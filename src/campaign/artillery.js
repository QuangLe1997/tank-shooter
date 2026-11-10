// campaign/artillery.js — ENEMY ARTILLERY: spotter locks, mortar strike zones with warning markers, shrapnel hit vs miss
import * as THREE from 'three';
import { BALANCE } from '../../config.js';
import { S, aoeDamage, bigExplode, blastAllies, blastAllyTanks, boss, burst, core, damageCore, damagePlayer, damageSoldier, deformCrater, enemies, enemyPool, floatText, heightAt, makeArtMissileMesh, muzzleLight, ringPulse, scene, sfx, showBanner, soldiers, spawnDebris, spawnPart, tip } from '../hub.js';

// ===== ARTILLERY LOCK — mortar barrage: lock the player's spot → red warning ring → arcing missile slams in =====
// Director alternates REST (calm) ↔ BARRAGE (a burst of locked strikes, warned in advance). Active only while
// mortar spotters are alive (stage≥2). dt-countdowns → freezes cleanly on pause.
export const artStrikes=[];                 // each: {tx,tz, state:'lock'|'fly', t, R, innerR, zone, blink, mesh, mx,my,mz, mvx,mvy,mvz}
export let ART={ phase:'rest', t:5 };
export function _artMortars(){ let n=0; for(const e of enemies) if(e.def.mortar) n++; return n; }
// RADAR LOCK reticle — thin tech lines on the ground: outer danger ring + inner kill ring + crosshair + a sweeping radar line. Subtle, blinking.
export function makeArtLock(x,z,R,innerR){
  const grp=new THREE.Group(); grp.position.set(x,0.14,z); grp.rotation.x=-Math.PI/2;
  const items=[];
  const add=(geo,c,o,ro)=>{ const m=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,side:THREE.DoubleSide,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending})); m.renderOrder=ro||18; grp.add(m); items.push({m,base:o}); return m; };
  add(new THREE.RingGeometry(R-0.13,R,72), 0xff4632, 0.85);                 // thin outer danger ring
  add(new THREE.RingGeometry(innerR-0.09,innerR,52), 0xff7048, 0.6);        // faint inner "direct hit" ring
  for(let k=0;k<4;k++){ const t=add(new THREE.PlaneGeometry(0.1,1.0), 0xff5a3c, 0.8); const a=k*Math.PI/2; t.position.set(Math.cos(a)*(R-0.65), Math.sin(a)*(R-0.65), 0); t.rotation.z=a; }  // 4 tick marks at the edge
  add(new THREE.PlaneGeometry(1.1,0.07), 0xff8050, 0.9); add(new THREE.PlaneGeometry(0.07,1.1), 0xff8050, 0.9);   // small center crosshair (thin)
  const sweepPivot=new THREE.Group(); const sw=new THREE.Mesh(new THREE.PlaneGeometry(R-0.2,0.13), new THREE.MeshBasicMaterial({color:0xff9a5c,transparent:true,opacity:0.6,side:THREE.DoubleSide,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending})); sw.position.x=(R-0.2)/2; sw.renderOrder=18; sweepPivot.add(sw); grp.add(sweepPivot);   // radar sweep line (rotates)
  grp.userData={items, sweep:sweepPivot, sweepMat:sw.material};
  scene.add(grp); return grp;
}
export function disposeArtZone(zone){ if(!zone) return; scene.remove(zone); zone.traverse(c=>{ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }); }
export function _pickMortar(){ const ms=[]; for(const e of enemies) if(e.def.mortar) ms.push(e); return ms.length ? ms[(Math.random()*ms.length)|0] : null; }
export function artLockStrike(tx,tz){
  const C=BALANCE.artillery, R=C.radius;
  artStrikes.push({ tx,tz, state:'lock', t:C.lockTime, R, innerR:R*C.innerFrac, zone:makeArtLock(tx,tz,R,R*C.innerFrac), blink:0, rip:0, launcher:_pickMortar() });   // remember WHICH mortar fires this shell
  sfx('alarm');
}
// the firing mortar visibly recoils + a shell blasts UP out of its tube (so the green tank reads as the source)
export function fireSpotter(e){
  if(!e) e=_pickMortar(); if(!e) return;
  const x=e.pos.x, z=e.pos.z;
  e.hitT=Math.max(e.hitT,0.16); e.kbx+=(Math.random()-0.5)*3; e.kbz+=(Math.random()-0.5)*3;          // recoil kick
  spawnPart(x, 2.4, z, 0, 20, 0, {color:0xffe06a, size:1.6, life:0.3, grav:-8, drag:1});              // muzzle flash up the tube
  for(let i=0;i<7;i++) spawnPart(x, 2.5, z, (Math.random()-0.5)*3, 12+Math.random()*10, (Math.random()-0.5)*3, {color:0xffb24a, size:0.6, life:0.5, grav:9, drag:1});   // launch sparks
  spawnPart(x, 1.8, z, 0, 1, 0, {color:0x4a4038, size:2.2, life:0.7, smoke:true, grav:-0.5, drag:1.6, op:0.5});   // muzzle smoke
  ringPulse(e.pos, 0xc0e060, 1.9); sfx('rocketlaunch');
  muzzleLight.position.set(x,2.4,z); muzzleLight.color.setHex(0xc0e060); muzzleLight.intensity=3.4;
}
export function updateArtillery(dt, now){
  const C=BALANCE.artillery, mort=_artMortars();
  if(S.stage<2 || mort===0 || boss){ if(ART.phase!=='rest'){ ART.phase='rest'; ART.t=C.restMin; } return; }   // no spotters → stand down
  ART.t-=dt; if(ART.t>0) return;
  if(ART.phase==='rest'){ tip('arty'); ART.phase='warn'; ART.t=C.warnLead; showBanner('⚠ PHÁO KÍCH — DI CHUYỂN!', '#ff5a4a'); sfx('alarm'); }
  else if(ART.phase==='warn'){ ART.phase='barrage'; ART.shots=Math.min(C.shotsMax, C.shotsBase + mort*C.shotsPerMortar); ART.t=0; }
  else if(ART.phase==='barrage'){
    const p=S.player; if(p) artLockStrike(p.pos.x, p.pos.z);     // lock the player's CURRENT spot each shot → must keep moving (the firing mortar flashes at LAUNCH)
    ART.shots--;
    if(ART.shots<=0){ ART.phase='rest'; ART.t=C.restMin + Math.random()*(C.restMax-C.restMin); }
    else ART.t=C.shotSpacing;
  }
}
export const _artUP=new THREE.Vector3(0,1,0), _artDir=new THREE.Vector3();
export function updateArtStrikes(dt, now){
  const C=BALANCE.artillery;
  for(let i=artStrikes.length-1;i>=0;i--){ const s=artStrikes[i]; s.t-=dt;
    // RADAR LOCK reticle: blink faster + spin the sweep faster the closer to launch/impact
    if(s.zone){ const ud=s.zone.userData, k = s.state==='lock' ? (1-Math.max(0,s.t)/C.lockTime) : 1;
      const pul=0.22+0.78*Math.abs(Math.sin(now*(6+k*18)));         // hard urgent blink, quickens near launch
      for(const it of ud.items) it.m.material.opacity = it.base*pul;
      if(ud.sweep) ud.sweep.rotation.z += dt*(3.4+k*6);             // radar sweep spins faster as the lock tightens
      if(ud.sweepMat) ud.sweepMat.opacity = 0.3+0.45*pul; }
    if(s.state==='lock'){ const k=1-Math.max(0,s.t)/C.lockTime; s.rip-=dt;   // expanding danger WAVES — quicken as launch nears
      if(s.rip<=0){ s.rip=0.55-0.4*k; ringPulse({x:s.tx,z:s.tz}, 0xff4632, s.R*0.95); } }
    s.blink-=dt; if(s.blink<=0){ s.blink=0.34-(s.state==='lock'?0.22:0.28)*(s.state==='lock'?(1-Math.max(0,s.t)/C.lockTime):1); if(S.mode==='playing') sfx('beep'); }
    if(s.state==='lock'){
      if(s.t<=0){   // LAUNCH — shell blasts UP out of the firing mortar's tube and arcs to the locked spot
        s.state='fly'; s.t=C.flightTime;
        const L=s.launcher, alive = L && enemies.indexOf(L)>=0;
        if(alive){ s.mx=L.pos.x; s.mz=L.pos.z; s.my=2.6; fireSpotter(L); }              // origin = the mortar's tube; it recoils + flashes
        else { const ang=Math.random()*6.283, dist=18+Math.random()*10; s.mx=s.tx+Math.cos(ang)*dist; s.mz=s.tz+Math.sin(ang)*dist; s.my=26+Math.random()*6; sfx('rocketlaunch'); }   // fallback: from the sky if its mortar died
        const T=C.flightTime, G=C.gravity;
        s.mvx=(s.tx-s.mx)/T; s.mvz=(s.tz-s.mz)/T; s.mvy=G*T/2 + (heightAt(s.tx,s.tz)+0.6-s.my)/T;            // lob up then down to impact
        s.mesh=makeArtMissileMesh(); s.mesh.position.set(s.mx,s.my,s.mz); scene.add(s.mesh);
      }
    } else { // flying — blazing arc + roiling smoke trail
      s.mvy-=C.gravity*dt; s.mx+=s.mvx*dt; s.my+=s.mvy*dt; s.mz+=s.mvz*dt; s.mesh.position.set(s.mx,s.my,s.mz);
      _artDir.set(s.mvx,s.mvy,s.mvz); if(_artDir.lengthSq()>1e-4){ _artDir.normalize(); s.mesh.quaternion.setFromUnitVectors(_artUP,_artDir); }
      if(s.mesh._plume) s.mesh._plume.scale.setScalar(2.3+Math.sin(now*42)*0.55);   // flickering engine plume
      spawnPart(s.mx,s.my,s.mz,(Math.random()-0.5)*2,-0.4,(Math.random()-0.5)*2,{color:0xffd24a,size:1.0,life:0.22,grav:0,drag:6});            // hot flame core
      spawnPart(s.mx,s.my,s.mz,(Math.random()-0.5)*3,-0.4,(Math.random()-0.5)*3,{color:0xff7a2e,size:1.5,life:0.4,grav:0.6,drag:2.4,op:0.8});  // fiery wake
      if(Math.random()<0.7) spawnPart(s.mx,s.my,s.mz,(Math.random()-0.5)*2,0,(Math.random()-0.5)*2,{color:0x4a4038,size:1.5,life:0.7,smoke:true,grav:1,drag:1.5,op:0.45});
      if(s.my<=0.85 || s.t<=0){ artImpact(s, now); if(s.mesh) scene.remove(s.mesh);
        disposeArtZone(s.zone);
        artStrikes.splice(i,1); }
    }
  }
}
export function artImpact(s, now){
  const C=BALANCE.artillery, pos=new THREE.Vector3(s.tx,1.1,s.tz), sc=s.R/3.0, tx=s.tx, tz=s.tz; deformCrater(tx, tz, s.R*0.55, 0.55);   // enemy artillery cratering
  // ---- distance-graded damage FIRST → decide HIT (shrapnel) vs MISS (just fire+smoke) ----
  const grade=(ox,oz)=>{ const d=Math.hypot(ox-tx,oz-tz); if(d>s.R) return 0;
    return d<=s.innerR ? C.dmgMax : C.dmgMin + (C.dmgMax-C.dmgMin)*(1-(d-s.innerR)/(s.R-s.innerR)); };
  blastAllies(tx, tz, s.R, C.dmgMax); blastAllyTanks(tx, tz, s.R, C.dmgMax*0.6);                                              // Z104 our infantry caught in the barrage
  let hit=false; const p=S.player;
  if(p && now>=p.invincibleUntil){ const dmg=grade(p.pos.x,p.pos.z);
    if(dmg>0){ hit=true; const direct = Math.hypot(p.pos.x-tx,p.pos.z-tz)<=s.innerR;
      damagePlayer(Math.round(dmg), now); floatText(direct?'TRÚNG ĐÍCH!':'SƯỢT QUA', direct?'#ff4028':'#ffcf5a', new THREE.Vector3(p.pos.x,2.4,p.pos.z), direct?24:18); } }
  if(core){ const dc=grade(core.pos.x,core.pos.z); if(dc>0){ hit=true; damageCore(Math.round(dc*C.coreMul)); } }
  for(const sd of soldiers){ const ds=grade(sd.pos.x,sd.pos.z); if(ds>0){ hit=true; damageSoldier(sd, ds*C.coreMul); } }
  // ---- common: flash + impact rings + light ----
  burst(pos, 0xffffff, Math.floor((hit?11:7)*sc), 7*sc, {life:0.13, size:2.5*sc, up:2, grav:-2, drag:8});   // flash
  ringPulse({x:tx,z:tz}, 0xffd27a, s.R*(hit?1.0:0.7)); ringPulse({x:tx,z:tz}, 0xff5028, s.R*(hit?0.7:0.45));
  muzzleLight.position.set(tx,4,tz); muzzleLight.color.setHex(0xffae5c); muzzleLight.intensity=hit?9.5:5.5;
  if(hit){
    // ===== DIRECT HIT → grand devastation + METAL SHRAPNEL =====
    burst(pos, 0xffe8a0, Math.floor(22*sc), 13*sc, {life:0.4,  size:2.5*sc, up:6, drag:2});
    burst(pos, 0xff6a1c, Math.floor(18*sc), 11*sc, {life:0.5,  size:2.3*sc, up:5, drag:2});
    burst(pos, 0xc4301a, Math.floor(12*sc), 9*sc,  {life:0.55, size:2.0*sc, up:4, drag:2});
    burst(pos, 0xffe6a0, Math.floor(26*sc), s.R*2.3, {life:0.5, size:0.5*sc, up:4, grav:-10, drag:1.2});   // sparks to the edge
    spawnDebris(pos, 2.6, 0x6a5a3a); spawnDebris(pos, 1.6, 0x33302a);                                       // dirt + metal shards (only on a hit)
    ringPulse({x:tx,z:tz}, 0xffffff, s.R*1.15); ringPulse({x:tx,z:tz}, 0xff3018, s.innerR*1.5);
    for(let k=0;k<6;k++) setTimeout(()=>{ if(S.mode==='paused') return;
      burst({x:tx,z:tz}, k<2?0x2a221a:0x191510, 2, 3+k*0.7, {y:1.2+k*1.15, life:0.9+k*0.12, size:(2.1+k*0.55)*sc, smoke:true, grav:-0.6, drag:1.5, up:2.4, op:0.5}); }, k*55);   // mushroom column
    setTimeout(()=>{ if(S.mode!=='paused') burst({x:tx,z:tz}, 0x241c14, 7, 5.5*sc, {y:8, life:1.5, size:3.6*sc, smoke:true, grav:-0.3, drag:1.6, up:1, op:0.45}); }, 360);
    for(let k=0;k<7;k++){ const a=Math.random()*6.283, rr=s.R*(0.35+Math.random()*0.6);
      setTimeout(()=>{ if(S.mode==='paused') return; const ep={x:tx+Math.cos(a)*rr, z:tz+Math.sin(a)*rr};
        burst(ep, 0xffba5c, 6, 8, {life:0.34, size:1.5, up:4, drag:2.6}); burst(ep, 0xff5a1c, 4, 6, {life:0.42, size:1.3, drag:2.6}); ringPulse(ep, 0xffaa50, 2.3); }, 40+k*42); }   // secondary pops
    S.shake=Math.min(5.5, S.shake+3.4);
    sfx('bigexplode'); setTimeout(()=>{ if(S.mode!=='paused') sfx('explode'); }, 130);
  } else {
    // ===== MISS (you dodged) → just fire + smoke "xèo" — no shrapnel =====
    burst(pos, 0xffd28a, Math.floor(10*sc), 8*sc, {life:0.36, size:1.8*sc, up:4, drag:2.6});               // modest fireball
    burst(pos, 0xff7a2e, Math.floor(7*sc),  6*sc, {life:0.42, size:1.5*sc, up:3, drag:2.6});
    burst(pos, 0x8a7355, Math.floor(5*sc),  5*sc, {life:0.5,  size:1.0*sc, up:2, grav:5, drag:2});         // light dirt puff (no metal)
    for(let k=0;k<3;k++) setTimeout(()=>{ if(S.mode==='paused') return;
      burst({x:tx,z:tz}, 0x241c14, 2, 3+k, {y:1+k*0.7, life:0.7, size:(1.7+k*0.4)*sc, smoke:true, grav:-0.5, drag:1.6, up:2, op:0.4}); }, k*55);   // small smoke wisp
    S.shake=Math.min(2.8, S.shake+1.1);
    sfx('explode');
  }
}
export function clearArtillery(){ for(const s of artStrikes){ if(s.mesh) scene.remove(s.mesh); disposeArtZone(s.zone); } artStrikes.length=0; ART={phase:'rest', t:BALANCE.artillery.restMin}; }
export function removeEnemy(e){ const i=enemies.indexOf(e); if(i>=0) enemies.splice(i,1); e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); }
export function airstrike(now){
  const cx=S.aimPoint.x||0, cz=S.aimPoint.z||0;
  for(let i=0;i<7;i++){
    const ax=cx+(Math.random()-0.5)*22, az=cz+(Math.random()-0.5)*22, delay=0.3+i*0.12+Math.random()*0.2;
    ringPulse(new THREE.Vector3(ax,0,az), 0xff6030, 3);
    setTimeout(()=>{ if(S.mode!=='playing') return; bigExplode(new THREE.Vector3(ax,1,az),0xff7a3d,1.6); aoeDamage(ax,az,5,50,false,performance.now()/1000); }, delay*1000);
  }
}
