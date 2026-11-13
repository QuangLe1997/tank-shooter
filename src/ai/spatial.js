// ai/spatial.js — Z172 UNIT GRID: a uniform hash of every unit (rebuilt once a frame) and of the obstacles (rebuilt when they change), so "who / what is near me?" reads a few cells instead of every unit on the field — the per-frame cost stays flat as the battle grows
import { blocks, enemies } from '../hub.js';

const CELL=6, KEY=(cx,cz)=>cx*4096+cz;
export const UGRID={ inf:new Map(), tank:new Map(), blk:new Map(), blkN:-1, blkAt:0, blkR:0 };
function add(M, o, x, z){ const k=KEY(Math.floor(x/CELL), Math.floor(z/CELL)); let a=M.get(k); if(!a){ a=[]; M.set(k,a); } a.push(o); }
// call once a frame before the units move
export function buildUnitGrid(now){
  for(const a of UGRID.inf.values()) a.length=0; for(const a of UGRID.tank.values()) a.length=0;
  for(const e of enemies) add(e.def.inf?UGRID.inf:UGRID.tank, e, e.pos.x, e.pos.z);
  if(blocks.length!==UGRID.blkN || now>UGRID.blkAt){ UGRID.blkN=blocks.length; UGRID.blkAt=now+0.5; for(const a of UGRID.blk.values()) a.length=0;   // obstacles: each in every cell its footprint touches
    for(const b of blocks){ const r=(b.obb ? Math.hypot(b.obb.hl, b.obb.hw) : b.r)+0.6, c0=Math.floor((b.x-r)/CELL), c1=Math.floor((b.x+r)/CELL), d0=Math.floor((b.z-r)/CELL), d1=Math.floor((b.z+r)/CELL);
      for(let cx=c0;cx<=c1;cx++) for(let cz=d0;cz<=d1;cz++){ const k=KEY(cx,cz); let a=UGRID.blk.get(k); if(!a){ a=[]; UGRID.blk.set(k,a); } a.push(b); } } } }
// units of one map within r of (x,z) — candidates only (the caller still checks the exact distance)
export function unitsNear(M, x, z, r, out){ out.length=0; const c0=Math.floor((x-r)/CELL), c1=Math.floor((x+r)/CELL), d0=Math.floor((z-r)/CELL), d1=Math.floor((z+r)/CELL);
  for(let cx=c0;cx<=c1;cx++) for(let cz=d0;cz<=d1;cz++){ const a=M.get(KEY(cx,cz)); if(a) for(let i=0;i<a.length;i++) out.push(a[i]); } return out; }
// obstacles whose footprint reaches the cell of (x,z)
export function blocksAt(x, z){ return UGRID.blk.get(KEY(Math.floor(x/CELL), Math.floor(z/CELL))) || _none; }
const _none=[];
