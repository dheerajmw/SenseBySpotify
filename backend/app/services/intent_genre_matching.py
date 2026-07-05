from __future__ import annotations

import re

from app.models.track import Track
from app.services.session_intent_validation import extract_intent_from_text
from app.services.valid_intents import GENRE_LABELS, GENERAL_LISTENING_INTENT, is_genre_label, normalize_text

# iTunes-friendly genre search terms (primaryGenreName clusters)
INTENT_KEYWORD_TO_GENRES: dict[str, list[str]] = {
    "hindi": ["Indian Pop", "Bollywood", "Indian"],
    "urdu": ["Indian Pop", "Bollywood", "World"],
    "shayari": ["Indian Pop", "Bollywood", "World"],
    "bollywood": ["Bollywood", "Indian Pop", "Indian"],
    "punjabi": ["Punjabi", "Indian Pop", "Indian"],
    "tamil": ["Tamil", "Indian Pop", "Indian"],
    "telugu": ["Telugu", "Indian Pop", "Indian"],
    "indie": ["Indie Rock", "Alternative", "Singer/Songwriter"],
    "lofi": ["Hip-Hop/Rap", "Electronic", "Easy Listening"],
    "lo-fi": ["Hip-Hop/Rap", "Electronic", "Easy Listening"],
    "acoustic": ["Singer/Songwriter", "Folk", "Acoustic"],
    "jazz": ["Jazz", "Vocal Jazz"],
    "classical": ["Classical", "Classical Crossover"],
    "rock": ["Rock", "Alternative"],
    "metal": ["Metal", "Rock"],
    "edm": ["Dance", "Electronic"],
    "electronic": ["Electronic", "Dance"],
    "hip hop": ["Hip-Hop/Rap"],
    "rap": ["Hip-Hop/Rap"],
    "r&b": ["R&B/Soul", "Soul"],
    "soul": ["R&B/Soul", "Soul"],
    "country": ["Country"],
    "folk": ["Folk", "Singer/Songwriter"],
    "latin": ["Latin", "Latino"],
    "k-pop": ["K-Pop", "Pop"],
    "kpop": ["K-Pop", "Pop"],
    "poetry": ["Indian Pop", "Singer/Songwriter", "Spoken Word"],
    "ghazal": ["Indian Pop", "Indian", "World"],
    "devotional": ["Indian Pop", "Devotional", "World"],
    "bhajan": ["Indian Pop", "Devotional", "World"],
    "sufi": ["Indian Pop", "World", "Singer/Songwriter"],
}

PREFERRED_GENRE_TO_ITUNES: dict[str, list[str]] = {
    "hindi": ["Indian Pop", "Bollywood", "Indian"],
    "urdu": ["Indian Pop", "Bollywood", "World"],
    "bollywood": ["Bollywood", "Indian Pop", "Indian"],
    "punjabi": ["Punjabi", "Indian Pop", "Indian"],
    "tamil": ["Tamil", "Indian Pop", "Indian"],
    "telugu": ["Telugu", "Indian Pop", "Indian"],
    "ghazal": ["Indian Pop", "World", "Singer/Songwriter"],
    "shayari": ["Indian Pop", "Bollywood", "World"],
    "sufi": ["Indian Pop", "World", "Devotional"],
    "devotional": ["Devotional", "Indian Pop", "World"],
    "bhajan": ["Devotional", "Indian Pop", "World"],
}

MOODS_OVERRIDDEN_BY_CULTURAL_GENRES = frozenset(
    {"Reading", "Study", "Focus", "Calm", "Relaxing", "Meditation"},
)

MOOD_INTENT_TO_GENRES: dict[str, list[str]] = {
    "Workout": ["Pop", "Hip-Hop/Rap", "Dance", "Electronic"],
    "Study": ["Classical", "Easy Listening", "Ambient", "Electronic"],
    "Focus": ["Classical", "Electronic", "Easy Listening", "Ambient"],
    "Coding": ["Electronic", "Ambient", "Easy Listening", "Indie Rock"],
    "Driving": ["Rock", "Pop", "Hip-Hop/Rap", "Alternative"],
    "Relaxing": ["Easy Listening", "Singer/Songwriter", "Ambient", "Jazz"],
    "Calm": ["Easy Listening", "Ambient", "Classical", "New Age"],
    "Party": ["Dance", "Pop", "Hip-Hop/Rap", "Electronic"],
    "Travel": ["Pop", "Rock", "Indie Rock", "Alternative"],
    "Sleep": ["Ambient", "Easy Listening", "New Age", "Classical"],
    "Romantic": ["Pop", "R&B/Soul", "Singer/Songwriter", "Soft Rock"],
    "Morning": ["Pop", "Indie Rock", "Singer/Songwriter", "Folk"],
    "Late Night": ["R&B/Soul", "Hip-Hop/Rap", "Electronic", "Jazz"],
    "Meditation": ["New Age", "Ambient", "Classical", "World"],
    "Reading": ["Classical", "Jazz", "Easy Listening", "Ambient"],
    "Rainy Evening": ["Singer/Songwriter", "Indie Rock", "Jazz", "Alternative"],
    "Road Trip": ["Rock", "Pop", "Country", "Alternative"],
    "Festival": ["Dance", "Electronic", "Pop", "Rock"],
    "High Energy": ["Dance", "Electronic", "Hip-Hop/Rap", "Rock", "Pop", "Alternative", "Metal"],
    "Happy": ["Pop", "Dance", "Folk", "Indie Rock"],
    "Melancholic": ["Singer/Songwriter", "Indie Rock", "Alternative", "Folk"],
}


def _title_case_genre(label: str) -> str:
    cleaned = " ".join(label.strip().split())
    if not cleaned:
        return ""
    if cleaned.lower() in {"r&b", "edm", "k-pop"}:
        mapping = {"r&b": "R&B", "edm": "EDM", "k-pop": "K-Pop"}
        return mapping[cleaned.lower()]
    return cleaned.title()


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        key = normalize_text(item)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _map_preferred_genres_to_itunes(preferred_genres: list[str]) -> list[str]:
    mapped: list[str] = []
    for label in preferred_genres:
        normalized = normalize_text(label)
        if not normalized:
            continue
        if normalized in PREFERRED_GENRE_TO_ITUNES:
            mapped.extend(PREFERRED_GENRE_TO_ITUNES[normalized])
            continue
        formatted = _title_case_genre(label)
        if formatted:
            mapped.append(formatted)
    return mapped


def _keyword_genres_from_text(normalized_intent: str) -> list[str]:
    targets: list[str] = []
    if not normalized_intent:
        return targets

    for keyword, genres in sorted(
        INTENT_KEYWORD_TO_GENRES.items(),
        key=lambda item: -len(item[0]),
    ):
        if keyword in normalized_intent:
            targets.extend(genres)

    for genre_label in GENRE_LABELS:
        if genre_label in normalized_intent:
            targets.append(_title_case_genre(genre_label))
    return targets


def resolve_target_genres(
    intent: str,
    profile_genres: list[str],
    preferred_genres: list[str] | None = None,
) -> list[str]:
    """Map listening intent + profile taste to iTunes genre targets."""
    session_preferred = preferred_genres or []
    trimmed = intent.strip()
    normalized_intent = normalize_text(trimmed)
    targets: list[str] = []

    cultural_targets = _map_preferred_genres_to_itunes(session_preferred)
    keyword_targets = _keyword_genres_from_text(normalized_intent)
    has_cultural_signal = bool(cultural_targets or keyword_targets)

    for genre in profile_genres:
        formatted = _title_case_genre(genre)
        if formatted:
            targets.append(formatted)

    if trimmed and is_genre_label(trimmed):
        targets.append(_title_case_genre(trimmed))

    if cultural_targets:
        targets.extend(cultural_targets)

    if keyword_targets:
        targets.extend(keyword_targets)

    canonical = extract_intent_from_text(trimmed)
    if canonical and canonical in MOOD_INTENT_TO_GENRES:
        if not (has_cultural_signal and canonical in MOODS_OVERRIDDEN_BY_CULTURAL_GENRES):
            targets.extend(MOOD_INTENT_TO_GENRES[canonical])

    if trimmed and normalize_text(trimmed) == normalize_text(GENERAL_LISTENING_INTENT):
        return _dedupe_preserve_order([_title_case_genre(genre) for genre in profile_genres[:4]]) or ["Pop"]

    if not targets and trimmed:
        tokens = [token for token in re.split(r"[^\w&]+", normalized_intent) if len(token) > 2]
        for token in tokens:
            if token in GENRE_LABELS:
                targets.append(_title_case_genre(token))

    return _dedupe_preserve_order(targets)[:8]


def build_genre_first_search_queries(
    intent: str,
    profile_genres: list[str],
    favourite_artists: list[str],
    preferred_genres: list[str] | None = None,
) -> list[str]:
    """Build iTunes queries that discover by genre/mood, not song-title keywords."""
    target_genres = resolve_target_genres(intent, profile_genres, preferred_genres)
    queries: list[str] = []

    for genre in target_genres:
        queries.append(genre)
        queries.append(f"{genre} music")

    session_preferred = preferred_genres or []
    for label in session_preferred[:3]:
        normalized = normalize_text(label)
        mapped = PREFERRED_GENRE_TO_ITUNES.get(normalized, [])
        for genre in mapped[:2]:
            queries.append(f"{genre} {label}".strip())

    canonical = extract_intent_from_text(intent)
    if canonical and canonical in MOOD_INTENT_TO_GENRES:
        anchor_genre = target_genres[0] if target_genres else MOOD_INTENT_TO_GENRES[canonical][0]
        queries.append(f"{anchor_genre} {canonical.lower()}")

    for artist in favourite_artists[:3]:
        for genre in target_genres[:2]:
            queries.append(f"{artist} {genre}".strip())

    if not queries and profile_genres:
        for genre in profile_genres[:3]:
            queries.append(_title_case_genre(genre))

    return _dedupe_preserve_order(queries) or ["Pop music"]


def _normalize_genre(value: str) -> str:
    return (
        value.lower()
        .replace("-", " ")
        .replace("/", " ")
        .replace("&", "and")
        .strip()
    )


def score_track_genre_fit(
    track: Track,
    target_genres: list[str],
    intent: str,
) -> float:
    """Score 0–1 for how well a track's iTunes genre matches the intent."""
    if not target_genres:
        return 0.5

    primary = track.primary_genre or (track.artists[0].genres[0] if track.artists and track.artists[0].genres else None)
    if not primary:
        return 0.0

    track_genre = _normalize_genre(primary)
    best = 0.0

    for target in target_genres:
        target_norm = _normalize_genre(target)
        if not target_norm:
            continue
        if track_genre == target_norm:
            best = max(best, 1.0)
            continue
        if target_norm in track_genre or track_genre in target_norm:
            best = max(best, 0.88)
            continue
        target_tokens = {token for token in target_norm.split() if len(token) > 2}
        track_tokens = {token for token in track_genre.split() if len(token) > 2}
        overlap = target_tokens & track_tokens
        if overlap:
            best = max(best, 0.72 + 0.08 * min(len(overlap), 2))

    intent_norm = normalize_text(intent)
    title_norm = normalize_text(track.name)
    if intent_norm and title_norm and intent_norm in title_norm and best < 0.4:
        best = max(best, 0.15)

    return round(best, 3)


def sort_tracks_by_genre_fit(
    tracks: list[Track],
    target_genres: list[str],
    intent: str,
) -> list[Track]:
    return sorted(
        tracks,
        key=lambda track: (
            score_track_genre_fit(track, target_genres, intent),
            track.popularity or 0,
        ),
        reverse=True,
    )
