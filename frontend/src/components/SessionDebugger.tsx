import { useState } from "react";
import { useSession } from "../hooks/useSession";
import {
  EXPLICIT_PREFERENCE_SIGNALS_TARGET,
  INTENT_CONFIDENCE_THRESHOLD,
  MEANINGFUL_INTERACTIONS_TARGET,
  remainingInteractionsNeeded,
} from "../utils/intentEvidence";

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatActionLabel(type: string, value: string): string {
  switch (type) {
    case "SEARCH_TRACK":
    case "SEARCH":
      return `Search: ${value}`;
    case "SEARCH_ARTIST":
      return `Search artist: ${value}`;
    case "PLAY":
      return `Played ${value}`;
    case "LIKE":
      return `Liked ${value}`;
    case "SKIP":
      return `Skipped ${value}`;
    case "REPLAY":
      return `Replayed ${value}`;
    case "RECOMMENDATION_CLICKED":
      return `Opened ${value}`;
    case "FEEDBACK":
      return `Feedback: ${value}`;
    default:
      return `${type}: ${value}`;
  }
}

function IntentTimelineEntry({
  entry,
  muted = false,
}: {
  entry: { timestamp: number; intent: string; confidence: number; reason: string };
  muted?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border px-4 py-3 text-sm",
        muted
          ? "border-zinc-800/60 bg-zinc-900/40"
          : "border-zinc-800 bg-zinc-900/60",
      ].join(" ")}
    >
      <p className="font-medium text-emerald-300">
        {formatTime(entry.timestamp)} → Intent: {entry.intent} (
        {Math.round(entry.confidence * 100)}%)
      </p>
      <p className="mt-1 text-zinc-400">Reason: {entry.reason}</p>
    </div>
  );
}

export default function SessionDebugger() {
  const { session, intentHistory, isCheckingIntent } = useSession();
  const [open, setOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const latestIntent = intentHistory.at(-1);
  const earlierIntents = intentHistory.slice(0, -1).reverse();
  const remaining = remainingInteractionsNeeded(session.interactionsCollected);
  const candidateDiffers =
    session.candidateIntent.trim() !== "" &&
    session.candidateIntent.trim().toLowerCase() !==
      session.currentIntent.trim().toLowerCase();

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-20 z-[80] rounded-full border border-emerald-500/40 bg-zinc-950/90 px-4 py-2 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur hover:bg-zinc-900"
      >
        AI Session
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-debugger-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-emerald-400">Developer Mode</p>
                <h2 id="session-debugger-title" className="mt-1 text-xl font-semibold">
                  AI Session
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTimelineOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                Close
              </button>
            </div>

            <section className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Intent Evidence
              </h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Current Intent</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {session.currentIntent || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Candidate Intent</dt>
                  <dd
                    className={[
                      "mt-0.5 font-medium",
                      candidateDiffers ? "text-amber-300" : "text-zinc-300",
                    ].join(" ")}
                  >
                    {session.candidateIntent || session.currentIntent || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Intent Confidence</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {session.intentConfidence}%
                    {isCheckingIntent ? " · evaluating..." : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Threshold</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {INTENT_CONFIDENCE_THRESHOLD}%
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Evidence</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {session.interactionsCollected} / {MEANINGFUL_INTERACTIONS_TARGET}{" "}
                    interactions
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Preference Signals</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {session.explicitPreferenceSignals} / {EXPLICIT_PREFERENCE_SIGNALS_TARGET}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500">Remaining Interactions Needed</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {remaining > 0
                      ? `${remaining} more meaningful interaction${remaining === 1 ? "" : "s"}`
                      : "Evaluation threshold met"}
                  </dd>
                </div>
              </dl>
            </section>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-900 px-4 py-3">
                <dt className="text-zinc-500">Discovery Level</dt>
                <dd className="mt-1 font-medium text-white">
                  {session.discoveryLabel} ({session.discoveryLevel}%)
                </dd>
              </div>
              <div className="rounded-xl bg-zinc-900 px-4 py-3">
                <dt className="text-zinc-500">AI Model Confidence</dt>
                <dd className="mt-1 font-medium text-white">
                  {Math.round(session.confidence * 100)}%
                </dd>
              </div>
              <div className="rounded-xl bg-zinc-900 px-4 py-3 sm:col-span-2">
                <dt className="text-zinc-500">Recommendation Version</dt>
                <dd className="mt-1 font-medium text-white">
                  v{session.recommendationVersion}
                </dd>
              </div>
              <div className="rounded-xl bg-zinc-900 px-4 py-3 sm:col-span-2">
                <dt className="text-zinc-500">AI Reason</dt>
                <dd className="mt-1 text-zinc-300">{session.aiReason || "—"}</dd>
              </div>
            </dl>

            <section className="mt-6">
              <h3 className="text-sm font-medium text-zinc-300">Intent Timeline</h3>

              {!latestIntent && (
                <p className="mt-3 text-sm text-zinc-500">No intent changes yet.</p>
              )}

              {latestIntent && (
                <div className="mt-3">
                  <IntentTimelineEntry entry={latestIntent} />
                </div>
              )}

              {earlierIntents.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setTimelineOpen((value) => !value)}
                    aria-expanded={timelineOpen}
                    className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-900/70"
                  >
                    <span>
                      {timelineOpen ? "Hide earlier intents" : "Show earlier intents"}
                      <span className="ml-2 text-zinc-500">({earlierIntents.length})</span>
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      className={[
                        "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
                        timelineOpen ? "rotate-180" : "",
                      ].join(" ")}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {timelineOpen && (
                    <ul className="mt-2 space-y-2">
                      {earlierIntents.map((entry) => (
                        <li key={`${entry.timestamp}-${entry.intent}`}>
                          <IntentTimelineEntry entry={entry} muted />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="mt-6">
              <h3 className="text-sm font-medium text-zinc-300">Recent Actions</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                {session.recentActions.length === 0 && <li>No actions logged yet.</li>}
                {[...session.recentActions].reverse().map((action) => (
                  <li key={`${action.timestamp}-${action.type}-${action.value}`}>
                    • {formatActionLabel(action.type, action.value)}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
