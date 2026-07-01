import { APP_NAME } from "../constants/brand";
import { useSession } from "../hooks/useSession";
import { formatConfidence } from "../utils/music";
import { formatRelativeTime } from "../utils/sessionDisplay";

export default function SessionIntentCard() {
  const { session } = useSession();
  const intent = session.currentIntent.trim();

  if (!intent) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-6">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-emerald-400/5 blur-2xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            Your Current Listening Intent
          </p>
          <div className="mt-3 flex min-w-0 items-start gap-2">
            <span className="shrink-0 text-xl" aria-hidden>
              🎧
            </span>
            <h2 className="break-words text-xl font-semibold text-white sm:text-2xl">{intent}</h2>
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            Recommendations are currently optimized for your session.
          </p>
          {session.preferredArtists.length > 0 && (
            <p className="mt-3 text-sm text-zinc-500">
              Preferred artists{" "}
              <span className="text-zinc-300">
                {session.preferredArtists.slice(0, 4).join(", ")}
              </span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
            Understood by {APP_NAME} AI
          </span>
          <div className="text-left text-sm sm:text-right">
            <p className="text-zinc-500">
              Confidence{" "}
              <span className="font-medium text-emerald-300">
                {formatConfidence(session.confidence)}
              </span>
            </p>
            <p className="mt-1 text-zinc-500">
              Last updated{" "}
              <span className="text-zinc-300">
                {formatRelativeTime(session.lastUpdated)}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
