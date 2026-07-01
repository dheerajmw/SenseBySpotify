import type { ReactNode } from "react";

interface DataPanelProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export default function DataPanel({
  title,
  description,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = "Nothing to show yet.",
  children,
}: DataPanelProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-14 animate-pulse rounded-lg bg-zinc-800/80"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && empty && (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      )}

      {!loading && !error && !empty && children}
    </section>
  );
}
