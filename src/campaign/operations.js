// campaign/operations.js — Z83 · CAMPAIGN OPERATIONS — named operation per stage: briefing, radio chatter, scripted waves and a high-value objective
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAMP, OPERATIONS, OBJECTIVES, OBJ_REWARD } from '../../config.js';
import { ARENA, S, WAVE, _canvasTex, _pv, addCoins, addDiamonds, addScore, aoeDamage, artLockStrike, bigExplode, blocks, burst, cMod, camera, clampFieldXZ, decalScorch, deformCrater, diffHpMul, diffRewardMul, fireball, freeEnemyBar, getEnemyBar, heightAt, hitFlash, loopHpMul, loopRewardMul, makeFlag, panelTex, propTex, ringPulse, scene, sfx, showBanner, spawnPart, spawnSquad, unwave, vnTex } from '../hub.js';

// ===== Z83 · CAMPAIGN OPERATIONS — named operation per stage: briefing, radio chatter, scripted waves and a high-value objective =====
export let OBJ=null; export const OBJ_SCALE=1.5;   // objectives read as big, important structures
export function opFor(stage){ return OPERATIONS[(Math.max(1,stage)-1)%OPERATIONS.length]; }
export function objMod(key, d){ d=(d===undefined?1:d); return (OBJ && OBJ.alive && OBJ.def.mods[key]!=null) ? OBJ.def.mods[key] : d; }
export function radio(msg){ const el=document.getElementById('radio'); if(!el || !msg) return; el.querySelector('.rd-txt').textContent=msg;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(radio._t); radio._t=setTimeout(()=>el.classList.remove('show'), 4600); sfx('beep'); }
export function buildObjMesh(kind){
  const g=new THREE.Group(), M={}, mat=(k,o)=>M[k]||(M[k]=new THREE.MeshStandardMaterial(o));
  const steel=mat('st',{color:0x5a5e56,roughness:0.45,metalness:0.8,map:panelTex()}), dark=mat('dk',{color:0x24261f,roughness:0.6,metalness:0.5}), olive=mat('ol',{color:0x56603a,roughness:0.75,metalness:0.35,map:panelTex()});
  const conc=mat('cc',{color:0x8a877c,roughness:0.95,map:propTex('concrete')}), red=mat('rd',{color:0x220000,emissive:0xff2a1a,emissiveIntensity:2.6});
  const put=(geo,m,x,y,z,rx,ry,rz,par)=>{ const o=new THREE.Mesh(geo,m); o.position.set(x,y,z); o.rotation.set(rx||0,ry||0,rz||0); o.castShadow=true; o.receiveShadow=true; (par||g).add(o); return o; };
  const sbm=mat('sb',{color:0xbca57a,roughness:0.95,map:propTex('burlap')}), sbg=new RoundedBoxGeometry(1.1,0.42,0.55,2,0.14);
  const bags=(R,n)=>{ for(let k=0;k<n;k++){ const a=k/n*6.283; put(sbg, sbm, Math.cos(a)*R,0.22,Math.sin(a)*R, 0,-a+Math.PI/2,0); put(sbg, sbm, Math.cos(a+0.2)*R,0.62,Math.sin(a+0.2)*R, 0,-a-0.2+Math.PI/2,0); } };
  const ud={};
  if(kind==='depot'){
    for(const sz of [-1.35,1.35]){ put(new THREE.CylinderGeometry(1.15,1.15,5.2,22), mat('tk',{color:0xb8b2a0,roughness:0.5,metalness:0.6,map:propTex('drum')}), 0,1.55,sz, 0,0,Math.PI/2);   // twin fuel tanks
      for(const ex of [-1.8,1.8]) put(new THREE.BoxGeometry(0.35,0.95,1.3), dark, ex,0.47,sz);                                // cradles
      put(new THREE.CylinderGeometry(1.17,1.17,0.25,22), mat('hz',{color:0xffb020,emissive:0x442200,roughness:0.6}), 0,1.55,sz, 0,0,Math.PI/2); }   // hazard band
    put(new THREE.CylinderGeometry(0.12,0.12,2.7,8), dark, 0,2.75,0, Math.PI/2,0,0);                                       // manifold pipe
    for(let k=0;k<6;k++) put(new THREE.CylinderGeometry(0.36,0.36,1.05,14), mat('dr'+(k%3),{color:[0x8a2a1a,0x3a5a2a,0x2a3a5a][k%3],roughness:0.55,metalness:0.6,map:propTex('drum')}), -2.6+(k%3)*0.8,0.52,2.4+((k/3)|0)*0.8);
    ud.h=3.6;
  } else if(kind==='radio'){
    const H=11; for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const leg=put(new THREE.CylinderGeometry(0.07,0.1,H,6), steel, sx*0.7,H/2,sz*0.7); leg.rotation.set(-sz*0.05,0,sx*0.05); }
    for(let y=1;y<H;y+=1.4) for(const r of [0,Math.PI/2,Math.PI,Math.PI*1.5]){ const br=put(new THREE.BoxGeometry(0.05,0.05,1.9), steel, Math.sin(r)*0.62*(1-y/H*0.3),y,Math.cos(r)*0.62*(1-y/H*0.3), 0.7,r,0); }
    for(let k=0;k<3;k++) put(new THREE.CylinderGeometry(0.03,0.03,3.2,5), dark, (k-1)*0.3,H+1.6,0);
    put(new THREE.CylinderGeometry(0.5,0.5,0.1,14), dark, 0.7,H*0.7,0.5, Math.PI/2,0.6,0);                                // dish antenna
    const lt=put(new THREE.SphereGeometry(0.16,8,6), red, 0,H+3.25,0); ud.blink=lt;
    put(new RoundedBoxGeometry(2.4,1.8,2.0,2,0.1), olive, 2.2,0.9,0.4); put(new RoundedBoxGeometry(0.8,0.5,0.6,1,0.05), dark, 2.2,2.0,0.4);   // equipment shed + genset
    ud.h=H+3.8;
  } else if(kind==='radar'){
    put(new RoundedBoxGeometry(3.0,1.6,2.4,2,0.12), olive, 0,0.8,0); put(new THREE.CylinderGeometry(0.35,0.5,1.4,12), steel, 0,2.3,0);
    const head=new THREE.Group(); head.position.set(0,3.1,0); g.add(head);
    put(new THREE.SphereGeometry(2.0,24,10,0,Math.PI*2,0,0.8), mat('dish',{color:0xc8ccc4,roughness:0.4,metalness:0.6,side:THREE.DoubleSide}), 0,0.4,0.2, -1.25,0,0, head);
    put(new THREE.CylinderGeometry(0.06,0.06,1.6,6), dark, 0,0.5,1.2, 1.2,0,0, head); ud.spin=head;
    for(const sx of [-1.6,1.6]) put(new THREE.CylinderGeometry(0.05,0.05,4,5), dark, sx,2,-1.2);
    ud.blink=put(new THREE.SphereGeometry(0.12,8,6), red, 1.6,4.05,-1.2); ud.h=5.4;
  } else if(kind==='battery'){
    bags(4.2,14); ud.guns=[];
    for(const sx of [-1.5,1.5]){ const gg=new THREE.Group(); gg.position.set(sx,0,0); g.add(gg);
      put(new RoundedBoxGeometry(1.4,0.6,2.4,2,0.08), olive, 0,0.55,0, 0,0,0, gg);
      for(const wx of [-0.85,0.85]) put(new THREE.CylinderGeometry(0.5,0.5,0.3,14), dark, wx,0.5,-0.3, 0,0,Math.PI/2, gg);
      const tb=new THREE.Group(); tb.position.set(0,1.0,0.3); tb.rotation.x=-0.75; gg.add(tb);
      put(new THREE.CylinderGeometry(0.16,0.2,3.6,14), steel, 0,0,1.8, Math.PI/2,0,0, tb); put(new THREE.CylinderGeometry(0.26,0.26,0.4,14), dark, 0,0,3.6, Math.PI/2,0,0, tb);
      const mz=new THREE.Object3D(); mz.position.set(0,0,3.8); tb.add(mz); ud.guns.push({tb,mz}); }
    ud.h=4.2;
  } else {   // command bunker
    put(new RoundedBoxGeometry(6.0,2.2,5.0,3,0.3), conc, 0,1.1,0); put(new RoundedBoxGeometry(6.4,0.4,5.4,2,0.15), conc, 0,2.35,0);
    put(new THREE.BoxGeometry(3.2,0.28,0.1), mat('slit',{color:0x050505,roughness:1}), 0,1.5,2.52);                         // firing slit
    put(new THREE.BoxGeometry(5.6,0.06,4.6), mat('net',{color:0x4a5530,roughness:1,transparent:true,opacity:0.85,side:THREE.DoubleSide}), 0,2.65,0, 0.04,0,0.03);   // camo net
    for(const sx of [-2.2,2.2]) put(new THREE.CylinderGeometry(0.04,0.04,4.5,5), dark, sx,4.6,-1.8);
    ud.blink=put(new THREE.SphereGeometry(0.14,8,6), red, 2.2,6.9,-1.8);
    const vnF=makeFlag(vnTex(),1.6,1.05,1); vnF.material=new THREE.MeshStandardMaterial({ map:_canvasTex(160,100,(x,W,H)=>{ x.fillStyle='#2a2a2a'; x.fillRect(0,0,W,H); x.fillStyle='#c8202a'; x.fillRect(0,H*0.35,W,H*0.3); }), side:THREE.DoubleSide, roughness:0.9 });
    vnF.position.set(-2.2,6.2,-1.8); g.add(vnF); bags(4.6,16); ud.h=5.2;
  }
  g.userData=ud; return g;
}
export function clearObjective(){ if(!OBJ) return; unwave(OBJ.g); scene.remove(OBJ.g); freeEnemyBar(OBJ.bar); const i=blocks.indexOf(OBJ.b); if(i>=0) blocks.splice(i,1); OBJ=null; updateObjHUD(); }
export function buildObjective(){
  clearObjective(); const op=opFor(S.stage), def=OBJECTIVES[op.obj]; if(!def) return;
  let x=0, z=-ARENA*0.6;
  for(let t=0;t<50;t++){ const cx=(Math.random()*2-1)*ARENA*0.5, cz=-ARENA*(0.48+Math.random()*0.22); if(!blocks.some(b=>Math.hypot(b.x-cx,b.z-cz)<b.r+def.r+2)){ x=cx; z=cz; break; } }
  const g=buildObjMesh(op.obj); g.position.set(x, heightAt(x,z), z); g.rotation.y=Math.atan2(-x,-z); g.scale.setScalar(OBJ_SCALE); g.userData.h*=OBJ_SCALE; scene.add(g);
  const hp=Math.round(def.hp*loopHpMul()*diffHpMul()*(1+RAMP.hpPerStage*(S.stage-1)));
  const b={ mesh:g, x, z, r:def.r, hp, maxHp:hp, steel:false, loot:false, kind:'obj' }; blocks.push(b);
  OBJ={ def, kind:op.obj, op, b, x, z, alive:true, g, shellAt:performance.now()/1000+10, bar:getEnemyBar(), burn:0 };
  OBJ.bar.g.scale.setScalar(2.4); updateObjHUD();
}
export function damageObjective(b, dmg){
  if(!OBJ || !OBJ.alive || OBJ.b!==b) return; b.hp-=dmg; hitFlash(OBJ.g);
  if(Math.random()<0.6) spawnPart(b.x+(Math.random()-0.5)*b.r, heightAt(b.x,b.z)+1+Math.random()*2, b.z+(Math.random()-0.5)*b.r, (Math.random()-0.5)*6, 4, (Math.random()-0.5)*6, {color:0xffd890, size:0.25, life:0.3, grav:-14, drag:2});
  updateObjHUD(); if(b.hp<=0) destroyObjective();
}
export function destroyObjective(){
  const O=OBJ; O.alive=false; const i=blocks.indexOf(O.b); if(i>=0) blocks.splice(i,1); O.bar.g.visible=false;
  const pos={x:O.x,z:O.z}, now=performance.now()/1000;
  for(let k=0;k<4;k++) setTimeout(()=>{ if(S.mode!=='playing' && S.mode!=='paused') return; const q={x:O.x+(Math.random()-0.5)*O.b.r*1.6, z:O.z+(Math.random()-0.5)*O.b.r*1.6}; bigExplode(q, 0xff8a3a, 1.6+k*0.3); fireball(q, 1.4+k*0.3); S.shake=Math.min(4.5,S.shake+1.1); sfx('bigexplode'); }, k*260);
  deformCrater(O.x,O.z,O.b.r*0.9,0.6); decalScorch(O.x,O.z,O.b.r*2.2,1);
  aoeDamage(O.x,O.z,O.b.r+3,40,false,now,'HE');
  O.g.traverse(o=>{ if(o.isMesh && o.material && o.material.color){ o.material=o.material.clone(); o.material.color.multiplyScalar(0.25); o.material.emissive&&o.material.emissive.setHex(0); } });   // charred hulk
  O.g.rotation.z=(Math.random()-0.5)*0.25; O.g.rotation.x=(Math.random()-0.5)*0.2; O.g.scale.y=OBJ_SCALE*0.6;
  const R=OBJ_REWARD, mul=loopRewardMul()*diffRewardMul()*cMod('coinMul'), coins=Math.round((R.coin+R.coinPerStage*S.stage)*mul);
  addCoins(coins); addDiamonds(R.dia); addScore(R.score, new THREE.Vector3(O.x,4,O.z));
  showBanner('ĐÃ PHÁ MỤC TIÊU  +'+coins+' ◎  +'+R.dia+' ◆', '#ffd24a'); radio(O.op.win); sfx('levelup'); updateObjHUD();
}
export function updateObjective(dt, now){
  if(!OBJ) return; const O=OBJ, ud=O.g.userData, gy=heightAt(O.x,O.z);
  if(ud.spin && O.alive) ud.spin.rotation.y += dt*1.6;
  if(ud.blink) ud.blink.visible = O.alive && Math.floor(now*1.6)%2===0;
  if(!O.alive){ if(Math.random()<0.5) spawnPart(O.x+(Math.random()-0.5)*O.b.r, gy+1.5, O.z+(Math.random()-0.5)*O.b.r, 0.4, 2.2+Math.random(), 0.3, {color:0x15120f, size:2.4, life:2.2, smoke:true, grav:0.3, drag:0.8, grow:1.6, op:0.5});
    if(Math.random()<0.35) spawnPart(O.x+(Math.random()-0.5)*O.b.r, gy+1, O.z+(Math.random()-0.5)*O.b.r, 0, 2.5, 0, {tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:1.2, life:0.5, grav:2, drag:1.6, grow:0.6}); return; }
  const b=O.bar, f=Math.max(0,O.b.hp/O.b.maxHp); b.g.visible=true; b.g.position.set(O.x, gy+ud.h+1.2, O.z); b.g.quaternion.copy(camera.quaternion);
  b.fill.scale.x=Math.max(0.001,f); b.fill.position.x=-(1-f)*0.5; b.fill.material.color.setHex(0xffc040);
  if(Math.random()<0.03) ringPulse({x:O.x,z:O.z}, 0xffc040, O.b.r+1.5);                            // pulsing target marker
  if(O.kind==='battery' && S.mode==='playing' && now>O.shellAt && S.player){ O.shellAt=now+O.def.mods.shellEvery;
    const p=S.player; artLockStrike(p.pos.x+p.vel.x*0.5, p.pos.z+p.vel.z*0.5);
    for(const gn of ud.guns||[]){ gn.mz.getWorldPosition(_pv); spawnPart(_pv.x,_pv.y,_pv.z,0,4,0,{tex:'flash', color:0xfff0c0, size:3, life:0.1, grav:0, drag:0}); burst({x:_pv.x,z:_pv.z}, 0xcfc6b4, 5, 3, {y:_pv.y, life:1.2, size:1.6, smoke:true, grav:-0.3, drag:1.5, op:0.5}); gn.tb.position.z=0; }
    sfx('rocketlaunch', {x:O.x,z:O.z}); }
  for(const gn of ud.guns||[]) gn.tb.position.z += (0.3-gn.tb.position.z)*Math.min(1,dt*3);
}
export function updateObjHUD(){
  const el=document.getElementById('objChip'); if(!el) return;
  if(!OBJ){ el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.classList.toggle('done', !OBJ.alive);
  el.querySelector('.ob-name').textContent = OBJ.alive ? 'PHÁ '+(OBJ.def.vi||OBJ.def.name) : 'ĐÃ PHÁ '+(OBJ.def.vi||OBJ.def.name);
  el.querySelector('.ob-fx').textContent = OBJ.alive ? (OBJ.def.effectVi||OBJ.def.effect) : 'Đã nhận thưởng';
  el.querySelector('.ob-bar i').style.width = (OBJ.alive ? Math.max(0,OBJ.b.hp/OBJ.b.maxHp*100) : 0)+'%';
}
// scripted wave events for this operation (override the random roll)
export function scriptedEvent(){ const sc=opFor(S.stage).script[S.wave]; if(!sc) return false;
  const B={ ambush:['⚠ PHỤC KÍCH — BỘ BINH ÁP SÁT','#ffb070'], column:['ĐOÀN XE THIẾT GIÁP ĐANG TỚI','#ff8a4a'], pyro:['XE PHUN LỬA — GIỮ KHOẢNG CÁCH','#ff7a1c'], airraid:['⚠ KHÔNG KÍCH — TRỰC THĂNG ĐANG TỚI','#ff7ae0'] }[sc];
  WAVE.event=sc; WAVE.eventBanner=B[0]; WAVE.eventColor=B[1]; sfx('alarm'); return true; }
export function applyScriptedWave(now){
  const ev=WAVE.event, q=WAVE.spawnQueue, p=S.player;
  if(ev==='ambush' && p){ const n=S.stage>=3?3:2, a0=Math.random()*6.283;
    for(let k=0;k<n;k++){ const a=a0+k*(6.283/n), r=17; const [x,z]=clampFieldXZ(p.pos.x+Math.cos(a)*r, p.pos.z+Math.sin(a)*r, 4);
      setTimeout(()=>{ if(S.mode==='playing') spawnSquad({x,z}); }, 400+k*500); } }
  else if(ev==='column'){ const col=['heavy','grunt','gunner','grunt']; if(S.stage>=3) col.push('heavy','atgm'); if(S.stage>=5) col.push('shield','heavy');
    q.unshift(...col); WAVE.fixedEdge=Math.floor(Math.random()*4); WAVE.columnLeft=col.length; }
  else if(ev==='pyro'){ q.splice(0,0,'pyro','grunt','pyro'); if(S.stage>=4) q.push('pyro'); }
  else if(ev==='airraid'){ q.splice(0,0,'gunship'); q.splice(3,0,'gunship'); if(S.stage>=5) q.push('gunship'); }
}
