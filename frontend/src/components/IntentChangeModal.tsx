import { APP_NAME } from "../constants/brand";
import { useSession } from "../hooks/useSession";
import { INTENT_CONFIDENCE_THRESHOLD } from "../utils/intentEvidence";

export default function IntentChangeModal() {
  const { intentChangeModal, session } = useSession();

  if (!intentChangeModal) {
    return null;
  }

  const { before, after, reason, phase } = intentChangeModal;
  const refreshing = phase === "refreshing";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[splash-enter_0.25s_ease-out]"
      role="dialog"
      aria-labelledby="intent-change-title"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <p className="text-center text-sm text-emerald-300">
          ✨ {APP_NAME} detected a mood shift (reached {INTENT_CONFIDENCE_THRESHOLD} points).
        </p>
        <h2 id="intent-change-title" className="mt-4 text-center text-xl font-semibold">
          Intent Updated
        </h2>

        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Before</p>
            <p className="mt-1 text-lg font-medium text-zinc-300">🌙 {before}</p>
          </div>

          <div className="flex justify-center text-2xl text-emerald-400" aria-hidden>
            ↓
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-emerald-400/80">Now</p>
            <p className="mt-1 text-lg font-semibold text-emerald-100">🏋️ {after}</p>
          </div>
        </div>

        {reason && (
          <div className="mt-6 rounded-xl bg-zinc-900/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Why Sense switched
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{reason}</p>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-zinc-500">
          Session confidence: {Math.round(session.intentConfidence)} / {INTENT_CONFIDENCE_THRESHOLD}{" "}
          points
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-400">
          {refreshing && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
          )}
          <span>
            {refreshing
              ? "Refreshing recommendations..."
              : "Your session mood has been updated"}
          </span>
        </div>
      </div>
    </div>
  );
}
