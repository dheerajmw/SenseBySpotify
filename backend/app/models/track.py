from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.artist import Artist


class Album(BaseModel):
    id: str
    name: str
    image_url: str | None = None
    release_date: str | None = None


class Track(BaseModel):
    id: str
    name: str
    artists: list[Artist] = Field(default_factory=list)
    album: Album | None = None
    primary_genre: str | None = None
    duration_ms: int | None = None
    preview_url: str | None = None
    external_url: str | None = None
    popularity: int | None = None
