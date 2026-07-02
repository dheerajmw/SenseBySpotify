import type { SessionAction, SessionActionType } from "../types";
import type { Track } from "../types";
import { intentsAlign } from "./intent";
import {
  inferIntentFromTrack,
  trackMatchesPredictedIntent,
} from "./trackIntentFit";

/** Minimum confidence points (0–100) required before Session Intent actually changes. */
export const INTENT_CONFIDENCE_THRESHOLD = 75;

/** Meaningful interactions required before re-evaluating intent with the AI. */
export const MEANINGFUL_INTERACTIONS_TARGET = 5;

/** Explicit preference signals (like / replay / feedback) that can trigger evaluation sooner. */
export const EXPLICIT_PREFERENCE_SIGNALS_TARGET = 2;

/** Continuous listening window before behaviour is worth evaluating. */
export const LISTENING_WINDOW_MS = 60_000;

/** Playback time before a sustained-listen confidence boost applies. */
export const SUSTAINED_LISTEN_MS = 20_000;

/** Confidence added once per track when playback reaches SUSTAINED_LISTEN_MS. */
export const SUSTAINED_LISTEN_CONFIDENCE_WEIGHT = 15;

/** Off-candidate genre plays before candidate intent is retargeted from listening. */
export const OFF_CANDIDATE_GENRE_PLAY_TARGET = 3;

/** Points added when listening pattern retargets the candidate intent. */
export const CANDIDATE_RETARGET_CONFIDENCE_BOOST = 20;

/** Fixed decrease per action when mood is stable (no predicted shift). */
export const STABLE_MOOD_ACTION_DECAY = 2;

/** Fixed decrease when 20s of playback doesn't match the active mood's genres. */
export const OFF_GENRE_SUSTAINED_LISTEN_DECAY = 12;

/** Fixed decrease after AI evaluation when mood stays the same. */
export const STABLE_MOOD_EVALUATION_DECAY = 5;

/** Fixed increases after AI evaluation when a mood shift is predicted. */
export const AI_EVALUATION_BOOST_HIGH = 25;
export const AI_EVALUATION_BOOST_MEDIUM = 15;
export const AI_EVALUATION_BOOST_LOW = 8;

const SEARCH_TYPES: SessionActionType[] = [
  "SEARCH",
  "SEARCH_TRACK",
  "SEARCH_ARTIST",
];

const EXPLICIT_TYPES: SessionActionType[] = ["LIKE", "REPLAY", "FEEDBACK"];

export function actionEvidenceWeight(type: SessionActionType): number {
  switch (type) {
    case "PLAY":
    case "RECOMMENDATION_CLICKED":
      return 8;
    case "LISTENED_20S":
      return SUSTAINED_LISTEN_CONFIDENCE_WEIGHT;
    case "SEARCH":
    case "SEARCH_TRACK":
    case "SEARCH_ARTIST":
    case "SKIP":
    case "DISLIKE":
      return 12;
    case "LIKE":
    case "REPLAY":
      return 22;
    case "UNLIKE":
      return 10;
    case "FEEDBACK":
      return 28;
    default:
      return 0;
  }
}

export function isMeaningfulInteraction(type: SessionActionType): boolean {
  return actionEvidenceWeight(type) > 0;
}

export function isExplicitPreferenceSignal(type: SessionActionType): boolean {
  return EXPLICIT_TYPES.includes(type);
}

export function isSearchAction(type: SessionActionType): boolean {
  return SEARCH_TYPES.includes(type);
}

export interface IntentEvidenceSnapshot {
  interactionsCollected: number;
  explicitPreferenceSignals: number;
  listeningWindowStart: number | null;
  lastDifferentSearch: string | null;
  listeningShiftIntent: string | null;
  listeningShiftPlayCount: number;
}

export function createEvidenceSnapshot(): IntentEvidenceSnapshot {
  return {
    interactionsCollected: 0,
    explicitPreferenceSignals: 0,
    listeningWindowStart: null,
    lastDifferentSearch: null,
    listeningShiftIntent: null,
    listeningShiftPlayCount: 0,
  };
}

export interface ListeningCandidateShiftResult {
  evidence: IntentEvidenceSnapshot;
  candidateIntent: string;
  retargeted: boolean;
  confidenceBoost: number;
  message: string | null;
}

export function applyListeningCandidateShift(
  evidence: IntentEvidenceSnapshot,
  track: Track,
  currentIntent: string,
  candidateIntent: string,
  profileGenres: string[],
): ListeningCandidateShiftResult {
  const inferred = inferIntentFromTrack(track, profileGenres);
  const resetShift = {
    ...evidence,
    listeningShiftIntent: null,
    listeningShiftPlayCount: 0,
  };

  if (!inferred) {
    return {
      evidence: resetShift,
      candidateIntent,
      retargeted: false,
      confidenceBoost: 0,
      message: null,
    };
  }

  if (trackMatchesPredictedIntent(track, candidateIntent, profileGenres)) {
    return {
      evidence: resetShift,
      candidateIntent,
      retargeted: false,
      confidenceBoost: 0,
      message: null,
    };
  }

  if (
    intentsAlign(inferred, currentIntent) &&
    intentsAlign(candidateIntent, currentIntent)
  ) {
    return {
      evidence: resetShift,
      candidateIntent,
      retargeted: false,
      confidenceBoost: 0,
      message: null,
    };
  }

  if (intentsAlign(inferred, candidateIntent)) {
    return {
      evidence: resetShift,
      candidateIntent,
      retargeted: false,
      confidenceBoost: 0,
      message: null,
    };
  }

  const sameAlternate =
    evidence.listeningShiftIntent &&
    intentsAlign(evidence.listeningShiftIntent, inferred);
  const nextCount = sameAlternate ? evidence.listeningShiftPlayCount + 1 : 1;
  const nextEvidence: IntentEvidenceSnapshot = {
    ...evidence,
    listeningShiftIntent: inferred,
    listeningShiftPlayCount: nextCount,
  };

  if (nextCount >= OFF_CANDIDATE_GENRE_PLAY_TARGET) {
    return {
      evidence: {
        ...nextEvidence,
        listeningShiftIntent: null,
        listeningShiftPlayCount: 0,
      },
      candidateIntent: inferred,
      retargeted: true,
      confidenceBoost: CANDIDATE_RETARGET_CONFIDENCE_BOOST,
      message: `You played ${OFF_CANDIDATE_GENRE_PLAY_TARGET} tracks in the ${inferred} mood — candidate intent updated.`,
    };
  }

  return {
    evidence: nextEvidence,
    candidateIntent,
    retargeted: false,
    confidenceBoost: 0,
    message: `Listening to ${inferred} tracks (${nextCount}/${OFF_CANDIDATE_GENRE_PLAY_TARGET}) — watching for a mood shift.`,
  };
}

export function applyActionToEvidence(
  evidence: IntentEvidenceSnapshot,
  action: SessionAction,
  currentIntent: string,
): IntentEvidenceSnapshot {
  const next = { ...evidence };

  if (isMeaningfulInteraction(action.type)) {
    next.interactionsCollected += 1;
  }

  if (isExplicitPreferenceSignal(action.type)) {
    next.explicitPreferenceSignals += 1;
  }

  if (action.type === "PLAY" || action.type === "LISTENED_20S") {
    if (next.listeningWindowStart === null) {
      next.listeningWindowStart = action.timestamp;
    }
  }

  if (isSearchAction(action.type)) {
    const query = action.value.trim();
    if (query && !intentsAlign(currentIntent, query)) {
      next.lastDifferentSearch = query;
    }
  }

  return next;
}

export function listeningWindowElapsed(
  evidence: IntentEvidenceSnapshot,
  now = Date.now(),
): boolean {
  if (evidence.listeningWindowStart === null) {
    return false;
  }
  return now - evidence.listeningWindowStart >= LISTENING_WINDOW_MS;
}

export interface EvaluationReadiness {
  ready: boolean;
  reason: string;
}

export function shouldEvaluateIntent(
  evidence: IntentEvidenceSnapshot,
  now = Date.now(),
): EvaluationReadiness {
  if (evidence.explicitPreferenceSignals >= EXPLICIT_PREFERENCE_SIGNALS_TARGET) {
    return {
      ready: true,
      reason: `${evidence.explicitPreferenceSignals} explicit preference signals collected.`,
    };
  }

  if (evidence.interactionsCollected >= MEANINGFUL_INTERACTIONS_TARGET) {
    return {
      ready: true,
      reason: `${evidence.interactionsCollected} meaningful interactions collected.`,
    };
  }

  if (
    evidence.lastDifferentSearch &&
    evidence.explicitPreferenceSignals >= EXPLICIT_PREFERENCE_SIGNALS_TARGET &&
    evidence.interactionsCollected >= 3
  ) {
    return {
      ready: true,
      reason: `Search pattern "${evidence.lastDifferentSearch}" confirmed by sustained activity.`,
    };
  }

  if (listeningWindowElapsed(evidence, now)) {
    return {
      ready: true,
      reason: "60 seconds of listening behaviour collected.",
    };
  }

  return { ready: false, reason: "Insufficient behavioural evidence." };
}

export function remainingInteractionsNeeded(
  interactionsCollected: number,
): number {
  return Math.max(0, MEANINGFUL_INTERACTIONS_TARGET - interactionsCollected);
}

/** Small boost when a 20s listen reinforces the active session mood. */
export const ON_GENRE_SUSTAINED_LISTEN_BOOST = 4;

export function applyActionConfidence(
  currentConfidence: number,
  action: SessionAction,
  candidateIntent: string,
  currentIntent: string,
  options?: { track?: Track; profileGenres?: string[]; reinforceSession?: boolean },
): number {
  const stable =
    !candidateIntent.trim() || intentsAlign(currentIntent, candidateIntent);
  const track = options?.track;
  const profileGenres = options?.profileGenres ?? [];

  if (
    track &&
    (action.type === "PLAY" || action.type === "LISTENED_20S")
  ) {
    const activeMoodIntent = stable ? currentIntent : candidateIntent;
    const onGenre =
      options?.reinforceSession === true
        ? true
        : trackMatchesPredictedIntent(
            track,
            activeMoodIntent,
            profileGenres,
          );

    if (onGenre) {
      if (stable) {
        if (action.type === "LISTENED_20S") {
          return Math.min(100, currentConfidence + ON_GENRE_SUSTAINED_LISTEN_BOOST);
        }
        return currentConfidence;
      }
      const weight = actionEvidenceWeight(action.type);
      return Math.min(100, currentConfidence + weight);
    }

    if (action.type === "LISTENED_20S") {
      return decayConfidenceForOffGenreListen(currentConfidence);
    }

    return Math.max(0, currentConfidence - STABLE_MOOD_ACTION_DECAY);
  }

  if (stable) {
    if (action.type === "LIKE" || action.type === "REPLAY") {
      return Math.min(100, currentConfidence + actionEvidenceWeight(action.type));
    }
    if (
      action.type === "SEARCH" ||
      action.type === "SEARCH_TRACK" ||
      action.type === "SEARCH_ARTIST"
    ) {
      return currentConfidence;
    }
    return Math.max(0, currentConfidence - STABLE_MOOD_ACTION_DECAY);
  }

  const weight = actionEvidenceWeight(action.type);
  return Math.min(100, currentConfidence + weight);
}

export function decayConfidenceForOffGenreListen(
  currentConfidence: number,
  amount: number = OFF_GENRE_SUSTAINED_LISTEN_DECAY,
): number {
  return Math.max(0, currentConfidence - amount);
}

function evaluationBoostFromApi(apiConfidence: number): number {
  if (apiConfidence >= 0.85) {
    return AI_EVALUATION_BOOST_HIGH;
  }
  if (apiConfidence >= 0.7) {
    return AI_EVALUATION_BOOST_MEDIUM;
  }
  if (apiConfidence >= 0.5) {
    return AI_EVALUATION_BOOST_LOW;
  }
  return 0;
}

export function mergeEvaluationConfidence(
  localConfidence: number,
  apiConfidence: number,
  candidateIntent: string,
  currentIntent: string,
): number {
  if (!candidateIntent || intentsAlign(currentIntent, candidateIntent)) {
    return Math.max(0, localConfidence - STABLE_MOOD_EVALUATION_DECAY);
  }

  return Math.min(100, localConfidence + evaluationBoostFromApi(apiConfidence));
}

export function shouldApplyIntentChange(
  intentConfidence: number,
  currentIntent: string,
  candidateIntent: string,
): boolean {
  if (intentConfidence < INTENT_CONFIDENCE_THRESHOLD) {
    return false;
  }
  if (!candidateIntent.trim()) {
    return false;
  }
  return !intentsAlign(currentIntent, candidateIntent);
}
