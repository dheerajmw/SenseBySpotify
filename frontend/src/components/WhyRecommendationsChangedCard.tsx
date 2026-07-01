import { useSession } from "../hooks/useSession";
import { buildWhyChangedBullets } from "../utils/sessionDisplay";

export default function WhyRecommendationsChangedCard() {
  const { session } = useSession();
  const bullets = buildWhyChangedBullets(session.aiReason, session.recentActions);

  if (bullets.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5 backdrop-blur-md">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
        Why recommendations changed
      </h3>
      <p className="mt-2 text-sm text-zinc-500">Recommendations changed because</p>
      <ul className="mt-4 space-y-2.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5 text-sm text-zinc-200">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-300"
              aria-hidden
            >
              •
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
