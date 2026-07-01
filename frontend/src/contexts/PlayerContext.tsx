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
import type { Track } from "../types";
import { playbackBridge } from "../utils/playbackBridge";
import { trackLabel } from "../utils/track";
import { useSessionContext } from "./SessionContext";

const RECENT_STORAGE_KEY = "sense_recent_plays";

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
  playTrack: (track: Track, options?: { queue?: Track[]; startIndex?: number }) => void;
  replaceQueue: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  pause: () => void;
  playNext: () => boolean;
  playPrevious: () => void;
  replayCurrentTrack: () => void;
  setAutoplayEnabled: (enabled: boolean) => void;
  closePlayer: () => void;
  isTrackPlaying: (trackId: string) => boolean;
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
  const { logAction } = useSessionContext();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayEnabled, setAutoplayEnabledState] = useState(loadAutoplayEnabled);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recentPlays, setRecentPlays] = useState<Track[]>(loadRecentPlays);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(0);
  const autoplayRef = useRef(autoplayEnabled);

  currentTrackRef.current = currentTrack;
  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  autoplayRef.current = autoplayEnabled;
  playbackBridge.autoplayEnabled = autoplayEnabled;

  const logPlayIfNew = useCallback(
    (track: Track) => {
      if (track.id === currentTrackRef.current?.id) {
        return;
      }
      logAction("PLAY", trackLabel(track));
    },
    [logAction],
  );

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    playbackBridge.setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const playAtIndex = useCallback(
    (index: number, tracks: Track[] = queueRef.current) => {
      if (index < 0 || index >= tracks.length) {
        return;
      }
      const track = tracks[index];
      logPlayIfNew(track);
      setQueue(tracks);
      setQueueIndex(index);
      queueRef.current = tracks;
      queueIndexRef.current = index;
      setCurrentTrack(track);
      setRecentPlays((current) => persistRecent(track, current));

      stopAudio();
      if (!track.preview_url) {
        if (track.external_url) {
          window.open(track.external_url, "_blank", "noopener,noreferrer");
        }
        playbackBridge.notifyTrackEnded();
        return;
      }

      const audio = new Audio(track.preview_url);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 30);
      };
      audio.ontimeupdate = () => {
        const total = audio.duration || 30;
        setCurrentTime(audio.currentTime);
        setProgress(total > 0 ? audio.currentTime / total : 0);
      };
      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        playbackBridge.notifyTrackEnded();
      };
      audio.onerror = () => {
        setIsPlaying(false);
        playbackBridge.notifyTrackEnded();
      };

      void audio.play().then(() => {
        setIsPlaying(true);
        playbackBridge.setPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
        playbackBridge.setPlaying(false);
      });
    },
    [logPlayIfNew, stopAudio],
  );

  const startAudio = useCallback(
    (track: Track) => {
      playAtIndex(
        queueRef.current.findIndex((item) => item.id === track.id),
        queueRef.current.length > 0 ? queueRef.current : [track],
      );
    },
    [playAtIndex],
  );

  const playTrack = useCallback(
    (track: Track, options?: { queue?: Track[]; startIndex?: number }) => {
      const nextQueue = options?.queue?.length ? options.queue : [track];
      const index =
        options?.startIndex ??
        nextQueue.findIndex((item) => item.id === track.id);
      const safeIndex = index >= 0 ? index : 0;
      playAtIndex(safeIndex, nextQueue);
    },
    [playAtIndex],
  );

  const replaceQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) {
        return;
      }
      const safeIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1);
      playAtIndex(safeIndex, tracks);
    },
    [playAtIndex],
  );

  const togglePlay = useCallback(() => {
    if (!currentTrack) {
      return;
    }
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      playbackBridge.setPlaying(false);
      return;
    }
    if (audioRef.current) {
      void audioRef.current.play().then(() => {
        setIsPlaying(true);
        playbackBridge.setPlaying(true);
      });
      return;
    }
    startAudio(currentTrack);
  }, [currentTrack, isPlaying, startAudio]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    playbackBridge.setPlaying(false);
  }, []);

  const playNext = useCallback((): boolean => {
    if (queueIndexRef.current < queueRef.current.length - 1) {
      playAtIndex(queueIndexRef.current + 1);
      return true;
    }
    return false;
  }, [playAtIndex]);

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
    if (!currentTrack) {
      return;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().then(() => {
        setIsPlaying(true);
        playbackBridge.setPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
        playbackBridge.setPlaying(false);
      });
      return;
    }
    startAudio(currentTrack);
  }, [currentTrack, startAudio]);

  const setAutoplayEnabled = useCallback((enabled: boolean) => {
    autoplayRef.current = enabled;
    playbackBridge.autoplayEnabled = enabled;
    setAutoplayEnabledState(enabled);
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, enabled ? "true" : "false");
  }, []);

  const closePlayer = useCallback(() => {
    stopAudio();
    setCurrentTrack(null);
    setQueue([]);
    setQueueIndex(0);
    queueRef.current = [];
    queueIndexRef.current = 0;
  }, [stopAudio]);

  const isTrackPlaying = useCallback(
    (trackId: string) => isPlaying && currentTrack?.id === trackId,
    [currentTrack?.id, isPlaying],
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

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
      setAutoplayEnabled,
      closePlayer,
      isTrackPlaying,
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
      setAutoplayEnabled,
      closePlayer,
      isTrackPlaying,
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
