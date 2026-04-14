-- 活跃邮箱地址白名单表
CREATE TABLE IF NOT EXISTS active_addresses (
    address TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- 索引：根据 session_id 查询用户的所有地址
CREATE INDEX IF NOT EXISTS idx_active_addresses_session 
ON active_addresses(session_id);

-- 索引：用于快速查询未过期的地址和定时清理
CREATE INDEX IF NOT EXISTS idx_active_addresses_expires 
ON active_addresses(expires_at);
