import { useSession } from "../hooks/useSession";

export default function IntentToast() {
  const { toastMessage, dismissToast } = useSession();

  if (!toastMessage) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 animate-[splash-enter_0.3s_ease-out]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-full border border-emerald-500/30 bg-zinc-950/95 px-5 py-3 text-sm text-emerald-100 shadow-xl backdrop-blur">
        <span>{toastMessage}</span>
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
