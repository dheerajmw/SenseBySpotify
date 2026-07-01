export interface DiscoveryProfile {
  label: string;
  description: string;
  familiarPercent: number;
  discoveryPercent: number;
}

export function clampDiscoveryLevel(level: number): number {
  return Math.round(Math.min(100, Math.max(0, level)));
}

export function normalizeNoveltyTolerance(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return clampDiscoveryLevel(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && value.trim() !== "") {
      return clampDiscoveryLevel(parsed);
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "familiar" || normalized.includes("mostly familiar")) {
      return 20;
    }
    if (normalized === "adventurous" || normalized.includes("discover")) {
      return 80;
    }
    return 50;
  }
  return 50;
}

export function getDiscoveryProfile(level: number): DiscoveryProfile {
  const discoveryPercent = clampDiscoveryLevel(level);
  const familiarPercent = 100 - discoveryPercent;

  if (discoveryPercent <= 25) {
    return {
      label: "Mostly Familiar",
      description: "Prioritising songs and artists you already know.",
      familiarPercent,
      discoveryPercent,
    };
  }
  if (discoveryPercent <= 50) {
    return {
      label: "Balanced Explorer",
      description: "Mixing familiar favourites with carefully selected discoveries.",
      familiarPercent,
      discoveryPercent,
    };
  }
  if (discoveryPercent <= 75) {
    return {
      label: "Adventurous Explorer",
      description: "Introducing more unfamiliar artists while staying relevant.",
      familiarPercent,
      discoveryPercent,
    };
  }
  return {
    label: "Discovery Enthusiast",
    description: "Maximising discovery of new artists and songs.",
    familiarPercent,
    discoveryPercent,
  };
}

export function discoveryLevelToPrompt(level: number): string {
  const profile = getDiscoveryProfile(level);
  return (
    `Discovery Level: ${profile.discoveryPercent}% (${profile.label}). ` +
    `Prioritise approximately ${profile.familiarPercent}% familiar music and ` +
    `${profile.discoveryPercent}% new discoveries.`
  );
}

export function sliderPresetLabel(level: number): string {
  if (level <= 33) {
    return "Familiar";
  }
  if (level <= 66) {
    return "Balanced";
  }
  return "Adventurous";
}
