export interface Artist {
  id: string;
  name: string;
  genres: string[];
  image_url: string | null;
  popularity: number | null;
  external_url: string | null;
}

export interface Album {
  id: string;
  name: string;
  image_url: string | null;
  release_date: string | null;
}

export interface Track {
  id: string;
  name: string;
  artists: Artist[];
  album: Album | null;
  duration_ms: number | null;
  preview_url: string | null;
  external_url: string | null;
  popularity: number | null;
}

export interface FavouriteArtist {
  id: string;
  name: string;
  image_url: string | null;
}

export interface LocalUserProfile {
  genres: string[];
  favouriteArtists: FavouriteArtist[];
  noveltyTolerance: number;
  currentIntent: string;
  onboardingCompleted: boolean;
  feedbackEvents: FeedbackEvent[];
  likedTrackIds: string[];
}

export interface SearchResponse {
  query: string;
  tracks: Track[];
  artists: Artist[];
}

export interface ArtistSearchResponse {
  query: string;
  artists: Artist[];
}

export interface GenerateRecommendationsResponse {
  query: string;
  recommendations: Recommendation[];
  candidate_count: number;
  used_ai: boolean;
}

export interface Recommendation {
  track: Track;
  rank: number;
  reason: string;
  confidence: number;
}

export type FeedbackEventType = "like" | "skip" | "replay";

export type FeedbackChip =
  | "mood"
  | "lyrics"
  | "vocals"
  | "beat"
  | "energy"
  | "instrumental"
  | "similar_artist"
  | "surprise_me";

export interface FeedbackEvent {
  track_id: string | null;
  event_type: FeedbackEventType;
  chips: FeedbackChip[];
  query: string | null;
  timestamp: string | null;
}

export interface HealthResponse {
  status: string;
  environment: string;
  timestamp: string;
}

export interface ApiErrorBody {
  error: {
    message: string;
    status_code: number;
    details?: unknown;
  };
}

export type SessionActionType =
  | "SEARCH_TRACK"
  | "SEARCH_ARTIST"
  | "SEARCH"
  | "PLAY"
  | "LIKE"
  | "SKIP"
  | "REPLAY"
  | "RECOMMENDATION_CLICKED"
  | "FEEDBACK";

export interface SessionAction {
  type: SessionActionType;
  value: string;
  timestamp: number;
}

export interface SessionState {
  currentIntent: string;
  preferredArtists: string[];
  discoveryLevel: number;
  discoveryLabel: string;
  confidence: number;
  recentActions: SessionAction[];
  lastUpdated: string;
  recommendationVersion: number;
  aiReason: string;
}

export interface IntentHistoryEntry {
  timestamp: number;
  intent: string;
  confidence: number;
  reason: string;
}

export interface UpdateSessionIntentResponse {
  intent_changed: boolean;
  new_intent: string;
  preferred_artists: string[];
  confidence: number;
  reason: string;
}
