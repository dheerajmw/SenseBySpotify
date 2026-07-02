import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import { FEED_STORAGE_KEY, HISTORY_STORAGE_KEY } from "../constants/brand";
import { useProfile } from "./ProfileContext";
import type {
  GenerateRecommendationsResponse,
  Recommendation,
  Track,
} from "../types";

interface StoredFeed {
  query: string;
  recommendations: Recommendation[];
  candidateCount: number;
  usedAi: boolean;
}

interface RecommendationsContextValue {
  query: string | null;
  recommendations: Recommendation[];
  candidateCount: number;
  usedAi: boolean;
  hasFeed: boolean;
  history: Recommendation[];
  trending: Track[];
  setFeed: (response: GenerateRecommendationsResponse) => void;
  getRecommendation: (trackId: string) => Recommendation | undefined;
  removeRecommendation: (trackId: string) => void;
  clearFeed: () => void;
}

const RecommendationsContext = createContext<RecommendationsContextValue | null>(null);

function loadStoredFeed(): StoredFeed | null {
  try {
    const raw = sessionStorage.getItem(FEED_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredFeed;
  } catch {
    return null;
  }
}

function loadHistory(): Recommendation[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Recommendation[];
  } catch {
    return [];
  }
}

function persistFeed(feed: StoredFeed | null) {
  if (!feed) {
    sessionStorage.removeItem(FEED_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(feed));
}

function persistHistory(history: Recommendation[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 40)));
}

export function RecommendationsProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const stored = loadStoredFeed();
  const [query, setQuery] = useState<string | null>(stored?.query ?? null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    stored?.recommendations ?? [],
  );
  const [candidateCount, setCandidateCount] = useState(stored?.candidateCount ?? 0);
  const [usedAi, setUsedAi] = useState(stored?.usedAi ?? false);
  const [history, setHistory] = useState<Recommendation[]>(loadHistory);
  const [trending, setTrending] = useState<Track[]>([]);

  useEffect(() => {
    if (!profile.onboardingCompleted || profile.genres.length === 0) {
      return;
    }

    const genre = profile.genres[0];
    void api.searchTracks(`${genre} trending`, 6).then((response) => {
      setTrending(response.tracks);
    }).catch(() => {
      setTrending([]);
    });
  }, [profile.genres, profile.onboardingCompleted]);

  const setFeed = useCallback((response: GenerateRecommendationsResponse) => {
    setQuery(response.query);
    setRecommendations(response.recommendations);
    setCandidateCount(response.candidate_count);
    setUsedAi(response.used_ai);
    persistFeed({
      query: response.query,
      recommendations: response.recommendations,
      candidateCount: response.candidate_count,
      usedAi: response.used_ai,
    });
    setHistory((current) => {
      const merged = [...response.recommendations, ...current];
      const seen = new Set<string>();
      const deduped = merged.filter((item) => {
        if (seen.has(item.track.id)) {
          return false;
        }
        seen.add(item.track.id);
        return true;
      });
      persistHistory(deduped);
      return deduped;
    });
  }, []);

  const getRecommendation = useCallback(
    (trackId: string) => recommendations.find((item) => item.track.id === trackId),
    [recommendations],
  );

  const removeRecommendation = useCallback((trackId: string) => {
    setRecommendations((current) => {
      const next = current
        .filter((item) => item.track.id !== trackId)
        .map((item, index) => ({ ...item, rank: index + 1 }));
      if (next.length === current.length) {
        return current;
      }
      if (query) {
        persistFeed({
          query,
          recommendations: next,
          candidateCount,
          usedAi,
        });
      }
      return next;
    });
  }, [query, candidateCount, usedAi]);

  const clearFeed = useCallback(() => {
    setQuery(null);
    setRecommendations([]);
    setCandidateCount(0);
    setUsedAi(false);
    persistFeed(null);
  }, []);

  const value = useMemo(
    () => ({
      query,
      recommendations,
      candidateCount,
      usedAi,
      hasFeed: recommendations.length > 0,
      history,
      trending,
      setFeed,
      getRecommendation,
      removeRecommendation,
      clearFeed,
    }),
    [
      query,
      recommendations,
      candidateCount,
      usedAi,
      history,
      trending,
      setFeed,
      getRecommendation,
      removeRecommendation,
      clearFeed,
    ],
  );

  return (
    <RecommendationsContext.Provider value={value}>
      {children}
    </RecommendationsContext.Provider>
  );
}

export function useRecommendations(): RecommendationsContextValue {
  const context = useContext(RecommendationsContext);
  if (!context) {
    throw new Error("useRecommendations must be used within RecommendationsProvider");
  }
  return context;
}
