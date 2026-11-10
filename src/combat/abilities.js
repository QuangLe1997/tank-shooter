// combat/abilities.js — ABILITIES (stubs filled in later phases)
import { PLAYER, S, controlScheme, getMoveDir, sfx, spawnPart, tankInput } from '../hub.js';

// ----------------------------- ABILITIES (stubs filled in later phases) -----------------------------
export function tryDash(){
  if(S.mode!=='playing') return; const p=S.player, now=performance.now()/1000;
  if(now < p.dashCdUntil) return;
  // dash along current move intent, else along facing
  let dir;
  if(controlScheme()==='tank'){ const back = tankInput().thr < -0.1 ? -1 : 1; dir=getMoveDir().set(Math.sin(p.facing)*back,0,Math.cos(p.facing)*back); }   // Z99: dash along the hull (back if reversing)
  else { dir = getMoveDir(); if(dir.lengthSq()<0.01){ dir.set(Math.sin(p.facing),0,Math.cos(p.facing)); } }
  p.dashDir.copy(dir).normalize();
  p.dashUntil = now + PLAYER.dashTime;
  p.dashCdUntil = now + PLAYER.dashCd * p.dashCdMul;
  p.invincibleUntil = now + PLAYER.dashIframe;
  sfx('dash');
  for(let i=0;i<6;i++) spawnPart(p.pos.x,0.6,p.pos.z, -p.dashDir.x*8+(Math.random()-0.5)*4, 1, -p.dashDir.z*8+(Math.random()-0.5)*4, {color:0xcfe6a0,size:1.1,life:0.3,grav:-2,drag:3,smoke:true,op:0.5});
}
