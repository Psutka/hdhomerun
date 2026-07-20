import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { GuideProgram } from "@/lib/types";

export const dynamic = "force-dynamic";

type ChannelRow = {
  guide_number: string;
  guide_name:   string;
  affiliate:    string | null;
  image_url:    string | null;
  stream_url:   string | null;
};

type ProgramRow = {
  guide_number:          string;
  start_time:            number;
  end_time:              number;
  title:                 string;
  episode_title:         string | null;
  synopsis:              string | null;
  image_url:             string | null;
  series_id:             string | null;
  episode_number:        string | null;
  original_airdate:      number | null;
  filter_tags:           string | null;
  recording_rule:        number;
  recording_in_progress: number;
};

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const channelParam = searchParams.get("channels");

    // Window: 1 hour ago → 3 days from now (mirrors what the TVGuide component displays)
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 3600;
    const windowEnd   = now + 60 * 60 * 24 * 3;

    // Fetch channels
    let channelRows: ChannelRow[];
    if (channelParam) {
      const nums = channelParam.split(",").map((s) => s.trim()).filter(Boolean);
      const placeholders = nums.map(() => "?").join(",");
      channelRows = db
        .prepare(`SELECT * FROM guide_channels WHERE guide_number IN (${placeholders}) ORDER BY guide_number ASC`)
        .all(...nums) as ChannelRow[];
    } else {
      channelRows = db
        .prepare("SELECT * FROM guide_channels ORDER BY guide_number ASC")
        .all() as ChannelRow[];
    }

    // Fetch programs for those channels within the window
    const guideNumbers = channelRows.map((c) => c.guide_number);
    let programRows: ProgramRow[] = [];
    if (guideNumbers.length > 0) {
      const placeholders = guideNumbers.map(() => "?").join(",");
      programRows = db
        .prepare(`
          SELECT * FROM guide_programs
          WHERE guide_number IN (${placeholders})
            AND end_time   > ?
            AND start_time < ?
          ORDER BY guide_number, start_time ASC
        `)
        .all(...guideNumbers, windowStart, windowEnd) as ProgramRow[];
    }

    // Build set of scheduled program IDs (format: "channel_number-start_time")
    const scheduledRows = db
      .prepare("SELECT program_id FROM scheduled_recordings WHERE end_time > ?")
      .all(now) as { program_id: string }[];
    const scheduledIds = new Set(scheduledRows.map((r) => r.program_id));

    // Group programs by channel, flagging scheduled ones
    const byChannel = new Map<string, (GuideProgram & { isScheduled: boolean })[]>();
    for (const p of programRows) {
      if (!byChannel.has(p.guide_number)) byChannel.set(p.guide_number, []);
      byChannel.get(p.guide_number)!.push({
        Title:                p.title,
        EpisodeTitle:         p.episode_title        ?? undefined,
        Synopsis:             p.synopsis             ?? undefined,
        StartTime:            p.start_time,
        EndTime:              p.end_time,
        ImageURL:             p.image_url            ?? undefined,
        SeriesID:             p.series_id            ?? undefined,
        EpisodeNumber:        p.episode_number       ?? undefined,
        OriginalAirdate:      p.original_airdate     ?? undefined,
        Filter:               p.filter_tags ? JSON.parse(p.filter_tags) : undefined,
        RecordingRule:        p.recording_rule       || undefined,
        RecordingInProgress:  p.recording_in_progress || undefined,
        isScheduled:          scheduledIds.has(`${p.guide_number}-${p.start_time}`),
      });
    }

    const channels = channelRows.map((c) => ({
      GuideNumber: c.guide_number,
      GuideName:   c.guide_name,
      Affiliate:   c.affiliate  ?? undefined,
      ImageURL:    c.image_url  ?? undefined,
      StreamURL:   c.stream_url ?? null,
      Guide:       byChannel.get(c.guide_number) ?? [],
    }));

    // Include last sync time so the client knows if the DB has ever been populated
    const syncRow = db
      .prepare("SELECT value FROM settings WHERE key = 'last_guide_synced_at'")
      .get() as { value: string } | undefined;

    return NextResponse.json({
      channels,
      lastSyncedAt: parseInt(syncRow?.value ?? "0", 10),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch guide" },
      { status: 500 }
    );
  }
}
