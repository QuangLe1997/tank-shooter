// ai/fieldcraft.js — Z220 FIELDCRAFT, for the soldiers of BOTH sides:
//   · LINE OF FIRE — a rifleman no longer empties his magazine into a house, a fortress wall or a boulder: a blocked line means no shot, and he
//     edges out sideways (or a step forward) to the nearest spot with a clear view of his man, then fires from there
//   · FRAG GRENADES — men behind cover or bunched together get a grenade lobbed in on a real arc; it lands, lies there for a heartbeat (a thin red
//     ring marks an enemy one) and goes off — and everyone close to a live grenade, ours or theirs, runs from it
//   · SMOKE — a squad that falls back, or has to cross open ground under heavy fire, throws a smoke screen between itself and the enemy; rounds
//     fired through the cloud go wild (both directions)
import * as THREE from 'three';
import { FIELDCRAFT } from '../../config.js';
import { MOBILE, S, blastAllies, blocksNear, damageEnemy, enemies, floatText, heightAt, inBlock, infBlastK, scene, sfx, spawnPart } from '../hub.js';

const FC=FIELDCRAFT, _lb=[];
// a "tall" obstacle stops a rifle round dead: buildings, fortress walls, masonry, towers, containers, boulders (sandbags, drums, logs… are shot over)
function tall(bl){ return bl.heavy || bl.fort || bl.wall || bl.kind==='building' || bl.kind==='tower' || bl.kind==='container' || bl.kind==='boulder' || bl.kind==='camp'; }
export function losBlocked(x0, z0, x1, z1){ const dx=x1-x0, dz=z1-z0, D=Math.hypot(dx,dz), L=FC.los; if(D<L.endSkip*2+0.5) return false; const ux=dx/D, uz=dz/D;
  for(let s=L.endSkip; s<D-L.endSkip; s+=L.step){ const x=x0+ux*s, z=z0+uz*s;
    for(const bl of blocksNear(x, z, 0.6, _lb)){ if(tall(bl) && inBlock(bl, x, z, 0.3)) return true; } }
  return false; }
function standable(x, z){ for(const bl of blocksNear(x, z, 0.9, _lb)) if(inBlock(bl, x, z, 0.55)) return false; return true; }
// the nearest spot round the obstacle with a clear line to (tx,tz): sideways first, then sideways-and-forward (null = nowhere close)
export function peekSpot(x, z, tx, tz){ const dx=tx-x, dz=tz-z, D=Math.hypot(dx,dz)||1, ux=dx/D, uz=dz/D;
  for(const fwd of [0, 2.5]) for(const o of FC.los.peekOff){ const px=x+uz*o+ux*fwd, pz=z-ux*o+uz*fwd; if(standable(px, pz) && !losBlocked(px, pz, tx, tz)) return [px, pz]; }
  return null; }
// one step of the "find a firing position" habit: true while the man is walking to his peek spot (u = the soldier record, any side)
export function peekMove(u, now, out){ if(!u.peek || now>u.peekUntil) { u.peek=null; return false; } const dx=u.peek[0]-u.pos.x, dz=u.peek[1]-u.pos.z, d=Math.hypot(dx,dz);
  if(d<FC.los.peekR){ u.peek=null; return false; } out.x=dx/d; out.z=dz/d; return true; }
export function wantPeek(u, tx, tz, now){ if(u.peek && now<u.peekUntil) return; u.peek=peekSpot(u.pos.x, u.pos.z, tx, tz); u.peekUntil=now+FC.los.peekHold; }

// ================= SMOKE SCREENS =================
export const SMOKES=[];
export function throwSmoke(x, z, side, now){ const C=FC.smoke; SMOKES.push({ x, z, R:C.R, until:now+C.life, side, puffAt:0, t0:now });
  for(let k=0;k<(MOBILE?7:12);k++){ const a=Math.random()*6.283, r=Math.random()*C.R*0.7; spawnPart(x+Math.cos(a)*r, heightAt(x,z)+0.6+Math.random()*1.4, z+Math.sin(a)*r, Math.cos(a)*1.4, 0.5+Math.random()*0.5, Math.sin(a)*1.4,
    { color:side==='e'?0xd9d6cc:0xdfe3dc, size:2.6+Math.random()*1.4, life:3.4+Math.random(), smoke:true, grav:0.06, drag:1.0, grow:1.7, op:0.62, keep:true }); }
  sfx('whoosh', { x, z }, 0.5); }
function updateSmokes(dt, now){ const C=FC.smoke;
  for(let i=SMOKES.length-1;i>=0;i--){ const s=SMOKES[i]; if(now>s.until){ SMOKES.splice(i,1); continue; }
    if(now>s.puffAt && now<s.until-2.6){ s.puffAt=now+C.puffEvery*(MOBILE?1.8:1); const a=Math.random()*6.283, r=Math.random()*s.R*0.8, gy=heightAt(s.x,s.z);   // the canisters keep pouring
      spawnPart(s.x+Math.cos(a)*r, gy+0.5+Math.random()*1.8, s.z+Math.sin(a)*r, (Math.random()-0.5)*0.8, 0.3+Math.random()*0.4, (Math.random()-0.5)*0.8,
        { color:s.side==='e'?0xd9d6cc:0xdfe3dc, size:3.0+Math.random()*1.6, life:3.6+Math.random()*1.2, smoke:true, grav:0.05, drag:1.0, grow:1.6, op:0.58, keep:true }); } } }
// does a shot from (x0,z0) to (x1,z1) pass through a smoke cloud? → aim multiplier
export function smokeSpreadK(x0, z0, x1, z1){ if(!SMOKES.length) return 1; const dx=x1-x0, dz=z1-z0, L2=dx*dx+dz*dz||1;
  for(const s of SMOKES){ const t=Math.max(0, Math.min(1, ((s.x-x0)*dx+(s.z-z0)*dz)/L2)), qx=x0+dx*t-s.x, qz=z0+dz*t-s.z; if(qx*qx+qz*qz < s.R*s.R) return FC.smoke.spreadMul; }
  return 1; }

// ================= FRAG GRENADES =================
export const NADES=[]; const NG=new THREE.SphereGeometry(0.13, 8, 6), NM=new THREE.MeshStandardMaterial({ color:0x3a4228, roughness:0.6, metalness:0.4 });
const RING_G=new THREE.RingGeometry(FC.nade.R*0.92, FC.nade.R, 56); RING_G.rotateX(-Math.PI/2);
const _lastThrow={ e:-99, p:-99 }; let _barkAt=-99;
export function liveNades(side){ let n=0; for(const g of NADES) if(g.side===side) n++; return n; }
// side 'e' = thrown by the enemy (hurts our men), 'p' = by ours (hurts theirs)
export function throwNade(side, fx, fz, tx, tz, now){ const N=FC.nade, d=Math.hypot(tx-fx, tz-fz), er=N.err[0]+Math.random()*(N.err[1]-N.err[0])*Math.min(1, d/N.maxD), ea=Math.random()*6.283;
  const m=new THREE.Mesh(NG, NM); m.castShadow=!MOBILE; scene.add(m);
  const g={ side, m, x0:fx, z0:fz, y0:heightAt(fx,fz)+1.5, x1:tx+Math.cos(ea)*er, z1:tz+Math.sin(ea)*er, t:0, T:0.7+d/26, peak:1.8+d*0.13, landed:false, boomAt:0, ring:null };
  g.boomAt=g.T+N.fuseGround; NADES.push(g); _lastThrow[side]=now; sfx('click', { x:fx, z:fz }, 0.5); return g; }
function nadeBoom(g, now){ const N=FC.nade, x=g.x1, z=g.z1, y=heightAt(x,z);
  spawnPart(x, y+0.4, z, 0, 0, 0, { tex:'flash', color:0xfff2d0, size:4.2, life:0.07, grav:0, drag:8 });
  spawnPart(x, y+0.5, z, 0, 0.6, 0, { tex:'fire', color:0xffe0a0, color2:0xff6a1a, size:1.8, grow:1.4, life:0.22, grav:0, drag:4 });
  for(let k=0;k<(MOBILE?6:11);k++){ const a=Math.random()*6.283, v=3+Math.random()*5; spawnPart(x, y+0.3, z, Math.cos(a)*v, 3+Math.random()*5, Math.sin(a)*v, { color:0x5a4a36, size:0.18+Math.random()*0.15, life:0.8, grav:-16, drag:0.6 }); }   // dirt
  spawnPart(x, y+0.8, z, 0, 0.8, 0, { color:0x8a8478, size:2.6, life:1.8, smoke:true, grav:0.2, drag:1.4, grow:1.8, op:0.55, keep:true });
  sfx('explode', { x, z }, 0.55); const p=S.player; if(p && Math.hypot(p.pos.x-x, p.pos.z-z)<16) S.shake=Math.min(3, S.shake+0.25);
  if(g.side==='e') blastAllies(x, z, N.R, N.dmgE*(1+(S.stage-1)*0.06));
  else for(const e of enemies.slice()){ if(!e.def.inf || e.dead) continue; const k=infBlastK(Math.hypot(e.pos.x-x, e.pos.z-z), N.R); if(k<=0) continue;
    e._blast={ x, z }; e._hitK=1+1.2*k; e._fx='blast'; damageEnemy(e, k>=1 ? e.hp+1 : N.dmgA*k*(1+(S.stage-1)*0.08)); } }
function updateNades(dt, now){
  for(let i=NADES.length-1;i>=0;i--){ const g=NADES[i]; g.t+=dt;
    if(!g.landed){ const u=Math.min(1, g.t/g.T), x=g.x0+(g.x1-g.x0)*u, z=g.z0+(g.z1-g.z0)*u, gy=heightAt(x,z), y=g.y0+(gy+0.13-g.y0)*u + g.peak*4*u*(1-u);
      g.m.position.set(x, y, z); g.m.rotation.x+=dt*14; g.m.rotation.z+=dt*9;
      if(u>=1){ g.landed=true; spawnPart(g.x1, gy+0.1, g.z1, 0, 0.6, 0, { color:0x8a7a60, size:0.6, life:0.4, smoke:true, grav:0, drag:3, op:0.4 }); sfx('thud', { x:g.x1, z:g.z1 }, 0.25);
        if(g.side==='e'){ const r=new THREE.Mesh(RING_G, new THREE.MeshBasicMaterial({ color:0xff3a2a, transparent:true, opacity:0.8, depthWrite:false })); r.position.set(g.x1, gy+0.08, g.z1); r.renderOrder=3; scene.add(r); g.ring=r; } } }
    else if(g.ring){ g.ring.material.opacity = Math.sin(now*28)>0 ? 0.85 : 0.2; }
    if(g.t>=g.boomAt){ nadeBoom(g, now); scene.remove(g.m); if(g.ring){ scene.remove(g.ring); g.ring.material.dispose(); } NADES.splice(i,1); } } }
// run from the nearest live grenade (any side) close enough to hurt: a unit vector, or null
export function nadeFlee(pos, out){ const N=FC.nade; let best=null, bd=N.flee*N.flee;
  for(const g of NADES){ if(g.boomAt-g.t > N.warnT) continue; const q=(pos.x-g.x1)**2+(pos.z-g.z1)**2; if(q<bd){ bd=q; best=g; } }
  if(!best) return null; const dx=pos.x-best.x1, dz=pos.z-best.z1, d=Math.hypot(dx,dz)||1; out.x=dx/d; out.z=dz/d; return best; }
// our men shout the warning (rate-limited)
export function nadeBark(pos, now){ if(now-_barkAt<5) return; _barkAt=now; floatText('LỰU ĐẠN! TẢN RA!', '#ff8a5a', new THREE.Vector3(pos.x, 2.6, pos.z), 13); }
// pick a grenade target among `foes` (each {pos, cover?}): someone in cover, or a knot of men; null = not worth a grenade
export function nadeTarget(x, z, foes, coverOf){ const N=FC.nade; let best=null, bs=N.score-0.01;
  for(const f of foes){ const d=Math.hypot(f.pos.x-x, f.pos.z-z); if(d<N.minD || d>N.maxD) continue; let s=1+(coverOf(f)?1.5:0);
    for(const o of foes){ if(o!==f && (o.pos.x-f.pos.x)**2+(o.pos.z-f.pos.z)**2 < 12.25) s+=1; }
    if(s>bs){ bs=s; best=f; } }
  return best; }
export function canThrow(side, now){ const N=FC.nade; return liveNades(side) < (side==='e'?N.liveE:N.liveA) && now-_lastThrow[side] > (side==='e'?N.gapE:N.gapA); }

export function updateFieldcraft(dt, now){ if(NADES.length) updateNades(dt, now); if(SMOKES.length) updateSmokes(dt, now); }
export function clearFieldcraft(){ for(const g of NADES){ scene.remove(g.m); if(g.ring){ scene.remove(g.ring); g.ring.material.dispose(); } } NADES.length=0; SMOKES.length=0; }
