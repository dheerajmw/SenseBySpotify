import { Link } from "react-router-dom";
import RecommendationCard from "../components/RecommendationCard";
import DiscoveryLevelCard from "../components/DiscoveryLevelCard";
import HomeHeroSection from "../components/HomeHeroSection";
import WhyRecommendationsChangedCard from "../components/WhyRecommendationsChangedCard";
import TrackRow from "../components/TrackRow";
import { usePlayer } from "../contexts/PlayerContext";
import { useProfile } from "../contexts/ProfileContext";
import { useRecommendations } from "../contexts/RecommendationsContext";
import { useFeedback } from "../hooks/useFeedback";
import { useSession } from "../hooks/useSession";
import { intentsAlign } from "../utils/intent";
import type { Recommendation } from "../types";

export default function Home() {
  const { profile } = useProfile();
  const { session, isRegeneratingFeed } = useSession();
  const { recommendations, query, history, trending } = useRecommendations();
  const { recentPlays } = usePlayer();
  const { sendFeedback } = useFeedback();

  async function handleSkip(recommendation: Recommendation) {
    const label = `${recommendation.track.name} — ${recommendation.track.artists.map((a) => a.name).join(", ")}`;
    await sendFeedback({
      track_id: recommendation.track.id,
      event_type: "skip",
      track_label: label,
    });
  }

  async function handleLike(recommendation: Recommendation) {
    if (profile.likedTrackIds.includes(recommendation.track.id)) {
      return;
    }
    const label = `${recommendation.track.name} — ${recommendation.track.artists.map((a) => a.name).join(", ")}`;
    await sendFeedback({
      track_id: recommendation.track.id,
      event_type: "like",
      track_label: label,
    });
  }

  const activeIntent = session.currentIntent || profile.currentIntent;
  const feedMatchesIntent =
    Boolean(query) && intentsAlign(query ?? "", activeIntent);
  const showRecommendations =
    recommendations.length > 0 && feedMatchesIntent && !isRegeneratingFeed;

  const greeting = activeIntent
    ? `Ready for ${activeIntent.toLowerCase()}?`
    : "Welcome back";

  return (
    <div className="space-y-5 sm:space-y-8">
      <HomeHeroSection greeting={greeting} activeIntent={activeIntent} />
      <DiscoveryLevelCard />
      <WhyRecommendationsChangedCard />

      {isRegeneratingFeed && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-200">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
          Sense AI is adapting to your latest activity...
        </div>
      )}

      {recentPlays.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold">Recently Played</h3>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-2">
            {recentPlays.slice(0, 5).map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                queue={recentPlays}
                showIndex
              />
            ))}
          </div>
        </section>
      )}

      {showRecommendations && (
        <section className="space-y-4" key={session.recommendationVersion}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 break-words text-lg font-semibold sm:text-xl">
              Recommended for {activeIntent}
            </h3>
            <Link
              to="/feed"
              className="shrink-0 text-sm text-emerald-300 hover:text-emerald-200"
            >
              View feed
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {recommendations.slice(0, 4).map((item) => (
              <RecommendationCard
                key={item.track.id}
                recommendation={item}
                compact
                onLike={(rec) => void handleLike(rec)}
                onSkip={(rec) => void handleSkip(rec)}
              />
            ))}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold">Trending</h3>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-2">
            {trending.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                queue={trending}
                showIndex
              />
            ))}
          </div>
        </section>
      )}

      {feedMatchesIntent && history.length > 0 && !isRegeneratingFeed && (
        <section className="space-y-4" key={`history-${session.recommendationVersion}`}>
          <h3 className="text-xl font-semibold">Recently Recommended</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {history.slice(0, 4).map((item) => (
              <RecommendationCard
                key={`${item.track.id}-${item.rank}`}
                recommendation={item}
                compact
                onLike={(rec) => void handleLike(rec)}
                onSkip={(rec) => void handleSkip(rec)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
