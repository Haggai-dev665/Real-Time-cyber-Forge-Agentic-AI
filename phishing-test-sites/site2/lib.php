<?php
/**
 * CyberForge Phishing-Simulation Lab — shared helpers (identical in site1/2/3).
 *
 * EDUCATIONAL SECURITY-AWARENESS ARTIFACT for the CyberForge thesis & demo video.
 * These pages deliberately imitate phishing so the CyberForge detector can be
 * shown flagging them. Safeguards baked in:
 *   • a visible "simulation" banner on every page (self-identifies as fake),
 *   • captured input is written ONLY to the operator's own store and never
 *     forwarded anywhere, validated, or used against a real service,
 *   • every credential submission ends on an educational debrief page.
 * Use only with your own test data, on infrastructure you control, for
 * authorized demonstrations.
 */

function cfg(): array {
    static $c = null;
    if ($c === null) { $c = require __DIR__ . '/config.php'; }
    return $c;
}

function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

/** Connect to MySQL (PDO). Returns null (never fatal) if the DB is unreachable
 *  so the page still works and capture falls back to a local file. */
function db(): ?PDO {
    static $pdo = false;
    if ($pdo !== false) { return $pdo ?: null; }
    $c = cfg();
    try {
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
            PDO::ATTR_TIMEOUT            => 5,
        ]);
        ensure_schema($pdo);
    } catch (Throwable $ex) {
        $pdo = null;
    }
    return $pdo ?: null;
}

/** Create the capture table on first run (no manual import needed), and upgrade
 *  older installs that predate the site/kind/extra columns. */
function ensure_schema(PDO $pdo): void {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS captured_credentials (
            id          BIGINT AUTO_INCREMENT PRIMARY KEY,
            site        VARCHAR(32),
            kind        VARCHAR(48),
            email       VARCHAR(320),
            password    VARCHAR(512),
            extra       TEXT,
            ip          VARCHAR(64),
            user_agent  VARCHAR(512),
            referer     VARCHAR(1024),
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    foreach ([
        "ALTER TABLE captured_credentials ADD COLUMN site VARCHAR(32)",
        "ALTER TABLE captured_credentials ADD COLUMN kind VARCHAR(48)",
        "ALTER TABLE captured_credentials ADD COLUMN extra TEXT",
    ] as $sql) {
        try { $pdo->exec($sql); } catch (Throwable $e) { /* column already present */ }
    }
}

/** Store one capture. Uses MySQL when available; otherwise appends a JSON line
 *  to a local file so the demo keeps working on hosts without a reachable DB. */
function store_capture(array $row): void {
    $c   = cfg();
    $row = array_merge([
        'site' => $c['site'] ?? '', 'kind' => '', 'email' => '', 'password' => '',
        'extra' => '', 'ip' => '', 'user_agent' => '', 'referer' => '',
    ], $row);
    if (is_array($row['extra'])) { $row['extra'] = json_encode($row['extra'], JSON_UNESCAPED_SLASHES); }

    $pdo = db();
    if ($pdo) {
        try {
            $st = $pdo->prepare(
                "INSERT INTO captured_credentials (site,kind,email,password,extra,ip,user_agent,referer)
                 VALUES (?,?,?,?,?,?,?,?)"
            );
            $st->execute([$row['site'], $row['kind'], $row['email'], $row['password'],
                          $row['extra'], $row['ip'], $row['user_agent'], $row['referer']]);
            return;
        } catch (Throwable $ex) { /* fall through to file */ }
    }
    $line = json_encode(array_merge($row, ['created_at' => date('c')]), JSON_UNESCAPED_SLASHES);
    @file_put_contents(__DIR__ . '/__captures.log', $line . "\n", FILE_APPEND | LOCK_EX);
}

/** Best-effort client metadata recorded with each capture. */
function client(): array {
    return [
        'ip'      => $_SERVER['REMOTE_ADDR'] ?? '',
        'ua'      => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 512),
        'referer' => substr($_SERVER['HTTP_REFERER'] ?? '', 0, 1024),
    ];
}

/** Store the POSTed fields and send the visitor to the educational debrief. */
function capture_and_debrief(string $kind, array $fields): void {
    $cl = client();
    store_capture([
        'kind'       => $kind,
        'email'      => $fields['email'] ?? '',
        'password'   => $fields['password'] ?? '',
        'extra'      => $fields['extra'] ?? '',
        'ip'         => $cl['ip'],
        'user_agent' => $cl['ua'],
        'referer'    => $cl['referer'],
    ]);
    header('Location: debrief.php');
    exit;
}

/** Off-localhost guard. Disabled by default now that hosting the demo is the
 *  goal; set ALLOW_REMOTE=0 in the environment to lock it back to localhost. */
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
           . '<h2>403 — Localhost only</h2><p>This CyberForge phishing <em>simulation</em> is locked to localhost. '
           . 'Set <code>ALLOW_REMOTE=1</code> to host it for an authorized demo.</p></body>';
        exit;
    }
}

/** The honest fixed banner shown on every simulation page. */
function sim_banner(): string {
    return '<div style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;'
        . 'background:#7a1020;color:#ffd9df;font:600 12px/1.4 system-ui,Arial,sans-serif;'
        . 'text-align:center;padding:7px 12px;border-top:1px solid #ff5b73">'
        . '&#9888; Phishing <u>simulation</u> for security-awareness training (CyberForge demo). '
        . 'Not affiliated with any real brand &mdash; enter test data only.'
        . '</div>';
}
