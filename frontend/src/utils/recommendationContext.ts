import type { LocalUserProfile } from "../types";
import type { SessionState } from "../types";
import { canonicalIntent } from "./intentValidation";
import { getRecommendationIntent } from "./sessionLifecycle";

const CULTURAL_GENRE_PATTERN =
  /hindi|urdu|ghazal|shayari|bollywood|punjabi|tamil|telugu|sufi|devotional|bhajan/i;

const POETRY_PATTERN = /poetry|poem|nazm|ghazal|shayari/i;

function normalizeQueryPart(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

/** True when raw text only repeats the canonical mood (e.g. mood Calm + raw "CALM"). */
export function rawInputRedundantWithMood(mood: string, raw: string): boolean {
  const moodNorm = normalizeQueryPart(mood);
  const rawNorm = normalizeQueryPart(raw);
  if (!rawNorm) {
    return true;
  }
  if (moodNorm === rawNorm) {
    return true;
  }
  const fromRaw = canonicalIntent(raw);
  if (!fromRaw || normalizeQueryPart(fromRaw) !== moodNorm) {
    return false;
  }
  // Short intent labels ("CALM", "fun", "workout music") — not full sentences.
  const wordCount = raw.trim().split(/\s+/).length;
  return wordCount <= 2 && raw.length <= 24;
}

/**
 * Build the backend search query from canonical mood and user raw text.
 * Genre hints are sent separately via profile.preferredGenres — not duplicated here.
 */
export function buildRecommendationQuery(
  intent: string,
  preferredGenres: string[] = [],
  rawUserInput?: string | null,
): string {
  const mood = intent.trim();
  const raw = rawUserInput?.trim() ?? "";

  let combined: string;
  if (raw && !rawInputRedundantWithMood(mood, raw)) {
    combined = `${mood} ${raw}`.replace(/\s+/g, " ").trim();
  } else if (mood) {
    combined = mood;
  } else if (raw) {
    combined = raw;
  } else {
    const hints = preferredGenres
      .map((genre) => genre.trim())
      .filter(Boolean);
    combined = hints.join(" ").replace(/\s+/g, " ").trim();
  }

  if (!combined) {
    return mood;
  }

  const poetryCue =
    POETRY_PATTERN.test(combined) &&
    CULTURAL_GENRE_PATTERN.test(combined) &&
    /reading|melancholic/i.test(mood) &&
    !/ghazal|shayari/.test(combined.toLowerCase())
      ? " ghazal"
      : "";

  return `${combined}${poetryCue}`.trim();
}

export type RecommendationRequestProfile = LocalUserProfile & {
  preferredGenres?: string[];
};

export function buildRecommendationRequest(
  profile: LocalUserProfile,
  session: Pick<SessionState, "preferredGenres" | "discoveryLevel" | "declaredUserInput"> & {
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
    query: buildRecommendationQuery(
      activeIntent,
      preferredGenres,
      session.declaredUserInput,
    ),
    profile: {
      ...profile,
      currentIntent: activeIntent,
      noveltyTolerance: session.discoveryLevel,
      preferredGenres,
    },
  };
}
