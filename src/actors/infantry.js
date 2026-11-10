// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { BALANCE, ENV, INFANTRY, EQUIP } from '../../config.js';
import { ARENA, BIOME, ENVMOD, S, _cv, addScore, animateSoldier, blocks, burst, cMod, diffDmgMul, diffScale, enemies, enemyPool, floatText, haptic, heightAt, hitsHull, inSmoke, killEnemy, launchEnemyMissile, loopDmgMul, makeSoldierMesh, ringPulse, scene, sfx, spawnBullet, spawnEnemy, spawnPart, wrapAngle } from '../hub.js';

// ===== Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take pot-shots, kneel to fire rockets…
// …and a tank rolling over them crushes them flat. Lives in enemies[] (def.inf) so every gun, drone, guard & blast already sees them. =====
export const INF_DEAD=[];
export const solidTank = e => !(e.def.bomber || e.def.inf || e.def.air);          // things that collide like a hull
export function smokeSpread(now){ return inSmoke(now) ? EQUIP.smoke.spreadMul : 1; }   // SMOKE screen ruins enemy aim
export function infMesh(type){
  const g=makeSoldierMesh({enemy:true}), u=g.userData;
  if(type==='rpg'){                                                          // shoulder-fired launcher instead of a carbine
    const tm=new THREE.MeshStandardMaterial({color:0x4a5530,roughness:0.75,metalness:0.25}), dm=new THREE.MeshStandardMaterial({color:0x2c2c22,roughness:0.6,metalness:0.4});
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.065,1.0,10), tm); tube.rotation.x=Math.PI/2; tube.position.set(0.17,0.66,0.08); u.up.add(tube);
    const war=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.34,10), dm); war.rotation.x=Math.PI/2; war.position.set(0.17,0.66,0.72); u.up.add(war);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.14,0.06), dm); grip.position.set(0.17,0.55,0.18); u.up.add(grip);
    u.gun.visible=false; const mz=new THREE.Object3D(); mz.position.set(0.17,0.66,0.9); u.up.add(mz); u.muzzle=mz; }
  g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  scene.add(g); return g;
}
export function spawnSquad(sp){
  const S2=INFANTRY.squad, n=S2.size[0]+((Math.random()*(S2.size[1]-S2.size[0]+1))|0);
  const nr = S.stage>=S2.rpgFrom ? (S.stage>=4?2:1) : 0, ix=-Math.sign(sp.x)||0, iz=-Math.sign(sp.z)||0;
  for(let k=0;k<n;k++){ const x=sp.x+ix*(1+Math.random()*3)+(Math.random()-0.5)*6, z=sp.z+iz*(1+Math.random()*3)+(Math.random()-0.5)*6;
    spawnEnemy(k<nr?'rpg':'rifle', x, z); }
  ringPulse(new THREE.Vector3(sp.x,0,sp.z), 0xd8b070, 2.4);
}
export function updateInfantry(e, dt, now, edt){
  const def=e.def, p=S.player, u=e.mesh.userData, dx=p.pos.x-e.pos.x, dz=p.pos.z-e.pos.z, d=Math.hypot(dx,dz)||1, ux=dx/d, uz=dz/d;
  let mx=0, mz=0, sp=def.speed;
  const closing = -(p.vel.x*ux + p.vel.z*uz);                              // how fast the tank is bearing down on this soldier
  if(d<10 && closing>7){ e.side=e.side||(Math.random()<0.5?-1:1); mx=-uz*e.side; mz=ux*e.side; sp*=1.9; e.aimT=0; }   // SCATTER — dive out of the tank's path
  else if(e.aimT>0){ }                                                       // kneeling with the launcher up: hold still
  else if(d>def.keep+2){ mx=ux; mz=uz; } else if(d<def.keep-5){ mx=-ux*0.8; mz=-uz*0.8; }
  e.ph+=dt; const w=Math.sin(e.ph*0.9)*0.6; mx+=-uz*w*0.55; mz+=ux*w*0.55;    // weave — a squad never walks in a conga line
  for(const o of enemies){ if(o===e || !o.def.inf) continue; const ox=e.pos.x-o.pos.x, oz=e.pos.z-o.pos.z, q=ox*ox+oz*oz; if(q<5 && q>1e-4){ const k=(2.24-Math.sqrt(q))*0.8; mx+=ox*k; mz+=oz*k; } }
  const ox0=e.pos.x, oz0=e.pos.z, ml=Math.hypot(mx,mz);
  if(ml>0.05 && !(e.aimT>0)){ e.pos.x+=mx/ml*sp*edt; e.pos.z+=mz/ml*sp*edt; }
  if(e.kbx||e.kbz){ e.pos.x+=e.kbx*edt; e.pos.z+=e.kbz*edt; const kf=Math.max(0,1-dt*9); e.kbx*=kf; e.kbz*=kf; }
  for(const bl of blocks){ if(bl.obb){ const s_=Math.sin(bl.obb.f), c_=Math.cos(bl.obb.f), dx_=e.pos.x-bl.x, dz_=e.pos.z-bl.z, al=dx_*s_+dz_*c_, ac=dx_*c_-dz_*s_, hw=bl.obb.hw+0.4; if(Math.abs(al)<bl.obb.hl+0.3 && Math.abs(ac)<hw){ const push=(ac<0?-hw:hw)-ac; e.pos.x+=c_*push; e.pos.z-=s_*push; } continue; } const bx=e.pos.x-bl.x, bz=e.pos.z-bl.z, q=bx*bx+bz*bz, rr=bl.r+0.45; if(q<rr*rr && q>1e-4){ const qq=Math.sqrt(q); e.pos.x=bl.x+bx/qq*rr; e.pos.z=bl.z+bz/qq*rr; } }
  const lim=ARENA-2; e.pos.x=Math.max(-lim,Math.min(lim,e.pos.x)); e.pos.z=Math.max(-lim,Math.min(lim,e.pos.z));
  const moved=Math.hypot(e.pos.x-ox0, e.pos.z-oz0), inRange=d<def.range;
  const want = (inRange || moved<0.002) ? Math.atan2(dx,dz) : Math.atan2(e.pos.x-ox0, e.pos.z-oz0);
  e.facing += wrapAngle(want-e.facing)*Math.min(1,dt*9);
  e.mesh.position.set(e.pos.x, heightAt(e.pos.x,e.pos.z), e.pos.z); e.mesh.rotation.y=e.facing;
  let fired=false; const ds=diffScale(), A=BALANCE.aggro;
  const dmgMul = (0.7+0.3*ds)*loopDmgMul()*cMod('enemyDmgMul')*diffDmgMul();
  if(inRange && now>e.fireAt && !(e.aimT>0) && S.mode==='playing'){
    if(Math.random() > Math.min(1, A.fireChanceBase + ds*A.fireChanceRamp)) e.fireAt=now+0.5;
    else if(def.rpg){ e.aimT=def.aimT; sfx('beep', e.pos); }                 // kneel + aim: a readable 1s telegraph before the rocket
    else { u.muzzle.getWorldPosition(_cv);
      const a=Math.atan2(dx,dz)+(Math.random()-0.5)*Math.max(0.05, A.spreadBase*(1-ds*A.spreadDrop)*1.25)*(ENVMOD.night?ENV.night.enemySpread:1)*smokeSpread(now);
      spawnBullet(_cv.x,_cv.z,a,{owner:'e', dmg:def.dmg*dmgMul, speed:def.bspeed, color:0xffd06a, r:0.22, life:1.6, maxDist:def.range+3, noArc:true, y:_cv.y, dropTo:1.3});
      spawnPart(_cv.x,_cv.y,_cv.z, Math.sin(a)*5,0.3,Math.cos(a)*5, {tex:'flash', color:0xfff0c0, size:0.5, life:0.05, grav:0, drag:8});
      sfx('rifleShot', e.pos); fired=true; e.fireAt=now+def.fireCd*(0.8+Math.random()*0.5)*(A.rateBase-A.rateDrop*ds)/1.6; } }
  if(e.aimT>0){ e.aimT-=dt;
    if(Math.random()<0.5){ u.muzzle.getWorldPosition(_cv); spawnPart(_cv.x,_cv.y,_cv.z,0,0,0,{tex:'flash', color:0xff3a2a, size:0.55+Math.random()*0.3, life:0.06, grav:0, drag:0}); }   // red sight glint = incoming
    if(e.aimT<=0){ u.muzzle.getWorldPosition(_cv);
      const lead=Math.min(0.6, d/def.rspeed)*(0.3+0.5*ds), tx=p.pos.x+p.vel.x*lead, tz=p.pos.z+p.vel.z*lead;
      const a=Math.atan2(tx-_cv.x, tz-_cv.z)+(Math.random()-0.5)*0.12*smokeSpread(now);
      launchEnemyMissile(_cv.x, _cv.y, _cv.z, a, { speed:def.rspeed, dmg:def.dmg*dmgMul, aoe:def.aoe, life:2.6, kind:'rpg' });
      spawnPart(_cv.x-Math.sin(a)*1.2,_cv.y,_cv.z-Math.cos(a)*1.2, -Math.sin(a)*6,0.5,-Math.cos(a)*6, {color:0xd8d0c0, size:1.4, life:0.6, smoke:true, grav:0.3, drag:2, op:0.5});   // back-blast
      fired=true; e.fireAt=now+def.fireCd*(A.rateBase-A.rateDrop*ds)/1.6; } }
  animateSoldier(e.mesh, moved/def.scale, dt, fired);
  if(e.aimT>0){ u.up.position.y=0.5; const L=u.legs; L[0].hip.rotation.x=-1.35; L[0].knee.rotation.x=1.35; L[1].hip.rotation.x=0.25; L[1].knee.rotation.x=1.7; }   // kneeling to fire
}
// a tank rolling over a soldier at speed crushes him; slower contact just shoves him aside
export function crushInfantry(now){
  const p=S.player; if(!p) return; const ps=Math.hypot(p.vel.x,p.vel.z);
  for(const e of enemies.slice()){ if(!e.def.inf) continue;
    if(hitsHull(p, e.pos.x, e.pos.z, 0.35)){
      if(ps>INFANTRY.crushSpeed || now<p.dashUntil){ e._crushed=true; killEnemy(e); continue; }
      const nx=e.pos.x-p.pos.x, nz=e.pos.z-p.pos.z, L=Math.hypot(nx,nz)||1; e.pos.x+=nx/L*0.45; e.pos.z+=nz/L*0.45; }
    for(const t of enemies){ if(!solidTank(t)) continue; if(hitsHull(t, e.pos.x, e.pos.z, 0.3)){ const nx=e.pos.x-t.pos.x, nz=e.pos.z-t.pos.z, L=Math.hypot(nx,nz)||1; e.pos.x+=nx/L*0.4; e.pos.z+=nz/L*0.4; } }   // their own tanks shove them aside
  }
}
export function infantryDown(e){
  const m=e.mesh, gy=heightAt(e.pos.x,e.pos.z);
  if(e._crushed){ m.scale.y*=0.12; m.position.y=gy+0.05;                    // flattened into the dirt under the tracks
    burst(e.pos, BIOME.ground, 8, 5, {y:gy+0.4, life:0.6, size:1.0, smoke:true, grav:-0.4, drag:2.2, up:1.5, op:0.5}); burst(e.pos, 0x6a2a1c, 6, 4, {y:gy+0.3, life:0.35, size:0.35, grav:-14, drag:2});
    floatText('CÁN NÁT +'+INFANTRY.crushBonus, '#ffcf5a', {x:e.pos.x, y:gy+2.4, z:e.pos.z}, 16); addScore(INFANTRY.crushBonus, new THREE.Vector3(e.pos.x,2,e.pos.z));
    sfx('crunch', e.pos); haptic(28); S.shake=Math.min(2,S.shake+0.25); }
  else { burst(e.pos, 0x7a3020, 6, 4, {y:gy+1.1, life:0.4, size:0.5, grav:-10, drag:2}); }
  INF_DEAD.push({ e, t:0, crushed:!!e._crushed, dir:(Math.random()<0.5?-1:1) });
}
export function updateInfDead(dt){
  for(let i=INF_DEAD.length-1;i>=0;i--){ const d=INF_DEAD[i], m=d.e.mesh; d.t+=dt;
    if(!d.crushed){ const k=Math.min(1, d.t/0.45); m.rotation.x=-k*k*Math.PI/2*0.96; m.rotation.z=d.dir*k*0.25; }   // crumples and falls backwards
    if(d.t>3.2){ const k=Math.max(0,1-(d.t-3.2)/0.8); m.position.y-=dt*0.6; if(k<=0){ m.visible=false; m.rotation.set(0,0,0); (enemyPool[d.e.type]=enemyPool[d.e.type]||[]).push(m); INF_DEAD.splice(i,1); } } }
}
export function clearInfDead(){ for(const d of INF_DEAD){ d.e.mesh.visible=false; d.e.mesh.rotation.set(0,0,0); (enemyPool[d.e.type]=enemyPool[d.e.type]||[]).push(d.e.mesh); } INF_DEAD.length=0; }
