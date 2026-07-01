from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.artist import Artist
from app.models.track import Track


class RecentlyPlayedItem(BaseModel):
    track: Track
    played_at: str


class SearchResponse(BaseModel):
    query: str
    tracks: list[Track] = Field(default_factory=list)
    artists: list[Artist] = Field(default_factory=list)


class ArtistSearchResponse(BaseModel):
    query: str
    artists: list[Artist] = Field(default_factory=list)
