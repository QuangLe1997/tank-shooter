// fx/explosions.js — COMBAT FX / EXPLOSIONS (juiced in P4)
import { BIOME, MOBILE, S, burst, decalCrater, decalDirt, decalScorch, fireball, haptic, muzzleLight, ringPulse, sfx, spawnDebris, spawnPart, spawnTankWreck } from '../hub.js';

// ----------------------------- COMBAT FX / EXPLOSIONS (juiced in P4) -----------------------------
export function bigExplode(pos, color, scale=1.5){
  decalScorch(pos.x, pos.z, 1.6+scale*1.5, 0.85); if(scale>=1.2) decalCrater(pos.x, pos.z, 0.6+scale*0.6, 0.8);   // blast leaves its mark on the ground
  ringPulse(pos, color, scale*3.2); fireball(pos, scale*0.6);
  burst(pos, color, Math.floor(6*scale), 11*scale, {life:0.45, size:1.2*scale, up:3});
  burst(pos, 0xffe6a0, Math.floor(9*scale), 7*scale, {life:0.34, size:0.9*scale, up:4});
  burst(pos, 0x201c14, Math.floor(5*scale), 4*scale, {life:0.95, size:2.6*scale, smoke:true, grav:-1.2, drag:1.4, up:2, op:0.55});
  S.shake = Math.min(2.4, S.shake + scale*0.7);
  muzzleLight.position.set(pos.x, 2, pos.z); muzzleLight.color.setHex(color); muzzleLight.intensity = 3.4;
  sfx(scale>=2 ? 'bigexplode' : 'explode', pos);
}
// a round that lands in the dirt: soil spray + dust puff + a scar on the ground
export function groundHit(x, z, r){ const k=Math.min(2.2, 0.6+r*1.4), dc=BIOME.ground;
  decalDirt(x, z, 0.25+r*0.5);
  burst({x,z}, dc, Math.floor(4*k), 5*k, {y:0.3, life:0.45, size:0.32*k, up:4.5, grav:-16, drag:1.5});                          // clods
  burst({x,z}, dc, Math.max(1,Math.floor(2*k)), 1.6*k, {y:0.4, life:0.7, size:1.1*k, smoke:true, grav:-0.4, drag:2.2, up:1.2, op:0.45}); }   // dust
// ----- per-gun IMPACT spray (non-lethal hit) — each weapon "reads" differently on contact -----
export function impactFX(pos, fx, k){ k=k||1; sfx(k>2.2?'hitHeavy':'hit', pos, 0.6+k*0.25);   // Z102 every strike on armour is heard
  if(k>=1.3){ const n=Math.min(MOBILE?5:10, Math.floor(3+k*2.5)), y0=(pos.y||1.2);   // Z168 a hard hit tears off glowing fragments that arc out, land and skip across the ground
    for(let i=0;i<n;i++){ const a=Math.random()*6.283, sp=4+Math.random()*7*Math.min(2,k); spawnPart(pos.x, y0, pos.z, Math.cos(a)*sp, 3+Math.random()*6, Math.sin(a)*sp, { color:0xfff0b0, color2:0xff5a10, size:0.14+0.06*k, life:0.9+Math.random()*0.7, grav:-18, drag:0.4 }); }
    spawnPart(pos.x, y0, pos.z, 0, 0, 0, { tex:'flash', color:0xffffff, size:1.6+k*0.8, life:0.06, grav:0, drag:0 }); }
  if(fx==='blast'){ ringPulse(pos, 0xffd27a, 2.0*k); burst(pos, 0xfff1c0, Math.floor(7*k), 9*k, {life:0.26, size:1.2*k, up:3, drag:3}); burst(pos, 0xff7a2e, Math.floor(5*k), 6*k, {life:0.34, size:1.05*k, drag:3});
    burst(pos, 0x281e14, Math.floor(2+k), 4*k, {life:0.55, size:1.3*k, smoke:true, grav:-0.5, drag:2, op:0.4});   // lingering fire-lit smoke
    muzzleLight.position.set(pos.x,1.6,pos.z); muzzleLight.color.setHex(0xff9a4a); muzzleLight.intensity=Math.max(muzzleLight.intensity,2.4*k); }
  else if(fx==='frag'){ ringPulse(pos, 0xffc070, 1.5*k); burst(pos, 0xffd27a, Math.floor(9*k), 13*k, {life:0.26, size:0.55*k, grav:-6, drag:4}); }                                  // shrapnel spray
  else if(fx==='pierce'){ ringPulse(pos, 0xd6b8ff, 1.9*k); burst(pos, 0xeaddff, Math.floor(5*k), 15*k, {life:0.2, size:0.5*k, grav:-2, drag:6}); }                                // clean punch-through streak
  else if(fx==='ice'){ ringPulse(pos, 0x9fe8ff, 1.7*k); burst(pos, 0xd8f6ff, Math.floor(7*k), 8*k, {life:0.42, size:0.7*k, grav:7, drag:3}); burst(pos, 0x7fd0ff, Math.floor(3*k), 5*k, {life:0.3, size:0.5*k, drag:5}); }   // frost shards fall
  else if(fx==='shock'){ ringPulse(pos, 0x7fd0ff, 1.5*k); for(let i=0;i<Math.floor(5*k);i++){ const a=Math.random()*6.283; spawnPart(pos.x,1.4,pos.z, Math.cos(a)*9,3,Math.sin(a)*9, {color:0xbfe8ff, size:0.7*k, life:0.16, grav:0, drag:5}); } }  // electric crackle
  else { ringPulse(pos, 0xffd27a, 1.4*k); burst(pos, 0xffe6a0, Math.floor(3*k), 6*k, {life:0.22, size:0.7*k, grav:-4, drag:5}); }                                                // 'spark' — light bullets
}
// per-gun DEATH blast styling: fire amount, smoke amount, ring/spark tints, debris tint, sound, themed extra
export const KILLFX = {
  fire:  { fire:1.0, smoke:1.0, r1:0xfff0c0, r2:0xff7a2e, spark:0xffe6a0, big:'bigexplode', sml:'explode' },
  blast: { fire:1.35,smoke:1.5, r1:0xffe0a0, r2:0xff5a1e, spark:0xffd27a, big:'bigexplode', sml:'bigexplode' },          // heavy ordnance: bigger fireball + smoke
  frag:  { fire:1.0, smoke:0.8, r1:0xffd9a0, r2:0xff8a3a, spark:0xffd27a, big:'bigexplode', sml:'explode', extra:'frag' },
  pierce:{ fire:0.9, smoke:0.7, r1:0xe6d6ff, r2:0xb088ff, spark:0xeaddff, big:'bigexplode', sml:'explode' },
  ice:   { fire:0.22,smoke:0.5, r1:0xd8f6ff, r2:0x7fd0ff, spark:0xd8f6ff, big:'explode', sml:'explode', extra:'ice',   debris:0x9fe8ff },   // freeze & shatter
  shock: { fire:0.4, smoke:0.5, r1:0xbfe8ff, r2:0x4fb0ff, spark:0xeaffff, big:'explode', sml:'explode', extra:'shock', debris:0x7fd0ff },   // electrocuted
};
// grand tank-death blast: white flash → roiling fireball → flying burning shards → rising smoke column.
// fx (per killing gun) restyles the fire/smoke/sound: ice = frozen shatter, shock = electrocuted, blast = heavier, etc.
export function tankExplode(pos, color, scale=1.5, pal=null, ms=null, fx='fire'){
  const cf=KILLFX[fx]||KILLFX.fire, fM=cf.fire, sM=cf.smoke;
  decalScorch(pos.x, pos.z, 2.2+scale*1.6, fx==='ice'?0.35:1); decalCrater(pos.x, pos.z, 0.8+scale*0.55, 0.9);
  if(fM>0.05) fireball(pos, scale*0.75);
  burst(pos, 0xffffff, Math.floor(7*scale),  9*scale,  {life:0.12, size:1.7*scale, up:5, grav:-2, drag:7});   // quick white flash (always)
  if(fM>0.05) burst(pos, 0xffb04a, Math.floor(6*fM*scale), 10*scale, {life:0.3, size:1.4*scale, up:5, drag:2.2});   // flare (the rolling fireball itself is fireball())
  burst(pos, color,    Math.floor(8*scale),  8*scale,  {life:0.32, size:1.2*scale, up:3, drag:2.2});           // tank's own palette tint
  burst(pos, cf.spark, Math.floor(14*scale), 18*scale, {life:0.38, size:0.4*scale, up:3, grav:-9, drag:1.3});  // sparks blast out & clear fast
  if(sM>0.05) burst(pos, 0x16110a, Math.floor(5*sM*scale), 5*scale, {life:0.5, size:2.0*scale, up:4, grav:-1.4, drag:2.2, smoke:true, op:0.42}); // light smoke
  ringPulse(pos, cf.r1, scale*2.2); ringPulse(pos, cf.r2, scale*4.0);                                          // shockwave (themed tint)
  // themed extra: frozen shards rain / electric arcs / shrapnel
  if(cf.extra==='ice'){ for(let i=0;i<Math.floor(10*scale);i++){ const a=Math.random()*6.283, sp=4+Math.random()*9; spawnPart(pos.x,1.6,pos.z, Math.cos(a)*sp, 5+Math.random()*6, Math.sin(a)*sp, {color: Math.random()<0.5?0xd8f6ff:0x7fd0ff, size:(0.4+Math.random()*0.5)*scale, life:0.6+Math.random()*0.4, grav:14, drag:1.2}); } ringPulse(pos, 0xffffff, scale*2.8); }
  else if(cf.extra==='shock'){ for(let i=0;i<Math.floor(9*scale);i++){ const a=Math.random()*6.283, sp=8+Math.random()*10; spawnPart(pos.x,1.5,pos.z, Math.cos(a)*sp, 2+Math.random()*4, Math.sin(a)*sp, {color:0xbfe8ff, size:(0.4+Math.random()*0.4)*scale, life:0.18+Math.random()*0.14, grav:0, drag:4}); } }
  else if(cf.extra==='frag'){ burst(pos, 0xffd27a, Math.floor(10*scale), 22*scale, {life:0.3, size:0.5*scale, grav:-5, drag:2}); }
  const dcol = cf.debris!=null ? cf.debris : color;
  if(pal) spawnTankWreck(pos, ms||scale*0.72, pal); else spawnDebris(pos, scale, dcol);                        // tanks shatter into real PARTS; walls/blocks → metal fragments
  for(let k=0;k<Math.floor(3*sM*scale);k++) setTimeout(()=>{ if(S.mode!=='paused')
    burst({x:pos.x,z:pos.z}, 0x20190f, 1, 2.5, {y:1.4+k*0.3, life:0.6, size:1.9*scale, smoke:true, grav:-0.6, drag:1.8, up:3, op:0.4}); }, k*60); // brief smoke puffs — clear quickly
  S.shake = Math.min(3.0, S.shake + scale*0.9);                                                                // moderate kick — scales with tank size
  muzzleLight.position.set(pos.x, 2.2, pos.z); muzzleLight.color.setHex(cf.r1); muzzleLight.intensity = 4.0 + scale*0.9;  // brief blast flash (themed colour)
  sfx(scale>=2 ? cf.big : cf.sml, pos);
  { const p=S.player; if(p && (p.pos.x-pos.x)**2+(p.pos.z-pos.z)**2 < 400) haptic([0,25,30,40]); }
  if(scale>=2.2){   // big tanks/bosses: a delayed secondary blast + extra shards = bigger payoff
    setTimeout(()=>{ if(S.mode==='paused') return;
      burst(pos, fM>0.05?0xffae5c:cf.spark, Math.floor(16*scale), 16*scale, {life:0.6, size:2.2*scale, up:5});
      if(pal) spawnTankWreck(pos,(ms||scale*0.72)*0.7, pal); else spawnDebris(pos, scale*0.8, dcol); ringPulse(pos, cf.r1, scale*3.0); S.shake=Math.min(3.6,S.shake+1.0); sfx(cf.big); }, 160);
  }
}
