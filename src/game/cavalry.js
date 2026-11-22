// game/cavalry.js — Z245 CAVALRY MODE: the player is a general in full plate — on his armoured war horse (walk · trot · canter · gallop surge, firing from the saddle, trampling infantry) or on foot (run, sprint, crouch, prone, crawl, auto-cover) — mount / dismount (G), whistle the horse back, hoof beats and dust, all on the tank player's interface so enemies, guns, camera and HUD work unchanged
import * as THREE from 'three';
import { CAV, HORSE, HUMAN_SCALE, RIDE, XEOM, XHAIR } from '../../config.js';
import { ARENA, BIOME, MOBILE, S, actx, aimTarget, animateHorse, animateSoldier, autoFire, barrelFixed, blocks, boss, buildGeneral, buildHorse, burst, clampField, cloakFoot, controlScheme, core, damageEnemy, endFall, enemies, fitRealCav, floatText, getMoveDir, heightAt, master, playerRange, poseRider, poseSoldier, scene, sfx, solidTank, spawnPart, startFall, stepFall, tankInput, trackOnTarget, trackTarget, turretTracks, updateRealCav, wadeAt, buildBikeMount, bikeWheelie, horseAir, rideBump, rideClear, rideCollide, rideLeap, rideReset, rideSpeedK, rideImpacts, callRide, rideCallStep, rideCallUi, rideCanCome, soldierFire, trooperGuns, soldierJump, footStance, footMotion, footPose, footMoveState, heldAction, solidShape, pushOutShape, mountDur, mountMove, mountOwn, aimAwake, seatTurnOff, driverBack, rideHull, ridePower, rideOver, rideRam, rideLowReset, RIDE_LOW, climbStep, climbAfter, climbOver, climbPh, climbReset, climbUi, climbing, footY } from '../hub.js';

export const CV = { on:false, mounted:true, H:null, G:null, speed:0, facing:-Math.PI, hPos:new THREE.Vector3(), yawRate:0, stance:'stand', want:'stand', surgeUntil:0, surgeCd:0, sprintUntil:0, sprintCd:0,
  trans:null, call:false, last:new THREE.Vector3(), tramAt:new WeakMap(), still:0, hoofAt:0 };
const wrapA=a=>Math.atan2(Math.sin(a), Math.cos(a));
export function cavOn(){ const p=S.player; return !!(p && p.cav); }
// ---- the player object: same fields as the tank (makePlayer) so every system that reads S.player keeps working ----
// Z293 the rider into his place on whatever he rides: the saddle (horse units) or the ride's pillion / bench / bed (XEOM seat, mount units) — mounting, remounting and respawning all go through here
function seatRider(G, H){ (H.bike && H.body || H.B).add(G); G.rotation.set(0,0,0); if(H.bike){ const X=XEOM[H.bike]; G.position.set(0, X.seat[0], X.seat[1]); G.scale.setScalar(HUMAN_SCALE/XEOM.k); } else { G.position.set(0, 0, -0.1); G.scale.setScalar(HUMAN_SCALE/HORSE.size); } }
export function makeCavPlayer(kind){   // Z282 kind: 'xeom' / 'bagac' / 'bantai' ride the bike instead of the horse
  const H=kind ? buildBikeMount(kind) : buildHorse(), G=buildGeneral(); CV.H=H; CV.G=G; CV.on=true; CV.mounted=true; CV.stance='stand'; CV.want='stand'; CV.trans=null; CV.call=false; CV.speed=0;
  if(kind) H.root.scale.setScalar(XEOM.k); seatRider(G, H);
  if(H.drv){ H.drv.onCrash=()=>{ if(CV.mounted && !CV.trans){ CV.trans={ k:'off', t:0, crash:true }; CV.call=false; } };   // Z296 the bike goes down: the soldier jumps clear
    H.drv.onBack=()=>{ const p=S.player, pick=H.drv.pickup; H.drv.pickup=false; if(!p || CV.mounted || CV.trans || CV.dead) return;
      if(pick){ callRide(p, true); CV.autoOn=true; floatText('BÁC TÀI CHẠY TỚI ĐÓN!', '#9be04a', p.pos, 14); return; }   // Z363 the repair done (or his break over): he rides over and the soldier climbs on
      const L=CV.landAt; CV.landAt=null; if(L && Math.hypot(p.pos.x-L.x, p.pos.z-L.z)<XEOM.call.stayR && Math.hypot(p.pos.x-CV.hPos.x, p.pos.z-CV.hPos.z)<RIDE.crash.callR){ CV.call=true; CV.autoOn=true; CV.callAt=performance.now()/1000; floatText('DỰNG XONG — LÊN XE ĐI CON!', '#9be04a', p.pos, 14); return; }   // Z306 you stayed by it: he rides up and you climb on
      floatText('BÁC TÀI ĐANG CHỜ — G: LÊN XE / GỌI XE', '#9be04a', p.pos, 14); }; }   // Z303 back up and waiting: no dragging him aboard, no chasing him — on foot he goes where he likes, G brings him back   // the rider sits on the horse's body (bobs and pitches with it) · on the bike's pillion / cyclo seat
  if(!kind) H.onStep=hoofFall;
  CV.real=null; CV.realP=null; fitRealCav(CV); rideCallUi(); climbUi(); if(kind) floatText(XEOM.lines[0], '#ffe9a8', new THREE.Vector3(0, 3, ARENA*0.55), 15);   // Z248 the real horse / operator / carbine dress the rigs once loaded
  const mesh=new THREE.Group(); mesh.add(H.root); scene.add(mesh);
  const u=G.userData, p={
    mesh, turret:new THREE.Object3D(), muzzle:u.muzzle, modelId:kind||'cav', bike:kind||null, cav:CV,
    pos:new THREE.Vector3(0, 0, ARENA*0.55), vel:new THREE.Vector3(), facing:-Math.PI, aim:-Math.PI, aimSmoothed:-Math.PI, shieldMesh:null,
    hp:100, maxHp:100, lives:5, fireAt:0, weaponLvl:0, guns:trooperGuns(), gunIdx:0, infiniteAmmo:false, ammoMul:1, magMul:1,
    buffUntil:{ rapid:0, power:0, speed:0, infammo:0, ammoup:0, range:0, turbo:0, ram:0 }, buffLv:{ turbo:0 }, era:0, rangeMul:1, radius:CAV.radius.mounted, scale:1,
    dashUntil:0, dashCdUntil:0, invincibleUntil:0, dashDir:new THREE.Vector3(), overUntil:0, spellCdUntil:0, shieldUntil:0, charge:0,
    dmgMul:1, fireMul:1, speedMul:1, dashCdMul:1, spellCdMul:1, crit:0, lifesteal:0, kbx:0, kbz:0, reloadMul:1, armor:0, bossMul:1, camK:CAV.camK.mounted, defK:CAV.defK.mounted, fwdSpeed:0, throttle:0 };
  return p; }
// Z404 the ride is dropped (another unit picked for the next battle): its driver goes with it — off it (thrown in a crash, kneeling by a fallen soldier,
//   on his break) he stood in the world on his own, and the xe ôm's driver turned up in the next battle beside the bán tải, a tank, a horse
export function dropCavPlayer(p){ if(!p || !p.cav) return; const D=CV.H && CV.H.drv; if(D){ driverBack(CV.H); if(D.w && D.w.parent) D.w.parent.remove(D.w); for(const k of ['cig','lit','ham']) if(D[k] && D[k].parent) D[k].parent.remove(D[k]); CV.H.drv=null; }
  if(CV.H && CV.H.root.parent) CV.H.root.parent.remove(CV.H.root); if(CV.G && CV.G.parent) CV.G.parent.remove(CV.G); if(p.mesh.parent) p.mesh.parent.remove(p.mesh); CV.on=false; }
// ---- hoof beats: a dull thump + a stony click, louder and closer together the faster he goes; a puff of dust off every hoof ----
function hoofFall(i, x, z, v){ const k=Math.min(1, v/12);
  if(Math.random()<0.55+k*0.4) spawnPart(x+(Math.random()-0.5)*0.3, heightAt(x,z)+0.08, z+(Math.random()-0.5)*0.3, (Math.random()-0.5)*1.2, 0.5+k*1.4, (Math.random()-0.5)*1.2, { color:0xb8a888, size:0.35+k*0.55, life:0.6+k*0.5, smoke:true, grav:-0.2, drag:2.2, grow:1.6, op:0.32+k*0.18 });
  if(!actx || !master || performance.now()-CV.hoofAt < 45) return; CV.hoofAt=performance.now(); const t=actx.currentTime, vol=0.07+k*0.1;
  try{ const o=actx.createOscillator(), g=actx.createGain(); o.type='sine'; o.frequency.setValueAtTime(150+Math.random()*30, t); o.frequency.exponentialRampToValueAtTime(55, t+0.09);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t+0.12); o.connect(g).connect(master); o.start(t); o.stop(t+0.13);
    const n=actx.createBufferSource(), b=actx.createBuffer(1, Math.floor(actx.sampleRate*0.03), actx.sampleRate), d=b.getChannelData(0); for(let q=0;q<d.length;q++) d[q]=(Math.random()*2-1)*(1-q/d.length);
    n.buffer=b; const f=actx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2200+Math.random()*900; f.Q.value=1.4; const g2=actx.createGain(); g2.gain.value=vol*0.55; n.connect(f).connect(g2).connect(master); n.start(t); }catch(e){} }
// ---- G: get off / get on (or whistle him over if he is far) ----
export function cavToggleMount(){ const p=S.player; if(!p || !p.cav || S.mode!=='playing' || CV.trans) return;
  if(CV.mounted){ if(CV.speed>CAV.horse.cruise*0.6 || (CV.H && CV.H.air && CV.H.air.y>0)){ floatText(CV.H && CV.H.bike ? 'CHẠY CHẬM LẠI ĐÃ' : 'GHÌM CƯƠNG ĐÃ', '#ffcf5a', p.pos, 14); return; }
    CV.trans={ k:'off', t:0 }; sfx('click'); return; }
  if(CV.climb){ floatText('XUỐNG ĐẤT RỒI MỚI LÊN XE / NGỰA', '#ffcf5a', p.pos, 14); return; }   // Z451 on a wall or a rock
  const d=Math.hypot(CV.hPos.x-p.pos.x, CV.hPos.z-p.pos.z), ready=rideCanCome();
  if(d<=CAV.mountR && ready){ CV.trans={ k:'on', t:0 }; sfx('click'); return; }
  if(d<=CAV.mountR){ floatText(CV.H.broken ? 'XE HƯ — BÁC TÀI ĐANG SỬA!' : CV.H.onBreak ? 'BÁC TÀI ĐANG NGHỈ — CHỜ CHÚT!' : 'CHỜ BÁC TÀI DỰNG XE!', '#ffcf5a', p.pos, 14); return; }   // Z296 the driver is still picking the bike up
  if(CV.call) return; whistle(); callRide(p); }   // Z306 away from it: call it — he comes now, or as soon as it is fit to (game/ride-call.js)
function whistle(){ if(!actx || !master) return; const t=actx.currentTime; try{ const o=actx.createOscillator(), g=actx.createGain(); o.type='sine';
  o.frequency.setValueAtTime(1500, t); o.frequency.linearRampToValueAtTime(2300, t+0.18); o.frequency.linearRampToValueAtTime(1700, t+0.32); o.frequency.linearRampToValueAtTime(2500, t+0.5);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t+0.04); g.gain.setValueAtTime(0.09, t+0.45); g.gain.exponentialRampToValueAtTime(0.0001, t+0.6); o.connect(g).connect(master); o.start(t); o.stop(t+0.62); }catch(e){} }
// ---- Space: a gallop surge in the saddle · a sprint on foot ----
export function cavDash(){ const p=S.player, now=performance.now()/1000; if(!p || !p.cav) return;
  if(CV.mounted){ if(now<CV.surgeCd) return; CV.surgeUntil=now+CAV.surge.dur; CV.surgeCd=now+CAV.surge.cd;
    if(CV.H && CV.H.bike){ if(!bikeWheelie(CV.H)){ sfx('whoosh'); floatText('VÍT GA!', '#ffcf5a', p.pos, 15); } }   // Z296 on the xe ôm a wheelie, on the rest the throttle wide open
    else { sfx('whoosh'); floatText('PHI NƯỚC ĐẠI!', '#ffcf5a', p.pos, 15); } }
  else soldierJump(); }   // Z336 on foot Space jumps (Shift held sprints)
// ---- C: kneel / stand · Z: go prone / get up (on foot only) ----
export function cavStance(kind){ if(!cavOn() || CV.mounted || CV.trans) return; CV.want = CV.want===kind ? 'stand' : kind; }
// ---- every frame in play (replaces updatePlayer) ----
export function updateCavalry(dt, now){
  const p=S.player; if(!p || !p.cav) return; const H=CV.H, G=CV.G, u=G.userData, bu=p.buffUntil;
  p.infiniteAmmo=now<bu.infammo; p.ammoMul=now<bu.ammoup?1.6:1; p.scale=1; if(p.mesh.scale.x!==1) p.mesh.scale.setScalar(1);   // (tank code sizes the hull; a horse is a horse)
  // AIM (same rules as the tank: mouse on desktop, the target-tracker on phones, the pad's right stick sets p.aim itself)
  if(barrelFixed()){ p.aim=CV.mounted?CV.facing:p.facing; }
  else if(turretTracks()){ const t=trackTarget(playerRange()); p.aim = t ? Math.atan2(t.pos.x-p.pos.x, t.pos.z-p.pos.z) : (CV.mounted?CV.facing:p.facing); }
  else if(S.pointerActive) p.aim=Math.atan2(S.aimPoint.x-p.pos.x, S.aimPoint.z-p.pos.z);
  p.aimSmoothed=wrapA(p.aimSmoothed + wrapA(p.aim-p.aimSmoothed)*Math.min(1, dt*14));
  const tankCtl=controlScheme()==='tank', TI=tankCtl?tankInput():null, dir=tankCtl?null:getMoveDir(), inp=tankCtl?Math.max(Math.abs(TI.thr), Math.abs(TI.turn)):Math.min(1, dir.length());
  const wade=wadeAt(p.pos.x, p.pos.z);   // Z405 (fords, the ice)
  if(CV.trans){ transition(p, dt, now); }
  else if(CV.mounted){
    // the horse: steer toward where you push (or the reins: W/S speed, A/D turn), speed builds and settles, he turns tighter when slow
    const Hc=CAV.horse, surge=now<CV.surgeUntil, top=(surge?Hc.gallop:Hc.cruise)*p.speedMul*wade*rideSpeedK(CV.H);   // (Z303 a worn ride has lost its top end)
    let want=0, turn=0;
    if(tankCtl){ want = TI.thr>0 ? top*TI.thr : TI.thr<0 ? -Hc.back : 0; turn=TI.turn; }
    else if(inp>0.1){ const tgt=Math.atan2(dir.x, dir.z), df=wrapA(tgt-CV.facing); want=top*inp*Math.max(0.25, Math.cos(Math.min(Math.PI/2, Math.abs(df))*0.8)); turn=Math.max(-1, Math.min(1, df*2)); }
    const tr=Hc.turnLow+(Hc.turnHigh-Hc.turnLow)*Math.min(1, Math.abs(CV.speed)/Hc.gallop), dY=turn*tr*dt; CV.facing=wrapA(CV.facing+dY); CV.yawRate=CV.yawRate+(dY/Math.max(dt,1e-3)-CV.yawRate)*Math.min(1, dt*8);
    const acc = want>CV.speed ? (surge?Hc.surgeAccel:Hc.accel) : Hc.decel; CV.speed += Math.max(-acc*dt, Math.min(acc*dt, want-CV.speed));
    p.facing=CV.facing; p.vel.set(Math.sin(CV.facing)*CV.speed, 0, Math.cos(CV.facing)*CV.speed); p.throttle=0;
    p.radius=CAV.radius.mounted; p.defK=CAV.defK.mounted; p.camK=CAV.camK.mounted;
  } else if(climbStep(p, dt, now)){ CV.moveT=0; p.radius=CAV.radius.foot; p.defK=CAV.defK.stand; p.camK=CAV.camK.foot; horseAlone(p, dt); }   // Z451 on the face of a rock / a wall: the climb moves him (game/soldier-climb.js)
  else {
    // on foot: run where you push; crouch / prone slow you right down; the body turns to the aim when firing or standing
    if(MOBILE){ const mv0=Math.hypot(p.vel.x, p.vel.z); CV.still = mv0<0.25 ? CV.still+dt : 0; if(CV.want!=='prone') CV.want = CV.still>1.2 ? 'crouch' : 'stand'; }   // phones: he kneels by himself when he stops
    if(CV.want!==CV.stance) CV.stance=CV.want; footStance(p, dt, now);   // Z336 behind cover he goes down on a knee
    CV.moveT = inp>0.1 && CV.stance==='stand' ? (CV.moveT||0)+dt : 0;   // Z368 how long he has been pushing on: a walk as he sets off, the key held and he runs
    const F=CAV.foot, sprint=(now<CV.sprintUntil || heldAction('sprint') && !S.firing) && CV.stance==='stand', offA=Math.abs(wrapA(p.aimSmoothed-Math.atan2(p.vel.x, p.vel.z))), awake=CV.aimUp=!sprint && (aimAwake(now) || offA>XHAIR.turn.twist), back=awake && !S.firing && Math.hypot(p.vel.x, p.vel.z)>0.4 && offA>XHAIR.turn.twist+XHAIR.turn.walk, sp=(CV.stance==='prone'?F.crawl:CV.stance==='crouch'?F.crouch:(sprint?F.sprint:S.firing?F.fire:CV.moveT<F.walkT?F.walk:back?Math.min(F.run, XHAIR.turn.backV):F.run))*p.speedMul*wade;   // Z376 the rifle stays up on the crosshair while it is in use, or off to his side / behind (only Shift's sprint carries it); far round behind him he backs off at a walk, on his own legs   // Z304 a man's pace: a run with the rifle, a sprint, a walk while he fires
    let mx=0, mz=0; if(tankCtl){ const f=p.facing+TI.turn*2.8*dt; p.facing=wrapA(f); mx=Math.sin(p.facing)*TI.thr; mz=Math.cos(p.facing)*TI.thr; } else if(inp>0.1){ mx=dir.x; mz=dir.z; }
    const tvx=mx*sp, tvz=mz*sp, dvx=tvx-p.vel.x, dvz=tvz-p.vel.z, dv=Math.hypot(dvx,dvz), acc=(Math.hypot(tvx,tvz)>Math.hypot(p.vel.x,p.vel.z)?F.accel:F.decel)*dt, ak=dv>acc?acc/dv:1; p.vel.x+=dvx*ak; p.vel.z+=dvz*ak;   // Z304 he takes a few strides to get going, and pulls up quicker
    const mv=Math.hypot(p.vel.x, p.vel.z), runA=Math.atan2(p.vel.x, p.vel.z), dA=wrapA(p.aimSmoothed-runA), face = (S.firing||mv<0.4||CV.stance==='prone'&&mv<0.2) ? p.aimSmoothed : awake && Math.abs(dA)>XHAIR.turn.twist ? runA+Math.sign(dA)*(Math.abs(dA)-XHAIR.turn.twist) : runA;   // Z376 running with the crosshair in use: the chest turns to it, and past what it can take the hips turn too (the legs step it sideways / back)
    p.facing=wrapA(p.facing+wrapA(face-p.facing)*Math.min(1, dt*(CV.stance==='prone'?3:9)));
    p.radius=CV.stance==='prone'?CAV.radius.prone:CAV.radius.foot; p.defK=CAV.defK[CV.stance]||CAV.defK.stand; p.camK=CV.stance==='prone'?CAV.camK.prone:CAV.camK.foot;
    footMotion(p, dt);   // Z336 a roll carries him, a jump keeps his way
    // the riderless horse: grazes where you left him, or trots / gallops to your whistle
    horseAlone(p, dt);
  }
  rideLowReset(); if(!CV.trans){ CV.last.copy(p.pos); p.pos.addScaledVector(p.vel, dt); hullEach(p, q=>collide(q, now)); hullEach(p, rideImpacts); clampField(p.pos, 3); if(!CV.mounted) climbAfter(p, dt, now);   // Z404 a long ride meets the world with its whole outline
    if(RIDE_LOW.length && CV.mounted){ const PW=ridePower(H); if(PW) CV.speed*=Math.exp(-dt*PW.climbDrag); }   // (Z404 climbing over something low)
    if(CV.mounted){ const moved=(p.pos.x-CV.last.x)*Math.sin(CV.facing)+(p.pos.z-CV.last.z)*Math.cos(CV.facing); CV.speed = dt>0 ? Math.sign(CV.speed)*Math.min(Math.abs(CV.speed), Math.abs(moved/dt)+0.5) : CV.speed; CV.hPos.copy(p.pos); } }
  p.fwdSpeed=CV.mounted?CV.speed:Math.hypot(p.vel.x, p.vel.z);
  // place + animate
  p.mesh.position.set(p.pos.x, CV.mounted ? heightAt(p.pos.x, p.pos.z) : footY(p), p.pos.z);   // (Z451 on top of what he climbed: his soles on it)
  const firing=!!(S.firing || (MOBILE && autoFire && p.fireAt>now-0.15));
  if(CV.mounted && !CV.trans){ p.mesh.rotation.y=CV.facing; H.root.position.set(0,0,0); H.root.rotation.y=0; if(!H.bike){ H.root.position.copy(p.mesh.position); H.root.rotation.y=CV.facing; } animateHorse(H, dt, CV.speed, CV.yawRate); H.root.position.set(0,0,0); H.root.rotation.y=0; if(!H.bike) H.root.position.y=horseAir(H, dt)/(p.mesh.scale.y||1);   // (Z300 a ride works in its true place: its feet and wheels read the real ground · Z321 a horse in mid-leap rides above it)
    poseRider(G, H, dt, wrapA(p.aimSmoothed-CV.facing), firing); }
  else if(!CV.trans){ p.mesh.rotation.y=p.facing; const d=Math.hypot(p.pos.x-CV.last.x, p.pos.z-CV.last.z); animateSoldier(G, d, dt, firing); poseSoldier(G, CV.stance, dt); footPose(G, p);
    u.up.rotation.y += (Math.max(-0.9, Math.min(0.9, wrapA(p.aimSmoothed-p.facing))) - u.up.rotation.y)*Math.min(1, dt*10); cloakFoot(G, Math.hypot(p.vel.x,p.vel.z), CV.stance==='prone'); }
  if(p.hitT>0){ p.hitT-=dt; }
  if(now < p.respawnBlinkUntil) p.mesh.visible=Math.floor((p.respawnBlinkUntil-now)/0.25)%2===0; else if(!p.mesh.visible) p.mesh.visible=true;
  p.kbx=p.kbz=0;
  updateRealCav(CV, dt, { twist: wrapA(p.aimSmoothed-(CV.mounted?CV.facing:p.facing)), footV: Math.hypot(p.vel.x, p.vel.z), stance: CV.stance, trans: CV.trans ? { k:CV.trans.k, e:Math.min(1, CV.trans.t/CAV.mountT) } : false, hit: p.hitT>0, ride: CV.mounted && CV.H.inert ? CV.H.inert : null, move: CV.mounted ? null : footMoveState(), climb: CV.mounted ? null : climbPh() });   // Z299 what the sprung body feels, for him to sway with   // Z295 which way and how far through getting on / off
  // fire: hold LMB (desktop) · the trigger / auto-fire on phones, exactly like the tank
  const range=playerRange();
  if(!CV.trans && !climbing()){ if(MOBILE){ const t=autoFire?aimTarget(range):null; if(autoFire ? (!!t && (!turretTracks() || trackOnTarget(t))) : S.firing) soldierFire(now, range); } else if(S.firing) soldierFire(now, range); }   // Z306 his own rifle (combat/soldier-fire.js), not the tank's gun
}
// ---- the horse on his own ----
function horseAlone(p, dt){ const H=CV.H; if(!H) return; let v=0, yr=0; const can=rideCanCome(); if(CV.call && can) rideCallStep(p);   // Z306 a call waits while the ride is down or broken; far off or stuck, he comes round (game/ride-call.js)   // Z296 a crashed bike answers no whistle
  if(CV.call && can){ const dx=p.pos.x-CV.hPos.x, dz=p.pos.z-CV.hPos.z, d=Math.hypot(dx,dz); if(d<CAV.call.arrive){ CV.call=false; if(CV.autoOn && !CV.trans && !CV.dead){ CV.autoOn=false; CV.trans={ k:'on', t:0 }; sfx('click'); } }
    else { const tgt=Math.atan2(dx,dz), df=wrapA(tgt-CV.facing); CV.facing=wrapA(CV.facing+Math.max(-2.4*dt, Math.min(2.4*dt, df))); yr=df*2; v=Math.min(CAV.call.speed, d*1.6); } }
  CV.speed+=(v-CV.speed)*Math.min(1, dt*2.2);
  CV.hPos.x+=Math.sin(CV.facing)*CV.speed*dt; CV.hPos.z+=Math.cos(CV.facing)*CV.speed*dt; clampField(CV.hPos, 3);
  for(const b of blocks){ const dx=CV.hPos.x-b.x, dz=CV.hPos.z-b.z, R=(b.r||1)+0.9, d2=dx*dx+dz*dz; if(d2<R*R && d2>1e-4){ const d=Math.sqrt(d2); CV.hPos.x+=dx/d*(R-d); CV.hPos.z+=dz/d*(R-d); } }
  rideClear(CV.hPos, 0.9);   // Z321 nor through a tree, a parked car, the street furniture or the wire (held there, he comes round: game/ride-call.js)
  H.wantGraze = !CV.call; H.root.position.set(CV.hPos.x, heightAt(CV.hPos.x, CV.hPos.z), CV.hPos.z); H.root.rotation.y=CV.facing; animateHorse(H, dt, CV.speed, yr); }
// ---- getting on and off: a short, eased move between the saddle and the ground beside the horse ----
function transition(p, dt, now){ const T=CV.trans, H=CV.H, G=CV.G, own=!T.crash && mountOwn(), k=Math.min(1, (T.t+=dt)/(own ? mountDur(T) : CAV.mountT)), e=k*k*(3-2*k);   // Z342 own: on / off the way a rider does (actors/soldier-mount.js)
  const side=new THREE.Vector3(-Math.cos(CV.facing), 0, Math.sin(CV.facing)).multiplyScalar(H.bike ? XEOM[H.bike].side : 1.05);   // the horse's left side (Z295 a ride's: clear of its body)
  if(T.k==='off'){ if(!T.started){ T.started=true; CV.speed=0; p.vel.set(0,0,0); CV.hPos.copy(p.pos);
      H.root.parent && H.root.parent.remove(H.root); scene.add(H.root); H.root.position.set(CV.hPos.x, heightAt(CV.hPos.x, CV.hPos.z), CV.hPos.z); H.root.rotation.y=CV.facing;
      const wp=new THREE.Vector3(); G.getWorldPosition(wp); G.parent.remove(G); p.mesh.add(G); T.from=wp; G.rotation.set(0,0,0); G.scale.setScalar(HUMAN_SCALE); seatTurnOff(G);
      if(H.bike && XEOM[H.bike].pose!=='stand') T.from.y=heightAt(wp.x, wp.z)+XEOM.pegY;   // Z295 off a seat his feet start on the pegs, not at his hips
      if(T.crash){ const d=Math.max(1.5, Math.min(4, ((H.drv && H.drv.slide) || 4)*0.4)); T.to=new THREE.Vector3(wp.x+Math.sin(CV.facing)*d, 0, wp.z+Math.cos(CV.facing)*d).add(side.clone().multiplyScalar(0.4)); } }   // Z304 thrown clear on his own line (the camera, on him, no longer slides along with the bike)
    if(T.crash) H.root.position.set(CV.hPos.x, heightAt(CV.hPos.x, CV.hPos.z), CV.hPos.z);   // Z296 the crashed bike slides on while he jumps clear
    if(own){ mountMove(p, T); animateHorse(H, dt, 0, 0); if(k>=1){ CV.trans=null; CV.mounted=false; G.position.set(0,0,0); CV.stance=CV.want='stand'; CV.landAt=null; CV.autoOn=false; } return; }   // (he ends stood beside it, facing it)
    const to=T.to || CV.hPos.clone().add(side); p.pos.set(T.from.x+(to.x-T.from.x)*e, 0, T.from.z+(to.z-T.from.z)*e);
    const gy=heightAt(p.pos.x, p.pos.z); p.mesh.position.set(p.pos.x, gy, p.pos.z); p.mesh.rotation.y=CV.facing;
    const hop = T.crash ? 0.45 : H.bike ? (XEOM[H.bike].pose==='stand' ? 0.22 : 0.06) : 0.35;   // a step down off a ride, a jump off a horse (thrown off a crash: a real leap)
    G.position.set(0, (T.from.y-gy)*(1-e)+Math.sin(Math.PI*e)*hop, 0); poseSoldier(G, 'stand', dt);
    animateHorse(H, dt, 0, 0);
    if(k>=1){ CV.trans=null; CV.mounted=false; G.position.set(0,0,0); p.facing=CV.facing; CV.stance=CV.want='stand'; CV.landAt=T.crash ? p.pos.clone() : null; CV.autoOn=false; } return; }   // Z306 where he landed: stay by it and you ride on
  // on: from beside him up into the saddle
  if(!T.started){ T.started=true; T.from=p.pos.clone(); p.vel.set(0,0,0); }
  if(own){ mountMove(p, T); animateHorse(H, dt, 0, 0); }
  else { const to=CV.hPos, s2=CV.hPos.clone().add(side); const px=T.from.x+(s2.x-T.from.x)*Math.min(1, e*2), pz=T.from.z+(s2.z-T.from.z)*Math.min(1, e*2);
  p.pos.set(px+(to.x-s2.x)*Math.max(0, e*2-1), 0, pz+(to.z-s2.z)*Math.max(0, e*2-1)); const gy=heightAt(p.pos.x, p.pos.z); p.mesh.position.set(p.pos.x, gy, p.pos.z);
  const upY = H.bike ? XEOM[H.bike].seat[0]*XEOM.k*(XEOM[H.bike].pose==='stand' ? 1 : 0.55) : (HORSE.bodyY+HORSE.saddleY)*HORSE.size-0.8;   // Z295 up onto the ride's own seat / bed, not a horse's back
  G.position.set(0, Math.max(0, e*2-1)*upY, 0); animateHorse(H, dt, 0, 0); }
  if(k>=1){ CV.trans=null; CV.mounted=true; p.pos.copy(CV.hPos); G.parent && G.parent.remove(G); seatRider(G, H);
    H.root.parent && H.root.parent.remove(H.root); p.mesh.add(H.root); H.root.position.set(0,0,0); H.root.rotation.y=0; p.facing=CV.facing; H.wantGraze=false; CV.call=false; } }
// ---- collisions: a circle (horse or man) against every solid thing; a galloping horse knocks infantry flying ----
// Z311 how tall a solid thing stands (once, from its own model): under XEOM.air.low.h it is a low obstacle the ride can leap at speed
const _lb=new THREE.Box3();
// Z404 each circle of a long ride's outline (game/ride-collide.js rideHull) meets the world in turn, carrying the ride with it; the xe ôm, the horse and a man on foot are one circle
const _hq={ pos:new THREE.Vector3(), vel:null, radius:1, bike:null };
function hullEach(p, fn){ const hull=CV.mounted && !CV.trans ? rideHull(CV.H) : null; if(!hull){ fn(p); return; } const s=Math.sin(CV.facing), c=Math.cos(CV.facing);
  for(const [hx, hz, r] of hull){ const ox=hx*c+hz*s, oz=-hx*s+hz*c; _hq.pos.set(p.pos.x+ox, 0, p.pos.z+oz); _hq.vel=p.vel; _hq.radius=r; _hq.bike=p.bike; fn(_hq); p.pos.x=_hq.pos.x-ox; p.pos.z=_hq.pos.z-oz; } }
function blockH(b){ if(b._h!=null) return b._h; let h=Infinity; if(b.mesh && b.mesh.isObject3D && !b.ridge){ b.mesh.updateWorldMatrix(true, true); _lb.setFromObject(b.mesh); if(!_lb.isEmpty()) h=_lb.max.y-heightAt(b.x, b.z); } return (b._h=h); }
function collide(p, now){ const R=p.radius, H=CV.H, PW=CV.mounted ? ridePower(H) : null;   // Z404 PW: the bán tải's weight — it climbs what is low, smashes light cover, bursts brick walls
  for(const b of blocks){ if(b.kind==='parked' || !CV.mounted && climbOver(b)) continue; const SH=solidShape(b, true);   // (Z451 not what he climbs, nor what he stands over)   // Z337 a wall, a fortress wall section, a building: its true box, not a circle round it
    if(SH){ const o=SH.obb, ex=o.hl+o.hw+R; if(Math.abs(p.pos.x-SH.x)>ex || Math.abs(p.pos.z-SH.z)>ex) continue; if(CV.mounted && rideLeap(H, blockH(b), Math.hypot(p.pos.x-SH.x, p.pos.z-SH.z)+R)) continue;
      if(PW && pushOutShape({ pos:{ x:p.pos.x, z:p.pos.z } }, SH, R, null)>=0 && rideOver(b, PW, SH)) continue;
      const px=p.pos.x, pz=p.pos.z, vx=p.vel.x, vz=p.vel.z, vn=pushOutShape(p, SH, R); if(PW && vn>0 && rideRam(p, b, vn, PW, px, pz, vx, vz)) continue;
      if(CV.mounted && vn>6){ rideBump(vn); CV.speed*=0.5; S.shake=Math.min(1.5, S.shake+0.5); sfx('thud'); } continue; }
    const dx=p.pos.x-b.x, dz=p.pos.z-b.z, rr=(b.r||1)+R; if(Math.abs(dx)>rr || Math.abs(dz)>rr) continue; const d2=dx*dx+dz*dz; if(d2>=rr*rr || d2<1e-6) continue;
    if(CV.mounted && rideLeap(H, blockH(b), Math.sqrt(d2)+rr)) continue;   // (leapt and flown over: a bike in a fast wheelie, a horse at a gallop — Z321; otherwise it stops the ride)
    if(PW && rideOver(b, PW, null)) continue;
    const d=Math.sqrt(d2), nx=dx/d, nz=dz/d, px=p.pos.x, pz=p.pos.z, vx=p.vel.x, vz=p.vel.z; p.pos.x+=nx*(rr-d); p.pos.z+=nz*(rr-d); const vn=p.vel.x*nx+p.vel.z*nz;
    if(vn<0){ if(PW && rideRam(p, b, -vn, PW, px, pz, vx, vz)) continue; p.vel.x-=nx*vn; p.vel.z-=nz*vn; if(CV.mounted && -vn>6){ rideBump(-vn); CV.speed*=0.5; S.shake=Math.min(1.5, S.shake+0.5); sfx('thud'); } } }
  const solid=(t, r)=>{ const dx=p.pos.x-t.pos.x, dz=p.pos.z-t.pos.z, rr=r+R, d2=dx*dx+dz*dz; if(d2>=rr*rr || d2<1e-6) return; const d=Math.sqrt(d2); p.pos.x+=dx/d*(rr-d); p.pos.z+=dz/d*(rr-d); if(CV.mounted) CV.speed*=0.92; };
  if(!CV.mounted && (p.lift||0)>2) return;   // Z451 up on a wall / a rock: nothing down there shoves him
  for(const e of enemies){ if(e.def.inf){ if(CV.mounted && Math.abs(CV.speed)>CAV.trample.v){ const d=Math.hypot(e.pos.x-p.pos.x, e.pos.z-p.pos.z); if(d<CAV.trample.r && (CV.tramAt.get(e)||0)<now){ CV.tramAt.set(e, now+CAV.trample.cd); damageEnemy(e, CAV.trample.dmg); sfx('thud'); } } continue; }
    if(solidTank(e)) solid(e, (e.r||2.0)*(e.mesh?e.mesh.scale.x:1)*0.9); }
  if(boss && boss.alive) solid(boss, boss.r||4); if(core) solid(core, core.r||3);
  if(CV.mounted) rideCollide(p, now); else rideClear(p.pos, R); }   // (Z337 on foot the trees, poles, parked cars, street furniture and wire are solid too)   // Z311 and everything a tank rolls over: trees, poles, parked cars, street furniture, wire
// the horse and the general idle through the intro and the 3-2-1 (no input)
export function cavIdle(dt){ const p=S.player; if(!p || !p.cav || !CV.H) return; const H=CV.H;
  if(CV.mounted){ H.root.position.set(0,0,0); H.root.rotation.y=0; p.mesh.position.set(p.pos.x, heightAt(p.pos.x,p.pos.z), p.pos.z); p.mesh.rotation.y=CV.facing=p.facing;
    const save=H.root.position.clone(); if(!H.bike){ H.root.position.copy(p.mesh.position); H.root.rotation.y=p.facing; } animateHorse(H, dt, 0, 0); H.root.position.copy(save); H.root.rotation.y=0; poseRider(CV.G, H, dt, 0, false); updateRealCav(CV, dt, { twist:0, footV:0, stance:'stand' }); } }

// ---- Z254 the general is killed: hit in the saddle he is thrown off sideways with the horse's momentum and falls to the ground (the real model plays
//   its fall-backwards clip; the procedural rig falls as a ragdoll); on foot he goes down where he stands. The riderless horse runs on, slowing, a little panicked.
export function cavDeathStart(p, now){ const H=CV.H, G=CV.G; if(!H || !G) return; const C=CAV.death;
  const fx=Math.sin(CV.facing), fz=Math.cos(CV.facing), side=Math.random()<0.5?-1:1, sx=fz*side, sz=-fx*side, from=CV.mounted;
  if(from){ scene.attach(G); G.rotation.set(0, CV.facing, 0); }
  const gy=heightAt(G.position.x, G.position.z);
  CV.dead={ t:0, from, vx:from ? fx*CV.speed*C.carry+sx*C.side : 0, vz:from ? fz*CV.speed*C.carry+sz*C.side : 0, vy:from ? C.up : 0, down:!from, pos:G.getWorldPosition(new THREE.Vector3()), panic:side };   // (Z331 where he fell in the world: on foot he is carried in p.mesh, his own position is local)
  CV.mounted=false; CV.trans=null; S.shake=Math.min(3, S.shake+1.2);
  if(!CV.real) startFall(G, [sx, sz], { drop:Math.max(0, G.position.y-gy) }); }
export function cavDeathUpdate(dt, now){ const D=CV.dead, p=S.player, H=CV.H, G=CV.G; if(!D || !H) return; const C=CAV.death; D.t+=dt;
  if(!D.down){ D.vy-=9.8*dt; G.position.x+=D.vx*dt; G.position.y+=D.vy*dt; G.position.z+=D.vz*dt; const g=heightAt(G.position.x, G.position.z);
    if(G.position.y<=g && D.vy<0){ G.position.y=g; D.down=true; D.vx*=0.25; D.vz*=0.25; burst({x:G.position.x, z:G.position.z}, BIOME.ground, 4, 3, {y:g+0.3, life:0.7, size:1.0, smoke:true, grav:-0.3, drag:2, op:0.45}); sfx('thud'); } }
  else { D.vx*=Math.exp(-dt*6); D.vz*=Math.exp(-dt*6); G.position.x+=D.vx*dt; G.position.z+=D.vz*dt; if(CV.real) G.position.y=heightAt(G.position.x, G.position.z); }
  if(!CV.real && G.userData.fall) stepFall(G, dt);
  G.getWorldPosition(D.pos);
  // the riderless horse: runs on, slowing, swerving
  if(D.from){ CV.speed*=Math.exp(-dt*C.slow); CV.facing=wrapA(CV.facing+Math.sin(D.t*1.7)*D.panic*C.swerve*dt);
    p.pos.x+=Math.sin(CV.facing)*CV.speed*dt; p.pos.z+=Math.cos(CV.facing)*CV.speed*dt; clampField(p.pos, 3); CV.hPos.copy(p.pos); }
  p.mesh.position.set(p.pos.x, heightAt(p.pos.x, p.pos.z), p.pos.z); p.mesh.rotation.y=CV.facing;
  if(!D.from){ H.root.position.set(CV.hPos.x, heightAt(CV.hPos.x, CV.hPos.z), CV.hPos.z); H.root.rotation.y=CV.facing; animateHorse(H, dt, 0, 0); }   // Z331 killed on foot: the ride stays where it stood (it was snapped to the world's origin)
  else { if(!H.bike){ H.root.position.copy(p.mesh.position); H.root.rotation.y=CV.facing; } animateHorse(H, dt, CV.speed, 0); H.root.position.set(0,0,0); H.root.rotation.y=0; }   // (a bike works in its true place, like the live ride: its driver gets off where it is)
  updateRealCav(CV, dt, { twist:0, footV:0, stance:'stand', dead:true }); }
// after a death: straight back in the saddle at the spawn point
export function cavRespawn(p){ const H=CV.H, G=CV.G; if(!H || !G) return; climbReset(); CV.trans=null; CV.call=false; CV.autoOn=false; CV.landAt=null; CV.speed=0; CV.stance=CV.want='stand'; CV.dead=null; if(G.userData.fall) endFall(G); G.rotation.set(0,0,0);
  if(!CV.mounted){ G.parent && G.parent.remove(G); seatRider(G, H); H.root.parent && H.root.parent.remove(H.root); p.mesh.add(H.root); H.root.position.set(0,0,0); H.root.rotation.set(0,0,0); CV.mounted=true; }
  CV.facing=-Math.PI; H.wantGraze=false; rideReset(H); }
