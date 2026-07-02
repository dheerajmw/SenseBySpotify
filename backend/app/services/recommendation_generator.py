from __future__ import annotations

import logging

from app.models.recommendation import Recommendation
from app.models.track import Track
from app.schemas.user_profile import UserProfilePayload
from app.services.ai.base import RankedTrackResult
from app.services.ai.openai_provider import OpenAIProvider
from app.services.candidates import fetch_candidates
from app.services.context_builder import UserContextBuilder
from app.services.intent_genre_matching import (
    resolve_target_genres,
    score_track_genre_fit,
    sort_tracks_by_genre_fit,
)
from app.services.music_catalog import MusicCatalogClient

logger = logging.getLogger(__name__)

MAX_PER_ARTIST = 2


def fallback_rank(
    candidates: list[Track],
    query: str,
    limit: int,
    *,
    profile_genres: list[str] | None = None,
) -> list[RankedTrackResult]:
    target_genres = resolve_target_genres(query, profile_genres or [])
    sorted_tracks = sort_tracks_by_genre_fit(candidates, target_genres, query)
    results: list[RankedTrackResult] = []
    for index, track in enumerate(sorted_tracks[:limit], start=1):
        genre_fit = score_track_genre_fit(track, target_genres, query)
        confidence = max(0.4, min(0.9, 0.45 + genre_fit * 0.45))
        genre_label = track.primary_genre or "its style"
        results.append(
            RankedTrackResult(
                track_id=track.id,
                rank=index,
                reason=(
                    f"Recommended because {genre_label} aligns with your \"{query}\" listening intent "
                    f"and taste profile."
                ),
                confidence=round(confidence, 2),
                score=max(40, int(60 + genre_fit * 35)),
            )
        )
    return results


def apply_artist_diversity(
    ranked: list[RankedTrackResult],
    tracks_by_id: dict[str, Track],
    limit: int,
) -> list[RankedTrackResult]:
    selected: list[RankedTrackResult] = []
    artist_counts: dict[str, int] = {}

    for item in sorted(ranked, key=lambda row: row.rank):
        track = tracks_by_id.get(item.track_id)
        if track is None:
            continue
        primary_artist = track.artists[0].id if track.artists else "unknown"
        if artist_counts.get(primary_artist, 0) >= MAX_PER_ARTIST:
            continue
        artist_counts[primary_artist] = artist_counts.get(primary_artist, 0) + 1
        selected.append(item)
        if len(selected) >= limit:
            break

    if len(selected) < limit:
        selected_ids = {item.track_id for item in selected}
        for item in sorted(ranked, key=lambda row: row.rank):
            if item.track_id in selected_ids:
                continue
            if tracks_by_id.get(item.track_id) is None:
                continue
            selected.append(item)
            selected_ids.add(item.track_id)
            if len(selected) >= limit:
                break

    for index, item in enumerate(selected, start=1):
        item.rank = index
    return selected


class RecommendationGenerator:
    def __init__(
        self,
        catalog: MusicCatalogClient,
        ai_provider: OpenAIProvider,
    ) -> None:
        self._catalog = catalog
        self._ai = ai_provider
        self._context_builder = UserContextBuilder()

    async def generate(
        self,
        profile: UserProfilePayload,
        *,
        query: str,
        limit: int = 10,
    ) -> tuple[list[Recommendation], int, bool]:
        context = self._context_builder.build(profile, current_query=query)
        candidates = await fetch_candidates(
            self._catalog,
            profile,
            context,
            query,
        )

        if not candidates:
            return [], 0, False

        tracks_by_id = {track.id: track for track in candidates}
        used_ai = True

        try:
            ranked = await self._ai.rank_tracks(
                context=context,
                query=query,
                candidates=candidates,
                limit=limit,
            )
            ranked = self._validate_ranked(ranked, tracks_by_id)
            if not ranked:
                raise ValueError("AI returned no valid track IDs")
        except Exception as exc:
            logger.warning("AI ranking failed, using fallback: %s", exc)
            used_ai = False
            ranked = fallback_rank(candidates, query, limit, profile_genres=list(profile.genres))

        ranked = apply_artist_diversity(ranked, tracks_by_id, limit)

        recommendations: list[Recommendation] = []
        for item in ranked:
            track = tracks_by_id.get(item.track_id)
            if track is None:
                continue
            recommendations.append(
                Recommendation(
                    track=track,
                    rank=item.rank,
                    reason=item.reason,
                    confidence=item.confidence,
                )
            )

        return recommendations, len(candidates), used_ai

    def _validate_ranked(
        self,
        ranked: list[RankedTrackResult],
        tracks_by_id: dict[str, Track],
    ) -> list[RankedTrackResult]:
        valid: list[RankedTrackResult] = []
        seen: set[str] = set()
        for item in ranked:
            if item.track_id not in tracks_by_id or item.track_id in seen:
                continue
            seen.add(item.track_id)
            valid.append(item)
        return valid
