from abc import ABC, abstractmethod
import os
import time
import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("news_provider")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [NewsProvider] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Custom Exceptions for clean, distinct handling
class NewsProviderError(Exception):
    """Base exception for news provider errors."""
    pass

class NewsAuthError(NewsProviderError):
    """Raised when authentication fails (401/403)."""
    pass

class NewsRateLimitError(NewsProviderError):
    """Raised when rate limit is exceeded (429)."""
    pass

class NewsInvalidRequestError(NewsProviderError):
    """Raised when request parameters are invalid (422)."""
    pass

class NewsServerError(NewsProviderError):
    """Raised when provider returns a 5xx error."""
    pass


class NewsProvider(ABC):
    @abstractmethod
    async def fetch_latest(
        self,
        category: Optional[str] = None,
        q: Optional[str] = None,
        page: Optional[str] = None,
        source: Optional[str] = None,
        removeduplicate: bool = True
    ) -> Dict[str, Any]:
        """Fetch latest news articles from provider."""
        pass


class YahooFinanceNewsProvider(NewsProvider):
    """
    Fallback news provider that fetches real-time financial market news
    using yfinance without requiring any API keys.
    """
    async def fetch_latest(
        self,
        category: Optional[str] = None,
        q: Optional[str] = None,
        page: Optional[str] = None,
        source: Optional[str] = None,
        removeduplicate: bool = True
    ) -> Dict[str, Any]:
        import yfinance as yf
        import asyncio

        tickers_to_query = ["SPY", "QQQ", "AAPL", "NVDA", "TSLA", "MSFT", "BTC-USD", "AMZN"]
        if category:
            cat = category.lower()
            if "crypto" in cat:
                tickers_to_query = ["BTC-USD", "ETH-USD", "SOL-USD"]
            elif "tech" in cat:
                tickers_to_query = ["AAPL", "NVDA", "MSFT", "GOOGL", "META"]
            elif "market" in cat or "business" in cat:
                tickers_to_query = ["SPY", "QQQ", "DIA", "IWM"]
        if q:
            clean_q = q.strip().upper()
            if len(clean_q) <= 6 and clean_q.isalpha():
                tickers_to_query = [clean_q] + tickers_to_query[:3]

        def get_all_news():
            results = []
            seen_titles = set()
            for sym in tickers_to_query:
                try:
                    t = yf.Ticker(sym)
                    items = t.news or []
                    for item in items:
                        c = item.get("content", item)
                        title = c.get("title") or item.get("title")
                        if not title or title in seen_titles:
                            continue
                        seen_titles.add(title)

                        click_through = c.get("clickThroughUrl") or {}
                        canonical = c.get("canonicalUrl") or {}
                        link = click_through.get("url") or canonical.get("url") or item.get("link")
                        if not link or not str(link).startswith("http"):
                            continue

                        desc = c.get("summary") or c.get("description") or item.get("summary") or item.get("description") or ""

                        thumb = c.get("thumbnail") or {}
                        image_url = None
                        if isinstance(thumb, dict):
                            resolutions = thumb.get("resolutions") or []
                            if resolutions and isinstance(resolutions, list):
                                image_url = resolutions[0].get("url")
                            if not image_url:
                                image_url = thumb.get("originalUrl")

                        prov = c.get("provider") or {}
                        source_name = prov.get("displayName") or item.get("publisher") or "Yahoo Finance"
                        pub_date = c.get("pubDate") or item.get("providerPublishTime")

                        results.append({
                            "article_id": str(item.get("id") or hash(link)),
                            "title": title,
                            "link": link,
                            "description": desc,
                            "image_url": image_url,
                            "source_name": source_name,
                            "source_id": source_name.lower().replace(" ", "_"),
                            "pubDate": pub_date,
                            "category": [category or "business", "finance"],
                            "keywords": [sym, "market", "finance"]
                        })
                except Exception as e:
                    logger.warning(f"Error fetching yfinance news for {sym}: {e}")
            return results

        loop = asyncio.get_event_loop()
        articles = await loop.run_in_executor(None, get_all_news)
        return {
            "status": "success",
            "totalResults": len(articles),
            "results": articles,
            "nextPage": None,
            "provider": "Yahoo Finance"
        }


class NewsDataProvider(NewsProvider):
    """
    Implementation of NewsProvider for NewsData.io with automatic fallback to Yahoo Finance.
    """

    def __init__(self):
        self.base_url = "https://newsdata.io/api/1/latest"
        self.fallback = YahooFinanceNewsProvider()

    @property
    def api_key(self) -> Optional[str]:
        key = os.getenv("NEWSDATA_API_KEY", "")
        if not key or key.strip() in ("", "your_newsdata_api_key_here", "None"):
            return None
        return key.strip()

    async def fetch_latest(
        self,
        category: Optional[str] = None,
        q: Optional[str] = None,
        page: Optional[str] = None,
        source: Optional[str] = None,
        removeduplicate: bool = True
    ) -> Dict[str, Any]:
        key = self.api_key
        if not key:
            logger.info("NEWSDATA_API_KEY is not configured. Automatically falling back to Yahoo Finance.")
            return await self.fallback.fetch_latest(category=category, q=q, page=page, source=source, removeduplicate=removeduplicate)

        params: Dict[str, Any] = {
            "apikey": key,
            "language": "en"
        }

        if removeduplicate:
            params["removeduplicate"] = 1

        if category:
            params["category"] = category.strip().lower()

        if q:
            clean_q = q.strip()[:100]
            params["q"] = clean_q

        if page:
            params["page"] = page.strip()

        if source:
            params["domain"] = source.strip()

        start_time = time.time()
        safe_params = {k: v for k, v in params.items() if k != "apikey"}
        safe_params["apikey"] = "***REDACTED***"
        logger.info(f"Initiating request to /api/1/latest with params: {safe_params}")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.base_url, params=params)
                duration = time.time() - start_time
                status = response.status_code

                logger.info(
                    f"Provider response status: {status} | Duration: {duration:.2f}s | Credits estimated: 1"
                )

                if status in (401, 403, 429) or status >= 500:
                    logger.warning(f"NewsData.io returned status {status}. Falling back to Yahoo Finance.")
                    return await self.fallback.fetch_latest(category=category, q=q, page=page, source=source, removeduplicate=removeduplicate)

                response.raise_for_status()
                res = response.json()
                res["provider"] = "NewsData.io"
                return res

        except Exception as exc:
            logger.warning(f"Error communicating with NewsData.io: {exc}. Falling back to Yahoo Finance.")
            return await self.fallback.fetch_latest(category=category, q=q, page=page, source=source, removeduplicate=removeduplicate)


def get_news_provider() -> NewsProvider:
    return NewsDataProvider()

