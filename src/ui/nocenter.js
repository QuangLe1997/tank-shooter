// ui/nocenter.js — NOCENTER · no words over the aim. In a battle nothing textual is drawn inside the aim zone (NOCENTER.zone, the middle of the screen):
//   a world label that would land there is re-routed by fx/hud-fx.js floatText — a boss's state word to a chip on the boss bar (ncChip), an informative line
//   to a small stack at the screen's left edge (ncFeed), cosmetics dropped; an attack warning from off screen gets a wordless chevron on the edge (ncArrow).
//   A last net (the guard) hides any HUD text card that would still cross the zone until it is clear (css/nocenter.css places them outside it).
import { NOCENTER } from '../../config.js';
import { MOBILE, S, uxNote, uxNoteEl } from '../hub.js';

export const NCZ = { l:0, r:0, t:0, b:0, w:0, h:0, guarded:0, fed:0, chips:0, arrows:0, dropped:0, feedEl:null, chipEl:null, chipT:0, arrows3:[], gT:0, hid:new Set(), gl:[] };
// the zone in px for the current viewport (cached per size)
export function ncZone(){ const w = innerWidth, h = innerHeight; if(w !== NCZ.w || h !== NCZ.h){ const Z = NOCENTER.zone; NCZ.w = w; NCZ.h = h;
    NCZ.l = w * (1 - Z.w) / 2; NCZ.r = w * (1 + Z.w) / 2; NCZ.t = h * (1 - Z.h) / 2; NCZ.b = h * (1 + Z.h) / 2; } return NCZ; }
export function ncHit(l, t, r, b){ const Z = ncZone(); return r > Z.l && l < Z.r && b > Z.t && t < Z.b; }
export const ncBattle = () => S.mode === 'playing';
// a floatText label's box at (x, y): centred, rising (popUp) by float.lift × its height, scaled up to 1.15 at its peak
export function ncLabelHit(x, y, text, size){ const w = String(text).length * size * 0.62 * 1.15 + 8, h = size * 1.3; return ncHit(x - w / 2, y - h * (0.5 + NOCENTER.float.lift), x + w / 2, y + h * 0.6); }

// ---- the edge stack: informative lines that would have floated over the aim ----
export function ncFeed(text, color){ if(typeof document === 'undefined' || !document.body) return; const F = NOCENTER.feed, now = performance.now() / 1000;
  let el = NCZ.feedEl; if(!el || !el.isConnected){ el = NCZ.feedEl = document.createElement('div'); el.id = 'ncFeed'; document.body.appendChild(el); }
  const last = el.lastElementChild; NCZ.fed++;
  if(last && last._tx === text && now - last._t0 < F.merge){ last._n++; last.textContent = text + ' ×' + last._n; last._t0 = now; clearTimeout(last._k); last._k = setTimeout(() => last.remove(), F.hold * 1000); return; }
  const q = uxNote(text, false); if(!q) return;   // HUDUX the text diet counts the edge stack too
  const ln = document.createElement('div'); ln.className = 'nc-ln'; uxNoteEl(q, ln, F.hold); ln.textContent = text; ln.style.color = color || '#e8e4d0'; ln._tx = text; ln._n = 1; ln._t0 = now;
  el.appendChild(ln); const max = MOBILE ? F.maxTouch : F.max; while(el.children.length > max) el.firstElementChild.remove();
  ln._k = setTimeout(() => ln.remove(), F.hold * 1000); }

// ---- the boss's state word on his bar (index.html #bossbar); false when no bar is up ----
export function ncChip(text, color){ if(typeof document === 'undefined') return false; const bb = document.getElementById('bossbar'); if(!bb || bb.style.display !== 'block') return false;
  let c = NCZ.chipEl; if(!c || c.parentNode !== bb){ c = NCZ.chipEl = document.createElement('b'); c.id = 'ncChip'; bb.appendChild(c); }
  const C = NOCENTER.chip; c.textContent = String(text).replace(/!+$/, ''); c.style.color = color || '#ffe08a'; c.style.transition = 'none'; c.style.opacity = '1'; NCZ.chips++;
  clearTimeout(NCZ.chipT); NCZ.chipT = setTimeout(() => { c.style.transition = 'opacity ' + C.fade + 's'; c.style.opacity = '0'; }, C.hold * 1000); return true; }

// ---- a wordless chevron on the screen's edge toward an attacker off screen (s = worldToScreen result) ----
export function ncArrow(s, color){ if(typeof document === 'undefined' || !document.body) return; const A = NOCENTER.arrow, w = innerWidth, h = innerHeight;
  let dx = s.x - w / 2, dy = s.y - h / 2; if(!s.infront){ dx = -dx; dy = -dy; } if(Math.abs(dx) + Math.abs(dy) < 1) dy = h;   // behind the camera: the projection is mirrored
  const hx = w * (0.5 - A.inset), hy = h * (0.5 - A.inset), k = Math.min(hx / Math.max(1e-3, Math.abs(dx)), hy / Math.max(1e-3, Math.abs(dy)));
  let a = NCZ.arrows3.find(q => !q._on); if(!a){ if(NCZ.arrows3.length >= 3) a = NCZ.arrows3[0]; else { a = document.createElement('i'); a.className = 'nc-arrow'; document.body.appendChild(a); NCZ.arrows3.push(a); } }
  a.style.width = a.style.height = A.size + 'px'; a.style.left = (w / 2 + dx * k) + 'px'; a.style.top = (h / 2 + dy * k) + 'px'; a.style.background = color || '#ff4a3a';
  a.style.transform = 'translate(-50%,-50%) rotate(' + Math.atan2(dy, dx) + 'rad)'; a.style.opacity = '1'; a._on = true; NCZ.arrows++;
  clearTimeout(a._k); a._k = setTimeout(() => { a.style.opacity = '0'; a._on = false; }, A.hold * 1000); }

// ---- the last net: HUD text cards that would cross the zone stay hidden while they do ----
const GUARD = '#combo,#coach,#mdlToasts .mdl-toast,.mdl-rankup,#tipCard .tc-box,#radio,#voiceSub,#sideChip,#bossbar,#contractChip,#objChip,#lootToast,#corewarn,#coreArrow,#edgeNote,#ncFeed,#scoreChip,#fortHud,#sqHud,#weaponchip,#rideCall,#droneWarn,#hud > [data-nc]';
function guard(){ if(!ncBattle()){ if(NCZ.hid.size){ for(const e of NCZ.hid) e.classList.remove('nc-off'); NCZ.hid.clear(); } return; }
  for(const e of document.querySelectorAll(GUARD)){ if(!e.textContent.trim()){ continue; } const r = e.getBoundingClientRect(); if(r.width < 2 || r.height < 2){ continue; }
    const hit = ncHit(r.left, r.top, r.right, r.bottom), was = NCZ.hid.has(e);
    if(hit && !was){ if(getComputedStyle(e).opacity < 0.05) continue; e.classList.add('nc-off'); NCZ.hid.add(e); NCZ.guarded++; if(NCZ.gl.length < 12) NCZ.gl.push((e.id || e.className) + '@' + Math.round(r.left) + ',' + Math.round(r.top)); } else if(!hit && was){ e.classList.remove('nc-off'); NCZ.hid.delete(e); } } }
if(typeof setInterval === 'function' && typeof document !== 'undefined') NCZ.gT = setInterval(() => { try{ guard(); }catch(err){} }, NOCENTER.guard.every * 1000);
// HUDUX the aim-zone check (tools/ts.mjs samples it in a battle): every visible text inside NOCENTER.zone — "id.class: words" (the perf readout and hidden cards aside)
export function ncZoneText(){ if(typeof document === 'undefined' || !document.body) return []; const Z = ncZone(), out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while((n = w.nextNode())){ const t = n.textContent.trim(); if(!t || !/\p{L}|\d/u.test(t)) continue; const e = n.parentElement; if(!e || e.closest('.hidden,.nc-off,#perfHud,.overlay')) continue;
    const r0 = e.getBoundingClientRect(); if(r0.width < 1 || r0.right < Z.l || r0.left > Z.r || r0.bottom < Z.t || r0.top > Z.b) continue;
    let op = 1; for(let a = e; a && a !== document.body; a = a.parentElement){ const c = getComputedStyle(a); if(c.display === 'none' || c.visibility === 'hidden'){ op = 0; break; } op *= +c.opacity; } if(op < 0.15) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if(r.width && ncHit(r.left, r.top, r.right, r.bottom)) out.push(((e.closest('[id]') || {}).id || '') + '.' + (typeof e.className === 'string' ? e.className : e.tagName) + ': ' + t.slice(0, 50)); }
  return out; }
