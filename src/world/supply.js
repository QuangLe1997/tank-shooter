// world/supply.js — Z194 ENEMY SUPPLY BASES: a FUEL STATION (tank farm behind a bund wall, pump house, dispensers, tanker trucks) and an AMMO DEPOT
//   (earth-covered igloo bunkers, crate stacks and shell pallets under camo nets, a supply truck) on every battlefield, plus the troop CAMPS
//   (world/camps.js) registered here too. Each is held: riflemen spread round the perimeter behind cover and shift to face the side you attack
//   from, guard tanks circle it and never chase far, and once the alarm goes up it calls gunships and armour in. Burn one down and the enemy
//   feels it for the rest of the battle: no fuel → their tanks crawl and fewer arrive; no ammo → they hit softer and reload slower; no barracks
//   → fewer troops in every wave.
import * as THREE from 'three';
import { SUPPLYB } from '../../config.js';
import { ARENA, BIOME, BUMPS, CAMPS, COVER_K, ENEMY_DEFS, MOBILE, S, _R, _mergeColored, _xf, addCoins, addDiamonds, addScore, aoeDamage, bigExplode, blocks, buildTower, burst, cMod, camera, clampFieldXZ, coverSpot, decalScorch, deformCrater, diffHpMul, diffRewardMul, dropPowerup, enemies, fireball, floatText, freeEnemyBar, getEnemyBar, heightAt, hitFlash, inField, inZone, leaveRubble, loopHpMul, loopRewardMul, makeCoverMesh, propTex, radio, scene, sfx, shockDome, showBanner, spawnDebris, spawnEnemy, spawnPart } from '../hub.js';

export const SUPPLY = { bases:[], fuel:0, ammo:0, camp:0 };
// what the enemy has lost, as multipliers (1 = nothing lost yet)
export function supplySpeed(){ return Math.max(SUPPLYB.cut.min, 1-SUPPLYB.cut.speed*SUPPLY.fuel); }
export function supplyDmg(){ return Math.max(SUPPLYB.cut.min, 1-SUPPLYB.cut.dmg*SUPPLY.ammo); }
export function supplyRate(){ return 1+SUPPLYB.cut.rate*SUPPLY.ammo; }
// trim a wave: tanks go missing for every fuel station lost, infantry squads for every barracks
export function trimWaveForSupply(q){ const C=SUPPLYB.cut, isInf=t=>t==='squad'||(ENEMY_DEFS[t]&&ENEMY_DEFS[t].inf), isTank=t=>ENEMY_DEFS[t]&&!ENEMY_DEFS[t].inf&&!ENEMY_DEFS[t].air&&!ENEMY_DEFS[t].bomber;
  const cut=(test, k)=>{ if(k<=0) return; const idx=[]; q.forEach((t,i)=>{ if(test(t)) idx.push(i); }); let n=Math.min(idx.length-1, Math.round(idx.length*Math.min(0.6,k))); while(n-->0){ const j=idx.pop(); q.splice(j,1); } };
  cut(isTank, C.tanks*SUPPLY.fuel); cut(isInf, C.inf*SUPPLY.camp); return q; }
export function resetSupply(){ for(const B of SUPPLY.bases){ if(B.decor) scene.remove(B.decor); for(const pc of B.pieces) if(pc.mesh) scene.remove(pc.mesh); } SUPPLY.bases.length=0; SUPPLY.fuel=SUPPLY.ammo=SUPPLY.camp=0; }

// ---------- materials / textures ----------
let _M=null;
function mats(){ if(_M) return _M; const V=(o)=>new THREE.MeshStandardMaterial(Object.assign({ vertexColors:true, roughness:0.85, metalness:0.1 }, o));
  const netT=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.clearRect(0,0,128,128);
    for(let i=0;i<260;i++){ x.fillStyle=['#4a5530','#5e6a3a','#6a5a3a','#3a4428'][i%4]; x.beginPath(); x.ellipse(Math.random()*128,Math.random()*128,3+Math.random()*7,2+Math.random()*4,Math.random()*3,0,7); x.fill(); }   // leaf scrim
    x.strokeStyle='#2a2a20'; x.lineWidth=1.5; for(let k=0;k<=128;k+=11){ x.beginPath(); x.moveTo(k,0); x.lineTo(k,128); x.moveTo(0,k); x.lineTo(128,k); x.stroke(); }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4,2); return t; })();
  _M={ paint:V({ map:propTex('steel'), roughness:0.55, metalness:0.45 }), conc:V({ map:propTex('concrete'), roughness:0.92, metalness:0.02 }), metal:V({ map:propTex('drum'), roughness:0.55, metalness:0.6 }),
    soil:V({ roughness:1, metalness:0 }), wood:V({ map:propTex('wood'), roughness:0.85 }), canvas:V({ map:propTex('burlap'), roughness:0.95 }),
    net:new THREE.MeshStandardMaterial({ map:netT, alphaTest:0.45, side:THREE.DoubleSide, roughness:1 }), glow:new THREE.MeshStandardMaterial({ color:0x222018, emissive:0xffd890, emissiveIntensity:1.6 }) };
  return _M; }
// a kit collects coloured parts per material and bakes them into one mesh each (a structure = a handful of draw calls)
function kit(){ const P={}; return { add(m, geo, col){ (P[m]=P[m]||[]).push({ geo, col }); return geo; }, bake(own){ const g=new THREE.Group(), M=mats();
  for(const k in P){ const mat=own && k!=='net' && k!=='glow' ? M[k].clone() : M[k]; if(own && mat!==M[k]) mat.userData.own=true; const m=new THREE.Mesh(_mergeColored(P[k]), mat); m.castShadow=k!=='net'; m.receiveShadow=true; g.add(m); } return g; } }; }
const B3=(w,h,d,x,y,z,ry)=>_xf(new THREE.BoxGeometry(w,h,d),x,y,z,0,ry||0,0), CY=(rt,rb,h,s,x,y,z,rx,rz)=>_xf(new THREE.CylinderGeometry(rt,rb,h,s),x,y,z,rx||0,0,rz||0);
function wheels(K, xs, zs, r){ for(const x of xs) for(const z of zs) K.add('metal', CY(r,r,0.36,14,x,r,z,0,Math.PI/2), 0x1c1b1a); }
function truckCab(K, col, zc){ K.add('paint', B3(2.3,1.9,2.0,0,1.65,zc), col); K.add('paint', B3(2.2,0.8,1.2,0,1.1,zc+1.5), col); K.add('metal', B3(2.0,0.7,0.05,0,2.0,zc+1.01), 0x1a2228); K.add('metal', B3(2.4,0.3,0.2,0,0.75,zc+2.12), 0x2a2a28); }

// ---------- the structures (built in local space: +z faces the battle, 1 unit = 1 m) ----------
function fuelTank(){ const K=kit();
  K.add('conc', CY(3.35,3.45,0.35,30,0,0.17,0), 0x9e9a90);
  K.add('paint', CY(3.0,3.0,5.6,30,0,2.95,0), 0xe6e4dc); K.add('paint', _xf(new THREE.SphereGeometry(3.04,30,8,0,Math.PI*2,0,Math.PI*0.5),0,5.75,0,0,0,0,1,0.3,1), 0xd6d4cc);
  K.add('paint', CY(3.04,3.04,0.55,30,0,1.5,0), 0xd0a020); K.add('paint', CY(3.04,3.04,0.35,30,0,4.6,0), 0x9a2a1e);
  for(const y of [5.8,6.7]) K.add('metal', _xf(new THREE.TorusGeometry(2.95,0.05,5,30),0,y,0,Math.PI/2), 0x6a6a64);
  for(let a=0;a<6.28;a+=0.52) K.add('metal', CY(0.04,0.04,0.9,5,Math.cos(a)*2.95,6.25,Math.sin(a)*2.95), 0x6a6a64);
  for(const s of [-0.28,0.28]) K.add('metal', CY(0.04,0.04,6.0,5,3.12,3.1,s), 0x5a5a56); for(let y=0.5;y<5.8;y+=0.4) K.add('metal', B3(0.05,0.05,0.6,3.12,y,0), 0x5a5a56);   // ladder
  K.add('metal', CY(0.22,0.22,1.6,10,0,0.9,3.2,Math.PI/2), 0x7a7a72); K.add('metal', CY(0.32,0.32,0.4,10,0,0.9,2.7,Math.PI/2), 0x4a4a46);   // outlet + valve
  return K.bake(true); }
function tankerTruck(){ const K=kit(), col=[0x6a6e52,0x7a3a2a,0x3a4a5a][(Math.random()*3)|0];
  K.add('metal', B3(1.2,0.35,8.2,0,0.8,0), 0x2a2a28); truckCab(K, col, 2.6);
  K.add('paint', _xf(new THREE.CylinderGeometry(1.15,1.15,5.2,22),0,2.0,-1.3,Math.PI/2,0,0,1,1,0.85), 0xcfcfc6); K.add('paint', CY(1.17,1.17,0.25,22,0,2.0,-1.3,Math.PI/2), 0xd0a020);
  K.add('metal', CY(0.35,0.35,0.15,10,0,3.15,-0.4), 0x4a4a46); K.add('metal', CY(0.35,0.35,0.15,10,0,3.15,-2.2), 0x4a4a46);
  wheels(K, [-1.05,1.05], [2.8,-2.4,-3.5], 0.55); return K.bake(true); }
function pumpHouse(){ const K=kit();
  K.add('conc', B3(7.0,3.4,4.6,0,1.7,0), 0xb0aca2); K.add('conc', B3(7.6,0.35,5.2,0,3.55,0), 0x8a867c); K.add('metal', B3(1.5,2.3,0.08,-1.6,1.15,2.33), 0x3a4a3a); K.add('metal', B3(1.6,0.9,0.06,1.8,2.1,2.32), 0x1a2228);
  for(const x of [-2.2,0,2.2]){ K.add('metal', CY(0.42,0.42,1.3,14,x,0.75,3.6,0,Math.PI/2), 0x3a5a7a); K.add('metal', B3(0.7,0.7,0.6,x+0.95,0.75,3.6), 0x2a3a4a); K.add('metal', CY(0.14,0.14,1.4,8,x,0.75,4.6,Math.PI/2), 0x6a6a64); }   // pumps + motors
  K.add('metal', CY(0.08,0.08,7,6,3.2,3.6,-1.8), 0x5a5a56); K.add('glow', B3(0.6,0.3,0.4,3.2,7.1,-1.6), 0xffffff);   // floodlight
  return K.bake(true); }
function igloo(){ const K=kit(), soil=new THREE.Color(BIOME.ground||0x8a7a5a).multiplyScalar(0.8).getHex();
  const arch=new THREE.CylinderGeometry(3.6,3.6,9.4,24,1,false,Math.PI/2,Math.PI); arch.rotateX(Math.PI/2); _xf(arch,0,0,0,0,0,0,1.25,1,1); K.add('soil', arch, soil);   // earth-covered magazine
  K.add('conc', B3(9.4,4.4,0.8,0,2.2,4.8), 0xa8a49a); for(const s of [-1,1]) K.add('conc', B3(0.7,3.2,3.0,s*4.9,1.6,5.8,s*0.35), 0x9e9a90);   // headwall + wing walls
  K.add('metal', B3(3.0,2.8,0.12,0,1.4,5.24), 0x46523a); K.add('metal', B3(0.06,2.8,0.14,0,1.4,5.3), 0x22261c); K.add('glow', B3(0.4,0.2,0.2,0,3.2,5.3), 0xffffff);
  K.add('metal', CY(0.3,0.3,1.4,10,0,4.2,-2), 0x5a5a56); K.add('metal', CY(0.42,0.3,0.25,10,0,4.95,-2), 0x4a4a46);   // vent
  for(let i=0;i<9;i++) K.add('soil', _xf(new THREE.SphereGeometry(_R(0.4,0.8),6,4),_R(-4,4),_R(2.8,3.4),_R(-4,3.5),0,0,0,1,0.5,1), new THREE.Color(soil).multiplyScalar(_R(0.8,1.1)).getHex());   // lumps of turf
  return K.bake(true); }
function ammoStack(){ const K=kit(), shells=Math.random()<0.4;
  K.add('wood', B3(2.6,0.18,2.0,0,0.09,0), 0x8a6a40);
  if(shells){ for(let r=0;r<3;r++) for(let c=0;c<6;c++){ const x=-1.05+c*0.42, y=0.38+r*0.38, z=-0.1+(r%2)*0.1; K.add('metal', CY(0.17,0.17,1.3,10,x,y,z,Math.PI/2), 0xb08a3a); K.add('metal', _xf(new THREE.ConeGeometry(0.17,0.45,10),x,y,z+0.87,Math.PI/2), 0x5a6a4a); } }
  else for(let l=0;l<3;l++) for(let c=0;c<2;c++) for(let d=0;d<2;d++){ const w=1.2, h=0.55; K.add('wood', B3(w,h,0.9,-0.62+c*1.24,0.46+l*0.58,-0.48+d*0.96), [0x4e5a34,0x56623a,0x4a5430][(l+c+d)%3]); K.add('paint', B3(w+0.01,0.08,0.91,-0.62+c*1.24,0.46+l*0.58,-0.48+d*0.96), 0xc8a020); }
  return K.bake(true); }
function supplyTruck(){ const K=kit(), col=0x5a6440;
  K.add('metal', B3(1.2,0.35,7.4,0,0.8,0), 0x2a2a28); truckCab(K, col, 2.4);
  K.add('paint', B3(2.4,0.5,4.6,0,1.2,-1.3), col); K.add('canvas', _xf(new THREE.CylinderGeometry(1.25,1.25,4.6,14,1,false,-Math.PI/2,Math.PI),0,1.7,-1.3,Math.PI/2,0,Math.PI/2,1,0.9,1), 0x7a7a52);
  K.add('canvas', B3(2.5,1.2,4.6,0,2.0,-1.3), 0x76764e); wheels(K, [-1.05,1.05], [2.6,-2.2,-3.2], 0.52); return K.bake(true); }

// ---------- placement ----------
const KEEP=new Set(['fortwall','gate','keep','fortcore','tower','camp','brick','obj','corewall','parked','pylon']);
// a site is free when no structure (fort, tower, camp, wall, ridge, loot) is in the way — scattered cover is simply cleared off the yard
export function siteOk(x, z, R){ return !blocks.some(b=>(KEEP.has(b.kind)||b.ridge||b.loot||b.fort||b.supply) && Math.hypot(b.x-x,b.z-z)<b.r+R+2); }
export function clearSite(x, z, R){ for(let i=blocks.length-1;i>=0;i--){ const b=blocks[i]; if(Math.hypot(b.x-x,b.z-z)<b.r+R){ scene.remove(b.mesh); if(b.bar){ freeEnemyBar(b.bar); b.bar=null; } if(b.bump){ const j=BUMPS.indexOf(b.bump); if(j>=0) BUMPS.splice(j,1); } blocks.splice(i,1); } } }
function findSite(R0){ for(const [k,core] of [[1,52],[0.85,48],[0.72,46],[0.58,44]]){ const R=R0*k;   // deep in the enemy half, well clear of our Core (relaxed step by step if the field is crowded)
  for(let t=0;t<1500;t++){ const x=(Math.random()*2-1)*(ARENA-R-8), z=-ARENA+R+8+Math.random()*Math.max(4, ARENA*0.85-R-8);
    if(Math.hypot(x,z)<R+core || !inField(x,z,R+4) || inZone(x,z,R) || CAMPS.some(c=>Math.hypot(c.x-x,c.z-z)<R+20) || SUPPLY.bases.some(B=>Math.hypot(B.x-x,B.z-z)<B.R+R+8) || !siteOk(x,z,R)) continue;
    clearSite(x, z, R0); return [x,z]; } } return null; }
export const SUPPLY_K=1.25;   // the installations are built big: storage tanks ~7.5 m across, 9 m tall
function newBase(kind, x, z, R, K){ K=K||1; const ang=Math.atan2(-x, ARENA*0.55-z), ca=Math.cos(ang), sa=Math.sin(ang);
  const B={ kind, x, z, R, K, ang, at:(lx,lz)=>[x+(lx*ca+lz*sa)*K, z+(-lx*sa+lz*ca)*K], pieces:[], alive:true, alarm:false, hitAt:-99, heloN:0, tankN:0, heloAt:0, tankAt:0, spreadAt:0, guards:[], fires:[], decor:null };
  const st=Math.max(0,S.stage-1); B.heloMax=SUPPLYB.heli[0]+Math.min(SUPPLYB.heli[1]-SUPPLYB.heli[0], st>>1); B.tankMax=SUPPLYB.reinf+(st>=3?1:0); SUPPLY.bases.push(B); return B; }
// one breakable piece of a base (core pieces must all fall for the base to fall)
function piece(B, kind, mesh, lx, lz, ry, shape, core){ const [x,z]=B.at(lx,lz), f=B.ang+(ry||0), hpK=(1+SUPPLYB.hpPerStage*(S.stage-1))*loopHpMul()*diffHpMul(), hp=Math.round(SUPPLYB.hp[kind]*hpK);
  const K=B.K; mesh.scale.setScalar(K); mesh.position.set(x, heightAt(x,z)-0.05, z); mesh.rotation.y=f; scene.add(mesh);
  const b={ mesh, x, z, r:shape.r*K, hp, maxHp:hp, steel:true, loot:false, kind, supply:B, core:!!core }; if(shape.hw) b.obb={ f:f+(shape.across?Math.PI/2:0), hw:shape.hw*K, hl:shape.hl*K };
  blocks.push(b); B.pieces.push(b); return b; }
function nest(B, lx, lz, ry){ const [x,z]=B.at(lx,lz); if(!inField(x,z,3) || blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+1.2)) return; const m=makeCoverMesh('sandbag', true); m.scale.setScalar(COVER_K); m.position.set(x,heightAt(x,z)-0.12,z); m.rotation.y=B.ang+(ry||0); scene.add(m);
  blocks.push({ mesh:m, x, z, r:1.7*COVER_K, hp:85, maxHp:85, steel:false, cover:true, ms:COVER_K, loot:false, kind:'sandbag' }); }
function garrison(B, nInf){ const st=S.stage, n=Math.round(Math.min(SUPPLYB.guards[1], SUPPLYB.guards[0]+st)*(MOBILE?0.7:1));
  for(let k=0;k<(nInf??n);k++){ const a=B.ang+(k/n)*6.283, r=B.R*(0.75+Math.random()*0.2), x=B.x+Math.sin(a)*r, z=B.z+Math.cos(a)*r; const e=spawnEnemy(k%4===3&&st>=2?'rpg':'rifle', x, z); if(!e) continue; e.guard={ kind:'supply', base:B }; e.post=[x,z]; e.loot=false; B.guards.push(e); }
  const nt=SUPPLYB.tanks[0]+(st>=3?SUPPLYB.tanks[1]-SUPPLYB.tanks[0]:0); for(let k=0;k<nt;k++) guardTank(B, k*Math.PI); }
const TANKS_BY=[['grunt','gunner'],['grunt','gunner','shield'],['gunner','shield','heavy'],['heavy','shield','chief']];
function guardTank(B, a0){ const L=TANKS_BY[Math.min(TANKS_BY.length-1, (S.stage-1)>>1)], a=B.ang+Math.PI+(a0||0)+_R(-0.6,0.6), r=B.R+4, [x,z]=clampFieldXZ(B.x+Math.sin(a)*r, B.z+Math.cos(a)*r, 6);
  const e=spawnEnemy(L[(Math.random()*L.length)|0], x, z); if(!e) return null; e.guard={ kind:'supply', base:B }; e.guardBase=B; e._gA=a; e.loot=Math.random()<0.4; return e; }

export function buildSupply(){
  const st=Math.min(4,S.stage-1);
  for(let i=0;i<SUPPLYB.perStage.fuel[st];i++){ const s=findSite(17*SUPPLY_K); if(!s) continue; const B=newBase('fuel', s[0], s[1], 17*SUPPLY_K, SUPPLY_K);
    for(const lx of [-7.6,0,7.6]) piece(B, 'fueltank', fuelTank(), lx, -2.5, 0, { r:3.2 }, true);
    piece(B, 'pumphouse', pumpHouse(), 0, 7.0, 0, { r:3.4, hw:2.4, hl:3.6, across:true });
    piece(B, 'tanker', tankerTruck(), -9.5, 10.5, 0.25, { r:2.2, hw:1.3, hl:4.1 }); piece(B, 'tanker', tankerTruck(), 10.5, 9.0, -0.35, { r:2.2, hw:1.3, hl:4.1 });
    const K=kit(); for(const [w,d,x,z] of [[25,0.45,0,-7.4],[25,0.45,0,2.6],[0.45,10,-12.5,-2.4],[0.45,10,12.5,-2.4]]) K.add('conc', B3(w,1.1,d,x,0.55,z), 0xa6a298);   // bund wall
    for(const y of [0.9,1.25,1.6]) K.add('metal', CY(0.16,0.16,15.4,10,0,y,3.6,0,Math.PI/2), [0x8a8a82,0x9a2a1e,0x7a7a72][Math.round((y-0.9)/0.35)]);   // pipe rack
    for(const x of [-7.4,-2.5,2.5,7.4]){ K.add('metal', B3(0.15,1.8,0.15,x,0.9,3.6), 0x4a4a46); K.add('metal', B3(0.15,0.15,0.8,x,1.75,3.6), 0x4a4a46); }
    for(const x of [-7.6,0,7.6]) K.add('metal', CY(0.13,0.13,3.2,8,x,0.9,1.7,Math.PI/2), 0x7a7a72);
    for(const x of [-4,4]){ K.add('conc', B3(3.4,0.25,1.4,x,0.12,12.4), 0x9e9a90); for(const s of [-1,1]){ K.add('paint', B3(0.9,1.7,0.6,x+s*0.9,1.05,12.4), 0xc8c4b8); K.add('paint', B3(0.92,0.35,0.62,x+s*0.9,1.6,12.4), 0x9a2a1e); } K.add('metal', B3(3.6,0.15,1.8,x,3.2,12.4), 0x8a8a82); for(const s of [-1,1]) K.add('metal', CY(0.08,0.08,3.1,6,x+s*1.6,1.6,12.4), 0x6a6a64); }   // dispenser islands under canopies
    for(const [x,z] of [[-12.5,-7.4],[12.5,2.6]]){ K.add('metal', CY(0.1,0.13,10,6,x,5,z), 0x5a5a56); K.add('glow', B3(0.9,0.4,0.5,x,10,z), 0xffffff); }   // floodlight masts
    const d=K.bake(false); d.scale.setScalar(B.K); d.position.set(B.x, heightAt(B.x,B.z)-0.05, B.z); d.rotation.y=B.ang; scene.add(d); B.decor=d;
    for(const [lx,lz,ry] of [[-15,-9,0.8],[15,-9,-0.8],[-15,6,-0.6],[15,6,0.6],[0,-11,0]]) nest(B, lx, lz, ry);
    { const [tx,tz]=B.at(-15.5,-1); if(!blocks.some(b=>Math.hypot(b.x-tx,b.z-tz)<b.r+3)) buildTower(tx, tz); }
    B.garrison=true; }
  for(let i=0;i<SUPPLYB.perStage.ammo[st];i++){ const s=findSite(16*SUPPLY_K); if(!s) continue; const B=newBase('ammo', s[0], s[1], 16*SUPPLY_K, SUPPLY_K);
    for(const lx of [-6.8,6.8]) piece(B, 'bunker', igloo(), lx, -3.5, 0, { r:4.4, hw:4.5, hl:4.9 }, true);
    for(const [lx,lz] of [[-6.6,7.2],[-2.2,7.6],[2.2,7.4],[6.6,7.0]]) piece(B, 'ammostack', ammoStack(), lx, lz, _R(-0.2,0.2), { r:1.7 });
    piece(B, 'supplytruck', supplyTruck(), 11.5, 6, -0.3, { r:2.2, hw:1.3, hl:3.7 });
    const K=kit(); for(const [x,z] of [[-9,5],[-9,9.6],[0,5],[0,9.6],[9,5],[9,9.6]]) K.add('metal', CY(0.06,0.06,3.4,6,x,1.7,z), 0x5a4a32);
    K.add('net', _xf(new THREE.PlaneGeometry(19,5.6,6,3),0,3.35,7.3,-Math.PI/2+0.03,0,0.02), 0xffffff);
    const soil=new THREE.Color(BIOME.ground||0x8a7a5a).multiplyScalar(0.75).getHex(); for(const x of [-13,13]) K.add('soil', _xf(new THREE.CylinderGeometry(0.6,1.8,2.0,4,1),x,1.0,-1,0,Math.PI/4,0,1,1,4.5), soil);   // earth traverses
    K.add('paint', B3(1.6,1.0,0.05,0,1.5,12.2), 0xd0a020);
    const d=K.bake(false); d.scale.setScalar(B.K); d.position.set(B.x, heightAt(B.x,B.z)-0.05, B.z); d.rotation.y=B.ang; scene.add(d); B.decor=d;
    for(const [lx,lz,ry] of [[-14,-10,0.8],[14,-10,-0.8],[-14,12,-0.6],[14,12,0.6],[-3,13.5,0]]) nest(B, lx, lz, ry);
    { const [tx,tz]=B.at(15,-1); if(!blocks.some(b=>Math.hypot(b.x-tx,b.z-tz)<b.r+3)) buildTower(tx, tz); }
    B.garrison=true; }
}
// the troop camps (world/camps.js) are bases too: same guards, same alarm, losing one costs the enemy troops
export function registerCampBase(camp){ const B=newBase('camp', camp.x, camp.z, 15); B.camp=camp; B.garrison=true; B.gInf=Math.round(Math.min(SUPPLYB.guards[1]-2, 2+S.stage)*(MOBILE?0.7:1)); return B; }
// the garrisons go in last, after buildZones() has cleared its own guards (it removes every enemy that has a post)
export function garrisonSupply(){ for(const B of SUPPLY.bases) if(B.garrison){ B.garrison=false; garrison(B, B.gInf); } }

// ---------- damage ----------
export function supplyDamage(b, dmg){ const B=b.supply, gy=heightAt(b.x,b.z), now=performance.now()/1000; if(!(b.hp>0)) return;
  b.hp-=dmg; B.hitAt=now; hitFlash(b.mesh);
  burst({x:b.x,z:b.z}, b.kind==='bunker'?0xb0aaa0:0xffe0a0, 4, 6, {y:gy+1+Math.random()*2.5, life:0.35, size:0.25, grav:-14, drag:1.6, up:2});
  const f=Math.max(0,b.hp)/b.maxHp, stg=f<0.34?2:f<0.67?1:0;
  if(stg>(b.stage||0)){ b.stage=stg; b.mesh.traverse(o=>{ if(o.material&&o.material.color&&o.material.userData.own) o.material.color.multiplyScalar(0.78); });
    if(b.kind==='fueltank'||b.kind==='tanker') B.fires.push({ x:b.x+_R(-1,1), z:b.z+_R(-1,1), y:gy+_R(1.5,4), t:30, s:0.6 });   // a hole spurting burning fuel
    burst({x:b.x,z:b.z}, 0x221e1a, 3, 3, {y:gy+2, life:1.6, size:2.2, smoke:true, grav:-0.6, drag:1.4, up:1.6, op:0.5}); sfx('explode', {x:b.x,z:b.z}, 0.5); }
  if(b.hp<=0){ if(b.bar){ freeEnemyBar(b.bar); b.bar=null; } pieceDown(b); return; }
  if(!b.bar){ b.bar=getEnemyBar(); b.bar.g.scale.setScalar(2.0); }
  const br=b.bar; br.g.visible=true; br.g.position.set(b.x, gy+(b.kind==='fueltank'?8:b.kind==='bunker'?6.2:4.4), b.z); br.g.quaternion.copy(camera.quaternion); br.fill.scale.x=Math.max(0.001,f); br.fill.position.x=-(1-f)*0.5; br.fill.material.color.setHex(0xff7a3a);
  const stamp=b._barT=performance.now(); setTimeout(()=>{ if(b.bar && b._barT===stamp) b.bar.g.visible=false; }, 4000); }
function cookOff(x, z, n, R, dmg){ for(let k=0;k<n;k++) setTimeout(()=>{ if(S.mode!=='playing' && S.mode!=='paused') return; const q={x:x+_R(-R,R)*0.5, z:z+_R(-R,R)*0.5}; bigExplode(q, 0xffa040, 1.1+Math.random()*0.8);
    for(let i=0;i<(MOBILE?4:9);i++){ const a=Math.random()*6.283, sp=14+Math.random()*16; spawnPart(q.x, heightAt(q.x,q.z)+1.2, q.z, Math.cos(a)*sp, 4+Math.random()*12, Math.sin(a)*sp, { color:0xfff0b0, color2:0xff5a10, size:0.22, life:0.7+Math.random()*0.6, grav:-14, drag:0.3 }); }   // rounds cooking off, streaking out
    if(k%2===0) aoeDamage(q.x, q.z, R*0.6, dmg, false, performance.now()/1000, 'HE'); }, 120+k*(240+Math.random()*200)); }
function pieceDown(b){ const B=b.supply, pos={x:b.x,z:b.z}, gy=heightAt(b.x,b.z), now=performance.now()/1000; const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1);
  const char=(k)=>{ b.mesh.traverse(o=>{ if(o.material&&o.material.color){ if(!o.material.userData.own){ o.material=o.material.clone(); o.material.userData.own=true; } o.material.color.multiplyScalar(k); if(o.material.emissive) o.material.emissive.setHex(0); } }); };
  if(b.kind==='fueltank'){ bigExplode(pos, 0xff7a2a, 3.2); fireball(pos, 3.2); shockDome(b.x, b.z, 16, 0xffc890); decalScorch(b.x, b.z, 10, 1); deformCrater(b.x,b.z,2.6,0.4); aoeDamage(b.x, b.z, 8, 80, false, now, 'HE');
    for(let k=0;k<(MOBILE?8:16);k++) spawnPart(b.x+_R(-2,2), gy+2+Math.random()*3, b.z+_R(-2,2), _R(-2,2), 12+Math.random()*12, _R(-2,2), { tex:'fire', color:0xfff0c0, color2:0xb8260a, size:3+Math.random()*2, life:1.0+Math.random()*0.5, grav:5, drag:1.3, grow:2.4 });   // a fire column
    char(0.22); b.mesh.scale.y*=0.42; b.mesh.rotation.z=_R(-0.12,0.12); B.fires.push({ x:b.x, z:b.z, y:gy+2.2, t:45, s:1.8 }); S.shake=Math.min(4.5, S.shake+2.0); sfx('bigexplode', pos);
    for(const o of B.pieces) if(o!==b && o.hp>0 && Math.hypot(o.x-b.x,o.z-b.z)<11) setTimeout(()=>{ if(o.hp>0 && blocks.includes(o)) supplyDamage(o, o.maxHp*0.45); }, 350+Math.random()*400); }   // the fire spreads along the farm
  else if(b.kind==='tanker' || b.kind==='supplytruck'){ bigExplode(pos, 0xff8a3a, 2.0); fireball(pos, 1.8); decalScorch(b.x,b.z,6,1); aoeDamage(b.x, b.z, 5, 50, false, now, 'HE'); for(let k=0;k<3;k++) spawnDebris(pos, 1.1, 0x3a2a20);
    char(0.25); b.mesh.scale.y*=0.7; b.mesh.rotation.z=_R(-0.15,0.15); B.fires.push({ x:b.x, z:b.z, y:gy+1.2, t:22, s:1.2 }); if(b.kind==='supplytruck') cookOff(b.x, b.z, 3, 5, 30); }
  else if(b.kind==='bunker'){ bigExplode(pos, 0xffb050, 3.4); fireball(pos, 3.0); shockDome(b.x, b.z, 18, 0xffd8a0); decalScorch(b.x,b.z,11,1); deformCrater(b.x,b.z,3.4,0.6); cookOff(b.x, b.z, MOBILE?5:9, 10, 45);
    char(0.3); b.mesh.scale.y*=0.5; b.mesh.position.y-=0.4; B.fires.push({ x:b.x, z:b.z, y:gy+1.5, t:30, s:1.5 }); for(let k=0;k<4;k++) spawnDebris(pos, 1.3, 0x8a867c); S.shake=Math.min(4.5, S.shake+2.4); sfx('bigexplode', pos); }
  else if(b.kind==='ammostack'){ cookOff(b.x, b.z, 3, 4, 35); scene.remove(b.mesh); leaveRubble({ kind:'crates', mesh:b.mesh, x:b.x, z:b.z, r:1.7 }, 8); }
  else { bigExplode(pos, 0xff8a3a, 1.8); burst(pos, 0xb0aaa0, 10, 5, {y:gy+1.4, life:1.5, size:3, smoke:true, grav:-0.5, drag:1.5, up:1.8, op:0.55}); char(0.3); b.mesh.scale.y*=0.4; for(let k=0;k<3;k++) spawnDebris(pos, 1.1, 0x9a968c); }   // pump house caves in
  addScore(300, new THREE.Vector3(b.x, gy+4, b.z));
  if(B.alive && B.pieces.filter(o=>o.core).every(o=>!(o.hp>0))) baseLost(B); }
const NAME={ fuel:'TRẠM NHIÊN LIỆU', ammo:'KHO ĐẠN DƯỢC', camp:'TRẠI LÍNH' };
const LOST={ fuel:'Xe tăng địch thiếu nhiên liệu: chạy chậm hơn, viện binh thiết giáp giảm.', ammo:'Địch thiếu đạn: bắn yếu hơn, nạp đạn chậm hơn.', camp:'Địch mất trại lính: mỗi đợt ít bộ binh hơn.' };
export function baseLost(B){ if(!B.alive) return; B.alive=false; SUPPLY[B.kind]++;
  for(const e of B.guards) if(enemies.includes(e) && e.guard && e.guard.base===B){ e.guard=null; e.post=null; }   // the garrison is loose now — no post to hold
  for(const e of enemies) if(e.guardBase===B){ e.guardBase=null; e.guard=null; }
  if(B.kind==='camp') return;   // camps pay out in destroyCamp
  const R=SUPPLYB, mul=loopRewardMul()*diffRewardMul()*cMod('coinMul'), coins=Math.round((R.coin+90*S.stage)*mul);
  addCoins(coins); addDiamonds(1); addScore(R.score, new THREE.Vector3(B.x, 6, B.z)); dropPowerup({x:B.x, z:B.z+4}, 2);
  showBanner('ĐÃ PHÁ '+NAME[B.kind]+'  +'+coins+' ◎  +1 ◆', '#ffd24a'); floatText(NAME[B.kind]+' BỊ PHÁ HUỶ', '#ffcf5a', new THREE.Vector3(B.x, 9, B.z), 26); radio('SCH: '+NAME[B.kind]+' địch đã bị phá huỷ! '+LOST[B.kind]); sfx('levelup'); }
// a camp destroyed in camps.js
export function campLost(camp){ const B=SUPPLY.bases.find(q=>q.camp===camp); if(B){ baseLost(B); radio('SCH: Trại lính địch đã bị san phẳng! '+LOST.camp); } }

// ---------- the living bases: alarm, guards shifting to face you, gunships and armour called in, fires burning ----------
export function updateSupply(dt, now){ const p=S.player; if(!p || S.mode!=='playing') return;
  for(const B of SUPPLY.bases){
    for(let i=B.fires.length-1;i>=0;i--){ const F=B.fires[i]; F.t-=dt; if(F.t<=0){ B.fires.splice(i,1); continue; } if(Math.random()>(MOBILE?0.35:0.7)) continue; const k=Math.min(1,F.t/8);
      spawnPart(F.x+_R(-1,1)*F.s, F.y, F.z+_R(-1,1)*F.s, _R(-0.4,0.4), 3+Math.random()*2, _R(-0.4,0.4), { tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:(1+Math.random())*F.s*(0.4+0.6*k), life:0.6, grav:1.6, drag:1.4, grow:0.8 });
      if(Math.random()<0.5) spawnPart(F.x, F.y+2*F.s, F.z, 0.6, 2.4, 0.3, { color:0x120f0c, size:2.2*F.s, life:3, smoke:true, grav:0.25, drag:0.6, grow:3, op:0.3+0.3*k }); }
    if(!B.alive) continue;
    if(B.camp && !B.camp.alive){ baseLost(B); continue; }
    const dp=Math.hypot(p.pos.x-B.x, p.pos.z-B.z);
    if(!B.alarm && (dp < SUPPLYB.alertR || now-B.hitAt < 2)){ B.alarm=true; B.heloAt=now+4; B.tankAt=now+8; radio('SCH: Lính canh '+NAME[B.kind]+' đã phát hiện ta — chúng đang gọi trực thăng và xe tăng yểm trợ!'); }
    if(!B.alarm) continue;
    if(dp > SUPPLYB.alertR*2.2 && now-B.hitAt > 25){ B.alarm=false; continue; }   // you left: they stand down
    if(now>B.heloAt && B.heloN<B.heloMax && enemies.filter(e=>e.def.air).length<(MOBILE?2:3)){ B.heloAt=now+SUPPLYB.heliCd; B.heloN++;
      const a=Math.atan2(B.x-p.pos.x, B.z-p.pos.z), [hx,hz]=clampFieldXZ(B.x+Math.sin(a)*40, B.z+Math.cos(a)*40, 8); if(spawnEnemy('gunship', hx, hz)) radio('SCH: Trực thăng địch cất cánh yểm trợ '+NAME[B.kind]+'!'); }
    if(now>B.tankAt && B.tankN<B.tankMax){ B.tankAt=now+SUPPLYB.tankCd; B.tankN++; guardTank(B, _R(-0.8,0.8)); }
    if(now>B.spreadAt){ B.spreadAt=now+3; const live=B.guards.filter(e=>enemies.includes(e) && e.guard && e.guard.base===B), bear=Math.atan2(p.pos.x-B.x, p.pos.z-B.z), n=live.length;   // spread along the threatened side, each behind something solid
      live.forEach((e,k)=>{ const a=bear+(n>1?(k/(n-1)-0.5):0)*2.2, r=B.R*0.85, x=B.x+Math.sin(a)*r, z=B.z+Math.cos(a)*r, c=coverSpot(x, z, p.pos.x, p.pos.z, 7); e.post = c ? [c.x, c.z] : [x, z]; }); } } }
// a guard tank's leash: while you are far from its base it circles the base and holds fire; come close and it fights
const _gT=new THREE.Vector3();
export function guardLeash(e, dt, p){ const B=e.guardBase; if(!B || !B.alive){ e.guardBase=null; return null; }
  if(Math.hypot(p.pos.x-B.x, p.pos.z-B.z) < SUPPLYB.leash || (B.alarm && performance.now()/1000-B.hitAt<6)) return null;
  e._gA=(e._gA||0)+dt*0.08; return _gT.set(B.x+Math.sin(e._gA)*(B.R+3), 0, B.z+Math.cos(e._gA)*(B.R+3)); }
