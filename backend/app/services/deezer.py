from __future__ import annotations

import logging

import httpx

from app.exceptions import AppError
from app.models.artist import Artist
from app.models.track import Track
from app.services.deezer_mappers import map_deezer_artist, map_deezer_track

logger = logging.getLogger(__name__)

DEEZER_API = "https://api.deezer.com"


class DeezerClient:
    async def search_artists(self, *, query: str, limit: int = 10) -> list[Artist]:
        data = await self._get("/search/artist", params={"q": query, "limit": limit})
        items = data.get("data") or []
        return [map_deezer_artist(item) for item in items if item.get("id")]

    async def search_tracks(self, *, query: str, limit: int = 25) -> list[Track]:
        data = await self._get("/search", params={"q": query, "limit": limit})
        items = data.get("data") or []
        return [map_deezer_track(item) for item in items if item.get("id")]

    async def _get(self, path: str, *, params: dict[str, str | int]) -> dict:
        url = f"{DEEZER_API}{path}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, params=params)
        except httpx.RequestError as exc:
            logger.warning("Deezer request failed: %s", exc)
            raise AppError("Music search is temporarily unavailable", status_code=502) from exc

        if response.status_code == 429:
            raise AppError("Music search rate limit reached. Please wait a moment.", status_code=429)

        if response.status_code >= 400:
            logger.warning("Deezer error %s: %s", response.status_code, response.text[:200])
            raise AppError("Music search failed", status_code=502)

        payload = response.json()
        if payload.get("error"):
            message = payload["error"].get("message", "Music search failed")
            raise AppError(message, status_code=502)
        return payload
