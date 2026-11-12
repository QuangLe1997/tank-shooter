// actors/wildlife.js — Z143 WILDLIFE: herds that graze, wander and bolt from tanks — gazelles, zebras, giraffes and elephants on the savanna,
//   deer on the hills and meadows, reindeer and polar bears in the Arctic. Low-poly, vertex-coloured; legs swing in a trot (diagonal pairs).
//   They are scenery that reacts — not targets: shells and tracks never hurt them, they just get out of the way.
import * as THREE from 'three';
import { ALLY_TANKS, ARENA, BIOME, MOBILE, S, _R, _mergeColored, blocks, clampField, enemies, heightAt, inField, inZone, scene, solidTank, wetAt } from '../hub.js';

const box=(P,w,h,d,x,y,z,col,rx,rz)=>{ const g=new THREE.BoxGeometry(w,h,d); if(rx) g.rotateX(rx); if(rz) g.rotateZ(rz); g.translate(x,y,z); P.push({ geo:g, col }); };
const cyl=(P,r1,r2,h,x,y,z,col,rx)=>{ const g=new THREE.CylinderGeometry(r1,r2,h,6); if(rx) g.rotateX(rx); g.translate(x,y,z); P.push({ geo:g, col }); };
// species: body builder (head toward +z), leg length, leg colour, hip spread, speeds, flee radius, herd size
const SPECIES = {
  gazelle:{ leg:0.75, legC:0xa07a4a, legR:0.05, hx:0.18, hz:0.45, walk:1.6, run:13, flee:30, herd:[6,10], body(P){ box(P,0.5,0.45,1.15,0,1.0,0,0xc08a52); box(P,0.42,0.12,1.0,0,0.8,0,0xf2ead8); cyl(P,0.09,0.12,0.6,0,1.35,0.55,0xc08a52,-0.6); box(P,0.18,0.18,0.32,0,1.62,0.78,0xc08a52);
    for(const s of [-1,1]){ const h=new THREE.ConeGeometry(0.025,0.45,4); h.rotateX(-0.5); h.translate(s*0.06,1.9,0.66); P.push({ geo:h, col:0x2a2420 }); } box(P,0.04,0.05,0.2,0,1.05,-0.62,0x2a2420); } },
  deer:{ leg:0.85, legC:0x6a4a30, legR:0.06, hx:0.2, hz:0.5, walk:1.4, run:11, flee:28, herd:[4,7], body(P){ box(P,0.55,0.55,1.3,0,1.15,0,0x8a5a36); box(P,0.4,0.1,0.9,0,0.92,0,0xd8c8a8); cyl(P,0.11,0.14,0.6,0,1.5,0.6,0x8a5a36,-0.5); box(P,0.2,0.2,0.36,0,1.78,0.84,0x8a5a36);
    for(const s of [-1,1]){ cyl(P,0.02,0.03,0.5,s*0.12,2.1,0.78,0x6a5030); cyl(P,0.015,0.02,0.3,s*0.24,2.25,0.8,0x6a5030); } box(P,0.12,0.12,0.06,0,1.2,-0.66,0xf0ece0); } },
  zebra:{ leg:0.85, legC:0x202020, legR:0.07, hx:0.22, hz:0.55, walk:1.3, run:12, flee:30, herd:[5,8], body(P){ for(let k=0;k<9;k++) box(P,0.62,0.62,0.16,0,1.2,-0.66+k*0.165, k%2?0x181818:0xf2f2ee);   // stripes
    cyl(P,0.14,0.18,0.7,0,1.6,0.72,0xf2f2ee,-0.7); for(let k=0;k<3;k++) box(P,0.3,0.06,0.3,0,1.45+k*0.18,0.66+k*0.1,0x181818,-0.7); box(P,0.22,0.24,0.48,0,1.92,1.02,0xf2f2ee); box(P,0.06,0.22,0.6,0,1.9,0.7,0x181818,-0.7); } },
  giraffe:{ leg:1.7, legC:0xd8a050, legR:0.08, hx:0.25, hz:0.6, walk:1.1, run:8, flee:34, herd:[3,5], body(P){ box(P,0.7,0.8,1.5,0,2.1,0,0xe0a858); cyl(P,0.13,0.2,2.4,0,3.4,0.75,0xe0a858,-0.35); box(P,0.24,0.26,0.55,0,4.6,1.25,0xe0a858);
    for(let k=0;k<14;k++) box(P,0.06,_R(0.14,0.24),_R(0.14,0.24), (k%2?1:-1)*0.36, _R(1.8,2.4), _R(-0.6,0.6), 0x8a4a20); for(let k=0;k<6;k++) box(P,0.28,0.12,0.12,0,2.8+k*0.33,0.5+k*0.12,0x8a4a20);
    for(const s of [-1,1]) cyl(P,0.03,0.03,0.25,s*0.08,4.85,1.15,0x5a3a20); } },
  elephant:{ leg:1.3, legC:0x7a7672, legR:0.24, hx:0.5, hz:0.8, walk:1.0, run:5, flee:26, herd:[3,5], body(P){ box(P,1.5,1.5,2.4,0,2.3,0,0x8a8682); box(P,1.0,1.0,0.9,0,2.6,1.5,0x8a8682);
    for(const s of [-1,1]){ box(P,0.1,1.0,0.8,s*0.62,2.6,1.35,0x7a7672); const t=new THREE.ConeGeometry(0.06,0.7,5); t.rotateX(1.9); t.translate(s*0.28,2.0,2.05); P.push({ geo:t, col:0xf2ead8 }); }
    cyl(P,0.12,0.2,1.5,0,1.7,2.05,0x8a8682,0.15); cyl(P,0.05,0.03,0.6,0,2.3,-1.25,0x6a6662,0.4); } },
  reindeer:{ leg:0.9, legC:0x5a4a3a, legR:0.07, hx:0.22, hz:0.55, walk:1.3, run:10, flee:28, herd:[5,9], body(P){ box(P,0.62,0.62,1.35,0,1.2,0,0x7a6a5a); box(P,0.5,0.4,0.4,0,1.35,0.6,0xe8e0d0); cyl(P,0.13,0.16,0.6,0,1.55,0.7,0x7a6a5a,-0.5); box(P,0.22,0.22,0.42,0,1.82,0.95,0x7a6a5a);
    for(const s of [-1,1]){ cyl(P,0.025,0.035,0.8,s*0.15,2.3,0.82,0xd8c8a8,-0.2); for(const t of [0.25,0.5]) cyl(P,0.02,0.02,0.35,s*(0.25+t*0.3),2.2+t*0.5,0.8,0xd8c8a8); } } },
  bear:{ leg:0.75, legC:0xe8e4dc, legR:0.16, hx:0.32, hz:0.62, walk:1.1, run:7, flee:24, herd:[1,2], body(P){ box(P,0.95,0.95,1.9,0,1.25,0,0xf2eee6); box(P,0.6,0.55,0.7,0,1.45,1.15,0xf2eee6); box(P,0.3,0.25,0.3,0,1.35,1.55,0xeae4da); box(P,0.12,0.1,0.06,0,1.42,1.71,0x1a1a1a);
    for(const s of [-1,1]) box(P,0.12,0.12,0.08,s*0.22,1.78,1.0,0xeae4da); } },
};
const GEO={}, MAT=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.9, metalness:0 });
function geos(id){ if(GEO[id]) return GEO[id]; const sp=SPECIES[id], P=[]; sp.body(P); const body=_mergeColored(P);
  const L=(dx,dz)=>{ const g=new THREE.CylinderGeometry(sp.legR, sp.legR*0.8, sp.leg, 5); g.translate(dx, -sp.leg/2, dz); return { geo:g, col:sp.legC }; };   // legs hang from the hip line (origin at hip height)
  const a=_mergeColored([L(sp.hx,sp.hz), L(-sp.hx,-sp.hz)]), b=_mergeColored([L(-sp.hx,sp.hz), L(sp.hx,-sp.hz)]);
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
