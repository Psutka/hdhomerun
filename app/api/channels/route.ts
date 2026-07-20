import { NextResponse } from "next/server";
import { getChannels } from "@/lib/hdhomerun";

export async function GET() {
  try {
    const channels = await getChannels();
    return NextResponse.json(channels);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch channels" },
      { status: 500 }
    );
  }
}
