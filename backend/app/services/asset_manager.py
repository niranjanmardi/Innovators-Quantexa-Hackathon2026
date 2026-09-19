import pandas as pd
from typing import Dict, Any, List, Optional
from app.services.market_data import get_market_data_provider
from app.services.cache import cache_service
import hashlib

class AssetManager:
    def __init__(self):
        self.provider = get_market_data_provider()

    def get_historical_data(self, symbol: str, start_date: str, end_date: str, interval: str = "1d") -> pd.DataFrame:
        cache_key = f"hist_{symbol}_{start_date}_{end_date}_{interval}"
        cached_data = cache_service.get(cache_key)
        
        if cached_data is not None:
            return pd.DataFrame(cached_data)
            
        df = self.provider.fetch_historical_data(symbol, start_date, end_date, interval)
        if not df.empty:
            # We must convert timestamps to string for JSON serialization in the cache
            df['timestamp'] = df['timestamp'].astype(str)
            cache_service.set(cache_key, df.to_dict(orient="records"), ttl_seconds=3600)
            # Revert back to datetime for internal use
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        return df

    def get_latest_price(self, symbol: str) -> Dict[str, Any]:
        cache_key = f"price_{symbol}"
        cached_data = cache_service.get(cache_key)
        if cached_data is not None:
            return cached_data
            
        data = self.provider.fetch_latest_price(symbol)
        if data:
            # Cache latest price for a short time (e.g. 5 minutes) to avoid rate limits
            cache_service.set(cache_key, data, ttl_seconds=300)
        return data

    def search(self, query: str) -> List[Dict[str, str]]:
        cache_key = f"search_{query}"
        cached_data = cache_service.get(cache_key)
        if cached_data is not None:
            return cached_data
            
        results = self.provider.search_assets(query)
        if results:
            cache_service.set(cache_key, results, ttl_seconds=86400) # Cache searches for a day
        return results

asset_manager = AssetManager()
