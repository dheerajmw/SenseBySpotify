import type { SessionAction, SessionActionType } from "../types";

/** Minimum confidence points (0–100) required before Session Intent actually changes. */
export const INTENT_CONFIDENCE_THRESHOLD = 75;

/** Meaningful interactions required before re-evaluating intent with the AI. */
export const MEANINGFUL_INTERACTIONS_TARGET = 3;

/** Explicit preference signals (like / replay / feedback) that can trigger evaluation sooner. */
export const EXPLICIT_PREFERENCE_SIGNALS_TARGET = 2;

/** Continuous listening window before behaviour is worth evaluating. */
export const LISTENING_WINDOW_MS = 60_000;

/** Playback time before a sustained-listen confidence boost applies. */
export const SUSTAINED_LISTEN_MS = 20_000;

/** Candidate confidence decay when listening returns to the current session mood. */
export const CANDIDATE_DECAY_ON_CURRENT_MATCH = 10;

const EXPLICIT_TYPES: SessionActionType[] = ["LIKE", "REPLAY", "FEEDBACK"];

export function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function actionEvidenceWeight(
  type: SessionActionType,
  options?: { deferPlay?: boolean },
): number {
  if (options?.deferPlay && type === "PLAY") {
    return 0;
  }

  switch (type) {
    case "PLAY":
      return 5;
    case "LISTENED_20S":
      return 10;
    case "PREVIEW_COMPLETED":
      return 15;
    case "REPLAY":
      return 20;
    case "LIKE":
      return 25;
    case "FEEDBACK":
      return 10;
    case "SKIP":
      return -15;
    case "DISLIKE":
      return -30;
    case "SEARCH":
    case "SEARCH_TRACK":
    case "SEARCH_ARTIST":
    case "RECOMMENDATION_CLICKED":
      return 0;
    case "UNLIKE":
      return -5;
    default:
      return 0;
  }
}

export function isMeaningfulInteraction(type: SessionActionType): boolean {
  return actionEvidenceWeight(type) !== 0;
}

export function isExplicitPreferenceSignal(type: SessionActionType): boolean {
  return EXPLICIT_TYPES.includes(type);
}

export interface IntentEvidenceSnapshot {
  interactionsCollected: number;
  explicitPreferenceSignals: number;
  listeningWindowStart: number | null;
}

export function createEvidenceSnapshot(): IntentEvidenceSnapshot {
  return {
    interactionsCollected: 0,
    explicitPreferenceSignals: 0,
    listeningWindowStart: null,
  };
}

export function applyActionToEvidence(
  evidence: IntentEvidenceSnapshot,
  action: SessionAction,
): IntentEvidenceSnapshot {
  const next = { ...evidence };

  if (isMeaningfulInteraction(action.type)) {
    next.interactionsCollected += 1;
  }

  if (isExplicitPreferenceSignal(action.type)) {
    next.explicitPreferenceSignals += 1;
  }

  if (
    action.type === "PLAY" ||
    action.type === "LISTENED_20S" ||
    action.type === "PREVIEW_COMPLETED"
  ) {
    if (next.listeningWindowStart === null) {
      next.listeningWindowStart = action.timestamp;
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
  options?: {
    candidateConfidence?: number;
    currentIntent?: string | null;
    candidateIntent?: string | null;
  },
  now = Date.now(),
): EvaluationReadiness {
  if (
    options?.candidateConfidence != null &&
    options.candidateConfidence >= 60 &&
    options.candidateIntent &&
    options.currentIntent &&
    options.candidateIntent.trim() !== options.currentIntent.trim()
  ) {
    return {
      ready: true,
      reason: "Candidate mood reached 60+ points — running AI review.",
    };
  }

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
