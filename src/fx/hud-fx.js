// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { VIEW, camera, heightAt, scene } from '../hub.js';

// ----------------------------- FX (rings, float text, screen) -----------------------------
export const _v = new THREE.Vector3();
export function worldToScreen(v){
  _v.copy(v).project(camera);
  return { x:(_v.x*0.5+0.5)*VIEW.w, y:(1-(_v.y*0.5+0.5))*VIEW.h, infront:_v.z<1 };
}
export function floatText(text, color, worldPos, size=20){
  const s = worldToScreen(worldPos); if(!s.infront) return;
  const el = document.createElement('div'); el.className='pop'; el.textContent=text;
  el.style.left=s.x+'px'; el.style.top=s.y+'px'; el.style.color=color; el.style.fontSize=size+'px';
  document.getElementById('popups').appendChild(el);
  setTimeout(()=>el.remove(), 950);
}
// shockwave ring pool
export const ringPool=[]; for(let i=0;i<14;i++){
  const m=new THREE.Mesh(new THREE.RingGeometry(0.5,0.7,40),
    new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.visible=false; scene.add(m); ringPool.push({mesh:m,life:0,max:0.5,scale:4,col:new THREE.Color()});
}
export function ringPulse(pos, color, scale=4){
  const r = ringPool.find(r=>r.life<=0); if(!r) return;
  r.mesh.position.set(pos.x,0.15+heightAt(pos.x,pos.z),pos.z); r.life=r.max=0.45; r.scale=scale; r.col.set(color);
  r.mesh.material.color.copy(r.col); r.mesh.visible=true;
}
export function updateRings(dt){
  for(const r of ringPool){ if(r.life<=0) continue; r.life-=dt; const k=1-r.life/r.max;
    const s=0.5+k*r.scale; r.mesh.scale.set(s,s,s); r.mesh.material.opacity=(1-k)*0.6;
    if(r.life<=0) r.mesh.visible=false; }
}
export const _flashing=new Set();   // materials currently flashing white (hit feedback) — updated directly, no scene traversal per frame
export function flashMat(m, t, inten){ if(!m || !m.emissive) return; const u=m.userData;
  if(u._e0===undefined){ u._e0=m.emissive.getHex(); u._i0=m.emissiveIntensity; }
  m.emissive.setHex(0xffffff); m.emissiveIntensity=inten; u._ft=t; _flashing.add(m); }
export function hitFlash(mesh){ mesh.traverse(o=>{ if(o.material && !Array.isArray(o.material)) flashMat(o.material, 0.12, 0.9); }); }
export function updateFlashes(dt){
  for(const m of _flashing){ const u=m.userData; u._ft-=dt; m.emissiveIntensity=Math.max(u._i0, m.emissiveIntensity-dt*8);
    if(u._ft<=0){ m.emissive.setHex(u._e0); m.emissiveIntensity=u._i0; u._e0=undefined; _flashing.delete(m); } }
}
