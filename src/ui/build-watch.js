// ui/build-watch.js — PERF 19 (critic C2-026) A NEW BUILD IS OFFERED, NEVER MIXED IN: the page runs the build index.html read from build.json (window.__BUILD);
//   every PERF_BUDGET.build.every s, and whenever the tab comes back into view, build.json is read again (never from a cache). A different id = a new build
//   is deployed: outside a fight (menus, the end screens) a small card offers "Tải lại" (a clean reload: the new build.json, every module at its new URL);
//   in a fight it waits for the menu — nothing interrupts a battle. The once-only reload guard index.html sets on a module that failed to link is cleared
//   once this build has run a few seconds.
import { PERF_BUDGET } from '../../config.js';
import { S } from '../hub.js';

const C = PERF_BUDGET.build, FIGHT = { playing:1, countdown:1, transit:1, dying:1, intro:1, paused:0 };
export const BUILD = { id:typeof window !== 'undefined' ? window.__BUILD || '' : '', fresh:'', shown:false, checks:0 };
let el = null, _t = 0;
async function check(){ if(!BUILD.id || typeof fetch === 'undefined') return; BUILD.checks++;
  try{ const r = await fetch('build.json?t=' + Date.now(), { cache:'no-store' }); if(!r.ok) return; const j = await r.json(); if(j && j.id && j.id !== BUILD.id) BUILD.fresh = j.id; }catch(e){} }
function card(){ if(el) return el; el = document.createElement('div'); el.id = 'buildNew';
  el.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;display:none;align-items:center;gap:12px;padding:10px 14px;border-radius:6px;' +
    'background:rgba(12,16,10,0.92);border:1px solid #c9a24a;color:#f2ead2;font:600 14px/1.3 "Saira Condensed",Rajdhani,system-ui,sans-serif;letter-spacing:0.03em;box-shadow:0 4px 18px rgba(0,0,0,0.5)';
  const t = document.createElement('span'); t.textContent = 'Đã có bản cập nhật mới'; const b = document.createElement('button'); b.textContent = 'Tải lại';
  b.style.cssText = 'font:700 13px/1 inherit;letter-spacing:0.06em;padding:7px 12px;border-radius:4px;border:0;background:#c9a24a;color:#141a10;cursor:pointer';
  b.addEventListener('click', () => location.reload()); el.append(t, b); document.body.appendChild(el); return el; }
// a few times a second from the main loop's clock (game/loop.js): show the card once a new build is known and no fight is on
export function buildWatchTick(now){ if(!C.on || !BUILD.id) return; if(now > _t){ _t = now + C.every; check(); }
  if(BUILD.fresh && !BUILD.shown && !FIGHT[S.mode]){ BUILD.shown = true; card().style.display = 'flex'; } }
if(typeof window !== 'undefined'){ document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && C.on) check(); });
  setTimeout(() => { try{ sessionStorage.removeItem('xk.reload'); }catch(e){} }, 8000); }
