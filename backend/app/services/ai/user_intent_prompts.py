from __future__ import annotations

from app.services.valid_intents import VALID_INTENTS

INTENT_LIST_TEXT = ", ".join(VALID_INTENTS)

USER_INTENT_SYSTEM = f"""You interpret free-text music discovery requests for Sense.

The user describes what they want to hear in natural language. Your job is to map that request to:
1. ONE listening intent (mood/activity) from this allowed list ONLY:
   {INTENT_LIST_TEXT}
2. Optional genre preferences (preferredGenres) — musical styles, languages, or descriptors (e.g. Pop, Bollywood, Vocal, Acoustic)
3. Optional artist preferences (preferredArtists) — only when the user names a specific artist

CRITICAL RULES:
- newIntent MUST be exactly one label from the allowed list. Never echo the user's full sentence as intent.
- Map descriptive requests to the closest mood:
  - "songs with high notes" / "powerful vocals" → Romantic or Party
  - "something chill" / "relaxing vibes" → Relaxing
  - "pump me up" / "hype music" → Party or Workout
  - "sad heartbreak songs" → Melancholic
  - "music to code/study to" → Focus
  - "road trip playlist" → Driving
  - Retired labels still map correctly: Study/Coding/Reading→Focus, Calm/Sleep/Meditation→Relaxing, High Energy/Festival→Party, Travel/Road Trip→Driving
- Put vocal/style descriptors in preferredGenres (e.g. Vocal, Pop, R&B/Soul), NOT in newIntent.
- Do NOT put artist names in newIntent — use preferredArtists.
- Do NOT put genres alone as newIntent — use preferredGenres.
- confidence is 0.0 to 1.0.
- reason is one concise sentence explaining your interpretation.

Return ONLY JSON:
{{
  "intent": "Romantic",
  "preferredGenres": ["Pop", "Vocal"],
  "preferredArtists": [],
  "confidence": 0.88,
  "reason": "User wants vocally impressive tracks with high notes."
}}"""


def build_user_intent_prompt(
    *,
    user_input: str,
    profile_genres: list[str],
    profile_artists: list[str],
) -> str:
    return (
        f"User request:\n{user_input.strip()}\n\n"
        f"Allowed intents:\n{INTENT_LIST_TEXT}\n\n"
        f"User profile genres: {profile_genres}\n"
        f"User favourite artists: {profile_artists}"
    )
