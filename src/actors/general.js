// actors/general.js — Z245 THE GENERAL: a soldier's rig in full plate (armet with visor and crest, gorget, ridged breastplate, pauldrons, faulds and tassets, vambraces, gauntlets, cuisses, poleyns, greaves, sabatons) with a cloak; seated on the horse (rising at the trot and gallop, twisting in the saddle to aim) or on foot with every stance of the infantry rig
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HORSE, HUMAN_SCALE } from '../../config.js';
import { makeSoldierMesh } from '../hub.js';

let _GM=null;
function gmats(){ if(_GM) return _GM; const S=(c,r,m,o)=>new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:r, metalness:m }, o||{}));
  _GM={ steel:S(0xc4c8cc,0.26,0.95), dark:S(0x3c4044,0.4,0.85), gold:S(0xd6a63e,0.28,0.95), plume:S(0xb01c16,0.8,0.0), slit:S(0x050505,0.6,0.2),
    cloak:S(0x1c4a24,0.85,0.0, { side:THREE.DoubleSide }), trim:S(0xc8962e,0.45,0.7, { side:THREE.DoubleSide }) };
  return _GM; }
// collect pieces per joint and material, merge each set into one mesh (a man in plate = a handful of draws, not fifty)
function plate(){ const sets=new Map();
  const add=(joint, mat, geo, x, y, z, rx, ry, rz, sx, sy, sz)=>{ geo.scale(sx||1, sy||1, sz||1); geo.rotateX(rx||0); geo.rotateY(ry||0); geo.rotateZ(rz||0); geo.translate(x||0, y||0, z||0);
    const k=joint.uuid+'|'+mat.uuid; if(!sets.has(k)) sets.set(k, { joint, mat, geos:[] }); sets.get(k).geos.push(geo.index?geo.toNonIndexed():geo); };
  const done=()=>{ for(const { joint, mat, geos } of sets.values()){ for(const g of geos){ for(const a of Object.keys(g.attributes)) if(a!=='position'&&a!=='normal'&&a!=='uv') g.deleteAttribute(a); }
      const m=new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow=true; m.receiveShadow=true; joint.add(m); geos.forEach(g=>g.dispose()); } };
  return { add, done }; }
const sph=(r,a,b,t0,t1)=>new THREE.SphereGeometry(r, a||16, b||12, 0, Math.PI*2, t0||0, t1||Math.PI), cyl=(a,b,h,n,open)=>new THREE.CylinderGeometry(a,b,h,n||14,1,!!open),
  cap=(r,h,n)=>new THREE.CapsuleGeometry(r, Math.max(0.01,h), 4, n||12), box=(w,h,d)=>new THREE.BoxGeometry(w,h,d), cone=(r,h,n)=>new THREE.ConeGeometry(r,h,n||8);

export function buildGeneral(){
  const g=makeSoldierMesh({ enemy:false }), u=g.userData, M=gmats(), P=plate();
  u.body.scale.set(0.9, 0.9, 0.9); g.scale.setScalar(HUMAN_SCALE); u.tint=new THREE.Color(0.32,0.3,0.27);   // a big man; the cloth under his plate is a dark arming doublet
  const [L0, L1]=u.legs;
  // ---- head: armet with a visor and eye slit, a gilt crown band, the crest of plumes, the gorget ----
  P.add(u.head, M.steel, sph(0.19, 18, 14), 0, 0.17, 0, 0, 0, 0, 0.95, 1.06, 1.06);
  P.add(u.head, M.steel, box(0.24, 0.13, 0.1), 0, 0.12, 0.155, -0.15);
  P.add(u.head, M.slit, box(0.2, 0.018, 0.02), 0, 0.17, 0.21);
  P.add(u.head, M.gold, new THREE.TorusGeometry(0.183, 0.012, 6, 28), 0, 0.1, 0, Math.PI/2, 0, 0, 1, 1.06, 1);
  P.add(u.head, M.gold, box(0.02, 0.06, 0.38), 0, 0.34, -0.01);
  for(let k=0;k<7;k++) P.add(u.head, M.plume, cone(0.035, 0.42-k*0.02, 6), 0, 0.42-k*0.01, 0.12-k*0.055, -1.15-k*0.12);
  P.add(u.head, M.steel, cyl(0.12, 0.15, 0.12, 16), 0, 0.0, 0);
  // ---- torso: ridged breastplate + backplate, faulds, tassets, pauldrons with lames ----
  P.add(u.up, M.steel, sph(0.27, 18, 14, 0, Math.PI*0.62), 0, 0.2, 0.0, 0, 0, 0, 1, 1.45, 0.78);
  P.add(u.up, M.gold, box(0.025, 0.36, 0.03), 0, 0.33, 0.2, -0.2);
  P.add(u.up, M.gold, new THREE.TorusGeometry(0.255, 0.012, 6, 30), 0, 0.54, 0.0, Math.PI/2, 0, 0, 1, 0.78, 1);
  for(let k=0;k<3;k++) P.add(u.up, M.steel, cyl(0.25+k*0.012, 0.26+k*0.014, 0.075, 18, true), 0, 0.06-k*0.07, 0.0, 0, 0, 0, 1, 1, 0.78);
  for(const sx of [-1,1]){ P.add(u.up, M.steel, box(0.17, 0.2, 0.025), sx*0.11, -0.16, 0.15, 0.2, 0, sx*-0.1);
    P.add(u.up, M.steel, sph(0.15, 14, 10, 0, Math.PI*0.55), sx*0.27, 0.53, 0.0, 0, 0, sx*-0.45, 1.15, 0.95, 1.15);
    for(let k=0;k<2;k++) P.add(u.up, M.steel, cyl(0.12-k*0.012, 0.13-k*0.012, 0.05, 14, true), sx*(0.3+k*0.012), 0.43-k*0.05, 0.0, 0, 0, sx*-0.4);
    P.add(u.up, M.gold, new THREE.TorusGeometry(0.15, 0.01, 6, 20, Math.PI), sx*0.27, 0.53, 0.0, 0, Math.PI/2, sx*-0.45+(sx<0?Math.PI:0)); }
  // ---- arms: rerebraces + couters on the upper arms, vambraces + gauntlets on the forearms ----
  for(const sx of [-1,1]) { P.add(u.arms, M.steel, cap(0.075, 0.24), sx*0.25, -0.05, 0.08, -0.9, 0, sx*0.25); P.add(u.arms, M.steel, sph(0.07, 10, 8), sx*0.21, -0.16, 0.2); }
  P.add(u.arms, M.steel, cap(0.065, 0.2), 0.15, -0.08, 0.26, -1.3, 0, -0.4); P.add(u.arms, M.dark, box(0.1, 0.08, 0.12), 0.1, -0.08, 0.14);
  P.add(u.lh, M.steel, cap(0.065, 0.2), 0.08, 0.03, 0.1, -1.45, 0, 0.6); P.add(u.lh, M.dark, box(0.1, 0.08, 0.12), 0.18, 0.07, 0.22);
  // ---- legs: cuisses + poleyns, greaves + sabatons ----
  for(const L of [L0, L1]){ P.add(L.hip, M.steel, cap(0.105, 0.26), 0, -0.19, 0.01); P.add(L.hip, M.steel, sph(0.08, 12, 10), 0, -0.38, 0.06, 0, 0, 0, 1, 1, 0.8);
    P.add(L.knee, M.steel, cap(0.09, 0.22), 0, -0.17, 0.0); P.add(L.knee, M.steel, box(0.15, 0.08, 0.3), 0, -0.36, 0.06); P.add(L.knee, M.gold, box(0.16, 0.012, 0.3), 0, -0.32, 0.06); }
  P.done();
  // ---- cloak: hangs from the shoulders, streams back with speed ----
  const cl=new THREE.Group(); cl.position.set(0, 0.56, -0.17); u.up.add(cl);
  { const geo=new THREE.PlaneGeometry(0.6, 1.05, 1, 6); geo.translate(0, -0.525, 0); const m=new THREE.Mesh(geo, M.cloak); m.castShadow=true; cl.add(m);
    const tr=new THREE.PlaneGeometry(0.6, 0.06); tr.translate(0, -1.03, 0.002); cl.add(new THREE.Mesh(tr, M.trim)); }
  u.cloak=cl; u.isGeneral=true;
  battleRifle(g);
  return g; }
// Z245 THE GENERAL'S RIFLE — a 7.62 mm battle rifle: flat-dark-earth receiver with a full-length rail, M-LOK handguard, 20-round box magazine,
//   free-floated barrel with a three-port muzzle brake, a 3–18× scope on rings with turrets, folding bipod, adjustable stock with cheek riser, sling
function battleRifle(g){ const u=g.userData; u.parts=u.parts.filter(pt=>pt.kind!=='gun');   // the batched infantry carbine is no longer drawn for him
  const R=gunMats(), P=plate(), G=u.gun;
  P.add(G, R.fde, box(0.068, 0.1, 0.46), 0, 0.0, 0.1);                                   // receiver
  for(let k=0;k<14;k++) P.add(G, R.blk, box(0.05, 0.012, 0.016), 0, 0.058, -0.08+k*0.05); // picatinny rail teeth
  P.add(G, R.fde, box(0.072, 0.082, 0.34), 0, -0.004, 0.48);                              // handguard
  for(let k=0;k<4;k++) for(const sx of [-1,1]) P.add(G, R.blk, box(0.004, 0.022, 0.05), sx*0.037, -0.01, 0.38+k*0.07);   // M-LOK slots
  P.add(G, R.blk, cyl(0.015, 0.017, 0.32, 10), 0, 0.005, 0.8, Math.PI/2);                 // barrel
  P.add(G, R.blk, cyl(0.026, 0.026, 0.085, 12), 0, 0.005, 0.99, Math.PI/2);               // muzzle brake
  for(let k=0;k<3;k++) for(const sx of [-1,1]) P.add(G, R.slot, box(0.004, 0.012, 0.012), sx*0.027, 0.005, 0.965+k*0.022);
  P.add(G, R.blk, box(0.052, 0.21, 0.085), 0, -0.15, 0.13, 0.16);                         // 20-round magazine
  P.add(G, R.blk, box(0.04, 0.11, 0.055), 0, -0.1, -0.06, -0.38);                          // pistol grip
  P.add(G, R.blk, box(0.012, 0.05, 0.085), 0, -0.065, 0.02);                               // trigger guard
  P.add(G, R.fde, box(0.06, 0.1, 0.26), 0, -0.02, -0.3); P.add(G, R.fde, box(0.05, 0.045, 0.16), 0, 0.045, -0.28); P.add(G, R.blk, box(0.064, 0.115, 0.03), 0, -0.025, -0.44);   // stock · cheek riser · butt pad
  P.add(G, R.blk, cyl(0.023, 0.023, 0.3, 14), 0, 0.105, 0.08, Math.PI/2);                  // scope tube
  P.add(G, R.blk, cyl(0.034, 0.024, 0.07, 14), 0, 0.105, 0.26, Math.PI/2); P.add(G, R.blk, cyl(0.03, 0.023, 0.06, 14), 0, 0.105, -0.09, Math.PI/2);   // objective + ocular bells
  P.add(G, R.lens, cyl(0.03, 0.03, 0.004, 14), 0, 0.105, 0.296, Math.PI/2);
  P.add(G, R.blk, cyl(0.012, 0.012, 0.03, 8), 0, 0.135, 0.08); P.add(G, R.blk, cyl(0.012, 0.012, 0.03, 8), 0.03, 0.105, 0.08, 0, 0, Math.PI/2);   // turrets
  for(const z of [0.0, 0.16]) P.add(G, R.blk, box(0.04, 0.05, 0.022), 0, 0.075, z);        // rings
  for(const sx of [-1,1]) P.add(G, R.blk, cyl(0.007, 0.007, 0.24, 6), sx*0.022, -0.06, 0.56, Math.PI/2);   // folded bipod legs
  P.add(G, R.blk, box(0.028, 0.07, 0.03), 0, -0.08, 0.44, 0.35);                          // angled fore-grip
  P.add(G, R.sling, box(0.01, 0.012, 0.66), -0.04, -0.03, 0.12);                           // sling
  P.done(); u.muzzle.position.set(0, 0.005, 1.04); }
let _RM=null;
function gunMats(){ if(_RM) return _RM; const S=(c,r,m,o)=>new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:r, metalness:m }, o||{}));
  _RM={ fde:S(0x8a7a58,0.62,0.25), blk:S(0x1c1d1f,0.42,0.6), slot:S(0x050505,0.8,0.2), sling:S(0x3c3a2c,0.9,0.0), lens:S(0x0a1a2a,0.05,0.4, { emissive:0x0a2a4a, emissiveIntensity:0.25 }) }; return _RM; }
// ---- riding: thighs round the barrel, heels down in the stirrups; rising out of the saddle at the trot (posting) and the gallop (two-point),
//   leaning into the stride; the torso twists toward the aim (the horse goes one way, the rifle another) ----
export function poseRider(g, H, dt, twist, firing){ const u=g.userData; if(!u.legs) return; const P=u.pose||(u.pose={ rx:0, y:0, z:0, up:0, arm:0, kw:0, pw:0 }); P.kw=P.pw=0; P.lw=0; u.stance='ride';
  const gal=H.gait==='gallop'?1:0, can=H.gait==='canter'?1:0, tro=H.gait==='trot'?1:0, ph=H.phase;
  const lift = gal*(0.09+H.B.position.y*0)+tro*Math.max(0, Math.sin(ph*4*Math.PI))*0.07+can*0.03;
  u.rideLift=(u.rideLift||0)+(lift-(u.rideLift||0))*Math.min(1, dt*10);
  g.position.y = HORSE.saddleY+0.06-0.74*u.body.scale.y*g.scale.y + u.rideLift - (H.B.position.y-HORSE.bodyY)*gal*0.6;   // two-point: the legs soak the horse's bob, the head stays level
  for(const L of u.legs){ L.hip.rotation.x=-1.32-gal*0.25; L.hip.rotation.z=L.sx*0.3; L.knee.rotation.x=1.5+gal*0.35; }
  u.body.rotation.set(0, 0, 0); u.body.position.set(0, 0, 0);
  const lean = gal*0.42 + can*0.16 + tro*0.06 + Math.sin(ph*2*Math.PI)*can*0.05;
  u.up.rotation.x = lean*(firing?0.45:1); u.up.rotation.y += (Math.max(-2.0, Math.min(2.0, twist)) - u.up.rotation.y)*Math.min(1, dt*10);
  if(u.arms){ u.arms.rotation.x = -lean*(firing?0.45:0.7) - (firing?0.02:0) + (u.kick||0)*-0.05; u.arms.rotation.y = Math.max(-0.5, Math.min(0.5, twist - u.up.rotation.y)); u.arms.rotation.z = 0; }
  u.kick=Math.max(0, (u.kick||0)-dt*9); if(firing) u.kick=1; u.gun.position.z=0.16-u.kick*0.06; u.gun.rotation.x=-u.kick*0.12;
  if(u.head){ u.head.rotation.y = 0; u.head.rotation.x = -lean*0.6; }
  if(u.cloak) u.cloak.rotation.x = Math.min(1.25, 0.12 + Math.abs(H.v)*0.075) + Math.sin(performance.now()/1000*7)*0.04*Math.min(1, Math.abs(H.v)/6); }
export function cloakFoot(g, spd, prone){ const u=g.userData; if(u.cloak) u.cloak.rotation.x = prone ? 0.04 : Math.min(0.9, 0.06 + spd*0.11) + Math.sin(performance.now()/1000*5)*0.03*Math.min(1, spd/3); }
