"""Sanity checks for frontend query-building rules (mirrored here for docs)."""

from app.services.session_intent_validation import extract_intent_from_text
from app.services.valid_intents import canonical_intent, normalize_text


def _raw_redundant_with_mood(mood: str, raw: str) -> bool:
    mood_norm = normalize_text(mood)
    raw_norm = normalize_text(raw)
    if not raw_norm or mood_norm == raw_norm:
        return True
    from_raw = canonical_intent(raw)
    if not from_raw or normalize_text(from_raw) != mood_norm:
        return False
    words = raw.strip().split()
    return len(words) <= 2 and len(raw) <= 24


def test_calm_search_not_redundant_with_itself():
    assert _raw_redundant_with_mood("Calm", "CALM") is True


def test_descriptive_search_not_redundant():
    assert _raw_redundant_with_mood("Happy", "soft song for fun time") is False
