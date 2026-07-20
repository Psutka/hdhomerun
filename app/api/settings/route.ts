import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { restartSyncScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// Keys the client is allowed to modify
const WRITABLE_KEYS = new Set(["sync_interval_seconds"]);

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function PUT(req: NextRequest) {
  const body: Record<string, unknown> = await req.json();
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  const updated: string[] = [];

  db.transaction(() => {
    for (const [key, value] of Object.entries(body)) {
      if (!WRITABLE_KEYS.has(key)) continue;
      if (typeof value !== "string" && typeof value !== "number") continue;
      if (key === "sync_interval_seconds") {
        const n = parseInt(String(value), 10);
        if (isNaN(n) || n < 60) {
          throw new Error("sync_interval_seconds must be a number >= 60");
        }
      }
      upsert.run(key, String(value), now);
      updated.push(key);
    }
  })();

  if (updated.includes("sync_interval_seconds")) {
    restartSyncScheduler();
  }

  return NextResponse.json({ updated });
}
