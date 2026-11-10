// fx/debris.js — Z103 split from fx/explosions.js: flying hull fragments (pooled) and the charred multi-part tank WRECK.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { heightAt, scene, spawnPart } from '../hub.js';

// ----- debris: tanks shatter into irregular metal fragments that fly, tumble, bounce low, settle, cool, and fade -----
export const debrisGeo = new THREE.BoxGeometry(1,1,1);   // unit cube, scaled NON-uniformly per fragment → plates/bars/chunks
export const debrisPool=[], debris=[];
for(let i=0;i<90;i++){ const m=new THREE.Mesh(debrisGeo, new THREE.MeshStandardMaterial({color:0x2a2824,roughness:0.88,metalness:0.7,emissive:0xff5a1e,emissiveIntensity:0,transparent:true,opacity:1}));
  m.visible=false; scene.add(m); debrisPool.push(m); }
export const _DEBRIS_DARK=[0x26241f,0x312c25,0x3a342c,0x1d1b18,0x2c2a26];
export function spawnDebris(pos, scale, color){
  const n=Math.min(26, Math.floor(6*scale)+2);
  for(let i=0;i<n;i++){ const m=debrisPool.pop(); if(!m) break;
    const a=Math.random()*6.283, ss=Math.sqrt(scale), sp=(3.5+Math.random()*8)*ss, up=(5+Math.random()*8)*ss;
    const b=(0.14+Math.random()*0.22)*scale;                                         // irregular fragment (non-uniform scale) — fragment-sized, not crates
    m.scale.set(b*(0.5+Math.random()*0.9), b*(0.22+Math.random()*0.4), b*(0.6+Math.random()*0.9));
    m.material.color.setHex(Math.random()<0.28 ? color : _DEBRIS_DARK[(Math.random()*_DEBRIS_DARK.length)|0]);  // mostly dark metal, some painted hull
    m.material.emissiveIntensity=0.8+Math.random()*0.9;                              // glowing hot from the blast (cools below)
    m.material.opacity=1;
    m.position.set(pos.x+(Math.random()-0.5)*scale*0.9, 1.0+Math.random()*scale*0.8, pos.z+(Math.random()-0.5)*scale*0.9);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); m.visible=true;
    debris.push({ m, vx:Math.cos(a)*sp, vy:up, vz:Math.sin(a)*sp,
      rx:(Math.random()-0.5)*11, ry:(Math.random()-0.5)*11, rz:(Math.random()-0.5)*11,
      age:0, life:2.0+Math.random()*1.6, settled:false }); }
}
// ----- tank WRECKAGE: a dying tank is RIPPED APART into charred, jagged metal — torn armour plates, ripped shards, snapped bars, wheels — mostly scorched black with white-hot edges (NOT coloured cubes) -----
export const WRECK_GEO = {
  plate:  new THREE.BoxGeometry(1.4,0.06,1.0),         // torn armour plate (thin slab)
  plate2: new THREE.BoxGeometry(0.85,0.05,1.55),       // long thin plate
  shard:  new THREE.TetrahedronGeometry(0.62),         // jagged ripped-metal shard
  shard2: new THREE.OctahedronGeometry(0.52),          // angular chunk
  bar:    new THREE.BoxGeometry(0.13,0.13,1.7),        // snapped rod / structural bar
  barrel: new THREE.CylinderGeometry(0.15,0.19,2.3,9), // broken gun barrel
  wheel:  new THREE.CylinderGeometry(0.42,0.42,0.4,14),// road wheel
  hub:    new THREE.CylinderGeometry(0.14,0.14,0.6,9), // snapped axle/hub
  turret: new RoundedBoxGeometry(1.25,0.48,1.45,1,0.1),// blown-off turret shell (flattened)
};
export const wreckPool=[];
for(let i=0;i<170;i++){ const m=new THREE.Mesh(WRECK_GEO.shard, new THREE.MeshStandardMaterial({color:0x18150f,roughness:0.85,metalness:0.6,emissive:0xff4612,emissiveIntensity:0,transparent:true,opacity:1,flatShading:true}));
  m.castShadow=true; m.visible=false; scene.add(m); wreckPool.push(m); }
export const _SCORCH=[0x141210,0x1c1813,0x24201a,0x100e0b,0x2a251d];                     // charred-metal tones (most fragments)
export const _burnt=hex=>{ const c=new THREE.Color(hex); c.multiplyScalar(0.45); return c.getHex(); };   // darkened "burnt paint" hint
// part list: geometry key + relative size + chance to keep (burnt) paint vs scorched black
export const _WRECK_PARTS=[ {g:'turret',sz:1.0,paint:0.6},{g:'barrel',sz:1.0,paint:0.4},{g:'plate',sz:1.0,paint:0.5},
  {g:'plate2',sz:0.95,paint:0.4},{g:'plate',sz:0.8,paint:0.3},{g:'shard',sz:1.1,paint:0.15},{g:'shard',sz:0.85,paint:0.1},
  {g:'shard2',sz:1.0,paint:0.12},{g:'shard2',sz:0.8,paint:0.1},{g:'bar',sz:1.0,paint:0.1},{g:'bar',sz:0.85,paint:0.1},
  {g:'wheel',sz:1.0,paint:0},{g:'wheel',sz:0.9,paint:0},{g:'hub',sz:1.0,paint:0.1},{g:'shard',sz:0.7,paint:0.1},{g:'plate',sz:0.7,paint:0.3} ];
export function spawnTankWreck(pos, ms, pal){
  const burntHull=_burnt(pal.hull), burntTur=_burnt(pal.turret||pal.hull);
  const rs=Math.sqrt(ms);
  const count = ms<1.05 ? 5 : ms<1.3 ? 6 : ms<2.2 ? 8 : 10;                  // torn-off bits only — the burning hull itself stays (spawnWreck)
  for(let pi=0; pi<count; pi++){ const part=_WRECK_PARTS[pi+1];   // skip the whole-turret slab
    const m=wreckPool.pop(); if(!m) return;                                  // pool exhausted (huge multi-kill) → stop gracefully
    m.geometry=WRECK_GEO[part.g];
    let col; if(Math.random()<part.paint) col = part.g==='turret'?burntTur:burntHull; else col=_SCORCH[(Math.random()*_SCORCH.length)|0];
    if(part.g==='wheel') col=0x0e0e0c;                                        // scorched rubber
    m.material.color.setHex(col);
    const s=ms*part.sz*(0.45+Math.random()*0.3); m.scale.set(s, s*(0.7+Math.random()*0.6), s*(0.8+Math.random()*0.5));   // torn plates, wheels, bars — sized like real fragments
    const a=Math.random()*6.283, sp=(7+Math.random()*9)*rs, up=(9+Math.random()*6)*rs;            // arc out then land as visible wreckage (moderate)
    m.position.set(pos.x+(Math.random()-0.5)*ms*0.7, 1.0+Math.random()*ms, pos.z+(Math.random()-0.5)*ms*0.7);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
    m.material.emissiveIntensity=1.0+Math.random()*0.7; m.material.opacity=1; m.visible=true;     // hot → cools to dark torn metal
    debris.push({ m, vx:Math.cos(a)*sp, vy:up, vz:Math.sin(a)*sp,
      rx:(Math.random()-0.5)*15, ry:(Math.random()-0.5)*15, rz:(Math.random()-0.5)*15,
      age:0, life:2.8+Math.random()*1.5, settled:false, floor:Math.max(0.14, s*0.4), pool:wreckPool, fire:true });   // lingers as readable wreckage on the ground, then fades (smoke/fire already gone — no view block)
  }
}
export function updateDebris(dt){
  for(let i=debris.length-1;i>=0;i--){ const d=debris[i], m=d.m; d.age+=dt;
    if(d.age>=d.life){ m.visible=false; m.material.opacity=1; m.material.emissiveIntensity=0; (d.pool||debrisPool).push(m); debris.splice(i,1); continue; }
    if(!d.settled){
      d.vy-=30*dt;                                                                   // gravity
      const dg=Math.max(0,1-dt*1.1); d.vx*=dg; d.vz*=dg;                              // air drag
      m.position.x+=d.vx*dt; m.position.y+=d.vy*dt; m.position.z+=d.vz*dt;
      const floor=(d.floor!=null?d.floor:Math.max(0.14, m.scale.y*0.5)) + heightAt(m.position.x, m.position.z);
      if(m.position.y<=floor){ m.position.y=floor;
        if(Math.abs(d.vy)<2.4 && Math.hypot(d.vx,d.vz)<2.6){ d.settled=true; d.vy=d.vx=d.vz=0; }   // come to rest on the ground
        else { d.vy*=-0.22; d.vx*=0.5; d.vz*=0.5; d.rx*=0.5; d.ry*=0.5; d.rz*=0.5; }               // low bounce + spin damp
      }
      m.rotation.x+=d.rx*dt; m.rotation.y+=d.ry*dt; m.rotation.z+=d.rz*dt;
    }
    if(d.fire && d.age<0.85){     // brief flaming trail: quick fire + embers + light smoke that clears fast (won't block the view)
      const mp=m.position;
      if(Math.random()<0.5) spawnPart(mp.x, mp.y, mp.z, (Math.random()-0.5)*3, 1.6+Math.random()*3, (Math.random()-0.5)*3,
        {color: Math.random()<0.5?0xff7a1e:0xffc24e, size:0.6+Math.random()*0.6, life:0.22+Math.random()*0.16, grav:-5, drag:3.5});
      if(Math.random()<0.22) spawnPart(mp.x, mp.y, mp.z, (Math.random()-0.5)*6, Math.random()*3, (Math.random()-0.5)*6,
        {color:0xffe09a, size:0.24+Math.random()*0.18, life:0.3+Math.random()*0.2, grav:-9, drag:1.3});   // embers flung out, quick
      if(Math.random()<0.16) spawnPart(mp.x, mp.y, mp.z, (Math.random()-0.5), 0.6, (Math.random()-0.5),
        {color:0x161310, size:0.9+Math.random()*0.4, life:0.45, smoke:true, grav:-1.2, drag:1.8, op:0.4});
    }
    if(m.material.emissiveIntensity>0) m.material.emissiveIntensity=Math.max(0, m.material.emissiveIntensity-dt*(d.fire?1.7:1.7));   // brief hot flash → quickly cools to readable DARK TORN METAL
    const fadeT=d.fire?1.0:0.7, rem=d.life-d.age; if(rem<fadeT) m.material.opacity=rem/fadeT;                            // fade out (burn up) and vanish
  }
}
