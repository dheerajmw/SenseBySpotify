from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.exceptions import AppError
from app.schemas.catalog import ArtistSearchResponse, SearchResponse
from app.services.music_catalog import MusicCatalogClient

router = APIRouter(tags=["search"])


def get_catalog_client() -> MusicCatalogClient:
    return MusicCatalogClient()


@router.get("/search/artists", response_model=ArtistSearchResponse)
async def search_artists(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=10, ge=1, le=25),
    catalog: MusicCatalogClient = Depends(get_catalog_client),
) -> ArtistSearchResponse:
    artists = await catalog.search_artists(query=q.strip(), limit=limit)
    return ArtistSearchResponse(query=q.strip(), artists=artists)


@router.get("/search", response_model=SearchResponse)
async def search_tracks(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=15, ge=1, le=25),
    catalog: MusicCatalogClient = Depends(get_catalog_client),
) -> SearchResponse:
    tracks = await catalog.search_tracks(query=q.strip(), limit=limit)
    return SearchResponse(query=q.strip(), tracks=tracks, artists=[])
