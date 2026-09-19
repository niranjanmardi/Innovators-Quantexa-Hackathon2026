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


class NewsDataProvider(NewsProvider):
    """
    Implementation of NewsProvider for NewsData.io.
    Adheres strictly to free plan constraints, credential protection,
    and distinct HTTP status error handling.
    """

    def __init__(self):
        self.base_url = "https://newsdata.io/api/1/latest"

    @property
    def api_key(self) -> Optional[str]:
        key = os.getenv("NEWSDATA_API_KEY", "")
        # Protect against dummy default placeholders
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
            logger.warning("Fetch aborted: NEWSDATA_API_KEY is not configured.")
            raise NewsAuthError("NewsData.io API key is not configured or invalid.")

        params: Dict[str, Any] = {
            "apikey": key,
            "language": "en"
        }

        if removeduplicate:
            params["removeduplicate"] = 1

        if category:
            params["category"] = category.strip().lower()

        if q:
            # Enforce 100 character query limit per NewsData.io documentation
            clean_q = q.strip()[:100]
            params["q"] = clean_q

        if page:
            params["page"] = page.strip()

        if source:
            params["domain"] = source.strip()

        start_time = time.time()

        # Log provider call WITHOUT exposing API key
        safe_params = {k: v for k, v in params.items() if k != "apikey"}
        safe_params["apikey"] = "***REDACTED***"
        logger.info(f"Initiating request to /api/1/latest with params: {safe_params}")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.base_url, params=params)

                duration = time.time() - start_time
                status = response.status_code

                # Log call metrics (status, credits estimated: 1 credit per call, duration)
                logger.info(
                    f"Provider response status: {status} | Duration: {duration:.2f}s | Credits estimated: 1"
                )

                if status == 401 or status == 403:
                    logger.error(f"Authentication failure (HTTP {status}) from NewsData.io")
                    raise NewsAuthError(f"NewsData.io authentication failed with status {status}.")

                if status == 422:
                    logger.error("Unprocessable Entity (HTTP 422) from NewsData.io")
                    raise NewsInvalidRequestError("NewsData.io rejected the request parameters (HTTP 422).")

                if status == 429:
                    logger.warning("Rate limit exceeded (HTTP 429) from NewsData.io")
                    raise NewsRateLimitError("NewsData.io rate limit reached (HTTP 429).")

                if status >= 500:
                    logger.error(f"Server error (HTTP {status}) from NewsData.io")
                    raise NewsServerError(f"NewsData.io server returned status {status}.")

                response.raise_for_status()
                return response.json()

        except httpx.TimeoutException:
            logger.error("Request to NewsData.io timed out.")
            raise NewsServerError("NewsData.io request timed out.")
        except httpx.RequestError as exc:
            logger.error(f"Network error during NewsData.io request: {exc.__class__.__name__}")
            raise NewsServerError(f"Network error communicating with NewsData.io.")


def get_news_provider() -> NewsProvider:
    return NewsDataProvider()
