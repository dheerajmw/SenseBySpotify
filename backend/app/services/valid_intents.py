from __future__ import annotations

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
    return VALID_INTENT_LOOKUP.get(normalized)


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
