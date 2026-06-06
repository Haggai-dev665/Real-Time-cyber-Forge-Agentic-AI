<?php
// site2 — stores the harvested signup + card-style fields to MySQL, then shows a
// benign "preparing your stream" outcome. Simulation only.
require __DIR__ . '/lib.php';
require_local();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

$stmt = db()->prepare(
    'INSERT INTO captured_signups
        (full_name, email, password, plan, card_number, card_exp, card_cvv, ip, user_agent)
     VALUES (:n, :e, :p, :pl, :cn, :ce, :cv, :ip, :ua)'
);
$c = client();
$stmt->execute([
    ':n'  => trim($_POST['full_name'] ?? ''),
    ':e'  => trim($_POST['email'] ?? ''),
    ':p'  => (string) ($_POST['password'] ?? ''),
    ':pl' => trim($_POST['plan'] ?? ''),
    ':cn' => preg_replace('/\s+/', '', (string) ($_POST['card_number'] ?? '')),
    ':ce' => trim($_POST['card_exp'] ?? ''),
    ':cv' => trim($_POST['card_cvv'] ?? ''),
    ':ip' => $c['ip'],
    ':ua' => $c['ua'],
]);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>StreamForge — Preparing your stream…</title>
<style>
  body{margin:0;font-family:Segoe UI,system-ui,Arial,sans-serif;background:#0a0d14;color:#eaf0f7;
       display:grid;place-items:center;height:100vh;padding-bottom:44px}
  .box{background:#0f1522;border:1px solid #243349;border-radius:14px;padding:34px 30px;max-width:460px;text-align:center}
  .spin{width:34px;height:34px;border:3px solid #25344a;border-top-color:#ff5b3a;border-radius:50%;margin:0 auto 16px;animation:s 1s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
  h2{margin:0 0 6px}
  p{color:#9fb0c6;font-size:13.5px}
  .note{margin-top:16px;font-size:11.5px;color:#ffb0b0;background:#2a1212;border:1px solid #5a2020;border-radius:8px;padding:9px}
</style>
</head>
<body>
  <div class="box">
    <div class="spin"></div>
    <h2>Preparing your stream…</h2>
    <p>Activating your free trial and loading your library.</p>
    <div class="note">Simulation: your input was stored in the lab database (<code>captured_signups</code>). No account or charge was created.</div>
  </div>
  <?= sim_banner() ?>
</body>
</html>
