// world/cover.js — TERRAIN BLOCKS (cover)
import * as THREE from 'three';
import { BALANCE, DEFENSE, FUEL_DRUM, RAM, HARD, OPEN_LAND, REALROCK, SHATTER, FUEL_TANK, BREAKUP } from '../../config.js';
import { CO, coopBlockDamage, modeSeed, AREA_K, ARENA, BIOME, BUMPS, CONTAINER_PAINT, COVER_HP, COVER_K, COVER_R, COVER_SET, DEF, HEAVY_KINDS, LONE_SET, MOBILE, S, _R, addLootBeacon, dressRock, aoeDamage, bigExplode, buildBrickWalls, buildCamps, buildCoreWalls, buildDefense, garrisonDefense, buildLandmarks, buildRidges, buildScenery, buildSupply, buildTowers, buildZones, buildingHit, burst, camera, clearLootBeacons, clearRubble, clearWallMarks, clearWalls, collapseTower, coverGeo, coverMat, coverVariant, damageCamp, damageEnemy, damageGate, damageObjective, damagePlayer, decalCrater, decalScorch, deformCrater, dropPowerup, enemies, fireball, flashMat, floatText, fortCoreHit, fortWallHit, freeEnemyBar, garrisonSupply, getEnemyBar, heightAt, hitTunnel, inField, inZone, leaveRubble, makeCoverMesh, placeCaches, planZones, resetSupply, ridgeRockDown, rockSet, scene, sfx, spawnDebris, spawnPart, supplyDamage, trackCover, underHit, wallDamage, clearShatter, shatter, solidKind, blastAllies, dropScenePiece, tentHit, blockTop, shockDome, blastLight, decalAsh, dirtGeyser, dustSkirt, coopSeedStep } from '../hub.js';

// ----------------------------- TERRAIN BLOCKS (cover) -----------------------------
// Brick (destructible) + steel (solid). Block tank movement + bullets → real cover.
export const SEG=3*COVER_K;   // segment spacing (= block size) → segments touch into solid walls · Z193 at the tanks' scale
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
  clearShatter(); for(const b of blocks){ scene.remove(b.mesh); if(b.bar){ freeEnemyBar(b.bar); b.bar=null; } } blocks.length=0; clearWalls(); clearLootBeacons('block'); clearRubble(); resetSupply(); clearWallMarks();
  modeSeed(4); planZones();                                                                             // Z104 reserve ground for the rally point, POW stockades, depots
  coopSeedStep(10); buildCoreWalls();                                                      // Z140 our walled compound + guard cannons round the Core · COOP 7 (in a co-op battle each of these on its own dice: one that draws differently on the two pages cannot shift the next; nothing otherwise)
  modeSeed(5); coopSeedStep(11); buildLandmarks();                                                      // Z139 city buildings · hill woods · village houses + paddies (they claim their ground before cover is scattered)
  modeSeed(6); coopSeedStep(12); buildDefense();                                                        // Z420 the enemy's belt, checkpoints and fighting positions — laid before the scatter, which keeps off them
  modeSeed(7); coopSeedStep(13); const set=COVER_SET[BIOME.name]||COVER_SET.DESERT;
  const shapeCount = Math.round((4 + Math.floor(S.stage*1.2))*AREA_K*((OPEN_LAND[BIOME.name]||{}).cover||1));   // Z242 town / countryside: more open ground   // Z104 more cover on the wider field (soldiers need somewhere to hide)
  const centers=[];
  let tries=0;
  while(centers.length<shapeCount && tries++<260){
    const x=(Math.random()*2-1)*(ARENA-12), z=(Math.random()*2-1)*(ARENA-12);
    if(Math.hypot(x,z) < 18) continue;                   // keep Core area open
    if(Math.hypot(x, z-ARENA*0.55) < 15) continue;       // keep player spawn open
    if(centers.some(c=>Math.hypot(c.x-x,c.z-z) < 16*COVER_K)) continue;  // spacing between shapes (navigable corridors) · Z193 wider for the bigger pieces
    if(inZone(x, z, 8) || !inField(x, z, 10)) continue;  // Z104 keep installations clear · Z106 stay inside the fence
    if(DEF.rb && Math.hypot(x,z) > DEF.rb-10 && z < 0 && Math.random() < DEFENSE.maze.cut) continue;   // Z420 behind the enemy's belt the fighting positions hold the ground: less random scatter
    centers.push({x,z});
    const shape = MAZE_SHAPES[(Math.random()*MAZE_SHAPES.length)|0];
    const rot = (Math.random()*4|0)*Math.PI/2, ca=Math.cos(rot), sa=Math.sin(rot);
    const steel = Math.random() < 0.4;                   // whole shape: solid (concrete/pipes/HESCO/jersey/teeth) or light (sandbags/drums/tyres/crates/logs) — Z193 both break under fire
    const pool = steel ? set[1] : set[0], kindA = pool[(Math.random()*pool.length)|0], kindB = pool[(Math.random()*pool.length)|0];
    shape.forEach(([ox,oz], si)=>{
      const rx = ox*ca - oz*sa, rz = ox*sa + oz*ca;
      const bx = x + rx*SEG, bz = z + rz*SEG;
      if(Math.abs(bx)>ARENA-4 || Math.abs(bz)>ARENA-4 || !inField(bx, bz, 3)) return;
      const kind = (!steel && si%3===2) ? kindB : kindA;                                 // mostly one kind, the odd different piece mixed in (real improvised lines)
      const m=makeCoverMesh(kind, true); m.scale.setScalar(COVER_K); m.position.set(bx,heightAt(bx,bz)-0.12,bz); m.rotation.y=rot+(Math.random()-0.5)*0.12; scene.add(m);   // Z193 own material: every piece shows its damage
      const hp = COVER_HP[kind]||70, heavy=HEAVY_KINDS.has(kind);
      const loot = !steel && Math.random()<BALANCE.drop.brick;   // some stockpiles conceal a power-up (boosted)
      const bobj={ mesh:m, x:bx, z:bz, r:(COVER_R[kind]||1.7)*COVER_K, hp, maxHp:hp, steel, heavy, cover:true, ms:COVER_K, loot, kind };
      blocks.push(bobj); if(loot) addLootBeacon(bobj, 'block');
    });
  }
  modeSeed(8); buildTowers();                                                            // enemy watchtowers with riflemen
  // lone heavy obstacles: boulders + Czech hedgehogs — solid, block shots, deflect tanks
  // Z429 the boulders as rock scans (world/real-props.js dressRock) laid out as outcrops: on the steepest of a few clear spots (a rise, a bank — not dropped
  //   anywhere on the flat), a big stone with smaller ones at its flank, all sunk into the ground; the hedgehogs stay lone, on the open ground
  const rs=rockSet(BIOME.name), nB=Math.round((MOBILE?4:7)*AREA_K), RK=REALROCK, nH=Math.round(nB/3);
  const clearAt=(x,z,r)=>Math.hypot(x,z)>15 && Math.hypot(x,z-ARENA*0.55)>12 && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<Math.max(6, b.r+r+2)) && !inZone(x,z,3) && inField(x,z,5);
  const slope=(x,z)=>Math.abs(heightAt(x+3,z)-heightAt(x-3,z))+Math.abs(heightAt(x,z+3)-heightAt(x,z-3));
  const lone=(x,z,hedge,r)=>{ const m = hedge ? new THREE.Mesh(coverGeo('hedgehog'), coverMat('hedgehog')) : dressRock(new THREE.Mesh(rs.big[(Math.random()*rs.big.length)|0], rs.mat), BIOME.name);
    if(hedge){ m.scale.setScalar(COVER_K); } else { m.scale.setScalar(r*1.05); m.position.y=r*0.2; }
    m.position.x=x; m.position.z=z; m.position.y+=heightAt(x,z); m.rotation.y=Math.random()*6.283; m.castShadow=true; m.receiveShadow=true; scene.add(m);
    const climb = !hedge && r < 2.0;                                                     // Z86 low rocks: take a run and the hull rides over them
    const hp=Math.round((hedge?HARD.hedgehog:HARD.boulder)*(hedge?1:r/1.6)), bump=climb ? { x, z, r:r*1.25, h:r*0.62, rock:true } : null;   // Z112 shootable: bigger rock, more stone
    blocks.push({ mesh:m, x, z, r:hedge?1.2*COVER_K:r*0.92, hp, maxHp:hp, steel:false, hard:true, loot:false, kind:hedge?'hedgehog':'boulder', climb, bump });
    if(bump) BUMPS.push(bump); };
  for(let i=0;i<nH;i++){ for(let t=0;t<20;t++){ const x=(Math.random()*2-1)*(ARENA-8), z=(Math.random()*2-1)*(ARENA-8); if(clearAt(x,z,1.2)){ lone(x,z,true,1.15); break; } } }
  for(let i=0, nO=Math.round((nB-nH)*RK.sites);i<nO;i++){ let best=null, bs=-1;   // (fewer outcrops than the lone rocks were: their satellites make up the count — the camps still find their ground)
    for(let t=0;t<RK.tries*3 && (!best || t<RK.tries);t++){ const x=(Math.random()*2-1)*(ARENA-8), z=(Math.random()*2-1)*(ARENA-8); if(!clearAt(x,z,3)) continue; const sl=slope(x,z)+Math.random()*0.05; if(sl>bs){ bs=sl; best=[x,z]; } }
    if(!best) continue; const [x,z]=best, R=_R(RK.big[0], RK.big[1]); lone(x,z,false,R);
    const n=Math.floor(_R(RK.around[0], RK.around[1]+0.99)), a0=Math.random()*6.283;
    for(let k=0;k<n;k++){ const a=a0+k*_R(0.9,1.6), r=_R(RK.small[0], RK.small[1]), d=R+r+_R(RK.gap[0], RK.gap[1]), sx=x+Math.cos(a)*d, sz=z+Math.sin(a)*d;
      if(inField(sx,sz,3) && !inZone(sx,sz,2) && !blocks.some(b=>b.kind!=='boulder' && Math.hypot(b.x-sx,b.z-sz)<b.r+r+1)) lone(sx,sz,false,r); } }
  modeSeed(9); placeLone();                                                                             // Z193 shipping containers + burnt-out car wrecks
  modeSeed(10); buildRidges();                                                                           // Z106 rock spines with passes → sectors + chokepoints
  buildBrickWalls();                                                                       // Z86 ruined masonry walls
  modeSeed(11); buildSupply('far');                                                                      // Z194 fuel / ammo compounds in the enemy-side corners
  buildCamps();                                                                            // Z90 enemy troop camps
  buildSupply('near');                                                                     // Z196 … then the near corners, round whatever room is left
  placeCaches();                                                                           // Z93 guarded supply caches
  modeSeed(12); buildZones();                                                                            // Z104 rally point · POW stockades · weapon + tank depots (with guards)
  modeSeed(13); buildScenery();                                                                          // Z141 trees · bushes · flowers · reeds · haystacks
  modeSeed(14); garrisonSupply();   // Z194 guards + guard tanks (after buildZones cleared its own)
  garrisonDefense();   // Z423 the men at the defence's posts
  modeSeed(15);   // MODE 2 (every modeSeed in here: the daily challenge's battlefield, each step from its own stream of the day's seed — campaign/mode-run.js; a no-op in every other battle)
}
// hit feedback + staged damage per material; destruction is material-specific (fuel drums EXPLODE and hurt everything around)
// Z418 SANDBAGS STOP SMALL ARMS: a round that cannot break a sandbag wall (a rifle / MG / autocannon round, shot, fire — see BREAKUP.sand) only puffs sand
export function sandProof(bl, b){ if(bl.kind!=='sandbag') return false; const Q=BREAKUP.sand; return !!b.inf || (b.type ? !Q.by.includes(b.type) : !(b.dmg>=Q.minDmg)); }
export function sandBlastProof(bl, r, type){ if(bl.kind!=='sandbag') return false; const Q=BREAKUP.sand; return r<Q.aoeMin && !(type && Q.by.includes(type)); }
// Z418 A BIG THING BROKEN: a flash and a shock of dust as it goes, then the ground where it stood is torn — a crater with thrown earth, a soil spray, a
//   light grey burn that smokes a while (fire: it burned — darker smoke). Nothing of it is left standing or lying there.
export function breakScar(x, z, r, fire){ const S0=BREAKUP.scar, gy=heightAt(x,z), k=Math.min(2.2, Math.max(0.6, r*0.6));
  blastLight(x, z, 40+r*18, 0.35); spawnPart(x, gy+1+r*0.3, z, 0, 0.3, 0, { tex:'flash', color:0xfff0d0, size:2+r*1.4, life:0.09, grav:0, drag:0 }); dustSkirt(x, z, k);
  decalCrater(x, z, r*S0.crater+0.8, 0.95); decalAsh(x, z, r*S0.ash+1, S0.ashK); dirtGeyser(x, z, Math.min(1.6, S0.geyser*Math.sqrt(r)));
  const n=Math.round(S0.smoke[0]*(MOBILE?0.5:1)); for(let i=0;i<n;i++) spawnPart(x+(Math.random()-0.5)*r, gy+0.4+i*0.5, z+(Math.random()-0.5)*r, (Math.random()-0.5)*0.5, 0.45+Math.random()*0.4, (Math.random()-0.5)*0.5,
    { color:fire ? 0x3a3632 : 0x9c988f, size:(1.4+Math.random())*k, life:S0.smoke[1]*(0.7+Math.random()*0.5), smoke:true, grav:0.12, drag:0.9, grow:2.2, op:S0.smokeOp }); }   // it smokes a while, thinning
// COOP 9 with a live co-op room a block's damage is the host's to decide (game/coop-world.js coopBlockDamage: passed on / reported / applied); without one, as ever
export function damageBlock(b, dmg){ if(CO.live) coopBlockDamage(b, dmg, damageBlock0); else damageBlock0(b, dmg); }
function damageBlock0(b, dmg){
  if(b.kind==='tent'){ tentHit(b); return; }                             // Z402 a tent catches fire
  if(b.kind==='fueldrum'){ fuelDrumHit(b, dmg); return; }                  // Z402 a fuel drum goes up
  if(b.kind==='building'){ buildingHit(b, dmg); return; }                 // Z216 a city building: floors come down from the top
  if(b.kind==='tunnel'){ hitTunnel(b.tun, dmg); return; }
  if(b.ub){ underHit(b, dmg); return; }                                   // Z226 the tunnel gate's lock / pillboxes, the underground base's depots                 // Z225 bunker stairs into the enemy tunnels
  if(b.supply){ supplyDamage(b, dmg); return; }                         // Z194 a piece of a fuel station / ammo depot
  if(b.kind==='gate'){ damageGate(b, dmg); return; }                     // Z107 fortress gate — batter it open
  if(b.kind==='fortwall'){ fortWallHit(b, dmg); return; }
  if(b.kind==='fortcore'){ fortCoreHit(b, dmg); return; }                 // Z176 the fort's command post                 // Z107 wall section: chipped by shells (½), a rifleman on top may fall
  if(b.kind==='obj'){ damageObjective(b, dmg); return; }                  // Z83 operation objective
  if(b.kind==='tower'){ if(b.tower.falling) return; b.hp-=dmg; flashMat(b.tower.wm, 0.1, 0.5);
    burst({x:b.x,z:b.z}, 0x9a7a52, 3, 5, {y:heightAt(b.x,b.z)+1.5+Math.random()*4, life:0.4, size:0.3, grav:-16, drag:1.5, up:2});   // splinters fly
    b.mesh.position.x = b.x + (Math.random()-0.5)*0.12;                                                                                   // the structure shudders
    if(b.hp<=0){ const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1); b.mesh.position.x=b.x; collapseTower(b.tower); if(b.loot) dropPowerup({x:b.x,z:b.z}, 1); } return; }
  if(b.hard){ hardDamage(b, dmg); return; }                              // Z112 boulder / hedgehog: chip, crack, shatter
  if(b.kind==='brick'){ wallDamage(b, dmg); return; }
  if(b.kind==='camp'){ damageCamp(b, dmg); return; }
  // Z90 barracks                     // Z86 masonry: staged collapse
  if(b.heavy){ heavyDamage(b, dmg); return; }                            // Z193 concrete / pipes / HESCO / jersey / teeth / containers / wrecks: crack, chip, collapse
  if(b.steel){ if(Math.random()<0.5) spawnPart(b.x+(Math.random()-0.5)*2, 1.2+Math.random(), b.z+(Math.random()-0.5)*2, (Math.random()-0.5)*6, 3, (Math.random()-0.5)*6, {color:b.kind==='boulder'?0xd8c8a8:0xffe0a0, size:0.22, life:0.25, grav:-12, drag:2}); return; }   // ricochet chips
  b.hp -= dmg; flashMat(b.mesh.material, 0.1, 0.6);
  const f=Math.max(0,b.hp)/(b.maxHp||70);
  if(b.ms==null) b.ms=b.mesh.scale.x||1; const ms=b.ms; if(f<0.55 && !b._dk){ b._dk=1; b.mesh.material.color.multiplyScalar(0.8); }   // Z193 scorched once it is badly hit
  if(b.kind==='sandbag'){ b.mesh.scale.set(ms, ms*(0.45+0.55*f), ms); burst({x:b.x,z:b.z}, 0xc8b48a, 2, 2.4, {y:1.0, life:0.7, size:1.0, smoke:true, grav:-0.6, drag:2.2, up:1.2, op:0.45}); }   // sand pours out, the wall slumps
  else if(b.kind==='logs'){ burst({x:b.x,z:b.z}, 0x8a6a40, 3, 5, {y:heightAt(b.x,b.z)+1, life:0.5, size:0.3, grav:-16, drag:1.4, up:2.5}); b.mesh.rotation.z=(1-f)*0.06; }   // splinters, the stack shifts
  else { b.mesh.scale.setScalar((0.9+0.1*f)*ms); }
  if(b.hp<=0) destroyCover(b);
}
// Z402 A FUEL DRUM GOES UP (the scanned oil drums round the fuel farms, world/scenery.js): rounds chip it, then it blows — a fireball, burning fuel thrown out,
//   a blast that hurts everything round it (enemies and their cover through aoeDamage, our men, the player — who is set alight close in), the drums beside
//   it go up after it (a blast inside a blast waits a beat: no chain in one frame) — and nothing of it is left where it stood: its scan and its collider are gone
//   Z414 the big fuel the same (b.fuel = FUEL_TANK.steel / rail: the farm's steel tanks, the rail tankers) — a bigger blast, a fire column, a bar showing what is left
let _drumBlast=0;
const _rnd=a=>a[0]+Math.random()*(a[1]-a[0]);
export function fuelDrumHit(b, dmg){ if(!(b.hp>0)) return; b.hp-=dmg; const gy=heightAt(b.x,b.z), D=b.fuel || FUEL_DRUM, big=D.boom>2;
  burst({x:b.x,z:b.z}, 0xffe0a0, big?5:3, 5, {y:gy+0.6+(big?Math.random()*3:0), life:0.25, size:0.2, grav:-12, drag:2, up:2});   // sparks off the steel
  if(big && b.hp>0){ if(!b.bar){ b.bar=getEnemyBar(); b.bar.g.scale.setScalar(2.0); } const f=Math.max(0, b.hp/b.maxHp), br=b.bar, top=blockTop(b);   // Z414 how much is left of a big one
    br.g.visible=true; br.g.position.set(b.x, top+1.2, b.z); br.g.quaternion.copy(camera.quaternion); br.fill.scale.x=Math.max(0.001,f); br.fill.position.x=-(1-f)*0.5; br.fill.material.color.setHex(0xff7a3a);
    const stamp=b._barT=performance.now(); setTimeout(()=>{ if(b.bar && b._barT===stamp) b.bar.g.visible=false; }, 3500); }
  if(b.hp>0) return; b.hp=0; if(b.bar){ freeEnemyBar(b.bar); b.bar=null; }
  const go=()=>{ const i=blocks.indexOf(b); if(i<0) return; blocks.splice(i,1); dropScenePiece(b.mesh);   // gone from the field as it goes up (rounds, eyes, tracks)
    const pos={x:b.x,z:b.z}, now=performance.now()/1000; _drumBlast++;
    try{ fuelBlast(b.x, b.z, D, now); fuelChain(b, D); }
    finally{ _drumBlast--; } };
  if(_drumBlast) setTimeout(go, _rnd(D.delay)*1000); else go(); }   // (go: nothing if the field it stood on is gone)
// Z414 the blast of fuel going up (a drum, a farm tank, a rail tanker, a supply base's tank or tanker): fireball, burning fuel thrown out (a fire column for
//   the big ones), and its splash — enemies and their cover, our men, the player
export function fuelBlast(x, z, D, now){ const gy=heightAt(x,z), pos={x,z}, R=D.r, big=D.boom>2;
  bigExplode(pos, 0xff8a3a, D.boom||1.5); fireball(pos, D.fire, gy+0.8); decalScorch(x, z, R*0.55, 1); if(big){ shockDome(x, z, R*1.8, 0xffc890); deformCrater(x, z, 2.2, 0.4); S.shake=Math.min(4.5, S.shake+1.6); }
  for(let k=0;k<(MOBILE?5:10)*(big?1.6:1);k++){ const a=Math.random()*6.283, sp=3+Math.random()*7*(big?1.6:1); spawnPart(x, gy+1, z, Math.cos(a)*sp, 4+Math.random()*6, Math.sin(a)*sp, {tex:'fire', color:0xffd080, color2:0xff3a08, size:big?1.6:0.9, life:0.8+Math.random()*0.4, grav:-12, drag:0.6, grow:0.7}); }   // burning fuel thrown out
  if(big) for(let k=0;k<(MOBILE?8:16);k++) spawnPart(x+_R(-2,2), gy+2+Math.random()*3, z+_R(-2,2), _R(-2,2), 12+Math.random()*12, _R(-2,2), { tex:'fire', color:0xfff0c0, color2:0xb8260a, size:3+Math.random()*2, life:1.0+Math.random()*0.5, grav:5, drag:1.3, grow:2.4 });   // a fire column
  aoeDamage(x, z, R, D.dmg, false, now); blastAllies(x, z, R, D.dmg*0.6);
  const p=S.player; if(p){ const d=Math.hypot(p.pos.x-x, p.pos.z-z); if(d<R){ damagePlayer(Math.round(D.dmg*(1-(1-D.edge)*d/R)*0.6), now, p.pos.x-x, p.pos.z-z, 'blast'); } } }
// Z414 the fuel round a blast goes next, a beat later: drums go up, a big tank / tanker takes spread × its max hp (a whole farm burns through in a few blasts)
const _isFuel=o=>o.kind==='fueldrum' || o.kind==='drums' || (o.supply && (o.kind==='fueltank' || o.kind==='tanker'));
export function fuelChain(src, D){ const sp=D.spread ?? FUEL_TANK.drumSpread;
  for(const o of blocks.slice()) if(o!==src && _isFuel(o) && o.hp>0 && Math.hypot(o.x-src.x, o.z-src.z)<D.chain){ const bigO=(o.fuel && o.fuel.boom>2) || o.supply;
    setTimeout(()=>{ if(blocks.includes(o)) damageBlock(o, bigO ? o.maxHp*sp+1 : 999); }, _rnd(D.delay)*1000); } }
// Z193 a solid piece under fire: chips + dust (stone) or sparks (steel) every hit; at ⅔ and ⅓ it cracks, darkens, is knocked askew and sheds chunks;
//   at 0 it collapses into a heap of its own rubble. Shows how much is left like a rock does.
const _STONEY=new Set(['concrete','pipes','jersey','teeth','hesco']);
export function heavyDamage(b, dmg){ const gy=heightAt(b.x,b.z), stone=_STONEY.has(b.kind), pos={x:b.x,z:b.z}, ms=b.ms||1, top=gy+(b.mesh.geometry&&b.mesh.geometry.userData.h||1.6)*ms;
  b.hp-=dmg;
  if(stone){ burst(pos, b.kind==='hesco'?0xc8b48a:0xb8b2a6, 4, 5, {y:gy+0.6+Math.random()*(top-gy-0.6), life:0.5, size:0.3, grav:-16, drag:1.4, up:2.5}); burst(pos, b.kind==='hesco'?0xc2ae84:0xb0aaa0, 1, 2, {y:gy+1, life:0.9, size:1.6, smoke:true, grav:-0.4, drag:2, up:1, op:0.42}); }
  else burst(pos, 0xffe0a0, 5, 7, {y:gy+0.8+Math.random()*(top-gy-0.8), life:0.25, size:0.2, grav:-12, drag:2, up:2});
  const f=Math.max(0,b.hp)/b.maxHp, st=f<0.34?2:f<0.67?1:0;
  if(st>(b.stage||0)){ b.stage=st; b.mesh.traverse(o=>{ if(o.material && o.material.color) o.material.color.multiplyScalar(st===1?0.8:0.72); });   // cracked, blackened
    b.mesh.rotation.z+=(Math.random()-0.5)*0.07*st; b.mesh.rotation.x+=(Math.random()-0.5)*0.05*st; b.mesh.position.y-=0.07*st;          // knocked askew, settles
    spawnDebris(pos, 0.6+0.2*st, stone?0x9a968c:0x4a423c); burst(pos, stone?0xb0aaa0:0x2a2622, 3, 3, {y:gy+1.2, life:1.2, size:2.0, smoke:true, grav:-0.4, drag:1.6, up:1.4, op:0.5}); sfx('explode', pos, 0.45); }
  if(b.hp<=0){ if(b.bar){ freeEnemyBar(b.bar); b.bar=null; } destroyCover(b); return; }
  if(!b.bar){ b.bar=getEnemyBar(); b.bar.g.scale.setScalar(1.7); }
  const br=b.bar; br.g.visible=true; br.g.position.set(b.x, top+1.0, b.z); br.g.quaternion.copy(camera.quaternion); br.fill.scale.x=Math.max(0.001,f); br.fill.position.x=-(1-f)*0.5; br.fill.material.color.setHex(stone?0xd8d2c4:0xc8c0b0);
  const stamp=b._barT=performance.now(); setTimeout(()=>{ if(b.bar && b._barT===stamp) b.bar.g.visible=false; }, 3500); }
// Z193 the big lone pieces: shipping containers (a third stacked two high) and burnt-out cars — oriented boxes, solid, breakable
export function placeLone(){ const L=LONE_SET[BIOME.name]||[2,3], mk=MOBILE?0.7:1;
  for(const [kind,n0] of [['container',L[0]],['wreck',L[1]]]){ const n=Math.round(n0*AREA_K*mk), g=coverGeo(kind), gb=g.boundingBox||(g.computeBoundingBox(), g.boundingBox), D={ hw:(gb.max.x-gb.min.x)/2, hl:(gb.max.z-gb.min.z)/2 };   // Z404 its box off its own model: the wreck (long along x) had its box turned 90° — 1.3 m of nothing either side, its nose and tail outside
    for(let i=0;i<n;i++){ let x=0,z=0,ok=false;
      for(let t=0;t<30&&!ok;t++){ x=(Math.random()*2-1)*(ARENA-10); z=(Math.random()*2-1)*(ARENA-10); ok=Math.hypot(x,z)>20 && Math.hypot(x,z-ARENA*0.55)>16 && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<9) && !inZone(x,z,5) && inField(x,z,7); }
      if(!ok) continue;
      const f=Math.random()*Math.PI, m=makeCoverMesh(kind, true); let hp=COVER_HP[kind];
      if(kind==='container'){ m.material.color.setHex(CONTAINER_PAINT[(Math.random()*CONTAINER_PAINT.length)|0]); coverVariant(m);   // Z420 which real box (and its shade) once the models are in
        if(Math.random()<0.33){ const up=new THREE.Mesh(m.geometry, coverMat('container').clone()); up.material.userData.own=true; up.material.color.setHex(CONTAINER_PAINT[(Math.random()*CONTAINER_PAINT.length)|0]); up.position.set(_R(-0.08,0.08), 2.0, _R(-0.3,0.3)); up.rotation.y=_R(-0.08,0.08); up.castShadow=up.receiveShadow=true; up.userData.kind='container'; coverVariant(up); trackCover(up); m.add(up); hp*=1.6; } }
      else m.material.color.setHex([0xffffff,0xd8c8b8,0xc0b0a0][(Math.random()*3)|0]);
      m.scale.setScalar(COVER_K); m.position.set(x, heightAt(x,z)-0.05, z); m.rotation.y=f; scene.add(m);
      blocks.push({ mesh:m, x, z, r:D.hl*COVER_K*0.8, hp, maxHp:hp, steel:true, heavy:true, cover:true, ms:COVER_K, loot:Math.random()<BALANCE.drop.brick, kind, obb:{ f, hw:D.hw*COVER_K, hl:D.hl*COVER_K } });
      if(blocks[blocks.length-1].loot) addLootBeacon(blocks[blocks.length-1], 'block'); } } }
// Z107 ram a block: flimsy cover in one hit, sturdy structures in a few, steel/concrete on its own ram-strength
export function ramBlock(b, vn, t){ if(b.fort || b.ridge || b.kind==='boulder' || !(b.hp>0)) return false; const R=RAM, now=performance.now()/1000;
  if(vn<R.minV || now<(b.ramAt||0)) return false; b.ramAt=now+R.cd; if(b.tower) b.tower._ramAt=now;   // Z112 remember: a ram (not a shell) brought it down
  const k=Math.min(1,(vn-R.minV)/(R.fullV-R.minV))*(t&&t.ramOn?R.buffMul:1);
  if(!isFinite(b.hp)){ if(b.ramHp==null) b.ramHp=R.steelHp; b.ramHp-=R.steelHp*R.frac*k;   // shell-proof: only a ram cracks it
    burst({x:b.x,z:b.z}, 0x9a968c, 4, 4, {y:1.2, life:0.6, size:0.4, grav:-14, drag:1.4, up:2.5}); sfx('clang');
    if(b.ramHp<=0){ destroyCover(b); return true; } return false; }
  const mh=b.maxHp||b.hp, before=b.hp; damageBlock(b, (mh<=R.weakHp && k>=R.weakK) ? b.hp+1 : mh*R.frac*k); return !blocks.includes(b) || b.hp<before; }   // flimsy → gone in one
// Z112 a lone boulder / steel hedgehog under fire: stone chips + dust each hit, one heavy round or enough hits shatters it
export function hardDamage(b, dmg){ const gy=heightAt(b.x,b.z), rock=b.kind==='boulder', big=dmg>=HARD.oneShot;
  burst({x:b.x,z:b.z}, rock?0xb8ad98:0xffe0a0, rock?5:4, rock?5:6, {y:gy+1+Math.random(), life:rock?0.5:0.25, size:rock?0.35:0.22, grav:-16, drag:1.4, up:2.5});
  if(rock) burst({x:b.x,z:b.z}, 0xa89a84, 2, 2, {y:gy+1, life:0.9, size:1.3, smoke:true, grav:-0.4, drag:2, up:1, op:0.4});
  b.hp -= big ? b.hp+1 : Math.max(dmg, b.maxHp/(dmg>=HARD.lightDmg?HARD.hits:HARD.lightHits)+0.01);   // Z121 3 shots from any real gun (6 from the rapid light ones), 1 from a heavy round
  if(b.mesh && !b.ridge && b.hp>0){ const k=0.9+0.1*Math.max(0,b.hp/b.maxHp); b.mesh.scale.multiplyScalar(k/(b._k||1)); b._k=k; }   // it visibly loses chunks
  if(b.hp>0){ if(!b.bar){ b.bar=getEnemyBar(); b.bar.g.scale.setScalar(1.7); }                      // Z120 a damaged rock shows how much stone is left
    const k=Math.max(0,b.hp/b.maxHp), br=b.bar; br.g.visible=true; br.g.position.set(b.x, gy+b.r*1.5+1.4, b.z); br.g.quaternion.copy(camera.quaternion); br.fill.scale.x=Math.max(0.001,k); br.fill.position.x=-(1-k)*0.5; br.fill.material.color.setHex(0xd8c8a8); const stamp=b._barT=performance.now(); setTimeout(()=>{ if(b.bar && b._barT===stamp) b.bar.g.visible=false; }, 3500); return; }
  if(b.bar){ freeEnemyBar(b.bar); b.bar=null; }
  const pos={x:b.x,z:b.z}, now=performance.now()/1000; const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1);
  if(b.ridge) ridgeRockDown(b); else { shatter(b.mesh, { ...(SHATTER.kinds[b.kind] || SHATTER.kinds.boulder), solid:solidKind(b.kind || 'boulder') }); scene.remove(b.mesh); }   // a ridge rock is two instances of the shared ridge mesh · Z261 the rock / the hedgehog breaks apart
  if(b.bump){ const j=BUMPS.indexOf(b.bump); if(j>=0) BUMPS.splice(j,1); }
  if(!b.ridge){ leaveRubble(b); breakScar(b.x, b.z, Math.max(1.2, b.r||1.5), false); }   // Z193 split stone / twisted beams stay where it stood (Z418 no heap: BREAKUP.heaps) · Z418 the ground torn where it stood
  if(rock){ for(let k=0;k<3;k++) spawnDebris(pos, 1.1, 0x9a8f7c); burst(pos, 0xc8b89a, 10, 5, {y:gy+1.2, life:1.4, size:2.6, smoke:true, grav:-0.5, drag:1.6, up:1.8, op:0.55}); burst(pos, 0x8a8070, 22, 11, {y:gy+1.2, life:0.6, size:0.45, grav:-18, drag:1.1, up:4}); decalCrater(b.x,b.z,1.6,0.6); }
  else { spawnDebris(pos, 1.0, 0x3a3a36); burst(pos, 0xffe0a0, 16, 12, {y:gy+1, life:0.3, size:0.3, grav:-12, drag:2}); }
  sfx('bigexplode', pos); S.shake=Math.min(2.4, S.shake+0.5);
  for(const e of enemies.slice()){ if(!e.def.inf) continue; const d=Math.hypot(e.pos.x-b.x, e.pos.z-b.z); if(d<HARD.shardR){ e._blast={ x:b.x, z:b.z }; damageEnemy(e, HARD.shardDmg*(1-d/HARD.shardR*0.6)); } }   // flying stone cuts down the men sheltering behind it
  floatText(rock?'MỞ ĐƯỜNG':'PHÁ RÀO THÉP', '#ffcf5a', new THREE.Vector3(b.x, gy+2.6, b.z), 13); }
export function destroyCover(b){
  const pos={x:b.x,z:b.z}, now=performance.now()/1000;
  shatter(b.mesh, { ...SHATTER.kinds[b.kind], solid:solidKind(b.kind) }); scene.remove(b.mesh); const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1);   // Z261 it breaks into pieces of itself
  if(b.kind==='drums'){                                                     // FUEL stockpile: fireball + shock wave + burning fuel splashed over everything nearby
    const R=7.5;
    bigExplode(pos, 0xff8a3a, 2.4); fireball(pos, 2.2); decalScorch(b.x, b.z, R*0.9, 1);
    for(let k=0;k<14;k++){ const a=Math.random()*6.283, sp=4+Math.random()*9; spawnPart(b.x, heightAt(b.x,b.z)+1.4, b.z, Math.cos(a)*sp, 5+Math.random()*7, Math.sin(a)*sp, {tex:'fire', color:0xffd080, color2:0xff3a08, size:1.2, life:0.9+Math.random()*0.5, grav:-12, drag:0.6, grow:0.8}); }   // flaming fuel blobs arc out
    aoeDamage(b.x, b.z, R, 60, false, now);
    for(const e of enemies){ const d=Math.hypot(e.pos.x-b.x, e.pos.z-b.z); if(d<R+e.r && !e.def.air){ if(!e.burn) e.burn={lvl:0,until:0}; e.burn.lvl=Math.min(BALANCE.flame.lvlMax, e.burn.lvl+2.5*(1-d/(R+e.r))+1); e.burn.until=now+BALANCE.flame.duration; } }   // tanks behind the drums catch fire
    const p=S.player; if(p){ const d=Math.hypot(p.pos.x-b.x, p.pos.z-b.z); if(d<R){ damagePlayer(Math.round(30*(1-d/R))+6, now, p.pos.x-b.x, p.pos.z-b.z, 'blast'); } }
    fuelChain(b, { chain:R*0.95, delay:[0.18, 0.44] });   // chain reaction through the fuel dump (Z402 and the loose drums · Z414 the big fuel takes a share)
    deformCrater(b.x, b.z, 2.4, 0.5);
    for(let k=0;k<4;k++) spawnDebris(pos, 0.9, 0x6a2a1a);
  } else if(b.kind==='tires'){ spawnDebris(pos, 1.2, 0x1e1e1c); burst(pos, 0x0e0d0c, 6, 3, {y:1.2, life:1.6, size:2.6, smoke:true, grav:-1.2, drag:1.2, up:2, op:0.55}); bigExplode(pos, 0xff7a2a, 1.0); }   // burning rubber, thick black smoke
  else if(b.kind==='container' || b.kind==='wreck'){ const big=b.kind==='container';   // Z193 the steel box / the car goes up: blast, flying sheet metal, and it burns
    bigExplode(pos, 0xff8a3a, big?2.0:1.5); fireball(pos, big?1.8:1.3); decalScorch(b.x, b.z, big?6:4.5, 1); for(let k=0;k<(big?4:3);k++) spawnDebris(pos, 1.1, big?0x6a3a26:0x3a2a20);
    burst(pos, 0x1a1612, 6, 3, {y:heightAt(b.x,b.z)+1.6, life:2.2, size:2.8, smoke:true, grav:-0.8, drag:1.2, up:2, op:0.55}); aoeDamage(b.x, b.z, big?4:3.5, big?30:45, false, now); breakScar(b.x, b.z, b.obb ? Math.max(b.obb.hw, b.obb.hl) : 2, true); }   // Z402 it goes up and is gone: no burning heap left · Z418 the ground torn and burnt where it stood
  else if(HEAVY_KINDS.has(b.kind)){ const gy=heightAt(b.x,b.z), sand=b.kind==='hesco';   // Z193 concrete / HESCO collapses: a dust cloud, chunks thrown out, a heap left behind
    burst(pos, sand?0xc8b48a:0xb8b2a6, 10, 5, {y:gy+1.2, life:1.5, size:2.8, smoke:true, grav:-0.5, drag:1.5, up:1.8, op:0.55}); burst(pos, sand?0xa8936a:0x8e8a82, 20, 10, {y:gy+1.4, life:0.6, size:0.4, grav:-18, drag:1.1, up:4});
    for(let k=0;k<3;k++) spawnDebris(pos, 1.0, sand?0xa8936a:0x9a968c); breakScar(b.x, b.z, b.obb ? Math.max(b.obb.hw, b.obb.hl) : (b.r||1.5), false); sfx('bigexplode', pos); S.shake=Math.min(2.4, S.shake+0.4);   // Z418 the ground torn where it stood
    floatText(sand?'PHÁ RỌ CÁT':'PHÁ BÊ TÔNG', '#ffcf5a', new THREE.Vector3(b.x, gy+2.8, b.z), 13); leaveRubble(b); }
  else if(b.kind==='logs'){ spawnDebris(pos, 1.3, 0x7a5e3e); burst(pos, 0x8a6a40, 14, 9, {y:1.2, life:0.6, size:0.42, grav:-16, drag:1.2, up:3.5}); burst(pos, 0x9a8a70, 3, 2.5, {y:1, life:1.0, size:1.8, smoke:true, grav:-0.4, drag:2, up:1, op:0.4}); sfx('explode'); leaveRubble(b); }   // the stack bursts apart
  else if(b.kind==='crates'){ spawnDebris(pos, 1.4, 0x8a6a40); burst(pos, 0xb08a56, 10, 8, {y:1.2, life:0.6, size:0.4, grav:-16, drag:1.4, up:3}); burst(pos, 0xb09a7a, 3, 2.5, {y:1, life:0.9, size:1.6, smoke:true, grav:-0.4, drag:2, up:1, op:0.4}); sfx('explode'); }   // splinters
  else { burst(pos, 0xc8b48a, 7, 4, {y:1.0, life:1.1, size:2.2, smoke:true, grav:-0.5, drag:1.8, up:1.6, op:0.55}); burst(pos, 0xa8936a, 14, 7, {y:1.2, life:0.55, size:0.3, grav:-18, drag:1.2, up:3}); spawnDebris(pos, 1.0, 0xa8936a); decalCrater(b.x,b.z,1.4,0.5); sfx('explode'); }   // sandbags burst: sand cloud + torn sacks
  if(b.kind==='sandbag'||b.kind==='crates') leaveRubble(b);   // Z193 what is left of it · Z402 what goes up in flames (fuel drums, tyres, containers, car wrecks) is gone — no burning heap
  if(b.loot){ dropPowerup(pos, b.lootTier||0); if(b.cache) dropPowerup(pos, Math.max(0,(b.lootTier||0)-1)); }   // beacon-marked stockpiles always yield; Z93 caches give two
}
