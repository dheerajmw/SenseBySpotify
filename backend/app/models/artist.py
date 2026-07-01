from __future__ import annotations

from pydantic import BaseModel, Field


class Artist(BaseModel):
    id: str
    name: str
    genres: list[str] = Field(default_factory=list)
    image_url: str | None = None
    popularity: int | None = None
    external_url: str | None = None
