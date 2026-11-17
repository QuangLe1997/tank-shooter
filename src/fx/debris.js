// fx/debris.js — Z103 split from fx/explosions.js: flying hull fragments (pooled) and the charred multi-part tank WRECK.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MOBILE, blastLight, heightAt, scene, spawnPart } from '../hub.js';

// ----- Z203 DEBRIS: not cubes — a library of fractured shapes (faceted chunks, jagged torn plates, splinters, slivers), sized like real breakage
//   (many small, a few big), each blast lights the ground, throws a dust cloud of its own material, sparks off metal, and every piece that hits the
//   ground kicks up a puff; stone and wood trail a little dust as they fly. Shapes are built once with seeded noise and reused by the pools.
let _sd=7; const rnd=()=>((_sd=(_sd*16807)%2147483647)/2147483647);
function chunkGeo(flat){ const g=new THREE.IcosahedronGeometry(1, 0), p=g.attributes.position, key=new Map();   // a faceted, fractured lump
  for(let i=0;i<p.count;i++){ const k=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3); if(!key.has(k)) key.set(k, 0.55+rnd()*0.7); const f=key.get(k); p.setXYZ(i, p.getX(i)*f, p.getY(i)*f*flat, p.getZ(i)*f); }
  g.computeVertexNormals(); return g; }
function plateGeo(){ const sh=new THREE.Shape(), n=6+((rnd()*3)|0); for(let k=0;k<n;k++){ const a=k/n*6.283+(rnd()-0.5)*0.5, r=0.32+rnd()*0.32; k ? sh.lineTo(Math.cos(a)*r, Math.sin(a)*r) : sh.moveTo(Math.cos(a)*r, Math.sin(a)*r); } sh.closePath();   // a jagged torn plate / slab
  const g=new THREE.ExtrudeGeometry(sh,{ depth:0.07+rnd()*0.06, bevelEnabled:false }); g.translate(0,0,-0.05); g.rotateX(Math.PI/2); g.rotateZ((rnd()-0.5)*0.4); return g; }
function splinterGeo(){ const g=new THREE.CylinderGeometry(0.02+rnd()*0.03, 0.06+rnd()*0.05, 1, 4), p=g.attributes.position; for(let i=0;i<p.count;i++) if(p.getY(i)>0) p.setX(i, p.getX(i)+(rnd()-0.5)*0.12); g.computeVertexNormals(); return g; }   // a splinter / snapped rod
function sliverGeo(){ const g=new THREE.TetrahedronGeometry(0.6, 0); g.scale(1, 0.35+rnd()*0.4, 1.6); return g; }   // a long sharp sliver
export const DEBRIS_GEOS = { chunk:[chunkGeo(0.8),chunkGeo(0.55),chunkGeo(1.0),chunkGeo(0.65)], plate:[plateGeo(),plateGeo(),plateGeo()], splinter:[splinterGeo(),splinterGeo()], sliver:[sliverGeo(),sliverGeo()] };
const _pick=a=>a[(Math.random()*a.length)|0];
export const debrisGeo = DEBRIS_GEOS.chunk[0];
export const debrisPool=[], debris=[];
for(let i=0;i<120;i++){ const m=new THREE.Mesh(debrisGeo, new THREE.MeshStandardMaterial({color:0x2a2824,roughness:0.88,metalness:0.7,emissive:0xff5a1e,emissiveIntensity:0,transparent:true,opacity:1,flatShading:true}));
  m.castShadow=true; m.visible=false; scene.add(m); debrisPool.push(m); }
export const _DEBRIS_DARK=[0x26241f,0x312c25,0x3a342c,0x1d1b18,0x2c2a26];
// what the source is made of, guessed from its colour: wood (warm brown), stone / concrete / sand (pale, unsaturated), else metal
const _hc=new THREE.Color(), _hs={h:0,s:0,l:0};
function material(col){ _hc.setHex(col); _hc.getHSL(_hs); if(_hs.h>0.04 && _hs.h<0.14 && _hs.s>0.25 && _hs.l>0.2 && _hs.l<0.6) return 'wood'; if(_hs.l>0.42 || (_hs.s<0.18 && _hs.l>0.3)) return 'stone'; return 'metal'; }
let _landT=0;
export function spawnDebris(pos, scale, color){
  const kind=material(color==null?0x2a2824:color), metal=kind==='metal', wood=kind==='wood', gy=heightAt(pos.x,pos.z);
  const n=Math.min(30, Math.floor(7*scale)+3);
  for(let i=0;i<n;i++){ const m=debrisPool.pop(); if(!m) break;
    const a=Math.random()*6.283, ss=Math.sqrt(scale), sp=(3.5+Math.random()*9)*ss, up=(5+Math.random()*9)*ss;
    const big=Math.pow(Math.random(),2.4), b=(0.1+big*0.42)*scale;                     // many small bits, the odd big piece
    const shape = wood ? (Math.random()<0.65?'splinter':'plate') : metal ? (Math.random()<0.45?'plate':Math.random()<0.5?'sliver':'chunk') : (Math.random()<0.75?'chunk':'sliver');
    m.geometry=_pick(DEBRIS_GEOS[shape]);
    const st=shape==='splinter' ? [b*0.9, b*(1.4+Math.random()*1.6), b*0.9] : shape==='plate' ? [b*(1.0+Math.random()*0.8), b, b*(1.0+Math.random()*0.8)] : [b*(0.7+Math.random()*0.6), b*(0.6+Math.random()*0.6), b*(0.7+Math.random()*0.6)];
    m.scale.set(...st);
    const tint=Math.random()<0.65 ? new THREE.Color(color??0x2a2824).multiplyScalar(0.75+Math.random()*0.4).getHex() : (metal?_DEBRIS_DARK[(Math.random()*_DEBRIS_DARK.length)|0] : new THREE.Color(color??0x888888).multiplyScalar(0.55).getHex());
    m.material.color.setHex(tint); m.material.metalness=metal?0.7:0.05; m.material.roughness=metal?0.55:0.95;
    m.material.emissiveIntensity=metal ? 0.8+Math.random()*0.9 : (Math.random()<0.15?0.5:0);   // metal comes off glowing hot; stone/wood mostly cold
    m.material.opacity=1;
    m.position.set(pos.x+(Math.random()-0.5)*scale*0.9, gy+1.0+Math.random()*scale*0.8, pos.z+(Math.random()-0.5)*scale*0.9);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); m.visible=true;
    debris.push({ m, vx:Math.cos(a)*sp, vy:up, vz:Math.sin(a)*sp, rx:(Math.random()-0.5)*13, ry:(Math.random()-0.5)*13, rz:(Math.random()-0.5)*13,
      age:0, life:2.2+Math.random()*1.8, settled:false, dust:!metal, dcol:color??0x888888, floor:Math.max(0.05, st[1]*0.4) }); }
  // the blast itself: a flash on the ground, a cloud of the material's own dust, sparks off metal, grit
  if(scale>=0.6) blastLight(pos.x, pos.z, 26+scale*22, 0.3);
  const dust=new THREE.Color(color??0x8a8070).lerp(_hc.setHex(0xb8b0a0), 0.45).getHex();
  for(let k=0;k<Math.round((MOBILE?3:6)*Math.min(2,scale));k++){ const aa=Math.random()*6.283, r=Math.random()*scale; spawnPart(pos.x+Math.cos(aa)*r, gy+0.6+Math.random()*scale, pos.z+Math.sin(aa)*r, Math.cos(aa)*(1+Math.random()*3), 0.8+Math.random()*1.6, Math.sin(aa)*(1+Math.random()*3), { color:dust, size:(1.2+Math.random()*1.4)*Math.sqrt(scale), life:1.4+Math.random()*1.0, smoke:true, grav:-0.25, drag:1.6, grow:1.6, op:0.45 }); }
  if(metal) for(let k=0;k<Math.round((MOBILE?5:10)*Math.min(2,scale));k++){ const aa=Math.random()*6.283, v=8+Math.random()*12; spawnPart(pos.x, gy+1.1, pos.z, Math.cos(aa)*v, 3+Math.random()*7, Math.sin(aa)*v, { color:0xfff0b0, color2:0xff5a10, size:0.12, life:0.35+Math.random()*0.4, grav:-16, drag:0.5 }); }
  for(let k=0;k<Math.round((MOBILE?4:9)*Math.min(2,scale));k++){ const aa=Math.random()*6.283, v=3+Math.random()*7; spawnPart(pos.x, gy+1.0, pos.z, Math.cos(aa)*v, 4+Math.random()*6, Math.sin(aa)*v, { color:new THREE.Color(dust).multiplyScalar(0.7).getHex(), size:0.1+Math.random()*0.08, life:0.7, grav:-18, drag:0.8 }); }   // grit
}
// ----- tank WRECKAGE: a dying tank is RIPPED APART into charred, jagged metal — torn armour plates, ripped shards, snapped bars, wheels — mostly scorched black with white-hot edges (NOT coloured cubes) -----
export const WRECK_GEO = {
  plate:  (()=>{ const g=plateGeo(); g.scale(2.0,0.8,1.5); return g; })(),   // Z203 torn armour plate (jagged outline)
  plate2: (()=>{ const g=plateGeo(); g.scale(1.2,0.7,2.2); return g; })(),   // long torn plate
  shard:  (()=>{ const g=sliverGeo(); g.scale(1.1,1.1,1.1); return g; })(),   // jagged ripped-metal sliver
  shard2: (()=>{ const g=chunkGeo(0.6); g.scale(0.55,0.55,0.55); return g; })(),   // fractured chunk
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
export function updateDebris(dt){ _landT=Math.max(0,_landT-dt*30);
  for(let i=debris.length-1;i>=0;i--){ const d=debris[i], m=d.m; d.age+=dt;
    if(d.age>=d.life){ m.visible=false; m.material.opacity=1; m.material.emissiveIntensity=0; (d.pool||debrisPool).push(m); debris.splice(i,1); continue; }
    if(!d.settled){
      d.vy-=30*dt;                                                                   // gravity
      const dg=Math.max(0,1-dt*1.1); d.vx*=dg; d.vz*=dg;                              // air drag
      m.position.x+=d.vx*dt; m.position.y+=d.vy*dt; m.position.z+=d.vz*dt;
      const floor=(d.floor!=null?d.floor:Math.max(0.14, m.scale.y*0.5)) + heightAt(m.position.x, m.position.z);
      if(d.dust && Math.random()<0.12) spawnPart(m.position.x, m.position.y, m.position.z, 0, 0.3, 0, { color:d.dcol, size:0.35, life:0.6, smoke:true, grav:-0.2, drag:2, grow:1.2, op:0.3 });   // Z203 stone / wood trails a little dust
      if(m.position.y<=floor){ m.position.y=floor;
        if(Math.abs(d.vy)>5 && _landT<(MOBILE?6:14)){ _landT++; spawnPart(m.position.x, floor+0.1, m.position.z, (Math.random()-0.5)*1.5, 0.6, (Math.random()-0.5)*1.5, { color:d.dust?d.dcol:0x8a8070, size:0.7+m.scale.x*1.5, life:0.8, smoke:true, grav:-0.2, drag:2.2, grow:1.4, op:0.4 }); }   // a puff where it lands
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
