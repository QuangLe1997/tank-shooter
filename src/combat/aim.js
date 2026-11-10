// combat/aim.js — Z104 aim policy: desktop aims with the mouse; MOBILE has the barrel FIXED to the hull (shoot where you face)
import { AIM } from '../../config.js';
import { MOBILE, S, boss, enemies, nearestTarget } from '../hub.js';

// true when the turret is locked to the hull (phones/tablets: no mouse to lay the gun)
export function barrelFixed(){ return MOBILE && AIM.mobileFixed; }
// nearest enemy straight AHEAD of the hull: inside the forward cone, or within a narrow lane for targets close by
export function aheadTarget(maxR, cone){
  const p=S.player; if(!p) return null; const fx=Math.sin(p.facing), fz=Math.cos(p.facing), tc=Math.tan(cone||AIM.cone);
  let best=null, bd=maxR;
  const consider=(t, r)=>{ const dx=t.pos.x-p.pos.x, dz=t.pos.z-p.pos.z, ahead=dx*fx+dz*fz; if(ahead<=0 || ahead>=bd) return;
    const side=Math.abs(dx*fz-dz*fx); if(side <= Math.max(AIM.lane, ahead*tc) + (r||0)){ bd=ahead; best=t; } };
  for(const e of enemies) consider(e, e.r||0.6);
  if(boss&&boss.alive) consider(boss, boss.r||3);
  return best; }
// the one call every weapon uses to pick what it is shooting at
export function aimTarget(maxR, cone){ return barrelFixed() ? aheadTarget(maxR, cone) : nearestTarget(maxR); }
