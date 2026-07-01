import type { SessionAction, SessionActionType } from "../types";
import { intentsAlign } from "./intent";

/** Minimum confidence (0–100) required before Session Intent actually changes. */
export const INTENT_CONFIDENCE_THRESHOLD = 75;

/** Meaningful interactions required before re-evaluating intent with the AI. */
export const MEANINGFUL_INTERACTIONS_TARGET = 5;

/** Explicit preference signals (like / replay / feedback) that can trigger evaluation sooner. */
export const EXPLICIT_PREFERENCE_SIGNALS_TARGET = 2;

/** Continuous listening window before behaviour is worth evaluating. */
export const LISTENING_WINDOW_MS = 60_000;

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
    case "SEARCH":
    case "SEARCH_TRACK":
    case "SEARCH_ARTIST":
    case "SKIP":
      return 12;
    case "LIKE":
    case "REPLAY":
      return 22;
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
}

export function createEvidenceSnapshot(): IntentEvidenceSnapshot {
  return {
    interactionsCollected: 0,
    explicitPreferenceSignals: 0,
    listeningWindowStart: null,
    lastDifferentSearch: null,
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

  if (action.type === "PLAY") {
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

  if (evidence.lastDifferentSearch) {
    return {
      ready: true,
      reason: `New search pattern detected: "${evidence.lastDifferentSearch}".`,
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

export function accumulateConfidence(
  currentConfidence: number,
  action: SessionAction,
  candidateIntent: string,
  currentIntent: string,
): number {
  if (!candidateIntent || intentsAlign(currentIntent, candidateIntent)) {
    return Math.max(0, currentConfidence - 2);
  }

  const weight = actionEvidenceWeight(action.type);
  return Math.min(100, currentConfidence + weight);
}

export function mergeEvaluationConfidence(
  localConfidence: number,
  apiConfidence: number,
  candidateIntent: string,
  currentIntent: string,
): number {
  const apiPercent = Math.round(apiConfidence * 100);
  if (!candidateIntent || intentsAlign(currentIntent, candidateIntent)) {
    return Math.max(0, Math.min(100, Math.round(localConfidence * 0.85)));
  }

  return Math.min(
    100,
    Math.round(localConfidence * 0.45 + apiPercent * 0.55),
  );
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
