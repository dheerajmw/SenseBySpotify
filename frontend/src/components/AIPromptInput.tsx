interface AIPromptInputProps {
  query: string;
  loading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
}

const SUGGESTIONS = [
  "relaxing indie acoustic for a rainy evening",
  "upbeat pop for a morning workout",
  "emotional singer-songwriter with soft vocals",
  "discover something new but not too experimental",
];

export default function AIPromptInput({
  query,
  loading,
  error,
  onQueryChange,
  onSubmit,
}: AIPromptInputProps) {
  const inputId = "ai-discovery-prompt";

  return (
    <div className="space-y-4">
      <label htmlFor={inputId} className="sr-only">
        Describe the music you want to discover
      </label>
      <textarea
        id={inputId}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        rows={4}
        placeholder="Describe your mood, activity, or the kind of music you want..."
        aria-describedby={error ? "ai-discovery-error" : undefined}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none ring-emerald-500/40 placeholder:text-zinc-500 focus:ring-2 focus-visible:ring-2"
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Prompt suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onQueryChange(suggestion)}
            aria-label={`Use suggestion: ${suggestion}`}
            className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || !query.trim()}
        aria-busy={loading}
        className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Generating recommendations..." : "Generate recommendations"}
      </button>

      {error && (
        <p
          id="ai-discovery-error"
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}
