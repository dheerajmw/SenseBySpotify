import type { SearchCandidate, SessionAction, Track } from "../types";
import { intentsAlign } from "./intent";
import {
  applyActionConfidence,
  INTENT_CONFIDENCE_THRESHOLD,
} from "./intentEvidence";
import { mapSearchToCandidateIntent } from "./intentValidation";
import {
  inferIntentFromSearchQuery,
  inferIntentFromTrack,
  trackMatchesPredictedIntent,
} from "./trackIntentFit";

/** Initial confidence when a committed search maps to a mood. */
export const SEARCH_COMMIT_CONFIDENCE_BOOST = 12;

/** Confidence when a search-queue play creates or reinforces a search candidate. */
export const SEARCH_PLAY_CONFIDENCE_BOOST = 8;

/** Confidence decay when the user reinforces the primary session on the intent feed. */
export const SEARCH_CANDIDATE_PRIMARY_DECAY = 3;

function trackHasGenre(track: Track): boolean {
  return Boolean(
    track.primary_genre ?? (track.artists[0]?.genres[0] ? track.artists[0].genres[0] : null),
  );
}

export function inferSearchIntent(
  query: string,
  track: Track | undefined,
  profileGenres: string[],
): string | null {
  const fromQuery =
    inferIntentFromSearchQuery(query, profileGenres) ??
    mapSearchToCandidateIntent(query);
  if (fromQuery) {
    return fromQuery;
  }
  if (track) {
    return inferIntentFromTrack(track, profileGenres);
  }
  return null;
}

export function createOrMergeSearchCandidate(
  existing: SearchCandidate | null,
  intent: string,
  query: string,
  initialBoost = SEARCH_COMMIT_CONFIDENCE_BOOST,
): SearchCandidate {
  const now = new Date().toISOString();
  if (existing && intentsAlign(existing.intent, intent)) {
    return {
      ...existing,
      query: query || existing.query,
      lastActiveAt: now,
      confidence: Math.min(
        100,
        Math.min(
          INTENT_CONFIDENCE_THRESHOLD - 1,
          existing.confidence + Math.max(4, Math.floor(initialBoost / 2)),
        ),
      ),
    };
  }
  return {
    intent,
    confidence: Math.min(initialBoost, INTENT_CONFIDENCE_THRESHOLD - 1),
    query,
    lastActiveAt: now,
  };
}

export function applySearchCandidateConfidence(
  candidate: SearchCandidate,
  action: SessionAction,
  currentIntent: string,
  options?: { track?: Track; profileGenres?: string[] },
): SearchCandidate {
  const nextConfidence = applyActionConfidence(
    candidate.confidence,
    action,
    candidate.intent,
    currentIntent,
    options,
  );
  return {
    ...candidate,
    confidence: Math.min(nextConfidence, INTENT_CONFIDENCE_THRESHOLD - 1),
    lastActiveAt: new Date().toISOString(),
  };
}

export function decaySearchCandidateOnPrimaryActivity(
  candidate: SearchCandidate | null,
): SearchCandidate | null {
  if (!candidate) {
    return null;
  }
  const next = Math.max(0, candidate.confidence - SEARCH_CANDIDATE_PRIMARY_DECAY);
  if (next === 0) {
    return null;
  }
  return { ...candidate, confidence: next };
}

export function searchCandidateDiffersFromCurrent(
  candidate: SearchCandidate | null,
  currentIntent: string,
): boolean {
  if (!candidate) {
    return false;
  }
  return !intentsAlign(currentIntent, candidate.intent);
}

/** Search play/listen reinforces the active session — not a side-quest browse. */
export function isSearchReinforcingSession(
  currentIntent: string,
  query: string,
  track: Track | undefined,
  profileGenres: string[],
): boolean {
  const fromQuery =
    inferIntentFromSearchQuery(query, profileGenres) ??
    mapSearchToCandidateIntent(query);
  if (fromQuery && intentsAlign(fromQuery, currentIntent)) {
    return true;
  }
  if (track && trackHasGenre(track)) {
    if (trackMatchesPredictedIntent(track, currentIntent, profileGenres)) {
      return true;
    }
    const inferred = inferIntentFromTrack(track, profileGenres);
    if (inferred && intentsAlign(inferred, currentIntent)) {
      return true;
    }
  }
  return false;
}
