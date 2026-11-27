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
import { GUNFX, REAL, SHOTFX } from '../../config.js';
import { BIOME, MOBILE, NIGHT, RIVER, S, WX, afxBrass, afxImpact, afxOn, bullets, camera, heightAt, muzzleLight, renderer, scene, spawnPart } from '../hub.js';

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
export function updateBolts(dt){ for(const r of RIB){ if(!r.on) continue; r.life-=dt;
    if(r.life<=0){ r.on=false; r.m.visible=false; continue; }
    const k=r.life/r.max; r.m.material.opacity=k*k*(r.jag>0 ? 0.75+Math.random()*0.25 : 1); r.w*= r.jag>0 ? 1 : (1-dt*1.5);
    if(r.jag>0){ r.reT-=dt; if(r.reT<=0){ r.reT=0.035; jagged(r); } } else layout(r); } }

// ---- muzzle effects per firing class ----
// Z168 the muzzle blast hits the ground: a ring of dust and grit thrown out under the barrel (bigger guns, bigger ring)
// where a straight-line weapon (tesla / railgun) actually connects: the first enemy close to the line of fire, else the end of its reach

// ---- Z419 SHAPED MUZZLE FLASH: two crossed petal planes along the bore + a face-on star, additive, from one atlas; pooled instances, one draw call ----
//   GUNFX 1 the atlas has a row per firing class (SHOTFX.cls[..].row): 0 rifle — tight petals, side-port jets, a 5–6 spike star · 1 MG — a fat blossom, a
//   four-prong star in a round glow · 2 suppressed / SMG — a short dim cone, a small soft disc · 3 cannon — a ball of fire in a cone, a big eight-spike star
const FLN = MOBILE ? GUNFX.flash.poolMob : GUNFX.flash.pool, FL = [], _fc = new THREE.Color();
function flashRow(x, oy, st){ const R=Math.random, lin=(x0,x1,a)=>{ const g=x.createLinearGradient(x0,0,x1,0); g.addColorStop(0,'rgba(255,255,255,'+a+')'); g.addColorStop(1,'rgba(255,255,255,0)'); return g; },
    rad=(cx,cy,r,a,m)=>{ const g=x.createRadialGradient(cx,cy,0,cx,cy,r); g.addColorStop(0,'rgba(255,255,255,'+a+')'); g.addColorStop(m,'rgba(255,255,255,'+(a*0.5)+')'); g.addColorStop(1,'rgba(255,255,255,0)'); return g; };
  x.save(); x.beginPath(); x.rect(0,oy,256,128); x.clip(); const cy=oy+64;
  // left: the flash seen side-on — a hot core at the bore, petals out along it
  const nP = st===2 ? 3 : st===1 ? 8 : st===3 ? 9 : 7, Lm = st===2 ? [26,18] : st===1 ? [52,58] : st===3 ? [70,52] : [60,64], Wm = st===2 ? [3,3] : st===1 ? [11,12] : st===3 ? [14,14] : [6,9];
  for(let i=0;i<nP;i++){ const L=Lm[0]+R()*Lm[1], off=(R()-0.5)*(st===1?26:16), w=Wm[0]+R()*Wm[1]; x.fillStyle=lin(0,L,st===2?0.45:0.85); x.beginPath(); x.moveTo(2,cy-w); x.quadraticCurveTo(L*0.45,cy+off*0.5-w*(st===1?1.3:0.9),L,cy+off); x.quadraticCurveTo(L*0.45,cy+off*0.5+w*(st===1?1.3:0.9),2,cy+w); x.closePath(); x.fill(); }
  if(st===0) for(let i=0;i<5;i++){ const a=(R()<0.5?-1:1)*(0.45+R()*0.7), L=22+R()*26, bx=8+R()*16; x.save(); x.translate(bx,cy); x.rotate(a); x.fillStyle=lin(0,L,0.7); x.beginPath(); x.moveTo(0,-3); x.lineTo(L,0); x.lineTo(0,3); x.closePath(); x.fill(); x.restore(); }   // the side-port jets
  if(st===1){ x.fillStyle=rad(30,cy,26,0.55,0.4); x.fillRect(0,cy-30,64,60); }   // the MG's blossom: a round ball just out of the flash hider
  if(st===3){ x.fillStyle=rad(44,cy,44,0.6,0.45); x.fillRect(0,cy-48,96,96); }   // the cannon's fireball
  x.fillStyle=rad(st===2?10:16,cy,st===2?16:26,st===2?0.8:1,0.5); x.fillRect(0,cy-34,60,68);
  // right: the flash seen down the bore — a hot core and thin, sharp, uneven spikes (a four-prong cross for the MG's slotted hider, none to speak of suppressed)
  x.translate(192,cy); const n = st===1 ? 4 : st===3 ? 8 : st===2 ? 0 : 5+(R()<0.5?1:0), a0=R()*6.283;
  for(let i=0;i<n;i++){ const a=a0+i/n*6.283+(R()-0.5)*(st===1?0.15:0.5), L=(st===3?40:34)+R()*(st===1?20:26), w=(st===1?3.5:2.5)+R()*2.5; x.save(); x.rotate(a); x.fillStyle=lin(0,L,0.95); x.beginPath(); x.moveTo(0,-w); x.lineTo(L,0); x.lineTo(0,w); x.closePath(); x.fill(); x.restore(); }
  const rr = st===2 ? 14 : st===1 ? 34 : st===3 ? 46 : 24; x.fillStyle=rad(0,0,rr,st===2?0.7:1,st===1?0.55:0.45); x.beginPath(); x.arc(0,0,rr,0,7); x.fill(); x.restore(); }
function flashAtlas(){ const c=document.createElement('canvas'); c.width=256; c.height=512; const x=c.getContext('2d'); for(let r=0;r<4;r++) flashRow(x, r*128, r);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
const _fl = (()=>{ const S2=0.75, z0=0.02, P=[0,-.5,0, 0,.5,0, 0,.5,1, 0,-.5,1,  -.5,0,0, .5,0,0, .5,0,1, -.5,0,1,  -S2,-S2,z0, S2,-S2,z0, S2,S2,z0, -S2,S2,z0],
    U=[0,0, 0,1, .5,1, .5,0,  0,0, 0,1, .5,1, .5,0,  .5,0, 1,0, 1,1, .5,1], I=[]; for(let q=0;q<3;q++){ const a=q*4; I.push(a,a+1,a+2, a,a+2,a+3); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P,3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U,2)); geo.setIndex(I);
  geo.setAttribute('aRow', new THREE.InstancedBufferAttribute(new Float32Array(FLN),1).setUsage(THREE.DynamicDrawUsage));
  const mat=new THREE.MeshBasicMaterial({ map:flashAtlas(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false });
  mat.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aRow; varying float vFace;').replace('#include <uv_vertex>','#include <uv_vertex>\n  vMapUv.y = (vMapUv.y + 3.0 - aRow) * 0.25;\n'
      +'  { vec3 bw = normalize((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz), wp = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz; float cf = abs(dot(bw, normalize(cameraPosition - wp)));\n'
      +'    vFace = uv.x > 0.5 ? smoothstep(0.35, 0.75, cf) : 1.0 - smoothstep(0.8, 0.98, cf); }');   // GUNFX 1 a quad seen edge-on fades out: no hard line through the flash (the star side-on, the petals head-on)
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFace;').replace('#include <map_fragment>','#include <map_fragment>\n  diffuseColor.a *= vFace;'); };   // its class's row of the atlas
  const m=new THREE.InstancedMesh(geo, mat, FLN);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _fc.setRGB(1,1,1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.count=0; m.frustumCulled=false; m.renderOrder=8; scene.add(m);
  for(let i=0;i<FLN;i++) FL.push({ on:false, life:0, max:1, fr:0, k:1, col:0xffffff, row:0, m:new THREE.Matrix4() }); return m; })();
const _q=new THREE.Quaternion(), _q2=new THREE.Quaternion(), _e=new THREE.Euler(), _p=new THREE.Vector3(), _sc=new THREE.Vector3(), _Zax=new THREE.Vector3(0,0,1);
// a flash at the muzzle (x,y,z) pointing along yaw ang (pitch up by pit): len m along the bore, wid m across, col tint, k brightness, row the atlas row — 1–2 rendered frames
export function gunFlash(x, y, z, ang, len, wid, col=0xfff0d0, k=1, pit=0, row=0){ let f=null, old=null;
  for(const r of FL){ if(!r.on){ f=r; break; } if(!old || r.life<old.life) old=r; } f=f||old;
  const j=0.8+Math.random()*0.4; _e.set(-pit, ang, 0, 'YXZ'); _q.setFromEuler(_e); _q2.setFromAxisAngle(_Zax, Math.random()*6.283); _q.multiply(_q2);   // a random roll about the bore: never the same flash twice
  f.m.compose(_p.set(x,y,z), _q, _sc.set(wid*j, wid*j, len*(0.75+Math.random()*0.5))); f.on=true; f.fr=0; f.life=f.max=GUNFX.flash.life; f.k=k*GUNFX.flash.hot; f.col=col; f.row=row; }
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
  b.L=kind==='link'?C[1]*1.4:C[0]; b.d=kind==='link'?C[1]*0.5:C[1]; b.chip=false; b.rang=false; b.col=kind==='link'?0x34332e:(kind==='shell'?0xe0b050:0xffd060); b.life=GUNFX.brass.life*(0.85+Math.random()*0.3)*(kind==='shell'?1.6:1); }
// a solid fragment thrown off a strike (a clod, a stone chip, a splinter): the same pool and tumble as the brass, its own colour and size, short-lived
function chip(x, y, z, vx, vy, vz, col, L, d){ const p=S.player; if(!p || (p.pos.x-x)**2+(p.pos.z-z)**2 > REAL.brass.R*REAL.brass.R) return;
  const b=BR[_bi]; _bi=(_bi+1)%BRN; b.on=true; b.chip=true; b.x=x; b.y=y; b.z=z; b.vx=vx; b.vy=vy; b.vz=vz; b.rx=Math.random()*6.283; b.ry=Math.random()*6.283; b.rz=Math.random()*6.283;
  b.sx=(Math.random()-0.5)*26; b.sy=(Math.random()-0.5)*20; b.sz=(Math.random()-0.5)*26; b.L=L; b.d=d; b.col=col; b.life=0.55+Math.random()*0.35; }
function updateBrass(dt){ let n=0; const G=GUNFX.brass;
  for(const b of BR){ if(!b.on) continue; b.life-=dt; if(b.life<=0){ b.on=false; continue; }
    b.vy+=G.grav*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt; b.rx+=b.sx*dt; b.ry+=b.sy*dt; b.rz+=b.sz*dt;
    const gy=heightAt(b.x,b.z)+b.d*0.5; if(b.y<gy){ b.y=gy; if(b.vy<-1.6){ if(!b.chip && !b.rang && afxOn()){ b.rang=true; afxBrass(b.x, b.z); } b.vy=-b.vy*G.bounce; b.vx*=0.5; b.vz*=0.5; b.sx*=0.5; b.sz*=0.5; } else { b.vy=0; b.vx*=0.86; b.vz*=0.86; b.sx*=0.8; b.sy*=0.9; if(!b.chip){ b.sz=0; b.rz+=(Math.PI/2-b.rz)*Math.min(1,dt*10); } } }   // first hit bounces, then it lies down and rolls
    const s=Math.min(1, b.life/0.22); _e.set(b.rx, b.ry, b.rz); _q.setFromEuler(_e); _p.set(b.x,b.y,b.z); _sc.set(b.d*s, b.L*s, b.d*s); _M.compose(_p, _q, _sc); _br.setMatrixAt(n, _M); _br.setColorAt(n, _fc.setHex(b.col)); n++; }
  _br.count=n; if(n){ _br.instanceMatrix.needsUpdate=true; _br.instanceColor.needsUpdate=true; } }
const _M=new THREE.Matrix4();

// ---- Z419 A BULLET STRIKES: what it hit is thrown up — mat = dirt | sand | stone | metal | wood | water; (ox,oz) = the way the debris flies (back
//   toward the shooter; 0,0 = straight up off the ground); k = the round's weight (1 rifle, ~1.3 heavy MG / autocannon). Small, quick, cheap.
export function hitMat(bl, stone){ const M=GUNFX.mat, k=bl&&bl.kind; if(M.sand.includes(k)) return 'sand'; if(M.metal.includes(k)) return 'metal'; if(M.wood.includes(k)) return 'wood'; return (stone || M.stone.includes(k) || (bl && (bl.steel || bl.heavy || bl.fort))) ? 'stone' : 'dirt'; }
const _dk=new THREE.Color(), _dc=new THREE.Color(), _fv={ x:0, z:0 };
function fly(up, ox, oz, sp){ const a=Math.random()*6.283, s=Math.random()*1.4; _fv.x=(up?0:ox*sp)+Math.cos(a)*s; _fv.z=(up?0:oz*sp)+Math.sin(a)*s; }   // a fragment's way out: back along (ox,oz) with a scatter, or any way up off flat ground
export function bulletImpact(mat, x, y, z, ox, oz, k=1){ if(afxOn()) afxImpact(mat, x, z, k);   // AUDIO 1 the strike is heard by its material (audio/afx.js)
  const H=GUNFX.hit, n=Math.max(2, Math.round((MOBILE?H.chipsMob:H.chips)*Math.min(1.6,k))), up=(ox===0 && oz===0);
  if(mat==='water'){ const wy=RIVER.on ? RIVER.y+0.05 : y;   // a slim white column that falls back, a ring of spray
    for(let i=0;i<H.splash;i++){ fly(true, ox, oz, 0); spawnPart(x, wy, z, _fv.x*0.7, 4+Math.random()*3*k, _fv.z*0.7, { color:0xeef4f6, size:(0.14+Math.random()*0.1)*k, life:0.55, smoke:true, grav:-16, drag:0.5, op:2, keep:true }); }
    spawnPart(x, wy+0.1, z, 0, 0.6, 0, { color:0xe8f0f3, size:0.55*k, life:0.6, smoke:true, grav:-0.6, drag:3, grow:1.0*k, op:1.6, keep:true }); return; }
  if(mat==='metal'){   // a white-hot spark-star and a fan of sparks off the plate, a breath of grey
    spawnPart(x, y, z, 0, 0, 0, { tex:'flash', color:0xfff6e4, size:0.5*k, life:0.035, grav:0, drag:0 });
    sparks(x, y, z, ox, oz, SHOTFX.spark.metal*Math.min(1.6,k), k); if(Math.random() < SHOTFX.rico.metal) ricochet(x, y, z, -ox, -oz);   // GUNFX 1 sparks are motion-blurred streaks now; some rounds whine off
    spawnPart(x, y, z, ox*0.6, 0.6, oz*0.6, { color:0x9a968e, size:0.35*k, life:0.6, smoke:true, grav:0.3, drag:2.4, grow:0.7*k, op:0.9, keep:true }); return; }
  const dust = mat==='stone' ? 0xb9b2a4 : mat==='wood' ? 0xa08a6a : mat==='sand' ? 0xcdb68a : BIOME.ground, w=mat==='wood',
    col = mat==='stone' ? 0x77726a : w ? 0xcfae78 : _dc.setHex(dust).lerp(_dk.setHex(0x241c12), 0.5).getHex();   // dark clods · grey chips · pale splinters
  for(let i=0;i<n;i++){ fly(up, ox, oz, 2.5+Math.random()*3); const s=(0.05+Math.random()*0.05)*Math.min(1.5,k);
    chip(x, y, z, _fv.x, (up?3.5:1.5)+Math.random()*(up?3.5:3)*k, _fv.z, col, w ? s*2.6 : s, w ? s*0.45 : s*0.9); }
  if(mat==='stone'){ if(Math.random()<0.6) sparks(x, y, z, ox, oz, SHOTFX.spark.stone, k*0.8); if(Math.random() < SHOTFX.rico.stone) ricochet(x, y, z, -ox, -oz); }   // stone strikes a spark or two, now and then a ricochet (GUNFX 1 streaks)
  if(mat==='sand') for(let i=0;i<n+2;i++){ fly(up, ox, oz, 1.5+Math.random()*2.5); chip(x, y, z, _fv.x, 2+Math.random()*3*k, _fv.z, 0xc8b080, 0.03, 0.03); }   // GUNFX 1 a fan of sand grains
  const D=H.dust*k*(mat==='sand'?1.35:1);   // the puff of what it was: soil, sand, grey stone dust, wood dust
  for(let i=0;i<2;i++) spawnPart(x+ox*0.2*(i+1), y+0.05, z+oz*0.2*(i+1), ox*(1.4-i*0.5)+(Math.random()-0.5)*0.6, (up?1.6:0.9)+i*0.4, oz*(1.4-i*0.5)+(Math.random()-0.5)*0.6, { color:dust, size:D*(1-i*0.2), life:0.75+Math.random()*0.35, smoke:true, grav:0.05, drag:2.6, grow:D*1.5, op:w?1.4:1.9, keep:true });   // two puffs: one alone is too thin to read
  if(up) spawnPart(x, y+0.1, z, 0, 3.2+Math.random()*1.5, 0, { color:dust, size:D*0.5, life:0.5, smoke:true, grav:-7, drag:1.2, grow:D*0.6, op:1.9, keep:true }); }   // the spurt standing up off the ground

// ---- GUNFX 1 ONE GUN, ONE CALL (SHOTFX): the flash shaped by the class, its light near the camera, a warm splash on the ground at night, MG / cannon
//   smoke, the barrel's heat — every shooter of both sides (cls = rifle | smg | supp | mg | sniper | shotgun | cannon | aa; side = 'p' him · 'a' ours · 'e' theirs;
//   src = the muzzle Object3D, for the barrel that smokes on after a burst)
const isNight = () => NIGHT.on || S.tod === 'night', lightK = () => isNight() ? SHOTFX.splash.night : S.tod === 'sunset' ? SHOTFX.splash.dusk : SHOTFX.splash.day;
export function gunCls(g){ return !g ? 'rifle' : g.ammo === 'blade' ? 'blade' : (g.frags || 1) > 1 ? 'shotgun' : g.supp ? 'supp' : g.ammo === 'pistol' ? 'smg' : g.type === 'AP' ? 'sniper' : (g.mag >= 100 || g.fireCd <= 0.09) ? 'mg' : 'rifle'; }
export function muzzleFX(x, y, z, ang, cls='rifle', side='e', pit=0, src=null, k=1){ const C=SHOTFX.cls[cls] || SHOTFX.cls.rifle, F=C.f, cp=camera.position;
  if(!SHOTFX.on){ gunFlash(x, y, z, ang, F[0]*k, F[1]*k, 0xfff0c0, 0.9, pit, 0); return; }   // (off: the Z419 flash alone — the A/B switch)
  const d2=(x-cp.x)**2+(y-cp.y)**2+(z-cp.z)**2, fx=Math.sin(ang), fz=Math.cos(ang);
  gunFlash(x, y, z, ang, F[0]*k, F[1]*k, 0xffc27a, F[2], pit, C.row);   // warm: the overlapping petals burn white-yellow at the core, orange at the tips
  const L=SHOTFX.light, lk=lightK(), R=isNight() ? L.R : L.Rday;   // the one shared light: the strongest strobe near the camera this frame wins it
  if(side === 'p' || d2 < R*R){ const fall = side === 'p' ? 1 : 1-Math.sqrt(d2)/R*0.6; gunLight(x+fx*0.5, y+0.25, z+fz*0.5, 0xffc27a, C.light*k*fall*(side === 'p' ? 1 : 0.8)); }
  if(C.splash && lk > 0.02 && d2 < 3600) splashAt(x+fx*C.splash*0.25, z+fz*C.splash*0.25, C.splash*k, lk);
  if(C.smoke && d2 < 2500 && (!MOBILE || Math.random() < 0.35)){ const w=WX.wind, s=C.smoke*k;   // a puff out of the muzzle, carried off on the wind
    spawnPart(x+fx*0.3, y+0.02, z+fz*0.3, fx*1.6*s+w.x*0.5, 0.3, fz*1.6*s+w.y*0.5, { color:0xc4c0b8, size:0.45+0.4*s, life:1.1+Math.random()*0.6, smoke:true, grav:0.35, drag:2.0, grow:1.8+s, op:0.22+0.12*s, keep:true }); }
  if(src && d2 < SHOTFX.barrel.R*SHOTFX.barrel.R) heatBarrel(src, C.heat*k); }

// ---- GUNFX 1 the light a shot throws on the ground: a warm, round splash under the muzzle for 1–2 frames (night: bright; day: next to nothing); one draw call ----
const SPN = MOBILE ? (SHOTFX.splash.pool >> 1) : SHOTFX.splash.pool, SPL = []; let _spi = 0;
function softTex(){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), d=x.createImageData(64,64);   // a gaussian pool of light: no edge to read as a disc
  for(let j=0;j<64;j++) for(let i=0;i<64;i++){ const r2=((i-31.5)**2+(j-31.5)**2)/(31.5*31.5), v=r2>=1?0:Math.exp(-r2*4.5)*(1-r2), o=(j*64+i)*4; d.data[o]=d.data[o+1]=d.data[o+2]=255; d.data[o+3]=Math.round(v*255); }
  x.putImageData(d,0,0); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
const _spm = (()=>{ const geo=new THREE.PlaneGeometry(1,1); geo.rotateX(-Math.PI/2);
  const m=new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map:softTex(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }), SPN);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _fc.setRGB(1,1,1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.count=0; m.frustumCulled=false; m.renderOrder=2; scene.add(m);
  for(let i=0;i<SPN;i++) SPL.push({ on:false, fr:0, x:0, y:0, z:0, s:1, k:1 }); return m; })();
function splashAt(x, z, s, k){ const q=SPL[_spi]; _spi=(_spi+1)%SPN; q.on=true; q.fr=0; q.x=x; q.z=z; q.y=heightAt(x,z)+0.06; q.s=s*(0.85+Math.random()*0.3); q.k=k*(0.8+Math.random()*0.4); }
function updateSplash(dt){ let n=0;
  for(const q of SPL){ if(!q.on) continue; if(dt>0 && q.fr++>=1){ q.on=false; continue; }
    _M.compose(_p.set(q.x,q.y,q.z), _q.identity(), _sc.set(q.s,1,q.s)); _spm.setMatrixAt(n, _M); _spm.setColorAt(n, _fc.setRGB(1,0.62,0.3).multiplyScalar(q.k)); n++; }
  _spm.count=n; _spm.visible=n>0; if(n){ _spm.instanceMatrix.needsUpdate=true; _spm.instanceColor.needsUpdate=true; } }

// ---- GUNFX 1 A BARREL THAT HAS BEEN WORKING SMOKES ON: a few hot barrels near the camera, by their muzzle; heat builds with each shot, a thin wisp curls
//   up off the muzzle once the burst stops, until it cools ----
const HB = []; for(let i=0;i<SHOTFX.barrel.n;i++) HB.push({ src:null, heat:0, quiet:0, t:0 });
function heatBarrel(src, h){ let b=null, cold=null; for(const q of HB){ if(q.src===src){ b=q; break; } if(!cold || q.heat<cold.heat) cold=q; }
  if(!b){ b=cold; b.src=src; b.heat=0; } b.heat=Math.min(SHOTFX.barrel.max, b.heat+h); b.quiet=0; }
const _hw=new THREE.Vector3();
function updateBarrels(dt){ if(MOBILE || !(dt>0)) return; const B=SHOTFX.barrel, w=WX.wind;
  for(const q of HB){ if(!q.src || q.heat<=0) continue; q.quiet+=dt; q.heat-=B.decay*dt; if(q.heat<=0 || !q.src.parent){ q.src=null; q.heat=0; continue; }
    if(q.quiet<0.18 || q.heat<B.th) continue; q.t-=dt; if(q.t>0) continue; q.t=B.every*(0.7+Math.random()*0.6);
    q.src.getWorldPosition(_hw); const h=Math.min(1, q.heat/B.max);
    spawnPart(_hw.x+(Math.random()-0.5)*0.04, _hw.y+0.03, _hw.z+(Math.random()-0.5)*0.04, w.x*0.25+(Math.random()-0.5)*0.15, 0.45+h*0.35, w.y*0.25+(Math.random()-0.5)*0.15,
      { color:0xd4d1cb, size:0.16+h*0.14, life:1.4+h*0.9, smoke:true, grav:0.6, drag:1.2, grow:1.9, op:0.22+h*0.28, keep:true }); } }

// ---- GUNFX 1 ROUNDS IN FLIGHT: most rifle / MG rounds fly unseen; every Nth is a TRACER — one motion-blurred streak (its speed × SHOTFX.streak.shutter
//   long, at least SHOTFX.tracer.minPx wide on screen so a far one stays a hairline, not a dotted line), brightest at its head, brighter still coming straight
//   at the camera; the free streaks (sparks, ricochets) share it. ONE instanced draw for all of them; nothing allocated per round ----
const STN = MOBILE ? SHOTFX.streak.poolMob : SHOTFX.streak.pool;
const _stG = new THREE.InstancedBufferGeometry(), _stA = new Float32Array(STN*3), _stB = new Float32Array(STN*3), _stC = new Float32Array(STN*4), _stW = new Float32Array(STN*3);
_stG.setAttribute('corner', new THREE.Float32BufferAttribute([0,-1, 0,1, 1,-1, 1,1], 2)); _stG.setIndex([0,2,1, 1,2,3]);
_stG.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,0, 0,0,0, 0,0,0], 3));
const _iA = new THREE.InstancedBufferAttribute(_stA,3).setUsage(THREE.DynamicDrawUsage), _iB = new THREE.InstancedBufferAttribute(_stB,3).setUsage(THREE.DynamicDrawUsage),
  _iC = new THREE.InstancedBufferAttribute(_stC,4).setUsage(THREE.DynamicDrawUsage), _iW = new THREE.InstancedBufferAttribute(_stW,3).setUsage(THREE.DynamicDrawUsage);
_stG.setAttribute('aA', _iA); _stG.setAttribute('aB', _iB); _stG.setAttribute('aC', _iC); _stG.setAttribute('aW', _iW); _stG.instanceCount = 0;
const _stU = { uPx:{ value:0.001 }, uRes:{ value:new THREE.Vector2(1280,720) }, uFog:{ value:0 }, uToward:{ value:SHOTFX.tracer.toward } };
const _stM = new THREE.Mesh(_stG, new THREE.ShaderMaterial({ uniforms:_stU, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  vertexShader:`attribute vec2 corner; attribute vec3 aA; attribute vec3 aB; attribute vec4 aC; attribute vec3 aW;
  uniform float uPx; uniform vec2 uRes; uniform float uFog; uniform float uToward;
  varying vec3 vC; varying float vAl, vHalf, vAc, vPx, vCore;
  void main(){ vec4 a = viewMatrix * vec4(aA, 1.0), b = viewMatrix * vec4(aB, 1.0); const float NZ = -0.65;
    if(a.z > NZ && b.z > NZ){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vC = vec3(0.0); return; }   // wholly behind the eye
    if(a.z > NZ) a.xyz = mix(b.xyz, a.xyz, (b.z - NZ) / (b.z - a.z)); if(b.z > NZ) b.xyz = mix(a.xyz, b.xyz, (a.z - NZ) / (a.z - b.z));   // cut at the near plane
    vec3 P = mix(a.xyz, b.xyz, corner.x); float dist = -P.z, w = max(aW.x, aW.y * uPx * dist), px = w / (uPx * dist);   // half width: its own, or minPx on screen
    vec4 ca = projectionMatrix * a, cb = projectionMatrix * b; vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * 0.5 * uRes; float L = length(d); vec2 dir = L > 1e-3 ? d / L : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
    vec4 c = projectionMatrix * vec4(P, 1.0); c.xy += (nrm * corner.y + dir * (corner.x * 2.0 - 1.0)) * px * 2.0 / uRes * c.w; gl_Position = c;   // a capsule: caps of the half width at both ends
    vAl = (corner.x * 2.0 - 1.0) * (L * 0.5 + px); vHalf = L * 0.5; vAc = corner.y * px; vPx = px; vCore = aW.z;
    vec3 sd = b.xyz - a.xyz; float sl = length(sd), tw = sl > 1e-4 ? max(0.0, dot(sd / sl, normalize(-b.xyz))) : 1.0;   // coming at the eye: brighter
    vC = aC.rgb * aC.w * (1.0 + uToward * tw * tw) * sqrt(max(0.12, aW.x / w)) * exp(-uFog * uFog * dist * dist * 0.55); }`,   // a far one widened to minPx dims to keep its light · the fog swallows it
  fragmentShader:`varying vec3 vC; varying float vAl, vHalf, vAc, vPx, vCore;
  void main(){ float dx = max(abs(vAl) - vHalf, 0.0), r = length(vec2(dx, vAc)) / vPx; if(r >= 1.0) discard;
    float f = clamp((vAl + vHalf) / (2.0 * vHalf + 1e-3), 0.0, 1.0), along = mix(1.0, 0.12 + 0.88 * pow(f, 0.7), clamp(vHalf / (3.0 * vPx), 0.0, 1.0));   // the head bright, the tail fading
    float q = r / vCore, v = exp(-q * q * 2.2) + exp(-r * r * 3.0) * (1.0 - r) * 0.28; gl_FragColor = vec4(vC * v * along, 1.0); }` }));
_stM.frustumCulled = false; _stM.renderOrder = 7; scene.add(_stM);
let _sn = 0;
function putStreak(ax, ay, az, bx, by, bz, col, I, w, core){ if(_sn >= STN) return; const i=_sn++, o=i*3, c=i*4; _fc.setHex(col);
  _stA[o]=ax; _stA[o+1]=ay; _stA[o+2]=az; _stB[o]=bx; _stB[o+1]=by; _stB[o+2]=bz; _stC[c]=_fc.r; _stC[c+1]=_fc.g; _stC[c+2]=_fc.b; _stC[c+3]=I;
  _stW[o]=w; _stW[o+1]=SHOTFX.tracer.minPx*0.5*(renderer.getPixelRatio ? renderer.getPixelRatio() : 1); _stW[o+2]=core; }
// a free streak — a spark, a ricochet: thrown from (x,y,z) at (vx,vy,vz), falls, shortens as it dies
const FS = []; for(let i=0;i<(MOBILE?40:110);i++) FS.push({ on:false, x:0, y:0, z:0, vx:0, vy:0, vz:0, life:0, max:1, col:0xffffff, k:1, w:0.02, g:-9 }); let _fsi = 0;
export function freeStreak(x, y, z, vx, vy, vz, col, k, life, w=0.02, g=-9){ const s=FS[_fsi]; _fsi=(_fsi+1)%FS.length;
  s.on=true; s.x=x; s.y=y; s.z=z; s.vx=vx; s.vy=vy; s.vz=vz; s.col=col; s.k=k; s.life=s.max=life; s.w=w; s.g=g; }
// a KINETIC round glancing off thick armour / a hard face: a bright streak that skips away + a spray of spark streaks
export function ricochet(x, y, z, vx, vz, col=0xfff0c8){ const L=Math.hypot(vx,vz)||1, a=Math.atan2(vx/L, vz/L)+(Math.random()<0.5?1:-1)*(0.5+Math.random()*0.9), RC=SHOTFX.rico, sp=RC.v[0]+Math.random()*(RC.v[1]-RC.v[0]);
  freeStreak(x, y, z, Math.sin(a)*sp, 2+Math.random()*9, Math.cos(a)*sp, col, RC.k, RC.life[0]+Math.random()*(RC.life[1]-RC.life[0]), RC.w, -9);
  sparks(x, y, z, -vx/L, -vz/L, 3, 1); }
function sparks(x, y, z, ox, oz, n, k){ const P=SHOTFX.spark; n=Math.max(1, Math.round(n*(MOBILE?P.mob:1)));
  for(let i=0;i<n;i++){ const a=Math.random()*6.283, s=(P.v[0]+Math.random()*(P.v[1]-P.v[0]))*Math.min(1.5,k), sc=0.35+Math.random()*0.9;
    freeStreak(x, y, z, ox*s*0.8+Math.cos(a)*s*sc*0.7, 1+Math.random()*s*0.5, oz*s*0.8+Math.sin(a)*s*sc*0.7, i%2 ? 0xffe2a0 : 0xffb860, P.k, P.life[0]+Math.random()*(P.life[1]-P.life[0]), P.w, -16); } }
// a round leaves the gun (combat/lock-on.js spawnBullet): small arms / a sniper's round become a streak or nothing; tank / wall guns / rockets keep their own look
const _trN = {};
export function tracerEvery(cls){ return cls === 'rifle' ? REAL.tracer.every : SHOTFX.tracer.every[cls] || SHOTFX.tracer.every.def; }
export function shotLook(b, o){ if(!SHOTFX.on || o.rocket || o.homing || o.aoe || b.arc || b.type === 'ELEC' || o.cls === 'blade') return;
  const sp=o.speed||60; let cls=o.cls;
  if(!b.sa){ if(b.type === 'AP' && sp < 200 && (cls === 'sniper' || b.owner === 'p')) cls='sniper'; else if(b.owner === 'e' && (o.r || 0.45) < 0.3 && !o.lockOn) cls=cls || 'aa'; else return; }   // a light AA gun's rounds streak too; a cannon keeps its shell look
  cls = cls || 'def'; let tr=o.tr;
  if(cls === 'sniper') tr=0; else if(tr == null){ const key=b.owner+cls, n=_trN[key]=(_trN[key] ?? (Math.random()*9|0))+1; tr = n % tracerEvery(cls) === 0 ? 1 : 0; }
  b.sk = cls === 'sniper' ? 3 : tr ? 1 : 2; b.trc = b.sk === 1; b.dark = true; b.mesh.visible = false; b.skx=b.x; b.sky=b.wy0; b.skz=b.z; b.skp=null; b.skc = b.owner === 'e' ? SHOTFX.tracer.theirs : SHOTFX.tracer.ours; }
const _bv = new THREE.Vector3();
// once a frame: every streaking round, then the free streaks
function updateStreaks(dt){ _sn=0; const T=SHOTFX.tracer, ST=SHOTFX.streak, cp=camera.position, sh=SHOTFX.shimmer, tc=SHOTFX.trace;
  for(let i=0;i<bullets.length;i++){ const b=bullets[i]; if(!b.sk || b._hx === undefined) continue; const h=b.mesh.position;
    let vy=0; if(b.skp != null && dt > 0) vy=(h.y-b.skp)/dt; b.skp=h.y; const vh=Math.hypot(b.vx,b.vz), v=Math.hypot(vh,vy)||1;
    const flown=Math.hypot(h.x-b.skx, h.y-b.sky, h.z-b.skz), L=Math.min(flown, Math.max(ST.min, Math.min(ST.max, v*ST.shutter)));
    if(L < 0.05) continue; const ax=h.x-b.vx/v*L, ay=h.y-vy/v*L, az=h.z-b.vz/v*L;
    if(b.sk === 1){ const ig=Math.min(1, 0.3+0.7*flown/T.ignite); putStreak(ax, ay, az, h.x, h.y, h.z, b.skc, T.hot*ig, T.width*T.glow, 1/T.glow); }   // a tracer: lit a few metres out of the muzzle
    else if(b.sk === 3) putStreak(ax, ay, az, h.x, h.y, h.z, tc.col, T.hot*tc.k, T.width*T.glow*tc.w*0.5, 0.5);   // the sniper's trace: a faint grey line
    else if(b.owner === 'e' && !MOBILE){ const d2=(h.x-cp.x)**2+(h.y-cp.y)**2+(h.z-cp.z)**2; if(d2 < sh.R*sh.R) putStreak(ax, ay, az, h.x, h.y, h.z, sh.col, T.hot*sh.k*(1-Math.sqrt(d2)/sh.R), T.width*sh.w, 0.6); } }   // an unseen round right past you: a faint shimmer
  for(const s of FS){ if(!s.on) continue; if(dt>0){ s.life-=dt; if(s.life<=0){ s.on=false; continue; } s.vy+=s.g*dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.z+=s.vz*dt;
      const gy=heightAt(s.x,s.z); if(s.y<gy){ s.y=gy; s.vy=Math.abs(s.vy)*0.3; s.vx*=0.55; s.vz*=0.55; } }   // a spark skips on the ground
    const v=Math.hypot(s.vx,s.vy,s.vz)||1, f=s.life/s.max, L=Math.max(0.06, Math.min(2.4, v*ST.shutter*0.6))*(0.4+0.6*f);
    putStreak(s.x-s.vx/v*L, s.y-s.vy/v*L, s.z-s.vz/v*L, s.x, s.y, s.z, s.col, s.k*(0.35+0.65*f), s.w*T.glow, 1/T.glow); }
  _stG.instanceCount=_sn; _stM.visible=_sn>0; if(_sn){ for(const a of [_iA,_iB,_iC,_iW]){ a.needsUpdate=true; a.addUpdateRange && (a.clearUpdateRanges(), a.addUpdateRange(0, _sn*a.itemSize)); } }
  const el=renderer.domElement; _stU.uRes.value.set(el.width, el.height); _stU.uPx.value=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1, el.height); _stU.uFog.value=scene.fog && scene.fog.density || 0; }

// per frame: flashes (fade over their 1–2 frames, packed into the instance list), brass, the muzzle light's strobe
export function updateGunFX(dt){ let n=0;
  for(const f of FL){ if(!f.on) continue; f.life-=dt; if(dt>0 && f.fr++>=1 && f.life<=0){ f.on=false; continue; }   // (a frame that stands still — dt 0 — does not use the flash up)
    _fl.setMatrixAt(n, f.m); _fl.setColorAt(n, _fc.setHex(f.col).multiplyScalar(f.k*Math.max(0.4, f.life/f.max))); _fl.geometry.attributes.aRow.setX(n, f.row); n++; }
  _fl.count=n; if(n){ _fl.instanceMatrix.needsUpdate=true; _fl.instanceColor.needsUpdate=true; _fl.geometry.attributes.aRow.needsUpdate=true; }
  updateBrass(dt); updateSplash(dt); updateBarrels(dt); updateStreaks(dt);   // GUNFX 1
  const L=muzzleLight; if(L.userData.fast){ L.intensity=Math.max(0, L.intensity-dt*GUNFX.light.decay); if(L.intensity<=0) L.userData.fast=false; } }
