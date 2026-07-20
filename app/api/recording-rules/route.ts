import { NextRequest, NextResponse } from "next/server";
import { addRecordingRule, deleteRecordingRule } from "@/lib/hdhomerun";
import { syncFromDevice, syncRecordingRules } from "@/lib/sync";
import type { RecordingRuleInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rules = await syncRecordingRules();
    return NextResponse.json(rules);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch recording rules" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: RecordingRuleInput = {
      SeriesID:                 body.SeriesID,
      ChannelOnly:              body.ChannelOnly              ?? undefined,
      AfterOriginalAirdateOnly: body.AfterOriginalAirdateOnly ?? undefined,
      RecentOnly:               body.RecentOnly               ?? undefined,
      KeepUpTo:                 body.KeepUpTo                 ?? undefined,
      DateTimeOnly:             body.DateTimeOnly             ?? undefined,
      StartPadding:             body.StartPadding             ?? undefined,
      EndPadding:               body.EndPadding               ?? undefined,
    };
    await addRecordingRule(input);
    syncFromDevice().catch((e) => console.error("[recording-rules] post-add sync failed:", e));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add recording rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await deleteRecordingRule(id);
    syncFromDevice().catch((e) => console.error("[recording-rules] post-delete sync failed:", e));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete recording rule" },
      { status: 500 }
    );
  }
}
