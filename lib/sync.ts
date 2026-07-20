import { getDb } from "./db";
import { getDeviceInfo, getChannels, getGuide, getRecordingRules, getSchedule } from "./hdhomerun";
import type { RecordingRule } from "./types";

export interface SyncResult {
  rulesCount: number;
  scheduledCount: number;
  syncedAt: number;
  error?: string;
}

export async function syncRecordingRules(): Promise<RecordingRule[]> {
  const db = getDb();
  const syncedAt = Math.floor(Date.now() / 1000);
  const rules = await getRecordingRules();

  const upsert = db.prepare(`
    INSERT INTO recording_rules (
      recording_rule_id, series_id, title, synopsis, image_url,
      channel_only, after_original_airdate_only, record_new_only,
      keep_up_to, date_time_only, start_padding, end_padding, synced_at
    ) VALUES (
      @recording_rule_id, @series_id, @title, @synopsis, @image_url,
      @channel_only, @after_original_airdate_only, @record_new_only,
      @keep_up_to, @date_time_only, @start_padding, @end_padding, @synced_at
    )
    ON CONFLICT(recording_rule_id) DO UPDATE SET
      series_id                   = excluded.series_id,
      title                       = excluded.title,
      synopsis                    = excluded.synopsis,
      image_url                   = excluded.image_url,
      channel_only                = excluded.channel_only,
      after_original_airdate_only = excluded.after_original_airdate_only,
      record_new_only             = excluded.record_new_only,
      keep_up_to                  = excluded.keep_up_to,
      date_time_only              = excluded.date_time_only,
      start_padding               = excluded.start_padding,
      end_padding                 = excluded.end_padding,
      synced_at                   = excluded.synced_at
  `);

  db.transaction(() => {
    for (const r of rules) {
      upsert.run({
        recording_rule_id:           r.RecordingRuleID,
        series_id:                   r.SeriesID,
        title:                       r.Title,
        synopsis:                    r.Synopsis                ?? null,
        image_url:                   r.ImageURL                ?? null,
        channel_only:                r.ChannelOnly             ?? null,
        after_original_airdate_only: r.AfterOriginalAirdateOnly ?? null,
        record_new_only:             r.RecentOnly               ?? 0,
        keep_up_to:                  r.KeepUpTo                ?? null,
        date_time_only:              r.DateTimeOnly            ?? null,
        start_padding:               r.StartPadding            ?? 0,
        end_padding:                 r.EndPadding              ?? 0,
        synced_at:                   syncedAt,
      });
    }
    if (rules.length > 0) {
      const placeholders = rules.map(() => "?").join(",");
      db.prepare(
        `DELETE FROM recording_rules WHERE recording_rule_id NOT IN (${placeholders})`
      ).run(...rules.map((r) => r.RecordingRuleID));
    } else {
      db.prepare("DELETE FROM recording_rules").run();
    }
  })();

  return rules;
}

export async function syncFromDevice(): Promise<SyncResult> {
  const db = getDb();
  const syncedAt = Math.floor(Date.now() / 1000);

  try {
    const [rules, scheduled] = await Promise.all([getRecordingRules(), getSchedule()]);

    const upsertRule = db.prepare(`
      INSERT INTO recording_rules (
        recording_rule_id, series_id, title, synopsis, image_url,
        channel_only, after_original_airdate_only, record_new_only,
        keep_up_to, date_time_only, start_padding, end_padding, synced_at
      ) VALUES (
        @recording_rule_id, @series_id, @title, @synopsis, @image_url,
        @channel_only, @after_original_airdate_only, @record_new_only,
        @keep_up_to, @date_time_only, @start_padding, @end_padding, @synced_at
      )
      ON CONFLICT(recording_rule_id) DO UPDATE SET
        series_id                   = excluded.series_id,
        title                       = excluded.title,
        synopsis                    = excluded.synopsis,
        image_url                   = excluded.image_url,
        channel_only                = excluded.channel_only,
        after_original_airdate_only = excluded.after_original_airdate_only,
        record_new_only             = excluded.record_new_only,
        keep_up_to                  = excluded.keep_up_to,
        date_time_only              = excluded.date_time_only,
        start_padding               = excluded.start_padding,
        end_padding                 = excluded.end_padding,
        synced_at                   = excluded.synced_at
    `);

    const upsertScheduled = db.prepare(`
      INSERT INTO scheduled_recordings (
        program_id, title, episode_title, synopsis,
        start_time, end_time, channel_name, channel_number,
        image_url, series_id, episode_number, recording_rule_id, synced_at
      ) VALUES (
        @program_id, @title, @episode_title, @synopsis,
        @start_time, @end_time, @channel_name, @channel_number,
        @image_url, @series_id, @episode_number, @recording_rule_id, @synced_at
      )
      ON CONFLICT(program_id) DO UPDATE SET
        title             = excluded.title,
        episode_title     = excluded.episode_title,
        synopsis          = excluded.synopsis,
        start_time        = excluded.start_time,
        end_time          = excluded.end_time,
        channel_name      = excluded.channel_name,
        channel_number    = excluded.channel_number,
        image_url         = excluded.image_url,
        series_id         = excluded.series_id,
        episode_number    = excluded.episode_number,
        recording_rule_id = excluded.recording_rule_id,
        synced_at         = excluded.synced_at
    `);

    db.transaction(() => {
      // Rules: upsert then prune any that were deleted on the device
      for (const r of rules) {
        upsertRule.run({
          recording_rule_id:           r.RecordingRuleID,
          series_id:                   r.SeriesID,
          title:                       r.Title,
          synopsis:                    r.Synopsis          ?? null,
          image_url:                   r.ImageURL          ?? null,
          channel_only:                r.ChannelOnly       ?? null,
          after_original_airdate_only: r.AfterOriginalAirdateOnly ?? null,
          record_new_only:             r.RecentOnly        ?? 0,
          keep_up_to:                  r.KeepUpTo          ?? null,
          date_time_only:              r.DateTimeOnly      ?? null,
          start_padding:               r.StartPadding      ?? 0,
          end_padding:                 r.EndPadding        ?? 0,
          synced_at:                   syncedAt,
        });
      }
      if (rules.length > 0) {
        const placeholders = rules.map(() => "?").join(",");
        db.prepare(
          `DELETE FROM recording_rules WHERE recording_rule_id NOT IN (${placeholders})`
        ).run(...rules.map((r) => r.RecordingRuleID));
      } else {
        db.prepare("DELETE FROM recording_rules").run();
      }

      // Schedule: upsert incoming, drop anything that has already ended
      for (const s of scheduled) {
        upsertScheduled.run({
          program_id:        s.ProgramID,
          title:             s.Title,
          episode_title:     s.EpisodeTitle    ?? null,
          synopsis:          s.Synopsis        ?? null,
          start_time:        s.StartTime,
          end_time:          s.EndTime,
          channel_name:      s.ChannelName     ?? null,
          channel_number:    s.ChannelNumber   ?? null,
          image_url:         s.ImageURL        ?? null,
          series_id:         s.SeriesID        ?? null,
          episode_number:    s.EpisodeNumber   ?? null,
          recording_rule_id: s.RecordingRuleID ?? null,
          synced_at:         syncedAt,
        });
      }
      db.prepare("DELETE FROM scheduled_recordings WHERE end_time < ?").run(syncedAt);

      db.prepare(
        "UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_synced_at'"
      ).run(String(syncedAt), syncedAt);
      db.prepare(
        "UPDATE settings SET value = '', updated_at = ? WHERE key = 'last_sync_error'"
      ).run(syncedAt);
    })();

    return { rulesCount: rules.length, scheduledCount: scheduled.length, syncedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    try {
      db.prepare(
        "UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_sync_error'"
      ).run(message, syncedAt);
    } catch { /* db itself may be unavailable */ }
    return { rulesCount: 0, scheduledCount: 0, syncedAt, error: message };
  }
}

export interface SyncGuideResult {
  channelCount: number;
  programCount: number;
  syncedAt: number;
  error?: string;
}

export async function syncGuide(): Promise<SyncGuideResult> {
  const db = getDb();
  const syncedAt = Math.floor(Date.now() / 1000);

  try {
    const device = await getDeviceInfo();
    const allChannels = await getChannels();
    const channelNumbers = allChannels.map((ch) => ch.GuideNumber);
    const streamMap = new Map(allChannels.map((ch) => [ch.GuideNumber, ch.URL]));
    const guideChannels = await getGuide(device.DeviceAuth, channelNumbers);

    const upsertChannel = db.prepare(`
      INSERT INTO guide_channels (guide_number, guide_name, affiliate, image_url, stream_url, synced_at)
      VALUES (@guide_number, @guide_name, @affiliate, @image_url, @stream_url, @synced_at)
      ON CONFLICT(guide_number) DO UPDATE SET
        guide_name = excluded.guide_name,
        affiliate  = excluded.affiliate,
        image_url  = excluded.image_url,
        stream_url = excluded.stream_url,
        synced_at  = excluded.synced_at
    `);

    const upsertProgram = db.prepare(`
      INSERT INTO guide_programs (
        guide_number, start_time, title, episode_title, synopsis, end_time,
        image_url, series_id, episode_number, original_airdate,
        filter_tags, recording_rule, recording_in_progress, synced_at
      ) VALUES (
        @guide_number, @start_time, @title, @episode_title, @synopsis, @end_time,
        @image_url, @series_id, @episode_number, @original_airdate,
        @filter_tags, @recording_rule, @recording_in_progress, @synced_at
      )
      ON CONFLICT(guide_number, start_time) DO UPDATE SET
        title                 = excluded.title,
        episode_title         = excluded.episode_title,
        synopsis              = excluded.synopsis,
        end_time              = excluded.end_time,
        image_url             = excluded.image_url,
        series_id             = excluded.series_id,
        episode_number        = excluded.episode_number,
        original_airdate      = excluded.original_airdate,
        filter_tags           = excluded.filter_tags,
        recording_rule        = excluded.recording_rule,
        recording_in_progress = excluded.recording_in_progress,
        synced_at             = excluded.synced_at
    `);

    let programCount = 0;

    db.transaction(() => {
      for (const gc of guideChannels) {
        upsertChannel.run({
          guide_number: gc.GuideNumber,
          guide_name:   gc.GuideName,
          affiliate:    gc.Affiliate ?? null,
          image_url:    gc.ImageURL  ?? null,
          stream_url:   streamMap.get(gc.GuideNumber) ?? null,
          synced_at:    syncedAt,
        });

        for (const p of gc.Guide ?? []) {
          upsertProgram.run({
            guide_number:          gc.GuideNumber,
            start_time:            p.StartTime,
            title:                 p.Title,
            episode_title:         p.EpisodeTitle     ?? null,
            synopsis:              p.Synopsis         ?? null,
            end_time:              p.EndTime,
            image_url:             p.ImageURL         ?? null,
            series_id:             p.SeriesID         ?? null,
            episode_number:        p.EpisodeNumber    ?? null,
            original_airdate:      p.OriginalAirdate  ?? null,
            filter_tags:           p.Filter ? JSON.stringify(p.Filter) : null,
            recording_rule:        p.RecordingRule    ?? 0,
            recording_in_progress: p.RecordingInProgress ?? 0,
            synced_at:             syncedAt,
          });
          programCount++;
        }
      }

      // Prune programs that have already ended
      db.prepare("DELETE FROM guide_programs WHERE end_time < ?").run(syncedAt);

      db.prepare(
        "UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_guide_synced_at'"
      ).run(String(syncedAt), syncedAt);
      db.prepare(
        "UPDATE settings SET value = '', updated_at = ? WHERE key = 'last_guide_sync_error'"
      ).run(syncedAt);
    })();

    return { channelCount: guideChannels.length, programCount, syncedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Guide sync failed";
    try {
      db.prepare(
        "UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_guide_sync_error'"
      ).run(message, syncedAt);
    } catch { /* db itself may be unavailable */ }
    return { channelCount: 0, programCount: 0, syncedAt, error: message };
  }
}
