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
  body{font-family:'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink);padding-bottom:48px}
  a{color:inherit;text-decoration:none}
  header{background:#fff;border-bottom:1px solid #e4eaf2;position:sticky;top:0;z-index:30}
  .bar{max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:22px;padding:14px 24px}
  .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:21px;color:var(--blue)}
  .logo .b{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#1a73e8,#34c0eb);display:grid;place-items:center;color:#fff}
  .nav{display:flex;gap:18px;font-size:14px;color:#46586f}
  .nav a:hover{color:var(--blue)}
  .hsearch{margin-left:auto;display:flex;align-items:center;gap:9px;background:#eef2f8;border:1px solid #e0e7f1;border-radius:9px;padding:9px 13px;min-width:240px}
  .hsearch input{background:none;border:none;outline:none;font-size:13.5px;flex:1}
  .hero{max-width:1120px;margin:30px auto 8px;padding:0 24px;display:flex;align-items:center;gap:24px}
  .hero .t{flex:1}
  .hero h1{font-size:32px;font-weight:800;margin-bottom:8px}
  .hero p{color:#52637b;font-size:15px;max-width:520px;line-height:1.6}
  .trust{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
  .tchip{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #e4eaf2;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#46586f;font-weight:600}
  .tchip svg{width:15px;height:15px;color:#16a34a}
  main{max-width:1120px;margin:26px auto 0;padding:0 24px}
  .sec-h{display:flex;align-items:center;justify-content:space-between;margin:8px 0 16px}
  .sec-h h2{font-size:19px}
  .sec-h span{font-size:13px;color:#7689a3}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
  .app{background:#fff;border:1px solid #e4eaf2;border-radius:14px;padding:18px;display:flex;flex-direction:column;
    transition:transform .15s,box-shadow .15s}
  .app:hover{transform:translateY(-3px);box-shadow:0 16px 36px -20px rgba(20,50,90,.4)}
  .app .top{display:flex;align-items:center;gap:13px;margin-bottom:13px}
  .app .ic{width:48px;height:48px;border-radius:12px;background:#f3f6fb;border:1px solid #e9eef6;display:grid;place-items:center;flex:none}
  .app .ic img{width:30px;height:30px}
  .app .nm{font-size:15.5px;font-weight:700}
  .app .ct{font-size:12px;color:#7689a3;margin-top:2px}
  .app .stats{display:flex;gap:14px;font-size:11.5px;color:#7689a3;margin-bottom:14px}
  .app .stats b{color:#46586f;font-weight:700}
  .app .star{color:#f5b400}
  .dlbtn{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--blue);color:#fff;
    border:none;border-radius:9px;font-size:14px;font-weight:700;padding:11px;cursor:pointer;width:100%}
  .dlbtn:hover{background:#1666d0}
  .dlbtn svg{width:16px;height:16px}
  footer{max-width:1120px;margin:34px auto 0;padding:20px 24px 0;border-top:1px solid #e4eaf2;color:#8395ad;font-size:12.5px}
  @media(max-width:640px){.nav,.hsearch{display:none}.hero h1{font-size:24px}}
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

  <section class="hero">
    <div class="t">
      <h1>Free software, downloaded safely.</h1>
      <p>Get the latest versions of the apps you love — fast, verified and 100% free. Trusted by millions every day.</p>
      <div class="trust">
        <div class="tchip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>Virus‑scanned</div>
        <div class="tchip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>High‑speed</div>
        <div class="tchip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>No bundleware</div>
      </div>
    </div>
  </section>

  <main>
    <div class="sec-h"><h2>Most Popular This Week</h2><span><?= count($apps) ?> apps</span></div>
    <div class="grid">
      <?php foreach ($apps as $i => $a): $rating = number_format(4.3 + (($i * 7) % 6) / 10, 1); ?>
        <div class="app">
          <div class="top">
            <div class="ic"><img src="https://cdn.simpleicons.org/<?= e($a['slug']) ?>" alt="" onerror="this.style.display='none'" /></div>
            <div><div class="nm"><?= e($a['name']) ?></div><div class="ct"><?= e($a['cat']) ?> · v<?= e($a['ver']) ?></div></div>
          </div>
          <div class="stats">
            <span class="star">&#9733; <b><?= $rating ?></b></span>
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
  <?= sim_banner() ?>
</body>
</html>
