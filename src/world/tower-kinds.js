// world/tower-kinds.js — Z175 WATCHTOWER TYPES: seven real guard-tower builds in timber, steel and concrete — each land raises the kinds it would really have (bamboo + thatch by the river villages, log cabins in the snow, steel lattice by the works, hardened concrete in the desert and the cities). Each kind has its own height, guard posts (how many men = how much fire), hit points and footprint.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const nI=q=>{ const n=q.index?q.toNonIndexed():q; for(const a of Object.keys(n.attributes)) if(!['position','normal','uv'].includes(a)) n.deleteAttribute(a); n.clearGroups(); if(!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count*2),2)); return n; };
const _e=new THREE.Euler(), _mm=new THREE.Matrix4();
function xf(g, x,y,z, rx,ry,rz){ if(rx||ry||rz) g.applyMatrix4(_mm.makeRotationFromEuler(_e.set(rx||0,ry||0,rz||0,'YXZ'))); g.translate(x||0,y||0,z||0); return g; }
const BX=(w,h,d,x,y,z,rx,ry,rz)=>xf(new THREE.BoxGeometry(w,h,d),x,y,z,rx,ry,rz);
const CY=(r0,r1,h,n,x,y,z,rx,ry,rz,open)=>xf(new THREE.CylinderGeometry(r0,r1,h,n||10,1,!!open),x,y,z,rx,ry,rz);
const _up=new THREE.Vector3(0,1,0), _d=new THREE.Vector3(), _q=new THREE.Quaternion();
// a member from point a to point b (square timber / steel angle, or a round log / bamboo pole)
function beam(a, b, t, round){ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz)||1e-3, g=round?new THREE.CylinderGeometry(t,t,L,8):new THREE.BoxGeometry(t,L,t);
  g.applyQuaternion(_q.setFromUnitVectors(_up, _d.set(dx/L,dy/L,dz/L))); g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2); return g; }
// four legs from a base square (half-width b) to a top square (half-width t) — returns the leg point at height y on corner (sx,sz)
const legAt=(b,t,h,sx,sz,y)=>{ const k=y/h, w=b+(t-b)*k; return [sx*w, y, sz*w]; };
const CORN=[[-1,-1],[1,-1],[1,1],[-1,1]];
// trussed sides: horizontal girts at the given heights + an X between each pair
function truss(P, mat, b, t, h, ys, th, round){ for(let i=0;i<4;i++){ const [ax,az]=CORN[i], [bx,bz]=CORN[(i+1)%4];
    for(const y of ys) P[mat].push(beam(legAt(b,t,h,ax,az,y), legAt(b,t,h,bx,bz,y), th*0.75, round));
    for(let k=0;k<ys.length-1;k++){ const y0=ys[k], y1=ys[k+1]; P[mat].push(beam(legAt(b,t,h,ax,az,y0), legAt(b,t,h,bx,bz,y1), th*0.6, round), beam(legAt(b,t,h,bx,bz,y0), legAt(b,t,h,ax,az,y1), th*0.6, round)); } } }
function ladder(P, mat, x, z0, z1, h, cage){ const rail=(dx)=>P[mat].push(beam([x+dx,0,z0],[x+dx,h,z1],0.06)); rail(-0.24); rail(0.24);
  const n=Math.floor(h/0.32); for(let k=1;k<n;k++){ const u=k/n; P[mat].push(BX(0.48,0.04,0.05, x, h*u, z0+(z1-z0)*u)); }
  if(cage) for(let y=2.4;y<h;y+=0.9){ const u=y/h, g=new THREE.TorusGeometry(0.42,0.025,4,10,Math.PI); g.rotateX(Math.PI/2); g.rotateY(Math.PI); g.translate(x, y, z0+(z1-z0)*u); P[mat].push(g); } }
function railing(P, mat, half, y, th){ for(let i=0;i<4;i++){ const [ax,az]=CORN[i], [bx,bz]=CORN[(i+1)%4]; P[mat].push(beam([ax*half,y+1.05,az*half],[bx*half,y+1.05,bz*half],th), beam([ax*half,y+0.55,az*half],[bx*half,y+0.55,bz*half],th*0.8));
    for(let k=0;k<=3;k++){ const u=k/3; P[mat].push(BX(th,1.05,th, ax*half+(bx-ax)*half*u, y+0.52, az*half+(bz-az)*half*u)); } } }
function sandbagRing(P, half, y, skipSide){ for(let i=0;i<4;i++){ if(i===skipSide) continue; const [ax,az]=CORN[i], [bx,bz]=CORN[(i+1)%4], L=half*2, n=Math.round(L/1.0);
    for(let r=0;r<2;r++) for(let k=0;k<n;k++){ const u=(k+0.5+(r?0.5:0))/n; if(u>1) continue; const g=new RoundedBoxGeometry(0.95,0.3,0.45,1,0.11), x=ax*half+(bx-ax)*half*u, z=az*half+(bz-az)*half*u;
      g.rotateY(Math.atan2(bx-ax, bz-az)+Math.PI/2+(Math.random()-0.5)*0.08); g.translate(x, y+0.15+r*0.28, z); P.bags.push(g); } } }

// ---------------------------------------------------------------------------------------------------------------------------------------
// the kinds — h: floor of the post (m) · gy: where the guards stand · guards: [x,z] posts · sl: searchlight · r: footprint · hp: × TOWER.hp
export const TOWER_KINDS = {
  // TIMBER GUARD POST — splayed square-timber legs, X-braced, plank floor ringed with sandbags, tin roof on corner posts, open ladder
  wood: { vi:'THÁP GỖ', mat:'wood', h:7.6, r:2.1, hp:1.0, guards:[[-0.7,0.45],[0.7,-0.45]], build(P,h){
    for(const [sx,sz] of CORN) P.wood.push(beam([sx*2.0,0,sz*2.0],[sx*1.45,h,sz*1.45],0.24));
    truss(P,'wood',2.0,1.45,h,[0.45,h*0.5,h-0.15],0.22);
    P.wood.push(BX(3.6,0.2,3.6,0,h,0)); for(const z of [-1.2,0,1.2]) P.wood.push(BX(3.4,0.16,0.18,0,h-0.16,z));
    for(const [sx,sz] of CORN) P.wood.push(BX(0.14,2.4,0.14, sx*1.62,h+1.2,sz*1.62));
    sandbagRing(P, 1.62, h+0.1, 2); for(let k=-1;k<=1;k++) P.wood.push(BX(1.05,0.95,0.06, k*1.08,h+0.6,1.66));   // plank breastwork on the ladder side
    for(const sd of [-1,1]) P.tin.push(BX(4.3,0.06,2.35, 0,h+2.62,sd*1.08, sd*0.32,0,0));                       // pitched tin roof
    ladder(P,'wood',0,2.55,1.8,h,false); return { sl:[1.3,h+1.1,-1.3] }; } },
  // LOG WATCHTOWER (taiga / mountains) — round-log legs and braces, a log cabin with an all-round window band, plank gable roof
  log: { vi:'THÁP GỖ TRÒN', mat:'wood', h:8.0, r:2.3, hp:1.3, guards:[[0,1.35],[1.35,-0.2],[-1.35,-0.2]], build(P,h){
    for(const [sx,sz] of CORN) P.wood.push(beam([sx*2.1,0,sz*2.1],[sx*1.7,h,sz*1.7],0.18,true));
    truss(P,'wood',2.1,1.7,h,[0.5,h*0.5,h-0.2],0.18,true);
    P.wood.push(BX(4.1,0.26,4.1,0,h,0));
    const log=(x,y,z,len,alongX)=>P.wood.push(CY(0.13,0.13,len,8, x,y,z, alongX?0:Math.PI/2, 0, alongX?Math.PI/2:0));
    for(const y of [0.25,0.5,0.75,1.0, 1.75,2.0,2.25]) for(const sd of [-1,1]){ log(0,h+y,sd*1.9,4.0,true); log(sd*1.9,h+y,0,4.0,false); }   // walls, window band 1.1–1.6
    for(const [sx,sz] of CORN) P.wood.push(CY(0.12,0.12,1.0,6, sx*1.9,h+1.4,sz*1.9));
    for(const sd of [-1,1]) P.wood.push(BX(4.7,0.12,2.75, 0,h+3.05,sd*1.15, sd*0.5,0,0)); P.wood.push(CY(0.12,0.12,4.9,8, 0,h+3.68,0, 0,0,Math.PI/2));   // gable roof + ridge log
    ladder(P,'wood',0,2.9,2.05,h,false); return { sl:[0,h+3.9,-2.3] }; } },
  // BAMBOO LOOKOUT (river villages, savanna) — lashed bamboo poles with nodes, slatted floor, bamboo rail, steep thatched roof
  bamboo: { vi:'CHÒI TRE', mat:'bamboo', h:6.4, r:1.9, hp:0.75, guards:[[-0.6,0.4],[0.6,-0.4]], build(P,h){
    for(const [sx,sz] of CORN){ P.bamboo.push(CY(0.09,0.1,h+2.6,8, sx*1.5,(h+2.6)/2,sz*1.5)); for(let y=0.9;y<h+2.4;y+=1.1) P.bamboo.push(CY(0.105,0.105,0.05,8, sx*1.5,y,sz*1.5)); }
    for(let i=0;i<4;i++){ const [ax,az]=CORN[i], [bx,bz]=CORN[(i+1)%4]; P.bamboo.push(beam([ax*1.5,0.6,az*1.5],[bx*1.5,h-0.3,bz*1.5],0.06,true), beam([bx*1.5,0.6,bz*1.5],[ax*1.5,h-0.3,az*1.5],0.06,true), beam([ax*1.5,h+0.95,az*1.5],[bx*1.5,h+0.95,bz*1.5],0.055,true)); }
    for(let k=0;k<12;k++) P.bamboo.push(CY(0.06,0.06,3.3,6, 0,h,-1.5+k*0.27, 0,0,Math.PI/2));
    { const g=new THREE.ConeGeometry(2.9,2.2,4,1); g.rotateY(Math.PI/4); g.translate(0,h+3.5,0); P.thatch.push(g); const g2=new THREE.ConeGeometry(2.6,0.5,4,1,true); g2.rotateY(Math.PI/4); g2.translate(0,h+2.55,0); P.thatch.push(g2); }
    ladder(P,'bamboo',0,2.2,1.55,h,false); return { sl:[1.2,h+1.4,-1.2] }; } },
  // STEEL LATTICE TOWER (works, border posts, the far north) — tapered angle-iron legs with K-bracing, grated platform + rail, a steel cabin with a glazed band, caged ladder, antenna
  lattice: { vi:'THÁP THÉP GIÀN', mat:'steel', h:11, r:2.4, hp:1.7, guards:[[0,0.65],[0.65,-0.45],[-0.65,-0.45]], build(P,h){
    for(const [sx,sz] of CORN) P.steel.push(beam([sx*2.3,0,sz*2.3],[sx*1.25,h,sz*1.25],0.2));
    truss(P,'steel',2.3,1.25,h,[0.3,h*0.25,h*0.5,h*0.75,h-0.1],0.16);
    P.steel.push(BX(3.6,0.12,3.6,0,h,0)); railing(P,'steel',1.78,h,0.06);
    const C=1.35; for(let i=0;i<4;i++){ const ry=i*Math.PI/2, sx=Math.sin(ry), sz=Math.cos(ry);   // cabin walls: steel skirt · glazed band · steel head
      P.steel.push(BX(2.7,1.0,0.08, sx*C,h+0.56,sz*C, 0,ry,0), BX(2.7,0.45,0.08, sx*C,h+2.17,sz*C, 0,ry,0)); P.glass.push(BX(2.6,0.88,0.05, sx*C,h+1.5,sz*C, 0,ry,0)); }
    for(const [sx,sz] of CORN) P.steel.push(BX(0.1,2.4,0.1, sx*C,h+1.25,sz*C));
    P.steel.push(BX(3.3,0.14,3.3,0,h+2.47,0), CY(0.03,0.03,2.6,6, 1.2,h+3.8,-1.2)); ladder(P,'steel',1.95,2.75,1.95,h,true); return { sl:[-1.4,h+2.75,1.4] }; } },
  // STEEL COLUMN TOWER (cities, works) — one heavy tube on a concrete plinth, braced octagonal cabin with a wrap-round window band and a shallow steel cone roof
  column: { vi:'THÁP THÉP MỘT CỘT', mat:'steel', h:9, r:2.2, hp:1.5, guards:[[0.75,0.55],[-0.75,-0.55]], build(P,h){
    P.conc.push(CY(1.25,1.45,0.7,16, 0,0.35,0)); P.steel.push(CY(0.55,0.62,h,16, 0,h/2,0)); P.dark.push(BX(0.7,1.9,0.08, 0,1.6,0.6));
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4; P.steel.push(beam([Math.sin(a)*0.55,h-1.8,Math.cos(a)*0.55],[Math.sin(a)*1.9,h-0.05,Math.cos(a)*1.9],0.14)); }
    P.steel.push(CY(2.15,2.15,0.22,8, 0,h,0)); P.steel.push(CY(2.05,2.05,1.0,8, 0,h+0.6,0, 0,0,0,true)); P.glass.push(CY(2.0,2.0,0.9,8, 0,h+1.55,0, 0,0,0,true));
    P.steel.push(CY(2.05,2.05,0.4,8, 0,h+2.2,0, 0,0,0,true), CY(0.25,2.45,0.75,8, 0,h+2.77,0), CY(0.03,0.03,2.2,6, 0,h+4.1,0)); return { sl:[1.6,h+2.5,-1.0] }; } },
  // ROUND CONCRETE TOWER (desert, citadels, ruins) — cast shaft on a footing, rows of firing slits, a flared crown with a slotted parapet, sandbags + aerial on top
  round: { vi:'THÁP BÊ TÔNG TRÒN', mat:'conc', h:7.4, r:2.3, hp:2.4, guards:[[1.25,0],[-1.25,0],[0,1.25],[0,-1.25]], build(P,h){
    P.conc.push(CY(2.15,2.3,0.55,20, 0,0.27,0), CY(1.7,1.9,h,20, 0,h/2,0), CY(2.45,1.75,0.5,20, 0,h-0.1,0), CY(2.45,2.45,0.22,20, 0,h+0.08,0));
    for(const y of [2.4,4.8]) for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+y; P.dark.push(BX(0.5,0.16,0.12, Math.sin(a)*(1.86-y*0.02),y,Math.cos(a)*(1.86-y*0.02), 0,a,0)); }
    for(let k=0;k<14;k++){ const a=k/14*Math.PI*2; P.conc.push(BX(0.88,1.2,0.32, Math.sin(a)*2.3,h+0.79,Math.cos(a)*2.3, 0,a,0)); }   // parapet with a slot between every block
    P.dark.push(BX(0.9,2.0,0.1, 0,1.25,1.88)); P.steel.push(CY(0.03,0.03,2.4,6, -1.6,h+2.0,-1.0)); return { sl:[1.7,h+1.6,1.0] }; } },
  // HARDENED CONCRETE TOWER (desert, savanna, citadels, ruins) — tapered square shaft, slit-windowed cabin with an overhanging roof slab, sandbags and a camouflage net on top
  block: { vi:'THÁP BÊ TÔNG KHỐI', mat:'conc', h:7.0, r:2.4, hp:2.2, guards:[[0,1.35],[1.35,0.1],[-1.35,0.1]], build(P,h){
    { const g=new THREE.CylinderGeometry(1.55*Math.SQRT2, 2.0*Math.SQRT2, h, 4, 1); g.rotateY(Math.PI/4); g.translate(0,h/2,0); P.conc.push(g); }
    for(const y of [h*0.33,h*0.66]) P.conc.push(BX(2*(2.0-(2.0-1.55)*y/h)+0.08,0.08,2*(2.0-(2.0-1.55)*y/h)+0.08, 0,y,0));   // formwork lifts
    P.conc.push(BX(4.1,0.3,4.1,0,h,0)); const C=1.9;
    for(let i=0;i<4;i++){ const ry=i*Math.PI/2, sx=Math.sin(ry), sz=Math.cos(ry); P.conc.push(BX(3.9,1.1,0.3, sx*C,h+0.7,sz*C, 0,ry,0), BX(3.9,0.55,0.3, sx*C,h+2.1,sz*C, 0,ry,0));
      for(const u of [-1,0,1]) P.conc.push(BX(0.45,0.7,0.3, sx*C+Math.cos(ry)*u*1.72,h+1.55,sz*C-Math.sin(ry)*u*1.72, 0,ry,0)); }   // window band 1.2–1.9 m, two openings a side
    P.conc.push(BX(4.7,0.3,4.7,0,h+2.52,0)); sandbagRing(P, 2.05, h+2.67, -1);
    { const net=new THREE.PlaneGeometry(3.6,3.0,6,5), pp=net.attributes.position; for(let i=0;i<pp.count;i++) pp.setZ(i, (Math.random()-0.5)*0.3); net.rotateX(-Math.PI/2); net.translate(0.3,h+2.75,-0.2); P.net.push(net); }
    P.dark.push(BX(1.0,2.0,0.1, 0,1.2,2.0)); P.steel.push(CY(0.03,0.03,2.4,6, 1.7,h+4.0,1.7)); return { sl:[-1.6,h+3.0,1.6] }; } },
};
// which kinds each land builds (weights)
export const TOWER_BIOME = {
  DESERT:{ block:3, round:2, lattice:1 }, SAVANNA:{ bamboo:2, wood:2, block:1 }, TUNDRA:{ log:3, lattice:2, wood:1 }, ARCTIC:{ lattice:3, log:2 },
  FOUNDRY:{ lattice:3, column:2, round:1 }, CITADEL:{ round:3, block:2, wood:1 }, MEADOW:{ wood:3, log:2 }, CITY:{ column:3, round:2, lattice:1 },
  HILLS:{ log:2, wood:2, block:1 }, VILLAGE:{ bamboo:3, wood:2 }, RUINS:{ block:3, column:1, round:2 } };
export function pickTowerKind(biome){ const W=TOWER_BIOME[biome]||{ wood:1 }; let tot=0; for(const k in W) tot+=W[k]; let r=Math.random()*tot; for(const k in W){ if((r-=W[k])<=0) return k; } return 'wood'; }
// merged geometry per material for one kind (built once, shared by every tower of that kind)
const _TK={};
export function towerKindGeo(id){ if(_TK[id]) return _TK[id]; const K=TOWER_KINDS[id];
  const P={ wood:[], tin:[], steel:[], conc:[], glass:[], dark:[], bamboo:[], thatch:[], bags:[], net:[] }; const extra=K.build(P, K.h)||{};
  const geo={}; for(const m in P) if(P[m].length) geo[m]=mergeGeometries(P[m].map(nI), false);
  return (_TK[id]={ geo, sl:extra.sl||[1.2,K.h+1.0,-1.2] }); }
