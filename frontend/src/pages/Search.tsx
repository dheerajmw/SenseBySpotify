import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import TrackRow from "../components/TrackRow";
import { useSession } from "../hooks/useSession";
import type { Artist, Track } from "../types";

type Tab = "songs" | "artists";

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [input, setInput] = useState(query);
  const [tab, setTab] = useState<Tab>("songs");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { logAction } = useSession();

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setTracks([]);
      setArtists([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [trackResponse, artistResponse] = await Promise.all([
          api.searchTracks(query.trim(), 25),
          api.searchArtists(query.trim(), 12),
        ]);
        if (!controller.signal.aborted) {
          setTracks(trackResponse.tracks);
          setArtists(artistResponse.artists);
          logAction("SEARCH_TRACK", query.trim());
          logAction("SEARCH", query.trim());
          if (artistResponse.artists.length > 0) {
            logAction("SEARCH_ARTIST", query.trim());
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof ApiClientError ? err.message : "Search failed",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, logAction]);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }
    setSearchParams({ q: trimmed });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-2xl font-semibold">Search</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Find any song or artist and play previews instantly.
        </p>
        <form onSubmit={handleSearchSubmit} className="mt-4">
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search for songs, artists, albums..."
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
          />
        </form>
      </section>

      {query && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("songs")}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              tab === "songs"
                ? "bg-emerald-500 text-black"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800",
            ].join(" ")}
          >
            Songs
          </button>
          <button
            type="button"
            onClick={() => setTab("artists")}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              tab === "artists"
                ? "bg-emerald-500 text-black"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800",
            ].join(" ")}
          >
            Artists
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-zinc-500">Searching...</p>}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && query && tab === "songs" && (
        <section className="space-y-1">
          {tracks.length === 0 ? (
            <p className="text-sm text-zinc-500">No songs found for “{query}”.</p>
          ) : (
            tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                queue={tracks}
                showIndex
              />
            ))
          )}
        </section>
      )}

      {!loading && query && tab === "artists" && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {artists.length === 0 ? (
            <p className="text-sm text-zinc-500">No artists found for “{query}”.</p>
          ) : (
            artists.map((artist) => (
              <button
                key={artist.id}
                type="button"
                onClick={() => {
                  setSearchParams({ q: artist.name });
                  setTab("songs");
                }}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-left transition hover:border-zinc-700 sm:p-4"
              >
                {artist.image_url ? (
                  <img
                    src={artist.image_url}
                    alt={artist.name}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{artist.name}</p>
                  <p className="text-sm text-zinc-400">View songs</p>
                </div>
              </button>
            ))
          )}
        </section>
      )}
    </div>
  );
}
