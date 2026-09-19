from typing import Dict, Any, List

class StrategyAutopsy:
    @staticmethod
    def generate_autopsy(backtest_result: Dict[str, Any]) -> Dict[str, Any]:
        trades = backtest_result.get("trades", [])
        
        if not trades:
            return {"message": "No trades executed to perform autopsy."}
            
        winning_trades = []
        losing_trades = []
        
        # Approximate profit per trade (assuming basic entry/exit pairs)
        # For simplicity, we just look at cost and slippage, and overall return
        # A more complex system would match BUY and SELL pairs.
        
        # Let's find biggest drawdown date from history
        history = backtest_result.get("history", [])
        max_dd = 0
        max_dd_date = None
        
        peak = 0
        for day in history:
            pv = day["portfolio_value"]
            if pv > peak:
                peak = pv
            dd = (peak - pv) / peak if peak > 0 else 0
            if dd > max_dd:
                max_dd = dd
                max_dd_date = day["timestamp"]

        total_fees = sum(t["cost"] for t in trades)
        total_slippage = sum(t["slippage"] for t in trades)
        
        # Conclusion generation based on metrics
        return_pct = backtest_result["total_return"]
        
        reasons_good = []
        reasons_bad = []
        
        if return_pct > 0.1:
            reasons_good.append("Captured significant trend movements.")
        elif return_pct < 0:
            reasons_bad.append("Failed to adapt to market direction.")
            
        if total_fees > (backtest_result["initial_capital"] * 0.05):
            reasons_bad.append("High transaction costs eroded profits due to frequent trading.")
            
        if backtest_result["max_drawdown"] > 0.3:
            reasons_bad.append("Strategy lacks sufficient downside protection, leading to deep drawdowns.")
            
        if not reasons_good:
            reasons_good.append("Maintained consistent risk exposure.")
        if not reasons_bad:
            reasons_bad.append("No critical weaknesses identified in this period.")

        return {
            "largest_drawdown_date": max_dd_date,
            "total_fees_paid": total_fees,
            "total_slippage_experienced": total_slippage,
            "reasons_good": reasons_good,
            "reasons_bad": reasons_bad
        }

strategy_autopsy = StrategyAutopsy()
