import { useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { buildIntentPredictionDisplay } from "../utils/intentPredictionDisplay";
import { hasKnownIntent } from "../utils/sessionLifecycle";

/** Compact AI session indicator — visible on all screens (including mobile). */
export default function SessionStatusPill() {
  const navigate = useNavigate();
  const { session, isCheckingIntent } = useSession();
  const display = buildIntentPredictionDisplay(session, {
    isEvaluating: isCheckingIntent,
  });

  if (!display) {
    return null;
  }

  const intentLabel = hasKnownIntent(session.currentIntent)
    ? session.currentIntent
    : display.headline;

  return (
    <button
      type="button"
      onClick={() => navigate("/feed")}
      className="session-status-pill fixed left-3 right-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-[70] mx-auto flex max-w-md items-center gap-2 rounded-full border border-emerald-500/35 bg-zinc-950/95 px-3 py-1.5 text-left shadow-lg backdrop-blur-md sm:left-auto sm:right-4 sm:top-[4.75rem] sm:mx-0 sm:max-w-[14rem]"
      aria-label={`AI session: ${intentLabel}. Open recommendation feed.`}
    >
      <span
        className={[
          "h-2 w-2 shrink-0 rounded-full",
          isCheckingIntent ? "animate-pulse bg-sky-400" : "bg-emerald-400",
        ].join(" ")}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-widest text-emerald-400/90">
          AI Session
        </span>
        <span className="block truncate text-xs font-medium text-white">{intentLabel}</span>
      </span>
      <span className="shrink-0 text-[10px] text-zinc-500" aria-hidden>
        Feed →
      </span>
    </button>
  );
}
