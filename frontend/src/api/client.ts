import type {
  ArtistSearchResponse,
  FeedbackEvent,
  GenerateRecommendationsResponse,
  HealthResponse,
  LocalUserProfile,
  SearchResponse,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiClientError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiClientError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

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

export const api = {
  health(): Promise<HealthResponse> {
    return apiRequest<HealthResponse>("/health");
  },

  searchArtists(query: string, limit = 10): Promise<ArtistSearchResponse> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return apiRequest<ArtistSearchResponse>(`/search/artists?${params}`);
  },

  searchTracks(query: string, limit = 15): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return apiRequest<SearchResponse>(`/search?${params}`);
  },

  generateRecommendations(
    profile: LocalUserProfile,
    query: string,
    limit = 10,
  ): Promise<GenerateRecommendationsResponse> {
    return apiRequest<GenerateRecommendationsResponse>(
      "/generate-recommendations",
      {
        method: "POST",
        body: JSON.stringify({
          profile: toProfilePayload(profile),
          query,
          limit,
        }),
      },
    );
  },
};

export type { FeedbackEvent };
