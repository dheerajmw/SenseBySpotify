from app.services.recommend_from_track import build_follow_up_queries


def test_build_follow_up_queries_uses_intent_genres_not_track_title() -> None:
    queries = build_follow_up_queries(
        track_name="Yellow",
        artist_name="Coldplay",
        profile_genres=["Rock", "Pop"],
        intent_query="late night coding",
    )

    assert "Yellow" not in queries
    assert any("Coldplay" in query for query in queries)
    assert any("Rock" in query or "Electronic" in query for query in queries)
