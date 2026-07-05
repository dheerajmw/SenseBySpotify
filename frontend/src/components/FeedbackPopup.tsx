import { useState } from "react";
import type { FeedbackChip, Recommendation } from "../types";
import { trackLabel } from "../utils/track";

const CHIP_OPTIONS: Array<{ id: FeedbackChip; label: string }> = [
  { id: "mood", label: "Mood" },
  { id: "lyrics", label: "Lyrics" },
  { id: "vocals", label: "Vocals" },
  { id: "beat", label: "Beat" },
  { id: "energy", label: "Energy" },
  { id: "instrumental", label: "Instrumental" },
  { id: "similar_artist", label: "Similar Artist" },
  { id: "surprise_me", label: "Surprise Me" },
];

interface FeedbackPopupProps {
  recommendation: Recommendation;
  onSubmit: (chips: FeedbackChip[]) => void;
  onDismiss: () => void;
}

export default function FeedbackPopup({
  recommendation,
  onSubmit,
  onDismiss,
}: FeedbackPopupProps) {
  const [selected, setSelected] = useState<FeedbackChip[]>([]);

  function toggleChip(chip: FeedbackChip) {
    setSelected((current) =>
      current.includes(chip)
        ? current.filter((value) => value !== chip)
        : [...current, chip],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-popup-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950/95 p-6 shadow-xl">
        <p className="text-sm uppercase tracking-widest text-emerald-400">
          Help improve recommendations
        </p>
        <h3 id="feedback-popup-title" className="mt-2 text-xl font-semibold">
          What stood out?
        </h3>
        <p className="mt-1 text-sm text-zinc-400">{trackLabel(recommendation.track)}</p>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Feedback chips">
          {CHIP_OPTIONS.map((chip) => {
            const active = selected.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => toggleChip(chip.id)}
                aria-pressed={active}
                className={[
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-emerald-500 text-black"
                    : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800",
                ].join(" ")}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onSubmit(selected)}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Save feedback
          </button>
        </div>
      </div>
    </div>
  );
}
