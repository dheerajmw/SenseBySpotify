from __future__ import annotations

from app.schemas.user_profile import UserProfilePayload
from app.services.context_builder import UserContextBuilder, novelty_to_float


def test_novelty_to_float_maps_labels() -> None:
    assert novelty_to_float("balanced") == 0.5
    assert novelty_to_float("Mostly Familiar") == 0.2
    assert novelty_to_float("Love Discovering New Music") == 0.85
    assert novelty_to_float(35) == 0.35
    assert novelty_to_float(80) == 0.8


def test_context_builder_accepts_numeric_discovery_level() -> None:
    profile = UserProfilePayload(
        genres=["pop"],
        novelty_tolerance=35,
        current_intent="workout",
    )
    context = UserContextBuilder().build(profile)
    assert context.novelty_tolerance == 0.35


def test_context_builder_uses_profile_fields() -> None:
    profile = UserProfilePayload(
        genres=["indie", "lo-fi"],
        favourite_artists=[
            {"id": "1", "name": "Bon Iver", "image_url": None},
        ],
        novelty_tolerance="balanced",
        current_intent="late night coding",
    )
    context = UserContextBuilder().build(profile)

    assert context.top_genres == ["indie", "lo-fi"]
    assert context.top_artists[0].name == "Bon Iver"
    assert context.current_query == "late night coding"
    assert context.novelty_tolerance == 0.5
