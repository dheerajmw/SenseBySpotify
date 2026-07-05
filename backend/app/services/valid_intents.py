from __future__ import annotations

GENERAL_LISTENING_INTENT = "General Listening"

VALID_INTENTS: tuple[str, ...] = (
    "Focus",
    "Workout",
    "Driving",
    "Relaxing",
    "Study",
    "Party",
    "Travel",
    "Sleep",
    "Romantic",
    "Morning",
    "Late Night",
    "Meditation",
    "Coding",
    "Reading",
    "Rainy Evening",
    "Road Trip",
    "Festival",
    "High Energy",
    "Calm",
    "Happy",
    "Melancholic",
)

VALID_INTENT_LOOKUP = {intent.lower(): intent for intent in VALID_INTENTS}

# Informal or AI-generated labels mapped to canonical session intents.
INTENT_ALIASES: dict[str, str] = {
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
    # Calm / cool / chill
    "cool": "Calm",
    "chill": "Calm",
    "chilled": "Calm",
    "chillout": "Calm",
    "mellow": "Calm",
    "smooth": "Calm",
    "relaxed": "Relaxing",
    "relaxing": "Relaxing",
    "peaceful": "Calm",
    "cozy": "Calm",
    "cosy": "Calm",
    "laid back": "Calm",
    "laid-back": "Calm",
    "easygoing": "Calm",
    "easy going": "Calm",
    "vibe": "Calm",
    "vibey": "Calm",
    "vibes": "Calm",
    "casual": "Calm",
    "soft": "Calm",
    "gentle": "Calm",
    "tranquil": "Calm",
    "serene": "Calm",
    "lazy": "Relaxing",
    # High energy
    "excited": "High Energy",
    "energizing": "High Energy",
    "energetic": "High Energy",
    "hype": "High Energy",
    "hyped": "High Energy",
    "pumped": "High Energy",
    "intense": "High Energy",
    "powerful": "High Energy",
    "wild": "High Energy",
    "lit": "High Energy",
    "banger": "High Energy",
    # Party / dance
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
    # Focus / study / work
    "productive": "Focus",
    "concentration": "Focus",
    "deep work": "Focus",
    "deep-work": "Focus",
    "work": "Focus",
    "working": "Focus",
    # Sleep
    "sleepy": "Sleep",
    "drowsy": "Sleep",
    "bedtime": "Sleep",
    "nap": "Sleep",
    "napping": "Sleep",
    # Meditation / wellness
    "zen": "Meditation",
    "mindful": "Meditation",
    "mindfulness": "Meditation",
    "yoga": "Meditation",
    # Workout
    "exercise": "Workout",
    "fitness": "Workout",
    "training": "Workout",
    "gym": "Workout",
    # Driving / travel
    "commute": "Driving",
    "commuting": "Driving",
    "roadtrip": "Road Trip",
    # Time of day
    "nighttime": "Late Night",
    "night time": "Late Night",
    "after hours": "Late Night",
    "sunrise": "Morning",
    "wake up": "Morning",
    "rainy day": "Rainy Evening",
    # Events
    "concert": "Festival",
    "concerts": "Festival",
    "rave": "Festival",
    # Coding
    "programming": "Coding",
    "developer": "Coding",
    "dev": "Coding",
    # Reading
    "books": "Reading",
    "book": "Reading",
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
