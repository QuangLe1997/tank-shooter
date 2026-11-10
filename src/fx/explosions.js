// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BIOME, S, burst, decalCrater, decalDirt, decalScorch, fireball, haptic, heightAt, muzzleLight, ringPulse, scene, sfx, spawnPart } from '../hub.js';

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
// ----- debris: tanks shatter into irregular metal fragments that fly, tumble, bounce low, settle, cool, and fade -----
export const debrisGeo = new THREE.BoxGeometry(1,1,1);   // unit cube, scaled NON-uniformly per fragment → plates/bars/chunks
export const debrisPool=[], debris=[];
for(let i=0;i<90;i++){ const m=new THREE.Mesh(debrisGeo, new THREE.MeshStandardMaterial({color:0x2a2824,roughness:0.88,metalness:0.7,emissive:0xff5a1e,emissiveIntensity:0,transparent:true,opacity:1}));
  m.visible=false; scene.add(m); debrisPool.push(m); }
export const _DEBRIS_DARK=[0x26241f,0x312c25,0x3a342c,0x1d1b18,0x2c2a26];
export function spawnDebris(pos, scale, color){
  const n=Math.min(26, Math.floor(6*scale)+2);
  for(let i=0;i<n;i++){ const m=debrisPool.pop(); if(!m) break;
    const a=Math.random()*6.283, ss=Math.sqrt(scale), sp=(3.5+Math.random()*8)*ss, up=(5+Math.random()*8)*ss;
    const b=(0.14+Math.random()*0.22)*scale;                                         // irregular fragment (non-uniform scale) — fragment-sized, not crates
    m.scale.set(b*(0.5+Math.random()*0.9), b*(0.22+Math.random()*0.4), b*(0.6+Math.random()*0.9));
    m.material.color.setHex(Math.random()<0.28 ? color : _DEBRIS_DARK[(Math.random()*_DEBRIS_DARK.length)|0]);  // mostly dark metal, some painted hull
    m.material.emissiveIntensity=0.8+Math.random()*0.9;                              // glowing hot from the blast (cools below)
    m.material.opacity=1;
    m.position.set(pos.x+(Math.random()-0.5)*scale*0.9, 1.0+Math.random()*scale*0.8, pos.z+(Math.random()-0.5)*scale*0.9);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); m.visible=true;
    debris.push({ m, vx:Math.cos(a)*sp, vy:up, vz:Math.sin(a)*sp,
      rx:(Math.random()-0.5)*11, ry:(Math.random()-0.5)*11, rz:(Math.random()-0.5)*11,
      age:0, life:2.0+Math.random()*1.6, settled:false }); }
}
// ----- tank WRECKAGE: a dying tank is RIPPED APART into charred, jagged metal — torn armour plates, ripped shards, snapped bars, wheels — mostly scorched black with white-hot edges (NOT coloured cubes) -----
export const WRECK_GEO = {
  plate:  new THREE.BoxGeometry(1.4,0.06,1.0),         // torn armour plate (thin slab)
  plate2: new THREE.BoxGeometry(0.85,0.05,1.55),       // long thin plate
  shard:  new THREE.TetrahedronGeometry(0.62),         // jagged ripped-metal shard
  shard2: new THREE.OctahedronGeometry(0.52),          // angular chunk
  bar:    new THREE.BoxGeometry(0.13,0.13,1.7),        // snapped rod / structural bar
  barrel: new THREE.CylinderGeometry(0.15,0.19,2.3,9), // broken gun barrel
  wheel:  new THREE.CylinderGeometry(0.42,0.42,0.4,14),// road wheel
  hub:    new THREE.CylinderGeometry(0.14,0.14,0.6,9), // snapped axle/hub
  turret: new RoundedBoxGeometry(1.25,0.48,1.45,1,0.1),// blown-off turret shell (flattened)
};
export const wreckPool=[];
for(let i=0;i<170;i++){ const m=new THREE.Mesh(WRECK_GEO.shard, new THREE.MeshStandardMaterial({color:0x18150f,roughness:0.85,metalness:0.6,emissive:0xff4612,emissiveIntensity:0,transparent:true,opacity:1,flatShading:true}));
  m.castShadow=true; m.visible=false; scene.add(m); wreckPool.push(m); }
export const _SCORCH=[0x141210,0x1c1813,0x24201a,0x100e0b,0x2a251d];                     // charred-metal tones (most fragments)
export const _burnt=hex=>{ const c=new THREE.Color(hex); c.multiplyScalar(0.45); return c.getHex(); };   // darkened "burnt paint" hint
// part list: geometry key + relative size + chance to keep (burnt) paint vs scorched black
export const _WRECK_PARTS=[ {g:'turret',sz:1.0,paint:0.6},{g:'barrel',sz:1.0,paint:0.4},{g:'plate',sz:1.0,paint:0.5},
  {g:'plate2',sz:0.95,paint:0.4},{g:'plate',sz:0.8,paint:0.3},{g:'shard',sz:1.1,paint:0.15},{g:'shard',sz:0.85,paint:0.1},
  {g:'shard2',sz:1.0,paint:0.12},{g:'shard2',sz:0.8,paint:0.1},{g:'bar',sz:1.0,paint:0.1},{g:'bar',sz:0.85,paint:0.1},
  {g:'wheel',sz:1.0,paint:0},{g:'wheel',sz:0.9,paint:0},{g:'hub',sz:1.0,paint:0.1},{g:'shard',sz:0.7,paint:0.1},{g:'plate',sz:0.7,paint:0.3} ];
export function spawnTankWreck(pos, ms, pal){
  const burntHull=_burnt(pal.hull), burntTur=_burnt(pal.turret||pal.hull);
  const rs=Math.sqrt(ms);
  const count = ms<1.05 ? 5 : ms<1.3 ? 6 : ms<2.2 ? 8 : 10;                  // torn-off bits only — the burning hull itself stays (spawnWreck)
  for(let pi=0; pi<count; pi++){ const part=_WRECK_PARTS[pi+1];   // skip the whole-turret slab
    const m=wreckPool.pop(); if(!m) return;                                  // pool exhausted (huge multi-kill) → stop gracefully
    m.geometry=WRECK_GEO[part.g];
    let col; if(Math.random()<part.paint) col = part.g==='turret'?burntTur:burntHull; else col=_SCORCH[(Math.random()*_SCORCH.length)|0];
    if(part.g==='wheel') col=0x0e0e0c;                                        // scorched rubber
    m.material.color.setHex(col);
    const s=ms*part.sz*(0.45+Math.random()*0.3); m.scale.set(s, s*(0.7+Math.random()*0.6), s*(0.8+Math.random()*0.5));   // torn plates, wheels, bars — sized like real fragments
    const a=Math.random()*6.283, sp=(7+Math.random()*9)*rs, up=(9+Math.random()*6)*rs;            // arc out then land as visible wreckage (moderate)
    m.position.set(pos.x+(Math.random()-0.5)*ms*0.7, 1.0+Math.random()*ms, pos.z+(Math.random()-0.5)*ms*0.7);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
    m.material.emissiveIntensity=1.0+Math.random()*0.7; m.material.opacity=1; m.visible=true;     // hot → cools to dark torn metal
    debris.push({ m, vx:Math.cos(a)*sp, vy:up, vz:Math.sin(a)*sp,
      rx:(Math.random()-0.5)*15, ry:(Math.random()-0.5)*15, rz:(Math.random()-0.5)*15,
      age:0, life:2.8+Math.random()*1.5, settled:false, floor:Math.max(0.14, s*0.4), pool:wreckPool, fire:true });   // lingers as readable wreckage on the ground, then fades (smoke/fire already gone — no view block)
  }
}
export function updateDebris(dt){
  for(let i=debris.length-1;i>=0;i--){ const d=debris[i], m=d.m; d.age+=dt;
    if(d.age>=d.life){ m.visible=false; m.material.opacity=1; m.material.emissiveIntensity=0; (d.pool||debrisPool).push(m); debris.splice(i,1); continue; }
    if(!d.settled){
      d.vy-=30*dt;                                                                   // gravity
      const dg=Math.max(0,1-dt*1.1); d.vx*=dg; d.vz*=dg;                              // air drag
      m.position.x+=d.vx*dt; m.position.y+=d.vy*dt; m.position.z+=d.vz*dt;
      const floor=(d.floor!=null?d.floor:Math.max(0.14, m.scale.y*0.5)) + heightAt(m.position.x, m.position.z);
      if(m.position.y<=floor){ m.position.y=floor;
        if(Math.abs(d.vy)<2.4 && Math.hypot(d.vx,d.vz)<2.6){ d.settled=true; d.vy=d.vx=d.vz=0; }   // come to rest on the ground
        else { d.vy*=-0.22; d.vx*=0.5; d.vz*=0.5; d.rx*=0.5; d.ry*=0.5; d.rz*=0.5; }               // low bounce + spin damp
      }
      m.rotation.x+=d.rx*dt; m.rotation.y+=d.ry*dt; m.rotation.z+=d.rz*dt;
    }
    if(d.fire && d.age<0.85){     // brief flaming trail: quick fire + embers + light smoke that clears fast (won't block the view)
      const mp=m.position;
      if(Math.random()<0.5) spawnPart(mp.x, mp.y, mp.z, (Math.random()-0.5)*3, 1.6+Math.random()*3, (Math.random()-0.5)*3,
        {color: Math.random()<0.5?0xff7a1e:0xffc24e, size:0.6+Math.random()*0.6, life:0.22+Math.random()*0.16, grav:-5, drag:3.5});
      if(Math.random()<0.22) spawnPart(mp.x, mp.y, mp.z, (Math.random()-0.5)*6, Math.random()*3, (Math.random()-0.5)*6,
        {color:0xffe09a, size:0.24+Math.random()*0.18, life:0.3+Math.random()*0.2, grav:-9, drag:1.3});   // embers flung out, quick
      if(Math.random()<0.16) spawnPart(mp.x, mp.y, mp.z, (Math.random()-0.5), 0.6, (Math.random()-0.5),
        {color:0x161310, size:0.9+Math.random()*0.4, life:0.45, smoke:true, grav:-1.2, drag:1.8, op:0.4});
    }
    if(m.material.emissiveIntensity>0) m.material.emissiveIntensity=Math.max(0, m.material.emissiveIntensity-dt*(d.fire?1.7:1.7));   // brief hot flash → quickly cools to readable DARK TORN METAL
    const fadeT=d.fire?1.0:0.7, rem=d.life-d.age; if(rem<fadeT) m.material.opacity=rem/fadeT;                            // fade out (burn up) and vanish
  }
}
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
