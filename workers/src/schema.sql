-- Treasure Hunt App Schema

-- Admin users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Games (one per conference/event)
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended')),
  map_config TEXT NOT NULL DEFAULT '{}',
  form_fields TEXT NOT NULL DEFAULT '[]',
  treasure_lat REAL,
  treasure_lng REAL,
  winner_entry_id TEXT,
  revealed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Participant entries
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  marker_lat REAL NOT NULL,
  marker_lng REAL NOT NULL,
  form_data TEXT NOT NULL DEFAULT '{}',
  distance_m REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entries_game_id ON entries(game_id);
CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
