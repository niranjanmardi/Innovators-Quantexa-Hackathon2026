import json
import os
import time
from typing import Any, Optional
import redis

class CacheService:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL")
        self.use_redis = False
        self.redis_client = None
        self._in_memory_cache = {}
        
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                # Test connection
                self.redis_client.ping()
                self.use_redis = True
                print("Using Redis for caching.")
            except Exception as e:
                print(f"Redis connection failed, falling back to in-memory cache. Error: {e}")
        else:
            print("No REDIS_URL found, using in-memory cache.")

    def get(self, key: str) -> Optional[Any]:
        if self.use_redis:
            try:
                val = self.redis_client.get(key)
                return json.loads(val) if val else None
            except Exception:
                return None
        else:
            item = self._in_memory_cache.get(key)
            if item:
                if time.time() > item['expires_at']:
                    del self._in_memory_cache[key]
                    return None
                return item['value']
            return None

    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        if self.use_redis:
            try:
                self.redis_client.setex(key, ttl_seconds, json.dumps(value))
            except Exception:
                pass
        else:
            self._in_memory_cache[key] = {
                'value': value,
                'expires_at': time.time() + ttl_seconds
            }

cache_service = CacheService()
