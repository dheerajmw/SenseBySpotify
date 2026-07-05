from typing import Optional

from app.services.intent_genre_matching import (
    build_genre_first_search_queries,
    resolve_target_genres,
    score_track_genre_fit,
)
from app.models.artist import Artist
from app.models.track import Album, Track


def _track(name: str, genre: Optional[str]) -> Track:
    return Track(
        id=name,
        name=name,
        artists=[Artist(id="a1", name="Artist", genres=[genre] if genre else [])],
        album=Album(id="al1", name="Album"),
        primary_genre=genre,
    )


def test_resolve_target_genres_for_hindi_poetry() -> None:
    genres = resolve_target_genres("Melancholic hindi urdu poetry", ["Rock"], preferred_genres=["Hindi", "Urdu"])
    assert "Bollywood" in genres or "Indian Pop" in genres
    assert "Rock" not in genres
    assert "Indie Rock" not in genres
    assert "Classical" not in genres


def test_resolve_target_genres_for_poetry_without_cultural_cue() -> None:
    genres = resolve_target_genres("Reading poetry", ["Pop"])
    assert "Indian Pop" not in genres
    assert any(genre in {"Singer/Songwriter", "Folk", "Spoken Word"} for genre in genres)


def test_resolve_target_genres_for_workout() -> None:
    genres = resolve_target_genres("Workout", ["Pop"])
    assert "Pop" in genres
    assert any(genre in {"Dance", "Hip-Hop/Rap", "Electronic"} for genre in genres)


def test_resolve_target_genres_for_reading_with_hindi_urdu_preferences() -> None:
    genres = resolve_target_genres(
        "Reading",
        ["Pop"],
        preferred_genres=["Hindi", "Urdu"],
    )
    assert "Indian Pop" in genres or "Bollywood" in genres
    assert "Classical" not in genres
    assert "Jazz" not in genres


def test_build_genre_first_search_queries_avoids_raw_intent_title() -> None:
    queries = build_genre_first_search_queries(
        "Melancholic hindi urdu poetry",
        ["Rock"],
        [],
        preferred_genres=["Hindi", "Urdu"],
    )
    assert "hindi poetry" not in queries
    assert any("Bollywood" in query or "ghazal" in query for query in queries)


def test_score_track_genre_fit_prefers_genre_over_title() -> None:
    indian = _track("Poetry of the Night", "Indian Pop")
    soundtrack = _track("Hindi Poetry Song", "Soundtrack")
    targets = resolve_target_genres("hindi poetry", ["Bollywood"])

    assert score_track_genre_fit(indian, targets, "hindi poetry") > score_track_genre_fit(
        soundtrack,
        targets,
        "hindi poetry",
    )
