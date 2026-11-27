// ui/sector-hud.js — SECTOR 1 what a sector run shows (css/sector.css): THE RAIL — one small line at the top of the HUD, "1 NGOẠI VI › 2 CẦU › 3 TƯỚNG", the
//   sectors behind ticked off, the one in hand lit, a clock beside it when its goal has one (the menus' step rail, at HUD size; a phone shows only the one in hand
//   by name) — and THE TRANSIT: letterbox bars, a black that fades in over the old field and out over the new one, the place and the goal in the middle, the radio
//   underneath one line at a time. Pure DOM, made once, changed only when what it says changes (the frame calls it every frame).
//   SECTOR 4 the rail's tail: the battle's carried consequences as small icons (green good, red bad) and the sector's event card as a chip; and THE FORK CARD in the
//   transit (a menu moment: the fight is stopped and under the black, so it stands in the middle) — two routes, tap / click / pad / keys 1·2, a clock to the default pick.
import { svgMarkup } from '../hub.js';   // SECTOR 4
let _rail = null, _railSig = '', _tr = null, _trLine = '', _main = null, _cons = null, _chip = null;
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
function railEl(){ if(_rail || typeof document === 'undefined') return _rail; const hud = document.getElementById('hud'); if(!hud) return null;
  _rail = document.createElement('div'); _rail.id = 'secRail'; _rail.className = 'hidden'; _rail.setAttribute('aria-hidden', 'true');
  _rail.innerHTML = '<span class="sr-m"></span><span class="sr-x hidden"></span><span class="sr-c hidden"></span>'; _main = _rail.firstChild; _cons = _main.nextSibling; _chip = _cons.nextSibling; hud.appendChild(_rail); return _rail; }   // (SECTOR 4 the steps, the icons, the chip)
// list: [{ vi }] · i: the sector in hand · clock: '' or "3:40" (its goal's time left) · sub: '' or the objective's line (SECTOR 2) · null list: the rail goes
export function sectorRail(list, i, clock, sub){ const el = railEl(); if(!el) return; sub = sub || '';
  if(!list){ if(_railSig){ _railSig = ''; el.classList.add('hidden'); _main.replaceChildren(); } return; }
  const sig = i + '|' + clock + '|' + list.length + '|' + sub; if(sig === _railSig) return; const same = _railSig && _railSig.split('|')[0] === String(i) && _railSig.split('|')[2] === String(list.length); _railSig = sig;
  if(same){ const t = _main.querySelector('.sr-t'), g = _main.querySelector('.sr-g'); if(t && g){ t.textContent = clock || ''; t.classList.toggle('hidden', !clock); g.textContent = sub; g.classList.toggle('hidden', !sub); return; } }
  _main.innerHTML = list.map((s, k) => (k ? '<i></i>' : '') + '<span class="sr-s' + (k < i ? ' done' : k === i ? ' on' : '') + '"><b>' + (k + 1) + '</b><span>' + esc(s.vi) + '</span></span>').join('') +
    '<em class="sr-t' + (clock ? '' : ' hidden') + '">' + esc(clock) + '</em><u class="sr-g' + (sub ? '' : ' hidden') + '">' + esc(sub) + '</u>';
  el.classList.remove('hidden'); }
function trEl(){ if(_tr || typeof document === 'undefined') return _tr; const d = document.createElement('div'); d.id = 'secTransit'; d.setAttribute('aria-hidden', 'true');
  d.innerHTML = '<div class="st-bar st-top"></div><div class="st-bar st-bot"></div><div class="st-black"></div><div class="st-card"><p class="st-kick"></p><h3 class="st-ttl"></h3><p class="st-goal"></p></div><p class="st-line"></p>';
  document.body.appendChild(d); _tr = { d, black:d.querySelector('.st-black'), kick:d.querySelector('.st-kick'), ttl:d.querySelector('.st-ttl'), goal:d.querySelector('.st-goal'), line:d.querySelector('.st-line') }; return _tr; }
// the transit's overlay: o = { kick, ttl, goal } (on) · null (off: bars out, black off, the HUD back)
export function sectorTransitShow(o){ const T = trEl(); if(!T) return;
  if(!o){ T.d.classList.remove('on', 'black'); document.body.classList.remove('sectx'); _trLine = ''; T.line.classList.remove('on'); return; }
  T.kick.textContent = o.kick || ''; T.ttl.textContent = o.ttl || ''; T.goal.textContent = o.goal || ''; T.d.classList.add('on'); document.body.classList.add('sectx'); }
// the black over the field (fades in / out by CSS, `fade` s)
export function sectorTransitBlack(on, fade){ const T = trEl(); if(!T) return; if(fade != null) T.black.style.transitionDuration = fade + 's'; T.d.classList.toggle('black', !!on); }
// one radio line under the card ('' clears it)
export function sectorTransitLine(t){ const T = trEl(); if(!T || t === _trLine) return; _trLine = t; T.line.classList.remove('on'); void T.line.offsetWidth; T.line.textContent = t || ''; if(t) T.line.classList.add('on'); }
// dev / probes: what is on show
export function sectorHudShown(){ return { rail:!!(_rail && !_rail.classList.contains('hidden')), railTx:_rail ? _rail.textContent : '', transit:!!(_tr && _tr.d.classList.contains('on')), black:!!(_tr && _tr.d.classList.contains('black')), line:_trLine }; }

// SECTOR 4 the carried consequences: [{ id, vi, tx, icon, good }] (null / empty: none)
let _consSig = '';
export function sectorRailCons(L){ if(!railEl()) return; const sig = L && L.length ? L.map(c => c.id).join(',') : ''; if(sig === _consSig) return; _consSig = sig;
  _cons.classList.toggle('hidden', !sig); _cons.innerHTML = sig ? L.map(c => '<i class="' + (c.good ? 'ok' : 'bad') + '" title="' + esc(c.vi + ' — ' + c.tx) + '" data-c="' + esc(c.id) + '">' + svgMarkup(c.icon, 2) + '</i>').join('') : ''; }
// SECTOR 4 the sector's event card as a chip: { vi, tx, icon, good } · null: none
export function sectorEventChip(o){ if(!railEl()) return; if(!o){ _chip.classList.add('hidden'); _chip.dataset.k = ''; return; }
  _chip.className = 'sr-c ' + (o.good ? 'ok' : 'bad'); _chip.dataset.k = o.vi; _chip.title = o.tx; _chip.innerHTML = svgMarkup(o.icon, 2) + '<b>' + esc(o.vi) + '</b>'; }
// SECTOR 4–5 THE FORK CARD — a decision moment on a full backdrop: two big selection cards of the ui-kit (corner brackets on hover / focus, ✓ when picked), each the
//   land's own picture tinted per route with the mission's icon, the place small, the mission big, ★ difficulty, the reward in amber, the consequence in red (or cyan when
//   there is none to fear), the key; under them the default route's clock as a draining bar.
//   o = { kick, ttl, routes:[{ place, ttl, diff, reward, cons, bad, icon, img, hue }], def, auto, frac, onPick(k) } · (o, true) = update { auto, frac } or { picked:k } · null = gone
let _fk = null, _fkKey = null;
export function sectorForkCard(o, part){ const T = trEl(); if(!T) return;
  if(!_fk){ _fk = document.createElement('div'); _fk.className = 'st-fork overlay hidden'; T.d.appendChild(_fk); }
  if(!o){ _fk.classList.add('hidden'); _fk.replaceChildren(); if(_fkKey){ removeEventListener('keydown', _fkKey, true); _fkKey = null; } return; }
  if(part){ if(o.picked != null){ for(const el of _fk.querySelectorAll('.sf-r')) el.classList.toggle('on', +el.dataset.k === o.picked); _fk.classList.add('done'); return; }
    const a = _fk.querySelector('.sf-auto'); if(a && a.textContent !== o.auto) a.textContent = o.auto; const b = _fk.querySelector('.sf-bar i'); if(b) b.style.transform = 'scaleX(' + o.frac.toFixed(3) + ')'; return; }
  _fk.innerHTML = '<div class="sf-in"><p class="sf-kick">' + esc(o.kick) + '</p><h3 class="sf-ttl">' + esc(o.ttl) + '</h3><div class="sf-row">' + o.routes.map((r, k) =>
    '<div class="sf-r' + (k === o.def ? ' def' : '') + '" data-pad data-k="' + k + '" role="button" tabindex="0" style="--sf-h:' + r.hue + '">' +
      '<div class="sf-img" style="background-image:linear-gradient(180deg,transparent 30%,rgba(9,11,8,.92)),linear-gradient(var(--sf-h),var(--sf-h)),url(' + r.img + ')"><span class="sf-ic">' + svgMarkup(r.icon, 1.8) + '</span>' +
      '<em>' + (k ? 'B' : 'A') + '</em><small>' + esc(r.place) + '</small></div>' +
      '<div class="sf-body"><b>' + esc(r.ttl) + '</b><span class="sf-d"><i>' + '★'.repeat(r.diff) + '</i><s>' + '★'.repeat(Math.max(0, 3 - r.diff)) + '</s>' + (k === o.def ? '<u>mặc định</u>' : '') + '</span>' +
      '<span class="sf-l rw"><u>Phần thưởng</u>' + esc(r.reward) + '</span><span class="sf-l ' + (r.bad ? 'bad' : 'safe') + '"><u>Hệ quả</u>' + esc(r.cons) + '</span></div>' +
      '<kbd>' + (k + 1) + '</kbd></div>').join('') +
    '</div><div class="sf-bar"><i></i></div><p class="sf-auto">' + esc(o.auto) + '</p></div>';
  _fk.classList.remove('hidden', 'done');
  for(const el of _fk.querySelectorAll('.sf-r')) el.addEventListener('click', () => o.onPick(+el.dataset.k));
  if(_fkKey) removeEventListener('keydown', _fkKey, true);
  _fkKey = e => { if(e.key === '1' || e.key === '2'){ e.preventDefault(); e.stopPropagation(); o.onPick(+e.key - 1); } else if(e.key === 'Enter'){ const f = _fk.querySelector('.sf-r.padfocus, .sf-r:focus'); if(f){ e.preventDefault(); o.onPick(+f.dataset.k); } } };
  addEventListener('keydown', _fkKey, true); try{ if(document.pointerLockElement) document.exitPointerLock(); }catch(e){} }
export const sectorForkShown = () => !!(_fk && !_fk.classList.contains('hidden'));
