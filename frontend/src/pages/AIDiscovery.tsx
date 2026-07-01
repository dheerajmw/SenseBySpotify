import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import AIPromptInput from "../components/AIPromptInput";
import RecommendationCardSkeleton from "../components/RecommendationCardSkeleton";
import { APP_NAME, DISCOVER_LABEL, INTENT_CHIPS } from "../constants/brand";
import { useProfile } from "../contexts/ProfileContext";
import { useSession } from "../hooks/useSession";
import { useRecommendations } from "../contexts/RecommendationsContext";

export default function AIDiscovery() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { logAction, setCurrentIntent } = useSession();
  const { setFeed } = useRecommendations();
  const [query, setQuery] = useState(profile.currentIntent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextProfile = { ...profile, currentIntent: trimmed };
      setCurrentIntent(trimmed, {
        reason: `Started AI discovery for "${trimmed}".`,
      });
      logAction("SEARCH", trimmed);
      const response = await api.generateRecommendations(nextProfile, trimmed);
      setFeed(response);
      navigate("/feed");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to generate recommendations",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-emerald-950/20 p-8 backdrop-blur">
        <p className="text-sm uppercase tracking-widest text-emerald-400">
          {DISCOVER_LABEL}
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Describe what you want to hear</h2>
        <p className="mt-4 max-w-2xl text-zinc-400">
          {APP_NAME} uses your taste profile, current intent, and Deezer candidates to
          rank recommendations with clear explanations.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
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
      </section>

      {loading && (
        <section className="space-y-4">
          <p className="text-sm text-zinc-500">
            Searching Deezer, gathering candidates, and ranking with AI...
          </p>
          <RecommendationCardSkeleton />
          <RecommendationCardSkeleton />
          <RecommendationCardSkeleton />
        </section>
      )}
    </div>
  );
}
