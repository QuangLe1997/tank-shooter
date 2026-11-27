// ui/sector-hud.js — SECTOR 1 what a sector run shows (css/sector.css): THE RAIL — one small line at the top of the HUD, "1 NGOẠI VI › 2 CẦU › 3 TƯỚNG", the
//   sectors behind ticked off, the one in hand lit, a clock beside it when its goal has one (the menus' step rail, at HUD size; a phone shows only the one in hand
//   by name) — and THE TRANSIT: letterbox bars, a black that fades in over the old field and out over the new one, the place and the goal in the middle, the radio
//   underneath one line at a time. Pure DOM, made once, changed only when what it says changes (the frame calls it every frame).
let _rail = null, _railSig = '', _tr = null, _trLine = '';
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
function railEl(){ if(_rail || typeof document === 'undefined') return _rail; const hud = document.getElementById('hud'); if(!hud) return null;
  _rail = document.createElement('div'); _rail.id = 'secRail'; _rail.className = 'hidden'; _rail.setAttribute('aria-hidden', 'true'); hud.appendChild(_rail); return _rail; }
// list: [{ vi }] · i: the sector in hand · clock: '' or "3:40" (its goal's time left) · sub: '' or the objective's line (SECTOR 2) · null list: the rail goes
export function sectorRail(list, i, clock, sub){ const el = railEl(); if(!el) return; sub = sub || '';
  if(!list){ if(_railSig){ _railSig = ''; el.classList.add('hidden'); el.replaceChildren(); } return; }
  const sig = i + '|' + clock + '|' + list.length + '|' + sub; if(sig === _railSig) return; const same = _railSig && _railSig.split('|')[0] === String(i) && _railSig.split('|')[2] === String(list.length); _railSig = sig;
  if(same){ const t = el.querySelector('.sr-t'), g = el.querySelector('.sr-g'); if(t && g){ t.textContent = clock || ''; t.classList.toggle('hidden', !clock); g.textContent = sub; g.classList.toggle('hidden', !sub); return; } }
  el.innerHTML = list.map((s, k) => (k ? '<i></i>' : '') + '<span class="sr-s' + (k < i ? ' done' : k === i ? ' on' : '') + '"><b>' + (k + 1) + '</b><span>' + esc(s.vi) + '</span></span>').join('') +
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
