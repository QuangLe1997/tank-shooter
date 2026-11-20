// game/cavalry.js — Z245 CAVALRY MODE: the player is a general in full plate — on his armoured war horse (walk · trot · canter · gallop surge, firing from the saddle, trampling infantry) or on foot (run, sprint, crouch, prone, crawl, auto-cover) — mount / dismount (G), whistle the horse back, hoof beats and dust, all on the tank player's interface so enemies, guns, camera and HUD work unchanged
import * as THREE from 'three';
import { CAV, HORSE, HUMAN_SCALE, XEOM } from '../../config.js';
import { ARENA, BIOME, MOBILE, S, actx, aimTarget, animateHorse, animateSoldier, autoFire, barrelFixed, blocks, boss, buildGeneral, buildHorse, burst, clampField, cloakFoot, controlScheme, core, damageEnemy, endFall, enemies, fireGun, fitRealCav, floatText, getMoveDir, heightAt, master, playerRange, poseRider, poseSoldier, scene, sfx, solidTank, spawnPart, startFall, stepFall, tankInput, trackOnTarget, trackTarget, turretTracks, updateRealCav, wetAt, buildBikeMount, bikeWheelie, driverReady, rideBump, rideTalk } from '../hub.js';

export const CV = { on:false, mounted:true, H:null, G:null, speed:0, facing:-Math.PI, hPos:new THREE.Vector3(), yawRate:0, stance:'stand', want:'stand', surgeUntil:0, surgeCd:0, sprintUntil:0, sprintCd:0,
  trans:null, call:false, last:new THREE.Vector3(), tramAt:new WeakMap(), still:0, hoofAt:0 };
const wrapA=a=>Math.atan2(Math.sin(a), Math.cos(a));
export function cavOn(){ const p=S.player; return !!(p && p.cav); }
// ---- the player object: same fields as the tank (makePlayer) so every system that reads S.player keeps working ----
// Z293 the rider into his place on whatever he rides: the saddle (horse units) or the ride's pillion / bench / bed (XEOM seat, mount units) — mounting, remounting and respawning all go through here
function seatRider(G, H){ (H.body||H.B).add(G); G.rotation.set(0,0,0); if(H.bike){ const X=XEOM[H.bike]; G.position.set(0, X.seat[0], X.seat[1]); G.scale.setScalar(HUMAN_SCALE/XEOM.k); } else { G.position.set(0, 0, -0.1); G.scale.setScalar(HUMAN_SCALE/HORSE.size); } }
export function makeCavPlayer(kind){   // Z282 kind: 'xeom' / 'xichlo' ride the bike instead of the horse
  const H=kind ? buildBikeMount(kind) : buildHorse(), G=buildGeneral(); CV.H=H; CV.G=G; CV.on=true; CV.mounted=true; CV.stance='stand'; CV.want='stand'; CV.trans=null; CV.call=false; CV.speed=0;
  if(kind) H.root.scale.setScalar(XEOM.k); seatRider(G, H);
  if(H.drv){ H.drv.onCrash=()=>{ if(CV.mounted && !CV.trans){ CV.trans={ k:'off', t:0, crash:true }; CV.call=false; } };   // Z296 the bike goes down: the soldier jumps clear
    H.drv.onBack=()=>{ const p=S.player; if(!p || CV.mounted || CV.trans || CV.dead) return; const d=Math.hypot(CV.hPos.x-p.pos.x, CV.hPos.z-p.pos.z);   // back on: called aboard (near) or the bike rides to him
      if(d<=CAV.mountR) CV.trans={ k:'on', t:0 }; else { CV.call=true; floatText('BẤM G LÊN XE', '#9be04a', p.pos, 14); } }; }   // the rider sits on the horse's body (bobs and pitches with it) · on the bike's pillion / cyclo seat
  if(!kind) H.onStep=hoofFall;
  CV.real=null; CV.realP=null; fitRealCav(CV); if(kind) floatText(XEOM.lines[0], '#ffe9a8', new THREE.Vector3(0, 3, ARENA*0.55), 15);   // Z248 the real horse / operator / carbine dress the rigs once loaded
  const mesh=new THREE.Group(); mesh.add(H.root); scene.add(mesh);
  const u=G.userData, p={
    mesh, turret:new THREE.Object3D(), muzzle:u.muzzle, modelId:kind||'cav', bike:kind||null, cav:CV,
    pos:new THREE.Vector3(0, 0, ARENA*0.55), vel:new THREE.Vector3(), facing:-Math.PI, aim:-Math.PI, aimSmoothed:-Math.PI, shieldMesh:null,
    hp:100, maxHp:100, lives:5, fireAt:0, weaponLvl:0, guns:[{ id:'rifle', ammo:24, rU:0, rD:0 }], gunIdx:0, infiniteAmmo:false, ammoMul:1, magMul:1,
    buffUntil:{ rapid:0, power:0, speed:0, infammo:0, ammoup:0, range:0, turbo:0, ram:0 }, buffLv:{ turbo:0 }, era:0, rangeMul:1, radius:CAV.radius.mounted, scale:1,
    dashUntil:0, dashCdUntil:0, invincibleUntil:0, dashDir:new THREE.Vector3(), overUntil:0, spellCdUntil:0, shieldUntil:0, charge:0,
    dmgMul:1, fireMul:1, speedMul:1, dashCdMul:1, spellCdMul:1, crit:0, lifesteal:0, kbx:0, kbz:0, reloadMul:1, armor:0, bossMul:1, camK:CAV.camK.mounted, defK:CAV.defK.mounted, fwdSpeed:0, throttle:0 };
  return p; }
export function dropCavPlayer(p){ if(!p || !p.cav) return; if(CV.H && CV.H.root.parent) CV.H.root.parent.remove(CV.H.root); if(CV.G && CV.G.parent) CV.G.parent.remove(CV.G); if(p.mesh.parent) p.mesh.parent.remove(p.mesh); CV.on=false; }
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
  if(!CV.mounted && CV.H && !driverReady(CV.H)){ floatText('CHỜ BÁC TÀI DỰNG XE!', '#ffcf5a', p.pos, 14); return; }   // Z296 the driver is still picking the bike up
  if(CV.mounted){ if(CV.speed>CAV.horse.cruise*0.6){ floatText('GHÌM CƯƠNG ĐÃ', '#ffcf5a', p.pos, 14); return; }
    CV.trans={ k:'off', t:0 }; sfx('click'); return; }
  const d=Math.hypot(CV.hPos.x-p.pos.x, CV.hPos.z-p.pos.z);
  if(d<=CAV.mountR){ CV.trans={ k:'on', t:0 }; sfx('click'); }
  else { CV.call=true; whistle(); floatText('HUÝT SÁO GỌI NGỰA', '#9be04a', p.pos, 14); } }
function whistle(){ if(!actx || !master) return; const t=actx.currentTime; try{ const o=actx.createOscillator(), g=actx.createGain(); o.type='sine';
  o.frequency.setValueAtTime(1500, t); o.frequency.linearRampToValueAtTime(2300, t+0.18); o.frequency.linearRampToValueAtTime(1700, t+0.32); o.frequency.linearRampToValueAtTime(2500, t+0.5);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t+0.04); g.gain.setValueAtTime(0.09, t+0.45); g.gain.exponentialRampToValueAtTime(0.0001, t+0.6); o.connect(g).connect(master); o.start(t); o.stop(t+0.62); }catch(e){} }
// ---- Space: a gallop surge in the saddle · a sprint on foot ----
export function cavDash(){ const p=S.player, now=performance.now()/1000; if(!p || !p.cav) return;
  if(CV.mounted){ if(now<CV.surgeCd) return; CV.surgeUntil=now+CAV.surge.dur; CV.surgeCd=now+CAV.surge.cd;
    if(CV.H && CV.H.bike){ if(!bikeWheelie(CV.H)){ sfx('whoosh'); floatText('VÍT GA!', '#ffcf5a', p.pos, 15); } }   // Z296 on the xe ôm a wheelie, on the rest the throttle wide open
    else { sfx('whoosh'); floatText('PHI NƯỚC ĐẠI!', '#ffcf5a', p.pos, 15); } }
  else { if(now<CV.sprintCd || CV.stance!=='stand') return; CV.sprintUntil=now+CAV.foot.sprintDur; CV.sprintCd=now+CAV.foot.sprintCd; } }
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
  const wade=wetAt(p.pos.x, p.pos.z, 0) ? 0.55 : 1;
  if(CV.trans){ transition(p, dt, now); }
  else if(CV.mounted){
    // the horse: steer toward where you push (or the reins: W/S speed, A/D turn), speed builds and settles, he turns tighter when slow
    const Hc=CAV.horse, surge=now<CV.surgeUntil, top=(surge?Hc.gallop:Hc.cruise)*p.speedMul*wade;
    let want=0, turn=0;
    if(tankCtl){ want = TI.thr>0 ? top*TI.thr : TI.thr<0 ? -Hc.back : 0; turn=TI.turn; }
    else if(inp>0.1){ const tgt=Math.atan2(dir.x, dir.z), df=wrapA(tgt-CV.facing); want=top*inp*Math.max(0.25, Math.cos(Math.min(Math.PI/2, Math.abs(df))*0.8)); turn=Math.max(-1, Math.min(1, df*2)); }
    const tr=Hc.turnLow+(Hc.turnHigh-Hc.turnLow)*Math.min(1, Math.abs(CV.speed)/Hc.gallop), dY=turn*tr*dt; CV.facing=wrapA(CV.facing+dY); CV.yawRate=CV.yawRate+(dY/Math.max(dt,1e-3)-CV.yawRate)*Math.min(1, dt*8);
    const acc = want>CV.speed ? (surge?Hc.surgeAccel:Hc.accel) : Hc.decel; CV.speed += Math.max(-acc*dt, Math.min(acc*dt, want-CV.speed));
    p.facing=CV.facing; p.vel.set(Math.sin(CV.facing)*CV.speed, 0, Math.cos(CV.facing)*CV.speed); p.throttle=0;
    p.radius=CAV.radius.mounted; p.defK=CAV.defK.mounted; p.camK=CAV.camK.mounted;
  } else {
    // on foot: run where you push; crouch / prone slow you right down; the body turns to the aim when firing or standing
    if(MOBILE){ const mv0=Math.hypot(p.vel.x, p.vel.z); CV.still = mv0<0.25 ? CV.still+dt : 0; if(CV.want!=='prone') CV.want = CV.still>1.2 ? 'crouch' : 'stand'; }   // phones: he kneels by himself when he stops
    if(CV.want!==CV.stance) CV.stance=CV.want;
    const F=CAV.foot, sprint=now<CV.sprintUntil && CV.stance==='stand', sp=(CV.stance==='prone'?F.crawl:CV.stance==='crouch'?F.crouch:(sprint?F.sprint:F.run))*p.speedMul*wade;
    let mx=0, mz=0; if(tankCtl){ const f=p.facing+TI.turn*2.8*dt; p.facing=wrapA(f); mx=Math.sin(p.facing)*TI.thr; mz=Math.cos(p.facing)*TI.thr; } else if(inp>0.1){ mx=dir.x; mz=dir.z; }
    const tvx=mx*sp, tvz=mz*sp, ak=Math.min(1, dt*12); p.vel.x+=(tvx-p.vel.x)*ak; p.vel.z+=(tvz-p.vel.z)*ak;
    const mv=Math.hypot(p.vel.x, p.vel.z), face = (S.firing||mv<0.4||CV.stance==='prone'&&mv<0.2) ? p.aimSmoothed : Math.atan2(p.vel.x, p.vel.z);
    p.facing=wrapA(p.facing+wrapA(face-p.facing)*Math.min(1, dt*(CV.stance==='prone'?3:9)));
    p.radius=CV.stance==='prone'?CAV.radius.prone:CAV.radius.foot; p.defK=CAV.defK[CV.stance]||CAV.defK.stand; p.camK=CV.stance==='prone'?CAV.camK.prone:CAV.camK.foot;
    // the riderless horse: grazes where you left him, or trots / gallops to your whistle
    horseAlone(p, dt);
  }
  if(!CV.trans){ CV.last.copy(p.pos); p.pos.addScaledVector(p.vel, dt); collide(p, now); clampField(p.pos, 3);
    if(CV.mounted){ const moved=(p.pos.x-CV.last.x)*Math.sin(CV.facing)+(p.pos.z-CV.last.z)*Math.cos(CV.facing); CV.speed = dt>0 ? Math.sign(CV.speed)*Math.min(Math.abs(CV.speed), Math.abs(moved/dt)+0.5) : CV.speed; CV.hPos.copy(p.pos); } }
  p.fwdSpeed=CV.mounted?CV.speed:Math.hypot(p.vel.x, p.vel.z);
  // place + animate
  p.mesh.position.set(p.pos.x, heightAt(p.pos.x, p.pos.z), p.pos.z);
  const firing=!!(S.firing || (MOBILE && autoFire && p.fireAt>now-0.15));
  if(CV.mounted && !CV.trans){ p.mesh.rotation.y=CV.facing; H.root.position.set(0,0,0); H.root.rotation.y=0; if(!H.bike){ H.root.position.copy(p.mesh.position); H.root.rotation.y=CV.facing; } animateHorse(H, dt, CV.speed, CV.yawRate); H.root.position.set(0,0,0); H.root.rotation.y=0;   // (Z300 a ride works in its true place: its feet and wheels read the real ground)
    poseRider(G, H, dt, wrapA(p.aimSmoothed-CV.facing), firing); }
  else if(!CV.trans){ p.mesh.rotation.y=p.facing; const d=Math.hypot(p.pos.x-CV.last.x, p.pos.z-CV.last.z); animateSoldier(G, d, dt, firing); poseSoldier(G, CV.stance, dt);
    u.up.rotation.y += (Math.max(-0.9, Math.min(0.9, wrapA(p.aimSmoothed-p.facing))) - u.up.rotation.y)*Math.min(1, dt*10); cloakFoot(G, Math.hypot(p.vel.x,p.vel.z), CV.stance==='prone'); }
  if(p.hitT>0){ p.hitT-=dt; }
  if(now < p.respawnBlinkUntil) p.mesh.visible=Math.floor((p.respawnBlinkUntil-now)/0.25)%2===0; else if(!p.mesh.visible) p.mesh.visible=true;
  p.kbx=p.kbz=0;
  updateRealCav(CV, dt, { twist: wrapA(p.aimSmoothed-(CV.mounted?CV.facing:p.facing)), footV: Math.hypot(p.vel.x, p.vel.z), stance: CV.stance, trans: CV.trans ? { k:CV.trans.k, e:Math.min(1, CV.trans.t/CAV.mountT) } : false, hit: p.hitT>0, ride: CV.mounted && CV.H.inert ? CV.H.inert : null });   // Z299 what the sprung body feels, for him to sway with   // Z295 which way and how far through getting on / off
  // fire: hold LMB (desktop) · the trigger / auto-fire on phones, exactly like the tank
  const range=playerRange();
  if(!CV.trans){ if(MOBILE){ const t=autoFire?aimTarget(range):null; if(autoFire ? (!!t && (!turretTracks() || trackOnTarget(t))) : S.firing) fireGun(now, range); } else if(S.firing) fireGun(now, range); }
}
// ---- the horse on his own ----
function horseAlone(p, dt){ const H=CV.H; if(!H) return; let v=0, yr=0; if(H.drv && !driverReady(H)) CV.call=false;   // Z296 a crashed bike answers no whistle
  if(CV.call){ const dx=p.pos.x-CV.hPos.x, dz=p.pos.z-CV.hPos.z, d=Math.hypot(dx,dz); if(d<CAV.call.arrive){ CV.call=false; }
    else { const tgt=Math.atan2(dx,dz), df=wrapA(tgt-CV.facing); CV.facing=wrapA(CV.facing+Math.max(-2.4*dt, Math.min(2.4*dt, df))); yr=df*2; v=Math.min(CAV.call.speed, d*1.6); } }
  CV.speed+=(v-CV.speed)*Math.min(1, dt*2.2);
  CV.hPos.x+=Math.sin(CV.facing)*CV.speed*dt; CV.hPos.z+=Math.cos(CV.facing)*CV.speed*dt; clampField(CV.hPos, 3);
  for(const b of blocks){ const dx=CV.hPos.x-b.x, dz=CV.hPos.z-b.z, R=(b.r||1)+0.9, d2=dx*dx+dz*dz; if(d2<R*R && d2>1e-4){ const d=Math.sqrt(d2); CV.hPos.x+=dx/d*(R-d); CV.hPos.z+=dz/d*(R-d); } }
  H.wantGraze = !CV.call; H.root.position.set(CV.hPos.x, heightAt(CV.hPos.x, CV.hPos.z), CV.hPos.z); H.root.rotation.y=CV.facing; animateHorse(H, dt, CV.speed, yr); }
// ---- getting on and off: a short, eased move between the saddle and the ground beside the horse ----
function transition(p, dt, now){ const T=CV.trans, H=CV.H, G=CV.G, k=Math.min(1, (T.t+=dt)/CAV.mountT), e=k*k*(3-2*k);
  const side=new THREE.Vector3(-Math.cos(CV.facing), 0, Math.sin(CV.facing)).multiplyScalar(H.bike ? XEOM[H.bike].side : 1.05);   // the horse's left side (Z295 a ride's: clear of its body)
  if(T.k==='off'){ if(!T.started){ T.started=true; CV.speed=0; p.vel.set(0,0,0); CV.hPos.copy(p.pos);
      H.root.parent && H.root.parent.remove(H.root); scene.add(H.root); H.root.position.set(CV.hPos.x, heightAt(CV.hPos.x, CV.hPos.z), CV.hPos.z); H.root.rotation.y=CV.facing;
      const wp=new THREE.Vector3(); G.getWorldPosition(wp); G.parent.remove(G); p.mesh.add(G); T.from=wp; G.rotation.set(0,0,0); G.scale.setScalar(HUMAN_SCALE);
      if(H.bike && XEOM[H.bike].pose!=='stand') T.from.y=heightAt(wp.x, wp.z)+XEOM.pegY; }   // Z295 off a seat his feet start on the pegs, not at his hips
    if(T.crash) H.root.position.set(CV.hPos.x, heightAt(CV.hPos.x, CV.hPos.z), CV.hPos.z);   // Z296 the crashed bike slides on while he jumps clear
    const to=CV.hPos.clone().add(side); p.pos.set(T.from.x+(to.x-T.from.x)*e, 0, T.from.z+(to.z-T.from.z)*e);
    const gy=heightAt(p.pos.x, p.pos.z); p.mesh.position.set(p.pos.x, gy, p.pos.z); p.mesh.rotation.y=CV.facing;
    const hop = H.bike ? (XEOM[H.bike].pose==='stand' ? 0.22 : 0.06) : 0.35;   // a step down off a ride, a jump off a horse
    G.position.set(0, (T.from.y-gy)*(1-e)+Math.sin(Math.PI*e)*hop, 0); poseSoldier(G, 'stand', dt);
    animateHorse(H, dt, 0, 0);
    if(k>=1){ CV.trans=null; CV.mounted=false; G.position.set(0,0,0); p.facing=CV.facing; CV.stance=CV.want='stand'; } return; }
  // on: from beside him up into the saddle
  if(!T.started){ T.started=true; T.from=p.pos.clone(); p.vel.set(0,0,0); }
  const to=CV.hPos, s2=CV.hPos.clone().add(side); const px=T.from.x+(s2.x-T.from.x)*Math.min(1, e*2), pz=T.from.z+(s2.z-T.from.z)*Math.min(1, e*2);
  p.pos.set(px+(to.x-s2.x)*Math.max(0, e*2-1), 0, pz+(to.z-s2.z)*Math.max(0, e*2-1)); const gy=heightAt(p.pos.x, p.pos.z); p.mesh.position.set(p.pos.x, gy, p.pos.z);
  const upY = H.bike ? XEOM[H.bike].seat[0]*XEOM.k*(XEOM[H.bike].pose==='stand' ? 1 : 0.55) : (HORSE.bodyY+HORSE.saddleY)*HORSE.size-0.8;   // Z295 up onto the ride's own seat / bed, not a horse's back
  G.position.set(0, Math.max(0, e*2-1)*upY, 0); animateHorse(H, dt, 0, 0);
  if(k>=1){ CV.trans=null; CV.mounted=true; p.pos.copy(CV.hPos); G.parent && G.parent.remove(G); seatRider(G, H);
    H.root.parent && H.root.parent.remove(H.root); p.mesh.add(H.root); H.root.position.set(0,0,0); H.root.rotation.y=0; p.facing=CV.facing; H.wantGraze=false; CV.call=false; } }
// ---- collisions: a circle (horse or man) against every solid thing; a galloping horse knocks infantry flying ----
function collide(p, now){ const R=p.radius;
  for(const b of blocks){ if(b.kind==='parked') continue; const dx=p.pos.x-b.x, dz=p.pos.z-b.z, rr=(b.r||1)+R; if(Math.abs(dx)>rr || Math.abs(dz)>rr) continue; const d2=dx*dx+dz*dz; if(d2>=rr*rr || d2<1e-6) continue;
    const d=Math.sqrt(d2), nx=dx/d, nz=dz/d; p.pos.x+=nx*(rr-d); p.pos.z+=nz*(rr-d); const vn=p.vel.x*nx+p.vel.z*nz; if(vn<0){ p.vel.x-=nx*vn; p.vel.z-=nz*vn; if(CV.mounted && -vn>6){ rideBump(-vn); CV.speed*=0.5; S.shake=Math.min(1.5, S.shake+0.5); sfx('thud'); } } }
  const solid=(t, r)=>{ const dx=p.pos.x-t.pos.x, dz=p.pos.z-t.pos.z, rr=r+R, d2=dx*dx+dz*dz; if(d2>=rr*rr || d2<1e-6) return; const d=Math.sqrt(d2); p.pos.x+=dx/d*(rr-d); p.pos.z+=dz/d*(rr-d); if(CV.mounted) CV.speed*=0.92; };
  for(const e of enemies){ if(e.def.inf){ if(CV.mounted && Math.abs(CV.speed)>CAV.trample.v){ const d=Math.hypot(e.pos.x-p.pos.x, e.pos.z-p.pos.z); if(d<CAV.trample.r && (CV.tramAt.get(e)||0)<now){ CV.tramAt.set(e, now+CAV.trample.cd); damageEnemy(e, CAV.trample.dmg); sfx('thud'); } } continue; }
    if(solidTank(e)) solid(e, (e.r||2.0)*(e.mesh?e.mesh.scale.x:1)*0.9); }
  if(boss && boss.alive) solid(boss, boss.r||4); if(core) solid(core, core.r||3); }
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
  CV.dead={ t:0, from, vx:from ? fx*CV.speed*C.carry+sx*C.side : 0, vz:from ? fz*CV.speed*C.carry+sz*C.side : 0, vy:from ? C.up : 0, down:!from, pos:G.position.clone(), panic:side };
  CV.mounted=false; CV.trans=null; S.shake=Math.min(3, S.shake+1.2);
  if(!CV.real) startFall(G, [sx, sz], { drop:Math.max(0, G.position.y-gy) }); }
export function cavDeathUpdate(dt, now){ const D=CV.dead, p=S.player, H=CV.H, G=CV.G; if(!D || !H) return; const C=CAV.death; D.t+=dt;
  if(!D.down){ D.vy-=9.8*dt; G.position.x+=D.vx*dt; G.position.y+=D.vy*dt; G.position.z+=D.vz*dt; const g=heightAt(G.position.x, G.position.z);
    if(G.position.y<=g && D.vy<0){ G.position.y=g; D.down=true; D.vx*=0.25; D.vz*=0.25; burst({x:G.position.x, z:G.position.z}, BIOME.ground, 4, 3, {y:g+0.3, life:0.7, size:1.0, smoke:true, grav:-0.3, drag:2, op:0.45}); sfx('thud'); } }
  else { D.vx*=Math.exp(-dt*6); D.vz*=Math.exp(-dt*6); G.position.x+=D.vx*dt; G.position.z+=D.vz*dt; if(CV.real) G.position.y=heightAt(G.position.x, G.position.z); }
  if(!CV.real && G.userData.fall) stepFall(G, dt);
  D.pos.copy(G.position);
  // the riderless horse: runs on, slowing, swerving
  if(D.from){ CV.speed*=Math.exp(-dt*C.slow); CV.facing=wrapA(CV.facing+Math.sin(D.t*1.7)*D.panic*C.swerve*dt);
    p.pos.x+=Math.sin(CV.facing)*CV.speed*dt; p.pos.z+=Math.cos(CV.facing)*CV.speed*dt; clampField(p.pos, 3); CV.hPos.copy(p.pos); }
  p.mesh.position.set(p.pos.x, heightAt(p.pos.x, p.pos.z), p.pos.z); p.mesh.rotation.y=CV.facing;
  H.root.position.copy(p.mesh.position); H.root.rotation.y=CV.facing; animateHorse(H, dt, CV.speed, 0); H.root.position.set(0,0,0); H.root.rotation.y=0;
  updateRealCav(CV, dt, { twist:0, footV:0, stance:'stand', dead:true }); }
// after a death: straight back in the saddle at the spawn point
export function cavRespawn(p){ const H=CV.H, G=CV.G; if(!H || !G) return; CV.trans=null; CV.call=false; CV.speed=0; CV.stance=CV.want='stand'; CV.dead=null; if(G.userData.fall) endFall(G); G.rotation.set(0,0,0);
  if(!CV.mounted){ G.parent && G.parent.remove(G); seatRider(G, H); H.root.parent && H.root.parent.remove(H.root); p.mesh.add(H.root); H.root.position.set(0,0,0); H.root.rotation.set(0,0,0); CV.mounted=true; }
  CV.facing=-Math.PI; H.wantGraze=false; }
