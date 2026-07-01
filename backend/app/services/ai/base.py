from __future__ import annotations

from pydantic import BaseModel, Field


class RankedTrackResult(BaseModel):
    track_id: str
    rank: int = Field(ge=1)
    reason: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    score: int = Field(default=0, ge=0, le=100)


class AIRecommendationItem(BaseModel):
    title: str
    artist: str
    score: int = Field(ge=0, le=100)
    reason: str = Field(min_length=1)
    confidence: str = "Medium"


class AIRankResponse(BaseModel):
    recommendations: list[AIRecommendationItem]
