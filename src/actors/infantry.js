// actors/infantry.js — Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take pot-shots, kneel to fire rockets…
import * as THREE from 'three';
import { AWARE, BALANCE, DEATH_POP, ENV, EQUIP, FIELDCRAFT, INFANTRY, REAL, SQUAD } from '../../config.js';
import { objMod, BIOME, ENVMOD, FT, MOBILE, S, UGRID, _cv, aiIQ, animateSoldier, atCover, burst, cMod, canThrow, clampField, clearGore, combatDive, coverSpot, dazePose, dazed, decalBlood, diffDmgMul, diffScale, dropSoldierGun, endFall, enemies, enemyPool, fortExitDir, fortWallCross, heightAt, inSmoke, infPushBlocks, kitAttach, launchEnemyMissile, loadGLTF, loopDmgMul, losBlocked, makeSoldierMesh, makeSquad, nadeFlee, nadeTarget, peekMove, poseSoldier, reviveSoldierMesh, rifleFX, ringPulse, scene, sfx, smokeSpreadK, soldierReloading, spawnBullet, spawnEnemy, spawnPart, squadMove, throwNade, tracerNext, unitsNear, wantPeek, wrapAngle, asShipped, nearShape, riverWay, wadeAt, gunFlash, awareTick, PL, hatchEntry, riseStep, dirFireK, giveUpStep, markAim, markStep } from '../hub.js';

// ===== Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take pot-shots, kneel to fire rockets…
// …and a tank rolling over them crushes them flat. Lives in enemies[] (def.inf) so every gun, drone, guard & blast already sees them. =====
export const INF_DEAD=[];
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
// a squad's men: 4–6, one or two of them with the B40 from stage rpgFrom
export function squadTypes(){ const S2=INFANTRY.squad, n=S2.size[0]+((Math.random()*(S2.size[1]-S2.size[0]+1))|0), nr = S.stage>=S2.rpgFrom ? (S.stage>=4?2:1) : 0, out=[]; for(let k=0;k<n;k++) out.push(k<nr?'rpg':'rifle'); return out; }
// AI 2 sp.how: the way in the caller vouches for (see spawnEnemy) · sp.hatch: they climb out of a hatch at (x, z) one at a time and form up once the last is out (returns null)
export function spawnSquad(sp){
  const n0=enemies.length, ty=squadTypes(), n=ty.length; if(sp.hatch){ hatchEntry(sp.x, sp.z, ty, { alert:sp.alert, escort:sp.escort||null }); return null; }
  const ix=-Math.sign(sp.x)||0, iz=-Math.sign(sp.z)||0;
  for(let k=0;k<n;k++){ const x=sp.x+ix*(1+Math.random()*3)+(Math.random()-0.5)*6, z=sp.z+iz*(1+Math.random()*3)+(Math.random()-0.5)*6;
    const e=spawnEnemy(ty[k], x, z, sp.how); if(e && sp.alert) e.alert0=1; }   // (AI 1 sp.alert: an ambush — these men know where he is)
  ringPulse(new THREE.Vector3(sp.x,0,sp.z), 0xd8b070, 2.4);
  return makeSquad(enemies.slice(n0), { escort:sp.escort||null });   // Z173 one squad, one plan
}
export const _INF0={ x:0, z:0 }; const _infNb=[], _fl={ x:0, z:0 };
// Z220 an enemy rifleman lobs a frag grenade at our men in cover or bunched together (from stage 2, sharper crews more often)
function enemyNade(e, now){ const N=FIELDCRAFT.nade; e.nadeAt=now+0.9+Math.random()*0.6; if(S.stage<N.fromStage || aiIQ()<N.iqMin || (e.supp||0)>0.6 || !canThrow('e', now)) return;
  const t=nadeTarget(e.pos.x, e.pos.z, FT, a=>a.task==='cover' && atCover(a.pos, a.cover)); if(!t || losBlocked(e.pos.x, e.pos.z, t.pos.x, t.pos.z) && Math.random()<0.5) return;
  if(Math.random()>0.35+aiIQ()*0.5) return; e.nadeAt=now+N.cdE[0]+Math.random()*(N.cdE[1]-N.cdE[0]); e.facing=Math.atan2(t.pos.x-e.pos.x, t.pos.z-e.pos.z); throwNade('e', e.pos.x, e.pos.z, t.pos.x, t.pos.z, now); }
// Z104 who an enemy soldier fights: the player by default; riflemen switch to one of OUR soldiers when clearly closer; RPG teams only ever pick the player
// AI 1 …the player only once this man is ALERTED and has him in sight (e.alert / e.sees, ai/awareness.js: looked up on the man's own staggered tick — no sight line
//   is asked here). Out of sight he works on the last place he knew him (e.lk): suppressing fire for AWARE.keep.suppress s (supp), then the search (lost). One record a man, reused.
export function infTarget(e, now){ const p=S.player, T=e._T||(e._T={ pos:null, vel:_INF0, you:false, lost:false, supp:false }), al=e.alert>=2, seen=al && e.sees, k=e.lk||(e.lk={ x:e.pos.x, z:e.pos.z });
  let best=seen ? p : null, bd=seen ? Math.hypot(p.pos.x-e.pos.x, p.pos.z-e.pos.z) : Infinity;
  if(!e.def.rpg) for(const a of FT){ const d0=Math.hypot(a.pos.x-e.pos.x, a.pos.z-e.pos.z), d=d0*(a.task==='cover'&&atCover(a.pos,a.cover)?FIELDCRAFT.target.coverMul:1)*(a.g.userData.stance==='prone'?FIELDCRAFT.target.proneMul:1);   // Z220 the man in the open is shot first
    if(d<bd*0.9 && d0<e.def.range*1.4){ bd=d; best=a; } }
  if(best===p){ T.pos=p.pos; T.vel=p.vel; T.you=true; T.lost=false; T.supp=false; }
  else if(best){ T.pos=best.pos; T.vel=_INF0; T.you=false; T.lost=false; T.supp=false; }
  else { T.pos=k; T.vel=_INF0; T.you=false; T.lost=true; T.supp=al && (now||performance.now()/1000)-(e.lkAt||0)<AWARE.keep.suppress; }   // (Z377 nobody he can see: the last known place)
  return T; }
// the player close and in sight of this alerted soldier: he takes cover from him
export function infThreat(e){ const p=S.player; return e.alert>=2 && e.sees && Math.hypot(p.pos.x-e.pos.x, p.pos.z-e.pos.z)<AWARE.cover.threat ? p : null; }
// AI 1 one round of a rifleman's burst: aimed from the muzzle at where the man will be (a share of the lead), inside a group that is wide when he first opens up and
//   closes while the player stays put in his sight (e.zero); wider past his own range, at night, through smoke, under fire; blind fire at a lost man is wider still
function fireRound(e, T, d, now, dmgMul, ds){ const def=e.def, F=AWARE.fire, A=BALANCE.aggro, you=T.you; e.mesh.userData.muzzle.getWorldPosition(_cv);
  let tx=T.pos.x, tz=T.pos.z; if(you){ const ft=Math.min(0.7, d/def.bspeed)*F.lead; tx+=T.vel.x*ft; tz+=T.vel.z*ft; }
  const w=(you ? (F.wide+(F.tight-F.wide)*(e.zero||0))*(F.stageK[0]+(F.stageK[1]-F.stageK[0])*ds) : T.supp ? F.wide*F.blindK : Math.max(0.05, A.spreadBase*(1-ds*A.spreadDrop)*1.25))
    *(d>def.range?F.farK:1)*(you && PL.v>AWARE.zero.runV?F.runK:1)*(ENVMOD.night?ENV.night.enemySpread:1)*smokeSpread(now)*smokeSpreadK(e.pos.x, e.pos.z, T.pos.x, T.pos.z)*(1+1.6*(e.supp||0))*(def.spreadK||1);   // Z173 suppressed men shoot wild · Z220 and through smoke
  const a=Math.atan2(tx-_cv.x, tz-_cv.z)+(Math.random()-0.5)*w, tr=tracerNext(e.mesh)||!!def.mg;
  spawnBullet(_cv.x,_cv.z,a,{owner:'e', inf:true, dmg:def.dmg*dmgMul*(you?F.dmgK:1), speed:def.bspeed, color:tr?REAL.tracer.enemy:0xffd06a, r:tr?0.3:0.22, trailK:tr?2.4:1, tr:tr?1:0, life:1.6, maxDist:def.range*(you||T.supp?F.reachK:1)+3, noArc:true, y:_cv.y, dropTo:1.3}); rifleFX(_cv.x, _cv.y, _cv.z, a, false);   // Z223 green tracer every Nth round · brass + smoke
  gunFlash(_cv.x,_cv.y,_cv.z, a, 0.6, 0.34, 0xfff0c0, 0.9);   // Z419 a shaped rifle flash along the bore
  sfx('rifleShot', e.pos); e.shotAt=now; }   // (DIR 1 shotAt: the director counts who is firing)
export function updateInfantry(e, dt, now, edt){
  const def=e.def, p=S.player, u=e.mesh.userData;
  if(dazed(e, now)){ if(e.kbx||e.kbz){ e.pos.x+=e.kbx*edt; e.pos.z+=e.kbz*edt; const kf=Math.max(0,1-dt*6); e.kbx*=kf; e.kbz*=kf; } infPushBlocks(e.pos); clampField(e.pos, 2);   // Z223 knocked flat by a blast: slides, lies there, then gets up
    e.mesh.position.set(e.pos.x, heightAt(e.pos.x,e.pos.z), e.pos.z); e.aimT=0; e.burstLeft=0; dazePose(e.mesh, now, dt); e.r=0.34; e.fireAt=Math.max(e.fireAt||0, now+0.4); return; }
  if(e.rise && riseStep(e, dt, now)){ e.intent='deploy'; e.actAt=now; return; }   // AI 2 climbing out of a hatch: below ground at first, no move of his own, no shot until he is out
  if(e.gaveUp){ giveUpStep(e, dt, now, edt); return; }                       // DIR 2 the last man of a squad who threw down his rifle: hands up, then off the field (ai/tiers.js)
  awareTick(e, now);                                                         // AI 1 what he knows: unaware → suspicious → alerted (his own staggered look)
  if(now>=(e.tgtAt||0)){ e.tgtAt=now+0.45+Math.random()*0.3; e.T=infTarget(e, now); }            // re-pick the target a couple of times a second
  const T=e.T||(e.T=infTarget(e, now)), dx=T.pos.x-e.pos.x, dz=T.pos.z-e.pos.z, d=Math.hypot(dx,dz)||1, ux=dx/d, uz=dz/d;
  const pdx=p.pos.x-e.pos.x, pdz=p.pos.z-e.pos.z, pd=Math.hypot(pdx,pdz)||1, pux=pdx/pd, puz=pdz/pd;
  const AW=AWARE, al=e.alert>=2, you=T.you, react=now<(e.reactAt||0), reach=def.range*(you||T.supp ? AW.fire.reachK : 1), fb=!!(e.sq && e.sq.state==='fallback');
  let mx=0, mz=0, sp=def.speed, _sm=null, it='attack';                       // AI 1 it = his ONE intent this frame (e.intent): attack · suppress · flank · cover · search · fallback (· react · pinned · evade · deploy · guard · patrol · check)
  const closing = -(p.vel.x*pux + p.vel.z*puz);                            // how fast the player is bearing down on this soldier
  const thr = (!def.rpg && !(e.aimT>0) && al && e.sees && pd<AW.cover.threat) ? p : null; if(thr) e.cvHold=now+AW.cover.hold;   // (AI 1 off his cached look — no sight line here)
  if(thr && now>=(e.coverAt||0)){ e.coverAt=now+1.4+Math.random()*0.6;       // AI 1 he keeps the cover he chose until it is gone or the player has moved round it (no shuffling between two rocks)
    if(!e.cover || !(e.cover.b.hp>0) || Math.hypot(p.pos.x-e.cvx, p.pos.z-e.cvz)>AW.cover.repick){ const c=coverSpot(e.pos.x, e.pos.z, p.pos.x, p.pos.z, AW.cover.search); e.cover = c && Math.hypot(c.x-p.pos.x, c.z-p.pos.z)<reach*0.9 ? c : null; e.cvx=p.pos.x; e.cvz=p.pos.z; } }   // (only a cover he can hit from)
  const inCv = !!e.cover && al && !def.rpg && !fb && !e.pinF && (!!thr || now<(e.cvHold||0)); if(!inCv) e.inCover=false;   // (DIR 2 pinF: a man of the flanking team keeps to the plan's own covers)
  if(al && !react && !e.guard && !def.mk && !fb && now-(e.actAt||now)>AW.idle.max){ e.pushUntil=now+AW.idle.push; e.actAt=now; e.fireAt=Math.min(e.fireAt, now); e.idleN=(e.idleN||0)+1; e.side=-(e.side||1); }   // AI 1 neither moved nor fired for 2 s while alerted: he goes for him
  const push = al && now<(e.pushUntil||0);
  const _ex=e.exit ? fortExitDir(e) : null;                                 // Z111b filing out through a fortress gate
  if(_ex){ mx=_ex.x; mz=_ex.z; sp*=1.15; it='deploy'; }
  else if(nadeFlee(e.pos, _fl)){ mx=_fl.x; mz=_fl.z; sp*=1.9; e.aimT=0; it='evade'; }   // Z220 a grenade at his feet: run
  else if(pd<10 && closing>7){ e.side=e.side||(Math.random()<0.5?-1:1); mx=-puz*e.side; mz=pux*e.side; sp*=1.9; e.aimT=0; it='evade'; }   // SCATTER — dive out of the tank's path
  else if(react){ it='react'; }                                              // AI 1 the moment it dawns on him: he stops dead, swings round on him, shouts — not a shot yet
  else if(e.aimT>0){ }                                                       // kneeling with the launcher up: hold still
  else if(now<(e.groundUntil||0) && !fb){ it='ground'; }                     // DIR 1 the director's release: the men in contact go to ground for a few seconds — flat, not a shot
  else if((e.supp||0)>0.82 && !fb){ it='pinned'; }                        // Z173 PINNED: rounds cracking overhead — he hugs the ground
  else if(!(e.sq && e.sqNoFire) && peekMove(e, now, _fl)){ mx=_fl.x; mz=_fl.z; sp*=1.25; it='flank'; }   // Z220 wall in the way → edge out to a clear line (AI 1 before the cover: out, fire, back)
  else if(inCv && !push){ const cx=e.cover.x-e.pos.x, cz=e.cover.z-e.pos.z, cd=Math.hypot(cx,cz); if(cd>0.7){ mx=cx/cd; mz=cz/cd; sp*=1.5; it='cover'; } else it=e.sees?'attack':'suppress'; e.inCover=cd<=1.3; }   // Z104 → into cover, shoot from there
  else if(push){ if(e.idleN>1){ mx=-uz*e.side+ux*0.4; mz=ux*e.side+uz*0.4; sp*=1.3; }   // (still stuck after one push — a wall, a rock in his way: round it, the other side each time)
    else if(d>def.keep*0.6){ const rw=riverWay(e, T.pos.x, T.pos.z, now); if(rw){ mx=rw.x; mz=rw.z; } else { mx=ux; mz=uz; } sp*=1.3; } }
  else if((_sm=squadMove(e))){ if(!_sm.hold){ mx=_sm.x; mz=_sm.z; if(_sm.run) sp*=1.35; }   // Z173 the squad's plan: formation · bound · flank · assault · fall back
    it=fb ? 'fallback' : e.sq.state==='search' ? 'search' : e.sqNoFire ? 'flank' : T.lost ? (T.supp ? 'suppress' : 'search') : 'attack'; }
  else if(e.guard && e.post){ const gx=e.post[0]-e.pos.x, gz=e.post[1]-e.pos.z, gd=Math.hypot(gx,gz); if(gd>2.5){ mx=gx/gd; mz=gz/gd; } it=al?'attack':'guard'; }   // Z104 depot / stockade guards hold their post
  else { const keep=T.lost && !T.supp ? AW.search.reach*0.5 : def.keep;    // (AI 1 a lost man is walked right up to, not watched from 15 m — once the suppressing fire on his last place is spent)
    if(d>keep+2){ const rw=riverWay(e, T.pos.x, T.pos.z, now); if(rw){ mx=rw.x; mz=rw.z; } else { mx=ux; mz=uz; } } else if(!T.lost && d<def.keep-5){ mx=-ux*0.8; mz=-uz*0.8; }   // (Z415 a deep river between: round by a bridge or a ford)
    it=T.lost ? (T.supp ? 'suppress' : 'search') : 'attack'; }
  if(!al && T.lost && (it==='search' || it==='suppress' || it==='attack')) it = e.alert===1 ? 'check' : 'patrol';
  e.intent=it;
  const settled = mx===0 && mz===0 && d<reach;                              // Z105 in position and in range → stop weaving, get down and shoot
  if(!_ex && !inCv && !e.guard && !settled && !_sm && !react && !push){ e.ph+=dt; const w=Math.sin(e.ph*0.9)*0.6; mx+=-uz*w*0.55; mz+=ux*w*0.55; }   // weave — a squad never walks in a conga line
  for(const o of unitsNear(UGRID.inf, e.pos.x, e.pos.z, 2.3, _infNb)){ if(o===e) continue; const ox=e.pos.x-o.pos.x, oz=e.pos.z-o.pos.z, q=ox*ox+oz*oz; if(q<5 && q>1e-4){ const k=(2.24-Math.sqrt(q))*0.8; mx+=ox*k; mz+=oz*k; } }
  const ox0=e.pos.x, oz0=e.pos.z, ml=Math.hypot(mx,mz);
  if(ml>0.05 && !(e.aimT>0) && !react){ const wk=wadeAt(e.pos.x, e.pos.z); e.pos.x+=mx/ml*sp*edt*wk; e.pos.z+=mz/ml*sp*edt*wk; }   // (Z415 wading slows him)
  if(e.kbx||e.kbz){ e.pos.x+=e.kbx*edt; e.pos.z+=e.kbz*edt; const kf=Math.max(0,1-dt*9); e.kbx*=kf; e.kbz*=kf; }
  infPushBlocks(e.pos);   // Z172 obstacles from the grid
  clampField(e.pos, 2);
  const moved=Math.hypot(e.pos.x-ox0, e.pos.z-oz0), inRange=d<reach;
  const want = !al && !react && T.lost && d<AW.search.reach && e.scanA!=null ? e.scanA   // AI 1 standing on the spot he was sent to, knowing nothing: he looks about
    : (inRange || moved<0.002 || react) ? Math.atan2(dx,dz) : Math.atan2(e.pos.x-ox0, e.pos.z-oz0);
  e.facing += wrapAngle(want-e.facing)*Math.min(1,dt*(al||react?9:3));
  e.mesh.position.set(e.pos.x, heightAt(e.pos.x,e.pos.z), e.pos.z); e.mesh.rotation.y=e.facing;
  let fired=false; const ds=diffScale(), A=BALANCE.aggro, F=AW.fire, FG=def.gap||F.gap, FR=def.rest||F.rest;   // (DIR 2 def.burst / gap / rest / spreadK: the machine gun's long hosing bursts — ai/tiers.js)
  const dmgMul = (0.7+0.3*ds)*loopDmgMul()*cMod('enemyDmgMul')*objMod('enemyDmgMul')*diffDmgMul();   // (an objective standing: the command bunker, the battery)
  // AI 1 FIRE: an alerted man with the player in his sights always fires (no coin toss), in BURSTS; out of sight he suppresses the last place he saw him; nothing during the reaction delay
  const open = S.mode==='playing' && !(e.aimT>0) && !react && (!T.lost || T.supp) && it!=='ground', rate=(A.rateBase-A.rateDrop*ds)/1.6*(e.sqFireK||1)*(1+(e.supp||0))*(you && PL.v>AW.zero.runV ? F.runRest : 1)*dirFireK();   // (AI 3 a running man: longer between bursts · DIR 1 and everyone in the director's lull)
  if(e.burstLeft>0){ if(!open || !inRange) e.burstLeft=0;
    else if(now>=e.fireAt){ fireRound(e, T, d, now, dmgMul, ds); fired=true; e.fireAt = --e.burstLeft>0 ? now+FG : now+(FR[0]+Math.random()*(FR[1]-FR[0]))*rate; } }
  else if(open && inRange && now>e.fireAt && !soldierReloading(e.mesh) && !(e.sqNoFire && moved>0.01)){   // Z172 nobody fires mid-reload · Z173 nor while sprinting to the next cover
    if((e.supp||0)>0.75 && Math.random()<0.5) e.fireAt=now+0.4; else
    if(fortWallCross(e.pos.x, e.pos.z, T.pos.x, T.pos.z) || losBlocked(e.pos.x, e.pos.z, T.pos.x, T.pos.z)){ e.fireAt=now+0.6; wantPeek(e, T.pos.x, T.pos.z, now); }     // Z111b a fortress wall between: no shot (rifle or rocket) · Z220 nor a house / rock — he moves for a clear line
    else if(!al && Math.random() > Math.min(1, A.fireChanceBase + ds*A.fireChanceRamp)) e.fireAt=now+0.5;   // (the old coin toss: only a man who is not alerted, at our other men)
    else if(def.mk){ markAim(e, T, now); }                                   // DIR 2 the marksman: a glint off his scope for a second, then one heavy round (ai/tiers.js)
    else if(def.rpg){ if(T.supp) e.fireAt=now+1.2; else { e.aimT=def.aimT; sfx('beep', e.pos); } }                 // kneel + aim: a readable 1s telegraph before the rocket
    else { const bst=you||T.supp, B=def.burst||F.burst; e.burstLeft = bst ? B[0]+((Math.random()*(B[1]-B[0]+1))|0) : 1; fireRound(e, T, d, now, dmgMul, ds); fired=true;
      e.fireAt = --e.burstLeft>0 ? now+FG : now+(bst ? FR[0]+Math.random()*(FR[1]-FR[0]) : def.fireCd*(0.8+Math.random()*0.5))*rate; } }
  if(!fired && !def.rpg && FT.length && now>(e.nadeAt||0)) enemyNade(e, now);   // Z220 frag grenade into our men behind cover / bunched up
  if(e.aimT>0 && def.mk){ if(markStep(e, T, dt, now, dmgMul)) fired=true; }   // DIR 2 the marksman's telegraph and shot
  else if(e.aimT>0){ e.aimT-=dt;
    if(Math.random()<0.5){ u.muzzle.getWorldPosition(_cv); spawnPart(_cv.x,_cv.y,_cv.z,0,0,0,{tex:'flash', color:0xff3a2a, size:0.55+Math.random()*0.3, life:0.06, grav:0, drag:0}); }   // red sight glint = incoming
    if(e.aimT<=0){ u.muzzle.getWorldPosition(_cv);
      const lead=Math.min(0.6, d/def.rspeed)*(0.3+0.5*ds), tx=T.pos.x+(T.vel?T.vel.x:0)*lead, tz=T.pos.z+(T.vel?T.vel.z:0)*lead;
      const a=Math.atan2(tx-_cv.x, tz-_cv.z)+(Math.random()-0.5)*0.12*smokeSpread(now);
      launchEnemyMissile(_cv.x, _cv.y, _cv.z, a, { speed:def.rspeed, dmg:def.dmg*dmgMul, aoe:def.aoe, life:2.6, kind:'rpg' });
      spawnPart(_cv.x-Math.sin(a)*1.2,_cv.y,_cv.z-Math.cos(a)*1.2, -Math.sin(a)*6,0.5,-Math.cos(a)*6, {color:0xd8d0c0, size:1.4, life:0.6, smoke:true, grav:0.3, drag:2, op:0.5});   // back-blast
      fired=true; e.fireAt=now+def.fireCd*(A.rateBase-A.rateDrop*ds)/1.6; } }
  if(fired || e.aimT>0 || moved>0.02*Math.max(1, edt/dt) || soldierReloading(e.mesh) || def.rpg && !T.lost && inRange && now<e.fireAt){ e.actAt=now; if(fired || !push) e.idleN=0; }   // (AI 3 a reload — the rifle's, or the launcher's with his man in sight — is something a player reads: not idle)   // AI 1 (he did something: the idle clock starts again)
  animateSoldier(e.mesh, moved/def.scale, dt, fired);
  // Z105 stance: kneel for the RPG / behind cover, flat on the ground when settled at range in the open, upright when moving
  const still = moved < 0.03*Math.max(1, edt/dt);
  const low = al && (!!thr || (e.supp||0)>0.25 || (e.sq && (e.sqNoFire || e.sq.state==='assault' || e.sq.state==='fm')) || d<def.range*1.15);   // Z223 within reach of the enemy: bent low on the move
  let st = e.aimT>0 ? 'crouch' : (!still ? (low ? 'low' : 'stand') : (e.inCover && thr ? 'crouch' : (settled && d>SQUAD.proneR && !def.rpg ? 'prone' : (settled ? 'crouch' : 'stand'))));
  if(still && e._dash && e.sqNoFire && !(e.aimT>0)){ st=e.inCover?'crouch':'prone'; combatDive(e.mesh, e.pos.x, e.pos.z); } e._dash = !still && !!e.sqNoFire;   // Z223 end of a bound: down at once
  if(still && !(e.aimT>0)){ if((e.supp||0)>0.55 || it==='ground') st='prone'; else if(e.sq && e.sqStance && !e.sqGoal) st=e.sqStance; }
  if(still && (react || !al && T.lost) && !((e.supp||0)>0.55)) st='stand';   // AI 1 a man who does not know stands and looks about; the one who has just realised is still on his feet   // Z173 under fire → flat · the covering team kneels / lies to shoot
  poseSoldier(e.mesh, st, dt); e.r = st==='prone' ? 0.34 : 0.55;              // a man lying flat is a smaller target for your gun too
}
// a tank rolling over a soldier at speed crushes him; slower contact just shoves him aside
export function infantryDown(e){
  const m=e.mesh, gy=heightAt(e.pos.x,e.pos.z);
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
