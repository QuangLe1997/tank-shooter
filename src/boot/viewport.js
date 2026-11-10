/* Z98 classic (non-module) boot script — runs synchronously before first paint. */
  /* ---------------------------------------------------------------------------------------------
     Mobile browsers keep a URL bar / toolbars on screen, and a `position:fixed; inset:0` box is sized
     to the LARGE viewport (bar hidden) — so the bottom of every fullscreen layer (menu buttons, FIRE
     pad, HUD) ended up *behind* the browser chrome and the layout looked broken/cut off.
     --appH/--appW = the height/width that is actually VISIBLE right now (visualViewport), published
     before the first paint and kept live. Every fullscreen layer sizes itself to it.
     --------------------------------------------------------------------------------------------- */
  (function(){
    var d = document.documentElement;
    function sync(){
      var vv = window.visualViewport;
      var h = Math.round(vv ? vv.height : window.innerHeight);
      var w = Math.round(vv ? vv.width  : window.innerWidth);
      d.style.setProperty('--vvTop', Math.round(vv ? vv.offsetTop : 0) + 'px');
      d.style.setProperty('--vvH', h + 'px');
      if(document.body && document.body.classList.contains('typing')) return;   // soft keyboard up → don't squash every layer, only the typing card follows it
      if(h > 0) d.style.setProperty('--appH', h + 'px');
      if(w > 0) d.style.setProperty('--appW', w + 'px');
    }
    sync();
    window.__syncAppSize = sync;
    addEventListener('resize', sync);
    addEventListener('orientationchange', function(){ sync(); setTimeout(sync, 80); setTimeout(sync, 400); setTimeout(sync, 900); });
    addEventListener('load', sync);
    if(window.visualViewport){ visualViewport.addEventListener('resize', sync); visualViewport.addEventListener('scroll', sync); }
    document.addEventListener('fullscreenchange', function(){ setTimeout(sync, 60); setTimeout(sync, 260); });
    document.addEventListener('webkitfullscreenchange', function(){ setTimeout(sync, 60); setTimeout(sync, 260); });
  })();

