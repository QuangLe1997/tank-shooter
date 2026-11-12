// actors/fireteam.js — Z89/Z100 friendly FIRETEAM: the APC that brings them, free-roam inside the tank's combat zone, recall.
import * as THREE from 'three';
import { TROOPS, SQUAD, DEPLOY } from '../../config.js';
import { ARENA, CAMPS, MOBILE, PLAYER_PAL, PYLONS, RIDER, S, TANK_SCALE, _RUP, _rdir, _sV, animateSoldier, animateTank, aoeDamage, applyPowerup, atCover, bigExplode, blocks, boss, buildTank, burst, camera, clampField, clearLadders, cmdGoal, coverSpot, damageBlock, decorateEnemyMesh, deformCrater, dropPowerup, enemies, fieldEdgePoint, floatText, gibBody, heightAt, inRally, infBlastK, layOut, liveGuards, lootModel, makeMortarShell, makeSoldierBar, makeSoldierMesh, pickups, playerRange, poseSoldier, radio, rallySpot, rangeRing, riders, scene, sfx, shootGuard, solidTank, spawnBullet, spawnPart, spawnRider, stanceBarK, stashLoot, takePickup, tip, towers, tryClimb, updateClimb, updateCrewBtn, updateLadders, wrapAngle, zoneJob } from '../hub.js';

// ---- friendly FIRETEAM ----
export const FT=[]; export let FT_APC=null;
export function callFireteam(now){
  const F=TROOPS.fireteam, p=S.player, want=Math.min(MOBILE?F.capMobile:F.cap, Math.round(F.size+(S.stage-1)*F.perStage)), need=want-FT.length;
  if(need<=0){ for(const a of FT) a.hp=a.maxHp; floatText('TỔ BỘ BINH ĐÃ TIẾP TẾ','#9bd14a',p.pos,16); return; }
  if(FT_APC) { FT_APC.load+=need; return; }
  const m=buildTank(PLAYER_PAL); m.userData.friendly=true; m.userData.palOverride={hull:0x5e7a2e,turret:0x6a8434,barrel:0x8aa048,tread:0x2a3514,accent:0xe7b54a};
  decorateEnemyMesh(m,'carrier'); for(let i=0;i<3;i++){ const c=m.getObjectByName('crew'+i); if(c) c.visible=true; }
  m.scale.setScalar(1.34*TANK_SCALE); scene.add(m);
  const [ex,ez]=fieldEdgePoint(Math.PI/2+(Math.random()-0.5)*0.5, 3);                                   // rolls in from our side of the field (Z106 at the fence)
  FT_APC={ mesh:m, pos:new THREE.Vector3(ex,0,ez), vel:new THREE.Vector3(), facing:Math.PI, load:need, state:'in', t:0, dropped:0 };
  radio('SCH: Tổ bộ binh đang tới — xe bọc thép ta ngay sau lưng anh.'); sfx('beep');
}
export function updateFireteamAPC(dt, now){
  const A=FT_APC; if(!A) return; const p=S.player, m=A.mesh, rmp=m.getObjectByName('ramp'); A.t+=dt;
  let tx, tz, spd=14;
  if(A.state==='in'){ tx=p.pos.x-Math.sin(p.facing)*7; tz=p.pos.z-Math.cos(p.facing)*7; if(Math.hypot(tx-A.pos.x,tz-A.pos.z)<4 || A.t>9){ A.state='drop'; A.t=0; } }
  else if(A.state==='drop'){ tx=A.pos.x; tz=A.pos.z; spd=0; if(rmp) rmp.rotation.x=Math.min(1.25, A.t*2.6);
    while(A.t>0.5 && A.dropped<A.load && A.t > 0.5+A.dropped*0.32){ const bx=A.pos.x-Math.sin(A.facing)*3.6, bz=A.pos.z-Math.cos(A.facing)*3.6; spawnAlly(bx,bz, A.facing+Math.PI+(A.dropped%2?0.7:-0.7)); A.dropped++; }
    if(A.dropped>=A.load && A.t>0.5+A.load*0.32+0.5){ A.state='out'; A.t=0; } }
  else { tx=A.pos.x; tz=ARENA+14; if(rmp) rmp.rotation.x=Math.max(0, rmp.rotation.x-dt*2); if(A.pos.z>ARENA+8){ scene.remove(m); FT_APC=null; return; } }
  const dx=tx-A.pos.x, dz=tz-A.pos.z, d=Math.hypot(dx,dz)||1, want=d>1?spd:0;
  A.vel.x+=(dx/d*want-A.vel.x)*Math.min(1,dt*2); A.vel.z+=(dz/d*want-A.vel.z)*Math.min(1,dt*2); A.pos.addScaledVector(A.vel, dt);
  if(A.state!=='out'){ clampField(A.pos, 4); }
  const sp=Math.hypot(A.vel.x,A.vel.z); if(sp>1){ A.facing+=wrapAngle(Math.atan2(A.vel.x,A.vel.z)-A.facing)*Math.min(1,dt*3); }
  m.position.set(A.pos.x,0,A.pos.z); m.rotation.y=A.facing; animateTank(m, A.pos.x, A.pos.z, A.facing, dt);
}
export let _mixI=0;
export function spawnAlly(x, z, dirA, role){ const F=TROOPS.fireteam, g=makeSoldierMesh(); g.scale.setScalar(TROOPS.look.scale); scene.add(g); const bar=makeSoldierBar(); bar.g.scale.setScalar(0.7); scene.add(bar.g);
  const k=FT.length, a={ g, bar:bar.g, barFill:bar.fill, pos:new THREE.Vector3(x,0,z), hp:F.hp, maxHp:F.hp, fireAt:0, slot:k, kbx:Math.sin(dirA)*6, kbz:Math.cos(dirA)*6, hitT:0, dead:false, facing:dirA }; FT.push(a);
  setRole(a, role || (S.roleQueue && S.roleQueue.length ? S.roleQueue.shift() : SQUAD.mix[(_mixI++)%SQUAD.mix.length])); return a; }
// Z105 specialist kit on the model: MG = long barrel + bipod · mortar = tube + baseplate on the back · sapper = satchel charges
export function setRole(a, role){ a.role=role||'rifle'; const u=a.g.userData, M=new THREE.MeshStandardMaterial({ color:0x2a2c24, roughness:0.6, metalness:0.5 });
  if(a.role==='mg'){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.55,6), M); b.rotation.x=Math.PI/2; b.position.set(0,0.0,0.85); u.gun.add(b); const bp=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.02,0.02), M); bp.position.set(0,-0.08,0.78); u.gun.add(bp); }
  else if(a.role==='mortar'){ const t=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.85,8), M); t.position.set(0.14,0.52,-0.34); t.rotation.x=0.35; u.up.add(t); const pl=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.04,10), M); pl.position.set(-0.12,0.42,-0.36); pl.rotation.x=Math.PI/2; u.up.add(pl); }
  else if(a.role==='sapper'){ const S2=new THREE.MeshStandardMaterial({ color:0x6a5a3a, roughness:0.9 }); for(const sx of [-0.13,0.13]){ const s=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.2,0.12), S2); s.position.set(sx,0.28,-0.3); u.up.add(s); } } }
export function damageAlly(a, dmg){ if(a.dead) return; a.hp-=dmg; if(a.hp<=0) dropCarry(a, false); a.hitT=0.16; const t=a.g.userData.torso; if(t){ t.material.emissive.setHex(0xff5a2a); t.material.emissiveIntensity=0.85; }
  if(a.hp<=0){ a.dead=true; const i=FT.indexOf(a); if(i>=0) FT.splice(i,1); floatText('✝','#ff9a7a',{x:a.pos.x,y:1.7,z:a.pos.z},16); scene.remove(a.bar);
    if(dmg>=100){ burst(a.pos, 0x2c331c, 6, 5, {y:0.9, life:0.7, size:1.1, smoke:true, op:0.45}); for(let k=0;k<8;k++){ const an=Math.random()*6.283, sp=2+Math.random()*5; spawnPart(a.pos.x, heightAt(a.pos.x,a.pos.z)+0.8, a.pos.z, Math.cos(an)*sp, 2+Math.random()*4, Math.sin(an)*sp, {color:[0x4a5a30,0x3a3f26,0x6a2a1c][k%3], size:0.16+Math.random()*0.18, life:0.7, grav:-18, drag:1}); } gibBody(a.pos.x, heightAt(a.pos.x,a.pos.z), a.pos.z, Math.random()-0.5, Math.random()-0.5, 1, true, a.g.scale.x||1.5); scene.remove(a.g); }   // Z113 a tank round tears him apart (Z121: into pieces)
    else { layOut(a.g, a.pos.x, a.pos.z); ALLY_DEAD.push({ g:a.g, t:0, dir:Math.random()<0.5?-1:1 }); }                                                         // Z113 shot: he falls and lies there a while
    FT.forEach((o,j)=>o.slot=j); updateCrewBtn(); } }
export const ALLY_DEAD=[];
export function updateAllyDead(dt){ for(let i=ALLY_DEAD.length-1;i>=0;i--){ const d=ALLY_DEAD[i], m=d.g; d.t+=dt; const k=Math.min(1, d.t/0.45);
  m.rotation.x=-k*k*Math.PI/2*0.96; m.rotation.z=d.dir*k*0.25; if(m.userData.arms) m.userData.arms.rotation.x=-k*2.5;
  if(d.t>3.6){ m.position.y-=dt*0.6; if(m.userData.droppedGun) m.userData.droppedGun.position.y-=dt*0.6; if(d.t>4.4){ scene.remove(m); if(m.userData.droppedGun) scene.remove(m.userData.droppedGun); ALLY_DEAD.splice(i,1); } } } }
// Z104 an enemy blast (mortar, RPG, artillery, bomb) among OUR men on foot: inside the core = killed, the ring = wounded
export function blastAllies(x, z, r, dmg){ for(const a of FT.slice()){ const k=infBlastK(Math.hypot(a.pos.x-x, a.pos.z-z), r); if(k>0) damageAlly(a, k>=1 ? 999 : dmg*k); } }
export function clearFireteam(){ clearLadders(); for(const d of ALLY_DEAD){ scene.remove(d.g); if(d.g.userData.droppedGun) scene.remove(d.g.userData.droppedGun); } ALLY_DEAD.length=0; S.recall=false; for(const a of FT){ scene.remove(a.g); scene.remove(a.bar); } FT.length=0; if(FT_APC){ scene.remove(FT_APC.mesh); FT_APC=null; } updateCrewBtn(); }
export function infPushBlocks(pos){ for(const bl of blocks){ if(bl.obb){ const s_=Math.sin(bl.obb.f), c_=Math.cos(bl.obb.f), dx_=pos.x-bl.x, dz_=pos.z-bl.z, al=dx_*s_+dz_*c_, ac=dx_*c_-dz_*s_, hw=bl.obb.hw+0.4; if(Math.abs(al)<bl.obb.hl+0.3 && Math.abs(ac)<hw){ const push=(ac<0?-hw:hw)-ac; pos.x+=c_*push; pos.z-=s_*push; } continue; }
  const bx=pos.x-bl.x, bz=pos.z-bl.z, q=bx*bx+bz*bz, rr=bl.r+0.45; if(q<rr*rr && q>1e-4){ const qq=Math.sqrt(q); pos.x=bl.x+bx/qq*rr; pos.z=bl.z+bz/qq*rr; } } }
// Z104 AUTONOMOUS SQUAD — soldiers are no longer leashed to the tank. Each one re-plans a few times a second, in priority order:
//   RECALL (only men inside the ring when the command is held answer: board the hull, or gather by it when it is full) →
//   CARRY loot home to the rally point → COVER from enemy armour (far side of a wall / rock / sandbags) →
//   FIGHT infantry and tower guards (tanks only with an AT launcher from a captured depot) → FETCH dropped loot →
//   JOBS (capture an open depot, free an open POW stockade) → ADVANCE on the nearest enemy → REGROUP around the tank.
export function squadZone(){ const F=TROOPS.fireteam; return Math.max(F.zoneMin, playerRange()*F.zoneMul); }
export function recallRange(){ return Math.max(TROOPS.fireteam.zoneMin, playerRange()); }   // the visible range ring
export const _AT=new THREE.Vector3();
function nearestEnemyTank(a, R){ let best=null, bd=R*R; for(const e of enemies){ if(!solidTank(e) || e.abandoned) continue; const q=(e.pos.x-a.pos.x)**2+(e.pos.z-a.pos.z)**2; if(q<bd){ bd=q; best=e; } }
  if(boss&&boss.alive){ const q=(boss.pos.x-a.pos.x)**2+(boss.pos.z-a.pos.z)**2; if(q<bd){ best=boss; } } return best; }
function allyTarget(a){ const F=TROOPS.fireteam; let best=null, bs=F.detect;
  for(const e of enemies){ if(e.dead) continue; const d=Math.hypot(e.pos.x-a.pos.x, e.pos.z-a.pos.z);
    if(e.def.inf){ if(d<bs){ bs=d; best={ kind:'inf', ref:e, pos:e.pos }; } }
    else if(a.at && !e.def.air && d*0.8<bs && d<SQUAD.at.range){ bs=d*0.8; best={ kind:'tank', ref:e, pos:e.pos }; } }
  if(a.at && boss && boss.alive){ const d=Math.hypot(boss.pos.x-a.pos.x, boss.pos.z-a.pos.z); if(d*0.8<bs && d<SQUAD.at.range){ bs=d*0.8; best={ kind:'tank', ref:boss, pos:boss.pos }; } }
  for(const G of liveGuards()){ const d=Math.hypot(G.gd.wx-a.pos.x, G.gd.wz-a.pos.z); if(d*1.1<bs && d<F.range+6){ bs=d*1.1; best={ kind:'guard', ref:G, pos:{ x:G.gd.wx, z:G.gd.wz } }; } }
  if(boss && boss.alive && boss.shielded){ const at=!!a.at;                                       // Z134 the general is immune while its shield pylons stand: the squad helps raze them
    if(at && best && best.ref===boss) best=null, bs=F.detect;                                     // (AT men stop wasting rockets on the shielded hull)
    for(const py of PYLONS){ if(!blocks.includes(py)) continue; const d=Math.hypot(py.x-a.pos.x, py.z-a.pos.z); if(d*(at?0.7:1.3)<bs && d<(at?SQUAD.at.range:F.range)){ bs=d*(at?0.7:1.3); best={ kind:at?'tank':'pylon', ref:py, pos:{ x:py.x, z:py.z } }; } } }
  return best; }
function nearestFreePickup(a){ let best=null, bd=SQUAD.lootDetect**2;
  for(const u of pickups){ if(!u.landed || u.stash || (u.claim && u.claim!==a && FT.includes(u.claim))) continue; const q=(u.x-a.pos.x)**2+(u.z-a.pos.z)**2; if(q<bd){ bd=q; best=u; } }
  return best; }
function nearestAnyEnemy(a, R){ let best=null, bd=R*R; for(const e of enemies){ if(e.def.air) continue; const q=(e.pos.x-a.pos.x)**2+(e.pos.z-a.pos.z)**2; if(q<bd){ bd=q; best=e; } } return best; }
function allyThink(a, now){
  const F=TROOPS.fireteam, p=S.player; a.thinkAt=now+SQUAD.think*(0.8+Math.random()*0.5);
  const foe=allyTarget(a); a.target=foe;
  if(a.carry){ a.task='rally'; if(!a.goal || a.goalKind!=='rally'){ a.goal=rallySpot(); a.goalKind='rally'; } return; }          // loot in hand → home first (shooting on the way)
  const tank=a.at ? null : nearestEnemyTank(a, SQUAD.cover.threat);
  if(tank){ if(!a.cover || now>(a.coverAt||0)){ a.cover=coverSpot(a.pos.x, a.pos.z, tank.pos.x, tank.pos.z, SQUAD.cover.search); a.coverAt=now+1.3; }
    if(a.cover){ a.task='cover'; a.goal=[a.cover.x, a.cover.z]; a.goalKind='cover'; if(!a.tookCover){ a.tookCover=true; tip('cover'); } return; }
    a.task='evade'; const ax=a.pos.x-tank.pos.x, az=a.pos.z-tank.pos.z, L=Math.hypot(ax,az)||1; a.goal=[a.pos.x+ax/L*8 - az/L*4, a.pos.z+az/L*8 + ax/L*4]; a.goalKind='evade'; return; }   // nothing to hide behind → get out of its line
  a.cover=null;
  { const cg=cmdGoal(a, now, foe); if(cg){ a.task=S.cmd.kind; a.goal=cg; a.goalKind=S.cmd.kind; return; } }   // Z107 an order (muster / assault) beats his own plan
  if(a.role==='mortar'){ const mt=mortarTarget(a); if(mt){ a.target=mt; a.task='fight'; const qx=mt.pos.x-a.pos.x, qz=mt.pos.z-a.pos.z, qd=Math.hypot(qx,qz)||1, M=SQUAD.mortar;   // mortar: keep to its band and lob
      a.goal = qd>M.max*0.9 ? [mt.pos.x-qx/qd*M.max*0.75, mt.pos.z-qz/qd*M.max*0.75] : (qd<M.min ? [a.pos.x-qx/qd*6, a.pos.z-qz/qd*6] : null); a.goalKind='fight'; return; } }
  if(a.role==='sapper' && !(foe && Math.hypot(foe.pos.x-a.pos.x, foe.pos.z-a.pos.z)<12)){ const dj=demolitionJob(a, now); if(dj) return; }           // sapper: bring a tower / hut down
  if(foe){ a.task='fight'; const qx=foe.pos.x-a.pos.x, qz=foe.pos.z-a.pos.z, qd=Math.hypot(qx,qz)||1, want=(a.at&&foe.kind==='tank')?SQUAD.at.range*0.75:(a.role==='mg'?SQUAD.mg.range:F.range)*0.75;
    if(qd>want){ a.goal=[foe.pos.x-qx/qd*want*0.9, foe.pos.z-qz/qd*want*0.9]; a.holdUntil=0; }
    else if(now<(a.holdUntil||0)){ a.goal=null; }                                                                            // HOLD: down and firing
    else if(now<(a.rushUntil||0)){ }                                                                                          // short RUSH to a new spot (goal already set)
    else if(a.rushUntil && now>=a.rushUntil){ a.rushUntil=0; a.holdUntil=now+R2(SQUAD.hold)*(a.role==='mg'?1.6:1); a.goal=null; }
    else { a.rushUntil=now+R2(SQUAD.rush); const s=(Math.random()<0.5?-1:1)*(2+Math.random()*3), fwd=Math.random()<0.4?2.5:0;   // bound sideways (sometimes forward) — nobody stands still in the open for long
      a.goal=[a.pos.x-qz/qd*s+qx/qd*fwd, a.pos.z+qx/qd*s+qz/qd*fwd]; const cv=coverSpot(a.goal[0], a.goal[1], foe.pos.x, foe.pos.z, 5); if(cv) a.goal=[cv.x, cv.z]; }   // prefer a bit of cover for the new spot
    a.goalKind='fight'; return; }
  const loot=nearestFreePickup(a); if(loot){ loot.claim=a; a.loot=loot; a.task='fetch'; a.goal=[loot.x, loot.z]; a.goalKind='fetch'; return; }
  const job=zoneJob(a); if(job){ a.task=job.kind; a.goal=[job.x, job.z]; a.goalKind=job.kind; a.job=job; return; }
  const front=nearestAnyEnemy(a, SQUAD.huntR); if(front && a.hold && Math.hypot(front.pos.x-a.hold[0], front.pos.z-a.hold[1]) > DEPLOY.holdR) { a.task='post'; a.goal=a.hold; a.goalKind='post'; return; }   // Z105 posted men hold their sector
  if(front){ a.task='advance'; const qx=front.pos.x-a.pos.x, qz=front.pos.z-a.pos.z, qd=Math.hypot(qx,qz)||1;
    a.goal=[front.pos.x-qx/qd*F.range*0.8, front.pos.z-qz/qd*F.range*0.8]; a.goalKind='advance'; return; }
  if(a.hold){ a.task='post'; if(!a.post || now>(a.postAt||0)){ const ang=Math.random()*6.283, r=1+Math.random()*5; a.post=[a.hold[0]+Math.sin(ang)*r, a.hold[1]+Math.cos(ang)*r]; a.postAt=now+5+Math.random()*4; } a.goal=a.post; a.goalKind='post'; return; }   // Z105 quiet → back to his post
  a.task='post'; if(!a.post || now>(a.postAt||0) || Math.hypot(a.post[0]-p.pos.x, a.post[1]-p.pos.z) > F.patrol[1]*1.6){   // quiet field → regroup around the tank
    const ang=Math.random()*6.283, r=F.patrol[0]+Math.random()*(F.patrol[1]-F.patrol[0]); a.post=[p.pos.x+Math.sin(ang)*r, p.pos.z+Math.cos(ang)*r]; a.postAt=now+4+Math.random()*3; }
  a.goal=a.post; a.goalKind='post'; }
const R2=(r)=>r[0]+Math.random()*(r[1]-r[0]);
// mortar targets: infantry clusters, tanks, guarded towers, camp huts — anything inside its min..max band, preferring groups of men
function mortarTarget(a){ const M=SQUAD.mortar; let best=null, bs=-1;
  const score=(x,z,w)=>{ const d=Math.hypot(x-a.pos.x, z-a.pos.z); if(d<M.min||d>M.max*1.2) return -1; return w - d*0.02; };
  for(const e of enemies){ if(e.def.air) continue; let w=e.def.inf?1:1.6; if(e.def.inf) for(const o of enemies) if(o!==e && o.def.inf && (o.pos.x-e.pos.x)**2+(o.pos.z-e.pos.z)**2<16) w+=0.8;   // a huddle is the best mortar target
    const s=score(e.pos.x,e.pos.z,w); if(s>bs){ bs=s; best={ kind:'shell', pos:e.pos, ref:e }; } }
  for(const t of towers){ if(t.falling) continue; const s=score(t.x,t.z,1.4); if(s>bs){ bs=s; best={ kind:'shell', pos:{x:t.x,z:t.z}, ref:t }; } }
  for(const c of CAMPS){ if(!c.alive) continue; const s=score(c.x,c.z,1.5); if(s>bs){ bs=s; best={ kind:'shell', pos:{x:c.x,z:c.z}, ref:c }; } }
  if(boss && boss.alive && boss.shielded) for(const py of PYLONS){ if(!blocks.includes(py)) continue; const s=score(py.x,py.z,2.2); if(s>bs){ bs=s; best={ kind:'shell', pos:{x:py.x,z:py.z}, ref:py }; } }   // Z134 shells walk onto the shield pylons
  return best; }
// sapper: pick the nearest standing watchtower / camp hut, run to its foot, plant, get clear — the charge brings it down
function demolitionJob(a, now){ const SP=SQUAD.sapper;
  if(a.demo && (a.demo.state==='plant' || a.demo.state==='clear')) { a.task='demolish'; return true; }
  let best=null, bd=SP.reach;
  for(const t of towers){ if(t.falling || !t.block || t.claimed && t.claimed!==a && FT.includes(t.claimed)) continue; const d=Math.hypot(t.x-a.pos.x, t.z-a.pos.z); if(d<bd){ bd=d; best={ x:t.x, z:t.z, block:t.block, ref:t }; } }
  for(const c of CAMPS){ if(!c.alive || !c.block || c.claimed && c.claimed!==a && FT.includes(c.claimed)) continue; const d=Math.hypot(c.x-a.pos.x, c.z-a.pos.z); if(d<bd){ bd=d; best={ x:c.x, z:c.z, block:c.block, ref:c }; } }
  if(boss && boss.alive && boss.shielded) for(const py of PYLONS){ if(!blocks.includes(py) || py.claimed && py.claimed!==a && FT.includes(py.claimed)) continue; const d=Math.hypot(py.x-a.pos.x, py.z-a.pos.z); if(d<bd){ bd=d; best={ x:py.x, z:py.z, block:py, ref:py }; } }   // Z134 sappers charge the shield pylons too
  if(!best) return false; best.ref.claimed=a; const ux=a.pos.x-best.x, uz=a.pos.z-best.z, L=Math.hypot(ux,uz)||1, off=(best.block.r||2)+0.9;
  a.demo={ state:'go', ...best, spot:[best.x+ux/L*off, best.z+uz/L*off] }; a.task='demolish'; a.goal=a.demo.spot; a.goalKind='demolish'; tip('sapper'); return true; }
export const CHARGES=[], ALLY_SHELLS=[];
function updateDemolition(a, dt, now){ const D=a.demo; if(!D) return; const SP=SQUAD.sapper;
  if(!blocks.includes(D.block)){ a.demo=null; a.thinkAt=0; return; }                                                     // already down
  if(D.state==='go'){ a.goal=D.spot; if(Math.hypot(a.pos.x-D.spot[0], a.pos.z-D.spot[1])<1.2){ D.state='plant'; D.at=now+SP.plant; a.goal=null; floatText('ĐANG ĐẶT THUỐC NỔ', '#ffcf5a', {x:a.pos.x, y:heightAt(a.pos.x,a.pos.z)+3, z:a.pos.z}, 13); } return; }
  if(D.state==='plant'){ a.goal=null; if(now>=D.at){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.3,0.35), new THREE.MeshStandardMaterial({ color:0x4a3a22, emissive:0xff2a1a, emissiveIntensity:0 })); m.position.set(D.spot[0], heightAt(D.spot[0],D.spot[1])+0.15, D.spot[1]); scene.add(m);
      CHARGES.push({ m, x:D.spot[0], z:D.spot[1], block:D.block, at:now+SP.fuse }); D.state='clear'; const ux=a.pos.x-D.x, uz=a.pos.z-D.z, L=Math.hypot(ux,uz)||1; a.goal=[D.x+ux/L*SP.safe*1.4, D.z+uz/L*SP.safe*1.4]; sfx('beep', a.pos); } return; }
  if(D.state==='clear'){ if(Math.hypot(a.pos.x-D.x, a.pos.z-D.z) > SP.safe){ a.demo=null; a.thinkAt=now+0.8; } } }
function updateCharges(dt, now){ for(let i=CHARGES.length-1;i>=0;i--){ const c=CHARGES[i]; c.m.material.emissiveIntensity = Math.sin(now*18)>0 ? 2.5 : 0;
    if(now<c.at) continue; CHARGES.splice(i,1); scene.remove(c.m);
    bigExplode({x:c.x,z:c.z}, 0xffae5c, 1.4); deformCrater(c.x, c.z, 1.6, 0.4); aoeDamage(c.x, c.z, 4, 40, false, now, 'HE', false);
    /* a pylon takes 60% of its health per charge (a tower / hut still falls at once) */
    if(blocks.includes(c.block)){ if(c.block.kind==='pylon'){ damageBlock(c.block, Math.max(110, (c.block.maxHp||240)*0.6)); c.block.claimed=null; } else damageBlock(c.block, (c.block.hp||1e4)+1); } floatText('ĐÃ ĐÁNH SẬP', '#9be04a', {x:c.x, y:heightAt(c.x,c.z)+5, z:c.z}, 20); } }
function fireShell(a, T, now){ const M=SQUAD.mortar; a.g.userData.muzzle.getWorldPosition(_sV); const lead=T.ref&&T.ref.vel ? M.flight*0.6 : 0;
  const tx=T.pos.x+(T.ref&&T.ref.vel?T.ref.vel.x*lead:0)+(Math.random()-0.5)*M.spread, tz=T.pos.z+(T.ref&&T.ref.vel?T.ref.vel.z*lead:0)+(Math.random()-0.5)*M.spread;
  const m=makeMortarShell(); m.scale.setScalar(0.6); scene.add(m); ALLY_SHELLS.push({ m, x0:_sV.x, y0:_sV.y, z0:_sV.z, tx, tz, t:0, T:M.flight, dmg:M.dmg*(1+(S.stage-1)*0.12) });
  spawnPart(_sV.x,_sV.y+0.4,_sV.z, 0,3,0, {color:0xd8d0c0, size:1.2, life:0.6, smoke:true, grav:0.3, drag:2, op:0.5}); sfx('launch', a.pos); }
function updateShells(dt, now){ const M=SQUAD.mortar; for(let i=ALLY_SHELLS.length-1;i>=0;i--){ const s=ALLY_SHELLS[i]; s.t+=dt; const u=Math.min(1, s.t/s.T), ty=heightAt(s.tx,s.tz);
    const x=s.x0+(s.tx-s.x0)*u, z=s.z0+(s.tz-s.z0)*u, y=s.y0+(ty-s.y0)*u + Math.sin(u*Math.PI)*11; s.m.position.set(x,y,z);
    _rdir.set(s.tx-s.x0, (ty-s.y0)+Math.cos(u*Math.PI)*Math.PI*11, s.tz-s.z0).normalize(); s.m.quaternion.setFromUnitVectors(_RUP, _rdir);   // Z112 nose follows the flight path (it used to tumble on a fixed world axis → looked like it flew sideways / upright)
    if(Math.random()<0.5) spawnPart(x-_rdir.x*0.5, y-_rdir.y*0.5, z-_rdir.z*0.5, 0, 0.3, 0, {color:0xcfc6b4, size:0.45, life:0.45, smoke:true, grav:0.2, drag:1.8, op:0.4});
    if(u<1) continue; ALLY_SHELLS.splice(i,1); scene.remove(s.m);
    bigExplode({x:s.tx,z:s.tz}, 0xffae5c, M.aoe/3); deformCrater(s.tx, s.tz, 0.9, 0.3); aoeDamage(s.tx, s.tz, M.aoe, s.dmg, false, now, 'HE', false); } }
export function clearAllyOrdnance(){ for(const c of CHARGES) scene.remove(c.m); CHARGES.length=0; for(const s of ALLY_SHELLS) scene.remove(s.m); ALLY_SHELLS.length=0; }
function allyFire(a, now){ const F=TROOPS.fireteam, T=a.target; if(!T) return false;
  if(T.kind==='inf' && (T.ref.dead || !enemies.includes(T.ref))){ a.target=null; return false; }
  if(T.kind==='guard' && !T.ref.gd.alive){ a.target=null; return false; }
  if(T.kind==='pylon' && !blocks.includes(T.ref)){ a.target=null; return false; }
  if(T.kind==='shell' && T.ref && ((T.ref.def && !enemies.includes(T.ref)) || T.ref.falling || T.ref.alive===false || (T.ref.kind==='pylon' && !blocks.includes(T.ref)))){ a.target=null; return false; }
  const dx=T.pos.x-a.pos.x, dz=T.pos.z-a.pos.z, d=Math.hypot(dx,dz), at=T.kind==='tank', mg=a.role==='mg';
  if(T.kind==='shell'){ const ang=Math.atan2(dx,dz); a.facing+=wrapAngle(ang-a.facing)*0.25; if(now<a.fireAt || d<SQUAD.mortar.min || d>SQUAD.mortar.max*1.2) return false; a.fireAt=now+SQUAD.mortar.cd*(0.85+Math.random()*0.3); fireShell(a, T, now); return true; }   // Z105 mortar lob
  if(d > (at?SQUAD.at.range:(T.kind==='guard'?F.range+6:(mg?SQUAD.mg.range:F.range)))) return false;
  const ang=Math.atan2(dx,dz); a.facing+=wrapAngle(ang-a.facing)*Math.min(1,0.2); if(now<a.fireAt || Math.abs(wrapAngle(ang-a.facing))>0.35) return false;
  a.g.userData.muzzle.getWorldPosition(_sV);
  if(at){ a.fireAt=now+SQUAD.at.cd*(0.85+Math.random()*0.3);                                                            // AT rocket (from a captured weapon depot)
    spawnBullet(_sV.x,_sV.z,ang+(Math.random()-0.5)*0.05,{owner:'p', dmg:SQUAD.at.dmg*(1+(S.stage-1)*0.12), speed:SQUAD.at.speed, color:0xffb060, r:0.34, life:1.6, maxDist:SQUAD.at.range+4, noArc:true, y:_sV.y, aoe:SQUAD.at.aoe, aoeDmg:SQUAD.at.dmg*0.6, type:'HE', fx:'blast', rocket:true});
    spawnPart(_sV.x-Math.sin(ang)*1.1,_sV.y,_sV.z-Math.cos(ang)*1.1, -Math.sin(ang)*6,0.5,-Math.cos(ang)*6, {color:0xd8d0c0, size:1.3, life:0.55, smoke:true, grav:0.3, drag:2, op:0.5}); sfx('rocketlaunch', a.pos); return true; }
  if(mg){ a.burst=(a.burst||SQUAD.mg.burst)-1; if(a.burst>0) a.fireAt=now+SQUAD.mg.gap; else { a.burst=SQUAD.mg.burst; a.fireAt=now+SQUAD.mg.pause; } }   // Z105 HMG: long bursts
  else a.fireAt=now+F.fireCd*(0.8+Math.random()*0.4);
  if(T.kind==='guard'){ const G=T.ref; spawnPart(_sV.x,_sV.y,_sV.z, dx/d*70, (G.gd.wy-_sV.y)/d*70, dz/d*70, {tex:'flash', color:0xe8ef86, size:0.32, life:d/70, grav:0, drag:0});   // tracer up at the platform
    if(Math.random()<SQUAD.guardHit) shootGuard(G.t, G.gd, a.pos.x, a.pos.z); }
  else spawnBullet(_sV.x,_sV.z,ang+(Math.random()-0.5)*(mg?SQUAD.mg.spread:0.06),{owner:'p', inf:true, dmg:(mg?SQUAD.mg.dmg:F.dmg)*(1+(S.stage-1)*0.12)*(a.armed?SQUAD.armedMul:1), speed:mg?90:80, color:0xe8ef86, r:mg?0.2:0.24, life:1.4, maxDist:(mg?SQUAD.mg.range:F.range)+2, noArc:true, y:_sV.y});
  spawnPart(_sV.x,_sV.y,_sV.z, Math.sin(ang)*6,0.4,Math.cos(ang)*6, {tex:'flash', color:0xf2f7a0, size:0.5, life:0.06, grav:0, drag:9}); sfx('rifleShot', a.pos); return true; }
// recall: board the hull (or gather beside it when every seat is taken). true = handled this frame
function allyMount(a, dt){ const F=TROOPS.fireteam, p=S.player, dx=p.pos.x-a.pos.x, dz=p.pos.z-a.pos.z, d=Math.hypot(dx,dz)||1, ox=a.pos.x, oz=a.pos.z;
  if(d < p.radius+2.4 && riders.length<RIDER.cap){ dropCarry(a, true); const i=FT.indexOf(a); FT.splice(i,1); scene.remove(a.g); scene.remove(a.bar); spawnRider(); const r=riders[riders.length-1]; r.hp=Math.max(6, a.hp/a.maxHp*r.maxHp);
    S.recallIn=(S.recallIn||0)+1; floatText('LÊN XE '+S.recallIn, '#9bd14a', p.pos, 14); FT.forEach((o,j)=>o.slot=j); updateCrewBtn(); return true; }
  const stand = riders.length>=RIDER.cap ? p.radius+3.5 : 0;                                                      // seats full → crowd round the hull
  if(d>stand){ a.pos.x+=dx/d*F.sprint*dt; a.pos.z+=dz/d*F.sprint*dt; infPushBlocks(a.pos); a.facing=Math.atan2(dx,dz); }
  allyPose(a, Math.hypot(a.pos.x-ox,a.pos.z-oz), dt, false); poseSoldier(a.g, 'stand', dt); return true; }
function allyPose(a, moved, dt, fired){ a.g.position.set(a.pos.x, heightAt(a.pos.x,a.pos.z)+(a.jy0||0), a.pos.z); a.g.rotation.y=a.facing; animateSoldier(a.g, moved/1.15, dt, fired);
  a.bar.position.set(a.pos.x, TROOPS.look.barY*stanceBarK(a.g)+heightAt(a.pos.x,a.pos.z), a.pos.z); a.bar.quaternion.copy(camera.quaternion); }
// loot on a soldier's back (a tiny copy of the item) — handed in at the rally point, or dropped where he falls
function takeCarry(a, u){ const it=takePickup(u); if(!it) return; a.carry=it; const m=lootModel(it.def); m.scale.setScalar(0.32); m.position.set(0,1.32,-0.34); a.g.add(m); a.carryMesh=m;
  floatText('NHẶT ĐỒ → KHU TẬP KẾT', '#9be04a', {x:a.pos.x, y:heightAt(a.pos.x,a.pos.z)+3, z:a.pos.z}, 13); }
export function dropCarry(a, toTank){ if(!a.carry) return; if(a.carryMesh) a.g.remove(a.carryMesh); a.carryMesh=null; const it=a.carry; a.carry=null;
  if(toTank){ applyPowerup(it.def); sfx('powerup'); } else dropPowerup({x:a.pos.x, z:a.pos.z}, it.tier, it.def); }
export function updateFireteam(dt, now){
  updateFireteamAPC(dt, now); updateCharges(dt, now); updateShells(dt, now); if(!FT.length) return;
  const F=TROOPS.fireteam, p=S.player, rr=recallRange();
  if(S.recall){ rangeRing.material.opacity = 0.3+0.15*Math.sin(now*10); }                            // recall in progress: the ring pulses
  updateLadders();
  for(const a of FT.slice()){
    if(a.climb){ updateClimb(a, dt); if(a.climb) continue; }                                       // Z145 on a scaling ladder
    if(S.recall){ if(!a.answering && Math.hypot(a.pos.x-p.pos.x, a.pos.z-p.pos.z) <= rr) a.answering=true; } else a.answering=false;   // only men inside the ring answer
    a.mounting=a.answering; if(a.answering && allyMount(a, dt)) continue;
    if(now>=(a.thinkAt||0)) allyThink(a, now);
    if(a.demo) updateDemolition(a, dt, now);
    const ox=a.pos.x, oz=a.pos.z; let mx=0, mz=0, md=0;
    if(a.goal){ mx=a.goal[0]-a.pos.x; mz=a.goal[1]-a.pos.z; md=Math.hypot(mx,mz); if(md<0.6 && (a.task==='cover'||a.task==='post')){ mx=mz=0; } }
    for(const o of FT){ if(o===a) continue; const sx=a.pos.x-o.pos.x, sz=a.pos.z-o.pos.z, sq=sx*sx+sz*sz; if(sq < F.spread*F.spread && sq>1e-4){ const k=(F.spread-Math.sqrt(sq))*2; mx+=sx*k; mz+=sz*k; } }   // personal space
    const ml=Math.hypot(mx,mz); if(ml>0.3){ const run = a.task==='cover'||a.task==='evade'||a.task==='rally'||md>12, sp=(run?F.sprint:F.speed)*(a.carry?0.85:1); a.pos.x+=mx/ml*Math.min(ml,sp*dt); a.pos.z+=mz/ml*Math.min(ml,sp*dt); }
    if(a.kbx||a.kbz){ a.pos.x+=a.kbx*dt; a.pos.z+=a.kbz*dt; const kf=Math.max(0,1-dt*5); a.kbx*=kf; a.kbz*=kf; if(Math.abs(a.kbx)+Math.abs(a.kbz)<0.1){ a.kbx=a.kbz=0; } }
    const px=a.pos.x-p.pos.x, pz=a.pos.z-p.pos.z, pd=Math.hypot(px,pz); if(pd<p.radius+1.4 && pd>1e-3){ a.pos.x=p.pos.x+px/pd*(p.radius+1.4); a.pos.z=p.pos.z+pz/pd*(p.radius+1.4); }   // step clear of our own tracks
    infPushBlocks(a.pos); clampField(a.pos, 2);
    if(a.ladPc) tryClimb(a);                                                                         // Z145 reached the wall foot → up the ladder
    // errands: pick up the item he walked to, hand loot in at the rally point
    if(a.task==='fetch' && a.loot){ if(!pickups.includes(a.loot)){ a.loot=null; a.thinkAt=0; } else if(Math.hypot(a.loot.x-a.pos.x, a.loot.z-a.pos.z)<1.4){ takeCarry(a, a.loot); a.loot=null; a.thinkAt=0; } }
    if(a.carry && inRally(a.pos.x, a.pos.z, -1)){ const it=a.carry; if(a.carryMesh) a.g.remove(a.carryMesh); a.carryMesh=null; a.carry=null; stashLoot(it); a.thinkAt=0; a.goal=null; }
    const fired=allyFire(a, now);
    if(!fired && !a.target){ const mv=Math.hypot(a.pos.x-ox,a.pos.z-oz); if(mv>0.01) a.facing+=wrapAngle(Math.atan2(a.pos.x-ox,a.pos.z-oz)-a.facing)*Math.min(1,dt*8); }
    let jy=0; if(a.jumpT>0){ a.jumpT-=dt; const u=Math.max(0,a.jumpT)/0.4; jy=Math.max(0,(a.jy-heightAt(a.pos.x,a.pos.z)))*u*u + Math.sin((1-u)*Math.PI)*0.5; }   // hop off the hull
    a.jy0=jy; const mvd=Math.hypot(a.pos.x-ox,a.pos.z-oz); allyPose(a, mvd, dt, fired);
    let st='stand';                                                                                  // Z105 stance: run upright · kneel at cover / to plant / mortar · prone with the MG or at range in the open
    if(mvd < 0.03 && !(a.jumpT>0)){ const T=a.target, dT=T ? Math.hypot(T.pos.x-a.pos.x, T.pos.z-a.pos.z) : 0;
      if(a.task==='cover' && atCover(a.pos, a.cover)) st='crouch';
      else if(a.demo) st='crouch';
      else if(T && T.kind==='shell') st='crouch';
      else if(T && (a.role==='mg' || (dT>SQUAD.proneR && T.kind==='inf' && !a.at))) st='prone';
      else if(T || a.task==='post') st='crouch'; }
    poseSoldier(a.g, st, dt);
    for(const e of enemies){ if(!solidTank(e)) continue; const qx=e.pos.x-a.pos.x, qz=e.pos.z-a.pos.z; if(qx*qx+qz*qz < (e.r+0.8)**2){ if(Math.hypot(e.vel.x,e.vel.z)>4) damageAlly(a, 999); else { const L=Math.hypot(qx,qz)||1; a.pos.x-=qx/L*0.5; a.pos.z-=qz/L*0.5; } } }   // enemy tracks crush them too
    if(a.dead) continue;
    a.bar.visible = a.hp < a.maxHp-0.5; const f=Math.max(0,a.hp/a.maxHp); a.barFill.scale.x=Math.max(0.001,f); a.barFill.position.x=-(1-f)*0.5; a.barFill.material.color.setHex(f>0.5?0x7fe06a:(f>0.25?0xffcf5a:0xff5a4a));
    if(a.hitT>0){ a.hitT-=dt; if(a.hitT<=0){ const t2=a.g.userData.torso; if(t2){ t2.material.emissive.setHex(0x000000); t2.material.emissiveIntensity=0; } } }
  }
}
// Z104 a weapon depot re-arms a soldier: AT launcher on his shoulder + better rifle rounds
export function armAlly(a){ if(a.at) return; a.at=true; a.armed=true; const u=a.g.userData, tm=new THREE.MeshStandardMaterial({color:0x4a5a30,roughness:0.75,metalness:0.25});
  const dm=new THREE.MeshStandardMaterial({color:0x22231e,roughness:0.6,metalness:0.45}), L=new THREE.Group(); L.position.set(-0.2,0.7,-0.05); u.up.add(L);   // Z113 recoilless AT launcher on the shoulder
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.95,10), tm); tube.rotation.x=Math.PI/2; L.add(tube);
  for(const z of [-0.5,0.5]){ const fl=new THREE.Mesh(new THREE.CylinderGeometry(z<0?0.085:0.07,0.06,0.12,10), dm); fl.rotation.x=z<0?-Math.PI/2:Math.PI/2; fl.position.z=z; L.add(fl); }   // venturi + muzzle flare
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.07,0.16), dm); sight.position.set(-0.07,0.07,0.12); L.add(sight);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.12,0.05), dm); grip.position.set(0,-0.09,0.1); L.add(grip); }
