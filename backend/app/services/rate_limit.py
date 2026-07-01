from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque

from app.exceptions import AppError


class RateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        async with self._lock:
            bucket = self._events[key]
            while bucket and now - bucket[0] > window_seconds:
                bucket.popleft()
            if len(bucket) >= limit:
                raise AppError(
                    "Rate limit exceeded. Please wait before generating again.",
                    status_code=429,
                )
            bucket.append(now)


generate_rate_limiter = RateLimiter()
