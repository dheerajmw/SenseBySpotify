from __future__ import annotations

from typing import Any

from app.models.artist import Artist
from app.models.track import Album, Track


def map_deezer_artist(raw: dict[str, Any]) -> Artist:
    return Artist(
        id=str(raw.get("id", "")),
        name=raw.get("name", "Unknown artist"),
        genres=[],
        image_url=raw.get("picture_medium") or raw.get("picture_small"),
        popularity=raw.get("nb_fan"),
        external_url=raw.get("link"),
    )


def map_deezer_track(raw: dict[str, Any]) -> Track:
    artist_raw = raw.get("artist") or {}
    album_raw = raw.get("album") or {}
    artists = [map_deezer_artist(artist_raw)] if artist_raw else []

    album = None
    if album_raw:
        album = Album(
            id=str(album_raw.get("id", "")),
            name=album_raw.get("title", "Unknown album"),
            image_url=album_raw.get("cover_medium") or album_raw.get("cover_small"),
            release_date=None,
        )

    return Track(
        id=str(raw.get("id", "")),
        name=raw.get("title", "Unknown track"),
        artists=artists,
        album=album,
        duration_ms=int(raw.get("duration", 0)) * 1000 if raw.get("duration") else None,
        preview_url=raw.get("preview"),
        external_url=raw.get("link"),
        popularity=raw.get("rank"),
    )
