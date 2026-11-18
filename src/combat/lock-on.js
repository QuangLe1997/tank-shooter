// combat/lock-on.js — MISSILE LOCK-ON — a hi-tech targeting reticle that snaps onto the locked target
import * as THREE from 'three';
import { ROSTER, LETHAL, SQUAD, INFANTRY, FORT, LOCKON } from '../../config.js';
import { ARC_G, ARENA, BVIS, DRONE, ENVMOD, FT, GLOW, HULL_HL, HULL_HW, MOBILE, S, UGRID, UNDER, _hot, addTrail, aoeDamage, armorOf, armourHit, ballisticInit, ballisticStep, ballisticTrailK, blocksNear, bloodSpurt, boss, bulletFalloff, bulletPool, bullets, burst, camera, core, damageAlly, damageBlock, damageBoss, damageCore, damageDrone, damageEnemy, damagePlayer, damageRider, damageSoldier, detonate, dirtGeyser, effectFeedback, enemies, envDmg, fenceShot, floatText, fortIntactCross, fortWallCross, groundHit, heightAt, hitAllyTank, impactFX, inBlock, lightning, nearMiss, orientShell, ricochet, riders, ringPulse, rocketExhaust, sabotDiscard, scene, sfx, shellStretch, shellTrail, shootGuard, siegeMul, soldiers, spawnPart, structMul, suppress, surfaceHit, sweepPoint, towers, tunnelBlast, typeMul, unitsNear, vaporWake, wrapAngle } from '../hub.js';

// ===== MISSILE LOCK-ON — a hi-tech targeting reticle that snaps onto the locked target =====
export const lockFX=[]; let _lockLabel=null;                                          // pooled reticles: {tgt, grp, bgrp, rgrp, hgrp, life, max, snap}
export function _lockMat(){ return new THREE.MeshBasicMaterial({color:0xff7a2e, transparent:true, opacity:0.92, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false}); }
for(let i=0;i<8;i++){
  const grp=new THREE.Group(), bgrp=new THREE.Group(), rgrp=new THREE.Group(), hgrp=new THREE.Group();
  const R=1.6, arm=0.62, th=0.11;
  for(let c=0;c<4;c++){ const sx=c&1?-1:1, sz=c<2?1:-1;                              // 4 corner brackets (L-shapes)
    const h=new THREE.Mesh(new THREE.BoxGeometry(arm,th,th), _lockMat()); h.position.set(sx*(R-arm/2),0,sz*R);
    const v=new THREE.Mesh(new THREE.BoxGeometry(th,th,arm), _lockMat()); v.position.set(sx*R,0,sz*(R-arm/2));
    bgrp.add(h,v); }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,0.035,8,44), _lockMat()); ring.rotation.x=Math.PI/2; rgrp.add(ring);
  const hex=new THREE.Mesh(new THREE.TorusGeometry(0.52,0.05,6,6), _lockMat());     hex.rotation.x=Math.PI/2; hgrp.add(hex);
  const dgrp=new THREE.Group(); for(let k=0;k<8;k++){ const d=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.06,0.09), _lockMat()); const a=k*Math.PI/4; d.position.set(Math.cos(a)*2.15,0,Math.sin(a)*2.15); d.rotation.y=-a+Math.PI/2; dgrp.add(d); }   // Z188 dashed outer ring
  grp.add(bgrp,rgrp,hgrp,dgrp); grp.visible=false; grp.renderOrder=6; scene.add(grp);
  if(!_lockLabel) _lockLabel=(()=>{ const c=document.createElement('canvas'); c.width=160; c.height=48; const x=c.getContext('2d'); x.fillStyle='rgba(30,8,0,0.7)'; x.beginPath(); x.roundRect(4,4,152,40,8); x.fill(); x.strokeStyle='#ff8a3a'; x.lineWidth=2.5; x.stroke();
    x.font='800 26px "Saira Condensed", Rajdhani, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillStyle='#ffd27a'; x.fillText('◆ KHOÁ', 80, 25); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  const lab=new THREE.Sprite(new THREE.SpriteMaterial({ map:_lockLabel, transparent:true, depthTest:false, depthWrite:false })); lab.scale.set(2.4,0.72,1); lab.position.set(0,2.4,0); grp.add(lab);
  lockFX.push({tgt:null, grp, bgrp, rgrp, hgrp, dgrp, lab, life:0, max:0.55, snap:0});
}
export function targetAlive(t){ if(t && t._twr) return t.gd.alive && !t.t.falling; return t===boss ? !!(boss&&boss.alive) : enemies.includes(t); }
// Z217 a guard up a watchtower as a missile target (one stable object per guard, kept at his real position)
function guardTarget(t, gd){ const o=gd._mt||(gd._mt={ _twr:true, t, gd, pos:{ x:0, y:0, z:0 }, def:{ guard:true, inf:true }, r:0.7 }); o.pos.x=gd.wx; o.pos.y=(gd.wy||6)+0.9; o.pos.z=gd.wz; return o; }   // dead targets splice out of enemies[]
// Z214 a smart missile goes for the helicopter first
// Z221 the seeker only looks AHEAD of the missile (a cone round its flight line) and never takes a mark danger-close to our own tank or our
//   men — no more missiles whipping round onto your own position or diving into your squad's fight
function seekOK(b, x, z, inf){ const dx=x-b.x, dz=z-b.z; if(dx*dx+dz*dz>4 && Math.abs(wrapAngle(Math.atan2(dx,dz)-b.angle))>LOCKON.cone) return false;
  const p=S.player; if(p && (x-p.pos.x)**2+(z-p.pos.z)**2 < LOCKON.minP*LOCKON.minP) return false;
  if(inf) for(const a of FT){ if((a.pos.x-x)**2+(a.pos.z-z)**2 < LOCKON.allyR*LOCKON.allyR) return false; }
  return true; }
function dangerClose(t){ const x=t.pos.x, z=t.pos.z, p=S.player; if(p && (x-p.pos.x)**2+(z-p.pos.z)**2 < LOCKON.minP*LOCKON.minP) return true;
  if(t.def && t.def.inf) for(const a of FT){ if((a.pos.x-x)**2+(a.pos.z-z)**2 < LOCKON.allyR*LOCKON.allyR) return true; } return false; }
export function acquireLock(b){ let best=null, bd=1e9;                                     // nearest live enemy/boss to the missile itself
  if(b.smart){ for(const e of enemies){ const w=e.def.air?0.35:e.def.inf?4:1, d=((e.pos.x-b.x)**2+(e.pos.z-b.z)**2)*w; if(d<bd && seekOK(b, e.pos.x, e.pos.z, e.def.inf)){ bd=d; best=e; } }   // Z217 heat-seeking: aircraft › armour › guards › foot soldiers — never bricks or stone
    for(const t of towers){ if(t.falling) continue; for(const gd of t.guards){ if(!gd.alive || gd.wx==null) continue; const d=((gd.wx-b.x)**2+(gd.wz-b.z)**2)*1.6; if(d<bd && seekOK(b, gd.wx, gd.wz, false)){ bd=d; best=guardTarget(t, gd); } } }
    if(boss&&boss.alive){ const d=(boss.pos.x-b.x)**2+(boss.pos.z-b.z)**2; if(d<bd && seekOK(b, boss.pos.x, boss.pos.z, false)){ bd=d; best=boss; } } return best; }
  for(const e of enemies){ const d=((e.pos.x-b.x)**2+(e.pos.z-b.z)**2)*(e.def.inf?9:(e.def.air && b.smart)?0.35:1); if(d<bd && seekOK(b, e.pos.x, e.pos.z, e.def.inf)){bd=d;best=e;} }   // missiles prefer vehicles over foot soldiers
  if(boss&&boss.alive){ const d=(boss.pos.x-b.x)**2+(boss.pos.z-b.z)**2; if(d<bd && seekOK(b, boss.pos.x, boss.pos.z, false)){bd=d;best=boss;} }
  return best; }
export function requestLock(t){
  for(const L of lockFX){ if(L.tgt===t && L.life>0){ L.life=L.max; return; } }      // already locked → keep alive while a missile chases it
  const L=lockFX.find(L=>L.life<=0); if(!L) return;                                 // grab a free reticle (skip if all 8 busy)
  L.tgt=t; L.life=L.max; L.snap=0; L.bgrp.scale.setScalar(2.5); L.grp.visible=true; seatLock(L);
  ringPulse(t.pos, 0xff7a3a, 1.7); sfx('beep'); }                                    // acquisition: scan-ring pulse + tech blip
// Z215 the reticle sits ON the surface it marks: flat on the terrain under a ground target, tilted with the slope; standing upright at the
//   aircraft's height, turned to face you, round a helicopter. The KHOÁ label always floats straight above.
const _UP=new THREE.Vector3(0,1,0), _ln=new THREE.Vector3(), _lq=new THREE.Quaternion(), _lqi=new THREE.Quaternion();
export function groundNormal(x, z, out){ const e=1.2, hx=heightAt(x+e,z)-heightAt(x-e,z), hz=heightAt(x,z+e)-heightAt(x,z-e); return out.set(-hx/(2*e), 1, -hz/(2*e)).normalize(); }
function seatLock(L){ const t=L.tgt, air=t.def && (t.def.air||t.def.guard);
  if(air){ L.grp.position.set(t.pos.x, t.pos.y||(heightAt(t.pos.x,t.pos.z)+8), t.pos.z); _ln.copy(camera.position).sub(L.grp.position).normalize(); }
  else { L.grp.position.set(t.pos.x, heightAt(t.pos.x,t.pos.z)+0.25, t.pos.z); groundNormal(t.pos.x, t.pos.z, _ln); }
  _lq.setFromUnitVectors(_UP, _ln); L.grp.quaternion.slerp(_lq, L.snap<0.05 ? 1 : 0.35);
  if(L.lab){ _lqi.copy(L.grp.quaternion).invert(); L.lab.position.set(0, air?2.6:2.4, 0).applyQuaternion(_lqi); } }
export function updateLocks(dt){
  for(const L of lockFX){ if(L.life<=0) continue;
    if(!targetAlive(L.tgt)) L.life-=dt*2.4;                                          // target gone → fade fast
    else { L.life-=dt; seatLock(L); }                                                 // else track it · Z215 laid on the surface it marks
    if(L.life<=0){ L.grp.visible=false; L.tgt=null; continue; }
    L.snap=Math.min(1, L.snap+dt*7); L.bgrp.scale.setScalar(1 + (1-L.snap)*1.5);     // brackets fly inward & snap shut on acquire
    L.bgrp.rotation.y += dt*0.8; L.rgrp.rotation.y -= dt*1.7; L.hgrp.rotation.y += dt*3.0; if(L.dgrp){ L.dgrp.rotation.y += dt*1.2; L.dgrp.scale.setScalar(1+(1-L.snap)*0.6); }   // counter-spinning tech layers
    if(L.lab){ L.lab.visible = L.snap>0.9; L.lab.scale.set(2.4*(1+(1-L.snap)), 0.72*(1+(1-L.snap)), 1); }   // Z188 "KHOÁ" pops once the brackets snap
    const op=Math.min(1, L.life/L.max*1.4)*0.92; L.grp.traverse(o=>{ if(o.material) o.material.opacity=op; });
    L.rgrp.scale.setScalar(1 + Math.sin((L.max-L.life)*22)*0.05); }                  // subtle ring pulse
}
// Z113 rocket rounds (our soldiers' AT launchers) fly as a real rocket — body, fins, exhaust glow — riding on the pooled bullet
const _rk=[]; let _rkMat=null;
function allyRocket(){ if(!_rkMat) _rkMat={ body:new THREE.MeshStandardMaterial({color:0x5a6438,roughness:0.55,metalness:0.4}), war:new THREE.MeshStandardMaterial({color:0x2a2a24,roughness:0.5,metalness:0.6}), glow:new THREE.SpriteMaterial({map:GLOW,color:0xffb060,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}) };
  const g=new THREE.Group(); const b=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.7,10), _rkMat.body); b.rotation.x=Math.PI/2; g.add(b);
  const n=new THREE.Mesh(new THREE.ConeGeometry(0.13,0.36,10), _rkMat.war); n.rotation.x=Math.PI/2; n.position.z=0.52; g.add(n);
  for(let k=0;k<4;k++){ const f=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.22,0.16), _rkMat.war); f.position.z=-0.3; f.rotation.z=k*Math.PI/2; f.position.x=Math.sin(k*Math.PI/2)*0.08; f.position.y=Math.cos(k*Math.PI/2)*0.08; g.add(f); }
  const s=new THREE.Sprite(_rkMat.glow); s.scale.setScalar(0.9); s.position.z=-0.45; g.add(s); g.userData.glow=s; return g; }
// Z214 SMART MINI-MISSILE — the lock-on gun's round: a slim white body, glass seeker dome with a red eye, canards, cruciform tail fins and a
//   white-hot motor; it rolls as it flies. Ejected from its cell, the motor lights a beat later (flash + whoosh) and it streaks off, hunting its lock.
const _sm=[]; let _smMat=null;
function smartMissile(){ if(!_smMat) _smMat={ body:new THREE.MeshStandardMaterial({color:0xdcdcd4,roughness:0.35,metalness:0.55}), band:new THREE.MeshStandardMaterial({color:0xc8301c,roughness:0.4,metalness:0.4,emissive:0x5a0800,emissiveIntensity:0.4}),
    dark:new THREE.MeshStandardMaterial({color:0x22262a,roughness:0.45,metalness:0.7}), seeker:new THREE.MeshStandardMaterial({color:0x0c1820,roughness:0.05,metalness:1,envMapIntensity:2}),
    eye:new THREE.MeshBasicMaterial({color:0xff3a20}), glow:new THREE.SpriteMaterial({map:GLOW,color:0xffe0b0,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}),
    core:new THREE.SpriteMaterial({map:GLOW,color:0xbfe4ff,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}) };
  const M=_smMat, g=new THREE.Group(), cyl=(r0,r1,h,z,m)=>{ const c=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,12),m); c.rotation.x=Math.PI/2; c.position.z=z; g.add(c); return c; };
  cyl(0.075,0.075,0.78,0,M.body); cyl(0.077,0.077,0.07,0.2,M.band); cyl(0.07,0.06,0.08,-0.42,M.dark);                                 // body · warhead band · nozzle
  const nose=new THREE.Mesh(new THREE.SphereGeometry(0.075,12,8,0,Math.PI*2,0,Math.PI/2),M.seeker); nose.rotation.x=Math.PI/2; nose.position.z=0.39; g.add(nose);   // glass seeker dome
  const eye=new THREE.Mesh(new THREE.SphereGeometry(0.022,8,6),M.eye); eye.position.z=0.44; g.add(eye);
  for(let k=0;k<4;k++){ const a=k*Math.PI/2+Math.PI/4, c=Math.cos(a), sn=Math.sin(a);
    const can=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.07,0.08),M.dark); can.position.set(c*0.09,sn*0.09,0.26); can.rotation.z=a+Math.PI/2; g.add(can);       // canards
    const fin=new THREE.Mesh(new THREE.BoxGeometry(0.014,0.15,0.16),M.dark); fin.position.set(c*0.13,sn*0.13,-0.32); fin.rotation.z=a+Math.PI/2; g.add(fin); }   // tail fins
  const s=new THREE.Sprite(M.glow); s.scale.setScalar(1.1); s.position.z=-0.55; g.add(s); const c2=new THREE.Sprite(M.core); c2.scale.setScalar(0.45); c2.position.z=-0.5; g.add(c2);
  g.userData.glow=s; g.userData.core=c2; g.userData.smart=true; return g; }
// the motor lights: a white flash behind it, a puff, the whoosh
function smartIgnite(b){ const sp=Math.hypot(b.vx,b.vz)||1, ux=b.vx/sp, uz=b.vz/sp, y=b.by+heightAt(b.x,b.z);
  spawnPart(b.x-ux*0.6, y, b.z-uz*0.6, -ux*3, 0, -uz*3, { tex:'flash', color:0xffffff, size:1.6, life:0.06, grav:0, drag:8 });
  spawnPart(b.x-ux*0.8, y, b.z-uz*0.8, -ux*4, 0.3, -uz*4, { tex:'fire', color:0xfff4d0, color2:0xff7a20, size:0.8, grow:1.2, life:0.12, grav:0, drag:6 });
  for(let k=0;k<3;k++) spawnPart(b.x-ux*(0.8+k*0.4), y, b.z-uz*(0.8+k*0.4), (Math.random()-0.5)*1.5, 0.4, (Math.random()-0.5)*1.5, { color:0xe8e6e0, size:0.6, life:0.9, smoke:true, grav:0.2, drag:2, grow:1.6, op:0.45, keep:true });
  sfx('whoosh', { x:b.x, z:b.z }); }
// a hit on an aircraft goes off IN THE AIR at its height: flash, fireball, burning fragments, a puff of black smoke — no crater on the ground
function airDetonate(b, t){ const y=(t.pos.y||b.by+heightAt(b.x,b.z)), now=performance.now()/1000;
  spawnPart(b.x, y, b.z, 0, 0, 0, { tex:'flash', color:0xffffff, size:5.5, life:0.08, grav:0, drag:8 });
  for(let k=0;k<5;k++){ const a=Math.random()*6.283; spawnPart(b.x, y, b.z, Math.cos(a)*3, (Math.random()-0.3)*3, Math.sin(a)*3, { tex:'fire', color:0xfff0c0, color2:0xff4a10, size:1.6+Math.random(), grow:1.5, life:0.35+Math.random()*0.2, grav:0.5, drag:3 }); }
  for(let k=0;k<(MOBILE?8:16);k++){ const a=Math.random()*6.283, v=8+Math.random()*12; spawnPart(b.x, y, b.z, Math.cos(a)*v, (Math.random()-0.2)*9, Math.sin(a)*v, { color:0xffd890, color2:0xff5a10, size:0.16, life:0.6+Math.random()*0.5, grav:-14, drag:0.8 }); }
  spawnPart(b.x, y, b.z, 0, 0.6, 0, { color:0x22201c, size:3.2, life:2.2, smoke:true, grav:0.3, drag:1.2, grow:1.8, op:0.6, keep:true });
  if(!t._twr) damageEnemy(t, b.dmg*0.9); aoeDamage(b.x, b.z, b.aoe, b.aoeDmg||b.dmg, false, now, b.type, true, siegeMul()); sfx('explode', { x:b.x, z:b.z }, 0.8); S.shake=Math.min(3, S.shake+0.35); }
const _ca=new THREE.Vector3(), _cb=new THREE.Vector3();   // Z149 chain-lightning ends
// Z232 ĐẠN NỔ MẠNH (HE ammo box) loaded: a gun that already bursts bursts 40% wider; one that doesn't now bursts on impact too (small blast, a share of the hit)
export const HE_AMMO = { R:1.4, share:0.35 };
function heAoe(o){ const he=o.owner==='p' && S.player && S.player.ammoSplash && !o.inf; if(o.aoe) return o.aoe*(he?1+S.player.ammoSplash:1); return he && !o.lockOn && !o.rocket ? HE_AMMO.R : 0; }
export function spawnBullet(x, z, angle, o={}){
  const m = bulletPool.pop(); if(!m) return;
  if(o.rocket){ const rk=o.smart ? (_sm.pop()||smartMissile()) : (_rk.pop()||allyRocket()); m.add(rk); m.userData.rk=rk; m.userData.core.visible=false; m.userData.halo.visible=false; m.rotation.set(0,angle,0); }   // Z113
  const r = o.r||0.45;
  m.visible=true; m.scale.setScalar((o.scale || (0.78 + r*1.1)) * BVIS);   // heavier rounds render fatter (per-gun size)
  if(m.userData.rk) m.userData.rk.scale.setScalar(1.15/m.scale.x);           // the rocket keeps its real size
  else m.userData.core.scale.set(0.38, 0.38, shellStretch(o.speed));          // Z192 the hot core is a streak along the flight, longer the faster the round
  const col = o.color ?? 0xffe08a;
  const tracer = (o.owner==='e') ? 0xff5a24 : col;                          // enemy fire reads as danger-red; player = the gun's colour
  m.userData.core.material.color.setHex(_hot(tracer));                      // bright white-hot core
  m.userData.halo.material.color.setHex(tracer);                           // glowing aura matches the tracer
  const y0 = o.y!=null ? Math.max(0.6, o.y - heightAt(x,z)) : 1.2;          // launch height ABOVE THE GROUND at the real muzzle
  if(o.from && y0 < FORT.wallH+0.4 && fortWallCross(o.from.x, o.from.z, x, z)){ x=o.from.x; z=o.from.z; }   // Z111b barrel poking through/over a fortress wall: the round leaves from the hull side → the stone takes it
  m.position.set(x, y0, z);
  const sp = o.speed||60;
  const D=o.arcDist||0; let vy=0; if(!o.lockOn && !o.noArc && D>11){ const T=Math.min(0.9, D/sp); vy=Math.min(30, ARC_G*T/2); }   // lob: more arc the farther/slower; flat up close (lock-on missiles arc themselves)
  const loft = o.smart ? (D<14 ? 0.8+Math.random()*0.8 : 2.2+Math.random()*1.6) : o.lockOn ? (D<14 ? 1.0+Math.random()*1.4 : 2.6+Math.random()*3.0) : 0;   // Z214 smart missiles fly flatter and faster, diving onto armour from above   // random arc: low/shallow when the target's close, lofts higher when far (kept snappy — short air time)
  const sp0 = o.smart ? sp*0.3 : sp;   // Z214 a smart missile is ejected slowly, then its motor lights
  const B0={ mesh:m, x, z, ox:x, oz:z, vx:Math.sin(angle)*sp0, vz:Math.cos(angle)*sp0, smart:!!o.smart, ign:o.smart?0.13:0, vmax:sp*1.45,
    owner:o.owner||'p', dmg:o.dmg||20, r:o.r||0.45, life:o.life||2.2, pierce:o.pierce||0,
    homing:o.homing||0, angle, aoe:heAoe(o), aoeDmg:o.aoeDmg||(o.aoe?0:heAoe(o)?(o.dmg||20)*HE_AMMO.share:0), maxDist:o.maxDist||0, color:col,
    lockOn:o.lockOn||false, tgt:null, loft, _py:null, _tx:null,
    by:y0, vy, arc:(vy>0.5), vyl:(o.dropTo!=null && (o.dropDist||D)>0.5 ? (o.dropTo-y0)/((o.dropDist||D)/sp) : 0), ignore:o.ignore||null, type:o.type||null, reach:o.reach||0, fall:o.fall??1, freeze:o.freeze||0, chain:o.chain||0, chainR:o.chainR||0, knock:o.knock||1, fx:o.fx||'spark', inf:!!o.inf, tk:o.trailK||1 };
  bullets.push(B0);
  { const v=ballisticInit(B0, o, sp); if(B0.bk){ B0.vx=Math.sin(angle)*v; B0.vz=Math.cos(angle)*v; if(!m.userData.rk) m.userData.core.scale.z=shellStretch(v); }   // Z228b the round's velocity curve (fast out of the muzzle / booster kick)
    if(B0.bk==='g' && !o.inf && (o.type==='AP' || (o.owner==='e' && !o.aoe && (o.dmg||0)>=20))) sabotDiscard(x, heightAt(x,z)+y0, z, angle, v); }   // APFSDS: the sabot petals peel away   // inf = small-arms round (rifle/MG) — anything else is a tank-gun round
}
// Z112 what a hit on stone / timber / steel looks like, by the round: heavy explosive → chunks + a dust cloud, armour-piercing → a hard spray of chips, small arms → sparks and grit
const _STONE=new Set(['building','fortwall','gate','boulder','brick','tower','concrete','hesco','camp','pipes','jersey','teeth']);
export function blockImpactFX(bl, b){ const gy=heightAt(b.x,b.z), y=gy+Math.max(0.6, Math.min(4, b.by)), heavy=b.aoe>0 || b.dmg>=40, stone=_STONE.has(bl.kind), col=stone?0xa89a84:(bl.steel||bl.kind==='hedgehog'?0xffe0a0:0x9a7a52);
  const bx=Math.hypot(b.vx,b.vz)||1, ux=-b.vx/bx, uz=-b.vz/bx;   // debris kicks back toward the shooter
  if(heavy){ for(let k=0;k<8;k++) spawnPart(b.x, y, b.z, ux*(3+Math.random()*5)+(Math.random()-0.5)*5, 2+Math.random()*5, uz*(3+Math.random()*5)+(Math.random()-0.5)*5, {color:col, size:0.22+Math.random()*0.25, life:0.7, grav:-18, drag:1});
    spawnPart(b.x, y, b.z, ux*1.2, 1.2, uz*1.2, {color:stone?0xb8a888:0x6a5a44, size:2.2+b.dmg*0.02, life:1.3, smoke:true, grav:-0.3, drag:1.6, grow:1.6, op:0.5}); }
  else if(b.inf || b.dmg<20){ for(let k=0;k<3;k++) spawnPart(b.x, y, b.z, ux*4+(Math.random()-0.5)*4, 1+Math.random()*3, uz*4+(Math.random()-0.5)*4, {color:stone?0xd8c8a8:0xffe6a0, size:0.12, life:0.25, grav:-14, drag:2}); }
  else { for(let k=0;k<5;k++) spawnPart(b.x, y, b.z, ux*(4+Math.random()*4)+(Math.random()-0.5)*3, 1+Math.random()*4, uz*(4+Math.random()*4)+(Math.random()-0.5)*3, {color:col, size:0.18, life:0.5, grav:-16, drag:1.2});
    spawnPart(b.x, y, b.z, ux, 0.8, uz, {color:stone?0xb8a888:0x7a6a54, size:1.2, life:0.8, smoke:true, grav:-0.3, drag:2, op:0.4}); } }
// does a round at (x,z) with radius r strike tank t? — tests the REAL hull footprint (oriented box), not a small circle
export function hitsHull(t, x, z, r){ const s=t.mesh?t.mesh.scale.x:1, f=t.facing||0, sf=Math.sin(f), cf=Math.cos(f), dx=x-t.pos.x, dz=z-t.pos.z;
  const lx=dx*cf-dz*sf, lz=dx*sf+dz*cf; return Math.abs(lx) < HULL_HW*s+r && Math.abs(lz) < HULL_HL*s+r; }
export function recycleBullet(i){ const b=bullets[i], m=b.mesh; m.visible=false; if(m.userData.rk){ m.remove(m.userData.rk); (m.userData.rk.userData.smart?_sm:_rk).push(m.userData.rk); m.userData.rk=null; m.userData.core.visible=true; m.userData.halo.visible=true; m.rotation.set(0,0,0); } bulletPool.push(m); bullets.splice(i,1); }
const _bcI=[], _bcT=[], _bcA=[], _bnb=[];
const _sw={ x:0, z:0 };   // Z228b swept-hit scratch
function bulletCands(b){ const st=b._st||0; unitsNear(UGRID.inf, b.x, b.z, b.r+2.5+st, _bcI); unitsNear(UGRID.tank, b.x, b.z, b.r+16+st, _bcT); _bcA.length=0; for(const e of _bcI) _bcA.push(e); for(const e of _bcT) _bcA.push(e); return _bcA; }   // Z172 only the units near the round
export function updateBullets(dt, now){
  const lim = UNDER.on ? 1e4 : ARENA-1;   // Z226 the underground base lies beyond the arena
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    if(b.lockOn && b.owner==='p'){ // MISSILE: lock ONE target, chase that object, loft-then-dive arc
      if(b.smart){ const sp=Math.hypot(b.vx,b.vz)||1; if(b.ign>0){ b.ign-=dt; if(b.ign<=0) smartIgnite(b); } else { const ns=Math.min(b.vmax, sp+b.vmax*3.4*dt); b.vx*=ns/sp; b.vz*=ns/sp; }   // Z214 eject → ignite → streak
        const rk=b.mesh.userData.rk; if(rk){ rk.rotation.z+=dt*16; if(rk.userData.glow) rk.userData.glow.visible = b.ign<=0; if(rk.userData.core) rk.userData.core.visible = b.ign<=0; } }
      if(!b.tgt || !targetAlive(b.tgt) || dangerClose(b.tgt)) b.tgt = (b.flared && now<b.flared) ? null : acquireLock(b);   // Z221 a mark that closes on our tank / our men is dropped            // sticky lock — re-acquire only if it dies · Z198 decoyed by flares: it flies on blind for a moment
      const t=b.tgt; if(t && t._twr) guardTarget(t.t, t.gd);
      if(t){ requestLock(t);                                              // hi-tech reticle snaps onto the locked target
        const want=Math.atan2(t.pos.x-b.x,t.pos.z-b.z); let da=wrapAngle(want-b.angle);
        b.angle=wrapAngle(b.angle+da*Math.min(1,dt*(b.smart ? (b.ign>0?0:15) : (b.homing||5)))); const sp=Math.hypot(b.vx,b.vz);
        b.vx=Math.sin(b.angle)*sp; b.vz=Math.cos(b.angle)*sp;
        const dist=Math.hypot(t.pos.x-b.x,t.pos.z-b.z), ty=(t.pos.y||1.2);
        if(dist < b.r+(t.r||1)+0.7){ if(t.def && t.def.aps && now>(t.apsCd||0) && Math.random()<t.def.aps){ t.apsCd=now+1.0; apsKill(b, t); recycleBullet(i); continue; } if(t._twr){ airDetonate(b, t); shootGuard(t.t, t.gd, b.x, b.z); } else if(t.def && t.def.air) airDetonate(b, t); else detonate(b); recycleBullet(i); continue; }   // Z158 APS can kill a guided missile on its final dive · Z214 an aircraft is hit in the air     // PROXIMITY FUSE: reached the locked target → detonate now (clean hit at any speed, no tunnelling/orbiting)
        const desiredY=(t.def && (t.def.air||t.def.guard)) ? ty : ty + b.loft*Math.min(1, dist/9);   // Z214 climbs straight to an aircraft's height                   // vault while far, dive to strike height as it closes (descends sooner → less loiter)
        b.by += (desiredY-b.by)*Math.min(1, dt*4.2); } }                  // snappy climb/dive — short air time, no orbiting
    else if(b.homing && b.owner==='p'){ // (legacy) plain homing toward the nearest enemy
      let best=null, bd=1e9; for(const e of enemies){ const d=(e.pos.x-b.x)**2+(e.pos.z-b.z)**2; if(d<bd){bd=d;best=e;} }
      if(boss&&boss.alive){ const d=(boss.pos.x-b.x)**2+(boss.pos.z-b.z)**2; if(d<bd){bd=d;best=boss;} }
      if(best){ const want=Math.atan2(best.pos.x-b.x,best.pos.z-b.z); let da=wrapAngle(want-b.angle);
        b.angle=wrapAngle(b.angle+da*Math.min(1,dt*b.homing)); const sp=Math.hypot(b.vx,b.vz);
        b.vx=Math.sin(b.angle)*sp; b.vz=Math.cos(b.angle)*sp; } }
    b._hx=b.x; b._hz=b.z; ballisticStep(b, dt);   // Z228b drag / motor along the round's velocity curve · Z232 _hx/_hz = where this frame's path starts (NOT _sx/_sz: fx/hitfx.js shellTrail owns those)
    b.x+=b.vx*dt; b.z+=b.vz*dt; b.life-=dt; b._st=Math.hypot(b.x-b._hx, b.z-b._hz);
    let landed=false;
    if(b.arc){ b.by+=b.vy*dt; b.vy-=ARC_G*dt; if(b.by<=0.3 && b.vy<0){ b.by=0.3; landed=true; } }   // ballistic shell: up, over, and DOWN into the ground
    if(b.vyl) b.by=Math.max(0.3, b.by+b.vyl*dt);                                                      // plunging fire (tower guards shooting down)
    const _gy=heightAt(b.x,b.z);
    const _wy=b.by+_gy; b.mesh.position.set(b.x,_wy,b.z); orientShell(b, _wy, dt);   // Z192 nose along the real flight path
    { const tc=(b.owner==='e' && b.tk<=1)?0xff5a24:b.color, ts=(b.r||0.45)*BVIS*1.7*b.tk*ballisticTrailK(b), tl=(0.16+(b.r||0.45)*0.24)*(1+(b.tk-1)*0.6); addTrail(b.x, _wy, b.z, tc, ts, tl);   // per-gun glowing tracer (enemy = danger-red); heavier rounds leave a fatter, longer streak   · Z222 trailK draws a gun's tracer fatter / longer · Z223 an enemy tracer keeps its own green
      if(b._lx!=null){ const gx=b.x-b._lx, gy=_wy-b._ly, gz=b.z-b._lz, n=Math.min(MOBILE?3:6, Math.floor(Math.hypot(gx,gz)/(ts*0.7))); for(let k=1;k<=n;k++){ const f=k/(n+1); addTrail(b._lx+gx*f, b._ly+gy*f, b._lz+gz*f, tc, ts, tl*(0.75+0.25*f)); } }
      b._lx=b.x; b._ly=_wy; b._lz=b.z; vaporWake(b, b.x, _wy, b.z); }   // Z192 the gap a fast round jumps each frame is filled in: one unbroken streak, not a string of beads
    if(b.mesh.userData.rk || b.lockOn) rocketExhaust(b, b.x, _wy, b.z); else shellTrail(b, b.x, _wy, b.z);   // Z210 every other round: its own light smoke line
    if(b.owner==='e') nearMiss(b, S.player);   // Z192 motor flame + a long, lingering smoke ribbon (was a short puff, and the missile's sat at ground level)
    const airborne = (b.lockOn && (b.smart || b.by>2.6)) || (b.arc && b.by>3.0);   // Z217 a smart missile never strikes bricks / stone / cover — it flies over them to its target   // lofted missiles / high shells sail over cover & bystanders — they strike on the way down

    const overRange = !b.arc && b.maxDist && ((b.x-b.ox)**2+(b.z-b.oz)**2 > b.maxDist*b.maxDist);   // shells in flight always come down somewhere
    if(b.life<=0 || overRange || Math.abs(b.x)>lim || Math.abs(b.z)>lim){ if(b.owner==='p'&&b.aoe) detonate(b); else if(Math.abs(b.x)<lim && Math.abs(b.z)<lim){ groundHit(b.x, b.z, b.r||0.45); if(!b.inf && b.dmg>=30) dirtGeyser(b.x, b.z, Math.min(1.6, 0.7+b.dmg/120)); if(b.owner==='p' && b.dmg>=20) tunnelBlast(b.x, b.z, 1.2, b.dmg); } recycleBullet(i); continue; }
    if(b.owner!=='e' && !b.smart){ const px=b.x-b.vx*dt, pz=b.z-b.vz*dt, wb=fortIntactCross(px, pz, b.x, b.z);   // Z170 a sealed fortress: the round strikes the wall, however high it flies
      if(wb && wb!==b.ignore){ damageBlock(wb, b.dmg*structMul(b.type, wb)*(b.owner==='p'?siegeMul():1)); surfaceHit(wb, b); blockImpactFX(wb, b); b.x=px; b.z=pz; if(b.owner==='p'&&b.aoe) detonate(b); recycleBullet(i); continue; } }
    // terrain blocks are cover — bullets break bricks / bounce off steel, then stop
    // Z204 any round that strikes something solid goes off against it (flash, fireball for a shell, chips, dust) and leaves its mark — breakable or not
    if(b.owner==='p' && !b.smart) fenceShot(b);   // Z205 the compound wire takes rounds too
    let blocked=false;   // Z192 (only the obstacles in this round's grid cells are tested) · Z193 enemy shells wear solid cover down at 40%
    const low = b.by < FORT.wallH+0.4;                                // Z111b below the parapet → a fortress wall stops it, even a lobbed shell
    if((!airborne || low) && !b.smart) for(const bl of blocksNear(b.x, b.z, b.r, _bnb)){ if(bl===b.ignore || (bl.ours && b.owner==='p')) continue; if(bl.fort ? !low : airborne) continue; if(inBlock(bl, b.x, b.z, b.r)){
      if((bl.kind==='obj' || bl.supply) && b.owner==='e'){ blocked=true; break; }   // Z194 nor their own supply bases   // enemy fire never hurts their own objective
      if(((bl.fort || bl.hard) && b.owner==='e') || ((bl.hard || bl.heavy) && b.inf)){   // Z193 rifle rounds only chip concrete / steel   // Z121 nor do rifle rounds (ours or theirs)
        surfaceHit(bl, b); blockImpactFX(bl, b); blocked=true; break; }   // Z112 enemy fire doesn't break rocks / hedgehogs either   // Z111b their own walls soak their fire — no damage to the stone
      damageBlock(bl, b.dmg*structMul(b.type, bl)*(b.owner==='p'?siegeMul():(bl.heavy?0.4:1))); surfaceHit(bl, b); blockImpactFX(bl, b); blocked=true; break; } }
    if(blocked){ if(b.owner==='p'&&b.aoe) detonate(b); recycleBullet(i); continue; }
    let hit=false;
    if(b.owner==='p' && !airborne){       // lofted missiles can't hit while high — they strike on the dive
      for(const e of bulletCands(b)){ sweepPoint(b._hx, b._hz, b.x, b.z, e.pos.x, e.pos.z, _sw); const dx=e.pos.x-_sw.x, dz=e.pos.z-_sw.z; if(e.def.inf && dx*dx+dz*dz<9) suppress(e, dt*(1.1+b.dmg*0.03));   // Z173 a near miss pins him
        if(dx*dx+dz*dz < (b.r+e.r*2.2)**2 && ((e.def.inf||e.def.air) ? dx*dx+dz*dz < (b.r+e.r)**2 : hitsHull(e, _sw.x, _sw.z, b.r))){ b.x=_sw.x; b.z=_sw.z; b.mesh.position.x=b.x; b.mesh.position.z=b.z;
          if(e.def.aps && (b.rocket||b.type==='TBX') && now>(e.apsCd||0) && Math.random()<e.def.aps){ e.apsCd=now+1.0; apsKill(b, e); b.aoe=0; b.pierce=0; hit=true; break; }   // Z158 APS kills the rocket
          const arcK=armourArc(e, b), tm = typeMul(b.type, armorOf(e))*envDmg(b.type)*arcK; let dmg=b.dmg*bulletFalloff(b)*tm; if(b.type) effectFeedback(tm, e.pos);   // damage class × armour × range × conditions
          const tank=!e.def.inf && !e.def.air, glance = tank && (tm<=0.6 || (arcK<1 && !b.aoe && Math.random()<0.45));   // Z192 thick front plate / the wrong gun: the round skips off
          if(tank){ const L=Math.hypot(b.vx,b.vz)||1; armourHit(e, b.x, b.by+heightAt(b.x,b.z), b.z, b.vx/L, b.vz/L, b.dmg, glance); }   // Z192 the hull rocks · spall out of the hole / sparks off the plate
          else if(tm<=0.6 && (b.fx==='spark'||b.fx==='he30') && Math.random()<0.6) ricochet(b.x, b.by+heightAt(b.x,b.z), b.z, b.vx, b.vz);   // Z149 light rounds skip off heavy armour
          if(e.def.air && b.type==='HE' && b.fx==='frag') dmg*=ROSTER.aaBonus;   // FLAK airbursts tear helicopters apart
          e._fx=b.fx;                               // remember which gun's style killed it → styled death blast
          if(b.owner==='p' && S.player && S.player.ammoBurn && !e.def.air && Math.random()<S.player.ammoBurn){ if(!e.burn) e.burn={ lvl:0, until:0 }; e.burn.lvl=Math.max(e.burn.lvl,1); e.burn.until=Math.max(e.burn.until, now+3); e.burn.k=Math.max(e.burn.k||1,1); }   // Z162 incendiary rounds
          e._big = !b.inf && (b.aoe>0 || b.dmg>=30); e._blast=null; e._hitK=b.dmg/40; { const L=Math.hypot(b.vx,b.vz)||1; e._hx=b.vx/L; e._hz=b.vz/L; }
          if(e.def.inf) bloodSpurt(e.pos.x, e.pos.z, b.vx, b.vz, b.inf ? 0.7 : 1.4);   // Z113 every hit on a man shows   // Z112 a heavy round throws a soldier; small arms just drop him
          if(e.def.inf && !b.inf && LETHAL.tankRoundKills) dmg=Math.max(dmg, e.hp+1);   // Z104 one tank round = one dead soldier
          damageEnemy(e, dmg);
          const _bl=Math.hypot(b.vx,b.vz)||1, _imp=Math.min(15, (2.2+b.dmg*0.08)*(b.knock||1))/(e.def.scale||1);   // shove back along the shot; per-gun KNOCK; heavy tanks resist
          e.kbx+=(b.vx/_bl)*_imp; e.kbz+=(b.vz/_bl)*_imp; e.hitT=Math.max(e.hitT,0.16);
          if(b.freeze){ e.stunUntil=Math.max(e.stunUntil, now+b.freeze*ENVMOD.freeze*(armorOf(e)==='H'?0.5:1)); ringPulse(b.mesh.position, 0x9fe8ff, 1.5); }   // CRYO: freeze
          if(b.chain){ let hits=b.chain;                                                                               // TESLA: arc to nearby enemies
            for(const e2 of enemies.slice()){ if(e2===e||hits<=0) continue; const cx=e2.pos.x-e.pos.x, cz=e2.pos.z-e.pos.z;
              if(cx*cx+cz*cz < b.chainR*b.chainR && !fortIntactCross(e.pos.x, e.pos.z, e2.pos.x, e2.pos.z)){ e2._fx='shock'; _ca.set(e.pos.x, heightAt(e.pos.x,e.pos.z)+1.3, e.pos.z); _cb.set(e2.pos.x, heightAt(e2.pos.x,e2.pos.z)+1.3, e2.pos.z); lightning(_ca, _cb, 0x7fc0ff, 0.18, 0.26); damageEnemy(e2, b.dmg*0.6); ringPulse(e2.pos, 0x7fd0ff, 1.3);
                spawnPart(e2.pos.x,1.4,e2.pos.z,(Math.random()-0.5)*6,4,(Math.random()-0.5)*6,{color:0x9fe0ff,size:0.9,life:0.2,grav:0,drag:6}); hits--; } } }
          impactFX(b.mesh.position, b.fx, Math.min(3.2, 1 + b.dmg/26), tank); hit=true;   // per-gun impact spray (spark/frag/blast/pierce/ice/shock)
          if(b.pierce>0){ b.pierce--; } else break; } }
      if(!hit && boss && boss.alive){ const dx=boss.pos.x-b.x, dz=boss.pos.z-b.z;
        if(dx*dx+dz*dz < (b.r+boss.r*2.5)**2 && hitsHull(boss, b.x, b.z, b.r)){ damageBoss(b.dmg*bulletFalloff(b)*typeMul(b.type,'H')*envDmg(b.type), b.x, b.z); ringPulse(b.mesh.position,0xffd27a,2.2); hit=true; } }
    } else if(b.owner!=='p'){ // enemy bullet — Z237 only an ENEMY round can hit our tank: our own lofted / guided missile used to fall through to here while airborne and strike us as it flew over the hull (firing on the move or back over the engine deck)
      const p=S.player;
      sweepPoint(b._hx, b._hz, b.x, b.z, p.pos.x, p.pos.z, _sw); const dpx=p.pos.x-_sw.x, dpz=p.pos.z-_sw.z;   // Z228b swept
      const armK = b.inf ? INFANTRY.vsArmour : 1;                                    // Z111b a rifle round barely scratches armour — only rockets (RPG / ATGM) really hurt a tank
      if(dpx*dpx+dpz*dpz < (b.r+p.radius*2.2)**2 && hitsHull(p, _sw.x, _sw.z, b.r)){ const _was=now>=p.invincibleUntil; damagePlayer(b.dmg*armK, now, b.vx, b.vz);
        if(_was){ const _bl=Math.hypot(b.vx,b.vz)||1, _imp=Math.min(11,2.8+b.dmg*0.12); p.kbx+=(b.vx/_bl)*_imp; p.kbz+=(b.vz/_bl)*_imp; }   // shoved clearly back along the shot — feel the hit
        else if(now < p.shieldUntil){ p.shieldHit=now; ringPulse({x:b.x,z:b.z}, 0x9ff0ff, 1.5);   // shield absorbs the shot → flash + ripple at the impact point
          spawnPart(b.x,1.3,b.z,(Math.random()-0.5)*5,3,(Math.random()-0.5)*5,{color:0xbff2ff,size:0.7,life:0.22,grav:0,drag:5}); }
        if(riders.length && Math.random()<0.45){ const rr=riders[(Math.random()*riders.length)|0]; if(rr&&!rr.dead) damageRider(rr, b.dmg); }   // a shot into the tank can wound an exposed rider
        hit=true; }
      if(!hit && hitAllyTank(b.x, b.z, b.r, b.dmg*armK)) hit=true;                       // Z104 our captured tanks take hits too
      if(!hit) for(const s of FT){ const dx=s.pos.x-b.x, dz=s.pos.z-b.z; if(dx*dx+dz*dz<9) suppress(s, dt*1.4); }   // Z173 our men get pinned too
      if(!hit) for(const s of FT){ const dx=s.pos.x-b.x, dz=s.pos.z-b.z, hr=s.g.userData.stance==='prone'?SQUAD.proneHitR:SQUAD.standHitR; if(dx*dx+dz*dz < (b.r+hr)**2){ bloodSpurt(s.pos.x, s.pos.z, b.vx, b.vz, b.inf?0.7:1.6); damageAlly(s, (b.inf||!LETHAL.tankRoundKills) ? b.dmg : 999); hit=true; break; } }   // Z89 fireteam can be hit · Z104 a tank shell kills outright   // Z105 a man lying flat is a much smaller target
      if(!hit) for(const s of soldiers){ const dx=s.pos.x-b.x, dz=s.pos.z-b.z;     // soldiers body-block incoming fire (and take the hit)
        if(dx*dx+dz*dz < (b.r+1.15)**2){ damageSoldier(s, b.dmg); ringPulse(b.mesh.position,0xff8a4a,1.0); hit=true; break; } }
      if(!hit && core){ const dcx=core.pos.x-b.x, dcz=core.pos.z-b.z;
        if(dcx*dcx+dcz*dcz < (b.r+core.r)**2){ damageCore(b.dmg); ringPulse(b.mesh.position,0xe0603a,2); hit=true; } }
      if(!hit && S.drone){ const dg=S.drone.g.position, ddx=dg.x-b.x, ddz=dg.z-b.z;        // the support drone can be shot down
        if(ddx*ddx+ddz*ddz < (b.r+DRONE.hitR)**2){ damageDrone(b.dmg, b); ringPulse(b.mesh.position,0x8fd0ff,1.1); hit=true; } }
    }
    if(hit && b.aoe){ detonate(b); recycleBullet(i); }
    else if(hit && b.pierce<=0) recycleBullet(i);
    else if(landed && !hit){ if(b.owner==='p'&&b.aoe) detonate(b); else { groundHit(b.x,b.z,b.r||0.45); if(!b.inf && b.dmg>=30) dirtGeyser(b.x, b.z, Math.min(1.6, 0.7+b.dmg/120)); } recycleBullet(i); }   // shell lands: burst / dirt + scar
  }
}

// Z158 ARMOUR BY ARC: where the round strikes the hull — front plates are thick, the rear deck and engine are thin
let _arcT=0;
export function armourArc(e, b){ const D=e.def; if(D.inf || D.air || (!D.armF && !D.armR)) return 1;
  const bl=Math.hypot(b.vx,b.vz)||1, c=-(b.vx/bl)*Math.sin(e.facing||0) - (b.vz/bl)*Math.cos(e.facing||0);   // +1 = the shot came at the nose
  const k = c>0.7 ? (D.armF??1) : c<-0.7 ? (D.armR??1) : 1; const n=performance.now();
  if(n-_arcT>1400 && (k>=1.3 || k<=0.55)){ _arcT=n; floatText(k>=1.3 ? 'BẮN ĐUÔI ×'+k.toFixed(1) : 'GIÁP TRƯỚC QUÁ DÀY', k>=1.3?'#ffb84a':'#9aa3ad', new THREE.Vector3(e.pos.x,3.6,e.pos.z), 14); }
  if(k<1 && S.player && S.player.ammoFront) k=Math.max(k, S.player.ammoFront);   // Z162 armour-piercing rounds
  return k; }
// Z158 active protection: a radar-cued charge kills the incoming rocket short of the hull
export function apsKill(b, e){ const a=Math.atan2(b.x-e.pos.x, b.z-e.pos.z), x=e.pos.x+Math.sin(a)*(e.r*1.6), z=e.pos.z+Math.cos(a)*(e.r*1.6);
  burst({x,z}, 0xffe0a0, 10, 9, { y:1.8, life:0.25, size:0.6, grav:-4, drag:4 }); ringPulse({x,z}, 0x9fd0ff, 1.6); spawnPart(x,1.8,z,0,0.5,0,{ color:0x9a948a, size:2, life:1.2, smoke:true, grav:0.3, drag:2, grow:1.2, op:0.5 });
  floatText('APS ĐÁNH CHẶN', '#9fd0ff', new THREE.Vector3(e.pos.x,3.8,e.pos.z), 15); sfx('explode', {x,z}, 0.6); }
