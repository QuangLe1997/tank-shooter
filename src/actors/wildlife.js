// actors/wildlife.js — Z143 WILDLIFE (Z208 real anatomy and coats): herds that graze, wander and bolt from tanks — gazelles, zebras, giraffes and elephants on the savanna,
//   deer on the hills and meadows, reindeer and polar bears in the Arctic. Low-poly, vertex-coloured; legs swing in a trot (diagonal pairs).
//   They are scenery that reacts — not targets: shells and tracks never hurt them, they just get out of the way.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ALLY_TANKS, ARENA, BIOME, MOBILE, S, _R, blocks, clampField, enemies, heightAt, inField, inZone, scene, solidTank, wetAt } from '../hub.js';

// Z208 organic anatomy: ellipsoid masses, tapered limbs with knees + hooves, coats painted per vertex (stripes, patches, bands, mottling)
const _up=new THREE.Vector3(0,1,0), _d=new THREE.Vector3();
function blob(P, rx,ry,rz, x,y,z, col, rotX, seg){ const g=new THREE.SphereGeometry(1, seg||14, seg?Math.max(6,seg-4):10); g.scale(rx,ry,rz); if(rotX) g.rotateX(rotX); g.translate(x,y,z); P.push({ geo:g, col }); }
function seg(P, ax,ay,az, bx,by,bz, r0,r1, col, n){ _d.set(bx-ax,by-ay,bz-az); const L=_d.length(), g=new THREE.CylinderGeometry(r1, r0, L, n||8, 2); g.translate(0,L/2,0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, _d.normalize())); g.translate(ax,ay,az); P.push({ geo:g, col }); }
function chain(P, pts, radii, col, n){ for(let i=0;i<pts.length-1;i++) seg(P, ...pts[i], ...pts[i+1], radii[i], radii[i+1], col, n); }
const C=new THREE.Color();
const PAT=new Map();   // coat function → shader pattern id (1 zebra stripes · 2 giraffe network · 3 leg bands)
function mergeVC(parts){ const geos=[]; for(const { geo, col } of parts){ const pat=PAT.get(col)||0; const g=geo.index?geo.toNonIndexed():geo; for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv') g.deleteAttribute(k);
    const pos=g.attributes.position, n=pos.count, c=new Float32Array(n*3);
    for(let i=0;i<n;i++){ const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i); if(typeof col==='function') col(x,y,z,C); else C.setHex(col);
      C.multiplyScalar(0.93+0.07*Math.sin(x*13+y*7)*Math.sin(z*11-y*5)); c[i*3]=C.r; c[i*3+1]=C.g; c[i*3+2]=C.b; }                         // soft mottling — no flat plastic
    g.setAttribute('color', new THREE.BufferAttribute(c,3)); g.setAttribute('aPat', new THREE.BufferAttribute(new Float32Array(n).fill(pat),1)); geos.push(g); }
  const m=mergeGeometries(geos, false); geos.forEach(g=>g.dispose()); return m; }
// coats
const mix=(a,b,t)=>C.setHex(a).lerp(new THREE.Color(b), Math.max(0,Math.min(1,t)));
const coat=(top,belly,y0,y1)=>(x,y,z,c)=>mix(belly, top, (y-y0)/(y1-y0));
const gazelleCoat=(x,y,z,c)=>{ if(y<0.93) c.setHex(0xf2ead8); else if(y<1.0 && z>-0.45) c.setHex(0x3e2618); else mix(0xc89058, 0xa87040, (y-1)/0.3); if(z<-0.5 && y<1.15 && Math.abs(x)<0.14) c.setHex(0xf2ead8); };
const zebraCoat=(x,y,z,c)=>c.setHex(0xf2f0ea), zebraHead=(x,y,z,c)=>c.setHex(z>1.24?0x1e1a18:0xf2f0ea), zebraLeg=(x,y,z,c)=>c.setHex(0xf2f0ea);
const giraffeCoat=(x,y,z,c)=>{ if(y<1.85) c.setHex(0xead6a8); else mix(0xa65e26, 0x8a4a1c, Math.sin(x*3+z*2)*0.5+0.5); };
PAT.set(zebraCoat,1); PAT.set(zebraHead,1); PAT.set(zebraLeg,3); PAT.set(giraffeCoat,2);
const eleSkin=(x,y,z,c)=>{ c.setHex(0x8a8580).multiplyScalar(0.86+0.14*Math.sin(y*34+Math.sin(x*9)*2)*Math.sin(z*21)); if(y<1.6) c.multiplyScalar(0.85); };
const bearFur=(x,y,z,c)=>mix(0xe6dcc6, 0xf6f2ea, (y-0.9)/0.9);
// species: body builder (head toward +z, hip line at y = leg), leg length/radius/colour, hoof colour, hip spread, speeds, flee radius, herd size
const SPECIES = {
  gazelle:{ leg:0.75, legC:0xc08a52, hoof:0x2a2018, legR:0.042, hx:0.13, hz:0.42, walk:1.6, run:13, flee:30, herd:[6,10], body(P){
    blob(P,0.24,0.27,0.6, 0,1.0,0, gazelleCoat); blob(P,0.22,0.24,0.24, 0,1.03,-0.4, gazelleCoat); seg(P, 0,1.12,0.42, 0,1.55,0.72, 0.11,0.065, 0xc08a52);
    blob(P,0.085,0.095,0.18, 0,1.6,0.86, 0xc89058, 0.55); blob(P,0.05,0.05,0.06, 0,1.5,0.99, 0x2a2018, 0, 8); blob(P,0.06,0.03,0.12, 0,1.62,0.88, 0xf2ead8, 0.55, 8);
    for(const s of [-1,1]){ seg(P, s*0.05,1.66,0.8, s*0.15,1.76,0.74, 0.03,0.012, 0xb07a48, 5); chain(P, [[s*0.03,1.68,0.8],[s*0.07,1.86,0.72],[s*0.05,2.02,0.68],[s*0.08,2.1,0.74]], [0.022,0.016,0.01,0.004], 0x2a2018, 5); blob(P,0.018,0.02,0.02, s*0.07,1.64,0.9, 0x0a0a0a, 0, 6); }
    seg(P, 0,1.1,-0.6, 0,0.9,-0.68, 0.03,0.012, 0x2a2018, 5); } },
  deer:{ leg:0.85, legC:0x7a4e30, hoof:0x221a14, legR:0.05, hx:0.15, hz:0.48, walk:1.4, run:11, flee:28, herd:[4,7], body(P){
    const c=(x,y,z,k)=>{ coat(0x8a5634, 0xd8c8a8, 0.92, 1.25)(x,y,z,k); if(z<-0.55 && y>1.0) k.setHex(0xece4d4); };
    blob(P,0.28,0.32,0.66, 0,1.17,0, c); blob(P,0.26,0.3,0.28, 0,1.2,-0.42, c); seg(P, 0,1.3,0.48, 0,1.76,0.8, 0.14,0.085, 0x8a5634);
    blob(P,0.1,0.11,0.21, 0,1.8,0.92, 0x8a5634, 0.5); blob(P,0.055,0.055,0.06, 0,1.68,1.08, 0x1a1410, 0, 8);
    for(const s of [-1,1]){ blob(P,0.03,0.09,0.05, s*0.12,1.93,0.84, 0x7a4a2e, -0.3, 8); blob(P,0.02,0.022,0.022, s*0.08,1.84,0.98, 0x0a0a0a, 0, 6);
      chain(P, [[s*0.05,1.9,0.86],[s*0.16,2.12,0.76],[s*0.26,2.36,0.74],[s*0.3,2.56,0.86]], [0.03,0.024,0.018,0.008], 0xb8a07a, 5);
      seg(P, s*0.16,2.12,0.76, s*0.15,2.32,0.95, 0.016,0.005, 0xb8a07a, 4); seg(P, s*0.26,2.36,0.74, s*0.34,2.5,0.62, 0.014,0.004, 0xb8a07a, 4); }
    seg(P, 0,1.25,-0.68, 0,1.12,-0.74, 0.05,0.02, 0xece4d4, 5); } },
  zebra:{ leg:0.85, legC:zebraLeg, hoof:0x141414, legR:0.06, hx:0.18, hz:0.52, walk:1.3, run:12, flee:30, herd:[5,8], body(P){
    blob(P,0.33,0.36,0.74, 0,1.2,0, zebraCoat, 0, 18); seg(P, 0,1.35,0.5, 0,1.88,0.88, 0.17,0.1, zebraCoat, 12);
    chain(P, [[0,1.55,0.44],[0,1.8,0.66],[0,2.02,0.86]], [0.035,0.035,0.03], zebraCoat, 5);   // upright mane
    blob(P,0.11,0.13,0.31, 0,1.9,1.06, zebraHead, 0.8, 16); for(const s of [-1,1]){ seg(P, s*0.06,2.02,0.96, s*0.12,2.2,0.92, 0.04,0.012, 0xf2f0ea, 5); blob(P,0.022,0.024,0.024, s*0.09,1.98,1.07, 0x0a0a0a, 0, 6); }
    seg(P, 0,1.32,-0.7, 0,0.95,-0.8, 0.035,0.02, zebraCoat, 5); blob(P,0.05,0.12,0.05, 0,0.88,-0.82, 0x161616, 0, 8); } },
  giraffe:{ leg:1.7, legC:0xe8cc98, hoof:0x2a2018, legR:0.075, hx:0.24, hz:0.6, walk:1.1, run:8, flee:34, herd:[3,5], body(P){
    blob(P,0.4,0.46,0.84, 0,2.15,0, giraffeCoat, -0.2, 18); seg(P, 0,2.4,0.55, 0,4.5,1.25, 0.24,0.11, giraffeCoat, 12);
    chain(P, [[0,2.65,0.5],[0,3.6,0.86],[0,4.55,1.15]], [0.05,0.04,0.03], 0x6a3a1c, 5);
    blob(P,0.1,0.12,0.3, 0,4.62,1.42, giraffeCoat, 0.6, 14); blob(P,0.07,0.07,0.09, 0,4.47,1.62, 0x5a3a26, 0, 8);
    for(const s of [-1,1]){ seg(P, s*0.06,4.72,1.32, s*0.07,4.95,1.28, 0.03,0.025, 0xe0b880, 5); blob(P,0.035,0.035,0.035, s*0.07,4.97,1.28, 0x2a1a10, 0, 6); seg(P, s*0.09,4.7,1.34, s*0.22,4.78,1.26, 0.04,0.012, 0xe0b880, 5); }
    seg(P, 0,2.3,-0.8, 0,1.4,-0.92, 0.04,0.02, 0xa05a24, 5); blob(P,0.06,0.16,0.06, 0,1.3,-0.93, 0x1a1210, 0, 8); } },
  elephant:{ leg:1.3, legC:eleSkin, hoof:0xb8b0a0, legR:0.25, lt:[1.12,0.98,0.98,0.92,0.96,1.06], hx:0.5, hz:0.78, walk:1.0, run:5, flee:26, herd:[3,5], body(P){
    blob(P,0.82,0.9,1.3, 0,2.35,0, eleSkin, 0, 18); blob(P,0.76,0.8,0.75, 0,2.55,0.65, eleSkin); blob(P,0.55,0.62,0.6, 0,2.72,1.35, eleSkin, 0, 16); blob(P,0.4,0.42,0.3, 0,2.95,1.55, eleSkin);
    for(const s of [-1,1]){ const e=new THREE.SphereGeometry(1,12,10); e.scale(0.07,0.66,0.56); e.rotateY(s*0.5); e.translate(s*0.66,2.62,1.18); P.push({ geo:e, col:(x,y,z,c)=>{ eleSkin(x,y,z,c); c.multiplyScalar(0.92); } });   // big flapping-ear shapes
      chain(P, [[s*0.24,2.25,1.82],[s*0.3,1.82,2.18],[s*0.24,1.72,2.48]], [0.07,0.05,0.015], 0xf2ead2, 6); blob(P,0.04,0.045,0.04, s*0.36,2.88,1.78, 0x1a1816, 0, 6); }
    chain(P, [[0,2.55,1.85],[0,2.05,2.12],[0,1.45,2.2],[0,0.95,2.3],[0,0.75,2.45]], [0.26,0.2,0.14,0.1,0.08], eleSkin, 10);   // trunk
    seg(P, 0,2.6,-1.25, 0,1.6,-1.4, 0.06,0.03, eleSkin, 5); } },
  reindeer:{ leg:0.9, legC:0x5a4a3a, hoof:0x1e1a16, legR:0.06, hx:0.18, hz:0.52, walk:1.3, run:10, flee:28, herd:[5,9], body(P){
    blob(P,0.32,0.35,0.7, 0,1.22,0, coat(0x6e5e4e, 0xe0d8c8, 0.95, 1.4)); blob(P,0.24,0.26,0.28, 0,1.38,0.6, 0xe8e0d0); seg(P, 0,1.35,0.5, 0,1.8,0.84, 0.17,0.11, 0xe2d8c6);
    blob(P,0.11,0.13,0.26, 0,1.84,1.0, 0x6e5e4e, 0.45); blob(P,0.06,0.06,0.07, 0,1.72,1.17, 0x2a2420, 0, 8);
    for(const s of [-1,1]){ chain(P, [[s*0.07,1.96,0.92],[s*0.28,2.3,0.72],[s*0.42,2.66,0.84],[s*0.36,2.92,1.06]], [0.035,0.03,0.022,0.01], 0xd0c0a0, 5);
      seg(P, s*0.06,2.0,0.95, s*0.04,2.16,1.16, 0.02,0.008, 0xd0c0a0, 4); seg(P, s*0.28,2.3,0.72, s*0.4,2.45,0.6, 0.016,0.005, 0xd0c0a0, 4); seg(P, s*0.42,2.66,0.84, s*0.56,2.8,0.86, 0.014,0.004, 0xd0c0a0, 4);
      blob(P,0.022,0.024,0.024, s*0.1,1.9,1.05, 0x0a0a0a, 0, 6); }
    seg(P, 0,1.32,-0.68, 0,1.2,-0.74, 0.06,0.02, 0xe8e0d0, 5); } },
  bear:{ leg:0.75, legC:0xece4d4, hoof:0x3a3632, legR:0.15, lt:[1.4,1.0,1.0,0.85,0.9,1.05], hx:0.3, hz:0.6, walk:1.1, run:7, flee:24, herd:[1,2], body(P){
    blob(P,0.52,0.56,1.0, 0,1.25,0, bearFur, 0, 18); blob(P,0.5,0.52,0.48, 0,1.32,0.68, bearFur); seg(P, 0,1.35,0.92, 0,1.42,1.22, 0.34,0.25, bearFur, 12);
    blob(P,0.25,0.24,0.32, 0,1.44,1.4, bearFur); blob(P,0.13,0.12,0.18, 0,1.37,1.66, 0xf0eae0); blob(P,0.05,0.04,0.035, 0,1.42,1.83, 0x141210, 0, 8);
    for(const s of [-1,1]){ blob(P,0.07,0.06,0.04, s*0.18,1.66,1.32, 0xe6dcc8, 0, 8); blob(P,0.022,0.024,0.024, s*0.1,1.52,1.6, 0x0a0a0a, 0, 6); }
    blob(P,0.08,0.07,0.07, 0,1.35,-1.0, 0xf2eee6, 0, 8); } },
};
const GEO={}, MAT=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.88, metalness:0 });
MAT.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aPat; varying float vPat; varying vec3 vOP;').replace('#include <begin_vertex>','#include <begin_vertex>\n  vPat=aPat; vOP=position;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vPat; varying vec3 vOP;').replace('#include <color_fragment>',`#include <color_fragment>
    if(vPat>0.5){ vec3 p=vOP;
      if(vPat<1.5){ float s = p.z>0.9 ? sin(p.y*26.+p.z*9.) : p.z<-0.3 ? sin(p.y*20.+p.z*7.+abs(p.x)*3.) : sin(p.z*17.+abs(p.x)*5.+p.y*6.+sin(p.y*4.)*1.5);
        float belly = (p.y<1.0 && abs(p.x)<0.15 && p.z>-0.3 && p.z<0.6) ? 0.0 : 1.0; diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.012), smoothstep(0.05,0.22,s)*belly); }
      else if(vPat<2.5){ float n=sin(p.x*8.+sin(p.z*6.)*1.6)*sin(p.z*8.+sin(p.y*7.)*1.6)*sin(p.y*8.+sin(p.x*6.)*1.6); diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.89,0.75,0.51), 1.-smoothstep(0.06,0.12,abs(n))); }
      else diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.012), smoothstep(0.0,0.25,sin(p.y*22.))*step(-0.72,p.y)); }`); };   // Z208 coats drawn per pixel: crisp stripes / patches
MAT.customProgramCacheKey=()=>'wildCoat';
function geos(id){ if(GEO[id]) return GEO[id]; const sp=SPECIES[id], P=[]; sp.body(P); const body=mergeVC(P);
  // a leg hangs from the hip line (origin at hip height): thigh → shin (the hind leg kinks back at the hock) → hoof
  const L=(dx,dz)=>{ const Q=[], len=sp.leg, r=sp.legR, hind=dz<0, k=hind?0.07:-0.02;
    const t=sp.lt||[1.45,0.8,0.72,0.52,0.6,0.72];
    seg(Q, dx,0.12,dz, dx,-len*0.48,dz+k, r*t[0], r*t[1], sp.legC); seg(Q, dx,-len*0.48,dz+k, dx,-len+0.07,dz+(hind?-0.01:0.01), r*t[2], r*t[3], sp.legC);
    seg(Q, dx,-len+0.075,dz+(hind?-0.01:0.01), dx,-len,dz+0.02, r*t[4], r*t[5], sp.hoof, sp.lt?10:6); return Q; };
  const a=mergeVC([...L(sp.hx,sp.hz), ...L(-sp.hx,-sp.hz)]), b=mergeVC([...L(-sp.hx,sp.hz), ...L(sp.hx,-sp.hz)]);
  return (GEO[id]={ body, a, b }); }
export const WILD = { list:[], g:null };
export function clearWildlife(){ if(WILD.g){ scene.remove(WILD.g); WILD.g=null; } WILD.list.length=0; }
function spawn(id, x, z){ const sp=SPECIES[id], G=geos(id), root=new THREE.Group(), body=new THREE.Mesh(G.body, MAT), la=new THREE.Mesh(G.a, MAT), lb=new THREE.Mesh(G.b, MAT);
  la.position.y=lb.position.y=sp.leg; body.castShadow=la.castShadow=lb.castShadow=!MOBILE; root.add(body, la, lb); const s=_R(0.9,1.1); root.scale.setScalar(s); WILD.g.add(root);
  const a={ id, sp, root, la, lb, x, z, vx:0, vz:0, face:Math.random()*6.28, goal:null, state:'graze', t:Math.random()*5, fleeT:0, ph:Math.random()*6, s }; WILD.list.push(a); return a; }
const SETS={ SAVANNA:[['gazelle',3],['zebra',2],['giraffe',1],['elephant',1]], HILLS:[['deer',3]], MEADOW:[['deer',3]], ARCTIC:[['reindeer',2],['bear',2]], TUNDRA:[['reindeer',1]] };
const freeAt=(x,z)=>inField(x,z,8) && !inZone(x,z,6) && Math.hypot(x,z)>40 && Math.hypot(x,z-ARENA*0.55)>28 && !wetAt(x,z,2) && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+2);
export function buildWildlife(){ clearWildlife(); const set=SETS[BIOME.name]; if(!set) return; WILD.g=new THREE.Group(); scene.add(WILD.g);
  for(const [id,herds] of set) for(let h=0;h<Math.max(1, Math.round(herds*(MOBILE?0.6:1)));h++){ let cx=0, cz=0, ok=false; for(let t=0;t<40&&!ok;t++){ cx=_R(-ARENA+20,ARENA-20); cz=_R(-ARENA+20,ARENA-20); ok=freeAt(cx,cz); } if(!ok) continue;
    const sp=SPECIES[id], n=Math.round(_R(sp.herd[0], sp.herd[1])*(MOBILE?0.7:1)); for(let k=0;k<n;k++){ const a=Math.random()*6.28, r=Math.random()*7; const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r; if(inField(x,z,4)) spawn(id, x, z); } } }
// the nearest threat (any tank) to a point → [dx,dz,dist]
function threat(x, z){ let best=null, bd=1e9; const P=S.player; const chk=(o)=>{ const d=Math.hypot(o.pos.x-x, o.pos.z-z); if(d<bd){ bd=d; best=o; } };
  if(P) chk(P); for(const e of enemies) if(solidTank(e)) chk(e); for(const t of ALLY_TANKS) chk(t); return best ? [x-best.pos.x, z-best.pos.z, bd] : null; }
export function updateWildlife(dt, now){ if(!WILD.list.length) return;
  for(const a of WILD.list){ const sp=a.sp; a.t-=dt; const T=threat(a.x, a.z); let speed=0, dirx=0, dirz=0;
    if(T && T[2]<sp.flee*(a.state==='flee'?1.4:1)){ a.state='flee'; a.fleeT=3+Math.random()*2; const L=T[2]||1; dirx=T[0]/L; dirz=T[1]/L; const j=Math.sin(now*1.7+a.ph)*0.35; const c=Math.cos(j), s=Math.sin(j); [dirx,dirz]=[dirx*c-dirz*s, dirx*s+dirz*c]; speed=sp.run; }
    else if(a.state==='flee'){ a.fleeT-=dt; if(a.fleeT<=0){ a.state='graze'; a.t=_R(2,6); } else { dirx=Math.sin(a.face); dirz=Math.cos(a.face); speed=sp.run*0.6; } }
    else { if(a.t<=0){ if(a.goal){ a.goal=null; a.t=_R(3,8); } else { const r=_R(4,12), an=Math.random()*6.28; a.goal=[a.x+Math.cos(an)*r, a.z+Math.sin(an)*r]; a.t=_R(4,9); } }
      if(a.goal){ const dx=a.goal[0]-a.x, dz=a.goal[1]-a.z, L=Math.hypot(dx,dz); if(L<0.8) a.goal=null; else { dirx=dx/L; dirz=dz/L; speed=sp.walk; } } }
    a.vx+=(dirx*speed-a.vx)*Math.min(1,dt*3); a.vz+=(dirz*speed-a.vz)*Math.min(1,dt*3); a.x+=a.vx*dt; a.z+=a.vz*dt;
    if(wetAt(a.x,a.z,0)){ a.x-=a.vx*dt*1.2; a.z-=a.vz*dt*1.2; a.vx*=-0.3; a.vz*=-0.3; }
    for(const b of blocks){ const dx=a.x-b.x, dz=a.z-b.z; if(Math.abs(dx)>b.r+1.5 || Math.abs(dz)>b.r+1.5) continue; const q=Math.hypot(dx,dz), rr=b.r+0.9; if(q<rr && q>1e-3){ a.x=b.x+dx/q*rr; a.z=b.z+dz/q*rr; } }
    const p={ x:a.x, z:a.z }; if(clampField(p, 6)){ a.x=p.x; a.z=p.z; a.vx*=-0.5; a.vz*=-0.5; }
    const v=Math.hypot(a.vx,a.vz); if(v>0.2){ const want=Math.atan2(a.vx,a.vz), d=Math.atan2(Math.sin(want-a.face),Math.cos(want-a.face)); a.face+=d*Math.min(1,dt*6); }
    a.ph+=dt*(1.5+v*1.6); const sw=Math.min(0.55, v*0.08)*Math.sin(a.ph*2.2); a.la.rotation.x=sw; a.lb.rotation.x=-sw;
    const bob = v>0.3 ? Math.abs(Math.sin(a.ph*2.2))*Math.min(0.18, v*0.02) : 0, graze = (v<0.3 && a.state==='graze') ? 0.08*Math.sin(now*1.3+a.ph) : 0;
    a.root.position.set(a.x, heightAt(a.x,a.z)+bob, a.z); a.root.rotation.set(graze*0.5, a.face, 0); } }
