import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { DISCOVER_LABEL } from "../constants/brand";
import FeedbackPopup from "../components/FeedbackPopup";
import RecommendationCard from "../components/RecommendationCard";
import DiscoveryLevelCard from "../components/DiscoveryLevelCard";
import SessionIntentCard from "../components/SessionIntentCard";
import WhyRecommendationsChangedCard from "../components/WhyRecommendationsChangedCard";
import { useProfile } from "../contexts/ProfileContext";
import { useRecommendations } from "../contexts/RecommendationsContext";
import { useFeedback } from "../hooks/useFeedback";
import { useSkipRecommendation } from "../hooks/useSkipRecommendation";
import { useSession } from "../hooks/useSession";
import { buildRecommendationRequest } from "../utils/recommendationContext";
import { getActiveIntent } from "../utils/sessionLifecycle";
import type { FeedbackChip, Recommendation } from "../types";
import { trackLabel } from "../utils/track";

export default function RecommendationFeed() {
  const { profile } = useProfile();
  const {
    query,
    recommendations,
    candidateCount,
    usedAi,
    hasFeed,
    setFeed,
    clearFeed,
  } = useRecommendations();
  const { session, isRegeneratingFeed } = useSession();
  const [pendingLike, setPendingLike] = useState<Recommendation | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedBanner, setUpdatedBanner] = useState(false);
  const [displayRecs, setDisplayRecs] = useState(recommendations);
  const [gridPhase, setGridPhase] = useState<"idle" | "fading" | "adapting" | "entering">("idle");

  const isUpdating = refreshing || isRegeneratingFeed;

  const regenerate = useCallback(async () => {
    const intent = getActiveIntent(session) || query;
    if (!intent) {
      return;
    }
    setRefreshing(true);
    try {
      const { query: recommendationQuery, profile: requestProfile } =
        buildRecommendationRequest(profile, session, intent);
      const response = await api.generateRecommendations(
        requestProfile,
        recommendationQuery,
      );
      setFeed(response);
    } finally {
      setRefreshing(false);
    }
  }, [profile, query, session, setFeed]);

  const { sendFeedback, toggleLike, toggleDislike } = useFeedback(regenerate);
  const { skipRecommendation } = useSkipRecommendation();

  useEffect(() => {
    if (isRegeneratingFeed) {
      setGridPhase("fading");
      const timer = window.setTimeout(() => setGridPhase("adapting"), 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isRegeneratingFeed]);

  useEffect(() => {
    if (!isRegeneratingFeed && !refreshing) {
      if (gridPhase === "adapting" || gridPhase === "fading") {
        setGridPhase("entering");
        setDisplayRecs(recommendations);
        const timer = window.setTimeout(() => setGridPhase("idle"), 500);
        return () => window.clearTimeout(timer);
      }
      setDisplayRecs(recommendations);
      if (gridPhase === "idle") {
        setDisplayRecs(recommendations);
      }
    }
    return undefined;
  }, [isRegeneratingFeed, refreshing, recommendations, gridPhase]);

  async function handleLike(recommendation: Recommendation) {
    const label = trackLabel(recommendation.track);
    if (profile.likedTrackIds.includes(recommendation.track.id)) {
      await toggleLike(recommendation.track.id, label);
      return;
    }
    setPendingLike(recommendation);
  }

  async function handleDislike(recommendation: Recommendation) {
    const label = trackLabel(recommendation.track);
    const wasDisliked = profile.dislikedTrackIds.includes(recommendation.track.id);
    await toggleDislike(recommendation.track.id, label);
    if (!wasDisliked) {
      await skipRecommendation(recommendation);
    }
  }

  async function handleLikeDismiss() {
    if (!pendingLike) {
      return;
    }
    const label = trackLabel(pendingLike.track);
    await sendFeedback({
      track_id: pendingLike.track.id,
      event_type: "like",
      track_label: label,
    });
    setPendingLike(null);
  }

  async function handleLikeSubmit(chips: FeedbackChip[]) {
    if (!pendingLike) {
      return;
    }
    const label = trackLabel(pendingLike.track);
    await sendFeedback(
      {
        track_id: pendingLike.track.id,
        event_type: "like",
        chips,
        track_label: label,
      },
      {
        refresh: true,
        onRefreshed: () => setUpdatedBanner(true),
      },
    );
    setPendingLike(null);
  }

  async function handleSkip(recommendation: Recommendation) {
    await skipRecommendation(recommendation);
  }

  if (!hasFeed) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
        <h2 className="text-2xl font-semibold">No recommendations yet</h2>
        <p className="mt-3 text-zinc-400">
          Start with a natural-language prompt to generate a personalized discovery feed.
        </p>
        <Link
          to="/discovery"
          className="mt-6 inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          Go to {DISCOVER_LABEL}
        </Link>
      </section>
    );
  }

  const gridClass = [
    "grid gap-4 transition-all duration-500 sm:grid-cols-2",
    gridPhase === "fading" ? "opacity-0 scale-[0.98]" : "",
    gridPhase === "adapting" ? "opacity-0" : "",
    gridPhase === "entering" ? "animate-feed-enter opacity-100" : "",
    gridPhase === "idle" ? "opacity-100" : "",
  ].join(" ");

  return (
    <div className="space-y-6">
      {pendingLike && (
        <FeedbackPopup
          recommendation={pendingLike}
          onSubmit={(chips) => void handleLikeSubmit(chips)}
          onDismiss={() => void handleLikeDismiss()}
        />
      )}

      <SessionIntentCard />
      <DiscoveryLevelCard />
      <WhyRecommendationsChangedCard />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm uppercase tracking-widest text-emerald-400">
              Recommendation Feed
            </p>
            <h2 className="mt-2 break-words text-xl font-semibold sm:text-2xl">
              {query ? `Results for “${query}”` : "Your recommendations"}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {recommendations.length} tracks ranked from {candidateCount} candidates
              {usedAi ? " · AI ranked" : " · fallback ranking"}
              {isUpdating ? " · updating..." : ""}
            </p>
            {updatedBanner && !isUpdating && (
              <p className="mt-2 text-sm text-emerald-300">
                Recommendations updated based on your feedback.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void regenerate()}
              disabled={isUpdating}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
            >
              Refresh
            </button>
            <Link
              to="/discovery"
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              New search
            </Link>
            <button
              type="button"
              onClick={clearFeed}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Clear feed
            </button>
          </div>
        </div>
      </section>

      <div className="relative">
        {gridPhase === "adapting" && (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 py-16 text-center animate-[splash-enter_0.3s_ease-out]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
            <p className="mt-4 text-sm font-medium text-emerald-200">
              Sense AI is adapting to your latest activity...
            </p>
          </div>
        )}

        {gridPhase !== "adapting" && (
          <div className={gridClass} key={session.recommendationVersion}>
            {displayRecs.map((recommendation, index) => (
              <div
                key={recommendation.track.id}
                className="animate-feed-card-enter"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <RecommendationCard
                  recommendation={recommendation}
                  onLike={(item) => void handleLike(item)}
                  onDislike={(item) => void handleDislike(item)}
                  onSkip={(item) => void handleSkip(item)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
