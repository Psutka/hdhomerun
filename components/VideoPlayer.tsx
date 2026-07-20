"use client";

import { useEffect, useRef, useState } from "react";
import type mpegtsTypes from "mpegts.js";

interface VideoPlayerProps {
  url: string;
  title?: string;
  subtitle?: string;
  isLive?: boolean;
  onClose?: () => void;
}

export default function VideoPlayer({
  url,
  title,
  subtitle,
  isLive = true,
  onClose,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegtsTypes.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // playing/muted/volume are UI mirror state only — never used to drive video.play()/pause()
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const proxyUrl = `/api/stream?url=${encodeURIComponent(url)}&live=${isLive}`;

  // Init mpegts.js — dynamic import keeps SSR clean
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
  }, [url, isLive, proxyUrl]);

  // Volume / mute — write directly to the element, no effect-driven play/pause
  const applyVolume = (v: number, m: boolean) => {
    const el = videoRef.current;
    if (el) { el.volume = v; el.muted = m; }
    setVolume(v);
    setMuted(m);
  };

  // Play / pause button — call the element directly
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
      onMouseLeave={() => setShowControls(false)}
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
      />

      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 35%, rgba(0,0,0,0.4) 100%)" }}
      />

      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
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

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-3 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
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
  );
}
