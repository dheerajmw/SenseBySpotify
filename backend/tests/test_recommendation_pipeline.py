from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.artist import Artist
from app.models.track import Album, Track
from app.models.user_context import UserContext
from app.schemas.user_profile import UserProfilePayload
from app.services.ai.base import RankedTrackResult
from app.services.candidates import build_search_queries
from app.services.recommendation_generator import (
    RecommendationGenerator,
    apply_artist_diversity,
    fallback_rank,
)


def _track(
    track_id: str,
    artist_id: str,
    name: str,
    *,
    popularity: int = 50,
    primary_genre: str | None = "Indie Rock",
) -> Track:
    return Track(
        id=track_id,
        name=name,
        artists=[Artist(id=artist_id, name=f"Artist {artist_id}", genres=["indie"])],
        album=Album(id=f"album-{track_id}", name="Album"),
        popularity=popularity,
        primary_genre=primary_genre,
    )


def test_build_search_queries_prioritizes_genres_over_raw_intent() -> None:
    context = UserContext(
        top_artists=[Artist(id="a1", name="Bon Iver", genres=["indie folk"])],
        top_genres=["indie folk", "acoustic"],
    )
    queries = build_search_queries(context, "hindi poetry")
    assert "hindi poetry" not in queries
    assert any("Bollywood" in query or "Indian" in query for query in queries)


def test_fallback_rank_prefers_genre_match() -> None:
    candidates = [
        _track("t1", "a1", "Poetry In Title", popularity=90, primary_genre="Soundtrack"),
        _track("t2", "a2", "Unrelated Name", popularity=10, primary_genre="Indian Pop"),
    ]
    ranked = fallback_rank(candidates, "hindi poetry", limit=2, profile_genres=["Bollywood"])
    assert ranked[0].track_id == "t2"


def test_apply_artist_diversity_caps_duplicates() -> None:
    tracks = {
        "t1": _track("t1", "a1", "One", popularity=80),
        "t2": _track("t2", "a1", "Two", popularity=70),
        "t3": _track("t3", "a2", "Three", popularity=60),
    }
    ranked = [
        RankedTrackResult(track_id="t1", rank=1, reason="r1", confidence=0.9, score=90),
        RankedTrackResult(track_id="t2", rank=2, reason="r2", confidence=0.8, score=80),
        RankedTrackResult(track_id="t3", rank=3, reason="r3", confidence=0.7, score=70),
    ]
    diverse = apply_artist_diversity(ranked, tracks, limit=3)
    artist_ids = [tracks[item.track_id].artists[0].id for item in diverse]
    assert artist_ids.count("a1") <= 2


@pytest.mark.asyncio
async def test_generator_uses_fallback_when_ai_fails() -> None:
    catalog = MagicMock()
    catalog.search_tracks = AsyncMock(return_value=[_track("t1", "a1", "Track 1", popularity=80)])

    ai = MagicMock()
    ai.rank_tracks = AsyncMock(side_effect=RuntimeError("AI down"))

    generator = RecommendationGenerator(catalog, ai)
    profile = UserProfilePayload(
        genres=["indie"],
        current_intent="indie focus",
    )

    recommendations, candidate_count, used_ai, fallback_reason = await generator.generate(
        profile,
        query="indie focus",
        limit=1,
    )

    assert candidate_count == 1
    assert used_ai is False
    assert fallback_reason is not None
    assert "temporarily unavailable" in fallback_reason.lower()
    assert len(recommendations) == 1
    assert recommendations[0].track.id == "t1"


@pytest.mark.asyncio
async def test_generator_filters_hallucinated_track_ids() -> None:
    catalog = MagicMock()
    catalog.search_tracks = AsyncMock(return_value=[_track("t1", "a1", "Track 1", popularity=80)])

    ai = MagicMock()
    ai.rank_tracks = AsyncMock(
        return_value=[
            RankedTrackResult(
                track_id="fake-id",
                rank=1,
                reason="bad",
                confidence=0.9,
                score=90,
            ),
            RankedTrackResult(
                track_id="t1",
                rank=2,
                reason="good pick for indie focus and your taste",
                confidence=0.85,
                score=85,
            ),
        ]
    )

    generator = RecommendationGenerator(catalog, ai)
    profile = UserProfilePayload(genres=["indie"], current_intent="indie focus")

    recommendations, _, used_ai, fallback_reason = await generator.generate(
        profile,
        query="indie focus",
        limit=5,
    )

    assert used_ai is True
    assert fallback_reason is None
    assert len(recommendations) == 1
    assert recommendations[0].track.id == "t1"
