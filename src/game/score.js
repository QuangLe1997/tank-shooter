// game/score.js — SCORE / COMBO
import { S, floatText, updateHUD } from '../hub.js';

// ----------------------------- SCORE / COMBO -----------------------------
export function comboMult(){ return Math.min(8, 1 + Math.floor(S.combo/2)); }
export function bumpCombo(){ S.combo++; S.comboUntil = performance.now()/1000 + 3;
  const m=comboMult(); const el=document.getElementById('combo');
  if(m>1){ el.textContent='LIÊN HOÀN ×'+m; el.classList.remove('long'); el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.15)';
    setTimeout(()=>{el.style.transform='translateX(-50%) scale(1)';},90); } }
export function addScore(base, worldPos){
  const pts = Math.round(base * comboMult());
  S.score += pts;
  floatText('+'+pts, '#e7b54a', worldPos, 18);
  updateHUD();
}
