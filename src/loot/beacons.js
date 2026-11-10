// loot/beacons.js — LOOT BEACONS (mark crates/tanks that hide a power-up)
import * as THREE from 'three';
import { GLOW, blocks, enemies, scene } from '../hub.js';

// ----------------------------- LOOT BEACONS (mark crates/tanks that hide a power-up) -----------------------------
// Some bricks and enemy tanks conceal a power-up. A glowing beacon (gem + light column + radar blip) marks them
// so the player can SEE and prioritise destroying them to claim the item.
export const LOOT_COL=0xffd24a, lootBeacons=[];
export function makeLootBeacon(){
  const g=new THREE.Group();
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.55,3.6,12,1,true), new THREE.MeshBasicMaterial({color:LOOT_COL,transparent:true,opacity:0.16,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); beam.position.y=-1.4; g.add(beam);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:LOOT_COL,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false})); glow.scale.set(1.7,1.7,1); g.add(glow);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(0.34,0), new THREE.MeshStandardMaterial({color:0xfff0c0,emissive:LOOT_COL,emissiveIntensity:1.3,roughness:0.3,metalness:0.5})); g.add(gem);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.05,8,20), new THREE.MeshBasicMaterial({color:LOOT_COL,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false})); ring.rotation.x=Math.PI/2; g.add(ring);
  return {g, gem, glow, ring};
}
export function addLootBeacon(owner, kind){ const b=makeLootBeacon(); scene.add(b.g); lootBeacons.push({g:b.g, gem:b.gem, glow:b.glow, ring:b.ring, owner, kind, t:Math.random()*6.28}); }
export function clearLootBeacons(kind){ for(let i=lootBeacons.length-1;i>=0;i--){ if(!kind||lootBeacons[i].kind===kind){ scene.remove(lootBeacons[i].g); lootBeacons.splice(i,1); } } }
export function updateLootBeacons(dt){
  for(let i=lootBeacons.length-1;i>=0;i--){ const lb=lootBeacons[i], o=lb.owner;
    const alive = lb.kind==='block' ? blocks.indexOf(o)>=0 : enemies.indexOf(o)>=0;
    if(!alive){ scene.remove(lb.g); lootBeacons.splice(i,1); continue; }      // owner gone (destroyed) → beacon removed; the drop is spawned by the kill/destroy code
    lb.t+=dt;
    const ox = lb.kind==='block'? o.x : o.pos.x, oz = lb.kind==='block'? o.z : o.pos.z;
    const baseY = lb.kind==='block'? 4.0 : 3.4;
    lb.g.position.set(ox, baseY+Math.sin(lb.t*2.2)*0.2, oz);
    lb.gem.rotation.y += dt*2.4;
    lb.ring.rotation.z += dt*1.6; lb.ring.scale.setScalar(1+Math.sin(lb.t*3)*0.12);
    lb.glow.material.opacity = 0.6+Math.sin(lb.t*4.5)*0.3;
  }
}
