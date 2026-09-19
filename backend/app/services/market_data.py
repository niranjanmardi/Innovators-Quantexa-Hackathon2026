from abc import ABC, abstractmethod
import yfinance as yf
import pandas as pd
from typing import List, Dict, Any, Optional

class MarketDataProvider(ABC):
    @abstractmethod
    def fetch_historical_data(self, symbol: str, start_date: str, end_date: str, interval: str = "1d") -> pd.DataFrame:
        pass

    @abstractmethod
    def fetch_latest_price(self, symbol: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def search_assets(self, query: str) -> List[Dict[str, str]]:
        pass

class YFinanceProvider(MarketDataProvider):
    def fetch_historical_data(self, symbol: str, start_date: str, end_date: str, interval: str = "1d") -> pd.DataFrame:
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start_date, end=end_date, interval=interval)
        if df.empty:
            return df
        
        # Normalize index to timezone-naive UTC
        if df.index.tz is not None:
            df.index = df.index.tz_convert('UTC').tz_localize(None)
            
        df = df.reset_index()
        # Rename 'Date' or 'Datetime' to 'timestamp'
        if 'Date' in df.columns:
            df.rename(columns={'Date': 'timestamp'}, inplace=True)
        elif 'Datetime' in df.columns:
            df.rename(columns={'Datetime': 'timestamp'}, inplace=True)
            
        # Clean up columns, keeping only standard OHLCV
        df.columns = df.columns.str.lower()
        return df[['timestamp', 'open', 'high', 'low', 'close', 'volume']]

    def fetch_latest_price(self, symbol: str) -> Dict[str, Any]:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        # Handle cases where info might be missing
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        previous_close = info.get('previousClose') or info.get('regularMarketPreviousClose')
        
        if current_price is None or previous_close is None:
            # Fallback to history if info is broken (happens sometimes with yfinance)
            df = ticker.history(period="5d")
            if not df.empty:
                current_price = float(df['Close'].iloc[-1])
                previous_close = float(df['Close'].iloc[-2]) if len(df) > 1 else current_price
            else:
                return {}

        change = current_price - previous_close
        change_percent = (change / previous_close) * 100 if previous_close else 0

        return {
            "symbol": symbol,
            "name": info.get("shortName", symbol),
            "price": current_price,
            "change": change,
            "change_percent": change_percent,
            "timestamp": pd.Timestamp.now('UTC').isoformat(),
            "provider": "Yahoo Finance (yfinance)"
        }

    def search_assets(self, query: str) -> List[Dict[str, str]]:
        # yfinance doesn't have a built-in search API that works reliably,
        # but we can return some common ones if they match or just attempt to look up.
        # For a production app, we would use a proper search endpoint (like Alpha Vantage or similar)
        # Here we do a basic mock search over a predefined list just for discovery, 
        # but the actual data fetching is real.
        # Wait, the prompt says "NO MOCK/PREDEFINED FINANCIAL DATA". 
        # Does returning a list of available tickers count as mock data? 
        # "Do NOT hardcode the list. Allow: Asset search"
        # We need a real search API. Yahoo Finance has an undocumented search endpoint.
        import requests
        
        url = f"https://query2.finance.yahoo.com/v1/finance/search"
        params = {"q": query, "quotesCount": 5, "newsCount": 0}
        headers = {'User-Agent': 'Mozilla/5.0'}
        try:
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            quotes = data.get('quotes', [])
            results = []
            for q in quotes:
                if 'symbol' in q and 'shortname' in q:
                    results.append({
                        "symbol": q['symbol'],
                        "name": q['shortname'],
                        "type": q.get('quoteType', 'Unknown'),
                        "exchange": q.get('exchange', 'Unknown')
                    })
            return results
        except Exception as e:
            print(f"Search error: {e}")
            return []

# Factory method to get the active provider
def get_market_data_provider() -> MarketDataProvider:
    return YFinanceProvider()
