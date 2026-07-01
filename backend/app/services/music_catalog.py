from __future__ import annotations

import logging

from app.models.artist import Artist
from app.models.track import Track
from app.services.deezer import DeezerClient
from app.services.itunes import ITunesClient

logger = logging.getLogger(__name__)


class MusicCatalogClient:
    """Deezer for artists; iTunes fallback for tracks when Deezer returns empty."""

    def __init__(self) -> None:
        self._deezer = DeezerClient()
        self._itunes = ITunesClient()

    async def search_artists(self, *, query: str, limit: int = 10) -> list[Artist]:
        artists = await self._deezer.search_artists(query=query, limit=limit)
        if artists:
            return artists
        logger.info("Deezer artist search empty for %r, trying iTunes", query)
        return await self._itunes.search_artists(query=query, limit=limit)

    async def search_tracks(self, *, query: str, limit: int = 25) -> list[Track]:
        tracks = await self._deezer.search_tracks(query=query, limit=limit)
        if tracks:
            return tracks
        logger.info("Deezer track search empty for %r, falling back to iTunes", query)
        return await self._itunes.search_tracks(query=query, limit=limit)
