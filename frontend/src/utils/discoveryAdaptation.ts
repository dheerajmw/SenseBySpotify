import type { SessionActionType } from "../types";

export interface DiscoveryAdjustment {
  delta: number;
  reason: string;
}

export function computeDiscoveryAdjustment(
  type: SessionActionType,
  value: string,
  favouriteArtistNames: string[],
): DiscoveryAdjustment | null {
  if (type === "SKIP" || type === "DISLIKE") {
    return {
      delta: -7,
      reason:
        type === "DISLIKE"
          ? "You disliked a recommendation — showing more familiar picks."
          : "You've recently preferred familiar artists over new discoveries.",
    };
  }

  if (type === "LIKE") {
    const artistPart = value.includes(" — ") ? value.split(" — ")[1] : value;
    const isFavourite = favouriteArtistNames.some((name) =>
      artistPart.toLowerCase().includes(name.toLowerCase()),
    );
    if (isFavourite) {
      return {
        delta: -4,
        reason: "You've been enjoying familiar favourites.",
      };
    }
    return {
      delta: 8,
      reason: "You've been liking new artists and songs.",
    };
  }

  if (type === "REPLAY") {
    return {
      delta: -3,
      reason: "You've been replaying familiar tracks.",
    };
  }

  return null;
}
