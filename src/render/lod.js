// render/lod.js — Z107 RENDER BUDGET: trims draw calls where the eye can't tell — soldier shadows only near the tank, tower / wall riflemen hidden out of range, HP bars only once hurt.
import { LOD } from '../../config.js';
import { FT, MOBILE, S, enemies, riders, towers } from '../hub.js';

let _at=0;
function castNear(g, near){ const u=g.userData; if(u._cs===near) return; u._cs=near; g.traverse(o=>{ if(o.isMesh) o.castShadow=near; }); }
export function updateLOD(now){ if(now<_at) return; _at=now+LOD.every; const p=S.player; if(!p) return; const px=p.pos.x, pz=p.pos.z, R2=LOD.shadowR*LOD.shadowR, G2=LOD.guardR*LOD.guardR;
  if(!MOBILE){
    for(const a of FT){ const dx=a.pos.x-px, dz=a.pos.z-pz; castNear(a.g, dx*dx+dz*dz<R2); }
    for(const e of enemies){ if(!e.def.inf) continue; const dx=e.pos.x-px, dz=e.pos.z-pz; castNear(e.mesh, dx*dx+dz*dz<R2); }
    for(const r of riders) castNear(r.g, false);                                     // the crew rides on the hull — the hull's shadow covers them
  }
  for(const t of towers){ if(t.falling) continue; const dx=t.x-px, dz=t.z-pz, far=dx*dx+dz*dz > G2+(t.fort?t.fort.R*t.fort.R*2:0);
    for(const gd of t.guards){ if(!gd.alive) continue; if(gd.g.visible===far) gd.g.visible=!far; if(!gd._cs){ gd._cs=1; castNear(gd.g, false); } } }
}
// HP bars only when it matters (hurt, elite, commander) — two draws saved per healthy unit
export function barWanted(e){ return e.hp < e.maxHp-0.5 || e.elite || e.commander; }
