import { NextResponse } from "next/server";
import { getRecordingGroups } from "@/lib/hdhomerun";

export async function GET() {
  try {
    const groups = await getRecordingGroups();
    return NextResponse.json(groups);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}
