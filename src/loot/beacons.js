// loot/beacons.js — LOOT MARKERS (crates / towers / huts / tanks that hide a power-up) · Z177 no light columns · Z211 the object is never recoloured:
//   a stockpile / tower / hut that hides a power-up shows ONE small blinking gold point of light just above its top, and a tank carrying loot one inside its hatch
import * as THREE from 'three';
import { GLOW, blocks, enemies, scene } from '../hub.js';

export const LOOT_COL=0xffd24a, lootBeacons=[];
// blink: two quick gold flashes, then a pause (~1.3 s cycle) — reads as "something in there", not as a beacon
function blink(t){ const c=t%1.3; return c<0.12 ? c/0.12 : c<0.24 ? 1-(c-0.12)/0.12 : c<0.36 ? (c-0.24)/0.12 : c<0.48 ? 1-(c-0.36)/0.12 : 0; }
// Z211 one gold point of light sitting just above the top of the object (its world bounds), nothing else touched
const _bb=new THREE.Box3();
function topDot(owner){ const m=owner.mesh; let x=owner.x, z=owner.z, y=2.2;
  if(m && m.isObject3D && m.parent){ m.updateMatrixWorld(true); _bb.setFromObject(m); if(isFinite(_bb.max.y) && _bb.max.y>-50){ y=_bb.max.y+0.35; x=(_bb.min.x+_bb.max.x)/2; z=(_bb.min.z+_bb.max.z)/2; } }
  const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:GLOW, color:LOOT_COL, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.scale.setScalar(1.3); s.position.set(x,y,z); s.renderOrder=4; scene.add(s);
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.11,8,6), new THREE.MeshBasicMaterial({ color:0xfff2c0, transparent:true, opacity:0 })); core.position.set(x,y,z); scene.add(core);
  return { s, core }; }
// a small blinking light just inside the commander's hatch
function hatchLight(e){ const T=e.mesh.userData.turret||e.mesh, s=new THREE.Sprite(new THREE.SpriteMaterial({ map:GLOW, color:LOOT_COL, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
  const k=1/((e.mesh.scale.x||1)*(T.scale?T.scale.x:1)||1); s.scale.setScalar(1.45*k); s.position.set(-0.42, 0.62, -0.36); T.add(s);
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.09*k,8,6), new THREE.MeshBasicMaterial({ color:0xfff2c0, transparent:true, opacity:0 })); core.position.copy(s.position); T.add(core);
  return { s, core }; }
export function addLootBeacon(owner, kind){ const lb={ owner, kind, t:Math.random()*1.3 };
  if(kind==='block'){ const h=topDot(owner); lb.s=h.s; lb.core=h.core; }
  else if(owner.mesh){ const h=hatchLight(owner); lb.s=h.s; lb.core=h.core; }
  lootBeacons.push(lb); }
function dropBeacon(lb){
  if(lb.s){ lb.s.parent && lb.s.parent.remove(lb.s); lb.core.parent && lb.core.parent.remove(lb.core); if(lb.kind==='block'){ lb.s.material.dispose(); lb.core.geometry.dispose(); lb.core.material.dispose(); } } }
export function clearLootBeacons(kind){ for(let i=lootBeacons.length-1;i>=0;i--){ if(!kind||lootBeacons[i].kind===kind){ dropBeacon(lootBeacons[i]); lootBeacons.splice(i,1); } } }
export function updateLootBeacons(dt){
  for(let i=lootBeacons.length-1;i>=0;i--){ const lb=lootBeacons[i], o=lb.owner;
    const alive = lb.kind==='block' ? blocks.indexOf(o)>=0 : enemies.indexOf(o)>=0;
    if(!alive){ dropBeacon(lb); lootBeacons.splice(i,1); continue; }      // owner gone (destroyed) → marker removed; the drop is spawned by the kill/destroy code
    lb.t+=dt; const k=blink(lb.t);
    if(lb.s){ lb.s.material.opacity=0.15+0.85*k; lb.core.material.opacity=0.35+0.65*k; }
  }
}
