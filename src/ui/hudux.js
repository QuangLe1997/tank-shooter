// ui/hudux.js — HUDUX the critic's HUD / UI-UX round 1: one small clock (4×/s) that keeps the battle HUD honest, and the rules other modules ask.
//   · body classes the stylesheet (css/hudux.css) lays the HUD out by: hux-play (a battle is on screen: its buttons may show), hux-sect (a battle of
//     sectors: the top bar shows the sector, not MÀN / ĐỢT), --hux-hurt (the hurt edge deepens as health falls, 0.45 → 1);
//   · the text diet (uxNote): at most HUDUX.notes.max worded notes on screen at once, the same words not twice within dedupe s, lines with no action dropped;
//   · tips only in a lull and at most perBattle a battle (uxTipOk); the leaderboard's test names (uxBoardHidden) and a test run never posting (uxDevRun);
//   · CHƠI NGAY = one click to the next fort (uxPlayNow), the briefing then goes on by itself (uxQuickGo).
import { HUDUX } from '../../config.js';
import { BIOME, CQ, DIR, PROFILE, S, SECT, battleTitle, biomeVi, conqLaunch, conqStore, escapeHtml } from '../hub.js';

export const UX = { k:0, map:null, tips:0, runId:null, notes:[], quick:false, dropped:0, capped:0, iv:0 };
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
export function uxTipOk(urgent){ const T = HUDUX.tips; if(UX.runId !== S.runId){ UX.runId = S.runId; UX.tips = 0; }
  if(UX.tips >= T.perBattle) return false; if(!urgent && T.lullOnly && DIR.on && DIR.phase !== 'release') return false; return true; }
export function uxTipShown(){ UX.tips++; }

// ---- the leaderboard: a name that reads as a test is not shown; a test / bot / automation run never posts ----
export function uxBoardHidden(name){ const B = HUDUX.board, n = String(name || '').trim(); return n.length <= B.minLen || B.rx.test(n); }
export function uxDevRun(){ const B = HUDUX.board; if(typeof location !== 'undefined' && B.query.test(location.search)) return true;
  if(typeof navigator !== 'undefined' && navigator.webdriver) return true; return uxBoardHidden(PROFILE.nickname || 'x'); }

// ---- CHƠI NGAY: straight into the next fort (the kit last chosen, the deployment remembered) ----
export function uxPlayNow(){ if(!HUDUX.quickPlay) return false; try{ const q = conqStore(); if(!q || q.cap >= 10) return false; UX.quick = true; if(conqLaunch(q.cap, true)) return true; }catch(e){} UX.quick = false; return false; }
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

// ---- the clock ----
function tick(){ if(typeof document === 'undefined' || !document.body) return; const b = document.body, play = PLAY.has(S.mode);
  b.classList.toggle('hux-play', play); b.classList.toggle('hux-sect', !!(SECT.on || CQ.on)); pauseSide(); if(S.mode === 'playing' && ++UX.k % 4 === 0) mapSnap();
  const p = S.player; if(play && p && p.maxHp){ const k = Math.max(0, Math.min(1, p.hp / p.maxHp)); b.style.setProperty('--hux-hurt', (1 - 0.55 * k).toFixed(2)); } }
if(typeof setInterval === 'function' && typeof document !== 'undefined') UX.iv = setInterval(() => { try{ tick(); }catch(e){} }, 250);
