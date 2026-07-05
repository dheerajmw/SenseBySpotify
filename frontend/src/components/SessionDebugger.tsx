import { useState } from "react";
import IntentConfidenceMeter from "./IntentConfidenceMeter";
import { useSession } from "../hooks/useSession";
import {
  EXPLICIT_PREFERENCE_SIGNALS_TARGET,
  INTENT_CONFIDENCE_THRESHOLD,
  MEANINGFUL_INTERACTIONS_TARGET,
  remainingInteractionsNeeded,
} from "../utils/intentEvidence";
import { intentsAlign } from "../utils/intent";
import { buildIntentPredictionDisplay } from "../utils/intentPredictionDisplay";
import {
  formatSessionAge,
  formatSessionStatusLabel,
  hasKnownIntent,
} from "../utils/sessionLifecycle";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
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
    case "LISTENED_20S":
      return `Listened 20s+ to ${value}`;
    case "LIKE":
      return `Liked ${value}`;
    case "UNLIKE":
      return `Unliked ${value}`;
    case "DISLIKE":
      return `Disliked ${value}`;
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

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900/80 p-3 text-xs text-zinc-300">
      {value ? JSON.stringify(value, null, 2) : "—"}
    </pre>
  );
}

export default function SessionDebugger() {
  const { session, sessionStatus, intentHistory, isCheckingIntent, demoMode } =
    useSession();
  const [open, setOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const latestIntent = intentHistory.at(-1);
  const earlierIntents = intentHistory.slice(0, -1).reverse();
  const remaining = remainingInteractionsNeeded(session.interactionsCollected);
  const candidateDiffers = Boolean(
    session.candidateIntent &&
      session.currentIntent &&
      !intentsAlign(session.currentIntent, session.candidateIntent),
  );
  const lastActions = [...session.recentActions].reverse().slice(0, 10);
  const validation = session.lastIntentValidation;
  const prediction = buildIntentPredictionDisplay(session, {
    isEvaluating: isCheckingIntent,
  });

  if (!import.meta.env.DEV && !demoMode) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-20 z-[80] max-w-[11rem] rounded-full border border-emerald-500/40 bg-zinc-950/90 px-4 py-2 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur hover:bg-zinc-900"
      >
        <span className="block truncate">AI Session</span>
        {hasKnownIntent(session.currentIntent) && (
          <span className="mt-0.5 block truncate text-[10px] font-normal text-zinc-400">
            Now: {session.currentIntent}
          </span>
        )}
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

            {hasKnownIntent(session.currentIntent) && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-emerald-400/90">
                  Current listening intent
                </p>
                <p className="mt-1 text-lg font-semibold text-white">{session.currentIntent}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Feed and recommendations are tuned for this mood right now.
                </p>
              </div>
            )}

            <section className="mt-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-sky-300">
                Session Lifecycle
              </h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500">Session ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-zinc-200">
                    {session.sessionId}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Created</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {formatDateTime(session.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Last Active</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {formatDateTime(session.lastActive)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Session Age</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {formatSessionAge(session.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Session Status</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {formatSessionStatusLabel(sessionStatus)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Queue Tracks</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {session.currentQueue.length} (index {session.currentQueueIndex})
                  </dd>
                </div>
              </dl>
            </section>

            <section className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Intent &amp; confidence
              </h3>
              {prediction && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-white">{prediction.headline}</p>
                  <p className="text-sm text-zinc-400">{prediction.subline}</p>
                  <IntentConfidenceMeter
                    confidencePercent={prediction.confidencePercent}
                    thresholdPercent={prediction.thresholdPercent}
                    isPredictingChange={prediction.isPredictingChange}
                    thresholdMet={prediction.thresholdMet}
                    predictedIntent={prediction.predictedIntent}
                  />
                </div>
              )}
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Current Intent</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {hasKnownIntent(session.currentIntent) ? session.currentIntent : "—"}
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
                    {session.candidateIntent || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Candidate Confidence</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {session.candidateConfidence}
                    {isCheckingIntent ? " · evaluating..." : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Current Confidence</dt>
                  <dd className="mt-0.5 font-medium text-white">{session.intentConfidence}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Switch threshold (points)</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {INTENT_CONFIDENCE_THRESHOLD}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500">Decision</dt>
                  <dd className="mt-0.5 font-medium text-amber-200">
                    {session.intentDecision || "—"}
                  </dd>
                </div>
                {session.lastPromotionReason && (
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500">Last promotion</dt>
                    <dd className="mt-0.5 font-medium text-emerald-200">
                      {session.lastPromotionReason}
                    </dd>
                  </div>
                )}
                {session.rejectedAiIntents.length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500">Rejected AI intents</dt>
                    <dd className="mt-0.5 font-medium text-rose-200">
                      {session.rejectedAiIntents.join(", ")}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-zinc-500">Evidence interactions</dt>
                  <dd className="mt-0.5 font-medium text-white">
                    {session.interactionsCollected} / {MEANINGFUL_INTERACTIONS_TARGET}
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

            <section className="mt-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-sky-300">
                Evidence log
              </h3>
              {session.evidence.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No listening evidence yet.</p>
              ) : (
                <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs text-zinc-300">
                  {[...session.evidence].reverse().slice(0, 12).map((entry, index) => (
                    <li key={`${entry.timestamp}-${index}`} className="rounded-lg bg-zinc-900/80 px-3 py-2">
                      <span className="text-zinc-500">{formatTime(entry.timestamp)}</span>{" "}
                      <span className="font-medium text-white">{entry.action}</span>{" "}
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta} → {entry.candidateConfidenceAfter}
                      {entry.candidateIntent ? ` (${entry.candidateIntent})` : ""}
                      <p className="mt-1 text-zinc-500">{entry.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-violet-300">
                Confidence timeline
              </h3>
              {session.confidenceTimeline.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No candidate confidence changes yet.</p>
              ) : (
                <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs text-zinc-300">
                  {[...session.confidenceTimeline].reverse().slice(0, 10).map((entry, index) => (
                    <li key={`${entry.timestamp}-${index}`} className="rounded-lg bg-zinc-900/80 px-3 py-2">
                      <span className="text-zinc-500">{formatTime(entry.timestamp)}</span>{" "}
                      {entry.candidateIntent ?? "—"} — {entry.candidateConfidence} pts
                      <p className="mt-1 text-zinc-500">{entry.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-900 px-4 py-3">
                <dt className="text-zinc-500">Preferred Genres</dt>
                <dd className="mt-1 font-medium text-white">
                  {session.preferredGenres.length > 0
                    ? session.preferredGenres.join(", ")
                    : "—"}
                </dd>
              </div>
              <div className="rounded-xl bg-zinc-900 px-4 py-3">
                <dt className="text-zinc-500">Preferred Artists</dt>
                <dd className="mt-1 font-medium text-white">
                  {session.preferredArtists.length > 0
                    ? session.preferredArtists.join(", ")
                    : "—"}
                </dd>
              </div>
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

            <section className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                Intent Validator (Test Mode)
              </h3>
              {!validation && (
                <p className="mt-3 text-sm text-zinc-500">
                  No AI intent evaluation yet. Trigger an intent check to see validation output.
                </p>
              )}
              {validation && (
                <div className="mt-3 space-y-4 text-sm">
                  <div>
                    <p className="text-zinc-500">Raw AI Output</p>
                    <JsonBlock value={validation.rawAiOutput} />
                  </div>
                  <div>
                    <p className="text-zinc-500">Parsed Output</p>
                    <JsonBlock value={validation.parsedOutput} />
                  </div>
                  <div>
                    <p className="text-zinc-500">Validation Result</p>
                    <p
                      className={[
                        "mt-1 font-medium",
                        validation.validationStatus === "rejected"
                          ? "text-red-400"
                          : "text-emerald-300",
                      ].join(" ")}
                    >
                      {validation.validationStatus === "rejected"
                        ? "❌ Rejected"
                        : "✓ Accepted"}
                    </p>
                    {validation.validationMessage && (
                      <p className="mt-1 text-zinc-400">
                        Reason: {validation.validationMessage}
                      </p>
                    )}
                    {validation.rawNewIntent && (
                      <p className="mt-1 text-zinc-500">
                        Raw proposed intent: {validation.rawNewIntent}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

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
              <h3 className="text-sm font-medium text-zinc-300">
                Last 10 Actions
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                {lastActions.length === 0 && <li>No actions logged yet.</li>}
                {lastActions.map((action) => (
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
