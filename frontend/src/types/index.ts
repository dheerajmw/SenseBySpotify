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
  primary_genre: string | null;
  duration_ms: number | null;
  preview_url: string | null;
  external_url: string | null;
  popularity: number | null;
}

/** Whether autoplay should chain through the queue or refresh from session intent. */
export type QueueSource = "intent" | "search";

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
  dislikedTrackIds: string[];
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
  fallback_reason?: string | null;
}

export interface Recommendation {
  track: Track;
  rank: number;
  reason: string;
  confidence: number;
}

export type FeedbackEventType = "like" | "unlike" | "dislike" | "undislike" | "skip" | "replay";

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
  | "LISTENED_20S"
  | "PREVIEW_COMPLETED"
  | "LIKE"
  | "UNLIKE"
  | "DISLIKE"
  | "SKIP"
  | "REPLAY"
  | "RECOMMENDATION_CLICKED"
  | "FEEDBACK";

export interface SessionAction {
  type: SessionActionType;
  value: string;
  timestamp: number;
}

/** @deprecated Search no longer drives session intent — kept for persisted action logs. */
export interface SearchCandidate {
  intent: string;
  confidence: number;
  query: string;
  lastActiveAt: string;
}

export interface IntentEvidenceEntry {
  timestamp: number;
  action: SessionActionType;
  value: string;
  delta: number;
  candidateIntent: string | null;
  candidateConfidenceAfter: number;
  note: string;
}

export interface ConfidenceTimelineEntry {
  timestamp: number;
  candidateIntent: string | null;
  candidateConfidence: number;
  reason: string;
}

export interface SessionState {
  sessionId: string;
  createdAt: string;
  lastActive: string;
  currentIntent: string | null;
  candidateIntent: string | null;
  intentConfidence: number;
  candidateConfidence: number;
  evidence: IntentEvidenceEntry[];
  confidenceTimeline: ConfidenceTimelineEntry[];
  lastSearchQuery: string | null;
  preferredArtists: string[];
  preferredGenres: string[];
  discoveryLevel: number;
  discoveryLabel: string;
  confidence: number;
  interactionsCollected: number;
  explicitPreferenceSignals: number;
  recentActions: SessionAction[];
  currentQueue: Track[];
  currentQueueIndex: number;
  lastUpdated: string;
  recommendationVersion: number;
  aiReason: string;
  intentDecision: string;
  lastPromotionReason: string | null;
  rejectedAiIntents: string[];
  lastIntentValidation: IntentValidationDebug | null;
  personalizedSecondSongUsed: boolean;
  /** User explicitly chose session intent this visit (via prompt or establishSessionIntent). */
  intentDeclaredThisSession: boolean;
}

export interface IntentValidationDebug {
  rawAiOutput: Record<string, unknown> | null;
  parsedOutput: Record<string, unknown> | null;
  validationStatus: "accepted" | "rejected" | "pending";
  validationMessage: string | null;
  rawNewIntent: string | null;
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
  preferred_genres: string[];
  confidence: number;
  reason: string;
  validation_status?: "accepted" | "rejected";
  validation_message?: string | null;
  raw_new_intent?: string | null;
}
