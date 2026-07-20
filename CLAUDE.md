# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Web DVR client for interfacing with an HDHomerun device on the local network. Features a TV guide with live viewing and recording scheduling, a recordings browser with playback, and a schedule/rules manager.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint check
```

No test suite is configured.

## Environment

`HDHOMERUN_IP` in `.env.local` sets the device IP (defaults to `192.168.1.100`). The device must be reachable on the local network. `ffmpeg` must be installed on the host for streaming to work.

## Architecture

### Data flow

All HDHomerun API calls go through [lib/hdhomerun.ts](lib/hdhomerun.ts). It communicates with two backends:

- **Device directly** (`http://$HDHOMERUN_IP`) — lineup, recordings, device info
- **HDHomerun cloud** (`https://api.hdhomerun.com/api`) — guide data, recording rules. Requires `DeviceAuth` token from the device's `discover.json`.

Next.js route handlers in `app/api/` are thin wrappers that call `lib/hdhomerun.ts` and return JSON. Client components fetch from these routes — never directly from the device or cloud.

### Streaming

`app/api/stream/route.ts` spawns `ffmpeg` server-side to transcode the MPEG-TS stream from the device. It transcodes video to H.264 (libx264, main profile) and audio AC-3 → AAC, then streams raw MPEG-TS to the client. `VideoPlayer.tsx` uses `mpegts.js` to play this stream in the browser via MSE.

The `/api/stream` endpoint accepts `?url=<encoded-stream-url>&live=true|false`.

### Types

All shared types are in [lib/types.ts](lib/types.ts). Key types: `DeviceInfo`, `Channel`, `GuideChannel`/`GuideProgram`, `RecordingSeries`/`RecordingEpisode`, `RecordingRule`, `ScheduledItem`.

### Guide

The guide API fetches channels in batches of 5 (HDHomerun cloud is per-channel). The guide route enriches guide data with the device stream URL from the local lineup. Guide data is cached for 5 minutes via Next.js `revalidate`.

### Schedule

Scheduled items are derived — there is no native HDHomerun schedule endpoint. `getSchedule()` cross-references `RecordingRule` series IDs against upcoming guide entries to show what will record.

## SQLite database

`hdhomerun.db` is created at the project root on first server start (gitignored; WAL mode). The schema lives in [lib/db.ts](lib/db.ts) and is applied via `initSchema` on every cold start.

**Tables**

| Table | Purpose |
|---|---|
| `settings` | Key/value config. Keys: `sync_interval_seconds` (default 300), `last_synced_at`, `last_sync_error` |
| `series_rules` | Recording rules synced from the HDHomerun cloud — mirrors `RecordingRule` type |
| `scheduled_recordings` | Upcoming recordings derived from rules × guide — mirrors `ScheduledItem` type |

**Sync architecture**

- [lib/sync.ts](lib/sync.ts) — `syncFromDevice()` fetches rules and schedule from HDHomerun, upserts both tables in a single transaction, and prunes stale rows (past `end_time`, deleted rules).
- [lib/scheduler.ts](lib/scheduler.ts) — background `setTimeout` loop. Runs first sync immediately on startup, then re-schedules after each tick using the current `sync_interval_seconds` value (so interval changes take effect on the next tick).
- [instrumentation.ts](instrumentation.ts) — Next.js server startup hook that initializes the DB and starts the scheduler. Runs once per process in the Node.js runtime.

**Affected API routes**

- `GET /api/schedule` — reads `scheduled_recordings` from DB (was live-computed)
- `GET /api/rules` — reads `series_rules` from DB (was live-fetched from cloud)
- `POST/DELETE /api/rules` — calls HDHomerun cloud then triggers a background sync
- `GET /api/sync` — returns sync status (`lastSyncedAt`, `intervalSeconds`, `nextSyncAt`, `lastError`)
- `POST /api/sync` — triggers immediate sync and resets the background timer
- `GET /api/settings` — returns all settings rows
- `PUT /api/settings` — updates writable keys (`sync_interval_seconds` ≥ 60); restarts scheduler if interval changes

## Styling

Tailwind with a custom dark theme defined in [tailwind.config.ts](tailwind.config.ts). Use semantic tokens:

- **Backgrounds**: `bg-bg-primary` / `bg-bg-secondary` / `bg-bg-card` / `bg-bg-hover`
- **Accent colors**: `accent-cyan` (primary interactive), `accent-purple`, `accent-pink`, `accent-green`, `accent-red`, `accent-orange`
- **Text**: `text-text-primary` / `text-text-secondary` / `text-text-muted`
- **Borders**: `border-border` / `border-border-bright`
