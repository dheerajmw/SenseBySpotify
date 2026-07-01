import type { ReactNode } from "react";
import { LikeIcon, ReplayIcon, SkipIcon } from "./FeedbackIcons";
import { usePlayer } from "../contexts/PlayerContext";
import { useProfile } from "../contexts/ProfileContext";
import { useFeedback } from "../hooks/useFeedback";
import type { Track } from "../types";
import { trackLabel } from "../utils/track";

interface PlayerFeedbackButtonsProps {
  track: Track;
  onSkipAfter?: () => void;
  size?: "sm" | "md";
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  size: "sm" | "md";
  children: ReactNode;
}

function ActionButton({
  label,
  onClick,
  active,
  size,
  children,
}: ActionButtonProps) {
  const iconWrapClass =
    size === "md"
      ? "flex h-5 w-5 shrink-0 items-center justify-center"
      : "flex h-4 w-4 shrink-0 items-center justify-center";

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
            ? "bg-emerald-500 text-black shadow-sm shadow-emerald-500/20"
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
          ? "bg-emerald-500 text-black"
          : "text-zinc-200 hover:bg-zinc-800 hover:text-white",
      ].join(" ")}
    >
      <span className={iconWrapClass}>{children}</span>
    </button>
  );
}

export default function PlayerFeedbackButtons({
  track,
  onSkipAfter,
  size = "sm",
}: PlayerFeedbackButtonsProps) {
  const { profile } = useProfile();
  const { replayCurrentTrack } = usePlayer();
  const { sendFeedback } = useFeedback();
  const isLiked = profile.likedTrackIds.includes(track.id);
  const label = trackLabel(track);

  const iconClass = "h-full w-full max-h-full max-w-full";

  async function handleLike() {
    if (isLiked) {
      return;
    }
    await sendFeedback({
      track_id: track.id,
      event_type: "like",
      track_label: label,
    });
  }

  async function handleSkip() {
    await sendFeedback({
      track_id: track.id,
      event_type: "skip",
      track_label: label,
    });
    onSkipAfter?.();
  }

  async function handleReplay() {
    await sendFeedback({
      track_id: track.id,
      event_type: "replay",
      track_label: label,
    });
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
        label={isLiked ? "Liked" : "Like"}
        size={size}
        onClick={() => void handleLike()}
        active={isLiked}
      >
        <LikeIcon className={iconClass} filled={isLiked} />
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
