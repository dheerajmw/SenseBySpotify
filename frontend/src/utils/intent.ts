import { canonicalIntent, extractIntentFromText } from "./intentValidation";

function normalizeIntent(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function resolveIntentLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return (
    canonicalIntent(trimmed) ??
    extractIntentFromText(trimmed) ??
    normalizeIntent(trimmed)
  );
}

export function intentsAlign(currentIntent: string, candidate: string): boolean {
  const current = resolveIntentLabel(currentIntent);
  const next = resolveIntentLabel(candidate);
  if (!next) {
    return true;
  }
  if (!current) {
    return false;
  }
  return normalizeIntent(current) === normalizeIntent(next);
}

export function hasIntentChanged(before: string, after: string): boolean {
  const left = before.trim();
  const right = after.trim();
  if (!left || !right) {
    return false;
  }
  return !intentsAlign(left, right);
}
