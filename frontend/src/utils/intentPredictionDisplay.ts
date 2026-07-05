import type { SessionState } from "../types";
import { GENERAL_LISTENING_INTENT } from "../constants/brand";
import { intentsAlign } from "./intent";
import {
  INTENT_CONFIDENCE_THRESHOLD,
  MEANINGFUL_INTERACTIONS_TARGET,
  remainingInteractionsNeeded,
} from "./intentEvidence";
import { getActiveIntent, isGeneralListeningIntent } from "./sessionLifecycle";
import { formatResolvedIntentLabel } from "./userIntentInput";

export interface IntentPredictionDisplay {
  currentIntent: string;
  predictedIntent: string | null;
  confidencePercent: number;
  thresholdPercent: number;
  meterFillPercent: number;
  pointsToThreshold: number;
  isPredictingChange: boolean;
  thresholdMet: boolean;
  headline: string;
  subline: string;
  evidenceHint: string | null;
}

export function buildIntentPredictionDisplay(
  session: SessionState,
  options?: { isEvaluating?: boolean },
): IntentPredictionDisplay | null {
  const currentIntent = getActiveIntent(session) || GENERAL_LISTENING_INTENT;
  const thresholdPercent = INTENT_CONFIDENCE_THRESHOLD;
  const candidate = session.candidateIntent?.trim() || null;
  const isPredictingChange = Boolean(
    candidate && session.currentIntent && !intentsAlign(session.currentIntent, candidate),
  );
  const predictedIntent = isPredictingChange ? candidate : null;
  const confidencePercent = Math.min(100, Math.round(session.candidateConfidence));
  const thresholdMet = confidencePercent >= thresholdPercent;
  const meterFillPercent = confidencePercent;
  const pointsToThreshold = Math.max(0, thresholdPercent - confidencePercent);

  let headline: string;
  let subline: string;

  if (options?.isEvaluating) {
    headline = "Reviewing your listening behaviour";
    subline = `Sense checks whether your mood shifted. Session intent only changes at ${thresholdPercent} candidate points.`;
  } else if (!isPredictingChange) {
    const intentLabel = isGeneralListeningIntent(currentIntent)
      ? GENERAL_LISTENING_INTENT
      : formatResolvedIntentLabel(currentIntent, session.preferredGenres);
    headline = intentLabel;
    subline = isGeneralListeningIntent(currentIntent)
      ? "Play and listen — Sense learns your mood from behaviour. Search never changes session intent."
      : `Your feed is tuned for ${intentLabel}. Points come from plays (+5), 20s listens (+10), likes (+25), and skips (−15).`;
  } else if (thresholdMet) {
    headline = predictedIntent ?? currentIntent;
    subline = `Candidate mood at ${confidencePercent}/${thresholdPercent} points — switch threshold met.`;
  } else {
    headline = predictedIntent ?? currentIntent;
    subline = `Watching a shift from “${currentIntent}”. ${pointsToThreshold} more point${pointsToThreshold === 1 ? "" : "s"} needed (${confidencePercent}/${thresholdPercent}).`;
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
  };
}
