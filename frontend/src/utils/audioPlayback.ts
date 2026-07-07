/** Configure an HTMLAudioElement for reliable mobile (iOS) preview playback. */
export function configurePreviewAudio(audio: HTMLAudioElement): void {
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
}

/** True when the browser blocked playback (autoplay policy). */
export function isPlaybackBlockedError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "AbortError")
  );
}
