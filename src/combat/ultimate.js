// combat/ultimate.js — Z186 ULTIMATE WEAPONS (TỐI THƯỢNG): orbital lance · plasma sun · Hydra swarm · black-hole grenade · photon lance — each its own mechanic, telegraph and spectacle
import * as THREE from 'three';
import { GLOW, MOBILE, PAD, S, aimTarget, aoeDamage, bigExplode, blocks, boss, bullets, damageBlock, damageBoss, damageEnemy, deformCrater, enemies, fortIntactCross, heightAt, playerRange, ringPulse, scene, sfx, spawnBullet, spawnPart } from '../hub.js';

export const ULTI = { strikes:[], orbs:[], holes:[], beams:[] };
const add=(o)=>{ scene.add(o); return o; };
const glowMat=(c,o)=>new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:o==null?1:o, blending:THREE.AdditiveBlending, depthWrite:false });
const sprite=(c,s,o)=>{ const m=new THREE.Sprite(new THREE.SpriteMaterial({ map:GLOW, color:c, transparent:true, opacity:o==null?1:o, blending:THREE.AdditiveBlending, depthWrite:false })); m.scale.setScalar(s); return m; };
const drop=(o)=>{ if(!o) return; scene.remove(o); o.traverse(n=>{ if(n.geometry) n.geometry.dispose(); if(n.material) n.material.dispose(); }); };
// where the weapon is pointed: your cursor (desktop / pad), the locked target, or straight ahead
export function ultiPoint(range, ang){ const p=S.player, R=range||playerRange();
  if((!MOBILE || PAD.active) && S.pointerActive){ const dx=S.aimPoint.x-p.pos.x, dz=S.aimPoint.z-p.pos.z, d=Math.hypot(dx,dz)||1, k=Math.min(1, R/d); return { x:p.pos.x+dx*k, z:p.pos.z+dz*k }; }
  const t=aimTarget(R); if(t) return { x:t.pos.x, z:t.pos.z };
  const d=Math.min(R, 28); return { x:p.pos.x+Math.sin(ang)*d, z:p.pos.z+Math.cos(ang)*d }; }
function targets(){ return enemies.filter(e=>!e.abandoned); }
// ---------- dispatcher (from fireGun) ----------
export function fireUltimate(now, g, dmg, ang, range, mz){ const R=(range||playerRange())*(g.rng||1);
  if(g.special==='orbital') fireOrbital(now, g, dmg, ang, R);
  else if(g.special==='plasma') firePlasma(now, g, dmg, ang, R, mz);
  else if(g.special==='hydra') fireHydra(now, g, dmg, ang, R, mz);
  else if(g.special==='singularity') fireSingularity(now, g, dmg, ang, R, mz);
  else if(g.special==='photon') firePhoton(now, g, dmg, ang, R, mz); }
// 1) THƯƠNG THẦN QUỸ ĐẠO — paint the spot, a thin guide beam from the sky, then the lance comes down
function fireOrbital(now, g, dmg, ang, R){ const t=ultiPoint(R, ang), y=heightAt(t.x,t.z);
  const ring=add(new THREE.Mesh(new THREE.RingGeometry(g.aoeR*0.92, g.aoeR, 48), glowMat(0x8fe8ff, 0.8))); ring.rotation.x=-Math.PI/2; ring.position.set(t.x, y+0.15, t.z);
  const guide=add(new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,90,10,1,true), glowMat(0xbff4ff, 0.55))); guide.position.set(t.x, y+45, t.z);
  ULTI.strikes.push({ x:t.x, z:t.z, y, at:now+1.0, t0:now, ring, guide, col:null, dmg, R:g.aoeR, done:false });
  sfx('beep'); }
// 2) PHÁO PLASMA MẶT TRỜI — a slow star that burns through everything, then goes nova
function firePlasma(now, g, dmg, ang, R, mz){ const o=new THREE.Group(); o.add(new THREE.Mesh(new THREE.SphereGeometry(0.85,20,16), glowMat(0xfff4d0, 1))); o.add(sprite(0xff9a2a, 7.5, 0.95)); o.add(sprite(0xffe6a0, 3.4, 1));
  o.position.set(mz.x, Math.max(1.4, mz.y), mz.z); add(o);
  ULTI.orbs.push({ o, x:mz.x, z:mz.z, vx:Math.sin(ang)*g.bspeed, vz:Math.cos(ang)*g.bspeed, left:R, dmg, R:g.aoeR, tick:0, hitAt:new Map() }); sfx('bigexplode'); }
function nova(x, z, dmg, R, now){ aoeDamage(x, z, R, dmg, false, now, 'TBX', true, 2.2); bigExplode({ x, z }, 0xffb24a, R/2.6); ringPulse({ x, y:0.2, z }, 0xfff0c0, R*1.1); ringPulse({ x, y:0.2, z }, 0xff7a2a, R*0.7);
  deformCrater(x, z, R*0.45, 0.9); S.shake=Math.min(6, S.shake+3.2); sfx('bigexplode'); }
// 3) BẦY TÊN LỬA HYDRA — ten micro-missiles in a rippling fan, each sent at a different target
function fireHydra(now, g, dmg, ang, R, mz){ const p=S.player, T=targets().filter(e=>(e.pos.x-p.pos.x)**2+(e.pos.z-p.pos.z)**2 < R*R).sort((a,b)=>((a.pos.x-p.pos.x)**2+(a.pos.z-p.pos.z)**2)-((b.pos.x-p.pos.x)**2+(b.pos.z-p.pos.z)**2));
  const n=g.frags||10;
  for(let i=0;i<n;i++) setTimeout(()=>{ if(S.mode!=='playing' || !S.player) return; const e=T.length ? T[i%T.length] : null;
      const a0 = e ? Math.atan2(e.pos.x-p.pos.x, e.pos.z-p.pos.z) : ang; const a = a0 + (i-(n-1)/2)*(g.spread/(n-1));   // fan out, then the seeker turns them in
      spawnBullet(mz.x, mz.z, a, { owner:'p', dmg, speed:g.bspeed, color:0xffb070, r:0.32, life:2.4, maxDist:R+8, y:Math.max(1.6, mz.y), type:'HE', homing:g.homing, rocket:true, lockOn:true, aoe:g.aoe, aoeDmg:dmg*0.8, fx:'blast', knock:1.4, from:p.pos });
      { const b=bullets[bullets.length-1]; if(b && e && b.owner==='p') b.tgt=e; }   // each head is given its own prey (the seeker keeps it)
      spawnPart(mz.x, mz.y+0.3, mz.z, (Math.random()-0.5)*2, 2.2, (Math.random()-0.5)*2, { color:0xd8d2c4, size:1.1, life:0.9, smoke:true, grav:-0.6, drag:1.4, op:0.35 });
      if(i%3===0) sfx('shoot_missile'); }, i*55); }
// 4) LỰU ĐẠN HỐ ĐEN — lobbed; where it lands a singularity drags everything in, crushes it, then collapses
function fireSingularity(now, g, dmg, ang, R, mz){ const t=ultiPoint(R, ang), o=new THREE.Group(); o.add(new THREE.Mesh(new THREE.SphereGeometry(0.45,16,12), new THREE.MeshBasicMaterial({ color:0x0a0410 }))); o.add(sprite(0xb070ff, 3, 0.9));
  o.position.set(mz.x, mz.y, mz.z); add(o);
  ULTI.holes.push({ phase:'fly', o, x0:mz.x, y0:mz.y, z0:mz.z, x:t.x, z:t.z, t0:now, fly:0.75, dmg, R:g.aoeR, dur:g.hold||2.6 }); sfx('shoot_agl'); }
function openHole(h, now){ h.phase='pull'; h.t0=now; drop(h.o); const y=heightAt(h.x,h.z)+1.6, o=new THREE.Group();
  o.add(new THREE.Mesh(new THREE.SphereGeometry(2.3,28,20), new THREE.MeshBasicMaterial({ color:0x000000 })));
  const disk=new THREE.Mesh(new THREE.RingGeometry(2.5, 8.5, 72), glowMat(0x9a5cff, 0.7)); disk.rotation.x=-Math.PI/2+0.35; o.add(disk);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.2, 10, 56), glowMat(0xe0c8ff, 1)); halo.rotation.x=Math.PI/2+0.35; o.add(halo);
  o.add(sprite(0x7a3cff, 20, 0.6)); o.position.set(h.x, y+0.8, h.z); add(o); h.o=o; h.disk=disk; h.halo=halo;
  ringPulse({ x:h.x, y:0.2, z:h.z }, 0xb070ff, h.R); sfx('bigexplode'); S.shake=Math.min(6, S.shake+1.5); }
// 5) TIA QUANG TỬ — a sustained beam that follows your aim and cuts a line through everything
function firePhoton(now, g, dmg, ang, R, mz){ const o=new THREE.Group(), core=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,1,12,1,true), glowMat(0xffffff, 1)), sheath=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,1,16,1,true), glowMat(0x7fd8ff, 0.4));
  for(const m of [core, sheath]){ m.rotation.x=Math.PI/2; o.add(m); } const tip=sprite(0xbfeaff, 5, 0.9); o.add(tip); add(o);
  ULTI.beams.push({ o, core, sheath, tip, t0:now, until:now+(g.hold||0.9), dps:dmg/(g.hold||0.9), R, blk:new Map() }); sfx('shoot_railgun'); }
// ---------- per-frame ----------
const _segD=(px,pz,ax,az,bx,bz)=>{ const vx=bx-ax, vz=bz-az, L2=vx*vx+vz*vz||1, t=Math.max(0,Math.min(1,((px-ax)*vx+(pz-az)*vz)/L2)), qx=ax+vx*t-px, qz=az+vz*t-pz; return Math.hypot(qx,qz); };
export function updateUltimates(dt, now){
  // orbital strikes
  for(let i=ULTI.strikes.length-1;i>=0;i--){ const s=ULTI.strikes[i], k=Math.min(1,(now-s.t0)/(s.at-s.t0));
    if(!s.done){ s.ring.scale.setScalar(1.25-0.25*k); s.ring.material.opacity=0.45+0.5*Math.abs(Math.sin(now*14)); s.guide.material.opacity=0.25+0.6*k; s.guide.scale.set(1+k*2.5,1,1+k*2.5);
      if(Math.random()<0.6) spawnPart(s.x+(Math.random()-0.5)*s.R*1.6, s.y+0.2, s.z+(Math.random()-0.5)*s.R*1.6, 0, 3+Math.random()*3, 0, { color:0x9fefff, size:0.4, life:0.4, grav:-3, drag:1 });
      if(now>=s.at){ s.done=true; s.end=now+0.5; drop(s.ring); drop(s.guide);
        const col=add(new THREE.Mesh(new THREE.CylinderGeometry(s.R*0.42, s.R*0.55, 120, 24, 1, true), glowMat(0xdffaff, 0.95))); col.position.set(s.x, s.y+60, s.z); s.col=col;
        aoeDamage(s.x, s.z, s.R, s.dmg, true, now, 'HE', true, 2.6); bigExplode({ x:s.x, z:s.z }, 0x8fe8ff, s.R/2.2); bigExplode({ x:s.x, z:s.z }, 0xffffff, s.R/3.2);
        ringPulse({ x:s.x, y:0.2, z:s.z }, 0xffffff, s.R*1.4); ringPulse({ x:s.x, y:0.2, z:s.z }, 0x8fe8ff, s.R); deformCrater(s.x, s.z, s.R*0.55, 1.4);
        S.shake=Math.min(7, S.shake+4.5); sfx('bigexplode'); } }
    else { const f=Math.max(0,(s.end-now)/0.5); if(s.col){ s.col.material.opacity=0.95*f; s.col.scale.set(1+(1-f)*0.8,1,1+(1-f)*0.8); } if(now>=s.end){ drop(s.col); ULTI.strikes.splice(i,1); } } }
  // plasma suns
  for(let i=ULTI.orbs.length-1;i>=0;i--){ const b=ULTI.orbs[i], step=Math.hypot(b.vx,b.vz)*dt, px=b.x, pz=b.z; b.x+=b.vx*dt; b.z+=b.vz*dt; b.left-=step;
    const y=heightAt(b.x,b.z)+1.5; b.o.position.set(b.x, y, b.z); b.o.rotation.y+=dt*3; const pul=1+Math.sin(now*22)*0.08; b.o.children[1].scale.setScalar(7.5*pul);
    for(let k=0;k<3;k++) spawnPart(b.x+(Math.random()-0.5)*1.2, y+(Math.random()-0.5)*1.2, b.z+(Math.random()-0.5)*1.2, -b.vx*0.08+(Math.random()-0.5)*2, (Math.random()-0.5)*2, -b.vz*0.08+(Math.random()-0.5)*2, { color:Math.random()<0.5?0xff8a2a:0xffe08a, size:0.9, life:0.45, grav:0, drag:2 });
    if((b.tick-=dt)<=0){ b.tick=0.15;   // burn everything it brushes
      for(const e of targets()){ const q=(e.pos.x-b.x)**2+(e.pos.z-b.z)**2, rr=(e.r||1.5)+2.6; if(q<rr*rr) damageEnemy(e, b.dmg*0.3); }
      if(boss && boss.alive && (boss.pos.x-b.x)**2+(boss.pos.z-b.z)**2 < 25) damageBoss(b.dmg*0.3);
      for(const bl of blocks.slice()){ const rr=(bl.r||1)+2.2; if((bl.x-b.x)**2+(bl.z-b.z)**2 < rr*rr && bl.kind!=='fortwall' && bl.kind!=='gate') damageBlock(bl, b.dmg*0.5); } }
    if(b.left<=0 || fortIntactCross(px, pz, b.x, b.z)){ nova(b.x, b.z, b.dmg*1.6, b.R, now); drop(b.o); ULTI.orbs.splice(i,1); } }
  // black holes
  for(let i=ULTI.holes.length-1;i>=0;i--){ const h=ULTI.holes[i];
    if(h.phase==='fly'){ const k=Math.min(1,(now-h.t0)/h.fly), x=h.x0+(h.x-h.x0)*k, z=h.z0+(h.z-h.z0)*k, y=h.y0+(heightAt(h.x,h.z)+0.5-h.y0)*k + Math.sin(k*Math.PI)*9; h.o.position.set(x,y,z);
      if(Math.random()<0.7) spawnPart(x,y,z, 0,0,0, { color:0x9a5cff, size:0.7, life:0.35, grav:0, drag:1 }); if(k>=1) openHole(h, now); continue; }
    if(h.phase==='pull'){ const k=(now-h.t0)/h.dur; h.disk.rotation.z+=dt*4; h.halo.rotation.z-=dt*6; const s=1+Math.sin(now*9)*0.06+k*0.3; h.o.scale.setScalar(s);
      for(let n=0;n<4;n++){ const a=Math.random()*6.283, r=h.R*(0.5+Math.random()*0.5), sx=h.x+Math.sin(a)*r, sz=h.z+Math.cos(a)*r; spawnPart(sx, 0.6+Math.random()*2, sz, (h.x-sx)*1.6+Math.cos(a)*6, 0.4, (h.z-sz)*1.6-Math.sin(a)*6, { color:Math.random()<0.5?0xb070ff:0x2a0a40, size:0.6, life:0.5, grav:0, drag:0.4 }); }
      for(const e of targets()){ if(e.def.air) continue; const dx=h.x-e.pos.x, dz=h.z-e.pos.z, d=Math.hypot(dx,dz); if(d>h.R || d<0.6) continue;   // drag everything in, harder near the core
        const pull=Math.min(d-0.6, (4+(1-d/h.R)*18)*dt); e.pos.x+=dx/d*pull; e.pos.z+=dz/d*pull; if(e.vel){ e.vel.x*=0.9; e.vel.z*=0.9; } e.stunUntil=Math.max(e.stunUntil||0, now+0.2);
        damageEnemy(e, h.dmg*0.22*dt*(1+(1-d/h.R))); }
      if(boss && boss.alive && Math.hypot(boss.pos.x-h.x, boss.pos.z-h.z) < h.R) damageBoss(h.dmg*0.2*dt);
      if(k>=1){ aoeDamage(h.x, h.z, h.R*0.85, h.dmg*2.2, false, now, 'TBX', true, 2); bigExplode({ x:h.x, z:h.z }, 0xb070ff, h.R/2.4); bigExplode({ x:h.x, z:h.z }, 0xffffff, h.R/4);
        ringPulse({ x:h.x, y:0.2, z:h.z }, 0xe0c8ff, h.R*1.3); deformCrater(h.x, h.z, h.R*0.4, 1.1); S.shake=Math.min(7, S.shake+4); sfx('bigexplode'); drop(h.o); ULTI.holes.splice(i,1); } } }
  // photon beams
  for(let i=ULTI.beams.length-1;i>=0;i--){ const b=ULTI.beams[i], p=S.player; if(!p || now>=b.until){ drop(b.o); ULTI.beams.splice(i,1); continue; }
    const ang=p.aimSmoothed, mzl=p.muzzle; const _m=new THREE.Vector3(); (mzl||p.mesh).getWorldPosition(_m);
    const ax=_m.x, az=_m.z, ex=ax+Math.sin(ang)*b.R, ez=az+Math.cos(ang)*b.R, L=b.R, y=Math.max(1.3,_m.y);
    b.o.position.set(ax, y, az); b.o.rotation.y=ang; for(const m of [b.core, b.sheath]){ m.scale.set(1+Math.sin(now*60)*0.15, L, 1); m.position.z=L/2; }
    b.sheath.material.opacity=0.3+0.25*Math.random(); b.tip.position.z=L; b.tip.scale.setScalar(4+Math.random()*2.5);
    for(const e of targets()){ if(_segD(e.pos.x,e.pos.z,ax,az,ex,ez) < (e.r||1.5)+1.7){ damageEnemy(e, b.dps*dt); if(Math.random()<0.4) spawnPart(e.pos.x,1.4,e.pos.z,(Math.random()-0.5)*5,3,(Math.random()-0.5)*5,{ color:0xbfeaff, size:0.5, life:0.25, grav:6, drag:1 }); } }
    if(boss && boss.alive && _segD(boss.pos.x,boss.pos.z,ax,az,ex,ez) < 4) damageBoss(b.dps*dt);
    for(const bl of blocks.slice()){ if(_segD(bl.x,bl.z,ax,az,ex,ez) < (bl.r||1)+0.6) damageBlock(bl, b.dps*0.45*dt); }
    for(let k=0;k<2;k++){ const t=Math.random(); spawnPart(ax+(ex-ax)*t, 0.25, az+(ez-az)*t, 0, 1.2, 0, { color:0xff8a3a, size:0.7, life:0.5, smoke:false, grav:-1, drag:1.5 }); }   // the ground under it scorches
    S.shake=Math.min(2.2, S.shake+dt*2); } }
export function clearUltimates(){ for(const s of ULTI.strikes){ drop(s.ring); drop(s.guide); drop(s.col); } for(const b of ULTI.orbs) drop(b.o); for(const h of ULTI.holes) drop(h.o); for(const b of ULTI.beams) drop(b.o);
  ULTI.strikes.length=0; ULTI.orbs.length=0; ULTI.holes.length=0; ULTI.beams.length=0; }
