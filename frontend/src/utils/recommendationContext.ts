import type { LocalUserProfile } from "../types";
import type { SessionState } from "../types";
import { getRecommendationIntent } from "./sessionLifecycle";

const CULTURAL_GENRE_PATTERN =
  /hindi|urdu|ghazal|shayari|bollywood|punjabi|tamil|telugu|sufi|devotional|bhajan/i;

/** Enrich the backend query with genre keywords stripped from the user's free text. */
export function buildRecommendationQuery(
  intent: string,
  preferredGenres: string[] = [],
): string {
  const mood = intent.trim();
  const hints = preferredGenres
    .map((genre) => genre.trim().toLowerCase())
    .filter(Boolean);

  if (hints.length === 0) {
    return mood;
  }

  const cultural = hints.some((hint) => CULTURAL_GENRE_PATTERN.test(hint));
  const poetryCue = cultural && /reading|melancholic/i.test(mood) ? " poetry ghazal" : "";

  return `${mood} ${hints.join(" ")}${poetryCue}`.trim();
}

export type RecommendationRequestProfile = LocalUserProfile & {
  preferredGenres?: string[];
};

export function buildRecommendationRequest(
  profile: LocalUserProfile,
  session: Pick<SessionState, "preferredGenres" | "discoveryLevel"> & {
    currentIntent?: string | null;
  },
  intentOverride?: string,
): { query: string; profile: RecommendationRequestProfile } {
  const activeIntent =
    intentOverride?.trim() ||
    getRecommendationIntent(session as SessionState) ||
    profile.currentIntent.trim();

  const preferredGenres = session.preferredGenres ?? [];

  return {
    query: buildRecommendationQuery(activeIntent, preferredGenres),
    profile: {
      ...profile,
      currentIntent: activeIntent,
      noveltyTolerance: session.discoveryLevel,
      preferredGenres,
    },
  };
}
