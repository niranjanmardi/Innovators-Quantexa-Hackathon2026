# Backtesting Engine & Methodology

## 1. Overview & Philosophy

The backtesting engine models real portfolio execution over historical asset price data. Rather than displaying theoretical buy/sell markers, it simulates a realistic trading account with cash balance, position sizing, brokerage commission, and market slippage.

> **Key Differentiator**: *"Don't just show the backtest. Test whether the backtest deserves to be trusted."*

---

## 2. Core Strategies

### A. SMA Crossover
- **Signals**: Long (1.0) when Fast SMA > Slow SMA; Flat (0.0) when Fast SMA <= Slow SMA.
- **Formulation**:
  $$\text{SMA}_k(t) = \frac{1}{k}\sum_{i=0}^{k-1} P_{t-i}$$
- **Parameters**: `fast_period` (default: 20), `slow_period` (default: 50).

### B. EMA Trend
- **Signals**: Exponential Moving Average crossover strategy giving higher weight to recent prices.
- **Formulation**:
  $$\text{EMA}_t = \alpha \cdot P_t + (1 - \alpha)\cdot \text{EMA}_{t-1}, \quad \alpha = \frac{2}{N+1}$$
- **Parameters**: `fast_period` (default: 12), `slow_period` (default: 26).

### C. Momentum Strategy
- **Signals**: Long (1.0) when asset returns over the lookback window are positive; Flat (0.0) otherwise.
- **Formulation**:
  $$\text{Signal}_t = \mathbf{1}\left(\frac{P_t - P_{t-L}}{P_{t-L}} > 0\right)$$
- **Parameters**: `lookback_period` (default: 20 days).

### D. Mean Reversion Strategy
- **Signals**: Statistical arbitrage on rolling standard deviations (Z-score).
- **Formulation**:
  $$Z_t = \frac{P_t - \mu_t(w)}{\sigma_t(w)}$$
  - Buy when $Z_t < -\theta$ (oversold condition).
  - Exit when $Z_t > +\theta$ (overbought condition).
- **Parameters**: `window` (default: 20 days), `z_score_threshold` (default: 1.5).

---

## 3. Look-Ahead Bias & Execution Realism

### Zero Look-Ahead Bias Guarantee
In live trading, a decision generated at the close of Day $T$ can only be executed at Day $T+1$.
The engine mathematically prevents look-ahead bias by shifting raw indicator signals:
$$\text{Execution Signal}_t = \text{Signal}_{t-1}$$
No historical trading decision uses future closing prices.

### Transaction Costs & Slippage Modeling
- **Broker Commission**: $0.10\%$ ($0.0010$) per trade volume.
- **Execution Slippage**: $0.05\%$ ($0.0005$) price penalty on buys ($P \cdot (1 + \text{slip})$) and sells ($P \cdot (1 - \text{slip})$).
- **Trade Traceability**: Every execution logs:
  - Timestamp
  - Action (BUY / SELL)
  - Execution price (adjusted for slippage)
  - Quantity traded
  - Commission fee paid
  - Slippage experienced

---

## 4. Benchmark Comparison

Every strategy execution is accompanied by an identical Buy-and-Hold benchmark over the same period with identical starting capital ($10,000). Metrics compared:
- Total Return
- Annualized Volatility
- Sharpe Ratio
- Maximum Drawdown
- Total Number of Trades

---

## 5. Backtest Trust Engine

The Trust Engine performs algorithmic integrity checks:
1. **Look-Ahead Bias Test**: Validates signal shift mechanism.
2. **Data Leakage Check**: Validates separation of signal generation parameters.
3. **Parameter Sensitivity Analysis**: Evaluates performance delta across neighboring parameter values ($\pm 5$ bars). Flags instability as `LOW`, `MEDIUM`, or `HIGH`.
4. **Transaction Cost Sensitivity**: Re-runs simulation with 5x higher costs ($0.5\%$ fee, $0.2\%$ slippage). If return drops drastically, it warns of high cost sensitivity.
