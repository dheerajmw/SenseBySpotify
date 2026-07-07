import pytest

from app.services.session_intent_validation import (
    extract_intent_from_text,
    is_likely_artist_name,
    sanitize_session_intent_result,
    validate_proposed_intent,
)


def test_extract_intent_from_mood_keywords():
    assert extract_intent_from_text("workout music") == "Workout"
    assert extract_intent_from_text("late night coding") == "Late Night"


def test_is_likely_artist_name_detects_known_artist():
    assert is_likely_artist_name("Arijit Singh", {"Arijit Singh"}) is True
    assert is_likely_artist_name("Workout", set()) is False


def test_sanitize_keeps_valid_context_intent():
    sanitized = sanitize_session_intent_result(
        {
            "intent_changed": True,
            "new_intent": "Workout",
            "preferred_artists": ["Eminem"],
            "preferred_genres": ["Rock"],
            "confidence": 0.91,
            "reason": "User searched workout tracks.",
        },
        current_intent="Focus",
        profile_artists=["Eminem"],
        profile_genres=["Pop"],
        recommendation_artists=[],
    )

    assert sanitized["new_intent"] == "Workout"
    assert sanitized["preferred_artists"] == ["Eminem"]
    assert sanitized["validation_status"] == "accepted"


def test_sanitize_rejects_discovery_label():
    sanitized = sanitize_session_intent_result(
        {
            "intent_changed": True,
            "new_intent": "Discovery",
            "preferred_artists": [],
            "confidence": 0.9,
            "reason": "User wants discovery.",
        },
        current_intent="Focus",
        profile_artists=[],
        profile_genres=[],
        recommendation_artists=[],
    )

    assert sanitized["new_intent"] == "Focus"
    assert sanitized["intent_changed"] is False
    assert sanitized["validation_status"] == "rejected"
    assert "Discovery Level" in sanitized["validation_message"]


def test_sanitize_rejects_artist_name():
    sanitized = sanitize_session_intent_result(
        {
            "intent_changed": True,
            "new_intent": "Coldplay",
            "preferred_artists": [],
            "confidence": 0.9,
            "reason": "User played Coldplay.",
        },
        current_intent="Late Night",
        profile_artists=[],
        profile_genres=[],
        recommendation_artists=[],
    )

    assert sanitized["new_intent"] == "Late Night"
    assert "Coldplay" in sanitized["preferred_artists"]
    assert sanitized["validation_status"] == "rejected"


def test_sanitize_rejects_genre_label():
    sanitized = sanitize_session_intent_result(
        {
            "intent_changed": True,
            "new_intent": "Rock",
            "preferred_artists": [],
            "confidence": 0.9,
            "reason": "User searched rock.",
        },
        current_intent="Focus",
        profile_artists=[],
        profile_genres=[],
        recommendation_artists=[],
    )

    assert sanitized["new_intent"] == "Focus"
    assert "Rock" in sanitized["preferred_genres"]
    assert sanitized["validation_status"] == "rejected"


def test_validate_proposed_intent_rejects_taylor_swift():
    result = validate_proposed_intent(
        "Taylor Swift",
        current_intent="Focus",
        known_artists=set(),
    )

    assert result["accepted"] is False
    assert result["intent"] == "Focus"
    assert "Taylor Swift" in result["preferred_artists"]


def test_validate_proposed_intent_maps_fun_alias_to_happy():
    result = validate_proposed_intent(
        "FUN",
        current_intent="Focus",
        known_artists=set(),
    )

    assert result["accepted"] is True
    assert result["intent"] == "Happy"
    assert result["intent_changed"] is True


@pytest.mark.parametrize(
    ("raw_intent", "expected"),
    [
        ("COOL", "Relaxing"),
        ("Chill", "Relaxing"),
        ("Vibes", "Relaxing"),
        ("Hype", "Party"),
        ("Emotional", "Melancholic"),
        ("Zen", "Relaxing"),
        ("Gym", "Workout"),
        ("Date Night", "Romantic"),
    ],
)
def test_validate_proposed_intent_maps_common_aliases(raw_intent: str, expected: str):
    result = validate_proposed_intent(
        raw_intent,
        current_intent="Focus",
        known_artists=set(),
    )

    assert result["accepted"] is True
    assert result["intent"] == expected


def test_extract_intent_from_descriptive_high_notes():
    assert extract_intent_from_text("SONG WITH HIGH NOTES") == "Romantic"


def test_study_alias_maps_to_focus():
    assert extract_intent_from_text("study music") == "Focus"
    assert extract_intent_from_text("CALM") == "Relaxing"


def test_sanitize_accepts_fun_ai_intent_as_happy():
    sanitized = sanitize_session_intent_result(
        {
            "intent_changed": True,
            "new_intent": "FUN",
            "preferred_artists": [],
            "preferred_genres": [],
            "confidence": 0.88,
            "reason": "User is listening to upbeat party tracks.",
        },
        current_intent="Focus",
        profile_artists=[],
        profile_genres=[],
        recommendation_artists=[],
    )

    assert sanitized["new_intent"] == "Happy"
    assert sanitized["intent_changed"] is True
    assert sanitized["validation_status"] == "accepted"
