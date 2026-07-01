export const APP_NAME = "Sense";
export const APP_BYLINE = "by Spotify";
export const APP_TAGLINE =
  "AI-powered music discovery that understands your listening intent.";
export const APP_TAGLINE_LEAD = "AI-powered music discovery";
export const APP_TAGLINE_DETAIL = "Understands your listening intent in real time.";
export const DISCOVER_LABEL = "AI Discovery";

export const GENRE_OPTIONS = [
  "Pop",
  "Bollywood",
  "Indie",
  "Rock",
  "Hip Hop",
  "Lo-fi",
  "Jazz",
  "EDM",
  "Classical",
  "Punjabi",
  "Acoustic",
] as const;

export const DISCOVERY_STYLE_OPTIONS = [
  { value: 20, label: "Mostly Familiar" },
  { value: 50, label: "Balanced Explorer" },
  { value: 80, label: "Adventurous Explorer" },
] as const;

export const INTENT_CHIPS = [
  "Workout",
  "Study",
  "Party",
  "Driving",
  "Sleep",
  "Focus",
  "Travel",
] as const;

export const PROFILE_STORAGE_KEY = "sense_profile";
export const FEED_STORAGE_KEY = "sense_feed";
export const HISTORY_STORAGE_KEY = "sense_recommendation_history";
export const SESSION_STORAGE_KEY = "sense_session";

export const SESSION_ACTIONS_THRESHOLD = 2;
export const SESSION_DEBOUNCE_MS = 10_000;
export const DEMO_MODE_STORAGE_KEY = "sense_demo_mode";
export const AUTOPLAY_STORAGE_KEY = "sense_autoplay";
