import { NextResponse } from "next/server";
import { getDeviceInfo } from "@/lib/hdhomerun";

export async function GET() {
  try {
    const device = await getDeviceInfo();
    return NextResponse.json(device);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Device unavailable" },
      { status: 503 }
    );
  }
}
