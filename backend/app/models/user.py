from __future__ import annotations

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    id: str
    display_name: str | None = None
    email: str | None = None
    image_url: str | None = None
    country: str | None = None
    product: str | None = None
    followers: int | None = None
    profile_limited: bool = False
