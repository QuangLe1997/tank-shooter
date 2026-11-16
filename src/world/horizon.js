// world/horizon.js — Z189 THE HORIZON: the battlefield is not alone in the world. Three rings of distant ranges fade into the haze (shaped and
//   coloured per battlefield: dunes, icy peaks, green hills, karst, a city skyline, smoking stacks, volcanic cones, marble mountains); the war
//   goes on out there — black smoke columns stand on the horizon over burning towns, gun flashes flicker along it, and jets scream across the sky.
import * as THREE from 'three';
import { ARENA, MOBILE, S, scene, sfx, smokeTex2, spawnPart } from '../hub.js';

export const HZN = { g:null, cols:[], flashes:[], jets:[], jetAt:0, flashAt:0, smokeTex:null, glowTex:null };
// per battlefield: [base colour, snow/highlight colour, shape kind, height (m)]
const LOOK = { DESERT:[0xa8885a,0xd8bc8a,'dune',38], SAVANNA:[0x8a6a40,0xb89a68,'mesa',46], TUNDRA:[0x5a6a78,0xf2f6fa,'peak',120], ARCTIC:[0x7a8ea4,0xffffff,'peak',140],
  MEADOW:[0x4a6a34,0x7a9a52,'hill',58], HILLS:[0x3e5a30,0x6a8a48,'hill',90], VILLAGE:[0x3a5a34,0x5e8248,'karst',110], CITADEL:[0x8a6a4a,0xc49a6a,'peak',85],
  RUINS:[0x5a5a5e,0x8a8a8e,'city',70], CITY:[0x4a5260,0x7a8494,'city',110], FOUNDRY:[0x4a423e,0x6a5e56,'stacks',80], STEELMILL:[0x4a3a32,0x6e5446,'stacks',90],
  VOLCANO:[0x2a2222,0x5a3a30,'volcano',150], QUARRY:[0x9a948a,0xf0ece2,'peak',110] };
function texes(){ if(!HZN.smokeTex){ HZN.smokeTex=smokeTex2(); const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,220,160,0.6)'); g.addColorStop(1,'rgba(255,160,60,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); HZN.glowTex=new THREE.CanvasTexture(c); } }
// one ring of ranges: a vertical curtain whose top follows layered noise; the snowline / sunlit band uses the highlight colour
function ring(R, H, kind, base, hi, fogC, mix, seed){ const n=MOBILE?120:200, pos=[], col=[], idx=[], ph=[0,1,2,3,4].map(k=>Math.sin(seed*91.7+k*12.9)*100);
  const cb=new THREE.Color(base).lerp(fogC, mix), ch=new THREE.Color(hi).lerp(fogC, mix*0.85), cfoot=new THREE.Color(base).lerp(fogC, Math.min(1, mix+0.25));
  const hAt=(a)=>{ let h; const s=(f,p)=>Math.sin(a*f+ph[p]);
    if(kind==='dune') h=0.55+0.25*s(3,0)+0.15*s(7,1)+0.05*s(17,2);
    else if(kind==='mesa'){ const m=0.5+0.5*s(4,0); h=m>0.7?0.95:m>0.45?0.55+(m-0.45)*1.6:0.35+0.1*s(19,2); }
    else if(kind==='hill') h=0.5+0.28*s(5,0)+0.14*s(11,1)+0.06*s(23,2);
    else if(kind==='karst'){ const k=Math.abs(s(13,0))*Math.abs(s(29,1)); h=0.35+0.65*Math.pow(k,0.6)+0.1*s(5,2); }
    else if(kind==='volcano'){ h=0.4+0.25*s(4,0)+0.12*s(11,1); const v=Math.max(0,Math.cos(a*2+ph[3]*0.01)); h+=0.55*Math.pow(v,18); }
    else if(kind==='city'||kind==='stacks') h=0.35+0.12*s(6,0);
    else { const r=Math.abs(s(7,0))*0.45+Math.abs(s(17,1))*0.3+Math.abs(s(37,2))*0.15; h=0.3+r*0.95; }   // jagged peaks
    return Math.max(0.12, h)*H; };
  for(let i=0;i<=n;i++){ const a=i/n*Math.PI*2, h=hAt(a), x=Math.cos(a)*R, z=Math.sin(a)*R, xi=Math.cos(a)*(R-H*0.25), zi=Math.sin(a)*(R-H*0.25);
    pos.push(x,-14,z, xi,h,zi); const top=(kind==='peak'||kind==='volcano'||kind==='karst') && h>H*0.62 ? ch : cb; col.push(cfoot.r,cfoot.g,cfoot.b, top.r,top.g,top.b);
    if(i<n){ const k=i*2; idx.push(k,k+1,k+2, k+1,k+3,k+2); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx);
  const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors:true, fog:false, side:THREE.DoubleSide })); m.renderOrder=-8; m.frustumCulled=false; return m; }
// a skyline: towers / stacks standing on the nearest ring
function skyline(R, H, kind, base, fogC, mix){ const n=MOBILE?40:70, geos=[], c=new THREE.Color(base).lerp(fogC, mix);
  for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, r=R+(Math.random()-0.5)*30, w=kind==='stacks'?3+Math.random()*3:8+Math.random()*16, h=kind==='stacks'?H*(0.6+Math.random()*0.8):H*(0.25+Math.random()*0.75);
    const g=kind==='stacks' && Math.random()<0.6 ? new THREE.CylinderGeometry(w*0.4,w*0.55,h,8) : new THREE.BoxGeometry(w,h,w*(0.6+Math.random()*0.8)); g.translate(Math.cos(a)*r, h/2-6, Math.sin(a)*r); g.rotateY(0); geos.push(g); }
  const merged=mergeGeos(geos); const m=new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color:c, fog:false })); m.renderOrder=-7; m.frustumCulled=false; return m; }
function mergeGeos(list){ let n=0; for(const g of list) n+=g.toNonIndexed().attributes.position.count; const out=new Float32Array(n*3); let o=0;
  for(const g0 of list){ const g=g0.toNonIndexed(), p=g.attributes.position.array; out.set(p,o); o+=p.length; g.dispose(); g0.dispose(); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out,3)); return g; }
export function clearHorizon(){ if(HZN.g){ scene.remove(HZN.g); HZN.g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material && !o.material.map) o.material.dispose(); }); } HZN.g=null; HZN.cols.length=0; HZN.flashes.length=0; }
export function buildHorizon(b){ clearHorizon(); texes(); const L=LOOK[b.name]||LOOK.DESERT, fogC=scene.fog.color.clone(), g=new THREE.Group(); HZN.g=g; scene.add(g);
  const R0=ARENA*1.55, kind=L[2], H=L[3]*(MOBILE?0.85:1);
  const rk = kind==='city'||kind==='stacks' ? 'hill' : kind;   // behind a skyline there are still hills
  g.add(ring(R0+170, H*1.35, rk==='dune'?'mesa':rk==='hill'?'peak':rk, L[0], L[1], fogC, 0.8, 3));   // far: tallest, palest
  g.add(ring(R0+95,  H*1.05, rk, L[0], L[1], fogC, 0.62, 2));
  if(kind==='city'||kind==='stacks') g.add(skyline(R0+30, H, kind, L[0], fogC, 0.42)); else g.add(ring(R0+30, H*0.7, rk, L[0], L[1], fogC, 0.42, 1));   // near: darkest, crispest
  // the war beyond the hills: smoke columns rising over burning places
  const nC=MOBILE?3:6; for(let i=0;i<nC;i++){ const a=Math.random()*Math.PI*2, r=R0+20+Math.random()*90, x=Math.cos(a)*r, z=Math.sin(a)*r, col=new THREE.Group(); col.position.set(x,0,z); g.add(col);
    const parts=[]; for(let k=0;k<7;k++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:HZN.smokeTex, color:new THREE.Color(0x1c1814).lerp(fogC,0.35+k*0.06), transparent:true, opacity:0.85-k*0.08, depthWrite:false, fog:false })); s.position.y=8+k*16; s.scale.setScalar(18+k*9); col.add(s); parts.push(s); }
    const fire=new THREE.Sprite(new THREE.SpriteMaterial({ map:HZN.glowTex, color:0xff7a2a, transparent:true, opacity:0.8, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); fire.position.y=3; fire.scale.set(26,12,1); col.add(fire);
    HZN.cols.push({ col, parts, fire, ph:Math.random()*10 }); }
  // horizon gun flashes (pooled)
  for(let i=0;i<4;i++){ const f=new THREE.Sprite(new THREE.SpriteMaterial({ map:HZN.glowTex, color:0xffb060, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); g.add(f); HZN.flashes.push({ s:f, t:0 }); }
  HZN.jetAt=performance.now()/1000+8+Math.random()*10; }
// jets: a pair that screams over the field at low level, contrails behind
function jetMesh(){ const g=new THREE.Group(), M=new THREE.MeshStandardMaterial({ color:0x5a626a, roughness:0.5, metalness:0.6 });
  const f=new THREE.Mesh(new THREE.ConeGeometry(0.9,11,8), M); f.rotation.x=Math.PI/2; g.add(f); const w=new THREE.Mesh(new THREE.BoxGeometry(10,0.25,3.2), M); w.position.z=-1; g.add(w);
  const t=new THREE.Mesh(new THREE.BoxGeometry(4,0.2,1.6), M); t.position.z=-4.6; g.add(t); const fin=new THREE.Mesh(new THREE.BoxGeometry(0.2,2.2,1.8), M); fin.position.set(0,1.1,-4.4); g.add(fin);
  const ab=new THREE.Sprite(new THREE.SpriteMaterial({ map:HZN.glowTex, color:0xffa050, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false })); ab.scale.setScalar(3.4); ab.position.z=-6; g.add(ab); return g; }
function launchJets(now){ const a=Math.random()*Math.PI*2, R=ARENA*1.9, y=48+Math.random()*18, sp=95, dx=-Math.cos(a), dz=-Math.sin(a), off=(Math.random()-0.5)*ARENA*0.6;
  for(let k=0;k<2;k++){ const m=jetMesh(), px=-dz*(off+k*9), pz=dx*(off+k*9); m.position.set(Math.cos(a)*R+px, y+k*3, Math.sin(a)*R+pz); m.rotation.y=Math.atan2(dx,dz); m.rotation.z=(k?-1:1)*0.15; scene.add(m);
    HZN.jets.push({ m, vx:dx*sp, vz:dz*sp, t:0, life:R*2/sp, delay:k*0.35 }); }
  setTimeout(()=>sfx('jet'), 900); }
export function updateHorizon(dt, now){ if(!HZN.g) return;
  for(const c of HZN.cols){ c.parts.forEach((s,k)=>{ s.position.x=Math.sin(now*0.15+c.ph+k*0.7)*k*1.6; s.material.rotation+=dt*0.03*(k%2?1:-1); }); c.fire.material.opacity=0.55+0.3*Math.sin(now*7+c.ph)+0.15*Math.random(); }
  if(now>HZN.flashAt){ HZN.flashAt=now+0.8+Math.random()*2.8; const f=HZN.flashes.find(q=>q.t<=0); if(f){ const a=Math.random()*Math.PI*2, r=ARENA*1.55+40+Math.random()*130; f.s.position.set(Math.cos(a)*r, 4+Math.random()*10, Math.sin(a)*r); f.s.scale.setScalar(24+Math.random()*40); f.t=0.28; } }
  for(const f of HZN.flashes){ if(f.t>0){ f.t-=dt; f.s.material.opacity=Math.max(0, f.t/0.28)*0.95; } }
  if(S.mode==='playing' && now>HZN.jetAt){ HZN.jetAt=now+(MOBILE?45:28)+Math.random()*25; launchJets(now); }
  for(let i=HZN.jets.length-1;i>=0;i--){ const j=HZN.jets[i]; if(j.delay>0){ j.delay-=dt; continue; } j.t+=dt; j.m.position.x+=j.vx*dt; j.m.position.z+=j.vz*dt;
    if(Math.random()<(MOBILE?0.5:0.95)){ const p=j.m.position; spawnPart(p.x-j.vx*0.06, p.y, p.z-j.vz*0.06, 0, 0, 0, { color:0xf0f2f4, size:1.4, life:3.2, smoke:true, grav:0, drag:0.2, grow:2.4, op:0.45 }); }
    if(j.t>j.life){ scene.remove(j.m); j.m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); HZN.jets.splice(i,1); } } }
