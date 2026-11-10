/* Z98 classic (non-module) boot script — runs synchronously before first paint. */
  /* safety net: if the ES module never boots (CDN blocked / very old browser) say so instead of spinning forever */
  setTimeout(function(){ var b=document.getElementById('boot'), m=document.getElementById('bootMsg');
    if(b && !b.getAttribute('data-live') && m) m.textContent='VẪN ĐANG TẢI — KIỂM TRA KẾT NỐI MẠNG'; }, 12000);

  /* Z107 SELF-HEAL after a deploy: the browser may hold some modules from the OLD version in its HTTP cache (GitHub Pages
     caches ~10 min) and link them with NEW ones → "does not provide an export named …" and the game never boots.
     On that error: re-download every module (hub.js lists them all) bypassing the cache, then reload once. */
  (function(){ var KEY='ss-heal-at';
    function heal(){ var last=+(sessionStorage.getItem(KEY)||0); if(Date.now()-last < 60000) return; sessionStorage.setItem(KEY, String(Date.now()));
      var m=document.getElementById('bootMsg'); if(m) m.textContent='ĐANG CẬP NHẬT PHIÊN BẢN MỚI…';
      fetch('src/hub.js', { cache:'reload' }).then(function(r){ return r.text(); }).then(function(t){
        var files=['src/main.js','config.js','index.html']; t.replace(/from '\.\/([^']+)'/g, function(_, f){ files.push('src/'+f); return _; });
        return Promise.all(files.map(function(f){ return fetch(f, { cache:'reload' }).catch(function(){}); }));
      }).then(function(){ location.reload(); }, function(){ location.reload(); }); }
    window.addEventListener('error', function(e){ var msg=String((e && (e.message || (e.error && e.error.message))) || '');
      if(/does not provide an export|not provide an export|Importing a module script failed|error loading dynamically imported module/i.test(msg)) heal(); }, true);
  })();
