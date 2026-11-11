// combat/lock-on.js — MISSILE LOCK-ON — a hi-tech targeting reticle that snaps onto the locked target
import * as THREE from 'three';
import { ROSTER, LETHAL, SQUAD, INFANTRY, FORT } from '../../config.js';
import { ARC_G, ARENA, BVIS, DRONE, ENVMOD, FT, GLOW, HULL_HL, HULL_HW, S, _hot, addTrail, armorOf, blocks, boss, bulletFalloff, bulletPool, bullets, core, damageAlly, damageBlock, damageBoss, damageCore, damageDrone, damageEnemy, damagePlayer, damageRider, damageSoldier, detonate, effectFeedback, enemies, envDmg, fortWallCross, groundHit, heightAt, hitAllyTank, impactFX, inBlock, riders, ringPulse, scene, sfx, siegeMul, soldiers, spawnPart, structMul, typeMul, wrapAngle } from '../hub.js';

// ===== MISSILE LOCK-ON — a hi-tech targeting reticle that snaps onto the locked target =====
export const lockFX=[];                                          // pooled reticles: {tgt, grp, bgrp, rgrp, hgrp, life, max, snap}
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
  grp.add(bgrp,rgrp,hgrp); grp.visible=false; grp.renderOrder=6; scene.add(grp);
  lockFX.push({tgt:null, grp, bgrp, rgrp, hgrp, life:0, max:0.55, snap:0});
}
export function targetAlive(t){ return t===boss ? !!(boss&&boss.alive) : enemies.includes(t); }   // dead targets splice out of enemies[]
export function acquireLock(b){ let best=null, bd=1e9;                                     // nearest live enemy/boss to the missile itself
  for(const e of enemies){ const d=((e.pos.x-b.x)**2+(e.pos.z-b.z)**2)*(e.def.inf?9:1); if(d<bd){bd=d;best=e;} }   // missiles prefer vehicles over foot soldiers
  if(boss&&boss.alive){ const d=(boss.pos.x-b.x)**2+(boss.pos.z-b.z)**2; if(d<bd){bd=d;best=boss;} }
  return best; }
export function requestLock(t){
  for(const L of lockFX){ if(L.tgt===t && L.life>0){ L.life=L.max; return; } }      // already locked → keep alive while a missile chases it
  const L=lockFX.find(L=>L.life<=0); if(!L) return;                                 // grab a free reticle (skip if all 8 busy)
  L.tgt=t; L.life=L.max; L.snap=0; L.bgrp.scale.setScalar(2.5); L.grp.visible=true; L.grp.position.set(t.pos.x,1.4,t.pos.z);
  ringPulse(t.pos, 0xff7a3a, 1.7); sfx('beep'); }                                    // acquisition: scan-ring pulse + tech blip
export function updateLocks(dt){
  for(const L of lockFX){ if(L.life<=0) continue;
    if(!targetAlive(L.tgt)) L.life-=dt*2.4;                                          // target gone → fade fast
    else { L.life-=dt; L.grp.position.set(L.tgt.pos.x,1.4,L.tgt.pos.z); }            // else track it
    if(L.life<=0){ L.grp.visible=false; L.tgt=null; continue; }
    L.snap=Math.min(1, L.snap+dt*7); L.bgrp.scale.setScalar(1 + (1-L.snap)*1.5);     // brackets fly inward & snap shut on acquire
    L.bgrp.rotation.y += dt*0.8; L.rgrp.rotation.y -= dt*1.7; L.hgrp.rotation.y += dt*3.0;   // counter-spinning tech layers
    const op=Math.min(1, L.life/L.max*1.4)*0.92; L.grp.traverse(o=>{ if(o.material) o.material.opacity=op; });
    L.rgrp.scale.setScalar(1 + Math.sin((L.max-L.life)*22)*0.05); }                  // subtle ring pulse
}
// Z113 rocket rounds (our soldiers' AT launchers) fly as a real rocket — body, fins, exhaust glow — riding on the pooled bullet
const _rk=[]; let _rkMat=null;
function allyRocket(){ if(!_rkMat) _rkMat={ body:new THREE.MeshStandardMaterial({color:0x5a6438,roughness:0.55,metalness:0.4}), war:new THREE.MeshStandardMaterial({color:0x2a2a24,roughness:0.5,metalness:0.6}), glow:new THREE.SpriteMaterial({map:GLOW,color:0xffb060,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}) };
  const g=new THREE.Group(); const b=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.7,10), _rkMat.body); b.rotation.x=Math.PI/2; g.add(b);
  const n=new THREE.Mesh(new THREE.ConeGeometry(0.13,0.36,10), _rkMat.war); n.rotation.x=Math.PI/2; n.position.z=0.52; g.add(n);
  for(let k=0;k<4;k++){ const f=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.22,0.16), _rkMat.war); f.position.z=-0.3; f.rotation.z=k*Math.PI/2; f.position.x=Math.sin(k*Math.PI/2)*0.08; f.position.y=Math.cos(k*Math.PI/2)*0.08; g.add(f); }
  const s=new THREE.Sprite(_rkMat.glow); s.scale.setScalar(0.9); s.position.z=-0.45; g.add(s); return g; }
export function spawnBullet(x, z, angle, o={}){
  const m = bulletPool.pop(); if(!m) return;
  if(o.rocket){ const rk=_rk.pop()||allyRocket(); m.add(rk); m.userData.rk=rk; m.userData.core.visible=false; m.userData.halo.visible=false; m.rotation.set(0,angle,0); }   // Z113
  const r = o.r||0.45;
  m.visible=true; m.scale.setScalar((o.scale || (0.78 + r*1.1)) * BVIS);   // heavier rounds render fatter (per-gun size)
  if(m.userData.rk) m.userData.rk.scale.setScalar(1.15/m.scale.x);           // the rocket keeps its real size
  const col = o.color ?? 0xffe08a;
  const tracer = (o.owner==='e') ? 0xff5a24 : col;                          // enemy fire reads as danger-red; player = the gun's colour
  m.userData.core.material.color.setHex(_hot(tracer));                      // bright white-hot core
  m.userData.halo.material.color.setHex(tracer);                           // glowing aura matches the tracer
  const y0 = o.y!=null ? Math.max(0.6, o.y - heightAt(x,z)) : 1.2;          // launch height ABOVE THE GROUND at the real muzzle
  if(o.from && y0 < FORT.wallH+0.4 && fortWallCross(o.from.x, o.from.z, x, z)){ x=o.from.x; z=o.from.z; }   // Z111b barrel poking through/over a fortress wall: the round leaves from the hull side → the stone takes it
  m.position.set(x, y0, z);
  const sp = o.speed||60;
  const D=o.arcDist||0; let vy=0; if(!o.lockOn && !o.noArc && D>11){ const T=Math.min(0.9, D/sp); vy=Math.min(30, ARC_G*T/2); }   // lob: more arc the farther/slower; flat up close (lock-on missiles arc themselves)
  const loft = o.lockOn ? (D<14 ? 1.0+Math.random()*1.4 : 2.6+Math.random()*3.0) : 0;   // random arc: low/shallow when the target's close, lofts higher when far (kept snappy — short air time)
  bullets.push({ mesh:m, x, z, ox:x, oz:z, vx:Math.sin(angle)*sp, vz:Math.cos(angle)*sp,
    owner:o.owner||'p', dmg:o.dmg||20, r:o.r||0.45, life:o.life||2.2, pierce:o.pierce||0,
    homing:o.homing||0, angle, aoe:o.aoe||0, aoeDmg:o.aoeDmg||0, maxDist:o.maxDist||0, color:col,
    lockOn:o.lockOn||false, tgt:null, loft,
    by:y0, vy, arc:(vy>0.5), vyl:(o.dropTo!=null && (o.dropDist||D)>0.5 ? (o.dropTo-y0)/((o.dropDist||D)/sp) : 0), ignore:o.ignore||null, type:o.type||null, reach:o.reach||0, fall:o.fall??1, freeze:o.freeze||0, chain:o.chain||0, chainR:o.chainR||0, knock:o.knock||1, fx:o.fx||'spark', inf:!!o.inf });   // inf = small-arms round (rifle/MG) — anything else is a tank-gun round
}
// Z112 what a hit on stone / timber / steel looks like, by the round: heavy explosive → chunks + a dust cloud, armour-piercing → a hard spray of chips, small arms → sparks and grit
const _STONE=new Set(['fortwall','gate','boulder','brick','tower','concrete','hesco','camp']);
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
export function recycleBullet(i){ const b=bullets[i], m=b.mesh; m.visible=false; if(m.userData.rk){ m.remove(m.userData.rk); _rk.push(m.userData.rk); m.userData.rk=null; m.userData.core.visible=true; m.userData.halo.visible=true; m.rotation.set(0,0,0); } bulletPool.push(m); bullets.splice(i,1); }
export function updateBullets(dt, now){
  const lim = ARENA-1;
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    if(b.lockOn && b.owner==='p'){ // MISSILE: lock ONE target, chase that object, loft-then-dive arc
      if(!b.tgt || !targetAlive(b.tgt)) b.tgt = acquireLock(b);            // sticky lock — re-acquire only if it dies
      const t=b.tgt;
      if(t){ requestLock(t);                                              // hi-tech reticle snaps onto the locked target
        const want=Math.atan2(t.pos.x-b.x,t.pos.z-b.z); let da=wrapAngle(want-b.angle);
        b.angle=wrapAngle(b.angle+da*Math.min(1,dt*(b.homing||5))); const sp=Math.hypot(b.vx,b.vz);
        b.vx=Math.sin(b.angle)*sp; b.vz=Math.cos(b.angle)*sp;
        const dist=Math.hypot(t.pos.x-b.x,t.pos.z-b.z), ty=(t.pos.y||1.2);
        if(dist < b.r+(t.r||1)+0.7){ detonate(b); recycleBullet(i); continue; }     // PROXIMITY FUSE: reached the locked target → detonate now (clean hit at any speed, no tunnelling/orbiting)
        const desiredY=ty + b.loft*Math.min(1, dist/9);                   // vault while far, dive to strike height as it closes (descends sooner → less loiter)
        b.by += (desiredY-b.by)*Math.min(1, dt*4.2); } }                  // snappy climb/dive — short air time, no orbiting
    else if(b.homing && b.owner==='p'){ // (legacy) plain homing toward the nearest enemy
      let best=null, bd=1e9; for(const e of enemies){ const d=(e.pos.x-b.x)**2+(e.pos.z-b.z)**2; if(d<bd){bd=d;best=e;} }
      if(boss&&boss.alive){ const d=(boss.pos.x-b.x)**2+(boss.pos.z-b.z)**2; if(d<bd){bd=d;best=boss;} }
      if(best){ const want=Math.atan2(best.pos.x-b.x,best.pos.z-b.z); let da=wrapAngle(want-b.angle);
        b.angle=wrapAngle(b.angle+da*Math.min(1,dt*b.homing)); const sp=Math.hypot(b.vx,b.vz);
        b.vx=Math.sin(b.angle)*sp; b.vz=Math.cos(b.angle)*sp; } }
    b.x+=b.vx*dt; b.z+=b.vz*dt; b.life-=dt;
    let landed=false;
    if(b.arc){ b.by+=b.vy*dt; b.vy-=ARC_G*dt; if(b.by<=0.3 && b.vy<0){ b.by=0.3; landed=true; } }   // ballistic shell: up, over, and DOWN into the ground
    if(b.vyl) b.by=Math.max(0.3, b.by+b.vyl*dt);                                                      // plunging fire (tower guards shooting down)
    const _gy=heightAt(b.x,b.z);
    b.mesh.position.set(b.x,b.by+_gy,b.z);
    addTrail(b.x, b.by+_gy, b.z, b.owner==='e'?0xff5a24:b.color, (b.r||0.45)*BVIS*3.0, 0.14+(b.r||0.45)*0.22);   // per-gun glowing tracer (enemy = danger-red); heavier rounds leave a fatter, longer streak
    if(b.mesh.userData.rk && Math.random()<0.8){ const bk=Math.hypot(b.vx,b.vz)||1; spawnPart(b.x-(b.vx/bk)*0.7, b.by+_gy, b.z-(b.vz/bk)*0.7, (Math.random()-0.5)*0.8, 0.3, (Math.random()-0.5)*0.8, {color:0xcfc6b4, size:0.55, life:0.55, smoke:true, grav:0.25, drag:1.6, grow:1.1, op:0.42}); }   // Z113 AT rocket smoke trail
    if(b.lockOn){ const bk=Math.hypot(b.vx,b.vz)||1, ex=b.x-(b.vx/bk)*0.6, ez=b.z-(b.vz/bk)*0.6;   // rocket exhaust plume trailing the missile
      if(Math.random()<0.8) spawnPart(ex,b.by,ez,(Math.random()-0.5)*1.2,0.4,(Math.random()-0.5)*1.2,{color:0x46382e,size:0.72,life:0.34,smoke:true,grav:0.5,drag:3,op:0.34});
      if(Math.random()<0.55) spawnPart(ex,b.by,ez,(Math.random()-0.5)*2,0.3,(Math.random()-0.5)*2,{color:0xff8a3a,size:0.5,life:0.15,grav:0,drag:4}); }
    const airborne = (b.lockOn && b.by>2.6) || (b.arc && b.by>3.0);   // lofted missiles / high shells sail over cover & bystanders — they strike on the way down

    const overRange = !b.arc && b.maxDist && ((b.x-b.ox)**2+(b.z-b.oz)**2 > b.maxDist*b.maxDist);   // shells in flight always come down somewhere
    if(b.life<=0 || overRange || Math.abs(b.x)>lim || Math.abs(b.z)>lim){ if(b.owner==='p'&&b.aoe) detonate(b); else if(Math.abs(b.x)<lim && Math.abs(b.z)<lim) groundHit(b.x, b.z, b.r||0.45); recycleBullet(i); continue; }
    // terrain blocks are cover — bullets break bricks / bounce off steel, then stop
    let blocked=false;
    const low = b.by < FORT.wallH+0.4;                                // Z111b below the parapet → a fortress wall stops it, even a lobbed shell
    if(!airborne || low) for(const bl of blocks){ if(bl===b.ignore) continue; if(bl.fort ? !low : airborne) continue; if(inBlock(bl, b.x, b.z, b.r)){
      if(bl.kind==='obj' && b.owner==='e'){ blocked=true; break; }   // enemy fire never hurts their own objective
      if((bl.fort || bl.hard) && b.owner==='e'){ ringPulse(b.mesh.position, 0xc89060, 0.9); blocked=true; break; }   // Z112 enemy fire doesn't break rocks / hedgehogs either   // Z111b their own walls soak their fire — no damage to the stone
      damageBlock(bl, b.dmg*structMul(b.type, bl)*(b.owner==='p'?siegeMul():1)); ringPulse(b.mesh.position, bl.steel?0xb0b0c0:0xc89060, 1.2); blockImpactFX(bl, b); blocked=true; break; } }
    if(blocked){ if(b.owner==='p'&&b.aoe) detonate(b); recycleBullet(i); continue; }
    let hit=false;
    if(b.owner==='p' && !airborne){       // lofted missiles can't hit while high — they strike on the dive
      for(const e of enemies){ const dx=e.pos.x-b.x, dz=e.pos.z-b.z;
        if(dx*dx+dz*dz < (b.r+e.r*2.2)**2 && ((e.def.inf||e.def.air) ? dx*dx+dz*dz < (b.r+e.r)**2 : hitsHull(e, b.x, b.z, b.r))){
          const tm = typeMul(b.type, armorOf(e))*envDmg(b.type); let dmg=b.dmg*bulletFalloff(b)*tm; if(b.type) effectFeedback(tm, e.pos);   // damage class × armour × range × conditions
          if(e.def.shield){ const nx=Math.sin(e.aim),nz=Math.cos(e.aim), bl=Math.hypot(b.vx,b.vz)||1;
            if((b.vx/bl)*nx+(b.vz/bl)*nz < -0.3){ dmg*=0.28; ringPulse(b.mesh.position,0x9fd0ff,1.2); } }  // blocked from the front → flank it
          if(e.def.air && b.type==='HE' && b.fx==='frag') dmg*=ROSTER.aaBonus;   // FLAK airbursts tear helicopters apart
          e._fx=b.fx;                               // remember which gun's style killed it → styled death blast
          e._big = !b.inf && (b.aoe>0 || b.dmg>=30); e._blast=null; { const L=Math.hypot(b.vx,b.vz)||1; e._hx=b.vx/L; e._hz=b.vz/L; }   // Z112 a heavy round throws a soldier; small arms just drop him
          if(e.def.inf && !b.inf && LETHAL.tankRoundKills) dmg=Math.max(dmg, e.hp+1);   // Z104 one tank round = one dead soldier
          damageEnemy(e, dmg);
          const _bl=Math.hypot(b.vx,b.vz)||1, _imp=Math.min(15, (2.2+b.dmg*0.08)*(b.knock||1))/(e.def.scale||1);   // shove back along the shot; per-gun KNOCK; heavy tanks resist
          e.kbx+=(b.vx/_bl)*_imp; e.kbz+=(b.vz/_bl)*_imp; e.hitT=Math.max(e.hitT,0.16);
          if(b.freeze){ e.stunUntil=Math.max(e.stunUntil, now+b.freeze*ENVMOD.freeze*(armorOf(e)==='H'?0.5:1)); ringPulse(b.mesh.position, 0x9fe8ff, 1.5); }   // CRYO: freeze
          if(b.chain){ let hits=b.chain;                                                                               // TESLA: arc to nearby enemies
            for(const e2 of enemies.slice()){ if(e2===e||hits<=0) continue; const cx=e2.pos.x-e.pos.x, cz=e2.pos.z-e.pos.z;
              if(cx*cx+cz*cz < b.chainR*b.chainR){ e2._fx='shock'; damageEnemy(e2, b.dmg*0.6); ringPulse(e2.pos, 0x7fd0ff, 1.3);
                spawnPart(e2.pos.x,1.4,e2.pos.z,(Math.random()-0.5)*6,4,(Math.random()-0.5)*6,{color:0x9fe0ff,size:0.9,life:0.2,grav:0,drag:6}); hits--; } } }
          impactFX(b.mesh.position, b.fx, Math.min(3.2, 1 + b.dmg/26)); hit=true;   // per-gun impact spray (spark/frag/blast/pierce/ice/shock)
          if(b.pierce>0){ b.pierce--; } else break; } }
      if(!hit && boss && boss.alive){ const dx=boss.pos.x-b.x, dz=boss.pos.z-b.z;
        if(dx*dx+dz*dz < (b.r+boss.r*2.5)**2 && hitsHull(boss, b.x, b.z, b.r)){ damageBoss(b.dmg*bulletFalloff(b)*typeMul(b.type,'H')*envDmg(b.type), b.x, b.z); ringPulse(b.mesh.position,0xffd27a,2.2); hit=true; } }
    } else { // enemy bullet
      const p=S.player;
      const dpx=p.pos.x-b.x, dpz=p.pos.z-b.z;
      const armK = b.inf ? INFANTRY.vsArmour : 1;                                    // Z111b a rifle round barely scratches armour — only rockets (RPG / ATGM) really hurt a tank
      if(dpx*dpx+dpz*dpz < (b.r+p.radius*2.2)**2 && hitsHull(p, b.x, b.z, b.r)){ const _was=now>=p.invincibleUntil; damagePlayer(b.dmg*armK, now, b.vx, b.vz);
        if(_was){ const _bl=Math.hypot(b.vx,b.vz)||1, _imp=Math.min(11,2.8+b.dmg*0.12); p.kbx+=(b.vx/_bl)*_imp; p.kbz+=(b.vz/_bl)*_imp; }   // shoved clearly back along the shot — feel the hit
        else if(now < p.shieldUntil){ p.shieldHit=now; ringPulse({x:b.x,z:b.z}, 0x9ff0ff, 1.5);   // shield absorbs the shot → flash + ripple at the impact point
          spawnPart(b.x,1.3,b.z,(Math.random()-0.5)*5,3,(Math.random()-0.5)*5,{color:0xbff2ff,size:0.7,life:0.22,grav:0,drag:5}); }
        if(riders.length && Math.random()<0.45){ const rr=riders[(Math.random()*riders.length)|0]; if(rr&&!rr.dead) damageRider(rr, b.dmg); }   // a shot into the tank can wound an exposed rider
        hit=true; }
      if(!hit && hitAllyTank(b.x, b.z, b.r, b.dmg*armK)) hit=true;                       // Z104 our captured tanks take hits too
      if(!hit) for(const s of FT){ const dx=s.pos.x-b.x, dz=s.pos.z-b.z, hr=s.g.userData.stance==='prone'?SQUAD.proneHitR:SQUAD.standHitR; if(dx*dx+dz*dz < (b.r+hr)**2){ damageAlly(s, (b.inf||!LETHAL.tankRoundKills) ? b.dmg : 999); hit=true; break; } }   // Z89 fireteam can be hit · Z104 a tank shell kills outright   // Z105 a man lying flat is a much smaller target
      if(!hit) for(const s of soldiers){ const dx=s.pos.x-b.x, dz=s.pos.z-b.z;     // soldiers body-block incoming fire (and take the hit)
        if(dx*dx+dz*dz < (b.r+1.15)**2){ damageSoldier(s, b.dmg); ringPulse(b.mesh.position,0xff8a4a,1.0); hit=true; break; } }
      if(!hit && core){ const dcx=core.pos.x-b.x, dcz=core.pos.z-b.z;
        if(dcx*dcx+dcz*dcz < (b.r+core.r)**2){ damageCore(b.dmg); ringPulse(b.mesh.position,0xe0603a,2); hit=true; } }
      if(!hit && S.drone){ const dg=S.drone.g.position, ddx=dg.x-b.x, ddz=dg.z-b.z;        // the support drone can be shot down
        if(ddx*ddx+ddz*ddz < (b.r+DRONE.hitR)**2){ damageDrone(b.dmg, b); ringPulse(b.mesh.position,0x8fd0ff,1.1); hit=true; } }
    }
    if(hit && b.aoe){ detonate(b); recycleBullet(i); }
    else if(hit && b.pierce<=0) recycleBullet(i);
    else if(landed && !hit){ if(b.owner==='p'&&b.aoe) detonate(b); else groundHit(b.x,b.z,b.r||0.45); recycleBullet(i); }   // shell lands: burst / dirt + scar
  }
}
