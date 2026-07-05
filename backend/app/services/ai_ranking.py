from __future__ import annotations

import logging
from collections.abc import Callable

import httpx

from app.exceptions import AppError
from app.models.track import Track
from app.models.user_context import UserContext
from app.services.ai.base import RankedTrackResult
from app.services.ai.openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)

AI_FALLBACK_REASON = (
    "AI is temporarily unavailable. Showing smart recommendations based on "
    "your current listening intent."
)


def _failure_reason(exc: BaseException) -> str:
    if isinstance(exc, httpx.TimeoutException):
        return "LLM Timeout"
    if isinstance(exc, httpx.TransportError):
        return "LLM Network Error"
    if isinstance(exc, AppError) and exc.status_code >= 503:
        return "LLM Upstream Error"
    if isinstance(exc, AppError):
        return f"LLM Error ({exc.message})"
    return type(exc).__name__


async def rank_with_ai_or_fallback(
    ai: OpenAIProvider,
    *,
    context: UserContext,
    query: str,
    candidates: list[Track],
    limit: int,
    profile_genres: list[str],
    preferred_genres: list[str] | None = None,
    tracks_by_id: dict[str, Track],
    validate_ranked: Callable[[list[RankedTrackResult], dict[str, Track]], list[RankedTrackResult]],
) -> tuple[list[RankedTrackResult], bool, str | None]:
    """
    Rank tracks with the LLM, falling back to deterministic genre ranking on failure.

    The LLM provider retries transport failures once. Validation failures are not retried.
    """
    try:
        ranked = await ai.rank_tracks(
            context=context,
            query=query,
            candidates=candidates,
            limit=limit,
        )
        ranked = validate_ranked(ranked, tracks_by_id)
        if not ranked:
            raise ValueError("AI returned no valid track IDs")
        return ranked, True, None
    except Exception as exc:
        logger.warning(
            "[AI] Fallback Activated\nCandidate Count: %d\nReason: %s",
            len(candidates),
            _failure_reason(exc),
        )
        from app.services.recommendation_generator import fallback_rank

        ranked = fallback_rank(
            candidates,
            query,
            limit,
            profile_genres=profile_genres,
            preferred_genres=preferred_genres or context.preferred_genres,
        )
        return ranked, False, AI_FALLBACK_REASON
