// game/update.js — per-frame PLAYER update (drive, aim, fire), tank rigs, camera follow; Vietnamese label helpers
import * as THREE from 'three';
import { DRIVE, LOOT, AIM, HEADING, CAM_AUTO, PAD_CFG, TURRET } from '../../config.js';
import { BIOME_VI, CAT_VI, FORTS, MOBILE, PAD, PLAYER, PROFILE, RIVER, S, TANK_SCALE, _v, aimTarget, animateTank, autoFire, barrelFixed, boss, bumpAt, camera, clampField, controlScheme, decalTread, enemies, equippedGun, fireGun, getMoveDir, gradePass, heightAt, magCap, padCfg, playerRange, rangeRing, solidTank, spawnPart, tankInput, wetAt } from '../hub.js';

// ----------------------------- UPDATE -----------------------------
export function updatePlayer(dt, now){
  const p = S.player; if(!p) return;
  // derive timed-buff state each frame
  const bu=p.buffUntil;
  p.infiniteAmmo = now < bu.infammo;
  p.ammoMul = now < bu.ammoup ? 1.6 : 1;
  // boss parity: grow to ~boss size during a boss fight so it's an even brawl
  const targScale = (boss&&boss.alive) ? Math.max(1, boss.r/PLAYER.radius*0.8) : 1;
  p.scale += (targScale - p.scale)*Math.min(1, dt*3);
  p.radius = PLAYER.radius * p.scale * TANK_SCALE;
  p.mesh.scale.setScalar(p.scale * TANK_SCALE);
  // AIM — Z104 mobile: the barrel is FIXED to the hull (no mouse to lay it) → the tank shoots where it faces.
  //       desktop: aim with the mouse.
  if(barrelFixed()){ p.aim = p.facing; p.aimSmoothed = p.facing; }
  else {
    if(S.pointerActive){ p.aim = Math.atan2(S.aimPoint.x - p.pos.x, S.aimPoint.z - p.pos.z); }
  }
  // smooth the aim angle a touch (avoids jitter); turret yaw applied after hull below
  const da = wrapAngle(p.aim - p.aimSmoothed);
  const padOn = PAD.active && now - PAD.lastAt < 1.5;                                 // Z124 a controller is the one being used right now
  const tk=Math.max(TURRET.min, Math.min(TURRET.max, PROFILE.turretK||1));          // Z145 the player's turret traverse speed
  if(padOn && !barrelFixed()){ const A=PAD_CFG.aim, mx=TURRET.rate*tk*(padCfg().sens||1)*dt, st=da*Math.min(1, dt*A.k); p.aimSmoothed = wrapAngle(p.aimSmoothed + Math.max(-mx, Math.min(mx, st))); }
  else if(!barrelFixed()){ const mx=TURRET.rate*TURRET.mouseMul*tk*dt, st=da*Math.min(1, dt*TURRET.k); p.aimSmoothed = wrapAngle(p.aimSmoothed + Math.max(-mx, Math.min(mx, st))); }
  else p.aimSmoothed = wrapAngle(p.aimSmoothed + da * Math.min(1, dt*PLAYER.turnLerp));

  // movement — Z85 TRACKED DRIVE: the hull steers (pivot when slow, wide arcs when fast), thrust runs along the hull,
  // a heavy launch builds into real momentum, the tank coasts on when you let go, and pulls back to reverse.
  const dashing = now < p.dashUntil;
  const fs0=Math.sin(p.facing), fc0=Math.cos(p.facing);
  let vf = p.vel.x*fs0 + p.vel.z*fc0, vl = p.vel.x*fc0 - p.vel.z*fs0;               // forward / lateral speed in hull space
  p.throttle = 0;
  if(dashing){
    p.vel.copy(p.dashDir).multiplyScalar(PLAYER.dashSpeed);
    const want=Math.atan2(p.dashDir.x, p.dashDir.z), df=wrapAngle(want-p.facing); p.facing += (Math.abs(df)>2.2? 0 : df*Math.min(1,dt*10));
  } else {
    const over = now < p.overUntil;
    const spd = now < bu.speed ? LOOT.speed.top : 1;     // ENGINE OVERDRIVE pickup (Z93)
    const heavy = 1 - Math.min(0.22, magCap(equippedGun())/450);                 // heavier magazine → a bit slower (ammo↔speed tradeoff)
    const tankCtl = controlScheme()==='tank', TI = tankCtl ? tankInput() : null;
    const dir = tankCtl ? null : getMoveDir(), inp = tankCtl ? Math.max(Math.abs(TI.thr), Math.abs(TI.turn)) : Math.min(1, dir.length());
    const gx=(heightAt(p.pos.x+1,p.pos.z)-heightAt(p.pos.x-1,p.pos.z))/2, gz=(heightAt(p.pos.x,p.pos.z+1)-heightAt(p.pos.x,p.pos.z-1))/2;
    const gr = gx*fs0*Math.sign(vf||1)+gz*fc0*Math.sign(vf||1);                    // >0 climbing, <0 descending (along travel)
    const slopeK = Math.max(0.45, Math.min(1.35, 1 - gr*1.3)); p.grade = inp>0.1 ? gr : 0;
    const mob = Math.min(LOOT.rules.speedCap, (over?1.3:1)*p.speedMul*spd);              // Z93: every speed source multiplies, then the hard cap
    const wade = wetAt(p.pos.x, p.pos.z, 0) ? 0.55 : 1;                                   // Z139 wading a river / stream slows the hull (a bridge keeps it dry)
    if(wade<1 && Math.random()<dt*14) spawnPart(p.pos.x+(Math.random()-0.5)*2.4, RIVER.y+0.15, p.pos.z+(Math.random()-0.5)*2.4, (Math.random()-0.5)*2, 1.2+Math.random()*1.6, (Math.random()-0.5)*2, { color:0xcfe8f2, size:0.35+Math.random()*0.3, life:0.55, grav:-9, drag:1.2 });
    const maxSp = PLAYER.maxSpeed*mob*heavy*wade*Math.max(0.7,slopeK);
    const tLv = now < bu.turbo ? (p.buffLv.turbo||1) : 0; p.turboLv=tLv;
    const pow = mob*(over?1.04:1)*heavy*slopeK*(1+tLv*LOOT.turbo.accel)*(p.accelMul||1);
    const scr = controlScheme()!=='tank' && !MOBILE, piv = scr ? DRIVE.screenPivot : DRIVE.pivot, tas = scr ? DRIVE.screenTurnAtSpeed : DRIVE.turnAtSpeed;   // Z107 keyboard on screen axes: swing round fast
    const turnK = (piv + (tas - piv)*Math.min(1, Math.abs(vf)/PLAYER.maxSpeed))*(p.turnMul||1);   // Z155 the model's suspension / gearbox
    let thr = 0;
    if(tankCtl){                                                                  // Z99 TANK CONTROLS: W/S = throttle along the hull, A/D = rotate the hull
      if(TI.turn) p.facing = wrapAngle(p.facing + TI.turn*turnK*dt);
      thr = TI.thr; p.rev = thr < 0; p.throttle = thr || TI.turn*0.25;             // pivoting still loads the engine a little
    } else if(inp > 0.1){                                                         // SCREEN CONTROLS: push where you want to go; the hull turns to it
      const want = Math.atan2(dir.x, dir.z); let df = wrapAngle(want - p.facing);
      const aimOnly = barrelFixed() && inp < AIM.pivotOnly;                       // Z104 light push on a phone = swing the gun (hull) onto the target, stay put
      if(aimOnly || (scr && !DRIVE.screenReverse)) p.rev = false; else if(p.rev ? Math.abs(df) > DRIVE.reverseKeep : Math.abs(df) > DRIVE.reverseAngle) p.rev = true; else p.rev = false;   // Z121 push behind the hull → back up straight, at any speed (brakes first); hysteresis so it doesn't flip
      if(p.rev) df = wrapAngle(want + Math.PI - p.facing);
      let step = Math.sign(df)*Math.min(Math.abs(df), turnK*dt);
      if(padOn){ const H=PAD_CFG.hull, mr=(DRIVE.pivot + (DRIVE.turnAtSpeed-DRIVE.pivot)*Math.min(1, Math.abs(vf)/PLAYER.maxSpeed))*(padCfg().sens||1), wr=Math.max(-mr, Math.min(mr, df*H.k));
        p.yawV = (p.yawV||0) + (wr-(p.yawV||0))*Math.min(1, dt*H.ease); step = p.yawV*dt; if(Math.abs(step) > Math.abs(df)) step = df; }
      p.facing = wrapAngle(p.facing + step);
      const align = Math.max(0, Math.cos(df));                                    // pivot first: little drive until the hull lines up
      thr = aimOnly ? 0 : inp * (0.12 + 0.88*align*align) * (p.rev?-1:1); p.throttle = aimOnly ? 0.2 : thr;
    }
    if(!(inp > 0.1) || tankCtl) p.yawV = 0;
    if(Math.abs(thr) > 0.05){
      const ak = Math.max(0.15, Math.min(1, (tankCtl ? Math.abs(TI.thr) : inp) / PAD_CFG.hull.speedFull)), top = (thr<0 ? maxSp*DRIVE.reverseMul : maxSp)*ak, v = Math.abs(vf);   // Z124 stick tilt = top speed (keys / full tilt = 1)
      if(vf*thr < -0.5){ vf += Math.sign(thr)*Math.min(Math.abs(vf), DRIVE.brake*dt); }   // pushing against the motion = brakes
      else { const l0 = DRIVE.launch + (1-DRIVE.launch)*Math.min(1, tLv*LOOT.turbo.launch), launch = l0 + (1-l0)*Math.min(1, v/DRIVE.launchV);   // heavy launch → builds with speed (TURBO fills the gap)
        const fall = Math.max(0, 1 - (v/top)*(v/top));                                   // power fades toward top speed
        vf += thr * DRIVE.accel*(p.rev?DRIVE.reverseMul+0.2:1) * pow * launch * fall * dt;
        if(Math.abs(vf) > top) vf -= Math.sign(vf)*Math.min(Math.abs(vf)-top, DRIVE.brake*dt); }
    } else { p.rev=false; vf -= Math.sign(vf)*Math.min(Math.abs(vf), (DRIVE.coast + Math.abs(vf)*DRIVE.coastLin)*dt); }   // throttle off: it rolls on and settles
    vl *= Math.max(0, 1 - DRIVE.grip*dt);                                         // tracks grip: no ice-skating sideways
    const fs1=Math.sin(p.facing), fc1=Math.cos(p.facing);
    p.vel.x = fs1*vf + fc1*vl; p.vel.z = fc1*vf - fs1*vl;
    p.vel.x -= gx*DRIVE.slopeSlide*dt; p.vel.z -= gz*DRIVE.slopeSlide*dt;                                     // still slides down into hollows/craters a little
  }
  p.fwdSpeed = p.vel.x*Math.sin(p.facing) + p.vel.z*Math.cos(p.facing);
  { const hd=p.mesh.userData.heading; if(hd){ const k=Math.min(1, Math.abs(p.fwdSpeed)/8), want=HEADING.idle+(HEADING.moving-HEADING.idle)*k;   // Z107 the nose chevron brightens with speed
      hd.material.opacity += (want-hd.material.opacity)*Math.min(1, dt*6); hd.position.z = HEADING.dist + (p.fwdSpeed<0 ? 0 : k*0.6); } }
  p.ramOn = now < bu.ram; { const bl=p.mesh.userData.dozer; if(bl && bl.visible!==p.ramOn) bl.visible=p.ramOn; }   // Z93 dozer blade bolts on while the buff runs
  if(p.turboLv && Math.abs(p.throttle||0)>0.4 && Math.random()<0.5*p.turboLv){ const bx=p.pos.x-Math.sin(p.facing)*2.4, bz=p.pos.z-Math.cos(p.facing)*2.4;   // turbo: blue exhaust flare
    spawnPart(bx+(Math.random()-0.5)*0.8, 1.3, bz, -Math.sin(p.facing)*4, 1.2, -Math.cos(p.facing)*4, {tex:'flash', color:0x8fd8ff, size:0.6, life:0.12, grav:0, drag:4}); }
  { const sp=Math.abs(p.fwdSpeed), th=Math.abs(p.throttle||0), E=DRIVE.smoke, ex=p.mesh.userData.exhaust;   // Z116 heavy engine taking the load → black diesel smoke out of the exhaust
    if(ex && th>0.35 && sp<E.until && now>(p._puffAt||0)){ const load=(1-sp/E.until)*Math.min(1,th), n=p._still?E.big:1; p._puffAt=now+E.every*(0.7+sp/E.until*1.6); p._still=false; ex.getWorldPosition(_v);
      const bx=-Math.sin(p.facing), bz=-Math.cos(p.facing);
      for(let k=0;k<n;k++) spawnPart(_v.x+(Math.random()-0.5)*0.3, _v.y+0.15, _v.z+(Math.random()-0.5)*0.3, bx*(1.2+Math.random()*1.5)+(Math.random()-0.5)*0.6, 1.6+Math.random()*1.4+k*0.3, bz*(1.2+Math.random()*1.5)+(Math.random()-0.5)*0.6,
        {color:k?0x16130f:0x0c0a08, size:(0.7+load*1.3)*(n>1?1.35:1), life:1.2+load*0.9, smoke:true, grav:-0.3, drag:1.3, grow:1.9, op:0.35+0.4*load}); }
    if(sp<0.5 && th<0.1) p._still=true; }
  if(now < bu.speed && Math.random()<0.25){ const bx=p.pos.x-Math.sin(p.facing)*2.4, bz=p.pos.z-Math.cos(p.facing)*2.4; spawnPart(bx, 1.5, bz, 0, 1.6, 0, {color:0x1a1814, size:0.9, life:0.8, smoke:true, grav:-0.4, drag:1.5, op:0.45}); }   // overdrive: diesel soot
  p.pos.addScaledVector(p.vel, dt);
  if(p.kbx||p.kbz){ p.pos.x+=p.kbx*dt; p.pos.z+=p.kbz*dt; const kf=Math.max(0,1-dt*8); p.kbx*=kf; p.kbz*=kf; }   // recoil when hit
  // clamp to arena
  clampField(p.pos, 3);
  // apply transforms: hull faces travel dir; turret is a child so subtract hull yaw to hit world aim
  p.mesh.position.set(p.pos.x, 0, p.pos.z);
  p.mesh.rotation.y = p.facing;
  p.turret.rotation.y = wrapAngle(p.aimSmoothed - p.facing);
  { const fl=p.mesh.userData.flag; if(fl){ const F=fl.userData.flag, sp=Math.hypot(p.vel.x,p.vel.z), k=Math.min(1, sp/(PLAYER.maxSpeed*0.55));   // Z89 flag streams back off the motion
      F.spd += (k-(F.spd||0))*Math.min(1, dt*(k>(F.spd||0)?2.5:1.2));
      if(sp>1.5){ const tx=-p.vel.x/sp, tz=-p.vel.z/sp, want=wrapAngle(Math.atan2(tz,-tx) - p.aimSmoothed); fl.rotation.y += wrapAngle(want-fl.rotation.y)*Math.min(1,dt*4); } } }
  // HIT FLINCH — clear rattle + roll right after taking damage (the "đang bị bắn trúng" feel)
  if(p.hitT>0){ p.hitT-=dt; const j=Math.max(0,p.hitT)*1.7;
    p.mesh.position.x += (Math.random()-0.5)*j; p.mesh.position.z += (Math.random()-0.5)*j;
    p.mesh.position.y = Math.max(0, p.hitT)*0.4*Math.random();                         // little buck/lift
    p.mesh.rotation.z = (Math.random()-0.5)*Math.max(0,p.hitT)*0.95;
    if(p.hitT<=0){ p.mesh.rotation.z=0; p.mesh.position.y=0; } }
  // BURNING hit-marks: fire + smoke at each struck spot on the hull (rides + rotates with the tank)
  if(p.burns && p.burns.length){ for(let i=p.burns.length-1;i>=0;i--){ const bn=p.burns[i]; bn.t-=dt;
    if(bn.t<=0){ p.burns.splice(i,1); continue; }
    const ang=bn.la+p.facing, bx=p.pos.x+Math.sin(ang)*bn.r, bz=p.pos.z+Math.cos(ang)*bn.r, intensity=Math.min(1,bn.t/0.8);
    if(Math.random()<0.75*intensity) spawnPart(bx, bn.ly, bz, (Math.random()-0.5)*0.9, 1.7+Math.random()*1.3, (Math.random()-0.5)*0.9, {color: Math.random()<0.5?0xff7a1c:0xffc24a, size:0.5+Math.random()*0.4, life:0.4, grav:0.4, drag:2.6});   // flame licking up
    if(Math.random()<0.55) spawnPart(bx, bn.ly+0.35, bz, (Math.random()-0.5)*0.5, 1.5+Math.random()*0.9, (Math.random()-0.5)*0.5, {color:0x18130d, size:0.85+Math.random()*0.6, life:0.75, smoke:true, grav:-0.5, drag:1.5, op:0.42});   // black smoke
  } }
  // respawn blink — flash the hull 3× during the post-respawn invulnerability
  if(now < p.respawnBlinkUntil) p.mesh.visible = Math.floor((p.respawnBlinkUntil-now)/0.25)%2===0;
  else if(!p.mesh.visible) p.mesh.visible = true;
  { const g0=equippedGun(); if(g0.spinUp){ const on = now-(p.spinT||0) < 0.2; p.spin = on ? Math.min(1,(p.spin||0)+dt/g0.spinUp) : Math.max(0,(p.spin||0)-dt/0.9); } else p.spin=0; }
  const _bg=p.mesh.userData.barrelG; if(_bg&&_bg.userData.spin) _bg.userData.spin.rotation.z += dt*(4+26*(p.spin||0));   // rotor speed = spin-up state
  { const rg=p.mesh.userData.rig; if(rg){ const g0=equippedGun(), tg=aimTarget(playerRange()+2);   // lay the gun: elevate for the ballistic lob to the target / cursor
      const D = tg ? Math.hypot(tg.pos.x-p.pos.x, tg.pos.z-p.pos.z) : ((!MOBILE || PAD.active) && S.pointerActive ? Math.hypot(S.aimPoint.x-p.pos.x, S.aimPoint.z-p.pos.z) : 0);
      rg.elevT = rg.elevates===false ? 0 : Math.min(0.05, D*0.0012); }   // flat-shooting tank gun: just a hair of super-elevation
    const radar=p.mesh.userData.gunMount && p.mesh.userData.gunMount.getObjectByName('radar'); if(radar) radar.rotation.z += dt*2.4; }   // flak search radar sweeps
  // energy shield: hex field + rim glow + orbiting rings; pops in, breathes, blinks near expiry, ripples on a blocked hit
  if(p.shieldMesh){ const sg=p.shieldMesh, on = now < p.shieldUntil;
    if(on && !sg.visible){ sg.visible=true; p._shieldOnAt=now; }              // spawn-in
    else if(!on && sg.visible) sg.visible=false;
    if(on){ const ud=sg.userData, tleft=p.shieldUntil-now;
      const popT=Math.min(1,(now-(p._shieldOnAt||now))/0.4);                  // 0→1 pop-in
      const hit=p.shieldHit?Math.max(0,1-(now-p.shieldHit)/0.3):0;           // 1→0 flash after absorbing a shot
      const blink=(tleft<1.2)?(0.55+0.45*Math.sin(now*22)):1;               // warning blink as it runs out
      sg.scale.setScalar((0.65+0.35*popT)*(1+Math.sin(now*4)*0.02+hit*0.07));
      ud.shell.rotation.y += dt*0.7; ud.shell.rotation.x += dt*0.3; ud.shell.material.map.offset.x += dt*0.04;   // drifting energy field
      ud.ring1.rotation.z += dt*1.3; ud.ring2.rotation.z -= dt*1.0; ud.ring2.rotation.x += dt*0.5;               // orbiting bands
      ud.shell.material.opacity = Math.min(1, (0.42+0.12*Math.sin(now*6))*popT*blink + hit*0.5);
      ud.rim.material.opacity   = Math.min(1, (0.3+hit*0.55)*popT*blink);
      ud.fill.material.opacity  = (0.1+hit*0.22)*popT;
      ud.ring1.material.opacity = ud.ring2.material.opacity = Math.min(1, (0.75+hit*0.25)*blink*popT);
    } }
  // combat range: ring follows player; gun only fires when a target is inside it
  const range = playerRange();
  rangeRing.visible = true; rangeRing.position.set(p.pos.x, 0.06, p.pos.z);
  rangeRing.scale.set(range, range, range);
  rangeRing.material.opacity = 0.08 + Math.sin(now*2)*0.025;   // thin + faint, just visible
  if(MOBILE){ if(autoFire ? !!aimTarget(range) : S.firing) fireGun(now, range); }   // mobile: AUTO fires when a target is straight ahead in range; MANUAL fires while the trigger is held
  else if(S.firing) fireGun(now, range);                                                 // desktop: fire only while LMB held; gun fireCd caps the rate
}
export function biomeVi(n){ return BIOME_VI[n]||n; }
export function catVi(c){ return CAT_VI[c]||c; }
export function wrapAngle(a){ return Math.atan2(Math.sin(a), Math.cos(a)); }
export function _HAT(x,z){ return heightAt(x,z); }
export function _rideH(x,z){ return heightAt(x,z)+bumpAt(x,z); }
export function _rigTread(m, x, z, f){ const rg=m.userData.rig; if(rg && rg.treadD>0.55){ rg.treadD=0; decalTread(x, z, f, m.scale.x||1); } }
export function updateTankRigs(dt){
  const p=S.player; if(p&&p.mesh){ animateTank(p.mesh, p.pos.x, p.pos.z, p.facing, dt, true); _rigTread(p.mesh, p.pos.x, p.pos.z, p.facing); }
  for(const e of enemies){ if(!solidTank(e) && !e.def.bomber) continue; animateTank(e.mesh, e.pos.x, e.pos.z, e.facing, dt); _rigTread(e.mesh, e.pos.x, e.pos.z, e.facing); }
  if(boss&&boss.alive&&boss.mesh){ animateTank(boss.mesh, boss.pos.x, boss.pos.z, boss.facing, dt); _rigTread(boss.mesh, boss.pos.x, boss.pos.z, boss.facing); }
}
// camera follow with aim lookahead
// lower, closer 3rd-person angle (was a high top-down); pulls back a touch on dash
export const camOff = new THREE.Vector3(0, MOBILE?18:28, MOBILE?14.5:23);   // base offset; S.zoom scales it, S.camYaw rotates it (player camera controls)
export const _camOff = new THREE.Vector3(), _camUP = new THREE.Vector3(0,1,0);
export const camTarget = new THREE.Vector3();
export const camLook = new THREE.Vector3();
export const camBase = new THREE.Vector3(); export let _camT = -1; const _camWant = new THREE.Vector3();
// Z110 AUTO CAMERA: how much wider the fight wants the view right now (0 … CAM_AUTO.max), on top of the zoom the player picked
export let _camAutoAt=0, _camAutoWant=0;
export function camAutoPull(p){ const A=CAM_AUTO, px=p.pos.x, pz=p.pos.z, R2=A.nearR*A.nearR; let n=0, k=0;
  k += Math.min(1, Math.hypot(p.vel.x, p.vel.z)/PLAYER.maxSpeed) * A.speedK;                                  // speed: see what you're driving into
  for(const e of enemies){ if(e.guard) continue; const dx=e.pos.x-px, dz=e.pos.z-pz; if(dx*dx+dz*dz<R2) n++; }
  k += Math.min(1, n/A.crowd) * A.crowdK;                                                                     // a crowd closing in
  for(const f of FORTS){ if(f.captured) continue; const d=Math.hypot(f.x-px, f.z-pz); if(d < f.R+A.fortPad){ k += A.fortK; break; } }   // a fortress ahead / inside one
  if(boss && Math.hypot(boss.pos.x-px, boss.pos.z-pz) < A.bossR) k += A.bossK;                                 // the boss fight
  return Math.min(A.max, k); }
export function updateCamera(dt, now){
  const p=S.player; if(!p) return;
  // look slightly ahead of the player toward the aim + a bit toward velocity (motion feel)
  camLook.set(Math.sin(p.aim)*6 + p.vel.x*0.18, 0, Math.cos(p.aim)*6 + p.vel.z*0.18);
  camTarget.set(p.pos.x + camLook.x*0.45, 0, p.pos.z + camLook.z*0.45);
  const dashPull = (now && now < p.dashUntil) ? 4 : 0;     // ease back during a dash
  if(now>=_camAutoAt){ _camAutoAt=now+CAM_AUTO.every; _camAutoWant=S.camAuto ? camAutoPull(p) : 0; }   // Z110 auto camera (sampled 4×/s, eased every frame)
  S.camZ += (_camAutoWant - S.camZ) * Math.min(1, dt*CAM_AUTO.ease);
  { const k=Math.max(0.4, (S.zoom||1) + S.camZ); _camOff.set(camOff.x*k, camOff.y*k*(k<1 ? 0.78+0.22*k : 1), camOff.z*k); }   // player zoom + the auto camera's pull-back · Z165 close-ups drop the camera a little lower for a more cinematic angle
  if(S.camYaw) _camOff.applyAxisAngle(_camUP, S.camYaw);   // player view rotation
  const want = _camWant.copy(camTarget).add(_camOff);
  want.y += dashPull;
  if(now - _camT > 0.15) camBase.copy(camera.position); _camT = now;   // resuming after a cinematic → continue from where the camera is
  camBase.lerp(want, Math.min(1, dt*5.5));   // Z107: tighter follow (was 4.5) — less floaty lag behind the lighter tank
  const tr=Math.min(1, S.shake/3.2), t2=tr*tr;               // TRAUMA model: shake ∝ trauma², smooth multi-sine noise, decays
  camera.position.copy(camBase);
  if(t2>0.0004){ const q=now; camera.position.x += (Math.sin(q*41.3)+Math.sin(q*73.1+1.7)*0.6)*t2*1.15; camera.position.y += (Math.sin(q*37.7+0.4)+Math.sin(q*67.9)*0.5)*t2*0.7; camera.position.z += (Math.sin(q*47.9+2.1)+Math.sin(q*59.3)*0.6)*t2*1.15; }
  { const k=S.camKick||0; if(k>0.004){ const a=S.kickAng||0; camera.position.x -= Math.sin(a)*k*0.75; camera.position.z -= Math.cos(a)*k*0.75; camera.position.y += k*0.32; } S.camKick=k*Math.exp(-dt*10); }   // Z168 the shot shoves the camera back along the barrel, then it springs home
  camera.lookAt(camTarget.x, 1, camTarget.z);
  { const base=camera.userData.fov0||(camera.userData.fov0=camera.fov), want=base+Math.min(3.2,(S.camKick||0)*2.4); if(Math.abs(camera.fov-want)>0.02){ camera.fov=want; camera.updateProjectionMatrix(); } }   // and a small FOV punch
  if(t2>0.0004) camera.rotateZ((Math.sin(now*29.7)+Math.sin(now*53.3+0.9)*0.5)*t2*0.035);   // roll
  gradePass.uniforms.aberr.value = t2*0.007;
  S.shake = Math.max(0, S.shake - dt*(S.shake*2.6 + 1.2));
}
