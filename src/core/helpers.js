// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { MOBILE, PROFILE, S, STICK_R, TANK_SCALE, _camUP, core, move, worldToScreen } from '../hub.js';

// ----------------------------- HELPERS -----------------------------
export function getMoveDir(){
  const d = new THREE.Vector3();
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
export function controlScheme(){ const c=PROFILE.ctrl; return c==='tank'||c==='screen' ? c : (MOBILE ? 'screen' : 'tank'); }
export function tankInput(){                                    // → { thr: -1..1 (forward +), turn: -1..1 (driver's LEFT +) }
  let thr=0, turn=0;
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
export function updateWorldBars(){
  if(!_phpBar){ _phpBar=document.getElementById('phpbar'); _phpFill=_phpBar.querySelector('i'); _phpLives=document.getElementById('phpLives');
                _chpBar=document.getElementById('chpbar'); _chpFill=_chpBar.querySelector('i'); }
  const p=S.player;
  if(p && p.hp>0){
    const f=p.hp/p.maxHp, sc=p.scale*TANK_SCALE, s=worldToScreen(_wbV.set(p.pos.x, 3.7*sc, p.pos.z));   // float clearly above the turret
    if(s.infront){ _phpBar.style.display='block'; _phpBar.style.left=s.x+'px'; _phpBar.style.top=s.y+'px';
      _phpFill.style.width=Math.max(0,f*100)+'%'; _phpFill.style.background=_hpGrad(f); _phpLives.textContent='×'+Math.max(0,p.lives); _phpBar.classList.toggle('low', f<=0.25); }
    else _phpBar.style.display='none';
  } else _phpBar.style.display='none';
  if(core && core.hp>0){
    const f=core.hp/core.maxHp, s=worldToScreen(_wbV.set(core.pos.x, 7.8, core.pos.z));                 // float above the monument crystal
    if(s.infront){ _chpBar.style.display='block'; _chpBar.style.left=s.x+'px'; _chpBar.style.top=s.y+'px';
      _chpFill.style.width=Math.max(0,f*100)+'%'; _chpFill.style.background=_coreGrad(f); _chpBar.classList.toggle('low', f<=0.3); }
    else _chpBar.style.display='none';
  } else _chpBar.style.display='none';
}
