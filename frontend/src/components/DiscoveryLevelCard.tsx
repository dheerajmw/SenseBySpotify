import { useEffect, useState } from "react";
import { useSession } from "../hooks/useSession";
import {
  getDiscoveryProfile,
  sliderPresetLabel,
} from "../utils/discoveryLevel";

export default function DiscoveryLevelCard() {
  const { session, isRegeneratingFeed, setDiscoveryLevel } = useSession();
  const [sliderValue, setSliderValue] = useState(session.discoveryLevel);
  const [isUpdating, setIsUpdating] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);

  const level = session.discoveryLevel;
  const profileInfo = getDiscoveryProfile(level);
  const busy = isUpdating || isRegeneratingFeed;

  useEffect(() => {
    setSliderValue(level);
  }, [level]);

  useEffect(() => {
    setAnimateBars(true);
    const timer = window.setTimeout(() => setAnimateBars(false), 900);
    return () => window.clearTimeout(timer);
  }, [level, profileInfo.label]);

  async function commitSlider(value: number) {
    const nextLevel = Math.round(value);
    if (nextLevel === level) {
      return;
    }

    setIsUpdating(true);
    try {
      await setDiscoveryLevel(nextLevel, { regenerate: true, manual: true });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-400/90">
            ✨ Discovery Level
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">
            {profileInfo.label}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {busy && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
          )}
          <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200">
            {profileInfo.discoveryPercent}% new
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
          <span>Familiar {profileInfo.familiarPercent}%</span>
          <span>New {profileInfo.discoveryPercent}%</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-800/90">
          <div
            className={[
              "bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out",
              animateBars ? "animate-pulse-glow" : "",
            ].join(" ")}
            style={{ width: `${profileInfo.familiarPercent}%` }}
          />
          <div
            className={[
              "bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-700 ease-out",
              animateBars ? "animate-pulse-glow" : "",
            ].join(" ")}
            style={{ width: `${profileInfo.discoveryPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
          <span>Familiar</span>
          <span className="text-zinc-400">{sliderPresetLabel(sliderValue)}</span>
          <span>Adventurous</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={sliderValue}
          disabled={busy}
          onChange={(event) => setSliderValue(Number(event.target.value))}
          onMouseUp={() => void commitSlider(sliderValue)}
          onTouchEnd={() => void commitSlider(sliderValue)}
          className="discovery-slider discovery-slider-compact w-full"
          aria-label="Adjust discovery level"
        />
      </div>
    </section>
  );
}
