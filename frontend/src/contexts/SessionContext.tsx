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
} from "../constants/brand";
import { updateSessionIntent } from "../services/sessionIntentService";
import { intentsAlign } from "../utils/intent";
import {
  INTENT_CONFIDENCE_THRESHOLD,
  LISTENING_WINDOW_MS,
  accumulateConfidence,
  applyActionToEvidence,
  createEvidenceSnapshot,
  isSearchAction,
  mergeEvaluationConfidence,
  shouldApplyIntentChange,
  shouldEvaluateIntent,
  type IntentEvidenceSnapshot,
} from "../utils/intentEvidence";
import { computeDiscoveryAdjustment } from "../utils/discoveryAdaptation";
import {
  clampDiscoveryLevel,
  getDiscoveryProfile,
  normalizeNoveltyTolerance,
} from "../utils/discoveryLevel";
import { playbackBridge } from "../utils/playbackBridge";
import { learningMessageForAction } from "../utils/sessionDisplay";
import { useProfile } from "./ProfileContext";
import { useRecommendations } from "./RecommendationsContext";
import type {
  GenerateRecommendationsResponse,
  IntentHistoryEntry,
  SessionAction,
  SessionActionType,
  SessionState,
  UpdateSessionIntentResponse,
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
}

interface SessionContextValue {
  session: SessionState;
  intentHistory: IntentHistoryEntry[];
  toastMessage: string | null;
  learningNotice: string | null;
  intentChangeModal: IntentChangeModalState | null;
  discoveryChangeModal: DiscoveryChangeModalState | null;
  isCheckingIntent: boolean;
  isRegeneratingFeed: boolean;
  demoMode: boolean;
  logAction: (type: SessionActionType, value: string) => void;
  setCurrentIntent: (intent: string, options?: SetCurrentIntentOptions) => void;
  setDiscoveryLevel: (
    level: number,
    options?: { regenerate?: boolean; manual?: boolean },
  ) => Promise<void>;
  setDemoMode: (enabled: boolean) => void;
  refreshRecommendations: (intent?: string) => Promise<GenerateRecommendationsResponse | null>;
  dismissToast: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface StoredSession {
  session: SessionState;
  intentHistory: IntentHistoryEntry[];
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

function createInitialSession(intent: string, discoveryLevel = 50): SessionState {
  const discoveryProfile = getDiscoveryProfile(discoveryLevel);
  const trimmedIntent = intent.trim();
  return {
    currentIntent: trimmedIntent,
    candidateIntent: trimmedIntent,
    intentConfidence: trimmedIntent ? 100 : 0,
    preferredArtists: [],
    discoveryLevel,
    discoveryLabel: discoveryProfile.label,
    confidence: trimmedIntent ? 0.75 : 0,
    interactionsCollected: 0,
    explicitPreferenceSignals: 0,
    recentActions: [],
    lastUpdated: new Date().toISOString(),
    recommendationVersion: 1,
    aiReason: trimmedIntent ? "Initial intent from onboarding profile." : "",
  };
}

function loadDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function resolveIntentUpdate(
  currentIntent: string,
  result: UpdateSessionIntentResponse,
): { candidateIntent: string; apiSuggestsChange: boolean } {
  const candidate = result.new_intent.trim() || currentIntent;
  const apiSuggestsChange =
    result.intent_changed || !intentsAlign(currentIntent, candidate);
  return { candidateIntent: candidate, apiSuggestsChange };
}

function normalizeSessionState(
  session: SessionState,
  fallbackIntent: string,
  discoveryLevel: number,
): SessionState {
  const base = createInitialSession(fallbackIntent, discoveryLevel);
  const currentIntent = session.currentIntent?.trim() || fallbackIntent.trim();
  const candidateIntent = session.candidateIntent?.trim() || currentIntent;
  return {
    ...base,
    ...session,
    currentIntent,
    candidateIntent,
    intentConfidence:
      typeof session.intentConfidence === "number"
        ? session.intentConfidence
        : currentIntent
          ? 100
          : 0,
    interactionsCollected: session.interactionsCollected ?? 0,
    explicitPreferenceSignals: session.explicitPreferenceSignals ?? 0,
  };
}

function loadSession(initialIntent: string, discoveryLevel: number): StoredSession {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      const session = createInitialSession(initialIntent, discoveryLevel);
      return {
        session,
        intentHistory: initialIntent
          ? [
              {
                timestamp: Date.now(),
                intent: initialIntent,
                confidence: 0.75,
                reason: "User selected initial intent during onboarding.",
              },
            ]
          : [],
      };
    }
    const parsed = JSON.parse(raw) as StoredSession;
    const storedSession = parsed.session ?? createInitialSession(initialIntent, discoveryLevel);
    const resolvedIntent =
      storedSession.currentIntent?.trim() || initialIntent.trim();
    const resolvedDiscovery = clampDiscoveryLevel(
      storedSession.discoveryLevel ?? discoveryLevel,
    );
    const discoveryProfile = getDiscoveryProfile(resolvedDiscovery);

    return {
      session: normalizeSessionState(
        {
          ...createInitialSession(initialIntent, resolvedDiscovery),
          ...storedSession,
          currentIntent: resolvedIntent,
          preferredArtists: storedSession.preferredArtists ?? [],
          discoveryLevel: resolvedDiscovery,
          discoveryLabel: storedSession.discoveryLabel ?? discoveryProfile.label,
        },
        initialIntent,
        resolvedDiscovery,
      ),
      intentHistory: parsed.intentHistory ?? [],
    };
  } catch {
    return {
      session: createInitialSession(initialIntent, discoveryLevel),
      intentHistory: [],
    };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useProfile();
  const { recommendations, setFeed, query: feedQuery } = useRecommendations();
  const initialDiscovery = normalizeNoveltyTolerance(profile.noveltyTolerance);
  const initial = loadSession(profile.currentIntent, initialDiscovery);
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

  sessionRef.current = session;
  recommendationsRef.current = recommendations;
  profileRef.current = profile;
  intentHistoryRef.current = intentHistory;
  demoModeRef.current = demoMode;

  const saveState = useCallback((nextSession: SessionState, history: IntentHistoryEntry[]) => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ session: nextSession, intentHistory: history }),
    );
  }, []);

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

  const applyIntentUpdate = useCallback(
    (
      intent: string,
      reason: string,
      options?: { bumpVersion?: boolean; addHistory?: boolean },
    ): boolean => {
      const trimmed = intent.trim();
      if (!trimmed || intentsAlign(sessionRef.current.currentIntent, trimmed)) {
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
        confidence: Math.max(sessionRef.current.confidence, 0.8),
        aiReason: reason,
        lastUpdated: new Date().toISOString(),
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

      sessionRef.current = next;
      setSession(next);
      saveState(next, nextHistory);
      updateProfile({ currentIntent: trimmed });
      return true;
    },
    [saveState, updateProfile],
  );

  const isAdaptingDiscoveryRef = useRef(false);

  const refreshRecommendations = useCallback(
    async (intent?: string) => {
      const activeIntent =
        intent?.trim() ||
        sessionRef.current.currentIntent ||
        profileRef.current.currentIntent;
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
        updateProfile({
          currentIntent: activeIntent,
          noveltyTolerance: sessionRef.current.discoveryLevel,
        });
        const response = await api.generateRecommendations(activeProfile, activeIntent);
        setFeed(response);
        lastSyncedFeedQuery.current = response.query;
        return response;
      } finally {
        setIsRegeneratingFeed(false);
      }
    },
    [setFeed, updateProfile],
  );

  const applyDiscoveryLevel = useCallback(
    (level: number, options?: { bumpVersion?: boolean }) => {
      const nextLevel = clampDiscoveryLevel(level);
      const discoveryProfile = getDiscoveryProfile(nextLevel);
      const next: SessionState = {
        ...sessionRef.current,
        discoveryLevel: nextLevel,
        discoveryLabel: discoveryProfile.label,
        lastUpdated: new Date().toISOString(),
        recommendationVersion: options?.bumpVersion
          ? sessionRef.current.recommendationVersion + 1
          : sessionRef.current.recommendationVersion,
      };
      sessionRef.current = next;
      setSession(next);
      saveState(next, intentHistoryRef.current);
      updateProfile({ noveltyTolerance: nextLevel });
      return { nextLevel, discoveryProfile };
    },
    [saveState, updateProfile],
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
      const significant =
        beforeProfile.label !== afterProfile.label ||
        Math.abs(nextLevel - currentLevel) >= 5;

      applyDiscoveryLevel(nextLevel, { bumpVersion: significant });

      if (!significant) {
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
      applyIntentUpdate(
        intent,
        options?.reason ?? "Intent updated by user activity.",
        { bumpVersion: options?.bumpVersion ?? false },
      );
    },
    [applyIntentUpdate],
  );

  const resetEvidence = useCallback(() => {
    evidenceRef.current = createEvidenceSnapshot();
    if (listeningTimer.current) {
      window.clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
  }, []);

  const runIntentCheck = useCallback(async () => {
    if (isCheckingRef.current) {
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
      currentIntent: sessionSnapshot.currentIntent,
    };

    try {
      const result = await updateSessionIntent(
        profileSnapshot,
        sessionSnapshot,
        recommendationsRef.current,
      );

      const now = new Date().toISOString();
      const { candidateIntent: apiCandidate } = resolveIntentUpdate(
        sessionSnapshot.currentIntent,
        result,
      );
      const preferredArtists = mergePreferredArtists(
        sessionSnapshot.preferredArtists,
        result.preferred_artists ?? [],
      );
      const mergedConfidence = mergeEvaluationConfidence(
        sessionSnapshot.intentConfidence,
        result.confidence,
        apiCandidate,
        sessionSnapshot.currentIntent,
      );
      const applyChange = shouldApplyIntentChange(
        mergedConfidence,
        sessionSnapshot.currentIntent,
        apiCandidate,
      );

      const nextIntent = applyChange ? apiCandidate : sessionSnapshot.currentIntent;

      setSession((current) => {
        const next: SessionState = {
          ...current,
          candidateIntent: apiCandidate,
          intentConfidence: mergedConfidence,
          confidence: result.confidence,
          aiReason: applyChange
            ? result.reason
            : `${result.reason} (Confidence ${mergedConfidence}% — below ${INTENT_CONFIDENCE_THRESHOLD}% threshold; keeping "${current.currentIntent}".)`,
          preferredArtists,
          interactionsCollected: 0,
          explicitPreferenceSignals: 0,
          lastUpdated: now,
        };

        if (applyChange) {
          next.currentIntent = nextIntent;
          next.candidateIntent = nextIntent;
          next.intentConfidence = Math.max(mergedConfidence, INTENT_CONFIDENCE_THRESHOLD);
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

        sessionRef.current = next;
        saveState(next, nextHistory);
        return next;
      });

      resetEvidence();

      if (applyChange) {
        updateProfile({ currentIntent: nextIntent });

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
  }, [refreshRecommendations, resetEvidence, saveState, updateProfile]);

  const scheduleIntentEvaluation = useCallback(() => {
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
  }, [runIntentCheck]);

  const logAction = useCallback(
    (type: SessionActionType, value: string) => {
      const action: SessionAction = { type, value, timestamp: Date.now() };
      const snapshot = sessionRef.current;

      evidenceRef.current = applyActionToEvidence(
        evidenceRef.current,
        action,
        snapshot.currentIntent,
      );

      let candidateIntent = snapshot.candidateIntent || snapshot.currentIntent;
      if (isSearchAction(type)) {
        const query = value.trim();
        if (query && !intentsAlign(snapshot.currentIntent, query)) {
          candidateIntent = query;
        }
      }

      const intentConfidence = accumulateConfidence(
        snapshot.intentConfidence,
        action,
        candidateIntent,
        snapshot.currentIntent,
      );

      const next: SessionState = {
        ...snapshot,
        recentActions: [...snapshot.recentActions, action].slice(-MAX_RECENT_ACTIONS),
        candidateIntent,
        intentConfidence,
        interactionsCollected: evidenceRef.current.interactionsCollected,
        explicitPreferenceSignals: evidenceRef.current.explicitPreferenceSignals,
        lastUpdated: new Date().toISOString(),
      };

      sessionRef.current = next;
      setSession(next);
      saveState(next, intentHistoryRef.current);

      const learningMessage = learningMessageForAction(type);
      if (learningMessage) {
        showLearningNotice(learningMessage);
      }

      if (type === "PLAY" && evidenceRef.current.listeningWindowStart !== null) {
        if (!listeningTimer.current) {
          listeningTimer.current = window.setTimeout(() => {
            listeningTimer.current = null;
            void runIntentCheck();
          }, LISTENING_WINDOW_MS);
        }
      }

      scheduleIntentEvaluation();

      if (["LIKE", "SKIP", "REPLAY"].includes(type)) {
        void runDiscoveryAdaptation(type, value);
      }
    },
    [
      runDiscoveryAdaptation,
      runIntentCheck,
      saveState,
      scheduleIntentEvaluation,
      showLearningNotice,
    ],
  );

  useEffect(() => {
    const feedIntent = feedQuery?.trim();
    if (!feedIntent || recommendations.length === 0) {
      return;
    }
    if (lastSyncedFeedQuery.current === feedIntent) {
      return;
    }
    if (intentsAlign(sessionRef.current.currentIntent, feedIntent)) {
      lastSyncedFeedQuery.current = feedIntent;
      return;
    }

    const next: SessionState = {
      ...sessionRef.current,
      candidateIntent: feedIntent,
      intentConfidence: Math.min(
        sessionRef.current.intentConfidence + 15,
        INTENT_CONFIDENCE_THRESHOLD - 1,
      ),
      aiReason: `Recommendations were generated for "${feedIntent}". Gathering evidence before changing intent.`,
      lastUpdated: new Date().toISOString(),
    };
    sessionRef.current = next;
    setSession(next);
    saveState(next, intentHistoryRef.current);
    lastSyncedFeedQuery.current = feedIntent;
  }, [feedQuery, recommendations.length, saveState]);

  useEffect(() => {
    const profileIntent = profile.currentIntent.trim();
    if (!profile.onboardingCompleted || !profileIntent) {
      return;
    }
    if (intentsAlign(sessionRef.current.currentIntent, profileIntent)) {
      return;
    }
    if (feedQuery?.trim() && !intentsAlign(feedQuery, profileIntent)) {
      return;
    }

    applyIntentUpdate(
      profileIntent,
      "Synced session intent from profile.",
      { bumpVersion: false, addHistory: false },
    );
  }, [
    applyIntentUpdate,
    feedQuery,
    profile.currentIntent,
    profile.onboardingCompleted,
  ]);

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

  const value = useMemo(
    () => ({
      session,
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
      setDiscoveryLevel,
      setDemoMode,
      refreshRecommendations,
      dismissToast,
    }),
    [
      session,
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
      setDiscoveryLevel,
      setDemoMode,
      refreshRecommendations,
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
