from __future__ import annotations

import re

ARTIST_TO_INTENT: dict[str, str] = {
    "coldplay": "Soft Rock",
    "arijit singh": "Bollywood Romance",
    "prateek kuhad": "Soft Indie",
    "taylor swift": "Upbeat Pop",
    "imagine dragons": "High Energy",
    "eminem": "High Energy",
    "ed sheeran": "Acoustic",
    "the weeknd": "Late Night",
    "drake": "Hip Hop Evening",
    "billie eilish": "Melancholic",
    "ariana grande": "Upbeat Pop",
    "bruno mars": "Party",
    "dua lipa": "Dance",
    "post malone": "Chill",
    "kendrick lamar": "High Energy",
    "bad bunny": "Party",
    "bts": "High Energy",
    "shreya ghoshal": "Bollywood Romance",
    "sonu nigam": "Bollywood Romance",
    "atif aslam": "Bollywood Romance",
}

MOOD_KEYWORD_TO_INTENT: dict[str, str] = {
    "workout": "Workout",
    "gym": "Workout",
    "running": "Workout",
    "cardio": "Workout",
    "focus": "Focus",
    "study": "Study",
    "coding": "Late Night",
    "drive": "Driving",
    "driving": "Driving",
    "road trip": "Road Trip",
    "relax": "Relaxing",
    "relaxing": "Relaxing",
    "chill": "Calm",
    "calm": "Calm",
    "party": "Party",
    "romance": "Romantic",
    "romantic": "Romantic",
    "love": "Romantic",
    "rain": "Rainy Evening",
    "rainy": "Rainy Evening",
    "night": "Late Night",
    "sleep": "Sleep",
    "travel": "Travel",
    "morning": "Morning",
    "motivat": "Motivational",
    "energy": "High Energy",
    "energetic": "High Energy",
    "happy": "Happy",
    "sad": "Melancholic",
    "melanchol": "Melancholic",
    "acoustic": "Acoustic",
    "lo-fi": "Lo-fi",
    "lofi": "Lo-fi",
    "jazz": "Jazz Evening",
    "festival": "Festival",
    "dance": "Dance",
    "meditat": "Meditation",
    "nostalg": "Nostalgic",
    "bollywood": "Bollywood Romance",
    "indie": "Soft Indie",
    "pop": "Upbeat Pop",
    "hip hop": "High Energy",
    "rap": "High Energy",
    "urdu rap": "High Energy",
}

VALID_INTENT_PHRASES = {
    "focus",
    "workout",
    "driving",
    "relaxing",
    "party",
    "romantic",
    "rainy evening",
    "late night",
    "study",
    "travel",
    "morning",
    "sleep",
    "motivational",
    "high energy",
    "calm",
    "melancholic",
    "happy",
    "acoustic",
    "lo-fi",
    "jazz evening",
    "road trip",
    "festival",
    "dance",
    "meditation",
    "nostalgic",
    "bollywood romance",
    "soft indie",
    "upbeat pop",
    "soft rock",
    "romantic mood",
    "late night coding",
    "discovery",
}


def _normalize(text: str) -> str:
    return " ".join(text.lower().strip().split())


def _title_phrase(text: str) -> str:
    cleaned = " ".join(text.strip().split())
    if not cleaned:
        return cleaned
    if cleaned.islower() or cleaned.isupper():
        return cleaned.title()
    return cleaned


def extract_intent_from_text(text: str) -> str | None:
    normalized = _normalize(text)
    if not normalized:
        return None

    for keyword, intent in sorted(MOOD_KEYWORD_TO_INTENT.items(), key=lambda item: -len(item[0])):
        if keyword in normalized:
            return intent

    if normalized in VALID_INTENT_PHRASES:
        return _title_phrase(normalized)

    return None


def map_artist_to_intent(artist_name: str) -> str:
    mapped = ARTIST_TO_INTENT.get(_normalize(artist_name))
    if mapped:
        return mapped
    return "Discovery"


def is_likely_artist_name(candidate: str, known_artists: set[str]) -> bool:
    normalized = _normalize(candidate)
    if not normalized or len(normalized) < 2:
        return False

    if extract_intent_from_text(candidate):
        return False

    known_normalized = {_normalize(name) for name in known_artists if name.strip()}
    if normalized in known_normalized:
        return True

    if normalized in ARTIST_TO_INTENT:
        return True

    if " — " in candidate or " - " in candidate:
        return False

    words = candidate.strip().split()
    if not (1 <= len(words) <= 4):
        return False

    if any(char.isdigit() for char in candidate):
        return False

    mood_hits = sum(1 for keyword in MOOD_KEYWORD_TO_INTENT if keyword in normalized)
    if mood_hits > 0:
        return False

    # Likely a proper name: each word starts uppercase or is all lowercase single token search
    capitalized_words = sum(1 for word in words if word[:1].isupper())
    if capitalized_words >= max(1, len(words) - 1):
        return True

    if len(words) == 1 and normalized not in VALID_INTENT_PHRASES:
        return True

    return False


def merge_preferred_artists(*lists: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for items in lists:
        for name in items:
            cleaned = " ".join(str(name).strip().split())
            if not cleaned:
                continue
            key = _normalize(cleaned)
            if key in seen:
                continue
            seen.add(key)
            merged.append(cleaned)
    return merged[:12]


def sanitize_session_intent_result(
    result: dict,
    *,
    current_intent: str,
    profile_artists: list[str],
    recommendation_artists: list[str],
) -> dict:
    known_artists = set(profile_artists) | set(recommendation_artists)
    preferred_artists = merge_preferred_artists(
        [str(name) for name in result.get("preferred_artists", []) if str(name).strip()],
    )

    raw_intent = str(result.get("new_intent", current_intent)).strip() or current_intent
    reason = str(result.get("reason", "No reason provided.")).strip()
    intent_changed = bool(result.get("intent_changed", False))

    if is_likely_artist_name(raw_intent, known_artists):
        preferred_artists = merge_preferred_artists(preferred_artists, [raw_intent])
        mapped_intent = map_artist_to_intent(raw_intent)
        if _normalize(mapped_intent) != _normalize(current_intent):
            intent_changed = True
            reason = (
                f"Detected artist preference for '{raw_intent}'. "
                f"Mapped listening context to '{mapped_intent}'."
            )
        else:
            intent_changed = bool(preferred_artists)
            reason = (
                f"Captured artist preference for '{raw_intent}' "
                f"without changing the current listening context."
            )
        raw_intent = mapped_intent if intent_changed else current_intent

    contextual_intent = extract_intent_from_text(raw_intent)
    if contextual_intent:
        raw_intent = contextual_intent
    elif is_likely_artist_name(raw_intent, known_artists | set(preferred_artists)):
        preferred_artists = merge_preferred_artists(preferred_artists, [raw_intent])
        raw_intent = map_artist_to_intent(raw_intent)
        intent_changed = _normalize(raw_intent) != _normalize(current_intent)
        reason = (
            f"Rejected artist-like intent '{result.get('new_intent', '')}'. "
            f"Using listening context '{raw_intent}'."
        )

    if _normalize(raw_intent) == _normalize(current_intent):
        intent_changed = intent_changed and bool(preferred_artists)

    return {
        "intent_changed": intent_changed,
        "new_intent": raw_intent if intent_changed else current_intent,
        "preferred_artists": preferred_artists,
        "confidence": min(1.0, max(0.0, float(result.get("confidence", 0.5)))),
        "reason": reason,
    }


def classify_search_signal(
    query: str,
    *,
    profile_artists: list[str],
    is_artist_search: bool = False,
) -> dict:
    cleaned = " ".join(query.strip().split())
    if not cleaned:
        return {"intent": None, "preferred_artists": []}

    known_artists = set(profile_artists)
    preferred_artists: list[str] = []
    intent: str | None = None

    if is_artist_search or is_likely_artist_name(cleaned, known_artists):
        preferred_artists = [cleaned]
        intent = map_artist_to_intent(cleaned)
    else:
        intent = extract_intent_from_text(cleaned) or _title_phrase(cleaned)

    if intent and is_likely_artist_name(intent, known_artists | set(preferred_artists)):
        preferred_artists = merge_preferred_artists(preferred_artists, [intent])
        intent = map_artist_to_intent(intent)

    return {
        "intent": intent,
        "preferred_artists": preferred_artists,
    }


def extract_artists_from_play_label(play_label: str) -> list[str]:
    for separator in (" — ", " - "):
        if separator in play_label:
            artist_part = play_label.split(separator, 1)[1].strip()
            if artist_part:
                return [artist_part]
    return []
