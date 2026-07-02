import type { SessionState } from "../types";
import { intentsAlign } from "./intent";
import {
  INTENT_CONFIDENCE_THRESHOLD,
  MEANINGFUL_INTERACTIONS_TARGET,
  OFF_CANDIDATE_GENRE_PLAY_TARGET,
  remainingInteractionsNeeded,
  SUSTAINED_LISTEN_CONFIDENCE_WEIGHT,
} from "./intentEvidence";
import { hasKnownIntent } from "./sessionLifecycle";
import { searchCandidateDiffersFromCurrent } from "./searchCandidateIntent";

export interface IntentPredictionDisplay {
  currentIntent: string;
  predictedIntent: string | null;
  confidencePercent: number;
  thresholdPercent: number;
  /** Visual fill 0–100 toward the switch threshold */
  meterFillPercent: number;
  pointsToThreshold: number;
  isPredictingChange: boolean;
  thresholdMet: boolean;
  headline: string;
  subline: string;
  evidenceHint: string | null;
  searchCandidateIntent: string | null;
  searchCandidateConfidence: number | null;
  searchCandidateQuery: string | null;
}

export function buildIntentPredictionDisplay(
  session: SessionState,
  options?: { isEvaluating?: boolean },
): IntentPredictionDisplay | null {
  const currentIntent = hasKnownIntent(session.currentIntent)
    ? session.currentIntent.trim()
    : "";
  if (!currentIntent) {
    return null;
  }

  const thresholdPercent = INTENT_CONFIDENCE_THRESHOLD;
  const confidencePercent = Math.min(100, Math.round(session.intentConfidence));
  const candidate = session.candidateIntent?.trim() || currentIntent;
  const isPredictingChange =
    Boolean(candidate) && !intentsAlign(currentIntent, candidate);
  const predictedIntent = isPredictingChange ? candidate : null;
  const thresholdMet = confidencePercent >= thresholdPercent;
  const meterFillPercent = confidencePercent;
  const pointsToThreshold = Math.max(0, thresholdPercent - confidencePercent);
  const searchExploring = searchCandidateDiffersFromCurrent(
    session.searchCandidate,
    currentIntent,
  );
  const searchCandidateIntent = searchExploring
    ? session.searchCandidate!.intent
    : null;
  const searchCandidateConfidence = searchExploring
    ? Math.min(100, Math.round(session.searchCandidate!.confidence))
    : null;
  const searchCandidateQuery = searchExploring
    ? session.searchCandidate!.query
    : null;

  let headline: string;
  let subline: string;

  if (options?.isEvaluating) {
    headline = "Reviewing your listening behaviour";
    subline = `Sense checks whether your mood shifted. A new session intent only applies at ${thresholdPercent}% confidence or higher.`;
  } else if (!isPredictingChange || confidencePercent >= 100) {
    headline = currentIntent;
    subline = `Your feed is tuned for this mood. Points add on play (+8) and 20s listens (+${SUSTAINED_LISTEN_CONFIDENCE_WEIGHT}) only when the song's genre fits the predicted intent (${thresholdPercent}-point threshold).`;
  } else if (thresholdMet) {
    headline = predictedIntent ?? currentIntent;
    subline = `Predicted intent at ${confidencePercent}/${thresholdPercent} points — switch threshold met.`;
  } else {
    headline = predictedIntent ?? currentIntent;
    subline = `Predicted mood shift from “${currentIntent}”. Off-genre plays retarget the candidate after ${OFF_CANDIDATE_GENRE_PLAY_TARGET} matching tracks. ${pointsToThreshold} more point${pointsToThreshold === 1 ? "" : "s"} needed (${confidencePercent}/${thresholdPercent}).`;
  }

  const remaining = remainingInteractionsNeeded(session.interactionsCollected);
  let evidenceHint: string | null = null;
  if (isPredictingChange && !thresholdMet) {
    if (remaining > 0) {
      evidenceHint = `${remaining} more meaningful interaction${remaining === 1 ? "" : "s"} before the next AI mood check (${session.interactionsCollected}/${MEANINGFUL_INTERACTIONS_TARGET}).`;
    } else {
      evidenceHint = "Enough activity logged — Sense will run the next mood check soon.";
    }
  }

  return {
    currentIntent,
    predictedIntent,
    confidencePercent,
    thresholdPercent,
    meterFillPercent,
    pointsToThreshold,
    isPredictingChange,
    thresholdMet,
    headline,
    subline,
    evidenceHint,
    searchCandidateIntent,
    searchCandidateConfidence,
    searchCandidateQuery,
  };
}
