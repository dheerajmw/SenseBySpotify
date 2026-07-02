import type { Track } from "../types";
import { extractIntentFromText, VALID_INTENTS, type ValidIntent } from "./intentValidation";

const INTENT_KEYWORD_TO_GENRES: Record<string, string[]> = {
  hindi: ["Indian Pop", "Bollywood", "Indian"],
  bollywood: ["Bollywood", "Indian Pop", "Indian"],
  punjabi: ["Punjabi", "Indian Pop", "Indian"],
  tamil: ["Tamil", "Indian Pop", "Indian"],
  telugu: ["Telugu", "Indian Pop", "Indian"],
  indie: ["Indie Rock", "Alternative", "Singer/Songwriter"],
  lofi: ["Hip-Hop/Rap", "Electronic", "Easy Listening"],
  "lo-fi": ["Hip-Hop/Rap", "Electronic", "Easy Listening"],
  acoustic: ["Singer/Songwriter", "Folk", "Acoustic"],
  jazz: ["Jazz", "Vocal Jazz"],
  classical: ["Classical", "Classical Crossover"],
  rock: ["Rock", "Alternative"],
  metal: ["Metal", "Rock"],
  edm: ["Dance", "Electronic"],
  electronic: ["Electronic", "Dance"],
  "hip hop": ["Hip-Hop/Rap"],
  rap: ["Hip-Hop/Rap"],
  "r&b": ["R&B/Soul", "Soul"],
  soul: ["R&B/Soul", "Soul"],
  country: ["Country"],
  folk: ["Folk", "Singer/Songwriter"],
  latin: ["Latin", "Latino"],
  "k-pop": ["K-Pop", "Pop"],
  kpop: ["K-Pop", "Pop"],
  poetry: ["Indian Pop", "Singer/Songwriter", "Spoken Word"],
  urdu: ["Indian Pop", "Indian", "World", "Singer/Songwriter"],
  ghazal: ["Indian Pop", "Indian", "World"],
  shayari: ["Indian Pop", "Indian", "World", "Singer/Songwriter"],
  nazm: ["Indian Pop", "Singer/Songwriter", "World"],
  devotional: ["Indian Pop", "Devotional", "World"],
  bhajan: ["Indian Pop", "Devotional", "World"],
  sufi: ["Indian Pop", "World", "Singer/Songwriter"],
};

const MOOD_INTENT_TO_GENRES: Record<string, string[]> = {
  Workout: ["Pop", "Hip-Hop/Rap", "Dance", "Electronic"],
  Study: ["Classical", "Easy Listening", "Ambient", "Electronic"],
  Focus: ["Classical", "Electronic", "Easy Listening", "Ambient"],
  Coding: ["Electronic", "Ambient", "Easy Listening", "Indie Rock"],
  Driving: ["Rock", "Pop", "Hip-Hop/Rap", "Alternative"],
  Relaxing: ["Easy Listening", "Singer/Songwriter", "Ambient", "Jazz"],
  Calm: ["Easy Listening", "Ambient", "Classical", "New Age"],
  Party: ["Dance", "Pop", "Hip-Hop/Rap", "Electronic"],
  Travel: ["Pop", "Rock", "Indie Rock", "Alternative"],
  Sleep: ["Ambient", "Easy Listening", "New Age", "Classical"],
  Romantic: ["Pop", "R&B/Soul", "Singer/Songwriter", "Soft Rock"],
  Morning: ["Pop", "Indie Rock", "Singer/Songwriter", "Folk"],
  "Late Night": ["R&B/Soul", "Hip-Hop/Rap", "Electronic", "Jazz"],
  Meditation: ["New Age", "Ambient", "Classical", "World"],
  Reading: ["Classical", "Jazz", "Easy Listening", "Ambient"],
  "Rainy Evening": ["Singer/Songwriter", "Indie Rock", "Jazz", "Alternative"],
  "Road Trip": ["Rock", "Pop", "Country", "Alternative"],
  Festival: ["Dance", "Electronic", "Pop", "Rock"],
  "High Energy": ["Dance", "Electronic", "Hip-Hop/Rap", "Rock", "Pop", "Alternative", "Metal"],
  Happy: ["Pop", "Dance", "Folk", "Indie Rock"],
  Melancholic: ["Singer/Songwriter", "Indie Rock", "Alternative", "Folk"],
};

/** Minimum genre-fit score for a track to count as supporting the predicted intent. */
export const TRACK_INTENT_MATCH_MIN_SCORE = 0.55;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeGenre(value: string): string {
  return value
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\//g, " ")
    .replace(/&/g, "and")
    .trim();
}

function titleCaseGenre(label: string): string {
  const cleaned = label.trim();
  if (!cleaned) {
    return "";
  }
  const lower = cleaned.toLowerCase();
  if (lower === "r&b") return "R&B";
  if (lower === "edm") return "EDM";
  if (lower === "k-pop") return "K-Pop";
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function dedupeGenres(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = normalizeText(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function resolveTargetGenres(intent: string, profileGenres: string[]): string[] {
  const targets: string[] = [];
  const trimmed = intent.trim();
  const normalizedIntent = normalizeText(trimmed);

  for (const genre of profileGenres) {
    const formatted = titleCaseGenre(genre);
    if (formatted) {
      targets.push(formatted);
    }
  }

  const canonical = extractIntentFromText(trimmed);
  if (canonical && MOOD_INTENT_TO_GENRES[canonical]) {
    targets.push(...MOOD_INTENT_TO_GENRES[canonical]);
  }

  if (normalizedIntent) {
    const keywords = Object.keys(INTENT_KEYWORD_TO_GENRES).sort(
      (left, right) => right.length - left.length,
    );
    for (const keyword of keywords) {
      if (normalizedIntent.includes(keyword)) {
        targets.push(...INTENT_KEYWORD_TO_GENRES[keyword]);
      }
    }
  }

  return dedupeGenres(targets).slice(0, 8);
}

export function scoreTrackGenreFit(
  track: Track,
  targetGenres: string[],
  intent: string,
): number {
  if (!targetGenres.length) {
    return 0.5;
  }

  const primary =
    track.primary_genre ??
    (track.artists[0]?.genres[0] ? track.artists[0].genres[0] : null);
  if (!primary) {
    return 0;
  }

  const trackGenre = normalizeGenre(primary);
  let best = 0;

  for (const target of targetGenres) {
    const targetNorm = normalizeGenre(target);
    if (!targetNorm) {
      continue;
    }
    if (trackGenre === targetNorm) {
      best = Math.max(best, 1);
      continue;
    }
    if (targetNorm.includes(trackGenre) || trackGenre.includes(targetNorm)) {
      best = Math.max(best, 0.88);
      continue;
    }
    const targetTokens = new Set(
      targetNorm.split(/\s+/).filter((token) => token.length > 2),
    );
    const trackTokens = trackGenre.split(/\s+/).filter((token) => token.length > 2);
    const overlap = trackTokens.filter((token) => targetTokens.has(token));
    if (overlap.length > 0) {
      best = Math.max(best, 0.72 + 0.08 * Math.min(overlap.length, 2));
    }
  }

  const intentNorm = normalizeText(intent);
  const titleNorm = normalizeText(track.name);
  if (intentNorm && titleNorm.includes(intentNorm) && best < 0.4) {
    best = Math.max(best, 0.15);
  }

  return Math.round(best * 1000) / 1000;
}

export function trackMatchesPredictedIntent(
  track: Track,
  predictedIntent: string,
  profileGenres: string[],
): boolean {
  const primary =
    track.primary_genre ??
    (track.artists[0]?.genres[0] ? track.artists[0].genres[0] : null);
  if (!primary) {
    // iTunes genre missing — don't penalize listening from recommendations
    return true;
  }
  const targets = resolveTargetGenres(predictedIntent, profileGenres);
  const score = scoreTrackGenreFit(track, targets, predictedIntent);
  return score >= TRACK_INTENT_MATCH_MIN_SCORE;
}

/** Best-matching session mood for a track's iTunes genre. */
export function inferIntentFromTrack(
  track: Track,
  profileGenres: string[],
): ValidIntent | null {
  let bestIntent: ValidIntent | null = null;
  let bestScore = 0;

  for (const intent of VALID_INTENTS) {
    const targets = resolveTargetGenres(intent, profileGenres);
    const score = scoreTrackGenreFit(track, targets, intent);
    if (score >= TRACK_INTENT_MATCH_MIN_SCORE && score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  return bestIntent;
}

function genresOverlap(left: string, right: string): boolean {
  const a = normalizeGenre(left);
  const b = normalizeGenre(right);
  if (!a || !b) {
    return false;
  }
  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }
  const aTokens = new Set(a.split(/\s+/).filter((t) => t.length > 2));
  return b.split(/\s+/).some((t) => t.length > 2 && aTokens.has(t));
}

/** Map a free-text search query to a session mood via keyword + genre overlap. */
export function inferIntentFromSearchQuery(
  query: string,
  profileGenres: string[] = [],
): ValidIntent | null {
  const fromMoodText = extractIntentFromText(query);
  if (fromMoodText) {
    return fromMoodText;
  }

  const normalized = normalizeText(query);
  if (!normalized) {
    return null;
  }

  let bestIntent: ValidIntent | null = null;
  let bestScore = 0;

  const keywords = Object.keys(INTENT_KEYWORD_TO_GENRES).sort(
    (left, right) => right.length - left.length,
  );
  for (const keyword of keywords) {
    const keyNorm = normalizeText(keyword);
    if (!keyNorm || !normalized.includes(keyNorm)) {
      continue;
    }
    const keywordGenres = INTENT_KEYWORD_TO_GENRES[keyword];
    for (const intent of VALID_INTENTS) {
      const moodGenres = resolveTargetGenres(intent, profileGenres);
      let overlap = 0;
      for (const kg of keywordGenres) {
        if (moodGenres.some((mg) => genresOverlap(kg, mg))) {
          overlap += 1;
        }
      }
      if (overlap > bestScore) {
        bestScore = overlap;
        bestIntent = intent;
      }
    }
  }

  return bestScore > 0 ? bestIntent : null;
}
