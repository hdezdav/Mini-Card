-- D1 database schema for MiniCard Web Analytics
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL, -- 'pageview', 'wallet_connected', 'play_initiated', 'play_completed'
  country TEXT,
  device TEXT,
  referrer TEXT,
  timestamp INTEGER NOT NULL -- Unix timestamp in seconds
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events(event_name);
