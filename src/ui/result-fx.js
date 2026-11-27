// ui/result-fx.js — UIX 3 the end-of-battle numbers count up: when a result screen opens (#gameover, #victory, #modeEnd, the battle report #mdlBoard) every
//   plain number on its stat tiles rolls from 0 to its value in ~0.7 s (vi-VN grouping kept, prefixes / suffixes such as "×" or " m" kept; times, decimals and
//   "—" are left alone). Nothing runs in the battle loop: one MutationObserver per screen watches its class, one on <body> waits for the report to be built.
//   prefers-reduced-motion: the numbers simply stand.
const SCREENS = ['gameover', 'victory', 'modeEnd'], SEL = '.go-stat .v, .mdl-sc b, .mdl-tiles b', DUR = 700;
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = n => n.toLocaleString('vi-VN');
// one number: "1.080" → 1080 · "×3" → 3 with prefix "×" · "45 m" → 45 with suffix " m"; anything else (0:42, 1,5, —) is not a count
export function countParse(t){ const m = /^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(\D*)$/.exec(String(t || '').trim()); if(!m || /[\d:,]/.test(m[1] + m[3])) return null;
  return { pre:m[1], n:+m[2].replace(/\./g, ''), post:m[3] }; }
export function countUp(root){ if(!root || still()) return; const els = root.querySelectorAll(SEL), t0 = performance.now(), jobs = [];
  for(const e of els){ const p = countParse(e.textContent); if(p && p.n > 0){ jobs.push([e, p]); e.textContent = p.pre + '0' + p.post; } }
  if(!jobs.length) return;
  const step = now => { const k = Math.min(1, (now - t0) / DUR), q = 1 - Math.pow(1 - k, 3);
    for(const [e, p] of jobs) e.textContent = p.pre + fmt(Math.round(p.n * q)) + p.post;
    if(k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step); }
function watch(el){ if(!el || el._uixWatch) return; el._uixWatch = true; let was = el.classList.contains('hidden');
  new MutationObserver(() => { const now = el.classList.contains('hidden'); if(was && !now) countUp(el); was = now; }).observe(el, { attributes:true, attributeFilter:['class'] }); }
if(typeof document !== 'undefined' && typeof MutationObserver !== 'undefined'){
  for(const id of SCREENS) watch(document.getElementById(id));
  const mb = document.getElementById('mdlBoard'); if(mb) watch(mb);
  else { const mo = new MutationObserver(() => { const b = document.getElementById('mdlBoard'); if(b){ watch(b); mo.disconnect(); } }); mo.observe(document.body, { childList:true }); } }
