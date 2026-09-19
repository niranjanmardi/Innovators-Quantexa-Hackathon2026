# API Documentation

The Quantitative Multi-Asset Financial Intelligence & Backtesting Platform provides a REST API built with FastAPI. All endpoints return standard JSON responses and enforce strict input validation via Pydantic schemas.

Base URL: `http://localhost:8000/api`

---

## 1. System Health

### `GET /health`
Returns the status of the backend API service.
- **Response**: `{"status": "ok", "message": "Quant Platform API is running"}`

---

## 2. Market Data Endpoints

### `GET /assets/search?q={query}`
Searches external market data providers dynamically for assets matching the query keyword.
- **Query Parameters**:
  - `q` (string): Keyword, e.g. `NVDA`, `BTC`, `Gold`
- **Response**: List of matching assets with symbol, name, quote type, and exchange.

### `GET /market/latest?symbol={symbol}`
Fetches the latest available market quote from the configured provider (Yahoo Finance).
- **Query Parameters**:
  - `symbol` (string): e.g. `NVDA`, `BTC-USD`, `GLD`
- **Response**:
  ```json
  {
    "symbol": "NVDA",
    "name": "NVIDIA Corporation",
    "price": 128.50,
    "change": 2.45,
    "change_percent": 1.94,
    "timestamp": "2026-09-19T17:00:00Z",
    "provider": "Yahoo Finance (yfinance)"
  }
  ```

### `GET /market/history?symbol={symbol}&start_date={start}&end_date={end}&interval={interval}`
Fetches historical OHLCV data with normalized UTC timestamps.
- **Query Parameters**:
  - `symbol` (string): Asset symbol
  - `start_date` (YYYY-MM-DD)
  - `end_date` (YYYY-MM-DD)
  - `interval` (optional, default `1d`): Data bar interval
- **Response**: Array of normalized bar objects: `[{"timestamp": "2023-01-03", "open": 100, "high": 105, "low": 99, "close": 104, "volume": 1200000}, ...]`

---

## 3. Quantitative Analysis Endpoints

### `POST /analysis/indicators`
Calculates mathematical technical indicators and risk metrics for an asset.
- **Request Body**:
  ```json
  {
    "symbol": "NVDA",
    "start_date": "2022-01-01",
    "end_date": "2023-12-31",
    "sma_periods": [20, 50, 200],
    "ema_periods": [12, 26],
    "risk_free_rate": 0.02
  }
  ```
- **Response**: Returns daily returns, cumulative returns, annualized volatility, Sharpe ratio, max drawdown, and moving average arrays.

### `GET /analysis/correlation` or `POST /analysis/correlation`
Calculates Pearson cross-asset correlation matrix for multiple symbols.
- **Query Parameters**:
  - `symbols` (string): Comma-separated list of symbols (e.g. `NVDA,GLD,BTC-USD`)
  - `start_date` (YYYY-MM-DD)
  - `end_date` (YYYY-MM-DD)
- **Response**:
  ```json
  {
    "correlation": {
      "NVDA": {"NVDA": 1.0, "GLD": 0.12, "BTC-USD": 0.48},
      "GLD": {"NVDA": 0.12, "GLD": 1.0, "BTC-USD": -0.05},
      "BTC-USD": {"NVDA": 0.48, "GLD": -0.05, "BTC-USD": 1.0}
    },
    "symbols": ["NVDA", "GLD", "BTC-USD"],
    "failed_symbols": []
  }
  ```

---

## 4. Backtesting Engine Endpoints

### `POST /backtest/run`
Simulates realistic portfolio trading across historical market data.
- **Request Body**:
  ```json
  {
    "symbol": "NVDA",
    "start_date": "2020-01-01",
    "end_date": "2023-12-31",
    "strategy": "sma_crossover", // "sma_crossover" | "ema_trend" | "momentum" | "mean_reversion"
    "params": {
      "fast_period": 20,
      "slow_period": 50
    },
    "initial_capital": 10000.0
  }
  ```
- **Response**: Returns full portfolio simulation including:
  - `strategy`: Final value, total return, Sharpe, drawdown, annualized volatility, trade log, and equity curve history.
  - `benchmark`: Buy-and-hold equivalent performance.
  - `trust`: Look-ahead bias check, parameter sensitivity, and cost sensitivity.
  - `stress`: Adverse scenario testing (3x costs, 4x slippage, volatility shock).
  - `regimes`: Performance broken down by market regime.
  - `autopsy`: Detailed post-backtest trade and drawdown autopsy.
  - `ai_explanation`: Fact-based plain English analysis of computed results.

### `POST /backtest/robustness`
Runs the Backtest Trust Engine standalone to test parameter perturbation and cost sensitivity.

### `POST /backtest/stress-test`
Executes the Stress Test Lab across transaction cost, slippage, and volatility shock variations.

### `POST /regime/analyze`
Classifies the historical timeline into market regimes (Bull/Bear x High/Low Volatility).

### `POST /strategy/autopsy`
Generates factual autopsy diagnostics from backtest results.

### `POST /ai/explain`
Generates explainable research assistant notes without predictions.

---

## 5. News Intelligence Endpoints

### `GET /news/latest?category={category}&q={query}`
Fetches verified real market news from NewsData.io with TTL caching and credit management.

### `GET /news/asset?symbol={symbol}`
Retrieves news articles contextually related to a specific financial asset.

### `GET /news/status`
Returns provider health, credit usage estimates, and cache TTL settings.
