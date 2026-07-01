from __future__ import annotations

from app.services.session_intent_validation import (
    classify_search_signal,
    extract_artists_from_play_label,
    merge_preferred_artists,
)

SEARCH_TYPES = {"SEARCH", "SEARCH_TRACK", "SEARCH_ARTIST"}


def _normalize(text: str) -> str:
    return " ".join(text.lower().strip().split())


def _intent_matches(current_intent: str, query: str) -> bool:
    current = _normalize(current_intent)
    query_norm = _normalize(query)
    if not query_norm:
        return True
    if not current:
        return False
    if query_norm in current or current in query_norm:
        return True
    query_words = [word for word in query_norm.split() if len(word) > 2]
    return any(word in current for word in query_words)


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


ROMANTIC_SIGNALS = {
    "romance",
    "romantic",
    "love",
    "heart",
    "mohabbat",
    "ishq",
    "pyaar",
    "dil",
}


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
) -> dict | None:
    """Detect clear intent shifts from search/play patterns without relying on the LLM."""
    if not recent_actions:
        return None

    artists = profile_artists or []
    plays = _recent_plays(recent_actions)
    searches = _recent_searches(recent_actions)

    preferred_artists: list[str] = []
    for play in plays[:6]:
        preferred_artists = merge_preferred_artists(
            preferred_artists,
            extract_artists_from_play_label(play),
        )

    if not searches:
        romantic_plays = _plays_suggest_theme(plays, ROMANTIC_SIGNALS)
        if romantic_plays >= 2 and not _intent_matches(current_intent, "romantic"):
            return {
                "intent_changed": True,
                "new_intent": "Romantic",
                "preferred_artists": preferred_artists,
                "confidence": 0.84,
                "reason": (
                    f"User played {romantic_plays} romantic tracks, "
                    f"shifting away from '{current_intent or 'their previous mood'}'."
                ),
            }
        if preferred_artists:
            return {
                "intent_changed": False,
                "new_intent": current_intent,
                "preferred_artists": preferred_artists,
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

    if not candidate_intent or _intent_matches(current_intent, candidate_intent):
        if preferred_artists:
            return {
                "intent_changed": False,
                "new_intent": current_intent,
                "preferred_artists": preferred_artists,
                "confidence": 0.72,
                "reason": "Updated preferred artists without changing listening context.",
            }
        return None

    latest_norm = _normalize(latest_query)
    matching_searches = sum(
        1 for item in searches[:8] if _normalize(item["value"]) == latest_norm
    )

    if matching_searches >= 2:
        return {
            "intent_changed": True,
            "new_intent": candidate_intent,
            "preferred_artists": preferred_artists,
            "confidence": 0.9,
            "reason": (
                f"User searched for '{latest_query}' multiple times, "
                f"shifting listening context to '{candidate_intent}'."
            ),
        }

    if matching_searches >= 1 and plays:
        return {
            "intent_changed": True,
            "new_intent": candidate_intent,
            "preferred_artists": preferred_artists,
            "confidence": 0.82,
            "reason": (
                f"User searched for '{latest_query}' and played tracks, "
                f"indicating '{candidate_intent}' as the new listening context."
            ),
        }

    romantic_plays = _plays_suggest_theme(plays, ROMANTIC_SIGNALS)
    if romantic_plays >= 2 and not _intent_matches(current_intent, "romantic"):
        return {
            "intent_changed": True,
            "new_intent": "Romantic",
            "preferred_artists": preferred_artists,
            "confidence": 0.84,
            "reason": (
                f"User played {romantic_plays} romantic tracks, "
                f"shifting away from '{current_intent or 'their previous mood'}'."
            ),
        }

    return None


def merge_intent_results(ai_result: dict, rule_result: dict | None) -> dict:
    if not rule_result:
        return ai_result

    merged = dict(ai_result)
    merged["preferred_artists"] = merge_preferred_artists(
        [str(name) for name in ai_result.get("preferred_artists", [])],
        [str(name) for name in rule_result.get("preferred_artists", [])],
    )

    if rule_result.get("intent_changed") and not ai_result.get("intent_changed"):
        merged.update(rule_result)
        return merged

    if (
        rule_result.get("intent_changed")
        and float(rule_result.get("confidence", 0)) > float(ai_result.get("confidence", 0))
    ):
        merged.update(rule_result)
        return merged

    return merged
