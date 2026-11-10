// world/physics.js — PHYSICS: oriented hull boxes (SAT) — tanks touch for real, shove by mass, slide with friction, never overlap
import { DRIVE, LOOT, BOSSFIGHT } from '../../config.js';
import { ARENA, BIOME, DYING, S, TANK_SCALE, _R, blocks, boss, burst, core, crushInfantry, damageBoss, damageEnemy, damagePlayer, driveHint, enemies, floatText, haptic, hitsHull, ramWall, sfx, solidTank, spawnDebris, spawnPart, stunBoss, tankVsWall, tip } from '../hub.js';

// ----------------------------- PHYSICS: oriented hull boxes (SAT) — tanks touch for real, shove by mass, slide with friction, never overlap -----------------------------
export const HULL_HW=1.52, HULL_HL=2.05;                                            // hull half-width / half-length (model units, × tank scale)
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
export function tankMass(t){ if(t===S.player) return 1.25*(t.scale||1)*(t.scale||1)*(t.ramOn?LOOT.ram.mass:1); if(t===boss) return 7*(t.def&&t.def.scale||3);
  const d=t.def||{}; return (d.scale||1)*(d.scale||1)*(d.heavy?1.7:1)*(t.elite?1.5:1); }
export function collideTanks(a, b, now){
  const h=satOBB(_tb(a), _tb(b)); if(!h) return 0;
  const ma=tankMass(a), mb=tankMass(b), tot=ma+mb, d=h.d+0.02;
  a.pos.x-=h.nx*d*(mb/tot); a.pos.z-=h.nz*d*(mb/tot); b.pos.x+=h.nx*d*(ma/tot); b.pos.z+=h.nz*d*(ma/tot);   // heavier tank moves less
  const rvx=b.vel.x-a.vel.x, rvz=b.vel.z-a.vel.z, vn=rvx*h.nx+rvz*h.nz; if(vn>=0) return 0;
  ramDamage(a, b, -vn, a.vel.x*h.nx+a.vel.z*h.nz, -(b.vel.x*h.nx+b.vel.z*h.nz), ma, mb, now);   // Z85 RAMMING: mass × closing speed hurts both hulls
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
// Z85 RAM DAMAGE — a collision only hurts once the closing speed beats DRIVE.ram.minImpact. Each hull takes a share set by the OTHER's
// mass (a heavy tank hits harder and shrugs more off) and by who did the ramming (the hull driving into the hit takes less: nose armour).
export function ramDamage(a, b, imp, sa, sb, ma, mb, now){
  const R=DRIVE.ram, P=S.player; if(imp <= R.minImpact || (a!==P && b!==P && a!==boss && b!==boss)) return;   // enemy-on-enemy shunts are harmless
  const ex=imp-R.minImpact, tot=Math.max(0.01,Math.abs(sa)+Math.abs(sb)), ag=[Math.max(0,sa)/tot, Math.max(0,sb)/tot];
  const hit=(t, mOther, mSelf, agg)=>{ const share=2*mOther/(mOther+mSelf), d=ex*share*(1-R.aggressor*agg);
    const vsP = (t===a?b:a)===P, deal = vsP ? (P.ramOn?LOOT.ram.dealt:1)*(P.ramDealMul||1) : 1;   // Z93 dozer blade / RAM PLATE
    if(t===P){ if(now < p_iframe(t)) return; damagePlayer(Math.round(d*R.toPlayer*(P.ramOn?LOOT.ram.taken:1)*(P.ramTakeMul||1)), now, t.pos.x-(t===a?b:a).pos.x, t.pos.z-(t===a?b:a).pos.z); }
    else if(t===boss){ damageBoss(d*R.toBoss*deal*(1+(S.stage-1)*R.perStage)); }
    else if(t.alive!==false && t.hp>0){ const dd=d*R.toEnemy*deal*(1+(S.stage-1)*R.perStage); damageEnemy(t, dd); if(dd>=4) floatText('HÚC '+Math.round(dd), '#ffcf7a', {x:t.pos.x,y:3,z:t.pos.z}, 15); } };
  hit(a, mb, ma, ag[0]); hit(b, ma, mb, ag[1]);
  if(imp > 16){ const mx=(a.pos.x+b.pos.x)/2, mz=(a.pos.z+b.pos.z)/2; sfx('explode'); spawnDebris({x:mx,z:mz}, 0.6, 0x3a3a34); if(a===P||b===P){ S.shake=Math.min(3.2,S.shake+imp*0.05); haptic([30,20,40]); } }   // a proper crunch: torn plating flies
}
export function p_iframe(t){ return Math.max(t.invincibleUntil||0, t.respawnBlinkUntil||0); }
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
export function separateTanks(now){
  const p=S.player; if(!p) return;
  const arenaLim=ARENA-2;
  for(let i=0;i<enemies.length;i++){ const a=enemies[i]; if(!solidTank(a)) continue;                    // enemy ↔ enemy
    for(let j=i+1;j<enemies.length;j++){ const b=enemies[j]; if(!solidTank(b)) continue; collideTanks(a,b,now); } }
  for(const a of enemies){ if(!solidTank(a)) continue;                                                   // enemy ↔ player: real hull contact (kamikaze must touch → excluded)
    const imp=collideTanks(a,p,now);
    if(imp && a.type==='scout'){ const nx=p.pos.x-a.pos.x, nz=p.pos.z-a.pos.z, L=Math.hypot(nx,nz)||1; a.vel.x-=nx/L*10; a.vel.z-=nz/L*10; }   // rammer backs off to ram again
    if(core){ const cx=a.pos.x-core.pos.x, cz=a.pos.z-core.pos.z, m2=a.r+core.r, cd2=cx*cx+cz*cz;
      if(cd2<m2*m2 && cd2>1e-4){ const cd=Math.sqrt(cd2), ov=m2-cd; a.pos.x+=cx/cd*ov; a.pos.z+=cz/cd*ov; } } }
  if(boss && boss.alive){ const imp=collideTanks(boss,p,now);                                            // boss ↔ player (boss is far heavier → bulldozes)
    if(imp && now < boss.chargeUntil){ const nx=p.pos.x-boss.pos.x, nz=p.pos.z-boss.pos.z, L=Math.hypot(nx,nz)||1; p.vel.x+=nx/L*18; p.vel.z+=nz/L*18; }
    for(const a of enemies){ if(solidTank(a)) collideTanks(boss,a,now); } }
  for(const d of DYING){ const r=1.6*(d.e.mesh.scale.x||1); tankVsCircle(p, d.e.pos.x, d.e.pos.z, r); for(const a of enemies) if(solidTank(a)) tankVsCircle(a, d.e.pos.x, d.e.pos.z, r); }   // burning hulks are still solid
  for(const bl of blocks.slice()){                                                                       // tanks ↔ cover / boulders / walls (solid, deflecting)
    if(bl.obb){ const pv={x:p.vel.x,z:p.vel.z}, vn=tankVsWall(p, bl);                                    // Z86 masonry: momentum decides
      if(vn>0 && ramWall(p, bl, vn)){ p.vel.x=pv.x*0.62; p.vel.z=pv.z*0.62; S.shake=Math.min(3,S.shake+1.2); p.hitT=Math.max(p.hitT||0,0.2); haptic([40,30,60]); sfx('clang'); continue; }
      if(vn>6){ S.shake=Math.min(2.5,S.shake+vn*0.04); p.hitT=Math.max(p.hitT||0,0.14); sfx('thud', null, vn/12); haptic(25); }
      for(const a of enemies) if(solidTank(a)) tankVsWall(a, bl);
      if(boss&&boss.alive){ const bv=tankVsWall(boss, bl); if(bv>2 && blocks.includes(bl)){ ramWall(boss, bl, 99); if(boss.mode==='charge' && bv>BOSSFIGHT.stun.minImpact) stunBoss(performance.now()/1000, boss.def.name+' húc vào tường — nó đang choáng, dồn hoả lực!'); } }   // the boss walks through masonry (and a charge into it stuns)
      continue; }
    if(bl.climb){ const dx=bl.x-p.pos.x, dz=bl.z-p.pos.z, dl=Math.hypot(dx,dz)||1, near=dl < bl.r+HULL_HL*p.scale*TANK_SCALE+0.2;
      if(p.climbing===bl){ if(!near) p.climbing=null; else { for(const a of enemies) if(solidTank(a)) tankVsCircle(a, bl.x, bl.z, bl.r); continue; } }   // riding over it
      else if(near){ const closing=(p.vel.x*dx+p.vel.z*dz)/dl;
        if(closing >= DRIVE.climb*(p.ramOn?LOOT.ram.climb:1) && hitsHull(p, bl.x, bl.z, bl.r)){ p.climbing=bl; p.vel.x*=0.7; p.vel.z*=0.7; S.shake=Math.min(2.6,S.shake+0.9); p.hitT=Math.max(p.hitT||0,0.16); sfx('thud'); haptic([30,20,30]);
          burst({x:bl.x,z:bl.z}, BIOME.ground, 4, 3, {y:0.6, life:0.9, size:1.6, smoke:true, grav:-0.3, drag:2, up:1.2, op:0.45}); continue; }
        else if(closing > 4 && hitsHull(p, bl.x, bl.z, bl.r+0.1)) { driveHint('LÙI LẠI · LẤY ĐÀ ĐỂ LEO'); tip('climb'); } } }
    const vn=tankVsCircle(p, bl.x, bl.z, bl.r);
    if(vn>9){ S.shake=Math.min(2.5,S.shake+vn*0.03); p.hitT=Math.max(p.hitT||0,0.12); burst({x:bl.x,z:bl.z}, BIOME.ground, 3, 2.5, {y:0.6, life:0.7, size:1.3, smoke:true, grav:-0.3, drag:2, up:1, op:0.4}); sfx('thud'); haptic(20); }
    for(const a of enemies) if(solidTank(a)) tankVsCircle(a, bl.x, bl.z, bl.r);
    if(boss&&boss.alive){ const bv=tankVsCircle(boss, bl.x, bl.z, bl.r); if(boss.mode==='charge' && bv>BOSSFIGHT.stun.minImpact && bl.kind!=='pylon') stunBoss(performance.now()/1000, boss.def.name+' đâm vào vật cản — nó đang choáng!'); } }
  for(const a of enemies){ if(!solidTank(a)) continue; a.pos.x=Math.max(-arenaLim,Math.min(arenaLim,a.pos.x)); a.pos.z=Math.max(-arenaLim,Math.min(arenaLim,a.pos.z)); a.mesh.position.set(a.pos.x,0,a.pos.z); }
  crushInfantry(now);                                                                                     // Z79 tracks vs foot soldiers
  if(boss&&boss.alive) boss.mesh.position.set(boss.pos.x,0,boss.pos.z);
  const plim=ARENA-3; p.pos.x=Math.max(-plim,Math.min(plim,p.pos.x)); p.pos.z=Math.max(-plim,Math.min(plim,p.pos.z));
  p.mesh.position.set(p.pos.x,0,p.pos.z);
}
