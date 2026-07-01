from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.models.user_context import FeedbackEvent


class BrowsingSession(BaseModel):
    user_id: str
    first_search: str | None = None
    current_query: str | None = None
    feedback_events: list[FeedbackEvent] = Field(default_factory=list)
    exploration_profile: float = Field(default=0.5, ge=0.0, le=1.0)
    novelty_tolerance: float = Field(default=0.5, ge=0.0, le=1.0)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def apply_query(self, query: str | None) -> None:
        trimmed = query.strip() if query else ""
        if not trimmed:
            return
        if self.first_search is None:
            self.first_search = trimmed
        self.current_query = trimmed
        self.updated_at = datetime.now(timezone.utc)
