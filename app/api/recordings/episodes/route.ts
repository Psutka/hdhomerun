import { NextRequest, NextResponse } from "next/server";
import { getEpisodesForSeries, deleteEpisode } from "@/lib/hdhomerun";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  try {
    const episodes = await getEpisodesForSeries(decodeURIComponent(url));
    return NextResponse.json(episodes);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch episodes" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cmdUrl = searchParams.get("cmdUrl");
  if (!cmdUrl) {
    return NextResponse.json({ error: "cmdUrl required" }, { status: 400 });
  }
  try {
    await deleteEpisode(decodeURIComponent(cmdUrl));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
