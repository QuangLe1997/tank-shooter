// actors/general.js — Z245/Z246 THE GENERAL: a big, modern heavy operator on the soldier's rig — one continuous skinned body (camouflage uniform, balaclava, combat boots) that bends at every joint; a high-cut ballistic helmet with a tinted visor over the eyes, headset and boom mic, NVG mount, rails, strobe and counterweight; a plate carrier with mag, admin, radio and IFAK pouches, hydration pack, battle belt, drop-leg holster; knee and elbow pads; gloved hands closed round the rifle's grip and handguard, finger by finger; seated on the horse (rising at the trot and gallop, twisting in the saddle to aim) or on foot with every stance of the infantry rig
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HORSE, HUMAN_SCALE, XEOM } from '../../config.js';
import { blot, fitRealRifle, keySec, lineAlong, lineAround, loftGeo, makeSoldierMesh, pathKeys, skinMesh, toLocal, trimGeo } from '../hub.js';

let _GM=null;
function gmats(){ if(_GM) return _GM; const S=(c,r,m,o)=>new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:r, metalness:m }, o||{}));
  _GM={ cloth:new THREE.MeshPhysicalMaterial({ vertexColors:true, roughness:0.9, metalness:0, sheen:0.45, sheenRoughness:0.6, sheenColor:new THREE.Color(0x77745e) }),
    gear:S(0x6c5e45,0.88,0), gearDk:S(0x54493a,0.9,0), helm:S(0x786a4f,0.72,0.02), hard:S(0x1d1e1f,0.5,0.12), rubber:S(0x141414,0.92,0), glove:S(0x4b4336,0.82,0),
    red:S(0x8a1c18,0.7,0), lens:S(0x0c2a18,0.1,0.3, { emissive:0x1a5a2a, emissiveIntensity:0.35 }),
    visor:new THREE.MeshPhysicalMaterial({ color:0x2a3a44, roughness:0.04, metalness:0.15, transparent:true, opacity:0.5, clearcoat:1, clearcoatRoughness:0.03, side:THREE.DoubleSide, depthWrite:false }) };
  return _GM; }
// multicam-like uniform: tan base, green and brown blotches, a few dark flecks
const C_TAN=new THREE.Color(0x8c7f60), C_GRN=new THREE.Color(0x646446), C_BRN=new THREE.Color(0x6a553e), C_DRK=new THREE.Color(0x3f3a2c), C_BAL=new THREE.Color(0x2f302a), C_BOOT=new THREE.Color(0x5e4b36);
function camo(q, c){ const a=blot(q, 9), b=blot(q.clone().addScalar(3.1), 13), d=blot(q.clone().addScalar(7.7), 23);
  c.copy(C_TAN); if(a>0.28) c.lerp(C_GRN, 0.85); else if(b>0.3) c.lerp(C_BRN, 0.8); if(d>0.55) c.lerp(C_DRK, 0.75); c.multiplyScalar(0.94+0.06*blot(q, 60)); }
const near=(t, at, h)=>Math.abs(t-at)<(h||0.06);
const V3=(a)=>new THREE.Vector3(a[0], a[1], a[2]);
// the rifle sits forward of the plate carrier with its butt in the right shoulder pocket (offset inside the rig's gun joint)
const GOFF=new THREE.Vector3(0.06, 0.06, 0.17);

export function buildGeneral(){
  const g=makeSoldierMesh({ enemy:false }), u=g.userData, M=gmats();
  u.parts=[];                                                                    // nothing of him is drawn by the troop batch — he is his own mesh
  u.body.scale.set(1.02, 1.02, 1.02); u.tint=new THREE.Color(1, 1, 1);          // a tall, heavy man
  g.updateMatrixWorld(true);                                                     // rest pose: the frame every section below is built in
  const [L0, L1]=u.legs, bones=[u.body, u.up, u.head, u.arms, u.lh, L0.hip, L0.knee, L1.hip, L1.knee];
  const B=0, U=1, H=2, A=3, LH=4, cloth=[], hardS=[], P=plate();
  const V=(F, y, z, rx, rt, rb, w, o)=>keySec(F, [0, y, z], [0, 1, 0], [0, 0, 1], rx, rt, rb, Object.assign({ w, e:0.9 }, o||{}));
  // ---- the trunk: hips → chest → neck → balaclava'd head, one tube ----
  const TK=[ V(u.body, 0.6, 0, 0.02, 0.02, 0.02, [[B,1]]), V(u.body, 0.63, 0, 0.15, 0.11, 0.11, [[B,1]]), V(u.body, 0.69, 0, 0.185, 0.125, 0.125, [[B,0.85],[U,0.15]]),
    V(u.up, 0.0, 0.005, 0.182, 0.125, 0.12, [[B,0.4],[U,0.6]]), V(u.up, 0.07, 0.01, 0.175, 0.13, 0.12, [[U,1]]), V(u.up, 0.18, 0.01, 0.2, 0.15, 0.135, [[U,1]]),
    V(u.up, 0.3, 0.01, 0.23, 0.165, 0.145, [[U,1]]), V(u.up, 0.4, 0.01, 0.245, 0.16, 0.15, [[U,1]]), V(u.up, 0.48, 0, 0.235, 0.14, 0.14, [[U,1]]), V(u.up, 0.535, 0, 0.16, 0.1, 0.1, [[U,1]]),
    V(u.up, 0.565, 0.005, 0.075, 0.072, 0.068, [[U,0.75],[H,0.25]]), V(u.head, 0.0, 0.005, 0.07, 0.07, 0.066, [[U,0.3],[H,0.7]]), V(u.head, 0.04, 0.012, 0.078, 0.086, 0.072, [[H,1]]),
    V(u.head, 0.085, 0.016, 0.092, 0.106, 0.09, [[H,1]]), V(u.head, 0.14, 0.01, 0.102, 0.108, 0.102, [[H,1]]), V(u.head, 0.2, 0, 0.106, 0.102, 0.108, [[H,1]]),
    V(u.head, 0.25, 0, 0.098, 0.092, 0.1, [[H,1]]), V(u.head, 0.29, 0, 0.065, 0.06, 0.068, [[H,1]]), V(u.head, 0.305, 0, 0.006, 0.006, 0.006, [[H,1]]) ];
  cloth.push(loftGeo(TK, { seg:8, ring:30, caps:true, skin:true, color:true, tint:(s, a, t, c, q)=>{ if(t<10.4) camo(q, c); else { c.copy(C_BAL); if(t>13.4 && t<14.3 && Math.abs(a-Math.PI/2)<0.9) c.multiplyScalar(0.55); } } }));
  // ---- legs: thigh → knee → calf → boot shaft, one tube from inside the hips; boots with lug soles; knee pads ----
  for(let i=0;i<2;i++){ const L=u.legs[i], HP=5+i*2, KN=6+i*2;
    const LK=(F, y, z, rx, rt, rb, w)=>keySec(F, [0, y, z], [0, -1, 0], [0, 0, 1], rx, rt, rb, { w, e:0.94 });
    const K=[ LK(L.hip, 0.1, 0, 0.03, 0.03, 0.03, [[B,1]]), LK(L.hip, 0.06, 0, 0.11, 0.11, 0.11, [[B,1]]), LK(L.hip, 0, 0, 0.115, 0.115, 0.12, [[B,0.5],[HP,0.5]]),
      LK(L.hip, -0.1, 0.005, 0.11, 0.112, 0.115, [[HP,1]]), LK(L.hip, -0.24, 0.01, 0.094, 0.095, 0.092, [[HP,1]]), LK(L.hip, -0.33, 0.012, 0.08, 0.082, 0.076, [[HP,0.85],[KN,0.15]]),
      LK(L.hip, -0.38, 0.015, 0.076, 0.08, 0.074, [[HP,0.5],[KN,0.5]]), LK(L.knee, -0.05, 0.008, 0.072, 0.074, 0.076, [[KN,1]]), LK(L.knee, -0.13, 0, 0.074, 0.068, 0.09, [[KN,1]]),
      LK(L.knee, -0.23, 0, 0.066, 0.062, 0.07, [[KN,1]]), LK(L.knee, -0.29, 0, 0.068, 0.068, 0.068, [[KN,1]]), LK(L.knee, -0.33, 0, 0.064, 0.064, 0.064, [[KN,1]]), LK(L.knee, -0.34, 0, 0.006, 0.006, 0.006, [[KN,1]]) ];
    cloth.push(loftGeo(K, { seg:8, ring:22, caps:true, skin:true, color:true, tint:(s, a, t, c, q)=>{ if(t>9.2){ c.copy(C_BOOT); if(near(t, 9.35, 0.05)) c.multiplyScalar(0.6); } else camo(q, c); } }));
    hardS.push(loftGeo(K, { t0:5.5, t1:7.2, a0:Math.PI*0.2, a1:Math.PI*0.8, off:0.024, seg:8, ring:12, skin:true }));                // knee pad
    for(const t of [5.6, 7.1]) hardS.push(loftGeo(K, { t0:t, t1:t+0.12, off:0.008, seg:1, ring:20, skin:true }));                         // its straps
    const BK=(z, y, rx, rt, rb)=>keySec(L.knee, [0, y, z], [0, 0, 1], [0, 1, 0], rx, rt, rb, { w:[[KN,1]], e:0.8 });
    const BT=[ BK(-0.115, -0.33, 0.01, 0.01, 0.01), BK(-0.1, -0.345, 0.05, 0.07, 0.05), BK(-0.06, -0.335, 0.06, 0.085, 0.062), BK(0, -0.33, 0.062, 0.085, 0.068),
      BK(0.06, -0.355, 0.062, 0.058, 0.042), BK(0.12, -0.365, 0.058, 0.044, 0.034), BK(0.18, -0.37, 0.052, 0.036, 0.03), BK(0.225, -0.372, 0.04, 0.03, 0.028), BK(0.25, -0.374, 0.006, 0.006, 0.006) ];
    cloth.push(loftGeo(BT, { seg:8, ring:22, caps:true, skin:true, color:true, tint:(s, a, t, c)=>{ c.copy(C_BOOT); const sa=Math.sin(a);
      if(sa>0.55 && t>2.6 && t<5.6 && (Math.round(t*8)%2)) c.multiplyScalar(0.45); else if(t>5.7) c.multiplyScalar(0.8); } }));              // laces · scuffed toe cap
    const SL=BT.map(k=>keySec(null, [k.c.x, k.c.y-(k.rb-0.006), k.c.z], [k.n.x, k.n.y, k.n.z], [k.u.x, k.u.y, k.u.z], k.rx+0.008, 0.012, 0.014, { w:k.w, e:0.45 }));
    SL[0].rx=SL[SL.length-1].rx=0.01; hardS.push(loftGeo(SL, { seg:8, ring:18, caps:true, skin:true })); }                                // the lug sole
  // ---- arms: sleeve from inside the shoulder to a gloved wrist; elbow pads ----
  const armPath=(pts, R, W)=>{ const m=u.arms.matrixWorld, P2=pts.map(p=>V3(p).applyMatrix4(m)), n=P2.length-1;
    const K=pathKeys(P2, null, t=>{ const r=R[Math.round(t*n)]; return [r, r, r]; }, t=>({ w:W[Math.round(t*n)] }));
    cloth.push(loftGeo(K, { seg:8, ring:18, caps:true, skin:true, color:true, tint:(s, a, t, c, q)=>camo(q, c) }));
    hardS.push(loftGeo(K, { t0:2.75, t1:3.25, off:0.011, seg:6, ring:16, skin:true })); };   // elbow pad
  armPath([[0.2,0.06,-0.02],[0.275,0.03,-0.03],[0.295,-0.09,0.02],[0.3,-0.2,0.08],[0.22,-0.15,0.15],[0.13,-0.086,0.221]],
    [0.07,0.085,0.078,0.066,0.058,0.044], [[[U,1]],[[U,0.4],[A,0.6]],[[A,1]],[[A,1]],[[A,1]],[[A,1]]]);
  armPath([[-0.2,0.06,-0.02],[-0.275,0.03,-0.03],[-0.23,-0.1,0.11],[-0.17,-0.21,0.24],[-0.07,-0.14,0.38],[0.04,-0.064,0.51]],
    [0.07,0.085,0.078,0.066,0.058,0.044], [[[U,1]],[[U,0.4],[A,0.6]],[[A,1]],[[A,0.5],[LH,0.5]],[[LH,1]],[[LH,1]]]);
  const skel=new THREE.Skeleton(bones), suit=skinMesh(mergeGeometries(cloth, false), M.cloth, skel, g); u.suit=suit;
  skinMesh(mergeGeometries(hardS, false), M.hard, skel, g); cloth.forEach(x=>x.dispose()); hardS.forEach(x=>x.dispose());
  const rb=(w, h, d, r)=>new RoundedBoxGeometry(w, h, d, 3, r==null ? Math.min(w, h, d)*0.3 : r), at=(geo, x, y, z, rx, ry, rz)=>{ geo.rotateX(rx||0); geo.rotateY(ry||0); geo.rotateZ(rz||0); geo.translate(x, y, z); return geo; };
  const add=(joint, mat, geo)=>P.addG(joint, mat, geo), inUp=(geo)=>toLocal(geo, u.up);
  // ---- plate carrier: front and back plates in their covers, cummerbund, shoulder straps, pouches, radio, hydration pack ----
  const PK=(zs, rxs)=>[0.12, 0.2, 0.3, 0.4, 0.46].map((y, i)=>keySec(null, [0, y, zs[i]], [0, 1, 0], [0, 0, 1], rxs[i], 0.03, 0.03, { e:0.35 }));
  add(u.up, M.gear, loftGeo(PK([0.18, 0.195, 0.19, 0.17, 0.15], [0.16, 0.18, 0.19, 0.18, 0.13]), { seg:4, ring:24, caps:true }));
  add(u.up, M.gear, loftGeo(PK([-0.165, -0.175, -0.18, -0.17, -0.16], [0.16, 0.18, 0.19, 0.18, 0.14]), { seg:4, ring:24, caps:true }));
  add(u.up, M.gearDk, inUp(loftGeo(TK, { t0:4.6, t1:5.9, off:0.035, seg:4, ring:30 })));                                             // cummerbund
  for(const sx of [-1,1]) add(u.up, M.gearDk, trimGeo([V3([sx*0.1,0.47,0.16]), V3([sx*0.13,0.555,0.06]), V3([sx*0.13,0.555,-0.07]), V3([sx*0.1,0.47,-0.17])], 0.022));   // shoulder straps
  for(const x of [-0.075, 0, 0.075]){ add(u.up, M.gear, at(rb(0.068, 0.12, 0.05), x, 0.2, 0.235)); add(u.up, M.gearDk, at(rb(0.072, 0.032, 0.056), x, 0.265, 0.237)); }   // three mag pouches with flaps
  add(u.up, M.gear, at(rb(0.17, 0.08, 0.035), 0, 0.355, 0.22)); add(u.up, M.red, at(rb(0.05, 0.032, 0.006, 0.002), 0.045, 0.36, 0.24));   // admin pouch · patch
  add(u.up, M.gear, at(rb(0.075, 0.14, 0.065), -0.25, 0.27, -0.02)); add(u.up, M.hard, at(rb(0.06, 0.06, 0.05), -0.25, 0.365, -0.02));   // radio pouch · radio
  add(u.up, M.hard, at(new THREE.CylinderGeometry(0.004, 0.006, 0.36, 6), -0.255, 0.55, -0.07, -0.2));                                  // whip antenna
  add(u.up, M.gear, at(rb(0.08, 0.1, 0.07), 0.25, 0.22, -0.03)); add(u.up, M.red, at(rb(0.004, 0.035, 0.035, 0.001), 0.292, 0.23, -0.03));   // IFAK + its red cross tab
  add(u.up, M.gear, at(rb(0.25, 0.34, 0.075), 0, 0.3, -0.245)); add(u.up, M.hard, trimGeo([V3([0.09,0.46,-0.24]), V3([0.15,0.56,-0.1]), V3([0.15,0.53,0.08]), V3([0.12,0.42,0.2])], 0.007));   // hydration pack + its tube
  for(const x of [0.15, 0.2]) add(u.up, M.gearDk, at(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 12), x, 0.12, 0.15));               // smoke grenades
  // ---- battle belt, dump pouch, drop-leg holster with a pistol ----
  add(u.body, M.gearDk, toLocal(loftGeo(TK, { t0:2.35, t1:2.85, off:0.03, seg:3, ring:30 }), u.body)); add(u.body, M.hard, at(rb(0.06, 0.045, 0.02), 0, 0.705, 0.165));
  add(u.body, M.gear, at(rb(0.1, 0.12, 0.08), -0.21, 0.66, -0.07));
  { const Rh=u.legs.find(l=>l.sx>0)||u.legs[1]; add(Rh.hip, M.gear, at(rb(0.06, 0.17, 0.11), 0.12, -0.13, 0.01)); add(Rh.hip, M.hard, at(rb(0.035, 0.07, 0.04), 0.125, -0.02, -0.02, 0.2));
    add(Rh.hip, M.gearDk, loftGeo([keySec(null, [0,-0.08,0], [0,-1,0], [0,0,1], 0.12, 0.12, 0.125), keySec(null, [0,-0.11,0], [0,-1,0], [0,0,1], 0.118, 0.12, 0.123)], { seg:1, ring:24 })); }   // leg strap
  // ---- helmet: high-cut shell, visor over the eyes, rails, NVG mount, headset + boom mic, strobe, counterweight ----
  const HK=[ V(u.head, 0.15, -0.005, 0.13, 0.134, 0.142), V(u.head, 0.2, -0.005, 0.138, 0.142, 0.15), V(u.head, 0.26, -0.005, 0.13, 0.13, 0.14), V(u.head, 0.31, -0.005, 0.1, 0.098, 0.108),
    V(u.head, 0.345, -0.005, 0.05, 0.05, 0.055), V(u.head, 0.358, -0.005, 0.006, 0.006, 0.006) ];
  const inHead=(geo)=>toLocal(geo, u.head);
  add(u.head, M.helm, inHead(loftGeo(HK, { seg:6, ring:30, caps:true })));
  add(u.head, M.hard, inHead(loftGeo(HK, { t0:0, t1:0.12, off:0.004, seg:1, ring:30 })));                                                   // rubber edge
  for(const a0 of [-0.95, Math.PI-0.95]) add(u.head, M.hard, inHead(trimGeo(lineAround(HK, 0.6, a0, a0+1.9, 0.006, 12), 0.009)));        // ARC rails
  const VK=[0.055, 0.1, 0.15, 0.185].map((y, i)=>V(u.head, y, 0.01, [0.128, 0.138, 0.142, 0.14][i], [0.142, 0.152, 0.156, 0.15][i], 0.12));
  add(u.head, M.visor, inHead(loftGeo(VK, { a0:Math.PI*0.1, a1:Math.PI*0.9, seg:6, ring:20 })));                                         // the visor glass
  for(const a of [Math.PI*0.1, Math.PI*0.9]) add(u.head, M.hard, inHead(trimGeo(lineAlong(VK, 0, 3, a, 0.002, 8), 0.006)));
  for(const t of [0, 3]) add(u.head, M.hard, inHead(trimGeo(lineAround(VK, t, Math.PI*0.1, Math.PI*0.9, 0.002, 16), 0.006)));
  add(u.head, M.hard, at(rb(0.065, 0.05, 0.03), 0, 0.25, 0.135, -0.35)); add(u.head, M.hard, at(rb(0.03, 0.06, 0.02), 0, 0.215, 0.152, -0.2));   // NVG shroud + arm
  add(u.head, M.gear, at(rb(0.12, 0.075, 0.05), 0, 0.22, -0.155, 0.35)); add(u.head, M.hard, at(rb(0.025, 0.03, 0.04), 0.13, 0.27, -0.06)); add(u.head, M.lens, at(new THREE.SphereGeometry(0.009, 8, 6), 0.143, 0.285, -0.06));   // counterweight · strobe
  add(u.head, M.gearDk, at(rb(0.07, 0.04, 0.008, 0.003), 0, 0.3, 0.1, -0.75));                                                           // IR patch
  const cupG=()=>{ const g2=new THREE.LatheGeometry([[0,0],[0.05,0],[0.054,0.012],[0.052,0.036],[0.04,0.048],[0,0.05]].map(p=>new THREE.Vector2(p[0], p[1])), 20); return g2; };
  for(const sx of [-1,1]) add(u.head, M.hard, at(cupG(), sx*0.118, 0.13, 0.0, 0, 0, -sx*Math.PI/2));                                     // headset cups
  add(u.head, M.hard, trimGeo([V3([-0.16,0.12,0.03]), V3([-0.14,0.08,0.09]), V3([-0.09,0.06,0.135]), V3([-0.04,0.06,0.16])], 0.005)); add(u.head, M.rubber, at(new THREE.SphereGeometry(0.016, 10, 8), -0.035, 0.06, 0.162));   // boom mic
  // ---- gloved hands: the right closed round the pistol grip, index finger along the frame; the left under the handguard ----
  rightHand(u.gun, M, P); leftHand(u, M, P);
  P.done(); u.isGeneral=true;
  battleRifle(g);
  g.scale.setScalar(HUMAN_SCALE);
  return g; }
// a finger: a path of knuckles, a gloved radius tapering to the tip
function finger(pts, r0, r1){ const P=pts.map(V3), n=P.length-1; return loftGeo(pathKeys(P, null, t=>{ const r=r0+(r1-r0)*t; return [r, r*0.92, r*0.92]; }), { seg:5, ring:10, caps:true }); }
// pistol-grip frame (gun space): centre G0, axis A up the grip, Z toward the muzzle, X to the right
const G0=new THREE.Vector3(0, -0.1, -0.05).add(GOFF), GA=new THREE.Vector3(0, Math.cos(0.32), Math.sin(0.32)), GZ=new THREE.Vector3(0, -Math.sin(0.32), Math.cos(0.32)), GX=new THREE.Vector3(1, 0, 0);
const gp=(x, y, z)=>G0.clone().addScaledVector(GX, x).addScaledVector(GA, y).addScaledVector(GZ, z);
function rightHand(gun, M, P){ const rx=0.034, rz=0.041, ring=(th, y, k)=>{ const a=th*Math.PI/180, p=gp(Math.cos(a)*rx*k, y, Math.sin(a)*rz*k); return [p.x, p.y, p.z]; };
  for(const [y, r] of [[0.024, 0.0118], [-0.003, 0.0115], [-0.03, 0.0102]]) P.addG(gun, M.glove, finger([-35, 10, 55, 100, 140, 172].map((th, i)=>ring(th, y, i ? 1 : 1.12)), r, r*0.78));   // middle · ring · little finger
  P.addG(gun, M.glove, finger([[0.03,0.045,-0.012],[0.032,0.05,0.0]].map(p=>{ const q=gp(...p); return [q.x, q.y, q.z]; }).concat([[0.026,-0.056,0.02],[0.022,-0.056,0.048],[0.019,-0.057,0.066]]), 0.0118, 0.0092));   // index along the frame
  P.addG(gun, M.glove, finger([-55, -95, -135, -170].map((th, i)=>ring(th, 0.05+i*0.003, 1.05)), 0.0125, 0.0098));                     // thumb round the back of the grip
  const palm=new THREE.SphereGeometry(1, 16, 12); palm.scale(0.024, 0.055, 0.034); const q=gp(0.022, 0.006, -0.026); palm.translate(q.x, q.y, q.z); P.addG(gun, M.glove, palm);
  const heel=new THREE.SphereGeometry(1, 14, 10); heel.scale(0.032, 0.045, 0.02); const h=gp(0.004, -0.01, -0.043); heel.translate(h.x, h.y, h.z); P.addG(gun, M.glove, heel);
  const knk=new THREE.SphereGeometry(1, 12, 8); knk.scale(0.012, 0.048, 0.03); const kq=gp(0.045, 0.0, 0.004); knk.translate(kq.x, kq.y, kq.z); P.addG(gun, M.hard, knk);   // knuckle armour
  const w=gp(0.026, -0.005, -0.062), w2=w.clone().add(new THREE.Vector3(0.17, -0.114, -0.141).normalize().multiplyScalar(0.06));
  P.addG(gun, M.glove, loftGeo(pathKeys([w, w2], null, ()=>[0.042, 0.04, 0.04]), { seg:2, ring:16, caps:true })); }                         // glove cuff
function leftHand(u, M, P){ const gun=u.gun, G=new THREE.Group(); gun.add(G); gun.updateMatrixWorld(true); const geos=[];
  const ring=(phi, z, k)=>{ const a=phi*Math.PI/180; return [Math.cos(a)*0.05*k, -0.004+Math.sin(a)*0.06*k, z]; }, o=(p)=>[p[0]+GOFF.x, p[1]+GOFF.y, p[2]+GOFF.z];
  [[0.27,0.0118],[0.247,0.0118],[0.224,0.0112],[0.202,0.0102]].forEach(([z, r])=>geos.push(finger([205, 240, 275, 310, 345, 15].map((ph, i)=>o(ring(ph, z, i ? 1 : 1.1))), r, r*0.78)));   // fingers up the far side of the magwell
  geos.push(finger([[-0.045,-0.03,0.205],[-0.05,-0.005,0.24],[-0.047,0.015,0.275],[-0.04,0.026,0.3]].map(o), 0.0125, 0.0098));        // thumb along the near side
  const palm=new THREE.SphereGeometry(1, 16, 12); palm.scale(0.024, 0.03, 0.055); palm.translate(...o([-0.042, -0.05, 0.235])); geos.push(palm);
  const knk=new THREE.SphereGeometry(1, 12, 8); knk.scale(0.012, 0.03, 0.048); knk.translate(...o([-0.06, -0.035, 0.235]));
  const cw=V3(o([-0.05,-0.06,0.19])); geos.push(loftGeo(pathKeys([cw, cw.clone().add(new THREE.Vector3(-0.21, -0.146, -0.27).normalize().multiplyScalar(0.06))], null, ()=>[0.042, 0.04, 0.04]), { seg:2, ring:16, caps:true }));   // cuff
  for(const g2 of geos){ g2.applyMatrix4(gun.matrixWorld); P.addG(u.lh, M.glove, toLocal(g2, u.lh)); }
  knk.applyMatrix4(gun.matrixWorld); P.addG(u.lh, M.hard, toLocal(knk, u.lh)); gun.remove(G); }
// rigid pieces merged per joint and material (gear, gloves, the rifle)
function plate(){ const sets=new Map();
  const add=(joint, mat, geo, x, y, z, rx, ry, rz)=>{ geo.rotateX(rx||0); geo.rotateY(ry||0); geo.rotateZ(rz||0); geo.translate(x||0, y||0, z||0);
    const k=joint.uuid+'|'+mat.uuid; if(!sets.has(k)) sets.set(k, { joint, mat, geos:[] }); sets.get(k).geos.push(geo.index?geo.toNonIndexed():geo); };
  const done=()=>{ for(const { joint, mat, geos } of sets.values()){ for(const g of geos){ for(const a of Object.keys(g.attributes)) if(a!=='position'&&a!=='normal') g.deleteAttribute(a); }
      const m=new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow=true; m.receiveShadow=true; joint.add(m); geos.forEach(g=>g.dispose()); } };
  const addG=(joint, mat, geo)=>{ const k=joint.uuid+'|'+mat.uuid; if(!sets.has(k)) sets.set(k, { joint, mat, geos:[] }); sets.get(k).geos.push(geo.index?geo.toNonIndexed():geo); };
  return { add, addG, done }; }
const cyl=(a,b,h,n)=>new THREE.CylinderGeometry(a,b,h,n||14,1), box=(w,h,d)=>new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d)*0.28);
// Z245 THE GENERAL'S RIFLE — a 7.62 mm battle rifle: flat-dark-earth receiver with a full-length rail, M-LOK handguard, 20-round box magazine,
//   free-floated barrel with a three-port muzzle brake, a 3–18× scope on rings with turrets, folding bipod, adjustable stock with cheek riser, sling (Z246 every edge eased)
function battleRifle(g){ const u=g.userData;
  const R=gunMats(), P=plate(), G=new THREE.Group(); G.position.copy(GOFF); u.gun.add(G);
  P.add(G, R.fde, box(0.068, 0.1, 0.46), 0, 0.0, 0.1);                                   // receiver
  for(let k=0;k<14;k++) P.add(G, R.blk, box(0.05, 0.012, 0.016), 0, 0.058, -0.08+k*0.05); // picatinny rail teeth
  P.add(G, R.fde, box(0.072, 0.082, 0.34), 0, -0.004, 0.48);                              // handguard
  for(let k=0;k<4;k++) for(const sx of [-1,1]) P.add(G, R.blk, box(0.006, 0.022, 0.05), sx*0.036, -0.01, 0.38+k*0.07);   // M-LOK slots
  P.add(G, R.blk, cyl(0.015, 0.017, 0.32, 12), 0, 0.005, 0.8, Math.PI/2);                 // barrel
  P.add(G, R.blk, cyl(0.026, 0.026, 0.085, 14), 0, 0.005, 0.99, Math.PI/2);               // muzzle brake
  for(let k=0;k<3;k++) for(const sx of [-1,1]) P.add(G, R.slot, box(0.006, 0.012, 0.012), sx*0.026, 0.005, 0.965+k*0.022);
  P.add(G, R.blk, box(0.052, 0.21, 0.085), 0, -0.15, 0.13, 0.16);                         // 20-round magazine
  P.add(G, R.blk, box(0.04, 0.11, 0.055), 0, -0.1, -0.05, 0.32);                           // pistol grip (raked back, the right hand closes round it)
  P.add(G, R.blk, box(0.014, 0.05, 0.085), 0, -0.065, 0.02);                               // trigger guard
  P.add(G, R.fde, box(0.06, 0.1, 0.18), 0, -0.02, -0.22); P.add(G, R.fde, box(0.05, 0.045, 0.12), 0, 0.045, -0.2); P.add(G, R.blk, box(0.064, 0.115, 0.03), 0, -0.025, -0.32);   // stock · cheek riser · butt pad
  P.add(G, R.blk, cyl(0.023, 0.023, 0.3, 16), 0, 0.105, 0.08, Math.PI/2);                  // scope tube
  P.add(G, R.blk, cyl(0.034, 0.024, 0.07, 16), 0, 0.105, 0.26, Math.PI/2); P.add(G, R.blk, cyl(0.03, 0.023, 0.06, 16), 0, 0.105, -0.09, Math.PI/2);   // objective + ocular bells
  P.add(G, R.lens, cyl(0.03, 0.03, 0.004, 16), 0, 0.105, 0.296, Math.PI/2);
  P.add(G, R.blk, cyl(0.012, 0.012, 0.03, 10), 0, 0.135, 0.08); P.add(G, R.blk, cyl(0.012, 0.012, 0.03, 10), 0.03, 0.105, 0.08, 0, 0, Math.PI/2);   // turrets
  for(const z of [0.0, 0.16]) P.add(G, R.blk, box(0.04, 0.05, 0.022), 0, 0.075, z);        // rings
  for(const sx of [-1,1]) P.add(G, R.blk, cyl(0.007, 0.007, 0.24, 8), sx*0.022, -0.06, 0.56, Math.PI/2);   // folded bipod legs
  P.add(G, R.blk, box(0.028, 0.07, 0.03), 0, -0.08, 0.44, 0.35);                          // angled fore-grip
  P.add(G, R.sling, box(0.012, 0.014, 0.66), -0.04, -0.03, 0.12);                          // sling
  P.done(); u.muzzle.position.set(GOFF.x, 0.005+GOFF.y, 1.04+GOFF.z);
  fitRealRifle(G, u, GOFF); }   // Z247 the photo-scanned rifle replaces this one once it has loaded
let _RM=null;
function gunMats(){ if(_RM) return _RM; const S=(c,r,m,o)=>new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:r, metalness:m }, o||{}));
  _RM={ fde:S(0x8a7a58,0.62,0.25), blk:S(0x1c1d1f,0.42,0.6), slot:S(0x050505,0.8,0.2), sling:S(0x3c3a2c,0.9,0.0), lens:S(0x0a1a2a,0.05,0.4, { emissive:0x0a2a4a, emissiveIntensity:0.25 }) }; return _RM; }
// ---- riding: thighs round the barrel, heels down in the stirrups; rising out of the saddle at the trot (posting) and the gallop (two-point),
//   leaning into the stride; the torso twists toward the aim (the horse goes one way, the rifle another) ----
export function poseRider(g, H, dt, twist, firing){ const u=g.userData; if(!u.legs) return; const P=u.pose||(u.pose={ rx:0, y:0, z:0, up:0, arm:0, kw:0, pw:0 }); P.kw=P.pw=0; P.lw=0; u.stance='ride';
  const gal=H.gait==='gallop'?1:0, can=H.gait==='canter'?1:0, tro=H.gait==='trot'?1:0, ph=H.phase;
  const lift = gal*0.09+tro*Math.max(0, Math.sin(ph*4*Math.PI))*0.07+can*0.03;
  u.rideLift=(u.rideLift||0)+(lift-(u.rideLift||0))*Math.min(1, dt*10);
  g.position.y = H.bike ? XEOM[H.bike].seat[0]-0.74*u.body.scale.y*g.scale.y : HORSE.saddleY+0.06-0.74*u.body.scale.y*g.scale.y + u.rideLift - (H.B.position.y-HORSE.bodyY)*gal*0.6;   // two-point: the legs soak the horse's bob, the head stays level · Z282 on a bike: the pillion / cyclo seat
  const RP = H.bike && XEOM[H.bike].pose ? XEOM.poses[XEOM[H.bike].pose] : null;   // Z293 on a ride: straddling the pillion, or standing braced in the bed
  if(RP){ g.position.y = XEOM[H.bike].seat[0] - (RP.stand || u.realOp ? 0 : 0.74*u.body.scale.y*g.scale.y);   // the real soldier's hips are put on the rig's origin (real-cav), the procedural one stands on it
    for(const L of u.legs){ L.hip.rotation.x=RP.hip; L.hip.rotation.y=0; L.hip.rotation.z=L.sx*RP.spread; L.knee.rotation.x=RP.knee; } }
  else for(const L of u.legs){ L.hip.rotation.x=-0.83-gal*0.3; L.hip.rotation.y=0; L.hip.rotation.z=L.sx*0.62; L.knee.rotation.x=1.12+gal*0.4; }   // Z246 thighs spread round the barrel, shins down the horse's sides to the stirrups
  u.body.rotation.set(0, 0, 0); u.body.position.set(0, 0, 0);
  const lean = gal*0.42 + can*0.16 + tro*0.06 + Math.sin(ph*2*Math.PI)*can*0.05;
  u.up.rotation.x = lean*(firing?0.45:1); u.up.rotation.y += (Math.max(-2.0, Math.min(2.0, twist)) - u.up.rotation.y)*Math.min(1, dt*10);
  if(u.arms){ u.arms.rotation.x = -lean*(firing?0.45:0.7) - (firing?0.02:0) + (u.kick||0)*-0.05; u.arms.rotation.y = Math.max(-0.5, Math.min(0.5, twist - u.up.rotation.y)); u.arms.rotation.z = 0; }
  u.kick=Math.max(0, (u.kick||0)-dt*9); if(firing) u.kick=1; u.gun.position.z=0.16-u.kick*0.06; u.gun.rotation.x=-u.kick*0.12;
  if(u.head){ u.head.rotation.y = 0; u.head.rotation.x = -lean*0.6; }
  if(u.cloak) u.cloak.rotation.x = Math.min(1.25, 0.12 + Math.abs(H.v)*0.075) + Math.sin(performance.now()/1000*7)*0.04*Math.min(1, Math.abs(H.v)/6); }
export function cloakFoot(g, spd, prone){ const u=g.userData; if(u.cloak) u.cloak.rotation.x = prone ? 0.04 : Math.min(0.9, 0.06 + spd*0.11) + Math.sin(performance.now()/1000*5)*0.03*Math.min(1, spd/3); }
