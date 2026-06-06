-- site3 capture table (auto-created by lib.php on first run; here for reference).
CREATE TABLE IF NOT EXISTS captured_profiles (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name    VARCHAR(200),
    email        VARCHAR(320),
    phone        VARCHAR(40),
    address      VARCHAR(400),
    city         VARCHAR(120),
    postcode     VARCHAR(20),
    dob          VARCHAR(20),
    id_last4     VARCHAR(8),
    ip           VARCHAR(64),
    user_agent   VARCHAR(512),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
