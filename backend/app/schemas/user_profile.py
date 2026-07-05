from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.user_context import FeedbackEvent


class FavouriteArtist(BaseModel):
    id: str
    name: str
    image_url: str | None = None


class UserProfilePayload(BaseModel):
    genres: list[str] = Field(default_factory=list)
    favourite_artists: list[FavouriteArtist] = Field(default_factory=list)
    novelty_tolerance: str | int | float = "balanced"
    current_intent: str = ""
    preferred_genres: list[str] = Field(default_factory=list)
    feedback_events: list[FeedbackEvent] = Field(default_factory=list)
    liked_track_ids: list[str] = Field(default_factory=list)
    disliked_track_ids: list[str] = Field(default_factory=list)
    onboarding_completed: bool = True
