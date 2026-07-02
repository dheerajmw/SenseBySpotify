import { useCallback } from "react";
import { usePlayer } from "../contexts/PlayerContext";
import { useProfile } from "../contexts/ProfileContext";
import { useSession } from "./useSession";
import { getActiveIntent } from "../utils/sessionLifecycle";
import type { FeedbackChip, QueueSource, Track } from "../types";

interface FeedbackPayload {
  track_id: string;
  event_type: "like" | "unlike" | "dislike" | "undislike" | "skip" | "replay";
  chips?: FeedbackChip[];
  track_label?: string;
}

interface FeedbackOptions {
  refresh?: boolean;
  onRefreshed?: () => void;
  queueSource?: QueueSource;
  track?: Track;
}

export function useFeedback(regenerate?: () => Promise<void>) {
  const {
    profile,
    addFeedback,
    addLikedTrack,
    removeLikedTrack,
    addDislikedTrack,
    removeDislikedTrack,
    addSkipFeedback,
    appendFeedbackEvent,
  } = useProfile();
  const { session, logAction } = useSession();
  const { getQueueSnapshot } = usePlayer();
  const activeIntent = getActiveIntent(session);

  const logFeedbackAction = useCallback(
    (
      type: Parameters<typeof logAction>[0],
      label: string,
      options?: Pick<FeedbackOptions, "queueSource" | "track">,
    ) => {
      logAction(type, label, {
        queueSource: options?.queueSource ?? getQueueSnapshot().queueSource,
        track: options?.track,
      });
    },
    [getQueueSnapshot, logAction],
  );

  const sendFeedback = useCallback(
    async (payload: FeedbackPayload, options: FeedbackOptions = {}) => {
      const label = payload.track_label ?? payload.track_id;
      const timestamp = new Date().toISOString();
      const actionContext = {
        queueSource: options.queueSource ?? getQueueSnapshot().queueSource,
        track: options.track,
      };

      if (payload.event_type === "like") {
        addLikedTrack(payload.track_id);
        addFeedback(payload.track_id, payload.chips ?? [], activeIntent);
        logFeedbackAction("LIKE", label, actionContext);
        if (payload.chips?.length) {
          logFeedbackAction("FEEDBACK", payload.chips.join(", "), actionContext);
        }
      }

      if (payload.event_type === "unlike") {
        removeLikedTrack(payload.track_id);
        appendFeedbackEvent({
          track_id: payload.track_id,
          event_type: "unlike",
          chips: [],
          query: activeIntent,
          timestamp,
        });
        logFeedbackAction("UNLIKE", label, actionContext);
      }

      if (payload.event_type === "dislike") {
        addDislikedTrack(payload.track_id);
        appendFeedbackEvent({
          track_id: payload.track_id,
          event_type: "dislike",
          chips: [],
          query: activeIntent,
          timestamp,
        });
        logFeedbackAction("DISLIKE", label, actionContext);
      }

      if (payload.event_type === "undislike") {
        removeDislikedTrack(payload.track_id);
        appendFeedbackEvent({
          track_id: payload.track_id,
          event_type: "undislike",
          chips: [],
          query: activeIntent,
          timestamp,
        });
      }

      if (payload.event_type === "skip") {
        addSkipFeedback(payload.track_id, activeIntent);
        logFeedbackAction("SKIP", label, actionContext);
      }

      if (payload.event_type === "replay") {
        logFeedbackAction("REPLAY", label, actionContext);
      }

      if (options.refresh && regenerate) {
        await regenerate();
        options.onRefreshed?.();
      }
    },
    [
      activeIntent,
      addDislikedTrack,
      addFeedback,
      addLikedTrack,
      addSkipFeedback,
      appendFeedbackEvent,
      getQueueSnapshot,
      logFeedbackAction,
      regenerate,
      removeDislikedTrack,
      removeLikedTrack,
    ],
  );

  const toggleLike = useCallback(
    async (
      trackId: string,
      trackLabel: string,
      chips?: FeedbackChip[],
      track?: Track,
    ) => {
      if (profile.likedTrackIds.includes(trackId)) {
        await sendFeedback(
          {
            track_id: trackId,
            event_type: "unlike",
            track_label: trackLabel,
          },
          { track },
        );
        return;
      }

      await sendFeedback(
        {
          track_id: trackId,
          event_type: "like",
          track_label: trackLabel,
          chips,
        },
        { track },
      );
    },
    [profile.likedTrackIds, sendFeedback],
  );

  const toggleDislike = useCallback(
    async (trackId: string, trackLabel: string, track?: Track) => {
      if (profile.dislikedTrackIds.includes(trackId)) {
        await sendFeedback(
          {
            track_id: trackId,
            event_type: "undislike",
            track_label: trackLabel,
          },
          { track },
        );
        return;
      }

      await sendFeedback(
        {
          track_id: trackId,
          event_type: "dislike",
          track_label: trackLabel,
        },
        { track },
      );
    },
    [profile.dislikedTrackIds, sendFeedback],
  );

  return { sendFeedback, toggleLike, toggleDislike };
}
