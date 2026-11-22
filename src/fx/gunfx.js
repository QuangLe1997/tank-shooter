// fx/gunfx.js — Z149 GUN EFFECTS that read like the real weapon, per firing class (GUNS[id].flash):
//   small  — rifle-calibre MGs / rotary: a tight, quick star flash, a breath of haze, no cannon smoke
//   auto   — autocannons (rifle, flak): the standard flash + propellant sparks
//   heavy  — big-bore guns (cannon, HESH, canister): blinding flash, brake jets, an expanding SMOKE RING (vortex) that drifts off the muzzle, dust kicked off the ground
//   rail   — railgun: no powder at all — a violet plasma burst and a straight BEAM that hangs in the air with a helix of sparks along it
//   arc    — tesla: a forked LIGHTNING bolt from the electrode to whatever it strikes (and between the enemies it chains through)
//   frost  — cryo: a cold white vapour plume and glittering ice dust instead of fire
//   launch — missile / thermobaric tubes: a small front flash and a hard BACKBLAST out of the rear of the tube that rolls dust behind the tank
// The bolts / beams are a small pool of camera-facing ribbons (no allocation per shot); everything else rides the instanced particle layers.
// Z419 + a SHAPED muzzle flash (gunFlash: petals along the bore + a face-on star, 1–2 frames, one instanced draw call), real BRASS meshes that tumble and
//   bounce (ejectBrass, one instanced draw call), and a bullet strike in the colour of what it hit (bulletImpact: dirt / stone / metal / wood / sand / water)
//   (the chips / clods / splinters are solid little meshes from the brass pool: a smoke-layer speck can never be opaque — keep its op ≤ 2, the HDR target does not clamp alpha)
import * as THREE from 'three';
import { GUNFX, REAL } from '../../config.js';
import { BIOME, MOBILE, RIVER, S, camera, heightAt, muzzleFlash, muzzleLight, muzzleLinger, ringPulse, scene, spawnPart, wetAt } from '../hub.js';

// ---- ribbon pool ----
const MAXP = 18, POOL = MOBILE ? 10 : 22;
let _tex = null;
function ribbonTex(){ if(_tex) return _tex; const c=document.createElement('canvas'); c.width=4; c.height=64; const x=c.getContext('2d'), g=x.createLinearGradient(0,0,0,64);
  g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.32,'rgba(255,255,255,0.35)'); g.addColorStop(0.5,'rgba(255,255,255,1)'); g.addColorStop(0.68,'rgba(255,255,255,0.35)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,4,64); _tex=new THREE.CanvasTexture(c); _tex.colorSpace=THREE.SRGBColorSpace; return _tex; }
const RIB = [];
function ribbon(){ for(const r of RIB) if(!r.on) return r;
  if(RIB.length >= POOL) return null;
  const pos=new Float32Array(MAXP*2*3), uv=new Float32Array(MAXP*2*2), idx=[];
  for(let i=0;i<MAXP;i++){ uv[i*4]=i/(MAXP-1); uv[i*4+1]=0; uv[i*4+2]=i/(MAXP-1); uv[i*4+3]=1; }
  for(let i=0;i<MAXP-1;i++){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(uv,2)); g.setIndex(idx);
  const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map:ribbonTex(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false }));
  m.frustumCulled=false; m.renderOrder=7; m.visible=false; scene.add(m);
  const r={ m, g, on:false, pts:[], n:0, w:0.3, life:0, max:0, base:new THREE.Color(), a:new THREE.Vector3(), b:new THREE.Vector3(), jag:0, reT:0, taper:true };
  for(let i=0;i<MAXP;i++) r.pts.push(new THREE.Vector3()); RIB.push(r); return r; }
const _d=new THREE.Vector3(), _v=new THREE.Vector3(), _s=new THREE.Vector3();
function layout(r){ const P=r.g.attributes.position.array, n=r.n;
  for(let i=0;i<n;i++){ const p=r.pts[i], q=r.pts[Math.min(n-1,i+1)], o=r.pts[Math.max(0,i-1)];
    _d.subVectors(q,o).normalize(); _v.subVectors(camera.position,p).normalize(); _s.crossVectors(_d,_v).normalize();
    const t=i/(n-1), w=r.w*(r.taper ? 0.35+0.65*Math.sin(Math.PI*Math.min(1,t*1.15+0.05)) : 1)*0.5;
    P[i*6]=p.x+_s.x*w; P[i*6+1]=p.y+_s.y*w; P[i*6+2]=p.z+_s.z*w; P[i*6+3]=p.x-_s.x*w; P[i*6+4]=p.y-_s.y*w; P[i*6+5]=p.z-_s.z*w; }
  for(let i=n;i<MAXP;i++){ const j=(n-1)*6; for(let k=0;k<6;k++) P[i*6+k]=P[j+k]; }
  r.g.attributes.position.needsUpdate=true; r.g.setDrawRange(0, (n-1)*6); }
// a jagged path a→b: midpoint-style random walk pinned at both ends, kink size ∝ length
function jagged(r){ const n=r.n, L=r.a.distanceTo(r.b), amp=Math.min(1.6, L*0.07)*r.jag;
  _d.subVectors(r.b,r.a); const sx=-_d.z, sz=_d.x, sl=Math.hypot(sx,sz)||1;
  for(let i=0;i<n;i++){ const t=i/(n-1), e=Math.sin(Math.PI*t), k=(Math.random()-0.5)*2*amp*e;
    r.pts[i].lerpVectors(r.a,r.b,t); r.pts[i].x+=sx/sl*k; r.pts[i].z+=sz/sl*k; r.pts[i].y+=(Math.random()-0.5)*amp*0.8*e; }
  layout(r); }
function startRibbon(a, b, col, w, life, jag, n, k){ const r=ribbon(); if(!r) return null;
  r.on=true; r.m.visible=true; r.a.copy(a); r.b.copy(b); r.w=w; r.life=r.max=life; r.jag=jag; r.n=Math.max(2, Math.min(MAXP, n)); r.reT=0; r.taper=jag>0;
  r.base.setHex(col).multiplyScalar(k||2.2); r.m.material.color.copy(r.base); r.m.material.opacity=1;
  if(jag>0) jagged(r); else { for(let i=0;i<r.n;i++) r.pts[i].lerpVectors(a,b,i/(r.n-1)); layout(r); }
  return r; }
// a forked lightning bolt (a main channel + a thinner branch or two) — re-strikes its shape every few frames while it lives
const _f=new THREE.Vector3();
export function lightning(a, b, col=0x9fd4ff, life=0.22, w=0.34){
  startRibbon(a, b, 0xe8f6ff, w*0.45, life, 1, 14, 3.2);                                   // white-hot core
  startRibbon(a, b, col, w*1.6, life, 1, 14, 1.6);                                          // blue corona
  if(Math.random()<0.8){ const t=0.3+Math.random()*0.4; _f.lerpVectors(a,b,t); const L=a.distanceTo(b)*0.35;
    _v.set(_f.x+(Math.random()-0.5)*L, _f.y-Math.random()*0.8, _f.z+(Math.random()-0.5)*L); startRibbon(_f, _v, col, w*0.6, life*0.8, 1, 8, 1.8); }   // a fork
}
// the railgun's slug path: a straight violet beam that hangs and thins, a hot core inside it
export function railBeam(a, b){
  startRibbon(a, b, 0xffffff, 0.22, 0.32, 0, 2, 3.0); startRibbon(a, b, 0xb07cff, 1.3, 0.55, 0, 2, 1.4);
  const L=a.distanceTo(b), n=Math.min(MOBILE?14:26, Math.ceil(L/1.4)); _d.subVectors(b,a).normalize(); const sx=-_d.z, sz=_d.x;
  for(let i=0;i<n;i++){ const t=i/n, ph=t*L*1.6, c=Math.cos(ph)*0.35, s=Math.sin(ph)*0.35;   // helix of plasma sparks wound round the path
    spawnPart(a.x+(b.x-a.x)*t+sx*c, a.y+(b.y-a.y)*t+s, a.z+(b.z-a.z)*t+sz*c, sx*c*2, s*2+0.4, sz*c*2, { color:i%3?0xc9a8ff:0xffffff, size:0.32, life:0.45+Math.random()*0.25, grav:0.6, drag:2.4 }); }
}
export function updateBolts(dt){ for(const r of RIB){ if(!r.on) continue; r.life-=dt;
    if(r.life<=0){ r.on=false; r.m.visible=false; continue; }
    const k=r.life/r.max; r.m.material.opacity=k*k*(r.jag>0 ? 0.75+Math.random()*0.25 : 1); r.w*= r.jag>0 ? 1 : (1-dt*1.5);
    if(r.jag>0){ r.reT-=dt; if(r.reT<=0){ r.reT=0.035; jagged(r); } } else layout(r); } }

// ---- muzzle effects per firing class ----
function smokeRing(x,y,z,fx,fz,s){ const n=MOBILE?7:12, px=fz, pz=-fx;   // vortex ring: puffs set round the bore axis, blown outward and slowly forward
  for(let i=0;i<n;i++){ const t=i/n*6.283, c=Math.cos(t), sn=Math.sin(t), ox=px*c*0.35*s, oz=pz*c*0.35*s, oy=sn*0.35*s;
    spawnPart(x+ox+fx*0.6*s, y+oy, z+oz+fz*0.6*s, px*c*2.4*s+fx*3.2, sn*2.4*s+0.3, pz*c*2.4*s+fz*3.2, { color:0xb0aa9c, size:0.75*s, life:1.5+Math.random()*0.4, smoke:true, grav:0.25, drag:1.7, grow:1.0*s, op:0.38 }); } }
// Z168 the muzzle blast hits the ground: a ring of dust and grit thrown out under the barrel (bigger guns, bigger ring)
export function groundBlast(x, z, fx, fz, k){ const gy=heightAt(x,z), n=MOBILE?6:12, dc=BIOME.ground;
  for(let i=0;i<n;i++){ const t=i/n*6.283, c=Math.cos(t), s=Math.sin(t), f=0.6+0.4*Math.max(0, c*fx+s*fz);   // stronger ahead of the muzzle
    spawnPart(x+c*0.6, gy+0.25, z+s*0.6, c*7*k*f, 0.8+Math.random(), s*7*k*f, { color:dc, size:1.1*k, life:0.8+Math.random()*0.4, smoke:true, grav:-0.2, drag:2.6, grow:1.6, op:0.45 }); }
  for(let i=0;i<(MOBILE?3:6);i++){ const a=Math.atan2(fx,fz)+(Math.random()-0.5)*1.4, sp=6+Math.random()*7; spawnPart(x, gy+0.3, z, Math.sin(a)*sp, 3+Math.random()*3, Math.cos(a)*sp, { color:0x6a5a44, size:0.16, life:0.7, grav:-14, drag:0.6 }); }   // grit
  ringPulse({ x, z }, 0xfff0d0, 1.8*k); }
export function gunMuzzleFX(g, x, y, z, ang, rec){ const fx=Math.sin(ang), fz=Math.cos(ang), kind=g.flash||'auto';
  if(rec>=1.2 && (kind==='heavy'||kind==='rail'||kind==='launch')) groundBlast(x+fx*0.8, z+fz*0.8, fx, fz, Math.min(1.8, 0.6+rec*0.25));
  if(kind==='auto'){ muzzleFlash(x,z,ang,g.color,rec,y); return; }
  if(kind==='auto30'){   // Z231 the 30 mm: a hard white star, the three-port brake throws flame jets out both sides, a ring of gas, a hot amber glint
    muzzleFlash(x,z,ang,g.color,1.2,y); brakeBlast(x,y,z, ang, 0.75);   // Z419 (muzzleFlash only throws brake jets from rec 1.4 up: the 30 mm's own three-port brake, here)
    spawnPart(x+fx*0.3,y,z+fz*0.3, fx*3,0.2,fz*3, { color:0xd8d2c4, size:0.9, life:0.35, smoke:true, grav:0.2, drag:5, grow:2.4, op:0.28 });
    gunLight(x+fx,y+0.2,z+fz, 0xffb060, 4.2); return; }
  if(kind==='small'){   // MG / rotary — crisp and small; rate of fire does the talking
    gunFlash(x+fx*0.05,y,z+fz*0.05, ang, 1.0, 0.5, 0xfff0c8, 1);   // Z419 a shaped MG flash along the bore (was a star billboard + a flame blob)
    if(Math.random()<0.3) spawnPart(x+fx*0.6,y+0.05,z+fz*0.6, fx*2+0.32,0.5,fz*2+0.12, { color:0xa8a298, size:0.45, life:0.8, smoke:true, grav:0.3, drag:2.6, grow:1.0, op:0.2 });   // a wisp that drifts off on the wind
    gunLight(x+fx,y+0.2,z+fz, 0xffc87a, 2.2); return; }
  if(kind==='heavy'){ muzzleFlash(x,z,ang,g.color,rec,y);
    gunFlash(x,y,z, ang, 3.0+rec*0.35, 1.7+rec*0.2, 0xffffff, 1.2);   // Z419 the blinding first instant: a big shaped flash down the bore (was a round billboard)
    spawnPart(x+fx*1.4,y,z+fz*1.4, fx*9,0.4,fz*9, { tex:'fire', color:0xfff0c0, color2:0xff4a10, size:1.6, grow:1.8, life:0.16, grav:0.5, drag:6 });   // fireball rolling off the muzzle
    smokeRing(x,y,z,fx,fz,0.8+rec*0.15);
    muzzleLinger(x,y,z,fx,fz,0.8+rec*0.2);   // Z210 the cloud hangs in front of the gun
    gunLight(x+fx,y+0.3,z+fz, 0xffc070, 5+rec); return; }
  if(kind==='rail'){
    spawnPart(x+fx*0.3,y,z+fz*0.3, 0,0,0, { tex:'flash', color:0xe6d4ff, size:2.6, life:0.07, grav:0, drag:8 });
    ringPulse({x:x+fx*0.6, z:z+fz*0.6}, 0xc9a8ff, 1.6);
    for(let i=0;i<10;i++){ const a=ang+(Math.random()-0.5)*1.6, sp=8+Math.random()*12; spawnPart(x,y,z, Math.sin(a)*sp,(Math.random()-0.2)*5,Math.cos(a)*sp, { color:Math.random()<0.5?0xffffff:0xb895ff, size:0.22, life:0.18+Math.random()*0.15, grav:-6, drag:3 }); }   // arcing off the rails
    spawnPart(x+fx*0.5,y,z+fz*0.5, fx*1.5,0.6,fz*1.5, { color:0x9c8ab8, size:0.8, life:0.9, smoke:true, grav:0.4, drag:2, grow:1.2, op:0.22 });   // ionised haze
    muzzleLight.position.set(x+fx,y+0.3,z+fz); muzzleLight.color.setHex(0xb88cff); muzzleLight.intensity=Math.max(muzzleLight.intensity,6); return; }
  if(kind==='arc'){
    spawnPart(x,y,z, 0,0,0, { tex:'flash', color:0xcfe8ff, size:1.8, life:0.05, grav:0, drag:8 });
    for(let i=0;i<5;i++){ const a=Math.random()*6.283, sp=5+Math.random()*7; spawnPart(x,y,z, Math.cos(a)*sp,(Math.random()-0.3)*6,Math.sin(a)*sp, { color:0xbfe8ff, size:0.24, life:0.12+Math.random()*0.1, grav:0, drag:4 }); }
    muzzleLight.position.set(x+fx,y+0.3,z+fz); muzzleLight.color.setHex(0x7fb8ff); muzzleLight.intensity=Math.max(muzzleLight.intensity,4.2); return; }
  if(kind==='frost'){
    spawnPart(x+fx*0.3,y,z+fz*0.3, fx*4,0,fz*4, { tex:'flash', color:0xe8fbff, size:1.2, life:0.05, grav:0, drag:8 });
    for(let i=0;i<(MOBILE?2:4);i++){ const a=ang+(Math.random()-0.5)*0.5, sp=4+Math.random()*4;   // LN2 boiling off into a white plume that sinks (cold air is heavy)
      spawnPart(x+fx*0.5,y,z+fz*0.5, Math.sin(a)*sp,0.2,Math.cos(a)*sp, { color:0xeaf8ff, size:0.6, life:0.9+Math.random()*0.4, smoke:true, grav:-0.6, drag:2.4, grow:1.6, op:0.32 }); }
    for(let i=0;i<4;i++){ const a=ang+(Math.random()-0.5)*0.8, sp=6+Math.random()*6; spawnPart(x,y,z, Math.sin(a)*sp,Math.random()*2,Math.cos(a)*sp, { color:0xcff4ff, size:0.16, life:0.35, grav:-3, drag:2 }); }   // ice glitter
    return; }
  if(kind==='launch'){
    gunFlash(x,y,z, ang, 1.4, 0.9, 0xfff0d8, 1);   // Z419 shaped
    const L=2.3, bx=x-fx*L, bz=z-fz*L;   // the open rear of the tube
    for(let i=0;i<(MOBILE?3:6);i++){ const a=ang+Math.PI+(Math.random()-0.5)*0.5, sp=12+Math.random()*10;
      spawnPart(bx,y,bz, Math.sin(a)*sp,0.3+Math.random(),Math.cos(a)*sp, { tex:'fire', color:0xfff0c0, color2:0xff4a10, size:0.9, grow:1.4, life:0.16+Math.random()*0.08, grav:0, drag:7 }); }   // flame out the back
    for(let i=0;i<(MOBILE?3:7);i++){ const a=ang+Math.PI+(Math.random()-0.5)*0.9, sp=4+Math.random()*6;
      spawnPart(bx,y,bz, Math.sin(a)*sp,0.4+Math.random()*0.8,Math.cos(a)*sp, { color:0xd8d0c0, size:1.4, life:1.4+Math.random()*0.6, smoke:true, grav:0.3, drag:1.6, grow:2.0, op:0.55 }); }   // backblast cloud
    const gy=heightAt(bx-fx*3, bz-fz*3)+0.3;
    for(let i=0;i<(MOBILE?3:6);i++){ const a=ang+Math.PI+(Math.random()-0.5)*1.4, sp=5+Math.random()*5;
      spawnPart(bx-fx*3,gy,bz-fz*3, Math.sin(a)*sp,0.6,Math.cos(a)*sp, { color:BIOME.ground, size:1.1, life:0.9, smoke:true, grav:-0.1, drag:2.6, grow:1.4, op:0.4 }); }   // ground dust behind the tank
    muzzleLight.position.set(bx,y+0.3,bz); muzzleLight.color.setHex(0xffb060); muzzleLight.intensity=Math.max(muzzleLight.intensity,4.5); return; }
  muzzleFlash(x,z,ang,g.color,rec,y);
}
// a KINETIC round glancing off thick armour: a bright tracer that skips away + a spray of sparks (tells you the gun is wrong for it)
export function ricochet(x, y, z, vx, vz){ const L=Math.hypot(vx,vz)||1, a=Math.atan2(vx/L, vz/L)+(Math.random()<0.5?1:-1)*(0.7+Math.random()*0.8), sp=26+Math.random()*14;
  spawnPart(x,y,z, Math.sin(a)*sp, 3+Math.random()*5, Math.cos(a)*sp, { color:0xfff0c8, size:0.42, life:0.22, grav:-10, drag:0.6 });
  for(let i=0;i<5;i++){ const b=a+(Math.random()-0.5)*1.2, s=6+Math.random()*10; spawnPart(x,y,z, Math.sin(b)*s, 1+Math.random()*4, Math.cos(b)*s, { color:0xffd890, size:0.14, life:0.25+Math.random()*0.15, grav:-18, drag:1.5 }); } }
// where a straight-line weapon (tesla / railgun) actually connects: the first enemy close to the line of fire, else the end of its reach
export function strikePoint(list, x, z, ang, maxD, cone, out){ const fx=Math.sin(ang), fz=Math.cos(ang); let best=null, bd=maxD;
  for(const e of list){ if(!e || e.abandoned || (e.alive===false)) continue; const dx=e.pos.x-x, dz=e.pos.z-z, along=dx*fx+dz*fz; if(along<0.5 || along>bd) continue;
    const off=Math.abs(dx*fz-dz*fx); if(off < (e.r||1)*1.4+along*cone){ best=e; bd=along; } }
  if(best){ out.set(best.pos.x, heightAt(best.pos.x,best.pos.z)+1.3, best.pos.z); return best; }
  out.set(x+fx*maxD, heightAt(x+fx*maxD, z+fz*maxD)+1.0, z+fz*maxD); return null; }

// ---- Z419 SHAPED MUZZLE FLASH: two crossed petal planes along the bore + a face-on star, additive, from one atlas; pooled instances, one draw call ----
const FLN = MOBILE ? GUNFX.flash.poolMob : GUNFX.flash.pool, FL = [], _fc = new THREE.Color();
function flashAtlas(){ const c=document.createElement('canvas'); c.width=256; c.height=128; const x=c.getContext('2d'), lin=(x0,x1,a)=>{ const g=x.createLinearGradient(x0,0,x1,0); g.addColorStop(0,'rgba(255,255,255,'+a+')'); g.addColorStop(1,'rgba(255,255,255,0)'); return g; };
  // left: the flash seen side-on — a hot core at the bore, a tapering cone of ragged petals out along it, short spikes thrown off to the sides
  for(let i=0;i<7;i++){ const L=60+Math.random()*64, off=(Math.random()-0.5)*16, w=6+Math.random()*9; x.fillStyle=lin(0,L,0.85); x.beginPath(); x.moveTo(2,64-w); x.quadraticCurveTo(L*0.45,64+off*0.5-w*0.9,L,64+off); x.quadraticCurveTo(L*0.45,64+off*0.5+w*0.9,2,64+w); x.closePath(); x.fill(); }
  for(let i=0;i<5;i++){ const a=(Math.random()<0.5?-1:1)*(0.45+Math.random()*0.7), L=22+Math.random()*26, bx=8+Math.random()*16; x.save(); x.translate(bx,64); x.rotate(a); x.fillStyle=lin(0,L,0.7); x.beginPath(); x.moveTo(0,-3); x.lineTo(L,0); x.lineTo(0,3); x.closePath(); x.fill(); x.restore(); }
  let g=x.createRadialGradient(16,64,0,16,64,26); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.5,'rgba(255,255,255,0.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,30,60,68);
  // right: the flash seen down the bore — a hot core and 5–6 thin, sharp, uneven spikes
  x.save(); x.translate(192,64); const n=5+(Math.random()<0.5?1:0);
  for(let i=0;i<n;i++){ const a=i/n*6.283+(Math.random()-0.5)*0.5, L=34+Math.random()*26, w=2.5+Math.random()*2.5; x.save(); x.rotate(a); x.fillStyle=lin(0,L,0.95); x.beginPath(); x.moveTo(0,-w); x.lineTo(L,0); x.lineTo(0,w); x.closePath(); x.fill(); x.restore(); }
  g=x.createRadialGradient(0,0,0,0,0,24); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.45,'rgba(255,255,255,0.5)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(0,0,24,0,7); x.fill(); x.restore();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
const _fl = (()=>{ const S2=0.75, z0=0.02, P=[0,-.5,0, 0,.5,0, 0,.5,1, 0,-.5,1,  -.5,0,0, .5,0,0, .5,0,1, -.5,0,1,  -S2,-S2,z0, S2,-S2,z0, S2,S2,z0, -S2,S2,z0],
    U=[0,0, 0,1, .5,1, .5,0,  0,0, 0,1, .5,1, .5,0,  .5,0, 1,0, 1,1, .5,1], I=[]; for(let q=0;q<3;q++){ const a=q*4; I.push(a,a+1,a+2, a,a+2,a+3); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P,3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U,2)); geo.setIndex(I);
  const m=new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map:flashAtlas(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false }), FLN);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _fc.setRGB(1,1,1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.count=0; m.frustumCulled=false; m.renderOrder=8; scene.add(m);
  for(let i=0;i<FLN;i++) FL.push({ on:false, life:0, max:1, fr:0, k:1, col:0xffffff, m:new THREE.Matrix4() }); return m; })();
const _q=new THREE.Quaternion(), _q2=new THREE.Quaternion(), _e=new THREE.Euler(), _p=new THREE.Vector3(), _sc=new THREE.Vector3(), _Zax=new THREE.Vector3(0,0,1);
// a flash at the muzzle (x,y,z) pointing along yaw ang (pitch up by pit): len m along the bore, wid m across, col tint, k brightness — 1–2 rendered frames
export function gunFlash(x, y, z, ang, len, wid, col=0xfff0d0, k=1, pit=0){ let f=null, old=null;
  for(const r of FL){ if(!r.on){ f=r; break; } if(!old || r.life<old.life) old=r; } f=f||old;
  const j=0.8+Math.random()*0.4; _e.set(-pit, ang, 0, 'YXZ'); _q.setFromEuler(_e); _q2.setFromAxisAngle(_Zax, Math.random()*6.283); _q.multiply(_q2);   // a random roll about the bore: never the same flash twice
  f.m.compose(_p.set(x,y,z), _q, _sc.set(wid*j, wid*j, len*(0.75+Math.random()*0.5))); f.on=true; f.fr=0; f.life=f.max=GUNFX.flash.life; f.k=k*GUNFX.flash.hot; f.col=col; }
// a gun's light is a strobe: it snaps up for the shot and dies in a few frames (an explosion keeps the slow fade in game/loop.js)
export function gunLight(x, y, z, col, I){ muzzleLight.position.set(x,y,z); muzzleLight.color.setHex(col); if(I>=muzzleLight.intensity){ muzzleLight.intensity=I; muzzleLight.userData.fast=true; } }
// the muzzle brake: gas and flame thrown out of the side ports (sd = ±1 sides), the smoke rolling away sideways
export function brakeBlast(x, y, z, ang, k){ const fx=Math.sin(ang), fz=Math.cos(ang);
  for(let sd=-1;sd<=1;sd+=2){ const a=ang+sd*Math.PI/2; gunFlash(x-fx*0.12*k, y, z-fz*0.12*k, a, 1.1*k, 0.75*k, 0xffe2a8, 0.8);
    for(let i=0;i<(MOBILE?1:2);i++) spawnPart(x+Math.sin(a)*0.5*k, y, z+Math.cos(a)*0.5*k, Math.sin(a)*(5+i*3)*k+fx*0.8, 0.35+Math.random()*0.3, Math.cos(a)*(5+i*3)*k+fz*0.8,
      { color:0xcdc6b8, size:(0.7+i*0.3)*k, life:1.3+Math.random()*0.6, smoke:true, grav:0.25, drag:2.0, grow:1.7*k, op:0.6, keep:true }); } }

// ---- Z419 SPENT BRASS: real little cases that spin out of the port, bounce once or twice on the ground, roll and vanish; pooled, one draw call ----
const BRN = MOBILE ? GUNFX.brass.poolMob : GUNFX.brass.pool, BR = []; let _bi = 0;
const _br = (()=>{ const V2=THREE.Vector2, geo=new THREE.LatheGeometry([new V2(0,-0.5), new V2(0.5,-0.5), new V2(0.46,-0.44), new V2(0.5,-0.4), new V2(0.48,0.18), new V2(0.34,0.3), new V2(0.33,0.5), new V2(0.28,0.5)], 7);   // a bottle-necked case: rim, extractor groove, body, shoulder, neck
  const m=new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color:0xffffff, metalness:0.35, roughness:0.42, side:THREE.DoubleSide }), BRN);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _fc.setHex(0xe0b450)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.count=0; m.frustumCulled=false; m.castShadow=false; m.receiveShadow=false; scene.add(m);
  for(let i=0;i<BRN;i++) BR.push({ on:false, x:0, y:0, z:0, vx:0, vy:0, vz:0, rx:0, ry:0, rz:0, sx:0, sy:0, sz:0, L:0.1, d:0.04, life:0, col:0xc99a3c }); return m; })();
// one case out of the port at (x,y,z), thrown (vx,vy,vz); kind = rifle | mg | auto | shell | link (a belt link: dark steel) — only near the player (REAL.brass.R)
export function ejectBrass(x, y, z, vx, vy, vz, kind='rifle'){ const p=S.player; if(!p || (p.pos.x-x)**2+(p.pos.z-z)**2 > REAL.brass.R*REAL.brass.R) return;
  const b=BR[_bi]; _bi=(_bi+1)%BRN; const C=GUNFX.case[kind==='link'?'rifle':kind]||GUNFX.case.rifle;   // oldest recycled
  b.on=true; b.x=x; b.y=y; b.z=z; b.vx=vx; b.vy=vy; b.vz=vz; b.rx=Math.random()*6.283; b.ry=Math.random()*6.283; b.rz=0; b.sx=(Math.random()-0.5)*30; b.sy=(Math.random()-0.5)*10; b.sz=(Math.random()-0.5)*24;
  b.L=kind==='link'?C[1]*1.4:C[0]; b.d=kind==='link'?C[1]*0.5:C[1]; b.chip=false; b.col=kind==='link'?0x34332e:(kind==='shell'?0xe0b050:0xffd060); b.life=GUNFX.brass.life*(0.85+Math.random()*0.3)*(kind==='shell'?1.6:1); }
// a solid fragment thrown off a strike (a clod, a stone chip, a splinter): the same pool and tumble as the brass, its own colour and size, short-lived
function chip(x, y, z, vx, vy, vz, col, L, d){ const p=S.player; if(!p || (p.pos.x-x)**2+(p.pos.z-z)**2 > REAL.brass.R*REAL.brass.R) return;
  const b=BR[_bi]; _bi=(_bi+1)%BRN; b.on=true; b.chip=true; b.x=x; b.y=y; b.z=z; b.vx=vx; b.vy=vy; b.vz=vz; b.rx=Math.random()*6.283; b.ry=Math.random()*6.283; b.rz=Math.random()*6.283;
  b.sx=(Math.random()-0.5)*26; b.sy=(Math.random()-0.5)*20; b.sz=(Math.random()-0.5)*26; b.L=L; b.d=d; b.col=col; b.life=0.55+Math.random()*0.35; }
function updateBrass(dt){ let n=0; const G=GUNFX.brass;
  for(const b of BR){ if(!b.on) continue; b.life-=dt; if(b.life<=0){ b.on=false; continue; }
    b.vy+=G.grav*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt; b.rx+=b.sx*dt; b.ry+=b.sy*dt; b.rz+=b.sz*dt;
    const gy=heightAt(b.x,b.z)+b.d*0.5; if(b.y<gy){ b.y=gy; if(b.vy<-1.6){ b.vy=-b.vy*G.bounce; b.vx*=0.5; b.vz*=0.5; b.sx*=0.5; b.sz*=0.5; } else { b.vy=0; b.vx*=0.86; b.vz*=0.86; b.sx*=0.8; b.sy*=0.9; if(!b.chip){ b.sz=0; b.rz+=(Math.PI/2-b.rz)*Math.min(1,dt*10); } } }   // first hit bounces, then it lies down and rolls
    const s=Math.min(1, b.life/0.22); _e.set(b.rx, b.ry, b.rz); _q.setFromEuler(_e); _p.set(b.x,b.y,b.z); _sc.set(b.d*s, b.L*s, b.d*s); _M.compose(_p, _q, _sc); _br.setMatrixAt(n, _M); _br.setColorAt(n, _fc.setHex(b.col)); n++; }
  _br.count=n; if(n){ _br.instanceMatrix.needsUpdate=true; _br.instanceColor.needsUpdate=true; } }
const _M=new THREE.Matrix4();

// ---- Z419 A BULLET STRIKES: what it hit is thrown up — mat = dirt | sand | stone | metal | wood | water; (ox,oz) = the way the debris flies (back
//   toward the shooter; 0,0 = straight up off the ground); k = the round's weight (1 rifle, ~1.3 heavy MG / autocannon). Small, quick, cheap.
export function hitMat(bl, stone){ const M=GUNFX.mat, k=bl&&bl.kind; if(M.sand.includes(k)) return 'sand'; if(M.metal.includes(k)) return 'metal'; if(M.wood.includes(k)) return 'wood'; return (stone || M.stone.includes(k) || (bl && (bl.steel || bl.heavy || bl.fort))) ? 'stone' : 'dirt'; }
const _dk=new THREE.Color(), _dc=new THREE.Color(), _fv={ x:0, z:0 };
function fly(up, ox, oz, sp){ const a=Math.random()*6.283, s=Math.random()*1.4; _fv.x=(up?0:ox*sp)+Math.cos(a)*s; _fv.z=(up?0:oz*sp)+Math.sin(a)*s; }   // a fragment's way out: back along (ox,oz) with a scatter, or any way up off flat ground
export function bulletImpact(mat, x, y, z, ox, oz, k=1){ const H=GUNFX.hit, n=Math.max(2, Math.round((MOBILE?H.chipsMob:H.chips)*Math.min(1.6,k))), up=(ox===0 && oz===0);
  if(mat==='water'){ const wy=RIVER.on ? RIVER.y+0.05 : y;   // a slim white column that falls back, a ring of spray
    for(let i=0;i<H.splash;i++){ fly(true, ox, oz, 0); spawnPart(x, wy, z, _fv.x*0.7, 4+Math.random()*3*k, _fv.z*0.7, { color:0xeef4f6, size:(0.14+Math.random()*0.1)*k, life:0.55, smoke:true, grav:-16, drag:0.5, op:2, keep:true }); }
    spawnPart(x, wy+0.1, z, 0, 0.6, 0, { color:0xe8f0f3, size:0.55*k, life:0.6, smoke:true, grav:-0.6, drag:3, grow:1.0*k, op:1.6, keep:true }); return; }
  if(mat==='metal'){   // a white-hot spark-star and a fan of sparks off the plate, a breath of grey
    spawnPart(x, y, z, 0, 0, 0, { tex:'flash', color:0xfff6e4, size:0.5*k, life:0.035, grav:0, drag:0 });
    for(let i=0;i<n;i++){ fly(up, ox, oz, 5+Math.random()*7); spawnPart(x, y, z, _fv.x, 1+Math.random()*4, _fv.z, { color:i%2?0xfff0c8:0xffc870, size:0.07+Math.random()*0.04, life:0.14+Math.random()*0.16, grav:-14, drag:1.2 }); }
    spawnPart(x, y, z, ox*0.6, 0.6, oz*0.6, { color:0x9a968e, size:0.35*k, life:0.6, smoke:true, grav:0.3, drag:2.4, grow:0.7*k, op:0.9, keep:true }); return; }
  const dust = mat==='stone' ? 0xb9b2a4 : mat==='wood' ? 0xa08a6a : mat==='sand' ? 0xcdb68a : BIOME.ground, w=mat==='wood',
    col = mat==='stone' ? 0x77726a : w ? 0xcfae78 : _dc.setHex(dust).lerp(_dk.setHex(0x241c12), 0.5).getHex();   // dark clods · grey chips · pale splinters
  for(let i=0;i<n;i++){ fly(up, ox, oz, 2.5+Math.random()*3); const s=(0.05+Math.random()*0.05)*Math.min(1.5,k);
    chip(x, y, z, _fv.x, (up?3.5:1.5)+Math.random()*(up?3.5:3)*k, _fv.z, col, w ? s*2.6 : s, w ? s*0.45 : s*0.9); }
  if(mat==='stone' && Math.random()<0.6) spawnPart(x, y, z, ox*6+(Math.random()-0.5)*4, 1+Math.random()*3, oz*6+(Math.random()-0.5)*4, { color:0xffe2b0, size:0.07, life:0.12, grav:-12, drag:1.5 });   // stone strikes a spark
  const D=H.dust*k*(mat==='sand'?1.35:1);   // the puff of what it was: soil, sand, grey stone dust, wood dust
  for(let i=0;i<2;i++) spawnPart(x+ox*0.2*(i+1), y+0.05, z+oz*0.2*(i+1), ox*(1.4-i*0.5)+(Math.random()-0.5)*0.6, (up?1.6:0.9)+i*0.4, oz*(1.4-i*0.5)+(Math.random()-0.5)*0.6, { color:dust, size:D*(1-i*0.2), life:0.75+Math.random()*0.35, smoke:true, grav:0.05, drag:2.6, grow:D*1.5, op:w?1.4:1.9, keep:true });   // two puffs: one alone is too thin to read
  if(up) spawnPart(x, y+0.1, z, 0, 3.2+Math.random()*1.5, 0, { color:dust, size:D*0.5, life:0.5, smoke:true, grav:-7, drag:1.2, grow:D*0.6, op:1.9, keep:true }); }   // the spurt standing up off the ground

// per frame: flashes (fade over their 1–2 frames, packed into the instance list), brass, the muzzle light's strobe
export function updateGunFX(dt){ let n=0;
  for(const f of FL){ if(!f.on) continue; f.life-=dt; if(dt>0 && f.fr++>=1 && f.life<=0){ f.on=false; continue; }   // (a frame that stands still — dt 0 — does not use the flash up)
    _fl.setMatrixAt(n, f.m); _fl.setColorAt(n, _fc.setHex(f.col).multiplyScalar(f.k*Math.max(0.4, f.life/f.max))); n++; }
  _fl.count=n; if(n){ _fl.instanceMatrix.needsUpdate=true; _fl.instanceColor.needsUpdate=true; }
  updateBrass(dt);
  const L=muzzleLight; if(L.userData.fast){ L.intensity=Math.max(0, L.intensity-dt*GUNFX.light.decay); if(L.intensity<=0) L.userData.fast=false; } }
