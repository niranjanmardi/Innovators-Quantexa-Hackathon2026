# Architecture

## System Overview

```
Browser (React + Vite)
        │
        │  REST/JSON
        ▼
FastAPI Backend (Python)
        │
    ┌───┴────────────────────────┐
    │                            │
MarketDataProvider          NewsProvider
(yfinance / Yahoo Finance)  (NewsData.io)
    │                            │
    ▼                            ▼
  CacheService             NewsService
  (In-memory / Redis)       (Cache + Credit Budget)
    │
    ▼
QuantEngine
(SMA, EMA, Returns, Volatility, Sharpe, Drawdown, Correlation)
    │
    ▼
BacktestEngine
(SMA Crossover, EMA Trend, Momentum, Mean Reversion)
    │
    ├── TrustEngine    (Look-ahead, sensitivity checks)
    ├── StressTestLab  (Cost/slippage/volatility scenarios)
    ├── RegimeEngine   (Bull/Bear/HighVol/LowVol classification)
    ├── StrategyAutopsy (Why did it work/fail?)
    └── AIExplainer    (LLM-based explanation of real computed data)
```

## Backend Services

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app entry point, CORS, router mount |
| `app/api/routes.py` | All REST endpoints |
| `app/services/market_data.py` | `MarketDataProvider` abstract class + `YFinanceProvider` |
| `app/services/asset_manager.py` | Orchestrates data fetch + caching |
| `app/services/cache.py` | Redis-first, in-memory fallback TTL cache |
| `app/services/quant_engine.py` | All quantitative indicator calculations |
| `app/services/backtest_engine.py` | Strategy simulation (4 strategies + benchmark) |
| `app/services/trust_engine.py` | Backtest integrity validation |
| `app/services/stress_test.py` | Stress scenario runner |
| `app/services/regime_engine.py` | Market regime classification |
| `app/services/strategy_autopsy.py` | Autopsy report generation |
| `app/services/ai_explainer.py` | AI explanation layer |
| `app/services/news_provider.py` | `NewsProvider` abstract class + `NewsDataProvider` |
| `app/services/news_service.py` | News fetch, normalize, dedupe, cache, credit budget |

## Frontend Pages

| File | Purpose |
|------|---------|
| `src/pages/Dashboard.tsx` | Price widget + news headlines |
| `src/pages/AssetAnalysis.tsx` | Full price/returns/volatility analysis |
| `src/pages/CorrelationLab.tsx` | Interactive correlation heatmap |
| `src/pages/StrategyLab.tsx` | Backtest, Trust, Stress, Regimes, Autopsy tabs |
| `src/pages/MarketNews.tsx` | Market news with category filters |
| `src/pages/DataSources.tsx` | Provider status and credit monitoring |

## Look-Ahead Bias Protection

Signals are generated at time T using data ≤ T, then `shift(1)` is applied so execution happens at T+1. This is enforced in every strategy in `backtest_engine.py`.
