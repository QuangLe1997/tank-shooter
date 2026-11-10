// world/pow.js — Z104 POW STOCKADES along our fence: our captured men behind barbed wire, enemy guards around them.
//   Kill the guards, then drive the tank to the gate (or walk a soldier in): the prisoners climb onto the hull — or, when every seat
//   is taken, pick up a rifle and follow you into the fight.
import * as THREE from 'three';
import { POW, TROOPS } from '../../config.js';
import { FT, MOBILE, RIDER, S, addCoins, addScore, burst, cMod, campMats, diffRewardMul, floatText, guardsLeft, heightAt, loopRewardMul, makeSoldierMesh, makeTent, radio, riders, scene, sfx, spawnAlly, spawnGuards, spawnRider, svgBadgeTex, tip, updateCrewBtn, zonesOf } from '../hub.js';

export const POWS=[];
let _wireMat=null;
export function wireMat(){ return _wireMat||(_wireMat=new THREE.MeshStandardMaterial({ color:0x6a6a62, roughness:0.5, metalness:0.8 })); }
// square stockade: steel pickets + three strands of wire, a gate gap facing the field, a tent, kneeling prisoners
function buildStockade(q){ const g=new THREE.Group(); scene.add(g); const R=q.r*0.62, gy=heightAt(q.x,q.z), M=campMats(), W=wireMat();
  const gateA=Math.atan2(-q.x, -q.z);                                                      // the gate looks toward the middle of the field
  const corners=[[-R,-R],[R,-R],[R,R],[-R,R]], posts=[];
  for(let k=0;k<4;k++){ const [ax,az]=corners[k], [bx,bz]=corners[(k+1)%4]; for(let s=0;s<=4;s++){ const u=s/4; posts.push([ax+(bx-ax)*u, az+(bz-az)*u]); } }
  const ca=Math.cos(gateA), sa=Math.sin(gateA), rot=(x,z)=>[q.x+x*ca+z*sa, q.z-x*sa+z*ca];
  const postGeo=new THREE.CylinderGeometry(0.06,0.07,2.3,5);
  let prev=null;
  for(let i=0;i<posts.length;i++){ const [lx,lz]=posts[i]; const gate = lz>R-0.01 && Math.abs(lx)<R*0.3;   // gap in the front side = the gate
    const [wx,wz]=rot(lx,lz), y=heightAt(wx,wz); if(!gate){ const m=new THREE.Mesh(postGeo, W); m.position.set(wx, y+1.15, wz); g.add(m); }
    if(prev && !gate && !prev.gate){ const dx=wx-prev.x, dz=wz-prev.z, L=Math.hypot(dx,dz);
      for(const h of [0.55,1.25,1.95]){ const s=new THREE.Mesh(new THREE.BoxGeometry(0.025,0.025,L), W); s.position.set((wx+prev.x)/2, (y+prev.y)/2+h, (wz+prev.z)/2); s.rotation.y=Math.atan2(dx,dz); g.add(s); } }
    prev={ x:wx, z:wz, y, gate }; }
  const tent=makeTent(); const [tx,tz]=rot(0,-R*0.45); tent.position.set(tx, heightAt(tx,tz)-0.03, tz); tent.rotation.y=gateA; g.add(tent);
  const men=[]; const n=POW.prisoners[0]+((Math.random()*(POW.prisoners[1]-POW.prisoners[0]+1))|0);
  for(let k=0;k<n;k++){ const s=makeSoldierMesh(); s.scale.setScalar(TROOPS.look.scale); const [px,pz]=rot((k-(n-1)/2)*1.5, R*0.15+(k%2)*0.8);
    s.position.set(px, heightAt(px,pz), pz); s.rotation.y=gateA+Math.PI+(Math.random()-0.5)*0.6; kneel(s, true); s.userData.gun.visible=false; g.add(s); men.push(s); }
  const badge=new THREE.Sprite(new THREE.SpriteMaterial({ map:svgBadgeTex('team','#ffcf5a'), transparent:true, depthWrite:false })); badge.scale.set(2.4,2.4,1); badge.position.set(q.x, gy+5.4, q.z); badge.userData.live=true; g.add(badge);
  const gate=rot(0, R+1.5);
  return { g, men, badge, gate, gateA }; }
function kneel(s, on){ const u=s.userData, L=u.legs; if(on){ u.up.position.y=0.5; L[0].hip.rotation.x=-1.35; L[0].knee.rotation.x=1.35; L[1].hip.rotation.x=0.25; L[1].knee.rotation.x=1.7; u.up.rotation.x=0.25; }
  else { u.up.position.y=0.74; u.up.rotation.x=0; for(const l of L){ l.hip.rotation.x=0; l.knee.rotation.x=0; } } }
export function buildPOWs(){ clearPOWs();
  for(const q of zonesOf('pow')){ const s=buildStockade(q), G=MOBILE?POW.guardsMobile:POW.guards, n=G[0]+((Math.random()*(G[1]-G[0]+1))|0);
    spawnGuards(q, n, S.stage>=3?1:0);
    POWS.push(Object.assign(s, { q, x:q.x, z:q.z, state:'held', seenAt:0 })); } }
export function clearPOWs(){ for(const w of POWS) scene.remove(w.g); POWS.length=0; }
// free them: seats on the hull first, everyone else becomes a rifleman on foot
function liberate(w){ w.state='free'; const p=S.player; let boarded=0, onFoot=0;
  for(const s of w.men){ const wp=s.position; burst({x:wp.x,z:wp.z}, 0x9be04a, 4, 3, {y:heightAt(wp.x,wp.z)+1.2, life:0.5, size:0.4, grav:-6, drag:2, up:3}); w.g.remove(s);
    if(riders.length<RIDER.cap && Math.hypot(p.pos.x-wp.x, p.pos.z-wp.z)<POW.freeR+4){ spawnRider(); boarded++; }
    else { spawnAlly(wp.x, wp.z, w.gateA); const a=FT[FT.length-1]; a.hp=a.maxHp*0.6; onFoot++; } }
  w.men.length=0; w.badge.material.map=svgBadgeTex('team','#9be04a'); w.badge.material.needsUpdate=true; w.badge.material.opacity=0.6;
  const R=Math.round; addScore(R(POW.score*loopRewardMul()), new THREE.Vector3(w.x,5,w.z)); addCoins(R(POW.coin*(1+(S.stage-1)*0.25)*loopRewardMul()*diffRewardMul()*cMod('coinMul')));
  floatText('GIẢI CỨU '+(boarded+onFoot)+' TÙ BINH', '#9be04a', new THREE.Vector3(w.x,6,w.z), 24); sfx('levelup');
  radio('Tù binh: Cảm ơn chỉ huy! '+(boarded?boarded+' người lên xe':'')+(boarded&&onFoot?', ':'')+(onFoot?onFoot+' người cầm súng theo anh':'')+'!'); updateCrewBtn(); }
// an open stockade (guards down) asks a nearby idle soldier to walk in and cut the wire
export function powJob(a){ let best=null, bd=48; for(const w of POWS){ if(w.state!=='open') continue; const d=Math.hypot(w.gate[0]-a.pos.x, w.gate[1]-a.pos.z); if(d<bd){ bd=d; best={ kind:'free', x:w.x, z:w.z, ref:w }; } } return best; }
export function updatePOWs(dt, now){ const p=S.player; if(!p) return;
  for(const w of POWS){ if(w.state==='free') continue;
    w.badge.position.y=heightAt(w.x,w.z)+5.4+Math.sin(now*2.2+w.x)*0.18;
    if(w.state==='held'){ const dp=Math.hypot(p.pos.x-w.x, p.pos.z-w.z); if(dp<34 && now>w.seenAt){ w.seenAt=now+1e9; tip('pow'); radio('SCH: Có trại giam lính ta phía trước — diệt lính canh rồi áp sát cổng để giải cứu!'); }
      if(guardsLeft(w.q)===0){ w.state='open'; w.badge.material.map=svgBadgeTex('team','#9be04a'); w.badge.material.needsUpdate=true; floatText('LÍNH CANH ĐÃ BỊ DIỆT — ÁP SÁT CỔNG', '#9be04a', new THREE.Vector3(w.x,6,w.z), 18); } continue; }
    w.badge.material.opacity=0.65+0.35*Math.sin(now*6);                                     // open: the badge blinks until someone reaches the gate
    const near=Math.hypot(p.pos.x-w.gate[0], p.pos.z-w.gate[1])<POW.freeR || Math.hypot(p.pos.x-w.x, p.pos.z-w.z)<POW.freeR;
    const walkIn=FT.some(a=>Math.hypot(a.pos.x-w.x, a.pos.z-w.z)<w.q.r*0.7);
    if(near || walkIn) liberate(w); } }
