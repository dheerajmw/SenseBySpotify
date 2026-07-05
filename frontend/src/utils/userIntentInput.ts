import { GENERAL_LISTENING_INTENT } from "../constants/brand";
import { inferIntentFromSearchQuery } from "./trackIntentFit";
import {
  extractIntentFromText,
  isKnownArtist,
  validateProposedIntent,
} from "./intentValidation";

const LANGUAGE_GENRE_HINTS: Record<string, string> = {
  hindi: "Hindi",
  urdu: "Urdu",
  punjabi: "Punjabi",
  tamil: "Tamil",
  telugu: "Telugu",
  bollywood: "Bollywood",
  ghazal: "Ghazal",
  shayari: "Shayari",
};

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function titleCaseGenre(label: string): string {
  const cleaned = label.trim();
  if (!cleaned) {
    return "";
  }
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Pull genre / language hints from free text — not the full sentence. */
export function extractGenreHintsFromText(text: string): string[] {
  const normalized = normalize(text);
  if (!normalized) {
    return [];
  }

  const hints: string[] = [];
  const seen = new Set<string>();

  const add = (label: string) => {
    const formatted = titleCaseGenre(label);
    const key = normalize(formatted);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    hints.push(formatted);
  };

  for (const [keyword, genre] of Object.entries(LANGUAGE_GENRE_HINTS)) {
    if (normalized.includes(keyword)) {
      add(genre);
    }
  }

  const genreLabels = [
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
  ];

  for (const label of genreLabels) {
    if (normalized.includes(label)) {
      add(label);
    }
  }

  return hints;
}

export function formatResolvedIntentLabel(intent: string, genreHints: string[]): string {
  const mood = intent.trim();
  if (!mood) {
    return genreHints.join(" · ");
  }
  if (genreHints.length === 0) {
    return mood;
  }
  const moodKey = normalize(mood);
  const genres = genreHints.filter((genre) => normalize(genre) !== moodKey);
  if (genres.length === 0) {
    return mood;
  }
  return `${mood} · ${genres.join(", ")}`;
}

export interface ResolvedUserDeclaredIntent {
  accepted: boolean;
  intent: string;
  preferredGenres: string[];
  preferredArtists: string[];
  displayLabel: string;
  rejectionReason: string | null;
}

function refineIntentForCulturalListening(
  rawInput: string,
  intent: string,
): string {
  const normalized = normalize(rawInput);
  const hasPoetryCue = /poetry|poem|nazm|ghazal|shayari/.test(normalized);
  const hasSouthAsianCue = /hindi|urdu|bollywood|ghazal|shayari|punjabi|sufi/.test(
    normalized,
  );

  if (hasPoetryCue && hasSouthAsianCue) {
    return "Melancholic";
  }

  if (/ghazal|shayari|urdu/.test(normalized)) {
    return "Melancholic";
  }

  return intent;
}

export function resolveUserDeclaredIntent(
  rawInput: string,
  options?: { knownArtists?: string[]; profileGenres?: string[] },
): ResolvedUserDeclaredIntent {
  const cleaned = rawInput.trim();
  const knownArtists = options?.knownArtists ?? [];
  const profileGenres = options?.profileGenres ?? [];
  const genreHints = extractGenreHintsFromText(cleaned);

  if (!cleaned) {
    return {
      accepted: false,
      intent: GENERAL_LISTENING_INTENT,
      preferredGenres: [],
      preferredArtists: [],
      displayLabel: "",
      rejectionReason: "Empty intent.",
    };
  }

  if (isKnownArtist(cleaned, knownArtists)) {
    return {
      accepted: false,
      intent: GENERAL_LISTENING_INTENT,
      preferredGenres: [],
      preferredArtists: [cleaned],
      displayLabel: cleaned,
      rejectionReason: "Artist names cannot become session intent.",
    };
  }

  let validation = validateProposedIntent(cleaned, GENERAL_LISTENING_INTENT, knownArtists);

  if (!validation.accepted) {
    const inferred =
      inferIntentFromSearchQuery(cleaned, profileGenres) ?? extractIntentFromText(cleaned);
    if (inferred) {
      validation = {
        accepted: true,
        intent: inferred,
        intentChanged: true,
        rejectionReason: null,
        preferredArtists: [],
        preferredGenres: validation.preferredGenres,
      };
    }
  }

  if (!validation.accepted) {
    return {
      accepted: false,
      intent: GENERAL_LISTENING_INTENT,
      preferredGenres: validation.preferredGenres.length ? validation.preferredGenres : genreHints,
      preferredArtists: validation.preferredArtists,
      displayLabel: genreHints.join(", "),
      rejectionReason:
        validation.rejectionReason ??
        "Could not detect a mood — try Reading, Workout, Chill, or a similar session intent.",
    };
  }

  const preferredGenres = [...validation.preferredGenres];
  const seen = new Set(preferredGenres.map(normalize));
  for (const hint of genreHints) {
    const key = normalize(hint);
    if (!seen.has(key)) {
      seen.add(key);
      preferredGenres.push(hint);
    }
  }

  const intent = refineIntentForCulturalListening(cleaned, validation.intent);

  return {
    accepted: true,
    intent,
    preferredGenres,
    preferredArtists: validation.preferredArtists,
    displayLabel: formatResolvedIntentLabel(intent, preferredGenres),
    rejectionReason: null,
  };
}
