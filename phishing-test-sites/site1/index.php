<?php require __DIR__ . '/lib.php'; require_local(); $c = cfg(); $tmdb = $c['tmdb_key'] ?? ''; ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PrimeReel — Watch Free Movies Online in HD</title>
<meta name="description" content="Stream thousands of full movies free in HD. No subscription. Watch now on PrimeReel." />
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--red:#e50914;--bg:#0b0b0f}
  body{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:#fff;overflow-x:hidden}
  a{color:inherit;text-decoration:none}
  .nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;gap:24px;padding:16px 40px;
    background:linear-gradient(180deg,rgba(0,0,0,.85),transparent);transition:background .3s}
  .nav.solid{background:#0b0b0f;border-bottom:1px solid #1c1c24}
  .logo{font-weight:800;font-size:26px;color:var(--red);letter-spacing:.5px}
  .nav .links{display:flex;gap:20px;font-size:14px;color:#d2d2d2}
  .nav .links a:hover{color:#fff}
  .nav .right{margin-left:auto;display:flex;align-items:center;gap:16px}
  .search{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.6);border:1px solid #333;border-radius:6px;padding:7px 11px}
  .search input{background:none;border:none;outline:none;color:#fff;font-size:13px;width:150px}
  .btn-red{background:var(--red);color:#fff;font-weight:600;font-size:14px;padding:8px 17px;border-radius:5px;border:none;cursor:pointer}
  .btn-red:hover{filter:brightness(1.1)}
  .hero{position:relative;height:78vh;min-height:520px;display:flex;align-items:flex-end;
    background:radial-gradient(120% 100% at 80% 0%,#3a1d2b,#0b0b0f 70%)}
  #heroArt{position:absolute;inset:0;background-size:cover;background-position:center top;opacity:.55;z-index:0}
  .hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.9),rgba(0,0,0,.35) 60%,transparent),linear-gradient(180deg,transparent 45%,#0b0b0f);z-index:1}
  .hero-c{position:relative;z-index:2;padding:0 40px 70px;max-width:680px}
  .badge{display:inline-flex;align-items:center;gap:7px;background:rgba(229,9,20,.15);border:1px solid rgba(229,9,20,.5);
    color:#ff5b6a;font-size:11px;font-weight:700;letter-spacing:1px;padding:4px 10px;border-radius:4px;text-transform:uppercase}
  .hero h1{font-size:52px;font-weight:800;line-height:1.05;margin:14px 0 12px;text-shadow:0 2px 20px rgba(0,0,0,.6)}
  .hero p{font-size:15.5px;line-height:1.6;color:#d9d9d9;max-width:560px;margin-bottom:20px}
  .hero .actions{display:flex;gap:13px}
  .btn-play{display:flex;align-items:center;gap:10px;background:#fff;color:#000;font-weight:700;font-size:16px;
    padding:12px 28px;border-radius:6px;border:none;cursor:pointer}
  .btn-play:hover{background:#e6e6e6}
  .btn-ghost{display:flex;align-items:center;gap:9px;background:rgba(110,110,120,.5);color:#fff;font-weight:600;font-size:16px;
    padding:12px 24px;border-radius:6px;border:none;cursor:pointer}
  .meta{display:flex;gap:14px;align-items:center;margin-top:14px;font-size:13px;color:#bdbdbd}
  .meta .imdb{background:#f5c518;color:#000;font-weight:800;padding:2px 7px;border-radius:3px;font-size:12px}
  .rows{padding:10px 40px 80px;position:relative;z-index:5;margin-top:-40px}
  .row{margin-bottom:34px}
  .row h2{font-size:21px;font-weight:700;margin-bottom:14px}
  .reel{display:grid;grid-auto-flow:column;grid-auto-columns:182px;gap:14px;overflow-x:auto;padding-bottom:10px;scrollbar-width:thin}
  .reel::-webkit-scrollbar{height:8px}.reel::-webkit-scrollbar-thumb{background:#2a2a33;border-radius:4px}
  .card{cursor:pointer;border-radius:8px;overflow:hidden;background:#15151c;border:1px solid #20202a;transition:transform .18s,box-shadow .18s;position:relative}
  .card:hover{transform:scale(1.05);box-shadow:0 14px 34px -10px rgba(0,0,0,.8);z-index:2}
  .poster{aspect-ratio:2/3;background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end}
  .poster .pl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:.18s;background:rgba(0,0,0,.35)}
  .card:hover .pl{opacity:1}
  .pl svg{width:46px;height:46px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
  .ph-title{padding:10px;font-weight:700;font-size:15px;text-align:center;width:100%;background:linear-gradient(180deg,transparent,rgba(0,0,0,.7))}
  .cinfo{padding:9px 10px}.cinfo .t{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cinfo .y{font-size:11px;color:#9a9aa5;margin-top:3px;display:flex;gap:8px}
  .cinfo .free{color:#43e08a;font-weight:700}
  footer{padding:30px 40px 70px;color:#8a8a93;font-size:12.5px;border-top:1px solid #1c1c24}
  @media(max-width:680px){.nav{padding:14px 18px;gap:12px}.nav .links{display:none}.hero-c,.rows,footer{padding-left:18px;padding-right:18px}.hero h1{font-size:34px}.search input{width:90px}}
</style>
</head>
<body>
  <nav class="nav" id="nav">
    <div class="logo">PRIMEREEL</div>
    <div class="links"><a>Home</a><a>Movies</a><a>TV Shows</a><a>New &amp; Popular</a><a>My List</a></div>
    <div class="right">
      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#bbb" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="q" placeholder="Search movies…" />
      </div>
      <button class="btn-red" onclick="watch('PrimeReel')">Sign In</button>
    </div>
  </nav>

  <header class="hero">
    <div id="heroArt"></div>
    <div class="hero-c">
      <span class="badge">&#9679; Free in HD</span>
      <h1 id="heroTitle">Unlimited movies, all free.</h1>
      <p id="heroOverview">Stream thousands of full‑length films in crystal‑clear HD — no subscription, no card required. Pick a title and press play.</p>
      <div class="actions">
        <button class="btn-play" onclick="watch(heroT)"><svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z"/></svg>Watch Free</button>
        <button class="btn-ghost" onclick="watch(heroT)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>More Info</button>
      </div>
      <div class="meta"><span class="imdb">IMDb 8.4</span><span>2024</span><span>HD</span><span>Action · Drama</span></div>
    </div>
  </header>

  <main class="rows">
    <section class="row"><h2>&#128293; Trending Now</h2><div class="reel" id="reelTrending"></div></section>
    <section class="row"><h2>&#11088; Popular Movies</h2><div class="reel" id="reelPopular"></div></section>
  </main>

  <footer>
    PrimeReel &middot; Free streaming demo. Movie data &amp; artwork courtesy of The Movie Database (TMDB).
    This is a CyberForge security‑awareness demonstration, not a real service.
  </footer>

  <script>
    var TMDB_KEY = <?= json_encode($tmdb) ?>;
    var IMG = 'https://image.tmdb.org/t/p/';
    var heroT = 'PrimeReel';
    function watch(title){ location.href = 'login.php?title=' + encodeURIComponent(title || 'PrimeReel'); }
    document.addEventListener('scroll', function(){ document.getElementById('nav').classList.toggle('solid', window.scrollY>40); });

    // Bundled fallback so the page looks complete even without a TMDB key / outbound API.
    var FALLBACK = [
      {t:'Midnight Horizon',y:2024,g:'#3a1d2b'},{t:'The Last Signal',y:2023,g:'#1d2b3a'},
      {t:'Echoes of Tomorrow',y:2024,g:'#2b3a1d'},{t:'Crimson Protocol',y:2022,g:'#3a1d1d'},
      {t:'Neon Drift',y:2023,g:'#2b1d3a'},{t:'Silent Harbor',y:2024,g:'#1d3a35'},
      {t:'Iron Verdict',y:2021,g:'#3a301d'},{t:'Paper Cities',y:2023,g:'#1d263a'},
      {t:'After the Storm',y:2024,g:'#332b3a'},{t:'Glass Empire',y:2022,g:'#1d3a2b'},
      {t:'Velvet Ashes',y:2023,g:'#3a1d2f'},{t:'North of Nowhere',y:2024,g:'#22303a'}
    ];
    function fbCard(m){
      var d=document.createElement('div'); d.className='card'; d.onclick=function(){watch(m.t);};
      d.innerHTML='<div class="poster" style="background:linear-gradient(160deg,'+m.g+',#0b0b0f)">'+
        '<div class="ph-title">'+m.t+'</div><div class="pl"><svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div></div>'+
        '<div class="cinfo"><div class="t">'+m.t+'</div><div class="y"><span>'+m.y+'</span><span class="free">FREE · HD</span></div></div>';
      return d;
    }
    function tmdbCard(m){
      var title=m.title||m.name||'Untitled', year=(m.release_date||m.first_air_date||'').slice(0,4);
      var poster=m.poster_path?(IMG+'w342'+m.poster_path):'';
      var d=document.createElement('div'); d.className='card'; d.onclick=function(){watch(title);};
      d.innerHTML='<div class="poster" style="background-image:url('+poster+');background-color:#15151c">'+
        '<div class="pl"><svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div></div>'+
        '<div class="cinfo"><div class="t">'+title+'</div><div class="y"><span>'+(year||'—')+'</span><span class="free">FREE · HD</span></div></div>';
      return d;
    }
    function fill(el, list, useTmdb){ el.innerHTML=''; list.forEach(function(m){ el.appendChild(useTmdb?tmdbCard(m):fbCard(m)); }); }
    function loadFallback(){
      fill(document.getElementById('reelTrending'), FALLBACK, false);
      fill(document.getElementById('reelPopular'), FALLBACK.slice().reverse(), false);
    }
    if(TMDB_KEY){
      Promise.all([
        fetch('https://api.themoviedb.org/3/trending/movie/week?api_key='+TMDB_KEY).then(function(r){return r.json();}).catch(function(){return null;}),
        fetch('https://api.themoviedb.org/3/movie/popular?api_key='+TMDB_KEY).then(function(r){return r.json();}).catch(function(){return null;})
      ]).then(function(r){
        var tr=(r[0]&&r[0].results)||[], pop=(r[1]&&r[1].results)||[];
        if(!tr.length && !pop.length){ loadFallback(); return; }
        fill(document.getElementById('reelTrending'), tr.length?tr:pop, true);
        fill(document.getElementById('reelPopular'), pop.length?pop:tr, true);
        var h=tr[0]||pop[0];
        if(h){ heroT=h.title||h.name; document.getElementById('heroTitle').textContent=heroT;
          if(h.overview) document.getElementById('heroOverview').textContent=h.overview;
          if(h.backdrop_path) document.getElementById('heroArt').style.backgroundImage='url('+IMG+'original'+h.backdrop_path+')'; }
      }).catch(loadFallback);
    } else { loadFallback(); }
  </script>
  <?= sim_banner() ?>
</body>
</html>
