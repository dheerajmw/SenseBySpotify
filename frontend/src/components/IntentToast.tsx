import { useSession } from "../hooks/useSession";

export default function IntentToast() {
  const { toastMessage, dismissToast } = useSession();

  if (!toastMessage) {
    return null;
  }

  return (
    <div
      className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-[splash-enter_0.3s_ease-out]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 rounded-full border border-emerald-500/30 bg-zinc-950/95 px-4 py-2.5 text-sm text-emerald-100 shadow-xl backdrop-blur sm:px-5 sm:py-3">
        <span className="min-w-0 truncate">{toastMessage}</span>
        <button
          type="button"
          onClick={dismissToast}
          className="text-zinc-400 hover:text-white"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
