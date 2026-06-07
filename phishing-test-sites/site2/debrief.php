<?php require __DIR__ . '/lib.php'; require_local(); $c = cfg(); ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Security Awareness — Simulation Debrief</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#0d1320;color:#e7edf5;
    min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 18px 64px}
  .card{max-width:640px;background:#121a2b;border:1px solid #25324a;border-radius:18px;padding:34px 34px 30px;
    box-shadow:0 30px 80px -30px rgba(0,0,0,.7)}
  .ico{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;font-size:30px;
    background:rgba(244,73,94,.13);border:1px solid rgba(244,73,94,.4);margin-bottom:18px}
  h1{font-size:23px;font-weight:700;margin-bottom:10px}
  h2{font-size:14px;letter-spacing:.5px;text-transform:uppercase;color:#7fd4ff;margin:22px 0 10px}
  p{font-size:14.5px;line-height:1.65;color:#c2cde0;margin-bottom:10px}
  b{color:#fff}
  ul{margin:4px 0 4px 2px;list-style:none;display:flex;flex-direction:column;gap:9px}
  li{display:flex;gap:10px;font-size:14px;color:#c2cde0;line-height:1.5}
  li::before{content:"✓";color:#43e08a;font-weight:700}
  .foot{margin-top:20px;padding-top:16px;border-top:1px solid #25324a;font-size:12.5px;color:#8595ad}
  a.btn{display:inline-block;margin-top:18px;background:linear-gradient(180deg,#3a7bff,#2b5fd6);color:#fff;
    text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px}
</style>
</head>
<body>
  <div class="card">
    <div class="ico">&#9888;</div>
    <h1>This was a phishing simulation</h1>
    <p>You just interacted with <b><?= e($c['site_name'] ?? 'a demo site') ?></b> — a deliberately fake page
       built for the <b>CyberForge</b> security-awareness demonstration. On a real phishing site, anything you
       typed would now be in an attacker's hands.</p>
    <p><b>Nothing you entered was validated, used, or sent anywhere.</b> It was recorded only in this lab's own
       store to illustrate what a phishing page captures.</p>

    <h2>How to spot the next one</h2>
    <ul>
      <li>Check the address bar — the real brand never lives on a look‑alike or free‑hosting domain.</li>
      <li>Be suspicious of urgency ("verify now", "watch free", "download required").</li>
      <li>A sign‑in popup that appears <em>inside</em> a page (not a real browser window) is a red flag.</li>
      <li>Never reuse passwords; enable two‑factor authentication everywhere.</li>
      <li>When in doubt, navigate to the service yourself instead of clicking through.</li>
    </ul>

    <p class="foot">This artifact exists only to demonstrate the CyberForge phishing‑detection system for an
       authorized thesis/demo. It impersonates no real organisation.</p>
    <a class="btn" href="index.php">Back to the demo</a>
  </div>
  <?= sim_banner() ?>
</body>
</html>
