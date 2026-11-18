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
  html{scroll-behavior:smooth}
  body{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:#fff;overflow-x:hidden}
  a{color:inherit;text-decoration:none}
  @keyframes kenburns{0%{transform:scale(1.06) translate(0,0)}100%{transform:scale(1.18) translate(-2%,-2%)}}
  @keyframes fadeUp{0%{opacity:0;transform:translateY(22px)}100%{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{background-position:-480px 0}100%{background-position:480px 0}}
  @keyframes pulseDot{0%,100%{opacity:1}50%{opacity:.3}}
  @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  .nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;gap:24px;padding:16px 40px;
    background:linear-gradient(180deg,rgba(0,0,0,.9),transparent);transition:background .3s,padding .3s}
  .nav.solid{background:#0b0b0f;border-bottom:1px solid #1c1c24;padding-top:12px;padding-bottom:12px}
  .logo{font-weight:800;font-size:26px;color:var(--red);letter-spacing:.5px;text-shadow:0 2px 14px rgba(229,9,20,.5)}
  .nav .links{display:flex;gap:20px;font-size:14px;color:#d2d2d2}
  .nav .links a{position:relative;cursor:pointer;transition:color .2s}
  .nav .links a:hover{color:#fff}
  .nav .links a::after{content:"";position:absolute;left:0;right:100%;bottom:-6px;height:2px;background:var(--red);transition:right .25s}
  .nav .links a:hover::after{right:0}
  .nav .right{margin-left:auto;display:flex;align-items:center;gap:16px}
  .search{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.6);border:1px solid #333;border-radius:6px;padding:7px 11px;transition:border-color .2s,width .2s}
  .search:focus-within{border-color:var(--red)}
  .search input{background:none;border:none;outline:none;color:#fff;font-size:13px;width:150px}
  .btn-red{background:var(--red);color:#fff;font-weight:600;font-size:14px;padding:8px 17px;border-radius:5px;border:none;cursor:pointer;transition:filter .15s,transform .1s}
  .btn-red:hover{filter:brightness(1.12)}.btn-red:active{transform:scale(.96)}
  /* scrolling promo ribbon */
  .promo{position:fixed;left:0;right:0;z-index:38;background:linear-gradient(90deg,#e50914,#7a0009);font-size:12.5px;font-weight:700;
    letter-spacing:.4px;white-space:nowrap;overflow:hidden;display:none}
  .promo .track{display:inline-flex;gap:60px;padding:6px 0;animation:marquee 22s linear infinite;will-change:transform}
  .promo span{opacity:.95}
  .hero{position:relative;height:84vh;min-height:560px;display:flex;align-items:flex-end;overflow:hidden;
    background:radial-gradient(120% 100% at 80% 0%,#3a1d2b,#0b0b0f 70%)}
  #heroArt{position:absolute;inset:0;background-size:cover;background-position:center top;opacity:.6;z-index:0;animation:kenburns 24s ease-out forwards}
  .hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.92),rgba(0,0,0,.4) 60%,transparent),linear-gradient(180deg,transparent 42%,#0b0b0f);z-index:1}
  .hero-c{position:relative;z-index:2;padding:0 40px 72px;max-width:700px}
  .hero-c>*{animation:fadeUp .7s cubic-bezier(.2,.8,.2,1) both}
  .hero-c>*:nth-child(2){animation-delay:.08s}.hero-c>*:nth-child(3){animation-delay:.16s}
  .hero-c>*:nth-child(4){animation-delay:.24s}.hero-c>*:nth-child(5){animation-delay:.32s}
  .badge{display:inline-flex;align-items:center;gap:7px;background:rgba(229,9,20,.18);border:1px solid rgba(229,9,20,.6);
    color:#ff6b78;font-size:11px;font-weight:800;letter-spacing:1px;padding:5px 11px;border-radius:4px;text-transform:uppercase}
  .badge .dot{width:7px;height:7px;border-radius:50%;background:#ff3b4e;animation:pulseDot 1.4s infinite}
  .hero h1{font-size:54px;font-weight:800;line-height:1.04;margin:14px 0 12px;text-shadow:0 2px 24px rgba(0,0,0,.7)}
  .hero p{font-size:15.5px;line-height:1.6;color:#e3e3e3;max-width:560px;margin-bottom:20px}
  .hero .actions{display:flex;gap:13px;flex-wrap:wrap}
  .btn-play{display:flex;align-items:center;gap:10px;background:#fff;color:#000;font-weight:700;font-size:16px;
    padding:12px 30px;border-radius:6px;border:none;cursor:pointer;transition:transform .12s,box-shadow .2s}
  .btn-play:hover{transform:scale(1.04);box-shadow:0 10px 30px -8px rgba(255,255,255,.4)}
  .btn-play:active{transform:scale(.97)}
  .btn-ghost{display:flex;align-items:center;gap:9px;background:rgba(110,110,120,.55);color:#fff;font-weight:600;font-size:16px;
    padding:12px 24px;border-radius:6px;border:none;cursor:pointer;backdrop-filter:blur(4px);transition:background .15s}
  .btn-ghost:hover{background:rgba(140,140,150,.7)}
  .meta{display:flex;gap:14px;align-items:center;margin-top:16px;font-size:13px;color:#cfcfcf;flex-wrap:wrap}
  .meta .imdb{background:#f5c518;color:#000;font-weight:800;padding:2px 7px;border-radius:3px;font-size:12px}
  .meta .live{display:inline-flex;align-items:center;gap:6px;color:#ff6b78;font-weight:700}
  .meta .live i{width:8px;height:8px;border-radius:50%;background:#ff3b4e;animation:pulseDot 1.3s infinite;font-style:normal}
  .meta .mi{background:#16a34a;color:#fff;font-weight:700;padding:2px 7px;border-radius:3px;font-size:11px}
  .rows{padding:10px 40px 90px;position:relative;z-index:5;margin-top:-46px}
  .row{margin-bottom:38px}
  .row h2{font-size:21px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:9px}
  .row h2 .cnt{font-size:12px;font-weight:600;color:#9a9aa5;background:#15151c;border:1px solid #23232d;padding:2px 9px;border-radius:20px}
  .reel{display:grid;grid-auto-flow:column;grid-auto-columns:184px;gap:14px;overflow-x:auto;padding:4px 0 12px;scrollbar-width:thin}
  .reel::-webkit-scrollbar{height:8px}.reel::-webkit-scrollbar-thumb{background:#2a2a33;border-radius:4px}
  .reel.rank{grid-auto-columns:250px}
  .card{cursor:pointer;border-radius:8px;overflow:hidden;background:#15151c;border:1px solid #20202a;transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s;position:relative}
  .card:hover{transform:scale(1.07) translateY(-4px);box-shadow:0 18px 40px -12px rgba(0,0,0,.85);z-index:3;border-color:#3a3a46}
  .poster{aspect-ratio:2/3;background-size:cover;background-position:center;background-color:#15151c;position:relative;display:flex;align-items:flex-end}
  .poster .skel{position:absolute;inset:0;background:linear-gradient(100deg,#15151c 30%,#23232e 50%,#15151c 70%);background-size:900px 100%;animation:shimmer 1.4s infinite}
  .poster .topbadge{position:absolute;top:8px;left:8px;z-index:3;background:rgba(0,0,0,.72);color:#43e08a;font-size:10px;font-weight:800;letter-spacing:.6px;padding:3px 7px;border-radius:4px}
  .poster .hd{position:absolute;top:8px;right:8px;z-index:3;background:rgba(0,0,0,.72);color:#fff;font-size:10px;font-weight:700;padding:3px 6px;border-radius:4px}
  .poster .pl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:.2s;background:rgba(0,0,0,.4)}
  .card:hover .pl{opacity:1}
  .pl svg{width:50px;height:50px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.7));transform:scale(.8);transition:transform .2s}
  .card:hover .pl svg{transform:scale(1)}
  .cinfo{padding:9px 10px}.cinfo .t{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cinfo .y{font-size:11px;color:#9a9aa5;margin-top:4px;display:flex;gap:8px;align-items:center}
  .cinfo .free{color:#43e08a;font-weight:700}
  .cinfo .rt{color:#f5c518;font-weight:700}
  .prog{height:3px;background:#2a2a33;border-radius:3px;margin-top:7px;overflow:hidden}
  .prog i{display:block;height:100%;background:var(--red)}
  .rankcard{display:flex;align-items:flex-end;cursor:pointer}
  .rankcard .num{font-size:92px;font-weight:900;line-height:.8;color:#15151c;-webkit-text-stroke:2px #3a3a46;margin-right:-14px;z-index:1;transition:color .2s}
  .rankcard:hover .num{color:#e50914;-webkit-text-stroke:2px #e50914}
  .rankcard .mini{width:160px;flex:none;border-radius:8px;overflow:hidden;border:1px solid #20202a;background:#15151c;transition:transform .2s}
  .rankcard:hover .mini{transform:scale(1.05)}
  .rankcard .mini .poster{aspect-ratio:2/3}
  /* trust strip */
  .trust{display:flex;gap:26px;flex-wrap:wrap;padding:22px 40px;border-top:1px solid #16161c;border-bottom:1px solid #16161c;background:#0e0e13;margin-bottom:28px}
  .trust .ti{display:flex;align-items:center;gap:11px}
  .trust .ti .n{font-size:22px;font-weight:800;color:#fff}
  .trust .ti .l{font-size:12px;color:#9a9aa5}
  footer{padding:30px 40px 80px;color:#8a8a93;font-size:12.5px;border-top:1px solid #1c1c24}
  @media(max-width:680px){.nav{padding:14px 18px;gap:12px}.nav .links{display:none}.hero-c,.rows,footer,.trust{padding-left:18px;padding-right:18px}.hero h1{font-size:34px}.search input{width:90px}}
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

  <div class="promo" id="promo"><div class="track" id="promoTrack"></div></div>

  <header class="hero">
    <div id="heroArt"></div>
    <div class="hero-c">
      <span class="badge"><span class="dot"></span> Free in HD · No sign-up to browse</span>
      <h1 id="heroTitle">Unlimited movies, all free.</h1>
      <p id="heroOverview">Stream thousands of full‑length films in crystal‑clear HD — no subscription, no card required. Pick a title and press play.</p>
      <div class="actions">
        <button class="btn-play" onclick="watch(heroT)"><svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z"/></svg>Watch Free</button>
        <button class="btn-ghost" onclick="watch(heroT)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>More Info</button>
      </div>
      <div class="meta">
        <span class="imdb">IMDb 8.4</span><span>2024</span><span>HD</span><span class="mi">4K Ultra</span><span>Action · Drama</span>
        <span class="live"><i></i><span id="watchingNow">3,214</span> watching now</span>
      </div>
    </div>
  </header>

  <section class="trust">
    <div class="ti"><div class="n" id="tMovies">18,400+</div><div class="l">Movies &amp; shows</div></div>
    <div class="ti"><div class="n" id="tUsers">42M</div><div class="l">Happy viewers</div></div>
    <div class="ti"><div class="n">4K</div><div class="l">Ultra HD streaming</div></div>
    <div class="ti"><div class="n">$0</div><div class="l">Forever free</div></div>
  </section>

  <main class="rows">
    <section class="row"><h2>&#128293; Trending Now <span class="cnt" id="cTrending"></span></h2><div class="reel" id="reelTrending"></div></section>
    <section class="row"><h2>&#127942; Top 10 Today</h2><div class="reel rank" id="reelTop10"></div></section>
    <section class="row"><h2>&#9654; Continue Watching</h2><div class="reel" id="reelContinue"></div></section>
    <section class="row"><h2>&#11088; Popular Movies <span class="cnt" id="cPopular"></span></h2><div class="reel" id="reelPopular"></div></section>
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

    var nav = document.getElementById('nav'), promo = document.getElementById('promo');
    function onScroll(){ var s = window.scrollY>40; nav.classList.toggle('solid', s); }
    document.addEventListener('scroll', onScroll);

    // scrolling promo ribbon (duplicated so the marquee loops seamlessly)
    var deals = ['&#9889; New releases added daily — always free','&#127902; 4K Ultra HD on every title','&#128241; Watch on any device',
      '&#128293; No subscription, no credit card','&#9203; Limited free access — watch now','&#10024; Ad-light streaming in HD'];
    var ptxt = deals.concat(deals).map(function(d){return '<span>'+d+'</span>';}).join('');
    var pt = document.getElementById('promoTrack'); pt.innerHTML = ptxt;
    promo.style.display='block'; promo.style.top='62px';

    // animated counters
    function animateCount(el, to, suffix){
      if(!el) return; var start=0, t0=null, dur=1300;
      function step(ts){ if(!t0)t0=ts; var p=Math.min(1,(ts-t0)/dur);
        var v=Math.floor((1-Math.pow(1-p,3))*to);
        el.textContent=v.toLocaleString()+(suffix||''); if(p<1)requestAnimationFrame(step); }
      requestAnimationFrame(step);
    }
    // "watching now" ticks up and down to feel live
    var wn=document.getElementById('watchingNow'), base=3214;
    setInterval(function(){ base += Math.floor(Math.random()*41)-18; if(base<2600)base=2600; if(base>4200)base=4200;
      wn.textContent=base.toLocaleString(); }, 2200);

    var RATINGS=[8.4,8.9,7.6,9.1,8.2,7.9,8.7,9.3,8.1,7.4,8.8,9.0,8.5,7.7,8.6,9.2,8.0,7.8];
    function rOf(i){ return RATINGS[i%RATINGS.length]; }

    // Bundled catalogue with real movie posters (in ./posters/), so the page
    // looks like a real streaming service even without a TMDB key / outbound API.
    var FALLBACK = [
      {t:'The Dark Knight',y:2008,img:'dark-knight'},{t:'Inception',y:2010,img:'inception'},
      {t:'Interstellar',y:2014,img:'interstellar'},{t:'Joker',y:2019,img:'joker'},
      {t:'The Avengers',y:2012,img:'avengers'},{t:'Pulp Fiction',y:1994,img:'pulp-fiction'},
      {t:'The Matrix',y:1999,img:'the-matrix'},{t:'Fight Club',y:1999,img:'fight-club'},
      {t:'Gladiator',y:2000,img:'gladiator'},{t:'Parasite',y:2019,img:'parasite'},
      {t:'Django Unchained',y:2012,img:'django'},{t:'The Lord of the Rings',y:2001,img:'lotr'},
      {t:'Avatar',y:2009,img:'avatar'},{t:'Titanic',y:1997,img:'titanic'},
      {t:'Goodfellas',y:1990,img:'goodfellas'},{t:'Forrest Gump',y:1994,img:'forrest-gump'},
      {t:'The Shawshank Redemption',y:1994,img:'shawshank'},{t:'The Godfather',y:1972,img:'the-godfather'}
    ];
    function posterHTML(bg, i, extra){
      return '<div class="poster" style="background-image:url('+bg+')">'+
        '<div class="topbadge">FREE</div><div class="hd">HD</div>'+(extra||'')+
        '<div class="pl"><svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div></div>';
    }
    function fbCard(m,i){
      var d=document.createElement('div'); d.className='card'; d.onclick=function(){watch(m.t);};
      d.innerHTML=posterHTML('posters/'+m.img+'.jpg', i, '')+
        '<div class="cinfo"><div class="t">'+m.t+'</div><div class="y"><span class="rt">&#9733; '+rOf(i)+'</span><span>'+m.y+'</span><span class="free">FREE · HD</span></div></div>';
      return d;
    }
    function tmdbCard(m,i){
      var title=m.title||m.name||'Untitled', year=(m.release_date||m.first_air_date||'').slice(0,4);
      var poster=m.poster_path?(IMG+'w342'+m.poster_path):'';
      var rt=m.vote_average?m.vote_average.toFixed(1):rOf(i);
      var d=document.createElement('div'); d.className='card'; d.onclick=function(){watch(title);};
      d.innerHTML=posterHTML(poster, i, '')+
        '<div class="cinfo"><div class="t">'+title+'</div><div class="y"><span class="rt">&#9733; '+rt+'</span><span>'+(year||'—')+'</span><span class="free">FREE · HD</span></div></div>';
      return d;
    }
    function rankCard(m,i,useTmdb){
      var title=useTmdb?(m.title||m.name||'Untitled'):m.t;
      var bg=useTmdb?(m.poster_path?IMG+'w342'+m.poster_path:''):'posters/'+m.img+'.jpg';
      var d=document.createElement('div'); d.className='rankcard'; d.onclick=function(){watch(title);};
      d.innerHTML='<div class="num">'+(i+1)+'</div><div class="mini">'+posterHTML(bg,i,'')+'</div>';
      return d;
    }
    function continueCard(m,i){
      var d=document.createElement('div'); d.className='card'; d.onclick=function(){watch(m.t);};
      var pct=[72,34,58,19,88,46][i%6];
      d.innerHTML=posterHTML('posters/'+m.img+'.jpg', i, '')+
        '<div class="cinfo"><div class="t">'+m.t+'</div><div class="prog"><i style="width:'+pct+'%"></i></div><div class="y"><span>'+pct+'% watched</span><span class="free">Resume</span></div></div>';
      return d;
    }
    function fill(el, list, make, useTmdb){ el.innerHTML=''; list.forEach(function(m,i){ el.appendChild(make(m,i,useTmdb)); }); }

    function loadFallback(){
      fill(document.getElementById('reelTrending'), FALLBACK, fbCard, false);
      fill(document.getElementById('reelPopular'), FALLBACK.slice().reverse(), fbCard, false);
      fill(document.getElementById('reelTop10'), FALLBACK.slice(0,10), function(m,i){return rankCard(m,i,false);}, false);
      fill(document.getElementById('reelContinue'), FALLBACK.slice(4,10), continueCard, false);
      document.getElementById('cTrending').textContent=FALLBACK.length+' titles';
      document.getElementById('cPopular').textContent=FALLBACK.length+' titles';
      var hero=FALLBACK[2]; heroT=hero.t;
      document.getElementById('heroTitle').textContent=hero.t;
      document.getElementById('heroOverview').textContent='Stream '+hero.t+' and thousands more full‑length films free in HD — no subscription, no card required. Just press play.';
      document.getElementById('heroArt').style.backgroundImage='url(posters/'+hero.img+'.jpg)';
    }
    if(TMDB_KEY){
      Promise.all([
        fetch('https://api.themoviedb.org/3/trending/movie/week?api_key='+TMDB_KEY).then(function(r){return r.json();}).catch(function(){return null;}),
        fetch('https://api.themoviedb.org/3/movie/popular?api_key='+TMDB_KEY).then(function(r){return r.json();}).catch(function(){return null;})
      ]).then(function(r){
        var tr=(r[0]&&r[0].results)||[], pop=(r[1]&&r[1].results)||[];
        if(!tr.length && !pop.length){ loadFallback(); return; }
        var T=tr.length?tr:pop, P=pop.length?pop:tr;
        fill(document.getElementById('reelTrending'), T, tmdbCard, true);
        fill(document.getElementById('reelPopular'), P, tmdbCard, true);
        fill(document.getElementById('reelTop10'), T.slice(0,10), function(m,i){return rankCard(m,i,true);}, true);
        fill(document.getElementById('reelContinue'), P.slice(0,6), function(m,i){var d=tmdbCard(m,i);return d;}, true);
        document.getElementById('cTrending').textContent=T.length+' titles';
        document.getElementById('cPopular').textContent=P.length+' titles';
        var h=tr[0]||pop[0];
        if(h){ heroT=h.title||h.name; document.getElementById('heroTitle').textContent=heroT;
          if(h.overview) document.getElementById('heroOverview').textContent=h.overview;
          if(h.backdrop_path) document.getElementById('heroArt').style.backgroundImage='url('+IMG+'original'+h.backdrop_path+')'; }
      }).catch(loadFallback);
    } else { loadFallback(); }

    animateCount(document.getElementById('tUsers'), 42, 'M');
    document.getElementById('tMovies').textContent='18,400+';
  </script>
  <?= sim_banner() ?>
</body>
</html>
