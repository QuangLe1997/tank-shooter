// world/cars.js — Z206 REAL STREET VEHICLES: every car is built from its true side silhouette (extruded with rounded edges, wheel arches cut in),
//   a narrower cabin on top with pillars, glass set into the windscreen / rear screen / side windows, lathed tyres on alloy rims, bumpers, grille,
//   head- and tail-lamps, mirrors, number plates. Seven bodies (sedan · hatchback · SUV · pickup · minivan · taxi · small box truck) and a proper
//   Vietnamese step-through scooter. Each body is two instanced draws: the PAINT (tinted per car, dusty clear-coat) and the TRIM (tyres, glass,
//   chrome, lamps — per-vertex roughness/metalness so glass gleams and rubber doesn't). Some cars are burnt-out wrecks: charred, sitting low on flat tyres.
//   Tanks flatten them (decor.js crushAt kind 'car').
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { REALCITY } from '../../config.js';
import { LAND, MOBILE, arena, carModel, crushables, detailize, heightAt } from '../hub.js';

// ---------- merging with per-vertex colour + roughness/metalness ----------
function mergeRM(parts){ const geos=[];
  for(const p of parts){ let g=p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if(!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv') g.deleteAttribute(k);
    const n=g.attributes.position.count, c=new Float32Array(n*3), rm=new Float32Array(n*2), cc=new THREE.Color(p.col);
    for(let i=0;i<n;i++){ c[i*3]=cc.r; c[i*3+1]=cc.g; c[i*3+2]=cc.b; rm[i*2]=p.r??0.6; rm[i*2+1]=p.m??0.1; }
    g.setAttribute('color', new THREE.BufferAttribute(c,3)); g.setAttribute('aRM', new THREE.BufferAttribute(rm,2)); geos.push(g); p.geo.dispose(); }
  const m=mergeGeometries(geos, false); geos.forEach(g=>g.dispose()); const w=mergeVertices(m, 1e-4); m.dispose(); return w; }   // Z211 welded + indexed: a fraction of the vertices to transform (×2 with shadows)
let _paint=null, _trim=null;
function paintMat(){ if(_paint) return _paint; const m=new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.3, metalness:0.5, envMapIntensity:1.35 });
  detailize(m, { scale:0.7, bump:0.003, alb:0.16, foot:0.9, streak:0.08, dust:0.22 }); LAND.mats.push(m); return (_paint=m); }
function trimMat(){ if(_trim) return _trim; const m=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:1, envMapIntensity:1.5 });
  m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 aRM; varying vec2 vRM;').replace('#include <begin_vertex>','#include <begin_vertex>\n  vRM=aRM;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vRM;')
      .replace('#include <roughnessmap_fragment>','float roughnessFactor = roughness*vRM.x;').replace('#include <metalnessmap_fragment>','float metalnessFactor = metalness*vRM.y;'); };
  m.customProgramCacheKey=()=>'carTrimRM'; LAND.mats.push(m); return (_trim=m); }

// ---------- part helpers ----------
const RUBBER={ col:0x161616, r:0.92, m:0.0 }, GLASS={ col:0x1c2a34, r:0.06, m:0.9 }, CHROME={ col:0xc8ccd0, r:0.18, m:1.0 }, PLASTIC={ col:0x1e1f20, r:0.7, m:0.05 },
  HEAD={ col:0xf2f0e4, r:0.1, m:0.6 }, TAIL={ col:0xa8141a, r:0.15, m:0.3 }, AMBER={ col:0xe88a1a, r:0.2, m:0.3 }, ALLOY={ col:0x9a9ea4, r:0.3, m:0.9 }, DARK={ col:0x2a2c2e, r:0.6, m:0.3 };
function box(L, w,h,d, x,y,z, mat, rx, ry){ const g=new THREE.BoxGeometry(w,h,d); if(rx) g.rotateX(rx); if(ry) g.rotateY(ry); g.translate(x,y,z); L.push({ geo:g, ...mat }); }
function cyl(L, r0,r1,h,seg, x,y,z, mat, axis){ const g=new THREE.CylinderGeometry(r0,r1,h,seg); if(axis==='x') g.rotateZ(Math.PI/2); else if(axis==='z') g.rotateX(Math.PI/2); g.translate(x,y,z); L.push({ geo:g, ...mat }); }
// a side profile (in car frame: u = along the car, +front; v = up) extruded across the width, rounded edges
function slab(pts, width, bevel, arches){ const s=new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for(let i=1;i<pts.length;i++){ const p=pts[i]; if(p[2]==='q') { s.quadraticCurveTo(p[3],p[4],p[0],p[1]); continue; }
    s.lineTo(p[0],p[1]); }
  const g=new THREE.ExtrudeGeometry(s, { depth:width-bevel*2, bevelEnabled:bevel>0, bevelThickness:bevel, bevelSize:bevel*0.8, bevelSegments:2, curveSegments:6 });
  g.translate(0,0,-(width-bevel*2)/2); g.rotateY(-Math.PI/2); return g; }   // extrude axis → car x (width), profile u → car z
// lathed tyre + alloy face (spokes) — wheel centred at (x, r, z), axle along x
function wheel(L, x, r, z, tw, side, spokes, wreck){
  const pr=[[r*0.6,-tw/2],[r*0.9,-tw/2],[r,-tw/2+tw*0.22],[r,tw/2-tw*0.22],[r*0.9,tw/2],[r*0.6,tw/2]].map(([a,b])=>new THREE.Vector2(a,b));
  if(!wreck){ const t=new THREE.LatheGeometry(pr, 12); t.rotateZ(Math.PI/2); t.translate(x,r,z); L.push({ geo:t, ...RUBBER }); }
  const rimR=r*(wreck?0.72:0.64), face=x+side*(tw/2-0.03);
  cyl(L, rimR, rimR, tw*0.9, 10, x, r, z, wreck?{ col:0x3a2a20, r:0.9, m:0.3 }:{ col:0x3a3c3e, r:0.6, m:0.5 }, 'x');               // rim barrel
  cyl(L, rimR*0.98, rimR*0.98, 0.02, 10, face, r, z, wreck?{ col:0x4a3426, r:0.9, m:0.2 }:DARK, 'x');                              // brake-dark rim well
  if(!wreck){ const ring=new THREE.TorusGeometry(rimR*0.93, 0.028, 3, 12); ring.rotateY(Math.PI/2); ring.translate(face+side*0.012, r, z); L.push({ geo:ring, ...ALLOY }); }   // alloy lip
  if(!wreck) for(let k=0;k<spokes;k++){ const a=k/spokes*Math.PI*2, g=new THREE.BoxGeometry(0.03, rimR*0.9, 0.07); g.translate(0, rimR*0.45, 0); g.rotateX(a); g.translate(face+side*0.012, r, z); L.push({ geo:g, ...ALLOY }); }
  cyl(L, rimR*0.22, rimR*0.22, 0.05, 8, face+side*0.02, r, z, wreck?DARK:CHROME, 'x'); }   // hub cap

// ---------- one body builder for every car shape ----------
// o: L,W,cl(ground clearance),rw(wheel r),wb(wheel base),noseH,beltF,beltR,tailH,a(windscreen base u),b(roof front u),c(roof rear u),d(rear screen base u),roofH,…
function carBody(o){ const P=[], T=[], L=o.L, W=o.W, cl=o.cl, rw=o.rw, ra=rw+0.1, fw=o.wb/2+(o.wOff||0), rwz=-o.wb/2+(o.wOff||0), h=L/2;
  // lower body: rear bumper → wheel arches → nose → hood → (cabin base) → deck → tail
  const low=[[-h+0.06, cl+0.12],[-h+0.2, cl],[rwz-ra, cl],[rwz-ra, rw],[rwz-ra*0.7, rw+ra*0.71,'q',rwz-ra, rw+ra*0.55],[rwz, rw+ra,'q',rwz-ra*0.4, rw+ra],[rwz+ra*0.7, rw+ra*0.71,'q',rwz+ra*0.4, rw+ra],[rwz+ra, rw,'q',rwz+ra, rw+ra*0.55],[rwz+ra, cl],
    [fw-ra, cl],[fw-ra, rw],[fw-ra*0.7, rw+ra*0.71,'q',fw-ra, rw+ra*0.55],[fw, rw+ra,'q',fw-ra*0.4, rw+ra],[fw+ra*0.7, rw+ra*0.71,'q',fw+ra*0.4, rw+ra],[fw+ra, rw,'q',fw+ra, rw+ra*0.55],[fw+ra, cl],
    [h-0.22, cl],[h, cl+0.16,'q',h, cl],[h-0.04, o.noseH,'q',h+0.02, (cl+o.noseH)/2+0.1],[o.a, o.beltF,'q',h*0.55+o.a*0.45, o.noseH+0.08]];
  if(o.bed){ low.push([o.d, o.beltR],[o.d, o.bedY],[-h+0.12, o.bedY],[-h+0.12, o.beltR],[-h, o.beltR-0.04],[-h, cl+0.16,'q',-h-0.02, (cl+o.beltR)/2]); }
  else { low.push([o.d, o.beltR],[-h+0.1, o.tailH,'q',(o.d-h)/2, o.beltR+0.02],[-h, cl+0.16,'q',-h-0.04, (cl+o.tailH)/2+0.05]); }
  P.push({ geo:slab(low, W, 0.07) });
  // cabin (narrower: tumblehome) — pillars + roof in paint, glass set into it
  const cw=W*(o.cab||0.86), rb=o.roofH;
  const cab=[[o.a, o.beltF-0.02],[o.b, rb-0.02],[(o.b+o.c)/2, rb+0.03,'q',o.b-0.12, rb+0.02],[o.c, rb-0.02,'q',o.c+0.12, rb+0.02],[o.d, o.beltR-0.02]];
  P.push({ geo:slab(cab, cw, 0.05) });
  // side windows: the cabin outline shrunk in, a hair wider than the cabin so it shows on both flanks; B (and C) pillar painted over it
  const ia=o.a-0.2, id=o.d+(o.c-o.d>0.15?0.16:0.04), wy0=Math.max(o.beltF,o.beltR)+0.06;
  const win=[[ia, wy0],[o.b-0.04, rb-0.08],[o.c+0.05, rb-0.08],[id, wy0]];
  T.push({ geo:slab(win, cw+0.03, 0), ...GLASS });
  for(const u of (o.pillars||[(o.b+o.c)/2])) box(P, cw+0.05, rb-wy0-0.02, 0.09, 0, (rb+wy0)/2-0.02, u, {});
  // windscreen + rear screen: quads laid along the slope, just proud of it
  for(const [u0,y0,u1,y1] of [[o.a,o.beltF,o.b,rb],[o.c,rb,o.d,o.beltR]]){ const du=u1-u0, dy=y1-y0, len=Math.hypot(du,dy), g=new THREE.PlaneGeometry(cw*0.92, len*0.84);
    // plane lies in XY (normal +z); tilt it so its height runs along the slope, facing outward (front screen faces +u, rear faces -u)
    const front=(u0+u1)/2>((o.b+o.c)/2); g.rotateX(-Math.atan2(Math.abs(du), Math.abs(dy))); if(!front) g.rotateY(Math.PI);
    const nx=front?Math.abs(dy):-Math.abs(dy), ny=Math.abs(du), nl=Math.hypot(nx,ny)||1; g.translate(0, (y0+y1)/2+ny/nl*0.06, (u0+u1)/2+nx/nl*0.06); T.push({ geo:g, ...GLASS }); }
  // bumpers, grille, lamps, plates, mirrors, sills
  const fy=cl+0.2, ry=cl+0.22;
  box(T, W+0.02, 0.2, 0.16, 0, fy, h-0.04, PLASTIC); box(T, W+0.02, 0.2, 0.16, 0, ry, -h+0.04, PLASTIC);
  box(T, W*0.42, (o.noseH-fy)*0.5, 0.05, 0, (o.noseH+fy)/2+0.02, h-0.005, { col:0x141516, r:0.4, m:0.6 });                     // grille
  for(const sx of [-1,1]){ box(T, 0.36, 0.13, 0.08, sx*(W/2-0.26), o.noseH-0.1, h-0.03, HEAD); box(T, 0.1, 0.06, 0.06, sx*(W/2-0.06), o.noseH-0.12, h-0.06, AMBER);
    box(T, 0.34, 0.14, 0.06, sx*(W/2-0.22), (o.bed?o.beltR:o.tailH)-0.14, -h+0.01, TAIL);
    box(T, 0.06, 0.1, 0.16, sx*(cw/2+0.1), o.beltF+0.12, o.a-0.12, PLASTIC); box(P, 0.12, 0.1, 0.18, sx*(cw/2+0.14), o.beltF+0.12, o.a-0.14, {});   // mirror arm + painted cap
    box(T, 0.02, 0.1, Math.abs(o.d-o.a)*0.9, sx*(W/2+0.005), cl+0.14, (o.a+o.d)/2, PLASTIC);                                         // sill / rocker trim
    box(T, 0.015, 0.03, 0.14, sx*(W/2+0.012), o.beltF-0.12, (o.a+o.d)/2+0.35, CHROME); box(T, 0.015, 0.03, 0.14, sx*(W/2+0.012), o.beltF-0.12, (o.a+o.d)/2-0.55, CHROME); }   // door handles
  box(T, 0.52, 0.12, 0.02, 0, fy+0.02, h+0.05, { col:0xeceae0, r:0.4, m:0.2 }); box(T, 0.52, 0.12, 0.02, 0, ry+0.06, -h-0.05, { col:0xeceae0, r:0.4, m:0.2 });   // plates
  // undertray so you never see daylight through the body, then wheels
  box(T, W-0.3, 0.1, L-0.5, 0, cl+0.04, 0, DARK);
  for(const [u] of [[fw],[rwz]]) for(const sx of [-1,1]) wheel(T, sx*(W/2-0.16), rw, u, 0.24, sx, o.spokes||5, false);
  return { P, T }; }

const SEDAN={ L:4.55, W:1.8, cl:0.16, rw:0.32, wb:2.7, noseH:0.72, beltF:0.9, beltR:0.92, tailH:0.86, a:0.95, b:0.12, c:-0.98, d:-1.55, roofH:1.42 };
const MODELS=[
  { name:'sedan', w:5, cr:1.6, make:()=>carBody(SEDAN) },
  { name:'hatch', w:4, cr:1.45, make:()=>carBody({ L:3.95, W:1.72, cl:0.16, rw:0.31, wb:2.5, noseH:0.74, beltF:0.92, beltR:0.98, tailH:0.96, a:0.78, b:0.02, c:-1.3, d:-1.88, roofH:1.48, pillars:[-0.55, -1.25], spokes:6 }) },
  { name:'suv', w:3, cr:1.75, make:()=>{ const B=carBody({ L:4.75, W:1.9, cl:0.26, rw:0.38, wb:2.8, noseH:0.98, beltF:1.12, beltR:1.16, tailH:1.12, a:1.08, b:0.35, c:-1.86, d:-2.22, roofH:1.82, pillars:[-0.45, -1.7], spokes:6 });
      for(const sx of [-1,1]) box(B.T, 0.05, 0.05, 2.0, sx*0.72, 1.86, -0.75, DARK); box(B.T, 1.5, 0.04, 0.05, 0, 1.87, 0.2, DARK); box(B.T, 1.5, 0.04, 0.05, 0, 1.87, -1.7, DARK);   // roof rails
      cyl(B.T, 0.36, 0.36, 0.22, 14, 0, 1.05, -2.45, RUBBER, 'z'); return B; } },                                                         // spare wheel on the tailgate
  { name:'pickup', w:3, cr:1.85, make:()=>{ const W=1.88, B=carBody({ L:5.3, W, cl:0.26, rw:0.38, wb:3.1, noseH:1.0, beltF:1.12, beltR:1.12, tailH:1.1, a:1.25, b:0.65, c:-0.45, d:-0.62, roofH:1.82, bed:true, bedY:0.7, pillars:[0.1], spokes:6 });
      box(B.P, 0.08, 0.36, 2.0, W/2-0.08, 0.94, -1.62, {}); box(B.P, 0.08, 0.36, 2.0, -W/2+0.08, 0.94, -1.62, {}); box(B.P, W, 0.36, 0.08, 0, 0.94, -0.62, {});   // bed walls
      box(B.T, W-0.2, 0.03, 1.95, 0, 0.72, -1.62, { col:0x2a2a28, r:0.85, m:0.2 }); for(const sx of [-1,1]) box(B.T, 0.06, 0.06, 1.95, sx*(W/2-0.04), 1.13, -1.62, DARK);   // bed liner + rails
      box(B.T, 1.0, 0.06, 0.06, 0, 1.3, -0.68, DARK); return B; } },                                                                       // headache bar
  { name:'van', w:3, cr:1.9, make:()=>carBody({ L:4.95, W:1.92, cl:0.2, rw:0.34, wb:3.0, noseH:0.98, beltF:1.12, beltR:1.18, tailH:1.15, a:1.7, b:1.0, c:-2.38, d:-2.45, roofH:2.05, pillars:[0.2, -0.85, -1.9], spokes:5, cab:0.95, wOff:-0.1 }) },
  { name:'taxi', w:2, cr:1.6, taxi:true, make:()=>{ const B=carBody(SEDAN); box(B.T, 0.7, 0.2, 0.26, 0, 1.55, -0.4, { col:0xf4f2e8, r:0.3, m:0.1 }); box(B.T, 0.72, 0.05, 0.28, 0, 1.45, -0.4, DARK); return B; } },
  { name:'truck', w:2, cr:2.1, truck:true, make:()=>{ const W=1.98, B=carBody({ L:5.7, W, cl:0.3, rw:0.4, wb:3.3, noseH:1.15, beltF:1.3, beltR:1.3, tailH:1.25, a:2.25, b:1.85, c:0.95, d:0.9, roofH:2.25, bed:true, bedY:0.95, pillars:[1.4], spokes:8, wOff:-0.1 });
      const cb=[]; box(cb, W+0.06, 2.0, 3.6, 0, 1.98, -0.98, { col:0xe6e6de, r:0.55, m:0.25 }); for(let k=0;k<7;k++) box(cb, W+0.1, 2.0, 0.05, 0, 1.98, -2.7+k*0.57, { col:0xcacac2, r:0.5, m:0.4 });   // ribbed cargo box
      box(cb, 0.02, 1.8, 1.6, 0, 1.95, -2.79, {}); box(cb, 0.04, 1.85, 0.04, 0, 1.95, -2.8, CHROME); box(cb, W*0.9, 0.04, 0.04, 0, 1.5, -2.81, DARK);
      for(const q of cb){ if(q.col===undefined) q.col=0xd8d8d0; B.T.push(q); } return B; } },
];

// ---------- Vietnamese step-through scooter ----------
function scooter(){ const P=[], T=[];
  for(const z of [0.64,-0.6]){ const t=new THREE.TorusGeometry(0.25,0.065,5,12); t.rotateY(Math.PI/2); t.translate(0,0.3,z); T.push({ geo:t, ...RUBBER }); cyl(T, 0.17,0.17,0.07,8, 0,0.3,z, ALLOY, 'x'); cyl(T, 0.05,0.05,0.12,5, 0,0.3,z, CHROME, 'x'); }
  // body: front shield, floorboard, rear cowl — one side profile
  P.push({ geo:slab([[0.52,0.98],[0.36,0.42,'q',0.5,0.6],[0.18,0.28],[-0.22,0.3],[-0.4,0.62,'q',-0.36,0.38],[-0.78,0.66,'q',-0.62,0.58],[-0.86,0.76],[-0.5,0.82,'q',-0.74,0.84],[-0.18,0.72],[-0.1,0.36],[0.26,0.38],[0.44,1.0]], 0.34, 0.04) });
  { const g=new THREE.TorusGeometry(0.36, 0.05, 3, 8, 1.9); g.rotateZ(0.4); g.rotateY(Math.PI/2); g.translate(0, 0.3, 0.64); P.push({ geo:g }); }   // front mudguard arc
  box(T, 0.28, 0.08, 0.62, 0, 0.86, -0.42, { col:0x1a1a1a, r:0.75, m:0.0 });                                                       // seat
  box(T, 0.04, 0.8, 0.04, 0, 0.68, 0.53, CHROME, -0.3);                                                                              // raked fork
  box(T, 0.66, 0.035, 0.035, 0, 1.08, 0.42, PLASTIC); box(P, 0.22, 0.12, 0.16, 0, 1.06, 0.44, {});                               // bars + headlight cowl
  box(T, 0.14, 0.08, 0.04, 0, 1.02, 0.53, HEAD); box(T, 0.16, 0.06, 0.04, 0, 0.74, -0.86, TAIL); box(T, 0.18, 0.12, 0.02, 0, 0.6, -0.88, { col:0xeceae0, r:0.4, m:0.2 });   // lamps + plate
  for(const sx of [-1,1]){ box(T, 0.012, 0.18, 0.012, sx*0.24, 1.18, 0.42, CHROME); box(T, 0.06, 0.04, 0.02, sx*0.25, 1.28, 0.42, GLASS); }   // mirrors
  cyl(T, 0.045,0.05,0.42,8, 0.13,0.34,-0.5, CHROME, 'z');                                                                                  // exhaust
  return { P, T }; }

// ---------- building + placing ----------
let _built=null;
function built(){ if(_built) return _built; _built={ cars:MODELS.map(M=>{ const B=M.make(); return { ...M, paint:mergeRM(B.P.map(q=>({ col:0xffffff, r:1, m:1, ...q }))), trim:mergeRM(B.T) }; }) };
  const S=scooter(); _built.moto={ paint:mergeRM(S.P.map(q=>({ col:0xffffff, ...q }))), trim:mergeRM(S.T) }; return _built; }
export const CAR_PAINT=[0xc8c8c8,0xf0f0ee,0x1e1e20,0x7a1416,0x1a3470,0x5e6266,0xd8c8a0,0x2e4a34,0x9a9ea2,0xb84a1a,0x3a6a8a,0xe8e4d8];
const WRECK=[0x2a2420,0x3e2a1e,0x5a3a26,0x1e1c1a];
// pick a body for each parked car; a share are burnt-out wrecks (charred, lower, skewed, glassless)
export function pickCar(o, wrecks){ const B=built().cars, tot=B.reduce((a,m)=>a+m.w,0); let r=Math.random()*tot, i=0; for(;i<B.length-1;i++){ r-=B[i].w; if(r<0) break; }
  o.m=i; const m=B[i]; o.wreck=Math.random()<(wrecks??0.08);
  o.col= o.wreck ? WRECK[(Math.random()*WRECK.length)|0] : m.taxi ? [0xf0f0ea,0x2a8a4a,0xf2c018][(Math.random()*3)|0] : m.truck ? [0x2a4a8a,0xe8e4d8,0x8a1a1a][(Math.random()*3)|0] : CAR_PAINT[(Math.random()*CAR_PAINT.length)|0];
  if(o.wreck){ o.ry+= (Math.random()-0.5)*0.9; o.tilt=(Math.random()-0.5)*0.12; o.sink=0.1; } return o; }
const _M=new THREE.Matrix4(), _Q=new THREE.Quaternion(), _E=new THREE.Euler(), _V=new THREE.Vector3(), _S=new THREE.Vector3(1,1,1), _C=new THREE.Color(), _W=new THREE.Color(0x6a6060);
function draw(paint, trim, list, cr, kind){ const shadow=!MOBILE && kind==='car'; if(!list.length) return; const pm=new THREE.InstancedMesh(paint, paintMat(), list.length), tm=new THREE.InstancedMesh(trim, trimMat(), list.length);
  const lift=kind==='moto' ? REALCITY.lift.walk : REALCITY.lift.road;   // Z271 on the raised road / pavement, not sunk into it
  list.forEach((o,k)=>{ _M.compose(_V.set(o.x, heightAt(o.x,o.z)+lift-(o.sink||0), o.z), _Q.setFromEuler(_E.set(o.tilt||0, o.ry, (o.tilt||0)*0.6)), _S.set(1,1,1)); pm.setMatrixAt(k,_M); tm.setMatrixAt(k,_M);
    pm.setColorAt(k, _C.setHex(o.col)); tm.setColorAt(k, o.wreck ? _W : _C.setHex(0xffffff));                                     // a wreck's trim is soot-darkened too
    crushables.push({ x:o.x, z:o.z, r:cr, im:pm, ims:[tm], k, alive:true, kind, ry:o.ry, s:1, land:true }); });
  for(const im of [pm,tm]){ im.instanceMatrix.needsUpdate=true; im.instanceColor.needsUpdate=true; im.castShadow=shadow; im.receiveShadow=true; im.computeBoundingSphere(); arena.add(im); LAND.meshes.push(im); }
  if(kind==='car') contactShadow(2.3, 5.0, list.length, pm.instanceMatrix); else contactShadow(0.75, 1.9, list.length, pm.instanceMatrix); }
// Z264 a body drawn as its Meshy model: one instanced mesh (the model brings its own glass, trim, tyres), its paint tinted toward the car's colour
//   (taxis and the bus keep their livery), a wreck charred; crushable and burnable like the rest
const _RG={};
function drawReal(R, list, cr, kind, livery){ if(!list.length) return; const k=R.key, L=(REALCITY.cars[k]||{}).L||4.6;
  if(!_RG[k]){ const g=R.geo.clone(), sc=L/Math.max(R.size.x, R.size.z); g.scale(sc,sc,sc); g.computeBoundingSphere(); _RG[k]=g; }
  const im=new THREE.InstancedMesh(_RG[k], R.mat, list.length), shadow=!MOBILE, wc=new THREE.Color(0x3a3430);
  list.forEach((o,i)=>{ _M.compose(_V.set(o.x, heightAt(o.x,o.z)+REALCITY.lift.road-(o.sink||0), o.z), _Q.setFromEuler(_E.set(o.tilt||0, o.ry, (o.tilt||0)*0.6)), _S.set(1,1,1)); im.setMatrixAt(i,_M);
    im.setColorAt(i, o.wreck ? wc : livery ? _C.setHex(0xffffff) : _C.setHex(0xffffff).lerp(_W.setHex(o.col), REALCITY.carTint)); _W.setHex(0x6a6060);
    crushables.push({ x:o.x, z:o.z, r:cr, im, ims:[], k:i, alive:true, kind, ry:o.ry, s:1, land:true }); });
  im.instanceMatrix.needsUpdate=true; im.instanceColor.needsUpdate=true; im.castShadow=shadow; im.receiveShadow=true; im.computeBoundingSphere(); arena.add(im); LAND.meshes.push(im);
  const sz=_RG[k].boundingSphere ? new THREE.Box3().setFromBufferAttribute(_RG[k].attributes.position).getSize(new THREE.Vector3()) : null; if(sz) contactShadow(sz.x*1.12, sz.z*1.06, list.length, im.instanceMatrix); }
// Z271 CONTACT SHADOWS: a soft dark patch under each vehicle (an instanced quad on the vehicle's own instance matrices, so it follows it
//   moving, crushed or burnt) — it seats the vehicle on the road where the shadow map is too coarse to; w × l in the instance's own units
let _csTex=null;
function csTex(){ if(_csTex) return _csTex; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), g=x.createRadialGradient(32,32,4,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.55,'rgba(255,255,255,0.75)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); return (_csTex=new THREE.CanvasTexture(c)); }
let _csMat=null;
export function contactShadow(w, l, n, matrix, y){ if(typeof document==='undefined') return null; const g=new THREE.PlaneGeometry(w, l); g.rotateX(-Math.PI/2); g.translate(0, y??0.012, 0);
  const m=_csMat||(_csMat=new THREE.MeshBasicMaterial({ color:0x000000, alphaMap:csTex(), transparent:true, opacity:REALCITY.contact.op, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
  const im=new THREE.InstancedMesh(g, m, n); im.instanceMatrix=matrix; im.frustumCulled=false; im.renderOrder=1; arena.add(im); LAND.meshes.push(im); return im; }
// cars: objects from pickCar — Z333 only as their real models (a kind with none is left out: no hand-built stand-in car or scooter is drawn any more)
export function drawStreetVehicles(cars){ const B=built();
  B.cars.forEach((m,i)=>{ const list=cars.filter(o=>o.m===i), R=carModel(m.name); if(R) drawReal(R, list, m.cr, 'car', m.taxi||m.truck); }); }
// a crushed car / scooter: pancaked, skewed; both draws follow
const _CM=new THREE.Matrix4();
export function crushVehicle(c){ const sq=c.kind==='car'?0.42:0.2; _CM.compose(_V.set(c.x, heightAt(c.x,c.z)-0.05, c.z), _Q.setFromEuler(_E.set((Math.random()-0.5)*0.15, c.ry+(Math.random()-0.5)*0.4, (Math.random()-0.5)*0.15)), _S.set(1.08, sq, 1.04));
  c.im.setMatrixAt(c.k,_CM); c.im.instanceMatrix.needsUpdate=true; for(const im of c.ims||[]){ im.setMatrixAt(c.k,_CM); im.instanceMatrix.needsUpdate=true; } }
