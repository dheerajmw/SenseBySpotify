interface IntentConfidenceMeterProps {
  confidencePercent: number;
  thresholdPercent: number;
  isPredictingChange: boolean;
  thresholdMet: boolean;
  predictedIntent?: string | null;
}

export default function IntentConfidenceMeter({
  confidencePercent,
  thresholdPercent,
  isPredictingChange,
  thresholdMet,
  predictedIntent,
}: IntentConfidenceMeterProps) {
  const barColor = thresholdMet
    ? "bg-emerald-400"
    : isPredictingChange
      ? "bg-amber-400"
      : "bg-emerald-500/80";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className="text-zinc-400">
          {isPredictingChange ? "Predicted intent confidence" : "Session confidence"}
        </span>
        <span className="font-medium tabular-nums text-zinc-100">
          {confidencePercent}
          <span className="font-normal text-zinc-500">
            {" "}
            / {thresholdPercent} points to switch
          </span>
        </span>
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, confidencePercent)}%` }}
          role="progressbar"
          aria-valuenow={confidencePercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={
            isPredictingChange && predictedIntent
              ? `Confidence for switching to ${predictedIntent}: ${confidencePercent} of ${thresholdPercent} points required`
              : `Session confidence ${confidencePercent} points`
          }
        />
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white/60"
          style={{ left: `${thresholdPercent}%` }}
          title={`${thresholdPercent}% switch threshold`}
          aria-hidden
        />
      </div>

      <p className="text-xs text-zinc-500">
        {thresholdMet
          ? `Threshold met (${thresholdPercent} points) — Sense can update your session intent.`
          : `${thresholdPercent - confidencePercent} more point${thresholdPercent - confidencePercent === 1 ? "" : "s"} needed to reach the ${thresholdPercent}-point switch threshold.`}
      </p>
    </div>
  );
}
