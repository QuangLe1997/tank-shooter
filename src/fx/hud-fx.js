// fx/hud-fx.js — FX (rings, float text, screen)
import * as THREE from 'three';
import { NOCENTER } from '../../config.js';
import { NCZ, VIEW, blTick, camera, heightAt, holoRing, ncArrow, ncBattle, ncChip, ncFeed, ncLabelHit, scene, soldierHit } from '../hub.js';

// ----------------------------- FX (rings, float text, screen) -----------------------------
export const _v = new THREE.Vector3();
export function worldToScreen(v){
  _v.copy(v).project(camera);
  return { x:(_v.x*0.5+0.5)*VIEW.w, y:(1-(_v.y*0.5+0.5))*VIEW.h, infront:_v.z<1 };
}
// NOCENTER in a battle no label is drawn inside the aim zone (ui/nocenter.js): kind 'boss' = a boss's state word → the chip on his bar; 'bosswarn' = that and,
//   from off screen, an edge chevron; 'warn' = an attack's "!" (its sound + ground telegraph stay): the chevron when off screen, nothing over the aim; 'fx' = cosmetic,
//   dropped in the zone; no kind: a line with words goes to the edge stack, a bare mark ("!", "✝", "+40") is dropped. Near the edges a label stays, small.
const WARN_RX = /^⚠/;
export function floatText(text, color, worldPos, size=20, kind){
  const s = worldToScreen(worldPos);
  if(ncBattle()){ const N = NOCENTER.float, w = innerWidth, h = innerHeight, boss = kind === 'boss' || kind === 'bosswarn', warn = kind === 'warn' || kind === 'bosswarn' || WARN_RX.test(text);
    if(boss && ncChip(text, color)){ if(warn && !(s.infront && s.x >= 0 && s.x <= w && s.y >= 0 && s.y <= h)) ncArrow(s, color); return; }
    if(!s.infront || s.x < 0 || s.x > w || s.y < 0 || s.y > h){ if(warn) ncArrow(s, color); return; }
    size = Math.min(size, N.edgeMax);
    if(ncLabelHit(s.x, s.y, text, size)){ if(kind === 'fx' || kind === 'warn' || !/\p{L}{2}/u.test(text)) NCZ.dropped++; else ncFeed(text, color); return; } }
  else if(!s.infront) return;
  const el = document.createElement('div'); el.className='pop'; el.textContent=text;
  el.style.left=s.x+'px'; el.style.top=s.y+'px'; el.style.color=color; el.style.fontSize=size+'px';
  document.getElementById('popups').appendChild(el);
  setTimeout(()=>el.remove(), 950);
}
// shockwave ring pool
// Z318 a shockwave is light: a hot thin front with a soft trailing glow (battle-light ring), not a flat disc
export const ringPool=[]; for(let i=0;i<14;i++){
  const m=holoRing(0.6, { kind:'shock', core:0.035, halo:0.09, fill:0.3, opacity:0 });
  m.visible=false; scene.add(m); ringPool.push({mesh:m,life:0,max:0.5,scale:4,col:new THREE.Color()});
}
export function ringPulse(pos, color, scale=4){
  const r = ringPool.find(r=>r.life<=0); if(!r) return;
  r.mesh.position.set(pos.x,0.15+heightAt(pos.x,pos.z),pos.z); r.life=r.max=0.45; r.scale=scale; r.col.set(color);
  r.mesh.material.color.copy(r.col); r.mesh.visible=true;
}
export function updateRings(dt){ blTick(dt);   // Z318 the one clock every battle light pulses on
  for(const r of ringPool){ if(r.life<=0) continue; r.life-=dt; const k=1-r.life/r.max;
    const s=0.5+(1-(1-k)*(1-k))*r.scale; r.mesh.scale.set(s,s,s); r.mesh.material.opacity=(1-k)*(1-k)*0.95;   // eases out: bursts fast, settles
    if(r.life<=0) r.mesh.visible=false; }
}
export const _flashing=new Set();   // materials currently flashing white (hit feedback) — updated directly, no scene traversal per frame
export function flashMat(m, t, inten, col){ if(!m || !m.emissive) return; const u=m.userData;
  if(u._e0===undefined){ u._e0=m.emissive.getHex(); u._i0=m.emissiveIntensity; }
  m.emissive.setHex(col??0xffffff); m.emissiveIntensity=inten; u._ft=t; _flashing.add(m); }
export function hitFlash(mesh){ if(mesh.userData && mesh.userData.parts){ soldierHit(mesh); return; } mesh.traverse(o=>{ if(o.material && !Array.isArray(o.material)) flashMat(o.material, 0.1, 0.5, 0xffc89a); }); }   // Z192 a warm, short glint (was the whole hull flashing white)
export function updateFlashes(dt){
  for(const m of _flashing){ const u=m.userData; u._ft-=dt; m.emissiveIntensity=Math.max(u._i0, m.emissiveIntensity-dt*8);
    if(u._ft<=0){ m.emissive.setHex(u._e0); m.emissiveIntensity=u._i0; u._e0=undefined; _flashing.delete(m); } }
}
