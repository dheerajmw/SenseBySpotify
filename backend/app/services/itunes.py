from __future__ import annotations

import logging

import httpx

from app.exceptions import AppError
from app.models.artist import Artist
from app.models.track import Track
from app.services.itunes_mappers import map_itunes_track

logger = logging.getLogger(__name__)

ITUNES_SEARCH_URL = "https://itunes.apple.com/search"


class ITunesClient:
    async def search_tracks(self, *, query: str, limit: int = 25) -> list[Track]:
        params = {
            "term": query,
            "media": "music",
            "entity": "song",
            "limit": str(limit),
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(ITUNES_SEARCH_URL, params=params)
        except httpx.RequestError as exc:
            logger.warning("iTunes request failed: %s", exc)
            raise AppError("Music search is temporarily unavailable", status_code=502) from exc

        if response.status_code >= 400:
            raise AppError("Music search failed", status_code=502)

        payload = response.json()
        results = payload.get("results") or []
        tracks: list[Track] = []
        seen: set[str] = set()
        for item in results:
            if item.get("wrapperType") != "track" or not item.get("trackId"):
                continue
            track = map_itunes_track(item)
            if track.id in seen:
                continue
            seen.add(track.id)
            tracks.append(track)
        return tracks

    async def search_artists(self, *, query: str, limit: int = 10) -> list[Artist]:
        params = {
            "term": query,
            "media": "music",
            "entity": "musicArtist",
            "limit": str(limit),
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(ITUNES_SEARCH_URL, params=params)
        except httpx.RequestError as exc:
            logger.warning("iTunes artist request failed: %s", exc)
            return []

        if response.status_code >= 400:
            return []

        results = response.json().get("results") or []
        artists: list[Artist] = []
        seen: set[str] = set()
        for item in results:
            artist_id = str(item.get("artistId", ""))
            if not artist_id or artist_id in seen:
                continue
            seen.add(artist_id)
            artists.append(
                Artist(
                    id=artist_id,
                    name=item.get("artistName", "Unknown artist"),
                    image_url=None,
                    external_url=item.get("artistLinkUrl") or item.get("artistViewUrl"),
                )
            )
        return artists
