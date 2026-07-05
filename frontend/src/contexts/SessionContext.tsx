import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import {
  DEMO_MODE_STORAGE_KEY,
  GENERAL_LISTENING_INTENT,
  SESSION_STORAGE_KEY,
  SESSION_VISIT_KEY,
} from "../constants/brand";
import { parseUserDeclaredIntent, updateSessionIntent } from "../services/sessionIntentService";
import { intentsAlign } from "../utils/intent";
import {
  INTENT_CONFIDENCE_THRESHOLD,
  LISTENING_WINDOW_MS,
  applyActionToEvidence,
  createEvidenceSnapshot,
  shouldEvaluateIntent,
  type IntentEvidenceSnapshot,
} from "../utils/intentEvidence";
import {
  validateProposedIntent,
  isDiscoveryLabel,
} from "../utils/intentValidation";
import { computeDiscoveryAdjustment } from "../utils/discoveryAdaptation";
import {
  clampDiscoveryLevel,
  getDiscoveryProfile,
  normalizeNoveltyTolerance,
} from "../utils/discoveryLevel";
import { playbackBridge } from "../utils/playbackBridge";
import {
  formatResolvedIntentLabel,
  resolveUserDeclaredIntent,
  type ResolvedUserDeclaredIntent,
} from "../utils/userIntentInput";
import { buildRecommendationRequest } from "../utils/recommendationContext";
import { learningMessageForAction } from "../utils/sessionDisplay";
import {
  applyAiCandidateSuggestion,
  applyListeningEvidence,
  applySearchCandidateSeed,
  buildPromotedSessionState,
  computeIntentDecision,
  shouldPromoteCandidate,
} from "../utils/sessionIntentEngine";
import {
  generateSessionId,
  getActiveIntent,
  getRecommendationIntent,
  getSessionStatus,
  hasKnownIntent,
  isSessionExpired,
  isUnknownIntent,
  resolveSessionLastActive,
  touchSessionTimestamps,
  type SessionStatus,
} from "../utils/sessionLifecycle";
import { useProfile } from "./ProfileContext";
import { useRecommendations } from "./RecommendationsContext";
import type {
  GenerateRecommendationsResponse,
  IntentHistoryEntry,
  IntentValidationDebug,
  QueueSource,
  SessionAction,
  SessionActionType,
  SessionState,
  Track,
} from "../types";

const MAX_RECENT_ACTIONS = 15;
/** Minimum time the before/after mood shift is shown before refresh begins. */
const INTENT_MODAL_VISIBLE_MS = 2800;
/** Brief pause after refresh so the transition does not feel like a flash. */
const INTENT_MODAL_DISMISS_MS = 600;
const DISCOVERY_MODAL_VISIBLE_MS = 1400;

interface IntentPromotionOptions {
  /** Behaviour-driven switch — use toast + immediate refresh instead of blocking modal. */
  local?: boolean;
}

export interface IntentChangeModalState {
  before: string;
  after: string;
  reason: string;
  phase: "visible" | "refreshing";
}

export interface DiscoveryChangeModalState {
  before: string;
  after: string;
  reason: string;
  phase: "visible" | "refreshing";
}

interface SetCurrentIntentOptions {
  reason?: string;
  bumpVersion?: boolean;
  userDeclared?: boolean;
}

export interface LogActionOptions {
  track?: Track;
  /** Autoplay PLAY — skip confidence until LISTENED_20S */
  deferConfidence?: boolean;
  queueSource?: QueueSource;
}

interface SessionContextValue {
  session: SessionState;
  sessionStatus: SessionStatus;
  needsIntentPrompt: boolean;
  intentHistory: IntentHistoryEntry[];
  toastMessage: string | null;
  learningNotice: string | null;
  intentChangeModal: IntentChangeModalState | null;
  discoveryChangeModal: DiscoveryChangeModalState | null;
  isCheckingIntent: boolean;
  isRegeneratingFeed: boolean;
  demoMode: boolean;
  logAction: (type: SessionActionType, value: string, options?: LogActionOptions) => void;
  setCurrentIntent: (intent: string, options?: SetCurrentIntentOptions) => void;
  establishSessionIntent: (intent: string) => Promise<GenerateRecommendationsResponse | null>;
  setDiscoveryLevel: (
    level: number,
    options?: { regenerate?: boolean; manual?: boolean },
  ) => Promise<void>;
  setDemoMode: (enabled: boolean) => void;
  refreshRecommendations: (intent?: string) => Promise<GenerateRecommendationsResponse | null>;
  updateSessionQueue: (queue: Track[], queueIndex: number) => void;
  markPersonalizedSecondSongUsed: () => void;
  dismissToast: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface StoredSession {
  session: SessionState;
  intentHistory: IntentHistoryEntry[];
}

interface ResolvedSession {
  session: SessionState;
  intentHistory: IntentHistoryEntry[];
  isNewSession: boolean;
  wasExpired: boolean;
}

function mergePreferredArtists(current: string[], incoming: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const name of [...current, ...incoming]) {
    const cleaned = name.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(cleaned);
  }
  return merged.slice(0, 12);
}

function mergePreferredGenres(current: string[], incoming: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const name of [...current, ...incoming]) {
    const cleaned = name.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(cleaned);
  }
  return merged.slice(0, 12);
}

function createNewListeningSession(discoveryLevel = 50): SessionState {
  const now = new Date().toISOString();
  const discoveryProfile = getDiscoveryProfile(discoveryLevel);
  return {
    sessionId: generateSessionId(),
    createdAt: now,
    lastActive: now,
    currentIntent: null,
    candidateIntent: null,
    intentConfidence: 0,
    candidateConfidence: 0,
    evidence: [],
    confidenceTimeline: [],
    lastSearchQuery: null,
    preferredArtists: [],
    preferredGenres: [],
    discoveryLevel,
    discoveryLabel: discoveryProfile.label,
    confidence: 0,
    interactionsCollected: 0,
    explicitPreferenceSignals: 0,
    recentActions: [],
    currentQueue: [],
    currentQueueIndex: 0,
    lastUpdated: now,
    recommendationVersion: 1,
    aiReason: "New listening session started.",
    intentDecision: "Waiting for listening behaviour",
    lastPromotionReason: null,
    rejectedAiIntents: [],
    lastIntentValidation: null,
    personalizedSecondSongUsed: false,
    intentDeclaredThisSession: false,
    declaredUserInput: null,
  };
}

function bootstrapNewSession(discoveryLevel: number): SessionState {
  const base = createNewListeningSession(discoveryLevel);
  return {
    ...base,
    currentIntent: null,
    intentConfidence: 0,
    aiReason: "Tell Sense what you want to listen for this session.",
    intentDecision: "Waiting for your session intent",
    intentDeclaredThisSession: false,
  };
}

function loadDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function normalizeSessionState(
  session: Partial<SessionState> & {
    searchCandidates?: unknown[];
    searchCandidate?: unknown;
    listeningShiftIntent?: string | null;
    listeningShiftPlayCount?: number;
  },
  discoveryLevel: number,
): SessionState {
  const base = createNewListeningSession(discoveryLevel);
  const createdAt = session.createdAt ?? base.createdAt;
  const lastActive = session.lastActive ?? session.lastUpdated ?? createdAt;
  const currentIntent =
    session.currentIntent?.trim() ||
    (isUnknownIntent(session.currentIntent) ? GENERAL_LISTENING_INTENT : null);

  let candidateIntent = session.candidateIntent?.trim() || null;
  let candidateConfidence =
    typeof session.candidateConfidence === "number" ? session.candidateConfidence : 0;

  if (
    candidateConfidence === 0 &&
    typeof session.intentConfidence === "number" &&
    candidateIntent &&
    currentIntent &&
    !intentsAlign(candidateIntent, currentIntent)
  ) {
    candidateConfidence = session.intentConfidence;
  }

  return {
    ...base,
    ...session,
    sessionId: session.sessionId ?? base.sessionId,
    createdAt,
    lastActive,
    currentIntent: currentIntent ?? base.currentIntent,
    candidateIntent,
    candidateConfidence,
    intentConfidence:
      typeof session.intentConfidence === "number"
        ? session.intentConfidence
        : currentIntent
          ? 100
          : 0,
    evidence: session.evidence ?? [],
    confidenceTimeline: session.confidenceTimeline ?? [],
    lastPromotionReason: session.lastPromotionReason ?? null,
    rejectedAiIntents: session.rejectedAiIntents ?? [],
    currentQueue: session.currentQueue ?? [],
    currentQueueIndex: session.currentQueueIndex ?? 0,
    interactionsCollected: session.interactionsCollected ?? 0,
    explicitPreferenceSignals: session.explicitPreferenceSignals ?? 0,
    preferredArtists: session.preferredArtists ?? [],
    preferredGenres: session.preferredGenres ?? [],
    intentDecision: session.intentDecision ?? "Waiting for listening behaviour",
    lastIntentValidation: session.lastIntentValidation ?? null,
    personalizedSecondSongUsed: session.personalizedSecondSongUsed ?? false,
    lastSearchQuery: session.lastSearchQuery ?? null,
    intentDeclaredThisSession:
      session.intentDeclaredThisSession ??
      Boolean(session.currentIntent?.trim() && (session.intentConfidence ?? 0) >= 100),
    declaredUserInput: session.declaredUserInput ?? null,
  };
}

function resolveStoredSession(discoveryLevel: number): ResolvedSession {
  try {
    const visitActive = sessionStorage.getItem(SESSION_VISIT_KEY);
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!visitActive || !raw) {
      sessionStorage.setItem(SESSION_VISIT_KEY, "1");
      return {
        session: bootstrapNewSession(discoveryLevel),
        intentHistory: [],
        isNewSession: true,
        wasExpired: Boolean(raw),
      };
    }

    const parsed = JSON.parse(raw) as StoredSession;
    const storedSession = parsed.session;
    const lastActive = resolveSessionLastActive(storedSession ?? {});

    if (!storedSession || isSessionExpired(lastActive)) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return {
        session: bootstrapNewSession(discoveryLevel),
        intentHistory: [],
        isNewSession: true,
        wasExpired: Boolean(storedSession),
      };
    }

    const resolvedDiscovery = clampDiscoveryLevel(
      storedSession.discoveryLevel ?? discoveryLevel,
    );
    const discoveryProfile = getDiscoveryProfile(resolvedDiscovery);
    const session = touchSessionTimestamps(
      normalizeSessionState(
        {
          ...storedSession,
          discoveryLevel: resolvedDiscovery,
          discoveryLabel: storedSession.discoveryLabel ?? discoveryProfile.label,
        },
        resolvedDiscovery,
      ),
    );

    return {
      session,
      intentHistory: parsed.intentHistory ?? [],
      isNewSession: false,
      wasExpired: false,
    };
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return {
      session: bootstrapNewSession(discoveryLevel),
      intentHistory: [],
      isNewSession: true,
      wasExpired: false,
    };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useProfile();
  const { recommendations, setFeed, query: feedQuery, clearFeed, usedAi, fallbackReason } = useRecommendations();
  const initialDiscovery = normalizeNoveltyTolerance(profile.noveltyTolerance);
  const initial = resolveStoredSession(initialDiscovery);
  const [session, setSession] = useState<SessionState>(initial.session);
  const [intentHistory, setIntentHistory] = useState<IntentHistoryEntry[]>(
    initial.intentHistory,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [learningNotice, setLearningNotice] = useState<string | null>(null);
  const [intentChangeModal, setIntentChangeModal] =
    useState<IntentChangeModalState | null>(null);
  const [discoveryChangeModal, setDiscoveryChangeModal] =
    useState<DiscoveryChangeModalState | null>(null);
  const [isCheckingIntent, setIsCheckingIntent] = useState(false);
  const [isRegeneratingFeed, setIsRegeneratingFeed] = useState(false);
  const [demoMode, setDemoModeState] = useState(loadDemoMode);

  const evidenceRef = useRef<IntentEvidenceSnapshot>(createEvidenceSnapshot());
  const debounceTimer = useRef<number | null>(null);
  const listeningTimer = useRef<number | null>(null);
  const learningTimer = useRef<number | null>(null);
  const isCheckingRef = useRef(false);
  const aiRecoveryAttemptedRef = useRef(false);
  const sessionRef = useRef(session);
  const recommendationsRef = useRef(recommendations);
  const profileRef = useRef(profile);
  const intentHistoryRef = useRef(intentHistory);
  const demoModeRef = useRef(demoMode);
  const lastSyncedFeedQuery = useRef<string | null>(null);
  const clearedForNewSessionRef = useRef(false);

  sessionRef.current = session;
  recommendationsRef.current = recommendations;
  profileRef.current = profile;
  intentHistoryRef.current = intentHistory;
  demoModeRef.current = demoMode;

  const sessionStatus = useMemo(() => getSessionStatus(session), [session]);
  const needsIntentPrompt =
    profile.onboardingCompleted && !session.intentDeclaredThisSession;

  const saveState = useCallback((nextSession: SessionState, history: IntentHistoryEntry[]) => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ session: nextSession, intentHistory: history }),
    );
  }, []);

  const persistSession = useCallback(
    (nextSession: SessionState, history = intentHistoryRef.current) => {
      const touched = touchSessionTimestamps(nextSession);
      sessionRef.current = touched;
      setSession(touched);
      saveState(touched, history);
      return touched;
    },
    [saveState],
  );

  useEffect(() => {
    if (!initial.isNewSession || clearedForNewSessionRef.current) {
      return;
    }
    clearedForNewSessionRef.current = true;
    clearFeed();
    saveState(initial.session, initial.intentHistory);
  }, [clearFeed, initial.intentHistory, initial.isNewSession, initial.session, saveState]);

  const showLearningNotice = useCallback((message: string) => {
    setLearningNotice(message);
    if (learningTimer.current) {
      window.clearTimeout(learningTimer.current);
    }
    learningTimer.current = window.setTimeout(() => {
      setLearningNotice(null);
      learningTimer.current = null;
    }, 2600);
  }, []);

  const setDemoMode = useCallback((enabled: boolean) => {
    demoModeRef.current = enabled;
    setDemoModeState(enabled);
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, enabled ? "true" : "false");
  }, []);

  const applyUserDeclaredIntent = useCallback(
    (
      intent: string,
      reason: string,
      options?: {
        bumpVersion?: boolean;
        addHistory?: boolean;
        resolved?: ResolvedUserDeclaredIntent;
        /** Allow updating session when mood matches but user gave new discovery text. */
        force?: boolean;
      },
    ): boolean => {
      const trimmed = intent.trim();
      if (!trimmed || isUnknownIntent(trimmed) || isDiscoveryLabel(trimmed)) {
        return false;
      }

      const profileArtists = profileRef.current.favouriteArtists.map((artist) => artist.name);
      const resolved =
        options?.resolved ??
        resolveUserDeclaredIntent(trimmed, {
          knownArtists: profileArtists,
          profileGenres: profileRef.current.genres,
        });

      if (!resolved.accepted) {
        return false;
      }

      const canonicalIntent = resolved.intent;
      const sameDeclaredInput =
        (sessionRef.current.declaredUserInput ?? "").trim().toLowerCase() ===
        trimmed.toLowerCase();

      if (
        !options?.force &&
        sessionRef.current.intentDeclaredThisSession &&
        hasKnownIntent(sessionRef.current.currentIntent) &&
        sessionRef.current.currentIntent &&
        intentsAlign(sessionRef.current.currentIntent, canonicalIntent) &&
        sameDeclaredInput
      ) {
        return false;
      }

      const displayLabel = resolved.displayLabel || formatResolvedIntentLabel(
        canonicalIntent,
        resolved.preferredGenres,
      );
      const bumpVersion = options?.bumpVersion ?? false;
      const next: SessionState = {
        ...sessionRef.current,
        currentIntent: canonicalIntent,
        candidateIntent: null,
        candidateConfidence: 0,
        intentConfidence: 100,
        intentDeclaredThisSession: true,
        interactionsCollected: 0,
        explicitPreferenceSignals: 0,
        preferredArtists: options?.force
          ? resolved.preferredArtists
          : mergePreferredArtists(
              sessionRef.current.preferredArtists,
              resolved.preferredArtists,
            ),
        preferredGenres: options?.force
          ? resolved.preferredGenres
          : mergePreferredGenres(
              sessionRef.current.preferredGenres,
              resolved.preferredGenres,
            ),
        declaredUserInput: trimmed,
        confidence: Math.max(sessionRef.current.confidence, 0.8),
        aiReason: reason || `Session tuned for ${displayLabel}.`,
        intentDecision: `Listening for "${canonicalIntent}"`,
        recommendationVersion: bumpVersion
          ? sessionRef.current.recommendationVersion + 1
          : sessionRef.current.recommendationVersion,
      };
      evidenceRef.current = createEvidenceSnapshot();

      let nextHistory = intentHistoryRef.current;
      if (options?.addHistory !== false) {
        const entry: IntentHistoryEntry = {
          timestamp: Date.now(),
          intent: canonicalIntent,
          confidence: next.confidence,
          reason: next.aiReason,
        };
        nextHistory = [...intentHistoryRef.current, entry].slice(-20);
        intentHistoryRef.current = nextHistory;
        setIntentHistory(nextHistory);
      }

      persistSession(next, nextHistory);
      return true;
    },
    [persistSession],
  );

  const applyIntentUpdate = useCallback(
    (
      intent: string,
      reason: string,
      options?: { bumpVersion?: boolean; addHistory?: boolean },
    ): boolean => {
      const trimmed = intent.trim();
      if (isUnknownIntent(trimmed)) {
        return false;
      }

      const profileArtists = profileRef.current.favouriteArtists.map(
        (artist) => artist.name,
      );
      const validation = validateProposedIntent(
        trimmed,
        sessionRef.current.currentIntent ?? GENERAL_LISTENING_INTENT,
        profileArtists,
      );
      if (!validation.accepted) {
        return false;
      }

      if (intentsAlign(sessionRef.current.currentIntent ?? "", validation.intent)) {
        return false;
      }

      const bumpVersion = options?.bumpVersion ?? false;
      const next: SessionState = {
        ...sessionRef.current,
        candidateIntent: validation.intent,
        candidateConfidence: Math.max(
          sessionRef.current.candidateConfidence,
          INTENT_CONFIDENCE_THRESHOLD,
        ),
        preferredArtists: mergePreferredArtists(
          sessionRef.current.preferredArtists,
          validation.preferredArtists,
        ),
        preferredGenres: mergePreferredGenres(
          sessionRef.current.preferredGenres,
          validation.preferredGenres,
        ),
        aiReason: reason,
        intentDecision: `AI suggested "${validation.intent}" — awaiting behavioural confirmation`,
        recommendationVersion: bumpVersion
          ? sessionRef.current.recommendationVersion + 1
          : sessionRef.current.recommendationVersion,
      };
      evidenceRef.current = createEvidenceSnapshot();

      let nextHistory = intentHistoryRef.current;
      if (options?.addHistory !== false) {
        const entry: IntentHistoryEntry = {
          timestamp: Date.now(),
          intent: validation.intent,
          confidence: next.confidence,
          reason,
        };
        nextHistory = [...intentHistoryRef.current, entry].slice(-20);
        intentHistoryRef.current = nextHistory;
        setIntentHistory(nextHistory);
      }

      persistSession(next, nextHistory);
      return true;
    },
    [persistSession],
  );

  const isAdaptingDiscoveryRef = useRef(false);

  const refreshRecommendations = useCallback(
    async (intent?: string) => {
      const activeIntent =
        intent?.trim() || getRecommendationIntent(sessionRef.current);
      if (!activeIntent) {
        return null;
      }

      setIsRegeneratingFeed(true);
      try {
        const { query, profile: requestProfile } = buildRecommendationRequest(
          profileRef.current,
          sessionRef.current,
          activeIntent,
        );
        const response = await api.generateRecommendations(requestProfile, query);
        setFeed(response);
        lastSyncedFeedQuery.current = response.query;
        return response;
      } finally {
        setIsRegeneratingFeed(false);
      }
    },
    [setFeed],
  );

  useEffect(() => {
    if (aiRecoveryAttemptedRef.current || usedAi || !fallbackReason) {
      return;
    }
    const intent = getActiveIntent(sessionRef.current) || feedQuery;
    if (!intent || !profileRef.current.onboardingCompleted) {
      return;
    }
    aiRecoveryAttemptedRef.current = true;
    void refreshRecommendations(intent);
  }, [usedAi, fallbackReason, feedQuery, refreshRecommendations]);

  const establishSessionIntent = useCallback(
    async (intent: string) => {
      const trimmed = intent.trim();
      if (!trimmed) {
        return null;
      }

      const profileArtists = profileRef.current.favouriteArtists.map((artist) => artist.name);
      let resolved = resolveUserDeclaredIntent(trimmed, {
        knownArtists: profileArtists,
        profileGenres: profileRef.current.genres,
      });

      if (!resolved.accepted) {
        try {
          const parsed = await parseUserDeclaredIntent(profileRef.current, trimmed);
          if (parsed.accepted) {
            resolved = {
              accepted: true,
              intent: parsed.intent,
              preferredGenres: parsed.preferred_genres,
              preferredArtists: parsed.preferred_artists,
              displayLabel: parsed.display_label || parsed.intent,
              rejectionReason: null,
            };
          } else if (parsed.rejection_reason) {
            throw new Error(parsed.rejection_reason);
          }
        } catch (err) {
          if (err instanceof Error && err.message && !resolved.accepted) {
            throw err;
          }
        }
      }

      if (!resolved.accepted) {
        throw new Error(
          resolved.rejectionReason ??
            "Could not start listening session with that intent.",
        );
      }

      const displayLabel =
        resolved.displayLabel ||
        formatResolvedIntentLabel(resolved.intent, resolved.preferredGenres);

      const established = applyUserDeclaredIntent(
        trimmed,
        `Session tuned for ${displayLabel}.`,
        { bumpVersion: true, resolved, force: true },
      );
      if (!established) {
        throw new Error("Could not start listening session with that intent.");
      }

      return refreshRecommendations(resolved.intent);
    },
    [applyUserDeclaredIntent, refreshRecommendations],
  );

  const applyDiscoveryLevel = useCallback(
    (level: number, options?: { bumpVersion?: boolean }) => {
      const nextLevel = clampDiscoveryLevel(level);
      const discoveryProfile = getDiscoveryProfile(nextLevel);
      const next: SessionState = {
        ...sessionRef.current,
        discoveryLevel: nextLevel,
        discoveryLabel: discoveryProfile.label,
        recommendationVersion: options?.bumpVersion
          ? sessionRef.current.recommendationVersion + 1
          : sessionRef.current.recommendationVersion,
      };
      persistSession(next);
      updateProfile({ noveltyTolerance: nextLevel });
      return { nextLevel, discoveryProfile };
    },
    [persistSession, updateProfile],
  );

  const setDiscoveryLevel = useCallback(
    async (
      level: number,
      options?: { regenerate?: boolean; manual?: boolean },
    ) => {
      const nextLevel = clampDiscoveryLevel(level);
      if (nextLevel === sessionRef.current.discoveryLevel) {
        if (options?.regenerate) {
          await refreshRecommendations();
        }
        return;
      }

      applyDiscoveryLevel(nextLevel, { bumpVersion: options?.regenerate !== false });
      if (options?.regenerate !== false) {
        await refreshRecommendations();
      }
    },
    [applyDiscoveryLevel, refreshRecommendations],
  );

  const runDiscoveryAdaptation = useCallback(
    async (type: SessionActionType, value: string) => {
      if (isAdaptingDiscoveryRef.current) {
        return;
      }

      const favouriteNames = profileRef.current.favouriteArtists.map(
        (artist) => artist.name,
      );
      const adjustment = computeDiscoveryAdjustment(type, value, favouriteNames);
      if (!adjustment) {
        return;
      }

      const currentLevel = sessionRef.current.discoveryLevel;
      const nextLevel = clampDiscoveryLevel(currentLevel + adjustment.delta);
      if (nextLevel === currentLevel) {
        return;
      }

      const beforeProfile = getDiscoveryProfile(currentLevel);
      const afterProfile = getDiscoveryProfile(nextLevel);
      const labelChanged = beforeProfile.label !== afterProfile.label;
      const levelDelta = Math.abs(nextLevel - currentLevel);
      const significant = labelChanged || levelDelta >= 5;

      applyDiscoveryLevel(nextLevel, { bumpVersion: significant });

      if (!labelChanged) {
        return;
      }

      isAdaptingDiscoveryRef.current = true;
      try {
        setDiscoveryChangeModal({
          before: beforeProfile.label,
          after: afterProfile.label,
          reason: adjustment.reason,
          phase: "visible",
        });

        await new Promise((resolve) => {
          window.setTimeout(resolve, DISCOVERY_MODAL_VISIBLE_MS);
        });

        if (playbackBridge.isPlaying) {
          setDiscoveryChangeModal(null);
        } else {
          setDiscoveryChangeModal((current) =>
            current ? { ...current, phase: "refreshing" } : null,
          );
          await refreshRecommendations();
          window.setTimeout(() => setDiscoveryChangeModal(null), 400);
        }
      } finally {
        isAdaptingDiscoveryRef.current = false;
      }
    },
    [applyDiscoveryLevel, refreshRecommendations],
  );

  const setCurrentIntent = useCallback(
    (intent: string, options?: SetCurrentIntentOptions) => {
      if (options?.userDeclared) {
        applyUserDeclaredIntent(
          intent,
          options?.reason ?? "Intent updated by user activity.",
          { bumpVersion: options?.bumpVersion ?? false },
        );
        return;
      }

      applyIntentUpdate(
        intent,
        options?.reason ?? "Intent updated by user activity.",
        { bumpVersion: options?.bumpVersion ?? false },
      );
    },
    [applyIntentUpdate, applyUserDeclaredIntent],
  );

  const resetEvidence = useCallback(() => {
    evidenceRef.current = createEvidenceSnapshot();
    if (listeningTimer.current) {
      window.clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
  }, []);

  const showIntentPromotionFlow = useCallback(
    async (
      beforeIntent: string,
      afterIntent: string,
      reason: string,
      options?: IntentPromotionOptions,
    ) => {
      if (options?.local) {
        showLearningNotice(`Switched to ${afterIntent}`);
        if (playbackBridge.isPlaying) {
          playbackBridge.pendingIntentRefresh = {
            intent: afterIntent,
            preferredArtists: sessionRef.current.preferredArtists,
          };
        } else {
          await refreshRecommendations(afterIntent);
        }
        return;
      }

      setIntentChangeModal({
        before: beforeIntent,
        after: afterIntent,
        reason,
        phase: "visible",
      });

      await new Promise((resolve) => {
        window.setTimeout(resolve, INTENT_MODAL_VISIBLE_MS);
      });

      if (playbackBridge.isPlaying) {
        playbackBridge.pendingIntentRefresh = {
          intent: afterIntent,
          preferredArtists: sessionRef.current.preferredArtists,
        };
      } else {
        setIntentChangeModal((current) =>
          current ? { ...current, phase: "refreshing" } : null,
        );
        await refreshRecommendations(afterIntent);
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, INTENT_MODAL_DISMISS_MS);
      });
      setIntentChangeModal(null);
    },
    [refreshRecommendations, showLearningNotice],
  );

  const runIntentCheck = useCallback(async () => {
    if (isCheckingRef.current) {
      return;
    }

    const readiness = shouldEvaluateIntent(evidenceRef.current, {
      candidateConfidence: sessionRef.current.candidateConfidence,
      currentIntent: sessionRef.current.currentIntent,
      candidateIntent: sessionRef.current.candidateIntent,
    });
    if (!readiness.ready) {
      return;
    }

    isCheckingRef.current = true;
    setIsCheckingIntent(true);
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const sessionSnapshot = sessionRef.current;
    const profileSnapshot = {
      ...profileRef.current,
      currentIntent: getRecommendationIntent(sessionSnapshot),
    };

    if (shouldPromoteCandidate(sessionSnapshot) && sessionSnapshot.candidateIntent) {
      const beforeIntent = sessionSnapshot.currentIntent ?? GENERAL_LISTENING_INTENT;
      const promotedIntent = sessionSnapshot.candidateIntent;
      const reason = `Listening behaviour reached ${INTENT_CONFIDENCE_THRESHOLD} points for "${promotedIntent}".`;
      const next = buildPromotedSessionState(sessionSnapshot, promotedIntent, reason);
      const entry: IntentHistoryEntry = {
        timestamp: Date.now(),
        intent: promotedIntent,
        confidence: 1,
        reason,
      };
      const nextHistory = [...intentHistoryRef.current, entry].slice(-20);
      intentHistoryRef.current = nextHistory;
      setIntentHistory(nextHistory);
      persistSession(next, nextHistory);
      resetEvidence();
      void showIntentPromotionFlow(beforeIntent, promotedIntent, reason);
      return;
    }

    try {
      const result = await updateSessionIntent(
        profileSnapshot,
        sessionSnapshot,
        recommendationsRef.current,
      );

      const profileArtists = profileRef.current.favouriteArtists.map(
        (artist) => artist.name,
      );
      const validation = validateProposedIntent(
        result.new_intent,
        sessionSnapshot.currentIntent ?? GENERAL_LISTENING_INTENT,
        profileArtists,
      );
      const apiRejected =
        result.validation_status === "rejected" || !validation.accepted;
      const preferredArtists = mergePreferredArtists(
        mergePreferredArtists(
          sessionSnapshot.preferredArtists,
          result.preferred_artists ?? [],
        ),
        validation.preferredArtists,
      );
      const preferredGenres = mergePreferredGenres(
        mergePreferredGenres(
          sessionSnapshot.preferredGenres,
          result.preferred_genres ?? [],
        ),
        validation.preferredGenres,
      );

      const aiSuggestion = apiRejected
        ? {
            candidateIntent: sessionSnapshot.candidateIntent,
            candidateConfidence: sessionSnapshot.candidateConfidence,
            rejectedIntent: result.new_intent,
            rejectionReason:
              result.validation_message ?? validation.rejectionReason,
            aiReason: `${result.reason} ${result.validation_message ?? validation.rejectionReason ?? ""}`.trim(),
            timelineEntry: null,
          }
        : applyAiCandidateSuggestion(
            sessionSnapshot,
            validation.intent,
            result.confidence,
            result.reason,
            profileArtists,
          );

      const validationDebug: IntentValidationDebug = {
        rawAiOutput: { ...result },
        parsedOutput: {
          intent_changed: result.intent_changed,
          new_intent: result.new_intent,
          preferred_artists: result.preferred_artists,
          preferred_genres: result.preferred_genres,
          confidence: result.confidence,
          reason: result.reason,
        },
        validationStatus: apiRejected ? "rejected" : "accepted",
        validationMessage:
          result.validation_message ??
          validation.rejectionReason ??
          aiSuggestion.rejectionReason ??
          null,
        rawNewIntent: result.raw_new_intent ?? result.new_intent,
      };
      const intentDecision = computeIntentDecision(
        sessionSnapshot.currentIntent,
        aiSuggestion.candidateIntent,
        aiSuggestion.candidateConfidence,
        validationDebug.validationStatus,
      );

      const next: SessionState = {
        ...sessionSnapshot,
        candidateIntent: aiSuggestion.candidateIntent,
        candidateConfidence: aiSuggestion.candidateConfidence,
        confidence: result.confidence,
        aiReason: aiSuggestion.aiReason,
        preferredArtists,
        preferredGenres,
        interactionsCollected: 0,
        explicitPreferenceSignals: 0,
        intentDecision,
        lastIntentValidation: validationDebug,
        rejectedAiIntents: aiSuggestion.rejectedIntent
          ? [...sessionSnapshot.rejectedAiIntents, aiSuggestion.rejectedIntent].slice(-10)
          : sessionSnapshot.rejectedAiIntents,
        confidenceTimeline: aiSuggestion.timelineEntry
          ? [...sessionSnapshot.confidenceTimeline, aiSuggestion.timelineEntry].slice(-30)
          : sessionSnapshot.confidenceTimeline,
      };

      persistSession(next);
      resetEvidence();

      if (shouldPromoteCandidate(next) && next.candidateIntent) {
        const beforeIntent = sessionSnapshot.currentIntent ?? GENERAL_LISTENING_INTENT;
        const promotedIntent = next.candidateIntent;
        const reason = `AI and listening behaviour agree on "${promotedIntent}".`;
        const promoted = buildPromotedSessionState(next, promotedIntent, reason);
        const entry: IntentHistoryEntry = {
          timestamp: Date.now(),
          intent: promotedIntent,
          confidence: 1,
          reason,
        };
        const nextHistory = [...intentHistoryRef.current, entry].slice(-20);
        intentHistoryRef.current = nextHistory;
        setIntentHistory(nextHistory);
        persistSession(promoted, nextHistory);
        await showIntentPromotionFlow(beforeIntent, promotedIntent, reason);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[SessionIntent] intent check failed:", error);
      }
      setIntentChangeModal(null);
    } finally {
      isCheckingRef.current = false;
      setIsCheckingIntent(false);
    }
  }, [persistSession, resetEvidence, showIntentPromotionFlow]);

  const scheduleIntentEvaluation = useCallback(() => {
    const readiness = shouldEvaluateIntent(evidenceRef.current, {
      candidateConfidence: sessionRef.current.candidateConfidence,
      currentIntent: sessionRef.current.currentIntent,
      candidateIntent: sessionRef.current.candidateIntent,
    });
    if (readiness.ready) {
      void runIntentCheck();
      return;
    }

    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
    }

    const evidence = evidenceRef.current;
    if (evidence.listeningWindowStart !== null) {
      const elapsed = Date.now() - evidence.listeningWindowStart;
      const remaining = Math.max(0, LISTENING_WINDOW_MS - elapsed);
      debounceTimer.current = window.setTimeout(() => {
        void runIntentCheck();
      }, remaining);
    }
  }, [runIntentCheck]);

  const logAction = useCallback(
    (type: SessionActionType, value: string, options?: LogActionOptions) => {
      const action: SessionAction = { type, value, timestamp: Date.now() };
      let snapshot = sessionRef.current;
      const profileGenres = profileRef.current.genres;
      const knownArtists = profileRef.current.favouriteArtists.map((artist) => artist.name);
      const deferPlayConfidence =
        options?.deferConfidence === true && type === "PLAY";

      if (type === "SEARCH") {
        const query = value.trim();
        const profileGenres = profileRef.current.genres;
        const seed = applySearchCandidateSeed(
          snapshot,
          query,
          profileGenres,
          knownArtists,
          action.timestamp,
        );
        persistSession({
          ...snapshot,
          recentActions: [...snapshot.recentActions, action].slice(-MAX_RECENT_ACTIONS),
          lastSearchQuery: query || snapshot.lastSearchQuery,
          candidateIntent: seed.candidateIntent,
          candidateConfidence: seed.candidateConfidence,
          intentDecision: seed.intentDecision,
          evidence: seed.evidenceEntry
            ? [...snapshot.evidence, seed.evidenceEntry].slice(-50)
            : snapshot.evidence,
          confidenceTimeline: seed.timelineEntry
            ? [...snapshot.confidenceTimeline, seed.timelineEntry].slice(-30)
            : snapshot.confidenceTimeline,
        });
        if (seed.created) {
          showLearningNotice(
            `Exploring “${seed.candidateIntent}” from search — listen to build toward ${INTENT_CONFIDENCE_THRESHOLD} points`,
          );
        }
        return;
      }

      if (type === "SEARCH_ARTIST") {
        const query = value.trim();
        const nextArtists = query
          ? mergePreferredArtists(snapshot.preferredArtists, [query])
          : snapshot.preferredArtists;
        persistSession({
          ...snapshot,
          preferredArtists: nextArtists,
          recentActions: [...snapshot.recentActions, action].slice(-MAX_RECENT_ACTIONS),
        });
        return;
      }

      if (!deferPlayConfidence) {
        evidenceRef.current = applyActionToEvidence(evidenceRef.current, action);
      }

      const listeningResult = applyListeningEvidence(
        snapshot,
        action,
        {
          track: options?.track,
          profileGenres,
          deferPlayConfidence,
          knownArtists,
        },
      );

      let next: SessionState = {
        ...snapshot,
        recentActions: [...snapshot.recentActions, action].slice(-MAX_RECENT_ACTIONS),
        candidateIntent: listeningResult.candidateIntent,
        candidateConfidence: listeningResult.candidateConfidence,
        interactionsCollected: evidenceRef.current.interactionsCollected,
        explicitPreferenceSignals: evidenceRef.current.explicitPreferenceSignals,
        intentDecision: computeIntentDecision(
          snapshot.currentIntent,
          listeningResult.candidateIntent,
          listeningResult.candidateConfidence,
        ),
        evidence: listeningResult.evidenceEntry
          ? [...snapshot.evidence, listeningResult.evidenceEntry].slice(-50)
          : snapshot.evidence,
        confidenceTimeline: listeningResult.timelineEntry
          ? [...snapshot.confidenceTimeline, listeningResult.timelineEntry].slice(-30)
          : snapshot.confidenceTimeline,
      };

      if (listeningResult.shouldPromote && listeningResult.candidateIntent) {
        const beforeIntent = snapshot.currentIntent ?? GENERAL_LISTENING_INTENT;
        const reason =
          listeningResult.promotionReason ??
          `Listening behaviour reached ${INTENT_CONFIDENCE_THRESHOLD} points for "${listeningResult.candidateIntent}".`;
        const promotedNext = buildPromotedSessionState(
          next,
          listeningResult.candidateIntent,
          reason,
        );
        evidenceRef.current = createEvidenceSnapshot();
        const entry: IntentHistoryEntry = {
          timestamp: Date.now(),
          intent: listeningResult.candidateIntent,
          confidence: 1,
          reason,
        };
        const nextHistory = [...intentHistoryRef.current, entry].slice(-20);
        intentHistoryRef.current = nextHistory;
        setIntentHistory(nextHistory);
        persistSession(promotedNext, nextHistory);
        void showIntentPromotionFlow(beforeIntent, listeningResult.candidateIntent, reason);

        if (["LIKE", "UNLIKE", "DISLIKE", "SKIP", "REPLAY"].includes(type)) {
          void runDiscoveryAdaptation(type, value);
        }
        return;
      }

      persistSession(next);

      const learningMessage = deferPlayConfidence
        ? null
        : learningMessageForAction(type);
      if (learningMessage) {
        showLearningNotice(learningMessage);
      }

      if (
        !deferPlayConfidence &&
        type === "PLAY" &&
        evidenceRef.current.listeningWindowStart !== null
      ) {
        if (!listeningTimer.current) {
          listeningTimer.current = window.setTimeout(() => {
            listeningTimer.current = null;
            void runIntentCheck();
          }, LISTENING_WINDOW_MS);
        }
      }

      if (!deferPlayConfidence) {
        scheduleIntentEvaluation();
      }

      if (["LIKE", "UNLIKE", "DISLIKE", "SKIP", "REPLAY"].includes(type)) {
        void runDiscoveryAdaptation(type, value);
      }
    },
    [
      persistSession,
      runDiscoveryAdaptation,
      runIntentCheck,
      scheduleIntentEvaluation,
      showIntentPromotionFlow,
      showLearningNotice,
    ],
  );

  const updateSessionQueue = useCallback(
    (queue: Track[], queueIndex: number) => {
      const current = sessionRef.current;
      if (
        current.currentQueue === queue &&
        current.currentQueueIndex === queueIndex
      ) {
        return;
      }

      const queueChanged =
        current.currentQueue.length !== queue.length ||
        current.currentQueue.some((track, index) => track.id !== queue[index]?.id) ||
        current.currentQueueIndex !== queueIndex;

      if (!queueChanged) {
        return;
      }

      persistSession({
        ...current,
        currentQueue: queue,
        currentQueueIndex: queueIndex,
      });
    },
    [persistSession],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
      }
      if (listeningTimer.current) {
        window.clearTimeout(listeningTimer.current);
      }
      if (learningTimer.current) {
        window.clearTimeout(learningTimer.current);
      }
    };
  }, []);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const markPersonalizedSecondSongUsed = useCallback(() => {
    persistSession({
      ...sessionRef.current,
      personalizedSecondSongUsed: true,
      aiReason: "Second song personalized from your last played track.",
    });
  }, [persistSession]);

  const value = useMemo(
    () => ({
      session,
      sessionStatus,
      needsIntentPrompt,
      intentHistory,
      toastMessage,
      learningNotice,
      intentChangeModal,
      discoveryChangeModal,
      isCheckingIntent,
      isRegeneratingFeed,
      demoMode,
      logAction,
      setCurrentIntent,
      establishSessionIntent,
      setDiscoveryLevel,
      setDemoMode,
      refreshRecommendations,
      updateSessionQueue,
      markPersonalizedSecondSongUsed,
      dismissToast,
    }),
    [
      session,
      sessionStatus,
      needsIntentPrompt,
      intentHistory,
      toastMessage,
      learningNotice,
      intentChangeModal,
      discoveryChangeModal,
      isCheckingIntent,
      isRegeneratingFeed,
      demoMode,
      logAction,
      setCurrentIntent,
      establishSessionIntent,
      setDiscoveryLevel,
      setDemoMode,
      refreshRecommendations,
      updateSessionQueue,
      markPersonalizedSecondSongUsed,
      dismissToast,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within SessionProvider");
  }
  return context;
}
