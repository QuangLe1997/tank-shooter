// combat/lock-on.js — EVERY ROUND IN FLIGHT: spawning a round, flying it (straight line / lob / rocket), striking men, aircraft, blocks and walls
//   (no-tanks: the tank's lock-on missile gun — its seeker, reticles, smart mini-missiles, homing — is gone; the file keeps its name)
import * as THREE from 'three';
import { LETHAL, SQUAD, FORT, TREEFALL, AIRAIM, LINE, GUNFX, GUNFEEL } from '../../config.js';
import { hitConfirm, sfx, wrapAngle, ARC_G, ARENA, BVIS, DW, droneShot, FT, GLOW, MOBILE, S, UGRID, UNDER, _hot, addTrail, armorOf, ballisticInit, ballisticStep, ballisticTrailK, bloodSpurt, bulletFalloff, bulletPool, bullets, core, damageAlly, damageBlock, damageCore, damageEnemy, damagePlayer, damageSoldier, detonate, dirtGeyser, effectFeedback, enemies, envDmg, fenceShot, fortIntactCross, fortWallCross, groundHit, heightAt, impactFX, lightning, nearMiss, orientShell, ringPulse, rocketExhaust, shellStretch, shellTrail, shootGuard, siegeMul, soldiers, spawnPart, structMul, suppress, surfaceHit, sweepPoint, tunnelBlast, typeMul, unitsNear, vaporWake, shotTree, trafficShot, dodgeShot, stealthShot, lineHit, inShape, dressRound, sandProof, bulletImpact, hitMat, climbPerch, tracerHit, fireFxOn, CO, coopBulletMate, medalShot, shotLook } from '../hub.js';
import { COVER_HP, CQ, conqShieldHit } from '../hub.js';   // CONQ 1 the ghost rifle's round passes thin cover (thin = the most health a piece it passes may have) · the lava shield (campaign/conquest.js)

// Z238 how high a block stands (world y of its top), measured once from its mesh and again after it has been damaged
const _tb=new THREE.Box3();
// Z314 does a straight round at world height wy meet this man (an enemy, the player, one of ours) — feet to head, not above it, not under it (an aircraft: always)
function lineH(b, wy, t){ if(!b.line || (t.def && t.def.air)) return true; const gy=heightAt(t.pos.x, t.pos.z)+(t.lift||0);   // (Z451 the soldier up on a wall: from his soles there)
  return wy > gy-LINE.floor && wy < gy+manHigh(t); }
// Z316 one of our men as he is now — lying flat, crouched, standing, sat on the ride — and how high that makes him (a round aimed at a standing man's chest goes over a man lying flat)
function stanceOf(t){ if(t && t.cav) return t.cav.mounted ? 'mounted' : t.cav.roll ? 'prone' : (t.cav.stance || 'stand');   // (Z377 going over in a roll he is as low as a man lying flat)
  const s = t && t.g && t.g.userData && t.g.userData.stance; return s==='low' ? 'crouch' : (s || 'stand'); }
function manHigh(t){ const st=stanceOf(t); return st==='prone' ? LINE.body.prone : st==='crouch' ? LINE.body.crouch : LINE.manH + (st==='mounted' ? 0.4 : 0); }
export function blockTop(bl){ if(bl.bld){ const B=bl.bld, f=!B.dead && B.top>=0 ? B.floors[B.top] : null; return f && f.y1!=null ? f.y1 : heightAt(bl.x,bl.z)+0.6; }   // Z380 a city block: as tall as its highest floor still standing (its circles carry no mesh: all of them stood 2 m high — rounds and eyes went through the upper floors)
  if(bl._top==null || bl._topHp!==bl.hp){ bl._topHp=bl.hp; if(bl.fort && (bl.kind==='fortwall' || bl.kind==='gate')) bl._top=heightAt(bl.x,bl.z)+FORT.wallH+0.6;   // a fortress wall's block carries the whole fort's mesh — its own height is the parapet's
    else if(bl.mesh){ _tb.setFromObject(bl.mesh); bl._top=_tb.isEmpty() ? heightAt(bl.x,bl.z)+2 : Math.min(_tb.max.y, heightAt(bl.x,bl.z)+16); } else bl._top=heightAt(bl.x,bl.z)+2; } return bl._top; }
// the ground's normal under (x,z) (campaign/artillery.js lays its ring on the slope)
export function groundNormal(x, z, out){ const e=1.2, hx=heightAt(x+e,z)-heightAt(x-e,z), hz=heightAt(x,z+e)-heightAt(x,z-e); return out.set(-hx/(2*e), 1, -hz/(2*e)).normalize(); }
// Z113 rocket rounds (our soldiers' AT launchers) fly as a real rocket — body, fins, exhaust glow — riding on the pooled bullet
const _rk=[]; let _rkMat=null;
function allyRocket(){ if(!_rkMat) _rkMat={ body:new THREE.MeshStandardMaterial({color:0x5a6438,roughness:0.55,metalness:0.4}), war:new THREE.MeshStandardMaterial({color:0x2a2a24,roughness:0.5,metalness:0.6}), glow:new THREE.SpriteMaterial({map:GLOW,color:0xffb060,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}) };
  const g=new THREE.Group(); const b=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.7,10), _rkMat.body); b.rotation.x=Math.PI/2; g.add(b);
  const n=new THREE.Mesh(new THREE.ConeGeometry(0.13,0.36,10), _rkMat.war); n.rotation.x=Math.PI/2; n.position.z=0.52; g.add(n);
  for(let k=0;k<4;k++){ const f=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.22,0.16), _rkMat.war); f.position.z=-0.3; f.rotation.z=k*Math.PI/2; f.position.x=Math.sin(k*Math.PI/2)*0.08; f.position.y=Math.cos(k*Math.PI/2)*0.08; g.add(f); }
  const s=new THREE.Sprite(_rkMat.glow); s.scale.setScalar(0.9); s.position.z=-0.45; g.add(s); g.userData.glow=s; g.userData.body=g.children.filter(o=>o.isMesh); return dressRound(g, 1.0); }   // Z424 the missile scan
const _ca=new THREE.Vector3(), _cb=new THREE.Vector3();   // Z149 chain-lightning ends
// Z314 how far along a round's line the first body on it stands (the player or our men for an enemy's round, the enemy for ours) — where a round with no
//   distance of its own is aimed at chest height; nobody on the line: most of its reach
function aimAlong(x, z, a, o){ const s=Math.sin(a), c=Math.cos(a); let bd=1e9, who=null;   // (Z316 and who it is)
  const on=(px, pz, lat, w)=>{ const dx=px-x, dz=pz-z, al=dx*s+dz*c; if(al>1 && al<bd && Math.abs(dx*c-dz*s)<lat){ bd=al; who=w; } };
  if(o.owner==='e'){ const p=S.player; if(p) on(p.pos.x, p.pos.z, 3, p); for(const f of FT) on(f.pos.x, f.pos.z, 2, f); } else for(const e of enemies) on(e.pos.x, e.pos.z, e.def && e.def.inf ? 2 : 3.5, e);
  return { d:bd<1e9 ? bd : (o.maxDist||30)*0.6, who }; }
export function spawnBullet(x, z, angle, o={}){
  const m = bulletPool.pop(); if(!m) return;
  if(o.owner==='p' && o.reach!=null){ const P=S.player; if(P && P.cav && (x-P.pos.x)**2+(z-P.pos.z)**2 < 9) stealthShot(); }   // Z377 the soldier's own shot (his guns pass their reach; his mates' rounds do not): the flash gives him away
  if(o.rocket){ const rk=_rk.pop()||allyRocket(); m.add(rk); m.userData.rk=rk; m.userData.core.visible=false; m.userData.halo.visible=false; m.rotation.set(0,angle,0); }   // Z113
  const r = o.r||0.45, TV=GUNFX.tracer, sa=!!(o.inf || o.mg), dark=o.tr===0 && !o.rocket;   // Z419 sa = rifle / MG calibre · dark = a ball round between the tracers: unseen
  m.visible=!dark; m.scale.setScalar((o.scale || (0.78 + r*1.1)) * BVIS);   // heavier rounds render fatter (per-gun size)
  if(m.userData.rk) m.userData.rk.scale.setScalar(1.15/m.scale.x);           // the rocket keeps its real size
  else { const w=sa ? TV.mgCore : TV.core; m.userData.core.scale.set(w, w, shellStretch(o.speed)*(sa?1.25:1)); m.userData.halo.scale.setScalar(sa ? TV.mgHalo : TV.halo); }   // Z192 the hot core is a streak along the flight, longer the faster the round · Z419 a thin bright line, not a fat ball (core 0.38 → 0.2 / 0.11, glow 1 → 0.55 / 0.32)
  const col = o.color ?? 0xffe08a;
  const tracer = (o.owner==='e') ? 0xff5a24 : col;                          // enemy fire reads as danger-red; player = the gun's colour
  m.userData.core.material.color.setHex(_hot(tracer));                      // bright white-hot core
  m.userData.halo.material.color.setHex(tracer);                           // glowing aura matches the tracer
  const y0 = o.y!=null ? Math.max(o.owner==='p' && o.reach!=null ? GUNFEEL.shot.low : 0.6, o.y - heightAt(x,z)) : 1.2;   // (GUN 3 the soldier's own round from his real muzzle, lying down too — it started 0.6 m up)          // launch height ABOVE THE GROUND at the real muzzle
  if(o.from && y0 < FORT.wallH+0.4 && fortWallCross(o.from.x, o.from.z, x, z)){ x=o.from.x; z=o.from.z; }   // Z111b barrel poking through/over a fortress wall: the round leaves from the hull side → the stone takes it
  m.position.set(x, y0, z);
  const sp = o.speed||60;
  const D=o.arcDist||0; let vy=0; if(!o.noArc && D>11){ const T=Math.min(0.9, D/sp); vy=Math.min(30, ARC_G*T/2); }   // lob: more arc the farther/slower; flat up close 
  // Z314 a gun's round is a straight line in the world (it no longer rides up and down with the ground beneath it): from the muzzle to dropTo above the
  //   ground at its aimed distance (dropDist / arcDist — or, for an enemy's round, as far as you are along its line), and on along the same line past it
  const lineRound = !o.homing && !(vy>0.5); let dropTo = o.dropTo ?? (o.owner==='e' ? 1.2 : null), A = o.dropDist || D;   // (an enemy's round with no mark set: at the chest of whoever stands on its line)
  if(lineRound && dropTo!=null && (o.owner==='e' || !A)){ const t=aimAlong(x, z, angle, o); if(!A) A=t.d;
    if(o.owner==='e' && t.who && !(t.who.def) && Math.abs(t.d-A)<5){ const st=stanceOf(t.who); if(st==='prone' || st==='crouch') dropTo=Math.min(dropTo, LINE.aim[st]); }
    if(o.owner==='e' && t.who && t.who===S.player && t.who.lift>0.3 && Math.abs(t.d-A)<5) dropTo+=t.who.lift; }   // Z451 he is up on a wall / a rock: they aim up at him   // Z316 one of ours lying flat or crouched: the enemy lays its aim low on him
  const wy0 = heightAt(x,z)+y0; let slope=0; if(lineRound && dropTo!=null && A>0.5){ const ex=x+Math.sin(angle)*A, ez=z+Math.cos(angle)*A; slope=(heightAt(ex,ez)+dropTo-wy0)/A; }
  const B0={ mesh:m, x, z, ox:x, oz:z, vx:Math.sin(angle)*sp, vz:Math.cos(angle)*sp,
    owner:o.owner||'p', dmg:o.dmg||20, r:o.r||0.45, life:o.life||2.2, pierce:o.pierce||0,
    homing:o.homing||0, angle, aoe:o.aoe||0, aoeDmg:o.aoeDmg||0, maxDist:o.maxDist||0, color:col, _py:null, _tx:null,
    airAim:o.airAim||null, line:lineRound, wy0, slope, by:y0, vy, arc:(vy>0.5), vyl:(o.dropTo!=null && (o.dropDist||D)>0.5 ? (o.dropTo-y0)/((o.dropDist||D)/sp) : 0), ignore:o.ignore||null, thin:o.thin||0, type:o.type||null, reach:o.reach||0, fall:o.fall??1, chain:o.chain||0, chainR:o.chainR||0, knock:o.knock||1, fx:o.fx||'spark', inf:!!o.inf, tk:o.trailK||1, sa, dark, trc:o.tr===1 };
  if(o.owner==='p' && o.reach!=null && !dark){ B0._lx=x; B0._ly=wy0; B0._lz=z; }   // GUN 3 its tracer starts AT the muzzle: fired after the frame's bullet step it was first drawn a frame's flight (1.5–3 m) out, nothing behind it
  shotLook(B0, o);   // GUNFX 1 a small-arms round: a tracer streak or unseen (fx/gunfx.js), no sphere + sprite of its own
  bullets.push(B0);
  { const v=ballisticInit(B0, o, sp); if(B0.bk){ B0.vx=Math.sin(angle)*v; B0.vz=Math.cos(angle)*v; if(!m.userData.rk) m.userData.core.scale.z=shellStretch(v)*(sa?1.25:1); } }   // Z228b the round's velocity curve (fast out of the muzzle / booster kick)
}
// Z112 what a hit on stone / timber / steel looks like, by the round: heavy explosive → chunks + a dust cloud, armour-piercing → a hard spray of chips, small arms → sparks and grit
const _STONE=new Set(['building','fortwall','gate','boulder','brick','tower','concrete','hesco','camp','pipes','jersey','teeth']);
export function blockImpactFX(bl, b){ const gy=heightAt(b.x,b.z), y=gy+Math.max(0.6, Math.min(4, b.by)), heavy=b.aoe>0 || b.dmg>=40, stone=_STONE.has(bl.kind), col=stone?0xa89a84:(bl.steel||bl.kind==='hedgehog'?0xffe0a0:0x9a7a52);
  const bx=Math.hypot(b.vx,b.vz)||1, ux=-b.vx/bx, uz=-b.vz/bx;   // debris kicks back toward the shooter
  if(heavy){ for(let k=0;k<8;k++) spawnPart(b.x, y, b.z, ux*(3+Math.random()*5)+(Math.random()-0.5)*5, 2+Math.random()*5, uz*(3+Math.random()*5)+(Math.random()-0.5)*5, {color:col, size:0.22+Math.random()*0.25, life:0.7, grav:-18, drag:1});
    spawnPart(b.x, y, b.z, ux*1.2, 1.2, uz*1.2, {color:stone?0xb8a888:0x6a5a44, size:2.2+b.dmg*0.02, life:1.3, smoke:true, grav:-0.3, drag:1.6, grow:1.6, op:0.5}); }
  else if(b.inf || b.dmg<20) bulletImpact(hitMat(bl, stone), b.x, y, b.z, ux, uz, b.inf ? 0.9 : 1.2);   // Z419 small arms: chips + grey dust off stone, sparks off steel, splinters off wood, a burst of sand
  else { bulletImpact(hitMat(bl, stone), b.x, y, b.z, ux, uz, 1.7);   // Z419 a heavy bullet / light shell: the same material burst, bigger
    spawnPart(b.x, y, b.z, ux, 0.8, uz, {color:stone?0xb8a888:0x7a6a54, size:1.2, life:0.8, smoke:true, grav:-0.3, drag:2, op:0.4}); } }
export function recycleBullet(i){ const b=bullets[i], m=b.mesh; m.visible=false; if(m.userData.rk){ m.remove(m.userData.rk); _rk.push(m.userData.rk); m.userData.rk=null; m.userData.core.visible=true; m.userData.halo.visible=true; m.rotation.set(0,0,0); } bulletPool.push(m); bullets.splice(i,1); }
const _bcI=[], _bcT=[], _bcA=[];
const _sw={ x:0, z:0 };   // Z228b swept-hit scratch
function bulletCands(b){ const st=b._st||0; unitsNear(UGRID.inf, b.x, b.z, b.r+2.5+st, _bcI); unitsNear(UGRID.air, b.x, b.z, b.r+16+st, _bcT); _bcA.length=0; for(const e of _bcI) _bcA.push(e); for(const e of _bcT) _bcA.push(e); return _bcA; }   // Z172 only the units near the round
export function updateBullets(dt, now){
  const lim = UNDER.on ? 1e4 : ARENA-1;   // Z226 the underground base lies beyond the arena
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    if(b.homing && b.owner==='p'){ // our fire teams' rockets at a helicopter: plain homing toward the nearest enemy
      let best=null, bd=1e9; for(const e of enemies){ const d=(e.pos.x-b.x)**2+(e.pos.z-b.z)**2; if(d<bd){bd=d;best=e;} }
      if(best){ const want=Math.atan2(best.pos.x-b.x,best.pos.z-b.z), da=wrapAngle(want-b.angle);
        b.angle=wrapAngle(b.angle+da*Math.min(1,dt*b.homing)); const sp=Math.hypot(b.vx,b.vz);
        b.vx=Math.sin(b.angle)*sp; b.vz=Math.cos(b.angle)*sp; } }
    b._hx=b.x; b._hz=b.z; ballisticStep(b, dt);   // Z228b drag / motor along the round's velocity curve · Z232 _hx/_hz = where this frame's path starts (NOT _sx/_sz: fx/hitfx.js shellTrail owns those)
    b.x+=b.vx*dt; b.z+=b.vz*dt; b.life-=dt; b._st=Math.hypot(b.x-b._hx, b.z-b._hz);
    let landed=false;
    if(b.arc){ b.by+=b.vy*dt; b.vy-=ARC_G*dt; if(b.by<=0.3 && b.vy<0){ b.by=0.3; landed=true; } }   // ballistic shell: up, over, and DOWN into the ground
    if(b.line){ b.by=b.wy0+b.slope*Math.hypot(b.x-b.ox, b.z-b.oz)-heightAt(b.x,b.z); if(b.by<0.05){ b.by=0.05; landed=true; } }   // Z314 on along its straight line — into a rise, a mound or the ground past its mark wherever the line meets the earth
    else if(b.vyl) b.by=Math.max(0.3, b.by+b.vyl*dt);                                                      // plunging fire (tower guards shooting down)
    const _gy=heightAt(b.x,b.z);
    const _wy=b.by+_gy; b.mesh.position.set(b.x,_wy,b.z); orientShell(b, _wy, dt);   // Z192 nose along the real flight path
    if(!b.dark && !(b.mesh.userData.rk && fireFxOn())){ const tc=(b.owner==='e' && b.tk<=1)?0xff5a24:b.color, TV=GUNFX.tracer,   /* FIRE 2 a rocket is no tracer: its light is the motor's flame (fx/blasts.js rocketFlight) */ ts=(b.r||0.45)*BVIS*1.7*b.tk*ballisticTrailK(b)*(b.sa?TV.mgTrail:TV.trail), tl=(0.16+(b.r||0.45)*0.24)*(1+(b.tk-1)*0.6)*(b.sa?TV.mgLife:1); addTrail(b.x, _wy, b.z, tc, ts, tl);   // per-gun glowing tracer (enemy = danger-red); heavier rounds leave a fatter, longer streak   · Z222 trailK draws a gun's tracer fatter / longer · Z223 an enemy tracer keeps its own green
      if(b._lx!=null){ const gx=b.x-b._lx, gy=_wy-b._ly, gz=b.z-b._lz, n=Math.min(MOBILE?3:6, Math.floor(Math.hypot(gx,gz)/(ts*0.7))); for(let k=1;k<=n;k++){ const f=k/(n+1); addTrail(b._lx+gx*f, b._ly+gy*f, b._lz+gz*f, tc, ts, tl*(0.75+0.25*f)); } }
      b._lx=b.x; b._ly=_wy; b._lz=b.z; vaporWake(b, b.x, _wy, b.z); }   // Z192 the gap a fast round jumps each frame is filled in: one unbroken streak, not a string of beads
    if(b.mesh.userData.rk) rocketExhaust(b, b.x, _wy, b.z); else if(!b.dark) shellTrail(b, b.x, _wy, b.z);   // (Z419 a dark ball round leaves nothing to see)   // Z210 every other round: its own light smoke line
    if(b.owner==='e') nearMiss(b, S.player);   // Z192 motor flame + a long, lingering smoke ribbon (was a short puff, and the missile's sat at ground level)
    const airborne = b.arc && b.by>3.0, aaHigh = !!b.airAim && b.by>3.0;   // (Z313 aaHigh: a round climbing to an aircraft clears the cover and the traffic, and can still strike it)   // lofted missiles / high shells sail over cover & bystanders — they strike on the way down

    const overRange = !b.arc && b.maxDist && ((b.x-b.ox)**2+(b.z-b.oz)**2 > b.maxDist*b.maxDist);   // shells in flight always come down somewhere
    if(b.life<=0 || overRange || Math.abs(b.x)>lim || Math.abs(b.z)>lim){ if(b.owner==='p'&&b.aoe) detonate(b); else if(Math.abs(b.x)<lim && Math.abs(b.z)<lim){ groundHit(b.x, b.z, b.r||0.45); if(!b.inf && b.dmg>=30) dirtGeyser(b.x, b.z, Math.min(1.6, 0.7+b.dmg/120)); if(b.owner==='p' && b.dmg>=20) tunnelBlast(b.x, b.z, 1.2, b.dmg); } recycleBullet(i); continue; }
    if(b.owner!=='e'){ const px=b.x-b.vx*dt, pz=b.z-b.vz*dt, wb=fortIntactCross(px, pz, b.x, b.z);   // Z170 a sealed fortress: the round strikes the wall, however high it flies
      if(wb && wb!==b.ignore){ damageBlock(wb, b.dmg*structMul(b.type, wb)*(b.owner==='p'?siegeMul():1)); surfaceHit(wb, b); blockImpactFX(wb, b); b.x=px; b.z=pz; if(b.owner==='p'&&b.aoe) detonate(b); recycleBullet(i); continue; } }
    // terrain blocks are cover — bullets break bricks / bounce off steel, then stop
    // Z204 any round that strikes something solid goes off against it (flash, fireball for a shell, chips, dust) and leaves its mark — breakable or not
    if(b.owner==='p' && DW.list.length && droneShot(b, _wy)){ if(b.aoe) detonate(b); recycleBullet(i); continue; }   // DRONE 3 a round through an enemy drone's sphere brings it down (campaign/drone-raid.js)
    if(b.owner==='p' && b.airAim && b.airAim._twr){ const G=b.airAim; if(G.gd.alive && Math.hypot(G.pos.x-b.x, G.pos.z-b.z)<1.4 && Math.abs(_wy-G.pos.y)<1.5){ shootGuard(G.t, G.gd, b.ox, b.oz); if(b.aoe) detonate(b); recycleBullet(i); continue; } }   // Z334 a round laid on a man up on a tower or a wall drops him
    if(b.owner==='p') fenceShot(b);   // Z205 the compound wire takes rounds too
    if(b.owner==='p' && !airborne && !aaHigh && trafficShot(b, dt)){ if(b.aoe) detonate(b); recycleBullet(i); continue; }   // Z306 a round that crosses a car or a scooter strikes it
    if(!airborne && !aaHigh && !b.inf && b.dmg>=TREEFALL.minDmg) shotTree(b.x, b.z, b.by, b.vx, b.vz);   // Z262 a shell through a trunk fells the tree along its flight
    // Z380 the first solid thing on the round's whole stretch this frame (from _hx/_hz, not only where it ends up — a fast round used to step over a thin
    //   wall), by its true footprint and height: the round goes no further than its face, and strikes it unless a man stood in front of it (below)
    const low = b.by < FORT.wallH+0.4;                                // Z111b below the parapet → a fortress wall stops it, even a lobbed shell
    let wb=null; { const py=b._py ?? _wy; b._py=_wy;
      if(!aaHigh && (!airborne || low)){ _bk.b=b; _bk.low=low; _bk.air=airborne; const h=lineHit(b._hx, py, b._hz, b.x, _wy, b.z, b.r, b.line ? LINE.over : 1e4, _bskip);   // (a line round flies over a block only well clear of its top; any other strikes its footprint)
        if(h){ wb=h.bl; b.x=b._hx+(b.x-b._hx)*h.t; b.z=b._hz+(b.z-b._hz)*h.t; b.mesh.position.set(b.x, py+(_wy-py)*h.t, b.z); } } }
    let hit=false;
    if(b.owner==='p' && !airborne){       // a lobbed shell high in its arc strikes nothing on the way
      for(const e of bulletCands(b)){ if(wb && pastFace(b, e.pos.x, e.pos.z)) continue; sweepPoint(b._hx, b._hz, b.x, b.z, e.pos.x, e.pos.z, _sw); const dx=e.pos.x-_sw.x, dz=e.pos.z-_sw.z; if(e.def.inf && dx*dx+dz*dz<9) suppress(e, dt*(1.1+b.dmg*0.03));   // Z173 a near miss pins him
        if(dx*dx+dz*dz < (b.r+e.r*2.2)**2 && (dx*dx+dz*dz < (b.r+(b.airAim && e.def.air ? Math.max(e.r, AIRAIM.hitR) : e.r))**2 && (!b.airAim || !e.def.air || Math.abs(_wy-e.pos.y) < Math.max(AIRAIM.hTol, (e.r||2)*0.8))) && lineH(b, _wy, e)){ b.x=_sw.x; b.z=_sw.z; b.mesh.position.x=b.x; b.mesh.position.z=b.z;
          const tm = typeMul(b.type, armorOf(e))*envDmg(b.type); let dmg=b.dmg*bulletFalloff(b)*tm; if(b.type) effectFeedback(tm, e.pos);   // damage class × armour × range × conditions
          e._fx=b.fx;                               // remember which gun's style killed it → styled death blast
          e._big = !b.inf && (b.aoe>0 || b.dmg>=30); e._blast=null; e._hitK=b.dmg/40; { const L=Math.hypot(b.vx,b.vz)||1; e._hx=b.vx/L; e._hz=b.vz/L; }
          if(e.def.inf) bloodSpurt(e.pos.x, e.pos.z, b.vx, b.vz, b.inf ? 0.7 : 1.4);   // Z113 every hit on a man shows   // Z112 a heavy round throws a soldier; small arms just drop him
          if(e.def.inf && !b.inf && LETHAL.heavyKills) dmg=Math.max(dmg, e.hp+1);   // Z104 a heavy round (AP slug, rocket, grenade) = one dead man
          if(b.reach) medalShot(e, b); damageEnemy(e, dmg); if(b.reach) hitConfirm(e.hp<=0);   // GUN 3 his own round struck: the mark at the crosshair, the click (actors/gun-feel.js)
          const _bl=Math.hypot(b.vx,b.vz)||1, _imp=Math.min(15, (2.2+b.dmg*0.08)*(b.knock||1))/(e.def.scale||1);   // shove back along the shot; per-gun KNOCK; heavy tanks resist
          e.kbx+=(b.vx/_bl)*_imp; e.kbz+=(b.vz/_bl)*_imp; e.hitT=Math.max(e.hitT,0.16);
          if(b.chain){ let hits=b.chain;                                                                               // TESLA: arc to nearby enemies
            for(const e2 of enemies.slice()){ if(e2===e||hits<=0) continue; const cx=e2.pos.x-e.pos.x, cz=e2.pos.z-e.pos.z;
              if(cx*cx+cz*cz < b.chainR*b.chainR && !fortIntactCross(e.pos.x, e.pos.z, e2.pos.x, e2.pos.z)){ e2._fx='shock'; _ca.set(e.pos.x, heightAt(e.pos.x,e.pos.z)+1.3, e.pos.z); _cb.set(e2.pos.x, heightAt(e2.pos.x,e2.pos.z)+1.3, e2.pos.z); lightning(_ca, _cb, 0x7fc0ff, 0.18, 0.26); damageEnemy(e2, b.dmg*0.6); ringPulse(e2.pos, 0x7fd0ff, 1.3);
                spawnPart(e2.pos.x,1.4,e2.pos.z,(Math.random()-0.5)*6,4,(Math.random()-0.5)*6,{color:0x9fe0ff,size:0.9,life:0.2,grav:0,drag:6}); hits--; } } }
          if(e.def.inf && b.fx!=='blast' && b.fx!=='shock') sfx('flesh', e.pos, 0.6+Math.min(0.8, b.dmg/40)); else impactFX(b.mesh.position, b.fx, Math.min(3.2, 1 + b.dmg/26)); hit=true;   // per-gun impact spray (spark/blast/pierce/shock) — HIT 1 a round into a MAN: the flesh thwack and his blood (above), not the armour's ring, sparks and glowing shards
          if(b.pierce>0){ b.pierce--; } else break; } }
    } else if(b.owner!=='p'){ // enemy bullet — Z237 only an ENEMY round can hit him
      const p=S.player;
      sweepPoint(b._hx, b._hz, b.x, b.z, p.pos.x, p.pos.z, _sw); const dpx=p.pos.x-_sw.x, dpz=p.pos.z-_sw.z;   // Z228b swept
      if(!b.dodged && !(wb && pastFace(b, p.pos.x, p.pos.z)) && dpx*dpx+dpz*dpz < (b.r+p.radius*2.2)**2 && Math.hypot(_sw.x-p.pos.x, _sw.z-p.pos.z) < p.radius+b.r && lineH(b, _wy, p) && !(dodgeShot(p) && (b.dodged=true))){ const _was=now>=p.invincibleUntil; damagePlayer(b.dmg, now, b.vx, b.vz, b.aoe>0 ? 'blast' : 'shot', _wy-heightAt(p.pos.x,p.pos.z)-(p.lift||0));   /* HIT 1 a shell that bursts on him is a blast; a round: how high it struck (his plate carrier) */   // Z377 a roll (or a hard run) makes it miss: it flies on past him
        if(_was){ const _bl=Math.hypot(b.vx,b.vz)||1, _imp=Math.min(11,2.8+b.dmg*0.12); p.kbx+=(b.vx/_bl)*_imp; p.kbz+=(b.vz/_bl)*_imp; }   // shoved clearly back along the shot — feel the hit
        else if(now < p.shieldUntil){ p.shieldHit=now; ringPulse({x:b.x,z:b.z}, 0x9ff0ff, 1.5); conqShieldHit(b, now);   /* CONQ 1 the lava shield throws it back */   // shield absorbs the shot → flash + ripple at the impact point
          spawnPart(b.x,1.3,b.z,(Math.random()-0.5)*5,3,(Math.random()-0.5)*5,{color:0xbff2ff,size:0.7,life:0.22,grav:0,drag:5}); }
        hit=true; }
      if(!hit && CO.ai && coopBulletMate(b, _wy)) hit=true;   // COOP 5 on a co-op host the guest's soldier is struck like the host's own (the damage is sent to him)
      if(!hit) for(const s of FT){ const dx=s.pos.x-b.x, dz=s.pos.z-b.z; if(dx*dx+dz*dz<9) suppress(s, dt*1.4); }   // Z173 our men get pinned too
      if(!hit) for(const s of FT){ const dx=s.pos.x-b.x, dz=s.pos.z-b.z, hr=s.g.userData.stance==='prone'?SQUAD.proneHitR:SQUAD.standHitR; if(dx*dx+dz*dz < (b.r+hr)**2 && lineH(b, _wy, s, true)){ bloodSpurt(s.pos.x, s.pos.z, b.vx, b.vz, b.inf?0.7:1.6); sfx('flesh', s.pos, 0.6); damageAlly(s, (b.inf||!LETHAL.heavyKills) ? b.dmg : 999); hit=true; break; } }   // Z89 fireteam can be hit · Z104 a tank shell kills outright   // Z105 a man lying flat is a much smaller target
      if(!hit) for(const s of soldiers){ const dx=s.pos.x-b.x, dz=s.pos.z-b.z;     // soldiers body-block incoming fire (and take the hit)
        if(dx*dx+dz*dz < (b.r+1.15)**2){ damageSoldier(s, b.dmg); bloodSpurt(s.pos.x, s.pos.z, b.vx, b.vz, 0.8); sfx('flesh', s.pos, 0.6); hit=true; break; } }   // HIT 1 one of ours bleeds (was an orange flash ring)
      if(!hit && core){ const dcx=core.pos.x-b.x, dcz=core.pos.z-b.z;
        if(dcx*dcx+dcz*dcz < (b.r+core.r)**2){ damageCore(b.dmg); ringPulse(b.mesh.position,0xe0603a,2); hit=true; } }
    }
    if(hit && b.aoe){ detonate(b); recycleBullet(i); }
    else if(hit && b.pierce<=0) recycleBullet(i);
    else if(wb){ strikeBlock(b, wb); recycleBullet(i); }   // Z380 nobody in front of it: the round strikes the wall / house / cover it reached
    else if(landed && !hit){ if(b.owner==='p'&&b.aoe) detonate(b); else { groundHit(b.x,b.z,b.r||0.45); if(b.trc) tracerHit(b.x, _gy+0.1, b.z);   /* FIRE 4 a tracer's compound burns on for a moment where it went in */ if(!b.inf && b.dmg>=30) dirtGeyser(b.x, b.z, Math.min(1.6, 0.7+b.dmg/120)); } recycleBullet(i); }   // shell lands: burst / dirt + scar
  }
}

// Z380 what a round in flight leaves out: what its shooter stands on or in (the guard's own tower, the wall under a rifleman), our own walls for
//   our rounds, a fortress wall above its parapet, anything at all while it is lofted high
const _bk={ b:null, low:false, air:false }, _bskip=bl=>{ const b=_bk.b; return bl===b.ignore || (b.thin && COVER_HP[bl.kind]<=b.thin && ++CQ.st.thru) || (b.owner==='e' && bl===climbPerch()) || (bl.ours && b.owner==='p') || (bl.fort ? !_bk.low : _bk.air) || inShape(bl, b.ox, b.oz); };
// a body beyond the face the round stopped at this frame (behind the tree, the wall, the cover): out of its reach, however close to the face
function pastFace(b, x, z){ const dx=b.x-b._hx, dz=b.z-b._hz; return (x-b._hx)*dx+(z-b._hz)*dz > dx*dx+dz*dz; }
// a round strikes the solid thing it reached: their fire never hurts their own objective; it chips stone it cannot break; anything else takes it
function strikeBlock(b, bl){ if(!((bl.kind==='obj' || bl.supply) && b.owner==='e')){   // Z194 nor their own supply bases
    if(!(((bl.fort || bl.hard) && b.owner==='e') || ((bl.hard || bl.heavy) && b.inf) || sandProof(bl, b))) damageBlock(bl, b.dmg*structMul(b.type, bl)*(b.owner==='p'?siegeMul():(bl.heavy?0.4:1)));   // Z193 rifle rounds only chip concrete / steel · Z111b their own walls soak their fire · Z418 sandbags shrug off small arms
    surfaceHit(bl, b); blockImpactFX(bl, b); }
  if(b.owner==='p'&&b.aoe) detonate(b); }
