import { type NextRequest } from "next/server";
import { spawn } from "child_process";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

// Stream from the HDHomerun device via ffmpeg.
// ffmpeg copies H.264 video and transcodes AC-3 audio → AAC (required by Chrome MSE).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return new Response(JSON.stringify({ error: "url required" }), { status: 400 });
  }

  const targetUrl = decodeURIComponent(rawUrl);
  const isLive = searchParams.get("live") !== "false";
  console.log(`[hdhomerun] ${new Date().toISOString()} [DEVICE] GET ${targetUrl} {"type":"${isLive ? "live" : "recording"}","via":"ffmpeg"}`);

  const ffmpeg = spawn("ffmpeg", [
    // no -re: the device already streams at broadcast rate
    "-i", targetUrl,
    "-c:v", "libx264",             // software H.264 — consistent profile (VideoToolbox changes profiles mid-stream, breaking MSE)
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-profile:v", "main",
    "-level:v", "4.0",
    "-c:a", "aac",                 // AC-3 (broadcast audio) → AAC (Chrome MSE)
    "-b:a", "192k",
    "-ac", "2",                    // downmix to stereo
    "-f", "mpegts",
    "-",                           // output to stdout
  ]);

  ffmpeg.stderr.on("data", (d: Buffer) => {
    const line = d.toString();
    if (!line.includes("frame=") && !line.includes("fps=")) {
      console.log("[hdhomerun] [ffmpeg]", line.trimEnd());
    }
  });

  req.signal.addEventListener("abort", () => ffmpeg.kill("SIGKILL"));

  const headers = new Headers({
    "content-type": "video/mp2t",
    "access-control-allow-origin": "*",
    "cache-control": "no-cache, no-store",
    "x-accel-buffering": "no",
  });

  return new Response(Readable.toWeb(ffmpeg.stdout) as ReadableStream, {
    status: 200,
    headers,
  });
}
