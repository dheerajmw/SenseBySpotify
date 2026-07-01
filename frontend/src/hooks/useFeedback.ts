import { useCallback } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { useSession } from "./useSession";
import type { FeedbackChip } from "../types";

interface FeedbackPayload {
  track_id: string;
  event_type: "like" | "skip" | "replay";
  chips?: FeedbackChip[];
  track_label?: string;
}

interface FeedbackOptions {
  refresh?: boolean;
  onRefreshed?: () => void;
}

export function useFeedback(regenerate?: () => Promise<void>) {
  const { profile, addFeedback, addLikedTrack, updateProfile } = useProfile();
  const { logAction } = useSession();

  const sendFeedback = useCallback(
    async (payload: FeedbackPayload, options: FeedbackOptions = {}) => {
      const label = payload.track_label ?? payload.track_id;

      if (payload.event_type === "like") {
        addLikedTrack(payload.track_id);
        addFeedback(payload.track_id, payload.chips ?? [], profile.currentIntent);
        logAction("LIKE", label);
        if (payload.chips?.length) {
          logAction("FEEDBACK", payload.chips.join(", "));
        }
      }

      if (payload.event_type === "skip") {
        updateProfile({
          feedbackEvents: [
            ...profile.feedbackEvents,
            {
              track_id: payload.track_id,
              event_type: "skip",
              chips: [],
              query: profile.currentIntent,
              timestamp: new Date().toISOString(),
            },
          ],
        });
        logAction("SKIP", label);
      }

      if (payload.event_type === "replay") {
        logAction("REPLAY", label);
      }

      if (options.refresh && regenerate) {
        await regenerate();
        options.onRefreshed?.();
      }
    },
    [addFeedback, addLikedTrack, logAction, profile, regenerate, updateProfile],
  );

  return { sendFeedback };
}
