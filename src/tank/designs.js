// tank/designs.js — Z157 EVERY MODEL ITS OWN VEHICLE: a dedicated build per tank instead of one stretched hull.
//   · running gear from the real layout: road-wheel count / size / spacing, return rollers, rear or FRONT drive sprocket (Merkava), idler —
//     the track belt is the convex wrap of those wheels, so every model's track has its own silhouette
//   · hull: its own lower and upper side profiles (long shallow glacis, V-nose, Merkava's high front engine deck…) and its own skirt kind
//     (armoured slab, plate segments, rubber flaps, reactive-armour boxes, faceted stealth panels)
//   · turret: a lofted solid (wide base polygon → narrower roof polygon) so the armour faces really slope; or a cast dome
//   · GUN MOUNT: where the trunnion sits on the turret (height / depth), the mantlet kind (slot, flat box, cast bulge, wedge, exposed cradle),
//     the barrel (calibre, length, fume extractor, thermal-sleeve bands, muzzle reference sensor / brake / plain), recoil travel, rest elevation
//   The weapon barrels the player fits (tank/barrels.js) hang off the same pivot, so they move with each model's mount.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const T_BELT = 0.09;
const _V=(a)=>new THREE.Vector3(a[0],a[1],a[2]);
// ---- a closed solid from a base polygon (x,z) at y0 to a roof polygon at y1 (same vertex count): sloped armour faces, flat-shaded ----
export function loft(bot, top, y0, y1){ const P=[], U=[]; const n=bot.length; let cx=0, cz=0; for(const p of bot){ cx+=p[0]; cz+=p[1]; } cx/=n; cz/=n;
  const tri=(a,b,c,ua,ub,uc,want)=>{ const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]], nn=[ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
    if(nn[0]*want[0]+nn[1]*want[1]+nn[2]*want[2] < 0){ [b,c]=[c,b]; [ub,uc]=[uc,ub]; } P.push(...a,...b,...c); U.push(...ua,...ub,...uc); };
  for(let i=0;i<n;i++){ const j=(i+1)%n, b0=[bot[i][0],y0,bot[i][1]], b1=[bot[j][0],y0,bot[j][1]], t0=[top[i][0],y1,top[i][1]], t1=[top[j][0],y1,top[j][1]];
    const L=Math.hypot(b1[0]-b0[0], b1[2]-b0[2])*0.34, H=Math.hypot(y1-y0, t0[0]-b0[0], t0[2]-b0[2])*0.34, w=[(b0[0]+b1[0])/2-cx, 0, (b0[2]+b1[2])/2-cz];
    tri(b0,b1,t1,[0,0],[L,0],[L,H],w); tri(b0,t1,t0,[0,0],[L,H],[0,H],w); }
  for(const [poly,y,up] of [[top,y1,1],[bot,y0,-1]]){ const ix=THREE.ShapeUtils.triangulateShape(poly.map(p=>new THREE.Vector2(p[0],p[1])), []);
    for(const [a,b,c] of ix){ const A=[poly[a][0],y,poly[a][1]], B=[poly[b][0],y,poly[b][1]], C=[poly[c][0],y,poly[c][1]]; tri(A,B,C,[A[0]*0.34,A[2]*0.34],[B[0]*0.34,B[2]*0.34],[C[0]*0.34,C[2]*0.34],[0,up,0]); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P,3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U,2)); g.computeVertexNormals(); return g; }
const scalePoly=(poly,sx,sz,dz)=>poly.map(([x,z])=>[x*sx, z*sz+(dz||0)]);
// side profile [[z,y]…] extruded across width w (centred on x=0), bevelled edges
function profile(pts, w, bevel){ const s=new THREE.Shape(); pts.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1])); s.closePath();
  const g=new THREE.ExtrudeGeometry(s, { depth:w, bevelEnabled:!!bevel, bevelThickness:bevel||0, bevelSize:bevel||0, bevelSegments:2 }); g.rotateY(-Math.PI/2); g.translate(w/2,0,0);
  const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*0.34, uv.getY(i)*0.34); return g; }
// convex hull of sampled circles in (z,y) — the outline of a track belt round its wheels
function circleHull(circles, grow){ const pts=[]; for(const c of circles) for(let k=0;k<28;k++){ const a=k/28*Math.PI*2; pts.push([c.z+Math.cos(a)*(c.r+grow), c.y+Math.sin(a)*(c.r+grow)]); }
  pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]); const lo=[], up=[];
  for(const p of pts){ while(lo.length>=2 && cr(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p); }
  for(let i=pts.length-1;i>=0;i--){ const p=pts[i]; while(up.length>=2 && cr(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up); }
function beltGeo(circles, tw){ const outer=circleHull(circles, T_BELT), inner=circleHull(circles, 0.0);
  const s=new THREE.Shape(); outer.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1])); s.closePath();
  const h=new THREE.Path(); inner.slice().reverse().forEach((p,i)=>i?h.lineTo(p[0],p[1]):h.moveTo(p[0],p[1])); h.closePath(); s.holes.push(h);
  const g=new THREE.ExtrudeGeometry(s, { depth:tw, bevelEnabled:false, curveSegments:4 }); g.rotateY(-Math.PI/2); g.translate(tw/2,0,0); return g; }

const _GEO={};   // per design: geometries shared by every tank of that model
// ======================================================================================================================
//   THE DESIGNS (lengths in game units ≈ 1.8 m; z forward, y up from the ground). run.n road wheels between run.z0…run.z1.
// ======================================================================================================================
const D = {
  abrams: { W:3.32, tw:0.62, run:{ n:7, r:0.30, z0:-1.72, z1:1.56, spr:{ z:-2.08, y:0.62, r:0.30 }, idl:{ z:1.98, y:0.50, r:0.25 }, rol:[] },
    skirt:{ kind:'slab', z0:-1.95, z1:2.08, front:0.5 },
    lower:[[-2.25,0.45],[1.6,0.45],[2.22,'F'],[-2.25,'F']], upper:[[-2.3,0],[2.2,0],[2.26,0.06],[1.0,0.36],[-2.05,0.38],[-2.3,0.24]],
    tur:{ y:0.36, z:-0.15, h:0.5, poly:[[-1.08,-1.68],[1.08,-1.68],[1.14,-0.95],[1.14,0.62],[0.66,1.32],[-0.66,1.32],[-1.14,0.62],[-1.14,-0.95]], top:[0.93,0.95,-0.04] },
    gun:{ y:0.25, z:1.22, mantlet:'slot', mw:0.42, mh:0.4, len:2.65, r0:0.115, r1:0.1, evac:0.55, bands:3, muzzle:'mrs', recoil:0.55, elev0:0 }, exhaust:[0,-2.32] },
  leo2a7: { W:3.26, tw:0.6, run:{ n:7, r:0.33, z0:-1.66, z1:1.62, spr:{ z:-2.02, y:0.64, r:0.30 }, idl:{ z:1.98, y:0.55, r:0.25 }, rol:[-1.2,-0.35,0.45,1.2], rolY:0.93 },
    skirt:{ kind:'plates', z0:-1.9, z1:2.05, heavyFront:2 },
    lower:[[-2.15,0.46],[1.4,0.46],[2.1,'F'],[-2.15,'F']], upper:[[-2.18,0],[2.12,0],[2.16,0.07],[1.0,0.42],[-1.85,0.46],[-2.18,0.28]],
    tur:{ y:0.44, z:-0.22, h:0.52, poly:[[-1.0,-1.6],[1.0,-1.6],[1.08,-1.0],[1.1,0.55],[0.95,0.98],[-0.95,0.98],[-1.1,0.55],[-1.08,-1.0]], top:[0.95,0.97,0] },
    gun:{ y:0.24, z:1.02, mantlet:'box', mw:0.62, mh:0.44, len:3.22, r0:0.105, r1:0.085, evac:0.4, bands:4, muzzle:'mrs', recoil:0.62, elev0:0 }, exhaust:[-0.9,-2.2] },
  t90m: { W:3.36, tw:0.58, run:{ n:6, r:0.36, zs:[-1.55,-1.0,-0.4,0.25,0.82,1.38], spr:{ z:-1.95, y:0.58, r:0.30 }, idl:{ z:1.86, y:0.5, r:0.26 }, rol:[] },
    skirt:{ kind:'rubber', z0:-1.9, z1:1.95, eraFront:3 },
    lower:[[-1.95,0.4],[1.2,0.4],[1.96,'F'],[-1.95,'F']], upper:[[-1.98,0],[1.95,0],[1.98,0.04],[0.95,0.22],[-1.8,0.25],[-1.98,0.16]],
    tur:{ y:0.25, z:-0.1, dome:{ rx:1.12, rz:1.24, h:0.66 } },
    gun:{ y:0.2, z:0.94, mantlet:'round', len:2.85, r0:0.12, r1:0.1, evac:0.5, bands:2, muzzle:'plain', recoil:0.5, elev0:0.02 }, exhaust:[-1.25,-1.4,'side'] },
  leclerc: { W:3.24, tw:0.58, run:{ n:6, r:0.33, z0:-1.5, z1:1.45, spr:{ z:-1.88, y:0.6, r:0.30 }, idl:{ z:1.84, y:0.52, r:0.25 }, rol:[] },
    skirt:{ kind:'slab', z0:-1.85, z1:1.95, ribs:1 },
    lower:[[-1.9,0.45],[1.3,0.45],[1.92,'F'],[-1.9,'F']], upper:[[-1.95,0],[1.92,0],[1.96,0.06],[0.9,0.4],[-1.7,0.42],[-1.95,0.26]],
    tur:{ y:0.4, z:-0.4, h:0.5, poly:[[-0.92,-1.62],[0.92,-1.62],[0.99,-1.12],[0.99,0.62],[0.8,1.1],[-0.8,1.1],[-0.99,0.62],[-0.99,-1.12]], top:[0.94,0.96,0] },
    gun:{ y:0.26, z:1.0, mantlet:'box', mw:0.5, mh:0.5, len:3.0, r0:0.105, r1:0.09, evac:0, bands:3, muzzle:'mrs', recoil:0.58, elev0:0 }, exhaust:[0,-1.98] },
  ch3: { W:3.22, tw:0.6, run:{ n:6, r:0.38, z0:-1.75, z1:1.55, spr:{ z:-2.18, y:0.66, r:0.30 }, idl:{ z:2.08, y:0.58, r:0.27 }, rol:[-1.3,-0.4,0.5,1.35], rolY:0.98 },
    skirt:{ kind:'plates', z0:-2.05, z1:2.2, heavyFront:6 },
    lower:[[-2.3,0.47],[1.55,0.47],[2.25,'F'],[-2.3,'F']], upper:[[-2.32,0],[2.25,0],[2.3,0.08],[1.1,0.4],[-2.0,0.42],[-2.32,0.3]],
    tur:{ y:0.42, z:-0.28, h:0.55, poly:[[-1.0,-1.62],[1.0,-1.62],[1.1,-1.05],[1.12,0.5],[0.9,1.14],[-0.9,1.14],[-1.12,0.5],[-1.1,-1.05]], top:[0.92,0.95,-0.03] },
    gun:{ y:0.28, z:1.16, mantlet:'slot', mw:0.42, mh:0.44, len:3.25, r0:0.105, r1:0.09, evac:0.45, bands:4, muzzle:'mrs', recoil:0.6, elev0:0 }, exhaust:[-1.0,-2.3,'side'] },
  merkava: { W:3.3, tw:0.6, run:{ n:6, r:0.33, z0:-1.7, z1:1.35, spr:{ z:2.05, y:0.68, r:0.30 }, idl:{ z:-2.1, y:0.55, r:0.27 }, rol:[-1.2,-0.4,0.4,1.2], rolY:0.95 },   // FRONT sprocket: the engine is in front
    skirt:{ kind:'plates', z0:-2.0, z1:2.15, heavyFront:3 },
    lower:[[-2.2,0.5],[1.7,0.5],[2.26,'F'],[-2.2,'F']], upper:[[-2.25,0],[2.25,0],[2.3,0.1],[1.5,0.52],[0.4,0.58],[-1.4,0.58],[-2.1,0.5],[-2.25,0.3]],
    tur:{ y:0.58, z:-0.7, h:0.5, poly:[[-0.86,-1.62],[0.86,-1.62],[1.0,-1.2],[1.0,0.1],[0.56,1.16],[0.18,1.74],[-0.18,1.74],[-0.56,1.16],[-1.0,0.1],[-1.0,-1.2]], top:[0.78,0.95,-0.04] },
    gun:{ y:0.2, z:1.36, mantlet:'wedge', len:2.9, r0:0.105, r1:0.09, evac:0.5, bands:2, muzzle:'plain', recoil:0.55, elev0:0 }, exhaust:[1.3,1.6,'side'] },
  type99: { W:3.26, tw:0.6, run:{ n:6, r:0.35, z0:-1.6, z1:1.5, spr:{ z:-2.05, y:0.62, r:0.30 }, idl:{ z:1.98, y:0.52, r:0.26 }, rol:[-1.0,0.0,1.0], rolY:0.96 },
    skirt:{ kind:'plates', z0:-1.95, z1:2.05, eraFront:2 },
    lower:[[-2.1,0.45],[1.45,0.45],[2.12,'F'],[-2.1,'F']], upper:[[-2.12,0],[2.1,0],[2.14,0.06],[0.95,0.38],[-1.9,0.4],[-2.12,0.25]],
    tur:{ y:0.4, z:-0.25, h:0.5, poly:[[-0.98,-1.38],[0.98,-1.38],[1.06,-0.9],[1.08,0.35],[0.72,1.05],[0.56,1.55],[0.2,1.08],[-0.2,1.08],[-0.56,1.55],[-0.72,1.05],[-1.08,0.35],[-1.06,-0.9]], top:[0.9,0.95,-0.02] },   // two arrowhead lobes with the gun in the notch
    gun:{ y:0.2, z:1.12, mantlet:'box', mw:0.38, mh:0.34, len:3.0, r0:0.12, r1:0.1, evac:0.45, bands:3, muzzle:'plain', recoil:0.55, elev0:0 }, exhaust:[-1.2,-1.6,'side'] },
  k2: { W:3.2, tw:0.58, run:{ n:7, r:0.30, z0:-1.65, z1:1.55, spr:{ z:-2.0, y:0.6, r:0.28 }, idl:{ z:1.95, y:0.5, r:0.24 }, rol:[-1.0,0.0,1.0], rolY:0.88 },
    skirt:{ kind:'plates', z0:-1.95, z1:2.05, heavyFront:2 },
    lower:[[-2.08,0.44],[1.45,0.44],[2.1,'F'],[-2.08,'F']], upper:[[-2.1,0],[2.08,0],[2.12,0.05],[0.95,0.34],[-1.85,0.36],[-2.1,0.22]],
    tur:{ y:0.34, z:-0.22, h:0.46, poly:[[-0.98,-1.48],[0.98,-1.48],[1.06,-0.95],[1.08,0.45],[0.74,1.22],[-0.74,1.22],[-1.08,0.45],[-1.06,-0.95]], top:[0.86,0.9,-0.05] },
    gun:{ y:0.2, z:1.12, mantlet:'box', mw:0.42, mh:0.34, len:3.15, r0:0.1, r1:0.085, evac:0.42, bands:4, muzzle:'mrs', recoil:0.6, elev0:0 }, exhaust:[-0.9,-2.15] },
  t14: { W:3.26, tw:0.6, run:{ n:7, r:0.33, z0:-1.95, z1:1.85, spr:{ z:-2.35, y:0.62, r:0.30 }, idl:{ z:2.3, y:0.52, r:0.26 }, rol:[] },
    skirt:{ kind:'era', z0:-2.25, z1:2.35 },
    lower:[[-2.42,0.48],[1.8,0.48],[2.4,'F'],[-2.42,'F']], upper:[[-2.45,0],[2.4,0],[2.45,0.1],[1.4,0.5],[-2.15,0.52],[-2.45,0.34]],
    tur:{ y:0.5, z:-0.38, h:0.6, poly:[[-0.78,-0.98],[0.78,-0.98],[0.88,-0.62],[0.88,0.55],[0.58,1.02],[-0.58,1.02],[-0.88,0.55],[-0.88,-0.62]], top:[0.85,0.9,-0.04] },
    gun:{ y:0.36, z:0.86, mantlet:'exposed', len:3.35, r0:0.115, r1:0.1, evac:0.5, bands:3, muzzle:'collar', recoil:0.6, elev0:0 }, exhaust:[-1.2,-1.9,'side'] },
  ghost: { W:3.0, tw:0.52, run:{ n:5, r:0.32, z0:-1.4, z1:1.35, spr:{ z:-1.82, y:0.56, r:0.27 }, idl:{ z:1.78, y:0.48, r:0.23 }, rol:[] },
    skirt:{ kind:'stealth', z0:-1.85, z1:1.9 },
    lower:[[-1.85,0.42],[1.2,0.42],[1.86,'F'],[-1.85,'F']], upper:[[-1.9,0],[1.88,0],[1.92,0.04],[0.7,0.26],[-1.6,0.28],[-1.9,0.16]],
    tur:{ y:0.27, z:-0.15, h:0.36, poly:[[-0.84,-1.02],[0.84,-1.02],[0.98,-0.42],[0.74,0.92],[0.0,1.55],[-0.74,0.92],[-0.98,-0.42]], top:[0.7,0.8,-0.08] },
    gun:{ y:0.16, z:0.98, mantlet:'wedge', len:2.75, r0:0.085, r1:0.075, evac:0, bands:2, muzzle:'brake', recoil:0.45, elev0:0 }, exhaust:[0,-1.95] },
  colossus: { W:3.62, tw:0.7, run:{ n:8, r:0.34, z0:-2.15, z1:2.05, spr:{ z:-2.55, y:0.66, r:0.32 }, idl:{ z:2.5, y:0.56, r:0.28 }, rol:[-1.6,-0.55,0.5,1.55], rolY:1.0 },
    skirt:{ kind:'era', z0:-2.5, z1:2.6 },
    lower:[[-2.6,0.5],[2.0,0.5],[2.6,'F'],[-2.6,'F']], upper:[[-2.65,0],[2.6,0],[2.65,0.1],[1.5,0.52],[-2.3,0.55],[-2.65,0.36]],
    tur:{ y:0.55, z:-0.32, h:0.72, poly:[[-1.24,-1.66],[1.24,-1.66],[1.34,-1.12],[1.34,0.74],[0.94,1.46],[-0.94,1.46],[-1.34,0.74],[-1.34,-1.12]], top:[0.9,0.93,-0.03] },
    gun:{ y:0.34, z:1.48, mantlet:'box', mw:0.9, mh:0.6, len:3.4, r0:0.15, r1:0.13, evac:0.45, bands:3, muzzle:'brake', recoil:0.7, elev0:0 }, exhaust:[-1.4,-2.4,'side'] },
};
export const DESIGNS = D;
export const hasDesign = id => !!D[id];

// ======================================================================================================================
//   the builder — returns the same rig / userData contract as tank/model.js buildTank, so animation, recoil, barrels, the player all just work
// ======================================================================================================================
export function buildDesignTank(opts, ctx){ const id=opts.model, d=D[id]; const { THREE_:_, mk, HULL, TUR, GUN, STEEL, BLACK, GLASS, RUB, BELT, FACE, dark, metal, ACC, HLM } = ctx;
  const g=new THREE.Group(); g.rotation.order='YXZ';
  const R=d.run, W=d.W, tw=d.tw, tx=W/2-tw/2;
  const zs=R.zs || Array.from({ length:R.n }, (_,i)=>R.z0+i*(R.z1-R.z0)/(R.n-1)), wy=R.r+T_BELT;
  const circles=zs.map(z=>({ z, y:wy, r:R.r })).concat([{ ...R.spr }, { ...R.idl }], (R.rol||[]).map(z=>({ z, y:R.rolY||1.0, r:0.1 })));
  const trackTop=Math.max(...circles.map(c=>c.y+c.r))+T_BELT, F=trackTop+0.02;
  const G=_GEO[id] || (_GEO[id]=(()=>{ const o={};
    o.belt=beltGeo(circles, tw);
    o.lower=profile(d.lower.map(([z,y])=>[z, y==='F'?F-0.02:y]), W-2*tw-0.04, 0.03);
    o.upper=profile(d.upper.map(([z,y])=>[z, F+y]), W-0.46, 0.035);   // the superstructure sits inboard; thin fenders cover the tracks
    if(d.tur.dome){ const dm=d.tur.dome, s=new THREE.SphereGeometry(1, 30, 12, 0, Math.PI*2, 0, Math.PI/2); s.scale(dm.rx, dm.h, dm.rz); o.tur=s; }
    else { const t=d.tur, [sx,sz,dz]=t.top; o.tur=loft(t.poly, scalePoly(t.poly,sx,sz,dz), 0, t.h); }
    return o; })());
  // ---------- running gear (stays on the ground) ----------
  const rig={ wheels:[[],[]], wheelTex:[], tracks:[], lx:undefined, lz:0, lf:0, v:0, a:0, pitch:0, pv:0, roll:0, rv:0, recoil:0, recoilLen:d.gun.recoil, vib:0, elev:0, elevT:0, elev0:d.gun.elev0||0, t:Math.random()*10 };
  for(let si=0; si<2; si++){ const sx=(si?1:-1)*tx;
    const tex=ctx.trackTex(); rig.tracks.push(tex); const bm=BELT(tex); mk(g, G.belt, bm, sx, 0, 0);
    const wt=ctx.wheelTex(); rig.wheelTex.push(wt); const fm=FACE(wt); const tyres=[], faces=[], W2=tw*0.42;
    const wheelAt=(z,y,r,seg)=>{ const ty=new THREE.CylinderGeometry(r,r,W2*2,seg||18,1,true); ty.rotateZ(Math.PI/2); ty.translate(sx,y,z); tyres.push(ty);
      for(const sd of [-1,1]){ const f=new THREE.CircleGeometry(r,seg||18); f.rotateY(sd*Math.PI/2); f.translate(sx+sd*W2,y,z); faces.push(f); } };
    for(const z of zs) wheelAt(z, wy, R.r);
    wheelAt(R.idl.z, R.idl.y, R.idl.r-0.02, 14); for(const z of (R.rol||[])) wheelAt(z, R.rolY||1.0, 0.1, 10);
    mk(g, mergeGeometries(tyres), RUB, 0,0,0); mk(g, mergeGeometries(faces), fm, 0,0,0); tyres.forEach(t=>t.dispose()); faces.forEach(f=>f.dispose());
    mk(g, ctx.sprocketGeo(R.spr.r), STEEL, sx, R.spr.y, R.spr.z); }
  const blob=new THREE.Mesh(ctx.blobGeo, ctx.blobMat()); blob.position.y=0.03; blob.scale.set(W/3.0, 1, (Math.max(d.upper[1][0], R.idl.z, R.spr.z)-Math.min(d.upper[0][0], R.idl.z, R.spr.z))/4.2); blob.renderOrder=-1; blob.userData.keep=true; g.add(blob);
  // ---------- sprung hull ----------
  const body=new THREE.Group(); body.position.y=0.95; g.add(body);
  const B=(geo,mat,x,y,z)=>mk(body,geo,mat,x,y-0.95,z);
  const hullM=B(G.lower, HULL, 0,0,0); B(G.upper, HULL, 0,0,0);
  { const zf0=d.upper.reduce((m,p)=>Math.max(m,p[0]),-9), zr0=d.upper.reduce((m,p)=>Math.min(m,p[0]),9), fl=zf0-zr0-0.1;
    for(const sd of [-1,1]){ B(new THREE.BoxGeometry(0.27,0.045,fl), HULL, sd*(W/2-0.12), F+0.02, (zf0+zr0)/2);                 // fender over the track
      const fr=B(new THREE.BoxGeometry(0.27,0.04,0.32), HULL, sd*(W/2-0.12), F-0.05, zf0-0.02); fr.rotation.x=0.45;                 // front mudguard
      for(const [z,w] of [[zr0+0.5,0.7],[zr0+1.35,0.55]]) B(new RoundedBoxGeometry(0.22,0.18,w,1,0.03), dark(0x3a3d30), sd*(W/2-0.14), F+0.135, z); } }   // tool boxes on the fenders
  const S=d.skirt, sL=S.z1-S.z0, sy=F-0.02;
  for(const sd of [-1,1]){ const x=sd*(W/2+0.02);
    if(S.kind==='slab'){ const sk=B(new THREE.BoxGeometry(0.07,0.46,sL*(1-(S.front||0)*0.1)), HULL, x, sy-0.23, (S.z0+S.z1)/2-0.05); if(S.ribs) for(let k=0;k<7;k++) B(new THREE.BoxGeometry(0.03,0.42,0.05), HULL, x+sd*0.045, sy-0.23, S.z0+0.3+k*(sL-0.6)/6);
      const fr=B(new THREE.BoxGeometry(0.07,0.46,0.5), HULL, x, sy-0.2, S.z1-0.1); fr.rotation.x=-0.35; }
    else if(S.kind==='plates'){ const n=Math.max(4, Math.round(sL/0.62)), seg=sL/n; for(let k=0;k<n;k++){ const heavy=k>=n-(S.heavyFront||0); const p=B(new THREE.BoxGeometry(heavy?0.12:0.05, heavy?0.5:0.4, seg*0.97), HULL, x+sd*(heavy?0.03:0), sy-(heavy?0.25:0.2), S.z0+seg*(k+0.5)); p.rotation.z=sd*0.03; } }
    else if(S.kind==='rubber'){ for(let k=0;k<8;k++){ const p=B(new THREE.BoxGeometry(0.03,0.3,sL/8*0.96), RUB, x, sy-0.15, S.z0+sL/8*(k+0.5)); p.rotation.z=sd*0.05; }
      for(let k=0;k<(S.eraFront||0);k++){ const e=B(new RoundedBoxGeometry(0.16,0.4,0.42,1,0.03), ctx.ERA, x+sd*0.04, sy-0.18, S.z1-0.25-k*0.45); } }
    else if(S.kind==='era'){ const n=Math.round(sL/0.5); for(let k=0;k<n;k++){ B(new RoundedBoxGeometry(0.18,0.5,0.46,1,0.03), ctx.ERA, x+sd*0.05, sy-0.24, S.z0+sL/n*(k+0.5)); } }
    else if(S.kind==='stealth'){ const p=B(new THREE.BoxGeometry(0.06,0.52,sL), HULL, x-sd*0.02, sy-0.2, (S.z0+S.z1)/2); p.rotation.z=-sd*0.32; }   // faceted panels lean IN over the tracks
    if(S.eraFront && S.kind==='plates') for(let k=0;k<S.eraFront;k++) B(new RoundedBoxGeometry(0.14,0.36,0.5,1,0.03), ctx.ERA, x+sd*0.07, sy-0.2, S.z1-0.3-k*0.55); }
  // nose kit: headlights + brush guards, tow hooks, driver's hatch + periscopes, deck grille, exhaust
  const zf=d.upper.reduce((m,p)=>Math.max(m,p[0]),-9), zr=d.upper.reduce((m,p)=>Math.min(m,p[0]),9), lx=W/2-0.32;
  for(const hx of [-lx,lx]){ const hl=B(new THREE.CylinderGeometry(0.08,0.09,0.1,12), HLM, hx, F+0.12, zf-0.04); hl.rotation.x=Math.PI/2-0.3; const gd=B(new THREE.TorusGeometry(0.12,0.018,5,12), STEEL, hx, F+0.12, zf-0.02); gd.rotation.x=-0.3; }
  for(const tx2 of [-0.6,0.6]){ const th=B(new THREE.TorusGeometry(0.1,0.033,5,10), STEEL, tx2, F-0.3, zf-0.04); th.rotation.y=Math.PI/2; }
  for(let k=0;k<5;k++) B(new THREE.BoxGeometry(0.8,0.025,0.035), STEEL, (k%2?0.45:-0.45), F+(d.upper[4]?d.upper[4][1]:0.4)+0.015, zr+0.35+Math.floor(k/2)*0.2);
  const ex=d.exhaust||[0,-2]; const exhaust=new THREE.Object3D(); exhaust.position.set(ex[0], F+0.25-0.95, ex[1]); body.add(exhaust);
  if(ex[2]==='side'){ const eg=B(new THREE.BoxGeometry(0.05,0.18,0.6), BLACK, ex[0]<0?-W/2-0.03:W/2+0.03, F+0.1, ex[1]); } else B(new THREE.BoxGeometry(Math.min(1.8,W-0.8),0.24,0.04), BLACK, 0, F+0.08, zr-0.02);
  // ---------- turret ----------
  const t=d.tur, turretG=new THREE.Group(); turretG.position.set(0, F+t.y-0.95, t.z); body.add(turretG);
  mk(turretG, new THREE.CylinderGeometry(0.88,0.92,0.1,24), BLACK, 0,-0.04,0);
  const turM=mk(turretG, G.tur, TUR, 0,0,0);
  const th = t.dome ? t.dome.h*0.9 : t.h;
  for(const s of [-1,1]){ const half = t.dome ? t.dome.rx*0.9 : Math.max(...t.poly.map(p=>Math.abs(p[0]))); mk(turretG, new THREE.BoxGeometry(0.02,0.09,0.8), ACC, s*(half*(t.dome?0.98:0.99)+0.012), th*0.45, -0.3); }   // faction stripe
  // ---------- gun mount: pivot + mantlet + own barrel ----------
  const gn=d.gun, gunPivot=new THREE.Group(); gunPivot.position.set(0, gn.y, gn.z); turretG.add(gunPivot);
  const P=(geo,mat,x,y,z)=>mk(gunPivot,geo,mat,x,y,z);
  if(gn.mantlet==='slot'){ P(new RoundedBoxGeometry(gn.mw,gn.mh,0.32,1,0.04), metal(0x3a3b33), 0,0,0.08); for(const s of [-1,1]) P(new THREE.BoxGeometry(0.06,gn.mh*0.9,0.12), BLACK, s*gn.mw*0.38,0,0.26); }
  else if(gn.mantlet==='box'){ P(new RoundedBoxGeometry(gn.mw,gn.mh,0.34,2,0.05), TUR, 0,0,0.1); P(new THREE.CylinderGeometry(0.17,0.17,0.12,14), metal(0x3a3b33), 0,0,0.3).rotation.x=Math.PI/2; }
  else if(gn.mantlet==='round'){ const m=P(new THREE.SphereGeometry(0.3,18,12), TUR, 0,0,0.05); m.scale.set(1.05,0.8,1.0); P(new THREE.CylinderGeometry(0.16,0.19,0.22,14), metal(0x3a3b33), 0,0,0.3).rotation.x=Math.PI/2; }
  else if(gn.mantlet==='wedge'){ const m=P(new THREE.ConeGeometry(0.32,0.5,4), TUR, 0,0,0.12); m.rotation.set(Math.PI/2,Math.PI/4,0); m.scale.set(1,1,0.7); P(new THREE.CylinderGeometry(0.15,0.15,0.16,12), metal(0x3a3b33), 0,0,0.36).rotation.x=Math.PI/2; }
  else if(gn.mantlet==='exposed'){ P(new THREE.BoxGeometry(0.3,0.26,0.7), metal(0x34352e), 0,-0.02,0.15); for(const s of [-1,1]) P(new THREE.BoxGeometry(0.05,0.3,0.55), BLACK, s*0.2,0,0.12); }
  const barrelG=new THREE.Group(); barrelG.position.set(0,-0.02,-ctx.TRUNNION_Z); gunPivot.add(barrelG);
  const Z=dz=>ctx.TRUNNION_Z+dz, Y=0.02, len=gn.len, e0=gn.evac>0 ? len*gn.evac : 0;
  { const prof=[[gn.r0*1.25,0.2],[gn.r0*1.25,0.5],[gn.r0,0.56]]; if(e0){ prof.push([gn.r0*0.96, e0-0.06],[gn.r0*1.45, e0+0.02],[gn.r0*1.5, e0+0.3],[gn.r0*0.95, e0+0.4]); } prof.push([gn.r1, len-0.1],[gn.r1*1.08, len-0.04],[gn.r1*1.05, len]);
    const lg=new THREE.LatheGeometry(prof.map(([r,z])=>new THREE.Vector2(r, Z(z))), 18); lg.rotateX(Math.PI/2); const lm=new THREE.Mesh(lg, GUN); lm.position.y=Y; barrelG.add(lm);
    for(let k=0;k<gn.bands;k++){ const zb=0.7+k*(len-1.0)/Math.max(1,gn.bands); if(e0 && Math.abs(zb-e0-0.15)<0.3) continue; const b=new THREE.Mesh(new THREE.CylinderGeometry(gn.r0*1.12,gn.r0*1.12,0.06,14), dark(0x2a2b24)); b.rotation.x=Math.PI/2; b.position.set(0,Y,Z(zb)); barrelG.add(b); }
    if(gn.muzzle==='mrs'){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.07,0.14), dark(0x22221d)); m.position.set(0,Y+gn.r1+0.05,Z(len-0.1)); barrelG.add(m); }
    if(gn.muzzle==='brake'){ for(const s of [-1,1]){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.06,gn.r1*2.4,0.26), dark(0x1d1d19)); b.position.set(s*gn.r1*1.3,Y,Z(len-0.12)); barrelG.add(b); } const c=new THREE.Mesh(new THREE.CylinderGeometry(gn.r1*1.5,gn.r1*1.5,0.34,14), dark(0x2a2b24)); c.rotation.x=Math.PI/2; c.position.set(0,Y,Z(len-0.12)); barrelG.add(c); }
    if(gn.muzzle==='collar'){ const c=new THREE.Mesh(new THREE.CylinderGeometry(gn.r1*1.3,gn.r1*1.2,0.16,14), dark(0x2a2b24)); c.rotation.x=Math.PI/2; c.position.set(0,Y,Z(len-0.08)); barrelG.add(c); }
    const bo=new THREE.Mesh(new THREE.CircleGeometry(gn.r1*0.72,12), dark(0x080706)); bo.position.set(0,Y,Z(len)+0.003); barrelG.add(bo);
    const coax=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.5,6), BLACK); coax.rotation.x=Math.PI/2; coax.position.set(0.28,Y-0.02,Z(0.45)); barrelG.add(coax); }
  const muzzle=new THREE.Object3D(); muzzle.position.set(0,Y,Z(len+0.05)); barrelG.add(muzzle);
  // ---------- the model's own kit ----------
  const K={ g, body, turretG, gunPivot, B, T:(geo,mat,x,y,z)=>mk(turretG,geo,mat,x,y,z), mk, F, W, tw, th, d, HULL, TUR, STEEL, BLACK, GLASS, RUB, ERA:ctx.ERA, dark, metal, zf, zr };
  if(DRESS[id]) DRESS[id](K);
  g.userData.turret=turretG; g.userData.muzzle=muzzle; g.userData.barrelG=barrelG; g.userData.gunPivot=gunPivot; g.userData.hull=hullM;
  g.userData.body=body; g.userData.rig=rig; g.userData.exhaust=exhaust; g.userData.blob=blob; g.userData.model=id; g.userData.mountY=th*0.5;
  return g; }

// ---- small parts ----
const bx=(K,par,w,h,dd,x,y,z,mat)=>K.mk(par, new THREE.BoxGeometry(w,h,dd), mat, x,y,z);
const rb=(K,par,w,h,dd,x,y,z,mat)=>K.mk(par, new RoundedBoxGeometry(w,h,dd,1,Math.min(w,h,dd)*0.2), mat, x,y,z);
const cy=(K,par,r1,r2,h,x,y,z,mat,seg)=>K.mk(par, new THREE.CylinderGeometry(r1,r2,h,seg||12), mat, x,y,z);
function sightBox(K, x, y, z, s, mast){ s=s||1; const T=K.turretG; if(mast) cy(K,T,0.07*s,0.08*s,mast,x,y+mast/2,z,K.STEEL,10); const yy=y+(mast||0);
  rb(K,T,0.3*s,0.24*s,0.3*s,x,yy+0.12*s,z,K.dark(0x2a2b25)); bx(K,T,0.22*s,0.12*s,0.02,x,yy+0.13*s,z+0.155*s,K.GLASS); }
function cupola(K, x, z, r, y){ const T=K.turretG; cy(K,T,r,r*1.08,0.16,x,y+0.08,z,K.TUR,16); cy(K,T,r*0.85,r*0.85,0.04,x,y+0.18,z,K.TUR,16); for(let i=0;i<5;i++){ const a=-0.9+i*0.45; bx(K,T,0.09,0.05,0.04,x+Math.sin(a)*r*1.02,y+0.11,z+Math.cos(a)*r*1.02,K.GLASS).rotation.y=a; } }
function hatch(K, x, z, r, y){ cy(K,K.turretG,r,r,0.04,x,y+0.02,z,K.TUR,14); }
function smokeBank(K, x, y, z, n, ry, rows){ const T=K.turretG; for(let r=0;r<(rows||1);r++) for(let i=0;i<n;i++){ const c=cy(K,T,0.05,0.05,0.24,x,y+r*0.11,z-i*0.11,K.STEEL,8); c.rotation.set(-0.8,0,ry); } }
function hmg(K, par, x, y, z, len){ const m=cy(K,par,0.03,0.035,len||0.9,x,y,z+(len||0.9)/2,K.BLACK,8); m.rotation.x=Math.PI/2; return m; }
function slat(K, par, x0, x1, z0, z1, y0, y1){ for(let i=0;i<=7;i++){ const z=z0+(z1-z0)*i/7; for(const x of [x0,x1]) bx(K,par,0.025,y1-y0,0.025,x,(y0+y1)/2,z,K.BLACK); }
  for(const y of [y0,(y0+y1)/2,y1]){ for(const x of [x0,x1]) bx(K,par,0.025,0.025,z1-z0,x,y,(z0+z1)/2,K.BLACK); bx(K,par,x1-x0,0.025,0.025,(x0+x1)/2,y,z0,K.BLACK); } }
function stowBox(K, par, w, h, dd, x, y, z, c){ rb(K,par,w,h,dd,x,y,z,K.dark(c||0x3d4030)); }
function aerial(K, x, z, h){ const a=cy(K,K.turretG,0.008,0.014,h||1.2,x,K.th+(h||1.2)/2,z,K.dark(0x22221e),4); a.rotation.z=x<0?0.05:-0.05; }
function glacisERA(K, rows, cols, z0, slope){ for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){ const z=z0-r*0.36, e=K.B(new RoundedBoxGeometry(0.34,0.09,0.3,1,0.02), K.ERA, (c-(cols-1)/2)*0.4, K.F+0.08+(K.zf-z)*slope, z); e.rotation.x=slope*1.05; } }

// ======================================================================================================================
//   THE KIT OF EACH MODEL (turret coordinates: y=0 at the turret base, +z toward the gun)
// ======================================================================================================================
const DRESS = {
  abrams(K){ const T=K.turretG, h=K.th;
    sightBox(K, 0.6, h, 0.62, 1.1);                                                   // gunner's primary sight "doghouse"
    cy(K,T,0.12,0.14,0.18,-0.55,h+0.09,-0.05,K.STEEL,12); { const c=new THREE.Group(); c.position.set(-0.55,h+0.2,-0.05); T.add(c); rb(K,c,0.34,0.26,0.36,0,0.13,0,K.dark(0x2c2d27)); bx(K,c,0.26,0.12,0.02,0,0.15,0.18,K.GLASS); }   // CITV
    { const r=new THREE.Group(); r.position.set(-0.45,h,0.35); T.add(r); rb(K,r,0.38,0.24,0.42,0,0.14,0,K.dark(0x34352d)); hmg(K,r,0.14,0.18,0.15,0.95); bx(K,r,0.12,0.1,0.02,-0.1,0.16,0.22,K.GLASS); }   // CROWS + M2
    hatch(K, 0.45, -0.45, 0.22, h); { const p=new THREE.Group(); p.position.set(0.45,h+0.15,-0.25); T.add(p); hmg(K,p,0,0,0,0.7); }   // loader's M240
    for(let i=0;i<=6;i++) bx(K,T,0.03,0.32,0.03,-1.0+i*0.333,h*0.6,-1.78,K.BLACK); bx(K,T,2.0,0.03,0.03,0,h*0.6+0.16,-1.78,K.BLACK); for(const s of [-1,1]) bx(K,T,0.03,0.03,0.55,s*1.0,h*0.6+0.16,-1.52,K.BLACK);   // bustle rack
    for(const s of [-1,1]) smokeBank(K, s*0.98, h*0.55, 0.55, 3, s*-0.5, 2);
    stowBox(K,T,0.32,0.32,0.8, 1.2,h*0.4,-0.65); stowBox(K,T,0.32,0.32,0.8,-1.2,h*0.4,-0.65); aerial(K,-0.8,-1.2,1.3); aerial(K,0.8,-1.2,1.1);
    K.B(new THREE.BoxGeometry(1.9,0.05,0.6), K.BLACK, 0, K.F+0.39, -1.6); K.B(new RoundedBoxGeometry(0.5,0.32,0.4,1,0.05), K.dark(0x3a3b30), -1.1, K.F+0.55, -1.95);   // turbine deck grille + TUSK APU
    cy(K,K.body,0.16,0.16,0.04,0.55,K.F+0.3-0.95+0.04,1.2,K.HULL,12); },
  leo2a7(K){ const T=K.turretG, h=K.th;
    for(const sx of [-1,1]){ const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(0.82,0); s.lineTo(0.08,0.92); s.closePath();   // spaced arrowhead wedges either side of the gun
      const gg=new THREE.ExtrudeGeometry(s,{ depth:h*0.92, bevelEnabled:true, bevelThickness:0.02, bevelSize:0.02, bevelSegments:1 }); gg.rotateX(-Math.PI/2); if(sx<0) gg.scale(-1,1,1);
      K.mk(T, gg, K.TUR, sx*0.24, 0.02, 0.92); }
    sightBox(K, 0.62, h, 0.5, 1.15);                                                      // EMES 15 / gunner's sight
    { const p=new THREE.Group(); p.position.set(-0.55,h,-0.25); T.add(p); cy(K,p,0.09,0.11,0.45,0,0.22,0,K.STEEL,12); rb(K,p,0.3,0.26,0.32,0,0.56,0,K.dark(0x2a2b25)); bx(K,p,0.24,0.12,0.02,0,0.58,0.17,K.GLASS); }   // PERI R17 periscope
    cupola(K, -0.55, -0.6, 0.24, h); hatch(K, 0.45, -0.55, 0.22, h);
    for(const s of [-1,1]){ stowBox(K,T,0.3,0.38,1.0, s*1.18,h*0.48,-0.7, 0x3a4030); smokeBank(K, s*1.05, h*0.7, -0.15, 4, s*-0.45); }
    stowBox(K,T,1.9,0.36,0.5, 0,h*0.5,-1.82); aerial(K,-0.8,-1.3,1.3); aerial(K,0.8,-1.3,1.3);
    K.B(new THREE.BoxGeometry(2.2,0.1,0.75), K.HULL, 0, K.F+0.2, K.zf-0.5).rotation.x=0.27;   // 2A7 hull front armour module
    for(let k=0;k<3;k++) K.B(new THREE.BoxGeometry(0.75,0.03,0.04), K.STEEL, -0.45, K.F+0.47, -1.2-k*0.2); },
  t90m(K){ const T=K.turretG, h=K.th, ERA=K.ERA;
    for(let i=0;i<10;i++){ const a=-1.05+i*(2.1/9); if(Math.abs(a)<0.2) continue; const e=K.mk(T, new RoundedBoxGeometry(0.34,0.36,0.32,1,0.03), ERA, Math.sin(a)*0.9, 0.2, Math.cos(a)*0.98); e.rotation.y=a; e.rotation.x=-0.25; }   // Relikt "brow" round the front arc
    for(let i=0;i<4;i++){ const e=K.mk(T, new RoundedBoxGeometry(0.34,0.08,0.4,1,0.02), ERA, (i-1.5)*0.34, h*0.95, 0.4); e.rotation.x=-0.15; }   // roof ERA
    sightBox(K, 0.5, h*0.85, 0.35);                                                          // Sosna-U
    cupola(K, -0.42, -0.2, 0.26, h*0.82); { const r=new THREE.Group(); r.position.set(-0.42,h*0.82+0.2,-0.2); T.add(r); rb(K,r,0.28,0.2,0.32,0,0.1,0,K.dark(0x30322a)); hmg(K,r,0.1,0.12,0.1,0.85); }   // UDP T05BV + Kord
    for(const s of [-1,1]) for(let i=0;i<6;i++){ const c=cy(K,T,0.05,0.05,0.26, s*(0.62+i*0.06), 0.42, 0.62-i*0.18, K.STEEL, 8); c.rotation.set(-0.7,0,s*-0.3); }   // 902A smoke tubes in an arc
    slat(K, T, -1.05, 1.05, -1.6, -1.05, -0.05, 0.42);
    cy(K,T,0.07,0.07,1.1,0.6,0.3,-1.3,K.dark(0x2e3028),8).rotation.z=Math.PI/2;           // snorkel stowed on the turret rear
    for(const s of [-1,1]){ const dr=cy(K,K.body,0.2,0.2,0.85, s*0.6, K.F+0.22-0.95, K.zr-0.12, K.dark(0x3a4430), 14); dr.rotation.z=Math.PI/2; }   // external fuel drums
    K.B(new THREE.BoxGeometry(2.3,0.08,0.3), K.dark(0x34352c), 0, 0.5, K.zf+0.02);           // self-entrenching blade under the nose
    glacisERA(K, 3, 5, K.zf-0.25, 0.3); slat(K, K.body, -1.3, 1.3, K.zr-0.12, K.zr+0.3, K.F-0.95, K.F+0.28-0.95); },
  leclerc(K){ const T=K.turretG, h=K.th;
    { const p=new THREE.Group(); p.position.set(-0.45,h,0.2); T.add(p); cy(K,p,0.08,0.09,0.42,0,0.21,0,K.STEEL,10); rb(K,p,0.34,0.28,0.34,0,0.56,0,K.dark(0x2a2b25)); bx(K,p,0.26,0.13,0.02,0,0.58,0.18,K.GLASS); }   // HL-70 commander's sight
    sightBox(K, 0.55, h, 0.62);                                                               // HL-60 gunner's sight
    for(const s of [-1,1]) for(let r=0;r<3;r++) for(let i=0;i<3;i++){ const c=cy(K,T,0.055,0.055,0.22,s*0.86,h*0.35+r*0.12,-0.9-i*0.13,K.STEEL,8); c.rotation.set(0,0,s*Math.PI/2*0.6); }   // GALIX launchers on the bustle sides
    cupola(K,-0.45,-0.45,0.22,h); hatch(K,0.45,-0.4,0.2,h); { const p=new THREE.Group(); p.position.set(0.45,h+0.12,-0.2); T.add(p); hmg(K,p,0,0,0,0.6); }
    for(let i=0;i<3;i++) stowBox(K,T,0.52,0.22,0.42, -0.58+i*0.58, h+0.11, -1.25, i===1?0x40402e:0x34342a); aerial(K,-0.7,-1.4,1.2); aerial(K,0.7,-1.4,1.0); },
  ch3(K){ const T=K.turretG, h=K.th;
    for(const s of [-1,1]){ rb(K,T,0.16,h*0.85,1.5, s*1.18,h*0.45,0.15,K.TUR); stowBox(K,T,0.3,0.36,0.9, s*1.15,h*0.45,-1.15,0x3a3f2c); smokeBank(K, s*0.95, h*0.75, 0.75, 5, s*-0.5); }
    sightBox(K, 0.55, h, 0.62, 1.05); { const p=new THREE.Group(); p.position.set(-0.5,h,-0.2); T.add(p); cy(K,p,0.1,0.12,0.3,0,0.15,0,K.STEEL,12); rb(K,p,0.34,0.3,0.36,0,0.44,0,K.dark(0x2b2c26)); bx(K,p,0.26,0.14,0.02,0,0.46,0.19,K.GLASS); }   // Orion commander sight
    { const r=new THREE.Group(); r.position.set(0.45,h,-0.45); T.add(r); rb(K,r,0.3,0.22,0.34,0,0.12,0,K.dark(0x30322a)); hmg(K,r,0.1,0.15,0.1,0.8); }   // RWS
    stowBox(K,T,2.0,0.36,0.5, 0,h*0.55,-1.85,0x34362b); aerial(K,-0.8,-1.4,1.3); aerial(K,0.8,-1.4,1.3);
    K.B(new THREE.BoxGeometry(2.6,0.14,0.8), K.HULL, 0, K.F+0.2, K.zf-0.45).rotation.x=0.33; },   // Dorchester glacis pack
  merkava(K){ const T=K.turretG, h=K.th;
    for(const s of [-1,1]){ const p=rb(K,T,0.08,0.36,0.46, s*1.0,h*0.5,0.2,K.dark(0x34362f)); p.rotation.y=s*0.3;   // Trophy radar panels
      cy(K,T,0.12,0.14,0.18, s*0.82,h+0.09,-0.75,K.STEEL,12); rb(K,T,0.2,0.18,0.28, s*0.82,h+0.27,-0.75,K.dark(0x2e302a)); }   // Trophy launchers
    for(const s of [-1,1]) for(let i=0;i<10;i++){ const z=-1.55+i*0.13; cy(K,T,0.008,0.008,0.42,s*0.98,-0.21,z,K.BLACK,4); K.mk(T,new THREE.SphereGeometry(0.045,6,4),K.STEEL,s*0.98,-0.44,z); }   // ball-and-chain curtain
    for(let i=0;i<7;i++){ const x=-0.8+i*0.27; cy(K,T,0.008,0.008,0.42,x,-0.21,-1.66,K.BLACK,4); K.mk(T,new THREE.SphereGeometry(0.045,6,4),K.STEEL,x,-0.44,-1.66); }
    sightBox(K, 0.48, h*0.95, 0.5); cupola(K, -0.4, -0.5, 0.24, h*0.95);
    { const m=cy(K,T,0.06,0.06,0.7,0.42,h+0.25,-0.3,K.dark(0x2a2b25),10); m.rotation.x=-0.9; }   // internal 60 mm mortar tube
    for(let i=0;i<2;i++) stowBox(K,T,0.9,0.25,0.4, (i?0.5:-0.5), h*0.45, -1.62, 0x3f3d30);
    K.B(new THREE.BoxGeometry(0.9,0.6,0.05), K.dark(0x3a3a30), 0, K.F-0.15, K.zr-0.01);           // rear crew door
    for(let k=0;k<4;k++) K.B(new THREE.BoxGeometry(0.75,0.025,0.035), K.STEEL, 0.45, K.F+0.535, 1.1+k*0.18);   // engine deck grille up front
    aerial(K,-0.6,-1.2,1.4); aerial(K,0.6,-1.2,1.2); },
  type99(K){ const T=K.turretG, h=K.th, ERA=K.ERA;
    for(const s of [-1,1]) for(let i=0;i<3;i++){ const e=K.mk(T,new RoundedBoxGeometry(0.34,h*0.7,0.3,1,0.03),ERA, s*(0.48+i*0.13), h*0.42, 1.18-i*0.18); e.rotation.y=s*0.55; }   // FY-4 ERA on the wedges
    { const p=new THREE.Group(); p.position.set(0.15,h,-0.3); T.add(p); rb(K,p,0.36,0.26,0.36,0,0.13,0,K.dark(0x2b2c26)); bx(K,p,0.28,0.12,0.02,0,0.14,0.19,K.GLASS); }   // JD-3 laser dazzler / LWS
    sightBox(K, 0.55, h, 0.55); { const p=new THREE.Group(); p.position.set(-0.5,h,-0.25); T.add(p); cy(K,p,0.08,0.09,0.3,0,0.15,0,K.STEEL,10); rb(K,p,0.3,0.26,0.32,0,0.42,0,K.dark(0x2a2b25)); bx(K,p,0.22,0.12,0.02,0,0.44,0.17,K.GLASS); }
    { const p=new THREE.Group(); p.position.set(0.5,h+0.12,-0.6); T.add(p); hmg(K,p,0,0,0,0.9); } hatch(K,0.5,-0.6,0.22,h);
    for(const s of [-1,1]) smokeBank(K, s*0.98, h*0.65, -0.2, 5, s*-0.45, 2);
    stowBox(K,T,1.8,0.32,0.5,0,h*0.5,-1.55); aerial(K,-0.8,-1.2,1.3); glacisERA(K, 2, 5, K.zf-0.25, 0.32); },
  k2(K){ const T=K.turretG, h=K.th;
    for(const [x,z] of [[0.92,0.85],[-0.92,0.85],[0.95,-1.2],[-0.95,-1.2]]){ const c=cy(K,T,0.0,0.09,0.16,x,h*0.8,z,K.dark(0x2a2c26),10); c.rotation.x=z>0?Math.PI/2:-Math.PI/2; }   // radar / laser warning receivers
    { const p=new THREE.Group(); p.position.set(-0.48,h,-0.15); T.add(p); cy(K,p,0.09,0.1,0.38,0,0.19,0,K.STEEL,10); rb(K,p,0.32,0.28,0.32,0,0.52,0,K.dark(0x2a2b25)); bx(K,p,0.24,0.13,0.02,0,0.54,0.17,K.GLASS); }   // KCPS
    sightBox(K, 0.5, h, 0.65, 0.95); K.mk(T,new THREE.SphereGeometry(0.16,14,10,0,Math.PI*2,0,Math.PI/2),K.dark(0x34362e),0,h,0.55);   // MMW radar dome
    for(const s of [-1,1]){ rb(K,T,0.06,h*0.8,1.0, s*1.1,h*0.42,0.05,K.TUR); smokeBank(K, s*0.92, h*0.72, 0.6, 4, s*-0.45); }
    stowBox(K,T,1.85,0.32,0.66,0,h*0.48,-1.72); hatch(K,0.45,-0.55,0.22,h); aerial(K,-0.8,-1.3,1.3); aerial(K,0.8,-1.3,1.3); },
  t14(K){ const T=K.turretG, h=K.th;
    for(const s of [-1,1]){ for(let i=0;i<5;i++){ const c=cy(K,T,0.065,0.065,0.34, s*0.95, 0.08, 0.6-i*0.3, K.dark(0x2b2d26), 8); c.rotation.z=Math.PI/2+s*0.65; }   // Afghanit launchers round the base
      rb(K,T,0.1,h*0.6,0.58, s*0.92,h*0.55,0.2,K.dark(0x3a3c32)); bx(K,T,0.02,h*0.4,0.4, s*0.975,h*0.55,0.2,K.GLASS); }   // AESA radar panels
    for(const [x,z] of [[0.68,0.95],[-0.68,0.95],[0.72,-0.9],[-0.72,-0.9]]){ rb(K,T,0.16,0.14,0.08,x,h*0.9,z,K.dark(0x262822)); bx(K,T,0.12,0.08,0.02,x,h*0.9,z+Math.sign(z)*0.05,K.GLASS); }
    { const r=new THREE.Group(); r.position.set(0.1,h,-0.35); T.add(r); rb(K,r,0.34,0.24,0.4,0,0.12,0,K.dark(0x30322a)); hmg(K,r,0.12,0.14,0.1,0.85); K.mk(r,new THREE.SphereGeometry(0.11,12,8),K.dark(0x22231e),-0.12,0.32,0.05); }   // RWS + sensor ball
    for(let i=0;i<6;i++){ const c=cy(K,T,0.05,0.05,0.24,-0.4+i*0.16,h+0.08,-0.85,K.STEEL,8); c.rotation.x=-0.6; }
    for(const hx of [-0.55,0,0.55]){ cy(K,K.body,0.18,0.18,0.05,hx,K.F+0.52-0.95,K.zf-0.75,K.HULL,12); bx(K,K.body,0.14,0.05,0.04,hx,K.F+0.56-0.95,K.zf-0.6,K.GLASS); }   // crew capsule hatches + periscopes
    glacisERA(K, 2, 5, K.zf-0.25, 0.32); },
  ghost(K){ const T=K.turretG, h=K.th, G2=new THREE.MeshStandardMaterial({ color:0x6ff0ff, emissive:0x3fd8ff, emissiveIntensity:1.6, roughness:0.3 });
    for(const s of [-1,1]){ bx(K,T,0.02,0.03,1.3, s*0.84,h*0.5,0.0,G2); bx(K,K.body,0.02,0.03,3.1, s*1.4,K.F-0.95,0.0,G2); }
    { const p=new THREE.Group(); p.position.set(-0.3,h,-0.4); T.add(p); cy(K,p,0.04,0.05,0.7,0,0.35,0,K.STEEL,8); K.mk(p,new THREE.SphereGeometry(0.12,12,8),K.dark(0x1d2024),0,0.74,0); }   // sensor mast
    for(const s of [-1,1]){ const pod=rb(K,T,0.22,0.16,0.62, s*0.92,h*0.35,-0.35,K.dark(0x23272b)); }   // drone pods
    bx(K,T,0.4,0.03,0.2, 0.3,h+0.015,0.1,G2); },
  colossus(K){ const T=K.turretG, h=K.th, ERA=K.ERA;
    for(const s of [-1,1]){ const pod=new THREE.Group(); pod.position.set(s*1.5,h*0.4,0.3); T.add(pod); rb(K,pod,0.4,0.4,0.8,0,0,0,K.dark(0x2f3328)); for(const dy of [-0.08,0.08]) hmg(K,pod,0,dy,0.4,0.85); }   // twin MG pods
    for(let r=0;r<2;r++) for(let k=-3;k<=3;k++){ const e=K.mk(T,new RoundedBoxGeometry(0.32,0.26,0.16,1,0.03),ERA, k*0.34, 0.16+r*0.3, 1.42-r*0.06); e.rotation.x=-0.2; }   // ERA wall on the face
    sightBox(K, 0.7, h, 0.7, 1.25); { const p=new THREE.Group(); p.position.set(-0.7,h,-0.2); T.add(p); cy(K,p,0.1,0.12,0.45,0,0.22,0,K.STEEL,10); rb(K,p,0.38,0.32,0.38,0,0.6,0,K.dark(0x2a2b25)); bx(K,p,0.3,0.15,0.02,0,0.62,0.2,K.GLASS); }
    cupola(K, -0.7, -0.75, 0.28, h); hatch(K, 0.6, -0.7, 0.26, h);
    slat(K, T, -1.4, 1.4, -2.1, -1.66, 0.0, h);
    for(const s of [-1,1]) smokeBank(K, s*1.25, h*0.8, -0.6, 6, s*-0.45, 2);
    glacisERA(K, 3, 7, K.zf-0.2, 0.3); aerial(K,-1.0,-1.4,1.5); aerial(K,1.0,-1.4,1.5); },
};
