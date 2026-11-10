// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { EQUIP } from '../../config.js';
import { ARENA, GLOW, S, addScore, apsIntercept, bigExplode, blocks, bullets, core, damageBlock, damageCore, damagePlayer, damageSoldier, decalScorch, dropBeam, enemies, floatText, heightAt, hitsHull, inBlock, inSmoke, recycleBullet, scene, sfx, soldiers, spawnPart, wrapAngle } from '../hub.js';

// ===== ENEMY ROCKETS & GUIDED MISSILES — real objects in flight: dodge them, SHOOT THEM DOWN, or blind them with smoke =====
export const EMIS=[], _emPool=[];
export let _emMats=null;
export function makeEnemyRocket(){
  if(!_emMats) _emMats={ body:new THREE.MeshStandardMaterial({color:0x4a5034,roughness:0.55,metalness:0.5}), war:new THREE.MeshStandardMaterial({color:0x2a2a24,roughness:0.5,metalness:0.6}),
    glow:new THREE.SpriteMaterial({map:GLOW,color:0xffb060,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}) };
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.9,10), _emMats.body); b.rotation.x=Math.PI/2; g.add(b);
  const n=new THREE.Mesh(new THREE.ConeGeometry(0.2,0.5,10), _emMats.war); n.rotation.x=Math.PI/2; n.position.z=0.68; g.add(n);
  for(let k=0;k<4;k++){ const f=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.34,0.24), _emMats.war); f.position.z=-0.38; f.rotation.z=k*Math.PI/2; f.position.x=Math.sin(k*Math.PI/2)*0.12; f.position.y=Math.cos(k*Math.PI/2)*0.12; g.add(f); }
  const s=new THREE.Sprite(_emMats.glow); s.scale.setScalar(1.3); s.position.z=-0.6; g.add(s);
  g.rotation.order='YXZ'; scene.add(g); return g;
}
export function launchEnemyMissile(x, y, z, ang, o){
  const m=_emPool.pop()||makeEnemyRocket(); m.visible=true; m.scale.setScalar(o.kind==='atgm'?1.35:(o.kind==='heli'?0.9:1));
  EMIS.push({ m, x, y, z, ang, pitch:0, speed:o.speed, dmg:o.dmg, aoe:o.aoe||2.5, guided:o.guided||0, life:o.life||3, kind:o.kind||'rpg', vy:o.vy||0, wire:o.wire||null, src:o.src||null });
  sfx('rocketlaunch', {x,z});
}
export function blowMissile(i, how){
  const r=EMIS[i], now=performance.now()/1000, gy=heightAt(r.x,r.z);
  if(how==='shot'){ bigExplode({x:r.x,z:r.z}, 0xffd27a, 0.7); floatText('ĐÃ ĐÁNH CHẶN', '#9fe8ff', {x:r.x,y:gy+2.6,z:r.z}, 15); addScore(40, new THREE.Vector3(r.x,2,r.z)); }
  else { bigExplode({x:r.x,z:r.z}, 0xff8a3a, r.aoe/3); decalScorch(r.x, r.z, r.aoe*0.6, 0.8);
    if(how!=='direct'){ const p=S.player, dd=Math.hypot(p.pos.x-r.x, p.pos.z-r.z); if(dd<r.aoe+p.radius) damagePlayer(r.dmg*0.55*(1-dd/(r.aoe+p.radius)*0.6), now, p.pos.x-r.x, p.pos.z-r.z); }
    for(const s of soldiers.slice()) if(Math.hypot(s.pos.x-r.x,s.pos.z-r.z)<r.aoe) damageSoldier(s, r.dmg*0.6); }
  if(r.wire){ dropBeam(r.wire); r.wire=null; }
  r.m.visible=false; _emPool.push(r.m); EMIS.splice(i,1);
}
export function updateEnemyMissiles(dt, now){
  const p=S.player; if(!p) return; const smoked = inSmoke(now);
  for(let i=EMIS.length-1;i>=0;i--){ const r=EMIS[i]; r.life-=dt;
    const gy=heightAt(r.x,r.z);
    if(r.guided && !smoked){ const want=Math.atan2(p.pos.x-r.x, p.pos.z-r.z); r.ang=wrapAngle(r.ang + Math.max(-r.guided*dt, Math.min(r.guided*dt, wrapAngle(want-r.ang)))); r.y += ((gy+1.5)-r.y)*Math.min(1,dt*2.5); }
    else if(r.guided && smoked){ r.ang += Math.sin(now*9+i)*dt*1.6; r.y += Math.sin(now*7+i)*dt*1.2; }    // SMOKE: the seeker loses you — it wobbles off course
    else { r.vy -= 4*dt; r.y += r.vy*dt; }
    const sx=Math.sin(r.ang), sz=Math.cos(r.ang); r.x+=sx*r.speed*dt; r.z+=sz*r.speed*dt;
    r.m.position.set(r.x, r.y, r.z); r.m.rotation.y=r.ang; r.m.rotation.x=-Math.atan2(r.vy||0, r.speed)*0.6;
    if(Math.random()<0.85) spawnPart(r.x-sx*0.7, r.y, r.z-sz*0.7, (Math.random()-0.5)*0.8, 0.35, (Math.random()-0.5)*0.8, {color:0xcfc6b4, size:0.7, life:0.7, smoke:true, grav:0.25, drag:1.6, grow:1.2, op:0.45});
    if(Math.random()<0.6) spawnPart(r.x-sx*0.6, r.y, r.z-sz*0.6, -sx*3, 0, -sz*3, {color:0xffb050, color2:0xff4a10, size:0.45, life:0.12, grav:0, drag:4});
    if(r.wire){ r.wire.visible=true; const s0=r.src; if(s0&&enemies.includes(s0)){ const L=r.wire.geometry.attributes.position; L.setXYZ(0,s0.pos.x,heightAt(s0.pos.x,s0.pos.z)+1.9,s0.pos.z); L.setXYZ(1,r.x,r.y,r.z); L.needsUpdate=true; } else r.wire.visible=false; }
    let gone=null;
    for(let j=bullets.length-1;j>=0;j--){ const b=bullets[j]; if(b.owner!=='p') continue; if((b.x-r.x)**2+(b.z-r.z)**2 < (b.r+0.85)**2){ if(b.pierce>0) b.pierce--; else recycleBullet(j); gone='shot'; break; } }   // SHOOT IT DOWN
    if(!gone && p.apsCharges>0 && now<(p.apsUntil||0) && Math.hypot(r.x-p.pos.x, r.z-p.pos.z) < EQUIP.aps.radius){ apsIntercept(r.x, r.y, r.z); gone='shot'; }   // APS hard-kill
    if(!gone && hitsHull(p, r.x, r.z, 0.3) && r.y < gy+3.2){ damagePlayer(r.dmg, now, sx, sz); gone='direct'; }
    if(!gone) for(const bl of blocks){ if(inBlock(bl, r.x, r.z, 0.3)){ if(bl.kind!=='obj') damageBlock(bl, r.dmg*1.2); gone='hit'; break; } }
    if(!gone && core && Math.hypot(core.pos.x-r.x, core.pos.z-r.z) < core.r){ damageCore(r.dmg*0.8); gone='hit'; }
    if(!gone && (r.y<=gy+0.2 || r.life<=0 || Math.abs(r.x)>ARENA || Math.abs(r.z)>ARENA)) gone='ground';
    if(gone) blowMissile(i, gone);
  }
}
export function clearEnemyMissiles(){ for(const r of EMIS){ r.m.visible=false; _emPool.push(r.m); if(r.wire) dropBeam(r.wire); } EMIS.length=0; }
