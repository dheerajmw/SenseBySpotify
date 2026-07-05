import type { Recommendation, Track } from "../types";

export function trackToRecommendation(
  track: Track,
  rank = 0,
  reason = "From your library search",
): Recommendation {
  return {
    track,
    rank,
    reason,
    confidence: 0.5,
  };
}

/** Best available genre label for a track (iTunes primary genre or artist genre). */
export function resolveTrackGenre(track: Track): string {
  const primary = track.primary_genre?.trim();
  if (primary) {
    return primary;
  }

  for (const artist of track.artists) {
    const genre = artist.genres?.find((value) => value?.trim());
    if (genre?.trim()) {
      return genre.trim();
    }
  }

  return "Unknown genre";
}

/** Artist line with genre, e.g. "Taylor Swift · Pop". */
export function trackArtistLine(track: Track): string {
  const artists = track.artists.map((artist) => artist.name).join(", ");
  const genre = resolveTrackGenre(track);
  if (artists) {
    return `${artists} · ${genre}`;
  }
  return genre;
}

/** Full label for logs, feedback, and queue rows: "Song — Artist · Genre". */
export function trackLabel(track: Track): string {
  const artists = track.artists.map((artist) => artist.name).join(", ");
  const genre = resolveTrackGenre(track);
  const base = artists ? `${track.name} — ${artists}` : track.name;
  return `${base} · ${genre}`;
}

/** Accessible name for play/pause controls. */
export function trackAccessibleLabel(track: Track): string {
  return trackLabel(track);
}
