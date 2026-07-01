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
  SESSION_ACTIONS_THRESHOLD,
  SESSION_DEBOUNCE_MS,
  SESSION_STORAGE_KEY,
} from "../constants/brand";
import { updateSessionIntent } from "../services/sessionIntentService";
import { intentsAlign } from "../utils/intent";
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
  return {
    currentIntent: intent,
    preferredArtists: [],
    discoveryLevel,
    discoveryLabel: discoveryProfile.label,
    confidence: intent ? 0.75 : 0,
    recentActions: [],
    lastUpdated: new Date().toISOString(),
    recommendationVersion: 1,
    aiReason: intent ? "Initial intent from onboarding profile." : "",
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
): { changed: boolean; nextIntent: string } {
  const candidate = result.new_intent.trim();
  if (!candidate) {
    return { changed: false, nextIntent: currentIntent };
  }

  if (result.intent_changed || !intentsAlign(currentIntent, candidate)) {
    return { changed: true, nextIntent: candidate };
  }

  return { changed: false, nextIntent: currentIntent };
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
      session: {
        ...createInitialSession(initialIntent, resolvedDiscovery),
        ...storedSession,
        currentIntent: resolvedIntent,
        preferredArtists: storedSession.preferredArtists ?? [],
        discoveryLevel: resolvedDiscovery,
        discoveryLabel: storedSession.discoveryLabel ?? discoveryProfile.label,
      },
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

  const actionsSinceCheck = useRef(0);
  const debounceTimer = useRef<number | null>(null);
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
        confidence: Math.max(sessionRef.current.confidence, 0.8),
        aiReason: reason,
        lastUpdated: new Date().toISOString(),
        recommendationVersion: bumpVersion
          ? sessionRef.current.recommendationVersion + 1
          : sessionRef.current.recommendationVersion,
      };

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

  const runIntentCheck = useCallback(async () => {
    if (isCheckingRef.current || actionsSinceCheck.current === 0) {
      return;
    }

    isCheckingRef.current = true;
    setIsCheckingIntent(true);
    actionsSinceCheck.current = 0;
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
      let shouldRegenerate = false;
      let nextIntent = sessionSnapshot.currentIntent;
      const { changed, nextIntent: resolvedIntent } = resolveIntentUpdate(
        sessionSnapshot.currentIntent,
        result,
      );
      nextIntent = resolvedIntent;
      const preferredArtists = mergePreferredArtists(
        sessionSnapshot.preferredArtists,
        result.preferred_artists ?? [],
      );

      setSession((current) => {
        const next: SessionState = {
          ...current,
          confidence: result.confidence,
          aiReason: result.reason,
          preferredArtists,
          lastUpdated: now,
        };

        if (changed) {
          next.currentIntent = nextIntent;
          next.recommendationVersion = current.recommendationVersion + 1;
          shouldRegenerate = true;
        }

        const entry: IntentHistoryEntry = {
          timestamp: Date.now(),
          intent: changed ? nextIntent : current.currentIntent,
          confidence: result.confidence,
          reason: result.reason,
        };
        const nextHistory = [...intentHistoryRef.current, entry].slice(-20);
        intentHistoryRef.current = nextHistory;
        setIntentHistory(nextHistory);
        sessionRef.current = next;
        saveState(next, nextHistory);
        return next;
      });

      if (changed) {
        updateProfile({ currentIntent: nextIntent });
      }

      if (shouldRegenerate) {
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
  }, [refreshRecommendations, saveState, updateProfile]);

  const scheduleIntentCheck = useCallback(() => {
    if (demoModeRef.current) {
      actionsSinceCheck.current = SESSION_ACTIONS_THRESHOLD;
      void runIntentCheck();
      return;
    }

    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
    }

    if (actionsSinceCheck.current >= SESSION_ACTIONS_THRESHOLD) {
      void runIntentCheck();
      return;
    }

    debounceTimer.current = window.setTimeout(() => {
      void runIntentCheck();
    }, SESSION_DEBOUNCE_MS);
  }, [runIntentCheck]);

  const logAction = useCallback(
    (type: SessionActionType, value: string) => {
      const action: SessionAction = { type, value, timestamp: Date.now() };
      const next: SessionState = {
        ...sessionRef.current,
        recentActions: [...sessionRef.current.recentActions, action].slice(-MAX_RECENT_ACTIONS),
        lastUpdated: new Date().toISOString(),
      };

      sessionRef.current = next;
      setSession(next);
      saveState(next, intentHistoryRef.current);

      const learningMessage = learningMessageForAction(type);
      if (learningMessage) {
        showLearningNotice(learningMessage);
      }

      actionsSinceCheck.current += 1;
      scheduleIntentCheck();

      if (["LIKE", "SKIP", "REPLAY"].includes(type)) {
        void runDiscoveryAdaptation(type, value);
      }
    },
    [runDiscoveryAdaptation, saveState, scheduleIntentCheck, showLearningNotice],
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

    const updated = applyIntentUpdate(
      feedIntent,
      `Recommendations were generated for "${feedIntent}".`,
      { bumpVersion: false },
    );
    if (updated) {
      lastSyncedFeedQuery.current = feedIntent;
    }
  }, [applyIntentUpdate, feedQuery, recommendations.length]);

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
