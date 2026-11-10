// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { BALANCE } from '../../config.js';
import { ARENA, BIOME, BUMPS, COVER_HP, COVER_SET, MOBILE, S, _R, addLootBeacon, addPlayerBurn, aoeDamage, bigExplode, buildBrickWalls, buildCamps, buildTowers, burst, clearLootBeacons, clearWalls, collapseTower, coverGeo, coverMat, damageCamp, damageObjective, damagePlayer, damagePylon, decalCrater, decalScorch, deformCrater, dropPowerup, enemies, fireball, flashMat, heightAt, makeCoverMesh, placeCaches, rockSet, scene, sfx, spawnDebris, spawnPart, wallDamage } from '../hub.js';

// ----------------------------- TERRAIN BLOCKS (cover) -----------------------------
// Brick (destructible) + steel (solid). Block tank movement + bullets → real cover.
export const SEG=3;   // segment spacing (= block size) → segments touch into solid walls
// maze wall shapes (offsets in segments) — I / L / U / T / Z to hide behind
export const MAZE_SHAPES = [
  [[0,-1],[0,0],[0,1]],                                  // I
  [[0,-1],[0,0],[0,1],[1,1],[2,1]],                      // L
  [[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1]],      // U
  [[-1,0],[0,0],[1,0],[0,1],[0,2]],                      // T
  [[-1,-1],[0,-1],[0,0],[1,0],[1,1]],                    // Z
];
export const blocks=[];   // fuel drums go up after a hit or two
export function buildBlocks(){
  for(const b of blocks) scene.remove(b.mesh); blocks.length=0; clearWalls(); clearLootBeacons('block');
  const set=COVER_SET[BIOME.name]||COVER_SET.DESERT;
  const shapeCount = 4 + Math.floor(S.stage*1.2);
  const centers=[];
  let tries=0;
  while(centers.length<shapeCount && tries++<260){
    const x=(Math.random()*2-1)*(ARENA-12), z=(Math.random()*2-1)*(ARENA-12);
    if(Math.hypot(x,z) < 16) continue;                   // keep Core area open
    if(Math.hypot(x, z-ARENA*0.55) < 13) continue;       // keep player spawn open
    if(centers.some(c=>Math.hypot(c.x-x,c.z-z) < 16)) continue;  // spacing between shapes (navigable corridors)
    centers.push({x,z});
    const shape = MAZE_SHAPES[(Math.random()*MAZE_SHAPES.length)|0];
    const rot = (Math.random()*4|0)*Math.PI/2, ca=Math.cos(rot), sa=Math.sin(rot);
    const steel = Math.random() < 0.4;                   // whole shape: solid (concrete/pipes/HESCO) or destructible (sandbags/drums/tyres/crates)
    const pool = steel ? set[1] : set[0], kindA = pool[(Math.random()*pool.length)|0], kindB = pool[(Math.random()*pool.length)|0];
    shape.forEach(([ox,oz], si)=>{
      const rx = ox*ca - oz*sa, rz = ox*sa + oz*ca;
      const bx = x + rx*SEG, bz = z + rz*SEG;
      if(Math.abs(bx)>ARENA-4 || Math.abs(bz)>ARENA-4) return;
      const kind = (!steel && si%3===2) ? kindB : kindA;                                 // mostly one kind, the odd different piece mixed in (real improvised lines)
      const m=makeCoverMesh(kind, !steel); m.position.set(bx,heightAt(bx,bz)-0.12,bz); m.rotation.y=rot+(Math.random()-0.5)*0.12; scene.add(m);
      const hp = steel ? Infinity : (COVER_HP[kind]||70);
      const loot = !steel && Math.random()<BALANCE.drop.brick;   // some stockpiles conceal a power-up (boosted)
      const bobj={ mesh:m, x:bx, z:bz, r:1.7, hp, maxHp:hp, steel, loot, kind };
      blocks.push(bobj); if(loot) addLootBeacon(bobj, 'block');
    });
  }
  buildTowers();                                                            // enemy watchtowers with riflemen
  // lone heavy obstacles: boulders + Czech hedgehogs — solid, block shots, deflect tanks
  const rs=rockSet(BIOME.name), nB=MOBILE?4:7;
  for(let i=0;i<nB;i++){ let x=0,z=0,ok=false;
    for(let t=0;t<20&&!ok;t++){ x=(Math.random()*2-1)*(ARENA-8); z=(Math.random()*2-1)*(ARENA-8); ok=Math.hypot(x,z)>15 && Math.hypot(x,z-ARENA*0.55)>12 && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<6); }
    if(!ok) continue;
    const hedge = i%3===2, r = hedge ? 1.15 : _R(1.3,2.2);
    const m = hedge ? new THREE.Mesh(coverGeo('hedgehog'), coverMat('hedgehog')) : new THREE.Mesh(rs.big[i%rs.big.length], rs.mat);
    if(hedge){ m.scale.setScalar(1.0); } else { m.scale.setScalar(r*1.05); m.position.y=r*0.2; }
    m.position.x=x; m.position.z=z; m.position.y+=heightAt(x,z); m.rotation.y=Math.random()*6.283; m.castShadow=true; m.receiveShadow=true; scene.add(m);
    const climb = !hedge && r < 1.8;                                                     // Z86 low rocks: take a run and the hull rides over them
    blocks.push({ mesh:m, x, z, r:hedge?1.2:r*0.92, hp:Infinity, steel:true, loot:false, kind:hedge?'hedgehog':'boulder', climb });
    if(climb) BUMPS.push({ x, z, r:r*1.25, h:r*0.62, rock:true });
  }
  buildBrickWalls();                                                                       // Z86 ruined masonry walls
  buildCamps();                                                                            // Z90 enemy troop camps
  placeCaches();                                                                           // Z93 guarded supply caches
}
// hit feedback + staged damage per material; destruction is material-specific (fuel drums EXPLODE and hurt everything around)
export function damageBlock(b, dmg){
  if(b.kind==='obj'){ damageObjective(b, dmg); return; }                  // Z83 operation objective
  if(b.kind==='tower'){ if(b.tower.falling) return; b.hp-=dmg; flashMat(b.tower.wm, 0.1, 0.5);
    burst({x:b.x,z:b.z}, 0x9a7a52, 3, 5, {y:heightAt(b.x,b.z)+1.5+Math.random()*4, life:0.4, size:0.3, grav:-16, drag:1.5, up:2});   // splinters fly
    b.mesh.position.x = b.x + (Math.random()-0.5)*0.12;                                                                                   // the structure shudders
    if(b.hp<=0){ const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1); b.mesh.position.x=b.x; collapseTower(b.tower); if(b.loot) dropPowerup({x:b.x,z:b.z}, 1); } return; }
  if(b.kind==='brick'){ wallDamage(b, dmg); return; }
  if(b.kind==='camp'){ damageCamp(b, dmg); return; }
  if(b.kind==='pylon'){ damagePylon(b, dmg); return; }                     // Z96 boss shield pylon                      // Z90 barracks                     // Z86 masonry: staged collapse
  if(b.steel){ if(Math.random()<0.5) spawnPart(b.x+(Math.random()-0.5)*2, 1.2+Math.random(), b.z+(Math.random()-0.5)*2, (Math.random()-0.5)*6, 3, (Math.random()-0.5)*6, {color:b.kind==='boulder'?0xd8c8a8:0xffe0a0, size:0.22, life:0.25, grav:-12, drag:2}); return; }   // ricochet chips
  b.hp -= dmg; flashMat(b.mesh.material, 0.1, 0.6);
  const f=Math.max(0,b.hp)/(b.maxHp||70);
  if(b.kind==='sandbag'){ b.mesh.scale.set(1, 0.45+0.55*f, 1); burst({x:b.x,z:b.z}, 0xc8b48a, 2, 2.4, {y:1.0, life:0.7, size:1.0, smoke:true, grav:-0.6, drag:2.2, up:1.2, op:0.45}); }   // sand pours out, the wall slumps
  else { b.mesh.scale.setScalar(0.9+0.1*f); }
  if(b.hp<=0) destroyCover(b);
}
export function destroyCover(b){
  const pos={x:b.x,z:b.z}, now=performance.now()/1000;
  scene.remove(b.mesh); const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1);
  if(b.kind==='drums'){                                                     // FUEL stockpile: fireball + shock wave + burning fuel splashed over everything nearby
    const R=7.5;
    bigExplode(pos, 0xff8a3a, 2.4); fireball(pos, 2.2); decalScorch(b.x, b.z, R*0.9, 1);
    for(let k=0;k<14;k++){ const a=Math.random()*6.283, sp=4+Math.random()*9; spawnPart(b.x, heightAt(b.x,b.z)+1.4, b.z, Math.cos(a)*sp, 5+Math.random()*7, Math.sin(a)*sp, {tex:'fire', color:0xffd080, color2:0xff3a08, size:1.2, life:0.9+Math.random()*0.5, grav:-12, drag:0.6, grow:0.8}); }   // flaming fuel blobs arc out
    aoeDamage(b.x, b.z, R, 60, false, now);
    for(const e of enemies){ const d=Math.hypot(e.pos.x-b.x, e.pos.z-b.z); if(d<R+e.r && !e.def.bomber && !e.def.air){ if(!e.burn) e.burn={lvl:0,until:0}; e.burn.lvl=Math.min(BALANCE.flame.lvlMax, e.burn.lvl+2.5*(1-d/(R+e.r))+1); e.burn.until=now+BALANCE.flame.duration; } }   // tanks behind the drums catch fire
    const p=S.player; if(p){ const d=Math.hypot(p.pos.x-b.x, p.pos.z-b.z); if(d<R){ damagePlayer(Math.round(30*(1-d/R))+6, now, p.pos.x-b.x, p.pos.z-b.z); for(let k=0;k<2;k++) addPlayerBurn(p.pos.x-b.x+(Math.random()-0.5), p.pos.z-b.z+(Math.random()-0.5)); } }
    for(const o of blocks.slice()) if(o!==b && o.kind==='drums' && Math.hypot(o.x-b.x,o.z-b.z) < R*0.95) setTimeout(()=>{ if(blocks.includes(o)) damageBlock(o, 999); }, 180+Math.random()*260);   // chain reaction through the fuel dump
    deformCrater(b.x, b.z, 2.4, 0.5);
    for(let k=0;k<4;k++) spawnDebris(pos, 0.9, 0x6a2a1a);
  } else if(b.kind==='tires'){ spawnDebris(pos, 1.2, 0x1e1e1c); burst(pos, 0x0e0d0c, 6, 3, {y:1.2, life:1.6, size:2.6, smoke:true, grav:-1.2, drag:1.2, up:2, op:0.55}); bigExplode(pos, 0xff7a2a, 1.0); }   // burning rubber, thick black smoke
  else if(b.kind==='crates'){ spawnDebris(pos, 1.4, 0x8a6a40); burst(pos, 0xb08a56, 10, 8, {y:1.2, life:0.6, size:0.4, grav:-16, drag:1.4, up:3}); burst(pos, 0xb09a7a, 3, 2.5, {y:1, life:0.9, size:1.6, smoke:true, grav:-0.4, drag:2, up:1, op:0.4}); sfx('explode'); }   // splinters
  else { burst(pos, 0xc8b48a, 7, 4, {y:1.0, life:1.1, size:2.2, smoke:true, grav:-0.5, drag:1.8, up:1.6, op:0.55}); burst(pos, 0xa8936a, 14, 7, {y:1.2, life:0.55, size:0.3, grav:-18, drag:1.2, up:3}); spawnDebris(pos, 1.0, 0xa8936a); decalCrater(b.x,b.z,1.4,0.5); sfx('explode'); }   // sandbags burst: sand cloud + torn sacks
  if(b.loot){ dropPowerup(pos, b.lootTier||0); if(b.cache) dropPowerup(pos, Math.max(0,(b.lootTier||0)-1)); }   // beacon-marked stockpiles always yield; Z93 caches give two
}
export function clearBlocks(){ for(const b of blocks) scene.remove(b.mesh); blocks.length=0; clearWalls(); }
