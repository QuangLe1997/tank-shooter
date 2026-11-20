// ai/tactics.js — Z95 · TACTICAL DIRECTOR — the enemy fights as a unit: encircle, flank your rear, hold range, use cover, fall back to engineers, press when you bleed
import * as THREE from 'three';
import { BALANCE, ENV, TACTICS, FORT } from '../../config.js';
import { ARC_G, ENEMY_CLASS, ENVMOD, FT, MOBILE, PLAYER_STANDOFF, PROFILE, S, _v, abandonedTick, aimElevation, allyArmourNear, armorOf, autoFire, bigExplode, blocksNear, bullets, cMod, clampField, core, damageCore, damagePlayer, diffDmgMul, diffScale, dropBeam, enemies, enemyFlame, enemyGroundStrike, enemyMuzzleFX, engineerPatient, floatText, fortExitDir, fortWallCross, guardLeash, heightAt, inBlock, killEnemy, loopDmgMul, objMod, radio, removeEnemy, ringPulse, sfx, smokeSpread, soldiers, solidTank, spawnBullet, spawnPart, supplyRate, supplySpeed, tankEscorted, tankRecoil, truckSalvo, typeMul, updateAtgm, updateCarrierCrew, updateDismount, updateEnemyBar, updateEngineer, updateHeli, updateInfantry, wrapAngle, MODE } from '../hub.js';

// ===== Z95 · TACTICAL DIRECTOR — the enemy fights as a unit: encircle, flank your rear, hold range, use cover, fall back to engineers, press when you bleed =====
export function aiIQ(){ const T=TACTICS.iq; return Math.max(0, Math.min(T.cap, T.base + T.perStage*(S.stage-1) + (T[PROFILE.difficulty]||0) + (S.loop||0)*T.loop)); }
export const AID={ at:0, flankRadioAt:0, pressRadioAt:0, press:false, punish:false, punishRadioAt:-99, volleyAt:0, volleyRadioAt:-99 };
export function aiDirector(now){
  if(now < AID.at) return; AID.at = now + TACTICS.tick;
  const p=S.player, T=TACTICS, iq=aiIQ(); if(!p) return;
  AID.press = iq>=T.press.from && p.hp/p.maxHp < T.press.hp;
  { const g=p.guns&&p.guns[p.gunIdx], was=AID.punish; AID.punish = iq>=T.punish.from && !!(g && g.rU>now);   // Z185 you are reloading → the line rushes you
    if(AID.punish && !was && now-AID.punishRadioAt>T.punish.radioGap && enemies.some(e=>e.ai)){ AID.punishRadioAt=now; radio('SCH: Chúng thấy anh đang nạp đạn — xe địch đang ào lên!'); } }
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
    ring.forEach((g,i)=>{ const ang = n===1 ? g.a : mid - arc/2 + arc*(i/(n-1||1)); g.e.ai={ role: (g.e.def.heavy||g.e.def.atgm||g.e.type==='sniper'||tankEscorted(g.e)) ? 'anchor' : 'ring', ang }; }); }   // Z173 a tank with its infantry fixes you from range while the men flank
  // Z185 4) coordinated volley: every so often the pack lays on you together and fires on one count (a red glint at each muzzle first)
  { const V=T.volley; if(iq>=V.from && now>AID.volleyAt){ AID.volleyAt=now+V.every[0]+Math.random()*(V.every[1]-V.every[0]);
      const shooters=G.filter(g=>g.e.def.canShoot && !g.e.def.truck && g.e.ai && g.e.ai.role!=='fall').map(g=>g.e);
      if(shooters.length>=V.minTanks){ for(const e of shooters) e.volleyAt=now+V.warn+Math.random()*0.15;
        if(now-AID.volleyRadioAt>V.radioGap){ AID.volleyRadioAt=now; radio('SCH: Cả tốp xe đang ngắm loạt vào anh — LƯỚT NÉ!'); } } } }
  if(AID.press && now-AID.pressRadioAt>30){ AID.pressRadioAt=now; radio('SCH: Chúng đánh hơi thấy anh bị thương — cả đội hình đang dồn lên!'); }
}
// Z192 FIRING SOLUTION — time for a round of speed sp from the muzzle (mx,mz) to meet a target at (tx,tz) moving at (vx,vz): the smallest
//   positive root of |T + V·t − M| = sp·t (falls back to straight-line flight time when there is no solution), capped so a wild lead never happens
export function interceptT(mx, mz, tx, tz, vx, vz, sp){ const rx=tx-mx, rz=tz-mz, c=rx*rx+rz*rz, flat=Math.sqrt(c)/Math.max(1,sp), a=vx*vx+vz*vz-sp*sp, b=2*(rx*vx+rz*vz);
  let t=-1; if(Math.abs(a)<1e-6){ if(b<0) t=-c/b; } else { const D=b*b-4*a*c; if(D>=0){ const q=Math.sqrt(D), t1=(-b-q)/(2*a), t2=(-b+q)/(2*a); t=Math.min(t1,t2); if(t<=0) t=Math.max(t1,t2); } }
  return t>0 ? Math.min(t, 1.6) : Math.min(flat, 1.6); }
// Z192 LINE OF FIRE — walks the round's real path (flat, or the same lob spawnBullet gives it past 11 m) and returns the first rock / hedgehog /
//   fortress wall / objective that would stop an enemy round short of the target, or null when the line is open
const _lf=[];
export function fireBlocked(mx, mz, my, tx, tz, sp){ const dx=tx-mx, dz=tz-mz, D=Math.hypot(dx,dz); if(D<3) return null; const ux=dx/D, uz=dz/D, s0=Math.max(1,sp);
  let vy=0; if(D>11){ const T=Math.min(0.9, D/s0); vy=Math.min(30, ARC_G*T/2); } const y0=Math.max(0.6, my-heightAt(mx,mz)), arc=vy>0.5;
  for(let s=1.2; s<D-1.5; s+=1.5){ const t=s/s0, h=arc ? y0+vy*t-0.5*ARC_G*t*t : y0, x=mx+ux*s, z=mz+uz*s, low=h<FORT.wallH+0.4, air=arc && h>3.0;
    for(const bl of blocksNear(x, z, 0.5, _lf)){ if(!(bl.hard||bl.heavy||bl.fort||bl.supply||bl.kind==='obj') || bl.ours) continue; if(bl.fort ? !low : air) continue; if(inBlock(bl, x, z, 0.35)) return bl; } }
  return null; }
// where this tank wants to stand right now (or null → fall back to the old straight-at-target logic)
export const _aiD=new THREE.Vector3(); const _nb=[];
export function aiDest(e, keep, iq){
  const A=e.ai, p=S.player; if(!A) return null;
  if(A.role==='fall'){ if(A.eng && enemies.includes(A.eng)) return _aiD.set(A.eng.pos.x, 0, A.eng.pos.z);
    const dx=e.pos.x-p.pos.x, dz=e.pos.z-p.pos.z, L=Math.hypot(dx,dz)||1; return _aiD.set(e.pos.x+dx/L*12, 0, e.pos.z+dz/L*12); }
  const k = keep*(AID.press?TACTICS.press.keep:1)*(AID.punish&&A.role!=='anchor'?TACTICS.punish.keep:1)*(A.role==='flank'?0.75:A.role==='anchor'?1.1:1);
  _aiD.set(p.pos.x+Math.sin(A.ang)*k, 0, p.pos.z+Math.cos(A.ang)*k);
  if(iq>=TACTICS.coverFrom && A.role!=='flank'){ let best=null, bd=64;                   // park behind solid cover between the slot and your gun
    for(const b of blocksNear(_aiD.x, _aiD.z, 8, _nb)){ if(b.kind==='obj'||b.kind==='camp'||b.cache||b.r<1) continue; const q=(b.x-_aiD.x)**2+(b.z-_aiD.z)**2; if(q<bd){ bd=q; best=b; } }   // Z192 only the cells round the slot
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
  for(const b of blocksNear(e.pos.x, e.pos.z, look+6, _nb)){ const q=(b.x-e.pos.x)**2+(b.z-e.pos.z)**2; if(q<(look+6)**2) test(b.x, b.z, b.obb?b.obb.hl:b.r); }   // Z192 grid, not every rock on the map
  if(ax||az){ dir.x+=ax; dir.z+=az; const L=Math.hypot(dir.x,dir.z)||1; dir.x/=L; dir.z/=L; } }
// sidestep when the player's gun is lined up and firing (lighter hulls only)
export function aiDodge(e, now, iq){ const D=TACTICS.dodge, p=S.player; if(iq<D.from || e.def.heavy || now<(e.dodgeCdAt||0) || !S.firing&&!(MOBILE&&autoFire)) return;
  const b=Math.atan2(e.pos.x-p.pos.x, e.pos.z-p.pos.z), off=Math.abs(wrapAngle(b-p.aimSmoothed)); if(off>0.12) return;
  e.dodgeCdAt=now+D.cd*(1.4-iq*0.6); if(Math.random()>iq) return;
  const side=Math.random()<0.5?-1:1; e.kbx+=Math.cos(b)*side*D.speed; e.kbz+=-Math.sin(b)*side*D.speed; }
// Z185 SHELL EVASION — the crew watches your rounds: one that will pass within a hull's width in the next second → break sideways off its line
export function aiEvade(e, now, iq){ const V=TACTICS.evade; if(iq<V.from || now<(e.evadeCdAt||0) || e.def.halt || e.aimT>0) return;
  e._evN=((e._evN|0)+1)&3; if(e._evN) return;   // every 4th frame is plenty
  const R=e.r+0.9;
  for(const b of bullets){ if(b.owner!=='p') continue; const rx=e.pos.x-b.x, rz=e.pos.z-b.z, vv=b.vx*b.vx+b.vz*b.vz; if(vv<1) continue;
    const t=(rx*b.vx+rz*b.vz)/vv; if(t<0 || t>V.look) continue;
    const mx=rx-b.vx*t, mz=rz-b.vz*t; if(mx*mx+mz*mz > R*R) continue;
    e.evadeCdAt=now+V.cd[0]+Math.random()*(V.cd[1]-V.cd[0]);
    if(Math.random() > (V.react[0]+(V.react[1]-V.react[0])*iq)*(e.def.heavy?V.heavyMul:1)) return;   // (too slow this time)
    const vl=Math.sqrt(vv); let sx=-b.vz/vl, sz=b.vx/vl; if(mx*sx+mz*sz<0){ sx=-sx; sz=-sz; }   // break to the side the shell is already passing on
    const k=V.speed*(e.def.heavy?0.6:1); e.kbx+=sx*k; e.kbz+=sz*k;
    spawnPart(e.pos.x-sx*1.2, 0.5, e.pos.z-sz*1.2, -sx*3, 1.2, -sz*3, { color:0x9a8a6a, size:1.6, life:0.55, smoke:true, grav:-0.3, drag:2, op:0.42 });   // tracks throw dirt as it swerves
    return; } }
export const _eTo=new THREE.Vector3();
export function updateEnemies(dt, now){
  aiDirector(now); const _iq=aiIQ();   // Z95
  const p=S.player;
  const slow = now < S.enemySlowUntil ? 0.35 : 1;     // Time Warp spell
  const cmds = enemies.filter(x=>x.def.chief), cmdDown = S.cmdDown && now < S.cmdDown.until ? S.cmdDown : null; let spot=false;   // Z158 command tanks · a fallen commander · scouts marking you
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i], def=e.def;
    updateEnemyBar(e);                                  // keep the floating HP bar pinned + facing camera every frame
    if(p && !e.seen && !def.inf){ const q=(e.pos.x-p.pos.x)**2+(e.pos.z-p.pos.z)**2; if(q<62*62){ e.seen=true; announceEnemy(e.type); } }   // Z158 first sighting of each class: the radio names it
    if(e.abandoned){ abandonedTick(e, dt, now); continue; }   // Z116 crew gone: it just sits there, smoking, waiting to be taken
    // ON FIRE (flamethrower DoT) — burns down HP over time; the fire grows; the tank keeps fighting while ablaze
    if(e.burn){ const F=BALANCE.flame;
      if(now >= e.burn.until) e.burn=null;
      else { e.burn.lvl = Math.min(F.lvlMax, e.burn.lvl + F.grow*dt); const n=e.burn.lvl;   // fire creeps bigger over time
        if(Math.random() < 0.5+0.35*n) spawnPart(e.pos.x+(Math.random()-0.5)*1.3, 1.1+Math.random()*(0.6+n*0.5), e.pos.z+(Math.random()-0.5)*1.3, (Math.random()-0.5)*1.6, 1.7+Math.random()*1.8, (Math.random()-0.5)*1.6, {color:Math.random()<0.5?0xff6a1c:0xffc24a, size:0.5+n*0.22, life:0.4, grav:0.4, drag:2.6});
        if(Math.random()<0.3) spawnPart(e.pos.x,1.7,e.pos.z, (Math.random()-0.5)*1,1.8,(Math.random()-0.5)*1, {color:0x16110b, size:0.9+n*0.4, life:0.7, smoke:true, grav:-0.5, drag:1.5, op:0.4});
        e.hp -= F.dps * n * (e.burn.k||1) * dt * typeMul('FIRE', armorOf(e)) * ENVMOD.fire; if(e.hp<=0){ killEnemy(e); continue; }   // burned to death → drop it (mesh already pooled)
      }
    }
    // stunned (EMP / freeze power-up): hold still, no fire
    if(now < e.stunUntil){
      e.mesh.position.set(e.pos.x, e.def.inf?heightAt(e.pos.x,e.pos.z):(e.def.air?e.pos.y:0), e.pos.z);
      if(Math.random()<0.3) spawnPart(e.pos.x,2,e.pos.z, (Math.random()-0.5)*4,3,(Math.random()-0.5)*4,{color:0x6fd0ff,size:0.7,life:0.3,grav:-2});
      continue;
    }
    const edt = dt * slow * (def.inf||def.air ? 1 : supplySpeed());   // movement slow factor (Time Warp); doesn't affect shared dt · Z194 no fuel → the tanks crawl
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
    if(def.air){ updateHeli(e, dt, now, edt); continue; }                     // Z80 attack helicopter · Z222 bomber / transport
    // pick target: player if close, else the guards defending the Core, else the Core
    const dpl = e.pos.distanceTo(p.pos);
    if(e.type==='scout' && dpl<46) spot=true;   // Z158 a recon vehicle has eyes on you
    let targetPlayer = dpl < 34 || !core || (e.ai && dpl < TACTICS.engage);   // Z95 tanks in the director's plan stay on you
    let target = targetPlayer ? p.pos : core.pos;
    { const at=allyArmourNear(e.pos.x, e.pos.z, Math.min(30, dpl*0.7)); if(at){ target=at.pos; targetPlayer=false; } }   // Z104 a captured tank of ours closer than you draws their fire
    if(!targetPlayer && soldiers.length){                         // guards draw fire — engage the nearest soldier in the way
      let bs=null, bd=36*36; for(const s of soldiers){ const dx=s.pos.x-e.pos.x, dz=s.pos.z-e.pos.z, q=dx*dx+dz*dz; if(q<bd){ bd=q; bs=s; } }
      if(bs) target = bs.pos;
    }
    let keep=def.keep;
    e._idle=false; if(e.guardBase){ const gp=guardLeash(e, dt, p); if(gp){ target=gp; targetPlayer=false; e._idle=true; keep=1; } }   // Z194 a guard tank circles its base until you come close
    if(def.engineer){ e.patient=engineerPatient(e); if(e.patient){ target=e.patient.pos; keep=7; } }   // the engineer drives to whoever needs welding
    if(def.ifv && dpl>14 && FT.length){ let bs=null, bd=26*26; for(const s of FT){ const q=(s.pos.x-e.pos.x)**2+(s.pos.z-e.pos.z)**2; if(q<bd){ bd=q; bs=s; } } if(bs){ target=bs.pos; targetPlayer=false; } }   // Z158 the IFV's 30 mm goes after our infantry first
    const to = _eTo.subVectors(target, e.pos); const d=to.length()||1; to.divideScalar(d);
    // movement
    let desire;
    const _ex=e.exit ? fortExitDir(e) : null;                       // Z111b filing out of a fortress gate overrides everything
    if(_ex){ to.set(_ex.x, 0, _ex.z); desire = def.speed*0.8; }
    else if(now < (e.smokeUntil||0)){ desire = -def.speed*0.9; }      // Z158 smoke out → reverse out of the line of fire
    else if(now < (e.scootUntil||0)){ to.set(e.scootX,0,e.scootZ); desire = def.speed*1.35; }   // Z158 shoot-and-scoot
    else if(def.halt && targetPlayer && d < def.range*(e.r/1.5) && now > e.fireAt-0.8){ desire = 0; }   // Z158 tank destroyer halts to lay the gun
    else if(e.aimT>0){ desire = 0; }                                   // ATGM gunner holds still while painting the target
    else if(e.unloading){ desire = 0; }                                // Z89 APC halted, ramp down, troops piling out
    else if(targetPlayer && e.ai){ const dst=aiDest(e, keep, _iq);   // Z95 the director's plan: ring slot / flank / cover / fall back
      if(dst){ const mx=dst.x-e.pos.x, mz=dst.z-e.pos.z, ml=Math.hypot(mx,mz)||1; desire = ml>2 ? def.speed*objMod('enemySpeedMul')*(e.ai.role==='flank'?1.15:e.ai.role==='fall'?1.1:1) : 0;
        to.set(mx/ml, 0, mz/ml); aiSteer(e, to); aiDodge(e, now, _iq); } else desire=0; }
    else if(d > keep+1.5){ desire = def.speed*objMod('enemySpeedMul'); }   // Z83 fuel depot keeps them rolling fast
    else { desire = -def.speed*0.3; } // back off a touch / hold
    if(def.canShoot && !def.truck) aiEvade(e, now, _iq);   // Z185 dodge the shells you fire
    e.vel.x += (to.x*desire - e.vel.x)*Math.min(1,dt*4);
    e.vel.z += (to.z*desire - e.vel.z)*Math.min(1,dt*4);
    { const J=TACTICS.jink, jk = (def.chief||def.orbit) ? 0.95 : (_iq>=J.from && targetPlayer && !def.heavy && !def.halt && !e.aimT && d < def.range*(e.r/1.5)+8 ? J.amp*_iq : 0);   // Z107 commander circle-strafes · Z185 smart crews weave while they fight
      if(jk && d < keep+16){ if(e.ph2==null){ e.ph2=Math.random()*6.283; e.jw=6.283/(J.per[0]+Math.random()*(J.per[1]-J.per[0])); } const w=Math.sin(now*((def.chief||def.orbit)?1.4:e.jw)+e.ph2)*def.speed*jk, k=Math.min(1,dt*3); e.vel.x += -to.z*w*k; e.vel.z += to.x*w*k; } }
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
    if(e.taim==null) e.taim=e.aim; { const da=wrapAngle(e.aim-e.taim), mx=(def.trav||2.4)*dt; e.taim=wrapAngle(e.taim+Math.max(-mx,Math.min(mx,da))); }   // Z158 the turret traverses at its real rate
    e.turret.rotation.y = wrapAngle(e.taim - e.facing); const laid = Math.abs(wrapAngle(e.aim-e.taim)) < 0.14;
    if(e.mesh.userData.rig) e.mesh.userData.rig.elevT = def.canShoot ? aimElevation(d, def.bspeed) : 0;   // lay the gun for the shot's arc
    // fire — accuracy, rate, damage all scale up with stage (gentle for newcomers)
    // combat range scales with tank size (small tank → small range, large → large)
    const er = def.range * (e.r/1.5);
    if(e.volleyAt){ if(now<e.volleyAt){ if(Math.random()<0.55){ e.muzzle.getWorldPosition(_v); spawnPart(_v.x,_v.y,_v.z, 0,0,0, { color:0xff2a2a, size:1.1+Math.random()*0.6, life:0.09, grav:0, drag:1 }); } }   // Z185 volley telegraph: the muzzles glint red
      else { e.volleyAt=0; if(targetPlayer && d<er){ e.fireAt=Math.min(e.fireAt, now); e.forceShot=true; } } }
    if(def.canShoot && now>e.fireAt && d < er && fortWallCross(e.pos.x, e.pos.z, target.x, target.z)){ e.fireAt=now+0.5; }   // Z111b stone in the way: no direct shot through a fortress wall / shut gate
    else if(def.truck && now>e.fireAt && d < def.range){ e.fireAt=now+def.fireCd*(0.85+Math.random()*0.3); truckSalvo(e, target.x, target.z, now); }   // Z116 rocket truck: lobbed salvo (arcs over cover)
    else if(def.canShoot && now>e.fireAt && d < er && laid && !e._idle){
      const ds=diffScale(), A=BALANCE.aggro;
      // PROACTIVE-FIRE chance ramps with stage — early enemies hesitate, late ones fire relentlessly
      if(!e.forceShot && Math.random() > Math.min(1, A.fireChanceBase + ds*A.fireChanceRamp)){ e.fireAt = now + 0.35; }   // hold fire a beat
      else {
        e.muzzle.getWorldPosition(_v);
        const _blk = _iq>=TACTICS.los.from && fireBlocked(_v.x, _v.z, _v.y, target.x, target.z, def.bspeed);   // Z192 a rock / wall between the muzzle and you: don't waste the round on the stone
        if(_blk){ e.fireAt=now+TACTICS.los.wait; e.forceShot=false; S.losHeld=(S.losHeld|0)+1;
          if(!def.heavy && now>(e.scootUntil||0)+0.4){ const ux=Math.sin(e.aim), uz=Math.cos(e.aim), sd=((_blk.x-e.pos.x)*uz-(_blk.z-e.pos.z)*ux)>0?-1:1;   // … pull out sideways, away from the side the cover sits on, to open a line
            e.scootX=uz*sd; e.scootZ=-ux*sd; e.scootUntil=now+TACTICS.los.peek; } }
        else {
        let aimA = e.aim;
        if(targetPlayer && (_iq > 0.15 || def.chief)){ const t=interceptT(_v.x, _v.z, target.x, target.z, p.vel.x, p.vel.z, def.bspeed), k=def.chief?1:Math.min(1, TACTICS.leadMax*_iq);   // Z192 the true intercept (where you WILL be when the round arrives), not a fixed guess
          aimA = Math.atan2((target.x+p.vel.x*t*k)-_v.x, (target.z+p.vel.z*t*k)-_v.z); }   // Z95 smarter crews lead their shots
        const spread = A.spreadBase * (1 - ds*A.spreadDrop) * (def.accurate?A.accurateMul:1) / (1 + (S.loop||0)*A.loopAcc);   // ACCURACY tightens hard with stage + NG+ loop
        const nearCmd = cmds.some(c=>c!==e && (c.pos.x-e.pos.x)**2+(c.pos.z-e.pos.z)**2 < 900), lost = cmdDown && (cmdDown.x-e.pos.x)**2+(cmdDown.z-e.pos.z)**2 < 1300;
        const moving = Math.hypot(e.vel.x,e.vel.z) > 1.5, unit = (moving ? 1+(1-(def.stab??0.8))*1.6 : 1) * (S.spotted?0.78:1) * (nearCmd?0.85:1) * (lost?1.5:1);   // Z158 stabiliser · scout marks · command net · leaderless
        aimA += (Math.random()-0.5) * Math.max(0.02, spread*unit) * (ENVMOD.night?ENV.night.enemySpread:1) * smokeSpread(now);
        const rateMul = (A.rateBase - A.rateDrop*ds) * (nearCmd?0.85:1) * (lost?1.3:1) * supplyRate();   // Z194 short of ammunition → slower to reload
        const dmg = def.dmg * (0.65 + 0.35*ds) * loopDmgMul() * (e.elite?BALANCE.elite.dmgMul:1) * cMod('enemyDmgMul') * diffDmgMul();
        const col = def.accurate?0xff3a66 : (def.heavy?0xffb050 : 0xff7a4a), br = def.heavy?0.7 : (def.accurate?0.28:0.4);
        if(!(MODE.tankShell && def.fireCd >= 1.4 && MODE.tankShell(e, aimA, d, dmg, !!def.heavy))){   // Z309 against a soldier the main gun lays on a spot and bursts there (campaign/soldier-war.js)
        spawnBullet(_v.x, _v.z, aimA, {owner:'e', dmg, speed:def.bspeed, color:col, r:br, life:3.0, maxDist:er+2, arcDist:d, knock:def.heavy?2.2:1, y:Math.max(1.2,_v.y), from:e.pos});
        tankRecoil(e.mesh, aimA, def.heavy?0.95:(def.accurate?0.7:0.45), e.facing);
        enemyMuzzleFX(_v.x, _v.y, _v.z, aimA, !!def.heavy);   // Z192 flash + flame + smoke at the real muzzle (was a flat dot at a fixed height)
        sfx('enemyShoot', e.pos); }
        if(def.scoot){ const sd=Math.random()<0.5?1:-1; e.scootX=Math.cos(aimA)*sd; e.scootZ=-Math.sin(aimA)*sd; e.scootUntil=now+1.5; }   // Z158 fire, then relocate
        if(def.burst){ e.burstLeft--; if(e.burstLeft<=0){ e.fireAt=now+def.reload*rateMul; e.burstLeft=def.burst; } else e.fireAt=now+def.fireCd; }
        else e.fireAt=now+def.fireCd*rateMul*(AID.punish&&targetPlayer?TACTICS.punish.rate:1);   // Z185 you reload → they fire faster
        e.forceShot=false;
        }
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
  if(spot && !S.spotted && p){ floatText('BỊ TRINH SÁT ĐỊCH ĐÁNH DẤU', '#ff9a5a', p.pos, 16); radio('SCH: Xe trinh sát địch đang chỉ điểm vị trí ta — hạ nó để cắt đường ngắm!'); }   // Z158
  S.spotted=spot;
}

// Z158 the radio names a class the first time it shows up in a battle
export function announceEnemy(type){ const C=ENEMY_CLASS[type]; if(!C) return; if(!S.seenTypes) S.seenTypes={}; if(S.seenTypes[type]) return; S.seenTypes[type]=1;
  radio('TÌNH BÁO: '+C.vi+' ('+C.model+') — '+C.tip); }
// Z158 a badly hit tank throws a smoke screen and backs out of the line of fire
export function popSmoke(e, now){ e.smoked=true; e.smokeUntil=now+2.6; const f=e.facing||0;
  for(let i=0;i<(MOBILE?9:16);i++){ const a=f+(Math.random()-0.5)*2.2, r=2.5+Math.random()*3.5; spawnPart(e.pos.x+Math.sin(a)*r, 1.2+Math.random(), e.pos.z+Math.cos(a)*r, Math.sin(a)*1.5, 0.6, Math.cos(a)*1.5, { color:0xd8d8d0, size:3.2+Math.random()*1.5, life:5+Math.random()*1.5, smoke:true, grav:0.15, drag:1.2, grow:1.4, op:0.7 }); }
  for(const sx of [-1,1]) spawnPart(e.pos.x, 2.4, e.pos.z, Math.sin(f+sx*0.6)*14, 6, Math.cos(f+sx*0.6)*14, { color:0xffffff, size:0.4, life:0.4, grav:-14, drag:1 }); }
