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

export function trackLabel(track: Track): string {
  const artists = track.artists.map((artist) => artist.name).join(", ");
  return artists ? `${track.name} — ${artists}` : track.name;
}
