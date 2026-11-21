// world/radar.js — Z197 THE RADAR STATION: the enemy's eyes. A 20 m tapered steel lattice tower on a concrete pad, an equipment cabin on its
//   railed platform and, on a turntable above it, a big phased-array antenna (tilted panel, glowing element grid, IFF bar on top, back truss)
//   that sweeps round without stopping, red aviation lights blinking at the top; on the ground a white radome, satellite dishes on tripods,
//   whip masts, equipment cabins with A/C units and a generator. Held by two twin-barrel AA guns that swing round and hose you, plus the usual
//   wire, gate, signs and garrison. Bring the tower down (it topples) and the enemy artillery loses its eyes: fewer barrages, fewer shells, wide of the mark.
import * as THREE from 'three';
import { B3, MOBILE, S, SUPPLY, _xf, aoeDamage, bigExplode, burst, heightAt, kit, sfx, spawnBullet, spawnDebris, spawnPart, playerSeen } from '../hub.js';

const CY=(rt,rb,h,s,x,y,z,rx,rz)=>_xf(new THREE.CylinderGeometry(rt,rb,h,s),x,y,z,rx||0,0,rz||0);
export function radarLost(){ return SUPPLY.radar|0; }
// what the artillery keeps of its precision and tempo once the radar is gone
export function artyRestMul(){ return 1+0.7*Math.min(2, radarLost()); }
export function artyShotCut(){ return Math.min(2, radarLost()); }
export function artyErr(){ return radarLost() ? 5+4*radarLost() : 0; }
let _panelT=null;
function panelMat(){ if(_panelT) return _panelT; const c=document.createElement('canvas'); c.width=256; c.height=128; const x=c.getContext('2d'); x.fillStyle='#2a2e2c'; x.fillRect(0,0,256,128);
  for(let i=0;i<32;i++) for(let j=0;j<14;j++){ x.fillStyle=(i+j)%7===0?'#4a8a9a':'#3a4442'; x.fillRect(4+i*7.9,4+j*8.8,5.5,6.5); }   // radiating elements
  x.strokeStyle='#56605c'; x.lineWidth=3; x.strokeRect(1.5,1.5,253,125); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
  return _panelT=new THREE.MeshStandardMaterial({ map:t, emissive:0x2a6a7a, emissiveMap:t, emissiveIntensity:0.35, roughness:0.5, metalness:0.6 }); }
let _redM=null; export function aviationMat(){ return _redM||(_redM=new THREE.MeshStandardMaterial({ color:0x300000, emissive:0xff2a1a, emissiveIntensity:2.4 })); }
// a tapered lattice: legs lean from ±b0 at the foot to ±b1 at height h, girts + X-braces every 2.5 m
function taperLattice(K, h, b0, b1, col){ const half=(y)=>b0+(b1-b0)*(y/h);
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const lean=Math.atan2(b0-b1,h), L=Math.hypot(h,b0-b1); K.add('metal', _xf(new THREE.BoxGeometry(0.22,L,0.22),sx*(b0+b1)/2,h/2,sz*(b0+b1)/2,-sz*lean,0,sx*lean), col); }
  for(let y=0.4;y<h;y+=2.5){ const w=half(y), w2=half(Math.min(h,y+2.5)), Lb=Math.hypot(2*w,2.5);
    for(const [ax,az,along] of [[0,-1,0],[0,1,0],[-1,0,1],[1,0,1]]){ const cx=ax*w, cz=az*w;
      K.add('metal', along ? B3(0.1,0.1,2*w,cx,y,cz) : B3(2*w,0.1,0.1,cx,y,cz), col);
      const a=Math.atan2(2.5,2*w); for(const sg of [1,-1]) K.add('metal', along ? _xf(new THREE.BoxGeometry(0.07,0.07,Lb),cx*(w+w2)/(2*w||1),y+1.25,cz,sg*a,0,0) : _xf(new THREE.BoxGeometry(Lb,0.07,0.07),cx,y+1.25,cz*(w+w2)/(2*w||1),0,0,sg*a), col); } } }
// the tower piece: pad, lattice, platform + railings + cabin, aviation lights; the rotating head is returned separately (it turns)
export function radarTower(){ const K=kit(), H=20, col=0x6a6e66;
  K.add('conc', B3(7.5,0.5,7.5,0,0.25,0), 0xa8a49a); taperLattice(K, H, 2.5, 1.15, col);
  K.add('metal', B3(4.4,0.22,4.4,0,H,0), 0x56584f); for(const [sx,sz,al] of [[0,-2.2,0],[0,2.2,0],[-2.2,0,1],[2.2,0,1]]){ K.add('metal', al?B3(0.06,0.06,4.4,sx,H+1.05,sz):B3(4.4,0.06,0.06,sx,H+1.05,sz), 0xc8a020); for(let k=-2;k<=2;k++) K.add('metal', al?B3(0.05,1.05,0.05,sx,H+0.55,k):B3(0.05,1.05,0.05,k,H+0.55,sz), 0x56584f); }
  K.add('paint', B3(2.6,2.1,2.0,-0.6,H+1.15,-0.9), 0xd8d8d0); K.add('metal', B3(0.9,0.6,0.5,0.95,H+0.55,-1.6), 0x8a8c84); K.add('metal', B3(0.7,0.7,0.06,-0.6,H+1.3,0.11), 0x1a2228);   // equipment cabin + A/C
  for(let y=0.6;y<H;y+=0.45) K.add('metal', B3(0.5,0.04,0.04,2.4-(1.25*y/H),y,0), 0x4a4c46);   // ladder rungs up one leg
  const g=K.bake(true); g.userData.lights=[];
  for(const [x,z] of [[-2.1,-2.1],[2.1,2.1]]){ const l=new THREE.Mesh(new THREE.SphereGeometry(0.18,8,6), aviationMat()); l.position.set(x,H+1.25,z); g.add(l); }
  const head=radarHead(); head.position.set(0.4,H+2.4,0.6); g.add(head); g.userData.head=head; return g; }
function radarHead(){ const K=kit(), h=new THREE.Group();
  K.add('metal', CY(0.9,1.1,0.6,20,0,0,0), 0x3a3c38); K.add('metal', CY(0.35,0.45,1.4,12,0,0.9,0), 0x4a4c46);   // turntable + mast
  for(const s of [-1,1]) K.add('metal', _xf(new THREE.BoxGeometry(0.16,2.6,0.16),s*2.2,2.3,-0.7,-0.35,0,0), 0x4a4c46);   // back truss struts
  K.add('metal', B3(5.2,0.14,0.14,0,1.3,-0.4), 0x4a4c46);
  const base=K.bake(true); h.add(base);
  const face=new THREE.Mesh(new THREE.BoxGeometry(7.4,3.2,0.28), [mat2(),mat2(),mat2(),mat2(),panelMat(),mat2()]); face.position.set(0,2.6,0.25); face.rotation.x=-0.32; face.castShadow=true; h.add(face);   // the phased array
  const iff=new THREE.Mesh(new THREE.BoxGeometry(7.8,0.32,0.4), mat2()); iff.position.set(0,4.25,-0.3); iff.rotation.x=-0.32; h.add(iff);   // IFF bar on top
  const dome=new THREE.Mesh(new THREE.SphereGeometry(0.45,14,10), new THREE.MeshStandardMaterial({ color:0xe8e8e0, roughness:0.4 })); dome.position.set(0,1.0,1.1); h.add(dome);
  return h; }
let _m2=null; function mat2(){ return _m2||(_m2=new THREE.MeshStandardMaterial({ color:0x585c56, roughness:0.45, metalness:0.7 })); }
// a twin 23 mm AA gun: the mount turns (child 'turret'), two long barrels, flash hiders, seats, shield
export function aaGun(){ const g=new THREE.Group(), K=kit(); K.add('metal', CY(0.9,1.1,0.5,14,0,0.25,0), 0x4a5032); for(const a of [0,2.1,4.2]) K.add('metal', _xf(new THREE.BoxGeometry(0.25,0.18,1.9),Math.sin(a)*0.9,0.12,Math.cos(a)*0.9,0,a,0), 0x3a3f28);
  g.add(K.bake(true)); const T=new THREE.Group(); T.position.y=0.55; g.add(T); g.userData.turret=T;
  const M=kit(); M.add('paint', B3(1.6,0.7,1.3,0,0.35,0), 0x56603a); M.add('paint', B3(1.8,0.9,0.06,0,0.85,0.75), 0x4e5834); for(const s of [-0.55,0.55]) M.add('metal', B3(0.45,0.12,0.45,s,0.75,-0.55), 0x2a2a28);
  for(const s of [-0.22,0.22]){ M.add('metal', CY(0.06,0.07,3.2,8,s,1.0,1.9,Math.PI/2), 0x2a2a28); M.add('metal', CY(0.1,0.1,0.35,8,s,1.0,3.5,Math.PI/2), 0x1e1e1c); M.add('metal', B3(0.22,0.3,0.7,s,1.0,0.5), 0x3a3a36); }
  const top=M.bake(true); T.add(top); const mz=new THREE.Object3D(); mz.position.set(0,1.0,3.7); T.add(mz); g.userData.muzzle=mz; return g; }
// ground clutter for the compound decor kit: radome, dishes, masts, cabins, generator
export function radome(){ const K=kit(); K.add('paint', _xf(new THREE.SphereGeometry(3.2,24,16,0,Math.PI*2,0,Math.PI*0.62),0,3.3,0), 0xeceae2); K.add('conc', CY(2.9,3.1,2.1,24,0,1.05,0), 0xb4b0a6); K.add('metal', B3(1.0,1.8,0.06,0,0.9,3.02), 0x2a2e26); return K.bake(true); }   // the golf-ball radome
export function radarYard(K){
  for(const [x,z,r] of [[8.5,-8,1.4],[11,-4,1.0]]){ for(const a of [0,2.1,4.2]) K.add('metal', _xf(new THREE.BoxGeometry(0.08,1.9,0.08),x+Math.sin(a)*0.5,0.9,z+Math.cos(a)*0.5,Math.cos(a)*0.25,0,-Math.sin(a)*0.25), 0x5a5a56);
    K.add('paint', _xf(new THREE.SphereGeometry(r,18,8,0,Math.PI*2,0,0.75),x,2.2,z,-1.0,0.6,0), 0xe0e0d8); K.add('metal', CY(0.04,0.04,r*1.1,5,x+0.3,2.6,z+0.4,-0.7), 0x3a3a36); }   // dishes
  for(const [x,z,h] of [[-13,6,9],[13,7,7],[4,-11,11]]) K.add('metal', CY(0.05,0.08,h,6,x,h/2,z), 0x4a4c46);   // whip masts
  for(const [x,z] of [[-8,8],[-3,9.5]]){ K.add('paint', B3(5.8,2.5,2.4,x,1.25,z), 0x56603a); K.add('metal', B3(0.9,0.8,0.6,x+1.6,2.9,z), 0x8a8c84); K.add('metal', B3(0.9,1.9,0.05,x-1.8,0.95,z+1.21), 0x2a2e26); for(const ox of [-2.8,2.8]) K.add('metal', B3(0.08,0.08,7,x+ox,0.08,z+4.5), 0x2a2a28); }   // cabins + cable runs
  K.add('paint', B3(3.0,1.6,1.4,5,0.8,9), 0x6a6e52); K.add('metal', CY(0.08,0.08,1.2,6,6,2.2,9), 0x2a2826); }   // generator + exhaust
// the tower topples: rotating about its foot toward `dir`, then a blast where it hits
export function toppleTower(T, dir, now){ T.fall={ t:0, dir, done:false, sx:Math.sin(dir), sz:Math.cos(dir) }; }
export function updateTopple(T, dt){ const F=T.fall; if(!F || F.done) return; F.t+=dt; const k=Math.min(1, F.t/1.8), e=k*k, a=e*1.45;
  T.mesh.rotation.set(F.sz*a, T.mesh.rotation.y, -F.sx*a, 'YXZ');
  if(k>=1){ F.done=true; const L=14, x=T.x+F.sx*L, z=T.z+F.sz*L, pos={x,z}; bigExplode(pos, 0xffb050, 2.2); burst(pos, 0xb0aaa0, 10, 6, {y:heightAt(x,z)+1, life:1.6, size:3, smoke:true, grav:-0.5, drag:1.5, up:2, op:0.5}); for(let i=0;i<3;i++) spawnDebris(pos, 1.2, 0x5a5c56); S.shake=Math.min(4, S.shake+1.6); sfx('bigexplode', pos); aoeDamage(x, z, 6, 60, false, performance.now()/1000, 'HE'); } }
// the AA guns swing onto you and hose you in bursts when you are in reach
export function updateAAGun(g, b, dt, now, p){ const u=g.userData, T=u.turret; if(!T || !(b.hp>0)) return; const dx=p.pos.x-b.x, dz=p.pos.z-b.z, d=Math.hypot(dx,dz); if(d>62 || !playerSeen(b.x, heightAt(b.x,b.z)+2.5, b.z)) return;   // Z377 a man lying flat out of its crew's sight: no target
  const want=Math.atan2(dx,dz)-g.rotation.y; let da=want-T.rotation.y; da=Math.atan2(Math.sin(da),Math.cos(da)); T.rotation.y+=Math.max(-dt*1.6,Math.min(dt*1.6,da));
  if(Math.abs(da)>0.12) return; if(!b.burstN && now<(b.fireAt||0)) return;
  if(!b.burstN){ b.burstN=MOBILE?6:9; } if(now<(b.shotAt||0)) return; b.shotAt=now+0.09; b.burstN--; if(!b.burstN) b.fireAt=now+2.2+Math.random()*1.2;
  u.muzzle.getWorldPosition(_mv); const a=g.rotation.y+T.rotation.y+(Math.random()-0.5)*0.05;
  spawnBullet(_mv.x, _mv.z, a, { owner:'e', dmg:2.2, speed:85, color:0xffa040, r:0.22, life:1.2, maxDist:66, y:_mv.y, noArc:true });
  spawnPart(_mv.x,_mv.y,_mv.z, Math.sin(a)*4,0,Math.cos(a)*4, { tex:'flash', color:0xfff0c0, size:1.1, life:0.04, grav:0, drag:8 }); if(Math.random()<0.4) sfx('enemyShoot', b, 0.5); }
const _mv=new THREE.Vector3();
