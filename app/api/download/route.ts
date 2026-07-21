import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");
  const filename = searchParams.get("filename") ?? "recording.ts";

  if (!rawUrl) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const targetUrl = decodeURIComponent(rawUrl);
  console.log(`[hdhomerun] ${new Date().toISOString()} [DEVICE] GET ${targetUrl} {"type":"download"}`);

  let deviceRes: Response;
  try {
    deviceRes = await fetch(targetUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Failed to reach device" }, { status: 502 });
  }

  if (!deviceRes.ok) {
    return NextResponse.json({ error: `Device returned ${deviceRes.status}` }, { status: 502 });
  }

  const headers = new Headers({
    "content-type": "video/mp2t",
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "no-store",
  });

  const contentLength = deviceRes.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);

  return new Response(deviceRes.body, { status: 200, headers });
}
