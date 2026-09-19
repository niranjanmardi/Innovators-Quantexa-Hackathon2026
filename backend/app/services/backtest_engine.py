import pandas as pd
import numpy as np
from typing import List, Dict, Any
from app.services.quant_engine import quant_engine

class BacktestResult:
    def __init__(self, initial_capital: float):
        self.initial_capital = initial_capital
        self.portfolio_value = initial_capital
        self.cash = initial_capital
        self.position = 0.0
        self.trades = []
        self.history = []

class BacktestEngine:
    @staticmethod
    def run_sma_crossover(df: pd.DataFrame, fast_period: int, slow_period: int, 
                          initial_capital: float = 10000.0, transaction_cost: float = 0.001, slippage: float = 0.0005) -> Dict[str, Any]:
        
        # Ensure we don't modify original dataframe
        data = df.copy()
        
        # 1. Generate Indicators
        data['fast_sma'] = quant_engine.calculate_sma(data, fast_period)
        data['slow_sma'] = quant_engine.calculate_sma(data, slow_period)
        
        # 2. Generate Signals
        # 1 if fast > slow, else 0
        data['signal'] = np.where(data['fast_sma'] > data['slow_sma'], 1.0, 0.0)
        
        # 3. Prevent Look-ahead bias: Signal generated at T affects execution at T+1
        data['execution_signal'] = data['signal'].shift(1).fillna(0.0)
        
        return BacktestEngine._simulate_portfolio(data, initial_capital, transaction_cost, slippage)

    @staticmethod
    def _simulate_portfolio(data: pd.DataFrame, initial_capital: float, transaction_cost: float, slippage: float) -> Dict[str, Any]:
        cash = initial_capital
        position = 0.0
        trades = []
        portfolio_history = []
        
        for i in range(len(data)):
            row = data.iloc[i]
            timestamp = row['timestamp']
            price = row['close']
            signal = row['execution_signal']
            
            # Simple execution model: Go all in or out based on signal.
            # Realistically, we'd use 'open' price of T+1, but we shifted signal so 'close' at T+1 is also acceptable for daily if we assume execution at close.
            # To be strict on look-ahead, using the Close of the day the signal is active.
            
            # Current state
            current_value = cash + (position * price)
            
            target_position = 0.0
            if signal == 1.0:
                # Target 100% position
                target_position = current_value / price # Ignoring costs for target calculation
                
            # If position needs to change
            if abs(target_position - position) > 1e-5: # Tolerance
                qty_to_trade = target_position - position
                
                # Apply slippage to execution price
                exec_price = price * (1 + slippage) if qty_to_trade > 0 else price * (1 - slippage)
                
                trade_value = abs(qty_to_trade) * exec_price
                cost = trade_value * transaction_cost
                
                if qty_to_trade > 0: # Buy
                    # Recalculate affordable qty after costs
                    qty_to_trade = (cash) / (exec_price * (1 + transaction_cost))
                    trade_value = qty_to_trade * exec_price
                    cost = trade_value * transaction_cost
                    cash -= (trade_value + cost)
                    position += qty_to_trade
                else: # Sell
                    cash += (trade_value - cost)
                    position = 0.0 # Full exit
                    
                trades.append({
                    "timestamp": str(timestamp),
                    "action": "BUY" if qty_to_trade > 0 else "SELL",
                    "price": exec_price,
                    "quantity": abs(qty_to_trade),
                    "cost": cost,
                    "slippage": slippage * price * abs(qty_to_trade)
                })
                
            current_value = cash + (position * price)
            portfolio_history.append({
                "timestamp": str(timestamp),
                "portfolio_value": current_value,
                "cash": cash,
                "position": position,
                "close": price
            })
            
        history_df = pd.DataFrame(portfolio_history)
        
        # Calculate metrics on the strategy performance
        returns = quant_engine.calculate_daily_returns(history_df, 'portfolio_value').fillna(0.0)
        history_df['daily_return'] = returns
        
        final_val = float(history_df['portfolio_value'].iloc[-1])
        total_return = float((final_val / initial_capital) - 1) if initial_capital else 0.0
        sharpe = quant_engine.calculate_sharpe_ratio(history_df, 'portfolio_value')
        sharpe_val = 0.0 if (sharpe is None or np.isnan(sharpe)) else float(sharpe)
        drawdown_data = quant_engine.calculate_maximum_drawdown(history_df, 'portfolio_value')
        max_dd = float(drawdown_data.get('max_drawdown', 0.0))
        if np.isnan(max_dd):
            max_dd = 0.0
        volatility = quant_engine.calculate_annualized_volatility(history_df, 'portfolio_value')
        vol_val = 0.0 if (volatility is None or np.isnan(volatility)) else float(volatility)
        
        # Clean history dataframe so no NaNs enter JSON serialization
        history_clean = history_df.fillna(0.0)
        
        return {
            "initial_capital": initial_capital,
            "final_value": final_val,
            "total_return": total_return,
            "sharpe_ratio": sharpe_val,
            "max_drawdown": max_dd,
            "volatility": vol_val,
            "num_trades": len(trades),
            "trades": trades,
            "history": history_clean.to_dict(orient="records")
        }


    @staticmethod
    def run_benchmark(df: pd.DataFrame, initial_capital: float = 10000.0) -> Dict[str, Any]:
        """Runs a Buy and Hold benchmark for comparison."""
        data = df.copy()
        
        # Buy on day 1 and hold
        data['execution_signal'] = 1.0 
        
        # Zero costs for pure benchmark, or realistic costs for day 1. Let's use 0 costs to represent the asset's true return.
        return BacktestEngine._simulate_portfolio(data, initial_capital, transaction_cost=0.0, slippage=0.0)

    @staticmethod
    def run_ema_trend(df: pd.DataFrame, fast_period: int, slow_period: int,
                      initial_capital: float = 10000.0, transaction_cost: float = 0.001,
                      slippage: float = 0.0005) -> Dict[str, Any]:
        """EMA crossover trend-following strategy.
        
        Signal logic: Go long (1) when the fast EMA crosses above the slow EMA,
        stay flat (0) otherwise. Signal is shifted by 1 bar to avoid look-ahead bias.
        """
        data = df.copy()

        # 1. Generate Indicators
        data['fast_ema'] = quant_engine.calculate_ema(data, fast_period)
        data['slow_ema'] = quant_engine.calculate_ema(data, slow_period)

        # 2. Generate Signals: 1 if fast EMA > slow EMA, else 0
        data['signal'] = np.where(data['fast_ema'] > data['slow_ema'], 1.0, 0.0)

        # 3. Prevent look-ahead bias: execution at T+1
        data['execution_signal'] = data['signal'].shift(1).fillna(0.0)

        return BacktestEngine._simulate_portfolio(data, initial_capital, transaction_cost, slippage)

    @staticmethod
    def run_momentum(df: pd.DataFrame, lookback_period: int,
                     initial_capital: float = 10000.0, transaction_cost: float = 0.001,
                     slippage: float = 0.0005) -> Dict[str, Any]:
        """Price momentum strategy.
        
        Signal logic: Go long (1) when the close price today is higher than the close
        price `lookback_period` days ago (positive momentum), flat (0) otherwise.
        Signal is shifted by 1 bar to avoid look-ahead bias.
        """
        data = df.copy()

        # 1. Generate Signals: 1 if pct_change over lookback is positive, else 0
        data['signal'] = np.where(data['close'].pct_change(lookback_period) > 0, 1.0, 0.0)

        # 2. Prevent look-ahead bias: execution at T+1
        data['execution_signal'] = data['signal'].shift(1).fillna(0.0)

        return BacktestEngine._simulate_portfolio(data, initial_capital, transaction_cost, slippage)

    @staticmethod
    def run_mean_reversion(df: pd.DataFrame, window: int, z_score_threshold: float,
                           initial_capital: float = 10000.0, transaction_cost: float = 0.001,
                           slippage: float = 0.0005) -> Dict[str, Any]:
        """Z-score mean reversion strategy.
        
        Signal logic:
          - Buy  (1) when z-score < -z_score_threshold  (price is cheap vs. rolling mean)
          - Sell (0) when z-score >  z_score_threshold  (price is expensive vs. rolling mean)
          - Hold current position when z-score is between the thresholds
        Signal is shifted by 1 bar to avoid look-ahead bias.
        """
        data = df.copy()

        # 1. Rolling statistics
        data['rolling_mean'] = data['close'].rolling(window=window).mean()
        data['rolling_std']  = data['close'].rolling(window=window).std()

        # 2. Z-score
        data['z_score'] = (data['close'] - data['rolling_mean']) / data['rolling_std']

        # 3. Generate signal with hysteresis:
        #    Start with NaN, then assign based on threshold crossings
        signal = pd.Series(np.nan, index=data.index)
        signal[data['z_score'] < -z_score_threshold] = 1.0   # oversold → buy
        signal[data['z_score'] >  z_score_threshold] = 0.0   # overbought → sell/flat

        # Forward-fill so we hold the position between crossings, default to 0
        data['signal'] = signal.ffill().fillna(0.0)

        # 4. Prevent look-ahead bias: execution at T+1
        data['execution_signal'] = data['signal'].shift(1).fillna(0.0)

        return BacktestEngine._simulate_portfolio(data, initial_capital, transaction_cost, slippage)

backtest_engine = BacktestEngine()
