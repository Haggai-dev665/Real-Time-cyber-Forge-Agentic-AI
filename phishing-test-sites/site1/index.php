<?php
// site1 — fake "SecureMail" webmail login (credential-harvesting simulation).
require __DIR__ . '/lib.php';
require_local();
$err = isset($_GET['e']);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- x-educational-simulation: CyberForge thesis phishing test target (fictional brand) -->
<title>SecureMail — Sign in to your account</title>
<style>
  :root{--b:#0a66c2}
  *{box-sizing:border-box}
  body{margin:0;font-family:Segoe UI,system-ui,Arial,sans-serif;background:#eef2f7;color:#1c2430}
  .top{background:#fff;border-bottom:1px solid #dfe6ee;padding:12px 22px;display:flex;align-items:center;gap:10px}
  .logo{font-weight:800;font-size:18px;color:var(--b);letter-spacing:-.5px}
  .logo span{color:#1c2430}
  .wrap{max-width:430px;margin:46px auto;padding:0 16px}
  .card{background:#fff;border:1px solid #dfe6ee;border-radius:12px;padding:30px 28px;box-shadow:0 12px 40px -18px rgba(20,40,80,.4)}
  .alert{display:flex;gap:10px;background:#fff4f4;border:1px solid #ffd0d0;color:#9b1c1c;border-radius:9px;padding:11px 13px;font-size:13px;margin-bottom:18px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#5a6b82;font-size:13.5px;margin:0 0 20px}
  label{display:block;font-size:12.5px;font-weight:600;margin:14px 0 6px}
  input{width:100%;height:44px;padding:0 13px;border:1px solid #c7d2e0;border-radius:8px;font-size:14px}
  input:focus{outline:none;border-color:var(--b);box-shadow:0 0 0 3px rgba(10,102,194,.15)}
  .btn{width:100%;height:46px;margin-top:20px;border:0;border-radius:8px;background:var(--b);color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  .row{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:12.5px}
  .row a{color:var(--b);text-decoration:none}
  .trust{display:flex;align-items:center;gap:7px;justify-content:center;margin-top:18px;color:#3a7a3a;font-size:11.5px}
  .trust svg{width:14px;height:14px}
  .foot{text-align:center;color:#8595a8;font-size:11px;margin-top:18px}
  body{padding-bottom:42px}
</style>
</head>
<body>
  <div class="top"><div class="logo">Secure<span>Mail</span></div></div>
  <div class="wrap">
    <div class="card">
      <div class="alert">
        <strong>!</strong>
        <div>Unusual sign-in activity was detected on your account. To keep it secure, please verify your identity now or access will be suspended.</div>
      </div>
      <h1>Sign in</h1>
      <p class="sub">Use your SecureMail email and password to continue.</p>
      <?php if ($err): ?><div class="alert">That didn't match our records. Please try again.</div><?php endif; ?>
      <form method="post" action="capture.php" autocomplete="off">
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" placeholder="you@securemail.test" required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" placeholder="Your password" required />
        <button class="btn" type="submit">Verify &amp; Sign in</button>
      </form>
      <div class="row">
        <a href="#">Forgot password?</a>
        <a href="#">Create account</a>
      </div>
      <div class="trust">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
        Protected by SecureMail 256-bit encryption
      </div>
    </div>
    <div class="foot">© SecureMail. Fictional brand used for security testing.</div>
  </div>
  <?= sim_banner() ?>
</body>
</html>
