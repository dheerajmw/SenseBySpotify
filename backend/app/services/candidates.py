from __future__ import annotations

import logging

from app.models.track import Track
from app.models.user_context import UserContext
from app.schemas.user_profile import UserProfilePayload
from app.services.music_catalog import MusicCatalogClient

logger = logging.getLogger(__name__)

MAX_CANDIDATES = 50
SEARCH_LIMIT = 25


def build_search_queries(context: UserContext, prompt: str) -> list[str]:
    trimmed = prompt.strip()
    queries: list[str] = [trimmed] if trimmed else []

    for genre in context.top_genres[:3]:
        queries.append(f"{genre} {trimmed}".strip() if trimmed else genre)

    for artist in context.top_artists[:3]:
        queries.append(f"{artist.name} {trimmed}".strip() if trimmed else artist.name)

    if context.current_query and context.current_query.lower() != trimmed.lower():
        queries.append(context.current_query)

    deduped: list[str] = []
    seen: set[str] = set()
    for query in queries:
        key = query.lower()
        if key and key not in seen:
            seen.add(key)
            deduped.append(query)
    return deduped or [trimmed or "popular music"]


def _excluded_track_ids(profile: UserProfilePayload) -> set[str]:
    return set(profile.liked_track_ids)


async def fetch_candidates(
    catalog: MusicCatalogClient,
    profile: UserProfilePayload,
    context: UserContext,
    prompt: str,
    *,
    max_candidates: int = MAX_CANDIDATES,
) -> list[Track]:
    excluded_ids = _excluded_track_ids(profile)
    queries = build_search_queries(context, prompt)

    candidates: list[Track] = []
    seen_ids: set[str] = set()

    for search_query in queries:
        if len(candidates) >= max_candidates:
            break
        try:
            tracks = await catalog.search_tracks(query=search_query, limit=SEARCH_LIMIT)
        except Exception as exc:
            logger.warning("Candidate search failed for %r: %s", search_query, exc)
            continue

        for track in tracks:
            if track.id in seen_ids or track.id in excluded_ids:
                continue
            seen_ids.add(track.id)
            candidates.append(track)
            if len(candidates) >= max_candidates:
                break

    if len(candidates) < 15 and prompt.strip():
        try:
            broad = await catalog.search_tracks(query=prompt.strip(), limit=SEARCH_LIMIT)
            for track in broad:
                if track.id in seen_ids or track.id in excluded_ids:
                    continue
                seen_ids.add(track.id)
                candidates.append(track)
                if len(candidates) >= max_candidates:
                    break
        except Exception as exc:
            logger.warning("Broad candidate search failed: %s", exc)

    return candidates
