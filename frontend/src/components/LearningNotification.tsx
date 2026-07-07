import { useSession } from "../hooks/useSession";

export default function LearningNotification() {
  const { learningNotice } = useSession();

  if (!learningNotice) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-[85] mx-auto max-w-sm animate-[slide-in-right_0.35s_ease-out] overlay-above-player sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 rounded-full border border-zinc-700/80 bg-zinc-950/90 px-4 py-2.5 text-sm text-zinc-200 shadow-lg backdrop-blur-md">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse-glow" />
        <span>{learningNotice}</span>
      </div>
    </div>
  );
}
