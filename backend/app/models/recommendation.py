from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.track import Track


class Recommendation(BaseModel):
    track: Track
    rank: int = Field(ge=1)
    reason: str
    confidence: float = Field(ge=0.0, le=1.0)
