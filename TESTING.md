# Testing Suite & Verification Guide

## 1. Automated Test Architecture

The automated test suite is located in `backend/tests/test_quant.py` and runs using Python's native `unittest` module.

### How to Run Tests
```bash
cd backend
.\venv\Scripts\Activate.ps1
python -m unittest tests/test_quant.py -v
```

---

## 2. Test Cases Covered

| Test Method | Category | Verified Requirement |
|---|---|---|
| `test_sma_calculation` | Quantitative Engine | Mathematically verified 3-period rolling average and NaN behavior |
| `test_ema_calculation` | Quantitative Engine | Exponential weighting correctness across length of series |
| `test_returns_calculation` | Quantitative Engine | Daily percentage change and cumulative return formulation |
| `test_volatility_and_sharpe` | Quantitative Engine | Annualized standard deviation and excess return Sharpe ratio |
| `test_drawdown_calculation` | Quantitative Engine | Peak-to-trough decline tracking and duration identification |
| `test_correlation_matrix` | Cross-Asset Analysis | Pearson correlation on aligned multi-asset series |
| `test_look_ahead_bias_protection` | Backtest Integrity | Validates that signal at $T$ executes strictly at $T+1$ |
| `test_realistic_costs_and_slippage` | Backtest Engine | Confirms fees and slippage realistically penalize trading returns |
| `test_all_four_strategies` | Strategy Engine | Executes SMA, EMA Trend, Momentum, Mean Reversion & Benchmark |
| `test_trust_and_stress_engines` | Diagnostics | Validates parameter sensitivity scans and stress multiplier testing |
| `test_regime_and_autopsy` | Diagnostics | Validates deterministic 4-regime classification and autopsy breakdown |

---

## 3. Frontend Typecheck & Build Verification

### Typecheck
```bash
cd frontend
npx tsc --noEmit
```
*Result: 0 errors.*

### Production Build
```bash
cd frontend
npm run build
```
*Result: Compiled successfully.*

---

## 4. Manual Verification Steps

1. **Live Dashboard Check**: Open `http://localhost:3000`, toggle between `NVDA`, `BTC-USD`, `GLD`, and `AAPL` chips to observe real-time price changes.
2. **Asset Analysis**: Open `http://localhost:asset`, search `NVDA`, and observe the Close Price with SMA 20 / SMA 50 overlays, daily return bars, and rolling volatility chart.
3. **Correlation Matrix**: Navigate to `/correlation`, click "Calculate Correlation" to view the color-coded heatmap.
4. **Strategy Simulation**: Navigate to `/strategy`, select "Momentum" or "Mean Reversion", run backtest, and inspect:
   - *Equity Curve vs Benchmark*
   - *Backtest Trust Engine Badges*
   - *Stress Test Lab Comparison Table*
   - *Market Regime Breakdown*
   - *Strategy Autopsy Report*
