import type { ReactNode } from "react";
import { DislikeIcon, LikeIcon, ReplayIcon, SkipIcon } from "./FeedbackIcons";
import { usePlayer } from "../contexts/PlayerContext";
import { useProfile } from "../contexts/ProfileContext";
import { useRecommendations } from "../contexts/RecommendationsContext";
import { useFeedback } from "../hooks/useFeedback";
import type { Track } from "../types";
import { trackLabel } from "../utils/track";

interface PlayerFeedbackButtonsProps {
  track: Track;
  size?: "sm" | "md";
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClassName?: string;
  size: "sm" | "md";
  children: ReactNode;
}

function ActionButton({
  label,
  onClick,
  active,
  activeClassName,
  size,
  children,
}: ActionButtonProps) {
  const iconWrapClass =
    size === "md"
      ? "flex h-5 w-5 shrink-0 items-center justify-center"
      : "flex h-4 w-4 shrink-0 items-center justify-center";

  const activeStyles =
    activeClassName ??
    (active ? "bg-emerald-500 text-black shadow-sm shadow-emerald-500/20" : "");

  if (size === "md") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={[
          "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
          active
            ? activeStyles
            : "text-zinc-300 hover:bg-zinc-800 hover:text-white",
        ].join(" ")}
      >
        <span className={iconWrapClass}>{children}</span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
        active
          ? activeStyles || "bg-emerald-500 text-black"
          : "text-zinc-200 hover:bg-zinc-800 hover:text-white",
      ].join(" ")}
    >
      <span className={iconWrapClass}>{children}</span>
    </button>
  );
}

export default function PlayerFeedbackButtons({
  track,
  size = "sm",
}: PlayerFeedbackButtonsProps) {
  const { profile } = useProfile();
  const { removeRecommendation } = useRecommendations();
  const { replayCurrentTrack, removeFromQueue } = usePlayer();
  const { sendFeedback, toggleLike, toggleDislike } = useFeedback();
  const isLiked = profile.likedTrackIds.includes(track.id);
  const isDisliked = profile.dislikedTrackIds.includes(track.id);
  const label = trackLabel(track);
  const iconClass = "h-full w-full max-h-full max-w-full";

  async function handleLikeToggle() {
    await toggleLike(track.id, label, undefined, track);
  }

  async function handleDislikeToggle() {
    const wasDisliked = isDisliked;
    await toggleDislike(track.id, label, track);
    if (!wasDisliked) {
      removeRecommendation(track.id);
      removeFromQueue(track.id);
    }
  }

  async function handleSkip() {
    await sendFeedback(
      {
        track_id: track.id,
        event_type: "skip",
        track_label: label,
      },
      { track },
    );
    removeRecommendation(track.id);
    removeFromQueue(track.id);
  }

  async function handleReplay() {
    await sendFeedback(
      {
        track_id: track.id,
        event_type: "replay",
        track_label: label,
      },
      { track },
    );
    replayCurrentTrack();
  }

  return (
    <div
      className={[
        "inline-flex shrink-0 items-center bg-zinc-900/80",
        size === "md"
          ? "gap-1 rounded-2xl border border-zinc-800/80 p-1.5"
          : "gap-0.5 rounded-full border border-zinc-800/80 p-0.5",
      ].join(" ")}
      role="group"
      aria-label="Track feedback"
    >
      <ActionButton
        label={isLiked ? "Unlike" : "Like"}
        size={size}
        onClick={() => void handleLikeToggle()}
        active={isLiked}
      >
        <LikeIcon className={iconClass} filled={isLiked} />
      </ActionButton>

      <ActionButton
        label={isDisliked ? "Remove dislike" : "Dislike"}
        size={size}
        onClick={() => void handleDislikeToggle()}
        active={isDisliked}
        activeClassName="bg-rose-500 text-white shadow-sm shadow-rose-500/20"
      >
        <DislikeIcon className={iconClass} filled={isDisliked} />
      </ActionButton>

      <ActionButton label="Skip" size={size} onClick={() => void handleSkip()}>
        <SkipIcon className={iconClass} />
      </ActionButton>

      <ActionButton label="Replay" size={size} onClick={() => void handleReplay()}>
        <ReplayIcon className={iconClass} />
      </ActionButton>
    </div>
  );
}
