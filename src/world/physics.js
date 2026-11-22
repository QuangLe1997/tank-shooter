// world/physics.js — PHYSICS: oriented hull boxes (SAT) — the enemy's ground vehicles touch for real, shove by mass, slide with friction, never overlap
//   (no-tanks: the player's hull, its ramming and the boss's charge are gone)

import { BIOME, S, _R, blocks, burst, clampField, core, enemies, haptic, sfx, solidTank, spawnPart, tankVsWall, solidShape } from '../hub.js';

// ----------------------------- PHYSICS: oriented hull boxes (SAT) — tanks touch for real, shove by mass, slide with friction, never overlap -----------------------------
export const HULL_HW=1.52, HULL_HL=2.05*1.36;   // Z174b the real-length hull                                            // hull half-width / half-length (model units, × tank scale)
export function _tb(t){ const s=t.mesh?t.mesh.scale.x:1; return { x:t.pos.x, z:t.pos.z, f:t.facing||0, hw:HULL_HW*s*0.96, hl:HULL_HL*s*0.95 }; }
export function _ax(f){ const s=Math.sin(f), c=Math.cos(f); return [c,-s, s,c]; }   // right axis (x,z), forward axis (x,z)
export function satOBB(A,B){
  const a=_ax(A.f), b=_ax(B.f), dx=B.x-A.x, dz=B.z-A.z; let best=1e9, nx=0, nz=0;
  for(let k=0;k<4;k++){ const ux = k<2 ? a[k*2] : b[(k-2)*2], uz = k<2 ? a[k*2+1] : b[(k-2)*2+1];
    const pa=A.hw*Math.abs(ux*a[0]+uz*a[1]) + A.hl*Math.abs(ux*a[2]+uz*a[3]);
    const pb=B.hw*Math.abs(ux*b[0]+uz*b[1]) + B.hl*Math.abs(ux*b[2]+uz*b[3]);
    const dist=dx*ux+dz*uz, ov=pa+pb-Math.abs(dist); if(ov<=0) return null;
    if(ov<best){ best=ov; const sg=dist<0?-1:1; nx=ux*sg; nz=uz*sg; } }
  return { nx, nz, d:best };
}
export function tankMass(t){
  const d=t.def||{}; return (d.scale||1)*(d.scale||1)*(d.heavy?1.7:1)*(t.elite?1.5:1); }
export function collideTanks(a, b, now){
  const h=satOBB(_tb(a), _tb(b)); if(!h) return 0;
  const ma=tankMass(a), mb=tankMass(b), tot=ma+mb, d=h.d+0.02;
  a.pos.x-=h.nx*d*(mb/tot); a.pos.z-=h.nz*d*(mb/tot); b.pos.x+=h.nx*d*(ma/tot); b.pos.z+=h.nz*d*(ma/tot);   // heavier tank moves less
  const rvx=b.vel.x-a.vel.x, rvz=b.vel.z-a.vel.z, vn=rvx*h.nx+rvz*h.nz; if(vn>=0) return 0;
  const inv=1/ma+1/mb, j=-(1+0.2)*vn/inv;                                     // inelastic steel-on-steel (restitution 0.2)
  a.vel.x-=j*h.nx/ma; a.vel.z-=j*h.nz/ma; b.vel.x+=j*h.nx/mb; b.vel.z+=j*h.nz/mb;
  const tx=-h.nz, tz=h.nx, vt=rvx*tx+rvz*tz, jt=Math.max(-0.55*j, Math.min(0.55*j, -vt/inv));   // Coulomb friction: grinding hulls bleed sideways speed
  a.vel.x-=jt*tx/ma; a.vel.z-=jt*tz/ma; b.vel.x+=jt*tx/mb; b.vel.z+=jt*tz/mb;
  const imp=-vn;
  if(imp>4){ const mx=(a.pos.x+b.pos.x)/2, mz=(a.pos.z+b.pos.z)/2;
    for(let i=0;i<Math.min(14,Math.round(imp*0.8));i++){ const sa=Math.random()*6.283, sp=_R(4,10); spawnPart(mx,_R(0.8,1.6),mz, Math.cos(sa)*sp+tx*_R(-4,4), _R(1,5), Math.sin(sa)*sp+tz*_R(-4,4), {color:Math.random()<0.6?0xffd27a:0xfff2c0, size:_R(0.14,0.3), life:_R(0.15,0.35), grav:-14, drag:2}); }   // steel-on-steel sparks
    burst({x:mx,z:mz}, BIOME.ground, 2, 2, {y:0.5, life:0.7, size:1.4, smoke:true, grav:-0.3, drag:2, up:1, op:0.35});
    a.hitT=Math.max(a.hitT||0, Math.min(0.22, imp*0.012)); b.hitT=Math.max(b.hitT||0, Math.min(0.22, imp*0.012));
    if(a===S.player||b===S.player){ S.shake=Math.min(3, S.shake+imp*0.04); sfx('clang', {x:mx,z:mz}, imp/16); haptic(Math.min(40, imp*2)); } }
  return imp;
}
// tank hull (OBB) vs round obstacle: push out, kill the velocity INTO it, keep a damped slide along it → the tank is deflected
export function tankVsCircle(t, cx, cz, r){
  const B=_tb(t), a=_ax(B.f), dx=cx-B.x, dz=cz-B.z, lx=dx*a[0]+dz*a[1], lz=dx*a[2]+dz*a[3];
  const qx=Math.max(-B.hw,Math.min(B.hw,lx)), qz=Math.max(-B.hl,Math.min(B.hl,lz)); let ex=lx-qx, ez=lz-qz, d=Math.hypot(ex,ez), pen;
  if(d<1e-4){ const px=B.hw-Math.abs(lx), pz=B.hl-Math.abs(lz); if(px<pz){ ex=Math.sign(lx)||1; ez=0; pen=px+r; } else { ex=0; ez=Math.sign(lz)||1; pen=pz+r; } d=1; }
  else { if(d>=r) return 0; pen=r-d; }
  const nlx=ex/d, nlz=ez/d, nx=nlx*a[0]+nlz*a[2], nz=nlx*a[1]+nlz*a[3];   // world normal: hull → obstacle
  t.pos.x-=nx*pen; t.pos.z-=nz*pen;
  if(!t.vel) return 0; const vn=t.vel.x*nx+t.vel.z*nz;
  if(vn>0){ t.vel.x-=nx*vn*1.1; t.vel.z-=nz*vn*1.1; const tx=-nz, tz=nx, vt=t.vel.x*tx+t.vel.z*tz; t.vel.x-=tx*vt*0.1; t.vel.z-=tz*vt*0.1; }
  return vn;
}

// Z245 the field without a player's hull (no-tanks: the only mode): enemies keep apart, round the Core, off cover and walls, inside the fence
export function separateTanks(now){
  for(let i=0;i<enemies.length;i++){ const a=enemies[i]; if(!solidTank(a)) continue; for(let j=i+1;j<enemies.length;j++){ const b=enemies[j]; if(solidTank(b)) collideTanks(a,b,now); }
    if(core){ const cx=a.pos.x-core.pos.x, cz=a.pos.z-core.pos.z, m2=a.r+core.r, cd2=cx*cx+cz*cz; if(cd2<m2*m2 && cd2>1e-4){ const cd=Math.sqrt(cd2), ov=m2-cd; a.pos.x+=cx/cd*ov; a.pos.z+=cz/cd*ov; } } }
  for(const bl of blocks){ if(bl.obb){ const SH=solidShape(bl); for(const a of enemies) if(solidTank(a)) tankVsWall(a, SH); continue; }
    const SH=solidShape(bl); for(const a of enemies) if(solidTank(a)){ if(SH) tankVsWall(a, SH); else tankVsCircle(a, bl.x, bl.z, bl.r); } }
  for(const a of enemies){ if(!solidTank(a)) continue; clampField(a.pos, 2); a.mesh.position.set(a.pos.x,0,a.pos.z); }
 }
