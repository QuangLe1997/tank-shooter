// world/depots.js — Z104 ENEMY DEPOTS in their half of the field: a WEAPON depot and a TANK depot (motor pool), each with a guard post.
//   Clear the guards, then put soldiers inside (drop them off, or they come on their own): after a few seconds the depot is OURS —
//   the weapon depot re-arms every soldier who enters (AT launcher + better rounds) and coughs up supplies, the motor pool's parked
//   tanks get a crew from our men and roll out as allied tanks that fight on their own.
import * as THREE from 'three';
import { DEPOT, ALLY_TANK } from '../../config.js';
import { ALLY_TANKS, ENEMY_DEFS, FT, GUN_DROP_DEF, MOBILE, S, TANK_SCALE, _canvasTex, addCoins, addScore, armAlly, bakeTank, blocks, buildTank, burst, cMod, campFlagTex, coverGeo, coverMat, diffRewardMul, dropPowerup, floatText, guardsLeft, heightAt, loopRewardMul, makeCoverMesh, makeFlag, radio, rallyFlagTex, scene, sfx, spawnAllyTank, spawnGuards, tip, unwave, zonesOf } from '../hub.js';

export const DEPOTS=[];
let _netTex=null;
function netTex(){ return _netTex||(_netTex=_canvasTex(64,64,(x,W)=>{ x.fillStyle='#5a5a3a'; x.fillRect(0,0,W,W); const cs=['#3e4428','#6e6a44','#2c3020'];
  for(let i=0;i<60;i++){ x.fillStyle=cs[i%3]; x.beginPath(); x.ellipse(Math.random()*W,Math.random()*W,3+Math.random()*6,2+Math.random()*4,Math.random()*3,0,7); x.fill(); } })); }
function addBlock(o){ blocks.push(o); return o; }
// sagging camouflage net (also used by the boot warm-up)
export function makeCamoNet(){ const net=new THREE.Mesh(new THREE.PlaneGeometry(8,6,6,4), new THREE.MeshStandardMaterial({ map:netTex(), roughness:0.95, side:THREE.DoubleSide, transparent:true, opacity:0.92 }));
  const pa=net.geometry.attributes.position; for(let i=0;i<pa.count;i++) pa.setZ(i, (Math.random()-0.5)*0.35 - Math.abs(pa.getX(i))*0.05); net.geometry.computeVertexNormals(); return net; }
function buildArms(q, g, at){ // camouflage net on four poles over weapon racks + ammo crates, sandbag horseshoe
  const net=makeCamoNet();
  const [nx,nz]=at(0,0); net.rotation.x=-Math.PI/2; net.rotation.z=q.ang; net.position.set(nx, heightAt(nx,nz)+2.6, nz); g.add(net);
  for(const [px,pz] of [[-3.8,-2.8],[3.8,-2.8],[-3.8,2.8],[3.8,2.8]]){ const [wx,wz]=at(px,pz); const m=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.6,5), coverMat('pipes')); m.position.set(wx, heightAt(wx,wz)+1.3, wz); g.add(m); }
  const rackM=new THREE.MeshStandardMaterial({ color:0x3a3426, roughness:0.85 }), gunM=new THREE.MeshStandardMaterial({ color:0x1c1c18, roughness:0.45, metalness:0.7 });
  for(const rx of [-1.6,1.6]){ const [wx,wz]=at(rx,-1.2), y=heightAt(wx,wz); const rack=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.2,0.25), rackM); rack.position.set(wx,y+0.6,wz); rack.rotation.y=q.ang; g.add(rack);
    for(let k=0;k<5;k++){ const gm=new THREE.Mesh(new THREE.BoxGeometry(0.07,1.0,0.12), gunM); const [gx,gz]=at(rx-1+k*0.5,-1.0); gm.position.set(gx,y+0.75,gz); gm.rotation.set(0.15,q.ang,0); g.add(gm); } }
  for(const [cx,cz] of [[-2.2,1.4],[0,1.8],[2.2,1.2],[0.9,-2.4]]){ const [wx,wz]=at(cx,cz); const m=makeCoverMesh('crates', true); m.scale.setScalar(0.7); m.position.set(wx,heightAt(wx,wz)-0.1,wz); m.rotation.y=q.ang+Math.random()*0.4; scene.add(m); g.userData.extra.push(m);
    addBlock({ mesh:m, x:wx, z:wz, r:1.1, hp:90, maxHp:90, steel:false, loot:false, kind:'crates' }); } }
function buildMotor(q, g, at){ // concrete revetment (U) + parked enemy tanks waiting for a crew
  for(const [wx0,wz0,ry] of [[-4.6,0,0],[4.6,0,0],[0,-4.4,Math.PI/2]]) for(let s=-1;s<=1;s++){ const lx = ry ? s*3 : wx0, lz = ry ? wz0 : s*3; const [wx,wz]=at(lx,lz);
    const m=new THREE.Mesh(coverGeo('concrete'), coverMat('concrete')); m.position.set(wx, heightAt(wx,wz)-0.12, wz); m.rotation.y=q.ang+(ry?0:Math.PI/2); m.castShadow=m.receiveShadow=true; scene.add(m); g.userData.extra.push(m);
    addBlock({ mesh:m, x:wx, z:wz, r:1.7, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'concrete' }); }
  const n=DEPOT.tanks[0]+((Math.random()*(DEPOT.tanks[1]-DEPOT.tanks[0]+1))|0), parked=[];
  for(let k=0;k<n;k++){ const def=ENEMY_DEFS[k%2?'heavy':'grunt'], m=buildTank(def.pal); bakeTank(m); m.scale.setScalar((k%2?1.15:1)*TANK_SCALE); const [px,pz]=at(n===1?0:(k?1.9:-1.9), 0.6);
    m.position.set(px, heightAt(px,pz), pz); m.rotation.y=q.ang+Math.PI; m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } }); scene.add(m); g.userData.extra.push(m);
    const b=addBlock({ mesh:m, x:px, z:pz, r:2.0, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'parked' }); parked.push({ mesh:m, x:px, z:pz, facing:q.ang+Math.PI, block:b, heavy:!!(k%2) }); }
  return parked; }
export function buildDepots(){ clearDepots();
  for(const kind of ['arms','motor']) for(const q of zonesOf(kind)){
    q.ang=Math.atan2(-q.x, -q.z)+Math.PI; const ca=Math.cos(q.ang), sa=Math.sin(q.ang), at=(lx,lz)=>[q.x+lx*ca+lz*sa, q.z-lx*sa+lz*ca];
    const g=new THREE.Group(); g.userData.extra=[]; scene.add(g);
    const parked = kind==='arms' ? (buildArms(q,g,at), []) : buildMotor(q,g,at);
    const [fx,fz]=at(-4.2,4.2), fy=heightAt(fx,fz); const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,6,6), coverMat('pipes')); pole.position.set(fx,fy+3,fz); g.add(pole);
    const flag=makeFlag(campFlagTex(),1.7,1.1,1); flag.position.set(fx,fy+5.4,fz); g.add(flag);
    const ring=new THREE.Mesh(new THREE.RingGeometry(q.r-0.4, q.r, 56, 1, 0, 0.001), new THREE.MeshBasicMaterial({ color:0x9be04a, transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    ring.rotation.x=-Math.PI/2; ring.position.set(q.x, heightAt(q.x,q.z)+0.09, q.z); ring.visible=false; g.add(ring);
    const G=MOBILE?DEPOT.guardsMobile:DEPOT.guards; spawnGuards(q, G[0]+((Math.random()*(G[1]-G[0]+1))|0), 1);
    DEPOTS.push({ kind, q, x:q.x, z:q.z, g, flag, flagPos:[fx,fy,fz], ring, parked, state:'held', cap:0, seenAt:0 }); } }
export function clearDepots(){ for(const d of DEPOTS){ unwave(d.g); scene.remove(d.g); for(const m of d.g.userData.extra) scene.remove(m); } DEPOTS.length=0; }
function soldiersIn(d){ let n=0; for(const a of FT) if(Math.hypot(a.pos.x-d.x, a.pos.z-d.z) < d.q.r*0.8) n++; return n; }
// an open depot (guards down) calls idle soldiers within reach to come and take it — then it keeps arming / crewing
export function depotJob(a){ let best=null, bd=52;
  for(const d of DEPOTS){ const want = d.state==='open' || (d.state==='ours' && ((d.kind==='arms' && !a.at) || (d.kind==='motor' && d.parked.length && ALLY_TANKS.length<ALLY_TANK.cap)));
    if(!want) continue; const dd=Math.hypot(d.x-a.pos.x, d.z-a.pos.z); if(dd<bd){ bd=dd; const j=Math.random()*6.283, r=Math.random()*d.q.r*0.4; best={ kind:'capture', x:d.x+Math.cos(j)*r, z:d.z+Math.sin(j)*r, ref:d }; } }
  return best; }
function captureDepot(d){ d.state='ours'; d.ring.visible=false;
  unwave(d.flag); d.g.remove(d.flag); const fl=makeFlag(rallyFlagTex(),1.7,1.1,1); fl.position.set(d.flagPos[0], d.flagPos[1]+5.4, d.flagPos[2]); d.g.add(fl); d.flag=fl;   // our colours go up
  const R=Math.round; addScore(R(DEPOT.score*loopRewardMul()), new THREE.Vector3(d.x,5,d.z)); addCoins(R(DEPOT.coin*(1+(S.stage-1)*0.25)*loopRewardMul()*diffRewardMul()*cMod('coinMul')));
  floatText(d.kind==='arms'?'ĐÃ CHIẾM KHO VŨ KHÍ':'ĐÃ CHIẾM KHO XE TĂNG', '#9be04a', new THREE.Vector3(d.x,6,d.z), 24); sfx('levelup');
  if(d.kind==='arms'){ radio('Tổ bộ binh: Kho vũ khí đã về tay ta — anh em nhận súng chống tăng!'); dropPowerup({x:d.x,z:d.z}, 1, GUN_DROP_DEF); dropPowerup({x:d.x,z:d.z}, 1); }   // a new gun + supplies
  else radio('Tổ bộ binh: Đã chiếm bãi xe — kíp lái đang nổ máy xe tăng địch!'); }
export function updateDepots(dt, now){ const p=S.player; if(!p) return;
  for(const d of DEPOTS){
    if(d.state==='held'){ if(Math.hypot(p.pos.x-d.x, p.pos.z-d.z)<40 && now>d.seenAt){ d.seenAt=now+1e9; tip('depot'); }
      if(guardsLeft(d.q)===0){ d.state='open'; d.ring.visible=true; floatText((d.kind==='arms'?'KHO VŨ KHÍ':'KHO XE TĂNG')+' BỎ NGỎ — THẢ LÍNH VÀO CHIẾM', '#9be04a', new THREE.Vector3(d.x,6,d.z), 18);
        radio('SCH: Lính canh '+(d.kind==='arms'?'kho vũ khí':'bãi xe tăng')+' đã bị diệt. Đưa bộ binh vào chiếm!'); } continue; }
    if(d.state==='open'){ const n=soldiersIn(d); d.cap = n ? Math.min(DEPOT.capT, d.cap+dt*Math.min(3, 0.6+n*0.4)) : Math.max(0, d.cap-dt*0.5);
      const f=d.cap/DEPOT.capT; d.ring.geometry.dispose(); d.ring.geometry=new THREE.RingGeometry(d.q.r-0.4, d.q.r, 56, 1, 0, Math.max(0.001, f*Math.PI*2)); d.ring.material.opacity=0.6+0.3*Math.sin(now*8);
      if(f>=1) captureDepot(d); continue; }
    // ours: arm whoever walks in; crew the parked tanks one soldier at a time
    for(const a of FT.slice()){ if(Math.hypot(a.pos.x-d.x, a.pos.z-d.z) > d.q.r*0.8) continue;
      if(d.kind==='arms' && !a.at){ armAlly(a); burst({x:a.pos.x,z:a.pos.z}, 0x9be04a, 4, 3, {y:heightAt(a.pos.x,a.pos.z)+1.6, life:0.4, size:0.35, grav:-6, drag:2, up:3}); floatText('NHẬN SÚNG CHỐNG TĂNG', '#9be04a', {x:a.pos.x, y:heightAt(a.pos.x,a.pos.z)+3.2, z:a.pos.z}, 13); }
      if(d.kind==='motor' && d.parked.length && ALLY_TANKS.length<ALLY_TANK.cap){ const pk=d.parked.shift(); const bi=blocks.indexOf(pk.block); if(bi>=0) blocks.splice(bi,1); scene.remove(pk.mesh);
        const i=FT.indexOf(a); FT.splice(i,1); scene.remove(a.g); scene.remove(a.bar);
        spawnAllyTank(pk.x, pk.z, pk.facing, pk.heavy); floatText('LÍNH TA ĐÃ LÁI XE ĐỊCH', '#9be04a', new THREE.Vector3(pk.x,4,pk.z), 18); sfx('levelup'); tip('allytank'); } } } }
