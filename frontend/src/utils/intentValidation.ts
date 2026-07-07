import { GENERAL_LISTENING_INTENT } from "../constants/brand";

export const VALID_INTENTS = [
  "Focus",
  "Workout",
  "Driving",
  "Relaxing",
  "Party",
  "Happy",
  "Melancholic",
  "Romantic",
  "Morning",
  "Late Night",
] as const;

export type ValidIntent = (typeof VALID_INTENTS)[number];

const VALID_INTENT_LOOKUP = new Map(
  VALID_INTENTS.map((intent) => [intent.toLowerCase(), intent]),
);

const INTENT_ALIASES: Record<string, ValidIntent> = {
  study: "Focus",
  coding: "Focus",
  reading: "Focus",
  code: "Focus",
  read: "Focus",
  calm: "Relaxing",
  sleep: "Relaxing",
  meditation: "Relaxing",
  "high energy": "Party",
  festival: "Party",
  "road trip": "Driving",
  travel: "Driving",
  "rainy evening": "Late Night",
  fun: "Happy",
  upbeat: "Happy",
  joyful: "Happy",
  cheerful: "Happy",
  playful: "Happy",
  uplifting: "Happy",
  good: "Happy",
  great: "Happy",
  awesome: "Happy",
  amazing: "Happy",
  positive: "Happy",
  sunny: "Happy",
  bright: "Happy",
  "feel good": "Happy",
  cool: "Relaxing",
  chill: "Relaxing",
  chilled: "Relaxing",
  chillout: "Relaxing",
  mellow: "Relaxing",
  smooth: "Relaxing",
  relaxed: "Relaxing",
  peaceful: "Relaxing",
  cozy: "Relaxing",
  cosy: "Relaxing",
  "laid back": "Relaxing",
  "laid-back": "Relaxing",
  easygoing: "Relaxing",
  "easy going": "Relaxing",
  vibe: "Relaxing",
  vibey: "Relaxing",
  vibes: "Relaxing",
  casual: "Relaxing",
  soft: "Relaxing",
  gentle: "Relaxing",
  tranquil: "Relaxing",
  serene: "Relaxing",
  lazy: "Relaxing",
  excited: "Party",
  energizing: "Party",
  energetic: "Party",
  hype: "Party",
  hyped: "Party",
  pumped: "Party",
  intense: "Party",
  wild: "Party",
  lit: "Party",
  banger: "Party",
  partying: "Party",
  dance: "Party",
  dancing: "Party",
  club: "Party",
  clubbing: "Party",
  nightclub: "Party",
  sad: "Melancholic",
  emotional: "Melancholic",
  moody: "Melancholic",
  blue: "Melancholic",
  somber: "Melancholic",
  sombre: "Melancholic",
  gloomy: "Melancholic",
  nostalgic: "Melancholic",
  heartbreak: "Melancholic",
  heartbroken: "Melancholic",
  melancholy: "Melancholic",
  depressing: "Melancholic",
  dark: "Late Night",
  sexy: "Romantic",
  sensual: "Romantic",
  intimate: "Romantic",
  love: "Romantic",
  loving: "Romantic",
  "date night": "Romantic",
  powerful: "Romantic",
  productive: "Focus",
  concentration: "Focus",
  "deep work": "Focus",
  "deep-work": "Focus",
  work: "Focus",
  working: "Focus",
  programming: "Focus",
  developer: "Focus",
  dev: "Focus",
  books: "Focus",
  book: "Focus",
  poetry: "Focus",
  poem: "Focus",
  nazm: "Focus",
  sleepy: "Relaxing",
  drowsy: "Relaxing",
  bedtime: "Relaxing",
  nap: "Relaxing",
  napping: "Relaxing",
  zen: "Relaxing",
  mindful: "Relaxing",
  mindfulness: "Relaxing",
  yoga: "Relaxing",
  sufi: "Relaxing",
  exercise: "Workout",
  fitness: "Workout",
  training: "Workout",
  gym: "Workout",
  commute: "Driving",
  commuting: "Driving",
  roadtrip: "Driving",
  drive: "Driving",
  nighttime: "Late Night",
  "night time": "Late Night",
  "after hours": "Late Night",
  night: "Late Night",
  sunrise: "Morning",
  "wake up": "Morning",
  "rainy day": "Late Night",
  rain: "Late Night",
  rainy: "Late Night",
  concert: "Party",
  concerts: "Party",
  rave: "Party",
  ghazal: "Melancholic",
  shayari: "Melancholic",
  urdu: "Melancholic",
  romance: "Romantic",
};

const GENRE_LABELS = new Set(
  [
    "pop",
    "bollywood",
    "indie",
    "rock",
    "hip hop",
    "lo-fi",
    "lofi",
    "jazz",
    "edm",
    "classical",
    "punjabi",
    "acoustic",
    "alternative",
    "metal",
    "country",
    "r&b",
    "soul",
    "blues",
    "folk",
    "reggae",
    "latin",
    "k-pop",
    "techno",
    "house",
    "trap",
  ],
);

const DISCOVERY_LABELS = new Set(
  [
    "discovery",
    "balanced explorer",
    "mostly familiar",
    "adventurous explorer",
    "discovery enthusiast",
    "new artist",
    "new discovery",
    "new discoveries",
    "familiar music",
    "balanced",
    "adventurous",
  ],
);

const KNOWN_ARTISTS = new Set(
  [
    "coldplay",
    "taylor swift",
    "arijit singh",
    "prateek kuhad",
    "imagine dragons",
    "eminem",
    "ed sheeran",
    "the weeknd",
    "drake",
    "billie eilish",
    "talha anjum",
  ],
);

const MOOD_KEYWORD_TO_INTENT: Record<string, ValidIntent> = {
  workout: "Workout",
  gym: "Workout",
  focus: "Focus",
  study: "Focus",
  coding: "Focus",
  code: "Focus",
  read: "Focus",
  reading: "Focus",
  driving: "Driving",
  drive: "Driving",
  "road trip": "Driving",
  travel: "Driving",
  relaxing: "Relaxing",
  relax: "Relaxing",
  chill: "Relaxing",
  calm: "Relaxing",
  party: "Party",
  festival: "Party",
  romance: "Romantic",
  romantic: "Romantic",
  rain: "Late Night",
  rainy: "Late Night",
  "late night": "Late Night",
  night: "Late Night",
  sleep: "Relaxing",
  morning: "Morning",
  energy: "Party",
  energetic: "Party",
  happy: "Happy",
  fun: "Happy",
  soft: "Relaxing",
  sad: "Melancholic",
  melanchol: "Melancholic",
  meditat: "Relaxing",
  poetry: "Focus",
  poem: "Focus",
  nazm: "Focus",
  ghazal: "Melancholic",
  shayari: "Melancholic",
  urdu: "Melancholic",
  sufi: "Relaxing",
};

const DESCRIPTIVE_PHRASE_TO_INTENT: Array<[string, ValidIntent]> = [
  ["high notes", "Romantic"],
  ["high note", "Romantic"],
  ["powerful vocal", "Romantic"],
  ["powerful vocals", "Romantic"],
  ["vocal range", "Romantic"],
  ["falsetto", "Romantic"],
  ["slow song", "Relaxing"],
  ["slow songs", "Relaxing"],
  ["wind down", "Relaxing"],
  ["pump up", "Party"],
  ["pump me up", "Party"],
  ["get hyped", "Party"],
  ["road trip", "Driving"],
  ["rainy day", "Late Night"],
  ["deep work", "Focus"],
  ["heart break", "Melancholic"],
  ["heartbreak", "Melancholic"],
  ["break up", "Melancholic"],
  ["breakup", "Melancholic"],
  ["to code", "Focus"],
  ["while coding", "Focus"],
  ["to study", "Focus"],
  ["while studying", "Focus"],
  ["to workout", "Workout"],
  ["while working out", "Workout"],
  ["to sleep", "Relaxing"],
  ["fall asleep", "Relaxing"],
  ["to drive", "Driving"],
  ["while driving", "Driving"],
  ["fun time", "Happy"],
  ["good time", "Happy"],
  ["soft song", "Relaxing"],
  ["soft songs", "Relaxing"],
  ["soft music", "Relaxing"],
  ["easy listening", "Relaxing"],
];

const UPBEAT_INTENTS = new Set<ValidIntent>(["Happy", "Party", "Workout"]);

function pickBestIntentMatch(matches: ValidIntent[]): ValidIntent | null {
  if (matches.length === 0) {
    return null;
  }
  const upbeat = matches.find((intent) => UPBEAT_INTENTS.has(intent));
  return upbeat ?? matches[0];
}

export function inferIntentFromDescriptivePhrase(text: string): ValidIntent | null {
  const normalized = text.toLowerCase();
  const matches: ValidIntent[] = [];
  const sorted = [...DESCRIPTIVE_PHRASE_TO_INTENT].sort(
    (left, right) => right[0].length - left[0].length,
  );
  for (const [phrase, intent] of sorted) {
    if (normalized.includes(phrase)) {
      matches.push(intent);
    }
  }
  return pickBestIntentMatch(matches);
}

export interface IntentValidationResult {
  accepted: boolean;
  intent: string;
  intentChanged: boolean;
  rejectionReason: string | null;
  preferredArtists: string[];
  preferredGenres: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function canonicalIntent(value: string): ValidIntent | null {
  const normalized = normalize(value);
  const direct = VALID_INTENT_LOOKUP.get(normalized);
  if (direct) {
    return direct;
  }
  return INTENT_ALIASES[normalized] ?? null;
}

export function isValidIntent(value: string): boolean {
  return canonicalIntent(value) !== null;
}

export function isGenreLabel(value: string): boolean {
  return GENRE_LABELS.has(normalize(value));
}

export function isDiscoveryLabel(value: string): boolean {
  return DISCOVERY_LABELS.has(normalize(value));
}

export function isKnownArtist(value: string, extraArtists: string[] = []): boolean {
  const normalized = normalize(value);
  if (KNOWN_ARTISTS.has(normalized)) {
    return true;
  }
  return extraArtists.some((artist) => normalize(artist) === normalized);
}

export function extractIntentFromText(text: string): ValidIntent | null {
  const normalized = normalize(text);
  const direct = canonicalIntent(text);
  if (direct) {
    return direct;
  }

  const descriptive = inferIntentFromDescriptivePhrase(text);
  if (descriptive) {
    return descriptive;
  }

  const sorted = Object.entries(MOOD_KEYWORD_TO_INTENT).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [keyword, intent] of sorted) {
    if (normalized.includes(keyword)) {
      return intent;
    }
  }
  return null;
}

export function validateProposedIntent(
  proposed: string,
  currentIntent: string,
  knownArtists: string[] = [],
): IntentValidationResult {
  const cleaned = proposed.trim();
  if (!cleaned) {
    return {
      accepted: false,
      intent: currentIntent,
      intentChanged: false,
      rejectionReason: "Empty intent proposal.",
      preferredArtists: [],
      preferredGenres: [],
    };
  }

  if (isDiscoveryLabel(cleaned)) {
    return {
      accepted: false,
      intent: currentIntent,
      intentChanged: false,
      rejectionReason: "Discovery Level cannot become Session Intent.",
      preferredArtists: [],
      preferredGenres: [],
    };
  }

  if (normalize(cleaned) === normalize(GENERAL_LISTENING_INTENT)) {
    return {
      accepted: false,
      intent: currentIntent,
      intentChanged: false,
      rejectionReason: "General Listening is not a promotable session mood.",
      preferredArtists: [],
      preferredGenres: [],
    };
  }

  if (isGenreLabel(cleaned)) {
    return {
      accepted: false,
      intent: currentIntent,
      intentChanged: false,
      rejectionReason: "Genre labels cannot become Session Intent.",
      preferredArtists: [],
      preferredGenres: [cleaned],
    };
  }

  if (isKnownArtist(cleaned, knownArtists)) {
    return {
      accepted: false,
      intent: currentIntent,
      intentChanged: false,
      rejectionReason: "Artist names cannot become Session Intent.",
      preferredArtists: [cleaned],
      preferredGenres: [],
    };
  }

  const canonical = canonicalIntent(cleaned) ?? extractIntentFromText(cleaned);
  if (!canonical) {
    return {
      accepted: false,
      intent: currentIntent,
      intentChanged: false,
      rejectionReason: `Invalid AI intent ignored: '${cleaned}' is not in the allowed intent list.`,
      preferredArtists: [],
      preferredGenres: [],
    };
  }

  return {
    accepted: true,
    intent: canonical,
    intentChanged: normalize(canonical) !== normalize(currentIntent),
    rejectionReason: null,
    preferredArtists: [],
    preferredGenres: [],
  };
}

export function mapSearchToCandidateIntent(query: string): ValidIntent | null {
  return extractIntentFromText(query);
}
