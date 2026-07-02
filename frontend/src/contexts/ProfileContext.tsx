import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PROFILE_STORAGE_KEY } from "../constants/brand";
import { normalizeNoveltyTolerance } from "../utils/discoveryLevel";
import type { FeedbackChip, FeedbackEvent, LocalUserProfile } from "../types";

const DEFAULT_PROFILE: LocalUserProfile = {
  genres: [],
  favouriteArtists: [],
  noveltyTolerance: 50,
  currentIntent: "",
  onboardingCompleted: false,
  feedbackEvents: [],
  likedTrackIds: [],
  dislikedTrackIds: [],
};

interface ProfileContextValue {
  profile: LocalUserProfile;
  isOnboarded: boolean;
  updateProfile: (patch: Partial<LocalUserProfile>) => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
  addFeedback: (
    trackId: string,
    chips: FeedbackChip[],
    query?: string | null,
  ) => void;
  addLikedTrack: (trackId: string) => void;
  removeLikedTrack: (trackId: string) => void;
  addDislikedTrack: (trackId: string) => void;
  removeDislikedTrack: (trackId: string) => void;
  addSkipFeedback: (trackId: string, query?: string | null) => void;
  appendFeedbackEvent: (event: FeedbackEvent) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function loadProfile(): LocalUserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PROFILE;
    }
    const parsed = JSON.parse(raw) as LocalUserProfile;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      noveltyTolerance: normalizeNoveltyTolerance(parsed.noveltyTolerance),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function persistProfile(profile: LocalUserProfile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LocalUserProfile>(loadProfile);

  const updateProfile = useCallback((patch: Partial<LocalUserProfile>) => {
    setProfile((current) => {
      const next = { ...current, ...patch };
      persistProfile(next);
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    setProfile((current) => {
      const next = { ...current, onboardingCompleted: true };
      persistProfile(next);
      return next;
    });
  }, []);

  const resetProfile = useCallback(() => {
    persistProfile(DEFAULT_PROFILE);
    setProfile(DEFAULT_PROFILE);
  }, []);

  const appendFeedbackEvent = useCallback((event: FeedbackEvent) => {
    setProfile((current) => {
      const next = {
        ...current,
        feedbackEvents: [...current.feedbackEvents, event],
      };
      persistProfile(next);
      return next;
    });
  }, []);

  const addFeedback = useCallback(
    (trackId: string, chips: FeedbackChip[], query: string | null = null) => {
      appendFeedbackEvent({
        track_id: trackId,
        event_type: "like",
        chips,
        query,
        timestamp: new Date().toISOString(),
      });
    },
    [appendFeedbackEvent],
  );

  const addLikedTrack = useCallback((trackId: string) => {
    setProfile((current) => {
      if (current.likedTrackIds.includes(trackId)) {
        return current;
      }
      const next = {
        ...current,
        likedTrackIds: [...current.likedTrackIds, trackId],
        dislikedTrackIds: current.dislikedTrackIds.filter((id) => id !== trackId),
      };
      persistProfile(next);
      return next;
    });
  }, []);

  const removeLikedTrack = useCallback((trackId: string) => {
    setProfile((current) => {
      if (!current.likedTrackIds.includes(trackId)) {
        return current;
      }
      const next = {
        ...current,
        likedTrackIds: current.likedTrackIds.filter((id) => id !== trackId),
      };
      persistProfile(next);
      return next;
    });
  }, []);

  const addDislikedTrack = useCallback((trackId: string) => {
    setProfile((current) => {
      if (current.dislikedTrackIds.includes(trackId)) {
        return current;
      }
      const next = {
        ...current,
        dislikedTrackIds: [...current.dislikedTrackIds, trackId],
        likedTrackIds: current.likedTrackIds.filter((id) => id !== trackId),
      };
      persistProfile(next);
      return next;
    });
  }, []);

  const removeDislikedTrack = useCallback((trackId: string) => {
    setProfile((current) => {
      if (!current.dislikedTrackIds.includes(trackId)) {
        return current;
      }
      const next = {
        ...current,
        dislikedTrackIds: current.dislikedTrackIds.filter((id) => id !== trackId),
      };
      persistProfile(next);
      return next;
    });
  }, []);

  const addSkipFeedback = useCallback(
    (trackId: string, query: string | null = null) => {
      appendFeedbackEvent({
        track_id: trackId,
        event_type: "skip",
        chips: [],
        query,
        timestamp: new Date().toISOString(),
      });
    },
    [appendFeedbackEvent],
  );

  const value = useMemo(
    () => ({
      profile,
      isOnboarded: profile.onboardingCompleted,
      updateProfile,
      completeOnboarding,
      resetProfile,
      addFeedback,
      addLikedTrack,
      removeLikedTrack,
      addDislikedTrack,
      removeDislikedTrack,
      addSkipFeedback,
      appendFeedbackEvent,
    }),
    [
      profile,
      updateProfile,
      completeOnboarding,
      resetProfile,
      addFeedback,
      addLikedTrack,
      removeLikedTrack,
      addDislikedTrack,
      removeDislikedTrack,
      addSkipFeedback,
      appendFeedbackEvent,
    ],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}
