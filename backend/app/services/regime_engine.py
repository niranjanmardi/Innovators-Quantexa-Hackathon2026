import pandas as pd
import numpy as np
from typing import Dict, Any

class RegimeEngine:
    @staticmethod
    def classify_regimes(df: pd.DataFrame, window: int = 60) -> pd.DataFrame:
        data = df.copy()
        
        # Calculate returns and volatility
        data['daily_return'] = data['close'].pct_change()
        data['rolling_return'] = data['close'].pct_change(periods=window)
        data['rolling_volatility'] = data['daily_return'].rolling(window=window).std() * np.sqrt(252)
        
        # Thresholds
        median_vol = data['rolling_volatility'].median()
        
        regimes = []
        for i in range(len(data)):
            row = data.iloc[i]
            
            if pd.isna(row['rolling_return']) or pd.isna(row['rolling_volatility']):
                regimes.append("Unknown")
                continue
                
            if row['rolling_return'] > 0 and row['rolling_volatility'] <= median_vol:
                regimes.append("Bull / Low Vol")
            elif row['rolling_return'] > 0 and row['rolling_volatility'] > median_vol:
                regimes.append("Bull / High Vol")
            elif row['rolling_return'] <= 0 and row['rolling_volatility'] <= median_vol:
                regimes.append("Bear / Low Vol")
            else:
                regimes.append("Bear / High Vol")
                
        data['regime'] = regimes
        return data

    @staticmethod
    def analyze_strategy_by_regime(strategy_history: pd.DataFrame, regime_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Merge strategy history with regime classification to see performance in each regime.
        strategy_history must contain 'timestamp' and 'daily_return'
        """
        if strategy_history.empty or regime_df.empty:
            return {}
            
        strat = strategy_history.copy()
        strat['timestamp'] = pd.to_datetime(strat['timestamp']).dt.strftime('%Y-%m-%d')
        reg = regime_df.copy()
        reg['timestamp'] = pd.to_datetime(reg['timestamp']).dt.strftime('%Y-%m-%d')
        merged = pd.merge(strat, reg[['timestamp', 'regime']], on='timestamp', how='left')

        
        results = {}
        for regime in ["Bull / Low Vol", "Bull / High Vol", "Bear / Low Vol", "Bear / High Vol"]:
            regime_data = merged[merged['regime'] == regime]
            if len(regime_data) == 0:
                continue
                
            total_return = (1 + regime_data['daily_return']).prod() - 1
            volatility = regime_data['daily_return'].std() * np.sqrt(252) if len(regime_data) > 1 else 0
            
            results[regime] = {
                "days": len(regime_data),
                "return": total_return,
                "volatility": float(volatility)
            }
            
        return results

regime_engine = RegimeEngine()
