// actors/helis.js — Z222 THE HELICOPTER FLEET: two more airframes beside the attack gunship, each with its own shape, paint and way of fighting.
//   · heliBomb  — a Hind-type assault helicopter in dark two-tone green over a pale belly, stub wings hung with bombs. No guns: it lines up on
//                 you, runs in level and fast, lays a string of bombs across your position, overshoots, swings round wide and comes again.
//   · heliTroop — a Hip-type transport in olive drab with round cabin windows, external tanks and a door gunner. It flies to a spot near you,
//                 STOPS in a hover, lowers a rope ladder from the side door and its squad climbs down one man at a time; then it lifts off,
//                 repositions and does it again; with its drops done it circles, the door gun firing. Shot down mid-drop, the men on the
//                 ladder fall with it.
//   The attack gunship (actors/vehicles.js) keeps its strafing orbit and now weaves (HELI.jink).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HELI, ROSTER, TROOPS } from '../../config.js';
import { BIOME, HELI_DOWN, MOBILE, S, _canvasTex, _mergeColored, blocksNear, bullets, cMod, clampField, clampFieldXZ, decal, decalScorch, deformCrater, diffDmgMul, diffScale, dirtGeyser, enemies, enemyGroundStrike, floatText, heightAt, insigniaMat, loopDmgMul, makeSoldierMesh, numMat, radio, scene, sfx, spawnBullet, spawnEnemy, spawnPart, updateGunship, wrapAngle, realAir } from '../hub.js';

const _r=(a,b)=>a+Math.random()*(b-a), _ra=a=>_r(a[0],a[1]);
function _tx(geo,x,y,z,rx,ry,rz,sx,sy,sz){ geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)), new THREE.Vector3(sx||1,sy||1,sz||1))); return geo; }

// ---------- paint: a splinter camouflage per airframe, panel lines and rivets ----------
const _camo={};
function camoTex(key, base, spots){ if(_camo[key]) return _camo[key];
  const t=_canvasTex(256,256,(x)=>{ x.fillStyle=base; x.fillRect(0,0,256,256);
    for(const [col,n,w] of spots) for(let i=0;i<n;i++){ x.fillStyle=col; x.beginPath(); const cx=Math.random()*256, cy=Math.random()*256; x.moveTo(cx,cy); for(let k=0;k<6;k++) x.lineTo(cx+(Math.random()-0.5)*w, cy+(Math.random()-0.5)*w*0.6); x.closePath(); x.fill(); }
    x.strokeStyle='rgba(18,18,12,0.38)'; x.lineWidth=1.2; for(let k=0;k<256;k+=28){ x.beginPath(); x.moveTo(k,0); x.lineTo(k,256); x.moveTo(0,k+10); x.lineTo(256,k+10); x.stroke(); }
    for(let i=0;i<90;i++){ x.fillStyle='rgba(18,18,12,0.5)'; x.fillRect(Math.random()*256,Math.random()*256,2,2); } });
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return _camo[key]=t; }
const _mats={};
function hmats(key){ if(_mats[key]) return _mats[key];
  const tex = key==='hind' ? camoTex('hind', '#4a5638', [['#2c3424',8,120],['#6a5a3a',6,110]])       // dark green / brown, the classic Hind scheme
            : camoTex('hip', '#66683e', [['#8a7a4e',7,110],['#3e4428',6,100]]);                       // olive drab with tan and dark green
  return _mats[key]={ hull:new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.55, metalness:0.3, map:tex }),
    dark:new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.55, metalness:0.6 }), glass:new THREE.MeshStandardMaterial({ vertexColors:true, color:0x1a262a, roughness:0.05, metalness:0.95, envMapIntensity:1.6 }),
    blade:new THREE.MeshStandardMaterial({ color:0x1a1c18, roughness:0.6, metalness:0.3 }), tip:new THREE.MeshStandardMaterial({ color:0xf2c21a, roughness:0.5 }),
    blur:new THREE.MeshBasicMaterial({ color:0x202020, transparent:true, opacity:0.14, depthWrite:false, side:THREE.DoubleSide }),
    red:new THREE.MeshStandardMaterial({ color:0x200000, emissive:0xff2020, emissiveIntensity:3 }), green:new THREE.MeshStandardMaterial({ color:0x002000, emissive:0x20ff40, emissiveIntensity:2.6 }),
    white:new THREE.MeshStandardMaterial({ color:0x202020, emissive:0xffffff, emissiveIntensity:2.2 }) }; }
function bake(body, P, M){ for(const k in P){ if(!P[k].length) continue; const m=new THREE.Mesh(_mergeColored(P[k]), M[k]); m.castShadow=true; body.add(m); } }
function mainRotor(M, n, R, y, z){ const rotor=new THREE.Group(); rotor.position.set(0,y,z);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.3,0.3,12), M.blade); rotor.add(hub);
  for(let k=0;k<n;k++){ const a=k*Math.PI*2/n, bl=new THREE.Mesh(new RoundedBoxGeometry(0.42,0.05,R,1,0.02), M.blade); bl.position.set(Math.sin(a)*R/2,0,Math.cos(a)*R/2); bl.rotation.set(0.03,a,0); bl.castShadow=true; rotor.add(bl);
    const t=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.06,0.4), M.tip); t.position.set(Math.sin(a)*(R-0.2),0.01,Math.cos(a)*(R-0.2)); t.rotation.y=a; rotor.add(t); }
  const blur=new THREE.Mesh(new THREE.RingGeometry(0.5,R+0.2,40), M.blur); blur.rotation.x=-Math.PI/2; rotor.add(blur); return rotor; }
function tailRotor(M, x, y, z, R){ const t=new THREE.Group(); t.position.set(x,y,z); for(let k=0;k<3;k++){ const b=new THREE.Mesh(new RoundedBoxGeometry(0.05,R,0.17,1,0.02), M.blade); b.position.y=R/2; const arm=new THREE.Group(); arm.rotation.x=k*Math.PI*2/3; arm.add(b); t.add(arm); } return t; }
function lights(body, M, span, tailZ){ const lt=(mat,x,y,z)=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), mat); m.position.set(x,y,z); body.add(m); return m; };
  lt(M.red,-span,-0.1,0.4); lt(M.green,span,-0.1,0.4); lt(M.white,0,1.9,tailZ); return lt(M.red,0,-1.1,-1.4); }   // the strobe under the belly
function marks(body, x, y, zBoom, zNose, zFin, finY){ const num=String(10+((Math.random()*89)|0));
  for(const sx of [-1,1]){ decal(body, insigniaMat(), 0.8, 0.8, sx*x.boom, y.boom, zBoom, sx*Math.PI/2); decal(body, numMat(num), 1.0, 0.5, sx*x.nose, y.nose, zNose, sx*Math.PI/2); decal(body, insigniaMat(), 0.6, 0.6, sx*0.1, finY, zFin, sx*Math.PI/2); } }

// ---------- a free-fall bomb (FAB type): olive body, yellow nose band, box tail fins ----------
let _bombGeo=null, _bombMat=null;
function bombGeo(){ if(_bombGeo) return _bombGeo; const P=[], OD=0x4a5236;
  P.push({ geo:_tx(new THREE.CylinderGeometry(0.24,0.24,1.1,12),0,0,0,Math.PI/2), col:OD }, { geo:_tx(new THREE.SphereGeometry(0.24,12,8,0,Math.PI*2,0,Math.PI/2),0,0,0.55,Math.PI/2), col:OD },
    { geo:_tx(new THREE.CylinderGeometry(0.245,0.245,0.1,12),0,0,0.36,Math.PI/2), col:0xd8b020 }, { geo:_tx(new THREE.CylinderGeometry(0.24,0.1,0.55,12),0,0,-0.82,Math.PI/2), col:OD });
  for(let k=0;k<4;k++){ const a=k*Math.PI/2; P.push({ geo:_tx(new THREE.BoxGeometry(0.02,0.36,0.4),Math.cos(a)*0.17,Math.sin(a)*0.17,-0.95,0,0,a), col:0x3a4028 }); }
  _bombGeo=_mergeColored(P); _bombMat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.6, metalness:0.35 }); return _bombGeo; }
function bombMesh(){ const m=new THREE.Mesh(bombGeo(), _bombMat); m.castShadow=!MOBILE; return m; }

// ---------- the rope ladder: two ropes and wooden rungs, hung from the door ----------
let _ladMat=null;
function buildLadder(L){ const P=[]; for(const sx of [-0.22,0.22]) P.push({ geo:_tx(new THREE.CylinderGeometry(0.028,0.028,L,5),sx,-L/2,0), col:0x8a7a52 });
  for(let y=0.35;y<L;y+=0.42) P.push({ geo:_tx(new THREE.BoxGeometry(0.52,0.05,0.07),0,-y,0), col:0x5a4630 });
  _ladMat=_ladMat||new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.9 }); const m=new THREE.Mesh(_mergeColored(P), _ladMat); m.castShadow=!MOBILE; const g=new THREE.Group(); g.add(m); return g; }

// ===== HIND — the bomber helicopter =====
export function buildHind(){ const M=hmats('hind'), g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const P={ hull:[], dark:[], glass:[] }, add=(k,geo,col)=>P[k].push({ geo, col }), W=0xffffff, BL=0xbfcbd2, D=0x24261f, M2=0x3a3c34, RED=0xc81e1e;
  add('hull', _tx(new RoundedBoxGeometry(2.1,2.0,7.4,3,0.45),0,0,0.2), W); add('hull', _tx(new RoundedBoxGeometry(2.12,0.5,7.2,2,0.2),0,-0.82,0.2), BL);   // cabin, pale belly
  add('hull', _tx(new THREE.CylinderGeometry(0.6,1.0,2.6,16),0,-0.15,5.15,Math.PI/2), W);                                                       // the long tapering nose
  add('glass', _tx(new THREE.SphereGeometry(0.66,16,10,0,Math.PI*2,0,Math.PI/2),0,0.3,5.55,0,0,0,1,0.85,1.6), W);                              // gunner's bubble…
  add('glass', _tx(new THREE.SphereGeometry(0.78,16,10,0,Math.PI*2,0,Math.PI/2),0,0.85,3.85,0,0,0,1,0.9,1.5), W);                              // …and the pilot's, stepped up behind
  for(const [y,z] of [[0.62,5.5],[1.2,3.85]]) add('dark', _tx(new THREE.BoxGeometry(0.06,0.1,1.9),0,y,z), D);
  add('dark', _tx(new THREE.CylinderGeometry(0.1,0.12,0.8,8),0,-0.9,6.2,Math.PI/2), D); add('dark', _tx(new THREE.SphereGeometry(0.26,12,8),0,-0.85,5.7), M2);   // chin sensor + gun barrel
  for(const sx of [-1,1]){ add('hull', _tx(new THREE.CylinderGeometry(0.48,0.5,3.4,16),sx*0.64,1.28,0.7,Math.PI/2), W); add('dark', _tx(new THREE.CylinderGeometry(0.36,0.36,0.12,14),sx*0.64,1.28,2.42,Math.PI/2), D);   // engines + intakes
    add('dark', _tx(new THREE.CylinderGeometry(0.32,0.42,0.9,12),sx*0.98,1.1,-1.2,Math.PI/2+0.3,0,sx*0.6), M2);                                    // exhaust deflectors
    add('hull', _tx(new THREE.BoxGeometry(2.9,0.16,1.5),sx*2.35,-0.18,0.4,0,0,-sx*0.18), W);                                                       // stub wing with anhedral
    add('dark', _tx(new THREE.BoxGeometry(0.16,0.5,0.6),sx*3.75,-0.55,0.45), D); add('hull', _tx(new THREE.CylinderGeometry(0.25,0.25,1.5,12),sx*3.75,-0.88,0.55,Math.PI/2), M2);   // wingtip rocket rail
    for(const wx of [1.45,2.3,3.0]) add('dark', _tx(new THREE.BoxGeometry(0.1,0.3,0.45),sx*wx,-0.36-(wx-0.9)*0.18,0.45), D);                         // bomb pylons
    add('glass', _tx(new THREE.BoxGeometry(0.06,0.5,0.6),sx*1.06,0.2,1.6), W); add('glass', _tx(new THREE.BoxGeometry(0.06,0.5,0.6),sx*1.06,0.2,0.6), W);   // cabin windows
    add('dark', _tx(new THREE.CylinderGeometry(0.2,0.2,0.16,12),sx*1.1,-1.35,-0.6,0,0,Math.PI/2), 0x161616); }                                     // wheels
  add('hull', _tx(new THREE.CylinderGeometry(0.3,0.62,6.2,14),0,0.5,-6.6,-Math.PI/2), W);                                                       // tail boom
  add('dark', _tx(new THREE.CylinderGeometry(0.42,0.44,0.4,14),0,0.5,-4.6,-Math.PI/2), RED);                                                    // red recognition band
  add('hull', _tx(new THREE.BoxGeometry(0.16,2.3,1.5),0,1.55,-9.5,-0.35), W); add('hull', _tx(new THREE.BoxGeometry(2.6,0.1,0.75),0,0.55,-8.4), W);   // swept fin, stabilator
  add('dark', _tx(new THREE.CylinderGeometry(0.3,0.36,0.5,14),0,1.55,0.3), D);
  bake(body, P, M); marks(body, { boom:0.36, nose:0.95 }, { boom:0.5, nose:0.2 }, -5.4, 2.2, -9.5, 1.6);
  const bombs=[]; for(const sx of [-1,1]) for(const wx of [1.45,2.3,3.0]){ const b=bombMesh(); b.position.set(sx*wx,-0.82-(wx-0.9)*0.18,0.45); body.add(b); bombs.push(b); }
  const nav=lights(body, M, 3.9, -10.1), rotor=mainRotor(M, 5, 7.6, 2.0, 0.3); body.add(rotor); const trot=tailRotor(M, -0.25, 1.9, -9.8, 1.5); body.add(trot);
  g.userData={ body, rotor, trot, nav, bombs, heli:true }; scene.add(g); return realAir(g, 'heli_swallow'); }   // Z272 the swooping swallow-wing bomber

// ===== HIP — the troop transport =====
export function buildHip(){ const M=hmats('hip'), g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const P={ hull:[], dark:[], glass:[] }, add=(k,geo,col)=>P[k].push({ geo, col }), W=0xffffff, BL=0xc4cdd2, D=0x24261f, M2=0x3a3c34, RED=0xc81e1e;
  add('hull', _tx(new RoundedBoxGeometry(2.5,2.5,8.2,3,0.6),0,0,0.3), W); add('hull', _tx(new RoundedBoxGeometry(2.52,0.55,8.0,2,0.22),0,-1.02,0.3), BL);   // cabin, pale belly
  add('hull', _tx(new THREE.SphereGeometry(1.25,16,10,0,Math.PI*2,0,Math.PI/2),0,-0.05,4.35,Math.PI/2,0,0,1,0.85,1), W);                       // rounded nose
  add('glass', _tx(new THREE.BoxGeometry(2.0,0.85,0.08),0,0.55,5.1,-0.55), W); for(const sx of [-1,1]) add('glass', _tx(new THREE.BoxGeometry(0.06,0.7,1.2),sx*1.12,0.45,4.6,0,sx*0.25,0), W);   // cockpit glazing
  add('glass', _tx(new THREE.BoxGeometry(1.4,0.5,0.06),0,-0.55,5.45,0.5), W);                                                                     // the chin windows
  add('hull', _tx(new THREE.SphereGeometry(1.24,16,10,0,Math.PI*2,0,Math.PI/2),0,0,-3.75,-Math.PI/2,0,0,1,1,0.55), W);                         // clamshell rear doors
  add('hull', _tx(new RoundedBoxGeometry(1.8,0.85,4.4,2,0.3),0,1.62,0.6), W); for(const sx of [-1,1]){ add('dark', _tx(new THREE.CylinderGeometry(0.34,0.34,0.12,14),sx*0.5,1.62,2.82,Math.PI/2), D);   // engine house + intakes
    add('dark', _tx(new THREE.CylinderGeometry(0.28,0.34,0.7,12),sx*0.95,1.55,-1.5,Math.PI/2,0,sx*0.4), M2);                                      // exhausts
    for(let k=0;k<5;k++) add('dark', _tx(new THREE.CylinderGeometry(0.21,0.21,0.06,14),sx*1.26,0.35,2.5-k*1.05,0,0,Math.PI/2), 0x1a2228);       // round cabin windows
    add('hull', _tx(new THREE.CylinderGeometry(0.45,0.45,2.8,14),sx*1.62,-0.75,0.6,Math.PI/2), W); add('hull', _tx(new THREE.SphereGeometry(0.45,12,8),sx*1.62,-0.75,2.0), W);   // external fuel tanks
    add('dark', _tx(new THREE.CylinderGeometry(0.3,0.3,0.2,12),sx*1.25,-1.55,-0.8,0,0,Math.PI/2), 0x161616); }
  add('dark', _tx(new THREE.BoxGeometry(0.08,1.75,1.25),1.27,-0.2,2.0), 0x101210);                                                               // the open side door
  add('dark', _tx(new THREE.CylinderGeometry(0.2,0.2,0.18,12),0,-1.5,3.8,0,0,Math.PI/2), 0x161616);                                              // nose wheel
  add('hull', _tx(new THREE.CylinderGeometry(0.28,0.6,6.8,14),0,0.65,-7.1,-Math.PI/2), W); add('dark', _tx(new THREE.CylinderGeometry(0.44,0.46,0.4,14),0,0.65,-5.0,-Math.PI/2), RED);   // tail boom, red band
  add('hull', _tx(new THREE.BoxGeometry(0.2,2.0,1.1),0,1.45,-10.3,-0.4), W); add('hull', _tx(new THREE.BoxGeometry(2.0,0.1,0.65),0,0.55,-9.0), W);   // tail pylon + stabiliser
  add('dark', _tx(new THREE.CylinderGeometry(0.34,0.4,0.55,14),0,2.3,0.3), D);
  bake(body, P, M); marks(body, { boom:0.4, nose:1.27 }, { boom:0.65, nose:0.9 }, -6.0, 3.2, -10.3, 1.5);
  const door=new THREE.Object3D(); door.position.set(1.3,-1.15,2.0); body.add(door);                                                            // the ladder hangs from here
  const lad=buildLadder(HELI.troop.ladder); lad.scale.y=0.001; lad.visible=false; door.add(lad);
  const gun=makeSoldierMesh({ enemy:true }); gun.scale.setScalar(TROOPS.look.scale/1.2); gun.position.set(0.85,-1.2,2.0); gun.rotation.y=Math.PI/2; body.add(gun);   // the door gunner
  const nav=lights(body, M, 2.1, -10.8), rotor=mainRotor(M, 5, 7.3, 2.6, 0.3); body.add(rotor); const trot=tailRotor(M, 0.3, 1.8, -10.6, 1.4); body.add(trot);
  g.userData={ body, rotor, trot, nav, door, lad, heli:true }; scene.add(g); return realAir(g, 'heli_bomber'); }

// ===== flight =====
const _w=new THREE.Vector3();
function dmul(){ const ds=diffScale(); return (0.75+0.25*ds)*loopDmgMul()*cMod('enemyDmgMul')*diffDmgMul(); }
// steer along a heading with a limited turn rate (a real turn, banked), arrive gently when asked to stop
function fly(e, tx, tz, spd, alt, dt, edt, turn, arrive){
  const dx=tx-e.pos.x, dz=tz-e.pos.z, d=Math.hypot(dx,dz)||1e-3, want=Math.atan2(dx,dz); e.hd=e.hd??e.facing; const da=wrapAngle(want-e.hd);
  e.hd=wrapAngle(e.hd+Math.sign(da)*Math.min(Math.abs(da), turn*dt)); const v=arrive ? Math.min(spd, d*0.55+0.4) : spd, sp0=e.spd||0;
  e.spd=sp0+(v-sp0)*Math.min(1,dt*(v<sp0?1.6:0.9)); e.vel.x=Math.sin(e.hd)*e.spd; e.vel.z=Math.cos(e.hd)*e.spd;
  e.pos.x+=e.vel.x*edt; e.pos.z+=e.vel.z*edt; clampField(e.pos, 3);
  e.pos.y+=(Math.max(heightAt(e.pos.x,e.pos.z),0)+alt-e.pos.y)*Math.min(1,dt*1.3); e.facing=e.hd;
  e.bank=(e.bank||0)+((Math.max(-0.5,Math.min(0.5,-da*0.6))*Math.min(1,e.spd/8))-(e.bank||0))*Math.min(1,dt*2.5);
  e.pitch=(e.pitch||0)+((e.spd*0.018 + (v-sp0)*0.02)-(e.pitch||0))*Math.min(1,dt*2); return d; }
function pose(e, dt, now){ const ud=e.mesh.userData; e.mesh.position.set(e.pos.x, e.pos.y, e.pos.z); e.mesh.rotation.set(0, e.facing, 0); ud.body.rotation.set(e.pitch||0, 0, e.bank||0);
  ud.rotor.rotation.y+=dt*38; ud.trot.rotation.x+=dt*50; ud.nav.visible=(now*1.4+e.ph)%1<0.12;
  const gy=heightAt(e.pos.x,e.pos.z), low=e.pos.y-gy; if(low<14 && Math.random()<(low<10?0.6:0.25)){ const a=Math.random()*6.283, r=3+Math.random()*7;   // rotor wash: dust thrown out under it, harder the lower it hangs
    spawnPart(e.pos.x+Math.cos(a)*r, gy+0.3, e.pos.z+Math.sin(a)*r, Math.cos(a)*(4+(14-low)*0.6), 0.5, Math.sin(a)*(4+(14-low)*0.6), { color:BIOME.ground, size:1.8, life:0.8, smoke:true, grav:-0.2, drag:1.8, op:low<10?0.32:0.2 }); }
  if(Math.random()<0.35){ const cf=Math.cos(e.facing), sf=Math.sin(e.facing); spawnPart(e.pos.x-sf*1.6, e.pos.y+1.2, e.pos.z-cf*1.6, -sf*2, -0.4, -cf*2, { color:0x3a3632, size:0.6, life:0.6, smoke:true, grav:0.2, drag:2, grow:1.2, op:0.16 }); } }   // hot exhaust haze
function flares(e, now){ if(now<(e.flareAt||0)) return; for(const b of bullets){ if(b.owner!=='p' || !b.lockOn || b.tgt!==e) continue; if((b.x-e.pos.x)**2+(b.z-e.pos.z)**2 > 26*26) continue;   // a missile locked on: FLARES
    e.flareAt=now+7; for(let k=0;k<(MOBILE?8:16);k++){ const a=e.facing+Math.PI+(k%2?1:-1)*(0.6+Math.random()*0.9); spawnPart(e.pos.x, e.pos.y-0.3, e.pos.z, Math.sin(a)*(6+Math.random()*6), 2+Math.random()*4, Math.cos(a)*(6+Math.random()*6), { tex:'fire', color:0xffffff, color2:0xffa040, size:0.8, life:1.6+Math.random()*0.6, grav:-5, drag:0.6 }); }
    if(Math.random()<ROSTER.gunship.flareDecoy*(b.smart?0.45:1)){ b.tgt=null; b.flared=now+(b.smart?0.6:1.2); } sfx('rocketlaunch', e.pos, 0.4); break; } }

// which helicopter answers an enemy call for air support
export function heliRoll(){ let n={ heliBomb:0, heliTroop:0 }; for(const e of enemies) if(n[e.type]!=null) n[e.type]++;
  const ok=HELI.mix.filter(([t,,st])=>S.stage>=st && !(t==='heliBomb' && n.heliBomb>=HELI.maxBomb) && !(t==='heliTroop' && n.heliTroop>=HELI.maxTroop));
  let sum=0; for(const m of ok) sum+=m[1]; let r=Math.random()*sum; for(const [t,w] of ok){ r-=w; if(r<=0) return t; } return 'gunship'; }

export function updateHeli(e, dt, now, edt){
  if(e.type==='gunship'){ updateGunship(e, dt, now, edt); return; }
  if(!e.hs) initHeli(e, now);
  if(e.type==='heliBomb') bombRun(e, dt, now, edt); else troopRun(e, dt, now, edt);
  pose(e, dt, now); flares(e, now); }
function initHeli(e, now){ const ud=e.mesh.userData; e.hs={ st:e.type==='heliBomb'?'set':'pick', t:0, lad:0, sent:0, down:0, n:0, drops:0, warned:0 }; e.spd=8; e.hd=Math.atan2(S.player.pos.x-e.pos.x, S.player.pos.z-e.pos.z); e.facing=e.hd;
  if(ud.bombs) for(const b of ud.bombs) b.visible=true; if(ud.lad){ ud.lad.scale.y=0.001; ud.lad.visible=false; } e.fireAt=now+2; }

// ---------- the bomber: line up, run in, lay the stick across you, overshoot, come round ----------
export const BOMBS=[];
function bombRun(e, dt, now, edt){ const B=HELI.bomb, h=e.hs, p=S.player, ud=e.mesh.userData;
  if(h.st==='set'){ const lx=p.pos.x+p.vel.x*B.lead, lz=p.pos.z+p.vel.z*B.lead, a=Math.atan2(lx-e.pos.x, lz-e.pos.z); h.tx=lx; h.tz=lz; h.dx=Math.sin(a); h.dz=Math.cos(a); h.left=B.bombs; h.relAt=0; h.st='run';
    for(const b of ud.bombs) b.visible=true;   // re-armed
    if(now>h.warned && S.mode==='playing'){ h.warned=now+18; floatText('⚠ TRỰC THĂNG NÉM BOM — TRÁNH ĐƯỜNG BAY!', '#ff6a3a', { x:p.pos.x, y:4.2, z:p.pos.z }, 18); } }
  if(h.st==='run'){ fly(e, h.tx+h.dx*B.over, h.tz+h.dz*B.over, B.speed, B.alt, dt, edt, B.turn*0.6, false);
    const tf=Math.sqrt(2*Math.max(2, e.pos.y-heightAt(e.pos.x,e.pos.z))/B.g), ix=e.pos.x+e.vel.x*tf, iz=e.pos.z+e.vel.z*tf, along=(ix-h.tx)*h.dx+(iz-h.tz)*h.dz;
    if(h.left>0 && along>-B.gap*B.speed*B.bombs*0.5 && now>h.relAt && S.mode==='playing'){ h.relAt=now+B.gap; h.left--; dropBomb(e); const bm=ud.bombs[h.left]; if(bm) bm.visible=false; }
    if((e.pos.x-h.tx)*h.dx+(e.pos.z-h.tz)*h.dz > B.over*0.8){ h.st='turn'; h.t=0; h.side=Math.random()<0.5?-1:1; } }
  else if(h.st==='turn'){ h.t+=dt; const px=-h.dz*h.side, pz=h.dx*h.side, d=fly(e, p.pos.x+px*30, p.pos.z+pz*30, B.cruise, B.alt+2, dt, edt, B.turn, false);   // a wide climbing turn back round
    const toP=Math.atan2(p.pos.x-e.pos.x, p.pos.z-e.pos.z); if((Math.abs(wrapAngle(toP-e.hd))<0.45 && Math.hypot(p.pos.x-e.pos.x,p.pos.z-e.pos.z)>40) || h.t>10 || d<6) h.st='set'; } }
function dropBomb(e){ const cf=Math.cos(e.facing), sf=Math.sin(e.facing), sx=(e.hs.left%2?1:-1)*1.8, x=e.pos.x+cf*sx, z=e.pos.z-sf*sx, y=e.pos.y-1.0;
  const m=bombMesh(); m.position.set(x,y,z); scene.add(m); BOMBS.push({ m, x, y, z, vx:e.vel.x*0.95, vz:e.vel.z*0.95, vy:-1.5, dmg:HELI.bomb.dmg*dmul() }); if(e.hs.left%2===0) sfx('whoosh', { x, z }, 0.5); }
function updateBombs(dt, now){ const B=HELI.bomb;
  for(let i=BOMBS.length-1;i>=0;i--){ const b=BOMBS[i]; b.vy-=B.g*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt; const h=Math.hypot(b.vx,b.vz);
    b.m.position.set(b.x,b.y,b.z); b.m.rotation.set(Math.atan2(-b.vy, h), Math.atan2(b.vx,b.vz), 0, 'YXZ');
    const gy=heightAt(b.x,b.z); if(b.y>gy+0.3) continue; BOMBS.splice(i,1); scene.remove(b.m);
    enemyGroundStrike(b.x, b.z, B.R, b.dmg, now); deformCrater(b.x, b.z, 1.6, 0.4); decalScorch(b.x, b.z, B.R*0.8, 1); dirtGeyser(b.x, b.z, 1.4); sfx('explode', { x:b.x, z:b.z }); S.shake=Math.min(4, S.shake+0.5); } }

// ---------- the transport: fly in, STOP, ladder down, the squad climbs down, ladder up, go again ----------
export const CLIMBERS=[]; const _climbPool=[], _bn=[];
function pickDrop(e){ const T=HELI.troop, p=S.player, base=Math.atan2(e.pos.x-p.pos.x, e.pos.z-p.pos.z);
  for(let k=0;k<8;k++){ const a=base+(Math.random()-0.5)*1.6, d=_ra(T.standoff), [x,z]=clampFieldXZ(p.pos.x+Math.sin(a)*d, p.pos.z+Math.cos(a)*d, 12); if(!blocksNear(x, z, 4, _bn).length || k===7) return [x,z]; } }
function hoverAlt(e){ const s=e.mesh.scale.x; return (1.15+HELI.troop.ladder)*s-0.25; }   // the ladder's foot just touches the ground
function troopRun(e, dt, now, edt){ const T=HELI.troop, h=e.hs, p=S.player, ud=e.mesh.userData;
  if(h.st==='pick'){ [h.sx, h.sz]=pickDrop(e); h.st='in'; }
  if(h.st==='in'){ const d=fly(e, h.sx, h.sz, T.cruise, T.alt, dt, edt, T.turn, true); doorGun(e, now);
    if(d<3 && e.spd<2.5){ h.st='hover'; h.t=0; h.sent=0; h.down=0; h.n=Math.round(_ra(MOBILE?T.menMobile:T.men)); if(S.mode==='playing') floatText('⚠ TRỰC THĂNG ĐỔ QUÂN!', '#ffb84a', { x:e.pos.x, y:e.pos.y-3, z:e.pos.z }, 16); if(h.drops===0) radio('SCH: Trực thăng địch đang treo thả quân bằng thang dây — bắn hạ nó ngay!'); } }
  else if(h.st==='hover' || h.st==='up'){ h.t+=dt; e.spd*=Math.max(0,1-dt*3); e.vel.x=Math.sin(e.hd)*e.spd; e.vel.z=Math.cos(e.hd)*e.spd; e.pos.x+=e.vel.x*edt+Math.sin(now*0.9+e.ph)*0.25*dt; e.pos.z+=e.vel.z*edt+Math.cos(now*0.7+e.ph)*0.25*dt;
    const gy=Math.max(heightAt(e.pos.x,e.pos.z),0), want=gy+(h.st==='up'&&h.lad<=0.05 ? T.alt : hoverAlt(e)); e.pos.y+=(want-e.pos.y)*Math.min(1,dt*1.4);
    e.bank=(e.bank||0)*Math.max(0,1-dt*3)+Math.sin(now*1.1+e.ph)*0.015; e.pitch=(e.pitch||0)*Math.max(0,1-dt*3);
    if(h.st==='hover'){ if(Math.abs(e.pos.y-gy-hoverAlt(e))<0.8) h.lad=Math.min(1, h.lad+dt/T.deploy);
      if(h.lad>=1 && h.sent<h.n && now>(h.climbAt||0)){ h.climbAt=now+T.gap; h.sent++; startClimber(e, h.sent%T.rpgEvery===0 && S.stage>=2 ? 'rpg' : 'rifle'); }
      if(h.sent>=h.n && h.down>=h.n){ h.st='up'; h.t=0; } }
    else { h.lad=Math.max(0, h.lad-dt/0.8); if(h.lad<=0 && e.pos.y-gy>T.alt-2){ h.drops++; if(h.drops<T.drops){ h.st='away'; h.awayT=T.recon; const a=Math.random()*6.283; [h.ax,h.az]=clampFieldXZ(e.pos.x+Math.sin(a)*45, e.pos.z+Math.cos(a)*45, 12); } else h.st='loiter'; } } }
  else if(h.st==='away'){ h.awayT-=dt; const d=fly(e, h.ax, h.az, T.cruise, T.alt, dt, edt, T.turn, true); doorGun(e, now); if(h.awayT<=0 || (d<4 && h.awayT<T.recon*0.5)) h.st='pick'; }
  else if(h.st==='loiter'){ h.orb=(h.orb??Math.atan2(e.pos.z-p.pos.z, e.pos.x-p.pos.x))+dt*0.25; fly(e, p.pos.x+Math.cos(h.orb)*T.loiterR, p.pos.z+Math.sin(h.orb)*T.loiterR, T.cruise*0.8, T.alt, dt, edt, T.turn, false); doorGun(e, now); }
  if(ud.lad){ ud.lad.visible=h.lad>0.01; ud.lad.scale.y=Math.max(0.001, h.lad*h.lad*(3-2*h.lad)); ud.lad.rotation.set(Math.sin(now*1.7+e.ph)*0.05*h.lad-(e.pitch||0), 0, Math.cos(now*1.3)*0.04*h.lad-(e.bank||0)); } }   // the ladder hangs plumb and sways
function doorGun(e, now){ const T=HELI.troop, p=S.player; if(S.mode!=='playing' || now<(e.fireAt||0)) return; const d=Math.hypot(p.pos.x-e.pos.x, p.pos.z-e.pos.z); if(d>T.gunR) return;
  e.mesh.userData.door.getWorldPosition(_w); const a=Math.atan2(p.pos.x-_w.x, p.pos.z-_w.z)+(Math.random()-0.5)*0.26;
  spawnBullet(_w.x, _w.z, a, { owner:'e', inf:true, dmg:T.gunDmg*dmul(), speed:70, color:0xffc070, r:0.22, life:1.4, maxDist:T.gunR+4, noArc:true, y:_w.y+0.6, dropTo:1.3 });
  spawnPart(_w.x, _w.y+0.6, _w.z, 0, 0, 0, { tex:'flash', color:0xfff0c0, size:0.7, life:0.05, grav:0, drag:0 }); sfx('enemyShoot', e.pos);
  e.burstLeft=(e.burstLeft||T.burst)-1; if(e.burstLeft<=0){ e.burstLeft=T.burst; e.fireAt=now+T.burstCd; } else e.fireAt=now+T.gunCd; }
function startClimber(e, type){ const g=_climbPool.pop()||makeSoldierMesh({ enemy:true }); g.scale.setScalar(TROOPS.look.scale); g.visible=true; if(g.userData.gun) g.userData.gun.visible=false; scene.add(g);
  e.mesh.userData.door.getWorldPosition(_w); CLIMBERS.push({ g, e, type, x:_w.x, z:_w.z, y:_w.y-0.4, vy:0, st:'climb', t:Math.random()*3 }); }
function endClimber(c, i){ CLIMBERS.splice(i,1); scene.remove(c.g); const u=c.g.userData; if(u.gun) u.gun.visible=true; if(u.arms) u.arms.rotation.x=0; for(const l of u.legs||[]){ l.hip.rotation.x=0; l.knee.rotation.x=0; } _climbPool.push(c.g); }
function updateClimbers(dt, now){ const T=HELI.troop;
  for(let i=CLIMBERS.length-1;i>=0;i--){ const c=CLIMBERS[i], e=c.e, u=c.g.userData; c.t+=dt;
    const alive=enemies.includes(e) && !HELI_DOWN.some(h=>h.e===e); if(c.st==='climb' && !alive){ c.st='fall'; c.vy=0; }
    if(c.st==='climb'){ e.mesh.userData.door.getWorldPosition(_w); c.x=_w.x+Math.cos(e.facing)*0.3; c.z=_w.z-Math.sin(e.facing)*0.3; c.y=Math.min(c.y, _w.y-0.4)-T.climb*dt;   // hand under hand down the rungs
      c.g.position.set(c.x, c.y-1.75, c.z); c.g.rotation.set(0, e.facing-Math.PI/2, 0);
      const ph=c.t*9; if(u.arms) u.arms.rotation.x=-2.5+Math.sin(ph)*0.35; for(const l of u.legs||[]){ const q=ph+(l.sx>0?Math.PI:0); l.hip.rotation.x=-0.5+Math.sin(q)*0.5; l.knee.rotation.x=0.7+Math.max(0,Math.sin(q))*0.6; }
      const gy=heightAt(c.x,c.z); if(c.y-1.75<=gy+0.05){ const ox=Math.cos(e.facing)*1.2, oz=-Math.sin(e.facing)*1.2; endClimber(c, i);
        spawnPart(c.x+ox, gy+0.3, c.z+oz, 0, 0.3, 0, { color:BIOME.ground, size:1.4, life:0.6, smoke:true, grav:0.2, drag:2, op:0.35 });
        const n=spawnEnemy(c.type, c.x+ox, c.z+oz); if(n){ n.fireAt=now+0.9; n.facing=e.facing; } e.hs.down++; } }
    else { c.vy-=20*dt; c.y+=c.vy*dt; c.g.position.y=c.y-1.75; c.g.rotation.x+=dt*2.2; const gy=heightAt(c.x,c.z); if(c.y-1.75<=gy){ spawnPart(c.x, gy+0.3, c.z, 0, 0.5, 0, { color:0x6a1a10, size:0.9, life:0.5, grav:-6, drag:2 }); c.g.rotation.x=0; endClimber(c, i); } } } }
export function updateHeliCrew(dt, now){ if(BOMBS.length) updateBombs(dt, now); if(CLIMBERS.length) updateClimbers(dt, now); }
export function clearHelis(){ for(const b of BOMBS) scene.remove(b.m); BOMBS.length=0; for(let i=CLIMBERS.length-1;i>=0;i--) endClimber(CLIMBERS[i], i); }
