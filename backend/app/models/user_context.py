from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from app.models.artist import Artist
from app.models.track import Track


class FeedbackEventType(str, Enum):
    SKIP = "skip"
    REPLAY = "replay"
    SEARCH = "search"
    COMPLETE = "complete"
    LIKE = "like"
    UNLIKE = "unlike"
    DISLIKE = "dislike"
    UNDISLIKE = "undislike"


class FeedbackChip(str, Enum):
    MOOD = "mood"
    LYRICS = "lyrics"
    VOCALS = "vocals"
    BEAT = "beat"
    ENERGY = "energy"
    INSTRUMENTAL = "instrumental"
    SIMILAR_ARTIST = "similar_artist"
    SURPRISE_ME = "surprise_me"


class FeedbackEvent(BaseModel):
    track_id: str | None = None
    event_type: FeedbackEventType
    chips: list[FeedbackChip] = Field(default_factory=list)
    query: str | None = None
    timestamp: str | None = None


class UserContext(BaseModel):
    user_id: str | None = None
    recently_played: list[Track] = Field(default_factory=list)
    top_artists: list[Artist] = Field(default_factory=list)
    top_genres: list[str] = Field(default_factory=list)
    liked_songs: list[Track] = Field(default_factory=list)
    first_search: str | None = None
    current_query: str | None = None
    feedback_events: list[FeedbackEvent] = Field(default_factory=list)
    exploration_profile: float = Field(default=0.5, ge=0.0, le=1.0)
    novelty_tolerance: float = Field(default=0.5, ge=0.0, le=1.0)
    incomplete: bool = False
