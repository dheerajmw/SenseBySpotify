from __future__ import annotations

import logging

from app.models.track import Track
from app.services.music_catalog import MusicCatalogClient
from app.services.session_intent_validation import extract_intent_from_text
from app.services.valid_intents import canonical_intent

logger = logging.getLogger(__name__)

MIN_CANDIDATES_BEFORE_EXPANSION = 10
POPULAR_SEARCH_SUFFIX = "popular"

# Adjacent iTunes-friendly genres for low-candidate expansion by session intent.
ADJACENT_GENRES_BY_INTENT: dict[str, list[str]] = {
    "Romantic": ["Bollywood", "Pop", "Singer/Songwriter"],
    "Workout": ["Dance", "Electronic", "Pop"],
    "Focus": ["Ambient", "Classical", "Easy Listening"],
    "Coding": ["Hip-Hop/Rap", "Ambient", "Electronic"],
    "Study": ["Classical", "Easy Listening", "Singer/Songwriter"],
    "Relaxing": ["Singer/Songwriter", "Easy Listening", "Ambient"],
    "Travel": ["Indie Rock", "Pop", "Alternative"],
    "Late Night": ["Soul", "R&B/Soul", "Easy Listening"],
    "Road Trip": ["Rock", "Pop", "Indie Rock"],
}


def resolve_intent_for_expansion(prompt: str) -> str | None:
    """Resolve a canonical session intent from a prompt for genre expansion."""
    extracted = extract_intent_from_text(prompt)
    if extracted:
        return extracted
    return canonical_intent(prompt)


def adjacent_genres_for_intent(prompt: str) -> list[str]:
    """Return adjacent genre search terms for the prompt's session intent."""
    intent = resolve_intent_for_expansion(prompt)
    if not intent:
        return []
    return list(ADJACENT_GENRES_BY_INTENT.get(intent, []))


async def expand_candidates_if_needed(
    catalog: MusicCatalogClient,
    *,
    prompt: str,
    candidates: list[Track],
    seen_ids: set[str],
    excluded_ids: set[str],
    max_candidates: int,
    search_limit: int,
) -> list[Track]:
    """
    Expand candidate retrieval when the initial pool is too small.

    Searches adjacent genres for the session intent, then popular tracks in those genres.
    """
    original_count = len(candidates)
    if original_count >= MIN_CANDIDATES_BEFORE_EXPANSION:
        return candidates

    expansion_genres = adjacent_genres_for_intent(prompt)
    if not expansion_genres:
        return candidates

    expanded = list(candidates)

    for genre in expansion_genres:
        if len(expanded) >= max_candidates:
            break
        expanded = await _append_search_results(
            catalog,
            query=genre,
            candidates=expanded,
            seen_ids=seen_ids,
            excluded_ids=excluded_ids,
            max_candidates=max_candidates,
            search_limit=search_limit,
        )

    if len(expanded) < MIN_CANDIDATES_BEFORE_EXPANSION:
        for genre in expansion_genres:
            if len(expanded) >= max_candidates:
                break
            expanded = await _append_search_results(
                catalog,
                query=f"{genre} {POPULAR_SEARCH_SUFFIX}",
                candidates=expanded,
                seen_ids=seen_ids,
                excluded_ids=excluded_ids,
                max_candidates=max_candidates,
                search_limit=search_limit,
            )

    if len(expanded) > original_count:
        logger.info(
            "[Candidates] Expanded candidate search\nOriginal candidates: %d\n"
            "Expanded candidates: %d\nIntent: %r\nGenres: %s",
            original_count,
            len(expanded),
            resolve_intent_for_expansion(prompt),
            ", ".join(expansion_genres),
        )

    return expanded


async def _append_search_results(
    catalog: MusicCatalogClient,
    *,
    query: str,
    candidates: list[Track],
    seen_ids: set[str],
    excluded_ids: set[str],
    max_candidates: int,
    search_limit: int,
) -> list[Track]:
    try:
        tracks = await catalog.search_tracks(query=query, limit=search_limit)
    except Exception as exc:
        logger.warning("Expanded candidate search failed for %r: %s", query, exc)
        return candidates

    for track in tracks:
        if track.id in seen_ids or track.id in excluded_ids:
            continue
        seen_ids.add(track.id)
        candidates.append(track)
        if len(candidates) >= max_candidates:
            break
    return candidates
