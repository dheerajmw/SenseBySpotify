export interface PendingIntentRefresh {
  intent: string;
  preferredArtists: string[];
}

type TrackEndedListener = () => void;

export const playbackBridge = {
  isPlaying: false,
  autoplayEnabled: true,
  pendingIntentRefresh: null as PendingIntentRefresh | null,
  listeners: new Set<TrackEndedListener>(),

  subscribe(listener: TrackEndedListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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
