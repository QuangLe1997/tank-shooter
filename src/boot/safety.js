/* Z98 classic (non-module) boot script — runs synchronously before first paint. */
  /* safety net: if the ES module never boots (CDN blocked / very old browser) say so instead of spinning forever */
  setTimeout(function(){ var b=document.getElementById('boot'), m=document.getElementById('bootMsg');
    if(b && !b.getAttribute('data-live') && m) m.textContent='VẪN ĐANG TẢI — KIỂM TRA KẾT NỐI MẠNG'; }, 12000);

