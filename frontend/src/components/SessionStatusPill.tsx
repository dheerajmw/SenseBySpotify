import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { buildIntentPredictionDisplay } from "../utils/intentPredictionDisplay";
import { hasKnownIntent } from "../utils/sessionLifecycle";

const FULL_SESSION_CARD_ROUTES = new Set(["/home", "/feed"]);

/** Compact AI session indicator in the header (hidden where SessionIntentCard is shown). */
export default function SessionStatusPill() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isCheckingIntent } = useSession();
  const display = buildIntentPredictionDisplay(session, {
    isEvaluating: isCheckingIntent,
  });

  if (!display || FULL_SESSION_CARD_ROUTES.has(location.pathname)) {
    return null;
  }

  const intentLabel = hasKnownIntent(session.currentIntent)
    ? session.currentIntent
    : display.headline;

  return (
    <button
      type="button"
      onClick={() => navigate("/feed")}
      className="session-status-pill flex w-full items-center gap-2 rounded-xl border border-emerald-500/35 bg-zinc-900/70 px-3 py-2 text-left shadow-sm backdrop-blur-sm sm:ml-auto sm:w-auto sm:max-w-[15rem] sm:rounded-full sm:py-1.5"
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
      <span className="hidden shrink-0 text-[10px] text-zinc-500 sm:inline" aria-hidden>
        Feed →
      </span>
    </button>
  );
}
