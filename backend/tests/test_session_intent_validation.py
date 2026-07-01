from app.services.session_intent_validation import (
    extract_intent_from_text,
    is_likely_artist_name,
    sanitize_session_intent_result,
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
            "confidence": 0.91,
            "reason": "User searched workout tracks.",
        },
        current_intent="Focus",
        profile_artists=["Eminem"],
        recommendation_artists=[],
    )

    assert sanitized["new_intent"] == "Workout"
    assert sanitized["preferred_artists"] == ["Eminem"]
