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
  SESSION_STORAGE_KEY,
  UNKNOWN_SESSION_INTENT,
} from "../constants/brand";
import { updateSessionIntent } from "../services/sessionIntentService";
import { intentsAlign, hasIntentChanged } from "../utils/intent";
import {
  INTENT_CONFIDENCE_THRESHOLD,
  LISTENING_WINDOW_MS,
  applyActionConfidence,
  applyActionToEvidence,
  applyListeningCandidateShift,
  createEvidenceSnapshot,
  mergeEvaluationConfidence,
  OFF_GENRE_SUSTAINED_LISTEN_DECAY,
  shouldApplyIntentChange,
  shouldEvaluateIntent,
  type IntentEvidenceSnapshot,
} from "../utils/intentEvidence";
import {
  mapSearchToCandidateIntent,
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
import { learningMessageForAction } from "../utils/sessionDisplay";
import { trackMatchesPredictedIntent } from "../utils/trackIntentFit";
import {
  applySearchCandidateConfidence,
  createOrMergeSearchCandidate,
  decaySearchCandidateOnPrimaryActivity,
  inferSearchIntent,
  isSearchReinforcingSession,
  SEARCH_PLAY_CONFIDENCE_BOOST,
} from "../utils/searchCandidateIntent";
import {
  generateSessionId,
  getActiveIntent,
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
const INTENT_MODAL_VISIBLE_MS = 1400;
const DISCOVERY_MODAL_VISIBLE_MS = 1400;

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
  /** Routes confidence to the parallel search candidate instead of the primary candidate. */
  queueSource?: QueueSource;
  /** Search playback that reinforces the active session mood. */
  reinforceSession?: boolean;
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

function computeIntentDecision(
  currentIntent: string,
  candidateIntent: string,
  intentConfidence: number,
  validationStatus?: "accepted" | "rejected" | "pending",
): string {
  if (validationStatus === "rejected") {
    return "Keeping your current mood — invalid suggestion ignored";
  }
  if (!candidateIntent || intentsAlign(currentIntent, candidateIntent)) {
    return "Your session mood looks steady";
  }
  if (intentConfidence >= INTENT_CONFIDENCE_THRESHOLD) {
    return `Switching to “${candidateIntent}” (${intentConfidence}/${INTENT_CONFIDENCE_THRESHOLD} points)`;
  }
  return `Watching “${candidateIntent}” — ${intentConfidence}/${INTENT_CONFIDENCE_THRESHOLD} points to switch`;
}

function buildPromotedSessionState(
  snapshot: SessionState,
  afterIntent: string,
  confidence: number,
  reason: string,
): SessionState {
  return {
    ...snapshot,
    currentIntent: afterIntent,
    candidateIntent: afterIntent,
    intentConfidence: Math.max(confidence, INTENT_CONFIDENCE_THRESHOLD),
    searchCandidate: null,
    recommendationVersion: snapshot.recommendationVersion + 1,
    aiReason: reason,
    intentDecision: `Listening for "${afterIntent}"`,
    listeningShiftIntent: null,
    listeningShiftPlayCount: 0,
    interactionsCollected: 0,
    explicitPreferenceSignals: 0,
  };
}

function createNewListeningSession(discoveryLevel = 50): SessionState {
  const now = new Date().toISOString();
  const discoveryProfile = getDiscoveryProfile(discoveryLevel);
  return {
    sessionId: generateSessionId(),
    createdAt: now,
    lastActive: now,
    currentIntent: UNKNOWN_SESSION_INTENT,
    candidateIntent: UNKNOWN_SESSION_INTENT,
    intentConfidence: 0,
    searchCandidate: null,
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
    intentDecision: "Waiting for listening intent",
    lastIntentValidation: null,
    personalizedSecondSongUsed: false,
    listeningShiftIntent: null,
    listeningShiftPlayCount: 0,
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
  session: Partial<SessionState>,
  discoveryLevel: number,
): SessionState {
  const base = createNewListeningSession(discoveryLevel);
  const currentIntent = session.currentIntent?.trim() || UNKNOWN_SESSION_INTENT;
  const candidateIntent = session.candidateIntent?.trim() || currentIntent;
  const createdAt = session.createdAt ?? base.createdAt;
  const lastActive = session.lastActive ?? session.lastUpdated ?? createdAt;

  return {
    ...base,
    ...session,
    sessionId: session.sessionId ?? base.sessionId,
    createdAt,
    lastActive,
    currentIntent,
    candidateIntent,
    currentQueue: session.currentQueue ?? [],
    currentQueueIndex: session.currentQueueIndex ?? 0,
    intentConfidence:
      typeof session.intentConfidence === "number"
        ? session.intentConfidence
        : hasKnownIntent(currentIntent)
          ? 100
          : 0,
    interactionsCollected: session.interactionsCollected ?? 0,
    explicitPreferenceSignals: session.explicitPreferenceSignals ?? 0,
    preferredArtists: session.preferredArtists ?? [],
    preferredGenres: session.preferredGenres ?? [],
    intentDecision: session.intentDecision ?? "Waiting for more evidence",
    lastIntentValidation: session.lastIntentValidation ?? null,
    personalizedSecondSongUsed: session.personalizedSecondSongUsed ?? false,
    listeningShiftIntent: session.listeningShiftIntent ?? null,
    listeningShiftPlayCount: session.listeningShiftPlayCount ?? 0,
    searchCandidate: session.searchCandidate ?? null,
    lastSearchQuery: session.lastSearchQuery ?? null,
  };
}

function resolveStoredSession(discoveryLevel: number): ResolvedSession {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return {
        session: createNewListeningSession(discoveryLevel),
        intentHistory: [],
        isNewSession: true,
        wasExpired: false,
      };
    }

    const parsed = JSON.parse(raw) as StoredSession;
    const storedSession = parsed.session;
    const lastActive = resolveSessionLastActive(storedSession ?? {});

    if (!storedSession || isSessionExpired(lastActive)) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return {
        session: createNewListeningSession(discoveryLevel),
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
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return {
      session: createNewListeningSession(discoveryLevel),
      intentHistory: [],
      isNewSession: true,
      wasExpired: false,
    };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useProfile();
  const { recommendations, setFeed, query: feedQuery, clearFeed } = useRecommendations();
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
  const needsIntentPrompt = isUnknownIntent(session.currentIntent);

  const saveState = useCallback((nextSession: SessionState, history: IntentHistoryEntry[]) => {
    localStorage.setItem(
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
      options?: { bumpVersion?: boolean; addHistory?: boolean },
    ): boolean => {
      const trimmed = intent.trim();
      if (!trimmed || isUnknownIntent(trimmed) || isDiscoveryLabel(trimmed)) {
        return false;
      }

      if (
        hasKnownIntent(sessionRef.current.currentIntent) &&
        intentsAlign(sessionRef.current.currentIntent, trimmed)
      ) {
        return false;
      }

      const bumpVersion = options?.bumpVersion ?? false;
      const next: SessionState = {
        ...sessionRef.current,
        currentIntent: trimmed,
        candidateIntent: trimmed,
        intentConfidence: 100,
        interactionsCollected: 0,
        explicitPreferenceSignals: 0,
        listeningShiftIntent: null,
        listeningShiftPlayCount: 0,
        searchCandidate: null,
        lastSearchQuery: null,
        confidence: Math.max(sessionRef.current.confidence, 0.8),
        aiReason: reason,
        intentDecision: `Listening for "${trimmed}"`,
        recommendationVersion: bumpVersion
          ? sessionRef.current.recommendationVersion + 1
          : sessionRef.current.recommendationVersion,
      };
      evidenceRef.current = createEvidenceSnapshot();

      let nextHistory = intentHistoryRef.current;
      if (options?.addHistory !== false) {
        const entry: IntentHistoryEntry = {
          timestamp: Date.now(),
          intent: trimmed,
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
        sessionRef.current.currentIntent,
        profileArtists,
      );
      if (!validation.accepted) {
        return false;
      }

      if (intentsAlign(sessionRef.current.currentIntent, validation.intent)) {
        return false;
      }

      const bumpVersion = options?.bumpVersion ?? false;
      const next: SessionState = {
        ...sessionRef.current,
        currentIntent: validation.intent,
        candidateIntent: validation.intent,
        intentConfidence: 100,
        interactionsCollected: 0,
        explicitPreferenceSignals: 0,
        listeningShiftIntent: null,
        listeningShiftPlayCount: 0,
        searchCandidate: null,
        lastSearchQuery: null,
        confidence: Math.max(sessionRef.current.confidence, 0.8),
        aiReason: reason,
        preferredArtists: mergePreferredArtists(
          sessionRef.current.preferredArtists,
          validation.preferredArtists,
        ),
        preferredGenres: mergePreferredGenres(
          sessionRef.current.preferredGenres,
          validation.preferredGenres,
        ),
        intentDecision: `Applying intent change to "${validation.intent}"`,
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
        intent?.trim() || getActiveIntent(sessionRef.current);
      if (!activeIntent) {
        return null;
      }

      setIsRegeneratingFeed(true);
      try {
        const activeProfile = {
          ...profileRef.current,
          currentIntent: activeIntent,
          noveltyTolerance: sessionRef.current.discoveryLevel,
        };
        const response = await api.generateRecommendations(activeProfile, activeIntent);
        setFeed(response);
        lastSyncedFeedQuery.current = response.query;
        return response;
      } finally {
        setIsRegeneratingFeed(false);
      }
    },
    [setFeed],
  );

  const establishSessionIntent = useCallback(
    async (intent: string) => {
      const trimmed = intent.trim();
      if (!trimmed) {
        return null;
      }

      const established = applyUserDeclaredIntent(
        trimmed,
        `Started listening session for "${trimmed}".`,
        { bumpVersion: true },
      );
      if (!established) {
        throw new Error("Could not start listening session with that intent.");
      }

      return refreshRecommendations(trimmed);
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
    async (beforeIntent: string, afterIntent: string, reason: string) => {
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
        setIntentChangeModal(null);
      } else {
        setIntentChangeModal((current) =>
          current ? { ...current, phase: "refreshing" } : null,
        );
        await refreshRecommendations(afterIntent);
        window.setTimeout(() => setIntentChangeModal(null), 400);
      }
    },
    [refreshRecommendations],
  );

  const runIntentCheck = useCallback(async () => {
    if (isCheckingRef.current || needsIntentPrompt) {
      return;
    }

    const readiness = shouldEvaluateIntent(evidenceRef.current);
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
      currentIntent: getActiveIntent(sessionSnapshot),
    };

    const localCandidate = sessionSnapshot.candidateIntent?.trim();
    if (
      localCandidate &&
      shouldApplyIntentChange(
        sessionSnapshot.intentConfidence,
        sessionSnapshot.currentIntent,
        localCandidate,
      )
    ) {
      const beforeIntent = sessionSnapshot.currentIntent;
      const reason = `Listening behaviour reached ${INTENT_CONFIDENCE_THRESHOLD} points for "${localCandidate}".`;
      const next = buildPromotedSessionState(
        sessionSnapshot,
        localCandidate,
        sessionSnapshot.intentConfidence,
        reason,
      );
      const entry: IntentHistoryEntry = {
        timestamp: Date.now(),
        intent: localCandidate,
        confidence: next.confidence,
        reason,
      };
      const nextHistory = [...intentHistoryRef.current, entry].slice(-20);
      intentHistoryRef.current = nextHistory;
      setIntentHistory(nextHistory);
      persistSession(next, nextHistory);
      resetEvidence();
      void showIntentPromotionFlow(beforeIntent, localCandidate, reason);
      isCheckingRef.current = false;
      setIsCheckingIntent(false);
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
        sessionSnapshot.currentIntent,
        profileArtists,
      );
      const apiRejected =
        result.validation_status === "rejected" || !validation.accepted;
      const apiCandidate = apiRejected
        ? sessionSnapshot.currentIntent
        : validation.intent;
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
      const mergedConfidence = mergeEvaluationConfidence(
        sessionSnapshot.intentConfidence,
        result.confidence,
        apiCandidate,
        sessionSnapshot.currentIntent,
      );
      const applyChange =
        !apiRejected &&
        shouldApplyIntentChange(
          mergedConfidence,
          sessionSnapshot.currentIntent,
          apiCandidate,
        ) &&
        hasIntentChanged(sessionSnapshot.currentIntent, apiCandidate);

      const nextIntent = applyChange ? apiCandidate : sessionSnapshot.currentIntent;
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
          null,
        rawNewIntent: result.raw_new_intent ?? result.new_intent,
      };
      const intentDecision = computeIntentDecision(
        sessionSnapshot.currentIntent,
        apiRejected ? sessionSnapshot.candidateIntent : apiCandidate,
        mergedConfidence,
        validationDebug.validationStatus,
      );

      setSession((current) => {
        const next: SessionState = {
          ...current,
          candidateIntent: apiRejected ? current.candidateIntent : apiCandidate,
          intentConfidence: mergedConfidence,
          confidence: result.confidence,
          aiReason: apiRejected
            ? `${result.reason} ${validationDebug.validationMessage ?? ""}`.trim()
            : applyChange
              ? result.reason
              : `${result.reason} (Confidence ${mergedConfidence}/${INTENT_CONFIDENCE_THRESHOLD} points — below switch threshold; keeping "${current.currentIntent}".)`,
          preferredArtists,
          preferredGenres,
          interactionsCollected: 0,
          explicitPreferenceSignals: 0,
          listeningShiftIntent: null,
          listeningShiftPlayCount: 0,
          intentDecision,
          lastIntentValidation: validationDebug,
        };

        if (applyChange) {
          next.currentIntent = nextIntent;
          next.candidateIntent = nextIntent;
          next.intentConfidence = Math.max(mergedConfidence, INTENT_CONFIDENCE_THRESHOLD);
          next.searchCandidate = null;
          next.recommendationVersion = current.recommendationVersion + 1;
        }

        let nextHistory = intentHistoryRef.current;
        if (applyChange) {
          const entry: IntentHistoryEntry = {
            timestamp: Date.now(),
            intent: nextIntent,
            confidence: result.confidence,
            reason: result.reason,
          };
          nextHistory = [...intentHistoryRef.current, entry].slice(-20);
          intentHistoryRef.current = nextHistory;
          setIntentHistory(nextHistory);
        }

        persistSession(next, nextHistory);
        return sessionRef.current;
      });

      resetEvidence();

      if (applyChange && hasIntentChanged(sessionSnapshot.currentIntent, nextIntent)) {
        setIntentChangeModal({
          before: sessionSnapshot.currentIntent,
          after: nextIntent,
          reason: result.reason,
          phase: "visible",
        });

        await new Promise((resolve) => {
          window.setTimeout(resolve, INTENT_MODAL_VISIBLE_MS);
        });

        if (playbackBridge.isPlaying) {
          playbackBridge.pendingIntentRefresh = {
            intent: nextIntent,
            preferredArtists,
          };
          setIntentChangeModal(null);
        } else {
          setIntentChangeModal((current) =>
            current ? { ...current, phase: "refreshing" } : null,
          );
          await refreshRecommendations(nextIntent);
          window.setTimeout(() => setIntentChangeModal(null), 400);
        }
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
  }, [needsIntentPrompt, persistSession, refreshRecommendations, resetEvidence, showIntentPromotionFlow]);

  const scheduleIntentEvaluation = useCallback(() => {
    if (needsIntentPrompt) {
      return;
    }

    const readiness = shouldEvaluateIntent(evidenceRef.current);
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
  }, [needsIntentPrompt, runIntentCheck]);

  const logAction = useCallback(
    (type: SessionActionType, value: string, options?: LogActionOptions) => {
      const action: SessionAction = { type, value, timestamp: Date.now() };
      let snapshot = sessionRef.current;
      const profileGenres = profileRef.current.genres;
      const isSearchLane = options?.queueSource === "search";
      const deferPlayConfidence =
        options?.deferConfidence === true && type === "PLAY";

      evidenceRef.current = {
        ...evidenceRef.current,
        listeningShiftIntent: snapshot.listeningShiftIntent,
        listeningShiftPlayCount: snapshot.listeningShiftPlayCount,
      };

      let candidateIntent = snapshot.candidateIntent || snapshot.currentIntent;
      let intentConfidence = snapshot.intentConfidence;
      let searchCandidate = snapshot.searchCandidate;
      let lastSearchQuery = snapshot.lastSearchQuery;
      let listeningShiftMessage: string | null = null;

      if (type === "SEARCH") {
        const query = value.trim();
        if (query) {
          lastSearchQuery = query;
          const mapped = inferSearchIntent(query, undefined, profileGenres);
          if (mapped && !intentsAlign(snapshot.currentIntent, mapped)) {
            searchCandidate = createOrMergeSearchCandidate(
              searchCandidate,
              mapped,
              query,
            );
          }
        }
      } else if (type === "SEARCH_ARTIST") {
        const query = value.trim();
        if (query) {
          const nextArtists = mergePreferredArtists(snapshot.preferredArtists, [query]);
          snapshot = { ...snapshot, preferredArtists: nextArtists };
        }
      }

      if (type === "SEARCH" || type === "SEARCH_ARTIST") {
        const next: SessionState = {
          ...snapshot,
          recentActions: [...snapshot.recentActions, action].slice(-MAX_RECENT_ACTIONS),
          searchCandidate,
          lastSearchQuery,
          candidateIntent:
            searchCandidate &&
            !intentsAlign(snapshot.currentIntent, searchCandidate.intent)
              ? searchCandidate.intent
              : snapshot.candidateIntent,
        };
        persistSession(next);
        return;
      }

      const searchPlaybackTypes = [
        "PLAY",
        "LISTENED_20S",
        "LIKE",
        "SKIP",
        "REPLAY",
        "DISLIKE",
      ] as const;
      const searchQuery = lastSearchQuery ?? searchCandidate?.query ?? value.trim();
      const reinforcesSession =
        options?.reinforceSession === true ||
        (isSearchLane &&
          !deferPlayConfidence &&
          searchPlaybackTypes.includes(type as (typeof searchPlaybackTypes)[number]) &&
          isSearchReinforcingSession(
            snapshot.currentIntent,
            searchQuery,
            options?.track,
            profileGenres,
          ));

      if (reinforcesSession && searchCandidate) {
        searchCandidate = null;
      }

      const searchLaneAction =
        isSearchLane &&
        searchPlaybackTypes.includes(type as (typeof searchPlaybackTypes)[number]);

      if (searchLaneAction && !deferPlayConfidence && !reinforcesSession) {
        const query = searchQuery;

        if (type === "PLAY" && options?.track) {
          const inferred = inferSearchIntent(query, options.track, profileGenres);
          if (inferred && !intentsAlign(snapshot.currentIntent, inferred)) {
            if (
              !searchCandidate ||
              !intentsAlign(searchCandidate.intent, inferred)
            ) {
              searchCandidate = createOrMergeSearchCandidate(
                searchCandidate,
                inferred,
                query,
                SEARCH_PLAY_CONFIDENCE_BOOST,
              );
            } else {
              searchCandidate = applySearchCandidateConfidence(
                searchCandidate,
                action,
                snapshot.currentIntent,
                { track: options.track, profileGenres },
              );
            }
          }
        } else if (
          searchCandidate &&
          ["LISTENED_20S", "LIKE", "SKIP", "REPLAY", "DISLIKE"].includes(type)
        ) {
          searchCandidate = applySearchCandidateConfidence(
            searchCandidate,
            action,
            snapshot.currentIntent,
            { track: options?.track, profileGenres },
          );
        }

        const intentDecision =
          searchCandidate &&
          !intentsAlign(snapshot.currentIntent, searchCandidate.intent)
            ? `Browsing “${searchCandidate.intent}” from search — your session stays on ${snapshot.currentIntent}`
            : snapshot.intentDecision;

        const next: SessionState = {
          ...snapshot,
          recentActions: [...snapshot.recentActions, action].slice(-MAX_RECENT_ACTIONS),
          searchCandidate,
          lastSearchQuery,
          candidateIntent:
            searchCandidate &&
            !intentsAlign(snapshot.currentIntent, searchCandidate.intent)
              ? searchCandidate.intent
              : snapshot.candidateIntent,
          intentDecision,
        };

        persistSession(next);
        if (
          searchCandidate &&
          !intentsAlign(snapshot.currentIntent, searchCandidate.intent) &&
          type === "LISTENED_20S"
        ) {
          showLearningNotice(
            `Search browse: ${searchCandidate.intent} — session mood unchanged`,
          );
        }

        if (["LIKE", "UNLIKE", "DISLIKE", "SKIP", "REPLAY"].includes(type)) {
          void runDiscoveryAdaptation(type, value);
        }
        return;
      }

      if (
        !isSearchLane &&
        !deferPlayConfidence &&
        (type === "PLAY" || type === "LISTENED_20S")
      ) {
        searchCandidate = decaySearchCandidateOnPrimaryActivity(searchCandidate);
      }

      if (
        !deferPlayConfidence &&
        options?.track &&
        (type === "PLAY" || type === "LISTENED_20S") &&
        intentsAlign(snapshot.currentIntent, candidateIntent) &&
        (reinforcesSession ||
          trackMatchesPredictedIntent(
            options.track,
            snapshot.currentIntent,
            profileGenres,
          ))
      ) {
        evidenceRef.current = {
          ...evidenceRef.current,
          listeningShiftIntent: null,
          listeningShiftPlayCount: 0,
        };
      } else if (
        !deferPlayConfidence &&
        options?.track &&
        (type === "PLAY" || type === "LISTENED_20S")
      ) {
        const shiftResult = applyListeningCandidateShift(
          evidenceRef.current,
          options.track,
          snapshot.currentIntent,
          candidateIntent,
          profileGenres,
        );
        evidenceRef.current = shiftResult.evidence;
        candidateIntent = shiftResult.candidateIntent;
        if (shiftResult.retargeted) {
          intentConfidence = Math.min(
            100,
            intentConfidence + shiftResult.confidenceBoost,
          );
          listeningShiftMessage = shiftResult.message;
        } else if (shiftResult.message && type === "PLAY") {
          listeningShiftMessage = shiftResult.message;
        }
      }

      if (!deferPlayConfidence) {
        evidenceRef.current = applyActionToEvidence(
          evidenceRef.current,
          action,
          snapshot.currentIntent,
        );
      }

      const confidenceBefore = intentConfidence;
      if (!deferPlayConfidence) {
        intentConfidence = applyActionConfidence(
          intentConfidence,
          action,
          candidateIntent,
          snapshot.currentIntent,
          {
            track: options?.track,
            profileGenres,
            reinforceSession: reinforcesSession,
          },
        );
      }

      const stableMood = intentsAlign(snapshot.currentIntent, candidateIntent);
      const onGenre20s =
        type === "LISTENED_20S" &&
        options?.track != null &&
        (reinforcesSession ||
          trackMatchesPredictedIntent(
            options.track,
            stableMood ? snapshot.currentIntent : candidateIntent,
            profileGenres,
          ));
      const offGenre20s =
        type === "LISTENED_20S" &&
        options?.track != null &&
        !onGenre20s &&
        (options.track.primary_genre != null ||
          (options.track.artists[0]?.genres[0] ?? null) != null);

      const intentDecision = offGenre20s
        ? `20s listen doesn't match ${stableMood ? snapshot.currentIntent : candidateIntent} genres — ${OFF_GENRE_SUSTAINED_LISTEN_DECAY} points removed`
        : onGenre20s && stableMood && intentConfidence > confidenceBefore
          ? `20s listen matches ${snapshot.currentIntent} — reinforcing your session`
          : listeningShiftMessage?.includes("candidate intent updated")
            ? listeningShiftMessage
            : computeIntentDecision(
                snapshot.currentIntent,
                candidateIntent,
                intentConfidence,
              );

      const next: SessionState = {
        ...snapshot,
        recentActions: [...snapshot.recentActions, action].slice(-MAX_RECENT_ACTIONS),
        candidateIntent,
        intentConfidence,
        searchCandidate,
        lastSearchQuery,
        intentDecision,
        interactionsCollected: evidenceRef.current.interactionsCollected,
        explicitPreferenceSignals: evidenceRef.current.explicitPreferenceSignals,
        listeningShiftIntent: evidenceRef.current.listeningShiftIntent,
        listeningShiftPlayCount: evidenceRef.current.listeningShiftPlayCount,
      };

      const promotedPrimary =
        !deferPlayConfidence &&
        shouldApplyIntentChange(
          intentConfidence,
          snapshot.currentIntent,
          candidateIntent,
        )
          ? candidateIntent
          : null;

      if (promotedPrimary) {
        const beforeIntent = snapshot.currentIntent;
        const reason = `Listening behaviour reached ${INTENT_CONFIDENCE_THRESHOLD} points for "${promotedPrimary}".`;
        const promotedNext = buildPromotedSessionState(
          next,
          promotedPrimary,
          intentConfidence,
          reason,
        );
        evidenceRef.current = createEvidenceSnapshot();
        const entry: IntentHistoryEntry = {
          timestamp: Date.now(),
          intent: promotedPrimary,
          confidence: promotedNext.confidence,
          reason,
        };
        const nextHistory = [...intentHistoryRef.current, entry].slice(-20);
        intentHistoryRef.current = nextHistory;
        setIntentHistory(nextHistory);
        persistSession(promotedNext, nextHistory);
        showLearningNotice(`Switching to ${promotedPrimary}`);
        void showIntentPromotionFlow(beforeIntent, promotedPrimary, reason);

        if (["LIKE", "UNLIKE", "DISLIKE", "SKIP", "REPLAY"].includes(type)) {
          void runDiscoveryAdaptation(type, value);
        }
        return;
      }

      persistSession(next);

      const learningMessage = deferPlayConfidence
        ? null
        : offGenre20s
          ? `Off-genre for ${stableMood ? snapshot.currentIntent : candidateIntent} — ${OFF_GENRE_SUSTAINED_LISTEN_DECAY} points removed`
          : onGenre20s && stableMood && type === "LISTENED_20S"
            ? `Matches ${snapshot.currentIntent} — session reinforced`
            : listeningShiftMessage ?? learningMessageForAction(type);
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
    const feedIntent = feedQuery?.trim();
    if (!feedIntent || recommendations.length === 0 || needsIntentPrompt) {
      return;
    }
    if (lastSyncedFeedQuery.current === feedIntent) {
      return;
    }
    const mappedIntent = mapSearchToCandidateIntent(feedIntent);
    if (!mappedIntent || intentsAlign(sessionRef.current.currentIntent, mappedIntent)) {
      lastSyncedFeedQuery.current = feedIntent;
      return;
    }

    persistSession({
      ...sessionRef.current,
      candidateIntent: mappedIntent,
      intentConfidence: Math.min(
        sessionRef.current.intentConfidence + 15,
        INTENT_CONFIDENCE_THRESHOLD - 1,
      ),
      intentDecision: "Waiting for more evidence",
      aiReason: `Recommendations were generated for "${mappedIntent}". Gathering evidence before changing intent.`,
    });
    lastSyncedFeedQuery.current = feedIntent;
  }, [feedQuery, needsIntentPrompt, persistSession, recommendations.length]);

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
