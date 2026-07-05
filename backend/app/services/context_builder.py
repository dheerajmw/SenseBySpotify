from __future__ import annotations

from app.models.artist import Artist
from app.models.user_context import UserContext
from app.schemas.user_profile import UserProfilePayload

NOVELTY_MAP = {
    "familiar": 0.2,
    "mostly_familiar": 0.2,
    "balanced": 0.5,
    "adventurous": 0.85,
    "love_discovering": 0.85,
}


def novelty_to_float(value: str | int | float) -> float:
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric > 1.0:
            return round(min(1.0, max(0.0, numeric / 100.0)), 2)
        return round(min(1.0, max(0.0, numeric)), 2)

    normalized = value.strip().lower().replace(" ", "_")
    if normalized in NOVELTY_MAP:
        return NOVELTY_MAP[normalized]
    if "familiar" in normalized and "mostly" in normalized:
        return 0.2
    if "adventurous" in normalized or "discover" in normalized:
        return 0.85
    return 0.5


def exploration_from_novelty(novelty: float) -> float:
    return round(min(1.0, max(0.2, novelty + 0.1)), 2)


class UserContextBuilder:
    def build(
        self,
        profile: UserProfilePayload,
        *,
        current_query: str | None = None,
    ) -> UserContext:
        query = (current_query or profile.current_intent or "").strip()
        top_artists = [
            Artist(
                id=artist.id,
                name=artist.name,
                image_url=artist.image_url,
                genres=[],
            )
            for artist in profile.favourite_artists
        ]
        novelty = novelty_to_float(profile.novelty_tolerance)

        return UserContext(
            user_id=None,
            recently_played=[],
            top_artists=top_artists,
            top_genres=list(profile.genres),
            preferred_genres=list(profile.preferred_genres),
            liked_songs=[],
            first_search=query or None,
            current_query=query or None,
            feedback_events=list(profile.feedback_events),
            exploration_profile=exploration_from_novelty(novelty),
            novelty_tolerance=novelty,
            incomplete=False,
        )
