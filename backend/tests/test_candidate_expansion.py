from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.artist import Artist
from app.models.track import Album, Track
from app.services.candidate_expansion import (
    adjacent_genres_for_intent,
    expand_candidates_if_needed,
)


def _track(track_id: str, name: str) -> Track:
    return Track(
        id=track_id,
        name=name,
        artists=[Artist(id="a1", name="Artist", genres=["pop"])],
        album=Album(id="album-1", name="Album"),
        popularity=50,
        primary_genre="Pop",
    )


def test_adjacent_genres_for_romantic_intent() -> None:
    genres = adjacent_genres_for_intent("Romantic evening")
    assert genres == ["Bollywood", "Pop", "Singer/Songwriter"]


@pytest.mark.asyncio
async def test_expand_candidates_if_needed_fetches_adjacent_genres() -> None:
    catalog = MagicMock()
    catalog.search_tracks = AsyncMock(
        side_effect=[
            [_track("t2", "Expanded 1"), _track("t3", "Expanded 2")],
            [_track("t4", "Expanded 3")],
            [],
            [],
            [],
            [],
        ]
    )

    candidates = [_track("t1", "Seed")]
    seen_ids = {track.id for track in candidates}
    expanded = await expand_candidates_if_needed(
        catalog,
        prompt="Romantic",
        candidates=candidates,
        seen_ids=seen_ids,
        excluded_ids=set(),
        max_candidates=50,
        search_limit=25,
    )

    assert len(expanded) >= 3
    assert catalog.search_tracks.await_count >= 1
