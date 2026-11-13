// fx/gunfx.js — Z149 GUN EFFECTS that read like the real weapon, per firing class (GUNS[id].flash):
//   small  — rifle-calibre MGs / rotary: a tight, quick star flash, a breath of haze, no cannon smoke
//   auto   — autocannons (rifle, flak): the standard flash + propellant sparks
//   heavy  — big-bore guns (cannon, HESH, canister): blinding flash, brake jets, an expanding SMOKE RING (vortex) that drifts off the muzzle, dust kicked off the ground
//   rail   — railgun: no powder at all — a violet plasma burst and a straight BEAM that hangs in the air with a helix of sparks along it
//   arc    — tesla: a forked LIGHTNING bolt from the electrode to whatever it strikes (and between the enemies it chains through)
//   frost  — cryo: a cold white vapour plume and glittering ice dust instead of fire
//   launch — missile / thermobaric tubes: a small front flash and a hard BACKBLAST out of the rear of the tube that rolls dust behind the tank
// The bolts / beams are a small pool of camera-facing ribbons (no allocation per shot); everything else rides the instanced particle layers.
import * as THREE from 'three';
import { BIOME, MOBILE, camera, heightAt, muzzleFlash, muzzleLight, ringPulse, scene, spawnPart } from '../hub.js';

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
const _a=new THREE.Vector3(), _b=new THREE.Vector3();
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
  if(kind==='small'){   // MG / rotary — crisp and small; rate of fire does the talking
    spawnPart(x+fx*0.25,y,z+fz*0.25, fx*3,0,fz*3, { tex:'flash', color:0xfff2d0, size:0.95+Math.random()*0.35, life:0.04, grav:0, drag:8 });
    spawnPart(x+fx*0.4,y,z+fz*0.4, fx*12,0.1,fz*12, { tex:'fire', color:0xfff0c0, color2:0xff7a20, size:0.55, grow:0.5, life:0.06, grav:0, drag:12 });
    if(Math.random()<0.25) spawnPart(x+fx*0.6,y+0.05,z+fz*0.6, fx*2,0.5,fz*2, { color:0x9a948a, size:0.5, life:0.6, smoke:true, grav:0.3, drag:2.6, grow:0.8, op:0.18 });
    muzzleLight.position.set(x+fx,y+0.2,z+fz); muzzleLight.color.setHex(0xffc87a); muzzleLight.intensity=Math.max(muzzleLight.intensity,2.2); return; }
  if(kind==='heavy'){ muzzleFlash(x,z,ang,g.color,rec,y);
    spawnPart(x+fx*0.9,y,z+fz*0.9, fx*6,0,fz*6, { tex:'flash', color:0xffffff, size:3.2+rec*0.4, life:0.05, grav:0, drag:9 });   // the blinding first instant
    spawnPart(x+fx*1.4,y,z+fz*1.4, fx*9,0.4,fz*9, { tex:'fire', color:0xfff0c0, color2:0xff4a10, size:1.6, grow:1.8, life:0.16, grav:0.5, drag:6 });   // fireball rolling off the muzzle
    smokeRing(x,y,z,fx,fz,0.8+rec*0.15);
    muzzleLight.intensity=Math.max(muzzleLight.intensity, 5+rec); return; }
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
    spawnPart(x+fx*0.4,y,z+fz*0.4, fx*5,0,fz*5, { tex:'flash', color:0xfff0d8, size:1.6, life:0.05, grav:0, drag:8 });
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
