import { APP_NAME } from "../constants/brand";
import { useSession } from "../hooks/useSession";

export default function DiscoveryChangeModal() {
  const { discoveryChangeModal } = useSession();

  if (!discoveryChangeModal) {
    return null;
  }

  const { before, after, reason, phase } = discoveryChangeModal;
  const refreshing = phase === "refreshing";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[splash-enter_0.25s_ease-out]"
      role="dialog"
      aria-labelledby="discovery-change-title"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <p className="text-center text-sm text-violet-300">
          ✨ {APP_NAME} has adjusted your Discovery Level.
        </p>
        <h2 id="discovery-change-title" className="mt-4 text-center text-xl font-semibold">
          Discovery Level Updated
        </h2>

        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Before</p>
            <p className="mt-1 text-lg font-medium text-zinc-300">{before}</p>
          </div>

          <div className="flex justify-center text-2xl text-violet-400" aria-hidden>
            ↓
          </div>

          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-violet-300/80">Now</p>
            <p className="mt-1 text-lg font-semibold text-violet-100">{after}</p>
          </div>
        </div>

        {reason && (
          <div className="mt-6 rounded-xl bg-zinc-900/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Reason
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{reason}</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-400">
          {refreshing && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400" />
          )}
          <span>{refreshing ? "Refreshing recommendations..." : "Updating discovery style..."}</span>
        </div>
      </div>
    </div>
  );
}
