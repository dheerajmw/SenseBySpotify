import { Link } from "react-router-dom";
import { APP_NAME, DISCOVER_LABEL } from "../constants/brand";
import { useSession } from "../hooks/useSession";
import { formatConfidence } from "../utils/music";
import { formatRelativeTime } from "../utils/sessionDisplay";

interface HomeHeroSectionProps {
  greeting: string;
  activeIntent: string;
}

export default function HomeHeroSection({
  greeting,
  activeIntent,
}: HomeHeroSectionProps) {
  const { session } = useSession();
  const intent = activeIntent.trim();

  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/30 p-4 sm:rounded-3xl sm:p-6 md:p-8">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-emerald-400/5 blur-2xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
            Home
          </p>
          <h2 className="mt-2 break-words text-2xl font-semibold sm:text-3xl md:text-4xl">
            {greeting}
          </h2>

          {intent ? (
            <div className="mt-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-400/80">
                Your Current Listening Intent
              </p>
              <div className="mt-2 flex min-w-0 items-start gap-2">
                <span className="shrink-0 text-lg" aria-hidden>
                  🎧
                </span>
                <p className="break-words text-lg font-semibold text-white sm:text-xl md:text-2xl">
                  {intent}
                </p>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                Recommendations are optimized for this session.
              </p>
              {session.preferredArtists.length > 0 && (
                <p className="mt-2 text-sm text-zinc-500">
                  Preferred artists{" "}
                  <span className="text-zinc-300">
                    {session.preferredArtists.slice(0, 4).join(", ")}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Search any song, play previews, or let AI discover music for your current mood.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/search"
              className="inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              Search Songs
            </Link>
            <Link
              to="/discovery"
              className="inline-flex rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              {DISCOVER_LABEL}
            </Link>
          </div>
        </div>

        {intent && (
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
              Understood by {APP_NAME} AI
            </span>
            <p className="text-sm text-zinc-500 lg:text-right">
              Confidence{" "}
              <span className="font-medium text-emerald-300">
                {formatConfidence(session.confidence)}
              </span>
            </p>
            <p className="text-sm text-zinc-500 lg:text-right">
              Updated{" "}
              <span className="text-zinc-300">
                {formatRelativeTime(session.lastUpdated)}
              </span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
