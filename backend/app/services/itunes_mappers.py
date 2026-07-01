from __future__ import annotations

from typing import Any

from app.models.artist import Artist
from app.models.track import Album, Track


def map_itunes_track(raw: dict[str, Any]) -> Track:
    artist = Artist(
        id=str(raw.get("artistId", raw.get("trackId", "unknown"))),
        name=raw.get("artistName", "Unknown artist"),
        image_url=None,
        external_url=raw.get("artistViewUrl"),
    )
    album = Album(
        id=str(raw.get("collectionId", raw.get("trackId", "unknown"))),
        name=raw.get("collectionName", "Unknown album"),
        image_url=raw.get("artworkUrl100") or raw.get("artworkUrl60"),
        release_date=(raw.get("releaseDate") or "")[:10] or None,
    )
    return Track(
        id=str(raw.get("trackId", "")),
        name=raw.get("trackName", "Unknown track"),
        artists=[artist],
        album=album,
        duration_ms=raw.get("trackTimeMillis"),
        preview_url=raw.get("previewUrl"),
        external_url=raw.get("trackViewUrl"),
        popularity=None,
    )
