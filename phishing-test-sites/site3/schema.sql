-- Capture table for the CyberForge phishing-simulation lab.
-- Auto-created by lib.php on first run; included here for reference / manual import.
CREATE TABLE IF NOT EXISTS captured_credentials (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    site        VARCHAR(32),     -- site1 / site2 / site3
    kind        VARCHAR(48),     -- e.g. google-oauth, software-download, doc-share
    email       VARCHAR(320),
    password    VARCHAR(512),
    extra       TEXT,            -- JSON: site-specific context (app, title, software, etc.)
    ip          VARCHAR(64),
    user_agent  VARCHAR(512),
    referer     VARCHAR(1024),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
