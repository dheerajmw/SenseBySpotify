from app.services.session_intent_validation import extract_intent_from_text
from app.services.user_intent_parser import parse_user_intent_rules


def test_extract_intent_from_high_notes_phrase():
    assert extract_intent_from_text("SONG WITH HIGH NOTES") == "Romantic"


def test_parse_user_intent_rules_accepts_high_notes():
    result = parse_user_intent_rules(
        "song with high notes",
        profile_artists=[],
        profile_genres=["Pop"],
    )

    assert result["accepted"] is True
    assert result["intent"] == "Romantic"
    assert "Pop" in result["preferred_genres"] or "Vocal" in result["preferred_genres"]
    assert result["source"] == "rules"


def test_parse_user_intent_rules_accepts_soft_song_for_fun_time():
    result = parse_user_intent_rules(
        "SOFT SONG FOR FUN TIME",
        profile_artists=[],
        profile_genres=["Pop"],
    )

    assert result["accepted"] is True
    assert result["intent"] == "Happy"


def test_parse_user_intent_rules_accepts_workout_phrase():
    result = parse_user_intent_rules(
        "music for my gym session",
        profile_artists=[],
        profile_genres=[],
    )

    assert result["accepted"] is True
    assert result["intent"] == "Workout"
