import type { Track } from "../types";

export interface PendingIntentRefresh {
  intent: string;
  preferredArtists: string[];
}

type TrackEndedListener = () => void;

export const playbackBridge = {
  isPlaying: false,
  autoplayEnabled: true,
  pendingIntentRefresh: null as PendingIntentRefresh | null,
  lastEndedTrack: null as Track | null,
  listeners: new Set<TrackEndedListener>(),

  subscribe(listener: TrackEndedListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },

  setLastEndedTrack(track: Track) {
    this.lastEndedTrack = track;
  },

  notifyTrackEnded() {
    this.isPlaying = false;
    for (const listener of this.listeners) {
      listener();
    }
  },

  setPlaying(value: boolean) {
    this.isPlaying = value;
  },
};
