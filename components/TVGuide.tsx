"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GuideChannel, GuideProgram } from "@/lib/types";

type ScheduledGuideProgram = GuideProgram & { isScheduled?: boolean };
type EnrichedChannel = Omit<GuideChannel, "Guide"> & {
  Guide: ScheduledGuideProgram[];
  StreamURL?: string | null;
};
import VideoPlayer from "./VideoPlayer";

const PIXELS_PER_MINUTE = 4;
const CHANNEL_COL_WIDTH = 130;
const ROW_HEIGHT = 56;
const TIME_HEADER_HEIGHT = 36;

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface ProgramColors {
  bg: string;
  border: string;
  text: string;
}

const PROGRAM_PALETTES: ProgramColors[] = [
  { bg: "#1a2744", border: "#2563eb", text: "#93c5fd" },
  { bg: "#1a1a44", border: "#7c3aed", text: "#c4b5fd" },
  { bg: "#1a2e1a", border: "#059669", text: "#6ee7b7" },
  { bg: "#2e1a2e", border: "#db2777", text: "#f9a8d4" },
  { bg: "#2e1a1a", border: "#dc2626", text: "#fca5a5" },
  { bg: "#1a2e2e", border: "#0891b2", text: "#67e8f9" },
];

function getProgramColor(title: string): ProgramColors {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff;
  }
  return PROGRAM_PALETTES[Math.abs(hash) % PROGRAM_PALETTES.length];
}

interface ProgramBlockProps {
  program: ScheduledGuideProgram;
  guideStart: number;
  isCurrent: boolean;
  onClick: () => void;
}

function ProgramBlock({ program, guideStart, isCurrent, onClick }: ProgramBlockProps) {
  const leftMinutes = Math.max(0, (program.StartTime - guideStart) / 60);
  const widthMinutes = (program.EndTime - program.StartTime) / 60;
  const left = leftMinutes * PIXELS_PER_MINUTE;
  const width = Math.max(2, widthMinutes * PIXELS_PER_MINUTE - 2);

  const colors = getProgramColor(program.Title);
  const now = Date.now() / 1000;
  const progress =
    isCurrent && program.StartTime <= now
      ? ((now - program.StartTime) / (program.EndTime - program.StartTime)) * 100
      : 0;

  return (
    <div
      className="guide-program select-none"
      style={{
        left,
        width,
        background: colors.bg,
        borderLeft: `2px solid ${colors.border}`,
        borderTop: isCurrent ? `1px solid ${colors.border}` : undefined,
        borderBottom: isCurrent ? `1px solid ${colors.border}` : undefined,
        borderRight: isCurrent ? `1px solid ${colors.border}` : undefined,
      }}
      onClick={onClick}
      title={`${program.Title}${program.EpisodeTitle ? ` — ${program.EpisodeTitle}` : ""}\n${formatTime(program.StartTime)} – ${formatTime(program.EndTime)}`}
    >
      {isCurrent && progress > 0 && (
        <div
          className="absolute bottom-0 left-0 h-0.5 opacity-60"
          style={{ width: `${progress}%`, background: colors.border }}
        />
      )}
      {program.isScheduled && (
        <div
          className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-red shrink-0"
          style={{ boxShadow: "0 0 5px rgba(239,68,68,0.9)" }}
        />
      )}
      <p
        className="text-xs font-semibold truncate leading-tight"
        style={{ color: colors.text }}
      >
        {program.Title}
      </p>
      {width > 80 && program.EpisodeTitle && (
        <p className="text-xs truncate leading-tight" style={{ color: colors.text, opacity: 0.7 }}>
          {program.EpisodeTitle}
        </p>
      )}
      {width > 60 && (
        <p className="text-xs leading-tight" style={{ color: colors.border, opacity: 0.8 }}>
          {formatTime(program.StartTime)}
        </p>
      )}
    </div>
  );
}

interface ProgramModalProps {
  program: ScheduledGuideProgram;
  channel: EnrichedChannel;
  onClose: () => void;
  onWatch: () => void;
  onRecord: () => void;
  onRecordSeries: () => void;
  onRemoveRecording: () => void;
}

function ProgramModal({ program, channel, onClose, onWatch, onRecord, onRecordSeries, onRemoveRecording }: ProgramModalProps) {
  const now = Date.now() / 1000;
  const isLive = program.StartTime <= now && program.EndTime > now;
  const isFuture = program.StartTime > now;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-bg-card border border-border-bright rounded-xl max-w-lg w-full p-6 animate-fade-in shadow-2xl"
        style={{ boxShadow: "0 0 60px rgba(0,0,0,0.8)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          {program.ImageURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={program.ImageURL}
              alt={program.Title}
              className="w-24 h-16 object-cover rounded-lg shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isLive && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-red text-white animate-pulse">
                  LIVE
                </span>
              )}
              <span className="text-xs text-text-secondary">
                {channel.GuideName} {channel.GuideNumber}
              </span>
            </div>
            <h2 className="text-lg font-bold text-text-primary leading-tight">{program.Title}</h2>
            {program.EpisodeTitle && (
              <p className="text-sm text-accent-cyan mt-0.5">{program.EpisodeTitle}</p>
            )}
            <p className="text-xs text-text-secondary mt-1">
              {formatTime(program.StartTime)} – {formatTime(program.EndTime)} · {formatDate(program.StartTime)}
            </p>
            {program.EpisodeNumber && (
              <p className="text-xs text-text-muted mt-0.5">{program.EpisodeNumber}</p>
            )}
          </div>
        </div>

        {program.Synopsis && (
          <p className="text-sm text-text-secondary mb-5 leading-relaxed">{program.Synopsis}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {isLive && channel.StreamURL && (
            <button
              onClick={onWatch}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-bg-primary transition-all hover:brightness-110 active:scale-95"
              style={{ background: "#00d4ff", boxShadow: "0 0 16px rgba(0,212,255,0.4)" }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch Live
            </button>
          )}

          {isFuture && (
            <button
              onClick={onRecord}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:brightness-110 active:scale-95"
              style={{ background: "#ef4444", boxShadow: "0 0 12px rgba(239,68,68,0.3)" }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <circle cx="12" cy="12" r="8" />
              </svg>
              Record
            </button>
          )}

          {isFuture && program.SeriesID && (
            <button
              onClick={onRecordSeries}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:brightness-110 active:scale-95"
              style={{ background: "#7c3aed", boxShadow: "0 0 12px rgba(124,58,237,0.3)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M12 2v20M2 12h20" />
              </svg>
              Record Series
            </button>
          )}

          {program.isScheduled && (
            <button
              onClick={onRemoveRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:brightness-110 active:scale-95"
              style={{
                color: "#ef4444",
                border: "1px solid #ef4444",
                background: "rgba(239,68,68,0.08)",
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
              Remove Recording
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary border border-border hover:border-border-bright transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TVGuide() {
  const [channels, setChannels] = useState<EnrichedChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false); // true when guide has never been synced
  const [error, setError] = useState<string | null>(null);
  const [guideStart, setGuideStart] = useState(0);
  const [selectedProgram, setSelectedProgram] = useState<{
    program: ScheduledGuideProgram;
    channel: EnrichedChannel;
  } | null>(null);
  const [watchingStream, setWatchingStream] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const now = Date.now() / 1000;
    const startOfHour = Math.floor(now / 3600) * 3600 - 3600;
    setGuideStart(startOfHour);

    const load = (isRetry = false) => {
      if (!isRetry) setLoading(true);
      fetch("/api/guide")
        .then((r) => r.json())
        .then((data: { channels?: typeof channels; lastSyncedAt?: number; error?: string }) => {
          if (data.error) {
            setError(data.error);
            setLoading(false);
            return;
          }
          const ch = data.channels ?? [];
          const neverSynced = (data.lastSyncedAt ?? 0) === 0;
          setChannels(ch);
          setSyncing(neverSynced && ch.length === 0);
          setLoading(false);
          // Poll every 15 s until the first guide sync completes
          if (neverSynced && ch.length === 0) {
            pollRef.current = setTimeout(() => load(true), 15_000);
          }
        })
        .catch(() => {
          setError("Network error");
          setLoading(false);
        });
    };

    load();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  // Scroll to current time on load
  useEffect(() => {
    if (channels.length === 0 || !scrollRef.current) return;
    const now = Date.now() / 1000;
    const minutesSinceStart = (now - guideStart) / 60;
    const scrollLeft = minutesSinceStart * PIXELS_PER_MINUTE - 100;
    scrollRef.current.scrollLeft = Math.max(0, scrollLeft);
  }, [channels, guideStart]);

  // Sync timeline scroll with main scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !timelineRef.current) return;
    timelineRef.current.scrollLeft = scrollRef.current.scrollLeft;
  }, []);

  // Update "now" line every minute
  useEffect(() => {
    const update = () => {
      if (!nowLineRef.current) return;
      const now = Date.now() / 1000;
      const minutes = (now - guideStart) / 60;
      const left = minutes * PIXELS_PER_MINUTE + CHANNEL_COL_WIDTH;
      nowLineRef.current.style.left = `${left}px`;
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [guideStart]);

  const guideEnd = guideStart + 60 * 60 * 24 * 3;
  const totalMinutes = (guideEnd - guideStart) / 60;
  const totalWidth = totalMinutes * PIXELS_PER_MINUTE;

  const timeLabels: { label: string; left: number }[] = [];
  for (let t = guideStart; t < guideEnd; t += 3600) {
    const left = ((t - guideStart) / 60) * PIXELS_PER_MINUTE;
    timeLabels.push({ label: formatTime(t), left });
  }

  const handleWatch = () => {
    if (!selectedProgram?.channel.StreamURL) return;
    setWatchingStream({
      url: selectedProgram.channel.StreamURL,
      title: selectedProgram.channel.GuideName,
      subtitle: selectedProgram.program.Title,
    });
    setSelectedProgram(null);
  };

  const handleRecord = async () => {
    if (!selectedProgram) return;
    const { program, channel } = selectedProgram;
    try {
      const res = await fetch("/api/recording-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          SeriesID: program.SeriesID || `${channel.GuideNumber}-${program.StartTime}`,
          ChannelOnly: channel.GuideNumber,
          DateTimeOnly: program.StartTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) showNotification(data.error || "Failed to schedule recording");
      else showNotification(`Recording scheduled: ${program.Title}`);
    } catch {
      showNotification("Failed to schedule recording");
    }
    setSelectedProgram(null);
  };

  const handleRecordSeries = async () => {
    if (!selectedProgram) return;
    const { program, channel } = selectedProgram;
    try {
      const res = await fetch("/api/recording-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          SeriesID: program.SeriesID,
          ChannelOnly: channel.GuideNumber,
          RecentOnly: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) showNotification(data.error || "Failed to add series recording");
      else showNotification(`Series recording added: ${program.Title}`);
    } catch {
      showNotification("Failed to add series recording");
    }
    setSelectedProgram(null);
  };

  const handleRemoveRecording = async () => {
    if (!selectedProgram) return;
    const { program, channel } = selectedProgram;
    const programId = `${channel.GuideNumber}-${program.StartTime}`;
    try {
      const res = await fetch(`/api/schedule?programId=${encodeURIComponent(programId)}`, {
        method: "DELETE",
      });
      const data: { success?: boolean; deletedRule?: boolean; error?: string } = await res.json();
      if (!res.ok) {
        showNotification(data.error || "Failed to remove recording");
      } else {
        showNotification(
          data.deletedRule ? `Recording cancelled: ${program.Title}` : `Episode removed from schedule: ${program.Title}`
        );
        // Clear the red dot immediately without waiting for a guide re-fetch
        setChannels((prev) =>
          prev.map((ch) =>
            ch.GuideNumber !== channel.GuideNumber
              ? ch
              : {
                  ...ch,
                  Guide: ch.Guide.map((p) =>
                    p.StartTime === program.StartTime ? { ...p, isScheduled: false } : p
                  ),
                }
          )
        );
      }
    } catch {
      showNotification("Failed to remove recording");
    }
    setSelectedProgram(null);
  };

  if (watchingStream) {
    return (
      <div className="h-full flex flex-col bg-bg-primary p-4">
        <VideoPlayer
          url={watchingStream.url}
          title={watchingStream.title}
          subtitle={watchingStream.subtitle}
          isLive={true}
          onClose={() => setWatchingStream(null)}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-5">
          <svg
            className="animate-spin"
            style={{ width: 48, height: 48, color: "#00d4ff", filter: "drop-shadow(0 0 10px rgba(0,212,255,0.5))" }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-text-primary font-semibold">Loading TV Guide</p>
        </div>
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-5 max-w-sm text-center">
          <svg
            className="animate-spin"
            style={{ width: 48, height: 48, color: "#7c3aed", filter: "drop-shadow(0 0 10px rgba(124,58,237,0.5))" }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-text-primary font-semibold text-base">Building Guide</p>
            <p className="text-text-secondary text-sm mt-1">
              Fetching program data from the HDHomerun cloud for the first time.
              This takes about a minute — the page will update automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-accent-red text-5xl mb-4">⚠</div>
          <p className="text-text-primary font-semibold text-lg mb-2">Guide Unavailable</p>
          <p className="text-text-secondary text-sm">{error}</p>
          <p className="text-text-muted text-xs mt-2">Check that your device IP is set in .env.local</p>
        </div>
      </div>
    );
  }

  const now = Date.now() / 1000;
  const nowLeft = ((now - guideStart) / 60) * PIXELS_PER_MINUTE;

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Date strip */}
      <div className="flex items-center gap-4 px-4 py-2 bg-bg-secondary border-b border-border shrink-0">
        <span className="text-sm font-semibold text-accent-cyan">TV Guide</span>
        <span className="text-xs text-text-secondary">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </span>
        <button
          onClick={() => {
            const minutesSinceStart = (now - guideStart) / 60;
            if (scrollRef.current) {
              scrollRef.current.scrollLeft = Math.max(0, minutesSinceStart * PIXELS_PER_MINUTE - 100);
            }
          }}
          className="text-xs px-3 py-1 rounded-full border border-accent-cyan text-accent-cyan hover:bg-accent-cyan hover:text-bg-primary transition-colors ml-auto"
        >
          Now
        </button>
      </div>

      {/* Time header + channel grid wrapper */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Time header */}
        <div className="flex shrink-0 bg-bg-secondary border-b border-border" style={{ height: TIME_HEADER_HEIGHT }}>
          {/* Channel label col */}
          <div
            className="shrink-0 flex items-center px-3 text-xs font-semibold text-text-muted uppercase tracking-wider border-r border-border"
            style={{ width: CHANNEL_COL_WIDTH }}
          >
            Channel
          </div>
          {/* Timeline */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-hidden relative"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="relative" style={{ width: totalWidth, height: TIME_HEADER_HEIGHT }}>
              {timeLabels.map((t, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex items-center"
                  style={{ left: t.left, height: TIME_HEADER_HEIGHT }}
                >
                  <div className="h-full w-px bg-border mr-2" />
                  <span className="text-xs text-text-muted whitespace-nowrap">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Channel rows */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          onScroll={handleScroll}
        >
          {/* Now line */}
          <div
            ref={nowLineRef}
            className="sticky top-0 pointer-events-none z-20"
            style={{ position: "sticky", height: 0 }}
          >
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: nowLeft + CHANNEL_COL_WIDTH,
                width: 2,
                background: "#00d4ff",
                height: channels.length * ROW_HEIGHT,
                boxShadow: "0 0 8px rgba(0,212,255,0.6)",
              }}
            />
          </div>

          <div style={{ width: totalWidth + CHANNEL_COL_WIDTH, position: "relative" }}>
            {channels.map((ch) => {
              const isCurrentCh = ch.StreamURL !== undefined;
              return (
                <div
                  key={ch.GuideNumber}
                  className="flex border-b border-border hover:bg-bg-hover/30 transition-colors"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Channel name col */}
                  <div
                    className="shrink-0 flex flex-col justify-center px-3 border-r border-border bg-bg-secondary/80 sticky left-0 z-10 cursor-pointer hover:bg-bg-hover transition-colors"
                    style={{ width: CHANNEL_COL_WIDTH }}
                    onClick={() => {
                      if (ch.StreamURL && isCurrentCh) {
                        setWatchingStream({
                          url: ch.StreamURL,
                          title: ch.GuideName,
                          subtitle: `Ch ${ch.GuideNumber}`,
                        });
                      }
                    }}
                  >
                    <p className="text-xs font-bold text-text-primary truncate">{ch.GuideName}</p>
                    <p className="text-xs text-text-muted">{ch.GuideNumber}</p>
                    {ch.StreamURL && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                        <span className="text-xs text-accent-green">Live</span>
                      </div>
                    )}
                  </div>

                  {/* Program blocks */}
                  <div className="relative flex-1" style={{ height: ROW_HEIGHT }}>
                    {ch.Guide?.filter(
                      (p) => p.EndTime > guideStart && p.StartTime < guideEnd
                    ).map((program, pi) => {
                      const isCurrentProg = program.StartTime <= now && program.EndTime > now;
                      return (
                        <ProgramBlock
                          key={pi}
                          program={program}
                          guideStart={guideStart}
                          isCurrent={isCurrentProg}
                          onClick={() => setSelectedProgram({ program, channel: ch })}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Program detail modal */}
      {selectedProgram && (
        <ProgramModal
          program={selectedProgram.program}
          channel={selectedProgram.channel}
          onClose={() => setSelectedProgram(null)}
          onWatch={handleWatch}
          onRecord={handleRecord}
          onRecordSeries={handleRecordSeries}
          onRemoveRecording={handleRemoveRecording}
        />
      )}

      {/* Notification toast */}
      {notification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium text-white bg-bg-card border border-accent-green animate-fade-in" style={{ boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}>
          {notification}
        </div>
      )}
    </div>
  );
}
