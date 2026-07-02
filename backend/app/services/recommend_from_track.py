from __future__ import annotations

import logging

from app.models.recommendation import Recommendation
from app.models.track import Track
from app.schemas.user_profile import UserProfilePayload
from app.services.ai.openai_provider import OpenAIProvider
from app.services.candidates import fetch_candidates
from app.services.context_builder import UserContextBuilder
from app.services.music_catalog import MusicCatalogClient
from app.services.intent_genre_matching import (
    build_genre_first_search_queries,
    resolve_target_genres,
    score_track_genre_fit,
    sort_tracks_by_genre_fit,
)
from app.services.recommendation_generator import RecommendationGenerator, fallback_rank

logger = logging.getLogger(__name__)


def build_follow_up_queries(
    *,
    track_name: str,
    artist_name: str,
    profile_genres: list[str],
    intent_query: str,
    track_genre: str | None = None,
) -> list[str]:
    target_genres = resolve_target_genres(intent_query, profile_genres)
    if track_genre:
        target_genres = _dedupe_follow_up_genres([track_genre, *target_genres])

    queries = build_genre_first_search_queries(
        intent_query,
        profile_genres,
        [artist_name] if artist_name.strip() else [],
    )

    cleaned_artist = artist_name.strip()
    if cleaned_artist:
        for genre in target_genres[:2]:
            queries.append(f"{cleaned_artist} {genre}".strip())

    deduped: list[str] = []
    seen: set[str] = set()
    for query in queries:
        key = query.lower()
        if key and key not in seen:
            seen.add(key)
            deduped.append(query)
    return deduped or ["Pop music"]


def _dedupe_follow_up_genres(genres: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for genre in genres:
        key = genre.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(genre.strip())
    return result[:6]


class FollowUpRecommender:
    def __init__(
        self,
        catalog: MusicCatalogClient,
        ai_provider: OpenAIProvider,
    ) -> None:
        self._catalog = catalog
        self._ai = ai_provider
        self._generator = RecommendationGenerator(catalog, ai_provider)
        self._context_builder = UserContextBuilder()

    async def recommend_from_last_track(
        self,
        profile: UserProfilePayload,
        *,
        last_track_id: str,
        last_track_name: str,
        last_track_artist: str,
        intent_query: str,
    ) -> tuple[Recommendation | None, int, bool]:
        artist_name = last_track_artist.strip() or "Unknown"
        track_name = last_track_name.strip() or "Unknown"
        query = (intent_query or profile.current_intent or "").strip() or "music"

        context = self._context_builder.build(profile, current_query=query)
        follow_up_queries = build_follow_up_queries(
            track_name=track_name,
            artist_name=artist_name,
            profile_genres=list(profile.genres),
            intent_query=query,
        )

        excluded_ids = set(profile.liked_track_ids) | set(profile.disliked_track_ids)
        excluded_ids.add(last_track_id)

        candidates: list[Track] = []
        seen_ids: set[str] = set()

        for search_query in follow_up_queries:
            if len(candidates) >= 40:
                break
            try:
                tracks = await self._catalog.search_tracks(query=search_query, limit=20)
            except Exception as exc:
                logger.warning("Follow-up search failed for %r: %s", search_query, exc)
                continue

            for track in tracks:
                if track.id in seen_ids or track.id in excluded_ids:
                    continue
                seen_ids.add(track.id)
                candidates.append(track)
                if len(candidates) >= 40:
                    break

        if not candidates:
            return None, 0, False

        target_genres = resolve_target_genres(query, list(profile.genres))
        candidates = sort_tracks_by_genre_fit(candidates, target_genres, query)

        follow_up_prompt = (
            f'Continue the listening session after "{track_name}" by {artist_name}. '
            f"Pick one track whose iTunes genre matches: {', '.join(target_genres) or query}. "
            f'Do not match on song title alone. Session intent: "{query}".'
        )

        tracks_by_id = {track.id: track for track in candidates}
        used_ai = True

        try:
            ranked = await self._ai.rank_tracks(
                context=context,
                query=follow_up_prompt,
                candidates=candidates,
                limit=1,
            )
            ranked = self._generator._validate_ranked(ranked, tracks_by_id)
            if not ranked:
                raise ValueError("AI returned no valid follow-up track")
        except Exception as exc:
            logger.warning("Follow-up AI ranking failed, using fallback: %s", exc)
            used_ai = False
            ranked = fallback_rank(
                candidates,
                query,
                1,
                profile_genres=list(profile.genres),
            )

        if not ranked:
            return None, len(candidates), used_ai

        item = ranked[0]
        track = tracks_by_id.get(item.track_id)
        if track is None:
            return None, len(candidates), used_ai

        recommendation = Recommendation(
            track=track,
            rank=1,
            reason=item.reason,
            confidence=item.confidence,
        )
        return recommendation, len(candidates), used_ai
