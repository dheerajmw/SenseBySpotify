from __future__ import annotations

from typing import Protocol

from app.models.track import Track
from app.models.user_context import UserContext
from app.services.ai.base import RankedTrackResult


class AIProvider(Protocol):
    async def rank_tracks(
        self,
        *,
        context: UserContext,
        query: str,
        candidates: list[Track],
        limit: int,
    ) -> list[RankedTrackResult]: ...
