"use client";

import { useEffect, useState } from "react";
import type { RecordingSeries, RecordingEpisode } from "@/lib/types";
import VideoPlayer from "./VideoPlayer";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface EpisodeCardProps {
  ep: RecordingEpisode;
  seriesTitle: string;
  onPlay: () => void;
  onDelete: () => void;
}

function EpisodeCard({ ep, seriesTitle, onPlay, onDelete }: EpisodeCardProps) {
  const duration = ep.RecordDuration
    ? formatDuration(ep.RecordDuration)
    : ep.EndTime && ep.StartTime
    ? formatDuration(ep.EndTime - ep.StartTime)
    : null;

  const label = ep.EpisodeTitle || ep.Title || seriesTitle;

  return (
    <div className="group flex gap-3 p-3 rounded-lg bg-bg-secondary border border-border hover:border-border-bright transition-all">
      {ep.ImageURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ep.ImageURL}
          alt={label}
          className="w-28 h-16 object-cover rounded-md shrink-0 bg-bg-card"
        />
      ) : (
        <div className="w-28 h-16 rounded-md shrink-0 bg-bg-card flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-text-muted">
            <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{label}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {ep.ChannelName && (
            <span className="text-xs text-accent-cyan">{ep.ChannelName}</span>
          )}
          {ep.EpisodeNumber && (
            <span className="text-xs text-text-muted">{ep.EpisodeNumber}</span>
          )}
          {ep.StartTime && (
            <span className="text-xs text-text-muted">{formatDate(ep.StartTime)}</span>
          )}
          {duration && (
            <span className="text-xs text-text-muted">{duration}</span>
          )}
          {ep.RecordFileSize && (
            <span className="text-xs text-text-muted">{formatFileSize(ep.RecordFileSize)}</span>
          )}
        </div>
        {ep.Synopsis && (
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{ep.Synopsis}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onPlay}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-bg-primary transition-all hover:brightness-110"
          style={{ background: "#00d4ff" }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play
        </button>
        {ep.CmdURL && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-white border border-border hover:border-accent-red hover:text-accent-red transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

interface SeriesCardProps {
  series: RecordingSeries;
  onPlayEpisode: (ep: RecordingEpisode, seriesTitle: string) => void;
}

function SeriesCard({ series, onPlayEpisode }: SeriesCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [episodes, setEpisodes] = useState<RecordingEpisode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadEpisodes = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/recordings/episodes?url=${encodeURIComponent(series.EpisodesURL)}`
      );
      const data = await res.json();
      setEpisodes(Array.isArray(data) ? data.sort((a: RecordingEpisode, b: RecordingEpisode) => b.StartTime - a.StartTime) : []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) loadEpisodes();
  };

  const handleDelete = async (ep: RecordingEpisode) => {
    if (!ep.CmdURL) return;
    await fetch(
      `/api/recordings/episodes?cmdUrl=${encodeURIComponent(ep.CmdURL)}`,
      { method: "DELETE" }
    );
    setEpisodes((prev) => prev.filter((e) => e.CmdURL !== ep.CmdURL));
  };

  return (
    <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
      <button
        className="w-full flex gap-4 p-4 hover:bg-bg-hover/40 transition-colors text-left"
        onClick={handleExpand}
      >
        {series.ImageURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={series.ImageURL}
            alt={series.Title}
            className="w-20 h-28 object-cover rounded-lg shrink-0 bg-bg-secondary"
          />
        ) : (
          <div
            className="w-20 h-28 rounded-lg shrink-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1a1a2e, #22223a)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-10 h-10 text-text-muted">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-text-primary">{series.Title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {series.New === 1 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30">
                New
              </span>
            )}
            {series.Category && (
              <span className="text-xs text-text-muted capitalize">{series.Category}</span>
            )}
          </div>
          {loaded && (
            <p className="text-sm text-accent-cyan mt-1">
              {episodes.length} {episodes.length === 1 ? "episode" : "episodes"}
            </p>
          )}
        </div>

        <div className="shrink-0 self-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`w-5 h-5 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-lg" />
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">No episodes found</p>
          ) : (
            episodes.map((ep, i) => (
              <EpisodeCard
                key={ep.CmdURL ?? i}
                ep={ep}
                seriesTitle={series.Title}
                onPlay={() => onPlayEpisode(ep, series.Title)}
                onDelete={() => {
                  if (confirm(`Delete this episode?`)) handleDelete(ep);
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function RecordingsList() {
  const [series, setSeries] = useState<RecordingSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<{ url: string; title: string; subtitle: string } | null>(null);

  useEffect(() => {
    fetch("/api/recordings")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSeries(data.sort((a: RecordingSeries, b: RecordingSeries) =>
            (a.Title ?? "").localeCompare(b.Title ?? "")
          ));
        } else {
          setError(data.error || "Failed to load recordings");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = series.filter((s) =>
    (s.Title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (playing) {
    return (
      <div className="h-full flex flex-col bg-bg-primary p-4 gap-4">
        <VideoPlayer
          url={playing.url}
          title={playing.title}
          subtitle={playing.subtitle}
          isLive={false}
          onClose={() => setPlaying(null)}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex items-center gap-4 px-6 py-3 bg-bg-secondary border-b border-border shrink-0">
        <h1 className="text-sm font-semibold text-accent-cyan">Recordings</h1>
        <span className="text-xs text-text-muted">{series.length} series</span>
        <div className="ml-auto">
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search recordings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-bg-card border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan transition-colors w-56"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-accent-red font-semibold mb-1">Failed to load recordings</p>
              <p className="text-text-muted text-sm">{error}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-16 h-16 text-text-muted mx-auto mb-3">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <p className="text-text-secondary font-medium">No recordings found</p>
              {search && <p className="text-text-muted text-sm mt-1">Try a different search term</p>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((s) => (
              <SeriesCard
                key={s.SeriesID}
                series={s}
                onPlayEpisode={(ep, title) =>
                  setPlaying({
                    url: ep.PlayURL,
                    title,
                    subtitle: ep.EpisodeTitle || ep.Title || formatDate(ep.StartTime),
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
