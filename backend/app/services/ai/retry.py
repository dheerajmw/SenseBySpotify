from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

import httpx

from app.exceptions import AppError

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Brief pause before retrying rate-limited LLM requests (e.g. Cerebras queue_exceeded).
DEFAULT_RATE_LIMIT_BACKOFF_SECONDS = 1.5


def is_retriable_llm_error(exc: BaseException) -> bool:
    """Return True for timeout, network, rate limits, and upstream 5xx failures."""
    if isinstance(exc, httpx.TimeoutException):
        return True
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, AppError) and exc.status_code >= 503:
        return True
    return False


async def call_llm_with_single_retry(
    operation: Callable[[], Awaitable[T]],
    *,
    operation_name: str = "llm_request",
    retry_backoff_seconds: float = DEFAULT_RATE_LIMIT_BACKOFF_SECONDS,
) -> T:
    """
    Execute an LLM HTTP call with at most one automatic retry.

    Retries timeout, network, rate-limit (429), and upstream 5xx errors.
    Validation and other client errors are never retried.
    """
    logger.info("[AI] Request Started operation=%s", operation_name)
    try:
        return await operation()
    except Exception as exc:
        if not is_retriable_llm_error(exc):
            raise
        logger.warning(
            "[AI] Retry Attempt 1 operation=%s reason=%s",
            operation_name,
            exc,
        )
        if retry_backoff_seconds > 0:
            await asyncio.sleep(retry_backoff_seconds)
        try:
            result = await operation()
        except Exception:
            raise
        logger.info("[AI] Retry Successful operation=%s", operation_name)
        return result
