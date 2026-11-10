// ai/cover.js — Z104 COVER: a soldier who sees a tank coming puts a wall, rock or sandbag line between it and himself (both sides)
import { blocks } from '../hub.js';

export const COVER_KINDS = new Set(['sandbag','drums','tires','crates','pipes','concrete','hesco','brick','boulder','hedgehog','tower','camp','parked']);
// best hiding spot within maxR of (x,z): the far side of a solid block as seen from the threat (tx,tz); null when nothing is near
export function coverSpot(x, z, tx, tz, maxR){ let best=null, bs=1e9; const dThreat=Math.hypot(x-tx, z-tz);
  for(const b of blocks){ if(!COVER_KINDS.has(b.kind) || !(b.hp>0)) continue; const dx=b.x-x, dz=b.z-z; if(dx*dx+dz*dz > maxR*maxR) continue;
    const ax=b.x-tx, az=b.z-tz, al=Math.hypot(ax,az)||1, off=(b.obb?Math.max(b.obb.hw,0.8):(b.r||1.4))+0.85;
    const cx=b.x+ax/al*off, cz=b.z+az/al*off, travel=Math.hypot(cx-x, cz-z);
    const charge = Math.hypot(cx-tx, cz-tz) < dThreat-3 ? travel*0.6 : 0;          // running TOWARD the tank to reach cover is a bad plan
    const sc=travel+charge; if(sc<bs){ bs=sc; best={ x:cx, z:cz, b }; } }
  return best; }
export function atCover(pos, c){ return !!c && Math.hypot(pos.x-c.x, pos.z-c.z) < 1.3; }
