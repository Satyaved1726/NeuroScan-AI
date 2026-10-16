# -*- coding: utf-8 -*-
"""
CacheService Module.
Provides thread-safe in-memory caching with TTL (Time-To-Live) and size capping/eviction.
"""

import time
from typing import Dict, Any, Tuple, Optional
from threading import Lock

class CacheService:
    def __init__(self, ttl_seconds: int = 3600, max_size: int = 500):
        self.cache: Dict[str, Tuple[Dict[str, Any], float]] = {}
        self.ttl = ttl_seconds
        self.max_size = max_size
        self.lock = Lock()

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            if key not in self.cache:
                return None
            data, timestamp = self.cache[key]
            if time.time() - timestamp > self.ttl:
                del self.cache[key]
                return None
            return data

    def set(self, key: str, value: Dict[str, Any]) -> None:
        with self.lock:
            if len(self.cache) >= self.max_size:
                # Evict oldest 50 items
                sorted_keys = sorted(self.cache.keys(), key=lambda k: self.cache[k][1])
                for old_key in sorted_keys[:50]:
                    del self.cache[old_key]
            self.cache[key] = (value, time.time())

    def clear(self) -> None:
        with self.lock:
            self.cache.clear()

# Global cache instance
global_cache = CacheService()
