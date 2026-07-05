import { useState } from "react";
import { APP_NAME } from "../constants/brand";
import { useSession } from "../hooks/useSession";
import { buildIntentPredictionDisplay } from "../utils/intentPredictionDisplay";
import { formatRelativeTime } from "../utils/sessionDisplay";
import IntentConfidenceMeter from "./IntentConfidenceMeter";

export default function SessionIntentCard() {
  const { session, isCheckingIntent } = useSession();
  const [expanded, setExpanded] = useState(false);
  const display = buildIntentPredictionDisplay(session, {
    isEvaluating: isCheckingIntent,
  });

  if (!display) {
    return null;
  }

  const {
    currentIntent,
    predictedIntent,
    confidencePercent,
    thresholdPercent,
    isPredictingChange,
    thresholdMet,
    headline,
    subline,
    evidenceHint,
  } = display;

  const showDualIntent = isPredictingChange && predictedIntent;

  const previewTitle = showDualIntent
    ? `${currentIntent} → ${predictedIntent}`
    : currentIntent;
  const previewMeta = isCheckingIntent
    ? "Checking mood…"
    : showDualIntent
      ? `${confidencePercent}/${thresholdPercent} candidate points`
      : "Tap to view session details";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group w-full rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3 text-left shadow-lg shadow-black/20 backdrop-blur-xl transition-colors hover:border-emerald-500/25 hover:bg-zinc-900/60"
        aria-expanded={false}
        aria-label={`Open AI listening session. ${previewTitle}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-400/90">
              AI listening session
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">{previewTitle}</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{previewMeta}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isCheckingIntent && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-300" />
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {APP_NAME} AI
            </span>
            <span
              className="text-zinc-500 transition-transform group-hover:text-zinc-300"
              aria-hidden
            >
              ▾
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-6">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-emerald-400/5 blur-2xl" />

      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="min-w-0 text-left transition-opacity hover:opacity-80"
            aria-expanded={true}
            aria-label="Collapse AI listening session"
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
              AI listening session
            </p>
            {isCheckingIntent && (
              <p className="mt-2 flex items-center gap-2 text-sm text-sky-300">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-300" />
                Checking your mood…
              </p>
            )}
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
              {APP_NAME} AI
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label="Collapse"
            >
              ▴
            </button>
          </div>
        </div>

        {showDualIntent ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Current intent</p>
              <p className="mt-1.5 text-lg font-semibold text-white">{currentIntent}</p>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-amber-400/90">
                Candidate intent
              </p>
              <p className="mt-1.5 text-lg font-semibold text-amber-100">{predictedIntent}</p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-start gap-2">
            <span className="shrink-0 text-xl" aria-hidden>
              🎧
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Current intent</p>
              <h2 className="mt-1 break-words text-xl font-semibold text-white sm:text-2xl">
                {headline}
              </h2>
            </div>
          </div>
        )}

        <p className="text-sm leading-relaxed text-zinc-400">{subline}</p>

        <IntentConfidenceMeter
          confidencePercent={confidencePercent}
          thresholdPercent={thresholdPercent}
          isPredictingChange={isPredictingChange}
          thresholdMet={thresholdMet}
          predictedIntent={predictedIntent}
        />

        {evidenceHint && (
          <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
            {evidenceHint}
          </p>
        )}

        {!isPredictingChange && session.aiReason && (
          <p className="text-xs text-zinc-500">
            <span className="text-zinc-400">Why: </span>
            {session.aiReason.length > 160
              ? `${session.aiReason.slice(0, 157)}…`
              : session.aiReason}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 pt-4 text-xs text-zinc-500">
          <span>
            Last updated{" "}
            <span className="text-zinc-300">{formatRelativeTime(session.lastUpdated)}</span>
          </span>
          {session.lastSearchQuery && (
            <span>
              Last search{" "}
              <span className="text-zinc-300">“{session.lastSearchQuery}”</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
