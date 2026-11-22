// campaign/artillery.js — ARTILLERY STRIKES: a locked spot (the objective battery's), the shell in flight, the burst, shrapnel hit vs miss; our own
//   airstrike (no-tanks: the enemy's spotter SPGs and their barrage director are gone)
import * as THREE from 'three';

import { S, aoeDamage, bigExplode, groundNormal, heightAt, scene, blRamp, holoGain, holoRing } from '../hub.js';

// ===== ARTILLERY LOCK — mortar barrage: lock the player's spot → red warning ring → arcing missile slams in =====
// Z188 STRIKE ZONE · Z213 kept simple: ONE thin red ring on the ground round the spot that will be hit, blinking — slowly while the
//   gunners lock, faster and faster as the shell nears, rapid once it is in the air (the falling shell's shadow grows inside it). No discs,
//   stripes, closing arrows, text or rippling waves.
const _artM=(c,o)=>new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:o, side:THREE.DoubleSide, depthWrite:false, depthTest:false, blending:THREE.NormalBlending });
export function makeArtLock(x,z,R,innerR){
  const root=new THREE.Group(), flat=new THREE.Group(); root.position.set(x, heightAt(x,z)+0.16, z); flat.rotation.x=-Math.PI/2; root.add(flat);
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), groundNormal(x, z, new THREE.Vector3()));   // Z215 the ring lies on the slope
  const edge=holoRing(R, { kind:'danger', flat:false, ticks:Math.round(R*6), tickLen:Math.min(0.45, R*0.07), spin:0.025 }); flat.add(edge);   // Z318 one thin hot red line with a soft glow (battle light), fine ticks turning
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,40), _artM(0x000000,0)); shadow.renderOrder=19; flat.add(shadow);
  root.userData={ edge, shadow, R, innerR }; root.visible=false; scene.add(root); return root; }   // Z403 the zone is laid (the general's grenades time on it) but never drawn
// k: 0→1 how tight the lock is (1 while the shell is in the air) · fly: 0→1 shell flight progress (null while locking)
export function tickArtLock(zone, k, fly, now, dt){ const u=zone.userData, hot=fly!=null;   // Z318 a smooth pulse that quickens warn → critical as the lock tightens (never a hard strobe), the line burning hotter
  u.edge.material.opacity = blRamp(u, dt||0.016, hot ? 1 : k, 'warn', 'crit', hot ? 0.42 : 0.22); holoGain(u.edge, 2.4 + (hot ? 1.3 : k*0.9));
  if(hot){ const s=0.6+fly*u.innerR*1.25; u.shadow.scale.set(s,s,1); u.shadow.material.opacity=0.08+0.3*fly; } }
export function disposeArtZone(zone){ if(!zone) return; scene.remove(zone); zone.traverse(c=>{ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }); }
// the firing mortar visibly recoils + a shell blasts UP out of its tube (so the green tank reads as the source)
export function airstrike(now){
  const cx=S.aimPoint.x||0, cz=S.aimPoint.z||0;
  for(let i=0;i<7;i++){
    const ax=cx+(Math.random()-0.5)*22, az=cz+(Math.random()-0.5)*22, delay=0.3+i*0.12+Math.random()*0.2;
    setTimeout(()=>{ if(S.mode!=='playing') return; bigExplode(new THREE.Vector3(ax,1,az),0xff7a3d,1.6); aoeDamage(ax,az,5,50,false,performance.now()/1000); }, delay*1000);
  }
}
