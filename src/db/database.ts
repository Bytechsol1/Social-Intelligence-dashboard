import Database from "better-sqlite3";

export const db = new Database("social_intel.db");
db.pragma("journal_mode = WAL");

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    yt_refresh_token TEXT,
    manychat_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    date TEXT,
    source TEXT,
    metric_name TEXT,
    value REAL,
    UNIQUE(user_id, date, source, metric_name)
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    status TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS manychat_automations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    status TEXT,
    runs INTEGER DEFAULT 0,
    ctr REAL DEFAULT 0,
    last_modified TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
