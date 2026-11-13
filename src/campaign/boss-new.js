// campaign/boss-new.js — Z161 the three new generals' weapons: HOẢ THẦN thermobaric salvos + burning ground + flame jet, MÃNG XÀ swinging tail + mortar battery, LÔI THẦN railgun + EMP + tesla arcs
import * as THREE from 'three';
import { S, beamReach, bigExplode, boss, bossAlive, bossMounts, bossSpread, bossSummon, damagePlayer, decalScorch, floatText, groundPound, gunMuzzleFX, heightAt, lightning, mountPos, muzzleLight, radio, railBeam, ringPulse, scene, sfx, spawnPart, wrapAngle } from '../hub.js';

export const NEW_GENERALS = ['inferno','serpent','thunder'];
export const FIREZ = [];                                   // burning ground: { x, z, r, until }
let _rail = null;
function railTel(){ if(!_rail){ _rail=new THREE.Mesh(new THREE.BoxGeometry(1,1,1).translate(0,0,0.5), new THREE.MeshBasicMaterial({ color:0xff2a2a, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); _rail.visible=false; scene.add(_rail); } return _rail; }
export function clearBossNew(){ FIREZ.length=0; if(_rail) _rail.visible=false; }

// a shell / rocket lobbed from P onto (x,z) in T seconds: a comet of particles along the arc, a telegraph ring, then the blast
export function lobShell(P, x, z, T, o){ const gy=heightAt(x,z), G=30, vx=(x-P.x)/T, vz=(z-P.z)/T, vy=(gy-P.y)/T+0.5*G*T, col=o.color||0xff8a1a;
  ringPulse({x,z}, 0xff3020, o.r); setTimeout(()=>{ if(S.mode==='playing') ringPulse({x,z}, 0xff3020, o.r*0.7); }, T*500);
  for(let k=0;k<7;k++) setTimeout(()=>{ if(S.mode!=='playing') return; const t=k*0.035;
    spawnPart(P.x+vx*t, P.y+vy*t-0.5*G*t*t, P.z+vz*t, vx, vy-G*t, vz, k===0 ? { color:0xfff2c0, size:1.1, life:T-t, grav:-G, drag:0 } : { color:k<3?col:0x6a5a4a, size:0.9-k*0.08, life:T-t, grav:-G, drag:0, smoke:k>=3, op:0.6 }); }, k*35);
  setTimeout(()=>{ if(S.mode!=='playing') return; const now=performance.now()/1000, p=S.player;
    bigExplode({x,z}, col, o.r/2.6); decalScorch(x, z, o.r*0.8, 0.9); S.shake=Math.min(3, S.shake+0.35);
    if(now>=p.invincibleUntil && (p.pos.x-x)**2+(p.pos.z-z)**2 < (o.r+p.radius)**2) damagePlayer(o.dmg, now, p.pos.x-x, p.pos.z-z);
    if(o.fire) FIREZ.push({ x, z, r:o.r*0.85, until:now+o.fire }); }, T*1000); }

// ---------------- attack menus ----------------
export function bossAttackNew(now, ph){ const B=boss, r=Math.random(), p=S.player, distP=Math.hypot(p.pos.x-B.pos.x, p.pos.z-B.pos.z);
  if(B.id==='inferno'){
    if(distP<17 && r<0.4){ B.flameUntil=now+1.7+ph*0.3; B.atkAt=now+2.6; sfx('shoot_flame', B.pos); }
    else if(r<0.75 && bossAlive('launcher')){ thermoSalvo(now, ph===2?12:ph===1?9:6); B.atkAt=now+(ph===2?2.4:3.0); }
    else if(r<0.9){ bossSpread(now, ph===2?9:6, 26); B.atkAt=now+1.8; }
    else { bossSummon('pyro', ph>=1?2:1); B.atkAt=now+3; }
  } else if(B.id==='serpent'){
    if(r<0.4 && bossAlive('mortar') && bossAlive('joint')){ mortarBarrage(now, ph===2?10:ph===1?8:6); B.atkAt=now+(ph===2?2.6:3.2); }
    else if(r<0.6){ tailSweep(now); B.atkAt=now+2.4; }
    else if(r<0.88){ bossSpread(now, ph===2?12:ph===1?8:5, 28); B.atkAt=now+1.7; }
    else { bossSummon(ph>=1?'heavy':'grunt', 2); B.atkAt=now+3.2; }
  } else {   // thunder
    if(r<0.45 && bossAlive('rail')){ const caps=['capL','capR'].filter(bossAlive).length; B.railTel=now+(caps===2?1.15:caps===1?1.45:1.85)-(ph>=2?0.2:0); B.railAng=B.aim; B.atkAt=B.railTel+(ph>=2?1.2:1.8); sfx('spell', B.pos); }
    else if(r<0.65 && distP<22){ empBurst(now); B.atkAt=now+2.8; }
    else if(r<0.85){ teslaArcs(now, ph>=1?4:3); B.atkAt=now+2.0; }
    else { bossSpread(now, ph===2?10:6, 34); B.atkAt=now+1.6; }
  } }

// HOẢ THẦN — a ripple of thermobaric rockets out of the launch box, each one a fireball that leaves the ground burning
export function thermoSalvo(now, n){ const tubes=bossMounts('tubes'), p=S.player, fuel=['fuelL','fuelR'].filter(bossAlive).length, burn=fuel===2?6:fuel===1?4:2.5;
  for(let i=0;i<n;i++) setTimeout(()=>{ if(!boss||!boss.alive||S.mode!=='playing') return; const P=tubes.length ? mountPos(tubes[(i*7)%tubes.length]) : boss.pos.clone().setY(4);
    const lead=0.9, a=Math.random()*6.283, rr=Math.random()*7, x=p.pos.x+(p.vel?p.vel.x*lead:0)+Math.cos(a)*rr, z=p.pos.z+(p.vel?p.vel.z*lead:0)+Math.sin(a)*rr;
    gunMuzzleFX({ flash:'launch', color:0xff8a1a }, P.x, P.y, P.z, Math.atan2(x-P.x, z-P.z), 1.6); sfx('rocketlaunch', P);
    lobShell(P, x, z, 1.15, { r:3.4, dmg:16, fire:burn, color:0xff8a1a }); }, i*110);
  radio('SCH: Rocket nhiệt áp! Ra khỏi vùng đỏ!'); }
// MÃNG XÀ — the rear unit's four mortars walk a pattern round you
export function mortarBarrage(now, n){ const tubes=bossMounts('mortar'), p=S.player;
  for(let i=0;i<n;i++) setTimeout(()=>{ if(!boss||!boss.alive||S.mode!=='playing') return; const P=tubes.length ? mountPos(tubes[i%tubes.length]) : boss.pos.clone().setY(4);
    const a=i/n*6.283+Math.random()*0.4, rr=i===0?0:3+Math.random()*7, x=p.pos.x+Math.cos(a)*rr, z=p.pos.z+Math.sin(a)*rr;
    gunMuzzleFX({ flash:'heavy', color:0x9dff8a }, P.x, P.y, P.z, Math.atan2(x-P.x, z-P.z), 1.4); sfx('shoot_hesh', P);
    lobShell(P, x, z, 1.6, { r:3.6, dmg:18, color:0x9dff8a }); }, i*180); }
export function tailSweep(now){ const tl=boss.mesh.userData.tail; if(tl) boss.whipUntil=now+0.6; groundPound(now); }
// LÔI THẦN — EMP: a collapsing ring of lightning; inside it your engine stalls (no dash) and the hull takes a jolt
export function empBurst(now){ const B=boss, acc=B.def.pal.accent; for(let k=0;k<3;k++) setTimeout(()=>{ if(boss===B) ringPulse(B.pos, acc, 6+k*6); }, k*140);
  setTimeout(()=>{ if(!boss||!boss.alive||S.mode!=='playing') return; const p=S.player, n=performance.now()/1000, d=Math.hypot(p.pos.x-B.pos.x, p.pos.z-B.pos.z);
    ringPulse(B.pos, 0xffffff, 20); S.shake=Math.min(3, S.shake+0.8); sfx('shoot_tesla', B.pos);
    for(let i=0;i<6;i++){ const a=i/6*6.283; lightning(new THREE.Vector3(B.pos.x, 3*B.def.scale/3+2, B.pos.z), new THREE.Vector3(B.pos.x+Math.cos(a)*16, 0.4, B.pos.z+Math.sin(a)*16), acc, 0.3, 0.5); }
    if(d<20 && n>=p.invincibleUntil){ damagePlayer(8, n); p.dashCdUntil=Math.max(p.dashCdUntil||0, n+4); floatText('EMP — ĐỘNG CƠ CHẾT MÁY', '#fff04a', p.pos, 18); } }, 650); }
export function teslaArcs(now, n){ const coils=bossMounts('coil'), B=boss;
  for(let i=0;i<n;i++) setTimeout(()=>{ if(!boss||!boss.alive||S.mode!=='playing') return; const p=S.player, P=coils.length ? mountPos(coils[i%coils.length]) : B.pos.clone().setY(4), n2=performance.now()/1000;
    const d=Math.hypot(p.pos.x-P.x, p.pos.z-P.z); if(d>24) return; lightning(P, new THREE.Vector3(p.pos.x, 1.3, p.pos.z), B.def.pal.accent, 0.25, 0.45); sfx('shoot_tesla', P);
    if(n2>=p.invincibleUntil) damagePlayer(6, n2, p.pos.x-P.x, p.pos.z-P.z); }, i*230); }

// ---------------- per-frame: burning ground, flame jet, tail swing, railgun charge/fire ----------------
export function updateBossNew(dt, now){ const B=boss, p=S.player;
  for(let i=FIREZ.length-1;i>=0;i--){ const F=FIREZ[i]; if(now>F.until){ FIREZ.splice(i,1); continue; }
    if(Math.random()<0.55){ const a=Math.random()*6.283, rr=Math.sqrt(Math.random())*F.r, x=F.x+Math.cos(a)*rr, z=F.z+Math.sin(a)*rr, y=heightAt(x,z);
      spawnPart(x, y+0.2, z, (Math.random()-0.5)*0.6, 2.6+Math.random()*2, (Math.random()-0.5)*0.6, { tex:'fire', color:0xffe0a0, color2:0xff4a10, size:1.1+Math.random()*0.8, grow:1.4, life:0.55, grav:0, drag:1.6 });
      if(Math.random()<0.3) spawnPart(x, y+1.6, z, 0, 2.4, 0, { color:0x1a1410, size:1.6, life:1.4, smoke:true, grav:-0.3, drag:1.2, grow:1.5, op:0.45 }); }
    if((p.pos.x-F.x)**2+(p.pos.z-F.z)**2 < (F.r+p.radius*0.6)**2 && now>(p._fireZT||0) && now>=p.invincibleUntil){ p._fireZT=now+0.33; damagePlayer(3.5, now); } }
  if(!B || !B.alive) return; const U=B.mesh.userData;
  if(B.id==='inferno' && now<(B.flameUntil||0)){ const fm=bossMounts('flame')[0]; if(fm){ const P=mountPos(fm), a=B.aim+Math.sin(now*5)*0.18, fx=Math.sin(a), fz=Math.cos(a);   // flame jet sweeps across you
      for(let k=0;k<3;k++){ const sp=24+Math.random()*10; spawnPart(P.x, P.y, P.z, fx*sp+(Math.random()-0.5)*4, 0.4+Math.random(), fz*sp+(Math.random()-0.5)*4, { tex:'fire', color:0xfff0b0, color2:0xff3a00, size:0.9, grow:3.4, life:0.55, grav:-1.5, drag:1.4 }); }
      muzzleLight.position.copy(P); muzzleLight.color.setHex(0xff7a1a); muzzleLight.intensity=Math.max(muzzleLight.intensity, 6);
      const dx=p.pos.x-P.x, dz=p.pos.z-P.z, d=Math.hypot(dx,dz); if(d<17 && Math.abs(wrapAngle(Math.atan2(dx,dz)-a))<0.32 && now>(B._flT||0) && now>=p.invincibleUntil){ B._flT=now+0.2; damagePlayer(5, now, dx, dz); }
      if(Math.random()<0.08) FIREZ.push({ x:P.x+fx*(8+Math.random()*7), z:P.z+fz*(8+Math.random()*7), r:2.2, until:now+3 }); } }
  if(U.tail){ const dF=wrapAngle(B.facing-(B._lf??B.facing))/Math.max(dt,1e-3); B._lf=B.facing;   // the rear unit lags behind the turn, and lashes out on a sweep
    const whip = now<(B.whipUntil||0) ? Math.sin((B.whipUntil-now)*16)*0.55 : 0, tgt=Math.max(-0.5, Math.min(0.5, -dF*0.35))+whip;
    U.tail.rotation.y += (tgt-U.tail.rotation.y)*Math.min(1, dt*(whip?14:3)); }
  if(B.id==='thunder' && B.railTel){ const T=railTel(), mz=bossMounts('main')[0], M=mz?mountPos(mz):B.pos.clone().setY(3);
    if(now < B.railTel){ if(now < B.railTel-0.35) B.railAng += wrapAngle(B.aim-B.railAng)*Math.min(1, dt*3);   // tracks you, then LOCKS for the last beat — that is your window to sidestep
      const reach=beamReach(B.pos.x, B.pos.z, B.railAng, 90), lock=now>=B.railTel-0.35; T.visible=true; T.position.set(M.x, heightAt(M.x, M.z)+1.1, M.z); T.rotation.set(0, B.railAng, 0); T.scale.set(lock?1.1:0.45, 0.25, reach);
      T.material.opacity = lock ? 0.85 : 0.35+0.25*Math.sin(now*30); T.material.color.setHex(lock?0xffffff:0xff2a2a);
      if(Math.random()<0.8){ const t=Math.random()*6.283, rr=2+Math.random()*2; spawnPart(M.x+Math.cos(t)*rr, M.y+(Math.random()-0.5)*1.5, M.z+Math.sin(t)*rr, -Math.cos(t)*rr*4, 0, -Math.sin(t)*rr*4, { color:B.def.pal.accent, size:0.35, life:0.25, grav:0, drag:0.3 }); } }
    else { B.railTel=0; T.visible=false; const reach=beamReach(B.pos.x, B.pos.z, B.railAng, 90), fx=Math.sin(B.railAng), fz=Math.cos(B.railAng), E=new THREE.Vector3(B.pos.x+fx*reach, 1.2, B.pos.z+fz*reach);
      railBeam(new THREE.Vector3(M.x, M.y, M.z), E); lightning(new THREE.Vector3(M.x, M.y, M.z), E, B.def.pal.accent, 0.3, 0.6);
      gunMuzzleFX({ flash:'rail', color:B.def.pal.accent }, M.x, M.y, M.z, B.railAng, 4); bigExplode({ x:E.x, z:E.z }, B.def.pal.accent, 1.3); decalScorch(E.x, E.z, 1.8, 1);
      muzzleLight.position.copy(M); muzzleLight.color.setHex(B.def.pal.accent); muzzleLight.intensity=12; S.shake=Math.min(3.4, S.shake+1.4); sfx('shoot_railgun', M, 1.4);
      const dx=p.pos.x-B.pos.x, dz=p.pos.z-B.pos.z, along=dx*fx+dz*fz; if(along>0 && along<reach && Math.abs(-fz*dx+fx*dz)<1.9 && now>=p.invincibleUntil) damagePlayer(38, now, fx, fz); } } }
