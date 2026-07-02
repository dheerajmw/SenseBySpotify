import type { LocalUserProfile, Recommendation, SessionAction } from "../types";
import { getDiscoveryProfile, normalizeNoveltyTolerance } from "./discoveryLevel";
import { INTENT_CONFIDENCE_THRESHOLD, OFF_GENRE_SUSTAINED_LISTEN_DECAY, SUSTAINED_LISTEN_CONFIDENCE_WEIGHT } from "./intentEvidence";
import { parseReasonBullets } from "./music";

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }
  return `${Math.floor(hours / 24)} d ago`;
}

export function buildWhyChangedBullets(
  reason: string,
  recentActions: SessionAction[],
): string[] {
  const bullets = new Set<string>();

  for (const item of parseReasonBullets(reason)) {
    if (item.length > 8) {
      bullets.add(item);
    }
  }

  const searches = recentActions
    .filter((action) =>
      ["SEARCH", "SEARCH_TRACK", "SEARCH_ARTIST"].includes(action.type),
    )
    .slice(-3);

  for (const search of searches) {
    bullets.add(`You searched for "${search.value}"`);
  }

  const likes = recentActions.filter((action) => action.type === "LIKE").length;
  if (likes > 0) {
    bullets.add(
      likes === 1
        ? "You liked a track in this session"
        : `You liked ${likes} tracks in this session`,
    );
  }

  const skips = recentActions.filter((action) => action.type === "SKIP").length;
  if (skips > 0) {
    bullets.add(
      skips === 1
        ? "You skipped a recommendation that didn't fit"
        : `You skipped ${skips} recommendations that didn't fit`,
    );
  }

  const feedback = recentActions.filter((action) => action.type === "FEEDBACK");
  for (const item of feedback.slice(-2)) {
    bullets.add(`You shared feedback: ${item.value}`);
  }

  if (bullets.size === 0 && reason) {
    bullets.add(reason);
  }

  return Array.from(bullets).slice(0, 6);
}

export function buildRecommendationFitBullets(
  recommendation: Recommendation,
  profile: LocalUserProfile,
  sessionIntent: string,
): string[] {
  const bullets: string[] = [];
  const reasonParts = parseReasonBullets(recommendation.reason);
  const artistNames = recommendation.track.artists.map((artist) => artist.name);

  if (sessionIntent) {
    bullets.push(`Matches your current ${sessionIntent.toLowerCase()} session`);
  }

  for (const part of reasonParts) {
    if (part.length > 10 && !bullets.includes(part)) {
      bullets.push(part);
    }
  }

  const discoveryLevel = normalizeNoveltyTolerance(profile.noveltyTolerance);
  const discoveryProfile = getDiscoveryProfile(discoveryLevel);
  bullets.push("Fits your preferred discovery level");

  const favouriteMatch = profile.favouriteArtists.find((artist) =>
    artistNames.some(
      (name) =>
        name.toLowerCase().includes(artist.name.toLowerCase()) ||
        artist.name.toLowerCase().includes(name.toLowerCase()),
    ),
  );
  if (favouriteMatch) {
    bullets.push(`Similar to ${favouriteMatch.name}, an artist you picked`);
  } else if (artistNames[0]) {
    const anchor = profile.favouriteArtists[0]?.name ?? artistNames[0];
    bullets.push(`Introduces a new artist similar to ${anchor}`);
    bullets.push(`${discoveryProfile.label} pick for today`);
  }

  if (recommendation.confidence >= 0.85) {
    bullets.push("High-confidence AI match");
  } else if (recommendation.confidence >= 0.65) {
    bullets.push("Medium-confidence AI match");
  }

  return bullets.slice(0, 5);
}

export function learningMessageForAction(type: SessionAction["type"]): string | null {
  switch (type) {
    case "SEARCH":
    case "SEARCH_TRACK":
    case "SEARCH_ARTIST":
      return `Learning from your search — mood changes need ${INTENT_CONFIDENCE_THRESHOLD} points`;
    case "LIKE":
      return `Updating taste — mood changes need ${INTENT_CONFIDENCE_THRESHOLD} points`;
    case "SKIP":
      return `Reading your mood — changes apply at ${INTENT_CONFIDENCE_THRESHOLD} points`;
    case "REPLAY":
      return "Strong signal recorded for mood detection";
    case "LISTENED_20S":
      return `20+ seconds listened — +${SUSTAINED_LISTEN_CONFIDENCE_WEIGHT} if genre matches, otherwise −${OFF_GENRE_SUSTAINED_LISTEN_DECAY} points`;
    case "FEEDBACK":
      return `Thanks — this helps Sense reach the ${INTENT_CONFIDENCE_THRESHOLD}-point mood threshold`;
    default:
      return null;
  }
}
