// actors/horse.js — Z245/Z246 THE WAR HORSE: one sculpted, skinned body (barrel, neck, head, four legs and tail lofted through real cross-sections and bent by a skeleton — no seams, no stuck-on blocks; a bay coat with black points, a sheen on it) in modern military tack that follows its shape (soft ballistic breast panel, clear face shield, leg boots, saddle, saddlebags, bedroll, reins); mane, forelock, a white star and sock, muscle under the skin, on a real gait engine — walk · trot · canter · gallop with the true footfall order and timing of each, two-bone IK legs that plant on the ground, body bob / pitch / bank, a nodding neck, a tail with lag
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HORSE } from '../../config.js';
import { blot, heightAt, keySec, lineAlong, lineAround, loftGeo, pathKeys, ringAt, secAt, skinMesh, toLocal, trimGeo, animateBike } from '../hub.js';

// ---- materials (shared) ----
let _M=null;
function mats(){ if(_M) return _M; const S=(c,r,m,o)=>new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:r, metalness:m }, o||{}));
  _M={ coat:new THREE.MeshPhysicalMaterial({ vertexColors:true, roughness:0.46, metalness:0, sheen:0.35, sheenRoughness:0.45, sheenColor:new THREE.Color(0x76665a) }),
    eye:S(0x050404,0.08,0.3), leather:S(0x1e1612,0.55,0.05, { side:THREE.DoubleSide }), strap:S(0x2a2a26,0.7,0.02, { side:THREE.DoubleSide }), iron:S(0x8a8e92,0.35,0.9),
    cloth:new THREE.MeshPhysicalMaterial({ color:0x4a4a34, roughness:0.9, sheen:0.5, sheenRoughness:0.6, sheenColor:new THREE.Color(0x77775a), side:THREE.DoubleSide }),
    gear:S(0x6c5e45,0.88,0, { side:THREE.DoubleSide }), gearDk:S(0x54493a,0.9,0, { side:THREE.DoubleSide }), boot:S(0x202226,0.65,0.05),
    visor:new THREE.MeshPhysicalMaterial({ color:0x2a3a44, roughness:0.04, metalness:0.15, transparent:true, opacity:0.42, clearcoat:1, clearcoatRoughness:0.03, side:THREE.DoubleSide, depthWrite:false }) };
  return _M; }
const COAT=()=>new THREE.Color(HORSE.coat), POINT=new THREE.Color(0x100c09), HOOF=new THREE.Color(0x2a2522), MUZ=new THREE.Color(0x1c140f), WHITE=new THREE.Color(0xd8d0c4);
const gs=(x, m, w)=>Math.exp(-((x-m)/w)*((x-m)/w));
const bone=(par, x, y, z)=>{ const b=new THREE.Bone(); b.position.set(x, y, z); par.add(b); return b; };
const put=(geo, mat, par)=>{ const m=new THREE.Mesh(geo, mat); m.castShadow=true; m.receiveShadow=true; par.add(m); return m; };

export function buildHorse(opts){ const M=mats(), armour=!(opts&&opts.bare), root=new THREE.Group(), CT=COAT();
  // ---- skeleton: body → neck → head; a tail chain; each leg pivot → upper (forearm / gaskin) → cannon → pastern ----
  const B=bone(root, 0, HORSE.bodyY, 0), N=bone(B, 0, 0.24, 0.66), H=bone(N, 0, 0.84, 0.02); N.rotation.x=HORSE.neckX; H.rotation.x=HORSE.headX;
  const T0=new THREE.Group(); T0.position.set(0, 0.24, -0.95); T0.rotation.x=0.3; B.add(T0);
  const tail=[]; { let par=T0; for(let i=0;i<5;i++){ const s=bone(par, 0, i?-0.17:0, 0); tail.push(s); par=s; } }
  const F=HORSE.legs, legDef=[[-F.hx, F.hy, F.hz, false], [-F.fx, F.fy, F.fz, true], [F.hx, F.hy, F.hz, false], [F.fx, F.fy, F.fz, true]];   // [LH, LF, RH, RF]
  const legs=legDef.map(([x, y, z, front])=>{ const L=front ? HORSE.front : HORSE.hind, piv=new THREE.Group(); piv.position.set(x, y, z); B.add(piv);
    const up=bone(piv, 0, 0, 0), mid=bone(up, 0, -L[0], 0), fet=bone(mid, 0, -L[1], 0);
    return { piv, up, mid, fet, front, L, a:L[0], b:L[1]+L[2], z0:z, x0:x, y0:y, st:false, curl:0 }; });
  root.updateMatrixWorld(true);
  const bones=[B, N, H, ...tail, ...legs.flatMap(l=>[l.up, l.mid, l.fet])], I=new Map(bones.map((b, i)=>[b, i])), iB=0, iN=1, iH=2;
  // ---- the body: tail-head → hindquarters → barrel → withers → the chest turning up into the neck → the poll, one tube ----
  const bk=(z, y, rx, rt, rb, o)=>keySec(B, [0, y, z], [0, 0, 1], [0, 1, 0], rx, rt, rb, Object.assign({ w:[[iB,1]], col:CT, e:0.86 }, o||{}));
  const ba=(z, y, al, rx, rt, rb, o)=>keySec(B, [0, y, z], [0, Math.cos(al), Math.sin(al)], [0, Math.sin(al), -Math.cos(al)], rx, rt, rb, Object.assign({ w:[[iB,1]], col:CT, e:0.86 }, o||{}));
  const nk=(s, rx, rt, rb, o)=>keySec(N, [0, s, 0], [0, 1, 0], [0, 0, -1], rx, rt, rb, Object.assign({ w:[[iN,1]], col:CT, e:0.94 }, o||{}));
  const BK=[ bk(-1.02, 0.05, 0.03, 0.03, 0.04), bk(-0.98, 0.05, 0.17, 0.2, 0.26), bk(-0.9, 0.04, 0.27, 0.29, 0.38), bk(-0.76, 0.04, 0.32, 0.33, 0.43), bk(-0.6, 0.03, 0.335, 0.33, 0.42),
    bk(-0.44, 0.0, 0.32, 0.31, 0.37), bk(-0.28, 0.0, 0.31, 0.29, 0.36), bk(-0.08, 0.0, 0.325, 0.29, 0.4), bk(0.12, 0.0, 0.335, 0.3, 0.43), bk(0.3, 0.02, 0.32, 0.34, 0.44), bk(0.46, 0.05, 0.3, 0.39, 0.43),
    ba(0.6, 0.1, 1.33, 0.28, 0.36, 0.44), ba(0.7, 0.18, 1.1, 0.25, 0.29, 0.41, { w:[[iB,0.9],[iN,0.1]] }), ba(0.76, 0.29, 0.92, 0.22, 0.27, 0.36, { w:[[iB,0.7],[iN,0.3]] }),
    nk(0.2, 0.18, 0.25, 0.3, { w:[[iB,0.4],[iN,0.6]] }), nk(0.4, 0.15, 0.2, 0.23, { w:[[iB,0.1],[iN,0.9]] }), nk(0.6, 0.125, 0.16, 0.18), nk(0.76, 0.11, 0.135, 0.15),
    nk(0.88, 0.095, 0.11, 0.12, { w:[[iN,0.6],[iH,0.4]] }), nk(0.95, 0.05, 0.06, 0.06, { w:[[iN,0.4],[iH,0.6]] }), nk(0.98, 0.01, 0.01, 0.01, { w:[[iH,1]] }) ];
  // muscle under the skin: the quarters, the stifle, the point of the hip, the ribs, the shoulder and its point, the crest, the jugular groove
  const relief=(s, a, t)=>{ const ca=Math.abs(Math.cos(a)), sa=Math.sin(a);
    return gs(t, 2.6, 1.2)*ca*Math.max(0, Math.min(1, (sa+0.2)/0.8))*0.032 + gs(t, 4.3, 0.5)*ca*gs(sa, -0.2, 0.35)*0.016 + gs(t, 4.6, 0.35)*gs(sa, 0.72, 0.18)*0.02
      + (t>6 && t<9 ? ca*gs(sa, -0.2, 0.4)*0.004*Math.sin(t*9) : 0) + gs(t, 10.3, 0.9)*ca*gs(sa, 0.1, 0.55)*0.03 + gs(t, 11.5, 0.4)*ca*gs(sa, -0.35, 0.3)*0.02
      + gs(t, 15, 1.2)*gs(sa, 0.7, 0.3)*0.014 - gs(t, 16, 1.5)*ca*gs(sa, -0.25, 0.15)*0.009 + gs(t, 7.5, 1.8)*gs(sa, -1, 0.4)*0.012; };
  const dorsal=(s, a, t, c, q)=>{ const sa=Math.sin(a); if(sa>0.6) c.multiplyScalar(0.86+0.14*(1-sa)); else if(sa<-0.7) c.multiplyScalar(1.06);   // a darker line down the back, a paler belly,
    c.multiplyScalar(1+relief(s, a, t)*4+0.05*blot(q, 16)); };                                                                                   //   light on the muscle, a faint dapple
  const flesh=[ loftGeo(BK, { seg:6, ring:36, caps:true, skin:true, color:true, tint:dorsal, bump:relief }) ];
  // ---- the head: broad jowls, a flat face narrowing to the muzzle ----
  const hd=(z, y, rx, rt, rb, o)=>keySec(H, [0, y*1.15, z*1.12], [0, 0, 1], [0, 1, 0], rx*1.15, rt*1.15, rb*1.15, Object.assign({ w:[[iH,1]], col:CT, e:0.9 }, o||{}));
  const HK=[ hd(-0.1, 0, 0.02, 0.02, 0.02), hd(-0.07, -0.01, 0.085, 0.08, 0.11), hd(0.0, -0.03, 0.11, 0.095, 0.16), hd(0.09, -0.03, 0.112, 0.1, 0.15), hd(0.18, -0.02, 0.095, 0.09, 0.11),
    hd(0.3, -0.02, 0.078, 0.08, 0.085), hd(0.42, -0.025, 0.07, 0.072, 0.075), hd(0.52, -0.03, 0.074, 0.07, 0.08, { col:MUZ }), hd(0.58, -0.035, 0.066, 0.06, 0.07, { col:MUZ }),
    hd(0.615, -0.04, 0.04, 0.035, 0.045, { col:MUZ }), hd(0.63, -0.04, 0.005, 0.005, 0.005, { col:MUZ }) ];
  flesh.push(loftGeo(HK, { seg:6, ring:26, caps:true, skin:true, color:true, tint:(s, a, t, c)=>{ if(t>8.6 && Math.abs(Math.sin(a)+0.15)<0.12) c.multiplyScalar(0.35); const st=gs(t, 2.7, 0.3)*gs(a, Math.PI/2, 0.3); if(st>0.3) c.lerp(WHITE, Math.min(1, (st-0.3)*2)); } }));   // the line of the lips · a white star
  // ---- legs: the forearm / gaskin muscle coming out of the body, knee / hock, the flat cannon with its tendons behind, fetlock, pastern, hoof ----
  legs.forEach((l, i)=>{ const iU=I.get(l.up), iM=I.get(l.mid), iF=I.get(l.fet), MIX=CT.clone().lerp(POINT, 0.55);
    const lk=(y, z, rx, rt, rb, w, col)=>keySec(l.piv, [0, y, z], [0, -1, 0], [0, 0, 1], rx, rt, rb, { w, col:col||CT, e:0.9 });
    const K = l.front ? [ lk(0.22, 0, 0.13, 0.15, 0.15, [[iB,1]]), lk(0.05, -0.01, 0.12, 0.14, 0.15, [[iB,0.7],[iU,0.3]]), lk(-0.08, 0, 0.11, 0.13, 0.16, [[iB,0.25],[iU,0.75]]),
        lk(-0.25, 0.005, 0.085, 0.1, 0.1, [[iU,1]]), lk(-0.45, 0, 0.062, 0.066, 0.06, [[iU,1]]), lk(-0.56, 0.005, 0.058, 0.062, 0.055, [[iU,0.7],[iM,0.3]], MIX),
        lk(-0.62, 0, 0.05, 0.05, 0.052, [[iU,0.3],[iM,0.7]], POINT), lk(-0.7, -0.005, 0.044, 0.04, 0.058, [[iM,1]], POINT), lk(-0.84, -0.005, 0.042, 0.038, 0.058, [[iM,1]], POINT),
        lk(-0.91, -0.01, 0.046, 0.04, 0.064, [[iM,0.7],[iF,0.3]], POINT), lk(-0.96, 0, 0.044, 0.04, 0.055, [[iM,0.2],[iF,0.8]], POINT), lk(-1.02, 0.008, 0.043, 0.042, 0.045, [[iF,1]], POINT),
        lk(-1.045, 0.01, 0.05, 0.055, 0.045, [[iF,1]], HOOF), lk(-1.1, 0.016, 0.062, 0.072, 0.055, [[iF,1]], HOOF), lk(-1.145, 0.02, 0.068, 0.08, 0.06, [[iF,1]], HOOF) ]
      : [ lk(0.22, 0, 0.17, 0.18, 0.2, [[iB,1]]), lk(0.05, -0.04, 0.15, 0.15, 0.21, [[iB,0.65],[iU,0.35]]), lk(-0.1, -0.05, 0.125, 0.12, 0.2, [[iB,0.2],[iU,0.8]]),
        lk(-0.28, -0.05, 0.09, 0.08, 0.14, [[iU,1]]), lk(-0.48, -0.04, 0.06, 0.055, 0.08, [[iU,1]]), lk(-0.58, -0.035, 0.06, 0.055, 0.095, [[iU,0.7],[iM,0.3]], MIX),
        lk(-0.64, -0.02, 0.05, 0.048, 0.065, [[iU,0.3],[iM,0.7]], POINT), lk(-0.72, -0.01, 0.045, 0.042, 0.06, [[iM,1]], POINT), lk(-0.92, -0.01, 0.043, 0.04, 0.058, [[iM,1]], POINT),
        lk(-1.0, -0.012, 0.046, 0.04, 0.064, [[iM,0.7],[iF,0.3]], POINT), lk(-1.05, 0, 0.044, 0.04, 0.055, [[iM,0.2],[iF,0.8]], POINT), lk(-1.1, 0.008, 0.043, 0.042, 0.045, [[iF,1]], POINT),
        lk(-1.12, 0.01, 0.05, 0.055, 0.045, [[iF,1]], HOOF), lk(-1.175, 0.016, 0.062, 0.07, 0.055, [[iF,1]], HOOF), lk(-1.22, 0.02, 0.067, 0.078, 0.06, [[iF,1]], HOOF) ];
    if(i===0) for(const k of K.slice(9, 12)) k.col=WHITE;   // a white sock on the near hind
    flesh.push(loftGeo(K, { seg:5, ring:18, caps:true, skin:true, color:true })); l.K=K; });
  // ---- tail: a dock, then a long, full fall of hair; mane: a ridge along the crest (only on a bare horse — the crinet covers it) ----
  { const tw=d=>{ const s=Math.max(0, d)/0.17, w=[]; for(let k=0;k<5;k++){ const v=k===4 && s>4.5 ? 1 : Math.max(0, 1-Math.abs(s-(k+0.5))); if(v>0) w.push([I.get(tail[k]), v]); } return w.length ? w : [[I.get(tail[0]), 1]]; };
    const HAIR=POINT, arch=d=>-0.16*Math.sin(Math.min(1, Math.max(0, d)/0.5)*Math.PI*0.5)+0.05*Math.max(0, d-0.5),   // the dock arches out behind, then the hair falls
      tk=(d, r, col)=>keySec(T0, [0, -d, arch(d)], [0, -1, 0], [0, 0, -1], r*0.92, r, r, { w:tw(d), col:col||HAIR, e:0.95 });
    const K=[ tk(-0.08, 0.04, CT), tk(0, 0.055, CT), tk(0.12, 0.058, CT.clone().lerp(HAIR, 0.6)), tk(0.25, 0.06), tk(0.45, 0.075), tk(0.7, 0.08), tk(0.9, 0.075), tk(1.05, 0.06), tk(1.2, 0.035), tk(1.32, 0.008) ];
    flesh.push(loftGeo(K, { seg:5, ring:14, caps:true, skin:true, color:true, tint:(s, a, t, c)=>{ if(t>2.5) c.multiplyScalar(0.85+0.3*((Math.sin(a*7+t*3)+1)*0.5)); } })); }   // strands
  { const MK=[]; for(let i=0;i<=12;i++){ const s=secAt(BK, 12.6+i*0.5), cp=ringAt(s, Math.PI/2, -0.02), u=s.u.clone().addScaledVector(s.X, 0.55).normalize(), k=Math.sin(Math.PI*Math.min(1, i/11));   // the mane falls to the off side
      MK.push(keySec(null, [cp.x, cp.y, cp.z], [s.n.x, s.n.y, s.n.z], [u.x, u.y, u.z], 0.025+0.02*k, 0.04+0.1*k, 0.01, { w:s.w, col:POINT })); }
    flesh.push(loftGeo(MK, { seg:4, ring:14, caps:true, skin:true, color:true, tint:(s, a, t, c)=>c.multiplyScalar(0.8+0.5*((Math.sin(a*9+t*5)+1)*0.5)) })); }   // strands
  const skel=new THREE.Skeleton(bones), body=skinMesh(mergeGeometries(flesh, false), M.coat, skel, root); flesh.forEach(g=>g.dispose());
  // ---- eyes, ears, nostrils (rigid on the head) ----
  const onHead=(t, a, off)=>H.worldToLocal(ringAt(secAt(HK, t), a, off));
  const ears=[]; for(const sx of [1,-1]){ const ex=sx>0 ? 0.42 : Math.PI-0.42, e=put(new THREE.SphereGeometry(0.027, 14, 10), M.eye, H); e.position.copy(onHead(3.35, ex, -0.012));
    const eg=new THREE.LatheGeometry([[0,0],[0.034,0.02],[0.04,0.07],[0.026,0.13],[0.008,0.165],[0,0.172]].map(p=>new THREE.Vector2(p[0], p[1])), 12); eg.scale(1, 1, 0.55);
    const ear=put(eg, M.coat, H); ear.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(eg.attributes.position.count*3).fill(0).map((_, k)=>[CT.r, CT.g, CT.b][k%3]), 3));
    ear.position.copy(onHead(1.3, Math.PI/2 - sx*0.5, -0.02)); ear.rotation.set(-0.25, 0, sx*-0.2); ears.push(ear);
    const ns=put(new THREE.SphereGeometry(0.016, 10, 8), M.eye, H); ns.position.copy(onHead(8.9, sx>0 ? 0.25 : Math.PI-0.25, -0.006)); ns.scale.set(0.7, 1, 1.4); }
  // ---- tack: saddle cloth, seat, pommel and cantle, girth, stirrups; bridle ----
  const saddle=new THREE.Group(); saddle.position.set(0, HORSE.saddleY, 0.05); B.add(saddle); saddle.updateMatrixWorld(true);
  const onSaddle=(geo, mat)=>put(toLocal(geo, saddle), mat, saddle), onB=(geo, mat)=>put(toLocal(geo, B), mat, B), onH=(geo, mat)=>put(toLocal(geo, H), mat, H);
  onSaddle(loftGeo(BK, { t0:5.7, t1:9.0, a0:0.12, a1:Math.PI-0.12, off:0.035, seg:8, ring:20 }), M.cloth);
  for(const a of [0.12, Math.PI-0.12]) onSaddle(trimGeo(lineAlong(BK, 5.7, 9.0, a, 0.037, 16), 0.009), M.strap);
  for(const t of [5.7, 9.0]) onSaddle(trimGeo(lineAround(BK, t, 0.12, Math.PI-0.12, 0.037, 16), 0.009), M.strap);
  onSaddle(loftGeo(BK, { t0:6.2, t1:8.7, a0:Math.PI*0.3, a1:Math.PI*0.7, off:0.075, seg:8, ring:12 }), M.leather);                      // the seat
  onSaddle(trimGeo([...lineAlong(BK, 6.2, 8.7, Math.PI*0.3, 0.075, 10), ...lineAround(BK, 8.7, Math.PI*0.3, Math.PI*0.7, 0.075, 8).slice(1), ...lineAlong(BK, 8.7, 6.2, Math.PI*0.7, 0.075, 10).slice(1)], 0.018), M.leather);   // its rolled edge
  onSaddle(trimGeo(lineAround(BK, 8.95, Math.PI*0.26, Math.PI*0.74, 0.11, 12), 0.04), M.leather);                                  // pommel
  onSaddle(trimGeo(lineAround(BK, 6.05, Math.PI*0.24, Math.PI*0.76, 0.13, 12), 0.045), M.leather);                                 // cantle
  onB(loftGeo(BK, { t0:8.3, t1:8.45, off:0.012, seg:2, ring:32 }), M.leather);                                                        // girth
  const stirrups=[];   // Z246 no hanging irons: the rider's boots sit against the horse's sides (two-point at the gallop)
  for(const t of [1.4, 5.2]) onH(loftGeo(HK, { t0:t, t1:t+0.18, off:0.007, seg:2, ring:26 }), M.leather);                           // headstall · noseband
  for(const a of [0.05, Math.PI-0.05]) onH(trimGeo(lineAlong(HK, 1.45, 5.3, a, 0.008, 12), 0.011), M.leather);                         // cheekpieces
  // ---- forelock over the brow ----
  { const P=[ringAt(secAt(HK, 0.9), Math.PI/2, 0.0), ringAt(secAt(HK, 1.8), Math.PI/2, 0.012), ringAt(secAt(HK, 2.6), Math.PI/2, 0.01)], up=secAt(HK, 1.8).u;
    onH(loftGeo(pathKeys(P, up, t=>[0.045-0.02*t, 0.012, 0.01]), { seg:5, ring:10, caps:true }), M.strap).material=M.leather; }
  // ---- modern kit: a soft ballistic breast panel, a clear face shield, leg boots, breast collar, saddlebags, bedroll, reins ----
  if(armour){ const trimB=(pts, mat)=>onB(trimGeo(pts, 0.009), mat||M.strap);
    onB(loftGeo(BK, { t0:10.4, t1:13.5, a0:Math.PI-0.35, a1:2*Math.PI+0.35, off:0.032, seg:8, ring:22 }), M.gear);                     // breast panel
    for(let k=1;k<4;k++) onB(trimGeo(lineAround(BK, 10.4+k*0.78, Math.PI+0.15, 2*Math.PI-0.15, 0.034, 20), 0.005), M.gearDk);         // MOLLE webbing rows
    for(const a of [Math.PI-0.35, 2*Math.PI+0.35]) trimB(lineAlong(BK, 10.4, 13.5, a, 0.034, 14));
    onB(loftGeo(BK, { t0:10.9, t1:11.12, a0:Math.PI*0.15, a1:Math.PI*0.85, off:0.012, seg:2, ring:16 }), M.leather);                    // breast collar over the withers
    onH(loftGeo(HK, { t0:2.5, t1:5.6, a0:Math.PI*0.04, a1:Math.PI*0.96, off:0.045, seg:8, ring:18 }), M.visor);                           // clear face shield
    for(const a of [Math.PI*0.04, Math.PI*0.96]) onH(trimGeo(lineAlong(HK, 2.5, 5.6, a, 0.046, 12), 0.007), M.strap);
    for(const t of [2.5, 5.6]) onH(trimGeo(lineAround(HK, t, Math.PI*0.04, Math.PI*0.96, 0.046, 14), 0.007), M.strap);
    legs.forEach(l=>skinMesh(loftGeo(l.K, { t0:6.7, t1:9.3, off:0.012, seg:5, ring:16, skin:true }), M.boot, skel, root));            // splint boots on the cannons
    for(const sx of [-1,1]){ const sb=put(new RoundedBoxGeometry(0.09, 0.2, 0.27, 4, 0.04), M.gear, B); sb.position.set(sx*0.36, 0.1, -0.42); sb.rotation.z=sx*0.12;   // saddlebags
      const fl=put(new RoundedBoxGeometry(0.088, 0.07, 0.29, 2, 0.02), M.gearDk, B); fl.position.set(sx*0.37, 0.2, -0.42); fl.rotation.z=sx*0.12; }
    { const br=put(new THREE.CylinderGeometry(0.075, 0.075, 0.62, 18), M.cloth, B); br.position.set(0, 0.43, -0.4); br.rotation.z=Math.PI/2;    // bedroll behind the cantle
      for(const x of [-0.2, 0.2]){ const st=put(new THREE.TorusGeometry(0.078, 0.008, 6, 20), M.strap, B); st.position.set(x, 0.43, -0.4); st.rotation.y=Math.PI/2; } }
    // reins: from the bit up the neck to the pommel — skinned, so they follow the head
    for(const sx of [1,-1]){ const pts=[], w=[]; const bit=ringAt(secAt(HK, 8.2), sx>0 ? -0.2 : Math.PI+0.2, 0.01);
      pts.push(bit); w.push([[iH,1]]); for(const [t, wt] of [[17.5, [[iN,0.7],[iH,0.3]]], [15.5, [[iN,1]]], [13.6, [[iN,0.5],[iB,0.5]]]]){ pts.push(ringAt(secAt(BK, t), sx>0 ? 0.35 : Math.PI-0.35, 0.03)); w.push(wt); }
      pts.push(ringAt(secAt(BK, 9.2), Math.PI/2-sx*0.25, 0.12)); w.push([[iB,1]]);
      skinMesh(loftGeo(pathKeys(pts, null, ()=>[0.009, 0.004, 0.004], t=>({ w:w[Math.round(t*(pts.length-1))] })), { seg:6, ring:6, caps:true, skin:true }), M.leather, skel, root);
      const rr=put(new THREE.TorusGeometry(0.022, 0.005, 6, 14), M.iron, H); rr.position.copy(H.worldToLocal(bit.clone())); rr.rotation.y=Math.PI/2; } }
  root.scale.setScalar(HORSE.size);   // Z245 a big destrier
  const S={ root, B, N, H, legs, mane:[], tail, ears, saddle, stirrups, body, phase:0, gait:'idle', prevGait:null, blend:1, prevPhase:0, bob:0, pitch:0, bank:0, nod:0, t:Math.random()*10, tailV:0, tailA:0, graze:0, onStep:null, v:0 };
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
export function animateHorse(S, dt, v, yawRate){ if(S.bike) return animateBike(S, Math.min(dt, 0.05), v, yawRate); dt=Math.min(dt, 0.05); S.t+=dt; S.v=v; const K=S.root.scale.x||1;   // world metres ↔ horse units · Z282 a bike mount (xe ôm / cyclo) moves its own way
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
