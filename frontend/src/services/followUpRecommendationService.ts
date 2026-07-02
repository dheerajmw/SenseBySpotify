import type { LocalUserProfile, Recommendation, Track } from "../types";
import { apiRequest } from "../api/client";

function toProfilePayload(profile: LocalUserProfile) {
  return {
    genres: profile.genres,
    favourite_artists: profile.favouriteArtists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      image_url: artist.image_url,
    })),
    novelty_tolerance: profile.noveltyTolerance,
    current_intent: profile.currentIntent,
    onboarding_completed: profile.onboardingCompleted,
    feedback_events: profile.feedbackEvents,
    liked_track_ids: profile.likedTrackIds,
    disliked_track_ids: profile.dislikedTrackIds,
  };
}

export interface RecommendFromLastTrackResponse {
  query: string;
  recommendation: Recommendation;
  candidate_count: number;
  used_ai: boolean;
}

export async function recommendFromLastTrack(
  profile: LocalUserProfile,
  lastTrack: Track,
  query: string,
): Promise<RecommendFromLastTrackResponse> {
  const artist = lastTrack.artists[0]?.name ?? "Unknown";
  return apiRequest<RecommendFromLastTrackResponse>("/recommend-from-last-track", {
    method: "POST",
    body: JSON.stringify({
      profile: toProfilePayload(profile),
      last_track: {
        id: lastTrack.id,
        name: lastTrack.name,
        artist,
      },
      query,
    }),
  });
}
