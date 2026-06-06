<?php
/**
 * site3 — shared helpers (PDO + schema + localhost guard + banner).
 * Part of the CyberForge thesis test lab. Localhost only.
 */

function cfg(): array {
    static $c = null;
    if ($c === null) { $c = require __DIR__ . '/config.php'; }
    return $c;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) { return $pdo; }
    $c = cfg();
    if (!empty($c['database_url'])) {
        $u    = parse_url($c['database_url']);
        $host = $u['host'] ?? '127.0.0.1';
        $port = $u['port'] ?? 3306;
        $name = ltrim($u['path'] ?? '', '/');
        $user = urldecode($u['user'] ?? '');
        $pass = urldecode($u['pass'] ?? '');
    } else {
        $host = $c['db_host']; $port = $c['db_port']; $name = $c['db_name'];
        $user = $c['db_user']; $pass = $c['db_pass'];
    }
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    ensure_schema($pdo);
    return $pdo;
}

function ensure_schema(PDO $pdo): void {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS captured_profiles (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

function require_local(): void {
    $c = cfg();
    if (!empty($c['allow_remote'])) { return; }
    $host   = strtolower(parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? 'localhost'), PHP_URL_HOST) ?: 'localhost');
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    $local  = in_array($host, ['localhost', '127.0.0.1', '::1'], true)
        || str_ends_with($host, '.local') || str_ends_with($host, '.test')
        || $remote === '::1' || str_starts_with($remote, '127.');
    if (!$local) {
        http_response_code(403);
        echo '<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0b0f17;color:#e7edf5;padding:48px">'
           . '<h2>403 — Localhost only</h2><p>Educational phishing <em>simulation</em> for the CyberForge thesis. Localhost only.</p></body>';
        exit;
    }
}

function client(): array {
    return [
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
        'ua' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 512),
    ];
}

function sim_banner(): string {
    return '<div style="position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#7a1020;color:#ffd9df;'
        . 'font:600 12px/1.4 system-ui,sans-serif;text-align:center;padding:7px 12px;border-top:1px solid #ff5b73">'
        . '⚠ Educational phishing <u>simulation</u> — CyberForge thesis lab. Localhost only. Enter fake personal data only.'
        . '</div>';
}
