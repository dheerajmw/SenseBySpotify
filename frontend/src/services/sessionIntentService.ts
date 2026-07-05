import { apiRequest } from "../api/client";
import type {
  LocalUserProfile,
  ParseUserIntentResponse,
  Recommendation,
  SessionState,
  UpdateSessionIntentResponse,
} from "../types";
import { resolveTrackGenre } from "../utils/track";

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

function toSessionPayload(session: SessionState) {
  return {
    session_id: session.sessionId,
    current_intent: session.currentIntent,
    preferred_artists: session.preferredArtists,
    preferred_genres: session.preferredGenres,
    confidence: session.confidence,
    recent_actions: session.recentActions.map((action) => ({
      type: action.type,
      value: action.value,
      timestamp: action.timestamp,
    })),
    created_at: session.createdAt,
    last_active: session.lastActive,
    last_updated: session.lastUpdated,
    recommendation_version: session.recommendationVersion,
    queue_length: session.currentQueue.length,
  };
}

function toRecommendationSummary(recommendations: Recommendation[]) {
  return recommendations.slice(0, 8).map((item) => ({
    title: item.track.name,
    artist: item.track.artists.map((artist) => artist.name).join(", "),
    genre: resolveTrackGenre(item.track),
    rank: item.rank,
    reason: item.reason,
  }));
}

export async function parseUserDeclaredIntent(
  profile: LocalUserProfile,
  userInput: string,
): Promise<ParseUserIntentResponse> {
  return apiRequest<ParseUserIntentResponse>("/parse-user-intent", {
    method: "POST",
    body: JSON.stringify({
      user_input: userInput,
      profile: toProfilePayload(profile),
    }),
  });
}

export async function updateSessionIntent(
  profile: LocalUserProfile,
  session: SessionState,
  recommendations: Recommendation[],
): Promise<UpdateSessionIntentResponse> {
  return apiRequest<UpdateSessionIntentResponse>("/update-session-intent", {
    method: "POST",
    body: JSON.stringify({
      profile: toProfilePayload(profile),
      session: toSessionPayload(session),
      current_recommendations: toRecommendationSummary(recommendations),
    }),
  });
}
