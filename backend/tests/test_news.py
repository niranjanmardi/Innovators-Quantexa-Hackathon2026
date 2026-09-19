import unittest
import asyncio
import time
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone

from app.services.news_provider import (
    NewsProvider,
    NewsDataProvider,
    NewsAuthError,
    NewsRateLimitError,
    NewsInvalidRequestError,
    NewsServerError
)
from app.services.news_service import NewsService, clean_text, is_safe_https_url, normalize_url
from app.services.news_cache import NewsCache
from app.services.credit_budget import CreditBudget
from app.services.ai_explainer import ai_explainer


class TestNewsNormalizationAndSecurity(unittest.TestCase):
    def setUp(self):
        self.service = NewsService(provider=MagicMock())

    def test_normalization_valid_article(self):
        raw = {
            "article_id": "test_123",
            "title": "Federal Reserve Cuts Interest Rates by 25 bps",
            "link": "https://example.com/fed-cuts-rates?utm_source=twitter&utm_medium=social",
            "description": "The Federal Reserve voted to lower the benchmark borrowing rate.",
            "image_url": "https://example.com/images/fed.jpg",
            "source_id": "Reuters",
            "category": ["business", "finance"],
            "keywords": ["interest rates", "fed"],
            "pubDate": "2026-03-20 14:30:00"
        }
        normalized = self.service._normalize_article(raw)
        self.assertIsNotNone(normalized)
        self.assertEqual(normalized["id"], "test_123")
        self.assertEqual(normalized["title"], "Federal Reserve Cuts Interest Rates by 25 bps")
        self.assertEqual(normalized["link"], "https://example.com/fed-cuts-rates?utm_source=twitter&utm_medium=social")
        self.assertEqual(normalized["source_name"], "Reuters")
        self.assertIn("business", normalized["categories"])
        self.assertTrue(normalized["published_at"].startswith("2026-03-20"))

    def test_missing_mandatory_fields_returns_none(self):
        # Missing title
        no_title = {"link": "https://example.com/article"}
        self.assertIsNone(self.service._normalize_article(no_title))

        # Missing link
        no_link = {"title": "Valid Title"}
        self.assertIsNone(self.service._normalize_article(no_link))

        # Empty strings
        empty = {"title": "   ", "link": "https://example.com"}
        self.assertIsNone(self.service._normalize_article(empty))

    def test_paid_only_placeholder_stripping(self):
        raw_paid = {
            "title": "Premium Market Analysis",
            "link": "https://example.com/premium-article",
            "description": "This analysis is only available in paid plan. Upgrade to paid plan to read full content.",
        }
        normalized = self.service._normalize_article(raw_paid)
        self.assertIsNotNone(normalized)
        self.assertIsNone(normalized["description"])

    def test_html_tag_stripping_and_entity_decoding(self):
        raw_html = {
            "title": "Tesla &amp; Apple &lt;b&gt;Surge&lt;/b&gt; in After-Hours Trading",
            "link": "https://example.com/tesla-apple",
            "description": "<p>Stocks rallied &quot;strongly&quot; after <i>earnings</i> &copy; 2026.</p>"
        }
        normalized = self.service._normalize_article(raw_html)
        self.assertEqual(normalized["title"], "Tesla & Apple Surge in After-Hours Trading")
        self.assertEqual(normalized["description"], "Stocks rallied \"strongly\" after earnings © 2026.")

    def test_security_insecure_url_rejection(self):
        # HTTP is rejected
        http_item = {
            "title": "Insecure Link Test",
            "link": "http://example.com/insecure",
            "image_url": "http://example.com/image.png"
        }
        self.assertIsNone(self.service._normalize_article(http_item))

        # Javascript scheme rejected
        js_item = {
            "title": "XSS Link Test",
            "link": "javascript:alert(1)",
            "image_url": "data:text/html,<script>alert(1)</script>"
        }
        self.assertIsNone(self.service._normalize_article(js_item))

    def test_deduplication_by_url_and_title(self):
        articles = [
            {
                "id": "1",
                "title": "Oil Prices Surge to 6-Month High",
                "link": "https://energy.com/oil-surge?utm_source=news",
                "description": "Oil spikes on supply concerns."
            },
            {
                "id": "2",
                "title": "Oil Prices Surge to 6-Month High", # duplicate title
                "link": "https://different.com/oil-high",
                "description": "Different url but identical title."
            },
            {
                "id": "3",
                "title": "Oil Prices Rise Sharply",
                "link": "https://energy.com/oil-surge/", # duplicate url (normalized)
                "description": "Different title but identical url."
            },
            {
                "id": "4",
                "title": "Gold Reaches New Record Peak",
                "link": "https://gold.com/record",
                "description": "Gold rally continues."
            }
        ]
        deduped = self.service._dedupe_articles(articles)
        self.assertEqual(len(deduped), 2)
        self.assertEqual(deduped[0]["id"], "1")
        self.assertEqual(deduped[1]["id"], "4")


class TestNewsCacheAndCreditBudget(unittest.IsolatedAsyncioTestCase):
    def test_credit_budget_enforcement(self):
        budget = CreditBudget(cap=5)
        # Reset today's key
        with patch.object(budget, "get_used_credits", return_value=0):
            self.assertTrue(budget.can_fetch(1))
            self.assertFalse(budget.is_capped())

        with patch.object(budget, "get_used_credits", return_value=5):
            self.assertFalse(budget.can_fetch(1))
            self.assertTrue(budget.is_capped())

    def test_cache_ttl_and_stale_fallback(self):
        cache = NewsCache(ttl_minutes=1) # 60 seconds
        articles = [{"id": "1", "title": "Cache Test Article", "link": "https://example.com/1"}]

        # Set in cache
        cache.set("test_key", articles, ttl_seconds=1)

        # Fresh hit
        cached, is_stale, cached_at = cache.get("test_key")
        self.assertEqual(len(cached), 1)
        self.assertFalse(is_stale)
        self.assertIsNotNone(cached_at)

        # Wait for expiration
        time.sleep(1.1)

        # Expired: should serve from stale backup
        stale_cached, is_stale, _ = cache.get("test_key")
        self.assertEqual(len(stale_cached), 1)
        self.assertTrue(is_stale)


class TestPaginationAndRateLimitHandling(unittest.IsolatedAsyncioTestCase):
    async def test_pagination_up_to_max_articles(self):
        mock_provider = AsyncMock()
        # Mock 3 pages of results
        page1 = {
            "results": [{"title": f"Article {i}", "link": f"https://example.com/{i}"} for i in range(10)],
            "nextPage": "cursor_page_2"
        }
        page2 = {
            "results": [{"title": f"Article {i}", "link": f"https://example.com/{i}"} for i in range(10, 20)],
            "nextPage": "cursor_page_3"
        }
        page3 = {
            "results": [{"title": f"Article {i}", "link": f"https://example.com/{i}"} for i in range(20, 25)],
            "nextPage": None # end of results
        }
        mock_provider.fetch_latest.side_effect = [page1, page2, page3]

        service = NewsService(provider=mock_provider)
        service.max_articles = 200

        with patch.object(service.budget, "is_capped", return_value=False), \
             patch.object(service.budget, "can_fetch", return_value=True), \
             patch.object(service.budget, "increment"):

            res = await service.fetch_news(category="business", force_refresh=True)
            self.assertEqual(res["total"], 25)
            self.assertEqual(mock_provider.fetch_latest.call_count, 3)

    async def test_stops_on_429_with_backoff(self):
        mock_provider = AsyncMock()
        page1 = {
            "results": [{"title": f"Article {i}", "link": f"https://example.com/{i}"} for i in range(5)],
            "nextPage": "cursor_page_2"
        }
        mock_provider.fetch_latest.side_effect = [page1, NewsRateLimitError("429 Rate Limit")]

        service = NewsService(provider=mock_provider)

        with patch.object(service.budget, "is_capped", return_value=False), \
             patch.object(service.budget, "can_fetch", return_value=True), \
             patch.object(service.budget, "increment"):

            res = await service.fetch_news(category="business", force_refresh=True)
            # Must return partial results gracefully
            self.assertEqual(res["total"], 5)
            self.assertIn("partial", res["message"].lower())


class TestAIExplainerNewsRules(unittest.TestCase):
    def test_explainer_does_not_claim_causation(self):
        articles = [
            {
                "title": "Fed Announces Rate Hike",
                "source_name": "Bloomberg",
                "published_at": "2026-03-20T10:00:00Z"
            }
        ]
        context = ai_explainer.contextualize_news(articles, "SPY")
        self.assertIn("does not imply causation", context)
        self.assertIn("Fed Announces Rate Hike", context)
        self.assertIn("Bloomberg", context)
        self.assertNotIn("caused", context)

    def test_explainer_historical_drawdown_disclaimer(self):
        autopsy = {
            "largest_drawdown_date": "2022-06-15",
            "reasons_good": ["Strong momentum"],
            "reasons_bad": ["High volatility"]
        }
        explanation = ai_explainer.explain_backtest(autopsy, {"total_return": 0.15})
        self.assertIn("News for this historical drawdown period is not available with the current data plan", explanation)


class TestNewsAPIEndpoints(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from main import app
        self.client = TestClient(app)

    def test_get_news_status_endpoint(self):
        resp = self.client.get("/api/news/status")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["provider"], "NewsData.io")
        self.assertIn("estimated_credits_used_today", data)
        self.assertIn("credit_cap", data)
        self.assertIn("provider_status", data)

    def test_get_latest_news_invalid_category(self):
        resp = self.client.get("/api/news/latest?category=invalid_category_xyz")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid category", resp.json()["detail"])

    def test_get_asset_news_endpoint(self):
        with patch("app.services.news_service.news_service.get_asset_news", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "articles": [
                    {
                        "id": "asset_art_1",
                        "title": "NVIDIA Launches Next-Gen AI Chip Architecture",
                        "link": "https://example.com/nvda-chip",
                        "source_name": "TechWire",
                        "categories": ["technology"],
                        "published_at": "2026-03-20T12:00:00Z",
                        "fetched_at": "2026-03-20T12:01:00Z",
                        "provider": "NewsData.io"
                    }
                ],
                "symbol": "NVDA",
                "total": 1,
                "relevance": "keyword-based"
            }
            resp = self.client.get("/api/news/asset?symbol=NVDA")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["symbol"], "NVDA")
            self.assertEqual(len(data["articles"]), 1)
            self.assertEqual(data["relevance"], "keyword-based")


if __name__ == '__main__':
    unittest.main()

