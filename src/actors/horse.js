// actors/horse.js — Z245 THE WAR HORSE: an armoured charger (chanfron, crinet, peytral, flanchards, crupper, caparison, saddle) on a real gait engine — walk · trot · canter · gallop with the true footfall order and timing of each, two-bone IK legs that plant on the ground, body bob / pitch / bank, a nodding neck, mane and tail with lag
import * as THREE from 'three';
import { HORSE } from '../../config.js';
import { heightAt } from '../hub.js';

// ---- materials (shared) ----
let _M=null;
function mats(){ if(_M) return _M; const S=(c,r,m,o)=>new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:r, metalness:m }, o||{}));
  _M={ coat:S(HORSE.coat,0.62,0.02), coatDk:S(0x1e130b,0.7,0.02), hair:S(0x0c0a08,0.85,0.0), hoof:S(0x1a1612,0.55,0.05), eye:S(0x050404,0.15,0.2),
    steel:S(0xaeb3b8,0.3,0.92), steelDk:S(0x5a5e62,0.38,0.9), gold:S(0xd2a33c,0.3,0.95), leather:S(0x4a2c18,0.7,0.05), cloth:S(0x1e4a26,0.85,0.0, { side:THREE.DoubleSide }),
    clothTrim:S(0xc8962e,0.5,0.6, { side:THREE.DoubleSide }), plume:S(0xb4201a,0.8,0.0) };
  return _M; }
const mesh=(geo, m, x, y, z, rx, ry, rz, par)=>{ const o=new THREE.Mesh(geo, m); o.position.set(x||0, y||0, z||0); o.rotation.set(rx||0, ry||0, rz||0); o.castShadow=true; o.receiveShadow=true; if(par) par.add(o); return o; };
const cap=(r, len, seg)=>new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, seg||12);
const cyl=(r0, r1, h, seg, open)=>new THREE.CylinderGeometry(r0, r1, h, seg||12, 1, !!open);

// ---- a leg: pivot → upper (forearm / gaskin) → joint (knee / hock) → cannon → fetlock → pastern + hoof ----
function buildLeg(par, x, y, z, front, M, armour){ const L=front ? HORSE.front : HORSE.hind;
  const piv=new THREE.Group(); piv.position.set(x, y, z); par.add(piv);
  const up=new THREE.Group(); piv.add(up);
  { const g=cyl(front?0.06:0.07, front?0.12:0.15, L[0], 12); mesh(g, M.coat, 0, -L[0]/2, front?0.0:-0.02, 0, 0, 0, up).scale.set(0.85, 1, front?1.2:1.45); }   // forearm / gaskin: thick muscle at the top, tapering to the joint
  mesh(new THREE.SphereGeometry(front?0.1:0.12, 10, 8), M.coat, 0, 0.02, front?0.02:-0.03, 0, 0, 0, up).scale.set(0.9, 1.1, 1.2);   // elbow / stifle mass
  const mid=new THREE.Group(); mid.position.y=-L[0]; up.add(mid);
  mesh(new THREE.SphereGeometry(0.065, 10, 8), M.coat, 0, 0, front?0.015:-0.03, 0, 0, 0, mid).scale.set(0.95, 1.1, front?1.2:1.6);   // knee / hock (the point of the hock sticks out behind)
  mesh(cyl(0.05, 0.058, L[1], 10), M.coat, 0, -L[1]/2, 0, 0, 0, 0, mid).scale.set(1, 1, 1.25);                                                          // cannon bone: slim, flat
  const fet=new THREE.Group(); fet.position.y=-L[1]; mid.add(fet);
  mesh(new THREE.SphereGeometry(0.05, 10, 8), M.coatDk, 0, 0, -0.01, 0, 0, 0, fet).scale.set(1, 1, 1.25);                         // fetlock
  mesh(cyl(0.048, 0.056, L[2]*0.6, 10), M.coatDk, 0, -L[2]*0.3, 0.01, 0, 0, 0, fet);                                              // pastern
  mesh(cyl(0.065, 0.08, L[2]*0.42, 12), M.hoof, 0, -L[2]*0.79, 0.02, 0, 0, 0, fet).scale.set(1, 1, 1.12);                                             // hoof
  if(armour && front) mesh(cyl(0.075, 0.07, 0.2, 10, true), M.steelDk, 0, -0.26, 0.005, 0, 0, 0, up);                           // a steel cuff over the forearm
  return { piv, up, mid, fet, front, L, a:L[0], b:L[1]+L[2], z0:z, x0:x, y0:y, st:false, curl:0 }; }

export function buildHorse(opts){ const M=mats(), armour=!(opts&&opts.bare), root=new THREE.Group(), B=new THREE.Group(); B.position.y=HORSE.bodyY; root.add(B);
  // ---- body: barrel, deep chest, rounded hindquarters, withers ----
  mesh(cap(0.35, 0.82, 16), M.coat, 0, 0, -0.02, Math.PI/2, 0, 0, B).scale.set(0.84, 1, 1);
  mesh(new THREE.SphereGeometry(0.38, 16, 12), M.coat, 0, 0.0, 0.52, 0, 0, 0, B).scale.set(0.86, 1.02, 0.92);
  mesh(new THREE.SphereGeometry(0.4, 16, 12), M.coat, 0, 0.04, -0.56, 0, 0, 0, B).scale.set(0.92, 1, 1.05);
  mesh(new THREE.SphereGeometry(0.2, 12, 8), M.coat, 0, 0.29, 0.42, 0, 0, 0, B).scale.set(0.9, 0.7, 1.4);                        // withers
  for(const sx of [-1,1]) mesh(new THREE.SphereGeometry(0.2, 10, 8), M.coat, sx*0.2, -0.05, 0.58, 0, 0, 0, B).scale.set(0.8, 1.2, 0.9);   // shoulders
  // ---- neck → head (each its own joint) ----
  const N=new THREE.Group(); N.position.set(0, 0.24, 0.66); N.rotation.x=HORSE.neckX; B.add(N);
  mesh(cyl(0.13, 0.23, 0.86, 14), M.coat, 0, 0.4, 0, 0, 0, 0, N).scale.set(0.75, 1, 1.1);
  const H=new THREE.Group(); H.position.set(0, 0.84, 0.02); H.rotation.x=HORSE.headX; N.add(H);
  { const g=cyl(0.075, 0.135, 0.56, 14); g.rotateX(Math.PI/2); g.translate(0, 0, 0.26); mesh(g, M.coat, 0, 0, 0, 0, 0, 0, H).scale.set(0.72, 1, 1); }   // head: broad jaw tapering to the muzzle
  mesh(new THREE.SphereGeometry(0.14, 12, 10), M.coat, 0, -0.02, 0.04, 0, 0, 0, H).scale.set(0.72, 1, 1.05);                        // jowl
  mesh(new THREE.SphereGeometry(0.085, 10, 8), M.coatDk, 0, -0.02, 0.53, 0, 0, 0, H).scale.set(0.9, 0.8, 0.85);                     // muzzle
  for(const sx of [-1,1]){ mesh(new THREE.SphereGeometry(0.024, 8, 6), M.eye, sx*0.095, 0.05, 0.12, 0, 0, 0, H);                     // eyes
    mesh(new THREE.ConeGeometry(0.04, 0.15, 8), M.coat, sx*0.055, 0.14, -0.02, -0.25, 0, sx*-0.2, H);                                   // ears
    mesh(new THREE.SphereGeometry(0.016, 6, 5), M.eye, sx*0.035, -0.0, 0.6, 0, 0, 0, H); }                                              // nostrils
  const ears=H.children.filter(o=>o.geometry && o.geometry.type==='ConeGeometry');
  // mane: cards along the crest of the neck, each sways on its own
  const mane=[]; for(let i=0;i<11;i++){ const t=i/10, g=new THREE.Group(); g.position.set(0, 0.06+t*0.8, -0.14+t*0.02); N.add(g);
    mesh(new THREE.PlaneGeometry(0.06, 0.26-t*0.06), M.hair, 0.02, -0.08, -0.02, 0, 0.12, 0.35, g).material.side=THREE.DoubleSide; mane.push(g); }
  { const fl=mesh(new THREE.PlaneGeometry(0.09, 0.16), M.hair, 0, 0.1, 0.06, -0.6, 0, 0, H); fl.material.side=THREE.DoubleSide; }       // forelock
  // tail: a chain of segments that trails the motion
  const tail=[]; { let par=B; const T0=new THREE.Group(); T0.position.set(0, 0.22, -0.93); T0.rotation.x=0.55; B.add(T0); par=T0;
    for(let i=0;i<5;i++){ const s=new THREE.Group(); s.position.y = i ? -0.17 : 0; par.add(s); mesh(cyl(0.05-i*0.006, 0.06-i*0.006, 0.19, 8), M.hair, 0, -0.085, 0, 0, 0, 0, s); tail.push(s); par=s; }
    mesh(new THREE.ConeGeometry(0.13, 0.55, 10), M.hair, 0, -0.36, 0, Math.PI, 0, 0, par).scale.set(0.75, 1, 1.15); mesh(new THREE.SphereGeometry(0.1, 10, 8), M.hair, 0, -0.1, 0, 0, 0, 0, par).scale.set(0.8, 1.6, 1); }   // a full, long tail
  // legs: [LH, LF, RH, RF]  (x: −left / +right in horse space = −x left)
  const F=HORSE.legs, legs=[ buildLeg(B, -F.hx, F.hy, F.hz, false, M, armour), buildLeg(B, -F.fx, F.fy, F.fz, true, M, armour), buildLeg(B, F.hx, F.hy, F.hz, false, M, armour), buildLeg(B, F.fx, F.fy, F.fz, true, M, armour) ];
  // ---- tack: saddle, girth, stirrups, bridle ----
  const saddle=new THREE.Group(); saddle.position.set(0, HORSE.saddleY, 0.05); B.add(saddle);
  mesh(new THREE.BoxGeometry(0.5, 0.08, 0.62), M.cloth, 0, -0.03, 0, 0, 0, 0, saddle);                                              // saddle cloth
  mesh(new THREE.BoxGeometry(0.4, 0.09, 0.5), M.leather, 0, 0.03, 0, 0, 0, 0, saddle);                                              // seat
  mesh(new THREE.BoxGeometry(0.3, 0.11, 0.08), M.leather, 0, 0.08, 0.25, -0.25, 0, 0, saddle);                                     // pommel
  mesh(new THREE.BoxGeometry(0.36, 0.13, 0.08), M.leather, 0, 0.09, -0.25, 0.35, 0, 0, saddle);                                     // cantle
  mesh(new THREE.TorusGeometry(0.37, 0.025, 6, 24, Math.PI), M.leather, 0, -0.06, 0.08, 0, Math.PI/2, Math.PI, saddle).scale.set(1, 1.05, 1);   // girth
  const stirrups=[]; for(const sx of [-1,1]){ const s=new THREE.Group(); s.position.set(sx*0.25, 0.0, 0.05); saddle.add(s);
    mesh(new THREE.BoxGeometry(0.02, 0.48, 0.04), M.leather, 0, -0.24, 0, 0, 0, 0, s); mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), M.steel, 0, -0.5, 0, 0, Math.PI/2, 0, s); stirrups.push(s); }
  mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 18), M.leather, 0, -0.02, 0.32, Math.PI/2, 0, 0, H).scale.set(0.75, 1, 1);           // noseband
  mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 18), M.leather, 0, 0.03, 0.04, 0, Math.PI/2, 0, H).scale.set(1, 1.2, 0.8);           // headstall
  // ---- barding (war armour) ----
  if(armour){
    { const g=new THREE.BoxGeometry(0.2, 0.06, 0.5); g.translate(0, 0, 0.25); mesh(g, M.steel, 0, 0.1, 0.02, 0.06, 0, 0, H).scale.set(1, 1, 1);   // chanfron: the face plate
      mesh(new THREE.ConeGeometry(0.03, 0.18, 8), M.gold, 0, 0.17, 0.12, -0.5, 0, 0, H);                                                // its spike
      for(const sx of [-1,1]) mesh(new THREE.SphereGeometry(0.045, 10, 8, 0, Math.PI*2, 0, Math.PI/2), M.steelDk, sx*0.09, 0.05, 0.12, 0, 0, sx*1.57, H);   // eye guards
      mesh(new THREE.BoxGeometry(0.22, 0.012, 0.52), M.gold, 0, 0.13, 0.27, 0.06, 0, 0, H); }                                              // gilt edge
    for(let i=0;i<7;i++){ const t=i/6, g=new THREE.CylinderGeometry(0.125+0.045*(1-t), 0.14+0.045*(1-t), 0.12, 14, 1, true, Math.PI*0.62, Math.PI*0.76); mesh(g, M.steel, 0, 0.1+t*0.68, -0.015, 0, 0, 0, N).scale.set(0.8, 1, 1.05); }   // crinet: lames over the crest only, the throat stays free
    { const g=new THREE.CylinderGeometry(0.44, 0.47, 0.5, 20, 1, true, -Math.PI*0.62, Math.PI*1.24); mesh(g, M.steel, 0, -0.02, 0.5, 0, 0, 0, B).scale.set(0.95, 1, 1.0);   // peytral: the chest plate
      mesh(new THREE.TorusGeometry(0.46, 0.018, 6, 24, Math.PI*1.24), M.gold, 0, 0.23, 0.5, Math.PI/2, 0, Math.PI*0.88, B).scale.set(0.95, 1, 1);   // gilt rim
      mesh(new THREE.SphereGeometry(0.07, 10, 8), M.gold, 0, 0.0, 0.96, 0, 0, 0, B); }                                                    // boss on the breast
    for(const sx of [-1,1]){ const g=new THREE.CylinderGeometry(0.37, 0.37, 0.5, 16, 1, true, sx>0?Math.PI*0.32:Math.PI*1.32, Math.PI*0.36); mesh(g, M.steel, 0, -0.04, 0.02, Math.PI/2, 0, 0, B).scale.set(0.9, 1, 1.02);   // flanchards: curved side plates under the saddle
      mesh(new THREE.BoxGeometry(0.02, 0.025, 0.56), M.gold, sx*0.335, 0.12, 0.02, 0, 0, sx*0.5, B); }
    { const g=new THREE.SphereGeometry(0.46, 18, 10, 0, Math.PI*2, 0, Math.PI*0.42); mesh(g, M.steel, 0, -0.04, -0.6, 0, 0, 0, B).scale.set(0.95, 0.9, 1.05);   // crupper over the hindquarters
      mesh(new THREE.TorusGeometry(0.44*0.95, 0.016, 6, 28), M.gold, 0, 0.11, -0.6, Math.PI/2, 0, 0, B).scale.set(1, 1.1, 1); }
    // caparison: a green cloth skirt with a gold hem hanging under the plates, front and back
    { const c=mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.2, 18, 1, true, Math.PI*0.45, Math.PI*1.1), M.cloth, 0, -0.26, -0.6, 0, 0, 0, B); c.scale.set(0.95, 1, 0.9);   // caparison: a short cloth skirt round the hindquarters, gold hem (the legs stay in view)
      mesh(new THREE.CylinderGeometry(0.505, 0.505, 0.04, 18, 1, true, Math.PI*0.45, Math.PI*1.1), M.clothTrim, 0, -0.37, -0.6, 0, 0, 0, B).scale.set(0.95, 1, 0.9); }
    { const pl=new THREE.Group(); pl.position.set(0, 0.2, 0.0); H.add(pl); for(let k=0;k<5;k++) mesh(new THREE.ConeGeometry(0.03, 0.34, 6), M.plume, (k-2)*0.02, 0.17, -0.04*k, -0.3-k*0.12, 0, (k-2)*0.12, pl); }   // a plume on the chanfron
  }
  root.traverse(o=>{ if(o.isMesh && o.geometry.type!=='PlaneGeometry') o.castShadow=true; }); root.scale.setScalar(HORSE.size);   // Z245 a big destrier
  const S={ root, B, N, H, legs, mane, tail, ears, saddle, stirrups, phase:0, gait:'idle', prevGait:null, blend:1, prevPhase:0, bob:0, pitch:0, bank:0, nod:0, t:Math.random()*10, tailV:0, tailA:0, graze:0, onStep:null, v:0 };
  return S; }

// ---- GAIT TABLE: footfall order (phase offsets for LH, LF, RH, RF), duty factor (share of the stride a hoof is on the ground), stride rate,
//   swing lift, and the body's own motion — from the classic analysis of horse locomotion (walk = 4-beat lateral sequence, trot = 2-beat diagonal
//   pairs, canter = 3-beat with the inside diagonal landing together, gallop = 4-beat transverse with a moment of suspension)
const GAITS={
  walk:  { off:[0, 0.25, 0.5, 0.75],   duty:0.64, f:(v)=>0.82+v*0.12, lift:[0.1,0.14],  bob:(p)=>-0.022*Math.cos(p*4*Math.PI), pitch:(p)=>0.012*Math.sin(p*2*Math.PI), nod:(p)=>0.09*Math.sin(p*4*Math.PI+0.6),  roll:(p)=>0.02*Math.sin(p*2*Math.PI) },
  trot:  { off:[0, 0.5, 0.5, 0],       duty:0.44, f:(v)=>1.28+v*0.05, lift:[0.17,0.24], bob:(p)=>-0.05*Math.cos(p*4*Math.PI),  pitch:(p)=>0.008*Math.sin(p*4*Math.PI), nod:(p)=>0.025*Math.sin(p*4*Math.PI),     roll:(p)=>0.012*Math.sin(p*2*Math.PI) },
  canter:{ off:[0.32, 0.6, 0, 0.3],    duty:0.42, f:(v)=>1.62+v*0.03, lift:[0.2,0.27],  bob:(p)=>0.065*Math.sin(p*2*Math.PI-0.4), pitch:(p)=>0.075*Math.sin(p*2*Math.PI+1.1), nod:(p)=>0.13*Math.sin(p*2*Math.PI+2.2), roll:(p)=>0.01 },
  gallop:{ off:[0.1, 0.55, 0, 0.45],   duty:0.3,  f:(v)=>1.95+v*0.025, lift:[0.25,0.33], bob:(p)=>0.085*Math.sin(p*2*Math.PI+0.5), pitch:(p)=>0.065*Math.sin(p*2*Math.PI+1.7), nod:(p)=>0.16*Math.sin(p*2*Math.PI+2.6), roll:(p)=>0.0 } };
const ORDER=['idle','walk','trot','canter','gallop'];
export function gaitFor(v, cur){ const T=[0.15, ...HORSE.gaitV], h=HORSE.gaitHys; let i=Math.max(0, ORDER.indexOf(cur));   // T[i]: the speed where ORDER[i] gives way to ORDER[i+1]
  while(i<4 && v > T[i]+(i?h:0)) i++; while(i>0 && v < T[i-1]-(i>1?h:0)) i--; return ORDER[i]; }
const _w=new THREE.Vector3(), _q=new THREE.Quaternion(), _e=new THREE.Euler();
// foot target for one leg (horse-body space, relative to its pivot): the hoof sweeps back along the ground in stance, swings forward in an arc
function footTarget(G, leg, ph, s, lift){ const u=((ph-G.off[leg.i])%1+1)%1,   // a hoof lands when the stride phase reaches its offset
    d=G.duty; let z, y, st;
  if(u<d){ const t=u/d; z=s-2*s*t; y=0; st=true; }
  else { const t=(u-d)/(1-d), e=t*t*(3-2*t); z=-s+2*s*e; y=lift*Math.sin(Math.PI*t)*(leg.front?1.15:0.9); st=false; }
  return { z, y, st, sw:st?0:Math.sin(Math.PI*((u-d)/(1-d))) }; }
// 2-bone IK in the leg's plane; front knee bends forward-out (the cannon folds back), the hind hock points back
function solveLeg(leg, tz, ty){ const a=leg.a, b=leg.b; let d=Math.hypot(tz, ty); d=Math.min(a+b-0.004, Math.max(Math.abs(a-b)+0.02, d));
  const th=Math.atan2(tz, -ty), al=Math.acos(Math.min(1, Math.max(-1, (a*a+d*d-b*b)/(2*a*d)))), be=Math.acos(Math.min(1, Math.max(-1, (a*a+b*b-d*d)/(2*a*b))));
  if(leg.front){ leg.up.rotation.x=-(th+al); leg.mid.rotation.x=(Math.PI-be); } else { leg.up.rotation.x=-(th-al); leg.mid.rotation.x=-(Math.PI-be); } }
// ---- drive the whole animal: speed v (m/s along its facing), yaw rate (rad/s), dt; the horse root must already be placed in the world ----
export function animateHorse(S, dt, v, yawRate){ dt=Math.min(dt, 0.05); S.t+=dt; S.v=v; const K=S.root.scale.x||1;   // world metres ↔ horse units
  const g0=S.gait, g1=gaitFor(Math.abs(v), g0); if(g1!==g0){ S.prevGait=g0; S.prevPhase=S.phase; S.blend=0; S.gait=g1; }
  S.blend=Math.min(1, S.blend+dt/HORSE.blendT);
  const G=GAITS[S.gait==='idle'?'walk':S.gait], f=G.f(Math.abs(v)), sgn=v<0?-1:1;
  S.phase=(S.phase+f*dt*(S.gait==='idle'?0:1))%1;
  const Gp=S.prevGait && S.prevGait!=='idle' ? GAITS[S.prevGait] : null; if(Gp) S.prevPhase=(S.prevPhase+Gp.f(Math.abs(v))*dt)%1;
  const idle=S.gait==='idle', bw=S.blend, s=(idle?0:Math.abs(v)*G.duty/(2*f))*sgn/K;
  // body motion (blended with the previous gait while changing)
  const mix=(fn)=>{ const a=idle?0:fn(G, S.phase); const b=(Gp && bw<1)?fn(Gp, S.prevPhase):(S.prevGait==='idle'?0:a); return a*bw+b*(1-bw); };
  const bob=mix((g,p)=>g.bob(p)), pitch=mix((g,p)=>g.pitch(p)), nod=mix((g,p)=>g.nod(p)), roll=mix((g,p)=>g.roll(p));
  const bank=Math.max(-0.22, Math.min(0.22, -yawRate*Math.abs(v)*0.035)); S.bank+=(bank-S.bank)*Math.min(1, dt*5);
  const breathe=Math.sin(S.t*1.6)*0.006, gal=(S.gait==='gallop'?1:0)*bw;
  S.B.position.y=HORSE.bodyY+bob+breathe-gal*0.06; S.B.rotation.x=pitch; S.B.rotation.z=S.bank+roll;
  // neck & head: nod with the gait, stretch forward at the gallop, lower to graze when idle and left alone
  S.graze+=((idle && S.wantGraze ? 1 : 0)-S.graze)*Math.min(1, dt*0.8);
  S.N.rotation.x = HORSE.neckX + nod + gal*0.32 + S.graze*0.95 + Math.sin(S.t*0.7)*0.02*(idle?1:0);
  S.H.rotation.x = HORSE.headX - nod*0.6 + gal*0.12 + S.graze*0.3;
  for(let i=0;i<S.ears.length;i++) S.ears[i].rotation.x=-0.25+Math.sin(S.t*(1.3+i*0.4)+i)*0.08 - gal*0.4;   // ears flick; pinned back at the gallop
  // legs: blend foot targets between the old and new gait, then IK; pastern curls in the swing
  const gyRoot=S.root.position.y, cosY=Math.cos(S.root.rotation.y), sinY=Math.sin(S.root.rotation.y);
  for(let i=0;i<4;i++){ const leg=S.legs[i]; leg.i=i;
    let tz, ty, st, sw; const L=G.lift[leg.front?1:0]*Math.min(1, Math.abs(v)/3+0.35);
    const A=idle ? { z:0, y:0, st:true, sw:0 } : footTarget(G, leg, S.phase, s, L);
    if(Gp && bw<1){ const sp=Math.abs(v)*Gp.duty/(2*Gp.f(Math.abs(v)))*sgn/K, Bt=footTarget(Gp, leg, S.prevPhase, sp, Gp.lift[leg.front?1:0]); tz=A.z*bw+Bt.z*(1-bw); ty=A.y*bw+Bt.y*(1-bw); st=bw>0.5?A.st:Bt.st; sw=A.sw*bw+Bt.sw*(1-bw); }
    else { tz=A.z; ty=A.y; st=A.st; sw=A.sw; }
    // ground under this hoof (world), back into the leg pivot's frame (the body is bobbing and pitching)
    const lx=leg.x0, lz=leg.z0+tz, wx=S.root.position.x+(lx*cosY+lz*sinY)*K, wz=S.root.position.z+(-lx*sinY+lz*cosY)*K, gy=(heightAt(wx, wz)-gyRoot)/K;
    const pz=leg.z0, py=S.B.position.y+leg.y0, cp=Math.cos(pitch), sp2=Math.sin(pitch);
    let dz=lz-pz, dy=(gy+0.01+ty)-py; const rz=dz*cp-dy*sp2, ry=dy*cp+dz*sp2;   // into the pitched body frame
    solveLeg(leg, rz, ry);
    leg.curl += ((sw*(leg.front?1.5:1.1)) - leg.curl)*Math.min(1, dt*14); leg.fet.rotation.x = leg.curl - (leg.up.rotation.x+leg.mid.rotation.x+pitch);   // hoof stays near level, curls up in the swing
    if(st && !leg.st && !idle && S.onStep) S.onStep(i, wx, wz, Math.abs(v)); leg.st=st; }
  // tail trails the motion (lags the pitch, lifts at speed); mane streams
  S.tailA += ((Math.abs(v)*0.045 + pitch*1.5) - S.tailA)*Math.min(1, dt*3);
  for(let i=0;i<S.tail.length;i++){ const tseg=S.tail[i]; tseg.rotation.x = (i?0.04:0) - S.tailA*(i?0.18:0.5) + Math.sin(S.t*3-i*0.7)*0.03; tseg.rotation.z = Math.sin(S.t*(idle?1.4:4)-i*0.6)*(idle?0.12:0.05) + S.bank*0.4; }
  for(let i=0;i<S.mane.length;i++){ const m=S.mane[i]; m.rotation.x = -Math.abs(v)*0.03 + Math.sin(S.t*6+i*0.5)*0.05*Math.min(1, Math.abs(v)/6+0.2); m.rotation.z = Math.sin(S.t*2+i)*0.04; }
  return S; }
