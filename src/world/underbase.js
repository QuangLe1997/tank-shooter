// world/underbase.js — Z226 THE UNDERGROUND BASE: under every battlefield the enemy keeps a buried base — its barracks, its vehicle bays,
//   its arsenal and the generator that powers it all. Squads that climb out of the spider holes and the armour that keeps coming are fed from here.
//   · on the surface: the MAIN TUNNEL GATE (CỬA HẦM CHÍNH) — a concrete portal over a ramp going down, sealed by steel blast doors that an
//     ELECTRONIC LOCK keeps shut. Twin-MG pillboxes flank it, riflemen hold posts round it, guard tanks circle it. Blow the lock → the doors
//     swing open → drive onto the ramp and the tank goes down
//   · below: a lit concrete complex (seen as a cutaway from above) — a central hall with pillars, the BARRACKS wing, the VEHICLE BAY, the ARSENAL
//     and the GENERATOR room. Every barracks / lift / arsenal stack you wreck cuts the enemy's reinforcements up top (squads and tanks simply
//     stop arriving); wreck the generator and the lights die to red emergency light and the base's guns go quiet
//   · while you are below, the fight up top holds its breath (the surface is frozen); your foot squad and allied tanks come down with you
//   · drive back up the ramp to surface at the gate
import * as THREE from 'three';
import { UNDERBASE } from '../../config.js';
import { ALLY_TANKS, ARENA, BIOME, FT, HZN, MOBILE, NIGHT, S, SKY, TUN, UNDER, addScore, ambient, applyAtmosphere, applyWeather, bigExplode, blocks, bullets, burst, damageEnemy, detailize, enemies, enemyPool, floatText, freeEnemyBar, getEnemyBar, heightAt, hemi, homeClear, inField, inZone, radio, recycleBullet, renderer, ringPulse, scene, sfx, showBanner, spawnBullet, spawnDebris, spawnEnemy, spawnPart, spawnSquad, sun, blPulse, holoRing } from '../hub.js';

const R=(a,b)=>a+Math.random()*(b-a), TAU=Math.PI*2;
const _V=new THREE.Vector3();
const clearOf=(x,z,r)=>!blocks.some(b=>(b.x-x)**2+(b.z-z)**2<(b.r+r)**2);
// ---- shared bits ----
let _M=null, _hz=null;
function hazardTex(){ if(_hz) return _hz; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.fillStyle='#d8a020'; x.fillRect(0,0,64,64); x.fillStyle='#1a1a1a';
  for(let i=-64;i<128;i+=22){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+11,0); x.lineTo(i+11-64,64); x.lineTo(i-64,64); x.fill(); } _hz=new THREE.CanvasTexture(c); _hz.wrapS=_hz.wrapT=THREE.RepeatWrapping; _hz.colorSpace=THREE.SRGBColorSpace; return _hz; }
function floorTex(){ const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d'); x.fillStyle='#6a6a66'; x.fillRect(0,0,512,512);
  for(let i=0;i<2600;i++){ const v=90+Math.random()*40|0; x.fillStyle=`rgba(${v},${v},${v-4},0.35)`; x.fillRect(Math.random()*512, Math.random()*512, 2, 2); }
  x.strokeStyle='rgba(30,30,30,0.55)'; x.lineWidth=2; for(let i=0;i<=512;i+=128){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,512); x.stroke(); x.beginPath(); x.moveTo(0,i); x.lineTo(512,i); x.stroke(); }   // poured slabs
  for(let i=0;i<14;i++){ const px=Math.random()*512, py=Math.random()*512, r=20+Math.random()*60, g=x.createRadialGradient(px,py,0,px,py,r); g.addColorStop(0,'rgba(20,18,16,0.35)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(px-r,py-r,r*2,r*2); }   // oil stains
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,8); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; }
function mats(){ if(_M) return _M;
  _M={ conc:detailize(new THREE.MeshStandardMaterial({ color:0x8a8780, roughness:0.9 }), { scale:0.3, bump:0.05, alb:0.3, foot:2, streak:0.35 }), dark:new THREE.MeshStandardMaterial({ color:0x3a3c3e, roughness:0.6, metalness:0.6 }),
    steel:new THREE.MeshStandardMaterial({ color:0x5a5e60, roughness:0.45, metalness:0.75 }), hazard:new THREE.MeshStandardMaterial({ map:hazardTex(), roughness:0.6, metalness:0.3 }),
    black:new THREE.MeshBasicMaterial({ color:0x000000 }), red:new THREE.MeshStandardMaterial({ color:0x300000, emissive:0xff2a14, emissiveIntensity:3 }),
    green:new THREE.MeshStandardMaterial({ color:0x002a10, emissive:0x30ff70, emissiveIntensity:2.5 }), screen:new THREE.MeshStandardMaterial({ color:0x101418, emissive:0xff3a2a, emissiveIntensity:1.8 }),
    lamp:new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xe8f2ff, emissiveIntensity:3.2 }), bag:new THREE.MeshStandardMaterial({ color:0xb8a47a, roughness:0.97 }),
    olive:new THREE.MeshStandardMaterial({ color:0x4a5236, roughness:0.8, metalness:0.3 }), cyan:new THREE.MeshStandardMaterial({ color:0x002a30, emissive:0x40e8ff, emissiveIntensity:3 }),
    crate:new THREE.MeshStandardMaterial({ color:0x6a5a3a, roughness:0.9 }), shell:new THREE.MeshStandardMaterial({ color:0xb08a3a, roughness:0.4, metalness:0.8 }) };
  return _M; }
const BX=(par,w,h,d,x,y,z,m,ry)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m); o.position.set(x,y,z); if(ry) o.rotation.y=ry; o.castShadow=!MOBILE; o.receiveShadow=true; par.add(o); return o; };
const CY=(par,rt,rb,h,s,x,y,z,m)=>{ const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s), m); o.position.set(x,y,z); o.castShadow=!MOBILE; o.receiveShadow=true; par.add(o); return o; };
const toW=(G,lx,lz)=>{ const c=Math.cos(G.a), s=Math.sin(G.a); return [G.x+lx*c+lz*s, G.z-lx*s+lz*c]; };   // gate-local → world (local +z = toward our side)

// ---- a twin-MG pillbox / ceiling autogun: turns on you and hoses you in bursts ----
function turret(par, x, z, wx, wz, base){ const M=mats(), g=new THREE.Group(); g.position.set(x, 0, z); par.add(g);
  if(!base){ CY(g,1.6,1.9,1.6,10,0,0.8,0,M.conc); for(let k=0;k<6;k++){ const a=k/6*TAU; BX(g,0.9,0.4,0.5,Math.cos(a)*1.95,0.25,Math.sin(a)*1.95,M.bag,-a); } }
  else { CY(g,0.5,0.7,3.4,8,0,1.7,0,M.steel); }
  const head=new THREE.Group(); head.position.y=base?3.6:1.9; g.add(head); BX(head,1.3,0.7,1.1,0,0,0,M.dark);
  for(const s of [-0.28,0.28]) BX(head,0.12,0.12,1.6,s,0.05,0.9,M.steel); const eye=BX(head,0.3,0.2,0.1,0,0.25,0.56,M.red);
  const T={ g, head, eye, x:wx, z:wz, hp:UNDERBASE.gate.turretHp, maxHp:UNDERBASE.gate.turretHp, alive:true, fireAt:0, shots:0, base:!!base, blk:null };
  T.blk={ mesh:g, x:wx, z:wz, r:base?1.0:1.9, hp:1e9, maxHp:1e9, steel:false, hard:false, loot:false, kind:'uturret', ub:true, T }; return T; }

// =================================================================== THE GATE (surface) ===================================================================
export function clearGate(){ const G=UNDER.gate; if(!G) return; scene.remove(G.g); for(const b of [G.lockBlk, G.blk, ...G.turrets.map(t=>t.blk)]){ const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1); } UNDER.gate=null; }
function buildGate(){ const U=UNDERBASE, M=mats();
  let x=0, z=0, ok=false; for(let t=0;t<900 && !ok;t++){ const k=t<400?1:t<700?0.6:0.35; x=R(-ARENA*0.75, ARENA*0.75); z=R(-ARENA*0.6, ARENA*0.25);   // looser and looser: every battlefield gets its gate
    ok=inField(x,z,16*k) && homeClear(x,z,16) && Math.hypot(x, z-ARENA*0.55)>60*k && !inZone(x,z,10*k) && clearOf(x,z,12*k) && !(TUN && TUN.list.some(E=>Math.hypot(E.x-x,E.z-z)<28*k)); }
  if(!ok) return; const a=Math.atan2(-x, ARENA*0.55-z), g=new THREE.Group(); g.position.set(x, heightAt(x,z), z); g.rotation.y=a; scene.add(g);
  const G={ x, z, a, g, open:0, opening:false, lockHp:U.gate.lockHp[0]+U.gate.lockHp[1]*(S.stage||1), turrets:[], told:false, beacon:null };
  // the portal: a concrete block over a ramp that dives under it, sandbags on the roof, a red beacon turning on top
  BX(g,13,4.2,3.2,0,2.1,-5.2,M.conc); BX(g,1.4,4.2,9,-6.1,2.1,-1.2,M.conc); BX(g,1.4,4.2,9,6.1,2.1,-1.2,M.conc); BX(g,13.6,0.8,10,0,4.6,-1.6,M.conc);
  for(let k=0;k<7;k++) BX(g,1.5,0.55,0.9,-4.8+k*1.6,5.3,-5.6+(k%2)*0.4,M.bag);
  const hole=new THREE.Mesh(new THREE.PlaneGeometry(10.6,8), M.black); hole.rotation.x=-Math.PI/2; hole.position.set(0,0.06,-0.8); g.add(hole);
  for(let k=0;k<4;k++){ const s=new THREE.Mesh(new THREE.PlaneGeometry(10.4,0.25), new THREE.MeshBasicMaterial({ color:new THREE.Color(0xffd040).multiplyScalar(0.9-k*0.2) })); s.rotation.x=-Math.PI/2; s.position.set(0,0.08,2.6-k*1.5); g.add(s); }   // lit edges of the ramp going down
  BX(g,10.8,0.3,0.6,0,0.15,3.4,M.hazard);
  G.doorL=new THREE.Group(); G.doorL.position.set(-5.3,0.1,-0.8); g.add(G.doorL); BX(G.doorL,5.3,0.35,8,2.65,0.17,0,M.hazard);
  G.doorR=new THREE.Group(); G.doorR.position.set(5.3,0.1,-0.8); g.add(G.doorR); BX(G.doorR,5.3,0.35,8,-2.65,0.17,0,M.hazard);
  G.beacon=BX(g,0.5,0.5,0.5,0,5.6,-1.6,M.red);
  // the electronic lock: a steel cabinet on a post with a red screen, an antenna and a cable conduit running to the doors
  const L=new THREE.Group(); L.position.set(8.6,0,2.4); g.add(L); BX(L,0.3,1.4,0.3,0,0.7,0,M.steel); BX(L,1.6,2.0,0.9,0,2.2,0,M.dark); G.screen=BX(L,1.2,0.8,0.05,0,2.5,0.47,M.screen);
  BX(L,0.08,1.8,0.08,0.6,4.1,0,M.steel); for(let k=0;k<3;k++) BX(L,0.18,0.18,0.06,-0.45+k*0.3,1.6,0.47,k===2?M.green:M.red); BX(g,0.2,0.2,4.6,7.4,0.15,1.0,M.dark,0.5);
  const [lx,lz]=toW(G,8.6,2.4); G.lock={ x:lx, z:lz }; G.lockMesh=L;
  G.lockBlk={ mesh:L, x:lx, z:lz, r:1.5, hp:1e9, maxHp:1e9, steel:false, hard:false, loot:false, kind:'ugatelock', ub:true }; blocks.push(G.lockBlk);
  G.blk={ mesh:g, x:x+Math.sin(a)*-5.2, z:z+Math.cos(a)*-5.2, r:4.2, hp:1e9, maxHp:1e9, steel:true, hard:false, loot:false, kind:'ugate' }; blocks.push(G.blk);
  for(const s of [-1,1]){ const [tx,tz]=toW(G,s*11,-1.5), T=turret(g, s*11, -1.5, tx, tz, false); G.turrets.push(T); blocks.push(T.blk); }
  // the guard: riflemen on posts round it, armour circling it
  const st=S.stage||1, nInf=Math.round((U.gate.guards[0]+st*U.gate.guards[1])*(MOBILE?0.7:1)), fake={ x, z, R:14, alive:true, alarm:false, hitAt:-99 };
  for(let k=0;k<nInf;k++){ const aa=k/nInf*TAU, r=R(12,17), px=x+Math.sin(aa)*r, pz=z+Math.cos(aa)*r; if(!inField(px,pz,3)) continue; const e=spawnEnemy(k%3===2?'rpg':'rifle', px, pz); if(!e) continue; e.guard={ kind:'gate', base:fake }; e.post=[px,pz]; }
  const nt=Math.min(3, Math.round(U.gate.tanks[0]+st*U.gate.tanks[1])), TK=st>=4?['heavy','grunt','gunner']:st>=2?['grunt','gunner']:['gunner','grunt'];
  for(let k=0;k<nt;k++){ const aa=a+Math.PI+k*2.1, px=x+Math.sin(aa)*18, pz=z+Math.cos(aa)*18; if(!inField(px,pz,5)) continue; const e=spawnEnemy(TK[k%TK.length], px, pz); if(!e) continue; e.guardBase=fake; e.guard={ kind:'gate', base:fake }; e._gA=aa; }
  G.fake=fake; G.mark=holoRing(6.6, { kind:'ally', fill:2.4, fog:false, opacity:0 });   // Z318 battle-light ally ring
  G.mark.position.set(0,0.3,-0.8); g.add(G.mark);
  UNDER.gate=G; }
function lockHit(dmg){ const G=UNDER.gate; if(!G || G.opening) return; G.lockHp-=dmg; G.fake.alarm=true; G.fake.hitAt=performance.now()/1000;
  burst({ x:G.lock.x, z:G.lock.z }, 0xffd080, 5, 3, { y:heightAt(G.lock.x,G.lock.z)+2.2, life:0.4, size:0.25, grav:-14, drag:1.5, up:2 });
  if(!G.bar){ G.bar=getEnemyBar(); G.bar.g.scale.setScalar(1.8); } const f=Math.max(0, G.lockHp)/(UNDERBASE.gate.lockHp[0]+UNDERBASE.gate.lockHp[1]*(S.stage||1)), br=G.bar; br.g.visible=true; br.g.position.set(G.lock.x, heightAt(G.lock.x,G.lock.z)+4.6, G.lock.z); br.fill.scale.x=Math.max(0.001,f); br.fill.position.x=-(1-f)*0.5; br.fill.material.color.setHex(0xff5a3a);
  if(!G.told){ G.told=true; floatText('KHOÁ ĐIỆN TỬ', '#ff7a5a', { x:G.lock.x, y:5, z:G.lock.z }, 16); }
  if(G.lockHp<=0) openGate(); }
function openGate(){ const G=UNDER.gate; G.opening=true; const now=performance.now()/1000; if(G.bar){ freeEnemyBar(G.bar); G.bar=null; }
  bigExplode({ x:G.lock.x, z:G.lock.z }, 0x9ad8ff, 1.0); for(let k=0;k<26;k++) spawnPart(G.lock.x, heightAt(G.lock.x,G.lock.z)+2.4, G.lock.z, R(-6,6), R(2,8), R(-6,6), { color:0xbfe8ff, size:0.12, life:0.6, grav:-18, drag:1 });
  G.lockMesh.rotation.z=0.5; G.screen.material=mats().black; const i=blocks.indexOf(G.lockBlk); if(i>=0) blocks.splice(i,1);
  sfx('alarm'); showBanner('KHOÁ ĐIỆN TỬ BỊ PHÁ — CỬA HẦM ĐÃ MỞ!', '#9be04a'); radio('SCH: Cửa xuống căn cứ ngầm đã mở — lái thẳng xuống, phá kho lính và kho xe của chúng!');
  addScore(UNDERBASE.score.lock, { x:G.lock.x, y:3, z:G.lock.z }); G.openAt=now; }
function turretHit(T, dmg){ if(!T.alive) return; T.hp-=dmg; burst({ x:T.x, z:T.z }, 0xffe0a0, 4, 3, { y:heightAt(T.x,T.z)+2, life:0.3, size:0.2, grav:-14, drag:1.5, up:2 });
  if(T.hp<=0){ T.alive=false; T.head.rotation.x=0.7; T.head.position.y-=0.4; T.eye.material=mats().black; bigExplode({ x:T.x, z:T.z }, 0xffae5c, 0.8); spawnDebris({ x:T.x, z:T.z }, 0.8, 0x4a4a4a);
    const i=blocks.indexOf(T.blk); if(i>=0) blocks.splice(i,1); addScore(150, { x:T.x, y:3, z:T.z }); floatText('HẠ Ụ SÚNG', '#ffcf5a', { x:T.x, y:4, z:T.z }, 15); } }
function runTurrets(list, dt, now){ const p=S.player, C=UNDERBASE.gate; if(!p) return;
  for(const T of list){ if(!T.alive) continue; const dx=p.pos.x-T.x, dz=p.pos.z-T.z, d=Math.hypot(dx,dz); if(d>C.turretR) continue; const ya=Math.atan2(dx,dz);
    const par=T.g.parent, py=(par && par.rotation) ? par.rotation.y : 0; let da=(ya-py)-T.head.rotation.y; da=Math.atan2(Math.sin(da),Math.cos(da)); T.head.rotation.y+=Math.max(-dt*2.4, Math.min(dt*2.4, da));
    if(Math.abs(da)>0.25 || now<T.fireAt) continue;
    if(T.shots<C.burst){ T.shots++; T.fireAt=now+C.turretCd[0]; const aa=ya+R(-0.05,0.05), gy=heightAt(T.x,T.z)+(T.base?3.6:1.95);
      spawnBullet(T.x+Math.sin(aa)*1.6, T.z+Math.cos(aa)*1.6, aa, { owner:'e', inf:true, dmg:C.turretDmg, speed:80, color:0xff7040, r:0.22, life:1.0, maxDist:C.turretR+4, noArc:true, y:gy, ignore:T.blk });
      spawnPart(T.x+Math.sin(aa)*2.2, gy, T.z+Math.cos(aa)*2.2, 0, 0, 0, { tex:'flash', color:0xffd080, size:1.1, life:0.05, grav:0, drag:6 }); if(T.shots%3===0) sfx('mg', _V.set(T.x,0,T.z)); }
    else { T.shots=0; T.fireAt=now+C.turretCd[1]; } } }

// =================================================================== THE BASE (below) ===================================================================
function wallBlocks(list, x0, z0, x1, z1){ const L=Math.hypot(x1-x0, z1-z0), n=Math.max(1, Math.round(L/2.6));
  for(let i=0;i<=n;i++){ const u=i/n; list.push({ mesh:null, x:x0+(x1-x0)*u, z:z0+(z1-z0)*u, r:1.7, hp:1e9, maxHp:1e9, steel:true, hard:false, loot:false, kind:'uwall' }); } }
function buildBase(){ const U=UNDER, M=mats(), C=UNDERBASE, g=new THREE.Group(), W=U.W, D=U.D, B=U.BX; g.position.set(B, 0, 0); scene.add(g);
  const base={ g }, bl=[]; U.base=base; U.bblocks=bl; U.targets.length=0; U.turrets.length=0; U.lamps.length=0;
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(W*2+8, D*2+40), new THREE.MeshStandardMaterial({ map:floorTex(), roughness:0.85, metalness:0.05 })); fl.rotation.x=-Math.PI/2; fl.position.set(0,0.02,12); fl.receiveShadow=true; g.add(fl);
  const wall=(x0,z0,x1,z1,h)=>{ const H=h||3.4, L=Math.hypot(x1-x0,z1-z0), m=BX(g,L+1.2,H,1.2,(x0+x1)/2,H/2,(z0+z1)/2,M.conc, -Math.atan2(z1-z0,x1-x0)); BX(g,L+1.3,0.18,1.35,(x0+x1)/2,H+0.09,(z0+z1)/2,M.hazard, -Math.atan2(z1-z0,x1-x0)); BX(g,L+0.6,0.1,1.34,(x0+x1)/2,0.32,(z0+z1)/2,M.lamp, -Math.atan2(z1-z0,x1-x0)); m.material=M.conc; wallBlocks(bl, B+x0, z0, B+x1, z1); return m; };
  // outer shell + the ramp corridor up to the gate (each wall carries a lit strip along its foot)
  wall(-W,-D,W,-D); wall(-W,-D,-W,D); wall(W,-D,W,D); wall(-W,D,-6.5,D); wall(6.5,D,W,D); wall(-6.5,D,-6.5,D+22); wall(6.5,D,6.5,D+22); wall(-6.5,D+22,6.5,D+22,1.2);
  for(let k=0;k<4;k++){ const s=new THREE.Mesh(new THREE.PlaneGeometry(12,0.5), new THREE.MeshBasicMaterial({ color:0xffd040 })); s.rotation.x=-Math.PI/2; s.position.set(0,0.06,D+4+k*4.5); g.add(s); }   // chevrons up the ramp
  // inner partitions with doorways: barracks (west), vehicle bay (east), arsenal + generator (north)
  wall(-28,-D,-28,-10); wall(-28,10,-28,28); wall(-28,40,-28,D); wall(28,-D,28,-16); wall(28,16,28,D); wall(-28,-25,-8,-25); wall(8,-25,28,-25); wall(0,-D,0,-34);
  for(const [x,z] of [[-14,0],[14,0],[-14,26],[14,26]]){ BX(g,2.4,6,2.4,x,3,z,M.conc); bl.push({ mesh:null, x:B+x, z, r:1.9, hp:1e9, maxHp:1e9, steel:true, hard:false, loot:false, kind:'uwall' }); }
  for(const s of [-1,1]) BX(g,0.5,0.5,D*2,s*(W-1.2),2.6,0,M.steel);   // pipe runs along the walls
  // lamps: strip lights along the walls, real lights ride the nearest ones
  for(let z=-D+6; z<D; z+=11) for(const x of [-W+0.8, W-0.8, -28.8, 28.8]){ const m=BX(g,0.25,0.25,3.2,x,3.0,z,M.lamp); U.lamps.push({ x:B+x+(x<0?1.2:-1.2), z, m }); }
  for(let x=-24; x<=24; x+=12) for(const z of [-24.2, D-0.8]){ BX(g,3.2,0.25,0.25,x,3.0,z,M.lamp); U.lamps.push({ x:B+x, z:z+(z<0?1.2:-1.2) }); }
  // floodlight poles out on the floor of the hall and the wings
  for(const [x,z] of [[-8,-8],[8,-8],[-8,22],[8,22],[0,44],[-52,-22],[-52,8],[52,-18],[52,12],[-14,-40],[14,-30]]){ BX(g,0.2,5.2,0.2,x,2.6,z,M.steel); const hd=BX(g,1.4,0.35,0.7,x,5.3,z,M.lamp); hd.rotation.x=0.3; U.lamps.push({ x:B+x, z, pole:true }); }
  // a pool of light on the floor under every lamp
  { const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), gr=x.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(255,255,255,0.85)'); gr.addColorStop(0.45,'rgba(255,255,255,0.32)'); gr.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=gr; x.fillRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; U.poolM=new THREE.MeshBasicMaterial({ map:t, color:0x9aa8c0, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2, fog:false });
    const pg=new THREE.PlaneGeometry(1,1); pg.rotateX(-Math.PI/2); const im=new THREE.InstancedMesh(pg, U.poolM, U.lamps.length), Mx=new THREE.Matrix4(), Q=new THREE.Quaternion(), S3=new THREE.Vector3(), P3=new THREE.Vector3();
    U.lamps.forEach((q,k)=>{ const r=q.pole?16:9; Mx.compose(P3.set(q.x-B, 0.05, q.z), Q, S3.set(r,1,r)); im.setMatrixAt(k, Mx); }); im.renderOrder=2; g.add(im); }
  // ---- the targets ----
  const T=(role, x, z, r, hp, build)=>{ const grp=new THREE.Group(); grp.position.set(x,0,z); g.add(grp); build(grp); const o={ role, x:B+x, z, r, hp, maxHp:hp, alive:true, g:grp, bar:null };
    o.blk={ mesh:grp, x:B+x, z, r, hp:1e9, maxHp:1e9, steel:false, hard:false, loot:false, kind:'utarget', ub:true, tg:o }; bl.push(o.blk); U.targets.push(o); return o; };
  for(const z of [-36,-8,22]) T('inf', -52, z, 5, C.hp.inf, gr=>{ BX(gr,16,3.6,7,0,1.8,0,M.olive); BX(gr,16.4,0.3,7.4,0,3.75,0,M.dark); for(let k=0;k<5;k++) BX(gr,1.4,0.7,0.05,-6+k*3,2.4,3.53,M.lamp);   // a barracks block: bunks behind lit windows
    for(let k=0;k<4;k++){ BX(gr,2.2,0.5,0.9,-6+k*4,0.6,5.4,M.crate); } BX(gr,1.6,2.6,0.1,7.2,1.3,3.55,M.dark); });
  for(const z of [-34,-4,26]) T('veh', 52, z, 6, C.hp.veh, gr=>{ BX(gr,14,0.5,10,0,0.25,0,M.hazard); for(const s of [-1,1]) BX(gr,0.6,7,0.6,s*6.6,3.5,-4.6,M.steel); BX(gr,14,0.6,0.8,0,7,-4.6,M.steel);   // a vehicle lift: hazard deck, gantry crane, a tank waiting on it
    BX(gr,0.6,2.2,0.6,1,5.6,-4.6,M.dark); BX(gr,7,1.6,4,0,1.3,0.6,M.olive); BX(gr,3.6,1.1,3,0.3,2.6,0.4,M.olive); BX(gr,0.3,0.3,4.6,0.3,2.7,3.4,M.dark); });
  for(const x of [-20,-8]) T('ammo', x, -42, 4.2, C.hp.ammo, gr=>{ for(let k=0;k<9;k++) BX(gr,1.6,1.1,1.1,-1.8+(k%3)*1.8,0.55+Math.floor(k/3)*1.15,-0.6+((k*7)%3)*0.25,M.crate);   // an arsenal stack: ammo boxes, shells on a rack
    for(let k=0;k<5;k++){ const s=CY(gr,0.18,0.18,1.6,8,-1.6+k*0.8,0.8,2.2,M.shell); s.rotation.x=Math.PI/2; } BX(gr,4.8,0.2,1.2,0,1.6,2.2,M.steel); });
  const gen=T('power', 15, -41, 6, C.hp.power, gr=>{ CY(gr,3.2,3.6,4.4,16,0,2.2,0,M.steel); const core=CY(gr,1.6,1.6,4.8,16,0,2.6,0,M.cyan); gr.userData.core=core;   // the generator: a steel drum round a glowing core, a turbine on top
    const fan=new THREE.Group(); fan.position.y=5.4; gr.add(fan); for(let k=0;k<4;k++){ const b=BX(fan,4.6,0.15,0.7,0,0,0,M.dark); b.rotation.y=k*Math.PI/4; } gr.userData.fan=fan; for(const s of [-1,1]) CY(gr,0.5,0.5,6,8,s*4.4,3,0,M.dark); });
  U.gen=gen;
  // base guns in the hall
  for(const [x,z] of [[-18,-18],[18,-18],[-20,34]]){ const Tt=turret(g, x, z, B+x, z, true); U.turrets.push(Tt); bl.push(Tt.blk); }
  // crates and sandbag lines as cover in the hall
  for(const [x,z,ry] of [[-8,10,0],[9,4,0.3],[-4,36,0],[12,38,-0.2],[0,-12,0]]){ BX(g,3.6,1.2,1.2,x,0.6,z,M.bag,ry); bl.push({ mesh:null, x:B+x, z, r:1.6, hp:1e9, maxHp:1e9, steel:true, hard:false, loot:false, kind:'uwall' }); }
  // real lights (made once)
  const want=MOBILE?UNDERBASE.lights.mob:UNDERBASE.lights.desk; while(U.lights.length<want){ const l=new THREE.PointLight(0xe8f0ff, 0, UNDERBASE.lights.range, 1.4); l.visible=false; scene.add(l); U.lights.push(l); }
  if(!U.genLight){ U.genLight=new THREE.PointLight(0x40e8ff, 0, 30, 1.4); U.genLight.visible=false; scene.add(U.genLight); }
  U.genLight.position.set(B+15, 5, -41); U.power=true; base.fresh=true; }
function clearBase(){ const U=UNDER; if(U.base){ scene.remove(U.base.g); U.base=null; } for(const e of U.bmen) poolMan(e); U.bmen.length=0; U.bblocks.length=0; U.targets.length=0; U.turrets.length=0; U.lamps.length=0; }
function poolMan(e){ if(e.mesh){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); } if(e.bar){ freeEnemyBar(e.bar); e.bar=null; } }

function targetHit(o, dmg){ if(!o.alive) return; o.hp-=dmg; const gy=0;
  burst({ x:o.x, z:o.z }, o.role==='power'?0x9ae8ff:0xffd080, 4, 3, { y:gy+2, life:0.4, size:0.25, grav:-14, drag:1.5, up:2 });
  if(!o.bar){ o.bar=getEnemyBar(); o.bar.g.scale.setScalar(2); } const f=Math.max(0,o.hp)/o.maxHp, br=o.bar; br.g.visible=true; br.g.position.set(o.x, 6.5, o.z); br.fill.scale.x=Math.max(0.001,f); br.fill.position.x=-(1-f)*0.5; br.fill.material.color.setHex(0xff8a3a);
  if(o.hp<=0) wreck(o); }
const ROLE={ inf:['KHO LÍNH NGẦM','viện binh bộ binh'], veh:['BÃI XE NGẦM','viện binh xe tăng'], ammo:['KHO ĐẠN NGẦM','kho đạn'], power:['MÁY PHÁT ĐIỆN','điện căn cứ'] };
function wreck(o){ const U=UNDER, C=UNDERBASE; o.alive=false; if(o.bar){ freeEnemyBar(o.bar); o.bar=null; } const i=U.bblocks.indexOf(o.blk); if(i>=0) U.bblocks.splice(i,1); const j=blocks.indexOf(o.blk); if(j>=0) blocks.splice(j,1);
  const big=o.role==='ammo'||o.role==='power'; bigExplode({ x:o.x, z:o.z }, o.role==='power'?0x8ae8ff:0xff8a3a, big?2.2:1.5); for(let k=0;k<4;k++) spawnDebris({ x:o.x+R(-3,3), z:o.z+R(-3,3) }, 1.2, 0x4a4a44);
  o.g.traverse(q=>{ if(q.material && q.material.color && !q.material.userData.burnt){ q.material=q.material.clone(); q.material.userData.burnt=true; q.material.color.multiplyScalar(0.3); if(q.material.emissive) q.material.emissiveIntensity=0; } }); o.g.scale.y=0.55; o.g.rotation.z=R(-0.08,0.08);
  S.shake=Math.max(S.shake, big?1.2:0.8);
  if(o.role==='ammo'){ for(const q of U.targets) if(q!==o && q.alive && Math.hypot(q.x-o.x,q.z-o.z)<16) setTimeout(()=>targetHit(q, 260), 500); for(const e of enemies.slice()) if(Math.hypot(e.pos.x-o.x,e.pos.z-o.z)<12) damageEnemy(e, 60); }   // the arsenal goes up and takes what is next to it
  if(o.role==='inf') U.cut.inf=Math.min(0.9, U.cut.inf+C.cut.inf); else if(o.role==='veh') U.cut.veh=Math.min(0.9, U.cut.veh+C.cut.veh); else if(o.role==='ammo'){ U.cut.inf=Math.min(0.9, U.cut.inf+C.cut.ammo); U.cut.veh=Math.min(0.9, U.cut.veh+C.cut.ammo); }
  else if(o.role==='power') powerDown();
  const left=U.targets.filter(q=>q.role===o.role && q.alive).length, R0=ROLE[o.role];
  addScore(C.score.target, { x:o.x, y:4, z:o.z }); floatText(R0[0]+' BỊ PHÁ', '#ffcf5a', { x:o.x, y:6, z:o.z }, 18);
  showBanner(o.role==='power' ? 'MÁY PHÁT BỊ PHÁ — CĂN CỨ MẤT ĐIỆN!' : (R0[0]+(left?' — CÒN '+left:' — ĐÃ XOÁ SỔ')+' · viện binh địch −'+Math.round(Math.max(U.cut.inf,U.cut.veh)*100)+'%'), '#ffcf5a');
  if(o.role==='inf' && !left) radio('SCH: Kho lính ngầm đã bị xoá sổ — bọn chúng hết người chui lên từ địa đạo!');
  if(o.role==='veh' && !left) radio('SCH: Bãi xe ngầm tan tành — xe tăng địch không còn đường ra!');
  if(U.targets.every(q=>!q.alive)){ addScore(C.score.all, { x:o.x, y:6, z:o.z }); setTimeout(()=>{ showBanner('CĂN CỨ NGẦM ĐÃ BỊ XOÁ SỔ!', '#9be04a'); radio('SCH: Căn cứ ngầm của địch đã thành đống đổ nát — rút lên mặt đất!'); }, 1500); }
  hud(); }
function powerDown(){ const U=UNDER; U.power=false; const M=mats(); M.lamp.emissive.setHex(0xff2a14); M.lamp.emissiveIntensity=1.6; if(U.poolM) U.poolM.color.setHex(0x7a1408); if(U.genLight) U.genLight.intensity=0;
  for(const l of U.lights) l.color.setHex(0xff3a24); radio('SCH: Căn cứ mất điện — ụ súng của chúng đã câm!'); }

// =================================================================== going down / coming up ===================================================================
function veil(){ if(UNDER.veil) return UNDER.veil; const v=document.createElement('div'); v.style.cssText='position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .5s ease;z-index:60;display:flex;align-items:center;justify-content:center;color:#ffcf5a;font:800 34px/1.2 system-ui,sans-serif;letter-spacing:.12em;text-shadow:0 0 18px #000';
  document.body.appendChild(v); return UNDER.veil=v; }
function hud(){ const U=UNDER; if(!U.hud){ const h=document.createElement('div'); h.style.cssText='position:fixed;right:14px;top:220px;z-index:30;padding:10px 12px;border-radius:10px;background:rgba(10,12,14,.78);border:1px solid rgba(255,207,90,.4);color:#e8e0c8;font:600 12px/1.6 system-ui,sans-serif;pointer-events:none;min-width:190px';
    document.body.appendChild(h); U.hud=h; }
  const h=U.hud; h.style.display=U.on?'block':'none'; if(!U.on) return; const cnt=r=>{ const a=U.targets.filter(q=>q.role===r); return (a.length-a.filter(q=>q.alive).length)+'/'+a.length; };
  h.innerHTML='<b style="color:#ffcf5a;letter-spacing:.1em">CĂN CỨ NGẦM</b><br>Kho lính '+cnt('inf')+' · Bãi xe '+cnt('veh')+'<br>Kho đạn '+cnt('ammo')+' · Máy phát '+cnt('power')
    +'<br><span style="color:#9be04a">Viện binh địch: bộ binh −'+Math.round(U.cut.inf*100)+'% · xe −'+Math.round(U.cut.veh*100)+'%</span><br><span style="opacity:.7">Lái lên dốc phía nam để trở lại mặt đất</span>'; }
function fade(on, text){ const v=veil(); v.textContent=text||''; v.style.opacity=on?'1':'0'; }
function stashSurface(){ const U=UNDER; U.surf=enemies.splice(0); for(const e of U.surf){ e.mesh.visible=false; if(e.bar) e.bar.g.visible=false; }
  U.sblocks=blocks.splice(0); for(const b of U.bblocks) blocks.push(b); for(const e of U.bmen){ e.mesh.visible=true; enemies.push(e); } U.bmen.length=0;
  for(let i=bullets.length-1;i>=0;i--) recycleBullet(i); }
function restoreSurface(){ const U=UNDER; U.bmen=enemies.splice(0); for(const e of U.bmen){ e.mesh.visible=false; if(e.bar) e.bar.g.visible=false; }
  blocks.length=0; for(const b of U.sblocks) blocks.push(b); U.sblocks.length=0; for(const e of U.surf){ e.mesh.visible=true; enemies.push(e); } U.surf.length=0;
  for(let i=bullets.length-1;i>=0;i--) recycleBullet(i); }
function moveAllies(fromX, fromZ, toX, toZ, face){ let k=0; for(const a of FT){ if(a.dead) continue; const r=4+(k%4)*2.2, s=(k%2?1:-1)*(1+(k>>1)); a.pos.set(toX+Math.sin(face)*-r+Math.cos(face)*s, 0, toZ+Math.cos(face)*-r-Math.sin(face)*s); if(a.g) a.g.position.copy(a.pos); a.facing=face; k++; }
  k=0; for(const t of ALLY_TANKS){ if(t.hp<=0) continue; t.pos.set(toX+Math.sin(face)*-(10+k*6)+(k%2?4:-4), 0, toZ+Math.cos(face)*-(10+k*6)); t.mesh.position.set(t.pos.x, 0, t.pos.z); t.facing=t.aim=face; t.goal=null; t.target=null; k++; } }
function placePlayer(x, z, face){ const p=S.player; p.pos.x=x; p.pos.z=z; if(p.vel) p.vel.set(0,0,0); p.facing=face; p.aim=p.aimSmoothed=face; p.mesh.position.set(x, heightAt(x,z), z); p.mesh.rotation.y=face; }
function underLook(on){ const U=UNDER;
  if(on){ U.wx=S.weather||'clear'; applyWeather('clear'); if(HZN.g) HZN.g.visible=false; SKY.visible=false; scene.background.setHex(0x050506); scene.fog.color.setHex(0x050506); scene.fog.density=0.0055;
    sun.intensity=0.12; hemi.color.setHex(0x8a96aa); hemi.groundColor.setHex(0x2a2a2a); hemi.intensity=0.95; ambient.color.setHex(0x9a9aa4); ambient.intensity=0.7; renderer.toneMappingExposure=1.3;
    NIGHT.on=true; if(NIGHT.head) NIGHT.head.visible=true; for(const sp of NIGHT.spots) sp.visible=false; for(const l of U.lights){ l.visible=true; } if(U.genLight){ U.genLight.visible=true; U.genLight.intensity=U.power?40:0; } }
  else { for(const l of U.lights) l.visible=false; if(U.genLight) U.genLight.visible=false; if(HZN.g) HZN.g.visible=true; applyAtmosphere(BIOME); applyWeather(U.wx); } }
function goDown(){ const U=UNDER, G=U.gate, p=S.player; if(U.busy || !G) return; U.busy=true; fade(true, 'ĐỘT NHẬP CĂN CỨ NGẦM'); sfx('bigexplode');
  setTimeout(()=>{ if(!U.base) buildBase(); U.on=true; stashSurface(); const fresh=U.base.fresh; U.base.fresh=false;
    placePlayer(U.BX, U.D+14, Math.PI); moveAllies(G.x, G.z, U.BX, U.D+10, Math.PI); underLook(true);
    if(fresh) garrisonBase(); U.sqAt=performance.now()/1000+12; U.tkAt=performance.now()/1000+25; hud();
    setTimeout(()=>{ fade(false); U.busy=false; U.cool=performance.now()/1000+3; showBanner('CĂN CỨ NGẦM — PHÁ KHO LÍNH, BÃI XE, KHO ĐẠN!', '#ffcf5a');
      if(!U.told){ U.told=true; radio('SCH: Anh đang ở dưới lòng đất. Mỗi kho lính, bãi xe bị phá là địch mất viện binh trên kia — phá máy phát để tắt ụ súng!'); } }, 450); }, 560); }
function goUp(silent){ const U=UNDER, G=U.gate; if(U.busy) return; const done=()=>{ restoreSurface(); U.on=false; underLook(false); hud();
    if(!silent && G){ const [x,z]=toW(G,0,12); placePlayer(x, z, G.a); moveAllies(U.BX, U.D, x, z, G.a); } };
  if(silent){ done(); return; } U.busy=true; fade(true, 'TRỞ LẠI MẶT ĐẤT'); setTimeout(()=>{ done(); setTimeout(()=>{ fade(false); U.busy=false; U.cool=performance.now()/1000+4; }, 400); }, 560); }
function garrisonBase(){ const U=UNDER, B=U.BX, st=S.stage||1;
  for(const [x,z] of [[0,4],[-50,10],[0,-36]]) spawnSquad({ x:B+x, z });
  const TK=st>=4?['heavy','grunt']:['grunt','gunner']; for(const [x,z] of (st>=3?[[44,-18],[44,12]]:[[44,-6]])) spawnEnemy(TK[(Math.random()*TK.length)|0], B+x, z);
  if(st>=3) spawnEnemy('atgm', B-12, -32); }

// =================================================================== per frame ===================================================================
export function updateUnder(dt, now){ const U=UNDER, G=U.gate, p=S.player; if(!p) return;
  if(G){ if(G.beacon) G.beacon.material.emissiveIntensity=G.opening?0:(2+2*Math.max(0,Math.sin(now*6)));
    if(G.opening){ G.open=Math.min(1, G.open+dt*0.6); G.doorL.rotation.z=G.open*2.1; G.doorR.rotation.z=-G.open*2.1; G.mark.material.opacity=blPulse(now, 'notice', 0.45); } }
  if(S.mode!=='playing') return;
  if(U.on){ if(p.pos.x<U.x0){ goUp(true); return; }   // respawned up top (or teleported) while below: the base lets go
    for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; if(e.pos.x<U.x0){ enemies.splice(i,1); e.mesh.visible=false; if(e.bar) e.bar.g.visible=false; U.surf.push(e); } }   // anything raised up top meanwhile waits there
    runTurrets(U.power?U.turrets:[], dt, now); const lx=p.pos.x-U.BX;
    if(!U.busy && now>U.cool && Math.abs(lx)<6.5 && p.pos.z>U.D+17) goUp(false);
    // the base keeps feeding men and armour while its barracks / lifts stand
    const C=UNDERBASE.spawn; if(now>U.sqAt){ U.sqAt=now+R(C.squad[0],C.squad[1]); const b=U.targets.filter(o=>o.role==='inf' && o.alive); if(b.length && enemies.filter(e=>e.def.inf).length<14){ const o=b[(Math.random()*b.length)|0]; spawnSquad({ x:o.x+9, z:o.z }); } }
    if(now>U.tkAt){ U.tkAt=now+R(C.tank[0],C.tank[1]); const v=U.targets.filter(o=>o.role==='veh' && o.alive); if(v.length && enemies.filter(e=>!e.def.inf).length<C.maxTanks){ const o=v[(Math.random()*v.length)|0]; spawnEnemy(S.stage>=4?'heavy':'grunt', o.x-9, o.z); ringPulse(_V.set(o.x-9,0,o.z), 0xe0603a, 3); } }
    // lights ride the nearest lamps; the generator hums
    if(now>(U.lAt||0)){ U.lAt=now+0.3; const near=U.lamps.map(q=>[q,(q.x-p.pos.x)**2+(q.z-p.pos.z)**2]).sort((a,b)=>a[1]-b[1]); U.lights.forEach((l,i)=>{ const q=near[i]; if(q){ l.position.set(q[0].x, 3.6, q[0].z); } }); }
    const fl=U.power?1:(0.5+0.5*Math.max(0,Math.sin(now*3.2))); for(const l of U.lights) l.intensity=UNDERBASE.lights.I*(U.power?1:0.55)*fl;
    if(U.power && U.gen && U.gen.alive){ const fan=U.gen.g.userData.fan; if(fan) fan.rotation.y+=dt*6; if(U.genLight) U.genLight.intensity=34+8*Math.sin(now*9); }
    return; }
  if(G){ runTurrets(G.turrets, dt, now);
    if(!G.seen && Math.hypot(p.pos.x-G.x, p.pos.z-G.z)<70){ G.seen=true; showBanner('PHÁT HIỆN CỬA HẦM CHÍNH CỦA ĐỊCH', '#ffb070'); radio('SCH: Kia là cửa xuống căn cứ ngầm của địch — phá cái KHOÁ ĐIỆN TỬ cạnh cửa là cửa tự mở. Coi chừng ụ súng!');
      floatText('KHOÁ ĐIỆN TỬ', '#ff7a5a', { x:G.lock.x, y:heightAt(G.lock.x,G.lock.z)+5, z:G.lock.z }, 16); }
    if(G.opening && G.open>0.85 && !U.busy && now>U.cool){ const [ex,ez]=toW(G,0,-0.8); if(Math.hypot(p.pos.x-ex, p.pos.z-ez)<4.2) goDown(); } } }

// ---- hooks for the rest of the game ----
export function underHit(b, dmg){ if(b.kind==='ugatelock') lockHit(dmg); else if(b.kind==='uturret') turretHit(b.T, dmg); else if(b.kind==='utarget') targetHit(b.tg, dmg); }
// a wave's next reinforcement: true = it never arrives (its depot below was wrecked)
export function underCut(t){ const c=UNDER.cut; return Math.random() < (t==='squad' ? c.inf : c.veh); }
export function resetUnder(){ const U=UNDER; if(U.on){ U.on=false; for(const e of U.surf) poolMan(e); U.surf.length=0; U.sblocks.length=0; for(let i=enemies.length-1;i>=0;i--) if(enemies[i].pos.x>U.x0){ poolMan(enemies[i]); enemies.splice(i,1); }
    for(let i=blocks.length-1;i>=0;i--) if(/^u(wall|target|turret)$/.test(blocks[i].kind)) blocks.splice(i,1); for(const l of U.lights) l.visible=false; if(U.genLight) U.genLight.visible=false; if(HZN.g) HZN.g.visible=true; }
  if(U.veil) U.veil.style.opacity='0'; U.busy=false; clearBase(); clearGate(); U.cut.inf=0; U.cut.veh=0; U.told=false; U.BX=ARENA+UNDERBASE.off; U.x0=U.BX-U.W-20; hud(); const M=mats(); M.lamp.emissive.setHex(0xe8f2ff); M.lamp.emissiveIntensity=3.2; }
export function buildUnderbase(){ resetUnder(); buildGate(); }
