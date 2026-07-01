import { useEffect, useRef } from "react";
import { usePlayer } from "../contexts/PlayerContext";
import { useSession } from "../hooks/useSession";
import { playbackBridge } from "../utils/playbackBridge";

export default function AutoplayController() {
  const { playNext, replaceQueue } = usePlayer();
  const { refreshRecommendations } = useSession();
  const handlingRef = useRef(false);
  const playNextRef = useRef(playNext);
  const replaceQueueRef = useRef(replaceQueue);
  const refreshRef = useRef(refreshRecommendations);

  playNextRef.current = playNext;
  replaceQueueRef.current = replaceQueue;
  refreshRef.current = refreshRecommendations;

  useEffect(() => {
    return playbackBridge.subscribe(() => {
      if (handlingRef.current || !playbackBridge.autoplayEnabled) {
        return;
      }

      handlingRef.current = true;
      void (async () => {
        try {
          if (playbackBridge.pendingIntentRefresh) {
            const pending = playbackBridge.pendingIntentRefresh;
            playbackBridge.pendingIntentRefresh = null;
            const response = await refreshRef.current(pending.intent);
            const tracks = response?.recommendations.map((item) => item.track) ?? [];
            if (tracks.length > 0) {
              replaceQueueRef.current(tracks, 0);
            }
            return;
          }

          const advanced = playNextRef.current();
          if (!advanced) {
            const response = await refreshRef.current();
            const tracks = response?.recommendations.map((item) => item.track) ?? [];
            if (tracks.length > 0) {
              replaceQueueRef.current(tracks, 0);
            }
          }
        } finally {
          handlingRef.current = false;
        }
      })();
    });
  }, []);

  return null;
}
