import { useCallback } from "react";
import { usePlayer } from "../contexts/PlayerContext";
import { useProfile } from "../contexts/ProfileContext";
import { useRecommendations } from "../contexts/RecommendationsContext";
import { useSession } from "./useSession";
import { getActiveIntent } from "../utils/sessionLifecycle";
import type { Recommendation } from "../types";
import { trackLabel } from "../utils/track";

export function useSkipRecommendation() {
  const { addSkipFeedback } = useProfile();
  const { session, logAction } = useSession();
  const activeIntent = getActiveIntent(session);
  const { removeRecommendation } = useRecommendations();
  const { removeFromQueue } = usePlayer();

  const skipRecommendation = useCallback(
    async (recommendation: Recommendation) => {
      const label = trackLabel(recommendation.track);
      const trackId = recommendation.track.id;

      addSkipFeedback(trackId, activeIntent);
      logAction("SKIP", label);
      removeRecommendation(trackId);
      removeFromQueue(trackId);
    },
    [
      activeIntent,
      addSkipFeedback,
      logAction,
      removeFromQueue,
      removeRecommendation,
    ],
  );

  return { skipRecommendation };
}
