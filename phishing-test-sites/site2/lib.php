<?php
/**
 * site2 — shared helpers (PDO + schema + localhost guard + banner) and the TMDB
 * movie fetch. Part of the CyberForge thesis test lab. Localhost only.
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
        "CREATE TABLE IF NOT EXISTS captured_signups (
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
        . '⚠ Educational phishing <u>simulation</u> — CyberForge thesis lab. Localhost only. Use fake card/login data only.'
        . '</div>';
}

/** Fetch popular movies from TMDB; fall back to a small built-in list. */
function fetch_movies(): array {
    $key = cfg()['tmdb_api_key'];
    if ($key) {
        $url = "https://api.themoviedb.org/3/movie/popular?api_key=" . urlencode($key) . "&page=1";
        $json = http_get($url);
        if ($json) {
            $data = json_decode($json, true);
            if (!empty($data['results'])) {
                return array_map(static function ($m) {
                    return [
                        'title'  => $m['title'] ?? 'Untitled',
                        'poster' => !empty($m['poster_path']) ? 'https://image.tmdb.org/t/p/w342' . $m['poster_path'] : '',
                        'rating' => $m['vote_average'] ?? 0,
                        'year'   => substr($m['release_date'] ?? '', 0, 4),
                    ];
                }, array_slice($data['results'], 0, 18));
            }
        }
    }
    // Fallback catalogue (no key / offline).
    $fb = ['Aurora Drift','Neon Harbor','The Last Signal','Crimson Vault','Echoes of Mars',
           'Paper Tigers','Glass Horizon','Midnight Cartel','Static Kingdom','Velvet Storm',
           'Iron Lullaby','Ghost Frequency'];
    return array_map(static fn($t) => ['title' => $t, 'poster' => '', 'rating' => 7.5, 'year' => '2024'], $fb);
}

function http_get(string $url): ?string {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $out = curl_exec($ch);
        curl_close($ch);
        return $out ?: null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 8]]);
    $out = @file_get_contents($url, false, $ctx);
    return $out ?: null;
}
