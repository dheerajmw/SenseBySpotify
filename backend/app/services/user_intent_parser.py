from __future__ import annotations

import logging
import re

from app.services.ai.openai_provider import OpenAIProvider
from app.services.session_intent_validation import (
    extract_intent_from_text,
    infer_intent_from_descriptive_phrase,
    merge_preferred_artists,
    merge_preferred_genres,
    validate_proposed_intent,
)
from app.services.valid_intents import GENERAL_LISTENING_INTENT, canonical_intent, normalize_text

logger = logging.getLogger(__name__)

LANGUAGE_GENRE_HINTS: dict[str, str] = {
    "hindi": "Hindi",
    "urdu": "Urdu",
    "punjabi": "Punjabi",
    "tamil": "Tamil",
    "telugu": "Telugu",
    "bollywood": "Bollywood",
    "ghazal": "Ghazal",
    "shayari": "Shayari",
}

GENRE_LABELS = [
    "pop",
    "bollywood",
    "indie",
    "rock",
    "hip hop",
    "lo-fi",
    "lofi",
    "jazz",
    "edm",
    "classical",
    "punjabi",
    "acoustic",
    "alternative",
    "metal",
    "country",
    "r&b",
    "soul",
    "blues",
    "folk",
    "reggae",
    "latin",
    "k-pop",
    "techno",
    "house",
    "trap",
]

# Natural-language phrases → canonical intent (longest match first).
DESCRIPTIVE_PHRASE_TO_INTENT: tuple[tuple[str, str], ...] = (
    ("high notes", "Romantic"),
    ("high note", "Romantic"),
    ("powerful vocal", "Romantic"),
    ("powerful vocals", "Romantic"),
    ("vocal range", "Romantic"),
    ("falsetto", "Romantic"),
    ("slow song", "Relaxing"),
    ("slow songs", "Relaxing"),
    ("wind down", "Relaxing"),
    ("pump up", "High Energy"),
    ("pump me up", "High Energy"),
    ("get hyped", "High Energy"),
    ("feel good", "Happy"),
    ("road trip", "Road Trip"),
    ("rainy day", "Rainy Evening"),
    ("late night", "Late Night"),
    ("deep work", "Focus"),
    ("heart break", "Melancholic"),
    ("heartbreak", "Melancholic"),
    ("break up", "Melancholic"),
    ("breakup", "Melancholic"),
    ("to code", "Coding"),
    ("while coding", "Coding"),
    ("to study", "Study"),
    ("while studying", "Study"),
    ("to workout", "Workout"),
    ("while working out", "Workout"),
    ("to sleep", "Sleep"),
    ("fall asleep", "Sleep"),
    ("to drive", "Driving"),
    ("while driving", "Driving"),
    ("fun time", "Happy"),
    ("good time", "Happy"),
    ("soft song", "Calm"),
    ("soft songs", "Calm"),
    ("soft music", "Calm"),
    ("easy listening", "Relaxing"),
)

DESCRIPTIVE_PHRASE_TO_GENRES: dict[str, list[str]] = {
    "high notes": ["Pop", "Vocal", "R&B/Soul"],
    "high note": ["Pop", "Vocal", "R&B/Soul"],
    "powerful vocal": ["Pop", "Vocal", "R&B/Soul"],
    "powerful vocals": ["Pop", "Vocal", "R&B/Soul"],
    "vocal range": ["Pop", "Vocal", "Classical"],
    "falsetto": ["Pop", "Vocal", "R&B/Soul"],
    "acoustic": ["Acoustic", "Singer/Songwriter", "Folk"],
}


def extract_genre_hints_from_text(text: str) -> list[str]:
    normalized = normalize_text(text)
    if not normalized:
        return []

    hints: list[str] = []
    seen: set[str] = set()

    def add(label: str) -> None:
        cleaned = " ".join(label.strip().split())
        key = normalize_text(cleaned)
        if not key or key in seen:
            return
        seen.add(key)
        hints.append(cleaned.title() if cleaned.islower() else cleaned)

    raw_lower = text.lower()
    for keyword, genre in LANGUAGE_GENRE_HINTS.items():
        if keyword in raw_lower:
            add(genre)

    for label in GENRE_LABELS:
        if label in raw_lower:
            add(label)

    for phrase, genres in DESCRIPTIVE_PHRASE_TO_GENRES.items():
        if phrase in raw_lower:
            for genre in genres:
                add(genre)

    if re.search(r"vocal|singing|singer", raw_lower):
        add("Vocal")

    return hints


def refine_intent_for_cultural_listening(raw_input: str, intent: str) -> str:
    normalized = raw_input.lower()
    has_poetry = bool(re.search(r"poetry|poem|nazm|ghazal|shayari", normalized))
    has_south_asian = bool(
        re.search(r"hindi|urdu|bollywood|ghazal|shayari|punjabi|sufi", normalized)
    )

    if has_poetry and has_south_asian:
        return "Melancholic"
    if re.search(r"ghazal|shayari|urdu", normalized):
        return "Melancholic"
    return intent


def format_display_label(intent: str, genre_hints: list[str]) -> str:
    mood = intent.strip()
    if not mood:
        return ", ".join(genre_hints)
    if not genre_hints:
        return mood
    mood_key = normalize_text(mood)
    genres = [genre for genre in genre_hints if normalize_text(genre) != mood_key]
    if not genres:
        return mood
    return f"{mood} · {', '.join(genres)}"


def parse_user_intent_rules(
    user_input: str,
    *,
    profile_artists: list[str],
    profile_genres: list[str],
) -> dict:
    cleaned = user_input.strip()
    known_artists = set(profile_artists)
    genre_hints = extract_genre_hints_from_text(cleaned)

    if not cleaned:
        return {
            "accepted": False,
            "intent": GENERAL_LISTENING_INTENT,
            "preferred_genres": [],
            "preferred_artists": [],
            "display_label": "",
            "reason": "",
            "rejection_reason": "Empty intent.",
            "source": "rules",
        }

    validation = validate_proposed_intent(
        cleaned,
        current_intent=GENERAL_LISTENING_INTENT,
        known_artists=known_artists,
    )

    if not validation["accepted"]:
        inferred = (
            infer_intent_from_descriptive_phrase(cleaned)
            or extract_intent_from_text(cleaned)
        )
        if inferred:
            validation = {
                "accepted": True,
                "intent": inferred,
                "intent_changed": True,
                "rejection_reason": None,
                "preferred_artists": [],
                "preferred_genres": validation["preferred_genres"],
            }

    if not validation["accepted"]:
        return {
            "accepted": False,
            "intent": GENERAL_LISTENING_INTENT,
            "preferred_genres": validation["preferred_genres"] or genre_hints,
            "preferred_artists": validation["preferred_artists"],
            "display_label": ", ".join(genre_hints),
            "reason": "",
            "rejection_reason": validation["rejection_reason"]
            or "Could not detect a mood from that description.",
            "source": "rules",
        }

    preferred_genres = merge_preferred_genres(validation["preferred_genres"], genre_hints)
    intent = refine_intent_for_cultural_listening(cleaned, validation["intent"])

    normalized = cleaned.lower()
    if re.search(r"poetry|poem|ghazal|shayari|nazm", normalized):
        poetry_genre = (
            "Ghazal"
            if re.search(r"hindi|urdu|bollywood|ghazal|shayari|punjabi|sufi", normalized)
            else "Poetry"
        )
        preferred_genres = merge_preferred_genres(preferred_genres, [poetry_genre])

    display_label = format_display_label(intent, preferred_genres)
    return {
        "accepted": True,
        "intent": intent,
        "preferred_genres": preferred_genres,
        "preferred_artists": validation["preferred_artists"],
        "display_label": display_label,
        "reason": f"Interpreted as {display_label}.",
        "rejection_reason": None,
        "source": "rules",
    }


async def parse_user_declared_intent(
    user_input: str,
    *,
    profile_artists: list[str],
    profile_genres: list[str],
    ai_provider: OpenAIProvider | None,
) -> dict:
    rule_result = parse_user_intent_rules(
        user_input,
        profile_artists=profile_artists,
        profile_genres=profile_genres,
    )
    if rule_result["accepted"]:
        return rule_result

    if ai_provider is None:
        return rule_result

    try:
        ai_result = await ai_provider.parse_user_declared_intent(
            user_input=user_input,
            profile_genres=profile_genres,
            profile_artists=profile_artists,
        )
    except Exception as exc:
        logger.warning("LLM user intent parse failed: %s", exc)
        return rule_result

    raw_intent = str(ai_result.get("intent", "")).strip()
    canonical = canonical_intent(raw_intent) or extract_intent_from_text(raw_intent)
    if not canonical:
        return {
            **rule_result,
            "rejection_reason": (
                f"Could not interpret '{user_input.strip()}' as a listening mood."
            ),
            "source": "llm_rejected",
        }

    known_artists = set(profile_artists)
    validation = validate_proposed_intent(
        canonical,
        current_intent=GENERAL_LISTENING_INTENT,
        known_artists=known_artists,
    )
    if not validation["accepted"]:
        return {
            **rule_result,
            "rejection_reason": validation["rejection_reason"]
            or rule_result["rejection_reason"],
            "source": "llm_rejected",
        }

    preferred_artists = merge_preferred_artists(
        [str(name) for name in ai_result.get("preferred_artists", []) if str(name).strip()],
        validation["preferred_artists"],
    )
    preferred_genres = merge_preferred_genres(
        [str(name) for name in ai_result.get("preferred_genres", []) if str(name).strip()],
        extract_genre_hints_from_text(user_input),
        profile_genres,
        validation["preferred_genres"],
    )
    intent = refine_intent_for_cultural_listening(user_input, validation["intent"])
    display_label = format_display_label(intent, preferred_genres)
    reason = str(ai_result.get("reason", "")).strip() or f"Interpreted as {display_label}."

    return {
        "accepted": True,
        "intent": intent,
        "preferred_genres": preferred_genres,
        "preferred_artists": preferred_artists,
        "display_label": display_label,
        "reason": reason,
        "rejection_reason": None,
        "source": "llm",
    }
