// loot/beacons.js — LOOT MARKERS (crates / towers / huts / tanks that hide a power-up) · Z177 no light columns: the object ITSELF blinks gold, and a tank carrying loot shows one small blinking light inside its hatch
import * as THREE from 'three';
import { GLOW, blocks, enemies } from '../hub.js';

export const LOOT_COL=0xffd24a, lootBeacons=[];
const _gold=new THREE.Color(LOOT_COL);
// blink: two quick gold flashes, then a pause (~1.3 s cycle) — reads as "something in there", not as a beacon
function blink(t){ const c=t%1.3; return c<0.12 ? c/0.12 : c<0.24 ? 1-(c-0.12)/0.12 : c<0.36 ? (c-0.24)/0.12 : c<0.48 ? 1-(c-0.36)/0.12 : 0; }
// a block's own materials (cloned for this object so nothing else that shares them blinks)
function ownMats(root){ const out=[], seen=new Map();
  root.traverse(o=>{ if(!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.emissive || o.isInstancedMesh) return;
    let m=seen.get(o.material); if(!m){ m=o.material.userData.own ? o.material : o.material.clone(); seen.set(o.material, m); out.push({ m, e0:m.emissive.clone(), i0:m.emissiveIntensity }); } o.material=m; });
  return out; }
// a small blinking light just inside the commander's hatch
function hatchLight(e){ const T=e.mesh.userData.turret||e.mesh, s=new THREE.Sprite(new THREE.SpriteMaterial({ map:GLOW, color:LOOT_COL, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
  const k=1/((e.mesh.scale.x||1)*(T.scale?T.scale.x:1)||1); s.scale.setScalar(1.45*k); s.position.set(-0.42, 0.62, -0.36); T.add(s);
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.09*k,8,6), new THREE.MeshBasicMaterial({ color:0xfff2c0, transparent:true, opacity:0 })); core.position.copy(s.position); T.add(core);
  return { s, core }; }
export function addLootBeacon(owner, kind){ const lb={ owner, kind, t:Math.random()*1.3 };
  if(kind==='block'){ if(owner.mesh) lb.mats=ownMats(owner.mesh); }
  else if(owner.mesh){ const h=hatchLight(owner); lb.s=h.s; lb.core=h.core; }
  lootBeacons.push(lb); }
function dropBeacon(lb){ if(lb.mats) for(const q of lb.mats){ q.m.emissive.copy(q.e0); q.m.emissiveIntensity=q.i0; }
  if(lb.s){ lb.s.parent && lb.s.parent.remove(lb.s); lb.core.parent && lb.core.parent.remove(lb.core); } }
export function clearLootBeacons(kind){ for(let i=lootBeacons.length-1;i>=0;i--){ if(!kind||lootBeacons[i].kind===kind){ dropBeacon(lootBeacons[i]); lootBeacons.splice(i,1); } } }
export function updateLootBeacons(dt){
  for(let i=lootBeacons.length-1;i>=0;i--){ const lb=lootBeacons[i], o=lb.owner;
    const alive = lb.kind==='block' ? blocks.indexOf(o)>=0 : enemies.indexOf(o)>=0;
    if(!alive){ dropBeacon(lb); lootBeacons.splice(i,1); continue; }      // owner gone (destroyed) → marker removed; the drop is spawned by the kill/destroy code
    lb.t+=dt; const k=blink(lb.t);
    if(lb.mats) for(const q of lb.mats){ if(q.m.userData._ft>0) continue; q.m.emissive.copy(q.e0).lerp(_gold, k); q.m.emissiveIntensity=q.i0+(0.75-q.i0*0.5)*k; }   // (a hit flash takes over while it runs)
    if(lb.s){ lb.s.material.opacity=0.15+0.85*k; lb.core.material.opacity=0.35+0.65*k; }
  }
}
