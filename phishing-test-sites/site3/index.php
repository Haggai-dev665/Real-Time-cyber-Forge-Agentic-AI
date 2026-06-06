<?php
// site3 — fake "GlobalParcel" redelivery / prize-claim PII-harvesting simulation.
require __DIR__ . '/lib.php';
require_local();
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- x-educational-simulation: CyberForge thesis phishing test target (fictional courier brand) -->
<title>GlobalParcel — Schedule your redelivery</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:Segoe UI,system-ui,Arial,sans-serif;background:#f3f6fa;color:#172230;padding-bottom:44px}
  .top{background:#0e7a4f;color:#fff;padding:13px 22px;display:flex;align-items:center;gap:10px}
  .top .b{font-weight:800;font-size:18px;letter-spacing:-.3px}
  .track{margin-left:auto;font-size:12px;background:rgba(255,255,255,.16);padding:5px 11px;border-radius:20px}
  .wrap{max-width:560px;margin:26px auto;padding:0 16px}
  .banner{background:#fff7e6;border:1px solid #ffd87a;border-radius:10px;padding:13px 15px;font-size:13.5px;color:#7a5300;margin-bottom:18px}
  .card{background:#fff;border:1px solid #dde6ef;border-radius:12px;padding:26px 24px;box-shadow:0 12px 40px -20px rgba(20,40,80,.35)}
  h1{font-size:21px;margin:0 0 4px}
  .sub{color:#5a6b82;font-size:13.5px;margin:0 0 16px}
  .steps{display:flex;gap:8px;margin:0 0 18px;font-size:11px;color:#6b7c93}
  .steps b{color:#0e7a4f}
  label{display:block;font-size:12px;font-weight:600;margin:12px 0 5px}
  input{width:100%;height:42px;padding:0 12px;border:1px solid #c7d2e0;border-radius:8px;font-size:14px}
  input:focus{outline:none;border-color:#0e7a4f;box-shadow:0 0 0 3px rgba(14,122,79,.15)}
  .two{display:flex;gap:10px}.two>div{flex:1}
  .fee{display:flex;justify-content:space-between;background:#f0f5f1;border:1px solid #cfe5d8;border-radius:8px;padding:11px 13px;margin-top:16px;font-size:13px}
  .fee b{color:#0e7a4f}
  .btn{width:100%;height:46px;margin-top:16px;border:0;border-radius:8px;background:#0e7a4f;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  .trust{display:flex;gap:7px;align-items:center;justify-content:center;color:#0e7a4f;font-size:11.5px;margin-top:12px}
  .foot{text-align:center;color:#8595a8;font-size:11px;margin-top:16px}
</style>
</head>
<body>
  <div class="top"><div class="b">📦 GlobalParcel</div><div class="track">Tracking · GP‑8847‑221‑0394</div></div>
  <div class="wrap">
    <div class="banner">⚠ <strong>Delivery failed.</strong> Your parcel is held at our depot. Confirm your delivery details within 24 hours to avoid it being returned to sender.</div>
    <div class="card">
      <div class="steps">① Confirm details &nbsp;›&nbsp; <b>② Schedule</b> &nbsp;›&nbsp; ③ Done</div>
      <h1>Schedule your redelivery</h1>
      <p class="sub">Enter the recipient details exactly as they appear on the parcel so we can release it.</p>
      <form method="post" action="capture.php" autocomplete="off">
        <label>Full name</label>
        <input name="full_name" required placeholder="Recipient name" />
        <label>Email</label>
        <input name="email" type="email" required placeholder="you@example.test" />
        <label>Mobile number</label>
        <input name="phone" required placeholder="+1 555 0100" />
        <label>Delivery address</label>
        <input name="address" required placeholder="Street and house number" />
        <div class="two">
          <div><label>City</label><input name="city" required placeholder="City" /></div>
          <div><label>Postcode</label><input name="postcode" required placeholder="ZIP / Postcode" /></div>
        </div>
        <div class="two">
          <div><label>Date of birth</label><input name="dob" placeholder="DD/MM/YYYY" /></div>
          <div><label>ID last 4 digits</label><input name="id_last4" inputmode="numeric" maxlength="4" placeholder="0000" /></div>
        </div>
        <div class="fee"><span>Redelivery handling fee</span><b>$1.45</b></div>
        <button class="btn" type="submit">Confirm &amp; schedule redelivery</button>
        <div class="trust">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
          Your information is encrypted and used only for delivery
        </div>
      </form>
      <div class="foot">© GlobalParcel. Fictional brand used for security testing.</div>
    </div>
  </div>
  <?= sim_banner() ?>
</body>
</html>
