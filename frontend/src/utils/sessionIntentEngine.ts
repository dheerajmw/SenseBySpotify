import type { SessionAction, SessionActionType, SessionState, Track } from "../types";
import { GENERAL_LISTENING_INTENT } from "../constants/brand";
import { intentsAlign } from "./intent";
import {
  CANDIDATE_DECAY_ON_CURRENT_MATCH,
  INTENT_CONFIDENCE_THRESHOLD,
  actionEvidenceWeight,
  clampConfidence,
} from "./intentEvidence";
import { validateProposedIntent, mapSearchToCandidateIntent } from "./intentValidation";
import { inferIntentFromSearchQuery, inferIntentFromTrack } from "./trackIntentFit";

export interface IntentEvidenceEntry {
  timestamp: number;
  action: SessionActionType;
  value: string;
  delta: number;
  candidateIntent: string | null;
  candidateConfidenceAfter: number;
  note: string;
}

export interface ConfidenceTimelineEntry {
  timestamp: number;
  candidateIntent: string | null;
  candidateConfidence: number;
  reason: string;
}

export interface ListeningEvidenceResult {
  candidateIntent: string | null;
  candidateConfidence: number;
  evidenceEntry: IntentEvidenceEntry | null;
  timelineEntry: ConfidenceTimelineEntry | null;
  shouldPromote: boolean;
  promotionReason: string | null;
}

export interface AiCandidateSuggestionResult {
  candidateIntent: string | null;
  candidateConfidence: number;
  rejectedIntent: string | null;
  rejectionReason: string | null;
  aiReason: string;
  timelineEntry: ConfidenceTimelineEntry | null;
}

function isNeutralCurrentIntent(currentIntent: string | null): boolean {
  const trimmed = currentIntent?.trim() ?? "";
  return (
    !trimmed ||
    intentsAlign(trimmed, GENERAL_LISTENING_INTENT) ||
    trimmed.toLowerCase() === "unknown"
  );
}

export function buildPromotedSessionState(
  snapshot: SessionState,
  afterIntent: string,
  reason: string,
): SessionState {
  return {
    ...snapshot,
    currentIntent: afterIntent,
    intentConfidence: 100,
    candidateIntent: null,
    candidateConfidence: 0,
    recommendationVersion: snapshot.recommendationVersion + 1,
    aiReason: reason,
    lastPromotionReason: reason,
    intentDecision: `Listening for "${afterIntent}"`,
    interactionsCollected: 0,
    explicitPreferenceSignals: 0,
    confidenceTimeline: [
      ...snapshot.confidenceTimeline,
      {
        timestamp: Date.now(),
        candidateIntent: afterIntent,
        candidateConfidence: 100,
        reason: `Promoted: ${reason}`,
      },
    ].slice(-30),
  };
}

export function computeIntentDecision(
  currentIntent: string | null,
  candidateIntent: string | null,
  candidateConfidence: number,
  validationStatus?: "accepted" | "rejected" | "pending",
): string {
  if (validationStatus === "rejected") {
    return "Keeping your current mood — invalid AI suggestion ignored";
  }
  if (!candidateIntent || intentsAlign(currentIntent ?? "", candidateIntent)) {
    return "Your session mood looks steady";
  }
  if (candidateConfidence >= INTENT_CONFIDENCE_THRESHOLD) {
    return `Ready to switch to “${candidateIntent}” (${candidateConfidence}/${INTENT_CONFIDENCE_THRESHOLD} points)`;
  }
  return `Watching “${candidateIntent}” — ${candidateConfidence}/${INTENT_CONFIDENCE_THRESHOLD} points to switch`;
}

export function applyListeningEvidence(
  state: SessionState,
  action: SessionAction,
  options: {
    track?: Track;
    profileGenres: string[];
    deferPlayConfidence?: boolean;
    knownArtists?: string[];
  },
): ListeningEvidenceResult {
  const currentIntent = state.currentIntent;
  let candidateIntent = state.candidateIntent;
  let candidateConfidence = state.candidateConfidence;

  if (options.deferPlayConfidence && action.type === "PLAY") {
    return {
      candidateIntent,
      candidateConfidence,
      evidenceEntry: null,
      timelineEntry: null,
      shouldPromote: false,
      promotionReason: null,
    };
  }

  const weight = actionEvidenceWeight(action.type, {
    deferPlay: options.deferPlayConfidence,
  });

  if (weight === 0 && action.type !== "PLAY") {
    return {
      candidateIntent,
      candidateConfidence,
      evidenceEntry: null,
      timelineEntry: null,
      shouldPromote: false,
      promotionReason: null,
    };
  }

  const track = options.track;
  const inferred =
    track && (action.type === "PLAY" || action.type === "LISTENED_20S" || action.type === "PREVIEW_COMPLETED")
      ? inferIntentFromTrack(track, options.profileGenres, currentIntent ?? undefined)
      : null;

  if (inferred && currentIntent && intentsAlign(inferred, currentIntent)) {
    if (candidateIntent && candidateConfidence > 0) {
      candidateConfidence = clampConfidence(candidateConfidence - CANDIDATE_DECAY_ON_CURRENT_MATCH);
      if (candidateConfidence <= 0) {
        candidateIntent = null;
        candidateConfidence = 0;
      }
      const entry: IntentEvidenceEntry = {
        timestamp: action.timestamp,
        action: action.type,
        value: action.value,
        delta: -CANDIDATE_DECAY_ON_CURRENT_MATCH,
        candidateIntent,
        candidateConfidenceAfter: candidateConfidence,
        note: `Listening matches ${currentIntent} — candidate decaying`,
      };
      const timeline: ConfidenceTimelineEntry = {
        timestamp: action.timestamp,
        candidateIntent,
        candidateConfidence,
        reason: entry.note,
      };
      return {
        candidateIntent,
        candidateConfidence,
        evidenceEntry: entry,
        timelineEntry: timeline,
        shouldPromote: false,
        promotionReason: null,
      };
    }
  }

  if (weight < 0) {
    if (!candidateIntent) {
      return {
        candidateIntent,
        candidateConfidence,
        evidenceEntry: null,
        timelineEntry: null,
        shouldPromote: false,
        promotionReason: null,
      };
    }
    candidateConfidence = clampConfidence(candidateConfidence + weight);
    if (candidateConfidence <= 0) {
      candidateIntent = null;
      candidateConfidence = 0;
    }
  } else if (weight > 0) {
    const behaviourIntent =
      inferred ??
      (candidateIntent && !isNeutralCurrentIntent(currentIntent) ? candidateIntent : null);

    if (!behaviourIntent) {
      return {
        candidateIntent,
        candidateConfidence,
        evidenceEntry: null,
        timelineEntry: null,
        shouldPromote: false,
        promotionReason: null,
      };
    }

    if (currentIntent && intentsAlign(behaviourIntent, currentIntent)) {
      return {
        candidateIntent,
        candidateConfidence,
        evidenceEntry: null,
        timelineEntry: null,
        shouldPromote: false,
        promotionReason: null,
      };
    }

    const validation = validateProposedIntent(
      behaviourIntent,
      currentIntent ?? GENERAL_LISTENING_INTENT,
      options.knownArtists ?? [],
    );
    if (!validation.accepted) {
      return {
        candidateIntent,
        candidateConfidence,
        evidenceEntry: null,
        timelineEntry: null,
        shouldPromote: false,
        promotionReason: null,
      };
    }

    if (!candidateIntent || !intentsAlign(candidateIntent, validation.intent)) {
      candidateIntent = validation.intent;
      candidateConfidence = clampConfidence(weight);
    } else {
      candidateConfidence = clampConfidence(candidateConfidence + weight);
    }
  }

  const entry: IntentEvidenceEntry | null =
    weight !== 0
      ? {
          timestamp: action.timestamp,
          action: action.type,
          value: action.value,
          delta: weight,
          candidateIntent,
          candidateConfidenceAfter: candidateConfidence,
          note:
            weight > 0
              ? `Evidence toward ${candidateIntent ?? "candidate"}`
              : `Negative signal on ${candidateIntent ?? "candidate"}`,
        }
      : null;

  const timeline: ConfidenceTimelineEntry | null = entry
    ? {
        timestamp: action.timestamp,
        candidateIntent,
        candidateConfidence,
        reason: entry.note,
      }
    : null;

  const shouldPromote = Boolean(
    candidateIntent &&
      currentIntent &&
      candidateConfidence >= INTENT_CONFIDENCE_THRESHOLD &&
      !intentsAlign(currentIntent, candidateIntent),
  );

  return {
    candidateIntent,
    candidateConfidence,
    evidenceEntry: entry,
    timelineEntry: timeline,
    shouldPromote,
    promotionReason: shouldPromote
      ? `Listening behaviour reached ${INTENT_CONFIDENCE_THRESHOLD} points for "${candidateIntent}".`
      : null,
  };
}

export function applyAiCandidateSuggestion(
  state: SessionState,
  proposedIntent: string,
  apiConfidence: number,
  reason: string,
  knownArtists: string[],
): AiCandidateSuggestionResult {
  const validation = validateProposedIntent(
    proposedIntent,
    state.currentIntent ?? GENERAL_LISTENING_INTENT,
    knownArtists,
  );

  if (!validation.accepted) {
    return {
      candidateIntent: state.candidateIntent,
      candidateConfidence: state.candidateConfidence,
      rejectedIntent: proposedIntent,
      rejectionReason: validation.rejectionReason,
      aiReason: `${reason} ${validation.rejectionReason ?? ""}`.trim(),
      timelineEntry: null,
    };
  }

  if (intentsAlign(validation.intent, state.currentIntent ?? "")) {
    return {
      candidateIntent: state.candidateIntent,
      candidateConfidence: state.candidateConfidence,
      rejectedIntent: null,
      rejectionReason: null,
      aiReason: reason,
      timelineEntry: null,
    };
  }

  const boost = Math.round(Math.max(0, Math.min(1, apiConfidence)) * 25);
  let candidateIntent = state.candidateIntent;
  let candidateConfidence = state.candidateConfidence;

  if (!candidateIntent || !intentsAlign(candidateIntent, validation.intent)) {
    candidateIntent = validation.intent;
    candidateConfidence = clampConfidence(boost);
  } else {
    candidateConfidence = clampConfidence(candidateConfidence + boost);
  }

  const timeline: ConfidenceTimelineEntry = {
    timestamp: Date.now(),
    candidateIntent,
    candidateConfidence,
    reason: `AI suggested ${validation.intent} (+${boost} points)`,
  };

  return {
    candidateIntent,
    candidateConfidence,
    rejectedIntent: null,
    rejectionReason: null,
    aiReason: reason,
    timelineEntry: timeline,
  };
}

export function shouldPromoteCandidate(state: SessionState): boolean {
  return Boolean(
    state.candidateIntent &&
      state.currentIntent &&
      state.candidateConfidence >= INTENT_CONFIDENCE_THRESHOLD &&
      !intentsAlign(state.currentIntent, state.candidateIntent),
  );
}

/** Initial candidate confidence when a committed search maps to a mood. */
export const SEARCH_CANDIDATE_SEED_CONFIDENCE = 12;

export interface SearchCandidateSeedResult {
  candidateIntent: string | null;
  candidateConfidence: number;
  intentDecision: string;
  evidenceEntry: IntentEvidenceEntry | null;
  timelineEntry: ConfidenceTimelineEntry | null;
  created: boolean;
}

function inferSearchMoodCandidate(
  query: string,
  profileGenres: string[],
): string | null {
  return (
    inferIntentFromSearchQuery(query, profileGenres) ??
    mapSearchToCandidateIntent(query)
  );
}

/**
 * Search may seed candidateIntent but must never change currentIntent.
 * Artist, genre, and discovery queries do not create a candidate.
 */
export function applySearchCandidateSeed(
  state: SessionState,
  query: string,
  profileGenres: string[],
  knownArtists: string[],
  timestamp = Date.now(),
): SearchCandidateSeedResult {
  const trimmed = query.trim();
  const unchanged: SearchCandidateSeedResult = {
    candidateIntent: state.candidateIntent,
    candidateConfidence: state.candidateConfidence,
    intentDecision: state.intentDecision,
    evidenceEntry: null,
    timelineEntry: null,
    created: false,
  };

  if (!trimmed) {
    return unchanged;
  }

  const currentIntent = state.currentIntent ?? GENERAL_LISTENING_INTENT;
  const directValidation = validateProposedIntent(trimmed, currentIntent, knownArtists);
  if (!directValidation.accepted) {
    return unchanged;
  }

  const mapped = inferSearchMoodCandidate(trimmed, profileGenres);
  if (!mapped) {
    return unchanged;
  }

  const moodValidation = validateProposedIntent(mapped, currentIntent, knownArtists);
  if (!moodValidation.accepted) {
    return unchanged;
  }

  if (intentsAlign(moodValidation.intent, currentIntent)) {
    return unchanged;
  }

  let candidateIntent = state.candidateIntent;
  let candidateConfidence = state.candidateConfidence;
  let created = false;

  if (!candidateIntent || !intentsAlign(candidateIntent, moodValidation.intent)) {
    candidateIntent = moodValidation.intent;
    candidateConfidence = SEARCH_CANDIDATE_SEED_CONFIDENCE;
    created = true;
  } else {
    candidateConfidence = clampConfidence(
      candidateConfidence + Math.max(4, Math.floor(SEARCH_CANDIDATE_SEED_CONFIDENCE / 2)),
    );
  }

  const note = created
    ? `Search for “${trimmed}” started watching “${candidateIntent}”`
    : `Search reinforced candidate “${candidateIntent}”`;

  const evidenceEntry: IntentEvidenceEntry = {
    timestamp,
    action: "SEARCH",
    value: trimmed,
    delta: created ? SEARCH_CANDIDATE_SEED_CONFIDENCE : 0,
    candidateIntent,
    candidateConfidenceAfter: candidateConfidence,
    note,
  };

  const timelineEntry: ConfidenceTimelineEntry = {
    timestamp,
    candidateIntent,
    candidateConfidence,
    reason: note,
  };

  return {
    candidateIntent,
    candidateConfidence,
    intentDecision: computeIntentDecision(currentIntent, candidateIntent, candidateConfidence),
    evidenceEntry,
    timelineEntry,
    created,
  };
}
