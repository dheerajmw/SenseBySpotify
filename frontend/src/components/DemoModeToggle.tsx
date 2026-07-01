import { useSession } from "../hooks/useSession";

export default function DemoModeToggle() {
  const { demoMode, setDemoMode } = useSession();

  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
      <span
        className={[
          "hidden whitespace-nowrap text-xs font-medium sm:inline",
          demoMode ? "text-emerald-300" : "text-zinc-500",
        ].join(" ")}
      >
        Demo Mode
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={demoMode}
        aria-label="Toggle demo mode"
        onClick={() => setDemoMode(!demoMode)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
          demoMode ? "bg-emerald-500" : "bg-zinc-700",
        ].join(" ")}
      >
        <span
          className={[
            "block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out",
            demoMode ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
