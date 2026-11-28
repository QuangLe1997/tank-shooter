// game/score.js — SCORE / COMBO
import { BAL, HUDCLEAN2 } from '../../config.js';
import { S, updateHUD } from '../hub.js';

// ----------------------------- SCORE / COMBO -----------------------------
// HUDCLEAN 2 the combo is a small "×N" hung on the score bar's right edge, with the last "+240" (or a kill word: HẠ TỐP TRƯỞNG) under it for a moment —
//   no LIÊN HOÀN banner over the view, no +score pop over the enemy. comboTick (game/loop.js) hides it once the combo ran out and the line is old.
let _sc=null, _lnT=0, _m=1;
function chip(){ if(_sc && _sc.isConnected) return _sc; if(typeof document==='undefined') return null; const tb=document.getElementById('topbar'); if(!tb) return null;
  _sc=document.createElement('div'); _sc.id='scoreChip'; _sc.innerHTML='<b></b><span></span>'; tb.appendChild(_sc); return _sc; }
export function scoreNote(text, col){ const c=chip(); if(!c) return; const s=c.lastChild; s.textContent=text; s.style.color=col||''; c.classList.add('on');
  c.classList.remove('fl'); void c.offsetWidth; c.classList.add('fl'); _lnT=performance.now()/1000+HUDCLEAN2.combo.lineT; }
export function comboTick(now){ if(!_sc) return; const m=comboMult(); if(m!==_m){ _m=m; _sc.firstChild.textContent=m>1 ? '×'+m : ''; }
  if(m<=1 && now>_lnT && _sc.classList.contains('on')){ _sc.classList.remove('on'); _sc.lastChild.textContent=''; } }
export function comboMult(){ return Math.min(BAL.score.comboMax, 1 + Math.floor(S.combo/2)); }   // BAL 7 (was up to ×8: the score ran into six figures in five minutes)
export function bumpCombo(){ S.combo++; S.comboUntil = performance.now()/1000 + 3;
  const m=comboMult(), c=chip(); if(c && m>1){ _m=m; c.firstChild.textContent='×'+m; c.classList.add('on'); } }
export function addScore(base, worldPos){   // (worldPos: where it was earned — no longer drawn there)
  const pts = Math.round(base * comboMult());
  S.score += pts;
  scoreNote('+'+pts);
  updateHUD();
}
