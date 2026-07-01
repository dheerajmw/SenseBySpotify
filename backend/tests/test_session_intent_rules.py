from app.services.session_intent_rules import infer_intent_from_actions, merge_intent_results
from app.services.session_intent_validation import (
    classify_search_signal,
    map_artist_to_intent,
    sanitize_session_intent_result,
)


def test_infer_intent_from_repeated_searches():
    actions = [
        {"type": "SEARCH_TRACK", "value": "romance", "timestamp": 3},
        {"type": "SEARCH", "value": "romance", "timestamp": 2},
        {"type": "PLAY", "value": "Song — Artist", "timestamp": 1},
    ]

    result = infer_intent_from_actions("Workout", actions)

    assert result is not None
    assert result["intent_changed"] is True
    assert result["new_intent"] == "Romantic"
    assert result["confidence"] >= 0.8


def test_infer_intent_from_search_and_play():
    actions = [
        {"type": "SEARCH_TRACK", "value": "romance", "timestamp": 2},
        {"type": "PLAY", "value": "Love Song — Artist", "timestamp": 1},
    ]

    result = infer_intent_from_actions("Study", actions)

    assert result is not None
    assert result["intent_changed"] is True
    assert result["new_intent"] == "Romantic"


def test_no_change_when_search_matches_current_intent():
    actions = [
        {"type": "SEARCH_TRACK", "value": "workout", "timestamp": 2},
        {"type": "PLAY", "value": "Pump — Artist", "timestamp": 1},
    ]

    result = infer_intent_from_actions("Workout", actions)

    assert result is not None
    assert result["intent_changed"] is False
    assert result["new_intent"] == "Workout"
    assert result["preferred_artists"] == ["Artist"]


def test_infer_intent_from_romantic_plays_without_search():
    actions = [
        {"type": "PLAY", "value": "Love Story — Taylor Swift", "timestamp": 3},
        {"type": "PLAY", "value": "Romantic — Artist", "timestamp": 2},
        {"type": "PLAY", "value": "Urdu Rap — Artist", "timestamp": 1},
    ]

    result = infer_intent_from_actions("Urdu rap", actions)

    assert result is not None
    assert result["intent_changed"] is True
    assert result["new_intent"] == "Romantic"


def test_artist_search_maps_to_context_not_artist_name():
    actions = [
        {"type": "SEARCH_ARTIST", "value": "Coldplay", "timestamp": 2},
        {"type": "SEARCH_ARTIST", "value": "Coldplay", "timestamp": 1},
    ]

    result = infer_intent_from_actions("Focus", actions, profile_artists=["Coldplay"])

    assert result is not None
    assert result["new_intent"] == "Soft Rock"
    assert "Coldplay" in result["preferred_artists"]


def test_merge_prefers_rule_when_ai_is_conservative():
    ai_result = {
        "intent_changed": False,
        "new_intent": "Workout",
        "preferred_artists": [],
        "confidence": 0.6,
        "reason": "No change.",
    }
    rule_result = {
        "intent_changed": True,
        "new_intent": "Romantic",
        "preferred_artists": ["Artist"],
        "confidence": 0.9,
        "reason": "Searched romance twice.",
    }

    merged = merge_intent_results(ai_result, rule_result)

    assert merged["intent_changed"] is True
    assert merged["new_intent"] == "Romantic"
    assert merged["preferred_artists"] == ["Artist"]


def test_sanitize_rejects_artist_intent():
    sanitized = sanitize_session_intent_result(
        {
            "intent_changed": True,
            "new_intent": "Taylor Swift",
            "preferred_artists": [],
            "confidence": 0.9,
            "reason": "User searched Taylor Swift.",
        },
        current_intent="Focus",
        profile_artists=[],
        recommendation_artists=[],
    )

    assert sanitized["new_intent"] == "Upbeat Pop"
    assert "Taylor Swift" in sanitized["preferred_artists"]


def test_classify_search_signal_for_artist():
    classified = classify_search_signal("Prateek Kuhad", profile_artists=[])

    assert classified["intent"] == "Soft Indie"
    assert classified["preferred_artists"] == ["Prateek Kuhad"]


def test_map_artist_to_intent_known_and_unknown():
    assert map_artist_to_intent("Imagine Dragons") == "High Energy"
    assert map_artist_to_intent("Unknown Artist") == "Discovery"
