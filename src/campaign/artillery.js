// campaign/artillery.js — ENEMY ARTILLERY: spotter locks, mortar strike zones with warning markers, shrapnel hit vs miss
import * as THREE from 'three';
import { BALANCE } from '../../config.js';
import { duelOn, BIOME, MODE, MOBILE, S, UNDER, aoeDamage, artyErr, artyRestMul, artyShotCut, bigExplode, blastAllies, blastLight, core, damageCore, damagePlayer, damageSoldier, decalScorch, deformCrater, dirtGeyser, enemies, enemyPool, floatText, freeEnemyBar, groundNormal, heightAt, makeArtMissileMesh, muzzleLight, ringPulse, scene, sfx, showBanner, soldiers, spawnDebris, spawnPart, tip, blRamp, holoGain, holoRing } from '../hub.js';

// ===== ARTILLERY LOCK — mortar barrage: lock the player's spot → red warning ring → arcing missile slams in =====
// Director alternates REST (calm) ↔ BARRAGE (a burst of locked strikes, warned in advance). Active only while
// mortar spotters are alive (stage≥2). dt-countdowns → freezes cleanly on pause.
export const artStrikes=[];                 // each: {tx,tz, state:'lock'|'fly', t, R, innerR, zone, blink, mesh, mx,my,mz, mvx,mvy,mvz}
export let ART={ phase:'rest', t:5 };
export function _artMortars(){ let n=0; for(const e of enemies) if(e.def.mortar) n++; return n; }
// Z188 STRIKE ZONE · Z213 kept simple: ONE thin red ring on the ground round the spot that will be hit, blinking — slowly while the
//   gunners lock, faster and faster as the shell nears, rapid once it is in the air (the falling shell's shadow grows inside it). No discs,
//   stripes, closing arrows, text or rippling waves.
const _artM=(c,o)=>new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:o, side:THREE.DoubleSide, depthWrite:false, depthTest:false, blending:THREE.NormalBlending });
export function makeArtLock(x,z,R,innerR){
  const root=new THREE.Group(), flat=new THREE.Group(); root.position.set(x, heightAt(x,z)+0.16, z); flat.rotation.x=-Math.PI/2; root.add(flat);
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), groundNormal(x, z, new THREE.Vector3()));   // Z215 the ring lies on the slope
  const edge=holoRing(R, { kind:'danger', flat:false, ticks:Math.round(R*6), tickLen:Math.min(0.45, R*0.07), spin:0.025 }); flat.add(edge);   // Z318 one thin hot red line with a soft glow (battle light), fine ticks turning
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,40), _artM(0x000000,0)); shadow.renderOrder=19; flat.add(shadow);
  root.userData={ edge, shadow, R, innerR }; root.visible=!!MODE.rings; scene.add(root); return root; }   // Z403 a soldier's war lays the zone but never draws it
// k: 0→1 how tight the lock is (1 while the shell is in the air) · fly: 0→1 shell flight progress (null while locking)
export function tickArtLock(zone, k, fly, now, dt){ const u=zone.userData, hot=fly!=null;   // Z318 a smooth pulse that quickens warn → critical as the lock tightens (never a hard strobe), the line burning hotter
  u.edge.material.opacity = blRamp(u, dt||0.016, hot ? 1 : k, 'warn', 'crit', hot ? 0.42 : 0.22); holoGain(u.edge, 2.4 + (hot ? 1.3 : k*0.9));
  if(hot){ const s=0.6+fly*u.innerR*1.25; u.shadow.scale.set(s,s,1); u.shadow.material.opacity=0.08+0.3*fly; } }
export function disposeArtZone(zone){ if(!zone) return; scene.remove(zone); zone.traverse(c=>{ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }); }
export function _pickMortar(){ const ms=[]; for(const e of enemies) if(e.def.mortar) ms.push(e); return ms.length ? ms[(Math.random()*ms.length)|0] : null; }
export function artLockStrike(tx,tz){ if(!MODE.arty) return;   // Z403 no enemy artillery in a soldier's war
  const C=BALANCE.artillery, R=C.radius;
  artStrikes.push({ tx,tz, state:'lock', t:C.lockTime, R, innerR:R*C.innerFrac, zone:makeArtLock(tx,tz,R,R*C.innerFrac), blink:0, rip:0, launcher:_pickMortar() });   // remember WHICH mortar fires this shell
  sfx('alarm');
}
// the firing mortar visibly recoils + a shell blasts UP out of its tube (so the green tank reads as the source)
export function fireSpotter(e){
  if(!e) e=_pickMortar(); if(!e) return;
  const x=e.pos.x, z=e.pos.z;
  e.hitT=Math.max(e.hitT,0.16); e.kbx+=(Math.random()-0.5)*3; e.kbz+=(Math.random()-0.5)*3;          // recoil kick
  // Z218 the launch: a blinding flash up the tube, a hard backblast of white smoke and a ring of dust thrown off the ground round the launcher
  spawnPart(x, 2.6, z, 0, 4, 0, { tex:'flash', color:0xfff4d8, size:4.5, life:0.08, grav:0, drag:8 });
  for(let i=0;i<4;i++) spawnPart(x, 2.4, z, (Math.random()-0.5)*2, 6+Math.random()*6, (Math.random()-0.5)*2, { tex:'fire', color:0xfff0c0, color2:0xff6a1a, size:1.2, grow:1.4, life:0.22, grav:0, drag:4 });
  for(let i=0;i<(MOBILE?5:10);i++){ const a=Math.random()*6.283; spawnPart(x+Math.cos(a)*0.8, 1.6+Math.random(), z+Math.sin(a)*0.8, Math.cos(a)*3, 1+Math.random()*2, Math.sin(a)*3, { color:0xe0dcd2, size:1.6+Math.random(), life:2.6+Math.random(), smoke:true, grav:0.2, drag:1.2, grow:2.2, op:0.6, keep:true }); }
  { const gy=heightAt(x,z); for(let i=0;i<(MOBILE?7:14);i++){ const a=i/(MOBILE?7:14)*6.283; spawnPart(x+Math.cos(a)*1.2, gy+0.4, z+Math.sin(a)*1.2, Math.cos(a)*8, 0.6, Math.sin(a)*8, { color:BIOME.ground, size:1.4, life:1.4, smoke:true, grav:-0.2, drag:2.2, grow:1.8, op:0.5, keep:true }); } }
  sfx('rocketlaunch');
  muzzleLight.position.set(x,2.4,z); muzzleLight.color.setHex(0xffd090); muzzleLight.intensity=5;
}
export function updateArtillery(dt, now){ if(UNDER.on) return;   // Z226
  const C=BALANCE.artillery, mort=_artMortars();
  if(S.stage<2 || mort===0 || duelOn() || !MODE.arty){ if(ART.phase!=='rest'){ ART.phase='rest'; ART.t=C.restMin; } return; }   // no spotters → stand down (Z403 never in a soldier's war)
  ART.t-=dt; if(ART.t>0) return;
  if(ART.phase==='rest'){ tip('arty'); ART.phase='warn'; ART.t=C.warnLead; showBanner('⚠ PHÁO KÍCH — DI CHUYỂN!', '#ff5a4a'); sfx('alarm'); }
  else if(ART.phase==='warn'){ ART.phase='barrage'; ART.shots=Math.max(1, Math.min(C.shotsMax, C.shotsBase + mort*C.shotsPerMortar) - artyShotCut()); ART.t=0; }   // Z197 no radar → fewer shells
  else if(ART.phase==='barrage'){
    const p=S.player, er=artyErr(), ea=Math.random()*6.283, ed=er*(0.5+Math.random()*0.7); if(p) artLockStrike(p.pos.x+Math.cos(ea)*ed, p.pos.z+Math.sin(ea)*ed);   // Z197 blind without the radar: the shells land wide     // lock the player's CURRENT spot each shot → must keep moving (the firing mortar flashes at LAUNCH)
    ART.shots--;
    if(ART.shots<=0){ ART.phase='rest'; ART.t=(C.restMin + Math.random()*(C.restMax-C.restMin))*artyRestMul(); }   // Z197 … and the barrages come less often
    else ART.t=C.shotSpacing;
  }
}
export const _artUP=new THREE.Vector3(0,1,0), _artDir=new THREE.Vector3(), _artRq=new THREE.Quaternion();
export function updateArtStrikes(dt, now){
  const C=BALANCE.artillery;
  for(let i=artStrikes.length-1;i>=0;i--){ const s=artStrikes[i]; s.t-=dt;
    // RADAR LOCK reticle: blink faster + spin the sweep faster the closer to launch/impact
    if(s.zone){ const lock=s.state==='lock', k = lock ? (1-Math.max(0,s.t)/C.lockTime) : 1;   // Z188
      tickArtLock(s.zone, k, lock ? null : 1-Math.max(0,s.t)/C.flightTime, now, dt); }
    s.blink-=dt; if(s.blink<=0){ s.blink=0.5-(s.state==='lock'?0.22:0.3)*(s.state==='lock'?(1-Math.max(0,s.t)/C.lockTime):1); if(S.mode==='playing') sfx('beep'); }
    if(s.state==='lock'){
      if(s.t<=0){   // LAUNCH — shell blasts UP out of the firing mortar's tube and arcs to the locked spot
        s.state='fly'; s.t=C.flightTime;
        const L=s.launcher, alive = L && enemies.indexOf(L)>=0;
        if(alive){ s.mx=L.pos.x; s.mz=L.pos.z; s.my=2.6; fireSpotter(L); }              // origin = the mortar's tube; it recoils + flashes
        else { const ang=Math.random()*6.283, dist=18+Math.random()*10; s.mx=s.tx+Math.cos(ang)*dist; s.mz=s.tz+Math.sin(ang)*dist; s.my=26+Math.random()*6; sfx('rocketlaunch'); }   // fallback: from the sky if its mortar died
        const T=C.flightTime, G=C.gravity;
        s.mvx=(s.tx-s.mx)/T; s.mvz=(s.tz-s.mz)/T; s.mvy=G*T/2 + (heightAt(s.tx,s.tz)+0.6-s.my)/T;            // lob up then down to impact
        s.mesh=makeArtMissileMesh(); s.mesh.position.set(s.mx,s.my,s.mz); scene.add(s.mesh); sfx('whistle');   // Z188 you hear it coming
      }
    } else { // Z218 flying: the motor burns for the first half of the flight (flame + a thick, lingering smoke trail), then it falls silent, trailing a wisp
      s.age=(s.age||0)+dt; const burn=s.age<C.flightTime*0.55;
      s.mvy-=C.gravity*dt; s.mx+=s.mvx*dt; s.my+=s.mvy*dt; s.mz+=s.mvz*dt; s.mesh.position.set(s.mx,s.my,s.mz);
      _artDir.set(s.mvx,s.mvy,s.mvz); if(_artDir.lengthSq()>1e-4){ _artDir.normalize(); s.mesh.quaternion.setFromUnitVectors(_artUP,_artDir); s.roll=(s.roll||0)+dt*7; _artRq.setFromAxisAngle(_artUP, s.roll); s.mesh.quaternion.multiply(_artRq); }
      const m=s.mesh; if(m._tongue){ m._tongue.visible=m._inner.visible=m._plume.visible=burn; if(burn){ const f=0.8+Math.random()*0.45; m._tongue.scale.set(1,f,1); m._tongue.material.opacity=0.6+Math.random()*0.3; m._plume.scale.setScalar(1.1+Math.random()*0.6); } }
      const k=1.25, tx=s.mx-_artDir.x*1.75*k, ty=s.my-_artDir.y*1.75*k, tz=s.mz-_artDir.z*1.75*k, step=burn?(MOBILE?0.55:0.26):1.4;
      if(s.lx==null){ s.lx=tx; s.ly=ty; s.lz=tz; }
      const dx=tx-s.lx, dy=ty-s.ly, dz=tz-s.lz, L=Math.hypot(dx,dy,dz);
      if(L>=step){ const n=Math.min(40, Math.floor(L/step));
        for(let q=1;q<=n;q++){ const f=q*step/L, px=s.lx+dx*f, py=s.ly+dy*f, pz=s.lz+dz*f;
          if(burn) spawnPart(px+(Math.random()-0.5)*0.25,py+(Math.random()-0.5)*0.25,pz+(Math.random()-0.5)*0.25, (Math.random()-0.5)*0.6+0.25, 0.2+Math.random()*0.3, (Math.random()-0.5)*0.6+0.1, { color:Math.random()<0.7?0xdedad2:0xbab4aa, size:1.0+Math.random()*0.5, life:2.6+Math.random()*1.2, smoke:true, grav:0.12, drag:1.0, grow:2.6, op:0.55, keep:true });   // a thick white trail that hangs and spreads
          else if(Math.random()<0.6) spawnPart(px,py,pz, 0, 0.1, 0, { color:0xb4aea4, size:0.45, life:1.2, smoke:true, grav:0.1, drag:1.2, grow:1.6, op:0.22, keep:true }); }   // after burnout, only a wisp
        if(L/step>40){ s.lx=tx; s.ly=ty; s.lz=tz; } else { const f=n*step/L; s.lx+=dx*f; s.ly+=dy*f; s.lz+=dz*f; } }
      if(burn){ spawnPart(tx,ty,tz, -_artDir.x*9, -_artDir.y*9, -_artDir.z*9, { tex:'fire', color:0xfff6dc, color2:0xff8a2a, size:0.7+Math.random()*0.3, life:0.09, grav:0, drag:6, grow:0.5 });   // white-hot exhaust jet
        if(Math.random()<0.25) spawnPart(tx,ty,tz, (Math.random()-0.5)*4, (Math.random()-0.5)*4, (Math.random()-0.5)*4, { color:0xffd890, color2:0xff6a10, size:0.12, life:0.4, grav:-6, drag:1 }); }   // a few embers
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
  blastAllies(tx, tz, s.R, C.dmgMax);                                              // Z104 our infantry caught in the barrage
  let hit=false; const p=S.player;
  if(p && now>=p.invincibleUntil){ const dmg=grade(p.pos.x,p.pos.z);
    if(dmg>0){ hit=true; const direct = Math.hypot(p.pos.x-tx,p.pos.z-tz)<=s.innerR;
      damagePlayer(Math.round(dmg), now); floatText(direct?'PHÁO ĐỊCH TRÚNG!':'PHÁO ĐỊCH SƯỢT QUA', direct?'#ff4028':'#ffcf5a', new THREE.Vector3(p.pos.x,2.4,p.pos.z), direct?24:18); } }
  if(core){ const dc=grade(core.pos.x,core.pos.z); if(dc>0){ hit=true; damageCore(Math.round(dc*C.coreMul)); } }
  for(const sd of soldiers){ const ds=grade(sd.pos.x,sd.pos.z); if(ds>0){ hit=true; damageSoldier(sd, ds*C.coreMul); } }
  // ---- Z218 what the eye sees: a white flash, a rolling fireball, a dark geyser of soil, a dust shockwave rushing out along the ground,
  //      flying dirt, a scorch, then a smoke column that climbs slowly and hangs (bigger + shrapnel when it caught someone) ----
  const K=hit?1.25:0.9, gy=heightAt(tx,tz);
  spawnPart(tx, gy+1.2, tz, 0, 0, 0, { tex:'flash', color:0xffffff, size:9*K, life:0.09, grav:0, drag:8 }); blastLight(tx, tz, 70*K, 0.4);
  for(let k=0;k<(MOBILE?5:9);k++){ const a=Math.random()*6.283, v=2+Math.random()*4; spawnPart(tx, gy+1, tz, Math.cos(a)*v, 2+Math.random()*4, Math.sin(a)*v, { tex:'fire', color:0xfff0c0, color2:0xff4a10, size:(1.8+Math.random()*1.2)*K, grow:1.6, life:0.4+Math.random()*0.25, grav:1.5, drag:2.6 }); }
  dirtGeyser(tx, tz, 1.5*K);
  for(let k=0;k<(MOBILE?10:20);k++){ const a=k/(MOBILE?10:20)*6.283; spawnPart(tx+Math.cos(a)*1.5, gy+0.5, tz+Math.sin(a)*1.5, Math.cos(a)*(14+Math.random()*4)*K, 0.6, Math.sin(a)*(14+Math.random()*4)*K, { color:BIOME.ground, size:1.8*K, life:1.4+Math.random()*0.5, smoke:true, grav:-0.2, drag:2.6, grow:2.0, op:0.55, keep:true }); }   // shockwave dust ring
  spawnDebris(pos, 2.2*K, 0x6e6658); decalScorch(tx, tz, s.R*0.55, 1);
  for(let k=0;k<(MOBILE?4:7);k++){ const a=Math.random()*6.283, r=Math.random()*s.R*0.5; spawnPart(tx+Math.cos(a)*r, gy+0.8, tz+Math.sin(a)*r, Math.cos(a)*1.2, 0.5, Math.sin(a)*1.2, { color:0x8a8070, size:(3.0+Math.random()*1.5)*K, life:3.5+Math.random(), smoke:true, grav:0.05, drag:1.0, grow:1.7, op:0.55, keep:true }); }   // the dust cloud that hangs over the hole
  for(let k=0;k<6;k++) setTimeout(()=>{ if(S.mode==='paused') return; spawnPart(tx+(Math.random()-0.5)*1.5, gy+1.2+k*1.4, tz+(Math.random()-0.5)*1.5, 0.3, 1.6-k*0.18, 0.1, { color:k<3?0x221c16:0x3a342c, size:(3.2+k*0.8)*K, life:4.5+k*0.5, smoke:true, grav:0.25, drag:1.0, grow:1.7, op:0.78, keep:true }); }, k*70);   // the black smoke column, climbing and hanging
  muzzleLight.position.set(tx,4,tz); muzzleLight.color.setHex(0xffae5c); muzzleLight.intensity=hit?9.5:5.5;
  if(hit){ for(let k=0;k<(MOBILE?12:24);k++){ const a=Math.random()*6.283, v=12+Math.random()*16; spawnPart(tx, gy+1, tz, Math.cos(a)*v, 2+Math.random()*7, Math.sin(a)*v, { color:0xffe6a0, color2:0xff5a10, size:0.16, life:0.5+Math.random()*0.4, grav:-14, drag:0.6 }); }   // shrapnel
    spawnDebris(pos, 1.6, 0x33302a); S.shake=Math.min(5.5, S.shake+3.4); sfx('bigexplode'); setTimeout(()=>{ if(S.mode!=='paused') sfx('explode'); }, 130); }
  else { S.shake=Math.min(2.8, S.shake+1.1); sfx('explode'); }
}
export function clearArtillery(){ for(const s of artStrikes){ if(s.mesh) scene.remove(s.mesh); disposeArtZone(s.zone); } artStrikes.length=0; ART={phase:'rest', t:BALANCE.artillery.restMin}; }
export function removeEnemy(e){ const i=enemies.indexOf(e); if(i<0) return; enemies.splice(i,1); e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh);
  if(e.bar){ freeEnemyBar(e.bar); e.bar=null; } }   // Z111b the kamikaze's HP bar used to stay hanging in the air where it blew up
export function airstrike(now){
  const cx=S.aimPoint.x||0, cz=S.aimPoint.z||0;
  for(let i=0;i<7;i++){
    const ax=cx+(Math.random()-0.5)*22, az=cz+(Math.random()-0.5)*22, delay=0.3+i*0.12+Math.random()*0.2;
    if(MODE.rings) ringPulse(new THREE.Vector3(ax,0,az), 0xff6030, 3);   // (Z403 no warning ring in a soldier's war)
    setTimeout(()=>{ if(S.mode!=='playing') return; bigExplode(new THREE.Vector3(ax,1,az),0xff7a3d,1.6); aoeDamage(ax,az,5,50,false,performance.now()/1000); }, delay*1000);
  }
}
