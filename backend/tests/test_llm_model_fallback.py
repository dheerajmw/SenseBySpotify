from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.config import Settings
from app.exceptions import AppError
from app.services.ai.openai_provider import OpenAIProvider


@pytest.mark.asyncio
async def test_chat_completion_uses_fallback_after_primary_rate_limit() -> None:
    settings = Settings(
        CEREBRAS_API_KEY="test-key",
        LLM_MODEL="gpt-oss-120b",
        LLM_FALLBACK_MODEL="gemma-4-31b",
        LLM_RETRY_BACKOFF_SECONDS=0,
    )
    provider = OpenAIProvider(settings)
    messages = [{"role": "user", "content": "hello"}]

    with patch.object(
        provider,
        "_request_chat_completion",
        new_callable=AsyncMock,
        side_effect=[
            AppError("queue exceeded", status_code=503),
            '{"ok": true}',
        ],
    ) as request_mock:
        result = await provider._chat_completion(messages)

    assert result == '{"ok": true}'
    assert request_mock.await_count == 2
    request_mock.assert_any_await(messages, "gpt-oss-120b")
    request_mock.assert_any_await(messages, "gemma-4-31b")


@pytest.mark.asyncio
async def test_chat_completion_skips_fallback_for_validation_errors() -> None:
    settings = Settings(
        CEREBRAS_API_KEY="test-key",
        LLM_MODEL="gpt-oss-120b",
        LLM_FALLBACK_MODEL="gemma-4-31b",
    )
    provider = OpenAIProvider(settings)

    with patch.object(
        provider,
        "_request_chat_completion",
        new_callable=AsyncMock,
        side_effect=AppError("invalid json", status_code=502),
    ) as request_mock:
        with pytest.raises(AppError):
            await provider._chat_completion([{"role": "user", "content": "hello"}])

    assert request_mock.await_count == 1


def test_resolve_fallback_model_ignores_blank_or_duplicate() -> None:
    settings = Settings(
        LLM_MODEL="gpt-oss-120b",
        LLM_FALLBACK_MODEL="gpt-oss-120b",
    )
    provider = OpenAIProvider(settings)
    assert provider._resolve_fallback_model("gpt-oss-120b") is None

    settings_empty = Settings(LLM_MODEL="gpt-oss-120b", LLM_FALLBACK_MODEL="")
    provider_empty = OpenAIProvider(settings_empty)
    assert provider_empty._resolve_fallback_model("gpt-oss-120b") is None
