// world/depots.js — Z104 ENEMY WEAPON DEPOTS in their half of the field, each with a guard post (no-tanks: the motor pool is gone).
//   Clear the guards, then put soldiers inside (drop them off, or they come on their own): after a few seconds the depot is OURS —
//   it re-arms every soldier who enters (AT launcher + better rounds) and coughs up supplies.
import * as THREE from 'three';
import { DEPOT, WORLD_FLAGS } from '../../config.js';
import { FT, GUN_DROP_DEF, MOBILE, S, _canvasTex, placeScan, addScore, armAlly, blocks, burst, campFlagTex, coverMat, dropPowerup, floatText, guardsLeft, heightAt, loopRewardMul, makeCoverMesh, makeFlag, radio, rallyFlagTex, scene, sfx, spawnGuards, tip, unwave, zonesOf, blPulse, holoArc, holoRing } from '../hub.js';

export const DEPOTS=[];
let _netTex=null;
function netTex(){ return _netTex||(_netTex=_canvasTex(64,64,(x,W)=>{ x.fillStyle='#5a5a3a'; x.fillRect(0,0,W,W); const cs=['#3e4428','#6e6a44','#2c3020'];
  for(let i=0;i<60;i++){ x.fillStyle=cs[i%3]; x.beginPath(); x.ellipse(Math.random()*W,Math.random()*W,3+Math.random()*6,2+Math.random()*4,Math.random()*3,0,7); x.fill(); } })); }
function addBlock(o){ blocks.push(o); return o; }
// sagging camouflage net (also used by the boot warm-up)
export function makeCamoNet(){ const net=new THREE.Mesh(new THREE.PlaneGeometry(8,6,6,4), new THREE.MeshStandardMaterial({ map:netTex(), roughness:0.95, side:THREE.DoubleSide, transparent:true, opacity:0.92 }));
  const pa=net.geometry.attributes.position; for(let i=0;i<pa.count;i++) pa.setZ(i, (Math.random()-0.5)*0.35 - Math.abs(pa.getX(i))*0.05); net.geometry.computeVertexNormals(); return net; }
function buildArms(q, g, at){ // camouflage net on four poles over weapon racks + ammo crates, sandbag horseshoe
  const net=makeCamoNet(), roof=[net];
  const [nx,nz]=at(0,0); net.rotation.x=-Math.PI/2; net.rotation.z=q.ang; net.position.set(nx, heightAt(nx,nz)+2.6, nz); g.add(net);
  for(const [px,pz] of [[-3.8,-2.8],[3.8,-2.8],[-3.8,2.8],[3.8,2.8]]){ const [wx,wz]=at(px,pz); const m=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.6,5), coverMat('pipes')); m.position.set(wx, heightAt(wx,wz)+1.3, wz); g.add(m); roof.push(m); }
  for(const rx of [-1.6,1.6]){ const [wx,wz]=at(rx,-1.2), y=heightAt(wx,wz); const cr=makeCoverMesh('crates', true); cr.scale.setScalar(0.6); cr.position.set(wx,y-0.1,wz); cr.rotation.y=q.ang; g.add(cr); }   // Z429 stacked crates where the weapon racks stood (they read as black boxes)
  placeScan(g, 'canopy', nx, heightAt(nx,nz), nz, q.ang, 9.6, roof);   // Z429 the camouflage canopy on its own poles over the stores (the drawn net and poles until it is in)
  for(const [cx,cz] of [[-2.2,1.4],[0,1.8],[2.2,1.2],[0.9,-2.4]]){ const [wx,wz]=at(cx,cz); const m=makeCoverMesh('crates', true); m.scale.setScalar(0.7); m.position.set(wx,heightAt(wx,wz)-0.1,wz); m.rotation.y=q.ang+Math.random()*0.4; scene.add(m); g.userData.extra.push(m);
    addBlock({ mesh:m, x:wx, z:wz, r:1.1, hp:90, maxHp:90, steel:false, loot:false, kind:'crates' }); } }
export function buildDepots(){ clearDepots();
  for(const kind of ['arms']) for(const q of zonesOf(kind)){
    q.ang=Math.atan2(-q.x, -q.z)+Math.PI; const ca=Math.cos(q.ang), sa=Math.sin(q.ang), at=(lx,lz)=>[q.x+lx*ca+lz*sa, q.z-lx*sa+lz*ca];
    const g=new THREE.Group(); g.userData.extra=[]; scene.add(g);
    buildArms(q,g,at); const parked = [];
    const [fx,fz]=at(-4.2,4.2), fy=heightAt(fx,fz); const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,6,6), coverMat('pipes')); pole.position.set(fx,fy+3,fz); if(WORLD_FLAGS.on) g.add(pole);
    const flag=makeFlag(campFlagTex(),1.7,1.1,1); flag.position.set(fx,fy+5.4,fz); g.add(flag);
    const ring=holoRing(q.r, { kind:'ally', arc:0 }); ring.position.set(q.x, heightAt(q.x,q.z)+0.09, q.z); ring.visible=false; g.add(ring);   // Z318 the capture shows as the lit arc of an ally-green ring
    const G=MOBILE?DEPOT.guardsMobile:DEPOT.guards; spawnGuards(q, G[0]+((Math.random()*(G[1]-G[0]+1))|0), 1);
    DEPOTS.push({ kind, q, x:q.x, z:q.z, g, flag, flagPos:[fx,fy,fz], ring, parked, state:'held', cap:0, seenAt:0 }); } }
export function clearDepots(){ for(const d of DEPOTS){ unwave(d.g); scene.remove(d.g); for(const m of d.g.userData.extra) scene.remove(m); } DEPOTS.length=0; }
function soldiersIn(d){ let n=0; for(const a of FT) if(Math.hypot(a.pos.x-d.x, a.pos.z-d.z) < d.q.r*0.8) n++; return n; }
// an open depot (guards down) calls idle soldiers within reach to come and take it — then it keeps arming / crewing
export function depotJob(a){ let best=null, bd=52;
  for(const d of DEPOTS){ const want = d.state==='open' || (d.state==='ours' && ((d.kind==='arms' && !a.at)));
    if(!want) continue; const dd=Math.hypot(d.x-a.pos.x, d.z-a.pos.z); if(dd<bd){ bd=dd; const j=Math.random()*6.283, r=Math.random()*d.q.r*0.4; best={ kind:'capture', x:d.x+Math.cos(j)*r, z:d.z+Math.sin(j)*r, ref:d }; } }
  return best; }
function captureDepot(d){ d.state='ours'; d.ring.visible=false;
  unwave(d.flag); d.g.remove(d.flag); const fl=makeFlag(rallyFlagTex(),1.7,1.1,1); fl.position.set(d.flagPos[0], d.flagPos[1]+5.4, d.flagPos[2]); d.g.add(fl); d.flag=fl;   // our colours go up
  const R=Math.round; addScore(R(DEPOT.score*loopRewardMul()), new THREE.Vector3(d.x,5,d.z));
  floatText('ĐÃ CHIẾM KHO VŨ KHÍ', '#9be04a', new THREE.Vector3(d.x,6,d.z), 24); sfx('levelup');
  radio('Tổ bộ binh: Kho vũ khí đã về tay ta — anh em nhận súng chống tăng!'); dropPowerup({x:d.x,z:d.z}, 1, GUN_DROP_DEF); dropPowerup({x:d.x,z:d.z}, 1); }   // a new gun + supplies
export function updateDepots(dt, now){ const p=S.player; if(!p) return;
  for(const d of DEPOTS){
    if(d.state==='held'){ if(Math.hypot(p.pos.x-d.x, p.pos.z-d.z)<40 && now>d.seenAt){ d.seenAt=now+1e9; tip('depot'); }
      if(guardsLeft(d.q)===0){ d.state='open'; d.ring.visible=true; floatText('KHO VŨ KHÍ BỎ NGỎ — THẢ LÍNH VÀO CHIẾM', '#9be04a', new THREE.Vector3(d.x,6,d.z), 18);
        radio('SCH: Lính canh kho vũ khí đã bị diệt. Đưa bộ binh vào chiếm!'); } continue; }
    if(d.state==='open'){ const n=soldiersIn(d); d.cap = n ? Math.min(DEPOT.capT, d.cap+dt*Math.min(3, 0.6+n*0.4)) : Math.max(0, d.cap-dt*0.5);
      const f=d.cap/DEPOT.capT; holoArc(d.ring, f); d.ring.material.opacity=blPulse(now, 'warn', 0.6);
      if(f>=1) captureDepot(d); continue; }
    // ours: arm whoever walks in; crew the parked tanks one soldier at a time
    for(const a of FT.slice()){ if(Math.hypot(a.pos.x-d.x, a.pos.z-d.z) > d.q.r*0.8) continue;
      if(d.kind==='arms' && !a.at){ armAlly(a); burst({x:a.pos.x,z:a.pos.z}, 0x9be04a, 4, 3, {y:heightAt(a.pos.x,a.pos.z)+1.6, life:0.4, size:0.35, grav:-6, drag:2, up:3}); floatText('NHẬN SÚNG CHỐNG TĂNG', '#9be04a', {x:a.pos.x, y:heightAt(a.pos.x,a.pos.z)+3.2, z:a.pos.z}, 13); }
 } } }
