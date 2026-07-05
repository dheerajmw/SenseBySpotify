import { useState } from "react";
import { Link } from "react-router-dom";
import { DislikeIcon, LikeIcon, SkipIcon } from "./FeedbackIcons";
import { usePlayer } from "../contexts/PlayerContext";
import { useProfile } from "../contexts/ProfileContext";
import { useRecommendations } from "../contexts/RecommendationsContext";
import { useSession } from "../hooks/useSession";
import { getActiveIntent } from "../utils/sessionLifecycle";
import type { Recommendation } from "../types";
import {
  formatConfidence,
  formatDuration,
} from "../utils/music";
import { buildRecommendationFitBullets } from "../utils/sessionDisplay";
import { trackAccessibleLabel, trackArtistLine, trackLabel } from "../utils/track";

interface RecommendationCardProps {
  recommendation: Recommendation;
  onLike?: (recommendation: Recommendation) => void;
  onDislike?: (recommendation: Recommendation) => void;
  onSkip?: (recommendation: Recommendation) => void;
  showDetailsLink?: boolean;
  compact?: boolean;
}

function PlayIcon({ playing }: { playing: boolean }) {
  if (playing) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function RecommendationCard({
  recommendation,
  onLike,
  onDislike,
  onSkip,
  showDetailsLink = true,
  compact = false,
}: RecommendationCardProps) {
  const { recommendations } = useRecommendations();
  const { profile } = useProfile();
  const { session, logAction } = useSession();
  const { playTrack, isTrackPlaying, togglePlay, currentTrack } = usePlayer();
  const [showWhy, setShowWhy] = useState(false);
  const { track, rank, confidence } = recommendation;
  const artistLine = trackArtistLine(track);
  const sessionIntent = getActiveIntent(session);
  const fitBullets = buildRecommendationFitBullets(
    recommendation,
    profile,
    sessionIntent,
  );
  const playing = isTrackPlaying(track.id);
  const isLiked = profile.likedTrackIds.includes(track.id);
  const isDisliked = profile.dislikedTrackIds.includes(track.id);
  const canPlay = Boolean(track.preview_url || track.external_url);
  const artSize = compact ? "h-16 w-16" : "h-20 w-20";
  const queue = recommendations.map((item) => item.track);

  function handlePlay() {
    if (playing) {
      togglePlay();
      return;
    }
    playTrack(track, {
      queue: queue.length > 0 ? queue : [track],
      startIndex: queue.findIndex((item) => item.id === track.id),
      queueSource: "intent",
    });
  }

  function handleDetailsClick() {
    logAction("RECOMMENDATION_CLICKED", trackLabel(track));
  }

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:shadow-lg hover:shadow-emerald-500/5">
      <div className="flex gap-4">
        <div className={`group relative ${artSize} shrink-0`}>
          {track.album?.image_url ? (
            <img
              src={track.album.image_url}
              alt={track.album.name}
              className={`${artSize} rounded-xl object-cover`}
            />
          ) : (
            <div className={`${artSize} rounded-xl bg-zinc-800`} />
          )}
          <button
            type="button"
            onClick={handlePlay}
            disabled={!canPlay}
            aria-label={playing ? `Pause ${trackAccessibleLabel(track)}` : `Preview ${trackAccessibleLabel(track)}`}
            className={[
              "absolute inset-0 flex items-center justify-center rounded-xl transition",
              canPlay
                ? "bg-black/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                : "cursor-not-allowed",
              playing ? "opacity-100 bg-black/50" : "",
            ].join(" ")}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg">
              <PlayIcon playing={playing} />
            </span>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
              #{rank}
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
              {formatConfidence(confidence)} confidence
            </span>
            {track.duration_ms && (
              <span className="text-xs text-zinc-500">
                {formatDuration(track.duration_ms)}
              </span>
            )}
          </div>

          <h3
            className={[
              "mt-2 truncate text-base font-semibold",
              currentTrack?.id === track.id ? "text-emerald-300" : "",
            ].join(" ")}
          >
            {track.name}
          </h3>
          <p className="truncate text-sm text-zinc-400">{artistLine}</p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={handlePlay}
              disabled={!canPlay}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlayIcon playing={playing} />
              {playing ? "Pause" : "Preview"}
            </button>

            {onLike && (
              <button
                type="button"
                onClick={() => onLike(recommendation)}
                aria-label={isLiked ? "Unlike" : "Like"}
                aria-pressed={isLiked}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  isLiked
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10",
                ].join(" ")}
              >
                <LikeIcon className="h-3.5 w-3.5" filled={isLiked} />
                {isLiked ? "Unlike" : "Like"}
              </button>
            )}

            {onDislike && (
              <button
                type="button"
                onClick={() => onDislike(recommendation)}
                aria-label={isDisliked ? "Remove dislike" : "Dislike"}
                aria-pressed={isDisliked}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  isDisliked
                    ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
                    : "border-rose-500/40 text-rose-300 hover:bg-rose-500/10",
                ].join(" ")}
              >
                <DislikeIcon className="h-3.5 w-3.5" filled={isDisliked} />
                {isDisliked ? "Undislike" : "Dislike"}
              </button>
            )}

            {onSkip && currentTrack?.id === track.id && (
              <button
                type="button"
                onClick={() => onSkip(recommendation)}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                aria-label="Skip"
              >
                <SkipIcon className="h-3.5 w-3.5" />
                Skip
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowWhy((value) => !value)}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            >
              {showWhy ? "Hide why" : "Why recommended"}
            </button>

            {showDetailsLink && (
              <Link
                to={`/recommendations/${track.id}`}
                onClick={handleDetailsClick}
                className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Details
              </Link>
            )}
          </div>

          {showWhy && (
            <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 backdrop-blur">
              <p className="text-sm font-medium text-emerald-300">Why this song fits</p>
              <p className="mt-1 text-xs text-zinc-500">Recommended because</p>
              <ul className="mt-3 space-y-2">
                {fitBullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-zinc-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                      <CheckIcon />
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
