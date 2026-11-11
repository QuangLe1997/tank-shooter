// actors/infantry.js — Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take pot-shots, kneel to fire rockets…
import * as THREE from 'three';
import { BALANCE, ENV, INFANTRY, EQUIP, SQUAD } from '../../config.js';
import { ALLY_TANKS, BIOME, ENVMOD, FT, MOBILE, S, _cv, addScore, animateSoldier, blocks, burst, cMod, clampField, coverSpot, damageAlly, decalBlood, diffDmgMul, diffScale, dropSoldierGun, enemies, enemyPool, floatText, fortExitDir, fortWallCross, haptic, heightAt, hitsHull, inSmoke, killEnemy, launchEnemyMissile, loopDmgMul, makeSoldierMesh, poseSoldier, reviveSoldierMesh, ringPulse, scene, sfx, spawnBullet, spawnEnemy, spawnPart, wrapAngle } from '../hub.js';

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
  g.traverse(o=>{ if(o.isMesh) o.castShadow=!MOBILE; });
  scene.add(g); return g;
}
export function spawnSquad(sp){
  const S2=INFANTRY.squad, n=S2.size[0]+((Math.random()*(S2.size[1]-S2.size[0]+1))|0);
  const nr = S.stage>=S2.rpgFrom ? (S.stage>=4?2:1) : 0, ix=-Math.sign(sp.x)||0, iz=-Math.sign(sp.z)||0;
  for(let k=0;k<n;k++){ const x=sp.x+ix*(1+Math.random()*3)+(Math.random()-0.5)*6, z=sp.z+iz*(1+Math.random()*3)+(Math.random()-0.5)*6;
    spawnEnemy(k<nr?'rpg':'rifle', x, z); }
  ringPulse(new THREE.Vector3(sp.x,0,sp.z), 0xd8b070, 2.4);
}
export const _INF0={ x:0, z:0 };
// Z104 who an enemy soldier fights: the tank by default; riflemen switch to one of OUR soldiers (or a captured tank) when clearly closer;
// RPG teams only ever pick armour — the tank or a captured one
export function infTarget(e){ const p=S.player; let best={ pos:p.pos, vel:p.vel, tank:true }, bd=Math.hypot(p.pos.x-e.pos.x, p.pos.z-e.pos.z);
  for(const t of ALLY_TANKS){ const d=Math.hypot(t.pos.x-e.pos.x, t.pos.z-e.pos.z); if(d<bd*0.85){ bd=d; best={ pos:t.pos, vel:t.vel, tank:true }; } }
  if(!e.def.rpg) for(const a of FT){ const d=Math.hypot(a.pos.x-e.pos.x, a.pos.z-e.pos.z); if(d<bd*0.9 && d<e.def.range*1.4){ bd=d; best={ pos:a.pos, vel:_INF0, tank:false }; } }
  return best; }
// nearest armour (ours) bearing on this soldier, for taking cover
export function infTankThreat(e){ const p=S.player, R=INFANTRY.coverThreat; let best=null, bd=R;
  const dp=Math.hypot(p.pos.x-e.pos.x, p.pos.z-e.pos.z); if(dp<bd){ bd=dp; best=p; }
  for(const t of ALLY_TANKS){ const d=Math.hypot(t.pos.x-e.pos.x, t.pos.z-e.pos.z); if(d<bd){ bd=d; best=t; } }
  return best; }
export function updateInfantry(e, dt, now, edt){
  const def=e.def, p=S.player, u=e.mesh.userData;
  if(now>=(e.tgtAt||0)){ e.tgtAt=now+0.45+Math.random()*0.3; e.T=infTarget(e); }            // re-pick the target a couple of times a second
  const T=e.T||{ pos:p.pos, vel:p.vel, tank:true }, dx=T.pos.x-e.pos.x, dz=T.pos.z-e.pos.z, d=Math.hypot(dx,dz)||1, ux=dx/d, uz=dz/d;
  const pdx=p.pos.x-e.pos.x, pdz=p.pos.z-e.pos.z, pd=Math.hypot(pdx,pdz)||1, pux=pdx/pd, puz=pdz/pd;
  let mx=0, mz=0, sp=def.speed;
  const closing = -(p.vel.x*pux + p.vel.z*puz);                            // how fast the tank is bearing down on this soldier
  const thr = (!def.rpg && !(e.aimT>0)) ? infTankThreat(e) : null;
  if(thr && now>=(e.coverAt||0)){ e.coverAt=now+1.4+Math.random()*0.6; e.cover=coverSpot(e.pos.x, e.pos.z, thr.pos.x, thr.pos.z, INFANTRY.coverSearch); }
  const _ex=e.exit ? fortExitDir(e) : null;                                 // Z111b filing out through a fortress gate
  if(_ex){ mx=_ex.x; mz=_ex.z; sp*=1.15; }
  else if(pd<10 && closing>7){ e.side=e.side||(Math.random()<0.5?-1:1); mx=-puz*e.side; mz=pux*e.side; sp*=1.9; e.aimT=0; }   // SCATTER — dive out of the tank's path
  else if(e.aimT>0){ }                                                       // kneeling with the launcher up: hold still
  else if(thr && e.cover){ const cx=e.cover.x-e.pos.x, cz=e.cover.z-e.pos.z, cd=Math.hypot(cx,cz); if(cd>0.7){ mx=cx/cd; mz=cz/cd; sp*=1.5; } e.inCover=cd<=1.3; }   // Z104 TANK! → into cover, shoot from there
  else if(e.guard && e.post){ const gx=e.post[0]-e.pos.x, gz=e.post[1]-e.pos.z, gd=Math.hypot(gx,gz); if(gd>2.5){ mx=gx/gd; mz=gz/gd; } }   // Z104 depot / stockade guards hold their post
  else if(d>def.keep+2){ mx=ux; mz=uz; } else if(d<def.keep-5){ mx=-ux*0.8; mz=-uz*0.8; }
  const settled = mx===0 && mz===0 && d<def.range;                          // Z105 in position and in range → stop weaving, get down and shoot
  if(!_ex && !(thr && e.cover) && !e.guard && !settled){ e.ph+=dt; const w=Math.sin(e.ph*0.9)*0.6; mx+=-uz*w*0.55; mz+=ux*w*0.55; }   // weave — a squad never walks in a conga line
  for(const o of enemies){ if(o===e || !o.def.inf) continue; const ox=e.pos.x-o.pos.x, oz=e.pos.z-o.pos.z, q=ox*ox+oz*oz; if(q<5 && q>1e-4){ const k=(2.24-Math.sqrt(q))*0.8; mx+=ox*k; mz+=oz*k; } }
  const ox0=e.pos.x, oz0=e.pos.z, ml=Math.hypot(mx,mz);
  if(ml>0.05 && !(e.aimT>0)){ e.pos.x+=mx/ml*sp*edt; e.pos.z+=mz/ml*sp*edt; }
  if(e.kbx||e.kbz){ e.pos.x+=e.kbx*edt; e.pos.z+=e.kbz*edt; const kf=Math.max(0,1-dt*9); e.kbx*=kf; e.kbz*=kf; }
  for(const bl of blocks){ if(bl.obb){ const s_=Math.sin(bl.obb.f), c_=Math.cos(bl.obb.f), dx_=e.pos.x-bl.x, dz_=e.pos.z-bl.z, al=dx_*s_+dz_*c_, ac=dx_*c_-dz_*s_, hw=bl.obb.hw+0.4; if(Math.abs(al)<bl.obb.hl+0.3 && Math.abs(ac)<hw){ const push=(ac<0?-hw:hw)-ac; e.pos.x+=c_*push; e.pos.z-=s_*push; } continue; } const bx=e.pos.x-bl.x, bz=e.pos.z-bl.z, q=bx*bx+bz*bz, rr=bl.r+0.45; if(q<rr*rr && q>1e-4){ const qq=Math.sqrt(q); e.pos.x=bl.x+bx/qq*rr; e.pos.z=bl.z+bz/qq*rr; } }
  clampField(e.pos, 2);
  const moved=Math.hypot(e.pos.x-ox0, e.pos.z-oz0), inRange=d<def.range;
  const want = (inRange || moved<0.002) ? Math.atan2(dx,dz) : Math.atan2(e.pos.x-ox0, e.pos.z-oz0);
  e.facing += wrapAngle(want-e.facing)*Math.min(1,dt*9);
  e.mesh.position.set(e.pos.x, heightAt(e.pos.x,e.pos.z), e.pos.z); e.mesh.rotation.y=e.facing;
  let fired=false; const ds=diffScale(), A=BALANCE.aggro;
  const dmgMul = (0.7+0.3*ds)*loopDmgMul()*cMod('enemyDmgMul')*diffDmgMul();
  if(inRange && now>e.fireAt && !(e.aimT>0) && S.mode==='playing'){
    if(fortWallCross(e.pos.x, e.pos.z, T.pos.x, T.pos.z)) e.fireAt=now+0.6;     // Z111b a fortress wall between: no shot (rifle or rocket)
    else if(Math.random() > Math.min(1, A.fireChanceBase + ds*A.fireChanceRamp)) e.fireAt=now+0.5;
    else if(def.rpg){ e.aimT=def.aimT; sfx('beep', e.pos); }                 // kneel + aim: a readable 1s telegraph before the rocket
    else { u.muzzle.getWorldPosition(_cv);
      const a=Math.atan2(dx,dz)+(Math.random()-0.5)*Math.max(0.05, A.spreadBase*(1-ds*A.spreadDrop)*1.25)*(ENVMOD.night?ENV.night.enemySpread:1)*smokeSpread(now);
      spawnBullet(_cv.x,_cv.z,a,{owner:'e', inf:true, dmg:def.dmg*dmgMul, speed:def.bspeed, color:0xffd06a, r:0.22, life:1.6, maxDist:def.range+3, noArc:true, y:_cv.y, dropTo:1.3});
      spawnPart(_cv.x,_cv.y,_cv.z, Math.sin(a)*5,0.3,Math.cos(a)*5, {tex:'flash', color:0xfff0c0, size:0.5, life:0.05, grav:0, drag:8});
      sfx('rifleShot', e.pos); fired=true; e.fireAt=now+def.fireCd*(0.8+Math.random()*0.5)*(A.rateBase-A.rateDrop*ds)/1.6; } }
  if(e.aimT>0){ e.aimT-=dt;
    if(Math.random()<0.5){ u.muzzle.getWorldPosition(_cv); spawnPart(_cv.x,_cv.y,_cv.z,0,0,0,{tex:'flash', color:0xff3a2a, size:0.55+Math.random()*0.3, life:0.06, grav:0, drag:0}); }   // red sight glint = incoming
    if(e.aimT<=0){ u.muzzle.getWorldPosition(_cv);
      const lead=Math.min(0.6, d/def.rspeed)*(0.3+0.5*ds), tx=T.pos.x+(T.vel?T.vel.x:0)*lead, tz=T.pos.z+(T.vel?T.vel.z:0)*lead;
      const a=Math.atan2(tx-_cv.x, tz-_cv.z)+(Math.random()-0.5)*0.12*smokeSpread(now);
      launchEnemyMissile(_cv.x, _cv.y, _cv.z, a, { speed:def.rspeed, dmg:def.dmg*dmgMul, aoe:def.aoe, life:2.6, kind:'rpg' });
      spawnPart(_cv.x-Math.sin(a)*1.2,_cv.y,_cv.z-Math.cos(a)*1.2, -Math.sin(a)*6,0.5,-Math.cos(a)*6, {color:0xd8d0c0, size:1.4, life:0.6, smoke:true, grav:0.3, drag:2, op:0.5});   // back-blast
      fired=true; e.fireAt=now+def.fireCd*(A.rateBase-A.rateDrop*ds)/1.6; } }
  animateSoldier(e.mesh, moved/def.scale, dt, fired);
  // Z105 stance: kneel for the RPG / behind cover, flat on the ground when settled at range in the open, upright when moving
  const still = moved < 0.03*Math.max(1, edt/dt);
  const st = e.aimT>0 ? 'crouch' : (!still ? 'stand' : (e.inCover && thr ? 'crouch' : (settled && d>SQUAD.proneR && !def.rpg ? 'prone' : (settled ? 'crouch' : 'stand'))));
  poseSoldier(e.mesh, st, dt); e.r = st==='prone' ? 0.34 : 0.55;              // a man lying flat is a smaller target for your gun too
}
// a tank rolling over a soldier at speed crushes him; slower contact just shoves him aside
export function crushInfantry(now){
  const p=S.player; if(!p) return; const ps=Math.hypot(p.vel.x,p.vel.z);
  for(const e of enemies.slice()){ if(!e.def.inf) continue;
    if(hitsHull(p, e.pos.x, e.pos.z, 0.35)){
      if(ps>INFANTRY.crushSpeed || now<p.dashUntil){ e._crushed=true; killEnemy(e); continue; }
      const nx=e.pos.x-p.pos.x, nz=e.pos.z-p.pos.z, L=Math.hypot(nx,nz)||1; e.pos.x+=nx/L*0.45; e.pos.z+=nz/L*0.45; }
    for(const t of enemies){ if(!solidTank(t)) continue; if(hitsHull(t, e.pos.x, e.pos.z, 0.3)){ const nx=e.pos.x-t.pos.x, nz=e.pos.z-t.pos.z, L=Math.hypot(nx,nz)||1; e.pos.x+=nx/L*0.4; e.pos.z+=nz/L*0.4; } }   // their own tanks shove them aside
    for(const t of ALLY_TANKS){ if(hitsHull(t, e.pos.x, e.pos.z, 0.35) && Math.hypot(t.vel?t.vel.x:0, t.vel?t.vel.z:0)>INFANTRY.crushSpeed){ e._crushed=true; killEnemy(e); break; } }   // Z113 our captured tanks crush them too
  }
  // Z113 enemy tanks run OUR men down the same way
  for(const t of enemies){ if(!solidTank(t)) continue; const ts=Math.hypot(t.vel.x,t.vel.z); if(ts<INFANTRY.crushSpeed) continue;
    for(const a of FT.slice()){ if(hitsHull(t, a.pos.x, a.pos.z, 0.3)){ burst(a.pos, BIOME.ground, 6, 4, {y:heightAt(a.pos.x,a.pos.z)+0.4, life:0.6, size:1.0, smoke:true, grav:-0.4, drag:2.2, up:1.5, op:0.5}); sfx('crunch', a.pos); damageAlly(a, 999); } } }
}
export function infantryDown(e){
  const m=e.mesh, gy=heightAt(e.pos.x,e.pos.z);
  if(e._crushed){ m.scale.y*=0.12; m.position.y=gy+0.05;                    // flattened into the dirt under the tracks
    burst(e.pos, BIOME.ground, 8, 5, {y:gy+0.4, life:0.6, size:1.0, smoke:true, grav:-0.4, drag:2.2, up:1.5, op:0.5}); burst(e.pos, 0x6a2a1c, 6, 4, {y:gy+0.3, life:0.35, size:0.35, grav:-14, drag:2});
    floatText('CÁN NÁT +'+INFANTRY.crushBonus, '#ffcf5a', {x:e.pos.x, y:gy+2.4, z:e.pos.z}, 16); addScore(INFANTRY.crushBonus, new THREE.Vector3(e.pos.x,2,e.pos.z));
    sfx('crunch', e.pos); haptic(28); S.shake=Math.min(2,S.shake+0.25); }
  else if(e._fx==='ice'){                                                     // Z112 frozen solid → shatters into ice on the spot
    for(let k=0;k<12;k++){ const a=Math.random()*6.283, sp=2+Math.random()*5; spawnPart(e.pos.x, gy+0.9+Math.random()*0.8, e.pos.z, Math.cos(a)*sp, 2+Math.random()*4, Math.sin(a)*sp, {color:Math.random()<0.5?0xd8f6ff:0x7fd0ff, size:0.18+Math.random()*0.22, life:0.7, grav:-16, drag:1}); }
    burst(e.pos, 0xd8f6ff, 3, 2, {y:gy+1, life:0.6, size:1.2, smoke:true, grav:-0.2, drag:2, op:0.4}); sfx('crunch', e.pos);
    m.visible=false; m.rotation.set(0,0,0); (enemyPool[e.type]=enemyPool[e.type]||[]).push(m); return; }
  else if(e._big || e._blast){                                                 // Z112 a tank round / a blast: the man is THROWN, then breaks apart and is gone
    let ux=e._blast ? e.pos.x-e._blast.x : (e._hx||0), uz=e._blast ? e.pos.z-e._blast.z : (e._hz||0); const L=Math.hypot(ux,uz)||1; ux/=L; uz/=L; if(L<0.05){ const a=Math.random()*6.283; ux=Math.cos(a); uz=Math.sin(a); }
    const F=INFANTRY.fling, pw=Math.max(0.8, Math.min(INFANTRY.fling.maxK, e._hitK||1)), sp=F.speed*pw*(0.75+Math.random()*0.5);   // Z113 heavier round → thrown farther
    burst(e.pos, 0x7a3020, 7, 6, {y:gy+1.1, life:0.35, size:0.45, grav:-10, drag:2}); burst(e.pos, BIOME.ground, 4, 4, {y:gy+0.6, life:0.8, size:1.2, smoke:true, grav:-0.4, drag:2, up:1.5, op:0.45});
    bloodSpurt(e.pos.x, e.pos.z, ux, uz, 1.6*pw);
    INF_DEAD.push({ e, t:0, fling:true, pw, vx:ux*sp, vy:F.up*Math.sqrt(pw)*(0.8+Math.random()*0.5), vz:uz*sp, rx:(Math.random()<0.5?-1:1)*(6+Math.random()*6), rz:(Math.random()-0.5)*8, gibAt:F.gib*(0.8+Math.random()*0.4) }); return; }
  else { burst(e.pos, 0x7a3020, 6, 4, {y:gy+1.1, life:0.4, size:0.5, grav:-10, drag:2}); layOut(m, e.pos.x, e.pos.z); }
  INF_DEAD.push({ e, t:0, crushed:!!e._crushed, dir:(Math.random()<0.5?-1:1) });
}
// Z113 shot dead (small arms): straighten out of any kneel / prone pose, rifle drops beside him, a dark pool spreads — he falls on his BACK
export function layOut(m, x, z){ const u=m.userData; if(u.body){ u.body.rotation.x=0; u.body.position.set(0,0,0); } if(u.up) u.up.rotation.x=0; if(u.pose){ u.pose.rx=u.pose.y=u.pose.z=u.pose.up=u.pose.arm=u.pose.kw=u.pose.pw=0; }
  for(const l of (u.legs||[])){ l.hip.rotation.set(0,0,0); l.knee.rotation.x=0.15; } dropSoldierGun(m); setTimeout(()=>decalBlood(x, z, 0.7+Math.random()*0.4), 450); }
// Z113 a hit on a man: blood sprays out of the exit side along the shot, a few drops land on the ground
export function bloodSpurt(x, z, dx, dz, k){ k=Math.max(0.4, Math.min(2.5, k||1)); const gy=heightAt(x,z), y=gy+1.0+Math.random()*0.4, L=Math.hypot(dx,dz)||1; dx/=L; dz/=L;
  const n=Math.round(4+4*k); for(let i=0;i<n;i++){ const sp=2+Math.random()*4*k; spawnPart(x+dx*0.2, y, z+dz*0.2, dx*sp+(Math.random()-0.5)*2, 1+Math.random()*2.5, dz*sp+(Math.random()-0.5)*2, {color:Math.random()<0.6?0x8a1410:0x5a0a08, size:0.1+Math.random()*0.12*k, life:0.45+Math.random()*0.25, grav:-16, drag:0.8}); }
  spawnPart(x+dx*0.3, y, z+dz*0.3, dx*1.5, 0.4, dz*1.5, {color:0x7a1210, size:0.5*k, life:0.25, grav:-2, drag:3, op:0.6});
  if(Math.random()<0.6) decalBlood(x+dx*(0.6+Math.random()*0.8*k), z+dz*(0.6+Math.random()*0.8*k), 0.25+0.15*k); }
// Z112 the thrown man comes apart: gear, cloth and dust
function gib(m, pw){ pw=pw||1; const p=m.position; for(let k=0;k<9;k++){ const a=Math.random()*6.283, sp=2+Math.random()*5; spawnPart(p.x, p.y+0.6, p.z, Math.cos(a)*sp, 2+Math.random()*4, Math.sin(a)*sp, {color:[0x4a5530,0x3a3f26,0x2a2a20,0x6a2a1c][k%4], size:0.16+Math.random()*0.2, life:0.6+Math.random()*0.3, grav:-18, drag:1}); }
  burst({x:p.x,z:p.z}, 0x8a7a60, 3, 2, {y:p.y+0.5, life:0.7, size:1.0, smoke:true, grav:-0.3, drag:2, op:0.4});
  for(let k=0;k<Math.round(10*pw);k++){ const a=Math.random()*6.283, sp=3+Math.random()*6*pw; spawnPart(p.x, p.y+0.5, p.z, Math.cos(a)*sp, 2+Math.random()*5, Math.sin(a)*sp, {color:Math.random()<0.6?0x8a1410:0x5a0a08, size:0.12+Math.random()*0.16, life:0.6+Math.random()*0.3, grav:-18, drag:0.9}); }   // Z113 bursts apart, spraying red
  decalBlood(p.x, p.z, 0.9+0.5*pw); for(let k=0;k<3;k++){ const a=Math.random()*6.283, r=0.8+Math.random()*1.6*pw; decalBlood(p.x+Math.cos(a)*r, p.z+Math.sin(a)*r, 0.3+Math.random()*0.3); } }
export function updateInfDead(dt){
  for(let i=INF_DEAD.length-1;i>=0;i--){ const d=INF_DEAD[i], m=d.e.mesh; d.t+=dt;
    if(d.fling){ if(!d.down){ d.vy-=24*dt; m.position.x+=d.vx*dt; m.position.y+=d.vy*dt; m.position.z+=d.vz*dt; m.rotation.x+=d.rx*dt; m.rotation.z+=d.rz*dt;   // Z112 ballistic tumble
        const g=heightAt(m.position.x, m.position.z); if(m.position.y<=g && d.vy<0){ m.position.y=g; d.down=true; burst({x:m.position.x,z:m.position.z}, BIOME.ground, 3, 3, {y:g+0.3, life:0.6, size:0.9, smoke:true, grav:-0.3, drag:2, op:0.45}); } }
      if(!d.down && Math.random()<0.6) spawnPart(m.position.x, m.position.y+0.7, m.position.z, 0, -1, 0, {color:0x7a1210, size:0.14, life:0.4, grav:-12, drag:1});   // Z113 a red trail through the air
      if(!d.gone && (d.t>=d.gibAt || d.down)){ d.gone=true; gib(m, d.pw); m.visible=false; }
      if(d.gone){ m.rotation.set(0,0,0); (enemyPool[d.e.type]=enemyPool[d.e.type]||[]).push(m); INF_DEAD.splice(i,1); }
      continue; }
    if(!d.crushed){ const k=Math.min(1, d.t/0.45); m.rotation.x=-k*k*Math.PI/2*0.96; m.rotation.z=d.dir*k*0.25; const u=m.userData; if(u.arms) u.arms.rotation.x=-k*2.5; if(u.legs) u.legs.forEach((l,j)=>{ l.hip.rotation.z=(j?1:-1)*k*0.22; }); }   // crumples and falls backwards, arms flung back
    if(d.t>3.2){ const k=Math.max(0,1-(d.t-3.2)/0.8); m.position.y-=dt*0.6; if(m.userData.droppedGun) m.userData.droppedGun.position.y-=dt*0.6; if(k<=0){ m.visible=false; m.rotation.set(0,0,0); reviveSoldierMesh(m); (enemyPool[d.e.type]=enemyPool[d.e.type]||[]).push(m); INF_DEAD.splice(i,1); } } }
}
export function clearInfDead(){ for(const d of INF_DEAD){ d.e.mesh.visible=false; d.e.mesh.rotation.set(0,0,0); reviveSoldierMesh(d.e.mesh); (enemyPool[d.e.type]=enemyPool[d.e.type]||[]).push(d.e.mesh); } INF_DEAD.length=0; }
