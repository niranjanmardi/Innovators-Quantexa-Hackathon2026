# Quantitative Methods & Mathematical Formulations

This document details all mathematical and statistical formulas implemented in the `QuantEngine` (`quant_engine.py`).

---

## 1. Returns Analysis

### Daily Simple Return
$$R_t = \frac{P_t - P_{t-1}}{P_{t-1}}$$

### Cumulative Return
$$\text{CumRet}_t = \prod_{i=1}^t (1 + R_i) - 1$$

---

## 2. Volatility Modeling

### Sample Historical Volatility
$$\sigma_{\text{daily}} = \sqrt{\frac{1}{N-1}\sum_{t=1}^N (R_t - \bar{R})^2}$$

### Annualized Volatility
Assuming 252 trading days per year:
$$\sigma_{\text{annual}} = \sigma_{\text{daily}} \times \sqrt{252}$$

### Rolling Volatility
For a rolling window $W$ (e.g., 30 days):
$$\sigma_{\text{rolling}, t} = \sqrt{\frac{1}{W-1}\sum_{i=0}^{W-1} (R_{t-i} - \bar{R}_{t,W})^2} \times \sqrt{252}$$

---

## 3. Risk-Adjusted Performance

### Sharpe Ratio
Calculated with explicit annualization and risk-free rate assumption:
$$\text{Sharpe} = \frac{\bar{R}_{\text{excess}}}{\sigma_{\text{excess}}} \times \sqrt{252}$$
where $R_{\text{excess}, t} = R_t - \frac{R_f}{252}$.
Default risk-free rate $R_f = 0.0$ (transparently documented and configurable).

---

## 4. Maximum Drawdown & Duration

### Running Peak & Drawdown Series
$$\text{Peak}_t = \max_{i \le t} (\text{Portfolio Value}_i)$$
$$\text{DD}_t = \frac{\text{Portfolio Value}_t - \text{Peak}_t}{\text{Peak}_t}$$

### Maximum Drawdown (MDD)
$$\text{MDD} = \min_t (\text{DD}_t)$$

### Drawdown Duration
$$\text{Duration} = \text{Date}(\text{Trough}) - \text{Date}(\text{Peak})$$

---

## 5. Cross-Asset Correlation Analysis

### Pearson Correlation Coefficient
For two aligned asset price return series $X$ and $Y$:
$$\rho_{X,Y} = \frac{\sum_{i=1}^n (X_i - \bar{X})(Y_i - \bar{Y})}{\sqrt{\sum_{i=1}^n (X_i - \bar{X})^2 \sum_{i=1}^n (Y_i - \bar{Y})^2}}$$
Values range from $-1.0$ (perfect inverse correlation) through $0.0$ (uncorrelated) to $+1.0$ (perfect positive correlation).

---

## 6. Market Regime Classification

Market regimes are classified deterministically without arbitrary clustering:
1. Compute rolling cumulative return $R_{60}$ and rolling volatility $\sigma_{60}$ over a 60-day window.
2. Determine market baseline volatility threshold as $\text{Median}(\sigma_{60})$.
3. Classify each historical trading day:
   - **Bull / Low Volatility**: $R_{60} > 0$ and $\sigma_{60} \le \text{Median}$
   - **Bull / High Volatility**: $R_{60} > 0$ and $\sigma_{60} > \text{Median}$
   - **Bear / Low Volatility**: $R_{60} \le 0$ and $\sigma_{60} \le \text{Median}$
   - **Bear / High Volatility**: $R_{60} \le 0$ and $\sigma_{60} > \text{Median}$
