import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.HDHOMERUN_DB_PATH ?? path.join(process.cwd(), "hdhomerun.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!global.__db) {
    global.__db = new Database(DB_PATH);
    global.__db.pragma("journal_mode = WAL");
    global.__db.pragma("foreign_keys = ON");
    initSchema(global.__db);
  }
  return global.__db;
}

function initSchema(db: Database.Database) {
  // Migrate old table name from earlier versions
  const old = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='series_rules'"
  ).get();
  if (old) db.exec("ALTER TABLE series_rules RENAME TO recording_rules");

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT    PRIMARY KEY,
      value      TEXT    NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS recording_rules (
      recording_rule_id           TEXT    PRIMARY KEY,
      series_id                   TEXT    NOT NULL,
      title                       TEXT    NOT NULL,
      synopsis                    TEXT,
      image_url                   TEXT,
      channel_only                TEXT,
      after_original_airdate_only INTEGER,
      record_new_only             INTEGER NOT NULL DEFAULT 0,
      keep_up_to                  INTEGER,
      date_time_only              INTEGER,
      start_padding               INTEGER NOT NULL DEFAULT 0,
      end_padding                 INTEGER NOT NULL DEFAULT 0,
      synced_at                   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS scheduled_recordings (
      program_id        TEXT    PRIMARY KEY,
      title             TEXT    NOT NULL,
      episode_title     TEXT,
      synopsis          TEXT,
      start_time        INTEGER NOT NULL,
      end_time          INTEGER NOT NULL,
      channel_name      TEXT,
      channel_number    TEXT,
      image_url         TEXT,
      series_id         TEXT,
      episode_number    TEXT,
      recording_rule_id TEXT,
      synced_at         INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS guide_channels (
      guide_number TEXT    PRIMARY KEY,
      guide_name   TEXT    NOT NULL,
      affiliate    TEXT,
      image_url    TEXT,
      stream_url   TEXT,
      synced_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS guide_programs (
      guide_number          TEXT    NOT NULL,
      start_time            INTEGER NOT NULL,
      title                 TEXT    NOT NULL,
      episode_title         TEXT,
      synopsis              TEXT,
      end_time              INTEGER NOT NULL,
      image_url             TEXT,
      series_id             TEXT,
      episode_number        TEXT,
      original_airdate      INTEGER,
      filter_tags           TEXT,
      recording_rule        INTEGER NOT NULL DEFAULT 0,
      recording_in_progress INTEGER NOT NULL DEFAULT 0,
      synced_at             INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (guide_number, start_time)
    );

    CREATE INDEX IF NOT EXISTS idx_guide_programs_window
      ON guide_programs(start_time, end_time);

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('sync_interval_seconds',       '300'),
      ('last_synced_at',              '0'),
      ('last_sync_error',             ''),
      ('guide_sync_interval_seconds', '900'),
      ('last_guide_synced_at',        '0'),
      ('last_guide_sync_error',       '');
  `);
}
