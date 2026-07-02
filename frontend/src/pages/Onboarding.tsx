import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import {
  APP_NAME,
  DISCOVERY_STYLE_OPTIONS,
  GENRE_OPTIONS,
  INTENT_CHIPS,
} from "../constants/brand";
import { useProfile } from "../contexts/ProfileContext";
import { useRecommendations } from "../contexts/RecommendationsContext";
import { useSession } from "../hooks/useSession";
import type { Artist, FavouriteArtist } from "../types";

const GENERATING_MESSAGES = [
  "Understanding your music taste...",
  "Learning your discovery style...",
  "Generating your recommendations...",
];

type Step = "genres" | "artists" | "style" | "intent" | "generating";

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, updateProfile, completeOnboarding } = useProfile();
  const { setFeed } = useRecommendations();
  const { setCurrentIntent: setSessionIntent, setDiscoveryLevel } = useSession();
  const [step, setStep] = useState<Step>("genres");
  const [selectedGenres, setSelectedGenres] = useState<string[]>(profile.genres);
  const [selectedArtists, setSelectedArtists] = useState<FavouriteArtist[]>(
    profile.favouriteArtists,
  );
  const [noveltyTolerance, setNoveltyTolerance] = useState(
    profile.noveltyTolerance || 50,
  );
  const [currentIntent, setCurrentIntent] = useState(profile.currentIntent);
  const [artistQuery, setArtistQuery] = useState("");
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const [artistLoading, setArtistLoading] = useState(false);
  const [artistError, setArtistError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  const stepNumber = useMemo(() => {
    const order: Step[] = ["genres", "artists", "style", "intent", "generating"];
    return order.indexOf(step) + 1;
  }, [step]);

  useEffect(() => {
    if (step !== "artists" || artistQuery.trim().length < 2) {
      setArtistResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setArtistLoading(true);
      setArtistError(null);
      try {
        const response = await api.searchArtists(artistQuery.trim(), 8);
        if (!controller.signal.aborted) {
          setArtistResults(response.artists);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setArtistResults([]);
          setArtistError(
            error instanceof ApiClientError
              ? error.message
              : "Artist search failed",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setArtistLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [artistQuery, step]);

  useEffect(() => {
    if (step !== "generating") {
      return;
    }

    let cancelled = false;

    const messageTimer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % GENERATING_MESSAGES.length);
    }, 1200);

    async function finishOnboarding() {
      const intent = currentIntent.trim();
      const nextProfile = {
        genres: selectedGenres,
        favouriteArtists: selectedArtists,
        noveltyTolerance,
        currentIntent: intent,
      };

      updateProfile(nextProfile);
      completeOnboarding();
      setSessionIntent(intent, {
        reason: "Initial intent from onboarding profile.",
        bumpVersion: true,
        userDeclared: true,
      });
      await setDiscoveryLevel(noveltyTolerance, { regenerate: false });

      try {
        const response = await api.generateRecommendations(
          { ...profile, ...nextProfile, onboardingCompleted: true },
          intent,
        );
        if (!cancelled) {
          setFeed(response);
          navigate("/feed", { replace: true });
        }
      } catch {
        if (!cancelled) {
          navigate("/feed", { replace: true });
        }
      }
    }

    void finishOnboarding();

    return () => {
      cancelled = true;
      window.clearInterval(messageTimer);
    };
  }, [
    step,
    selectedGenres,
    selectedArtists,
    noveltyTolerance,
    currentIntent,
    profile,
    updateProfile,
    completeOnboarding,
    setFeed,
    setSessionIntent,
    setDiscoveryLevel,
    navigate,
  ]);

  function toggleGenre(genre: string) {
    setSelectedGenres((current) =>
      current.includes(genre)
        ? current.filter((value) => value !== genre)
        : [...current, genre],
    );
  }

  function artistKey(artist: Pick<FavouriteArtist, "id" | "name">): string {
    return `${String(artist.id)}::${artist.name.trim().toLowerCase()}`;
  }

  function toggleArtist(artist: Artist) {
    const key = artistKey(artist);
    setSelectedArtists((current) => {
      const exists = current.some((item) => artistKey(item) === key);
      if (exists) {
        return current.filter((item) => artistKey(item) !== key);
      }
      return [
        ...current,
        {
          id: String(artist.id),
          name: artist.name,
          image_url: artist.image_url,
        },
      ];
    });
  }

  function removeArtist(artist: FavouriteArtist) {
    const key = artistKey(artist);
    setSelectedArtists((current) => current.filter((item) => artistKey(item) !== key));
  }

  function goNext() {
    if (step === "genres") {
      setStep("artists");
      return;
    }
    if (step === "artists") {
      setStep("style");
      return;
    }
    if (step === "style") {
      setStep("intent");
      return;
    }
    if (step === "intent") {
      setStep("generating");
    }
  }

  if (step === "generating") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-center backdrop-blur sm:rounded-3xl sm:p-10">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
          <p className="mt-8 text-lg font-medium text-white">
            {GENERATING_MESSAGES[messageIndex]}
          </p>
          <p className="mt-3 text-sm text-zinc-400">
            Building your {APP_NAME} profile
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm text-zinc-500">Step {stepNumber} of 5</p>
          <div className="h-1 flex-1 max-w-xs rounded-full bg-zinc-800 ml-4">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(stepNumber / 5) * 100}%` }}
            />
          </div>
        </div>

        {step === "genres" && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 backdrop-blur sm:rounded-3xl sm:p-6 md:p-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">What do you usually listen to?</h2>
            <p className="mt-2 text-zinc-400">Select all genres that fit your taste.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {GENRE_OPTIONS.map((genre) => {
                const active = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={[
                      "rounded-full px-4 py-2 text-sm transition",
                      active
                        ? "bg-emerald-500 text-black"
                        : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800",
                    ].join(" ")}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === "artists" && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 backdrop-blur sm:rounded-3xl sm:p-6 md:p-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">Favourite artists</h2>
            <p className="mt-2 text-zinc-400">
              Search and select as many artists as you like.
            </p>

            {selectedArtists.length > 0 && (
              <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                  {selectedArtists.length} selected
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedArtists.map((artist) => (
                    <button
                      key={artistKey(artist)}
                      type="button"
                      onClick={() => removeArtist(artist)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100 transition hover:bg-emerald-500/20"
                      aria-label={`Remove ${artist.name}`}
                    >
                      {artist.name}
                      <span className="text-emerald-300" aria-hidden>
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              type="search"
              value={artistQuery}
              onChange={(event) => setArtistQuery(event.target.value)}
              placeholder="Search artists..."
              className="mt-6 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-500"
            />
            {artistLoading && (
              <p className="mt-3 text-sm text-zinc-500">Searching...</p>
            )}
            {artistError && (
              <p className="mt-3 text-sm text-amber-300">{artistError}</p>
            )}
            <div className="mt-4 space-y-2">
              {artistResults.map((artist) => {
                const selected = selectedArtists.some(
                  (item) => artistKey(item) === artistKey(artist),
                );
                return (
                  <button
                    key={artistKey(artist)}
                    type="button"
                    onClick={() => toggleArtist(artist)}
                    aria-pressed={selected}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                      selected
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-zinc-800 hover:border-zinc-700",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                        selected
                          ? "border-emerald-400 bg-emerald-500 text-black"
                          : "border-zinc-600 bg-transparent text-transparent",
                      ].join(" ")}
                      aria-hidden
                    >
                      ✓
                    </span>
                    {artist.image_url ? (
                      <img
                        src={artist.image_url}
                        alt={artist.name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-800" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">{artist.name}</span>
                  </button>
                );
              })}
            </div>
            {artistQuery.trim().length >= 2 &&
              !artistLoading &&
              artistResults.length === 0 &&
              !artistError && (
                <p className="mt-3 text-sm text-zinc-500">No artists found. Try another search.</p>
              )}
          </section>
        )}

        {step === "style" && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 backdrop-blur sm:rounded-3xl sm:p-6 md:p-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">Choose your Discovery Style</h2>
            <p className="mt-2 text-zinc-400">
              How adventurous should Sense be when recommending music?
            </p>
            <div className="mt-8 space-y-3">
              {DISCOVERY_STYLE_OPTIONS.map((option) => {
                const active = noveltyTolerance === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNoveltyTolerance(option.value)}
                    className={[
                      "w-full rounded-2xl border px-5 py-4 text-left transition",
                      active
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-100"
                        : "border-zinc-800 hover:border-zinc-700",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === "intent" && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 backdrop-blur sm:rounded-3xl sm:p-6 md:p-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">What are you listening for today?</h2>
            <input
              type="text"
              value={currentIntent}
              onChange={(event) => setCurrentIntent(event.target.value)}
              placeholder="Late night coding, gym, rainy evening..."
              className="mt-6 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-500"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {INTENT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setCurrentIntent(chip)}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            onClick={() => {
              if (step === "genres") {
                navigate("/welcome");
                return;
              }
              if (step === "artists") setStep("genres");
              if (step === "style") setStep("artists");
              if (step === "intent") setStep("style");
            }}
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={
              (step === "genres" && selectedGenres.length === 0) ||
              (step === "intent" && !currentIntent.trim())
            }
            className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
