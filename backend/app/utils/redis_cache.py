"""
Redis Cache Utilities
Provides caching for repeated API requests with fallback mechanisms.
Optimized with orjson for faster JSON serialization.
"""

import hashlib
from typing import Optional, Any
from enum import Enum

import redis.asyncio as redis

from app.config import get_settings
from app.utils.logger import logger

# Try to use orjson for faster JSON serialization, fall back to standard json
try:
    import orjson
    _use_orjson = True
    logger.info("Using orjson for optimized JSON serialization")
except ImportError:
    import json
    _use_orjson = False
    logger.info("orjson not available, using standard json module")


def _json_dumps(obj: Any) -> str:
    """
    Serialize object to JSON string using fastest available method.
    
    Args:
        obj: Object to serialize
        
    Returns:
        JSON string
    """
    if _use_orjson:
        # orjson returns bytes, need to decode to str
        return orjson.dumps(obj, default=str).decode('utf-8')
    else:
        # Standard json module
        return json.dumps(obj, default=str)


def _json_loads(data: str) -> Any:
    """
    Deserialize JSON string to object using fastest available method.
    
    Args:
        data: JSON string
        
    Returns:
        Deserialized object
    """
    if _use_orjson:
        return orjson.loads(data)
    else:
        return json.loads(data)


class CacheStatus(Enum):
    """Cache operation status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"


class RedisClient:
    """Async Redis client wrapper with connection pooling and health tracking."""

    # Expose CacheStatus as a class attribute for external access
    CacheStatus = CacheStatus

    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._status = CacheStatus.UNAVAILABLE
        self._consecutive_failures = 0
        self._max_failures_before_degraded = 3
        self._max_failures_before_unavailable = 10
    
    async def get_client(self) -> Optional[redis.Redis]:
        """Get or create Redis client connection."""
        if self._status == CacheStatus.UNAVAILABLE and self._consecutive_failures >= self._max_failures_before_unavailable:
            # Don't even try if we're marked unavailable
            return None
            
        if self._client is None:
            settings = get_settings()
            if not settings.redis_url:
                self._status = CacheStatus.UNAVAILABLE
                return None
                
            try:
                self._client = redis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                )
                # Test connection
                await self._client.ping()
                self._status = CacheStatus.HEALTHY
                self._consecutive_failures = 0
                logger.info("Redis connection established")
            except Exception as e:
                self._consecutive_failures += 1
                self._update_status()
                logger.error(f"Failed to connect to Redis: {e}")
                self._client = None
                return None
                
        return self._client
    
    def _update_status(self):
        """Update cache status based on failure count."""
        if self._consecutive_failures >= self._max_failures_before_unavailable:
            if self._status != CacheStatus.UNAVAILABLE:
                logger.error(f"Redis marked as unavailable after {self._consecutive_failures} consecutive failures")
                self._status = CacheStatus.UNAVAILABLE
        elif self._consecutive_failures >= self._max_failures_before_degraded:
            if self._status != CacheStatus.DEGRADED:
                logger.warning(f"Redis marked as degraded after {self._consecutive_failures} consecutive failures")
                self._status = CacheStatus.DEGRADED
    
    def record_failure(self):
        """Record a cache operation failure."""
        self._consecutive_failures += 1
        self._update_status()
    
    def record_success(self):
        """Record a cache operation success."""
        if self._consecutive_failures > 0:
            self._consecutive_failures = 0
            if self._status != CacheStatus.HEALTHY:
                logger.info("Redis connection recovered, marked as healthy")
                self._status = CacheStatus.HEALTHY
    
    @property
    def status(self) -> CacheStatus:
        """Get current cache status."""
        return self._status
    
    @property
    def is_available(self) -> bool:
        """Check if cache is available for use."""
        return self._status != CacheStatus.UNAVAILABLE
    
    async def ping(self) -> bool:
        """Ping Redis server."""
        try:
            client = await self.get_client()
            if client:
                await client.ping()
                self.record_success()
                return True
        except Exception as e:
            self.record_failure()
            logger.error(f"Redis ping failed: {e}")
        return False
    
    async def close(self):
        """Close Redis connection."""
        if self._client:
            try:
                await self._client.close()
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")
            finally:
                self._client = None
                self._status = CacheStatus.UNAVAILABLE


# Global Redis client instance
redis_client = RedisClient()


# Namespace prefix for all CV-Wiz cache keys (prevents collisions with other apps)
CACHE_NAMESPACE = "cvwiz"
# Secondary index sets track keys per user/prefix so invalidation avoids SCAN
KEY_INDEX_PREFIX = f"{CACHE_NAMESPACE}:idx"


def generate_cache_key(user_id: str, job_description: str, prefix: str = "resume") -> str:
    """
    Generate a namespaced cache key based on user ID and job description hash.
    Format: cvwiz:{prefix}:{user_id}:{jd_hash}
    """
    # Hash the job description to create a consistent key
    jd_hash = hashlib.sha256(job_description.encode()).hexdigest()[:16]
    safe_user = user_id.replace(":", "_")
    safe_prefix = prefix.replace(":", "_")
    return f"{CACHE_NAMESPACE}:{safe_prefix}:{safe_user}:{jd_hash}"


def _index_set_key(user_id: str, prefix: str = "resume") -> str:
    """Redis set key that tracks all cache keys for a user+prefix."""
    safe_user = user_id.replace(":", "_")
    safe_prefix = prefix.replace(":", "_")
    return f"{KEY_INDEX_PREFIX}:{safe_prefix}:{safe_user}"


def parse_cache_key_parts(key: str) -> Optional[tuple]:
    """Parse a cache key into (namespace, prefix, user_id, hash) or None."""
    parts = key.split(":")
    if len(parts) < 4 or parts[0] != CACHE_NAMESPACE:
        return None
    return parts[0], parts[1], parts[2], parts[3]


async def get_cached(key: str) -> Optional[dict]:
    """
    Get cached value from Redis.
    
    Returns None if cache is unavailable or key not found.
    Logs errors appropriately without failing the request.
    """
    if not redis_client.is_available:
        logger.debug("Cache unavailable, skipping get", {"key": key[:50]})
        return None
        
    try:
        client = await redis_client.get_client()
        if not client:
            return None
            
        value = await client.get(key)
        if value:
            redis_client.record_success()
            logger.debug("Cache hit", {"key": key[:50]})
            return _json_loads(value)
        else:
            logger.debug("Cache miss", {"key": key[:50]})
    except Exception as e:
        redis_client.record_failure()
        logger.error(f"Redis get error: {e}", {"key": key[:50]})
    return None


async def set_cached(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    """
    Set cached value in Redis with optional TTL.
    Also tracks the key in a per-user Redis SET for O(1) invalidation.
    
    Args:
        key: Cache key
        value: Value to cache (will be JSON serialized)
        ttl: Time to live in seconds (defaults to settings.cache_ttl)
    
    Returns:
        True if cached successfully, False otherwise
    """
    if not redis_client.is_available:
        logger.debug("Cache unavailable, skipping set", {"key": key[:50]})
        return False
        
    try:
        settings = get_settings()
        client = await redis_client.get_client()
        
        if not client:
            return False
        
        effective_ttl = ttl or settings.cache_ttl
        serialized = _json_dumps(value)
        await client.set(
            key,
            serialized,
            ex=effective_ttl,
        )

        # Track key in index set for SCAN-free invalidation
        parts = parse_cache_key_parts(key)
        if parts:
            _, prefix, user_id, _ = parts
            index_key = _index_set_key(user_id, prefix)
            await client.sadd(index_key, key)
            # Index set lives slightly longer than entries so cleanup can still find them.
            # Never *shorten* an existing TTL — only extend when needed.
            desired_ttl = int(effective_ttl) + 60
            try:
                current_ttl = await client.ttl(index_key)
            except Exception:
                current_ttl = -1
            # ttl: -2 missing, -1 no expiry, >0 seconds remaining
            if current_ttl is None or current_ttl < 0 or current_ttl < desired_ttl:
                await client.expire(index_key, desired_ttl)

        redis_client.record_success()
        logger.debug("Cache set successfully", {"key": key[:50]})
        return True
    except Exception as e:
        redis_client.record_failure()
        logger.error(f"Redis set error: {e}", {"key": key[:50]})
        return False


async def invalidate_user_cache(user_id: str, prefix: str = "resume") -> int:
    """
    Invalidate all cache keys for a user using the set-based index (no SCAN).

    Args:
        user_id: User id embedded in cache keys
        prefix: Cache prefix (resume, cover, etc.)

    Returns:
        Number of keys deleted
    """
    if not redis_client.is_available:
        return 0
    try:
        client = await redis_client.get_client()
        if not client:
            return 0

        index_key = _index_set_key(user_id, prefix)
        keys = await client.smembers(index_key)
        if not keys:
            return 0

        key_list = list(keys)
        total_deleted = await client.delete(*key_list)
        await client.delete(index_key)
        redis_client.record_success()
        logger.info(
            "Cache invalidated via set index",
            {"user_id": user_id, "prefix": prefix, "deleted": total_deleted},
        )
        return int(total_deleted)
    except Exception as e:
        redis_client.record_failure()
        logger.error(f"Redis set-index invalidate error: {e}", {"user_id": user_id})
        return 0


async def invalidate_cache(pattern: str) -> int:
    """
    Invalidate cache entries matching a pattern.

    Prefer set-based invalidation when pattern is cvwiz:{prefix}:{user_id}:*
    Falls back to SCAN only for arbitrary patterns (legacy).
    
    Args:
        pattern: Redis key pattern (e.g., "cvwiz:resume:user123:*")
    
    Returns:
        Number of keys deleted
    """
    if not redis_client.is_available:
        logger.debug("Cache unavailable, skipping invalidate", {"pattern": pattern})
        return 0

    # Fast path: cvwiz:{prefix}:{user}:*  → set-based invalidation
    parts = pattern.rstrip("*").rstrip(":").split(":")
    if (
        len(parts) >= 3
        and parts[0] == CACHE_NAMESPACE
        and pattern.endswith("*")
        and "*" not in pattern[:-1]
    ):
        prefix = parts[1]
        user_id = parts[2]
        return await invalidate_user_cache(user_id, prefix)
        
    try:
        client = await redis_client.get_client()
        if not client:
            return 0
            
        total_deleted = 0
        keys = []
        async for key in client.scan_iter(pattern):
            keys.append(key)
            # Delete in batches of 100 to avoid memory issues and long blocking
            if len(keys) >= 100:
                total_deleted += await client.delete(*keys)
                keys = []
        
        if keys:
            total_deleted += await client.delete(*keys)
        
        if total_deleted > 0:
            redis_client.record_success()
            logger.info(f"Cache invalidated {total_deleted} keys", {"pattern": pattern})
        
        return total_deleted
    except Exception as e:
        redis_client.record_failure()
        logger.error(f"Redis invalidate error: {e}", {"pattern": pattern})
        return 0


async def get_cache_health() -> dict:
    """
    Get current cache health status.
    
    Returns:
        Dictionary with cache status information
    """
    is_connected = await redis_client.ping()
    
    return {
        "status": redis_client.status.value,
        "available": redis_client.is_available,
        "connected": is_connected,
        "consecutive_failures": redis_client._consecutive_failures,
    }
