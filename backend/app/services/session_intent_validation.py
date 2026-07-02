from __future__ import annotations

import logging

from app.services.valid_intents import (
    canonical_intent,
    is_discovery_label,
    is_genre_label,
    is_known_artist_name,
    is_valid_intent,
    normalize_text,
)

logger = logging.getLogger(__name__)

MOOD_KEYWORD_TO_INTENT: dict[str, str] = {
    "workout": "Workout",
    "gym": "Workout",
    "running": "Workout",
    "cardio": "Workout",
    "focus": "Focus",
    "study": "Study",
    "coding": "Coding",
    "code": "Coding",
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
    "late night": "Late Night",
    "night": "Late Night",
    "sleep": "Sleep",
    "travel": "Travel",
    "morning": "Morning",
    "energy": "High Energy",
    "energetic": "High Energy",
    "happy": "Happy",
    "sad": "Melancholic",
    "melanchol": "Melancholic",
    "meditat": "Meditation",
    "festival": "Festival",
    "read": "Reading",
    "reading": "Reading",
}


def extract_intent_from_text(text: str) -> str | None:
    normalized = normalize_text(text)
    if not normalized:
        return None

    direct = canonical_intent(text)
    if direct:
        return direct

    for keyword, intent in sorted(MOOD_KEYWORD_TO_INTENT.items(), key=lambda item: -len(item[0])):
        if keyword in normalized:
            return intent

    return None


def is_likely_artist_name(candidate: str, known_artists: set[str]) -> bool:
    normalized = normalize_text(candidate)
    if not normalized or len(normalized) < 2:
        return False

    if extract_intent_from_text(candidate):
        return False

    if is_genre_label(candidate) or is_discovery_label(candidate):
        return False

    if is_known_artist_name(candidate, known_artists):
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

    capitalized_words = sum(1 for word in words if word[:1].isupper())
    if capitalized_words >= max(1, len(words) - 1):
        return True

    if len(words) == 1 and not is_valid_intent(candidate):
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
            key = normalize_text(cleaned)
            if key in seen:
                continue
            seen.add(key)
            merged.append(cleaned)
    return merged[:12]


def merge_preferred_genres(*lists: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for items in lists:
        for genre in items:
            cleaned = " ".join(str(genre).strip().split())
            if not cleaned:
                continue
            key = normalize_text(cleaned)
            if key in seen:
                continue
            seen.add(key)
            merged.append(cleaned.title() if cleaned.islower() else cleaned)
    return merged[:12]


def validate_proposed_intent(
    proposed: str,
    *,
    current_intent: str,
    known_artists: set[str],
) -> dict:
    cleaned = str(proposed).strip()
    preferred_artists: list[str] = []
    preferred_genres: list[str] = []

    if not cleaned:
        return {
            "accepted": False,
            "intent": current_intent,
            "intent_changed": False,
            "rejection_reason": "Empty intent proposal.",
            "preferred_artists": [],
            "preferred_genres": [],
        }

    if is_discovery_label(cleaned):
        return {
            "accepted": False,
            "intent": current_intent,
            "intent_changed": False,
            "rejection_reason": "Discovery Level cannot become Session Intent.",
            "preferred_artists": [],
            "preferred_genres": [],
        }

    if is_genre_label(cleaned):
        preferred_genres = merge_preferred_genres([cleaned])
        return {
            "accepted": False,
            "intent": current_intent,
            "intent_changed": False,
            "rejection_reason": "Genre labels cannot become Session Intent.",
            "preferred_artists": [],
            "preferred_genres": preferred_genres,
        }

    if is_likely_artist_name(cleaned, known_artists) or is_known_artist_name(cleaned, known_artists):
        preferred_artists = merge_preferred_artists([cleaned])
        return {
            "accepted": False,
            "intent": current_intent,
            "intent_changed": False,
            "rejection_reason": "Artist names cannot become Session Intent.",
            "preferred_artists": preferred_artists,
            "preferred_genres": [],
        }

    canonical = canonical_intent(cleaned)
    if not canonical:
        extracted = extract_intent_from_text(cleaned)
        if extracted:
            canonical = extracted
        else:
            return {
                "accepted": False,
                "intent": current_intent,
                "intent_changed": False,
                "rejection_reason": f"Invalid AI intent ignored: '{cleaned}' is not in the allowed intent list.",
                "preferred_artists": [],
                "preferred_genres": [],
            }

    changed = normalize_text(canonical) != normalize_text(current_intent)
    return {
        "accepted": True,
        "intent": canonical,
        "intent_changed": changed,
        "rejection_reason": None,
        "preferred_artists": [],
        "preferred_genres": [],
    }


def sanitize_session_intent_result(
    result: dict,
    *,
    current_intent: str,
    profile_artists: list[str],
    profile_genres: list[str],
    recommendation_artists: list[str],
) -> dict:
    known_artists = set(profile_artists) | set(recommendation_artists)
    preferred_artists = merge_preferred_artists(
        [str(name) for name in result.get("preferred_artists", []) if str(name).strip()],
    )
    preferred_genres = merge_preferred_genres(
        [str(name) for name in result.get("preferred_genres", []) if str(name).strip()],
        profile_genres,
    )

    raw_intent = str(result.get("new_intent", current_intent)).strip() or current_intent
    reason = str(result.get("reason", "No reason provided.")).strip()
    raw_changed = bool(result.get("intent_changed", False))

    validation = validate_proposed_intent(
        raw_intent,
        current_intent=current_intent,
        known_artists=known_artists,
    )

    preferred_artists = merge_preferred_artists(preferred_artists, validation["preferred_artists"])
    preferred_genres = merge_preferred_genres(preferred_genres, validation["preferred_genres"])

    if not validation["accepted"]:
        logger.warning(
            "Invalid AI intent ignored: %s (proposed=%r, current=%r)",
            validation["rejection_reason"],
            raw_intent,
            current_intent,
        )
        return {
            "intent_changed": False,
            "new_intent": current_intent,
            "preferred_artists": preferred_artists,
            "preferred_genres": preferred_genres,
            "confidence": min(1.0, max(0.0, float(result.get("confidence", 0.5)))),
            "reason": f"{reason} {validation['rejection_reason']}".strip(),
            "validation_status": "rejected",
            "validation_message": validation["rejection_reason"],
            "raw_new_intent": raw_intent,
        }

    intent_changed = raw_changed and validation["intent_changed"]
    new_intent = validation["intent"] if intent_changed else current_intent

    if not intent_changed and (preferred_artists or preferred_genres):
        reason = (
            f"{reason} Updated preferences without changing listening intent."
        ).strip()

    return {
        "intent_changed": intent_changed,
        "new_intent": new_intent,
        "preferred_artists": preferred_artists,
        "preferred_genres": preferred_genres,
        "confidence": min(1.0, max(0.0, float(result.get("confidence", 0.5)))),
        "reason": reason,
        "validation_status": "accepted",
        "validation_message": None,
        "raw_new_intent": raw_intent,
    }


def classify_search_signal(
    query: str,
    *,
    profile_artists: list[str],
    is_artist_search: bool = False,
) -> dict:
    cleaned = " ".join(query.strip().split())
    if not cleaned:
        return {"intent": None, "preferred_artists": [], "preferred_genres": []}

    known_artists = set(profile_artists)
    preferred_artists: list[str] = []
    preferred_genres: list[str] = []
    intent: str | None = None

    if is_genre_label(cleaned):
        preferred_genres = merge_preferred_genres([cleaned])
    elif is_artist_search or is_likely_artist_name(cleaned, known_artists):
        preferred_artists = merge_preferred_artists([cleaned])
    else:
        intent = extract_intent_from_text(cleaned)

    return {
        "intent": intent,
        "preferred_artists": preferred_artists,
        "preferred_genres": preferred_genres,
    }


def extract_artists_from_play_label(play_label: str) -> list[str]:
    for separator in (" — ", " - "):
        if separator in play_label:
            artist_part = play_label.split(separator, 1)[1].strip()
            if artist_part:
                return [artist_part]
    return []
