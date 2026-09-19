# Data Sources & External Provider Specifications

This document outlines the external financial and news data providers integrated into the platform, their specifications, rate limits, and compliance terms.

---

## 1. Absolute Requirement: Real Data Only

The platform strictly prohibits mock, synthetic, or artificially generated prices.
- If an external provider is unreachable or returns empty data, the system surfaces:
  > *"Live market data is currently unavailable. Please try again later."*
- Missing data is never silently substituted with placeholder values.

---

## 2. Market Data Provider: Yahoo Finance (`yfinance`)

- **Interface**: Implemented via abstract class `MarketDataProvider` in `market_data.py`.
- **Supported Assets**:
  - Equities (e.g. `NVDA`, `AAPL`, `MSFT`, `SPY`)
  - Cryptocurrencies (e.g. `BTC-USD`, `ETH-USD`)
  - Commodities (e.g. `GLD`, `SLV`)
- **Data Retrieved**: Historical Open, High, Low, Close, Volume (OHLCV) and latest bid/ask quotes.
- **Timestamp Normalization**: Timezone information is converted to UTC and normalized to ISO 8601 strings.
- **Caching Layer**: Responses cached with a 1-hour TTL for historical bars and 5-minute TTL for latest market quotes.

---

## 3. News Intelligence Provider: NewsData.io (Addendum A3 Verification)

Verified against [NewsData.io Documentation](https://newsdata.io/documentation) and [NewsData.io Pricing](https://newsdata.io/pricing):

| Fact / Specification | Provider Reality & Implementation |
|---|---|
| **Authentication** | API Key sent exclusively via backend HTTP header/query parameter. Never exposed to browser or prefixed with `VITE_`. |
| **Endpoint** | `/api/1/latest` (news from the last 48 hours). Paid archive endpoint is not used. |
| **Free Plan Limits** | 200 credits/day, ~10 articles per credit, ~30 requests per 15 minutes. Delayed ~12 hours. |
| **Credit Budget** | Enforced in `news_service.py` with `NEWS_DAILY_CREDIT_CAP=180`. Further calls are blocked once the budget is reached. |
| **Pagination** | Uses `nextPage` cursor token parameter up to a maximum of 200 articles. |
| **Rate Limit Handling** | Distinct handling of HTTP 401, 403, 422, 429, and 5xx. Implements exponential backoff on HTTP 429. |
| **Single-Flight Lock** | `asyncio.Lock` ensures concurrent user requests trigger only one provider fetch. |
| **Duplicate Removal** | Supports provider-level `removeduplicate=1` parameter, with secondary backend deduplication by normalized URL and title. |
| **Query Constraints** | Keyword `q` parameter strictly capped at 100 characters per provider specification. |
| **Attribution & Terms** | Full source attribution ("Source: NewsData.io"), link to original publisher with `rel="noopener noreferrer"`. No full-text scraping. |
| **Paid-Only Filtering** | Detects and strips paid placeholder texts ("Upgrade to paid plan", "Only available in paid plan"). |
| **Compliance Notice** | News is provided as research context only. Never presented as a trading signal or financial recommendation. |

