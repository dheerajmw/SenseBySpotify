from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.exceptions import AppError
from app.schemas.session_intent import (
    UpdateSessionIntentRequest,
    UpdateSessionIntentResponse,
)
from app.services.ai.openai_provider import OpenAIProvider
from app.services.session_intent_rules import infer_intent_from_actions, merge_intent_results
from app.services.session_intent_validation import sanitize_session_intent_result

router = APIRouter(tags=["session"])


def get_ai_provider(settings: Settings = Depends(get_settings)) -> OpenAIProvider:
    return OpenAIProvider(settings)


def _extract_recommendation_artists(recommendations: list[dict]) -> list[str]:
    artists: list[str] = []
    for item in recommendations:
        artist = item.get("artist")
        if isinstance(artist, str) and artist.strip():
            artists.append(artist.strip())
            continue
        track = item.get("track")
        if isinstance(track, dict):
            for entry in track.get("artists", []):
                if isinstance(entry, dict):
                    name = entry.get("name")
                    if isinstance(name, str) and name.strip():
                        artists.append(name.strip())
    return artists


@router.post("/update-session-intent", response_model=UpdateSessionIntentResponse)
async def update_session_intent(
    payload: UpdateSessionIntentRequest,
    ai_provider: OpenAIProvider = Depends(get_ai_provider),
) -> UpdateSessionIntentResponse:
    profile_artists = [artist.name for artist in payload.profile.favourite_artists]
    profile_summary = {
        "genres": payload.profile.genres,
        "favourite_artists": profile_artists,
        "novelty_tolerance": payload.profile.novelty_tolerance,
        "current_intent": payload.profile.current_intent,
    }
    actions = [
        {"type": action.type, "value": action.value, "timestamp": action.timestamp}
        for action in payload.session.recent_actions
    ]
    recommendation_artists = _extract_recommendation_artists(payload.current_recommendations)

    rule_result = infer_intent_from_actions(
        payload.session.current_intent,
        actions,
        profile_artists=profile_artists,
        profile_genres=payload.profile.genres,
    )

    try:
        ai_result = await ai_provider.detect_session_intent(
            current_intent=payload.session.current_intent,
            recent_actions=actions,
            profile=profile_summary,
            current_recommendations=payload.current_recommendations,
        )
        result = merge_intent_results(ai_result, rule_result)
    except AppError:
        if rule_result:
            result = rule_result
        else:
            result = {
                "intent_changed": False,
                "new_intent": payload.session.current_intent,
                "preferred_artists": [],
                "confidence": payload.session.confidence,
                "reason": (
                    "AI intent check is unavailable and recent actions do not "
                    "clearly indicate a new intent."
                ),
            }

    sanitized = sanitize_session_intent_result(
        result,
        current_intent=payload.session.current_intent,
        profile_artists=profile_artists,
        profile_genres=payload.profile.genres,
        recommendation_artists=recommendation_artists,
    )

    return UpdateSessionIntentResponse(
        intent_changed=sanitized["intent_changed"],
        new_intent=sanitized["new_intent"],
        preferred_artists=sanitized["preferred_artists"],
        preferred_genres=sanitized["preferred_genres"],
        confidence=sanitized["confidence"],
        reason=sanitized["reason"],
        validation_status=sanitized.get("validation_status", "accepted"),
        validation_message=sanitized.get("validation_message"),
        raw_new_intent=sanitized.get("raw_new_intent"),
    )
