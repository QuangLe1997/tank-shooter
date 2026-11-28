// ui/hudux.js — HUDUX the critic's HUD / UI-UX round 1: one small clock (4×/s) that keeps the battle HUD honest, and the rules other modules ask.
//   · body classes the stylesheet (css/hudux.css) lays the HUD out by: hux-play (a battle is on screen: its buttons may show), hux-sect (a battle of
//     sectors: the top bar shows the sector, not MÀN / ĐỢT), --hux-hurt (the hurt edge deepens as health falls, 0.45 → 1);
//   · the text diet (uxNote): at most HUDUX.notes.max worded notes on screen at once, the same words not twice within dedupe s, lines with no action dropped;
//   · tips only in a lull and at most perBattle a battle (uxTipOk); the leaderboard's test names (uxBoardHidden) and a test run never posting (uxDevRun);
//   · CHƠI NGAY = one click to the next fort (uxPlayNow), the briefing then goes on by itself (uxQuickGo).
import { HUDUX } from '../../config.js';
import { BIOME, CQ, DIR, MOBILE, PROFILE, S, SECT, SGOAL, _tipOpen, closeTip, enemies, heightAt, ncHit, worldToScreen, battleTitle, biomeVi, conqLaunch, conqStore, escapeHtml, sectorStoryRadio } from '../hub.js';

export const UX = { hitAt:0, hp0:0, tipChk:0, tipOk:false, tipLull:false, k:0, map:null, tips:0, runId:null, notes:[], quick:false, dropped:0, capped:0, iv:0 };
const PLAY = new Set(['playing', 'countdown', 'transit', 'dying', 'tip']);
const now = () => performance.now() / 1000;

// ---- the text diet: may this worded note show now? (warn: an attack's warning — it pushes the oldest plain note out) ----
export function uxNote(text, warn){ const N = HUDUX.notes, t = now(), s = String(text || '').trim(); if(!s) return false;
  if(N.drop && N.drop.test(s)){ UX.dropped++; return false; }
  for(let i = UX.notes.length - 1; i >= 0; i--){ const q = UX.notes[i]; if(t - q.t > (q.life || 2.4) || (q.el && !q.el.isConnected)) UX.notes.splice(i, 1); }
  if(UX.notes.some(q => q.s === s && t - q.t < N.dedupe)){ UX.dropped++; return false; }
  if(UX.notes.length >= N.max){ const k = warn ? UX.notes.findIndex(q => !q.warn) : -1; if(k < 0){ UX.capped++; return false; } const q = UX.notes.splice(k, 1)[0]; if(q.el && q.el.remove) q.el.remove(); }
  const q = { s, t, warn:!!warn, el:null, life:2.4 }; UX.notes.push(q); return q; }
// the note's element, once made (so a warning can take its place)
export function uxNoteEl(q, el, life){ if(q && typeof q === 'object'){ q.el = el; if(life) q.life = life; } }

// ---- first-time tips in a battle: in a lull only, at most perBattle a battle ----
export function uxTipOk(urgent){ const T = HUDUX.tips, t = now(); if(UX.runId !== S.runId){ UX.runId = S.runId; UX.tips = 0; UX.hitAt = t; }
  if(UX.tips >= T.perBattle || S.mode !== 'playing') return false; if(t < UX.tipChk) return UX.tipOk && (urgent || UX.tipLull); UX.tipChk = t + 0.25;   // (asked every frame while a note waits: judged 4× a second)
  const p = S.player; let ok = !!p && t - UX.hitAt >= T.quietS && p.hp >= T.hpMin * (p.maxHp || 1) && !(DIR.on && DIR.P > T.pressMax);   // HUDUX 4 a real lull: no hit for quietS s, health up, the pressure low, nobody near
  if(ok){ const r2 = T.nearR * T.nearR; for(const e of enemies){ if(e.hp > 0 && !e.abandoned){ const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; if(dx * dx + dz * dz < r2){ ok = false; break; } } } }
  UX.tipOk = ok; UX.tipLull = !T.lullOnly || !DIR.on || DIR.phase === 'release'; return ok && (urgent || UX.tipLull); }
export function uxTipShown(){ UX.tips++; }

// ---- the leaderboard: a name that reads as a test is not shown; a test / bot / automation run never posts ----
export function uxBoardHidden(name){ const B = HUDUX.board, n = String(name || '').trim(); return n.length <= B.minLen || B.rx.test(n); }
export function uxDevRun(){ const B = HUDUX.board; if(typeof location !== 'undefined' && B.query.test(location.search)) return true;
  if(typeof navigator !== 'undefined' && navigator.webdriver) return true; return uxBoardHidden(PROFILE.nickname || 'x'); }

// ---- CHƠI NGAY: straight into the next fort (the kit last chosen, the deployment remembered) ----
export function uxPlayNow(){ if(!HUDUX.quickPlay) return false; try{ const q = conqStore(); if(!q) return false; const i = q.cap >= 10 ? Math.max(0, Math.min(9, q.sel | 0)) : q.cap; UX.quick = true; if(conqLaunch(i, true)) return true; }catch(e){} UX.quick = false; return false; }   // HUDUX 5 all ten taken: the fort last picked, again
// the briefing asks: was it a quick start? then it goes on by itself (once)
export function uxQuickGo(){ if(!UX.quick) return false; UX.quick = false; return true; }

// ---- a briefing's long paragraph (8 lines in a block): the first two sentences stay as its lead, the rest become up to four points ----
export function uxBriefTidy(el){ if(!el || typeof document === 'undefined') return; const prev = el.querySelector('.br-prev'), tx = [...el.childNodes].filter(n => n !== prev).map(n => n.textContent).join('').trim();
  if(tx.length < 240) return; const S0 = tx.split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ỹ“"])/u).filter(Boolean); if(S0.length < 4) return;
  const lead = document.createElement('span'), ul = document.createElement('ul'); lead.className = 'hux-lead'; lead.textContent = S0.slice(0, 2).join(' '); ul.className = 'hux-pts';
  const rest = S0.slice(2), per = Math.ceil(rest.length / 4); for(let i = 0; i < rest.length; i += per){ const li = document.createElement('li'); li.textContent = rest.slice(i, i + per).join(' '); ul.appendChild(li); }
  el.replaceChildren(...(prev ? [prev] : []), lead, ul); }

// ---- the pause screen's right half: where the battle stands — the sector, its goal, the map, the gun (it was empty) ----
let _pz = false;
function pauseSide(){ const el = document.getElementById('pauseSide'), pz = document.getElementById('pause'), open = !!(el && pz && !pz.classList.contains('hidden')); if(!open){ _pz = false; return; } if(_pz) return; _pz = true;
  const T = (id, sel) => { const e = document.getElementById(id); const q = e && (sel ? e.querySelector(sel) : e); return q ? q.textContent.trim().replace(/\s+/g, ' ') : ''; };
  const sec = SECT.on && SECT.list && SECT.list.length ? 'Khu ' + (SECT.i + 1) + '/' + SECT.list.length + ' · ' + ((SECT.list[SECT.i] || {}).vi || '') : '';
  const goal = T('secRail', '.sr-g') || T('objChip', '.ob-name') || T('sideChip', '.sc-name'), gun = (() => { const n = document.querySelector('#weaponchip .wc-nm'); return n && n.firstChild ? n.firstChild.textContent.trim() : ''; })(), am = T('weaponchip', '.wc-am'), hp = S.player && S.player.maxHp ? Math.round(100 * S.player.hp / S.player.maxHp) : null;
  const row = (k, v) => v ? '<div class="pz-r"><small>' + k + '</small><b>' + escapeHtml(v) + '</b></div>' : '';
  el.innerHTML = '<p class="pz-k">Tình hình</p><h3 class="pz-t">' + escapeHtml(battleTitle() || biomeVi(BIOME.name)) + '</h3>' + row('Khu vực', sec) + row('Mục tiêu', goal) + row('Súng', gun + (am ? ' · ' + am : '')) + row('Máu', hp != null ? hp + '%' : '')
    + '<canvas class="pz-map" width="200" height="200"></canvas>';
  const cv = el.querySelector('canvas'); try{ if(UX.map) cv.getContext('2d').drawImage(UX.map, 0, 0, 200, 200); else cv.parentNode.removeChild(cv); }catch(e){} }
// the radar as it last was in the fight (the pause screen's map: the live one is cleared once the battle stops)
function mapSnap(){ const src = document.getElementById('radar'); if(!src || !src.width) return; if(!UX.map){ UX.map = document.createElement('canvas'); UX.map.width = UX.map.height = 200; }
  try{ const x = UX.map.getContext('2d'); x.clearRect(0, 0, 200, 200); x.drawImage(src, 0, 0, 200, 200); }catch(e){} }

// ---- HUDUX 4 one caption at a time: a spoken line's subtitle that would sit on the radio's text waits (hidden) until the radio is done ----
function subQueue(){ const v = document.getElementById('voiceSub'), r = document.getElementById('radio'); if(!v) return;
  let hold = false; if(r && r.classList.contains('show') && +v.style.opacity > 0.05){ const a = v.getBoundingClientRect(), b = r.getBoundingClientRect(); hold = a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
  v.classList.toggle('hux-subhold', hold); }

// ---- HUDUX 5 THE GOAL MARKER: a diamond and the metres to the sector's goal, pinned on the screen over it (or on the safe frame's edge with an arrow toward it) ----
//   The goal is the sector's own world mark (campaign/sector-goals.js SGOAL.marks: 0 the thing to reach / free / break, 1 the ring to stand in or the general's arena),
//   the first one up. NOCENTER: inside the aim zone it is a tiny tick with no words. (Called every frame by ui/squad-hud.js updateSquadHud.)
const _gv = { x:0, y:0, z:0 }, _ga = { x:0, z:0, col:'', i:0 }; let _gEl = null;   // (reused: no allocation a frame)
function goalEl(){ if(_gEl && _gEl.isConnected) return _gEl; const d = _gEl = document.createElement('div'); d.id = 'huxGoal'; d.className = 'hidden'; d.setAttribute('aria-hidden', 'true');
  d.innerHTML = '<s class="hg-p"></s><s class="hg-p hg-p2"></s><i class="hg-d"></i><b class="hg-m"></b><em class="hg-a"></em>'; document.body.appendChild(d); d._m = d.children[3]; d._a = d.children[4]; d._t = ''; d._k = ''; d._pt = 0; d._pd = 1e9; return d; }
// HUDUX 6 a ping (two rings, 0.6 s): restarted by toggling the class
function goalPing(d){ d.classList.remove('ping'); void d.offsetWidth; d.classList.add('ping'); }
export function uxGoalAt(){ const L = SGOAL.marks; if(!L) return null; for(let i = 0; i < L.length; i++){ const M = L[i]; if(M && M.badge && M.badge.visible){ if(M._hk !== M.icon){ M._hk = M.icon; const c = /#[0-9a-f]{6}$/i.exec(M.icon || ''); M._hc = c ? c[0] : '#ffd27a'; } _ga.x = M.badge.position.x; _ga.z = M.badge.position.z; _ga.col = M._hc; _ga.i = i; return _ga; } } return null; }
export function uxGoalTick(){ if(typeof document === 'undefined' || !HUDUX.goal.on) return; const d = goalEl(), p = S.player, g = S.mode === 'playing' && p && SECT.on ? uxGoalAt() : null;
  if(!g){ if(!d.classList.contains('hidden')) d.classList.add('hidden'); return; } const G = HUDUX.goal, F = MOBILE ? G.touch : G.desk, w = innerWidth, h = innerHeight;
  _gv.x = g.x; _gv.z = g.z; _gv.y = heightAt(g.x, g.z) + G.y; const s = worldToScreen(_gv), dist = Math.hypot(g.x - p.pos.x, g.z - p.pos.z);
  let x = s.x, y = s.y, off = !s.infront || x < F.left || x > w - F.right || y < F.top || y > h - F.bottom, a = 0;
  if(off){ let dx = x - w / 2, dy = y - h / 2; if(!s.infront){ dx = -dx; dy = -dy; } if(Math.abs(dx) + Math.abs(dy) < 1) dy = 1;   // (behind the lens the projection is mirrored)
    const hx = (dx > 0 ? w - F.right : F.left) - w / 2, hy = (dy > 0 ? h - F.bottom : F.top) - h / 2, k = Math.min(Math.abs(hx / dx), Math.abs(hy / dy)); x = w / 2 + dx * k; y = h / 2 + dy * k; a = Math.atan2(dy, dx); }
  if(x > w - F.radar[0] && y < F.radar[1]) y = F.radar[1];   // HUDUX 6 never on the minimap: just under its corner
  const tick = !off && (dist < G.near || ncHit(x - 24, y - 10, x + 24, y + 22)), cls = 'hux-goal' + (off ? ' off' : '') + (tick ? ' tick' : '');
  if(d.className.replace(' ping', '') !== cls) d.className = cls + (d.classList.contains('ping') ? ' ping' : ''); d.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)'; d.style.setProperty('--gc', g.col); if(off) d._a.style.transform = 'rotate(' + a.toFixed(3) + 'rad)';
  const t = tick ? '' : Math.round(dist) + ' m'; if(d._t !== t){ d._t = t; d._m.textContent = t; }
  const key = g.i + ':' + Math.round(g.x) + ':' + Math.round(g.z), now = performance.now() / 1000, P = G.ping;   // HUDUX 6 a new goal → a ping; then every P.every s while he has not come P.gain m nearer
  if(d._k !== key){ d._k = key; d._pt = now; d._pd = dist; if(!tick) goalPing(d); } else if(now - d._pt >= P.every){ if(dist > d._pd - P.gain && !tick) goalPing(d); d._pt = now; d._pd = dist; } }

// ---- HUDUX 5 a fort's opening lines after the first card: on the radio, one every opening.radioGap s, while he is already fighting (the same run only) ----
export function uxStoryRest(lines, from, seq){ if(!lines || from >= lines.length) return; let k = from; const step = () => { if(SECT.seq !== seq || k >= lines.length) return; if(S.mode === 'playing'){ sectorStoryRadio(lines[k++]); } setTimeout(step, HUDUX.opening.radioGap * 1000); };
  setTimeout(step, 1200); }

// ---- the clock ----
function tick(){ if(typeof document === 'undefined' || !document.body) return; const b = document.body, play = PLAY.has(S.mode);
  b.classList.toggle('hux-play', play); b.classList.toggle('hux-sect', !!(SECT.on || CQ.on)); b.classList.toggle('hux-nostage', !!(S.run && S.run.mode !== 'campaign'));   /* HUDUX 4 a custom / mixer / mode battle has no campaign stage to number */ pauseSide(); subQueue(); if(S.mode === 'playing' && ++UX.k % 4 === 0) mapSnap();
  const p = S.player; if(p && p.hp < UX.hp0 - 0.01){ UX.hitAt = now(); if(_tipOpen && play) closeTip(true); }   // (a note still up when the shooting starts goes away) if(p) UX.hp0 = p.hp;   // HUDUX 4 the last hit he took (the tips wait quietS s after it)
  if(play && p && p.maxHp){ const k = Math.max(0, Math.min(1, p.hp / p.maxHp)); b.style.setProperty('--hux-hurt', (1 - 0.55 * k).toFixed(2)); } }
if(typeof setInterval === 'function' && typeof document !== 'undefined') UX.iv = setInterval(() => { try{ tick(); }catch(e){} }, 250);
