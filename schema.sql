-- Schema D1 pour Bump

CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  total_size INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  FOREIGN KEY (transfer_id) REFERENCES transfers(id)
);

CREATE INDEX idx_files_transfer ON files(transfer_id);
CREATE INDEX idx_transfers_expires ON transfers(expires_at);
