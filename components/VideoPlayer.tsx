"use client";

import { useEffect, useRef, useState } from "react";
import type mpegtsTypes from "mpegts.js";

interface VideoPlayerProps {
  url: string;
  title?: string;
  subtitle?: string;
  isLive?: boolean;
  duration?: number; // seconds — from RecordDuration metadata
  onClose?: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoPlayer({
  url,
  title,
  subtitle,
  isLive = true,
  duration,
  onClose,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegtsTypes.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  // playing/muted/volume are UI mirror state only — never used to drive video.play()/pause()
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Timeline state
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  // seekStart drives a stream restart: changing it updates proxyUrl → triggers useEffect
  const [seekStart, setSeekStart] = useState(0);
  // scrubTime is non-null while user is dragging — moves the thumb without seeking yet
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  // tracks the recording-time offset at which the current stream was started
  const seekOffsetRef = useRef(0);

  // Prefer video-reported duration; fall back to metadata prop
  const effectiveDuration =
    videoDuration > 0 && isFinite(videoDuration) ? videoDuration : (duration ?? 0);
  // Actual position in the recording = where the stream started + elapsed time in that stream
  const recordingTime = seekOffsetRef.current + videoCurrentTime;
  // While scrubbing show the drag position; otherwise show live position
  const displayTime = scrubTime !== null ? scrubTime : recordingTime;
  const progress = effectiveDuration > 0 ? Math.min(1, displayTime / effectiveDuration) : 0;

  // Show for all recordings; seek is disabled when duration is unknown
  const showTimeline = !isLive;
  const canSeek = effectiveDuration > 0;

  const proxyUrl =
    `/api/stream?url=${encodeURIComponent(url)}&live=${isLive}` +
    (seekStart > 0 ? `&startTime=${Math.floor(seekStart)}` : "");

  // Init / reinit mpegts.js whenever the proxy URL changes (seek restart changes it)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    import("mpegts.js").then((mod) => {
      if (cancelled) return;
      const mpegts = mod.default;

      if (!mpegts.isSupported()) {
        setError("Your browser does not support MPEG-TS playback (MSE required).");
        return;
      }

      const player = mpegts.createPlayer(
        { type: "mpegts", isLive, url: proxyUrl },
        { enableWorker: false }
      );

      player.on(mpegts.Events.ERROR, (type: unknown, detail: unknown) => {
        console.error("mpegts error:", type, detail);
        setError(`Playback error (${type}) — check the stream URL or device.`);
      });

      player.attachMediaElement(video);
      player.load();
      video.play().catch(() => {});

      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [proxyUrl]); // proxyUrl encodes url + isLive + seekStart

  // Volume / mute — write directly to the element
  const applyVolume = (v: number, m: boolean) => {
    const el = videoRef.current;
    if (el) { el.volume = v; el.muted = m; }
    setVolume(v);
    setMuted(m);
  };

  // Play / pause button
  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  // Auto-hide controls
  const resetControlsTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    resetControlsTimer();
    return () => clearTimeout(controlsTimer.current);
  }, []); // intentional: run once on mount

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) await containerRef.current.requestFullscreen();
    else await document.exitFullscreen();
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Timeline / seek ──────────────────────────────────────────────────────

  const getTimeFromClientX = (clientX: number): number => {
    const el = scrubberRef.current;
    if (!el || effectiveDuration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * effectiveDuration;
  };

  const handleSeek = (targetTime: number) => {
    const video = videoRef.current;
    if (!video || effectiveDuration <= 0) return;
    const clamped = Math.max(0, Math.min(effectiveDuration, targetTime));

    // Fast path: target is within the already-buffered range of the current stream
    const streamTime = clamped - seekOffsetRef.current;
    for (let i = 0; i < video.buffered.length; i++) {
      if (streamTime >= video.buffered.start(i) - 0.5 && streamTime <= video.buffered.end(i)) {
        video.currentTime = streamTime;
        return;
      }
    }

    // Restart ffmpeg from the target position
    seekOffsetRef.current = clamped;
    setVideoCurrentTime(0);
    setSeekStart(clamped);
  };

  const handleScrubberPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    // Keep controls visible while scrubbing
    clearTimeout(controlsTimer.current);
    setShowControls(true);
    setScrubTime(getTimeFromClientX(e.clientX));
  };

  const handleScrubberPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubTime !== null) setScrubTime(getTimeFromClientX(e.clientX));
  };

  const handleScrubberPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (scrubTime !== null) {
      handleSeek(scrubTime);
      setScrubTime(null);
    }
    resetControlsTimer();
  };

  if (error) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg flex flex-col items-center justify-center gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-accent-red">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <p className="text-white/80 text-sm text-center px-6">{error}</p>
        {onClose && (
          <button onClick={onClose} className="text-xs text-white/50 hover:text-white mt-2">
            Go back
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => { if (scrubTime === null) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        className="w-full aspect-video"
        autoPlay
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(e) => {
          const el = e.currentTarget;
          setMuted(el.muted);
          setVolume(el.volume);
        }}
        onTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) setVideoDuration(d);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) setVideoDuration(d);
        }}
      />

      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 40%, rgba(0,0,0,0.4) 100%)" }}
      />

      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div>
          {title && <p className="text-white font-semibold text-lg leading-tight drop-shadow">{title}</p>}
          {subtitle && <p className="text-white/70 text-sm drop-shadow">{subtitle}</p>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom controls + timeline */}
      <div className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>

        {/* Timeline scrubber */}
        {showTimeline && (
          <div className="px-4 pb-1 group">
            <div
              ref={scrubberRef}
              className={`relative w-full ${canSeek ? "cursor-pointer" : "cursor-default"}`}
              style={{ height: 20 }}
              onPointerDown={canSeek ? handleScrubberPointerDown : undefined}
              onPointerMove={canSeek ? handleScrubberPointerMove : undefined}
              onPointerUp={canSeek ? handleScrubberPointerUp : undefined}
            >
              {/* Track */}
              <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 ${canSeek ? "group-hover:h-1.5" : ""} transition-all duration-150 rounded-full bg-white/25 overflow-hidden`}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-accent-cyan"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              {/* Thumb — only shown when seekable */}
              {canSeek && (
                <div
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md transition-opacity duration-150 pointer-events-none ${scrubTime !== null ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  style={{ left: `${progress * 100}%` }}
                />
              )}
            </div>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Skip back 30s */}
          {!isLive && (
            <button
              onClick={() => handleSeek(Math.max(0, recordingTime - 30))}
              className="text-white hover:text-accent-cyan transition-colors"
              title="Back 30 seconds"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                <text x="12" y="15.5" textAnchor="middle" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif" fill="currentColor">30</text>
              </svg>
            </button>
          )}

          <button onClick={togglePlay} className="text-white hover:text-accent-cyan transition-colors">
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip forward 30s */}
          {!isLive && (
            <button
              onClick={() => handleSeek(recordingTime + 30)}
              className="text-white hover:text-accent-cyan transition-colors"
              title="Forward 30 seconds"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/>
                <text x="12" y="15.5" textAnchor="middle" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif" fill="currentColor">30</text>
              </svg>
            </button>
          )}

          <button onClick={() => applyVolume(volume, !muted)} className="text-white hover:text-accent-cyan transition-colors">
            {muted || volume === 0 ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          <input
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => applyVolume(+e.target.value, false)}
            className="w-20 accent-cyan-400"
          />

          {/* Time display */}
          {showTimeline && (
            <span className="text-white/80 text-xs tabular-nums select-none">
              {formatTime(displayTime)}{canSeek ? ` / ${formatTime(effectiveDuration)}` : ""}
            </span>
          )}

          <div className="ml-auto">
            <button onClick={toggleFullscreen} className="text-white hover:text-accent-cyan transition-colors">
              {fullscreen ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
