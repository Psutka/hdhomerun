import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteRecordingRule } from "@/lib/hdhomerun";
import { syncFromDevice } from "@/lib/sync";
import type { ScheduledItem } from "@/lib/types";

export const dynamic = "force-dynamic";

type ScheduledRow = {
  program_id:        string;
  title:             string;
  episode_title:     string | null;
  synopsis:          string | null;
  start_time:        number;
  end_time:          number;
  channel_name:      string | null;
  channel_number:    string | null;
  image_url:         string | null;
  series_id:         string | null;
  episode_number:    string | null;
  recording_rule_id: string | null;
};

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const rows = getDb()
      .prepare(`
        SELECT * FROM scheduled_recordings
        WHERE end_time > ?
        ORDER BY start_time ASC
      `)
      .all(now) as ScheduledRow[];

    const schedule: ScheduledItem[] = rows.map((r) => ({
      ProgramID:        r.program_id,
      Title:            r.title,
      EpisodeTitle:     r.episode_title     ?? undefined,
      Synopsis:         r.synopsis          ?? undefined,
      StartTime:        r.start_time,
      EndTime:          r.end_time,
      ChannelName:      r.channel_name      ?? undefined,
      ChannelNumber:    r.channel_number    ?? undefined,
      ImageURL:         r.image_url         ?? undefined,
      SeriesID:         r.series_id         ?? undefined,
      EpisodeNumber:    r.episode_number    ?? undefined,
      RecordingRuleID:  r.recording_rule_id ?? undefined,
    }));

    return NextResponse.json(schedule);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const programId = new URL(req.url).searchParams.get("programId");
  if (!programId) {
    return NextResponse.json({ error: "programId required" }, { status: 400 });
  }

  const db = getDb();

  type MinRow = { series_id: string | null; start_time: number };
  const row = db
    .prepare("SELECT series_id, start_time FROM scheduled_recordings WHERE program_id = ?")
    .get(programId) as MinRow | undefined;

  if (!row) {
    return NextResponse.json({ error: "Scheduled recording not found" }, { status: 404 });
  }

  let deletedRule = false;

  if (row.series_id) {
    const rule = db
      .prepare("SELECT recording_rule_id FROM recording_rules WHERE series_id = ?")
      .get(row.series_id) as { recording_rule_id: string } | undefined;

    if (rule) {
      await deleteRecordingRule(rule.recording_rule_id);
      db.prepare("DELETE FROM recording_rules WHERE recording_rule_id = ?")
        .run(rule.recording_rule_id);
      deletedRule = true;
    }
  }

  db.prepare("DELETE FROM scheduled_recordings WHERE program_id = ?").run(programId);

  // Re-sync rules if we deleted one so the DB stays consistent
  if (deletedRule) {
    syncFromDevice().catch((e) => console.error("[schedule] post-delete sync failed:", e));
  }

  return NextResponse.json({ success: true, deletedRule });
}
