import pandas as pd
from typing import Dict, Any, Callable

class StressTestLab:
    @staticmethod
    def run_stress_tests(
        strategy_func: Callable,
        df: pd.DataFrame,
        base_params: Dict[str, Any],
        initial_capital: float = 10000.0
    ) -> Dict[str, Any]:
        
        # Base Case
        base = strategy_func(df=df, initial_capital=initial_capital, transaction_cost=0.001, slippage=0.0005, **base_params)
        
        # Higher Costs (3x)
        high_cost = strategy_func(df=df, initial_capital=initial_capital, transaction_cost=0.003, slippage=0.0005, **base_params)
        
        # Higher Slippage (4x)
        high_slip = strategy_func(df=df, initial_capital=initial_capital, transaction_cost=0.001, slippage=0.002, **base_params)
        
        # Volatility Shock (Artificially increase price variance for stress test)
        # Note: True historical stress tests would use actual periods like 2008 or March 2020. 
        # Here we do a synthetic volatility shock to see if strategy survives choppy markets.
        df_shock = df.copy()
        returns = df_shock['close'].pct_change().fillna(0)
        df_shock['close'] = df_shock['close'].iloc[0] * (1 + (returns * 1.5)).cumprod()
        vol_shock = strategy_func(df=df_shock, initial_capital=initial_capital, transaction_cost=0.001, slippage=0.0005, **base_params)

        def extract_metrics(res):
            return {
                "return": res['total_return'],
                "sharpe": res['sharpe_ratio'],
                "drawdown": res['max_drawdown'],
                "trades": res['num_trades']
            }

        return {
            "base_case": extract_metrics(base),
            "higher_costs": extract_metrics(high_cost),
            "higher_slippage": extract_metrics(high_slip),
            "volatility_shock": extract_metrics(vol_shock)
        }

stress_test_lab = StressTestLab()
