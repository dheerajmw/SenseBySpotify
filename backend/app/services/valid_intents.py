from __future__ import annotations

GENERAL_LISTENING_INTENT = "General Listening"

# 10 evaluator-friendly session intents (down from 21).
VALID_INTENTS: tuple[str, ...] = (
    "Focus",
    "Workout",
    "Driving",
    "Relaxing",
    "Party",
    "Happy",
    "Melancholic",
    "Romantic",
    "Morning",
    "Late Night",
)

VALID_INTENT_LOOKUP = {intent.lower(): intent for intent in VALID_INTENTS}

# Retired intent labels + informal words mapped to canonical session intents.
INTENT_ALIASES: dict[str, str] = {
    # Retired intents (backward compatible)
    "study": "Focus",
    "coding": "Focus",
    "reading": "Focus",
    "code": "Focus",
    "read": "Focus",
    "calm": "Relaxing",
    "sleep": "Relaxing",
    "meditation": "Relaxing",
    "high energy": "Party",
    "festival": "Party",
    "road trip": "Driving",
    "travel": "Driving",
    "rainy evening": "Late Night",
    # Happy / upbeat
    "fun": "Happy",
    "upbeat": "Happy",
    "joyful": "Happy",
    "cheerful": "Happy",
    "playful": "Happy",
    "uplifting": "Happy",
    "good": "Happy",
    "great": "Happy",
    "awesome": "Happy",
    "amazing": "Happy",
    "positive": "Happy",
    "sunny": "Happy",
    "bright": "Happy",
    "feel good": "Happy",
    # Relaxing / chill
    "cool": "Relaxing",
    "chill": "Relaxing",
    "chilled": "Relaxing",
    "chillout": "Relaxing",
    "mellow": "Relaxing",
    "smooth": "Relaxing",
    "relaxed": "Relaxing",
    "peaceful": "Relaxing",
    "cozy": "Relaxing",
    "cosy": "Relaxing",
    "laid back": "Relaxing",
    "laid-back": "Relaxing",
    "easygoing": "Relaxing",
    "easy going": "Relaxing",
    "vibe": "Relaxing",
    "vibey": "Relaxing",
    "vibes": "Relaxing",
    "casual": "Relaxing",
    "soft": "Relaxing",
    "gentle": "Relaxing",
    "tranquil": "Relaxing",
    "serene": "Relaxing",
    "lazy": "Relaxing",
    # Party / high energy
    "excited": "Party",
    "energizing": "Party",
    "energetic": "Party",
    "hype": "Party",
    "hyped": "Party",
    "pumped": "Party",
    "intense": "Party",
    "wild": "Party",
    "lit": "Party",
    "banger": "Party",
    "partying": "Party",
    "dance": "Party",
    "dancing": "Party",
    "club": "Party",
    "clubbing": "Party",
    "nightclub": "Party",
    # Melancholic / sad
    "sad": "Melancholic",
    "emotional": "Melancholic",
    "moody": "Melancholic",
    "blue": "Melancholic",
    "somber": "Melancholic",
    "sombre": "Melancholic",
    "gloomy": "Melancholic",
    "nostalgic": "Melancholic",
    "heartbreak": "Melancholic",
    "heartbroken": "Melancholic",
    "melancholy": "Melancholic",
    "depressing": "Melancholic",
    "dark": "Late Night",
    # Romantic
    "sexy": "Romantic",
    "sensual": "Romantic",
    "intimate": "Romantic",
    "love": "Romantic",
    "loving": "Romantic",
    "date night": "Romantic",
    "powerful": "Romantic",
    # Focus / work
    "productive": "Focus",
    "concentration": "Focus",
    "deep work": "Focus",
    "deep-work": "Focus",
    "work": "Focus",
    "working": "Focus",
    "programming": "Focus",
    "developer": "Focus",
    "dev": "Focus",
    "books": "Focus",
    "book": "Focus",
    "poetry": "Focus",
    "poem": "Focus",
    "nazm": "Focus",
    # Sleep / wellness → Relaxing
    "sleepy": "Relaxing",
    "drowsy": "Relaxing",
    "bedtime": "Relaxing",
    "nap": "Relaxing",
    "napping": "Relaxing",
    "zen": "Relaxing",
    "mindful": "Relaxing",
    "mindfulness": "Relaxing",
    "yoga": "Relaxing",
    "sufi": "Relaxing",
    # Workout
    "exercise": "Workout",
    "fitness": "Workout",
    "training": "Workout",
    "gym": "Workout",
    "running": "Workout",
    "cardio": "Workout",
    # Driving
    "commute": "Driving",
    "commuting": "Driving",
    "roadtrip": "Driving",
    "drive": "Driving",
    # Time of day
    "nighttime": "Late Night",
    "night time": "Late Night",
    "after hours": "Late Night",
    "night": "Late Night",
    "sunrise": "Morning",
    "wake up": "Morning",
    "rainy day": "Late Night",
    "rain": "Late Night",
    "rainy": "Late Night",
    # Events → Party
    "concert": "Party",
    "concerts": "Party",
    "rave": "Party",
    # Cultural moods
    "ghazal": "Melancholic",
    "shayari": "Melancholic",
    "urdu": "Melancholic",
    "romance": "Romantic",
}

GENRE_LABELS: frozenset[str] = frozenset(
    {
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
    }
)

DISCOVERY_LABELS: frozenset[str] = frozenset(
    {
        "discovery",
        "balanced explorer",
        "mostly familiar",
        "adventurous explorer",
        "discovery enthusiast",
        "new artist",
        "new discovery",
        "new discoveries",
        "familiar music",
        "balanced",
        "adventurous",
    }
)

KNOWN_ARTIST_NAMES: frozenset[str] = frozenset(
    {
        "coldplay",
        "taylor swift",
        "arijit singh",
        "prateek kuhad",
        "imagine dragons",
        "eminem",
        "ed sheeran",
        "the weeknd",
        "drake",
        "billie eilish",
        "ariana grande",
        "bruno mars",
        "dua lipa",
        "post malone",
        "kendrick lamar",
        "bad bunny",
        "bts",
        "shreya ghoshal",
        "sonu nigam",
        "atif aslam",
        "talha anjum",
    }
)


def normalize_text(value: str) -> str:
    return " ".join(value.lower().strip().split())


def canonical_intent(value: str) -> str | None:
    normalized = normalize_text(value)
    if not normalized:
        return None
    direct = VALID_INTENT_LOOKUP.get(normalized)
    if direct:
        return direct
    return INTENT_ALIASES.get(normalized)


def is_valid_intent(value: str) -> bool:
    return canonical_intent(value) is not None


def is_genre_label(value: str) -> bool:
    return normalize_text(value) in GENRE_LABELS


def is_discovery_label(value: str) -> bool:
    return normalize_text(value) in DISCOVERY_LABELS


def is_known_artist_name(value: str, extra_artists: set[str] | None = None) -> bool:
    normalized = normalize_text(value)
    if not normalized:
        return False
    if normalized in KNOWN_ARTIST_NAMES:
        return True
    if extra_artists and normalized in {normalize_text(name) for name in extra_artists}:
        return True
    return False
