<?php
// site3 — stores the harvested PII profile to MySQL, then shows a benign
// "redelivery scheduled" outcome. Simulation only.
require __DIR__ . '/lib.php';
require_local();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

$stmt = db()->prepare(
    'INSERT INTO captured_profiles
        (full_name, email, phone, address, city, postcode, dob, id_last4, ip, user_agent)
     VALUES (:n, :e, :ph, :a, :c, :pc, :d, :id, :ip, :ua)'
);
$c = client();
$stmt->execute([
    ':n'  => trim($_POST['full_name'] ?? ''),
    ':e'  => trim($_POST['email'] ?? ''),
    ':ph' => trim($_POST['phone'] ?? ''),
    ':a'  => trim($_POST['address'] ?? ''),
    ':c'  => trim($_POST['city'] ?? ''),
    ':pc' => trim($_POST['postcode'] ?? ''),
    ':d'  => trim($_POST['dob'] ?? ''),
    ':id' => substr(preg_replace('/\D/', '', (string) ($_POST['id_last4'] ?? '')), 0, 4),
    ':ip' => $c['ip'],
    ':ua' => $c['ua'],
]);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GlobalParcel — Redelivery scheduled</title>
<style>
  body{margin:0;font-family:Segoe UI,system-ui,Arial,sans-serif;background:#f3f6fa;color:#172230;
       display:grid;place-items:center;height:100vh;padding-bottom:44px}
  .box{background:#fff;border:1px solid #dde6ef;border-radius:12px;padding:34px 30px;max-width:460px;text-align:center;
       box-shadow:0 12px 40px -20px rgba(20,40,80,.35)}
  .ok{width:46px;height:46px;border-radius:50%;background:#0e7a4f;color:#fff;display:grid;place-items:center;margin:0 auto 14px;font-size:24px}
  h2{margin:0 0 6px}
  p{color:#5a6b82;font-size:13.5px}
  .note{margin-top:16px;font-size:11.5px;color:#7a5300;background:#fff7e6;border:1px solid #ffd87a;border-radius:8px;padding:9px}
</style>
</head>
<body>
  <div class="box">
    <div class="ok">✓</div>
    <h2>Redelivery scheduled</h2>
    <p>Your parcel will be delivered within 2 business days. A confirmation has been sent to your email.</p>
    <div class="note">Simulation: your input was stored in the lab database (<code>captured_profiles</code>). No parcel, fee, or email is real.</div>
  </div>
  <?= sim_banner() ?>
</body>
</html>
