function normalizeIntent(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

export function intentsAlign(currentIntent: string, candidate: string): boolean {
  const current = normalizeIntent(currentIntent);
  const next = normalizeIntent(candidate);
  if (!next) {
    return true;
  }
  if (!current) {
    return false;
  }
  if (current === next || current.includes(next) || next.includes(current)) {
    return true;
  }
  const words = next.split(" ").filter((word) => word.length > 2);
  return words.some((word) => current.includes(word));
}
