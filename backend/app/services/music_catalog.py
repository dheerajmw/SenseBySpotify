from __future__ import annotations

from app.models.artist import Artist
from app.models.track import Track
from app.services.itunes import ITunesClient


class MusicCatalogClient:
    """iTunes Search API for track and artist catalogue lookups."""

    def __init__(self) -> None:
        self._itunes = ITunesClient()

    async def search_artists(self, *, query: str, limit: int = 10) -> list[Artist]:
        return await self._itunes.search_artists(query=query, limit=limit)

    async def search_tracks(self, *, query: str, limit: int = 25) -> list[Track]:
        return await self._itunes.search_tracks(query=query, limit=limit)
