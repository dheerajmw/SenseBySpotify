import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DISCOVER_LABEL } from "../constants/brand";
import FeedbackPopup from "../components/FeedbackPopup";
import { useProfile } from "../contexts/ProfileContext";
import { usePlayer } from "../contexts/PlayerContext";
import { useRecommendations } from "../contexts/RecommendationsContext";
import { useFeedback } from "../hooks/useFeedback";
import { useSession } from "../hooks/useSession";
import type { FeedbackChip } from "../types";
import { formatConfidence, formatDuration, parseReasonBullets } from "../utils/music";
import { trackLabel } from "../utils/track";

export default function RecommendationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { query, getRecommendation, setFeed } = useRecommendations();
  const { playTrack, isTrackPlaying, togglePlay } = usePlayer();
  const [showLikePopup, setShowLikePopup] = useState(false);
  const recommendation = id ? getRecommendation(id) : undefined;

  const regenerate = useCallback(async () => {
    if (!query) {
      return;
    }
    const { api } = await import("../api/client");
    const response = await api.generateRecommendations(profile, query);
    setFeed(response);
  }, [profile, query, setFeed]);

  const { sendFeedback } = useFeedback(regenerate);
  const { logAction } = useSession();

  useEffect(() => {
    if (!recommendation) {
      return;
    }
    const label = `${recommendation.track.name} — ${recommendation.track.artists.map((a) => a.name).join(", ")}`;
    logAction("RECOMMENDATION_CLICKED", label);
  }, [recommendation?.track.id, logAction, recommendation]);

  if (!recommendation) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
        <h2 className="text-2xl font-semibold">Recommendation not found</h2>
        <p className="mt-3 text-zinc-400">
          This track is not in your current feed. Generate a new discovery session to
          explore more music.
        </p>
        <Link
          to="/discovery"
          className="mt-6 inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          Start {DISCOVER_LABEL}
        </Link>
      </section>
    );
  }

  const { track, reason, confidence, rank } = recommendation;
  const bullets = parseReasonBullets(reason);
  const label = trackLabel(track);

  const playing = isTrackPlaying(track.id);

  function handlePlay() {
    if (playing) {
      togglePlay();
      return;
    }
    playTrack(track);
  }

  async function handleLikeSubmit(chips: FeedbackChip[]) {
    await sendFeedback(
      {
        track_id: track.id,
        event_type: "like",
        chips,
        track_label: label,
      },
      { refresh: true },
    );
    setShowLikePopup(false);
    navigate("/feed");
  }

  async function handleLikeDismiss() {
    await sendFeedback({
      track_id: track.id,
      event_type: "like",
      track_label: label,
    });
    setShowLikePopup(false);
  }

  return (
    <div className="space-y-6">
      {showLikePopup && (
        <FeedbackPopup
          recommendation={recommendation}
          onSubmit={(chips) => void handleLikeSubmit(chips)}
          onDismiss={() => void handleLikeDismiss()}
        />
      )}

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Back
      </button>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <div className="grid gap-6 p-6 lg:grid-cols-[220px_1fr] lg:p-8">
          {track.album?.image_url ? (
            <img
              src={track.album.image_url}
              alt={track.album.name}
              className="aspect-square w-full max-w-[220px] rounded-2xl object-cover"
            />
          ) : (
            <div className="aspect-square w-full max-w-[220px] rounded-2xl bg-zinc-800" />
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                Rank #{rank}
              </span>
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                {formatConfidence(confidence)} confidence
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold">{track.name}</h1>
            <p className="mt-2 text-lg text-zinc-400">
              {track.artists.map((artist) => artist.name).join(", ")}
            </p>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-zinc-950 px-4 py-3">
                <dt className="text-zinc-500">Album</dt>
                <dd className="mt-1 font-medium">{track.album?.name ?? "—"}</dd>
              </div>
              <div className="rounded-lg bg-zinc-950 px-4 py-3">
                <dt className="text-zinc-500">Duration</dt>
                <dd className="mt-1 font-medium">{formatDuration(track.duration_ms)}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePlay}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                {playing ? "Pause" : "Play"}
              </button>
              <Link
                to="/now-playing"
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Now playing
              </Link>
              <button
                type="button"
                onClick={() => setShowLikePopup(true)}
                className="rounded-full border border-emerald-500/40 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10"
              >
                Like
              </button>
              {track.external_url && (
                <a
                  href={track.external_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Open in Apple Music
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 p-6 lg:p-8">
          <h2 className="text-lg font-medium text-emerald-300">Why recommended</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-300">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
