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

  const addFeedback = useCallback(
    (trackId: string, chips: FeedbackChip[], query: string | null = null) => {
      const event: FeedbackEvent = {
        track_id: trackId,
        event_type: "like",
        chips,
        query,
        timestamp: new Date().toISOString(),
      };
      setProfile((current) => {
        const next = {
          ...current,
          feedbackEvents: [...current.feedbackEvents, event],
        };
        persistProfile(next);
        return next;
      });
    },
    [],
  );

  const addLikedTrack = useCallback((trackId: string) => {
    setProfile((current) => {
      if (current.likedTrackIds.includes(trackId)) {
        return current;
      }
      const next = {
        ...current,
        likedTrackIds: [...current.likedTrackIds, trackId],
      };
      persistProfile(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      profile,
      isOnboarded: profile.onboardingCompleted,
      updateProfile,
      completeOnboarding,
      resetProfile,
      addFeedback,
      addLikedTrack,
    }),
    [
      profile,
      updateProfile,
      completeOnboarding,
      resetProfile,
      addFeedback,
      addLikedTrack,
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
