// combat/aim.js — Z104 aim policy: desktop aims with the mouse; MOBILE: Z233 the turret tracks the enemy itself (AIM.mobileFixed=true restores the old barrel-on-the-hull mode)
import { AIM } from '../../config.js';
import { MOBILE, PAD, S, blocks, boss, enemies, nearestTarget, tentHidesFromPlayer } from '../hub.js';

// true when the turret is locked to the hull (phones/tablets: no mouse to lay the gun)
export function barrelFixed(){ return MOBILE && AIM.mobileFixed && !PAD.active; }   // Z117 with a controller the right stick aims, even on a phone
// nearest enemy straight AHEAD of the hull: inside the forward cone, or within a narrow lane for targets close by
export function aheadTarget(maxR, cone){
  const p=S.player; if(!p) return null; const fx=Math.sin(p.facing), fz=Math.cos(p.facing), tc=Math.tan(cone||AIM.cone);
  let best=null, bd=maxR;
  const consider=(t, r)=>{ const dx=t.pos.x-p.pos.x, dz=t.pos.z-p.pos.z, ahead=dx*fx+dz*fz; if(ahead<=0 || ahead>=bd) return;
    const side=Math.abs(dx*fz-dz*fx); if(side <= Math.max(AIM.lane, ahead*tc) + (r||0)){ bd=ahead; best=t; } };
  for(const e of enemies) if(!e.abandoned && !tentHidesFromPlayer(e)) consider(e, e.r||0.6);   // Z116 an abandoned hull is a prize, not a target · Z402 nor one behind a tent
  if(boss&&boss.alive) consider(boss, boss.r||3);
  if(!best){ const lim=bd; bd=Math.min(lim, AIM.rockR); for(const b of blocks) if(b.hard) consider({ pos:{ x:b.x, z:b.z }, r:b.r*0.8, block:b }, b.r*0.8); }   // Z120 nothing to fight → a rock / hedgehog blocking the road
  return best; }
// Z233 PHONES: the turret lays itself — it picks the enemy to engage, keeps it (no flicking between two), swings onto it at the turret's
//   real traverse rate and fires only once the barrel is on; with nothing in range it comes back to the bow. The hull drives free.
export function turretTracks(){ return MOBILE && !PAD.active && AIM.mobileTrack && !AIM.mobileFixed; }
export const TRACK={ t:null };
const _alive=t=>t && (t===boss ? !!(boss&&boss.alive) : enemies.includes(t) && !t.abandoned);
export function trackTarget(maxR){ const p=S.player; if(!p) return null; const R2=maxR*maxR, d2=t=>(t.pos.x-p.pos.x)**2+(t.pos.z-p.pos.z)**2;
  const score=t=>{ const a=Math.atan2(t.pos.x-p.pos.x, t.pos.z-p.pos.z); let da=Math.abs(a-(p.aimSmoothed||0)); da=Math.min(da, 6.283-da); return Math.sqrt(d2(t))*(1+0.5*da/Math.PI); };   // near first, and what the gun already faces
  let cur=_alive(TRACK.t) && d2(TRACK.t)<R2 && !tentHidesFromPlayer(TRACK.t) ? TRACK.t : null, best=null, bs=1e9;
  for(const e of enemies){ if(e.abandoned || d2(e)>=R2 || tentHidesFromPlayer(e)) continue; const s=score(e); if(s<bs){ bs=s; best=e; } }   // Z402 a tent hides him
  if(boss && boss.alive && d2(boss)<R2){ const s=score(boss)*0.8; if(s<bs){ bs=s; best=boss; } }
  if(cur && best && best!==cur && bs*AIM.trackSticky > score(cur)) best=cur;   // keep the one we're on unless another is clearly better
  TRACK.t=best||null; return TRACK.t; }
// is the barrel laid on it? (within the target's own width, at least trackTol)
export function trackOnTarget(t){ const p=S.player; if(!p||!t) return false; const dx=t.pos.x-p.pos.x, dz=t.pos.z-p.pos.z, d=Math.hypot(dx,dz)||1;
  let da=Math.abs(Math.atan2(dx,dz)-(p.aimSmoothed||0)); da=Math.min(da, 6.283-da); return da < Math.max(AIM.trackTol, Math.atan((t.r||1)*1.1/d)); }
// the one call every weapon uses to pick what it is shooting at
export function aimTarget(maxR, cone){ return barrelFixed() ? aheadTarget(maxR, cone) : turretTracks() ? trackTarget(maxR) : nearestTarget(maxR); }
