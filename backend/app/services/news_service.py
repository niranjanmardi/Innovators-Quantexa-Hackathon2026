import os
import re
import html
import time
import logging
import asyncio
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from dateutil import parser as date_parser

from app.services.news_provider import (
    get_news_provider,
    NewsProvider,
    NewsAuthError,
    NewsRateLimitError,
    NewsInvalidRequestError,
    NewsServerError,
    NewsProviderError
)
from app.services.news_cache import news_cache
from app.services.credit_budget import credit_budget
from app.services.asset_manager import asset_manager

logger = logging.getLogger("news_service")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [NewsService] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

PAID_PLACEHOLDER_PATTERNS = [
    re.compile(r"upgrade\s+to\s+paid\s+plan", re.IGNORECASE),
    re.compile(r"only\s+available\s+in\s+paid\s+plan", re.IGNORECASE),
    re.compile(r"paid\s+plan\s+feature", re.IGNORECASE),
    re.compile(r"subscribe\s+to\s+view", re.IGNORECASE),
]

TAG_RE = re.compile(r"<[^>]+>")

def clean_text(text: Optional[str]) -> str:
    """Safely strip HTML tags, unescape entities, and trim."""
    if not text:
        return ""
    # Unescape first so that encoded tags like &lt;b&gt; become <b>
    clean = html.unescape(text)
    # Strip all HTML tags
    clean = TAG_RE.sub("", clean)
    # Final unescape for any residual entities
    clean = html.unescape(clean)
    return clean.strip()


def is_safe_https_url(url: Optional[str]) -> Optional[str]:
    """Verify that a URL is non-empty, well-formed, and strictly HTTPS."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    try:
        parsed = urlparse(url)
        if parsed.scheme.lower() == "https" and parsed.netloc:
            return url
    except Exception:
        pass
    return None

def normalize_url(url: str) -> str:
    """Normalize URL by stripping tracking parameters (utm_*) and trailing slash."""
    try:
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        # Remove tracking parameters
        clean_query = {k: v for k, v in query.items() if not k.lower().startswith("utm_")}
        new_query = urlencode(clean_query, doseq=True)
        path = parsed.path.rstrip("/")
        normalized = urlunparse((parsed.scheme, parsed.netloc, path, parsed.params, new_query, ""))
        return normalized.lower()
    except Exception:
        return url.strip().lower()

def parse_iso_utc(date_str: Optional[str]) -> Optional[str]:
    """Convert any date string into normalized UTC ISO 8601 format."""
    if not date_str:
        return None
    try:
        dt = date_parser.parse(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat()
    except Exception:
        return None


class NewsService:
    """
    Orchestrates news fetching, normalization, deduplication, caching,
    credit budgeting, and asset-aware search.
    """

    def __init__(self, provider: Optional[NewsProvider] = None):
        self.provider = provider or get_news_provider()
        self.max_articles = int(os.getenv("NEWS_MAX_ARTICLES", 200))
        self.cache = news_cache
        self.budget = credit_budget

    def _normalize_article(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalize raw NewsData.io item into canonical Article model.
        Returns None if mandatory fields (title, link) are missing or invalid.
        """
        raw_title = item.get("title")
        raw_link = item.get("link")

        clean_title = clean_text(raw_title)
        safe_link = is_safe_https_url(raw_link)

        # Title and HTTPS link are mandatory
        if not clean_title or not safe_link:
            return None

        # Clean description and filter paid placeholders
        raw_desc = item.get("description")
        clean_desc = clean_text(raw_desc)
        for pattern in PAID_PLACEHOLDER_PATTERNS:
            if pattern.search(clean_desc):
                clean_desc = ""
                break

        # Categories & Keywords
        cats = item.get("category")
        if isinstance(cats, str):
            categories = [c.strip().lower() for c in cats.split(",") if c.strip()]
        elif isinstance(cats, list):
            categories = [clean_text(c).lower() for c in cats if c]
        else:
            categories = []

        raw_kw = item.get("keywords")
        if isinstance(raw_kw, str):
            keywords = [k.strip() for k in raw_kw.split(",") if k.strip()]
        elif isinstance(raw_kw, list):
            keywords = [clean_text(k) for k in raw_kw if k]
        else:
            keywords = []

        # Image and icon URLs strictly HTTPS
        image_url = is_safe_https_url(item.get("image_url"))
        source_icon = is_safe_https_url(item.get("source_icon"))
        source_url = is_safe_https_url(item.get("source_url"))

        # Published date normalized to UTC ISO
        pub_date = parse_iso_utc(item.get("pubDate") or item.get("published_at"))

        article_id = str(item.get("article_id") or item.get("id") or hash(safe_link))

        return {
            "id": article_id,
            "title": clean_title,
            "link": safe_link,
            "description": clean_desc if clean_desc else None,
            "image_url": image_url,
            "source_name": clean_text(item.get("source_id") or item.get("source_name")) or "NewsData.io",
            "source_url": source_url,
            "source_icon": source_icon,
            "categories": categories,
            "language": item.get("language") or "en",
            "country": item.get("country") if isinstance(item.get("country"), list) else ([item.get("country")] if item.get("country") else []),
            "keywords": keywords,
            "published_at": pub_date,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "provider": "NewsData.io"
        }

    def _dedupe_articles(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Deduplicate list of articles by canonical URL and title."""
        seen_urls = set()
        seen_titles = set()
        deduped = []

        for art in articles:
            url_norm = normalize_url(art["link"])
            title_norm = art["title"].lower().strip()

            if url_norm in seen_urls or title_norm in seen_titles:
                continue

            seen_urls.add(url_norm)
            seen_titles.add(title_norm)
            deduped.append(art)

        return deduped

    async def fetch_news(
        self,
        category: Optional[str] = None,
        q: Optional[str] = None,
        source: Optional[str] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Sequential 200-article fetch strategy:
        1. Fresh cache check (0 credits)
        2. Credit budget check (< 180 credits)
        3. Single-flight lock
        4. Sequential pagination with nextPage cursor
        5. 429 exponential backoff handling
        6. Stale cache fallback if provider fails
        """
        cat_key = (category or "all").lower()
        q_key = (q or "none").lower()
        src_key = (source or "none").lower()
        cache_key = f"news_{cat_key}_{q_key}_{src_key}"

        # 1. Fresh cache check
        if not force_refresh:
            cached_articles, is_stale, cached_at = self.cache.get(cache_key)
            if cached_articles is not None and not is_stale:
                return {
                    "articles": cached_articles,
                    "total": len(cached_articles),
                    "is_stale": False,
                    "cached_at": cached_at,
                    "message": None
                }

        # 2. Credit Budget Check
        if self.budget.is_capped():
            stale_articles, cached_at = self.cache.get_stale(cache_key)
            if stale_articles:
                return {
                    "articles": stale_articles,
                    "total": len(stale_articles),
                    "is_stale": True,
                    "cached_at": cached_at,
                    "message": f"Daily credit cap reached ({self.budget.cap} credits). Showing saved news from {cached_at}."
                }
            return {
                "articles": [],
                "total": 0,
                "is_stale": False,
                "cached_at": None,
                "message": f"Daily credit cap reached ({self.budget.cap} credits). News is currently unavailable."
            }

        # 3. Single-flight lock
        async with self.cache.get_lock():
            # Double check fresh cache inside lock
            if not force_refresh:
                cached_articles, is_stale, cached_at = self.cache.get(cache_key)
                if cached_articles is not None and not is_stale:
                    return {
                        "articles": cached_articles,
                        "total": len(cached_articles),
                        "is_stale": False,
                        "cached_at": cached_at,
                        "message": None
                    }

            articles: List[Dict[str, Any]] = []
            next_page: Optional[str] = None
            rate_limited = False
            last_error_msg: Optional[str] = None

            # 4. Sequential fetch loop up to max_articles
            while len(articles) < self.max_articles:
                if not self.budget.can_fetch(1):
                    logger.warning("Daily credit cap met during pagination. Stopping fetch.")
                    break

                try:
                    data = await self.provider.fetch_latest(
                        category=category if category != "top" else None,
                        q=q,
                        page=next_page,
                        source=source,
                        removeduplicate=True
                    )
                    # 1 credit consumed per successful provider request
                    self.budget.increment(1)

                    raw_results = data.get("results") or []
                    if not raw_results:
                        break

                    for item in raw_results:
                        norm = self._normalize_article(item)
                        if norm:
                            articles.append(norm)

                    articles = self._dedupe_articles(articles)

                    next_page = data.get("nextPage")
                    if not next_page:
                        break

                except NewsRateLimitError:
                    logger.warning("HTTP 429 encountered during pagination. Applying exponential backoff.")
                    rate_limited = True
                    await asyncio.sleep(2.0)
                    break

                except (NewsAuthError, NewsInvalidRequestError, NewsServerError) as err:
                    logger.error(f"Provider error during news fetch: {err}")
                    last_error_msg = str(err)
                    break

                except Exception as err:
                    logger.error(f"Unexpected error during news fetch: {err}")
                    last_error_msg = str(err)
                    break

            # 5. Stale Fallback on failure
            if not articles:
                stale_articles, cached_at = self.cache.get_stale(cache_key)
                if stale_articles:
                    msg = f"Showing saved news from {cached_at}."
                    if rate_limited:
                        msg += " (Provider rate limited)"
                    return {
                        "articles": stale_articles,
                        "total": len(stale_articles),
                        "is_stale": True,
                        "cached_at": cached_at,
                        "message": msg
                    }
                else:
                    return {
                        "articles": [],
                        "total": 0,
                        "is_stale": False,
                        "cached_at": None,
                        "message": "News is currently unavailable. Please try again later."
                    }

            # 6. Final Deduplication and Caching
            final_list = self._dedupe_articles(articles)[:self.max_articles]
            self.cache.set(cache_key, final_list)

            cached_at = datetime.now(timezone.utc).isoformat()
            msg = None
            if rate_limited:
                msg = "Returned partial news results due to provider rate limiting (429)."

            return {
                "articles": final_list,
                "total": len(final_list),
                "is_stale": False,
                "cached_at": cached_at,
                "message": msg
            }

    async def get_asset_news(self, symbol: str) -> Dict[str, Any]:
        """
        Asset-aware news retrieval (A8).
        Dynamically builds query from asset name and symbol.
        Reuses cached pool of news when possible to conserve credits.
        """
        clean_symbol = symbol.strip().upper()
        if not clean_symbol:
            return {"articles": [], "total": 0, "symbol": symbol, "relevance": "keyword-based"}

        # 1. Resolve asset name dynamically from market data provider
        asset_info = asset_manager.get_latest_price(clean_symbol) or {}
        company_name = clean_text(asset_info.get("name") or "")

        # Build dynamic query under 100-character limit
        terms = [clean_symbol]
        if company_name and company_name.upper() != clean_symbol:
            # Take primary entity token (e.g. "NVIDIA" from "NVIDIA Corporation")
            primary_name = re.sub(r"[,\.\(\)]", "", company_name).split()[0]
            if len(primary_name) > 2 and primary_name.upper() != clean_symbol:
                terms.append(primary_name)

        query = " OR ".join(terms)[:100]

        # 2. Check in-memory cached articles first for matching keywords to save credits
        status = self.cache.get_status()
        cached_articles, _, _ = self.cache.get("news_all_none_none")
        if cached_articles:
            pattern = re.compile(rf"\b({clean_symbol}|{'|'.join(re.escape(t) for t in terms)})\b", re.IGNORECASE)
            matching = [
                art for art in cached_articles
                if pattern.search(art["title"]) or (art.get("description") and pattern.search(art["description"]))
            ]
            if len(matching) >= 3:
                logger.info(f"Reusing {len(matching)} cached articles matching asset query: {query}")
                return {
                    "articles": matching[:20],
                    "total": len(matching),
                    "symbol": clean_symbol,
                    "query": query,
                    "source": "cached_pool",
                    "relevance": "keyword-based"
                }

        # 3. Controlled fetch with business category
        res = await self.fetch_news(category="business", q=query)
        res["symbol"] = clean_symbol
        res["query"] = query
        res["relevance"] = "keyword-based"
        return res

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive provider, cache, and budget status."""
        cache_status = self.cache.get_status()
        budget_status = self.budget.get_status()

        # Determine provider status
        key = getattr(self.provider, "api_key", None)
        if not key:
            prov_status = "unconfigured"
        elif budget_status["is_capped"]:
            prov_status = "credit_cap_reached"
        else:
            prov_status = "operational"

        return {
            "provider": "NewsData.io",
            "provider_status": prov_status,
            "last_fetched_at": cache_status.get("last_fetched_at"),
            "cache_age_seconds": cache_status.get("cache_age_seconds"),
            "articles_cached": cache_status.get("articles_cached", 0),
            "estimated_credits_used_today": budget_status["estimated_credits_used_today"],
            "credit_cap": budget_status["credit_cap"],
            "credits_remaining": budget_status["credits_remaining"],
            "ttl_minutes": cache_status.get("ttl_minutes", 30)
        }

news_service = NewsService()
