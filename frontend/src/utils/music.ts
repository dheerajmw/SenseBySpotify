export function formatDuration(durationMs: number | null | undefined): string {
  if (!durationMs) {
    return "—";
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatConfidence(confidence: number): string {
  if (confidence >= 0.85) {
    return "High";
  }
  if (confidence >= 0.65) {
    return "Medium";
  }
  return "Low";
}

export function parseReasonBullets(reason: string): string[] {
  const parts = reason
    .split(/[•\n]|(?:\.\s+)/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [reason];
}
