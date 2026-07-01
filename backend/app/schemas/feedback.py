from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.user_context import FeedbackChip, FeedbackEventType


class FeedbackRequest(BaseModel):
    track_id: str | None = None
    event_type: FeedbackEventType
    chips: list[FeedbackChip] = Field(default_factory=list)
    query: str | None = Field(default=None, max_length=500)


class FeedbackResponse(BaseModel):
    message: str = "Feedback recorded"
    exploration_profile: float
    novelty_tolerance: float
    feedback_count: int
