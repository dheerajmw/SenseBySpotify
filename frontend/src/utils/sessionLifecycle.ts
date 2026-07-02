import { SESSION_EXPIRY_MS, UNKNOWN_SESSION_INTENT } from "../constants/brand";
import type { SessionState, Track } from "../types";

export type SessionStatus = "new" | "active" | "expired";

export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isUnknownIntent(intent: string | null | undefined): boolean {
  const trimmed = intent?.trim() ?? "";
  if (!trimmed) {
    return true;
  }
  return trimmed.toLowerCase() === UNKNOWN_SESSION_INTENT.toLowerCase();
}

export function hasKnownIntent(intent: string | null | undefined): boolean {
  return !isUnknownIntent(intent);
}

export function getActiveIntent(session: SessionState): string {
  return hasKnownIntent(session.currentIntent) ? session.currentIntent.trim() : "";
}

export function isSessionExpired(
  lastActive: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!lastActive) {
    return true;
  }
  const timestamp = Date.parse(lastActive);
  if (Number.isNaN(timestamp)) {
    return true;
  }
  return now - timestamp > SESSION_EXPIRY_MS;
}

export function resolveSessionLastActive(session: Partial<SessionState>): string | null {
  return session.lastActive ?? session.lastUpdated ?? session.createdAt ?? null;
}

export function getSessionStatus(
  session: Pick<SessionState, "createdAt" | "lastActive" | "currentIntent">,
  now = Date.now(),
): SessionStatus {
  if (isSessionExpired(session.lastActive, now)) {
    return "expired";
  }

  const createdAt = Date.parse(session.createdAt);
  const lastActive = Date.parse(session.lastActive);
  const sessionAgeMs = Number.isNaN(createdAt) ? Number.POSITIVE_INFINITY : now - createdAt;
  const idleMs = Number.isNaN(lastActive) ? Number.POSITIVE_INFINITY : now - lastActive;

  if (isUnknownIntent(session.currentIntent) && sessionAgeMs < 60_000 && idleMs < 60_000) {
    return "new";
  }

  return "active";
}

export function formatSessionAge(createdAt: string, now = Date.now()): string {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) {
    return "Just started";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
}

export function formatSessionStatusLabel(status: SessionStatus): string {
  switch (status) {
    case "new":
      return "New Session";
    case "active":
      return "Active";
    case "expired":
      return "Expired";
  }
}

export function touchSessionTimestamps(session: SessionState): SessionState {
  const now = new Date().toISOString();
  return {
    ...session,
    lastActive: now,
    lastUpdated: now,
  };
}

export interface SessionQueueSnapshot {
  currentQueue: Track[];
  currentQueueIndex: number;
}
