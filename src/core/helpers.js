// core/helpers.js — shared helpers: control scheme + tank input → move direction, main HUD refresh, world-space HP bars
import * as THREE from 'three';
import { MOBILE, PAD, PROFILE, S, STICK_R, TANK_SCALE, _camUP, core, move, worldToScreen } from '../hub.js';

// ----------------------------- HELPERS -----------------------------
export function getMoveDir(){
  const d = new THREE.Vector3();
  if(PAD.active && (PAD.lx || PAD.ly)){ d.set(PAD.lx, 0, PAD.ly); if(d.lengthSq()>1) d.normalize(); if(S.camYaw) d.applyAxisAngle(_camUP, S.camYaw); return d; }   // Z117 left stick (analogue: half-tilt = half power)
  if(MOBILE){
    if(move.id!==null){ d.set(move.x, 0, move.y); if(d.length()>STICK_R) d.setLength(STICK_R); d.divideScalar(STICK_R);
      if(S.camYaw) d.applyAxisAngle(_camUP, S.camYaw); }   // keep stick screen-relative when the view is rotated
  } else {
    if(S.keys['w']||S.keys['arrowup']) d.z-=1;
    if(S.keys['s']||S.keys['arrowdown']) d.z+=1;
    if(S.keys['a']||S.keys['arrowleft']) d.x-=1;
    if(S.keys['d']||S.keys['arrowright']) d.x+=1;
    if(d.lengthSq()>1) d.normalize();
    if(S.camYaw && d.lengthSq()>0) d.applyAxisAngle(_camUP, S.camYaw);   // Z99 fix: keys stay screen-relative when the view is rotated
  }
  return d;
}
// Z99 CONTROL SCHEMES — 'tank': W/S throttle along the hull, A/D rotate the hull (the driver's left/right), mouse aims the turret.
//                       'screen': push the direction you want to go on screen; the hull turns to it (joystick default).
export function controlScheme(){ const c=PROFILE.ctrl; return c==='tank'||c==='screen' ? c : 'screen'; }   // Z107: SCREEN-relative is the default on every device
export function tankInput(){                                    // → { thr: -1..1 (forward +), turn: -1..1 (driver's LEFT +) }
  let thr=0, turn=0;
  if(PAD.active && (PAD.lx || PAD.ly)) return { thr:-PAD.ly, turn:-PAD.lx };   // Z117 left stick: up = throttle, sideways = turn
  if(MOBILE){ if(move.id!==null){ const L=Math.max(STICK_R*0.15, Math.hypot(move.x,move.y)); thr=Math.max(-1,Math.min(1,-move.y/STICK_R)); turn=Math.max(-1,Math.min(1,-move.x/STICK_R)); if(Math.abs(thr)<0.12) thr=0; if(Math.abs(turn)<0.12) turn=0; } }
  else { if(S.keys['w']||S.keys['arrowup']) thr+=1; if(S.keys['s']||S.keys['arrowdown']) thr-=1;
    if(S.keys['a']||S.keys['arrowleft']) turn+=1; if(S.keys['d']||S.keys['arrowright']) turn-=1; }
  return { thr, turn };
}
export function updateHUD(){
  document.getElementById('ui-score').textContent = S.score.toLocaleString();
  document.getElementById('ui-stage').textContent = S.stage;
  document.getElementById('ui-wave').textContent = S.wave;
  const p=S.player; if(p){
    document.getElementById('ui-hp').style.width = Math.max(0,p.hp/p.maxHp*100)+'%';
    document.getElementById('lives').textContent = '×'+Math.max(0,p.lives);
  }
  if(core) document.getElementById('ui-core').style.width = Math.max(0, core.hp/core.maxHp*100)+'%';
}
// world-attached HP bars: project the tank + core monument to screen each frame so a small bar rides right on them
export const _wbV = new THREE.Vector3();
export let _phpBar=null,_phpFill=null,_phpLives=null,_chpBar=null,_chpFill=null;
export const _hpGrad =f=> f>0.5 ? 'linear-gradient(90deg,#3fa84a,#7fe06a)' : f>0.25 ? 'linear-gradient(90deg,#c79434,#ffcf5a)' : 'linear-gradient(90deg,#c0392b,#ff6a52)';
export const _coreGrad=f=> f>0.3 ? 'linear-gradient(90deg,#b07a2c,#ffc24e)' : 'linear-gradient(90deg,#c0392b,#ff7a52)';
// Z107: every write is cached — the bars used to re-set left/top/width/background/text on every frame (a style recalc each frame);
// now position moves through transform (compositor-only) and the rest is written only when it actually changes.
export const _WB = { p:{ d:'', t:'', w:'', g:'', l:'', low:null }, c:{ d:'', t:'', w:'', g:'', low:null } };
export function _wbSet(el, fill, C, s, f, grad, lowAt){
  if(!s){ if(C.d!=='none'){ C.d='none'; el.style.display='none'; } return; }
  if(C.d!=='block'){ C.d='block'; el.style.display='block'; el.style.left='0px'; el.style.top='0px'; }
  const t='translate3d('+Math.round(s.x)+'px,'+Math.round(s.y)+'px,0) translate(-50%,-50%)'; if(t!==C.t){ C.t=t; el.style.transform=t; }
  const w=Math.max(0,Math.round(f*100))+'%'; if(w!==C.w){ C.w=w; fill.style.width=w; }
  const g=grad(f); if(g!==C.g){ C.g=g; fill.style.background=g; }
  const low=f<=lowAt; if(low!==C.low){ C.low=low; el.classList.toggle('low', low); } }
export function updateWorldBars(){
  if(!_phpBar){ _phpBar=document.getElementById('phpbar'); _phpFill=_phpBar.querySelector('i'); _phpLives=document.getElementById('phpLives');
                _chpBar=document.getElementById('chpbar'); _chpFill=_chpBar.querySelector('i'); }
  const p=S.player;
  if(p && p.hp>0){
    const f=p.hp/p.maxHp, sc=p.scale*TANK_SCALE, s=worldToScreen(_wbV.set(p.pos.x, 3.7*sc, p.pos.z));   // float clearly above the turret
    _wbSet(_phpBar, _phpFill, _WB.p, s.infront?s:null, f, _hpGrad, 0.25);
    if(s.infront){ const l='×'+Math.max(0,p.lives); if(l!==_WB.p.l){ _WB.p.l=l; _phpLives.textContent=l; } }
  } else _wbSet(_phpBar, _phpFill, _WB.p, null);
  if(core && core.hp>0){
    const f=core.hp/core.maxHp, s=worldToScreen(_wbV.set(core.pos.x, 7.8, core.pos.z));                 // float above the monument crystal
    _wbSet(_chpBar, _chpFill, _WB.c, s.infront?s:null, f, _coreGrad, 0.3);
  } else _wbSet(_chpBar, _chpFill, _WB.c, null);
}
