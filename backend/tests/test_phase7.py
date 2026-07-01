from __future__ import annotations

import pytest

from app.exceptions import AppError
from app.services.rate_limit import RateLimiter


@pytest.mark.asyncio
async def test_rate_limiter_blocks_after_limit() -> None:
    limiter = RateLimiter()
    for _ in range(3):
        await limiter.check("user-1", limit=3, window_seconds=60)

    with pytest.raises(AppError) as exc_info:
        await limiter.check("user-1", limit=3, window_seconds=60)

    assert exc_info.value.status_code == 429
