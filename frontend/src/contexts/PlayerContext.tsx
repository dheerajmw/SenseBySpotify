import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AUTOPLAY_STORAGE_KEY } from "../constants/brand";
import type { QueueSource, Track } from "../types";
import { SUSTAINED_LISTEN_MS } from "../utils/intentEvidence";
import { configurePreviewAudio, isPlaybackBlockedError } from "../utils/audioPlayback";
import { playbackBridge } from "../utils/playbackBridge";
import { trackLabel } from "../utils/track";
import { useSessionContext } from "./SessionContext";

const RECENT_STORAGE_KEY = "sense_recent_plays";

interface PlayOptions {
  /** Autoplay — defer confidence updates until LISTENED_20S */
  autoplay?: boolean;
  /** Called from audio.onended — keep play() in the same sync stack for mobile */
  syncQueueAdvance?: boolean;
}

interface PlayerContextValue {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  autoplayEnabled: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  recentPlays: Track[];
  playTrack: (
    track: Track,
    options?: { queue?: Track[]; startIndex?: number; queueSource?: QueueSource },
  ) => void;
  replaceQueue: (tracks: Track[], startIndex?: number, options?: PlayOptions) => void;
  togglePlay: () => void;
  pause: () => void;
  playNext: (options?: PlayOptions) => boolean;
  playPrevious: () => void;
  replayCurrentTrack: () => void;
  removeFromQueue: (trackId: string) => void;
  setAutoplayEnabled: (enabled: boolean) => void;
  closePlayer: () => void;
  isTrackPlaying: (trackId: string) => boolean;
  playbackBlocked: boolean;
  queueAdvancePending: boolean;
  resumePlayback: () => void;
  getQueueSnapshot: () => { queue: Track[]; index: number; queueSource: QueueSource };
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function loadAutoplayEnabled(): boolean {
  try {
    const stored = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
    if (stored === null) {
      return true;
    }
    return stored === "true";
  } catch {
    return true;
  }
}

function loadRecentPlays(): Track[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Track[]) : [];
  } catch {
    return [];
  }
}

function persistRecent(track: Track, current: Track[]) {
  const next = [track, ...current.filter((item) => item.id !== track.id)].slice(0, 20);
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { logAction, session, updateSessionQueue } = useSessionContext();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>(session.currentQueue);
  const [queueIndex, setQueueIndex] = useState(session.currentQueueIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayEnabled, setAutoplayEnabledState] = useState(loadAutoplayEnabled);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recentPlays, setRecentPlays] = useState<Track[]>(loadRecentPlays);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [queueAdvancePending, setQueueAdvancePending] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(0);
  const autoplayRef = useRef(autoplayEnabled);
  const queueSourceRef = useRef<QueueSource>("intent");
  const restoredQueueRef = useRef(session.currentQueue.length > 0);
  const logActionRef = useRef(logAction);
  const sustainedListenAwardedTrackIdRef = useRef<string | null>(null);
  const playAtIndexRef = useRef<
    (index: number, tracks?: Track[], options?: PlayOptions) => void
  >(() => {});

  logActionRef.current = logAction;

  currentTrackRef.current = currentTrack;
  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  autoplayRef.current = autoplayEnabled;
  playbackBridge.autoplayEnabled = autoplayEnabled;

  useEffect(() => {
    if (restoredQueueRef.current) {
      return;
    }
    if (session.currentQueue.length === 0) {
      return;
    }
    restoredQueueRef.current = true;
    setQueue(session.currentQueue);
    setQueueIndex(session.currentQueueIndex);
    queueRef.current = session.currentQueue;
    queueIndexRef.current = session.currentQueueIndex;
  }, [session.currentQueue, session.currentQueueIndex]);

  useEffect(() => {
    updateSessionQueue(queue, queueIndex);
  }, [queue, queueIndex, updateSessionQueue]);

  const logPlayIfNew = useCallback(
    (track: Track, options?: PlayOptions) => {
      if (track.id === currentTrackRef.current?.id) {
        return;
      }
      logAction("PLAY", trackLabel(track), {
        track,
        deferConfidence: options?.autoplay === true,
        queueSource: queueSourceRef.current,
      });
    },
    [logAction],
  );

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    setIsPlaying(false);
    playbackBridge.setPlaying(false);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const stopAudio = useCallback(() => {
    pauseAudio();
    resetProgress();
    if (audioRef.current) {
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
  }, [pauseAudio, resetProgress]);

  const beginPlayback = useCallback(
    (audio: HTMLAudioElement, options?: PlayOptions) => {
      setPlaybackBlocked(false);
      setQueueAdvancePending(false);

      void audio.play()
        .then(() => {
          setIsPlaying(true);
          setPlaybackBlocked(false);
          setQueueAdvancePending(false);
          playbackBridge.setPlaying(true);
        })
        .catch((error) => {
          setIsPlaying(false);
          playbackBridge.setPlaying(false);
          if (isPlaybackBlockedError(error)) {
            setPlaybackBlocked(true);
            if (options?.autoplay || options?.syncQueueAdvance) {
              setQueueAdvancePending(true);
            }
          }
        });
    },
    [],
  );

  const handleTrackEnded = useCallback(() => {
    const endedTrack = currentTrackRef.current;
    if (
      endedTrack &&
      sustainedListenAwardedTrackIdRef.current === endedTrack.id
    ) {
      logActionRef.current("PREVIEW_COMPLETED", trackLabel(endedTrack), {
        track: endedTrack,
        queueSource: queueSourceRef.current,
      });
    }

    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    playbackBridge.setPlaying(false);

    if (
      autoplayRef.current &&
      queueIndexRef.current < queueRef.current.length - 1
    ) {
      const nextIndex = queueIndexRef.current + 1;
      playAtIndexRef.current(nextIndex, queueRef.current, {
        autoplay: true,
        syncQueueAdvance: true,
      });
      return;
    }

    if (endedTrack) {
      playbackBridge.setLastEndedTrack(endedTrack);
    }
    playbackBridge.notifyTrackEnded();
  }, []);

  const ensureAudioElement = useCallback((): HTMLAudioElement | null => {
    if (audioRef.current) {
      return audioRef.current;
    }
    const audio = document.createElement("audio");
    configurePreviewAudio(audio);
    audio.className = "sr-only";
    audio.setAttribute("aria-hidden", "true");
    document.body.appendChild(audio);

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 30);
    };
    audio.ontimeupdate = () => {
      const total = audio.duration || 30;
      setCurrentTime(audio.currentTime);
      setProgress(total > 0 ? audio.currentTime / total : 0);

      const track = currentTrackRef.current;
      if (!track) {
        return;
      }

      const listenThresholdSec = SUSTAINED_LISTEN_MS / 1000;
      if (
        audio.currentTime >= listenThresholdSec &&
        sustainedListenAwardedTrackIdRef.current !== track.id
      ) {
        sustainedListenAwardedTrackIdRef.current = track.id;
        logActionRef.current("LISTENED_20S", trackLabel(track), {
          track,
          queueSource: queueSourceRef.current,
        });
      }
    };
    audio.onended = () => {
      handleTrackEnded();
    };
    audio.onerror = () => {
      setIsPlaying(false);
      playbackBridge.setPlaying(false);
      if (currentTrackRef.current) {
        playbackBridge.setLastEndedTrack(currentTrackRef.current);
      }
      playbackBridge.notifyTrackEnded();
    };

    audioRef.current = audio;
    return audio;
  }, [handleTrackEnded]);

  useEffect(() => {
    ensureAudioElement();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.remove();
        audioRef.current = null;
      }
    };
  }, [ensureAudioElement]);

  const playAtIndex = useCallback(
    (index: number, tracks: Track[] = queueRef.current, options?: PlayOptions) => {
      if (index < 0 || index >= tracks.length) {
        return;
      }

      const track = tracks[index];
      const audio = ensureAudioElement();
      if (!audio) {
        return;
      }

      sustainedListenAwardedTrackIdRef.current = null;
      logPlayIfNew(track, options);
      setQueue(tracks);
      setQueueIndex(index);
      queueRef.current = tracks;
      queueIndexRef.current = index;
      setCurrentTrack(track);
      setRecentPlays((current) => persistRecent(track, current));

      if (!track.preview_url) {
        audio.pause();
        audio.removeAttribute("src");
        if (track.external_url) {
          window.open(track.external_url, "_blank", "noopener,noreferrer");
        }
        playbackBridge.notifyTrackEnded();
        return;
      }

      if (!options?.syncQueueAdvance) {
        audio.pause();
        audio.currentTime = 0;
      }

      audio.src = track.preview_url;
      audio.load();
      beginPlayback(audio, options);
    },
    [beginPlayback, ensureAudioElement, logPlayIfNew],
  );

  playAtIndexRef.current = playAtIndex;

  const startAudio = useCallback(
    (track: Track) => {
      const tracks = queueRef.current.length > 0 ? queueRef.current : [track];
      const index = tracks.findIndex((item) => item.id === track.id);
      playAtIndex(index >= 0 ? index : 0, tracks);
    },
    [playAtIndex],
  );

  const playTrack = useCallback(
    (
      track: Track,
      options?: { queue?: Track[]; startIndex?: number; queueSource?: QueueSource },
    ) => {
      const nextQueue = options?.queue?.length ? options.queue : [track];
      const index =
        options?.startIndex ??
        nextQueue.findIndex((item) => item.id === track.id);
      const safeIndex = index >= 0 ? index : 0;
      queueSourceRef.current = options?.queueSource ?? "intent";
      playAtIndex(safeIndex, nextQueue);
    },
    [playAtIndex],
  );

  const replaceQueue = useCallback(
    (tracks: Track[], startIndex = 0, options?: PlayOptions) => {
      if (tracks.length === 0) {
        return;
      }
      queueSourceRef.current = "intent";
      const safeIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1);
      playAtIndex(safeIndex, tracks, options);
    },
    [playAtIndex],
  );

  const resumePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio && currentTrack?.preview_url) {
      startAudio(currentTrack);
      return;
    }
    if (!audio) {
      return;
    }
    beginPlayback(audio);
  }, [beginPlayback, currentTrack, startAudio]);

  const togglePlay = useCallback(() => {
    if (!currentTrack) {
      return;
    }
    if (playbackBlocked || queueAdvancePending || (!isPlaying && audioRef.current)) {
      resumePlayback();
      return;
    }
    if (isPlaying && audioRef.current) {
      pauseAudio();
      return;
    }
    if (audioRef.current?.src) {
      beginPlayback(audioRef.current);
      return;
    }
    startAudio(currentTrack);
  }, [
    beginPlayback,
    currentTrack,
    isPlaying,
    pauseAudio,
    playbackBlocked,
    queueAdvancePending,
    resumePlayback,
    startAudio,
  ]);

  const pause = useCallback(() => {
    pauseAudio();
  }, [pauseAudio]);

  const playNext = useCallback(
    (options?: PlayOptions): boolean => {
      if (queueIndexRef.current < queueRef.current.length - 1) {
        playAtIndex(queueIndexRef.current + 1, queueRef.current, options);
        return true;
      }
      return false;
    },
    [playAtIndex],
  );

  const playPrevious = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (queueIndexRef.current > 0) {
      playAtIndex(queueIndexRef.current - 1);
    }
  }, [playAtIndex]);

  const replayCurrentTrack = useCallback(() => {
    if (!currentTrack || !audioRef.current) {
      if (currentTrack) {
        startAudio(currentTrack);
      }
      return;
    }
    audioRef.current.currentTime = 0;
    beginPlayback(audioRef.current);
  }, [beginPlayback, currentTrack, startAudio]);

  const removeFromQueue = useCallback(
    (trackId: string) => {
      const tracks = queueRef.current;
      const currentIndex = queueIndexRef.current;
      const playing = currentTrackRef.current;
      const removedIndex = tracks.findIndex((item) => item.id === trackId);

      if (removedIndex < 0) {
        return;
      }

      const nextQueue = tracks.filter((item) => item.id !== trackId);
      queueRef.current = nextQueue;
      setQueue(nextQueue);

      if (!playing) {
        return;
      }

      if (playing.id === trackId) {
        if (nextQueue.length === 0) {
          stopAudio();
          setCurrentTrack(null);
          setQueueIndex(0);
          queueIndexRef.current = 0;
          return;
        }

        const nextIndex = Math.min(currentIndex, nextQueue.length - 1);
        playAtIndex(nextIndex, nextQueue);
        return;
      }

      const nextIndex =
        removedIndex < currentIndex ? currentIndex - 1 : currentIndex;
      setQueueIndex(nextIndex);
      queueIndexRef.current = nextIndex;
    },
    [playAtIndex, stopAudio],
  );

  const setAutoplayEnabled = useCallback((enabled: boolean) => {
    autoplayRef.current = enabled;
    playbackBridge.autoplayEnabled = enabled;
    setAutoplayEnabledState(enabled);
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, enabled ? "true" : "false");
  }, []);

  const closePlayer = useCallback(() => {
    stopAudio();
    setPlaybackBlocked(false);
    setQueueAdvancePending(false);
    setCurrentTrack(null);
    setQueue([]);
    setQueueIndex(0);
    queueRef.current = [];
    queueIndexRef.current = 0;
    queueSourceRef.current = "intent";
  }, [stopAudio]);

  const isTrackPlaying = useCallback(
    (trackId: string) => isPlaying && currentTrack?.id === trackId,
    [currentTrack?.id, isPlaying],
  );

  const getQueueSnapshot = useCallback(
    () => ({
      queue: queueRef.current,
      index: queueIndexRef.current,
      queueSource: queueSourceRef.current,
    }),
    [],
  );

  const value = useMemo(
    () => ({
      currentTrack,
      queue,
      queueIndex,
      isPlaying,
      autoplayEnabled,
      progress,
      currentTime,
      duration,
      recentPlays,
      playTrack,
      replaceQueue,
      togglePlay,
      pause,
      playNext,
      playPrevious,
      replayCurrentTrack,
      removeFromQueue,
      setAutoplayEnabled,
      closePlayer,
      isTrackPlaying,
      playbackBlocked,
      queueAdvancePending,
      resumePlayback,
      getQueueSnapshot,
    }),
    [
      currentTrack,
      queue,
      queueIndex,
      isPlaying,
      autoplayEnabled,
      progress,
      currentTime,
      duration,
      recentPlays,
      playTrack,
      replaceQueue,
      togglePlay,
      pause,
      playNext,
      playPrevious,
      replayCurrentTrack,
      removeFromQueue,
      setAutoplayEnabled,
      closePlayer,
      isTrackPlaying,
      playbackBlocked,
      queueAdvancePending,
      resumePlayback,
      getQueueSnapshot,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return context;
}
