from __future__ import annotations

from app.services.valid_intents import canonical_intent, is_valid_intent, normalize_text
from app.services.session_intent_validation import (
    classify_search_signal,
    extract_artists_from_play_label,
    extract_intent_from_text,
    merge_preferred_artists,
    merge_preferred_genres,
)

SEARCH_TYPES = {"SEARCH", "SEARCH_TRACK", "SEARCH_ARTIST"}


def _intent_matches(current_intent: str, query: str) -> bool:
    current = canonical_intent(current_intent) or current_intent
    candidate = extract_intent_from_text(query) or canonical_intent(query)
    if not candidate:
        return False
    return normalize_text(current) == normalize_text(candidate)


def _recent_searches(recent_actions: list[dict]) -> list[dict]:
    searches: list[dict] = []
    for action in reversed(recent_actions):
        if action.get("type") not in SEARCH_TYPES:
            continue
        value = str(action.get("value", "")).strip()
        if value:
            searches.append(
                {
                    "value": value,
                    "is_artist_search": action.get("type") == "SEARCH_ARTIST",
                }
            )
    return searches


def _recent_plays(recent_actions: list[dict]) -> list[str]:
    return [
        str(action.get("value", "")).strip()
        for action in recent_actions
        if action.get("type") == "PLAY" and str(action.get("value", "")).strip()
    ]


ROMANTIC_SIGNALS = {"romance", "romantic", "love", "heart", "mohabbat", "ishq", "pyaar", "dil"}


def _plays_suggest_theme(plays: list[str], signals: set[str]) -> int:
    count = 0
    for play in plays[:8]:
        lowered = play.lower()
        if any(signal in lowered for signal in signals):
            count += 1
    return count


def infer_intent_from_actions(
    current_intent: str,
    recent_actions: list[dict],
    *,
    profile_artists: list[str] | None = None,
    profile_genres: list[str] | None = None,
) -> dict | None:
    """Conservative rule-based hints. Never maps artists/genres/discovery to intent."""
    if not recent_actions:
        return None

    artists = profile_artists or []
    genres = profile_genres or []
    plays = _recent_plays(recent_actions)
    searches = _recent_searches(recent_actions)

    preferred_artists: list[str] = []
    preferred_genres: list[str] = list(genres)
    for play in plays[:6]:
        preferred_artists = merge_preferred_artists(
            preferred_artists,
            extract_artists_from_play_label(play),
        )

    if not searches:
        romantic_plays = _plays_suggest_theme(plays, ROMANTIC_SIGNALS)
        if romantic_plays >= 3 and not _intent_matches(current_intent, "romantic"):
            return {
                "intent_changed": True,
                "new_intent": "Romantic",
                "preferred_artists": preferred_artists,
                "preferred_genres": preferred_genres,
                "confidence": 0.84,
                "reason": (
                    f"User played {romantic_plays} romantic tracks, "
                    f"suggesting a shift from '{current_intent or 'their previous mood'}'."
                ),
            }
        if preferred_artists or preferred_genres:
            return {
                "intent_changed": False,
                "new_intent": current_intent,
                "preferred_artists": preferred_artists,
                "preferred_genres": preferred_genres,
                "confidence": 0.7,
                "reason": "Captured recent artist preferences from playback.",
            }
        return None

    latest = searches[0]
    latest_query = latest["value"]
    classified = classify_search_signal(
        latest_query,
        profile_artists=artists,
        is_artist_search=latest["is_artist_search"],
    )
    candidate_intent = classified["intent"]
    preferred_artists = merge_preferred_artists(
        preferred_artists,
        classified["preferred_artists"],
    )
    preferred_genres = merge_preferred_genres(
        preferred_genres,
        classified["preferred_genres"],
    )

    if classified["preferred_artists"] and not candidate_intent:
        return {
            "intent_changed": False,
            "new_intent": current_intent,
            "preferred_artists": preferred_artists,
            "preferred_genres": preferred_genres,
            "confidence": 0.72,
            "reason": "Updated preferred artists without changing listening context.",
        }

    if not candidate_intent or not is_valid_intent(candidate_intent):
        if preferred_artists or preferred_genres:
            return {
                "intent_changed": False,
                "new_intent": current_intent,
                "preferred_artists": preferred_artists,
                "preferred_genres": preferred_genres,
                "confidence": 0.72,
                "reason": "Updated preferences without changing listening context.",
            }
        return None

    if _intent_matches(current_intent, candidate_intent):
        return {
            "intent_changed": False,
            "new_intent": current_intent,
            "preferred_artists": preferred_artists,
            "preferred_genres": preferred_genres,
            "confidence": 0.72,
            "reason": "Recent activity aligns with the current listening intent.",
        }

    latest_norm = normalize_text(latest_query)
    matching_searches = sum(
        1 for item in searches[:8] if normalize_text(item["value"]) == latest_norm
    )

    if matching_searches >= 2:
        return {
            "intent_changed": True,
            "new_intent": candidate_intent,
            "preferred_artists": preferred_artists,
            "preferred_genres": preferred_genres,
            "confidence": 0.9,
            "reason": (
                f"User searched for '{latest_query}' multiple times, "
                f"suggesting '{candidate_intent}' as the new listening context."
            ),
        }

    return {
        "intent_changed": False,
        "new_intent": current_intent,
        "preferred_artists": preferred_artists,
        "preferred_genres": preferred_genres,
        "confidence": 0.65,
        "reason": "Insufficient repeated search evidence to change listening intent.",
    }


def merge_intent_results(ai_result: dict, rule_result: dict | None) -> dict:
    if not rule_result:
        return ai_result

    merged = dict(ai_result)
    merged["preferred_artists"] = merge_preferred_artists(
        [str(name) for name in ai_result.get("preferred_artists", [])],
        [str(name) for name in rule_result.get("preferred_artists", [])],
    )
    merged["preferred_genres"] = merge_preferred_genres(
        [str(name) for name in ai_result.get("preferred_genres", [])],
        [str(name) for name in rule_result.get("preferred_genres", [])],
    )

    if rule_result.get("intent_changed") and not ai_result.get("intent_changed"):
        if is_valid_intent(str(rule_result.get("new_intent", ""))):
            merged.update(rule_result)
        return merged

    if (
        rule_result.get("intent_changed")
        and float(rule_result.get("confidence", 0)) > float(ai_result.get("confidence", 0))
        and is_valid_intent(str(rule_result.get("new_intent", "")))
    ):
        merged.update(rule_result)
        return merged

    return merged
