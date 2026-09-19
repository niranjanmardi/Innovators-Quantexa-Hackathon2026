# Quantitative Multi-Asset Financial Intelligence & Backtesting Platform

## Overview

A production-quality FinTech/Quantitative Finance web application that collects, processes, and analyzes real historical market data across multiple asset classes (equities, crypto, commodities). The platform provides quantitative indicators, realistic strategy backtesting, trust analysis, stress testing, regime analysis, and AI-powered explainability.

**Live App:** http://localhost:3000  
**API Docs:** http://localhost:8000/docs

---

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate    # Windows
pip install -r requirements.txt
cp .env.example .env       # Fill in your keys
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Market overview + latest headlines |
| Asset Analysis | `/asset` | Price chart, SMA/EMA overlays, returns, volatility, related news |
| Correlation Lab | `/correlation` | Cross-asset Pearson correlation heatmap |
| Strategy Lab | `/strategy` | Run backtests across 4 strategies with full analytics |
| Market News | `/news` | NewsData.io headlines with category tabs |
| Data Sources | `/data-sources` | Provider status, cache info, credit usage |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
NEWSDATA_API_KEY=        # From newsdata.io (free plan works)
NEWS_CACHE_TTL_MINUTES=30
NEWS_MAX_ARTICLES=200
NEWS_DAILY_CREDIT_CAP=180
AI_API_KEY=              # Optional: Gemini or OpenAI key
AI_PROVIDER=gemini
```

---

## Important Rules

- **No mock data.** If a provider fails, the UI shows an error—never fabricated data.
- **No price predictions.** The AI layer explains computed results only.
- **No investment advice.** All outputs are for quantitative research only.
