// world/supply.js — Z194 ENEMY SUPPLY BASES: a FUEL STATION (tank farm behind a bund wall, pump house, dispensers, tanker trucks) and an AMMO DEPOT
//   (earth-covered igloo bunkers, crate stacks and shell pallets under camo nets, a supply truck) on every battlefield, plus the troop CAMPS
//   (world/camps.js) registered here too. Each is held: riflemen spread round the perimeter behind cover and shift to face the side you attack
//   from, guard tanks circle it and never chase far, and once the alarm goes up it calls gunships and armour in. Burn one down and the enemy
//   feels it for the rest of the battle: no fuel → their tanks crawl and fewer arrive; no ammo → they hit softer and reload slower; no barracks
//   → fewer troops in every wave.
import * as THREE from 'three';
import { SUPPLYB, FENCE, SCENERY } from '../../config.js';
import { ARENA, BIOME, BUMPS, CAMPS, CAMP_R, COVER_K, ENEMY_DEFS, HF, HULL_HL, HULL_HW, MOBILE, S, TANK_SCALE, _R, _mergeColored, _xf, aaGun, addCoins, addDiamonds, addScore, aoeDamage, aviationMat, bigExplode, blocks, buildTower, burst, cMod, camera, clampFieldXZ, coverSpot, crushables, decalScorch, deformCrater, diffHpMul, diffRewardMul, driveHint, dropPowerup, enemies, fireball, floatText, freeEnemyBar, getEnemyBar, heightAt, hitFlash, homeClear, inField, inZone, leaveRubble, loopHpMul, loopRewardMul, makeCoverMesh, propTex, radarTower, radarYard, radio, radome, scene, sfx, shockDome, showBanner, spawnDebris, spawnEnemy, spawnPart, toppleTower, updateAAGun, updateTopple, playerSeen, ridgeRockDown, sceneDims } from '../hub.js';

export const SUPPLY = { bases:[], fuel:0, ammo:0, camp:0, radar:0 };
// what the enemy has lost, as multipliers (1 = nothing lost yet)
export function supplySpeed(){ return Math.max(SUPPLYB.cut.min, 1-SUPPLYB.cut.speed*SUPPLY.fuel); }
export function supplyDmg(){ return Math.max(SUPPLYB.cut.min, 1-SUPPLYB.cut.dmg*SUPPLY.ammo); }
export function supplyRate(){ return 1+SUPPLYB.cut.rate*SUPPLY.ammo; }
// trim a wave: tanks go missing for every fuel station lost, infantry squads for every barracks
export function trimWaveForSupply(q){ const C=SUPPLYB.cut, isInf=t=>t==='squad'||(ENEMY_DEFS[t]&&ENEMY_DEFS[t].inf), isTank=t=>ENEMY_DEFS[t]&&!ENEMY_DEFS[t].inf&&!ENEMY_DEFS[t].air&&!ENEMY_DEFS[t].bomber;
  const cut=(test, k)=>{ if(k<=0) return; const idx=[]; q.forEach((t,i)=>{ if(test(t)) idx.push(i); }); let n=Math.min(idx.length-1, Math.round(idx.length*Math.min(0.6,k))); while(n-->0){ const j=idx.pop(); q.splice(j,1); } };
  cut(isTank, C.tanks*SUPPLY.fuel); cut(isInf, C.inf*SUPPLY.camp); return q; }
export function resetSupply(){ for(const B of SUPPLY.bases){ if(B.decor) scene.remove(B.decor); if(B.fence){ scene.remove(B.fence.a, B.fence.b); B.fence.a.dispose(); B.fence.b.dispose(); } for(const pc of B.pieces) if(pc.mesh) scene.remove(pc.mesh); } SUPPLY.bases.length=0; SUPPLY.fuel=SUPPLY.ammo=SUPPLY.camp=SUPPLY.radar=0; }

// ---------- materials / textures ----------
let _M=null;
function mats(){ if(_M) return _M; const V=(o)=>new THREE.MeshStandardMaterial(Object.assign({ vertexColors:true, roughness:0.85, metalness:0.1 }, o));
  const netT=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.clearRect(0,0,128,128);
    for(let i=0;i<260;i++){ x.fillStyle=['#4a5530','#5e6a3a','#6a5a3a','#3a4428'][i%4]; x.beginPath(); x.ellipse(Math.random()*128,Math.random()*128,3+Math.random()*7,2+Math.random()*4,Math.random()*3,0,7); x.fill(); }   // leaf scrim
    x.strokeStyle='#2a2a20'; x.lineWidth=1.5; for(let k=0;k<=128;k+=11){ x.beginPath(); x.moveTo(k,0); x.lineTo(k,128); x.moveTo(0,k); x.lineTo(128,k); x.stroke(); }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4,2); return t; })();
  _M={ paint:V({ map:propTex('steel'), roughness:0.58, metalness:0.2 }), conc:V({ map:propTex('concrete'), roughness:0.92, metalness:0.02 }), metal:V({ map:propTex('drum'), roughness:0.55, metalness:0.6 }),
    soil:V({ roughness:1, metalness:0 }), wood:V({ map:propTex('wood'), roughness:0.85 }), canvas:V({ map:propTex('burlap'), roughness:0.95 }),
    net:new THREE.MeshStandardMaterial({ map:netT, alphaTest:0.45, side:THREE.DoubleSide, roughness:1 }), glow:new THREE.MeshStandardMaterial({ color:0x222018, emissive:0xffd890, emissiveIntensity:1.6 }) };
  return _M; }
// a kit collects coloured parts per material and bakes them into one mesh each (a structure = a handful of draw calls)
export function kit(){ const P={}; return { add(m, geo, col){ (P[m]=P[m]||[]).push({ geo, col }); return geo; }, bake(own){ const g=new THREE.Group(), M=mats();
  for(const k in P){ const mat=own && k!=='net' && k!=='glow' ? M[k].clone() : M[k]; if(own && mat!==M[k]) mat.userData.own=true; const m=new THREE.Mesh(_mergeColored(P[k]), mat); m.castShadow=k!=='net'; m.receiveShadow=true; g.add(m); } return g; } }; }
export const B3=(w,h,d,x,y,z,ry)=>_xf(new THREE.BoxGeometry(w,h,d),x,y,z,0,ry||0,0), CY=(rt,rb,h,s,x,y,z,rx,rz)=>_xf(new THREE.CylinderGeometry(rt,rb,h,s),x,y,z,rx||0,0,rz||0);
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
// Z196 level the ground under a compound: flat inside rIn (the mean height there), blending back to the natural ground by rOut;
//   loose stones sitting on the reshaped ground are tidied away so nothing floats or sinks
const _Z0=new THREE.Matrix4().makeScale(0,0,0);
export function flattenPad(x, z, rIn, rOut){ const W=HF.W, h=HF.h, st=HF.step; if(!h) return; let sum=0, n=0;
  for(let a=0;a<6.283;a+=0.5) for(const r of [0, rIn*0.4, rIn*0.8]){ sum+=heightAt(x+Math.cos(a)*r, z+Math.sin(a)*r); n++; } const h0=sum/n;
  const i0=Math.max(0,Math.floor((x-rOut+ARENA)/st)), i1=Math.min(HF.N,Math.ceil((x+rOut+ARENA)/st)), j0=Math.max(0,Math.floor((z-rOut+ARENA)/st)), j1=Math.min(HF.N,Math.ceil((z+rOut+ARENA)/st));
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const d=Math.hypot(-ARENA+i*st-x, -ARENA+j*st-z); if(d>=rOut) continue; const t=d<=rIn?1:1-(d-rIn)/(rOut-rIn), w=t*t*(3-2*t); h[j*W+i]=h[j*W+i]*(1-w)+h0*w; }
  HF.dj0=Math.min(HF.dj0??1e9, j0-1); HF.dj1=Math.max(HF.dj1??-1, j1+1); HF.dirty=true;
  for(const c of crushables) if(c.alive && Math.hypot(c.x-x,c.z-z)<rOut){ c.alive=false; for(const im of [c.im, ...(c.ims||[])]){ im.setMatrixAt(c.k,_Z0); im.instanceMatrix.needsUpdate=true; } } }
const KEEP=new Set(['fortwall','gate','keep','fortcore','tower','camp','brick','obj','corewall','parked','pylon']);
// a site is free when no structure (fort, tower, camp, wall, ridge, loot) is in the way — scattered cover is simply cleared off the yard
export function siteOk(x, z, R){ return !blocks.some(b=>(KEEP.has(b.kind)||b.ridge||b.loot||b.fort||b.supply||b.hp===Infinity) && Math.hypot(b.x-x,b.z-z)<b.r+R+2); }   // Z380 nor on a house, a ruin, a scanned model — and clearSite never takes one away (clearing it took its solid and left the model standing: men and rounds went through it)
// Z404 a ridge rock shares one instanced mesh with its whole spine, a fort section its fort's: clearing one took the mesh away and left every other
//   rock of the ridge (and the fort's walls) solid and invisible — a ridge rock is hidden by its own instances, a structure is never cleared
export function clearSite(x, z, R){ for(let i=blocks.length-1;i>=0;i--){ const b=blocks[i]; if(b.hp===Infinity || KEEP.has(b.kind) || b.fort || b.supply || Math.hypot(b.x-x,b.z-z)>=b.r+R) continue;
    if(b.ridge) ridgeRockDown(b); else scene.remove(b.mesh); if(b.bar){ freeEnemyBar(b.bar); b.bar=null; } if(b.bump){ const j=BUMPS.indexOf(b.bump); if(j>=0) BUMPS.splice(j,1); } blocks.splice(i,1); } }
export const SUPPLY_K=1.25;   // the installations are built big: storage tanks ~7.5 m across, 9 m tall
function newBase(kind, x, z, R, K, ang0){ K=K||1; const ang=ang0??Math.atan2(-x, ARENA*0.55-z), ca=Math.cos(ang), sa=Math.sin(ang);
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

// ---------- Z195 a real compound: chain-link + barbed-wire fence (tanks flatten it), steel gate with a name board and a boom, warning signs ----------
const SIGN_MAT={};
function signMat(kind){ if(SIGN_MAT[kind]) return SIGN_MAT[kind]; const W=256, H=kind==='name'?72:160, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  const F=(px,w)=>(w||900)+' '+px+'px "Saira Condensed", Rajdhani, Arial, sans-serif', txt=(t,y,px,col,w)=>{ x.fillStyle=col; x.font=F(px,w); x.textAlign='center'; x.textBaseline='middle'; x.fillText(t, W/2, y); };
  const grime=()=>{ for(let i=0;i<500;i++){ x.fillStyle='rgba(60,45,30,'+(Math.random()*0.18).toFixed(2)+')'; x.fillRect(Math.random()*W,Math.random()*H,2,2); } for(let i=0;i<6;i++){ const sx=Math.random()*W; const g=x.createLinearGradient(sx,0,sx,H); g.addColorStop(0,'rgba(110,60,25,0.35)'); g.addColorStop(1,'rgba(110,60,25,0)'); x.fillStyle=g; x.fillRect(sx,0,3,H); } for(const [bx,by] of [[10,10],[W-10,10],[10,H-10],[W-10,H-10]]){ x.fillStyle='#555'; x.beginPath(); x.arc(bx,by,3.5,0,7); x.fill(); } };
  const tri=(cx,cy,r,fill)=>{ x.fillStyle='#111'; x.beginPath(); x.moveTo(cx,cy-r); x.lineTo(cx+r*0.95,cy+r*0.7); x.lineTo(cx-r*0.95,cy+r*0.7); x.closePath(); x.fill(); x.fillStyle=fill; x.beginPath(); x.moveTo(cx,cy-r+9); x.lineTo(cx+r*0.95-9,cy+r*0.7-5); x.lineTo(cx-r*0.95+9,cy+r*0.7-5); x.closePath(); x.fill(); };
  if(kind==='fire'){ x.fillStyle='#f2c21a'; x.fillRect(0,0,W,H); tri(52,70,44,'#f2c21a'); x.fillStyle='#111'; x.beginPath(); x.moveTo(52,92); x.bezierCurveTo(30,80,44,60,50,44); x.bezierCurveTo(56,62,72,70,52,92); x.fill();   // flame
    txt('NGUY HIỂM',52,34,'#111'); x.textAlign='left'; x.font=F(25); x.fillStyle='#111'; x.fillText('CHẤT DỄ',104,58); x.fillText('CHÁY NỔ',104,88); txt('XĂNG DẦU — CẤM LỬA',134,30,'#111'); }
  else if(kind==='nosmoke'){ x.fillStyle='#f4f2ea'; x.fillRect(0,0,W,H); x.strokeStyle='#c81e1e'; x.lineWidth=11; x.beginPath(); x.arc(64,78,44,0,7); x.stroke(); x.fillStyle='#222'; x.fillRect(36,72,50,12); x.fillStyle='#d86a2a'; x.fillRect(86,72,8,12);   // cigarette
    x.beginPath(); x.moveTo(33,47); x.lineTo(95,109); x.stroke(); x.textAlign='left'; x.font=F(30); x.fillStyle='#c81e1e'; x.fillText('CẤM LỬA',122,64); x.font=F(22,800); x.fillStyle='#222'; x.fillText('CẤM HÚT THUỐC',122,98); x.fillText('CẤM ĐIỆN THOẠI',122,124); }
  else if(kind==='ammo'){ x.fillStyle='#f27a12'; x.fillRect(0,0,W,H); x.save(); x.translate(60,82); x.rotate(Math.PI/4); x.fillStyle='#111'; x.fillRect(-40,-40,80,80); x.fillStyle='#f27a12'; x.fillRect(-35,-35,70,70); x.restore();
    x.fillStyle='#111'; x.beginPath(); x.arc(60,86,13,0,7); x.fill(); for(let k=0;k<8;k++){ const a=k*0.785; x.fillRect(60+Math.cos(a)*16-3,86+Math.sin(a)*16-3,6,6); } x.font=F(16); x.textAlign='center'; x.fillText('1.1',60,116);   // exploding bomb, class 1.1
    x.textAlign='left'; x.font=F(30); x.fillText('KHO ĐẠN',118,60); x.font=F(22,800); x.fillText('NGUY HIỂM NỔ',118,92); x.fillText('CẤM LẠI GẦN',118,120); }
  else if(kind==='military'){ x.fillStyle='#f4f2ea'; x.fillRect(0,0,W,H); x.fillStyle='#c81e1e'; x.fillRect(0,0,W,46); txt('KHU VỰC QUÂN SỰ',24,30,'#fff'); txt('CẤM VÀO',82,46,'#c81e1e'); txt('Lính gác được phép nổ súng',128,20,'#222',700); }
  else if(kind==='mines'){ x.fillStyle='#c81e1e'; x.fillRect(0,0,W,H); x.fillStyle='#f4f2ea'; x.beginPath(); x.arc(60,70,26,0,7); x.fill(); x.fillRect(46,88,28,16); x.fillStyle='#c81e1e'; x.beginPath(); x.arc(51,68,7,0,7); x.arc(69,68,7,0,7); x.fill();   // skull
    x.strokeStyle='#f4f2ea'; x.lineWidth=7; x.beginPath(); x.moveTo(26,112); x.lineTo(94,140); x.moveTo(94,112); x.lineTo(26,140); x.stroke(); x.textAlign='left'; x.font=F(40); x.fillStyle='#f4f2ea'; x.fillText('CÓ MÌN!',112,70); x.font=F(20,800); x.fillText('Không ra khỏi lối đi',112,108); }
  else if(kind==='radar'){ x.fillStyle='#f2c21a'; x.fillRect(0,0,W,H); x.fillStyle='#111'; x.beginPath(); x.arc(58,80,9,0,7); x.fill();   // radiation trefoil
    for(let k=0;k<3;k++){ const a=-Math.PI/2+k*2.094; x.beginPath(); x.moveTo(58,80); x.arc(58,80,42,a-0.52,a+0.52); x.closePath(); x.fill(); } x.fillStyle='#f2c21a'; x.beginPath(); x.arc(58,80,15,0,7); x.fill(); x.fillStyle='#111'; x.beginPath(); x.arc(58,80,9,0,7); x.fill();
    x.textAlign='left'; x.font=F(26); x.fillText('BỨC XẠ',112,58); x.fillText('ĐIỆN TỪ',112,88); x.font=F(20,800); x.fillText('CẤM VÀO KHU ĂNG-TEN',108,124); }
  else if(kind==='halt'){ x.fillStyle='#c81e1e'; x.fillRect(0,0,W,H); x.strokeStyle='#f4f2ea'; x.lineWidth=6; x.strokeRect(8,8,W-16,H-16); txt('DỪNG LẠI!',62,52,'#f4f2ea'); txt('TRẠM GÁC — XUẤT TRÌNH GIẤY TỜ',118,19,'#f4f2ea',800); }
  else { x.fillStyle='#2e3a26'; x.fillRect(0,0,W,H); x.strokeStyle='#d8d0b8'; x.lineWidth=3; x.strokeRect(5,5,W-10,H-10); txt(kind==='nameA'?'KHO ĐẠN DƯỢC':kind==='nameC'?'TRẠI LÍNH':kind==='nameR'?'TRẠM RADAR':'TRẠM NHIÊN LIỆU',H*0.55,40,'#f0e8d0'); }
  grime(); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
  return SIGN_MAT[kind]=new THREE.MeshStandardMaterial({ map:t, roughness:0.75, metalness:0.15 }); }
let _sb=null; function signBack(){ return _sb||(_sb=new THREE.MeshStandardMaterial({ color:0x6a6c64, roughness:0.7, metalness:0.4, side:THREE.BackSide })); }
// one 3 m fence bay (built once): Y-picket with an outrigger, 3 barbed strands + 2 on the outrigger, a razor concertina along the foot outside, and the chain-link panel
let _bayG=null;
function bayGeo(){ if(_bayG) return _bayG; const P=[], L=3;
  P.push({ geo:B3(0.09,2.5,0.09,0,1.25,0), col:0x5a4a3a }); P.push({ geo:_xf(new THREE.BoxGeometry(0.06,0.7,0.06),0,2.72,0.18,0.75,0,0), col:0x5a4a3a });   // picket + outrigger
  P.push({ geo:B3(L,0.05,0.05,L/2,2.45,0), col:0x6a6660 }); P.push({ geo:B3(L,0.05,0.05,L/2,0.12,0), col:0x6a6660 });   // top + bottom rail
  for(const [y,z] of [[2.62,0.08],[2.82,0.25],[3.0,0.42]]) P.push({ geo:_xf(new THREE.CylinderGeometry(0.012,0.012,L,3),L/2,y,z,0,0,Math.PI/2), col:0x9a9a92 });   // barbed strands on the outrigger
  for(let k=0;k<9;k++) P.push({ geo:_xf(new THREE.TorusGeometry(0.42,0.013,3,10),0.17+k*0.33,0.42,0.75+_R(-0.05,0.05),0,Math.PI/2+_R(-0.2,0.2),0), col:0xa8a8a0 });   // razor concertina at the foot
  const steel=_mergeColored(P); const chain=new THREE.PlaneGeometry(L,2.3); chain.translate(L/2,1.3,0); const uv=chain.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*6, uv.getY(i)*4.6);
  return _bayG={ steel, chain }; }
let _chainMat=null;
function chainMat(){ if(_chainMat) return _chainMat; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.strokeStyle='#b8b8b0'; x.lineWidth=2.2;
  x.beginPath(); x.moveTo(0,32); x.lineTo(32,0); x.lineTo(64,32); x.lineTo(32,64); x.closePath(); x.moveTo(-32,32); x.lineTo(0,0); x.moveTo(64,0); x.lineTo(96,32); x.stroke();   // diamond mesh
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return _chainMat=new THREE.MeshStandardMaterial({ map:t, alphaTest:0.35, transparent:false, side:THREE.DoubleSide, color:0x9a9a94, roughness:0.45, metalness:0.8 }); }
const _fM=new THREE.Matrix4(), _fQ=new THREE.Quaternion(), _fE=new THREE.Euler(0,0,0,'YXZ'), _fV=new THREE.Vector3(), _fS=new THREE.Vector3();
function bayMatrix(sp, tilt){ _fE.set(tilt||0, sp.th, 0); _fQ.setFromEuler(_fE); _fS.set(sp.L/3*sp.K, sp.K*(tilt?0.9:1), sp.K); return _fM.compose(_fV.set(sp.x0, sp.y, sp.z0), _fQ, _fS); }
// fence the rectangle x0..x1 × z0..z1 (base-local metres), a gate gap of width gw in the front side
function fenceBase(B, x0, x1, z0, z1, gw){ const G=bayGeo(), spans=[], K=B.K;
  const side=(ax,az,bx,bz,th,gate)=>{ const len=Math.hypot(bx-ax,bz-az), n=Math.max(1,Math.round(len/3)), L=len/n;
    for(let i=0;i<n;i++){ const f0=i/n, lx=ax+(bx-ax)*f0, lz=az+(bz-az)*f0, mx=ax+(bx-ax)*(f0+0.5/n), mz=az+(bz-az)*(f0+0.5/n); if(gate && Math.abs(mx)<gw/2) continue;
      const [x,z]=B.at(lx,lz), [cx,cz]=B.at(mx,mz); spans.push({ x0:x, z0:z, y:heightAt(x,z)-0.05, cx, cz, th:B.ang+th, L, K, nx:Math.sin(B.ang+th), nz:Math.cos(B.ang+th), dx:Math.cos(B.ang+th), dz:-Math.sin(B.ang+th), Lw:L*K, hp:FENCE.hp, down:false }); } };
  side(x0,z1,x1,z1,0,true); side(x1,z1,x1,z0,Math.PI/2); side(x1,z0,x0,z0,Math.PI); side(x0,z0,x0,z1,-Math.PI/2);
  const a=new THREE.InstancedMesh(G.steel, mats().metal, spans.length), b=new THREE.InstancedMesh(G.chain, chainMat(), spans.length);
  spans.forEach((sp,i)=>{ const M=bayMatrix(sp,0); a.setMatrixAt(i,M); b.setMatrixAt(i,M); }); a.castShadow=true; a.receiveShadow=b.receiveShadow=true; scene.add(a, b); B.fence={ a, b, spans }; }
// Z205 THE WIRE HOLDS: an upright bay stops the hull (oriented hull box vs the bay's line) unless the tank drives into it at ram speed;
//   rounds and blasts tear bays down (a shell flattens one, small arms need a lot); a bay that falls goes away from what hit it
function knockSpan(B, i, fx, fz){ const F=B.fence, sp=F.spans[i]; if(!sp || sp.down) return; sp.down=true; const out=(fx-sp.cx)*sp.nx+(fz-sp.cz)*sp.nz > 0, M=bayMatrix(sp, out?-1.45:1.45);
  F.a.setMatrixAt(i,M); F.b.setMatrixAt(i,M); F.a.instanceMatrix.needsUpdate=true; F.b.instanceMatrix.needsUpdate=true;
  burst({x:sp.cx,z:sp.cz}, BIOME.ground, 3, 2.5, {y:heightAt(sp.cx,sp.cz)+0.5, life:0.8, size:1.3, smoke:true, grav:-0.3, drag:2, up:1, op:0.4}); for(let k=0;k<6;k++) spawnPart(sp.cx, heightAt(sp.cx,sp.cz)+1.2, sp.cz, (Math.random()-0.5)*6, 2+Math.random()*3, (Math.random()-0.5)*6, { color:0xffe0a0, size:0.1, life:0.3, grav:-14, drag:1.5 }); sfx('clang', {x:sp.cx,z:sp.cz}, 0.7); }
let _fenceHintAt=0;
function fenceCollide(B, p, now){ const F=B.fence, s=p.scale*TANK_SCALE, HW=HULL_HW*s, HL=HULL_HL*s, f=p.facing||0, fx=Math.sin(f), fz=Math.cos(f), rx=Math.cos(f), rz=-Math.sin(f);
  for(let i=0;i<F.spans.length;i++){ const sp=F.spans[i]; if(sp.down) continue; const qx=p.pos.x-sp.x0, qz=p.pos.z-sp.z0;
    const extD=HW*Math.abs(sp.dx*rx+sp.dz*rz)+HL*Math.abs(sp.dx*fx+sp.dz*fz), along=qx*sp.dx+qz*sp.dz; if(along<-extD*0.6 || along>sp.Lw+extD*0.6) continue;
    const side=qx*sp.nx+qz*sp.nz, extN=HW*Math.abs(sp.nx*rx+sp.nz*rz)+HL*Math.abs(sp.nx*fx+sp.nz*fz); if(Math.abs(side)>=extN) continue;
    const sg=side>=0?1:-1, vn=p.vel.x*sp.nx+p.vel.z*sp.nz, closing=-vn*sg;
    if(closing>=FENCE.ramV*(p.ramOn?0.7:1)){ knockSpan(B, i, p.pos.x, p.pos.z); for(const j of [i-1,i+1]){ const o=F.spans[j]; if(o && !o.down && Math.hypot(o.cx-sp.cx,o.cz-sp.cz)<4 && Math.random()<0.5) knockSpan(B, j, p.pos.x, p.pos.z); }   // rammed through (the next bay may go with it)
      p.vel.x*=0.72; p.vel.z*=0.72; S.shake=Math.min(2.6,S.shake+0.6); continue; }
    const pen=extN-Math.abs(side); p.pos.x+=sp.nx*sg*pen; p.pos.z+=sp.nz*sg*pen; if(closing>0){ p.vel.x+=sp.nx*sg*closing; p.vel.z+=sp.nz*sg*closing; }   // held by the wire
    if(closing>2 && now>_fenceHintAt){ _fenceHintAt=now+3; driveHint('LẤY ĐÀ HÚC MẠNH · HOẶC BẮN ĐỔ HÀNG RÀO'); } } }
// Z311 a ride (bike or horse: a circle of radius R moving at vel) against every compound's wire: a bay holds it unless it comes on at wireV, which
//   flattens the bay (and it goes on, slowed); returns how hard it hit (closing m/s) when held, 0 otherwise
export function rideFence(p, R, wireV){ let hit=0; for(const B of SUPPLY.bases){ const F=B.fence; if(!F || (p.pos.x-B.x)**2+(p.pos.z-B.z)**2 > (B.R*1.6)**2) continue;
    for(let i=0;i<F.spans.length;i++){ const sp=F.spans[i]; if(sp.down) continue; const qx=p.pos.x-sp.x0, qz=p.pos.z-sp.z0, along=qx*sp.dx+qz*sp.dz; if(along<-R || along>sp.Lw+R) continue;
      const side=qx*sp.nx+qz*sp.nz; if(Math.abs(side)>=R) continue; const sg=side>=0?1:-1, vn=p.vel.x*sp.nx+p.vel.z*sp.nz, closing=-vn*sg;
      if(closing>=wireV){ knockSpan(B, i, p.pos.x, p.pos.z); p.vel.x*=0.75; p.vel.z*=0.75; S.shake=Math.min(2, S.shake+0.4); continue; }
      const pen=R-Math.abs(side); p.pos.x+=sp.nx*sg*pen; p.pos.z+=sp.nz*sg*pen; if(closing>0){ p.vel.x+=sp.nx*sg*closing; p.vel.z+=sp.nz*sg*closing; hit=Math.max(hit, closing); } } }
  return hit; }
// a round passing through the wire line: it tears at the bay it crosses
export function fenceShot(b){ if(!SUPPLY.bases.length) return; for(const B of SUPPLY.bases){ if(!B.fence || (b.x-B.x)**2+(b.z-B.z)**2 > (B.R*1.6)**2) continue;
    const F=B.fence; for(let i=0;i<F.spans.length;i++){ const sp=F.spans[i]; if(sp.down) continue; const qx=b.x-sp.x0, qz=b.z-sp.z0, al=qx*sp.dx+qz*sp.dz; if(al<0 || al>sp.Lw || Math.abs(qx*sp.nx+qz*sp.nz)>0.45+b.r) continue;
      if(b._fenceHit===sp) continue; b._fenceHit=sp; sp.hp-=b.inf ? b.dmg*0.35 : b.dmg*(b.aoe?3:1.6);
      spawnPart(b.x, heightAt(b.x,b.z)+Math.max(0.5,Math.min(2.4,b.by)), b.z, (Math.random()-0.5)*4, 1.5, (Math.random()-0.5)*4, { color:0xffe0a0, size:0.1, life:0.2, grav:-14, drag:2 });
      if(sp.hp<=0) knockSpan(B, i, b.x-b.vx, b.z-b.vz); return; } } }
// a blast near the wire flattens the bays in reach
export function fenceBlast(x, z, r){ for(const B of SUPPLY.bases){ if(!B.fence || (x-B.x)**2+(z-B.z)**2 > (B.R*1.6+r)**2) continue; const F=B.fence;
    for(let i=0;i<F.spans.length;i++){ const sp=F.spans[i]; if(!sp.down && Math.hypot(sp.cx-x, sp.cz-z) < r+1.2) knockSpan(B, i, x, z); } } }
// signs on two legs, merged per sign kind into the compound's decor (base-local metres; ry turns the face)
function signs(B, list){ const by={}; for(const [kind,x,z,ry,w] of list){ const W=w||1.5, H=kind.startsWith('name')?W*72/256:W*160/256, legs=[];
    (by[kind]=by[kind]||[]).push(_xf(new THREE.PlaneGeometry(W,H),x,kind.startsWith('name')?0:1.25+H/2,z,0,ry||0,0)); }
  for(const k in by){ const g=mergeGeos(by[k]), m=new THREE.Mesh(g, signMat(k)); m.castShadow=true; B.decor.add(m); const bk=new THREE.Mesh(g, signBack()); B.decor.add(bk); } }   // Z196 face reads right, the back is bare painted steel
function mergeGeos(list){ const g=_mergeColored(list.map(geo=>({ geo, col:0xffffff }))); g.deleteAttribute('color'); return g; }
function signPosts(K, list){ for(const [kind,x,z,ry,w] of list){ if(kind.startsWith('name')) continue; const W=w||1.5, c=Math.cos(ry||0), s=Math.sin(ry||0); for(const o of [-W*0.38,W*0.38]) K.add('metal', CY(0.04,0.04,2.6,5,x+o*c,1.3,z-o*s), 0x5a5a56); } }
// steel portal over the gate: box columns, a beam with knee braces, the name board, a red-white boom and a sentry booth
function gate(K, z1, gw, nameKind, B){ for(const s of [-1,1]){ K.add('metal', B3(0.36,5.6,0.36,s*(gw/2+0.3),2.8,z1), 0x4a4e46); K.add('metal', _xf(new THREE.BoxGeometry(0.12,1.6,0.12),s*(gw/2-0.25),4.9,z1,0,0,s*0.75), 0x4a4e46); }
  K.add('metal', B3(gw+1.4,0.5,0.32,0,5.5,z1), 0x4a4e46); K.add('metal', B3(0.3,1.1,0.3,-gw/2+0.2,0.55,z1+0.7), 0x5a5a56);
  for(let i=0;i<9;i++) K.add('paint', B3(gw/9,0.14,0.14,-gw/2+0.2+(i+0.5)*gw/9,1.05,z1+0.7), i%2?0xf2f0ea:0xc81e1e);   // boom barrier
  K.add('conc', B3(2.0,2.5,2.0,gw/2+2.6,1.25,z1-1.6), 0xb4b0a6); K.add('conc', B3(2.3,0.2,2.3,gw/2+2.6,2.6,z1-1.6), 0x8a867c); K.add('metal', B3(1.2,0.6,0.06,gw/2+2.6,1.6,z1-0.59), 0x1a2228);   // sentry booth
  return [nameKind, 0, z1+0.2, 0, gw*0.8]; }
function nameSignAt(B, z1, item){ const [k,,,,w]=item, H=w*72/256, g=new THREE.PlaneGeometry(w,H); for(const [ry,dz] of [[0,0.2],[Math.PI,-0.2]]){ const m=new THREE.Mesh(g, signMat(k)); m.position.set(0,4.75,z1+dz); m.rotation.y=ry; B.decor.add(m); } }   // Z196 the name reads right from outside AND from inside the yard
// ---------- Z195 the compounds stand in the corners of the map: the two far corners first, then the near ones ----------
const SP_Z=()=>ARENA*0.55;
// Z196 GRID SCAN: walk the whole field on a 6 m grid and take the best-scoring free spot (score = how well it suits: near a corner, high ground…);
//   unlike random tries it never misses a gap that exists. Tiers shrink the clearance a little when the field is crowded.
export function scanSite(R0, score, o){ o=o||{}; const step=6;
  for(const k of [1,0.88,0.76,0.66]){ const R=R0*k; let best=null, bs=Infinity;
    for(let x=-ARENA+R+5; x<=ARENA-R-5; x+=step) for(let z=-ARENA+R+5; z<=ARENA-R-5; z+=step){
      if(o.maxZ!=null && z>o.maxZ) continue; const sc=score(x,z); if(sc>=bs) continue;
      if(!homeClear(x,z,R0,false,o.homeK) || Math.hypot(x, z-SP_Z())<R+42 || !inField(x,z,R*0.8) || inZone(x,z,R*0.8) || CAMPS.some(c=>Math.hypot(c.x-x,c.z-z)<R+CAMP_R*0.8) || SUPPLY.bases.some(B=>Math.hypot(B.x-x,B.z-z)<(B.R+R)*0.92) || !siteOk(x,z,R)) continue;
      best=[x,z]; bs=sc; }
    if(best){ clearSite(best[0], best[1], R0*1.05); return best; } }
  return null; }
const FUEL_R=24, AMMO_R=23;
function buildFuel(s){ flattenPad(s[0], s[1], FUEL_R*SUPPLY_K*0.95, FUEL_R*SUPPLY_K*1.35); const B=newBase('fuel', s[0], s[1], FUEL_R*SUPPLY_K, SUPPLY_K);
    for(const lx of [-7.6,0,7.6]) piece(B, 'fueltank', fuelTank(), lx, -2.5, 0, { r:3.2 }, true);
    { const Dp=SCENERY.on && sceneDims('fuel_depot', SCENERY.supply.depot.w/SCENERY.models.fuel_depot.w);   // Z420 the fuel store (the weathered platform scan, world/scenery.js realSupply) — its box, when it will stand there
      piece(B, 'pumphouse', pumpHouse(), 0, Dp ? SCENERY.supply.depot.z : 7.0, 0, Dp ? { r:Math.hypot(Dp.x,Dp.z)/2, hw:Dp.x/2*0.9, hl:Dp.z/2*0.9 } : { r:3.4, hw:2.4, hl:3.6, across:true }); }
    piece(B, 'tanker', tankerTruck(), -9.5, 10.5, 0.25, { r:2.2, hw:1.3, hl:4.1 }); piece(B, 'tanker', tankerTruck(), 10.5, 9.0, -0.35, { r:2.2, hw:1.3, hl:4.1 });
    const K=kit(); for(const [w,d,x,z] of [[25,0.45,0,-7.4],[25,0.45,0,2.6],[0.45,10,-12.5,-2.4],[0.45,10,12.5,-2.4]]) K.add('conc', B3(w,1.1,d,x,0.55,z), 0xa6a298);   // bund wall
    for(const y of [0.9,1.25,1.6]) K.add('metal', CY(0.16,0.16,15.4,10,0,y,3.6,0,Math.PI/2), [0x8a8a82,0x9a2a1e,0x7a7a72][Math.round((y-0.9)/0.35)]);   // pipe rack
    for(const x of [-7.4,-2.5,2.5,7.4]){ K.add('metal', B3(0.15,2.4,0.15,x,1.2,3.3), 0x4a4a46); K.add('metal', B3(0.15,2.4,0.15,x,1.2,3.9), 0x4a4a46); K.add('metal', B3(0.15,0.15,0.9,x,2.35,3.6), 0x4a4a46); }   // Z195 steel H-frames…
    for(const [xa,xb] of [[-7.4,-2.5],[-2.5,2.5],[2.5,7.4]]){ const L=Math.hypot(xb-xa,2.2), a=Math.atan2(2.2,xb-xa); K.add('metal', _xf(new THREE.BoxGeometry(L,0.08,0.08),(xa+xb)/2,1.2,3.9,0,0,a), 0x4a4a46); K.add('metal', _xf(new THREE.BoxGeometry(L,0.08,0.08),(xa+xb)/2,1.2,3.9,0,0,-a), 0x4a4a46); }   // …with X-bracing
    K.add('metal', B3(15.2,0.14,0.14,0,2.42,3.6), 0x4a4a46);
    for(const x of [-7.6,0,7.6]) K.add('metal', CY(0.13,0.13,3.2,8,x,0.9,1.7,Math.PI/2), 0x7a7a72);
    for(const x of [-4,4]){ K.add('conc', B3(3.4,0.25,1.4,x,0.12,12.4), 0x9e9a90); for(const s of [-1,1]){ K.add('paint', B3(0.9,1.7,0.6,x+s*0.9,1.05,12.4), 0xc8c4b8); K.add('paint', B3(0.92,0.35,0.62,x+s*0.9,1.6,12.4), 0x9a2a1e); } K.add('metal', B3(3.6,0.15,1.8,x,3.2,12.4), 0x8a8a82); for(const s of [-1,1]) K.add('metal', CY(0.08,0.08,3.1,6,x+s*1.6,1.6,12.4), 0x6a6a64); }   // dispenser islands under canopies
    for(const [x,z] of [[-16,-11],[16,-11]]) lattice(K, x, z, 11);   // Z195 steel lattice floodlight towers
    const SG=[['military',-7.5,15.2,0],['fire',7.5,15.2,0],['nosmoke',-4,8.9,0,1.3],['fire',-14.5,-2.4,Math.PI/2,1.3],['mines',-17.6,4,-Math.PI/2],['mines',17.6,-6,Math.PI/2],['nosmoke',0,-12.6,Math.PI,1.3],['military',12,-12.6,Math.PI]];
    signPosts(K, SG); const nm=gate(K, 15, 8, 'name', B);
    const d=K.bake(false); d.scale.setScalar(B.K); d.position.set(B.x, heightAt(B.x,B.z)-0.05, B.z); d.rotation.y=B.ang; scene.add(d); B.decor=d; signs(B, SG); nameSignAt(B, 15, nm);
    fenceBase(B, -18.5, 18.5, -13.5, 15, 8);
    for(const [lx,lz,ry] of [[-15,-9,0.8],[15,-9,-0.8],[-15,6,-0.6],[15,6,0.6],[0,-11,0]]) nest(B, lx, lz, ry);
    { const [tx,tz]=B.at(-15.5,-1); if(!blocks.some(b=>Math.hypot(b.x-tx,b.z-tz)<b.r+3)) buildTower(tx, tz); }
    B.garrison=true; }
function buildAmmo(s){ flattenPad(s[0], s[1], AMMO_R*SUPPLY_K*0.95, AMMO_R*SUPPLY_K*1.35); const B=newBase('ammo', s[0], s[1], AMMO_R*SUPPLY_K, SUPPLY_K);
    for(const lx of [-6.8,6.8]) piece(B, 'bunker', igloo(), lx, -3.5, 0, { r:4.4, hw:4.5, hl:4.9 }, true);
    for(const [lx,lz] of [[-6.6,7.2],[-2.2,7.6],[2.2,7.4],[6.6,7.0]]) piece(B, 'ammostack', ammoStack(), lx, lz, _R(-0.2,0.2), { r:1.7 });
    piece(B, 'supplytruck', supplyTruck(), 11.5, 6, -0.3, { r:2.2, hw:1.3, hl:3.7 });
    const K=kit();
    for(const x of [-9.6,-3.2,3.2,9.6]) for(const z of [4.4,10.2]) K.add('metal', B3(0.24,4.0,0.24,x,2.0,z), 0x4a4e46);   // Z195 steel-frame storage shed: I-beam columns…
    for(const z of [4.4,10.2]) K.add('metal', B3(19.8,0.32,0.22,0,4.0,z), 0x4a4e46);
    for(const x of [-9.6,-6.4,-3.2,0,3.2,6.4,9.6]) K.add('metal', _xf(new THREE.BoxGeometry(0.16,0.24,6.4),x,4.25,7.3,0.08,0,0), 0x4a4e46);   // rafters
    K.add('metal', _xf(new THREE.BoxGeometry(20.4,0.07,6.9),0,4.45,7.3,0.08,0,0), 0x8a8c84);   // corrugated roof
    for(let x=-9.9;x<10;x+=0.5) K.add('metal', _xf(new THREE.BoxGeometry(0.08,0.06,6.9),x,4.5,7.3,0.08,0,0), 0x9a9c94);
    for(const [xa,xb] of [[-9.6,-3.2],[3.2,9.6]]){ const L=Math.hypot(xb-xa,3.6), a=Math.atan2(3.6,xb-xa); for(const sg of [1,-1]) K.add('metal', _xf(new THREE.BoxGeometry(L,0.08,0.08),(xa+xb)/2,2.1,4.4,0,0,sg*a), 0x4a4e46); }   // back bracing
    K.add('net', _xf(new THREE.PlaneGeometry(19.6,2.6,6,2),0,2.7,10.32,0,0,0), 0xffffff);   // camo net hung on the open side
    const soil=new THREE.Color(BIOME.ground||0x8a7a5a).multiplyScalar(0.75).getHex(); for(const x of [-13,13]) K.add('soil', _xf(new THREE.CylinderGeometry(0.6,1.8,2.0,4,1),x,1.0,-1,0,Math.PI/4,0,1,1,4.5), soil);   // earth traverses
    for(const [x,z] of [[-15.5,-11],[15.5,-11]]) lattice(K, x, z, 10);
    { const c=0xc8a020; for(const sx of [-1,1]){ for(const sz of [-1,1]) K.add('paint', _xf(new THREE.BoxGeometry(0.3,7.4,0.3),sx*12.2,3.6,1.8+sz*1.1,sz*-0.14,0,0), c); K.add('paint', B3(0.4,0.4,2.8,sx*12.2,0.25,1.8), c); K.add('metal', B3(0.16,0.12,26,sx*12.2,0.06,1.8,Math.PI/2), 0x4a4a46); }   // Z196 rail-mounted gantry crane over the magazine doors
      K.add('paint', B3(25,0.6,0.5,0,7.3,1.4), c); K.add('paint', B3(25,0.6,0.5,0,7.3,2.2), c); K.add('metal', B3(1.4,0.7,1.4,-3,6.75,1.8), 0x3a3a36); K.add('metal', CY(0.02,0.02,3.2,4,-3,5.0,1.8), 0x222222); K.add('metal', B3(0.5,0.3,0.3,-3,3.3,1.8), 0x2a2a28); }
    { const fx=-11.5, fz=12.5; K.add('paint', B3(1.2,0.9,2.0,fx,0.75,fz), 0xd8a020); K.add('metal', B3(1.1,0.08,0.9,fx,1.25,fz-0.1), 0x2a2a28); for(const s of [-0.5,0.5]) K.add('metal', B3(0.06,1.9,0.06,fx+s,1.6,fz-0.4), 0x2a2a28); K.add('metal', B3(1.1,0.06,0.06,fx,2.5,fz-0.4), 0x2a2a28);
      for(const s of [-0.4,0.4]) K.add('metal', B3(0.08,2.4,0.1,fx+s*0.7,1.2,fz+1.05), 0x3a3a36); for(const s of [-0.25,0.25]) K.add('metal', B3(0.1,0.05,1.1,fx+s,0.12,fz+1.6), 0x3a3a36); wheels(K,[fx-0.62,fx+0.62],[fz+0.6,fz-0.6],0.3); K.add('wood', B3(1.2,0.15,1.0,fx,0.22,fz+1.65), 0x8a6a40); K.add('wood', B3(1.0,0.5,0.8,fx,0.55,fz+1.65), 0x4e5a34); }   // forklift with a crate on the forks
    const SG=[['military',-7,16.2,0],['ammo',7,16.2,0],['ammo',-6.8,1.6,0,1.3],['ammo',6.8,1.6,0,1.3],['nosmoke',0,12.6,0,1.3],['mines',-17.1,2,-Math.PI/2],['mines',17.1,-4,Math.PI/2],['military',0,-12.1,Math.PI]];
    signPosts(K, SG); const nm=gate(K, 16, 8, 'nameA', B);
    const d=K.bake(false); d.scale.setScalar(B.K); d.position.set(B.x, heightAt(B.x,B.z)-0.05, B.z); d.rotation.y=B.ang; scene.add(d); B.decor=d; signs(B, SG); nameSignAt(B, 16, nm);
    fenceBase(B, -17.5, 17.5, -13, 16, 8);
    for(const [lx,lz,ry] of [[-14,-10,0.8],[14,-10,-0.8],[-14,12,-0.6],[14,12,0.6],[-3,13.5,0]]) nest(B, lx, lz, ry);
    { const [tx,tz]=B.at(15,-1); if(!blocks.some(b=>Math.hypot(b.x-tx,b.z-tz)<b.r+3)) buildTower(tx, tz); }
    B.garrison=true; }
// a steel lattice light tower: four legs, girts every 2 m, X-braced faces, a railed platform with two lamps
function lattice(K, x, z, h){ const w=0.55, c=0x56584f; for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) K.add('metal', B3(0.1,h,0.1,x+sx*w,h/2,z+sz*w), c);
  for(let y=1.8;y<h;y+=2){ for(const [ax,az,bx,bz] of [[-1,-1,1,-1],[1,-1,1,1],[1,1,-1,1],[-1,1,-1,-1]]){ const mx=x+(ax+bx)/2*w, mz=z+(az+bz)/2*w, along=ax===bx, L=Math.hypot(2*w,2), a=Math.atan2(2,2*w);
      K.add('metal', _xf(new THREE.BoxGeometry(along?0.06:2*w,0.06,along?2*w:0.06),mx,y,mz), c);
      K.add('metal', _xf(new THREE.BoxGeometry(along?0.05:L,0.05,along?L:0.05),mx,y-1,mz,along?a:0,0,along?0:a), c); } }
  K.add('metal', B3(1.8,0.12,1.8,x,h,z), c); K.add('metal', B3(1.8,0.6,0.05,x,h+0.35,z+0.9), c); K.add('glow', B3(0.6,0.4,0.3,x-0.4,h+0.6,z+0.95), 0xffffff); K.add('glow', B3(0.6,0.4,0.3,x+0.4,h+0.6,z+0.95), 0xffffff); }
const RADAR_R=21;
function buildRadar(s){ flattenPad(s[0], s[1], RADAR_R*0.95, RADAR_R*1.35); const B=newBase('radar', s[0], s[1], RADAR_R, 1);
  const tw=piece(B, 'radartower', radarTower(), 0, -2, 0, { r:3.0 }, true); B.tower=tw; B.head=tw.mesh.userData.head;
  piece(B, 'radome', radome(), -9.5, -6, 0, { r:3.3 }); for(const [lx,lz] of [[-8,6.5],[8.5,3]]) piece(B, 'aagun', aaGun(), lx, lz, Math.PI*0.1, { r:1.9 });
  const K=kit(); radarYard(K); for(const [cx,cz] of [[-8,6.5],[8.5,3]]) for(let k=0;k<14;k++){ const a=k/14*6.283; if(Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<0.35) continue; for(const L of [0,1]) K.add('canvas', _xf(new THREE.BoxGeometry(1.0,0.42,0.5),cx+Math.sin(a)*2.6,0.22+L*0.42,cz+Math.cos(a)*2.6,0,a+L*0.2,0), 0xbca57a); }   // sandbagged gun pits
  const SG=[['military',-6,16.2,0],['radar',6,16.2,0],['radar',3,-1,0,1.3],['mines',-16.1,0,-Math.PI/2],['mines',16.1,-4,Math.PI/2],['military',0,-15.1,Math.PI]];
  signPosts(K, SG); const nm=gate(K, 16, 8, 'nameR', B);
  const d=K.bake(false); d.position.set(B.x, heightAt(B.x,B.z)-0.05, B.z); d.rotation.y=B.ang; scene.add(d); B.decor=d; signs(B, SG); nameSignAt(B, 16, nm);
  fenceBase(B, -16.5, 16.5, -15, 16, 8);
  for(const [lx,lz,ry] of [[-13,-12,0.8],[13,-12,-0.8],[-13,13,-0.6],[13,13,0.6]]) nest(B, lx, lz, ry);
  B.garrison=true; }
export function buildSupply(phase){   // Z196 'far' — the two enemy-side corners (before the camps) · 'near' — the rest (after them)
  if(phase!=='near'){ const st=Math.min(4,S.stage-1), N=SUPPLYB.perStage.total[st], far=[[-1,-1],[1,-1]].sort(()=>Math.random()-0.5), near=[[-1,1],[1,1]].sort(()=>Math.random()-0.5);
    const kinds=Math.random()<0.5 ? ['fuel','ammo','ammo','fuel'] : ['ammo','fuel','fuel','ammo']; SUPPLY.plan=far.concat(near).slice(0,N).map((c,i)=>({ c, kind:kinds[i] })); }
  const todo=(SUPPLY.plan||[]).filter((q,i)=>phase==='near' ? i>=2 : i<2);
  for(const q of todo){ const [sx,sz]=q.c, kind=q.kind, R=(kind==='fuel'?FUEL_R:AMMO_R)*SUPPLY_K, jx=Math.random()*30, jz=Math.random()*30, s=scanSite(R, (x,z)=>Math.hypot(x-sx*(ARENA-jx), z-sz*(ARENA-jz))); if(!s) continue;   // the free spot nearest this corner
    if(kind==='fuel') buildFuel(s); else buildAmmo(s); }
  if(phase!=='near'){ const jx=_R(-40,40), s=scanSite(RADAR_R, (x,z)=>-heightAt(x,z)*8 + Math.hypot(x-jx, z+ARENA*0.6)*0.25, { maxZ:ARENA*0.05 }); if(s) buildRadar(s); }   // Z197 the radar on the highest free ground of the enemy half
}
// the troop camps (world/camps.js) are bases too: same guards, same alarm, losing one costs the enemy troops
export function registerCampBase(camp){ const B=newBase('camp', camp.x, camp.z, CAMP_R, 1, camp.ang); B.camp=camp; B.garrison=true; B.gInf=Math.round(Math.min(SUPPLYB.guards[1]-2, 2+S.stage)*(MOBILE?0.7:1));
  // Z196 the barracks become a fenced compound: wire fence, steel gate + boom + sentry booth, a steel-frame vehicle shed with a truck, a water tower, light towers, signs
  const K=kit(); lattice(K, -25, 24, 10); lattice(K, 25, 24, 10); waterTower(K, 14, -20);
  for(const x of [18.2,23.8]) for(const z of [-0.8,4.2]) K.add('metal', B3(0.22,3.6,0.22,x,1.8,z), 0x4a4e46);   // vehicle shed
  for(const z of [-0.8,4.2]) K.add('metal', B3(6.4,0.28,0.2,21,3.6,z), 0x4a4e46); K.add('metal', _xf(new THREE.BoxGeometry(6.9,0.07,5.8),21,3.85,1.7,0.07,0,0), 0x7e8078);
  for(let x=17.8;x<24.4;x+=0.5) K.add('metal', _xf(new THREE.BoxGeometry(0.07,0.06,5.8),x,3.9,1.7,0.07,0,0), 0x8e9088);
  const SG=[['military',-7,26.2,0],['halt',7,26.2,0],['mines',-27.1,0,-Math.PI/2],['mines',27.1,-6,Math.PI/2],['military',0,-25.1,Math.PI]];
  signPosts(K, SG); const nm=gate(K, 26, 8, 'nameC', B);
  const d=K.bake(false); d.position.set(B.x, heightAt(B.x,B.z)-0.05, B.z); d.rotation.y=B.ang; scene.add(d); B.decor=d; signs(B, SG); nameSignAt(B, 26, nm);
  { const t=supplyTruck(); t.scale.setScalar(0.9); t.position.set(21, 0, 1.7); t.rotation.y=Math.PI; d.add(t); }   // parked under the shed
  fenceBase(B, -27, 27, -25, 26, 8);
  return B; }
// a steel water tower: four braced legs, a riveted tank with a conical lid, a ladder
function waterTower(K, x, z){ const h=8, w=1.3, c=0x56584f; for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) K.add('metal', _xf(new THREE.BoxGeometry(0.16,h,0.16),x+sx*w,h/2,z+sz*w,sz*0.04,0,-sx*0.04), c);
  for(let y=2;y<h;y+=2.6){ K.add('metal', B3(2*w+0.2,0.1,0.1,x,y,z-w), c); K.add('metal', B3(2*w+0.2,0.1,0.1,x,y,z+w), c); K.add('metal', B3(0.1,0.1,2*w+0.2,x-w,y,z), c); K.add('metal', B3(0.1,0.1,2*w+0.2,x+w,y,z), c);
    const L=Math.hypot(2*w,2.6), a=Math.atan2(2.6,2*w); for(const sg of [1,-1]){ K.add('metal', _xf(new THREE.BoxGeometry(L,0.07,0.07),x,y+1.3,z+w,0,0,sg*a), c); K.add('metal', _xf(new THREE.BoxGeometry(0.07,0.07,L),x+w,y+1.3,z,sg*a,0,0), c); } }
  K.add('metal', B3(3.4,0.2,3.4,x,h,z), c); K.add('paint', CY(1.7,1.7,2.6,20,x,h+1.4,z), 0x8a9a8a); K.add('paint', _xf(new THREE.ConeGeometry(1.78,0.8,20),x,h+3.1,z), 0x6a7a6a);
  for(const y of [h+0.5,h+2.3]) K.add('metal', _xf(new THREE.TorusGeometry(1.72,0.04,4,20),x,y,z,Math.PI/2), 0x4a4e46);
  for(const s of [-0.22,0.22]) K.add('metal', CY(0.03,0.03,h+2.4,5,x+w+0.25,(h+2.4)/2,z+s), c); for(let y=0.4;y<h+2.2;y+=0.45) K.add('metal', B3(0.04,0.04,0.48,x+w+0.25,y,z), c); }
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
  if(b.kind==='radartower'){ const p=S.player, dir=p ? Math.atan2(b.x-p.pos.x, b.z-p.pos.z) : Math.random()*6.283; toppleTower(b, dir, now); bigExplode(pos, 0xffd27a, 2.0); for(let k=0;k<(MOBILE?8:16);k++) spawnPart(b.x, gy+18*Math.random()+2, b.z, _R(-6,6), _R(2,8), _R(-6,6), { color:0x9fd8ff, size:0.25, life:0.6, grav:-14, drag:1 });   // shorting electrics
    char(0.35); B.fires.push({ x:b.x, z:b.z, y:gy+1, t:20, s:1.0 }); sfx('bigexplode', pos); }
  else if(b.kind==='aagun'){ bigExplode(pos, 0xff8a3a, 1.4); fireball(pos, 1.0); char(0.25); b.mesh.userData.turret && (b.mesh.userData.turret.rotation.z=0.5); cookOff(b.x, b.z, 2, 3, 25); }
  else if(b.kind==='radome'){ burst(pos, 0xeceae2, 14, 7, {y:gy+3, life:0.7, size:0.6, grav:-14, drag:1.2, up:3}); b.mesh.scale.y*=0.35; char(0.5); sfx('explode', pos); }
  else if(b.kind==='fueltank'){ bigExplode(pos, 0xff7a2a, 3.2); fireball(pos, 3.2); shockDome(b.x, b.z, 16, 0xffc890); decalScorch(b.x, b.z, 10, 1); deformCrater(b.x,b.z,2.6,0.4); aoeDamage(b.x, b.z, 8, 80, false, now, 'HE');
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
const NAME={ fuel:'TRẠM NHIÊN LIỆU', ammo:'KHO ĐẠN DƯỢC', camp:'TRẠI LÍNH', radar:'TRẠM RADAR' };
const LOST={ radar:'Pháo binh địch mất mắt: pháo kích thưa hơn, ít đạn hơn và rơi lệch xa.', fuel:'Xe tăng địch thiếu nhiên liệu: chạy chậm hơn, viện binh thiết giáp giảm.', ammo:'Địch thiếu đạn: bắn yếu hơn, nạp đạn chậm hơn.', camp:'Địch mất trại lính: mỗi đợt ít bộ binh hơn.' };
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
  aviationMat().emissiveIntensity = Math.floor(now*1.2)%2 ? 0.2 : 2.6;   // Z197 aviation lights blink
  for(const B of SUPPLY.bases){
    if(B.kind==='radar'){ if(B.tower && B.tower.fall) updateTopple(B.tower, dt); else if(B.head && B.alive) B.head.rotation.y+=dt*(B.alarm?1.9:1.15);   // the array never stops sweeping
      if(B.alive) for(const pc of B.pieces) if(pc.kind==='aagun') updateAAGun(pc.mesh, pc, dt, now, p); }
    if(B.fence && Math.hypot(p.pos.x-B.x, p.pos.z-B.z) < B.R+16) fenceCollide(B, p, now);   // Z205 the wire is a real barrier: ram it hard or shoot it down
    for(let i=B.fires.length-1;i>=0;i--){ const F=B.fires[i]; F.t-=dt; if(F.t<=0){ B.fires.splice(i,1); continue; } if(Math.random()>(MOBILE?0.35:0.7)) continue; const k=Math.min(1,F.t/8);
      spawnPart(F.x+_R(-1,1)*F.s, F.y, F.z+_R(-1,1)*F.s, _R(-0.4,0.4), 3+Math.random()*2, _R(-0.4,0.4), { tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:(1+Math.random())*F.s*(0.4+0.6*k), life:0.6, grav:1.6, drag:1.4, grow:0.8 });
      if(Math.random()<0.5) spawnPart(F.x, F.y+2*F.s, F.z, 0.6, 2.4, 0.3, { color:0x120f0c, size:2.2*F.s, life:3, smoke:true, grav:0.25, drag:0.6, grow:3, op:0.3+0.3*k }); }
    if(!B.alive) continue;
    if(B.camp && !B.camp.alive){ baseLost(B); continue; }
    const dp=Math.hypot(p.pos.x-B.x, p.pos.z-B.z);
    if(!B.alarm && (dp < SUPPLYB.alertR && playerSeen(B.x, heightAt(B.x,B.z)+1.7, B.z) || now-B.hitAt < 2)){ B.alarm=true; B.heloAt=now+4; B.tankAt=now+8; radio('SCH: Lính canh '+NAME[B.kind]+' đã phát hiện ta — chúng đang gọi trực thăng và xe tăng yểm trợ!'); }   // Z377 a man crawling in flat is no alarm until a guard sees him (or he opens fire)
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
