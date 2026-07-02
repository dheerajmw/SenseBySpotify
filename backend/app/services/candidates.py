from __future__ import annotations

import logging

from app.models.track import Track
from app.models.user_context import UserContext
from app.schemas.user_profile import UserProfilePayload
from app.services.intent_genre_matching import (
    build_genre_first_search_queries,
    resolve_target_genres,
    sort_tracks_by_genre_fit,
)
from app.services.music_catalog import MusicCatalogClient

logger = logging.getLogger(__name__)

MAX_CANDIDATES = 50
SEARCH_LIMIT = 25
MIN_GENRE_FIT_CANDIDATES = 15


def build_search_queries(context: UserContext, prompt: str) -> list[str]:
    favourite_artists = [artist.name for artist in context.top_artists[:3]]
    return build_genre_first_search_queries(
        prompt,
        context.top_genres,
        favourite_artists,
    )


def _excluded_track_ids(profile: UserProfilePayload) -> set[str]:
    return set(profile.liked_track_ids) | set(profile.disliked_track_ids)


async def fetch_candidates(
    catalog: MusicCatalogClient,
    profile: UserProfilePayload,
    context: UserContext,
    prompt: str,
    *,
    max_candidates: int = MAX_CANDIDATES,
) -> list[Track]:
    excluded_ids = _excluded_track_ids(profile)
    target_genres = resolve_target_genres(prompt, list(profile.genres))
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

    if len(candidates) < MIN_GENRE_FIT_CANDIDATES and target_genres:
        for genre in target_genres[:3]:
            if len(candidates) >= max_candidates:
                break
            try:
                tracks = await catalog.search_tracks(query=genre, limit=SEARCH_LIMIT)
            except Exception as exc:
                logger.warning("Genre backfill search failed for %r: %s", genre, exc)
                continue
            for track in tracks:
                if track.id in seen_ids or track.id in excluded_ids:
                    continue
                seen_ids.add(track.id)
                candidates.append(track)
                if len(candidates) >= max_candidates:
                    break

    ranked = sort_tracks_by_genre_fit(candidates, target_genres, prompt)
    return ranked[:max_candidates]
