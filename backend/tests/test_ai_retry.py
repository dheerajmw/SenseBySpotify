from __future__ import annotations

from unittest.mock import AsyncMock

import httpx
import pytest

from app.exceptions import AppError
from app.services.ai.retry import call_llm_with_single_retry, is_retriable_llm_error


def test_is_retriable_llm_error_for_timeout() -> None:
    assert is_retriable_llm_error(httpx.ReadTimeout("timeout")) is True


def test_is_retriable_llm_error_for_network() -> None:
    assert is_retriable_llm_error(httpx.ConnectError("network")) is True


def test_is_retriable_llm_error_for_upstream_5xx() -> None:
    assert is_retriable_llm_error(AppError("upstream", status_code=503)) is True


def test_is_retriable_llm_error_rejects_validation() -> None:
    assert is_retriable_llm_error(AppError("invalid json", status_code=502)) is False


def test_is_retriable_llm_error_for_rate_limit() -> None:
    assert is_retriable_llm_error(AppError("queue exceeded", status_code=503)) is True


@pytest.mark.asyncio
async def test_call_llm_with_single_retry_retries_rate_limit() -> None:
    operation = AsyncMock(
        side_effect=[
            AppError("We're experiencing high traffic right now!", status_code=503),
            "ok",
        ]
    )

    result = await call_llm_with_single_retry(
        operation,
        operation_name="rank",
        retry_backoff_seconds=0,
    )

    assert result == "ok"
    assert operation.await_count == 2


@pytest.mark.asyncio
async def test_call_llm_with_single_retry_retries_once() -> None:
    operation = AsyncMock(side_effect=[httpx.ReadTimeout("timeout"), "ok"])

    result = await call_llm_with_single_retry(operation, operation_name="rank")

    assert result == "ok"
    assert operation.await_count == 2


@pytest.mark.asyncio
async def test_call_llm_with_single_retry_does_not_retry_validation() -> None:
    operation = AsyncMock(side_effect=AppError("invalid json", status_code=502))

    with pytest.raises(AppError):
        await call_llm_with_single_retry(operation, operation_name="rank")

    assert operation.await_count == 1
