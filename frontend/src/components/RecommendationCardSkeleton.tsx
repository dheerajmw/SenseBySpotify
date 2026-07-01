export default function RecommendationCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 rounded-lg bg-zinc-800" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 rounded bg-zinc-800" />
          <div className="h-5 w-2/3 rounded bg-zinc-800" />
          <div className="h-4 w-1/2 rounded bg-zinc-800" />
          <div className="h-12 w-full rounded bg-zinc-800/80" />
        </div>
      </div>
    </div>
  );
}
