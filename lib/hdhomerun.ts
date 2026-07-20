import type {
  DeviceInfo,
  Channel,
  GuideChannel,
  RecordingSeries,
  RecordingEpisode,
  ScheduledItem,
  RecordingRule,
  RecordingRuleInput,
} from "./types";

const DEVICE_IP = process.env.HDHOMERUN_IP || "192.168.1.100";
const DEVICE_BASE = `http://${DEVICE_IP}`;
const CLOUD_API = "https://api.hdhomerun.com/api";
const GUIDE_API = `${CLOUD_API}/guide`;

function source(url: string) {
  return url.startsWith(DEVICE_BASE) ? "DEVICE" : url.startsWith(CLOUD_API) ? "CLOUD" : "APP";
}

function log(method: string, url: string, params?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const paramStr = params && Object.keys(params).length > 0
    ? " " + JSON.stringify(params)
    : "";
  console.log(`[hdhomerun] ${ts} [${source(url)}] ${method} ${url}${paramStr}`);
}

function logResponse(url: string, status: number, body: unknown) {
  const ts = new Date().toISOString();
  const bodyStr = body !== undefined ? " " + JSON.stringify(body) : "";
  console.log(`[hdhomerun] ${ts} [${source(url)}] ${status}${bodyStr}`);
}


export async function getDeviceInfo(): Promise<DeviceInfo> {
  const url = `${DEVICE_BASE}/discover.json`;
  log("GET", url);
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Device unreachable at ${DEVICE_IP}`);
  return res.json();
}

export async function getChannels(): Promise<Channel[]> {
  const url = `${DEVICE_BASE}/lineup.json`;
  log("GET", url);
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch channel lineup");
  return res.json();
}

export async function getGuide(
  deviceAuth: string,
  channels: string[]
): Promise<GuideChannel[]> {
  const BATCH = 5;
  const results: GuideChannel[] = [];

  for (let i = 0; i < channels.length; i += BATCH) {
    const batch = channels.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map(async (ch) => {
        const params = new URLSearchParams({ DeviceAuth: deviceAuth, Channel: ch });
        const url = `${GUIDE_API}?${params.toString()}`;
        log("GET", GUIDE_API, { Channel: ch, DeviceAuth: "[redacted]" });
        try {
          const res = await fetch(url, { next: { revalidate: 300 } });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        } catch {
          return [];
        }
      })
    );
    results.push(...fetched.flat());
  }

  return results;
}

export async function getRecordingGroups(): Promise<RecordingSeries[]> {
  const url = `${DEVICE_BASE}/recorded_files.json`;
  log("GET", url);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch recordings");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getEpisodesForSeries(episodesURL: string): Promise<RecordingEpisode[]> {
  log("GET", episodesURL);
  const res = await fetch(episodesURL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch episodes");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function deleteEpisode(cmdUrl: string): Promise<void> {
  const url = `${cmdUrl}&cmd=delete`;
  log("POST", cmdUrl, { cmd: "delete" });
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error("Delete failed");
}

export async function getRecordingRules(): Promise<RecordingRule[]> {
  const device = await getDeviceInfo();
  const url = `${CLOUD_API}/recording_rules`;
  log("GET", url, { DeviceAuth: "[redacted]" });
  const res = await fetch(
    `${url}?DeviceAuth=${device.DeviceAuth}`,
    { cache: "no-store" }
  );
  const data = res.ok ? await res.json() : null;
  logResponse(url, res.status, data);
  return Array.isArray(data) ? data : [];
}

export async function addRecordingRule(rule: RecordingRuleInput): Promise<void> {
  const device = await getDeviceInfo();
  const url = `${CLOUD_API}/recording_rules`;
  log("POST", url, { DeviceAuth: "[redacted]", Cmd: "add", body: rule });

  const params = new URLSearchParams({ DeviceAuth: device.DeviceAuth, Cmd: "add" });
  for (const [k, v] of Object.entries(rule)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }

  const fullUrl = `${url}?${params.toString()}`;
  const redactedUrl = fullUrl.replace(device.DeviceAuth, "[redacted]");
  console.log(`[hdhomerun] query string: ${redactedUrl}`);

  const res = await fetch(fullUrl, { method: "POST" });
  const body = await res.text().catch(() => "");
  logResponse(url, res.status, body || null);
  if (!res.ok) throw new Error(`HDHomerun cloud returned ${res.status} adding rule${body ? `: ${body}` : ""}`);

  await notifyDeviceSync(device.BaseURL).catch((e) =>
    console.error("[hdhomerun] device sync notify failed:", e)
  );
}

export async function deleteRecordingRule(ruleId: string): Promise<void> {
  const device = await getDeviceInfo();
  const url = `${CLOUD_API}/recording_rules`;
  log("POST", url, { DeviceAuth: "[redacted]", Cmd: "delete", RecordingRuleID: ruleId });
  const res = await fetch(
    `${url}?DeviceAuth=${device.DeviceAuth}&Cmd=delete&RecordingRuleID=${ruleId}`,
    { method: "POST" }
  );
  const body = await res.text().catch(() => "");
  logResponse(url, res.status, body || null);
  if (!res.ok) throw new Error(`HDHomerun cloud returned ${res.status} deleting rule ${ruleId}${body ? `: ${body}` : ""}`);

  await notifyDeviceSync(device.BaseURL).catch((e) =>
    console.error("[hdhomerun] device sync notify failed:", e)
  );
}

async function notifyDeviceSync(baseURL: string): Promise<void> {
  const syncUrl = `${baseURL}/recording_events.post?sync`;
  log("POST", syncUrl);
  const res = await fetch(syncUrl, { method: "POST" });
  logResponse(syncUrl, res.status, null);
}

// Derive upcoming recordings by cross-referencing rules with guide data
export async function getSchedule(): Promise<ScheduledItem[]> {
  try {
    const device = await getDeviceInfo();
    const url = `${CLOUD_API}/recording_rules`;
    log("GET", url, { DeviceAuth: "[redacted]" });
    const [rulesRes, allChannels] = await Promise.all([
      fetch(`${url}?DeviceAuth=${device.DeviceAuth}`, { cache: "no-store" }),
      getChannels(),
    ]);

    const rules: RecordingRule[] = rulesRes.ok ? await rulesRes.json() : [];
    if (!Array.isArray(rules) || rules.length === 0) return [];

    const ruleSeriesIds = new Set(rules.map((r) => r.SeriesID));
    const channelNumbers = allChannels.map((ch) => ch.GuideNumber);
    const guide = await getGuide(device.DeviceAuth, channelNumbers);

    const now = Date.now() / 1000;
    const upcoming = new Map<string, ScheduledItem>();

    for (const channel of guide) {
      for (const program of channel.Guide ?? []) {
        if (program.EndTime > now && program.SeriesID && ruleSeriesIds.has(program.SeriesID)) {
          const id = `${channel.GuideNumber}-${program.StartTime}`;
          upcoming.set(id, {
            ProgramID: id,
            Title: program.Title,
            EpisodeTitle: program.EpisodeTitle,
            Synopsis: program.Synopsis,
            StartTime: program.StartTime,
            EndTime: program.EndTime,
            ChannelName: channel.GuideName,
            ChannelNumber: channel.GuideNumber,
            ImageURL: program.ImageURL,
            SeriesID: program.SeriesID,
          });
        }
      }
    }

    return [...upcoming.values()].sort((a, b) => a.StartTime - b.StartTime);
  } catch {
    return [];
  }
}


export function getStreamURL(channel: Channel): string {
  return channel.URL;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}
