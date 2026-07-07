import { useEffect, useRef } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { usePlayer } from "../contexts/PlayerContext";
import { useSession } from "../hooks/useSession";
import { getActiveIntent } from "../utils/sessionLifecycle";
import { recommendFromLastTrack } from "../services/followUpRecommendationService";
import type { Track } from "../types";
import { playbackBridge } from "../utils/playbackBridge";

function buildFollowUpQueue(
  followTrack: Track,
  currentQueue: Track[],
  currentIndex: number,
  endedTrackId: string,
): Track[] {
  const seen = new Set<string>([followTrack.id, endedTrackId]);
  const remainder = currentQueue
    .slice(currentIndex + 1)
    .filter((track) => {
      if (seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
  return [followTrack, ...remainder];
}

export default function AutoplayController() {
  const { profile } = useProfile();
  const { playNext, replaceQueue, getQueueSnapshot } = usePlayer();
  const {
    session,
    refreshRecommendations,
    markPersonalizedSecondSongUsed,
  } = useSession();

  const handlingRef = useRef(false);
  const playNextRef = useRef(playNext);
  const replaceQueueRef = useRef(replaceQueue);
  const refreshRef = useRef(refreshRecommendations);
  const getQueueSnapshotRef = useRef(getQueueSnapshot);
  const profileRef = useRef(profile);
  const sessionRef = useRef(session);
  const markSecondSongRef = useRef(markPersonalizedSecondSongUsed);

  playNextRef.current = playNext;
  replaceQueueRef.current = replaceQueue;
  refreshRef.current = refreshRecommendations;
  getQueueSnapshotRef.current = getQueueSnapshot;
  profileRef.current = profile;
  sessionRef.current = session;
  markSecondSongRef.current = markPersonalizedSecondSongUsed;

  useEffect(() => {
    return playbackBridge.subscribe(() => {
      if (handlingRef.current || !playbackBridge.autoplayEnabled) {
        return;
      }

      const snapshot = getQueueSnapshotRef.current();
      if (
        snapshot.queueSource === "intent" &&
        snapshot.index < snapshot.queue.length - 1
      ) {
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
              replaceQueueRef.current(tracks, 0, { autoplay: true });
            }
            return;
          }

          const endedTrack = playbackBridge.lastEndedTrack;
          playbackBridge.lastEndedTrack = null;
          const sessionSnapshot = sessionRef.current;

          if (!sessionSnapshot.personalizedSecondSongUsed && endedTrack) {
            const intent = getActiveIntent(sessionSnapshot);
            if (intent) {
              try {
                const response = await recommendFromLastTrack(
                  {
                    ...profileRef.current,
                    currentIntent: intent,
                    noveltyTolerance: sessionSnapshot.discoveryLevel,
                  },
                  endedTrack,
                  intent,
                );
                const followTrack = response.recommendation.track;
                const { queue, index, queueSource } = getQueueSnapshotRef.current();
                markSecondSongRef.current();
                if (queueSource === "search") {
                  replaceQueueRef.current([followTrack], 0, { autoplay: true });
                  return;
                }
                const nextQueue = buildFollowUpQueue(
                  followTrack,
                  queue,
                  index,
                  endedTrack.id,
                );
                replaceQueueRef.current(nextQueue, 0, { autoplay: true });
                return;
              } catch (error) {
                if (import.meta.env.DEV) {
                  console.warn("[Autoplay] follow-up recommendation failed:", error);
                }
                markSecondSongRef.current();
              }
            } else {
              markSecondSongRef.current();
            }
          }

          const { queueSource } = getQueueSnapshotRef.current();
          const advanced =
            queueSource === "intent" ? playNextRef.current({ autoplay: true }) : false;
          if (!advanced) {
            const response = await refreshRef.current();
            const tracks = response?.recommendations.map((item) => item.track) ?? [];
            if (tracks.length > 0) {
              replaceQueueRef.current(tracks, 0, { autoplay: true });
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
