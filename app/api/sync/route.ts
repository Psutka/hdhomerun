import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { syncFromDevice } from "@/lib/sync";
import { restartSyncScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

function getSetting(key: string): string {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE key IN ('last_synced_at','sync_interval_seconds','last_sync_error')")
    .all() as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const lastSyncedAt      = parseInt(map.last_synced_at ?? "0", 10);
  const intervalSeconds   = parseInt(map.sync_interval_seconds ?? "300", 10);

  return NextResponse.json({
    lastSyncedAt,
    intervalSeconds,
    nextSyncAt:  lastSyncedAt + intervalSeconds,
    lastError:   map.last_sync_error ?? "",
  });
}

export async function POST() {
  const result = await syncFromDevice();
  // Reset the background timer so the next scheduled run is N minutes from now
  restartSyncScheduler();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
