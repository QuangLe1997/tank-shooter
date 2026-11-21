// actors/infantry.js — Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take pot-shots, kneel to fire rockets…
import * as THREE from 'three';
import { BALANCE, DEATH_POP, ENV, EQUIP, FIELDCRAFT, INFANTRY, REAL, SQUAD } from '../../config.js';
import { ALLY_TANKS, BIOME, ENVMOD, FT, MOBILE, S, UGRID, _cv, addScore, aiIQ, animateSoldier, atCover, burst, cMod, canThrow, clampField, clearGore, combatDive, coverSpot, damageAlly, dazePose, dazed, decalBlood, diffDmgMul, diffScale, dropSoldierGun, endFall, enemies, enemyPool, floatText, fortExitDir, fortWallCross, haptic, heightAt, hitsHull, inSmoke, infPushBlocks, killEnemy, kitAttach, launchEnemyMissile, loadGLTF, loopDmgMul, losBlocked, makeSoldierMesh, makeSquad, nadeFlee, nadeTarget, peekMove, poseSoldier, reviveSoldierMesh, rifleFX, ringPulse, scene, sfx, smokeSpreadK, soldierReloading, spawnBullet, spawnEnemy, spawnPart, squadMove, throwNade, tracerNext, unitsNear, wantPeek, wrapAngle, playerSeen , asShipped, nearShape, riverWay, wadeAt } from '../hub.js';

// ===== Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take pot-shots, kneel to fire rockets…
// …and a tank rolling over them crushes them flat. Lives in enemies[] (def.inf) so every gun, drone, guard & blast already sees them. =====
export const INF_DEAD=[];
export const solidTank = e => !(e.def.bomber || e.def.inf || e.def.air);          // things that collide like a hull
export function smokeSpread(now){ return inSmoke(now) ? EQUIP.smoke.spreadMul : 1; }   // SMOKE screen ruins enemy aim
export function infMesh(type){
  const g=makeSoldierMesh({enemy:true}), u=g.userData;
  if(type==='rpg') rpgKit(u);                                                 // Z346 the B40 instead of a carbine
  g.traverse(o=>{ if(o.isMesh) o.castShadow=!MOBILE; });
  scene.add(g); return g;
}
// Z346 THE B40 (RPG-7) ON HIS SHOULDER: the infantry launcher model (the soldier's own, assets/models/real/gun/inf/rpg.glb) instead of a bare
//   tube with a cone — held as he holds his rifle: its pistol grip (under the sight) in his right palm, the tube along the rifle's line, so it
//   rides over his right shoulder with the front under his left hand; a crude stand-in until the model is in. RPGKIT: the length (m), and in the
//   launcher's own frame (warhead toward +z) where the grip is held, and the muzzle
const RPGKIT={ len:1.05, grip:[0, -0.072, -0.35], muzzle:[0, 0.01, 0.55] };
let _rpgTpl=null, _rpgLoad=null;
function rpgModel(){ if(_rpgTpl){ const c = _rpgTpl.clone(true); c.traverse(o => { if(o.isMesh) nearShape(o, 'inf_rpg', asShipped('inf_rpg')); }); return c; }   // (Z395 the launcher on an enemy's shoulder whole up close)
  if(!_rpgLoad) _rpgLoad=loadGLTF('inf_rpg').then(g=>{ if(!g) return; const m=g.scene.clone(true), b=new THREE.Box3().setFromObject(m), c=b.getCenter(new THREE.Vector3()), k=RPGKIT.len/(b.max.z-b.min.z);
    const t=new THREE.Group(); m.scale.setScalar(k); m.position.copy(c).multiplyScalar(-k); t.add(m); t.traverse(o=>{ if(o.isMesh){ o.castShadow=!MOBILE; o.frustumCulled=false; } }); _rpgTpl=t; }).catch(()=>{}); return null; }
function rpgKit(u){ const gp=u.parts && u.parts.find(p=>p.kind==='gun'); if(gp) gp.o.visible=false;   // (the rifle piece goes; the gun joint stays — the launcher hangs on it)
  const L=new THREE.Group(), G=RPGKIT.grip; kitAttach(u, u.gun, L, 'grip', [-G[0], -G[1], -G[2]]);
  const mz=new THREE.Object3D(); mz.position.fromArray(RPGKIT.muzzle); L.add(mz); u.muzzle=mz;
  const real=rpgModel(); if(real){ L.add(real); return; }
  const tm=new THREE.MeshStandardMaterial({color:0x4a5530,roughness:0.75,metalness:0.25}), dm=new THREE.MeshStandardMaterial({color:0x2c2c22,roughness:0.6,metalness:0.4}), tmp=new THREE.Group();   // the stand-in
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.95,10), tm); tube.rotation.x=Math.PI/2; tmp.add(tube);
  const war=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.3,10), dm); war.rotation.x=Math.PI/2; war.position.z=0.6; tmp.add(war);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.11,0.05), dm); grip.position.set(0,-0.07,-0.35); tmp.add(grip); L.add(tmp);
  _rpgLoad.then(()=>{ if(!_rpgTpl) return; L.remove(tmp); L.add(_rpgTpl.clone(true)); }); }
export function spawnSquad(sp){
  const n0=enemies.length, S2=INFANTRY.squad, n=S2.size[0]+((Math.random()*(S2.size[1]-S2.size[0]+1))|0);
  const nr = S.stage>=S2.rpgFrom ? (S.stage>=4?2:1) : 0, ix=-Math.sign(sp.x)||0, iz=-Math.sign(sp.z)||0;
  for(let k=0;k<n;k++){ const x=sp.x+ix*(1+Math.random()*3)+(Math.random()-0.5)*6, z=sp.z+iz*(1+Math.random()*3)+(Math.random()-0.5)*6;
    spawnEnemy(k<nr?'rpg':'rifle', x, z); }
  ringPulse(new THREE.Vector3(sp.x,0,sp.z), 0xd8b070, 2.4);
  return makeSquad(enemies.slice(n0), { escort:sp.escort||null });   // Z173 one squad, one plan
}
export const _INF0={ x:0, z:0 }; const _infNb=[], _infTk=[], _fl={ x:0, z:0 };
// Z220 an enemy rifleman lobs a frag grenade at our men in cover or bunched together (from stage 2, sharper crews more often)
function enemyNade(e, now){ const N=FIELDCRAFT.nade; e.nadeAt=now+0.9+Math.random()*0.6; if(S.stage<N.fromStage || aiIQ()<N.iqMin || (e.supp||0)>0.6 || !canThrow('e', now)) return;
  const t=nadeTarget(e.pos.x, e.pos.z, FT, a=>a.task==='cover' && atCover(a.pos, a.cover)); if(!t || losBlocked(e.pos.x, e.pos.z, t.pos.x, t.pos.z) && Math.random()<0.5) return;
  if(Math.random()>0.35+aiIQ()*0.5) return; e.nadeAt=now+N.cdE[0]+Math.random()*(N.cdE[1]-N.cdE[0]); e.facing=Math.atan2(t.pos.x-e.pos.x, t.pos.z-e.pos.z); throwNade('e', e.pos.x, e.pos.z, t.pos.x, t.pos.z, now); }
// Z104 who an enemy soldier fights: the tank by default; riflemen switch to one of OUR soldiers (or a captured tank) when clearly closer;
// RPG teams only ever pick armour — the tank or a captured one
export function infTarget(e){ const p=S.player, seen=playerSeen(e.pos.x, heightAt(e.pos.x,e.pos.z)+1.6, e.pos.z); if(seen){ const k=e.lk||(e.lk={ x:0, z:0 }); k.x=p.pos.x; k.z=p.pos.z; }   // Z377 a soldier lying flat out of his sight: not his target — he goes to look where he last saw him
  let best=seen ? { pos:p.pos, vel:p.vel, tank:true } : null, bd=seen ? Math.hypot(p.pos.x-e.pos.x, p.pos.z-e.pos.z) : Infinity;
  for(const t of ALLY_TANKS){ const d=Math.hypot(t.pos.x-e.pos.x, t.pos.z-e.pos.z); if(d<bd*0.85){ bd=d; best={ pos:t.pos, vel:t.vel, tank:true }; } }
  if(!e.def.rpg) for(const a of FT){ const d0=Math.hypot(a.pos.x-e.pos.x, a.pos.z-e.pos.z), d=d0*(a.task==='cover'&&atCover(a.pos,a.cover)?FIELDCRAFT.target.coverMul:1)*(a.g.userData.stance==='prone'?FIELDCRAFT.target.proneMul:1);   // Z220 the man in the open is shot first
    if(d<bd*0.9 && d0<e.def.range*1.4){ bd=d; best={ pos:a.pos, vel:_INF0, tank:false }; } }
  return best || { pos:e.lk || { x:e.pos.x, z:e.pos.z }, vel:_INF0, tank:false, lost:true }; }   // (Z377 nobody he can see: search — never a shot)
// nearest armour (ours) bearing on this soldier, for taking cover
export function infTankThreat(e){ const p=S.player, R=INFANTRY.coverThreat; let best=null, bd=R;
  const dp=Math.hypot(p.pos.x-e.pos.x, p.pos.z-e.pos.z); if(dp<bd && playerSeen(e.pos.x, heightAt(e.pos.x,e.pos.z)+1.6, e.pos.z)){ bd=dp; best=p; }   // (Z377 not one he cannot see)
  for(const t of ALLY_TANKS){ const d=Math.hypot(t.pos.x-e.pos.x, t.pos.z-e.pos.z); if(d<bd){ bd=d; best=t; } }
  return best; }
export function updateInfantry(e, dt, now, edt){
  const def=e.def, p=S.player, u=e.mesh.userData;
  if(dazed(e, now)){ if(e.kbx||e.kbz){ e.pos.x+=e.kbx*edt; e.pos.z+=e.kbz*edt; const kf=Math.max(0,1-dt*6); e.kbx*=kf; e.kbz*=kf; } infPushBlocks(e.pos); clampField(e.pos, 2);   // Z223 knocked flat by a blast: slides, lies there, then gets up
    e.mesh.position.set(e.pos.x, heightAt(e.pos.x,e.pos.z), e.pos.z); e.aimT=0; dazePose(e.mesh, now, dt); e.r=0.34; e.fireAt=Math.max(e.fireAt||0, now+0.4); return; }
  if(now>=(e.tgtAt||0)){ e.tgtAt=now+0.45+Math.random()*0.3; e.T=infTarget(e); }            // re-pick the target a couple of times a second
  const T=e.T||{ pos:p.pos, vel:p.vel, tank:true }, dx=T.pos.x-e.pos.x, dz=T.pos.z-e.pos.z, d=Math.hypot(dx,dz)||1, ux=dx/d, uz=dz/d;
  const pdx=p.pos.x-e.pos.x, pdz=p.pos.z-e.pos.z, pd=Math.hypot(pdx,pdz)||1, pux=pdx/pd, puz=pdz/pd;
  let mx=0, mz=0, sp=def.speed, _sm=null;
  const closing = -(p.vel.x*pux + p.vel.z*puz);                            // how fast the tank is bearing down on this soldier
  const thr = (!def.rpg && !(e.aimT>0)) ? infTankThreat(e) : null;
  if(thr && now>=(e.coverAt||0)){ e.coverAt=now+1.4+Math.random()*0.6; e.cover=coverSpot(e.pos.x, e.pos.z, thr.pos.x, thr.pos.z, INFANTRY.coverSearch); }
  const _ex=e.exit ? fortExitDir(e) : null;                                 // Z111b filing out through a fortress gate
  if(_ex){ mx=_ex.x; mz=_ex.z; sp*=1.15; }
  else if(nadeFlee(e.pos, _fl)){ mx=_fl.x; mz=_fl.z; sp*=1.9; e.aimT=0; }   // Z220 a grenade at his feet: run
  else if(pd<10 && closing>7){ e.side=e.side||(Math.random()<0.5?-1:1); mx=-puz*e.side; mz=pux*e.side; sp*=1.9; e.aimT=0; }   // SCATTER — dive out of the tank's path
  else if(e.aimT>0){ }                                                       // kneeling with the launcher up: hold still
  else if((e.supp||0)>0.82 && !(e.sq && e.sq.state==='fallback')){ }      // Z173 PINNED: rounds cracking overhead — he hugs the ground
  else if(thr && e.cover){ const cx=e.cover.x-e.pos.x, cz=e.cover.z-e.pos.z, cd=Math.hypot(cx,cz); if(cd>0.7){ mx=cx/cd; mz=cz/cd; sp*=1.5; } e.inCover=cd<=1.3; }   // Z104 TANK! → into cover, shoot from there
  else if(!(e.sq && e.sqNoFire) && peekMove(e, now, _fl)){ mx=_fl.x; mz=_fl.z; sp*=1.25; }   // Z220 wall in the way → edge out to a clear line
  else if((_sm=squadMove(e))){ if(!_sm.hold){ mx=_sm.x; mz=_sm.z; if(_sm.run) sp*=1.35; } }   // Z173 the squad's plan: formation · bound · flank · assault · fall back
  else if(e.guard && e.post){ const gx=e.post[0]-e.pos.x, gz=e.post[1]-e.pos.z, gd=Math.hypot(gx,gz); if(gd>2.5){ mx=gx/gd; mz=gz/gd; } }   // Z104 depot / stockade guards hold their post
  else if(d>def.keep+2){ const rw=riverWay(e, T.pos.x, T.pos.z, now); if(rw){ mx=rw.x; mz=rw.z; } else { mx=ux; mz=uz; } } else if(d<def.keep-5){ mx=-ux*0.8; mz=-uz*0.8; }   // (Z415 a deep river between: round by a bridge or a ford)
  const settled = mx===0 && mz===0 && d<def.range;                          // Z105 in position and in range → stop weaving, get down and shoot
  if(!_ex && !(thr && e.cover) && !e.guard && !settled && !_sm){ e.ph+=dt; const w=Math.sin(e.ph*0.9)*0.6; mx+=-uz*w*0.55; mz+=ux*w*0.55; }   // weave — a squad never walks in a conga line
  for(const o of unitsNear(UGRID.inf, e.pos.x, e.pos.z, 2.3, _infNb)){ if(o===e) continue; const ox=e.pos.x-o.pos.x, oz=e.pos.z-o.pos.z, q=ox*ox+oz*oz; if(q<5 && q>1e-4){ const k=(2.24-Math.sqrt(q))*0.8; mx+=ox*k; mz+=oz*k; } }
  const ox0=e.pos.x, oz0=e.pos.z, ml=Math.hypot(mx,mz);
  if(ml>0.05 && !(e.aimT>0)){ const wk=wadeAt(e.pos.x, e.pos.z); e.pos.x+=mx/ml*sp*edt*wk; e.pos.z+=mz/ml*sp*edt*wk; }   // (Z415 wading slows him)
  if(e.kbx||e.kbz){ e.pos.x+=e.kbx*edt; e.pos.z+=e.kbz*edt; const kf=Math.max(0,1-dt*9); e.kbx*=kf; e.kbz*=kf; }
  infPushBlocks(e.pos);   // Z172 obstacles from the grid
  clampField(e.pos, 2);
  const moved=Math.hypot(e.pos.x-ox0, e.pos.z-oz0), inRange=d<def.range;
  const want = (inRange || moved<0.002) ? Math.atan2(dx,dz) : Math.atan2(e.pos.x-ox0, e.pos.z-oz0);
  e.facing += wrapAngle(want-e.facing)*Math.min(1,dt*9);
  e.mesh.position.set(e.pos.x, heightAt(e.pos.x,e.pos.z), e.pos.z); e.mesh.rotation.y=e.facing;
  let fired=false; const ds=diffScale(), A=BALANCE.aggro;
  const dmgMul = (0.7+0.3*ds)*loopDmgMul()*cMod('enemyDmgMul')*diffDmgMul();
  if(inRange && now>e.fireAt && !(e.aimT>0) && !T.lost && S.mode==='playing' && !soldierReloading(e.mesh) && !(e.sqNoFire && moved>0.01)){   // Z172 nobody fires mid-reload · Z173 nor while sprinting to the next cover
    if((e.supp||0)>0.75 && Math.random()<0.5) e.fireAt=now+0.4; else
    if(fortWallCross(e.pos.x, e.pos.z, T.pos.x, T.pos.z) || losBlocked(e.pos.x, e.pos.z, T.pos.x, T.pos.z)){ e.fireAt=now+0.6; wantPeek(e, T.pos.x, T.pos.z, now); }     // Z111b a fortress wall between: no shot (rifle or rocket) · Z220 nor a house / rock — he moves for a clear line
    else if(Math.random() > Math.min(1, A.fireChanceBase + ds*A.fireChanceRamp)) e.fireAt=now+0.5;
    else if(def.rpg){ e.aimT=def.aimT; sfx('beep', e.pos); }                 // kneel + aim: a readable 1s telegraph before the rocket
    else { u.muzzle.getWorldPosition(_cv);
      const a=Math.atan2(dx,dz)+(Math.random()-0.5)*Math.max(0.05, A.spreadBase*(1-ds*A.spreadDrop)*1.25)*(ENVMOD.night?ENV.night.enemySpread:1)*smokeSpread(now)*smokeSpreadK(e.pos.x, e.pos.z, T.pos.x, T.pos.z)*(1+1.6*(e.supp||0));   // Z173 suppressed men shoot wild · Z220 and through smoke
      const tr=tracerNext(e.mesh); spawnBullet(_cv.x,_cv.z,a,{owner:'e', inf:true, dmg:def.dmg*dmgMul, speed:def.bspeed, color:tr?REAL.tracer.enemy:0xffd06a, r:tr?0.3:0.22, trailK:tr?2.4:1, life:1.6, maxDist:def.range+3, noArc:true, y:_cv.y, dropTo:1.3}); rifleFX(_cv.x, _cv.y, _cv.z, a, false);   // Z223 green tracer every Nth round · brass + smoke
      spawnPart(_cv.x,_cv.y,_cv.z, Math.sin(a)*5,0.3,Math.cos(a)*5, {tex:'flash', color:0xfff0c0, size:0.5, life:0.05, grav:0, drag:8});
      sfx('rifleShot', e.pos); fired=true; e.fireAt=now+def.fireCd*(0.8+Math.random()*0.5)*(A.rateBase-A.rateDrop*ds)/1.6*(e.sqFireK||1)*(1+(e.supp||0)); } }
  if(!fired && !def.rpg && FT.length && now>(e.nadeAt||0)) enemyNade(e, now);   // Z220 frag grenade into our men behind cover / bunched up
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
  const low = !!thr || (e.supp||0)>0.25 || (e.sq && (e.sqNoFire || e.sq.state==='assault' || e.sq.state==='fm')) || d<def.range*1.15;   // Z223 within reach of the enemy: bent low on the move
  let st = e.aimT>0 ? 'crouch' : (!still ? (low ? 'low' : 'stand') : (e.inCover && thr ? 'crouch' : (settled && d>SQUAD.proneR && !def.rpg ? 'prone' : (settled ? 'crouch' : 'stand'))));
  if(still && e._dash && e.sqNoFire && !(e.aimT>0)){ st=e.inCover?'crouch':'prone'; combatDive(e.mesh, e.pos.x, e.pos.z); } e._dash = !still && !!e.sqNoFire;   // Z223 end of a bound: down at once
  if(still && !(e.aimT>0)){ if((e.supp||0)>0.55) st='prone'; else if(e.sq && e.sqStance && !e.sqGoal) st=e.sqStance; }   // Z173 under fire → flat · the covering team kneels / lies to shoot
  poseSoldier(e.mesh, st, dt); e.r = st==='prone' ? 0.34 : 0.55;              // a man lying flat is a smaller target for your gun too
}
// a tank rolling over a soldier at speed crushes him; slower contact just shoves him aside
export function crushInfantry(now){
  const p=S.player; if(!p) return; const ps=Math.hypot(p.vel.x,p.vel.z);
  for(const e of enemies.slice()){ if(!e.def.inf) continue;
    if(hitsHull(p, e.pos.x, e.pos.z, 0.35)){
      if(ps>INFANTRY.crushSpeed || now<p.dashUntil){ e._crushed=true; killEnemy(e); continue; }
      const nx=e.pos.x-p.pos.x, nz=e.pos.z-p.pos.z, L=Math.hypot(nx,nz)||1; e.pos.x+=nx/L*0.45; e.pos.z+=nz/L*0.45; }
    for(const t of unitsNear(UGRID.tank, e.pos.x, e.pos.z, 12, _infTk)){ if(!solidTank(t)) continue; if(hitsHull(t, e.pos.x, e.pos.z, 0.3)){ const nx=e.pos.x-t.pos.x, nz=e.pos.z-t.pos.z, L=Math.hypot(nx,nz)||1; e.pos.x+=nx/L*0.4; e.pos.z+=nz/L*0.4; } }   // their own tanks shove them aside
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
    sfx('crunch', e.pos); haptic(28); S.shake=Math.min(2,S.shake+0.25); INF_DEAD.push({ e, t:0, crushed:true }); return; }   // Z402 and bursts a moment later
  if(e._fx==='ice'){                                                     // Z112 frozen solid → shatters into ice on the spot
    for(let k=0;k<12;k++){ const a=Math.random()*6.283, sp=2+Math.random()*5; spawnPart(e.pos.x, gy+0.9+Math.random()*0.8, e.pos.z, Math.cos(a)*sp, 2+Math.random()*4, Math.sin(a)*sp, {color:Math.random()<0.5?0xd8f6ff:0x7fd0ff, size:0.18+Math.random()*0.22, life:0.7, grav:-16, drag:1}); }
    burst(e.pos, 0xd8f6ff, 3, 2, {y:gy+1, life:0.6, size:1.2, smoke:true, grav:-0.2, drag:2, op:0.4}); sfx('crunch', e.pos);
    m.visible=false; m.rotation.set(0,0,0); (enemyPool[e.type]=enemyPool[e.type]||[]).push(m); return; }
  // Z402 every other death: thrown whole along the shot (a heavy round or a blast throws him far), and gone in a burst a moment after he lands
  const heavy=!!(e._big || e._blast); let ux=e._blast ? e.pos.x-e._blast.x : (e._hx||0), uz=e._blast ? e.pos.z-e._blast.z : (e._hz||0); const L=Math.hypot(ux,uz);
  if(L<0.05){ const a=Math.random()*6.283; ux=Math.cos(a); uz=Math.sin(a); } else { ux/=L; uz/=L; }
  if(heavy) burst(e.pos, BIOME.ground, 4, 4, {y:gy+0.6, life:0.8, size:1.2, smoke:true, grav:-0.4, drag:2, up:1.5, op:0.45});   // the dust he is thrown out of
  INF_DEAD.push({ e, t:0, ...flingDead(m, ux, uz, e._hitK||1, heavy) }); }
// ---- Z402 A MAN SHOT DEAD IS THROWN AND GONE (enemy infantry here, our fireteam in actors/fireteam.js): he no longer drops, crawls or lies on the field for 4 s —
//   whatever killed him throws him whole along the shot (small arms DEATH_POP.speed / up × the round's weight, a heavy round or a blast INFANTRY.fling), tumbling
//   with his arms and legs flung out; he lands, slides a moment and bursts in a puff of blood mist and dust — gone, ~1–1.5 s after the kill ----
export function flingDead(m, ux, uz, k, heavy){ const P=DEATH_POP, F=INFANTRY.fling, u=m.userData, R=a=>a[0]+Math.random()*(a[1]-a[0]);
  const pw=heavy ? Math.max(0.8, Math.min(F.maxK, k||1)) : Math.max(P.k[0], Math.min(P.k[1], k||1)), sp=(heavy ? F.speed*(0.75+Math.random()*0.5) : R(P.speed))*pw, up=(heavy ? F.up*(0.8+Math.random()*0.5) : R(P.up))*Math.sqrt(pw);
  bloodSpurt(m.position.x, m.position.z, ux, uz, (heavy?1.1:0.7)*pw);
  if(u.body){ u.body.rotation.x=0; u.body.position.set(0,0,0); } if(u.up) u.up.rotation.x=0; if(u.pose){ u.pose.rx=u.pose.y=u.pose.z=u.pose.up=u.pose.arm=u.pose.kw=u.pose.pw=0; }   // out of any kneel / prone pose
  if(u.arms) u.arms.rotation.set(-2.1-Math.random()*0.9, 0, (Math.random()-0.5)*0.9);                                                                        // arms thrown up over his head
  (u.legs||[]).forEach((l,j)=>{ l.hip.rotation.set((Math.random()-0.5)*1.0, 0, (j?1:-1)*(0.25+Math.random()*0.35)); l.knee.rotation.x=0.2+Math.random()*0.9; });   // legs flung apart
  m.rotation.order='XYZ'; return { fling:true, pw, vx:ux*sp, vy:up, vz:uz*sp, rx:(Math.random()<0.5?-1:1)*(3+Math.random()*3)*(heavy?1:0.75), rz:(Math.random()-0.5)*3, down:false, lie:0 }; }
// one step of a thrown body (d.t already advanced by the caller); true once it has burst and is gone (the caller puts the rig away)
export function stepFlung(d, m, dt){ const P=DEATH_POP;
  if(!d.down){ d.vy-=24*dt; m.position.x+=d.vx*dt; m.position.y+=d.vy*dt; m.position.z+=d.vz*dt; m.rotation.x+=d.rx*dt; m.rotation.z+=d.rz*dt;   // ballistic tumble
    { const px=m.position.x, pz=m.position.z; infPushBlocks(m.position); if(px!==m.position.x || pz!==m.position.z){ d.vx*=-0.15; d.vz*=-0.15; } }   // thrown against cover or a wall: stopped by it, drops at its foot
    const g=heightAt(m.position.x, m.position.z); if(m.position.y<=g && d.vy<0){ m.position.y=g; d.down=true; const rx=Math.atan2(Math.sin(m.rotation.x), Math.cos(m.rotation.x)); d.flat=m.rotation.x-rx+(rx>=0?1:-1)*Math.PI/2; d.vx*=0.45; d.vz*=0.45;   // lands on his back or his face
      burst({x:m.position.x,z:m.position.z}, BIOME.ground, 3, 3, {y:g+0.3, life:0.6, size:0.9, smoke:true, grav:-0.3, drag:2, op:0.45}); sfx('thud', m.position, 0.4); }
    else if(Math.random()<0.2) spawnPart(m.position.x, m.position.y+0.7, m.position.z, 0, -1, 0, {color:0x6a100c, size:0.1, life:0.35, grav:-12, drag:1}); }   // a few drops through the air
  else { d.lie+=dt; const k=Math.exp(-dt*6); d.vx*=k; d.vz*=k; m.position.x+=d.vx*dt; m.position.z+=d.vz*dt; m.position.y=heightAt(m.position.x, m.position.z)+0.12;   // skids to a stop
    m.rotation.x+=(d.flat-m.rotation.x)*Math.min(1, dt*12); m.rotation.z*=Math.max(0, 1-dt*8); }
  if((d.down && d.lie>=P.lie) || d.t>=P.max){ popBody(m, d.pw||1); return true; } return false; }
// the burst he goes in: a puff of blood mist, the dust he lay in, a spray of drops, a stain left on the ground — and the body is gone
function popBody(m, pw){ const x=m.position.x, z=m.position.z, gy=heightAt(x,z), y=Math.max(gy+0.5, m.position.y+0.35);
  for(let k=0;k<2;k++) spawnPart(x+(Math.random()-0.5)*0.5, y+k*0.3, z+(Math.random()-0.5)*0.5, (Math.random()-0.5)*0.8, 0.9+k*0.5, (Math.random()-0.5)*0.8, {color:k?0x8a1812:0x6e100c, size:2.0+0.4*pw, life:0.65, smoke:true, grav:-0.4, drag:2.4, grow:2.2, op:0.7});
  burst({x,z}, BIOME.ground, MOBILE?5:9, 5, {y:gy+0.4, life:1.0, size:2.0, smoke:true, grav:-0.3, drag:2.2, up:2.0, op:0.65});
  for(let i=0;i<(MOBILE?8:15);i++){ const a=Math.random()*6.283, sp=2.5+Math.random()*5; spawnPart(x, y, z, Math.cos(a)*sp, 2+Math.random()*4, Math.sin(a)*sp, {color:Math.random()<0.6?0x8a1410:0x5a0a08, size:0.12+Math.random()*0.14, life:0.45+Math.random()*0.3, grav:-16, drag:0.8}); }
  decalBlood(x, z, 0.5+0.15*pw); m.visible=false; }
// a rig put back the way the pool wants it (standing, gun in hand)
function poolDead(e){ const m=e.mesh; m.visible=false; endFall(m); reviveSoldierMesh(m); (enemyPool[e.type]=enemyPool[e.type]||[]).push(m); }
// Z113 shot dead (small arms): straighten out of any kneel / prone pose, rifle drops beside him, a dark pool spreads — he falls on his BACK
export function layOut(m, x, z){ const u=m.userData; if(u.body){ u.body.rotation.x=0; u.body.position.set(0,0,0); } if(u.up) u.up.rotation.x=0; if(u.pose){ u.pose.rx=u.pose.y=u.pose.z=u.pose.up=u.pose.arm=u.pose.kw=u.pose.pw=0; }
  for(const l of (u.legs||[])){ l.hip.rotation.set(0,0,0); l.knee.rotation.x=0.15; } dropSoldierGun(m); setTimeout(()=>decalBlood(x, z, 0.7+Math.random()*0.4), 450); }
// Z113 a hit on a man: blood sprays out of the exit side along the shot, a few drops land on the ground
export function bloodSpurt(x, z, dx, dz, k){ k=Math.max(0.4, Math.min(2.5, k||1)); const gy=heightAt(x,z), y=gy+1.0+Math.random()*0.4, L=Math.hypot(dx,dz)||1; dx/=L; dz/=L;
  const n=Math.round(4+4*k); for(let i=0;i<n;i++){ const sp=2+Math.random()*4*k; spawnPart(x+dx*0.2, y, z+dz*0.2, dx*sp+(Math.random()-0.5)*2, 1+Math.random()*2.5, dz*sp+(Math.random()-0.5)*2, {color:Math.random()<0.6?0x8a1410:0x5a0a08, size:0.1+Math.random()*0.12*k, life:0.45+Math.random()*0.25, grav:-16, drag:0.8}); }
  spawnPart(x+dx*0.3, y, z+dz*0.3, dx*1.5, 0.4, dz*1.5, {color:0x7a1210, size:0.5*k, life:0.25, grav:-2, drag:3, op:0.6});
  if(Math.random()<0.6) decalBlood(x+dx*(0.6+Math.random()*0.8*k), z+dz*(0.6+Math.random()*0.8*k), 0.25+0.15*k); }
export function updateInfDead(dt){
  for(let i=INF_DEAD.length-1;i>=0;i--){ const d=INF_DEAD[i], m=d.e.mesh; d.t+=dt;
    if(d.crushed){ if(d.t>=DEATH_POP.crush){ popBody(m, 0.6); poolDead(d.e); INF_DEAD.splice(i,1); } continue; }   // Z402 flattened, then gone
    if(stepFlung(d, m, dt)){ poolDead(d.e); INF_DEAD.splice(i,1); } }
}
export function clearInfDead(){ clearGore(); for(const d of INF_DEAD) poolDead(d.e); INF_DEAD.length=0; }
