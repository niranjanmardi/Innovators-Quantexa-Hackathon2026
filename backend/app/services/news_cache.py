# -*- coding: utf-8 -*-
import os
import time
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone


class NewsCache:
    """
    Dedicated NewsCache supporting fresh and stale-fallback caching,
    TTL invalidation, single-flight locking, and metadata introspection.
    """

    def __init__(self, ttl_minutes: Optional[int] = None):
        self.ttl_minutes = ttl_minutes or int(os.getenv("NEWS_CACHE_TTL_MINUTES", 30))
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._stale_backup: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self.last_fetched_at: Optional[str] = None

    @property
    def ttl_seconds(self) -> int:
        return int(os.getenv("NEWS_CACHE_TTL_MINUTES", self.ttl_minutes)) * 60

    def get_lock(self) -> asyncio.Lock:
        return self._lock

    def get(self, key: str) -> Tuple[Optional[List[Dict[str, Any]]], bool, Optional[str]]:
        """
        Returns: (articles, is_stale, cached_at_iso)
        - If fresh cache hit: (articles, False, cached_at)
        - If cache expired but stale backup exists: (articles, True, cached_at)
        - If completely empty: (None, False, None)
        """
        now = time.time()
        entry = self._cache.get(key)
        if entry:
            if now <= entry["expires_at"]:
                return entry["articles"], False, entry["cached_at"]
            else:
                # Expired: move to stale backup if not already there, and clear from active fresh cache
                self._stale_backup[key] = entry
                del self._cache[key]

        # Check stale backup
        stale_entry = self._stale_backup.get(key)
        if stale_entry:
            return stale_entry["articles"], True, stale_entry["cached_at"]

        return None, False, None

    def set(self, key: str, articles: List[Dict[str, Any]], ttl_seconds: Optional[int] = None):
        now = time.time()
        ttl = ttl_seconds if ttl_seconds is not None else self.ttl_seconds
        iso_now = datetime.now(timezone.utc).isoformat()
        self.last_fetched_at = iso_now

        payload = {
            "articles": articles,
            "cached_at": iso_now,
            "cached_timestamp": now,
            "expires_at": now + ttl
        }
        self._cache[key] = payload
        self._stale_backup[key] = payload

    def get_stale(self, key: str) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
        """Directly retrieve stale cached articles if available."""
        entry = self._cache.get(key) or self._stale_backup.get(key)
        if entry:
            return entry["articles"], entry["cached_at"]
        return None, None

    def purge_expired(self, max_age_seconds: int = 86400):
        """Purge stale backups older than max_age_seconds."""
        now = time.time()
        to_del = [
            k for k, v in self._stale_backup.items()
            if now - v.get("cached_timestamp", 0) > max_age_seconds
        ]
        for k in to_del:
            del self._stale_backup[k]

    def get_status(self) -> Dict[str, Any]:
        """Calculates cache age and count of cached articles for active or stale sets."""
        now = time.time()
        latest_entry = None
        latest_ts = 0.0

        for entry in list(self._cache.values()) + list(self._stale_backup.values()):
            if entry.get("cached_timestamp", 0) > latest_ts:
                latest_ts = entry["cached_timestamp"]
                latest_entry = entry

        cache_age_seconds = int(now - latest_ts) if latest_ts > 0 else None
        articles_count = len(latest_entry["articles"]) if latest_entry else 0

        return {
            "last_fetched_at": self.last_fetched_at or (latest_entry["cached_at"] if latest_entry else None),
            "cache_age_seconds": cache_age_seconds,
            "articles_cached": articles_count,
            "ttl_minutes": int(os.getenv("NEWS_CACHE_TTL_MINUTES", self.ttl_minutes)),
            "is_cached": articles_count > 0
        }

news_cache = NewsCache()
