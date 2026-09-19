import unittest
import pandas as pd
import numpy as np
from app.services.quant_engine import quant_engine
from app.services.backtest_engine import backtest_engine
from app.services.trust_engine import trust_engine
from app.services.stress_test import stress_test_lab
from app.services.regime_engine import regime_engine
from app.services.strategy_autopsy import strategy_autopsy

class TestQuantitativeEngine(unittest.TestCase):
    def setUp(self):
        # Deterministic price series for rigorous mathematical verification
        dates = pd.date_range('2023-01-01', periods=10, freq='D')
        self.df = pd.DataFrame({
            'timestamp': dates,
            'open': [100.0, 102.0, 101.0, 105.0, 107.0, 106.0, 108.0, 110.0, 109.0, 112.0],
            'high': [103.0, 104.0, 103.0, 106.0, 108.0, 108.0, 110.0, 112.0, 111.0, 114.0],
            'low': [99.0, 100.0, 100.0, 103.0, 105.0, 104.0, 106.0, 108.0, 107.0, 110.0],
            'close': [100.0, 102.0, 101.0, 105.0, 107.0, 106.0, 108.0, 110.0, 109.0, 112.0],
            'volume': [1000] * 10
        })

    def test_sma_calculation(self):
        sma = quant_engine.calculate_sma(self.df, period=3)
        self.assertTrue(np.isnan(sma.iloc[0]))
        self.assertTrue(np.isnan(sma.iloc[1]))
        # (100 + 102 + 101) / 3 = 101.0
        self.assertAlmostEqual(sma.iloc[2], 101.0, places=4)
        # (102 + 101 + 105) / 3 = 102.6667
        self.assertAlmostEqual(sma.iloc[3], 102.666667, places=4)

    def test_ema_calculation(self):
        ema = quant_engine.calculate_ema(self.df, period=3)
        self.assertEqual(len(ema), len(self.df))
        self.assertFalse(np.isnan(ema.iloc[-1]))

    def test_returns_calculation(self):
        daily = quant_engine.calculate_daily_returns(self.df)
        self.assertTrue(np.isnan(daily.iloc[0]))
        # (102 - 100) / 100 = 0.02
        self.assertAlmostEqual(daily.iloc[1], 0.02, places=4)

        cum = quant_engine.calculate_cumulative_returns(self.df)
        # Final price 112 vs initial 100 = 0.12
        self.assertAlmostEqual(cum.iloc[-1], 0.12, places=4)

    def test_volatility_and_sharpe(self):
        vol = quant_engine.calculate_annualized_volatility(self.df)
        self.assertGreater(vol, 0.0)

        sharpe = quant_engine.calculate_sharpe_ratio(self.df, risk_free_rate=0.0)
        self.assertIsInstance(sharpe, float)

    def test_drawdown_calculation(self):
        dd_info = quant_engine.calculate_maximum_drawdown(self.df)
        self.assertIn("max_drawdown", dd_info)
        # Close prices: 100, 102, 101 (dd = (101-102)/102 = -0.0098), 105, 107, 106 (dd = -0.00934), 108, 110, 109, 112
        self.assertLessEqual(dd_info["max_drawdown"], 0.0)

    def test_correlation_matrix(self):
        df1 = self.df.copy()
        df2 = self.df.copy()
        df2['close'] = df2['close'] * 2.0  # Perfect linear correlation

        corr = quant_engine.calculate_correlation({"A": df1, "B": df2})
        self.assertAlmostEqual(corr.loc["A", "B"], 1.0, places=4)
        self.assertAlmostEqual(corr.loc["A", "A"], 1.0, places=4)


class TestBacktestingIntegrity(unittest.TestCase):
    def setUp(self):
        dates = pd.date_range('2023-01-01', periods=30, freq='D')
        np.random.seed(42)
        prices = [100.0]
        for _ in range(29):
            prices.append(prices[-1] * (1 + np.random.normal(0.001, 0.02)))
        self.df = pd.DataFrame({
            'timestamp': dates,
            'open': prices,
            'high': [p * 1.01 for p in prices],
            'low': [p * 0.99 for p in prices],
            'close': prices,
            'volume': [1000] * 30
        })

    def test_look_ahead_bias_protection(self):
        """Mandatory requirement 12: Signals at T must execute at T+1."""
        res = backtest_engine.run_sma_crossover(self.df, fast_period=3, slow_period=6, initial_capital=10000.0)
        trades = res['trades']
        if trades:
            # First bar cannot have a trade execution because signal is generated at bar T and shifted to T+1
            first_trade_ts = trades[0]['timestamp']
            self.assertNotEqual(first_trade_ts, str(self.df['timestamp'].iloc[0]))

    def test_realistic_costs_and_slippage(self):
        """Requirements 11: Transaction costs and slippage must degrade portfolio performance."""
        res_no_cost = backtest_engine.run_sma_crossover(
            self.df, fast_period=3, slow_period=6, initial_capital=10000.0,
            transaction_cost=0.0, slippage=0.0
        )
        res_high_cost = backtest_engine.run_sma_crossover(
            self.df, fast_period=3, slow_period=6, initial_capital=10000.0,
            transaction_cost=0.01, slippage=0.005
        )
        # With active trades, high costs must result in equal or lower final value
        if res_no_cost['num_trades'] > 0:
            self.assertLessEqual(res_high_cost['final_value'], res_no_cost['final_value'])

    def test_all_four_strategies(self):
        """Requirement 10: SMA, EMA Trend, Momentum, Mean Reversion must all execute cleanly."""
        res_sma = backtest_engine.run_sma_crossover(self.df, fast_period=3, slow_period=6)
        res_ema = backtest_engine.run_ema_trend(self.df, fast_period=3, slow_period=6)
        res_mom = backtest_engine.run_momentum(self.df, lookback_period=5)
        res_mr = backtest_engine.run_mean_reversion(self.df, window=5, z_score_threshold=1.0)
        res_bm = backtest_engine.run_benchmark(self.df)

        for res in [res_sma, res_ema, res_mom, res_mr, res_bm]:
            self.assertIn("total_return", res)
            self.assertIn("sharpe_ratio", res)
            self.assertIn("max_drawdown", res)
            self.assertIn("history", res)

    def test_trust_and_stress_engines(self):
        """Requirements 15, 17: Backtest Trust Engine & Stress Lab."""
        trust = trust_engine.evaluate_trust(
            backtest_engine.run_sma_crossover, self.df,
            base_params={"fast_period": 3, "slow_period": 6},
            param_variations=[{"fast_period": 4, "slow_period": 7}]
        )
        self.assertEqual(trust["look_ahead_bias"], "PASS")

        stress = stress_test_lab.run_stress_tests(
            backtest_engine.run_sma_crossover, self.df,
            base_params={"fast_period": 3, "slow_period": 6}
        )
        self.assertIn("base_case", stress)
        self.assertIn("higher_costs", stress)
        self.assertIn("volatility_shock", stress)

    def test_regime_and_autopsy(self):
        """Requirements 19, 21: Market Regime Analysis & Strategy Autopsy."""
        regimes = regime_engine.classify_regimes(self.df, window=5)
        self.assertIn("regime", regimes.columns)

        res = backtest_engine.run_sma_crossover(self.df, fast_period=3, slow_period=6)
        autopsy = strategy_autopsy.generate_autopsy(res)
        self.assertIn("total_fees_paid", autopsy)
        self.assertIn("reasons_good", autopsy)
        self.assertIn("reasons_bad", autopsy)


if __name__ == '__main__':
    unittest.main()
