from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.user_profile import UserProfilePayload


class SessionActionPayload(BaseModel):
    type: str
    value: str
    timestamp: int


class SessionStatePayload(BaseModel):
    current_intent: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    recent_actions: list[SessionActionPayload] = Field(default_factory=list)
    last_updated: str = ""
    recommendation_version: int = 1


class UpdateSessionIntentRequest(BaseModel):
    profile: UserProfilePayload
    session: SessionStatePayload
    current_recommendations: list[dict] = Field(default_factory=list)


class UpdateSessionIntentResponse(BaseModel):
    intent_changed: bool
    new_intent: str
    preferred_artists: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str
