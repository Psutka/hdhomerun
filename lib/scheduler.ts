import { getDb } from "./db";
import { syncFromDevice, syncGuide } from "./sync";

declare global {
  // eslint-disable-next-line no-var
  var __syncTimer: NodeJS.Timeout | undefined;
  // eslint-disable-next-line no-var
  var __guideTimer: NodeJS.Timeout | undefined;
}

// ── Rules / schedule scheduler (default 5 min) ──────────────────────────────

function getIntervalMs(): number {
  try {
    const row = getDb()
      .prepare("SELECT value FROM settings WHERE key = 'sync_interval_seconds'")
      .get() as { value: string } | undefined;
    const s = parseInt(row?.value ?? "300", 10);
    return (isNaN(s) || s < 60 ? 300 : s) * 1000;
  } catch {
    return 300_000;
  }
}

async function tick() {
  global.__syncTimer = undefined;
  const result = await syncFromDevice();
  if (result.error) {
    console.error("[scheduler] sync error:", result.error);
  } else {
    console.log(`[scheduler] synced ${result.rulesCount} rules, ${result.scheduledCount} scheduled`);
  }
  global.__syncTimer = setTimeout(tick, getIntervalMs());
}

export function startSyncScheduler() {
  if (global.__syncTimer) return;
  tick().catch((err) => console.error("[scheduler] initial sync failed:", err));
}

export function restartSyncScheduler() {
  if (global.__syncTimer) {
    clearTimeout(global.__syncTimer);
    global.__syncTimer = undefined;
  }
  tick().catch((err) => console.error("[scheduler] restart sync failed:", err));
}

// ── Guide scheduler (default 15 min) ────────────────────────────────────────

function getGuideIntervalMs(): number {
  try {
    const row = getDb()
      .prepare("SELECT value FROM settings WHERE key = 'guide_sync_interval_seconds'")
      .get() as { value: string } | undefined;
    const s = parseInt(row?.value ?? "900", 10);
    return (isNaN(s) || s < 60 ? 900 : s) * 1000;
  } catch {
    return 900_000;
  }
}

async function guideTick() {
  global.__guideTimer = undefined;
  const result = await syncGuide();
  if (result.error) {
    console.error("[scheduler] guide sync error:", result.error);
  } else {
    console.log(`[scheduler] guide synced: ${result.channelCount} channels, ${result.programCount} programs`);
  }
  global.__guideTimer = setTimeout(guideTick, getGuideIntervalMs());
}

export function startGuideScheduler() {
  if (global.__guideTimer) return;
  guideTick().catch((err) => console.error("[scheduler] initial guide sync failed:", err));
}

export function restartGuideScheduler() {
  if (global.__guideTimer) {
    clearTimeout(global.__guideTimer);
    global.__guideTimer = undefined;
  }
  guideTick().catch((err) => console.error("[scheduler] guide restart sync failed:", err));
}
