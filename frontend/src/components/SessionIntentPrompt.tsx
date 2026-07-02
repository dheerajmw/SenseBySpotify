import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiClientError } from "../api/client";
import AIPromptInput from "./AIPromptInput";
import { APP_NAME, INTENT_CHIPS } from "../constants/brand";
import { useSession } from "../hooks/useSession";

export default function SessionIntentPrompt() {
  const navigate = useNavigate();
  const { needsIntentPrompt, establishSessionIntent, logAction } = useSession();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!needsIntentPrompt) {
    return null;
  }

  async function handleSubmit() {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      logAction("SEARCH", trimmed);
      await establishSessionIntent(trimmed);
      navigate("/feed");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to start your listening session",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-intent-prompt-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
          New listening session
        </p>
        <h2
          id="session-intent-prompt-title"
          className="mt-2 text-2xl font-semibold text-white sm:text-3xl"
        >
          What are you listening for today?
        </h2>
        <p className="mt-3 text-sm text-zinc-400">
          {APP_NAME} keeps your taste profile, but each visit starts fresh. Tell us
          what you want to hear right now and we&apos;ll build recommendations for
          this session.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {INTENT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setQuery(chip)}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <AIPromptInput
            query={query}
            loading={loading}
            error={error}
            onQueryChange={setQuery}
            onSubmit={() => void handleSubmit()}
          />
        </div>
      </div>
    </div>
  );
}
