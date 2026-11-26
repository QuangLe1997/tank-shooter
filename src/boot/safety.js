/* Z98 classic (non-module) boot script — runs synchronously before first paint. */
  /* TEST 1 ?seed=N — a battle that can be played again: Math.random becomes a seeded generator (mulberry32) before any module runs, and every
     battlefield starts from the same state (game/flow.js startGame calls __reseed), so the land, the forts and the first wave come out the same */
  (function(){ var m=/[?&]seed=(\d+)/.exec(location.search); if(!m) return; var s0=(+m[1])>>>0||1, a=s0, n=0; window.__seed=s0; window.__rand0=Math.random;   /* SYNC 1 the page's own generator, kept for what is not layout (core/dice.js) */
    Math.random=function(){ n++; a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
    Math.random.back=function(k){ n-=k; a=a-Math.imul(k,0x6D2B79F5)|0; }; Math.random.at=function(){ return n; };   /* SYNC 1 it steps back: three.js's uuid draws are handed back */
    window.__reseed=function(k){ a=(s0^Math.imul((k|0)+1,0x9E3779B1))>>>0; }; })();
  /* safety net: if the ES module never boots (CDN blocked / very old browser) say so instead of spinning forever */
  setTimeout(function(){ var b=document.getElementById('boot'), m=document.getElementById('bootMsg');
    if(b && !b.getAttribute('data-live') && m) m.textContent='Vẫn đang tải. Nếu chờ quá lâu, hãy kiểm tra kết nối mạng.'; }, 12000);

  /* NO-TANKS 9 the boot screen's first step, for real: every game module that arrives moves the line (0 → 50 %), counted against the
     modules src/hub.js lists (read back from the cache once it has arrived); the game takes over at 55 % once it runs (data-live) */
  (function(){ if(!window.PerformanceObserver) return; var n=0, total=240, asked=false;
    function show(){ var b=document.getElementById('boot'); if(!b || b.getAttribute('data-live')) return;
      var p=Math.min(50, 50*n/total), f=document.getElementById('bootFill'), t=document.getElementById('bootPct');
      if(f) f.style.transform='scaleX('+Math.max(0.02, p/100).toFixed(3)+')'; if(t) t.textContent=Math.round(p)+'%'; }
    try{ new PerformanceObserver(function(list){ list.getEntries().forEach(function(e){ if(/\/src\/.+\.js|three/.test(e.name)) n++;
        if(!asked && /\/src\/hub\.js/.test(e.name)){ asked=true; fetch('src/hub.js').then(function(r){ return r.text(); }).then(function(t){ var m=t.match(/from '/g); if(m) total=m.length+3; }).catch(function(){}); } });
      show(); }).observe({ type:'resource', buffered:true }); }catch(e){}
  })();

  /* Z107 SELF-HEAL after a deploy: the browser may hold some modules from the OLD version in its HTTP cache (GitHub Pages
     caches ~10 min) and link them with NEW ones → "does not provide an export named …" and the game never boots.
     On that error: re-download every module (hub.js lists them all) bypassing the cache, then reload once. */
  (function(){ var KEY='ss-heal-at';
    function heal(){ var last=+(sessionStorage.getItem(KEY)||0); if(Date.now()-last < 60000) return; sessionStorage.setItem(KEY, String(Date.now()));
      var m=document.getElementById('bootMsg'); if(m) m.textContent='Đang cập nhật phiên bản mới…';
      fetch('src/hub.js', { cache:'reload' }).then(function(r){ return r.text(); }).then(function(t){
        var files=['src/main.js','config.js','index.html']; t.replace(/from '\.\/([^']+)'/g, function(_, f){ files.push('src/'+f); return _; });
        return Promise.all(files.map(function(f){ return fetch(f, { cache:'reload' }).catch(function(){}); }));
      }).then(function(){ location.reload(); }, function(){ location.reload(); }); }
    window.addEventListener('error', function(e){ var msg=String((e && (e.message || (e.error && e.error.message))) || '');
      if(/does not provide an export|not provide an export|Importing a module script failed|error loading dynamically imported module/i.test(msg)) heal(); }, true);
  })();
