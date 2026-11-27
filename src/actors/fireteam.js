// actors/fireteam.js — Z89/Z100 friendly FIRETEAM: called in on foot (no-tanks: no APC, no hull to board), free-roam inside the soldier's combat zone
import * as THREE from 'three';
import { TROOPS, SQUAD, DEPLOY, FIELDCRAFT, REAL, SHOTFX } from '../../config.js';
import { ambushHold, coopHostDeath, CAMPS, FTSQ, HELI_DOWN, MOBILE, S, droneMarkK, _RUP, _rdir, _sV, animateSoldier, aoeDamage, atCover, bigExplode, blocks, blocksAt, bullets, burst, camera, canThrow, clampField, clearLadders, cmdGoal, combatDive, concuss, coverSpot, damageBlock, damageEnemy, dazePose, dazed, deformCrater, dropGuard, dropPowerup, enemies, fieldEdgePoint, flingDead, floatText, heightAt, inRally, infBlastK, kitAttach, liveGuards, lootModel, losBlocked, makeMortarShell, makeSoldierBar, makeSoldierMesh, nadeBark, nadeFlee, nadeTarget, orderGoal, pickups, playerRange, poseSoldier, radio, rallySpot, riverWay, rifleFX, scene, sfx, shootGuard, smokeSpreadK, soldierReloading, spawnBullet, spawnPart, stanceBarK, stashLoot, stepFlung, takePickup, throwNade, throwSmoke, tip, towers, tracerNext, tryClimb, updateClimb, updateLadders, wadeAt, wantPeek, wrapAngle, zoneJob, gunSound } from '../hub.js';
import { swimFoeK } from '../hub.js';   // SWIM 1 (game/swim.js)
import { muzzleFX, freeStreak } from '../hub.js';   // GUNFX 1 (fx/gunfx.js)

// ---- friendly FIRETEAM ----
export const FT=[]; 
export function callFireteam(now){
  const F=TROOPS.fireteam, p=S.player, want=Math.min(MOBILE?F.capMobile:F.cap, Math.round(F.size+(S.stage-1)*F.perStage)), need=want-FT.length;
  if(need<=0){ for(const a of FT) a.hp=a.maxHp; floatText('TỔ BỘ BINH ĐÃ TIẾP TẾ','#9bd14a',p.pos,16); return; }
  const [ex,ez]=fieldEdgePoint(Math.PI/2+(Math.random()-0.5)*0.5, 3);                                   // (no-tanks: no APC) they run in from our side of the field (Z106 at the fence)
  for(let i=0;i<need;i++) spawnAlly(ex+(Math.random()-0.5)*7, ez+(Math.random()-0.5)*4, Math.PI);
  radio('SCH: Tổ bộ binh đang chạy tới từ phía sau anh.'); sfx('beep');
}
export let _mixI=0;
export function spawnAlly(x, z, dirA, role){ const F=TROOPS.fireteam, g=makeSoldierMesh(); g.scale.setScalar(TROOPS.look.scale); scene.add(g); const bar=makeSoldierBar(); bar.g.scale.setScalar(0.7); scene.add(bar.g);
  const k=FT.length, a={ g, bar:bar.g, barFill:bar.fill, pos:new THREE.Vector3(x,0,z), hp:F.hp, maxHp:F.hp, fireAt:0, slot:k, kbx:Math.sin(dirA)*6, kbz:Math.cos(dirA)*6, hitT:0, dead:false, facing:dirA }; FT.push(a);
  setRole(a, role || (S.roleQueue && S.roleQueue.length ? S.roleQueue.shift() : SQUAD.mix[(_mixI++)%SQUAD.mix.length])); return a; }
// Z105 specialist kit on the model: MG = long barrel + bipod · mortar = tube + baseplate on the back · sapper = satchel charges
export function setRole(a, role){ a.role=role||'rifle'; const u=a.g.userData, M=new THREE.MeshStandardMaterial({ color:0x2a2c24, roughness:0.6, metalness:0.5 });
  if(a.role==='mg'){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.55,6), M); b.rotation.x=Math.PI/2; kitAttach(u, u.gun, b, 'muzzle', [0,-0.01,0.15]); const bp=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.02,0.02), M); kitAttach(u, u.gun, bp, 'muzzle', [0,-0.09,0.08]); }   // Z249 on the kit's muzzle anchor
  else if(a.role==='mortar'){ const t=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.85,8), M); t.rotation.x=0.35; kitAttach(u, u.up, t, 'back', [0.14,0.05,0.01]); const pl=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.04,10), M); pl.rotation.x=Math.PI/2; kitAttach(u, u.up, pl, 'back', [-0.12,-0.05,-0.01]); }
  else if(a.role==='sapper'){ const S2=new THREE.MeshStandardMaterial({ color:0x6a5a3a, roughness:0.9 }); for(const sx of [-0.13,0.13]){ const s=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.2,0.12), S2); kitAttach(u, u.up, s, 'back', [sx,-0.19,0.05]); } } }
export function damageAlly(a, dmg){ if(a.dead || a.puppet) return;   /* COOP 9 on a co-op guest our men are the host's: nothing here hurts them */ a.hp-=dmg; if(a.hp<=0) dropCarry(a, false); a.hitT=0.16; const t=a.g.userData.torso; if(t){ t.material.emissive.setHex(0xff5a2a); t.material.emissiveIntensity=0.85; }
  if(a.hp<=0){ a.dead=true; if(a.nid) coopHostDeath(a);   /* COOP 9 (an id only on a co-op host) */ const i=FT.indexOf(a); if(i>=0) FT.splice(i,1); floatText('✝','#ff9a7a',{x:a.pos.x,y:1.7,z:a.pos.z},16); scene.remove(a.bar);
    if(dmg>=100) burst(a.pos, 0x2c331c, 6, 5, {y:0.9, life:0.7, size:1.1, smoke:true, op:0.45});   // Z312 a heavy round knocks him down in a cloud of dust — whole, never torn into pieces
    { let ux=0, uz=0, bd=40*40; for(const e of enemies){ const dx=a.pos.x-e.pos.x, dz=a.pos.z-e.pos.z, q=dx*dx+dz*dz; if(q<bd){ bd=q; ux=dx; uz=dz; } }   // Z402 thrown away from the nearest enemy (the one who shot him) and gone in a burst
      const L=Math.hypot(ux,uz); if(L<0.05){ const r=Math.random()*6.283; ux=Math.cos(r); uz=Math.sin(r); } else { ux/=L; uz/=L; } ALLY_DEAD.push({ g:a.g, t:0, ...flingDead(a.g, ux, uz, dmg>=100?1.3:1, dmg>=100) }); }                                                         // Z113 shot: he falls and lies there a while
    FT.forEach((o,j)=>o.slot=j); } }
export const ALLY_DEAD=[];
export function updateAllyDead(dt){ for(let i=ALLY_DEAD.length-1;i>=0;i--){ const d=ALLY_DEAD[i], m=d.g; d.t+=dt;
  if(stepFlung(d, m, dt)){ scene.remove(m); if(m.userData.droppedGun) scene.remove(m.userData.droppedGun); ALLY_DEAD.splice(i,1); } } }   // Z402 thrown, lands, bursts, gone
// Z104 an enemy blast (mortar, RPG, artillery, bomb) among OUR men on foot: inside the core = killed, the ring = wounded
export function blastAllies(x, z, r, dmg){ const now=performance.now()/1000; for(const a of FT.slice()){ const d=Math.hypot(a.pos.x-x, a.pos.z-z), k=infBlastK(d, r); if(k>0) damageAlly(a, k>=1 ? 999 : dmg*k); if(!a.dead && d<r*REAL.concuss.reach) concuss(a, x, z, now); } }   // Z223 survivors thrown flat
export function clearFireteam(){ clearLadders(); for(const d of ALLY_DEAD){ scene.remove(d.g); if(d.g.userData.droppedGun) scene.remove(d.g.userData.droppedGun); } ALLY_DEAD.length=0; for(const a of FT){ scene.remove(a.g); scene.remove(a.bar); } FT.length=0; }
export function infPushBlocks(pos){ for(const bl of blocksAt(pos.x, pos.z)){ if(bl.obb){ const s_=Math.sin(bl.obb.f), c_=Math.cos(bl.obb.f), dx_=pos.x-bl.x, dz_=pos.z-bl.z, al=dx_*s_+dz_*c_, ac=dx_*c_-dz_*s_, hw=bl.obb.hw+0.4; if(Math.abs(al)<bl.obb.hl+0.3 && Math.abs(ac)<hw){ const push=(ac<0?-hw:hw)-ac; pos.x+=c_*push; pos.z-=s_*push; } continue; }
  const bx=pos.x-bl.x, bz=pos.z-bl.z, q=bx*bx+bz*bz, rr=bl.r+0.45; if(q<rr*rr && q>1e-4){ const qq=Math.sqrt(q); pos.x=bl.x+bx/qq*rr; pos.z=bl.z+bz/qq*rr; } } }
// Z104 AUTONOMOUS SQUAD — soldiers are no longer leashed to the tank. Each one re-plans a few times a second, in priority order:
//   RECALL (only men inside the ring when the command is held answer: board the hull, or gather by it when it is full) →
//   CARRY loot home to the rally point → COVER from enemy armour (far side of a wall / rock / sandbags) →
//   FIGHT infantry and tower guards (tanks only with an AT launcher from a captured depot) → FETCH dropped loot →
//   JOBS (capture an open depot, free an open POW stockade) → ADVANCE on the nearest enemy → REGROUP around the tank.
export function recallRange(){ return Math.max(TROOPS.fireteam.zoneMin, playerRange()); }   // the visible range ring
function allyTarget(a){ const F=TROOPS.fireteam; let best=null, bs=F.detect;
  for(const e of enemies){ if(e.dead) continue; const d=Math.hypot(e.pos.x-a.pos.x, e.pos.z-a.pos.z)*droneMarkK(e);   // DRONE 1 a man the recon drone has marked counts as nearer
    if(e.def.inf){ if(d<bs){ bs=d; best={ kind:'inf', ref:e, pos:e.pos }; } } }
  if(a.at) for(const t of towers){ if(t.falling || (t.block && !blocks.includes(t.block))) continue; let live=0; for(const gd of t.guards) if(gd.alive) live++; if(!live) continue;   // Z175 a man with a launcher puts a rocket into a manned tower
    const d=Math.hypot(t.x-a.pos.x, t.z-a.pos.z), w=d*(1.1-0.12*Math.min(4,live)); if(d>5 && d<SQUAD.at.range+6 && w<bs){ bs=w; best={ kind:'towerAT', ref:t, pos:{ x:t.x, z:t.z } }; } }
  for(const G of liveGuards()){ const d=Math.hypot(G.gd.wx-a.pos.x, G.gd.wz-a.pos.z); if(d*0.9<bs && d<F.range+6){ bs=d*0.9; best={ kind:'guard', ref:G, pos:{ x:G.gd.wx, z:G.gd.wz } }; } }   // Z200 a man up on a platform is shot down first (he sees the whole field)
  if(a.role!=='mortar') for(const e of enemies){ if(!e.def.air || e.dead || HELI_DOWN.some(h=>h.e===e)) continue; const d=Math.hypot(e.pos.x-a.pos.x, e.pos.z-a.pos.z), rng=a.at?SQUAD.at.range+SQUAD.ai.airRng+4:(a.role==='mg'?SQUAD.mg.range:F.range)+SQUAD.ai.airRng;   // Z200 helicopters: everyone with a gun that reaches
    if(d<rng && d*SQUAD.ai.airPri<bs){ bs=d*SQUAD.ai.airPri; best={ kind:'air', ref:e, pos:e.pos }; } }
  { const fo=FTSQ.focus; if(fo && enemies.includes(fo) && (!best || best.kind==='inf') && !(fo.def.air && a.role==='mortar')){ const d=Math.hypot(fo.pos.x-a.pos.x, fo.pos.z-a.pos.z); if(d<F.detect && d<bs+12) best={ kind:'inf', ref:fo, pos:fo.pos }; } }   // Z173 the squad's focus target (RPG men, their leader) first
  return best; }
function nearestFreePickup(a){ let best=null, bd=SQUAD.lootDetect**2;
  for(const u of pickups){ if(!u.landed || u.stash || (u.claim && u.claim!==a && FT.includes(u.claim))) continue; const q=(u.x-a.pos.x)**2+(u.z-a.pos.z)**2; if(q<bd){ bd=q; best=u; } }
  return best; }
function nearestAnyEnemy(a, R){ let best=null, bd=R*R; for(const e of enemies){ if(e.def.air) continue; const q=(e.pos.x-a.pos.x)**2+(e.pos.z-a.pos.z)**2; if(q<bd){ bd=q; best=e; } } return best; }
function allyThink(a, now){
  const F=TROOPS.fireteam, p=S.player; a.thinkAt=now+SQUAD.think*(0.8+Math.random()*0.5);
  const foe=allyTarget(a); a.target=foe;
  if(a.hp < a.maxHp*SQUAD.ai.woundedHp) a.healing=true; else if(a.hp >= a.maxHp*SQUAD.ai.healed) a.healing=false;   // Z200 badly hurt → back behind the tank to patch up, then back into it
  if(a.healing && !a.answering){ a.task='fallback'; a.goal=fallbackSpot(a, now); a.goalKind='fallback'; if(!a.saidHurt){ a.saidHurt=true; floatText('BỊ THƯƠNG — RÚT VỀ', '#ffcf5a', new THREE.Vector3(a.pos.x,2.6,a.pos.z), 12); } return; } else a.saidHurt=false;
  if(a.carry){ a.task='rally'; if(!a.goal || a.goalKind!=='rally'){ a.goal=rallySpot(); a.goalKind='rally'; } return; }          // loot in hand → home first (shooting on the way)
  a.cover=null;
  { const cg=cmdGoal(a, now, foe); if(cg){ a.task=S.cmd.kind; a.goal=cg; a.goalKind=S.cmd.kind; return; } }   // Z107 an order (muster / assault) beats his own plan
  if(S.sqOrder==='hold' && a.orderPos){ a.task=foe?'fight':'post'; a.goal=a.orderPos; a.goalKind='order'; return; }   // Z173 squad order: hold this ground, shoot from it
  { const og=orderGoal(a, foe, now); if(og){ a.task='order'; a.goal=og; a.goalKind='order'; return; } }                 // Z173 squad order: push / flank left / flank right (firing on the move)
  if(a.role==='mortar'){ const mt=mortarTarget(a); if(mt){ a.target=mt; a.task='fight'; const qx=mt.pos.x-a.pos.x, qz=mt.pos.z-a.pos.z, qd=Math.hypot(qx,qz)||1, M=SQUAD.mortar;   // mortar: keep to its band and lob
      a.goal = qd>M.max*0.9 ? [mt.pos.x-qx/qd*M.max*0.75, mt.pos.z-qz/qd*M.max*0.75] : (qd<M.min ? [a.pos.x-qx/qd*6, a.pos.z-qz/qd*6] : null); a.goalKind='fight'; return; } }
  if(a.role==='sapper' && !(foe && Math.hypot(foe.pos.x-a.pos.x, foe.pos.z-a.pos.z)<12)){ const dj=demolitionJob(a, now); if(dj) return; }           // sapper: bring a tower / hut down
  if(foe && FTSQ.posture==='fallback' && foe.kind!=='air'){ a.task='fallback'; a.goal=fallbackSpot(a, now); a.goalKind='fallback'; return; }   // Z200 outgunned: the squad pulls back behind the tank, firing as it goes
  if(foe && a.peek && now<a.peekUntil){ a.task='fight'; a.goal=a.peek; a.goalKind='fight'; return; }   // Z220 walking out to a clear line of fire
  if(foe){ a.task='fight'; const qx=foe.pos.x-a.pos.x, qz=foe.pos.z-a.pos.z, qd=Math.hypot(qx,qz)||1, want=(a.role==='mg'?SQUAD.mg.range:F.range)*(FTSQ.posture==='advance'&&foe.kind!=='air'?0.5:0.75);   // Z200 the upper hand → close in
    if(qd>want){ a.goal=[foe.pos.x-qx/qd*want*0.9, foe.pos.z-qz/qd*want*0.9]; a.bndAt=0; }
    else if(((a.slot||0)%2)===FTSQ.bound && (a.supp||0)<0.8 && a.role!=='mg' && a.role!=='mortar'){ if(a.bndAt!==FTSQ.swapAt){ a.bndAt=FTSQ.swapAt;   // Z173 BOUNDING team: a short dash to the next cover, a little closer and round the side
        const s=(Math.random()<0.5?-1:1)*(1.5+Math.random()*2.5), fwd=qd>want*0.55 ? 2.5+Math.random()*3 : 0; a.goal=[a.pos.x-qz/qd*s+qx/qd*fwd, a.pos.z+qx/qd*s+qz/qd*fwd];
        const cv=coverSpot(a.goal[0], a.goal[1], foe.pos.x, foe.pos.z, 5); if(cv) a.goal=[cv.x, cv.z]; } }
    else { if(!a.fcov || now>(a.fcovAt||0)){ a.fcov=coverSpot(a.pos.x, a.pos.z, foe.pos.x, foe.pos.z, 5); a.fcovAt=now+3; } a.goal=a.fcov ? [a.fcov.x, a.fcov.z] : null; }   // COVERING team: down and firing while the others move · Z200 from behind the nearest cover
    a.goalKind='fight'; return; }
  const loot=nearestFreePickup(a); if(loot){ loot.claim=a; a.loot=loot; a.task='fetch'; a.goal=[loot.x, loot.z]; a.goalKind='fetch'; return; }
  const job=zoneJob(a); if(job){ a.task=job.kind; a.goal=[job.x, job.z]; a.goalKind=job.kind; a.job=job; return; }
  const front=nearestAnyEnemy(a, SQUAD.huntR); if(front && a.hold && Math.hypot(front.pos.x-a.hold[0], front.pos.z-a.hold[1]) > DEPLOY.holdR) { a.task='post'; a.goal=a.hold; a.goalKind='post'; return; }   // Z105 posted men hold their sector
  if(front){ a.task='advance'; const p=S.player, qx=front.pos.x-p.pos.x, qz=front.pos.z-p.pos.z, qd=Math.hypot(qx,qz)||1, ux=qx/qd, uz=qz/qd, k=a.slot||0, row=(k+1)>>1, side=(k%2?1:-1)*row*3.2, back=row*3.0;   // Z223 the squad closes in a WEDGE (point man ahead, the rest echeloned back on both sides)
    const bx=front.pos.x-ux*F.range*0.8, bz=front.pos.z-uz*F.range*0.8; a.goal=[bx-ux*back+uz*side, bz-uz*back-ux*side]; a.goalKind='advance'; return; }
  if(a.hold){ a.task='post'; if(!a.post || now>(a.postAt||0)){ const ang=Math.random()*6.283, r=1+Math.random()*5; a.post=[a.hold[0]+Math.sin(ang)*r, a.hold[1]+Math.cos(ang)*r]; a.postAt=now+5+Math.random()*4; } a.goal=a.post; a.goalKind='post'; return; }   // Z105 quiet → back to his post
  a.task='post'; a.goal=formationSlot(a); a.goalKind='form'; }   // Z220 quiet field → ESCORT FORMATION on the tank (two files when it rolls, an all-round ring when it halts)
// Z220 the man's slot round the tank: rolling → two files flanking and trailing the hull (a little ahead of where it is going); halted → a
//   perimeter ring, every man facing out
function formationSlot(a){ const C=FIELDCRAFT.form, p=S.player, i=Math.max(0, FT.indexOf(a)), n=FT.length, v=Math.hypot(p.vel.x, p.vel.z);
  if(v>C.moveV){ const h=Math.atan2(p.vel.x, p.vel.z), fx=Math.sin(h), fz=Math.cos(h), side=(i%2?1:-1)*(C.file+((i>>1)%2)*C.file2), back=1.5+(i>>2)*C.rowGap*1.3+((i>>1)%2)*C.rowGap*0.6;
    const ox=p.pos.x+p.vel.x*C.lead, oz=p.pos.z+p.vel.z*C.lead; a.ringOut=null; return [ox-fx*back+fz*side, oz-fz*back-fx*side]; }
  const ang=p.facing+(i+0.5)/n*6.283, r=C.ringR+(i%2)*C.ringR2; a.ringOut=ang; return [p.pos.x+Math.sin(ang)*r, p.pos.z+Math.cos(ang)*r]; }
const R2=(r)=>r[0]+Math.random()*(r[1]-r[0]);
const _fl={ x:0, z:0 };
// Z220 a rifleman of ours throws a frag grenade: men behind cover or in a knot, 8–20 m out (true = he threw this frame)
function allyNade(a, now){ const N=FIELDCRAFT.nade; a.nadeAt=now+0.8+Math.random()*0.5; if(!canThrow('p', now)) return false;
  _nf.length=0; for(const e of enemies) if(e.def.inf && !e.dead && (e.pos.x-a.pos.x)**2+(e.pos.z-a.pos.z)**2 < N.maxD*N.maxD) _nf.push(e);
  const t=nadeTarget(a.pos.x, a.pos.z, _nf, e=>e.inCover || (e.supp||0)>0.5); if(!t) return false;
  a.nadeAt=now+R2(N.cdA); a.facing=Math.atan2(t.pos.x-a.pos.x, t.pos.z-a.pos.z); throwNade('p', a.pos.x, a.pos.z, t.pos.x, t.pos.z, now);
  if(now-(FTSQ.nadeBarkAt||-99)>7){ FTSQ.nadeBarkAt=now; floatText('LỰU ĐẠN!', '#ffd27a', new THREE.Vector3(a.pos.x,2.6,a.pos.z), 12); } return true; }
const _nf=[];
// Z200 where a man falls back to: behind our tank as seen from the nearest threat, each in his own slot, tucked behind cover if there is some
function fallbackSpot(a, now){ if(a.fbSpot && now<(a.fbAt||0)) return a.fbSpot; const p=S.player, th=nearestAnyEnemy(a, 50) || { pos:{ x:a.pos.x, z:a.pos.z-10 } };
  const ux=p.pos.x-th.pos.x, uz=p.pos.z-th.pos.z, L=Math.hypot(ux,uz)||1, s=((a.slot||0)%5-2)*2.6, x=p.pos.x+ux/L*7-uz/L*s, z=p.pos.z+uz/L*7+ux/L*s, cv=coverSpot(x, z, th.pos.x, th.pos.z, 6);
  a.fbAt=now+2.5; return a.fbSpot = cv ? [cv.x, cv.z] : [x, z]; }
// Z200 the squad weighs itself against what is around it: advance when it has the upper hand, fall back behind the tank when it is outgunned
let _postAt=0, _barkAt=-99;
function squadPosture(now){ if(now<_postAt) return; _postAt=now+SQUAD.ai.postureEvery; if(!FT.length){ FTSQ.posture='hold'; return; }
  let cx=0, cz=0, str=0; for(const a of FT){ cx+=a.pos.x; cz+=a.pos.z; str+=Math.max(0,a.hp)/a.maxHp; } cx/=FT.length; cz/=FT.length; const at=FT.some(a=>a.at), R=SQUAD.ai.threatR;
  let thr=0; for(const e of enemies){ if(e.abandoned || e.dead) continue; const q=(e.pos.x-cx)**2+(e.pos.z-cz)**2; if(q>R*R) continue; thr += e.def.air ? 2.5 : 1; }
  const was=FTSQ.posture||'hold', now2 = thr > str*SQUAD.ai.fallK+1 ? 'fallback' : (thr < str*SQUAD.ai.advK && thr>0 ? 'advance' : 'hold'); FTSQ.posture=now2;
  if(now2!==was && now2!=='hold' && now-_barkAt>SQUAD.ai.barkGap){ _barkAt=now; const adv=now2==='advance'; floatText(adv?'TIẾN LÊN!':'RÚT LUI!', adv?'#9be04a':'#ffcf5a', new THREE.Vector3(cx,3,cz), 16);
    radio(adv ? 'Tổ bộ binh: địch núng thế rồi — cả tổ tiến lên, áp sát!' : 'Tổ bộ binh: địch quá đông — rút về sau, vừa lui vừa bắn!'); }
  if(now2==='fallback' && now>(FTSQ.smokeAt||0)){ let ex=0, ez=0, n=0; for(const e of enemies){ if(e.def.air || e.dead) continue; const q=(e.pos.x-cx)**2+(e.pos.z-cz)**2; if(q<R*R){ ex+=e.pos.x; ez+=e.pos.z; n++; } }   // Z220 breaking contact: a smoke screen between us and them
    if(n){ ex/=n; ez/=n; const dx=ex-cx, dz=ez-cz, dd=Math.hypot(dx,dz)||1, k=Math.min(dd*0.5, FIELDCRAFT.smoke.ahead), sx=cx+dx/dd*k, sz=cz+dz/dd*k; FTSQ.smokeAt=now+FIELDCRAFT.smoke.cdA; throwSmoke(sx, sz, 'p', now); floatText('THẢ KHÓI — RÚT!', '#dfe8d0', new THREE.Vector3(sx,2.8,sz), 14); } } }
// mortar targets: infantry clusters, tanks, guarded towers, camp huts — anything inside its min..max band, preferring groups of men
function mortarTarget(a){ const M=SQUAD.mortar; let best=null, bs=-1;
  const score=(x,z,w)=>{ const d=Math.hypot(x-a.pos.x, z-a.pos.z); if(d<M.min||d>M.max*1.2) return -1; return w - d*0.02; };
  for(const e of enemies){ if(e.def.air) continue; let w=e.def.inf?1:1.6; if(e.def.inf) for(const o of enemies) if(o!==e && o.def.inf && (o.pos.x-e.pos.x)**2+(o.pos.z-e.pos.z)**2<16) w+=0.8;   // a huddle is the best mortar target
    const s=score(e.pos.x,e.pos.z,w); if(s>bs){ bs=s; best={ kind:'shell', pos:e.pos, ref:e }; } }
  for(const t of towers){ if(t.falling) continue; const s=score(t.x,t.z,1.4); if(s>bs){ bs=s; best={ kind:'shell', pos:{x:t.x,z:t.z}, ref:t }; } }
  for(const c of CAMPS){ if(!c.alive) continue; const s=score(c.x,c.z,1.5); if(s>bs){ bs=s; best={ kind:'shell', pos:{x:c.x,z:c.z}, ref:c }; } }
  return best; }
// sapper: pick the nearest standing watchtower / camp hut, run to its foot, plant, get clear — the charge brings it down
function demolitionJob(a, now){ const SP=SQUAD.sapper;
  if(a.demo && (a.demo.state==='plant' || a.demo.state==='clear')) { a.task='demolish'; return true; }
  let best=null, bd=SP.reach;
  for(const t of towers){ if(t.falling || !t.block || t.claimed && t.claimed!==a && FT.includes(t.claimed)) continue; const d=Math.hypot(t.x-a.pos.x, t.z-a.pos.z); if(d<bd){ bd=d; best={ x:t.x, z:t.z, block:t.block, ref:t }; } }
  for(const c of CAMPS){ if(!c.alive || !c.block || c.claimed && c.claimed!==a && FT.includes(c.claimed)) continue; const d=Math.hypot(c.x-a.pos.x, c.z-a.pos.z); if(d<bd){ bd=d; best={ x:c.x, z:c.z, block:c.block, ref:c }; } }
  if(!best) return false; best.ref.claimed=a; const ux=a.pos.x-best.x, uz=a.pos.z-best.z, L=Math.hypot(ux,uz)||1, off=(best.block.r||2)+0.9;
  a.demo={ state:'go', ...best, spot:[best.x+ux/L*off, best.z+uz/L*off] }; a.task='demolish'; a.goal=a.demo.spot; a.goalKind='demolish'; tip('sapper'); return true; }
export const CHARGES=[], ALLY_SHELLS=[], TOWER_RPG=[];
// Z175 a rocket from the shoulder, up into the tower's platform / cabin (from _sV, the shooter's muzzle)
function towerRocket(t){ const m=makeMortarShell(); m.scale.setScalar(0.5); scene.add(m); const tx=t.x+(Math.random()-0.5)*1.2, tz=t.z+(Math.random()-0.5)*1.2, ty=t.deckY+1.0+Math.random()*0.5;
  const D=Math.hypot(tx-_sV.x, ty-_sV.y, tz-_sV.z); TOWER_RPG.push({ m, t, x0:_sV.x, y0:_sV.y, z0:_sV.z, tx, ty, tz, u:0, T:Math.max(0.25, D/SQUAD.at.speed) });
  spawnPart(_sV.x,_sV.y,_sV.z, 0,0.5,0, {color:0xd8d0c0, size:1.3, life:0.55, smoke:true, grav:0.3, drag:2, op:0.5}); sfx('rocketlaunch', { x:_sV.x, z:_sV.z }); }
function updateTowerRockets(dt, now){ for(let i=TOWER_RPG.length-1;i>=0;i--){ const r=TOWER_RPG[i]; r.u+=dt/r.T; const u=Math.min(1,r.u);
    const x=r.x0+(r.tx-r.x0)*u, y=r.y0+(r.ty-r.y0)*u+Math.sin(u*Math.PI)*0.6, z=r.z0+(r.tz-r.z0)*u; r.m.position.set(x,y,z); _rdir.set(r.tx-r.x0, r.ty-r.y0, r.tz-r.z0).normalize(); r.m.quaternion.setFromUnitVectors(_RUP, _rdir);
    spawnPart(x-_rdir.x*0.4, y-_rdir.y*0.4, z-_rdir.z*0.4, 0,0.2,0, {color:0xcfc6b4, size:0.5, life:0.5, smoke:true, grav:0.2, drag:1.8, op:0.45}); spawnPart(x,y,z, 0,0,0, {color:0xffb060, size:0.35, life:0.06, grav:0, drag:0});
    if(u<1) continue; TOWER_RPG.splice(i,1); scene.remove(r.m); rocketHitsTower(r.t, r.tx, r.ty, r.tz); } }
// the warhead bursts on the platform: half the guards up there — or all of them — are killed and thrown off; the structure takes the blast too
function rocketHitsTower(t, x, y, z){ bigExplode(new THREE.Vector3(x,y,z), 0xffae5c, 1.1); burst({x,z}, 0xffd27a, 10, 7, {y, life:0.35, size:0.35, grav:-14, drag:1.5, up:3}); sfx('explode', {x,z}); S.shake=Math.min(2.5, S.shake+0.3);
  if(t.falling) return; const live=t.guards.filter(g=>g.alive); if(live.length){ const all=Math.random()<0.45, n=all?live.length:Math.ceil(live.length/2); live.sort(()=>Math.random()-0.5);
    for(let k=0;k<n;k++){ const gd=live[k], ux=(gd.wx??t.x)-x, uz=(gd.wz??t.z)-z, L=Math.hypot(ux,uz)||1; dropGuard(t, gd, ux/L, uz/L, false); }
    floatText(n>=live.length ? 'TRÚNG THÁP — DIỆT SẠCH LÍNH GÁC' : 'TRÚNG THÁP — HẠ '+n+'/'+live.length+' LÍNH GÁC', '#9be04a', new THREE.Vector3(t.x, y+1.5, t.z), 15); }
  if(t.block && blocks.includes(t.block)) damageBlock(t.block, SQUAD.at.dmg*1.6); }
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
function updateShells(dt, now){ updateTowerRockets(dt, now); const M=SQUAD.mortar; for(let i=ALLY_SHELLS.length-1;i>=0;i--){ const s=ALLY_SHELLS[i]; s.t+=dt; const u=Math.min(1, s.t/s.T), ty=heightAt(s.tx,s.tz);
    const x=s.x0+(s.tx-s.x0)*u, z=s.z0+(s.tz-s.z0)*u, y=s.y0+(ty-s.y0)*u + Math.sin(u*Math.PI)*11; s.m.position.set(x,y,z);
    _rdir.set(s.tx-s.x0, (ty-s.y0)+Math.cos(u*Math.PI)*Math.PI*11, s.tz-s.z0).normalize(); s.m.quaternion.setFromUnitVectors(_RUP, _rdir);   // Z112 nose follows the flight path (it used to tumble on a fixed world axis → looked like it flew sideways / upright)
    if(Math.random()<0.5) spawnPart(x-_rdir.x*0.5, y-_rdir.y*0.5, z-_rdir.z*0.5, 0, 0.3, 0, {color:0xcfc6b4, size:0.45, life:0.45, smoke:true, grav:0.2, drag:1.8, op:0.4});
    if(u<1) continue; ALLY_SHELLS.splice(i,1); scene.remove(s.m);
    bigExplode({x:s.tx,z:s.tz}, 0xffae5c, M.aoe/3); deformCrater(s.tx, s.tz, 0.9, 0.3); aoeDamage(s.tx, s.tz, M.aoe, s.dmg, false, now, 'HE', false); } }
export function clearAllyOrdnance(){ for(const r of TOWER_RPG) scene.remove(r.m); TOWER_RPG.length=0; for(const c of CHARGES) scene.remove(c.m); CHARGES.length=0; for(const s of ALLY_SHELLS) scene.remove(s.m); ALLY_SHELLS.length=0; }
function allyFire(a, now){ const F=TROOPS.fireteam, T=a.target; if(!T) return false; if(ambushHold(a)) return false;   // AMBUSH 1 the blade out, nobody alerted: his men hold their fire (game/ambush.js)
  if(T.kind==='inf' && (T.ref.dead || !enemies.includes(T.ref))){ a.target=null; return false; }
  if(T.kind==='guard' && !T.ref.gd.alive){ a.target=null; return false; }
  if(T.kind==='pylon' && !blocks.includes(T.ref)){ a.target=null; return false; }
  if(T.kind==='shell' && T.ref && ((T.ref.def && !enemies.includes(T.ref)) || T.ref.falling || T.ref.alive===false || (T.ref.kind==='pylon' && !blocks.includes(T.ref)))){ a.target=null; return false; }
  const dx=T.pos.x-a.pos.x, dz=T.pos.z-a.pos.z, d=Math.hypot(dx,dz), mg=a.role==='mg';
  if(T.kind==='shell'){ const ang=Math.atan2(dx,dz); a.facing+=wrapAngle(ang-a.facing)*0.25; if(now<a.fireAt || d<SQUAD.mortar.min || d>SQUAD.mortar.max*1.2) return false; a.fireAt=now+SQUAD.mortar.cd*(0.85+Math.random()*0.3); fireShell(a, T, now); return true; }   // Z105 mortar lob
  if(T.kind==='towerAT'){ const t=T.ref; if(t.falling || !t.guards.some(g=>g.alive)){ a.target=null; return false; } if(d>SQUAD.at.range+6) return false;
    const ang=Math.atan2(dx,dz); a.facing+=wrapAngle(ang-a.facing)*Math.min(1,0.2); if(now<a.fireAt || Math.abs(wrapAngle(ang-a.facing))>0.35 || soldierReloading(a.g)) return false;
    a.fireAt=now+SQUAD.at.cd*(0.85+Math.random()*0.3); a.g.userData.muzzle.getWorldPosition(_sV); towerRocket(t); return true; }
  if(T.kind==='air'){ const e=T.ref; if(!enemies.includes(e) || HELI_DOWN.some(h=>h.e===e)){ a.target=null; return false; } const rng=a.at?SQUAD.at.range+SQUAD.ai.airRng+4:(mg?SQUAD.mg.range:F.range)+SQUAD.ai.airRng; if(d>rng) return false;   // Z200 shooting at a helicopter
    const ang=Math.atan2(dx,dz); a.facing+=wrapAngle(ang-a.facing)*Math.min(1,0.3); { const u=a.g.userData; u.aimEl=Math.max(0, Math.min(1.25, Math.atan2(e.pos.y-heightAt(a.pos.x,a.pos.z)-1.4, Math.max(1,d)))); u.aimElAt=now; } if(now<a.fireAt || Math.abs(wrapAngle(ang-a.facing))>0.35 || soldierReloading(a.g)) return false;   // Z222 he looks up and lays the rifle on it, tracking it across the sky
    a.g.userData.muzzle.getWorldPosition(_sV); const dy=e.pos.y-_sV.y, D=Math.hypot(d,dy)||1;
    if(a.at){ a.fireAt=now+SQUAD.at.cd*(0.9+Math.random()*0.3); spawnBullet(_sV.x,_sV.z,ang,{ owner:'p', dmg:SQUAD.at.dmg*1.5*(1+(S.stage-1)*0.12), speed:44, color:0xffb060, r:0.34, life:3.2, maxDist:rng+12, y:_sV.y, type:'HE', homing:7, rocket:true, lockOn:true, aoe:2.2, aoeDmg:SQUAD.at.dmg*0.5, fx:'blast' }); bullets[bullets.length-1].tgt=e;   // a guided rocket, locked on it
      spawnPart(_sV.x-Math.sin(ang)*1.1,_sV.y,_sV.z-Math.cos(ang)*1.1, -Math.sin(ang)*6,0.5,-Math.cos(ang)*6, {color:0xd8d0c0, size:1.3, life:0.55, smoke:true, grav:0.3, drag:2, op:0.5}); sfx('rocketlaunch', a.pos); return true; }
    if(mg){ a.burst=(a.burst||SQUAD.mg.burst)-1; if(a.burst>0) a.fireAt=now+SQUAD.mg.gap; else { a.burst=SQUAD.mg.burst; a.fireAt=now+SQUAD.mg.pause; } } else a.fireAt=now+F.fireCd*(0.8+Math.random()*0.4);
    const sp=95, j=()=>(Math.random()-0.5)*0.06; if(tracerNext(a.g, mg?'mg':'rifle')) freeStreak(_sV.x,_sV.y,_sV.z, (dx/D+j())*sp, (dy/D+j())*sp, (dz/D+j())*sp, SHOTFX.tracer.ours, SHOTFX.tracer.hot, D/sp, SHOTFX.tracer.width*SHOTFX.tracer.glow, 0);   // GUNFX 1 a tracer streak now and then (was a glowing dot every round)   // Z222 a brighter tracer you can follow up   // the tracer climbs to it
    if(Math.random()<(mg?SQUAD.ai.airHitMg:SQUAD.ai.airHit)){ damageEnemy(e, (mg?SQUAD.mg.dmg:F.dmg)*(1+(S.stage-1)*0.12)*(a.armed?SQUAD.armedMul:1)*(a.dmgK||1)*SQUAD.ai.airDmgK); spawnPart(e.pos.x,e.pos.y,e.pos.z,(Math.random()-0.5)*6,2,(Math.random()-0.5)*6,{ color:0xffe6a0, size:0.18, life:0.25, grav:-12, drag:1.5 }); }
    muzzleFX(_sV.x,_sV.y,_sV.z, ang, mg?'mg':'rifle', 'a', 0, a.g.userData.muzzle); gunSound('rifleShot', a.pos, 'ally'); return true; }
  if(d > (T.kind==='guard'?F.range+6:(mg?SQUAD.mg.range:F.range))) return false;
  if(T.kind==='inf' && losBlocked(a.pos.x, a.pos.z, T.pos.x, T.pos.z)){ wantPeek(a, T.pos.x, T.pos.z, now); if(a.peek) a.thinkAt=0; return false; }   // Z220 a wall in the line: no wasted rounds, find a clear line
  if(T.kind==='inf' && a.role==='rifle' && !a.at && now>(a.nadeAt||0) && allyNade(a, now)) return true;   // Z220 frag grenade into men in cover / bunched up
  const ang=Math.atan2(dx,dz); a.facing+=wrapAngle(ang-a.facing)*Math.min(1,0.2); if(now<a.fireAt || Math.abs(wrapAngle(ang-a.facing))>0.35 || soldierReloading(a.g)) return false;
  a.g.userData.muzzle.getWorldPosition(_sV);
  if(mg){ a.burst=(a.burst||SQUAD.mg.burst)-1; if(a.burst>0) a.fireAt=now+SQUAD.mg.gap; else { a.burst=SQUAD.mg.burst; a.fireAt=now+SQUAD.mg.pause; } }   // Z105 HMG: long bursts
  else a.fireAt=now+F.fireCd*(0.8+Math.random()*0.4);
  if(T.kind==='guard'){ const G=T.ref; if(tracerNext(a.g, mg?'mg':'rifle')) freeStreak(_sV.x,_sV.y,_sV.z, dx/d*70, (G.gd.wy-_sV.y)/d*70, dz/d*70, SHOTFX.tracer.ours, SHOTFX.tracer.hot, d/70, SHOTFX.tracer.width*SHOTFX.tracer.glow, 0);   // tracer up at the platform (GUNFX 1 a streak, 1 in N)
    if(Math.random()<SQUAD.guardHit) shootGuard(G.t, G.gd, a.pos.x, a.pos.z); }
  else { const tr=tracerNext(a.g, mg?'mg':'rifle'); spawnBullet(_sV.x,_sV.z,ang+(Math.random()-0.5)*(mg?SQUAD.mg.spread:0.06)*smokeSpreadK(a.pos.x, a.pos.z, T.pos.x, T.pos.z),{owner:'p', inf:true, dmg:(mg?SQUAD.mg.dmg:F.dmg)*(1+(S.stage-1)*0.12)*(a.armed?SQUAD.armedMul:1)*(a.dmgK||1), speed:mg?90:80, color:tr?REAL.tracer.ally:0xe8ef86, r:tr?0.3:(mg?0.2:0.24), trailK:tr?2.4:1, tr:tr?1:0, life:1.4, maxDist:(mg?SQUAD.mg.range:F.range)+2, noArc:true, y:_sV.y}); rifleFX(_sV.x, _sV.y, _sV.z, ang, mg); }   // Z223 red-orange tracer every Nth round · brass + muzzle smoke
  muzzleFX(_sV.x,_sV.y,_sV.z, ang, mg?'mg':'rifle', 'a', 0, a.g.userData.muzzle); gunSound('rifleShot', a.pos, 'ally'); return true; }   // GUNFX 1 the flash of his gun's class (Z419 shaped along the bore)
function allyPose(a, moved, dt, fired){ a.g.position.set(a.pos.x, heightAt(a.pos.x,a.pos.z)+(a.jy0||0), a.pos.z); a.g.rotation.y=a.facing; animateSoldier(a.g, moved/1.15, dt, fired);
  a.bar.position.set(a.pos.x, TROOPS.look.barY*stanceBarK(a.g)+heightAt(a.pos.x,a.pos.z), a.pos.z); a.bar.quaternion.copy(camera.quaternion); }
// loot on a soldier's back (a tiny copy of the item) — handed in at the rally point, or dropped where he falls
function takeCarry(a, u){ const it=takePickup(u); if(!it) return; a.carry=it; const m=lootModel(it.def); m.scale.setScalar(0.32); m.position.set(0,1.32,-0.34); a.g.add(m); a.carryMesh=m;
  floatText('NHẶT ĐỒ → KHU TẬP KẾT', '#9be04a', {x:a.pos.x, y:heightAt(a.pos.x,a.pos.z)+3, z:a.pos.z}, 13); }
export function dropCarry(a){ if(!a.carry) return; if(a.carryMesh) a.g.remove(a.carryMesh); a.carryMesh=null; const it=a.carry; a.carry=null;
  dropPowerup({x:a.pos.x, z:a.pos.z}, it.tier, it.def); }
export function updateFireteam(dt, now){
  updateCharges(dt, now); updateShells(dt, now); if(!FT.length) return;
  const F=TROOPS.fireteam, p=S.player, rr=recallRange();
  updateLadders(); squadPosture(now);   // Z200
  for(const a of FT.slice()){
    if(a.climb){ updateClimb(a, dt); if(a.climb) continue; }                                       // Z145 on a scaling ladder
    if(now>=(a.thinkAt||0)) allyThink(a, now);
    if(a.demo) updateDemolition(a, dt, now);
    const ox=a.pos.x, oz=a.pos.z; let mx=0, mz=0, md=0;
    if(a.goal){ mx=a.goal[0]-a.pos.x; mz=a.goal[1]-a.pos.z; md=Math.hypot(mx,mz); if(md<0.6 && (a.task==='cover'||a.task==='post')){ mx=mz=0; } else if(md>4){ const rw=riverWay(a, a.goal[0], a.goal[1], now); if(rw){ mx=rw.x*md; mz=rw.z*md; } } }   // Z417 a goal across the deep river: round by a bridge or a ford
    let fleeing=false; if(nadeFlee(a.pos, _fl)){ mx=_fl.x*20; mz=_fl.z*20; md=20; fleeing=true; nadeBark(a.pos, now); }   // Z220 a grenade lands among them: scatter
    for(const o of FT){ if(o===a) continue; const sx=a.pos.x-o.pos.x, sz=a.pos.z-o.pos.z, sq=sx*sx+sz*sz; if(sq < F.spread*F.spread && sq>1e-4){ const k=(F.spread-Math.sqrt(sq))*2; mx+=sx*k; mz+=sz*k; } }   // personal space
    if(dazed(a, now)){ mx=mz=0; }   // Z223 dazed: stays down
    const ml=Math.hypot(mx,mz); if(ml>0.3){ const run = fleeing||a.task==='cover'||a.task==='evade'||a.task==='rally'||a.task==='fallback'||md>12, sp=(run?F.sprint:F.speed)*(a.carry?0.85:1)*swimFoeK(a, mx, mz); a.pos.x+=mx/ml*Math.min(ml,sp*dt); a.pos.z+=mz/ml*Math.min(ml,sp*dt); }
    if(a.kbx||a.kbz){ a.pos.x+=a.kbx*dt; a.pos.z+=a.kbz*dt; const kf=Math.max(0,1-dt*5); a.kbx*=kf; a.kbz*=kf; if(Math.abs(a.kbx)+Math.abs(a.kbz)<0.1){ a.kbx=a.kbz=0; } }
    const px=a.pos.x-p.pos.x, pz=a.pos.z-p.pos.z, pd=Math.hypot(px,pz); if(pd<p.radius+1.4 && pd>1e-3){ a.pos.x=p.pos.x+px/pd*(p.radius+1.4); a.pos.z=p.pos.z+pz/pd*(p.radius+1.4); }   // step clear of our own tracks
    infPushBlocks(a.pos); clampField(a.pos, 2);
    if(a.healing && a.task==='fallback' && a.goal && Math.hypot(a.goal[0]-a.pos.x, a.goal[1]-a.pos.z)<2.5){ a.hp=Math.min(a.maxHp, a.hp+SQUAD.ai.heal*dt); if(Math.random()<dt*0.8) spawnPart(a.pos.x, heightAt(a.pos.x,a.pos.z)+1.6, a.pos.z, 0, 1.2, 0, { color:0x9be04a, size:0.35, life:0.6, grav:0.5, drag:2 }); }   // Z200 patching up behind the tank
    if(a.ladPc) tryClimb(a);                                                                         // Z145 reached the wall foot → up the ladder
    // errands: pick up the item he walked to, hand loot in at the rally point
    if(a.task==='fetch' && a.loot){ if(!pickups.includes(a.loot)){ a.loot=null; a.thinkAt=0; } else if(Math.hypot(a.loot.x-a.pos.x, a.loot.z-a.pos.z)<1.4){ takeCarry(a, a.loot); a.loot=null; a.thinkAt=0; } }
    if(a.carry && inRally(a.pos.x, a.pos.z, -1)){ const it=a.carry; if(a.carryMesh) a.g.remove(a.carryMesh); a.carryMesh=null; a.carry=null; stashLoot(it); a.thinkAt=0; a.goal=null; }
    const dz_=dazed(a, now), fired=dz_ ? false : allyFire(a, now);   // Z223 dazed by a blast: no shooting
    if(!fired && !a.target){ const mv=Math.hypot(a.pos.x-ox,a.pos.z-oz); if(mv>0.01) a.facing+=wrapAngle(Math.atan2(a.pos.x-ox,a.pos.z-oz)-a.facing)*Math.min(1,dt*8); else if(a.goalKind==='form' && a.ringOut!=null) a.facing+=wrapAngle(a.ringOut-a.facing)*Math.min(1,dt*3); }   // Z220 on the ring: watch outward
    let jy=0; if(a.jumpT>0){ a.jumpT-=dt; const u=Math.max(0,a.jumpT)/0.4; jy=Math.max(0,(a.jy-heightAt(a.pos.x,a.pos.z)))*u*u + Math.sin((1-u)*Math.PI)*0.5; }   // hop off the hull
    a.jy0=jy; const mvd=Math.hypot(a.pos.x-ox,a.pos.z-oz); allyPose(a, mvd, dt, fired);
    let st = mvd>=0.03 && (a.target || (a.supp||0)>0.25 || a.task==='cover' || a.task==='evade' || a.task==='order' || a.task==='fight') ? 'low' : 'stand';   // Z223 under the enemy's guns he runs bent low
    if(mvd<0.03 && a._dash){ a._dash=false; combatDive(a.g, a.pos.x, a.pos.z); } else if(mvd>=0.03 && a.bndAt && a.bndAt===FTSQ.swapAt) a._dash=true;   // end of a bound: drops at once
    // Z105 stance: run upright · kneel at cover / to plant / mortar · prone with the MG or at range in the open
    if(mvd < 0.03 && !(a.jumpT>0)){ const T=a.target, dT=T ? Math.hypot(T.pos.x-a.pos.x, T.pos.z-a.pos.z) : 0;
      if(a.task==='cover' && atCover(a.pos, a.cover)) st='crouch';
      else if(a.demo) st='crouch';
      else if(T && T.kind==='shell') st='crouch';
      else if(T && T.kind==='air') st='stand';                                                     // Z222 on his feet to fire up at a helicopter
      else if(T && (a.role==='mg' || (dT>SQUAD.proneR && T.kind==='inf' && !a.at))) st='prone';
      else if(T || a.task==='post') st='crouch'; }
    if(dz_) dazePose(a.g, now, dt); else poseSoldier(a.g, st, dt);
    if(a.dead) continue;
    a.bar.visible = a.hp < a.maxHp-0.5; const f=Math.max(0,a.hp/a.maxHp); a.barFill.scale.x=Math.max(0.001,f); a.barFill.position.x=-(1-f)*0.5; a.barFill.material.color.setHex(f>0.5?0x7fe06a:(f>0.25?0xffcf5a:0xff5a4a));
    if(a.hitT>0){ a.hitT-=dt; if(a.hitT<=0){ const t2=a.g.userData.torso; if(t2){ t2.material.emissive.setHex(0x000000); t2.material.emissiveIntensity=0; } } }
  }
}
// Z104 a weapon depot re-arms a soldier: AT launcher on his shoulder + better rifle rounds
export function armAlly(a){ if(a.at) return; a.at=true; a.armed=true; const u=a.g.userData, tm=new THREE.MeshStandardMaterial({color:0x4a5a30,roughness:0.75,metalness:0.25});
  const dm=new THREE.MeshStandardMaterial({color:0x22231e,roughness:0.6,metalness:0.45}), L=new THREE.Group(); kitAttach(u, u.up, L, 'shoulderL');   // Z113 recoilless AT launcher on the shoulder
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.95,10), tm); tube.rotation.x=Math.PI/2; L.add(tube);
  for(const z of [-0.5,0.5]){ const fl=new THREE.Mesh(new THREE.CylinderGeometry(z<0?0.085:0.07,0.06,0.12,10), dm); fl.rotation.x=z<0?-Math.PI/2:Math.PI/2; fl.position.z=z; L.add(fl); }   // venturi + muzzle flare
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.07,0.16), dm); sight.position.set(-0.07,0.07,0.12); L.add(sight);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.12,0.05), dm); grip.position.set(0,-0.09,0.1); L.add(grip); }
