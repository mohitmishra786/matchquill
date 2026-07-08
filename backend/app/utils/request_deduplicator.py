"""
Request Deduplication for LLM Calls
Prevents duplicate API requests by caching in-flight requests
"""

import asyncio
import hashlib
from typing import Any, Dict, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class InFlightRequest:
    """Represents a request that is currently in flight."""
    event: asyncio.Event
    timestamp: datetime
    request_hash: str
    result: Any = None
    error: Optional[BaseException] = None


class RequestDeduplicator:
    """
    Deduplicates LLM API requests to prevent wasting quota.

    When multiple identical requests are made simultaneously, only one
    actual API call is made, and all callers receive the same result.
    """

    def __init__(self, ttl_seconds: float = 30.0):
        self._in_flight: Dict[str, InFlightRequest] = {}
        self._ttl = timedelta(seconds=ttl_seconds)
        self._lock = asyncio.Lock()

    def _generate_request_hash(self, *args, **kwargs) -> str:
        content = f"args:{str(args)}|kwargs:{str(sorted(kwargs.items()))}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    async def execute(self, key_prefix: str, func, *args, **kwargs) -> Any:
        request_hash = self._generate_request_hash(*args, **kwargs)
        cache_key = f"{key_prefix}:{request_hash}"

        while True:
            existing = None
            async with self._lock:
                existing = self._in_flight.get(cache_key)
                if existing is not None:
                    if datetime.utcnow() - existing.timestamp >= self._ttl:
                        del self._in_flight[cache_key]
                        existing = None

                if existing is None:
                    event = asyncio.Event()
                    self._in_flight[cache_key] = InFlightRequest(
                        event=event,
                        timestamp=datetime.utcnow(),
                        request_hash=request_hash,
                    )

            if existing is None:
                break

            try:
                await asyncio.wait_for(
                    existing.event.wait(),
                    timeout=self._ttl.total_seconds()
                )
            except asyncio.TimeoutError:
                async with self._lock:
                    if self._in_flight.get(cache_key) is existing:
                        del self._in_flight[cache_key]
                continue
            if existing.error:
                raise existing.error
            return existing.result

        result = None
        exc: Optional[BaseException] = None
        try:
            result = await func(*args, **kwargs)
            return result
        except BaseException as e:
            exc = e
            raise
        finally:
            async with self._lock:
                req = self._in_flight.get(cache_key)
                if req is not None:
                    if exc is not None:
                        req.error = exc
                    req.result = result
                    req.event.set()
                    del self._in_flight[cache_key]

    async def cleanup_expired(self) -> int:
        now = datetime.utcnow()
        expired_keys = []

        async with self._lock:
            for key, in_flight in self._in_flight.items():
                if now - in_flight.timestamp > self._ttl:
                    expired_keys.append(key)

            for key in expired_keys:
                del self._in_flight[key]

        return len(expired_keys)

    def get_stats(self) -> Dict[str, Any]:
        now = datetime.utcnow()
        return {
            "in_flight_count": len(self._in_flight),
            "ttl_seconds": self._ttl.total_seconds(),
            "requests": [
                {
                    "key": key,
                    "age_seconds": (now - req.timestamp).total_seconds(),
                    "hash": req.request_hash,
                }
                for key, req in self._in_flight.items()
            ],
        }


# Global deduplicator instance
_deduplicator: Optional[RequestDeduplicator] = None


def get_deduplicator() -> RequestDeduplicator:
    """Get the global deduplicator instance."""
    global _deduplicator
    if _deduplicator is None:
        _deduplicator = RequestDeduplicator()
    return _deduplicator
