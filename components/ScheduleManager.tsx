"use client";

import { useEffect, useState } from "react";
import type { ScheduledItem, RecordingRule } from "@/lib/types";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${m} ${ampm}`;
}

function formatPadding(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Tab = "upcoming" | "series";

export default function ScheduleManager() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [rules, setRules] = useState<RecordingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [sched, ruleData] = await Promise.all([
        fetch("/api/schedule").then((r) => r.json()),
        fetch("/api/recording-rules").then((r) => r.json()),
      ]);
      setScheduled(Array.isArray(sched) ? sched : []);
      setRules(Array.isArray(ruleData) ? ruleData : []);
    } catch {
      setScheduled([]);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deleteRule = async (ruleId: string) => {
    if (!confirm("Remove this recording rule?")) return;
    try {
      await fetch(`/api/recording-rules?id=${encodeURIComponent(ruleId)}`, { method: "DELETE" });
      showNotification("Recording rule removed");
      load();
    } catch {
      showNotification("Failed to remove rule");
    }
  };

  const deleteScheduledItem = async (programId: string) => {
    if (!confirm("Remove this recording?")) return;
    try {
      const res = await fetch(`/api/schedule?programId=${encodeURIComponent(programId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) showNotification(data.error || "Failed to remove recording");
      else showNotification("Recording removed");
      load();
    } catch {
      showNotification("Failed to remove recording");
    }
  };

  const upcomingByDay = scheduled.reduce<Record<string, ScheduledItem[]>>((acc, item) => {
    const day = new Date(item.StartTime * 1000).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 bg-bg-secondary border-b border-border shrink-0">
        <h1 className="text-sm font-semibold text-accent-cyan">Schedule</h1>

        <div className="flex gap-1 ml-4">
          {(["upcoming", "series"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "text-bg-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              style={tab === t ? { background: "#00d4ff" } : undefined}
            >
              {t === "upcoming" ? "Upcoming Recordings" : "Series & Rules"}
            </button>
          ))}
        </div>

        {tab === "upcoming" && (
          <span className="text-xs text-text-muted ml-2">
            {scheduled.length} scheduled
          </span>
        )}
        {tab === "series" && (
          <span className="text-xs text-text-muted ml-2">
            {rules.length} rules
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : tab === "upcoming" ? (
          scheduled.length === 0 ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-16 h-16 text-text-muted mx-auto mb-3">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              }
              title="No upcoming recordings"
              subtitle="Schedule recordings from the TV Guide"
            />
          ) : (
            <div className="space-y-6">
              {Object.entries(upcomingByDay).map(([day, items]) => (
                <div key={day}>
                  <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                    <div className="h-px bg-border flex-1" />
                    {day}
                    <div className="h-px bg-border flex-1" />
                  </h2>
                  <div className="space-y-2">
                    {items
                      .sort((a, b) => a.StartTime - b.StartTime)
                      .map((item, i) => (
                        <ScheduledItemCard key={i} item={item} onDelete={() => deleteScheduledItem(item.ProgramID)} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : rules.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-16 h-16 text-text-muted mx-auto mb-3">
                <path d="M12 2v20M2 12h20" />
              </svg>
            }
            title="No recording rules"
            subtitle='Add series recordings from the TV Guide by clicking "Record Series"'
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rules.map((rule) => (
              <RuleCard key={rule.RecordingRuleID} rule={rule} onDelete={() => deleteRule(rule.RecordingRuleID)} />
            ))}
          </div>
        )}
      </div>

      {notification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium text-white bg-bg-card border border-accent-green animate-fade-in" style={{ boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}>
          {notification}
        </div>
      )}
    </div>
  );
}

function ScheduledItemCard({ item, onDelete }: { item: ScheduledItem; onDelete: () => void }) {
  const now = Date.now() / 1000;
  const isRecording = item.StartTime <= now && item.EndTime > now;

  return (
    <div
      className={`group flex gap-4 p-3 rounded-lg border transition-all ${
        isRecording
          ? "border-accent-red bg-accent-red/5"
          : "border-border bg-bg-card hover:border-border-bright"
      }`}
    >
      {item.ImageURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.ImageURL}
          alt={item.Title}
          className="w-20 h-12 object-cover rounded shrink-0"
        />
      ) : (
        <div className="w-20 h-12 rounded shrink-0 bg-bg-secondary flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-text-muted">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-accent-red text-white animate-pulse shrink-0">
              REC
            </span>
          )}
          <p className="text-sm font-semibold text-text-primary truncate">{item.Title}</p>
        </div>
        {item.EpisodeTitle && (
          <p className="text-xs text-accent-cyan truncate">{item.EpisodeTitle}</p>
        )}
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-text-muted">{formatDateTime(item.StartTime)}</span>
          {item.ChannelName && (
            <span className="text-xs text-text-muted">{item.ChannelName}</span>
          )}
          <span className="text-xs text-text-muted">
            {formatTime(item.StartTime)} – {formatTime(item.EndTime)}
          </span>
        </div>
      </div>

      <button
        onClick={onDelete}
        className="self-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-accent-red shrink-0 p-1"
        title="Remove recording"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
      </button>
    </div>
  );
}

interface RuleCardProps {
  rule: RecordingRule;
  onDelete: () => void;
}

function RuleCard({ rule, onDelete }: RuleCardProps) {
  return (
    <div className="group rounded-xl border border-border bg-bg-card hover:border-border-bright transition-all overflow-hidden">
      <div className="flex gap-3 p-4">
        {rule.ImageURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={rule.ImageURL}
            alt={rule.Title}
            className="w-16 h-22 object-cover rounded-lg shrink-0"
            style={{ height: 88 }}
          />
        ) : (
          <div className="w-16 rounded-lg shrink-0 bg-bg-secondary flex items-center justify-center" style={{ height: 88 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-8 h-8 text-text-muted">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary leading-tight">{rule.Title}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {rule.ChannelOnly && (
              <Badge color="cyan">Ch {rule.ChannelOnly}</Badge>
            )}
            {rule.RecentOnly === 1 && (
              <Badge color="purple">New only</Badge>
            )}
            {rule.AfterOriginalAirdateOnly ? (
              <Badge color="green">
                After {new Date(rule.AfterOriginalAirdateOnly * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </Badge>
            ) : null}
            {rule.KeepUpTo ? (
              <Badge color="orange">Keep {rule.KeepUpTo}</Badge>
            ) : null}
            {rule.DateTimeOnly ? (
              <Badge color="cyan">
                One-time: {new Date(rule.DateTimeOnly * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </Badge>
            ) : null}
            {rule.StartPadding ? (
              <Badge color="purple">Start -{formatPadding(rule.StartPadding)}</Badge>
            ) : null}
            {rule.EndPadding ? (
              <Badge color="purple">End +{formatPadding(rule.EndPadding)}</Badge>
            ) : null}
          </div>
          {rule.Synopsis && (
            <p className="text-xs text-text-secondary mt-2 line-clamp-2">{rule.Synopsis}</p>
          )}
        </div>
      </div>

      <div className="border-t border-border px-4 py-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="text-xs flex items-center gap-1.5 text-text-muted hover:text-accent-red transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
          Remove rule
        </button>
      </div>
    </div>
  );
}

type BadgeColor = "cyan" | "purple" | "green" | "orange" | "red";

function Badge({ children, color }: { children: React.ReactNode; color: BadgeColor }) {
  const colors: Record<BadgeColor, string> = {
    cyan: "bg-cyan-950 text-cyan-300 border-cyan-800",
    purple: "bg-purple-950 text-purple-300 border-purple-800",
    green: "bg-emerald-950 text-emerald-300 border-emerald-800",
    orange: "bg-amber-950 text-amber-300 border-amber-800",
    red: "bg-red-950 text-red-300 border-red-800",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[color]}`}>
      {children}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        {icon}
        <p className="text-text-secondary font-medium">{title}</p>
        <p className="text-text-muted text-sm mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
