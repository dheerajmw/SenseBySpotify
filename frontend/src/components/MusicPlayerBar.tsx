import { useLocation, useNavigate } from "react-router-dom";
import { usePlayer } from "../contexts/PlayerContext";
import { formatDuration } from "../utils/music";
import PlayerFeedbackButtons from "./PlayerFeedbackButtons";

function TransportButton({
  children,
  onClick,
  disabled,
  label,
  large = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "flex shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30",
        large
          ? "h-10 w-10 bg-white text-black hover:scale-105"
          : "h-8 w-8 text-zinc-300 hover:bg-zinc-800 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function MusicPlayerBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isExpanded = location.pathname === "/now-playing";

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
  } = usePlayer();

  if (!currentTrack) {
    return null;
  }

  const artistNames = currentTrack.artists.map((artist) => artist.name).join(", ");
  const hasNext = queueIndex < queue.length - 1 || autoplayEnabled;
  const hasPrev = queueIndex > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Track info */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            {currentTrack.album?.image_url ? (
              <img
                src={currentTrack.album.image_url}
                alt={currentTrack.album.name}
                className="h-11 w-11 shrink-0 rounded-md object-cover sm:h-12 sm:w-12"
              />
            ) : (
              <div className="h-11 w-11 shrink-0 rounded-md bg-zinc-800 sm:h-12 sm:w-12" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{currentTrack.name}</p>
              <p className="truncate text-xs text-zinc-400">{artistNames}</p>
            </div>
          </div>

          {/* Transport controls */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <TransportButton
              onClick={playPrevious}
              disabled={!hasPrev}
              label="Previous"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
              </svg>
            </TransportButton>

            <TransportButton
              onClick={togglePlay}
              label={isPlaying ? "Pause" : "Play"}
              large
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="0.5" />
                  <rect x="14" y="5" width="4" height="14" rx="0.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
                </svg>
              )}
            </TransportButton>

            <TransportButton
              onClick={() => {
                playNext();
              }}
              disabled={!hasNext}
              label="Next"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M6 18l8.5-6L6 6v12zm2-6v0zm3.5 0 8.5 6V6l-8.5 6z" />
              </svg>
            </TransportButton>
          </div>

          {/* Feedback + expand */}
          <div className="flex shrink-0 items-center gap-1.5">
            <PlayerFeedbackButtons
              track={currentTrack}
              onSkipAfter={() => {
                playNext();
              }}
            />

            <button
              type="button"
              onClick={() => (isExpanded ? navigate(-1) : navigate("/now-playing"))}
              aria-label={isExpanded ? "Minimize player" : "Expand player"}
              title={isExpanded ? "Minimize" : "Expand"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              {isExpanded ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 15 6-6 6 6" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Progress — own row so controls don't get squished */}
        <div className="mt-2 flex items-center gap-2 px-0.5 text-[10px] text-zinc-500 sm:mt-2.5">
          <span className="w-8 shrink-0 tabular-nums">{formatDuration(currentTime * 1000)}</span>
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums">
            {formatDuration((duration || 30) * 1000)}
          </span>
        </div>
      </div>
    </div>
  );
}
