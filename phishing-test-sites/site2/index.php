<?php
require __DIR__ . '/lib.php';
require_local();
// Catalogue of popular free software. Icons load client-side from simpleicons CDN.
$apps = [
    ['slug'=>'googlechrome','name'=>'Google Chrome','cat'=>'Web Browser','ver'=>'124.0','size'=>'98.4 MB','dl'=>'2.4B'],
    ['slug'=>'vlcmediaplayer','name'=>'VLC Media Player','cat'=>'Media Player','ver'=>'3.0.20','size'=>'42.1 MB','dl'=>'3.8B'],
    ['slug'=>'zoom','name'=>'Zoom Workplace','cat'=>'Communication','ver'=>'6.0','size'=>'34.7 MB','dl'=>'920M'],
    ['slug'=>'obsstudio','name'=>'OBS Studio','cat'=>'Streaming','ver'=>'30.1','size'=>'128 MB','dl'=>'410M'],
    ['slug'=>'spotify','name'=>'Spotify','cat'=>'Music','ver'=>'1.2.3','size'=>'1.1 MB','dl'=>'1.9B'],
    ['slug'=>'discord','name'=>'Discord','cat'=>'Communication','ver'=>'1.0.9','size'=>'92.0 MB','dl'=>'700M'],
    ['slug'=>'audacity','name'=>'Audacity','cat'=>'Audio Editor','ver'=>'3.5','size'=>'31.2 MB','dl'=>'200M'],
    ['slug'=>'blender','name'=>'Blender','cat'=>'3D Creation','ver'=>'4.1','size'=>'320 MB','dl'=>'150M'],
    ['slug'=>'gimp','name'=>'GIMP','cat'=>'Graphics','ver'=>'2.10','size'=>'260 MB','dl'=>'300M'],
    ['slug'=>'notepadplusplus','name'=>'Notepad++','cat'=>'Code Editor','ver'=>'8.6','size'=>'4.5 MB','dl'=>'500M'],
    ['slug'=>'libreoffice','name'=>'LibreOffice','cat'=>'Office Suite','ver'=>'24.2','size'=>'330 MB','dl'=>'350M'],
    ['slug'=>'7zip','name'=>'7-Zip','cat'=>'Utility','ver'=>'24.0','size'=>'1.5 MB','dl'=>'1.2B'],
];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SoftHub — Download Free Software for Windows, Mac &amp; Linux</title>
<meta name="description" content="Download the latest free software safely. Verified, malware-free downloads at high speed." />
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--blue:#1a73e8;--bg:#f4f7fb;--ink:#16202e}
  html{scroll-behavior:smooth}
  body{font-family:'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink);padding-bottom:52px}
  a{color:inherit;text-decoration:none}
  @keyframes fadeUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
  @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  @keyframes pulseDot{0%,100%{opacity:1}50%{opacity:.25}}
  header{background:#fff;border-bottom:1px solid #e4eaf2;position:sticky;top:0;z-index:30;box-shadow:0 1px 0 rgba(20,50,90,.02)}
  .bar{max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:22px;padding:14px 24px}
  .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:21px;color:var(--blue)}
  .logo .b{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#1a73e8,#34c0eb);display:grid;place-items:center;color:#fff;box-shadow:0 4px 12px -3px rgba(26,115,232,.6)}
  .nav{display:flex;gap:18px;font-size:14px;color:#46586f}
  .nav a{cursor:pointer;transition:color .15s}.nav a:hover{color:var(--blue)}
  .hsearch{margin-left:auto;display:flex;align-items:center;gap:9px;background:#eef2f8;border:1px solid #e0e7f1;border-radius:9px;padding:9px 13px;min-width:260px;transition:border-color .15s,box-shadow .15s}
  .hsearch:focus-within{border-color:var(--blue);box-shadow:0 0 0 3px rgba(26,115,232,.1)}
  .hsearch input{background:none;border:none;outline:none;font-size:13.5px;flex:1}
  .livebar{background:#0e1830;color:#cfe0ff;font-size:12.5px}
  .livebar .lc{max-width:1120px;margin:0 auto;padding:7px 24px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  .livebar b{color:#fff}
  .livebar .ld{display:inline-flex;align-items:center;gap:7px}
  .livebar .ld i{width:7px;height:7px;border-radius:50%;background:#43e08a;animation:pulseDot 1.3s infinite;font-style:normal}
  .hero{max-width:1120px;margin:30px auto 8px;padding:0 24px;display:flex;align-items:center;gap:24px}
  .hero .t{flex:1;animation:fadeUp .6s ease both}
  .hero h1{font-size:34px;font-weight:800;margin-bottom:8px;letter-spacing:-.3px}
  .hero p{color:#52637b;font-size:15px;max-width:540px;line-height:1.6}
  .trust{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
  .tchip{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #e4eaf2;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#46586f;font-weight:600;transition:transform .15s,box-shadow .15s}
  .tchip:hover{transform:translateY(-2px);box-shadow:0 8px 20px -12px rgba(20,50,90,.5)}
  .tchip svg{width:15px;height:15px;color:#16a34a}
  .heroart{width:150px;height:150px;flex:none;border-radius:24px;background:linear-gradient(135deg,#1a73e8,#34c0eb);display:grid;place-items:center;color:#fff;box-shadow:0 24px 50px -22px rgba(26,115,232,.8);animation:floaty 4s ease-in-out infinite}
  .heroart svg{width:72px;height:72px}
  /* editor's choice feature */
  .feature{max-width:1120px;margin:26px auto 0;padding:0 24px}
  .fcard{display:flex;align-items:center;gap:20px;background:linear-gradient(120deg,#0e1830,#17345e);color:#fff;border-radius:16px;padding:22px 24px;overflow:hidden;position:relative}
  .fcard .fic{width:70px;height:70px;border-radius:16px;background:rgba(255,255,255,.12);display:grid;place-items:center;flex:none}
  .fcard .fic img{width:44px;height:44px}
  .fcard .pick{font-size:11px;font-weight:800;letter-spacing:1.2px;color:#8fd0ff;text-transform:uppercase}
  .fcard h3{font-size:22px;font-weight:800;margin:3px 0 4px}
  .fcard p{font-size:13px;color:#c5d6f0;max-width:460px;line-height:1.5}
  .fcard .fdl{margin-left:auto;background:#fff;color:#0e1830;font-weight:800;font-size:14px;border:none;border-radius:10px;padding:13px 22px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:transform .12s}
  .fcard .fdl:hover{transform:scale(1.04)}.fcard .fdl svg{width:16px;height:16px}
  main{max-width:1120px;margin:30px auto 0;padding:0 24px}
  .sec-h{display:flex;align-items:center;justify-content:space-between;margin:8px 0 16px}
  .sec-h h2{font-size:19px}
  .sec-h span{font-size:13px;color:#7689a3}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
  .app{background:#fff;border:1px solid #e4eaf2;border-radius:14px;padding:18px;display:flex;flex-direction:column;
    transition:transform .17s,box-shadow .17s,border-color .17s;position:relative;opacity:0;animation:fadeUp .5s ease forwards}
  .app:hover{transform:translateY(-4px);box-shadow:0 20px 40px -22px rgba(20,50,90,.45);border-color:#cfe0f5}
  .app .verified{position:absolute;top:14px;right:14px;display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:#16a34a}
  .app .verified svg{width:13px;height:13px}
  .app .top{display:flex;align-items:center;gap:13px;margin-bottom:12px}
  .app .ic{width:48px;height:48px;border-radius:12px;background:#f3f6fb;border:1px solid #e9eef6;display:grid;place-items:center;flex:none}
  .app .ic img{width:30px;height:30px}
  .app .nm{font-size:15.5px;font-weight:700}
  .app .ct{font-size:12px;color:#7689a3;margin-top:2px}
  .app .stars{display:flex;align-items:center;gap:6px;font-size:12px;color:#7689a3;margin-bottom:9px}
  .app .stars .s{color:#f5b400;letter-spacing:1px}
  .app .stats{display:flex;gap:14px;font-size:11.5px;color:#7689a3;margin-bottom:14px}
  .app .stats b{color:#46586f;font-weight:700}
  .dlbtn{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--blue);color:#fff;
    border:none;border-radius:9px;font-size:14px;font-weight:700;padding:11px;cursor:pointer;width:100%;transition:background .15s,transform .1s}
  .dlbtn:hover{background:#1666d0}.dlbtn:active{transform:scale(.97)}
  .dlbtn svg{width:16px;height:16px}
  footer{max-width:1120px;margin:34px auto 0;padding:20px 24px 0;border-top:1px solid #e4eaf2;color:#8395ad;font-size:12.5px}
  @media(max-width:640px){.nav,.hsearch{display:none}.hero h1{font-size:24px}.heroart{display:none}.fcard{flex-wrap:wrap}.fcard .fdl{margin-left:0}}
</style>
</head>
<body>
  <header>
    <div class="bar">
      <div class="logo"><span class="b"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></span>SoftHub</div>
      <nav class="nav"><a>Windows</a><a>macOS</a><a>Linux</a><a>Android</a><a>Categories</a></nav>
      <div class="hsearch"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8395ad" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input placeholder="Search 50,000+ apps…" /></div>
    </div>
  </header>

  <div class="livebar"><div class="lc">
    <span class="ld"><i></i><b id="liveNow">1,284</b> downloading right now</span>
    <span>&#9733; <b>4.8</b>/5 from <b>2.1M</b> reviews</span>
    <span>&#128190; <b id="today">0</b> downloads today</span>
    <span>&#9989; Every file virus-scanned before release</span>
  </div></div>

  <section class="hero">
    <div class="t">
      <h1>Free software, downloaded safely.</h1>
      <p>Get the latest versions of the apps you love — fast, verified and 100% free. Trusted by millions every day.</p>
      <div class="trust">
        <div class="tchip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>Virus‑scanned</div>
        <div class="tchip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>High‑speed CDN</div>
        <div class="tchip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>No bundleware</div>
        <div class="tchip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v8M8 12h8"/><circle cx="12" cy="12" r="9"/></svg>Always latest version</div>
      </div>
    </div>
    <div class="heroart"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></div>
  </section>

  <section class="feature">
    <div class="fcard">
      <div class="fic"><img src="https://cdn.simpleicons.org/googlechrome" alt="" onerror="this.style.display='none'" /></div>
      <div>
        <div class="pick">&#11088; Editor's Choice this week</div>
        <h3>Google Chrome 124.0</h3>
        <p>The world's most popular browser, now faster and more secure. Free, verified, and ready to install in seconds.</p>
      </div>
      <button class="fdl" onclick="location.href='download.php?app=googlechrome&name=Google%20Chrome'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Free Download
      </button>
    </div>
  </section>

  <main>
    <div class="sec-h"><h2>Most Popular This Week</h2><span><?= count($apps) ?> apps · updated hourly</span></div>
    <div class="grid">
      <?php foreach ($apps as $i => $a): $rating = number_format(4.3 + (($i * 7) % 6) / 10, 1); $revs = 1200 + (($i * 977) % 8000); ?>
        <div class="app" style="animation-delay:<?= ($i * 45) ?>ms">
          <span class="verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Verified</span>
          <div class="top">
            <div class="ic"><img src="https://cdn.simpleicons.org/<?= e($a['slug']) ?>" alt="" onerror="this.style.display='none'" /></div>
            <div><div class="nm"><?= e($a['name']) ?></div><div class="ct"><?= e($a['cat']) ?> · v<?= e($a['ver']) ?></div></div>
          </div>
          <div class="stars"><span class="s">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <b style="color:#46586f"><?= $rating ?></b> <span>(<?= number_format($revs) ?> reviews)</span></div>
          <div class="stats">
            <span><b><?= e($a['dl']) ?></b> downloads</span>
            <span><b><?= e($a['size']) ?></b></span>
          </div>
          <button class="dlbtn" onclick="location.href='download.php?app=<?= urlencode($a['slug']) ?>&name=<?= urlencode($a['name']) ?>'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
            Free Download
          </button>
        </div>
      <?php endforeach; ?>
    </div>
    <footer>SoftHub &middot; The safe place to download free software. App logos are trademarks of their respective owners.
      This is a CyberForge security‑awareness demonstration, not a real download service.</footer>
  </main>

  <script>
    // live download counters
    var liveNow=document.getElementById('liveNow'), b=1284;
    setInterval(function(){ b += Math.floor(Math.random()*25)-10; if(b<900)b=900; if(b<1600){} liveNow.textContent=b.toLocaleString(); }, 1800);
    var today=document.getElementById('today'), tv=418233, t0=null;
    function run(ts){ if(!t0)t0=ts; var p=Math.min(1,(ts-t0)/1400); today.textContent=Math.floor((1-Math.pow(1-p,3))*tv).toLocaleString(); if(p<1)requestAnimationFrame(run); }
    requestAnimationFrame(run);
    setInterval(function(){ tv += Math.floor(Math.random()*7)+1; today.textContent=tv.toLocaleString(); }, 900);
  </script>
  <?= sim_banner() ?>
</body>
</html>
