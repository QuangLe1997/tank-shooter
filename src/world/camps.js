// world/camps.js — Z90 · ENEMY TROOP CAMPS — a Quonset barracks, canvas tents, sandbag ring, flag & cookfire; squads keep pouring out of the hut until you level it
import * as THREE from 'three';
import { CAMP, LOOT } from '../../config.js';
import { ARENA, COVER_HP, COVER_K, MOBILE, S, SUPPLY, WAVE, _canvasTex, addCoins, addLootBeacon, addScore, bigExplode, blocks, buildTower, burst, cMod, campLost, clearSite, coverGeo, coverMat, decalScorch, deformCrater, diffHpMul, diffRewardMul, dropPowerup, enemies, fireball, flashMat, floatText, haptic, heightAt, hitsHull, inField, inZone, loopHpMul, loopRewardMul, makeCoverMesh, makeFlag, propTex, radio, registerCampBase, scene, sfx, siteOk, spawnDebris, spawnEnemy, spawnPart, tip, towers, unwave } from '../hub.js';

// ===== Z90 · ENEMY TROOP CAMPS — a Quonset barracks, canvas tents, sandbag ring, flag & cookfire; squads keep pouring out of the hut until you level it =====
export const CAMPS=[], TENTS=[]; export const CAMP_K=1.35;   // Z194 the compound at the tanks' scale
export let _campMats=null;
export function campMats(){ if(_campMats) return _campMats;
  const tin=propTex('drum').clone(); tin.wrapS=tin.wrapT=THREE.RepeatWrapping; tin.repeat.set(6,2); tin.needsUpdate=true;
  const canvasT=_canvasTex(64,64,(x,W)=>{ x.fillStyle='#8a7c56'; x.fillRect(0,0,W,W); for(let i=0;i<900;i++){ const v=(110+Math.random()*60)|0; x.fillStyle='rgba('+v+','+(v-8)+','+(v-30)+',0.35)'; x.fillRect(Math.random()*W,Math.random()*W,2,1); }
    x.strokeStyle='rgba(60,50,30,0.5)'; x.lineWidth=1; for(let k=8;k<W;k+=16){ x.beginPath(); x.moveTo(0,k); x.lineTo(W,k); x.stroke(); } });   // weathered canvas with seams
  _campMats={ tin:new THREE.MeshStandardMaterial({ map:tin, color:0x8a8e86, roughness:0.5, metalness:0.7, side:THREE.DoubleSide }),
    wall:new THREE.MeshStandardMaterial({ color:0x6e6a5a, roughness:0.85, map:propTex('wood') }),
    canvas:new THREE.MeshStandardMaterial({ map:canvasT, roughness:0.95, side:THREE.DoubleSide }),
    dark:new THREE.MeshStandardMaterial({ color:0x1a1814, roughness:0.9 }), rope:new THREE.MeshStandardMaterial({ color:0x8a7a58, roughness:0.9 }),
    fire:new THREE.MeshStandardMaterial({ color:0x000000, emissive:0xff7a2a, emissiveIntensity:2.2 }), glass:new THREE.MeshStandardMaterial({ color:0x2a3a3a, emissive:0xffc070, emissiveIntensity:0.0, roughness:0.2 }) };
  return _campMats; }
export function makeTent(){ const M=campMats(), g=new THREE.Group(), L=3.6, W=2.6, H=1.9;
  const sh=new THREE.Shape(); sh.moveTo(-W/2,0); sh.lineTo(0,H); sh.lineTo(W/2,0); sh.lineTo(W/2-0.05,0); sh.lineTo(0,H-0.07); sh.lineTo(-W/2+0.05,0); sh.closePath();
  const sk=new THREE.ExtrudeGeometry(sh,{depth:L,bevelEnabled:false}); sk.translate(0,0,-L/2); const tm=new THREE.Mesh(sk,M.canvas); tm.castShadow=true; tm.receiveShadow=true; g.add(tm);
  const back=new THREE.Mesh(new THREE.ShapeGeometry((()=>{ const t=new THREE.Shape(); t.moveTo(-W/2,0); t.lineTo(0,H); t.lineTo(W/2,0); t.closePath(); return t; })()), M.canvas); back.position.z=-L/2; g.add(back);
  const flap=new THREE.Mesh(new THREE.ShapeGeometry((()=>{ const t=new THREE.Shape(); t.moveTo(-W/2,0); t.lineTo(0,H); t.lineTo(-0.15,0); t.closePath(); return t; })()), M.canvas); flap.position.z=L/2; flap.rotation.y=-0.5; g.add(flap);   // door flap tied back
  const door=new THREE.Mesh(new THREE.ShapeGeometry((()=>{ const t=new THREE.Shape(); t.moveTo(-0.1,0); t.lineTo(0,H-0.1); t.lineTo(W/2-0.1,0); t.closePath(); return t; })()), M.dark); door.position.z=L/2-0.02; g.add(door);
  for(const [x,z] of [[-W/2-0.5,-L/2],[W/2+0.5,-L/2],[-W/2-0.5,L/2],[W/2+0.5,L/2]]){ const pts=[new THREE.Vector3(0,H*0.95,z), new THREE.Vector3(x,0.02,z+(z>0?0.4:-0.4))];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(pts[0],pts[1]),1,0.015,3), M.rope)); }   // guy ropes + pegs
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,H+0.25,6), M.dark); pole.position.set(0,(H+0.25)/2,L/2+0.02); g.add(pole);
  return g; }
export function makeQuonset(){ const M=campMats(), g=new THREE.Group(), R=2.4, L=7;
  const sg=new THREE.CylinderGeometry(R,R,L,22,1,true,Math.PI/2,Math.PI); sg.rotateX(Math.PI/2); const shell=new THREE.Mesh(sg, M.tin); shell.castShadow=true; shell.receiveShadow=true; g.add(shell);   // corrugated half-barrel roof
  for(const sz of [-1,1]){ const end=new THREE.Mesh(new THREE.CircleGeometry(R-0.02,22,0,Math.PI), M.wall); end.position.z=sz*L/2*0.995; if(sz<0) end.rotation.y=Math.PI; g.add(end); }
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.9,0.12), M.dark); door.position.set(0,0.95,L/2+0.02); g.add(door);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), M.fire); lamp.position.set(0,2.05,L/2+0.12); g.add(lamp);
  for(const sx of [-1,1]) for(const wz of [-1.6,1.4]){ const w=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.5,0.9), M.glass); w.position.set(sx*Math.cos(0.5)*R*1.01, Math.sin(0.5)*R*1.01*0.95, wz); w.rotation.z=sx*0.55; g.add(w); }   // little side windows
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.03,3.2,5), M.dark); ant.position.set(1.1,R+1.0,-2.6); g.add(ant);                // radio mast
  return g; }
export function campFlagTex(){ return _canvasTex(160,100,(x,W,H)=>{ x.fillStyle='#2a2a2a'; x.fillRect(0,0,W,H); x.fillStyle='#b8202a'; x.fillRect(0,H*0.35,W,H*0.3); x.fillStyle='#d8d0b8'; x.beginPath(); x.arc(W*0.25,H*0.5,H*0.16,0,7); x.fill(); }); }
export function buildCamps(){
  clearCamps(); const n=(CAMP.perStage[Math.min(CAMP.perStage.length-1,S.stage-1)]||1) - (MOBILE&&S.stage<4?0:0);
  for(let c=0;c<n;c++){ let x=0,z=0,ok=false;
    for(let t=0;t<500&&!ok;t++){ x=(Math.random()*2-1)*(ARENA-16); z=-ARENA+15+Math.random()*(ARENA*0.75); ok=Math.hypot(x,z)>50 && siteOk(x,z,19) && !CAMPS.some(o=>Math.hypot(o.x-x,o.z-z)<42) && !inZone(x,z,15) && inField(x,z,19); }   // Z194 a bigger compound: any structure keeps it away, scattered cover is cleared off the ground
    if(!ok) continue; clearSite(x, z, 18); const ang=(Math.random()*4|0)*Math.PI/2+(Math.random()-0.5)*0.3, ca=Math.cos(ang), sa=Math.sin(ang), at=(lx,lz)=>[x+lx*ca+lz*sa, z-lx*sa+lz*ca];
    const g=new THREE.Group(); scene.add(g);
    const K=CAMP_K, hut=makeQuonset(); const gy=heightAt(x,z); hut.scale.setScalar(K); hut.position.set(x,gy-0.05,z); hut.rotation.y=ang; g.add(hut);   // Z194 barracks at ×1.35
    const hp=Math.round(CAMP.hp*(1+(S.stage-1)*CAMP.hpPerStage)*loopHpMul()*diffHpMul());
    const camp={ g, hut, x, z, ang, hp, maxHp:hp, nextAt:performance.now()/1000+6, alive:true, fire:null, door:at(0,4.4*K), blocks:[] };
    const bobj={ mesh:hut, x, z, r:3.6*K, hp, maxHp:hp, steel:false, loot:true, kind:'camp', camp, obb:{ f:ang, hw:2.5*K, hl:3.6*K } }; blocks.push(bobj); camp.block=bobj; camp.blocks.push(bobj); addLootBeacon(bobj,'block');
    { const [hx,hz]=at(9.5,-3.5), h2=makeQuonset(); h2.scale.setScalar(K); h2.position.set(hx,heightAt(hx,hz)-0.05,hz); h2.rotation.y=ang; g.add(h2); camp.hut2=h2;   // Z194 a second barracks block (same garrison, same HP pool)
      const b2={ mesh:h2, x:hx, z:hz, r:3.6*K, hp, maxHp:hp, steel:false, loot:false, kind:'camp', camp, obb:{ f:ang, hw:2.5*K, hl:3.6*K } }; blocks.push(b2); camp.blocks.push(b2); }
    { const [tx,tz]=at(-12,-11); if(inField(tx,tz,4) && !blocks.some(b=>Math.hypot(b.x-tx,b.z-tz)<b.r+3)) buildTower(tx, tz); }   // Z194 a watchtower over the compound
    for(const [lx,lz,ry,ts] of [[-8.6,2.0,0.1,1],[-8.2,-6.6,0.05,1],[3.5,-11.5,1.57,1.5],[-1.5,-12.5,1.57,1]]){ const [tx,tz]=at(lx,lz); const tn=makeTent(); tn.scale.setScalar(ts*1.2); tn.position.set(tx,heightAt(tx,tz)-0.03,tz); tn.rotation.y=ang+ry; g.add(tn); TENTS.push({ g:tn, x:tx, z:tz, flat:false, ft:0 }); }
    { const [fx,fz]=at(-4.5,-9.2), fy=heightAt(fx,fz); const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,6.5,6), campMats().dark); pole.position.set(fx,fy+3.25,fz); g.add(pole);
      const fl=makeFlag(campFlagTex(),1.8,1.15,1); fl.position.set(fx,fy+5.85,fz); g.add(fl); }
    { const [cx,cz]=at(-2.4,9.0), cy=heightAt(cx,cz); const ring=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.16,6,12), campMats().dark); ring.rotation.x=Math.PI/2; ring.position.set(cx,cy+0.08,cz); g.add(ring);
      const fire=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.6,7), campMats().fire); fire.position.set(cx,cy+0.32,cz); g.add(fire); camp.fire={ m:fire, x:cx, z:cz, y:cy };
      for(const [lx,lz] of [[-0.6,7.6],[-4.2,8.2]]){ const [bx,bz]=at(lx,lz); const crate=new THREE.Mesh(coverGeo('crates'), coverMat('crates')); crate.scale.setScalar(0.5); crate.position.set(bx,heightAt(bx,bz),bz); crate.rotation.y=ang+Math.random(); g.add(crate); } }
    for(let k=0;k<12;k++){ const a=-Math.PI*0.74+k*(Math.PI*1.48/11)+Math.PI, [sx,sz]=at(Math.sin(a)*15.5, Math.cos(a)*15.5);   // sandbag ring, open at the front (the hut door side) · Z194 wider, taller bags
      if(Math.abs(sx)>ARENA-4||Math.abs(sz)>ARENA-4||!inField(sx,sz,3)||blocks.some(b=>b.kind!=='camp'&&Math.hypot(b.x-sx,b.z-sz)<3.5)) continue;
      const m=makeCoverMesh('sandbag', true); m.scale.setScalar(COVER_K); m.position.set(sx,heightAt(sx,sz)-0.12,sz); m.rotation.y=ang+a+Math.PI/2; scene.add(m); g.userData.bags=(g.userData.bags||0)+1;
      blocks.push({ mesh:m, x:sx, z:sz, r:1.7*COVER_K, hp:COVER_HP.sandbag, maxHp:COVER_HP.sandbag, steel:false, cover:true, ms:COVER_K, loot:false, kind:'sandbag' }); }
    CAMPS.push(camp); registerCampBase(camp);   // Z194 guarded like the other supply bases
  }
}
export function clearCamps(){ for(const c of CAMPS){ unwave(c.g); scene.remove(c.g); } CAMPS.length=0; TENTS.length=0; }
// Z194 both barracks share one HP pool · a hit sounds the alarm
export function damageCamp(b, dmg){ const c=b.camp; if(!c.alive) return; c.hp-=dmg; for(const q of c.blocks||[b]) q.hp=c.hp; const sb=SUPPLY.bases.find(B=>B.camp===c); if(sb) sb.hitAt=performance.now()/1000; flashMat(campMats().tin, 0.08, 0.4);
  if(Math.random()<0.5) burst({x:b.x+(Math.random()-0.5)*3,z:b.z+(Math.random()-0.5)*3}, 0xb0b4ac, 3, 4, {y:heightAt(b.x,b.z)+1.5+Math.random()*1.5, life:0.35, size:0.25, grav:-14, drag:1.5, up:2});
  if(b.hp<=0) destroyCamp(b); }
export function destroyCamp(b){ const c=b.camp; c.alive=false; for(const q of c.blocks||[b]){ const i=blocks.indexOf(q); if(i>=0) blocks.splice(i,1); }
  bigExplode({x:c.x,z:c.z}, 0xff8a3a, 2.2); fireball({x:c.x,z:c.z}, 2.0); decalScorch(c.x,c.z,7,1); deformCrater(c.x,c.z,2.6,0.5); S.shake=Math.min(3.2,S.shake+1.4);
  for(const h of [c.hut, c.hut2]) if(h){ h.scale.set(1.04*CAMP_K,0.32*CAMP_K,CAMP_K); h.rotation.z=0.12; h.position.y-=0.2; h.traverse(o=>{ if(o.isMesh && o.material===campMats().tin){ o.material=o.material.clone(); o.material.color.setHex(0x2a2622); } }); }   // the roofs cave in, scorched
  for(let k=0;k<3;k++) spawnDebris({x:c.x,z:c.z}, 1.2, 0x8a8e86);
  const R=Math.round; addScore(R(CAMP.score*loopRewardMul()), new THREE.Vector3(c.x,5,c.z)); addCoins(R(CAMP.coin*(1+(S.stage-1)*0.25)*loopRewardMul()*diffRewardMul()*cMod('coinMul')));
  floatText('ĐÃ PHÁ TRẠI', '#ffcf5a', new THREE.Vector3(c.x,6,c.z), 24); campLost(c); sfx('bigexplode');   // Z194 the radio + the lasting cut come from the supply bases
  if(b.loot){ dropPowerup({x:c.x,z:c.z+4}, 2); dropPowerup({x:c.x,z:c.z+4}, 1); } c.burnT=12; }
export let _campRadioAt=0;
export function updateCamps(dt, now){
  const p=S.player; if(!p) return;
  for(const c of CAMPS){
    if(c.fire && Math.random()<(c.alive?0.25:0)){ spawnPart(c.fire.x,c.fire.y+0.6,c.fire.z,(Math.random()-0.5)*0.3,1.4,(Math.random()-0.5)*0.3,{color:0x3a342c,size:0.9,life:1.6,smoke:true,grav:-0.3,drag:1,op:0.35}); c.fire.m.scale.y=0.8+Math.random()*0.5; }   // cookfire smoke
    if(!c.alive){ if(c.burnT>0){ c.burnT-=dt; if(Math.random()<0.6) spawnPart(c.x+(Math.random()-0.5)*4,heightAt(c.x,c.z)+1.2,c.z+(Math.random()-0.5)*5,(Math.random()-0.5),2.4,(Math.random()-0.5),{tex:'fire',color:0xffd080,color2:0xff3a08,size:1.4,life:0.6,grav:1.5,drag:1.4,grow:0.8});
        if(Math.random()<0.5) spawnPart(c.x,heightAt(c.x,c.z)+2.5,c.z,0.5,2.2,0.3,{color:0x15120f,size:2.2,life:2.2,smoke:true,grav:0.3,drag:0.7,grow:1.5,op:0.55}); } continue; }
    if(S.mode!=='playing' || !WAVE.active || now<c.nextAt) continue;
    c.nextAt=now+CAMP.every*(0.8+Math.random()*0.4);
    if(enemies.filter(e=>e.def.inf).length >= CAMP.infCap) continue;
    const n=CAMP.squad[0]+((Math.random()*(CAMP.squad[1]-CAMP.squad[0]+1))|0);
    for(let k=0;k<n;k++) setTimeout(()=>{ if(!c.alive||S.mode!=='playing') return; const t=spawnEnemy(k===n-1&&S.stage>=2?'rpg':'rifle', c.door[0]+(Math.random()-0.5)*1.2, c.door[1]+(Math.random()-0.5)*1.2); if(t){ t.kbx=Math.sin(c.ang)*5; t.kbz=Math.cos(c.ang)*5; } }, k*450);
    tip('camp'); if(now-_campRadioAt>25){ _campRadioAt=now; radio('SCH: Bộ binh đang kéo ra từ trại địch — san phẳng nhà lính để chặn chúng.'); }
  }
  for(const t of TENTS){ if(t.flat){ if(t.ft<1){ t.ft=Math.min(1,t.ft+dt*5); t.g.scale.y=Math.max(0.08,1-t.ft*0.92); } continue; }   // tracks flatten tents
    if(hitsHull(p, t.x, t.z, 1.4)){ t.flat=true; burst({x:t.x,z:t.z}, 0x8a7c56, 6, 4, {y:heightAt(t.x,t.z)+0.8, life:0.6, size:0.5, grav:-12, drag:1.6, up:2}); burst({x:t.x,z:t.z}, 0xb8a888, 2, 2, {y:heightAt(t.x,t.z)+0.6, life:1.0, size:1.8, smoke:true, grav:-0.3, drag:1.8, up:0.6, op:0.4});
      addScore(CAMP.tentScore, new THREE.Vector3(t.x,2,t.z)); sfx('thud'); haptic(15); } }
}
// ===== Z93 · SUPPLY CACHES — loot stashed where it is hard to get: inside camp perimeters, under watchtowers, behind ruined walls =====
export function placeCaches(){
  const n=LOOT.cache.perStage[Math.min(LOOT.cache.perStage.length-1, S.stage-1)], spots=[];
  for(const c of CAMPS){ const ca=Math.cos(c.ang), sa=Math.sin(c.ang); spots.push([c.x-sa*5.6, c.z-ca*5.6, 2]); }                      // behind the barracks
  for(const t of towers) if(!t.falling){ const a=Math.random()*6.283; spots.push([t.x+Math.cos(a)*3.4, t.z+Math.sin(a)*3.4, 1]); }   // at the foot of a guarded tower
  for(const b of blocks) if(b.kind==='brick' && Math.random()<0.3){ const sd=b.z>0?-1:1; spots.push([b.x+Math.cos(b.obb.f)*sd*1.6, b.z-Math.sin(b.obb.f)*sd*1.6, 1]); }   // tucked behind masonry
  spots.sort(()=>Math.random()-0.5); spots.sort((a,b)=>b[2]-a[2]);
  let k=0; for(const [x,z,t] of spots){ if(k>=n) break; if(Math.abs(x)>ARENA-5||Math.abs(z)>ARENA-5||!inField(x,z,4)||blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+1.2)) continue;
    const m=makeCoverMesh('crates', true); m.scale.set(0.8,0.7,0.8); m.position.set(x,heightAt(x,z)-0.1,z); m.rotation.y=Math.random()*6.283; scene.add(m);
    const hp=LOOT.cache.hp, b={ mesh:m, x, z, r:1.3, hp, maxHp:hp, steel:false, loot:true, lootTier:t, kind:'crates', cache:true }; blocks.push(b); addLootBeacon(b,'block'); k++; }
}
