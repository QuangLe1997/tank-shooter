// ai/tactics.js — Z95 · TACTICAL DIRECTOR — the enemy fights as a unit: encircle, flank your rear, hold range, use cover, fall back to engineers, press when you bleed
import * as THREE from 'three';
import { BALANCE, ENV, TACTICS } from '../../config.js';
import { ENVMOD, MOBILE, PLAYER_STANDOFF, PROFILE, S, _v, aimElevation, allyArmourNear, armorOf, autoFire, bigExplode, blocks, cMod, clampField, core, damageCore, damagePlayer, diffDmgMul, diffScale, dropBeam, enemies, enemyFlame, enemyGroundStrike, engineerPatient, heightAt, killEnemy, loopDmgMul, objMod, radio, removeEnemy, ringPulse, sfx, smokeSpread, soldiers, solidTank, spawnBullet, spawnPart, tankRecoil, typeMul, updateAtgm, updateCarrierCrew, updateDismount, updateEnemyBar, updateEngineer, updateGunship, updateInfantry, wrapAngle } from '../hub.js';

// ===== Z95 · TACTICAL DIRECTOR — the enemy fights as a unit: encircle, flank your rear, hold range, use cover, fall back to engineers, press when you bleed =====
export function aiIQ(){ const T=TACTICS.iq; return Math.max(0, Math.min(T.cap, T.base + T.perStage*(S.stage-1) + (T[PROFILE.difficulty]||0) + (S.loop||0)*T.loop)); }
export const AID={ at:0, flankRadioAt:0, pressRadioAt:0, press:false };
export function aiDirector(now){
  if(now < AID.at) return; AID.at = now + TACTICS.tick;
  const p=S.player, T=TACTICS, iq=aiIQ(); if(!p) return;
  AID.press = iq>=T.press.from && p.hp/p.maxHp < T.press.hp;
  const G=[]; for(const e of enemies){ if(!solidTank(e) || e.def.bomber || e.type==='scout' || e.def.engineer || e.def.carrier) continue;
    const dx=e.pos.x-p.pos.x, dz=e.pos.z-p.pos.z; if(dx*dx+dz*dz > T.engage*T.engage){ e.ai=null; continue; } G.push({ e, a:Math.atan2(dx,dz) }); }
  if(!G.length) return;
  const engs=enemies.filter(o=>o.def.engineer);
  // 1) retreaters
  for(const g of G){ const e=g.e; if(iq>=T.retreatFrom && e.hp/e.maxHp < T.retreatHp && !e.def.heavy){ e.ai={ role:'fall', eng:engs.length?engs[0]:null }; g.done=true; } }
  // 2) flankers: the quickest hulls go round the back
  const live=G.filter(g=>!g.done), nF = iq<T.flankFrom ? 0 : Math.round(live.length*T.flankShare*iq);
  live.sort((a,b)=>b.e.def.speed-a.e.def.speed);
  let fl=0; for(const g of live){ if(fl>=nF) break; if(g.e.def.heavy || g.e.def.atgm || g.e.type==='sniper' || g.e.type==='mortar') continue; const side=(fl%2?1:-1);
    g.e.ai={ role:'flank', ang: p.facing+Math.PI+side*(0.45+0.25*Math.random()) }; g.done=true; fl++; }
  if(fl && iq>=0.45 && now-AID.flankRadioAt>22){ AID.flankRadioAt=now; radio('SCH: Có xe đang vòng ra sau lưng anh — coi chừng hai bên sườn!'); }
  // 3) the rest form a ring: sorted by bearing, spread evenly over an arc that widens with IQ
  const ring=G.filter(g=>!g.done).sort((a,b)=>a.a-b.a); const n=ring.length;
  if(n){ let mx=0, mz=0; for(const g of ring){ mx+=Math.sin(g.a); mz+=Math.cos(g.a); } const mid=Math.atan2(mx,mz), arc=Math.min(Math.PI*2*T.encircle*iq, n*0.75)+0.3;
    ring.forEach((g,i)=>{ const ang = n===1 ? g.a : mid - arc/2 + arc*(i/(n-1||1)); g.e.ai={ role: (g.e.def.heavy||g.e.def.atgm||g.e.type==='sniper') ? 'anchor' : 'ring', ang }; }); }
  if(AID.press && now-AID.pressRadioAt>30){ AID.pressRadioAt=now; radio('SCH: Chúng đánh hơi thấy anh bị thương — cả đội hình đang dồn lên!'); }
}
// where this tank wants to stand right now (or null → fall back to the old straight-at-target logic)
export const _aiD=new THREE.Vector3();
export function aiDest(e, keep, iq){
  const A=e.ai, p=S.player; if(!A) return null;
  if(A.role==='fall'){ if(A.eng && enemies.includes(A.eng)) return _aiD.set(A.eng.pos.x, 0, A.eng.pos.z);
    const dx=e.pos.x-p.pos.x, dz=e.pos.z-p.pos.z, L=Math.hypot(dx,dz)||1; return _aiD.set(e.pos.x+dx/L*12, 0, e.pos.z+dz/L*12); }
  const k = keep*(AID.press?TACTICS.press.keep:1)*(A.role==='flank'?0.75:A.role==='anchor'?1.1:1);
  _aiD.set(p.pos.x+Math.sin(A.ang)*k, 0, p.pos.z+Math.cos(A.ang)*k);
  if(iq>=TACTICS.coverFrom && A.role!=='flank'){ let best=null, bd=64;                   // park behind solid cover between the slot and your gun
    for(const b of blocks){ if(b.kind==='obj'||b.kind==='camp'||b.cache||b.r<1) continue; const q=(b.x-_aiD.x)**2+(b.z-_aiD.z)**2; if(q<bd){ bd=q; best=b; } }
    if(best){ const dx=best.x-p.pos.x, dz=best.z-p.pos.z, L=Math.hypot(dx,dz)||1, off=(best.obb?1.2:best.r)+2.6; _aiD.set(best.x+dx/L*off, 0, best.z+dz/L*off); } }
  clampField(_aiD, 4);
  return _aiD;
}
// look ahead along the travel line and bend round anything solid (Core, walls, rocks, towers) instead of grinding into it
export function aiSteer(e, dir){ const look=7, R0=e.r+1.2; let ax=0, az=0;
  const test=(ox,oz,orr)=>{ const rx=ox-e.pos.x, rz=oz-e.pos.z, along=rx*dir.x+rz*dir.z; if(along<0 || along>look+orr) return;
    const px=rx-dir.x*along, pz=rz-dir.z*along, lat=Math.hypot(px,pz), clear=orr+R0; if(lat>clear) return;
    const w=(1-along/(look+orr))*(1-lat/clear+0.35), sx = lat>1e-3 ? -px/lat : dir.z, sz = lat>1e-3 ? -pz/lat : -dir.x; ax+=sx*w*1.6; az+=sz*w*1.6; };
  if(core) test(core.pos.x, core.pos.z, core.r);
  for(const b of blocks){ const q=(b.x-e.pos.x)**2+(b.z-e.pos.z)**2; if(q<(look+6)**2) test(b.x, b.z, b.obb?b.obb.hl:b.r); }
  if(ax||az){ dir.x+=ax; dir.z+=az; const L=Math.hypot(dir.x,dir.z)||1; dir.x/=L; dir.z/=L; } }
// sidestep when the player's gun is lined up and firing (lighter hulls only)
export function aiDodge(e, now, iq){ const D=TACTICS.dodge, p=S.player; if(iq<D.from || e.def.heavy || now<(e.dodgeCdAt||0) || !S.firing&&!(MOBILE&&autoFire)) return;
  const b=Math.atan2(e.pos.x-p.pos.x, e.pos.z-p.pos.z), off=Math.abs(wrapAngle(b-p.aimSmoothed)); if(off>0.12) return;
  e.dodgeCdAt=now+D.cd*(1.4-iq*0.6); if(Math.random()>iq) return;
  const side=Math.random()<0.5?-1:1; e.kbx+=Math.cos(b)*side*D.speed; e.kbz+=-Math.sin(b)*side*D.speed; }
export const _eTo=new THREE.Vector3();
export function updateEnemies(dt, now){
  aiDirector(now); const _iq=aiIQ();   // Z95
  const p=S.player;
  const slow = now < S.enemySlowUntil ? 0.35 : 1;     // Time Warp spell
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i], def=e.def;
    updateEnemyBar(e);                                  // keep the floating HP bar pinned + facing camera every frame
    // ON FIRE (flamethrower DoT) — burns down HP over time; the fire grows; the tank keeps fighting while ablaze
    if(e.burn){ const F=BALANCE.flame;
      if(now >= e.burn.until) e.burn=null;
      else { e.burn.lvl = Math.min(F.lvlMax, e.burn.lvl + F.grow*dt); const n=e.burn.lvl;   // fire creeps bigger over time
        if(Math.random() < 0.5+0.35*n) spawnPart(e.pos.x+(Math.random()-0.5)*1.3, 1.1+Math.random()*(0.6+n*0.5), e.pos.z+(Math.random()-0.5)*1.3, (Math.random()-0.5)*1.6, 1.7+Math.random()*1.8, (Math.random()-0.5)*1.6, {color:Math.random()<0.5?0xff6a1c:0xffc24a, size:0.5+n*0.22, life:0.4, grav:0.4, drag:2.6});
        if(Math.random()<0.3) spawnPart(e.pos.x,1.7,e.pos.z, (Math.random()-0.5)*1,1.8,(Math.random()-0.5)*1, {color:0x16110b, size:0.9+n*0.4, life:0.7, smoke:true, grav:-0.5, drag:1.5, op:0.4});
        e.hp -= F.dps * n * dt * typeMul('FIRE', armorOf(e)) * ENVMOD.fire; if(e.hp<=0){ killEnemy(e); continue; }   // burned to death → drop it (mesh already pooled)
      }
    }
    // stunned (EMP / freeze power-up): hold still, no fire
    if(now < e.stunUntil){
      e.mesh.position.set(e.pos.x, e.def.inf?heightAt(e.pos.x,e.pos.z):(e.def.air?e.pos.y:0), e.pos.z);
      if(Math.random()<0.3) spawnPart(e.pos.x,2,e.pos.z, (Math.random()-0.5)*4,3,(Math.random()-0.5)*4,{color:0x6fd0ff,size:0.7,life:0.3,grav:-2});
      continue;
    }
    const edt = dt * slow;   // movement slow factor (Time Warp); doesn't affect shared dt
    // BOMBER: kamikaze — charges the player and self-destructs (never shoots). Clearly telegraphed so it reads as a THREAT.
    if(e.def.bomber){
      const to=_eTo.subVectors(p.pos,e.pos); const d=to.length()||1; to.divideScalar(d);
      e.pos.addScaledVector(to, e.def.speed*edt);
      e.mesh.position.set(e.pos.x,0,e.pos.z); e.facing=Math.atan2(to.x,to.z); e.mesh.rotation.y=e.facing;
      // menacing lit-fuse telegraph: steady red glow + sparks + warning ring that quickens as it closes
      if(Math.random()<0.7) spawnPart(e.pos.x,1.9,e.pos.z, (Math.random()-0.5)*0.6,0.4,(Math.random()-0.5)*0.6, {color:0xff2a14, size:2.2, life:0.12, grav:0, drag:1});
      if(Math.random()<0.5) spawnPart(e.pos.x,2.3,e.pos.z, (Math.random()-0.5)*1.6,2.6,(Math.random()-0.5)*1.6, {color:0xffae5c, size:0.55, life:0.3, grav:-3, drag:3});
      e.warn=(e.warn||0)-dt; if(e.warn<=0){ e.warn=Math.max(0.1, Math.min(0.6,(d-2)/16)); ringPulse(e.pos, 0xff2a14, 2.0); }
      const touch = e.r + p.radius + 0.4;                            // touching the player's tank
      if(d < touch+2.4) e.mesh.visible = Math.floor(now*22)%2===0;    // frantic blink in the final lunge (telegraph)
      if(d <= touch){                                                // CONTACT → detonate INSTANTLY (no arm delay) and hurt the player
        e.mesh.visible=true; enemyGroundStrike(e.pos.x,e.pos.z,4.6,34,now); bigExplode(e.pos,0xff3020,2.0);
        ringPulse(e.pos,0xffffff,4.6); ringPulse(e.pos,0xff5028,3.2); S.shake=Math.min(4.5, S.shake+1.7); sfx('bigexplode'); removeEnemy(e); continue;
      }
      continue;
    }
    if(def.inf){ updateInfantry(e, dt, now, edt); continue; }                 // Z79 foot soldiers
    if(def.air){ updateGunship(e, dt, now, edt); continue; }                  // Z80 attack helicopter
    // pick target: player if close, else the guards defending the Core, else the Core
    const dpl = e.pos.distanceTo(p.pos);
    let targetPlayer = dpl < 34 || !core || (e.ai && dpl < TACTICS.engage);   // Z95 tanks in the director's plan stay on you
    let target = targetPlayer ? p.pos : core.pos;
    { const at=allyArmourNear(e.pos.x, e.pos.z, Math.min(30, dpl*0.7)); if(at){ target=at.pos; targetPlayer=false; } }   // Z104 a captured tank of ours closer than you draws their fire
    if(!targetPlayer && soldiers.length){                         // guards draw fire — engage the nearest soldier in the way
      let bs=null, bd=36*36; for(const s of soldiers){ const dx=s.pos.x-e.pos.x, dz=s.pos.z-e.pos.z, q=dx*dx+dz*dz; if(q<bd){ bd=q; bs=s; } }
      if(bs) target = bs.pos;
    }
    let keep=def.keep;
    if(def.engineer){ e.patient=engineerPatient(e); if(e.patient){ target=e.patient.pos; keep=7; } }   // the engineer drives to whoever needs welding
    const to = _eTo.subVectors(target, e.pos); const d=to.length()||1; to.divideScalar(d);
    // movement
    let desire;
    if(e.type==='scout'){ desire = e.def.speed; }
    else if(e.aimT>0){ desire = 0; }                                   // ATGM gunner holds still while painting the target
    else if(e.unloading){ desire = 0; }                                // Z89 APC halted, ramp down, troops piling out
    else if(targetPlayer && e.ai && e.type!=='scout'){ const dst=aiDest(e, keep, _iq);   // Z95 the director's plan: ring slot / flank / cover / fall back
      if(dst){ const mx=dst.x-e.pos.x, mz=dst.z-e.pos.z, ml=Math.hypot(mx,mz)||1; desire = ml>2 ? def.speed*objMod('enemySpeedMul')*(e.ai.role==='flank'?1.15:e.ai.role==='fall'?1.1:1) : 0;
        to.set(mx/ml, 0, mz/ml); aiSteer(e, to); aiDodge(e, now, _iq); } else desire=0; }
    else if(d > keep+1.5){ desire = def.speed*objMod('enemySpeedMul'); }   // Z83 fuel depot keeps them rolling fast
    else { desire = -def.speed*0.3; } // back off a touch / hold
    e.vel.x += (to.x*desire - e.vel.x)*Math.min(1,dt*4);
    e.vel.z += (to.z*desire - e.vel.z)*Math.min(1,dt*4);
    if(def.chief && d < keep+16){ if(e.ph2==null) e.ph2=Math.random()*6.283; const w=Math.sin(now*1.4+e.ph2)*def.speed*0.95, k=Math.min(1,dt*3); e.vel.x += -to.z*w*k; e.vel.z += to.x*w*k; }   // Z107 commander circle-strafes — hard to pin down
    { const sl=Math.hypot(e.vel.x,e.vel.z)||1, ux=e.vel.x/sl, uz=e.vel.z/sl, gr=(heightAt(e.pos.x+ux,e.pos.z+uz)-heightAt(e.pos.x-ux,e.pos.z-uz))/2;
      e.pos.addScaledVector(e.vel, edt*Math.max(0.5, Math.min(1.3, 1-gr*1.2))); }   // slower up the mounds, faster down — hard separation later in separateTanks()
    if(e.kbx||e.kbz){ e.pos.x+=e.kbx*edt; e.pos.z+=e.kbz*edt; const kf=Math.max(0,1-dt*9); e.kbx*=kf; e.kbz*=kf; }   // recoil from being shot
    clampField(e.pos, 2);
    // face
    const sp=Math.hypot(e.vel.x,e.vel.z);
    if(sp>0.5){ const wf=Math.atan2(e.vel.x,e.vel.z); let df=wrapAngle(wf-e.facing); e.facing+=df*Math.min(1,dt*7); }
    e.aim = Math.atan2(target.x-e.pos.x, target.z-e.pos.z);
    let _jx=0,_jz=0; if(e.hitT>0){ e.hitT-=dt; const j=e.hitT*1.1; _jx=(Math.random()-0.5)*j; _jz=(Math.random()-0.5)*j; }   // hit jolt shake
    e.mesh.position.set(e.pos.x+_jx,0,e.pos.z+_jz); e.mesh.rotation.y=e.facing;
    e.turret.rotation.y = wrapAngle(e.aim - e.facing);
    if(e.mesh.userData.rig) e.mesh.userData.rig.elevT = def.canShoot ? aimElevation(d, def.bspeed) : 0;   // lay the gun for the shot's arc
    // fire — accuracy, rate, damage all scale up with stage (gentle for newcomers)
    // combat range scales with tank size (small tank → small range, large → large)
    const er = def.range * (e.r/1.5);
    if(def.canShoot && now>e.fireAt && d < er){
      const ds=diffScale(), A=BALANCE.aggro;
      // PROACTIVE-FIRE chance ramps with stage — early enemies hesitate, late ones fire relentlessly
      if(Math.random() > Math.min(1, A.fireChanceBase + ds*A.fireChanceRamp)){ e.fireAt = now + 0.35; }   // hold fire a beat
      else {
        e.muzzle.getWorldPosition(_v);
        let aimA = e.aim;
        if(targetPlayer && (_iq > 0.15 || def.chief)){ const lead=Math.min(0.6, d/Math.max(1,def.bspeed))*(def.chief?1:TACTICS.leadMax*_iq); aimA = Math.atan2((target.x+p.vel.x*lead)-e.pos.x, (target.z+p.vel.z*lead)-e.pos.z); }   // Z95 smarter crews lead their shots
        const spread = A.spreadBase * (1 - ds*A.spreadDrop) * (def.accurate?A.accurateMul:1) / (1 + (S.loop||0)*A.loopAcc);   // ACCURACY tightens hard with stage + NG+ loop
        aimA += (Math.random()-0.5) * Math.max(0.02, spread) * (ENVMOD.night?ENV.night.enemySpread:1) * smokeSpread(now);
        const rateMul = A.rateBase - A.rateDrop*ds;
        const dmg = def.dmg * (0.65 + 0.35*ds) * loopDmgMul() * (e.elite?BALANCE.elite.dmgMul:1) * cMod('enemyDmgMul') * diffDmgMul();
        const col = def.accurate?0xff3a66 : (def.heavy?0xffb050 : 0xff7a4a), br = def.heavy?0.7 : (def.accurate?0.28:0.4);
        spawnBullet(_v.x, _v.z, aimA, {owner:'e', dmg, speed:def.bspeed, color:col, r:br, life:3.0, maxDist:er+2, arcDist:d, knock:def.heavy?2.2:1, y:Math.max(1.2,_v.y)});
        tankRecoil(e.mesh, aimA, def.heavy?0.95:(def.accurate?0.7:0.45), e.facing);
        spawnPart(_v.x,1.4,_v.z, Math.sin(aimA)*7,1,Math.cos(aimA)*7, {color:col,size:def.heavy?1.4:1,life:0.1,grav:0,drag:7});
        sfx('enemyShoot', e.pos);
        if(def.burst){ e.burstLeft--; if(e.burstLeft<=0){ e.fireAt=now+def.reload*rateMul; e.burstLeft=def.burst; } else e.fireAt=now+def.fireCd; }
        else e.fireAt=now+def.fireCd*rateMul;
      }
    }
    if(def.carrier){ updateCarrierCrew(e, now); updateDismount(e, dt, now, dpl); }   // APC: riflemen on top shoot; Z89 it halts and dismounts a squad
    if(def.pyro) enemyFlame(e, d, dt, now, target);
    if(def.atgm && targetPlayer) updateAtgm(e, d, now, target, dt); else if(def.atgm && e.laser){ dropBeam(e.laser); e.laser=null; e.aimT=0; }
    if(def.engineer) updateEngineer(e, dt, now);
    // mortar enemies are SPOTTERS — they call in the ARTILLERY barrage (see updateArtillery); they don't lob directly
    // ram contact damage (separateTanks keeps them from overlapping; this just applies the bump damage)
    if(now>e.ramAt){
      if(dpl < e.r+p.radius+PLAYER_STANDOFF+1.5){ damagePlayer(def.ram, now); e.ramAt=now+0.8; }   // rammers still bump-damage across the standoff band
      else if(core && e.pos.distanceTo(core.pos) < e.r+core.r+0.6){ damageCore(def.ram*0.7); e.ramAt=now+0.8; }
    }
  }
}
