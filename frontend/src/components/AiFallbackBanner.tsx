import { useEffect, useState } from "react";
import { useRecommendations } from "../contexts/RecommendationsContext";

export default function AiFallbackBanner() {
  const { usedAi, fallbackReason } = useRecommendations();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (usedAi || !fallbackReason) {
      setDismissed(false);
    }
  }, [usedAi, fallbackReason]);

  if (usedAi || !fallbackReason || dismissed) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto fixed inset-x-3 z-[84] mx-auto max-w-lg overlay-above-player sm:inset-x-4 sm:bottom-auto sm:top-24"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100 shadow-lg backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-sky-50">AI is temporarily unavailable.</p>
            <p className="text-sky-100/90">
              Showing recommendations using your listening intent.
            </p>
            <p className="text-xs text-sky-200/75">
              We&apos;ll automatically switch back to AI once it becomes available.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-sky-200/90 transition-colors hover:bg-sky-500/15 hover:text-sky-50"
            aria-label="Dismiss AI fallback notice"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
