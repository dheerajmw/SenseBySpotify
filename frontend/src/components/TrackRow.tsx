import { usePlayer } from "../contexts/PlayerContext";
import type { Track } from "../types";
import { formatDuration } from "../utils/music";
import { trackLabel } from "../utils/track";

interface TrackRowProps {
  track: Track;
  index?: number;
  queue?: Track[];
  onPlay?: (track: Track) => void;
  showIndex?: boolean;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export default function TrackRow({
  track,
  index,
  queue,
  onPlay,
  showIndex = false,
}: TrackRowProps) {
  const { playTrack, isTrackPlaying, togglePlay, currentTrack } = usePlayer();
  const playing = isTrackPlaying(track.id);
  const artistNames = track.artists.map((artist) => artist.name).join(", ");

  function handlePlay() {
    if (playing) {
      togglePlay();
      return;
    }
    onPlay?.(track);
    playTrack(track, queue ? { queue, startIndex: queue.findIndex((t) => t.id === track.id) } : undefined);
  }

  return (
    <div
      className={[
        "group flex items-center gap-4 rounded-xl px-3 py-2 transition-colors",
        currentTrack?.id === track.id ? "bg-emerald-500/10" : "hover:bg-zinc-800/60",
      ].join(" ")}
    >
      <div className="flex w-8 shrink-0 items-center justify-center text-sm text-zinc-500">
        {showIndex && typeof index === "number" ? (
          <span className="group-hover:hidden">{index + 1}</span>
        ) : null}
        <button
          type="button"
          onClick={handlePlay}
          aria-label={playing ? `Pause ${track.name}` : `Play ${track.name}`}
          className={[
            "flex h-8 w-8 items-center justify-center rounded-full text-black transition",
            showIndex && typeof index === "number" ? "hidden group-hover:flex" : "flex",
            playing ? "bg-emerald-400" : "bg-emerald-500 hover:bg-emerald-400",
          ].join(" ")}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      {track.album?.image_url ? (
        <img
          src={track.album.image_url}
          alt={track.album.name}
          className="h-11 w-11 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-md bg-zinc-800" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{track.name}</p>
        <p className="truncate text-sm text-zinc-400">{artistNames}</p>
      </div>

      <span className="shrink-0 text-sm text-zinc-500">
        {formatDuration(track.duration_ms)}
      </span>
    </div>
  );
}

export { trackLabel };
