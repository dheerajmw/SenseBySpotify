from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.exceptions import AppError
from app.schemas.recommendations import (
    GenerateRecommendationsRequest,
    GenerateRecommendationsResponse,
)
from app.services.ai.openai_provider import OpenAIProvider
from app.services.music_catalog import MusicCatalogClient
from app.services.rate_limit import generate_rate_limiter
from app.services.recommendation_generator import RecommendationGenerator

router = APIRouter(tags=["recommendations"])


def get_catalog_client() -> MusicCatalogClient:
    return MusicCatalogClient()


def get_ai_provider(settings: Settings = Depends(get_settings)) -> OpenAIProvider:
    return OpenAIProvider(settings)


def get_recommendation_generator(
    catalog: MusicCatalogClient = Depends(get_catalog_client),
    ai_provider: OpenAIProvider = Depends(get_ai_provider),
) -> RecommendationGenerator:
    return RecommendationGenerator(catalog, ai_provider)


@router.post("/generate-recommendations", response_model=GenerateRecommendationsResponse)
async def generate_recommendations(
    payload: GenerateRecommendationsRequest,
    generator: RecommendationGenerator = Depends(get_recommendation_generator),
    settings: Settings = Depends(get_settings),
) -> GenerateRecommendationsResponse:
    query = (payload.query or payload.profile.current_intent or "").strip()
    if not query:
        raise AppError("Query or current intent is required", status_code=400)

    rate_key = "|".join(payload.profile.genres[:3]) or "anonymous"
    await generate_rate_limiter.check(
        rate_key,
        limit=settings.generate_rate_limit_per_minute,
        window_seconds=60,
    )

    recommendations, candidate_count, used_ai = await generator.generate(
        payload.profile,
        query=query,
        limit=payload.limit,
    )

    if not recommendations:
        raise AppError(
            "No tracks found for your search. Try a different prompt or broader genres.",
            status_code=404,
        )

    return GenerateRecommendationsResponse(
        query=query,
        recommendations=recommendations,
        candidate_count=candidate_count,
        used_ai=used_ai,
    )
