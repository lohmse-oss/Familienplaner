CREATE TABLE IF NOT EXISTS items (
  id      TEXT PRIMARY KEY,
  data    TEXT NOT NULL,     -- kompletter Eintrag als JSON
  updated INTEGER NOT NULL,  -- Zeitstempel des Geräts (Last-Write-Wins)
  rev     INTEGER NOT NULL   -- Server-Revision, steigt streng monoton
);
CREATE INDEX IF NOT EXISTS items_rev ON items(rev);

CREATE TABLE IF NOT EXISTS kv (
  k  TEXT PRIMARY KEY,
  v  TEXT NOT NULL,
  ts INTEGER NOT NULL
);
