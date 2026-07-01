from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.recommendation import Recommendation
from app.schemas.user_profile import UserProfilePayload


class GenerateRecommendationsRequest(BaseModel):
    profile: UserProfilePayload
    query: str = Field(default="", max_length=500)
    limit: int = Field(default=10, ge=1, le=20)


class GenerateRecommendationsResponse(BaseModel):
    query: str
    recommendations: list[Recommendation]
    candidate_count: int
    used_ai: bool
