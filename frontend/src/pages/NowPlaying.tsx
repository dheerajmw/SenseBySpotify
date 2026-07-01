import { Link } from "react-router-dom";
import PlayerFeedbackButtons from "../components/PlayerFeedbackButtons";
import { usePlayer } from "../contexts/PlayerContext";
import { useProfile } from "../contexts/ProfileContext";
import { useSession } from "../hooks/useSession";
import { formatDuration } from "../utils/music";
import { trackLabel } from "../utils/track";

export default function NowPlaying() {
  const { profile } = useProfile();
  const { session } = useSession();
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    progress,
    currentTime,
    duration,
    queue,
    queueIndex,
    autoplayEnabled,
    setAutoplayEnabled,
    playTrack,
  } = usePlayer();

  const activeIntent = session.currentIntent || profile.currentIntent;

  if (!currentTrack) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
        <h2 className="text-2xl font-semibold">Nothing playing</h2>
        <p className="mt-3 text-zinc-400">
          Search for a song or pick a recommendation to start listening.
        </p>
        <Link
          to="/search"
          className="mt-6 inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          Search songs
        </Link>
      </section>
    );
  }

  const artistNames = currentTrack.artists.map((artist) => artist.name).join(", ");
  const hasNext = queueIndex < queue.length - 1;
  const hasPrev = queueIndex > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm uppercase tracking-widest text-emerald-400">Now Playing</p>
          <div className="flex flex-wrap items-center gap-2">
            {activeIntent && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                Intent: {activeIntent}
              </span>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-300">
              <span>Autoplay</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoplayEnabled}
                onClick={() => setAutoplayEnabled(!autoplayEnabled)}
                className={[
                  "relative h-5 w-9 rounded-full p-0.5 transition-colors",
                  autoplayEnabled ? "bg-emerald-500" : "bg-zinc-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "block h-4 w-4 rounded-full bg-white shadow transition-transform",
                    autoplayEnabled ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
              <span className={autoplayEnabled ? "text-emerald-300" : "text-zinc-500"}>
                {autoplayEnabled ? "ON" : "OFF"}
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {currentTrack.album?.image_url ? (
            <img
              src={currentTrack.album.image_url}
              alt={currentTrack.album.name}
              className="h-48 w-48 rounded-2xl object-cover shadow-xl"
            />
          ) : (
            <div className="h-48 w-48 rounded-2xl bg-zinc-800" />
          )}

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-3xl font-semibold">{currentTrack.name}</h2>
            <p className="mt-2 text-lg text-zinc-400">{artistNames}</p>
            <p className="mt-1 text-sm text-zinc-500">{currentTrack.album?.name}</p>

            <div className="mt-6 flex items-center justify-center gap-4 sm:justify-start">
              <button
                type="button"
                onClick={playPrevious}
                disabled={!hasPrev}
                className="text-zinc-400 hover:text-white disabled:opacity-30"
                aria-label="Previous"
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                  <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" />
                    <rect x="14" y="5" width="4" height="14" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                    <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={playNext}
                disabled={!hasNext && !autoplayEnabled}
                className="text-zinc-400 hover:text-white disabled:opacity-30"
                aria-label="Next"
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zm2-6v0zm3.5 0 8.5 6V6l-8.5 6z" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex justify-center sm:justify-start">
              <PlayerFeedbackButtons
                track={currentTrack}
                onSkipAfter={playNext}
                size="md"
              />
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-zinc-500">
              <span>{formatDuration(currentTime * 1000)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
              <span>{formatDuration((duration || 30) * 1000)}</span>
            </div>
          </div>
        </div>

        {queue.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-zinc-400">Queue</h3>
            <ul className="mt-3 space-y-2">
              {queue.map((track, index) => {
                const active = index === queueIndex;
                return (
                  <li key={`${track.id}-${index}`}>
                    <button
                      type="button"
                      onClick={() => playTrack(track, { queue, startIndex: index })}
                      className={[
                        "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition",
                        active
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                          : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700",
                      ].join(" ")}
                    >
                      <span>
                        <span className="mr-2 text-zinc-500">{index + 1}.</span>
                        {trackLabel(track)}
                      </span>
                      {active && (
                        <span className="text-xs uppercase tracking-widest text-emerald-300">
                          Playing
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
