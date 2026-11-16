// campaign/artillery.js — ENEMY ARTILLERY: spotter locks, mortar strike zones with warning markers, shrapnel hit vs miss
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BALANCE } from '../../config.js';
import { S, aoeDamage, bigExplode, blastAllies, blastAllyTanks, boss, burst, core, damageCore, damagePlayer, damageSoldier, deformCrater, enemies, enemyPool, floatText, freeEnemyBar, heightAt, makeArtMissileMesh, muzzleLight, ringPulse, scene, sfx, showBanner, soldiers, spawnDebris, spawnPart, tip } from '../hub.js';

// ===== ARTILLERY LOCK — mortar barrage: lock the player's spot → red warning ring → arcing missile slams in =====
// Director alternates REST (calm) ↔ BARRAGE (a burst of locked strikes, warned in advance). Active only while
// mortar spotters are alive (stage≥2). dt-countdowns → freezes cleanly on pause.
export const artStrikes=[];                 // each: {tx,tz, state:'lock'|'fly', t, R, innerR, zone, blink, mesh, mx,my,mz, mvx,mvy,mvz}
export let ART={ phase:'rest', t:5 };
export function _artMortars(){ let n=0; for(const e of enemies) if(e.def.mortar) n++; return n; }
// Z188 STRIKE ZONE — a proper targeting picture: glowing red disc, a turning hazard-stripe band, a dashed outer ring, four chevrons that close in
//   on the centre as the lock tightens, a countdown arc that fills, a label with the seconds to impact; once the shell is in the air the zone
//   burns white-hot and the shell's shadow grows on the ground. ~15 meshes a zone (merged where they never move apart).
let _artTex=null;
function artTex(){ if(_artTex) return _artTex;
  const mk=(w,h,draw)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; };
  const disc=mk(256,256,(x)=>{ const g=x.createRadialGradient(128,128,0,128,128,128); g.addColorStop(0,'rgba(255,70,40,0.10)'); g.addColorStop(0.6,'rgba(255,50,30,0.22)'); g.addColorStop(0.93,'rgba(255,40,20,0.62)'); g.addColorStop(1,'rgba(255,40,20,0)'); x.fillStyle=g; x.fillRect(0,0,256,256); });
  const stripes=mk(256,256,(x)=>{ x.fillStyle='rgba(18,8,4,0.9)'; x.fillRect(0,0,256,256); x.fillStyle='#ffb21c'; for(let i=-256;i<512;i+=44){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+22,0); x.lineTo(i+22-256,256); x.lineTo(i-256,256); x.fill(); } });
  _artTex={ disc, stripes }; return _artTex; }
const _artM=(c,o,map,add)=>new THREE.MeshBasicMaterial({ color:c, map:map||null, transparent:true, opacity:o, side:THREE.DoubleSide, depthWrite:false, depthTest:false, blending:add===false?THREE.NormalBlending:THREE.AdditiveBlending });
function artLabel(){ const c=document.createElement('canvas'); c.width=320; c.height=80; const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:t, transparent:true, depthTest:false, depthWrite:false })); sp.scale.set(5.2,1.3,1); sp.renderOrder=21; sp.userData={ c, t, last:'' }; return sp; }
function drawLabel(sp, top, big, hot){ const u=sp.userData, key=top+big+hot; if(u.last===key) return; u.last=key; const x=u.c.getContext('2d'); x.clearRect(0,0,320,80);
  x.fillStyle=hot?'rgba(255,240,220,0.92)':'rgba(10,4,2,0.78)'; x.beginPath(); x.roundRect(20,10,280,60,12); x.fill(); x.strokeStyle=hot?'#fff':'#ff4a2a'; x.lineWidth=3; x.stroke();
  x.font='800 22px "Saira Condensed", Rajdhani, sans-serif'; x.textBaseline='middle'; x.textAlign='left'; x.fillStyle=hot?'#c01800':'#ffb21c'; x.fillText(top, 38, 40);
  x.font='800 34px "Saira Condensed", Rajdhani, sans-serif'; x.textAlign='right'; x.fillStyle=hot?'#c01800':'#fff'; x.fillText(big, 286, 41); u.t.needsUpdate=true; }
export function makeArtLock(x,z,R,innerR){
  const T=artTex(), root=new THREE.Group(), flat=new THREE.Group(); root.position.set(x, heightAt(x,z)+0.16, z); flat.rotation.x=-Math.PI/2; root.add(flat);
  const put=(geo,mat,ro)=>{ const m=new THREE.Mesh(geo,mat); m.renderOrder=ro||18; flat.add(m); return m; };
  const disc=put(new THREE.CircleGeometry(R,64), _artM(0xffffff,1,T.disc,false), 17);
  const hazard=put(new THREE.RingGeometry(R-0.7,R-0.16,72), _artM(0xffffff,0.85,T.stripes,false), 18);
  const edge=put(new THREE.RingGeometry(R-0.14,R+0.05,96), _artM(0xff3a24,0.95));
  const dashG=[]; for(let k=0;k<12;k++) dashG.push(new THREE.RingGeometry(R+0.38,R+0.62,6,1,k*Math.PI/6,Math.PI/10)); const dash=put(mergeGeometries(dashG), _artM(0xff6a3a,0.85)); dashG.forEach(g=>g.dispose());
  const inner=put(new THREE.RingGeometry(innerR-0.09,innerR+0.02,64), _artM(0xff7048,0.75));
  const arc=put(new THREE.RingGeometry(innerR+0.18,innerR+0.46,48,1,Math.PI/2,0.001), _artM(0xffd24a,0.95));
  const dia=put(new THREE.RingGeometry(0.34,0.5,4), _artM(0xffffff,0.9)); dia.rotation.z=Math.PI/4;
  const crossG=[new THREE.PlaneGeometry(1.5,0.08), new THREE.PlaneGeometry(0.08,1.5)]; const cross=put(mergeGeometries(crossG), _artM(0xff9a6a,0.9)); crossG.forEach(g=>g.dispose());
  const shadow=put(new THREE.CircleGeometry(1,40), _artM(0x000000,0,null,false), 19);
  const chev=[], cg=new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.55,0.42),new THREE.Vector2(0,-0.42),new THREE.Vector2(0.55,0.42),new THREE.Vector2(0,0.12)]));
  for(let k=0;k<4;k++){ const pv=new THREE.Group(); pv.rotation.z=k*Math.PI/2; flat.add(pv); const m=new THREE.Mesh(cg, _artM(0xffd24a,0.95)); m.renderOrder=20; pv.add(m); chev.push(m); }
  const label=artLabel(); label.position.set(0, 3.2, 0); root.add(label);
  root.userData={ disc, hazard, edge, dash, inner, arc, dia, cross, shadow, chev, label, R, innerR, cg }; scene.add(root); return root; }
// k: 0→1 how tight the lock is (1 while the shell is in the air) · fly: 0→1 shell flight progress (null while locking) · tLeft: seconds to impact
function tickArtLock(zone, k, fly, now, dt, tLeft){ const u=zone.userData, hot=fly!=null, pul=0.5+0.5*Math.sin(now*(hot?30:8+k*14));
  u.disc.material.opacity = hot ? 0.7+0.25*pul : 0.42+0.3*pul; u.disc.material.color.setHex(hot?0xfff0e0:0xffffff);
  u.hazard.rotation.z += dt*(0.25+k*0.9); u.dash.rotation.z -= dt*(0.8+k*2.5); u.dia.rotation.z += dt*3;
  u.edge.material.opacity = 0.6+0.4*pul; u.edge.material.color.setHex(hot?0xffffff:0xff3a24);
  const ease=hot?1:k*k*(3-2*k), r=(u.R+1.6)-((u.R+1.6)-(u.innerR+0.75))*ease;
  for(const c of u.chev){ c.position.set(0, r, 0); c.material.opacity = hot ? 0.6+0.4*pul : 0.95; c.material.color.setHex(hot?0xffffff:0xffd24a); }
  const span=Math.max(0.001, Math.PI*2*(hot?1:k)); u.arc.geometry.dispose(); u.arc.geometry=new THREE.RingGeometry(u.innerR+0.18,u.innerR+0.46,48,1,Math.PI/2,span); u.arc.material.opacity = hot ? 0.5+0.5*pul : 0.95;
  if(hot){ const s=0.6+fly*u.innerR*1.25; u.shadow.scale.set(s,s,1); u.shadow.material.opacity=0.12+0.5*fly; }
  drawLabel(u.label, hot?'ĐẠN ĐANG RƠI':'PHÁO KÍCH', hot?'TRÁNH RA!':Math.max(0,tLeft).toFixed(1)+'s', hot);
  u.label.position.y = 3.2+Math.sin(now*4)*0.12; }
export function disposeArtZone(zone){ if(!zone) return; scene.remove(zone); zone.traverse(c=>{ if(c.geometry) c.geometry.dispose(); if(c.material){ if(c.material.map && c.material.map!==_artTex?.disc && c.material.map!==_artTex?.stripes) c.material.map.dispose(); c.material.dispose(); } }); }
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
    if(s.zone){ const lock=s.state==='lock', k = lock ? (1-Math.max(0,s.t)/C.lockTime) : 1;   // Z188
      tickArtLock(s.zone, k, lock ? null : 1-Math.max(0,s.t)/C.flightTime, now, dt, lock ? Math.max(0,s.t)+C.flightTime : Math.max(0,s.t)); }
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
        s.mesh=makeArtMissileMesh(); s.mesh.position.set(s.mx,s.my,s.mz); scene.add(s.mesh); sfx('whistle');   // Z188 you hear it coming
      }
    } else { // flying — blazing arc + roiling smoke trail
      s.mvy-=C.gravity*dt; s.mx+=s.mvx*dt; s.my+=s.mvy*dt; s.mz+=s.mvz*dt; s.mesh.position.set(s.mx,s.my,s.mz);
      _artDir.set(s.mvx,s.mvy,s.mvz); if(_artDir.lengthSq()>1e-4){ _artDir.normalize(); s.mesh.quaternion.setFromUnitVectors(_artUP,_artDir); }
      if(s.mesh._plume) s.mesh._plume.scale.setScalar(2.3+Math.sin(now*42)*0.55);   // flickering engine plume
      if(s.mesh._tongue){ const f=0.85+Math.random()*0.35; s.mesh._tongue.scale.set(1, f, 1); s.mesh._tongue.material.opacity=0.55+Math.random()*0.3; }   // Z188
      { const bx=s.mx-_artDir.x*1.6, by=s.my-_artDir.y*1.6, bz=s.mz-_artDir.z*1.6;   // Z188 everything trails from the tail, along the flight line
        spawnPart(bx,by,bz,-_artDir.x*6+(Math.random()-0.5)*1.5,-_artDir.y*6,-_artDir.z*6+(Math.random()-0.5)*1.5,{color:0xfff0b0,size:1.3,life:0.16,grav:0,drag:6});           // white-hot exhaust core
        spawnPart(bx,by,bz,-_artDir.x*3+(Math.random()-0.5)*2,-_artDir.y*3,-_artDir.z*3+(Math.random()-0.5)*2,{color:0xff7a2e,color2:0xc0300a,size:1.9,life:0.38,grav:0.4,drag:2.6,op:0.85});   // fiery wake
        for(let q=0;q<2;q++) spawnPart(bx,by,bz,(Math.random()-0.5)*1.2,(Math.random()-0.5)*0.6,(Math.random()-0.5)*1.2,{color:q?0x6a5e52:0xb8ae9e,size:1.4+q*0.5,life:1.6+q*0.5,smoke:true,grav:-0.2,drag:1.2,grow:2.4,op:0.5});   // a thick rolling smoke ribbon
        if(Math.random()<0.4) spawnPart(bx,by,bz,(Math.random()-0.5)*7,(Math.random()-0.5)*7,(Math.random()-0.5)*7,{color:0xffd27a,size:0.3,life:0.35,grav:6,drag:1}); }   // sparks
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
export function removeEnemy(e){ const i=enemies.indexOf(e); if(i<0) return; enemies.splice(i,1); e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh);
  if(e.bar){ freeEnemyBar(e.bar); e.bar=null; } }   // Z111b the kamikaze's HP bar used to stay hanging in the air where it blew up
export function airstrike(now){
  const cx=S.aimPoint.x||0, cz=S.aimPoint.z||0;
  for(let i=0;i<7;i++){
    const ax=cx+(Math.random()-0.5)*22, az=cz+(Math.random()-0.5)*22, delay=0.3+i*0.12+Math.random()*0.2;
    ringPulse(new THREE.Vector3(ax,0,az), 0xff6030, 3);
    setTimeout(()=>{ if(S.mode!=='playing') return; bigExplode(new THREE.Vector3(ax,1,az),0xff7a3d,1.6); aoeDamage(ax,az,5,50,false,performance.now()/1000); }, delay*1000);
  }
}
