CREATE TABLE IF NOT EXISTS address_notes (
    address    TEXT PRIMARY KEY,
    note       TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
);
