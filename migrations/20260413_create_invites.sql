CREATE TABLE IF NOT EXISTS invites (
    code         TEXT PRIMARY KEY,
    max_uses     INTEGER NOT NULL,
    used_count   INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER,
    bound_session TEXT
);

CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites (expires_at);
