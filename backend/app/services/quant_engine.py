import pandas as pd
import numpy as np

class QuantEngine:
    @staticmethod
    def calculate_sma(df: pd.DataFrame, period: int, column: str = 'close') -> pd.Series:
        return df[column].rolling(window=period).mean()

    @staticmethod
    def calculate_ema(df: pd.DataFrame, period: int, column: str = 'close') -> pd.Series:
        return df[column].ewm(span=period, adjust=False).mean()

    @staticmethod
    def calculate_daily_returns(df: pd.DataFrame, column: str = 'close') -> pd.Series:
        return df[column].pct_change()

    @staticmethod
    def calculate_cumulative_returns(df: pd.DataFrame, column: str = 'close') -> pd.Series:
        daily_returns = QuantEngine.calculate_daily_returns(df, column)
        return (1 + daily_returns).cumprod() - 1

    @staticmethod
    def calculate_annualized_volatility(df: pd.DataFrame, column: str = 'close', periods_per_year: int = 252) -> float:
        daily_returns = QuantEngine.calculate_daily_returns(df, column)
        return float(daily_returns.std() * np.sqrt(periods_per_year))

    @staticmethod
    def calculate_rolling_volatility(df: pd.DataFrame, window: int, column: str = 'close', periods_per_year: int = 252) -> pd.Series:
        daily_returns = QuantEngine.calculate_daily_returns(df, column)
        return daily_returns.rolling(window=window).std() * np.sqrt(periods_per_year)

    @staticmethod
    def calculate_sharpe_ratio(df: pd.DataFrame, column: str = 'close', risk_free_rate: float = 0.0, periods_per_year: int = 252) -> float:
        daily_returns = QuantEngine.calculate_daily_returns(df, column).dropna()
        if len(daily_returns) == 0:
            return 0.0
        
        # Annualize the return and the risk free rate
        # Simple daily risk free rate assumption
        daily_rf = risk_free_rate / periods_per_year
        excess_returns = daily_returns - daily_rf
        
        if excess_returns.std() == 0:
            return 0.0
            
        sharpe = (excess_returns.mean() / excess_returns.std()) * np.sqrt(periods_per_year)
        return float(sharpe)

    @staticmethod
    def calculate_maximum_drawdown(df: pd.DataFrame, column: str = 'close') -> dict:
        cum_returns = QuantEngine.calculate_cumulative_returns(df, column)
        portfolio_value = (1 + cum_returns) * 100 # start at 100
        
        running_max = portfolio_value.cummax()
        drawdown = (portfolio_value - running_max) / running_max
        
        max_drawdown = float(drawdown.min())
        
        # Find duration
        try:
            end_date = drawdown.idxmin()
            # If no drawdown occurred
            if pd.isna(end_date):
                return {"max_drawdown": 0.0, "duration_days": 0}
                
            start_date = portfolio_value.loc[:end_date].idxmax()
            duration = (df.loc[end_date, 'timestamp'] - df.loc[start_date, 'timestamp']).days
        except Exception:
            duration = 0
            
        return {
            "max_drawdown": max_drawdown,
            "duration_days": duration
        }

    @staticmethod
    def calculate_correlation(df_dict: dict[str, pd.DataFrame], column: str = 'close') -> pd.DataFrame:
        """
        Calculates Pearson correlation matrix for multiple assets.
        df_dict: mapping of symbol -> historical dataframe
        """
        combined = pd.DataFrame()
        for symbol, df in df_dict.items():
            # Set index to timestamp to align dates
            temp_df = df.set_index('timestamp')[column].rename(symbol)
            if combined.empty:
                combined = temp_df.to_frame()
            else:
                combined = combined.join(temp_df, how='outer')
        
        # Forward fill then drop remaining NaNs to get clean correlation
        combined = combined.ffill().dropna()
        return combined.corr(method='pearson')

quant_engine = QuantEngine()
