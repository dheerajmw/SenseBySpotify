from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import Settings
from app.exceptions import AppError
from app.models.track import Track
from app.models.user_context import UserContext
from app.services.ai.base import AIRecommendationItem, AIRankResponse, RankedTrackResult
from app.services.ai.retry import call_llm_with_single_retry, is_retriable_llm_error
from app.services.ai.prompts import (
    FEW_SHOT_ASSISTANT,
    FEW_SHOT_USER,
    SYSTEM_PROMPT,
    build_user_prompt,
)
from app.services.intent_genre_matching import resolve_target_genres
from app.services.ai.session_intent_prompts import (
    SESSION_INTENT_SYSTEM,
    build_session_intent_user_prompt,
)
from app.services.ai.user_intent_prompts import (
    USER_INTENT_SYSTEM,
    build_user_intent_prompt,
)

logger = logging.getLogger(__name__)

CONFIDENCE_MAP = {
    "high": 0.9,
    "medium": 0.7,
    "low": 0.5,
}


def confidence_label_to_float(label: str) -> float:
    return CONFIDENCE_MAP.get(label.strip().lower(), 0.7)


def normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def match_track_id(
    item: AIRecommendationItem,
    candidates: list[Track],
    tracks_by_id: dict[str, Track],
) -> str | None:
    title_key = normalize_text(item.title)
    artist_key = normalize_text(item.artist)

    for track in candidates:
        primary_artist = track.artists[0].name if track.artists else ""
        if normalize_text(track.name) == title_key and normalize_text(primary_artist) == artist_key:
            return track.id

    for track in candidates:
        if normalize_text(track.name) == title_key:
            return track.id

    for track_id, track in tracks_by_id.items():
        primary_artist = track.artists[0].name if track.artists else ""
        if artist_key and artist_key in normalize_text(primary_artist):
            if title_key in normalize_text(track.name):
                return track_id
    return None


class OpenAIProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _ensure_configured(self) -> None:
        if not self._settings.llm_api_key:
            raise AppError("LLM API key is not configured", status_code=503)

    async def rank_tracks(
        self,
        *,
        context: UserContext,
        query: str,
        candidates: list[Track],
        limit: int,
    ) -> list[RankedTrackResult]:
        self._ensure_configured()

        discovery_percent = round(context.novelty_tolerance * 100)
        familiar_percent = max(0, 100 - discovery_percent)
        context_summary = {
            "genres": context.top_genres[:8],
            "preferred_genres": context.preferred_genres[:8],
            "target_genres": resolve_target_genres(
                query,
                context.top_genres,
                context.preferred_genres,
            ),
            "favourite_artists": [artist.name for artist in context.top_artists[:8]],
            "current_intent": context.current_query,
            "discovery_level_percent": discovery_percent,
            "discovery_level_meaning": (
                f"Prioritise approximately {familiar_percent}% familiar music "
                f"and {discovery_percent}% new discoveries."
            ),
            "novelty_tolerance": context.novelty_tolerance,
            "feedback_events": [
                {
                    "event_type": event.event_type.value,
                    "track_id": event.track_id,
                    "chips": [chip.value for chip in event.chips],
                }
                for event in context.feedback_events[-10:]
            ],
        }
        candidate_payload = [
            {
                "id": track.id,
                "title": track.name,
                "artist": track.artists[0].name if track.artists else "Unknown",
                "genre": track.primary_genre,
            }
            for track in candidates
        ]

        user_prompt = build_user_prompt(
            query=query,
            context_summary=context_summary,
            candidates=candidate_payload,
            limit=limit,
        )

        system_prompt = SYSTEM_PROMPT.format(limit=limit)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": FEW_SHOT_USER},
            {"role": "assistant", "content": FEW_SHOT_ASSISTANT},
            {"role": "user", "content": user_prompt},
        ]

        logger.info(
            "AI ranking request query=%r candidates=%d model=%s",
            query,
            len(candidates),
            self._settings.llm_model,
        )

        raw = await self._chat_completion(messages)
        return self._parse_response(raw, candidates, limit)

    async def detect_session_intent(
        self,
        *,
        current_intent: str,
        recent_actions: list[dict],
        profile: dict,
        current_recommendations: list[dict],
    ) -> dict:
        self._ensure_configured()

        user_prompt = build_session_intent_user_prompt(
            current_intent=current_intent,
            recent_actions=recent_actions,
            profile=profile,
            current_recommendations=current_recommendations,
        )
        messages = [
            {"role": "system", "content": SESSION_INTENT_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]

        raw = await self._chat_completion(messages)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AppError("AI returned invalid JSON", status_code=502) from exc

        return {
            "intent_changed": bool(
                parsed.get("intent_changed", parsed.get("intentChanged", False))
            ),
            "new_intent": str(
                parsed.get("new_intent", parsed.get("newIntent", current_intent))
            ).strip()
            or current_intent,
            "preferred_artists": [
                str(name).strip()
                for name in parsed.get("preferred_artists", parsed.get("preferredArtists", []))
                if str(name).strip()
            ],
            "preferred_genres": [
                str(name).strip()
                for name in parsed.get("preferred_genres", parsed.get("preferredGenres", []))
                if str(name).strip()
            ],
            "confidence": min(1.0, max(0.0, float(parsed.get("confidence", 0.5)))),
            "reason": str(parsed.get("reason", "No reason provided.")).strip(),
        }

    async def parse_user_declared_intent(
        self,
        *,
        user_input: str,
        profile_genres: list[str],
        profile_artists: list[str],
    ) -> dict:
        self._ensure_configured()

        user_prompt = build_user_intent_prompt(
            user_input=user_input,
            profile_genres=profile_genres,
            profile_artists=profile_artists,
        )
        messages = [
            {"role": "system", "content": USER_INTENT_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]

        raw = await self._chat_completion(messages)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AppError("AI returned invalid JSON", status_code=502) from exc

        return {
            "intent": str(parsed.get("intent", parsed.get("newIntent", ""))).strip(),
            "preferred_artists": [
                str(name).strip()
                for name in parsed.get("preferred_artists", parsed.get("preferredArtists", []))
                if str(name).strip()
            ],
            "preferred_genres": [
                str(name).strip()
                for name in parsed.get("preferred_genres", parsed.get("preferredGenres", []))
                if str(name).strip()
            ],
            "confidence": min(1.0, max(0.0, float(parsed.get("confidence", 0.75)))),
            "reason": str(parsed.get("reason", "")).strip(),
        }

    async def _chat_completion(self, messages: list[dict[str, str]]) -> str:
        primary_model = self._settings.llm_model
        try:
            return await self._request_chat_completion(messages, primary_model)
        except AppError as exc:
            fallback_model = self._resolve_fallback_model(primary_model)
            if fallback_model is None or not is_retriable_llm_error(exc):
                raise
            logger.warning(
                "[AI] Primary model failed, trying fallback\nPrimary: %s\nFallback: %s\nReason: %s",
                primary_model,
                fallback_model,
                exc.message,
            )
            result = await self._request_chat_completion(messages, fallback_model)
            logger.info("[AI] Fallback model successful model=%s", fallback_model)
            return result

    def _resolve_fallback_model(self, primary_model: str) -> str | None:
        fallback = self._settings.llm_fallback_model.strip()
        if not fallback or fallback == primary_model.strip():
            return None
        return fallback

    async def _request_chat_completion(
        self,
        messages: list[dict[str, str]],
        model: str,
    ) -> str:
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
        }

        async def _request() -> str:
            async with httpx.AsyncClient(
                timeout=self._settings.llm_timeout_seconds,
            ) as client:
                response = await client.post(
                    self._settings.llm_chat_completions_url,
                    headers={
                        "Authorization": f"Bearer {self._settings.llm_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

            if response.status_code >= 400:
                logger.warning(
                    "LLM request failed (%s) status=%s model=%s: %s",
                    self._settings.llm_base_url,
                    response.status_code,
                    model,
                    response.text,
                )
                detail = "AI request failed"
                try:
                    error_body = response.json()
                    message = error_body.get("error", {}).get("message")
                    if not message:
                        message = error_body.get("message")
                    if message:
                        detail = message
                except (json.JSONDecodeError, AttributeError):
                    pass
                status_code = (
                    503
                    if response.status_code >= 500 or response.status_code == 429
                    else 502
                )
                raise AppError(detail, status_code=status_code)

            data = response.json()
            return data["choices"][0]["message"]["content"]

        return await call_llm_with_single_retry(
            _request,
            operation_name=f"chat_completion:{model}",
            retry_backoff_seconds=self._settings.llm_retry_backoff_seconds,
        )

    def _parse_response(
        self,
        raw: str,
        candidates: list[Track],
        limit: int,
    ) -> list[RankedTrackResult]:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                payload = {"recommendations": parsed}
            else:
                payload = parsed
            response = AIRankResponse.model_validate(payload)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Invalid AI JSON response: %s", exc)
            raise AppError("AI returned invalid JSON", status_code=502) from exc

        tracks_by_id = {track.id: track for track in candidates}
        ranked: list[RankedTrackResult] = []
        seen: set[str] = set()

        for index, item in enumerate(response.recommendations[:limit], start=1):
            track_id = match_track_id(item, candidates, tracks_by_id)
            if not track_id or track_id in seen:
                continue
            seen.add(track_id)
            ranked.append(
                RankedTrackResult(
                    track_id=track_id,
                    rank=index,
                    reason=item.reason,
                    confidence=confidence_label_to_float(item.confidence),
                    score=item.score,
                )
            )

        if not ranked:
            raise AppError("AI returned no valid recommendations", status_code=502)
        return ranked
