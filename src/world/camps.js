// world/camps.js — Z90 · ENEMY TROOP CAMPS — a Quonset barracks, canvas tents, sandbag ring, flag & cookfire; squads keep pouring out of the hut until you level it
import * as THREE from 'three';
import { CAMP, HOME_GAP, LOOT, TENT } from '../../config.js';
import { ARENA, B3, COVER_HP, COVER_K, MOBILE, S, SUPPLY, WAVE, ZONES, _canvasTex, addCoins, dressFit, addLootBeacon, addScore, bigExplode, blockTop, blocks, buildTower, burst, cMod, campLost, clearCrowd, decalScorch, deformCrater, diffHpMul, diffRewardMul, dropPowerup, enemies, fireLight, fireball, flameFX, flashMat, flattenPad, floatText, heightAt, inField, inShape, kit, loopHpMul, loopRewardMul, makeCoverMesh, makeFlag, medical, messHall, person, propTex, quartermaster, radio, registerCampBase, scanSite, scene, scrambleCrowd, segBlock, sfx, spawnDebris, spawnEnemy, spawnPart, tip, towers, unwave, photoSet } from '../hub.js';

// ===== Z90 · ENEMY TROOP CAMPS — a Quonset barracks, canvas tents, sandbag ring, flag & cookfire; squads keep pouring out of the hut until you level it =====
export const CAMPS=[], TENTS=[]; export const CAMP_K=1.35, CAMP_R=31;   // Z194 the compound at the tanks' scale
export let _campMats=null;
export function campMats(){ if(_campMats) return _campMats;
  const tin=propTex('tin').clone(); tin.wrapS=tin.wrapT=THREE.RepeatWrapping; tin.center.set(0.5,0.5); tin.rotation=Math.PI/2; tin.repeat.set(1.5,4); tin.needsUpdate=true;   // Z236 corrugated sheet (was the drum's paint texture)
  const canvasT=_canvasTex(64,64,(x,W)=>{ x.fillStyle='#8a7c56'; x.fillRect(0,0,W,W); for(let i=0;i<900;i++){ const v=(110+Math.random()*60)|0; x.fillStyle='rgba('+v+','+(v-8)+','+(v-30)+',0.35)'; x.fillRect(Math.random()*W,Math.random()*W,2,1); }
    x.strokeStyle='rgba(60,50,30,0.5)'; x.lineWidth=1; for(let k=8;k<W;k+=16){ x.beginPath(); x.moveTo(0,k); x.lineTo(W,k); x.stroke(); } });   // weathered canvas with seams
  _campMats={ tin:new THREE.MeshStandardMaterial({ map:tin, color:0xa2a69e, roughness:0.5, metalness:0.35, side:THREE.DoubleSide }),   // Z236 weathered zinc reads grey, not black
    wall:new THREE.MeshStandardMaterial({ color:0x6e6a5a, roughness:0.85, map:propTex('wood') }),
    canvas:new THREE.MeshStandardMaterial({ map:canvasT, roughness:0.95, side:THREE.DoubleSide }),
    dark:new THREE.MeshStandardMaterial({ color:0x1a1814, roughness:0.9 }), rope:new THREE.MeshStandardMaterial({ color:0x8a7a58, roughness:0.9 }),
    fire:new THREE.MeshStandardMaterial({ color:0x000000, emissive:0xff7a2a, emissiveIntensity:2.2 }), glass:new THREE.MeshStandardMaterial({ color:0x2a3a3a, emissive:0xffc070, emissiveIntensity:0.0, roughness:0.2 }) };
  skinCamp(_campMats); return _campMats; }
// Z264 photographed skins once they load: weathered corrugated iron on the Quonset huts (the sheet's own turn and repeat kept), old planks on the walls
function skinCamp(M){ if(typeof window==='undefined' || /procwall/.test(location.search+location.hash)) return;
  photoSet('corrugated_iron').then(P=>{ const t=P.diff.clone(), o=M.tin.map; t.center.copy(o.center); t.rotation=o.rotation; t.repeat.copy(o.repeat); t.needsUpdate=true; M.tin.map=t; M.tin.color.setHex(0xc8ccc4); M.tin.metalness=0.45; M.tin.needsUpdate=true; }).catch(()=>{});
  photoSet('weathered_brown_planks').then(P=>{ const t=P.diff.clone(), o=M.wall.map; if(o){ t.repeat.copy(o.repeat); t.offset.copy(o.offset); } t.wrapS=t.wrapT=THREE.RepeatWrapping; t.needsUpdate=true; M.wall.map=t; M.wall.color.setHex(0xb8b2a6); M.wall.needsUpdate=true; }).catch(()=>{}); }
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
// Z234 the small phone field: when nothing else is free, the first camp may take a weapon/tank depot's planned ground (that depot is dropped)
//   and relax toward half the home gap — a barracks camp matters more than a depot
function campOverDepot(tx, tz){ const D=ZONES.filter(q=>q.kind==='arms'||q.kind==='motor'); for(const q of D) ZONES.splice(ZONES.indexOf(q),1);
  const sc=(x,z)=>Math.hypot(x-tx,z-tz)+Math.max(0,z)*2, s=scanSite(CAMP_R, sc, { homeK:HOME_GAP.minK }) || scanSite(CAMP_R, sc, { homeK:HOME_GAP.campMobileK });
  for(const q of D) if(!s || Math.hypot(q.x-s[0], q.z-s[1]) > CAMP_R+q.r+4) ZONES.push(q); return s; }
export function buildCamps(){
  clearCamps(); const n=(CAMP.perStage[Math.min(CAMP.perStage.length-1,S.stage-1)]||1) - (MOBILE&&S.stage<4?0:0);
  for(let c=0;c<n;c++){ const tx=(Math.random()*2-1)*ARENA*0.6, tz=-ARENA*(0.35+Math.random()*0.45), site=scanSite(CAMP_R, (x,z)=>Math.hypot(x-tx,z-tz), { maxZ:ARENA*0.15 }) || scanSite(CAMP_R, (x,z)=>Math.hypot(x-tx,z-tz), { maxZ:ARENA*0.45 }) || scanSite(CAMP_R, (x,z)=>Math.hypot(x-tx,z-tz), { maxZ:ARENA*0.45, homeK:HOME_GAP.minK }) || scanSite(CAMP_R, (x,z)=>Math.hypot(x-tx,z-tz)+Math.max(0,z)*2, { homeK:HOME_GAP.minK }) || (MOBILE && !CAMPS.length ? campOverDepot(tx, tz) : null);   // Z234 last resort: out on a flank, never on our home ground (the small phone field: one camp may sit a little nearer)   // no room in the enemy half → nearer the middle (still off our home ground, Z234)   // Z196 grid-scanned site for the big fenced camp, in the enemy half
    if(!site) continue; const [x,z]=site; flattenPad(x, z, CAMP_R*0.9, CAMP_R*1.3); const ang=(Math.random()*4|0)*Math.PI/2+(Math.random()-0.5)*0.3, ca=Math.cos(ang), sa=Math.sin(ang), at=(lx,lz)=>[x+lx*ca+lz*sa, z-lx*sa+lz*ca];
    const g=new THREE.Group(); scene.add(g); const K=CAMP_K, hp=Math.round(CAMP.hp*(1+(S.stage-1)*CAMP.hpPerStage)*loopHpMul()*diffHpMul());
    const camp={ g, x, z, ang, at, hp, maxHp:hp, nextAt:performance.now()/1000+6, alive:true, fire:null, door:at(-6,-7+4.4*K), blocks:[], huts:[] };
    for(const [lx,lz] of [[-6,-7],[6,-7]]){ const [hx,hz]=at(lx,lz), h=makeQuonset(); h.scale.setScalar(K); h.position.set(hx,heightAt(hx,hz)-0.05,hz); h.rotation.y=ang; g.add(h); dressFit(h, 'hut'); camp.huts.push(h);   // Z196 two barracks blocks, one HP pool
      const b={ mesh:h, x:hx, z:hz, r:3.6*K, hp, maxHp:hp, steel:false, loot:!camp.blocks.length, kind:'camp', camp, obb:{ f:ang, hw:2.5*K, hl:3.6*K } }; blocks.push(b); camp.blocks.push(b); }
    camp.hut=camp.huts[0]; camp.hut2=camp.huts[1]; camp.block=camp.blocks[0]; addLootBeacon(camp.block,'block');
    { const [tx,tz]=at(24,-21); if(inField(tx,tz,4) && !blocks.some(b=>Math.hypot(b.x-tx,b.z-tz)<b.r+3)) buildTower(tx, tz); }   // a watchtower over the back corner
    for(const lx of [-8,-2,4]){ const [tx,tz]=at(lx,-19); const tn=makeTent(); tn.scale.setScalar(1.2); tn.position.set(tx,heightAt(tx,tz)-0.03,tz); tn.rotation.y=ang; g.add(tn); dressFit(tn, 'tent'); addTent(tn, tx, tz, ang, 1.8*1.2, 1.3*1.2, true); }   // sleeping tents · Z402 solid, hiding, burnable
    { const [fx,fz]=at(0,4), fy=heightAt(fx,fz); const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,8,6), campMats().dark); pole.position.set(fx,fy+4,fz); g.add(pole);   // parade-ground flag
      const fl=makeFlag(campFlagTex(),2.2,1.4,1); fl.position.set(fx,fy+7.2,fz); g.add(fl); }
    { const [cx,cz]=at(9,12), cy=heightAt(cx,cz); const ring=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.16,6,12), campMats().dark); ring.rotation.x=Math.PI/2; ring.position.set(cx,cy+0.08,cz); g.add(ring);   // the campfire
      const fire=flameFX(1.25, 0.9); fire.position.set(cx,cy+0.05,cz); g.add(fire); camp.fire={ m:fire, x:cx, z:cz, y:cy }; }   // Z235 a living flame
    { const L=kit(), TK=[]; L.tent=(lx, lz, w, dp)=>{ const K=kit(); TK.push({ K, lx, lz, w, dp }); return K; };   // Z414 each canvas tent of the camp gets a kit of its own (world/camp-life.js frameTent / messHall)
      messHall(L, -15, 12); quartermaster(L, -17, -9); medical(L, 15, 11);   // Z196 feeding, clothing, treating the men (Z434 the drawn rest area and latrines gone)
      for(const a of [0,1.57,3.14,4.71]) L.add('wood', B3(1.6,0.3,0.35,9+Math.sin(a)*1.9,0.25,12+Math.cos(a)*1.9,a), 0x5a4428);   // log benches round the fire
      const d=L.bake(false); d.position.set(x, heightAt(x,z)-0.05, z); d.rotation.y=ang; g.add(d);
      TK.forEach((t, i)=>{ const tg=t.K.bake(false), [wx,wz]=at(t.lx, t.lz); tg.position.copy(d.position); tg.rotation.y=ang; g.add(tg); dressFit(tg, ['mess','qm','med'][i]); addTent(tg, wx, wz, ang, t.dp/2, t.w/2, true); }); }   // (Z429 each in its real tent: the mess, the quartermaster's, the medical)   // Z414 the mess, the quartermaster's and the medical tent: walls to hide behind until they burn
    for(const [lx,lz,ry] of [[-25,22,0.6],[25,20,-0.6],[-25,-4,1.57],[25,-14,-1.57],[0,-23,0]]){ const [sx,sz]=at(lx,lz); if(!inField(sx,sz,3)||blocks.some(b=>Math.hypot(b.x-sx,b.z-sz)<3.5)) continue;   // sandbag posts
      const m=makeCoverMesh('sandbag', true); m.scale.setScalar(COVER_K); m.position.set(sx,heightAt(sx,sz)-0.12,sz); m.rotation.y=ang+ry; scene.add(m);
      blocks.push({ mesh:m, x:sx, z:sz, r:1.7*COVER_K, hp:COVER_HP.sandbag, maxHp:COVER_HP.sandbag, steel:false, cover:true, ms:COVER_K, loot:false, kind:'sandbag' }); }
    { const few=MOBILE;   // the men: eating, by the fire, drilling, wounded, at the stores, resting, walking about, a sentry
      for(const [lx,lz,ry] of [[-17.5,10,0],[-16,10,0],[-14.5,10,0],[-13,10,0],[-17,11.5,Math.PI],[-15,11.5,Math.PI],[-16.5,12.5,0],[-14,13.8,Math.PI]]) if(!few||lx<-15) person(camp, lx, lz, ry, 'sit', { y:0.08 });
      person(camp, -21.4, 13.6, Math.PI, 'stand');
      for(const a of [0.4,1.9,3.4,4.9]) person(camp, 9+Math.sin(a)*1.9, 12+Math.cos(a)*1.9, a+Math.PI, 'sit', { y:0.08 });
      for(const cx of [-2.4,0,2.4]) person(camp, 15+cx-0.9*0, 14.9, 0, 'lie', { y:0.55 }); person(camp, 13.6, 16.6, Math.PI, 'stand');
      for(const cx of [-1.5,1.5]) person(camp, -17+cx, -3.4, Math.PI, 'stand');
      for(let r=0;r<2;r++) for(let c=0;c<(few?3:5);c++) person(camp, -4+c*2, 8+r*1.6, Math.PI, 'drill');
      person(camp, 0, 6, 0, 'stand');
      for(const cx of [-0.7,0.8]) person(camp, 17+cx, -9, 0, 'lie', { y:0.55 });
      person(camp, -8, 4, 0, 'walk', { path:[[-8,4],[8,4],[8,-15],[-8,-15]] }); person(camp, -15, 6, 0, 'walk', { path:[[-15,6],[15,6]] });
      if(!few) person(camp, -20, -15, 0, 'walk', { path:[[-20,-15],[-10,-15],[-10,-3]] });
      person(camp, -22, 23, 0, 'guard', { path:[[-22,23],[22,23]] }); }
    CAMPS.push(camp); registerCampBase(camp);   // Z194 guarded like the other supply bases
  }
}
export function clearCamps(){ for(const c of CAMPS){ unwave(c.g); scene.remove(c.g); } CAMPS.length=0; TENTS.length=0; clearCrowd(); }
// Z194 both barracks share one HP pool · a hit sounds the alarm
export function damageCamp(b, dmg){ const c=b.camp; if(!c.alive) return; c.hp-=dmg; for(const q of c.blocks||[b]) q.hp=c.hp; const sb=SUPPLY.bases.find(B=>B.camp===c); if(sb) sb.hitAt=performance.now()/1000; flashMat(campMats().tin, 0.08, 0.4);
  if(Math.random()<0.5) burst({x:b.x+(Math.random()-0.5)*3,z:b.z+(Math.random()-0.5)*3}, 0xb0b4ac, 3, 4, {y:heightAt(b.x,b.z)+1.5+Math.random()*1.5, life:0.35, size:0.25, grav:-14, drag:1.5, up:2});
  if(b.hp<=0) destroyCamp(b); }
export function destroyCamp(b){ const c=b.camp; c.alive=false; for(const q of c.blocks||[b]){ const i=blocks.indexOf(q); if(i>=0) blocks.splice(i,1); }
  bigExplode({x:c.x,z:c.z}, 0xff8a3a, 2.2); fireball({x:c.x,z:c.z}, 2.0); decalScorch(c.x,c.z,7,1); deformCrater(c.x,c.z,2.6,0.5); S.shake=Math.min(3.2,S.shake+1.4);
  clearCrowd(c);   // Z196 nobody is left standing in the open
  for(const h of [c.hut, c.hut2]) if(h){ h.scale.set(1.04*CAMP_K,0.32*CAMP_K,CAMP_K); h.rotation.z=0.12; h.position.y-=0.2; h.traverse(o=>{ if(o.isMesh && o.material===campMats().tin){ o.material=o.material.clone(); o.material.color.setHex(0x2a2622); } }); }   // the roofs cave in, scorched
  for(let k=0;k<3;k++) spawnDebris({x:c.x,z:c.z}, 1.2, 0x8a8e86);
  const R=Math.round; addScore(R(CAMP.score*loopRewardMul()), new THREE.Vector3(c.x,5,c.z)); addCoins(R(CAMP.coin*(1+(S.stage-1)*0.25)*loopRewardMul()*diffRewardMul()*cMod('coinMul')));
  floatText('ĐÃ PHÁ TRẠI', '#ffcf5a', new THREE.Vector3(c.x,6,c.z), 24); campLost(c); sfx('bigexplode');   // Z194 the radio + the lasting cut come from the supply bases
  if(b.loot){ dropPowerup({x:c.x,z:c.z+4}, 2); dropPowerup({x:c.x,z:c.z+4}, 1); } c.burnT=12; }
export let _campRadioAt=0;
export function updateCamps(dt, now){
  const p=S.player; if(!p) return;
  for(const c of CAMPS){
    if(c.fire && Math.random()<(c.alive?0.25:0)){ spawnPart(c.fire.x,c.fire.y+0.6,c.fire.z,(Math.random()-0.5)*0.3,1.4,(Math.random()-0.5)*0.3,{color:0x3a342c,size:0.9,life:1.6,smoke:true,grav:-0.3,drag:1,op:0.35}); }   // cookfire smoke
    if(!c.alive){ if(c.burnT>0){ c.burnT-=dt; if(Math.random()<0.6) spawnPart(c.x+(Math.random()-0.5)*4,heightAt(c.x,c.z)+1.2,c.z+(Math.random()-0.5)*5,(Math.random()-0.5),2.4,(Math.random()-0.5),{tex:'fire',color:0xffd080,color2:0xff3a08,size:1.4,life:0.6,grav:1.5,drag:1.4,grow:0.8});
        if(Math.random()<0.5) spawnPart(c.x,heightAt(c.x,c.z)+2.5,c.z,0.5,2.2,0.3,{color:0x15120f,size:2.2,life:2.2,smoke:true,grav:0.3,drag:0.7,grow:1.5,op:0.55}); } continue; }
    { const B=SUPPLY.bases.find(q=>q.camp===c); if(B && B.alarm && !c.scrambled && S.mode==='playing'){ c.scrambled=true; scrambleCrowd(c);   // Z196 alarm: the men run inside… and come back out armed
        const n=Math.min(8, 3+S.stage); for(let k=0;k<n;k++) setTimeout(()=>{ if(!c.alive||S.mode!=='playing') return; const t=spawnEnemy(k%4===3?'rpg':'rifle', c.door[0]+(Math.random()-0.5)*1.5, c.door[1]+(Math.random()-0.5)*1.5); if(t){ t.kbx=Math.sin(c.ang)*5; t.kbz=Math.cos(c.ang)*5; } }, 2200+k*380); } }
    if(S.mode!=='playing' || !WAVE.active || now<c.nextAt) continue;
    c.nextAt=now+CAMP.every*(0.8+Math.random()*0.4);
    if(enemies.filter(e=>e.def.inf).length >= CAMP.infCap) continue;
    const n=CAMP.squad[0]+((Math.random()*(CAMP.squad[1]-CAMP.squad[0]+1))|0);
    for(let k=0;k<n;k++) setTimeout(()=>{ if(!c.alive||S.mode!=='playing') return; const t=spawnEnemy(k===n-1&&S.stage>=2?'rpg':'rifle', c.door[0]+(Math.random()-0.5)*1.2, c.door[1]+(Math.random()-0.5)*1.2); if(t){ t.kbx=Math.sin(c.ang)*5; t.kbz=Math.cos(c.ang)*5; } }, k*450);
    tip('camp'); if(now-_campRadioAt>25){ _campRadioAt=now; radio('SCH: Bộ binh đang kéo ra từ trại địch — san phẳng nhà lính để chặn chúng.'); }
  }
  updateTents(dt);   // Z402 burning tents (they no longer flatten under the tracks: a tent is a wall until it burns)
}
// ===== Z402 TENTS ARE WALLS UNTIL THEY BURN — a camp's sleeping tent / an outpost's field tent stands as a block with its true box: tanks and men stop at it
//   (world/physics.js, actors/fireteam.js, game/cavalry.js), rounds stop at it (combat/solid-line.js) and so does every eye — the enemy's (game/stealth.js:
//   playerSeen, ai/fieldcraft.js losBlocked) and the player's auto-aim and lock-on (tentHides below). One hit sets it alight: flames run over the canvas, it
//   chars and sags, and in TENT.burn s it is gone — its collider, its mesh and what it alone owned on the GPU =====
export function addTent(g, x, z, f, hl, hw, own){ const b={ mesh:g, x, z, r:Math.min(hl, hw), obb:{ f, hl, hw }, hp:1, maxHp:1, steel:false, cover:true, loot:false, kind:'tent' };
  const T={ g, b, x, z, f, hl, hw, own, burn:-1, sy:g.scale.y, mats:null, fireT:0, ms:Math.max(hl, hw)/2.2 }; b.tent=T; blocks.push(b); TENTS.push(T); return T; }
// a hit (any round, a ram, a blast): it catches fire
export function tentHit(b){ const T=b.tent; if(!T || T.burn>=0) return; T.burn=0; const gy=heightAt(T.x, T.z);
  T.mats=new Map(); T.g.traverse(o=>{ if(!o.isMesh) return; let c=T.mats.get(o.material); if(!c){ c=o.material.clone(); T.mats.set(o.material, c); } o.material=c; });   // its own canvas now, to char
  for(const c of T.mats.values()){ c.userData.col=c.color.clone(); if(c.emissive) c.emissive.setHex(0x8a2a08); }
  fireLight(T, TENT.burn*0.9); sfx('whoosh', { x:T.x, z:T.z }, 0.7); burst({ x:T.x, z:T.z }, 0xffb050, 8, 4, { y:gy+1.2, life:0.4, size:0.9, grav:-3, drag:2, up:2 }); }
const _CHAR=new THREE.Color(0x1a1612), _sb={ t0:0, t1:1 };
function updateTents(dt){ for(let i=TENTS.length-1;i>=0;i--){ const T=TENTS[i]; if(T.burn<0) continue; T.burn+=dt; const k=Math.min(1, T.burn/TENT.burn), gy=heightAt(T.x, T.z), s=Math.sin(T.f), c=Math.cos(T.f);
    for(const m of T.mats.values()){ m.color.copy(m.userData.col).lerp(_CHAR, Math.min(1, k*2.2)); if(m.emissive) m.emissiveIntensity=(0.03+0.09*Math.random())*(1-k); }   // the canvas chars black, a faint ember glow flickering in it
    const sg=Math.max(0, (k-(1-TENT.sag))/TENT.sag); T.g.scale.y=T.sy*(1-0.9*sg); T.b.hp=1-k;   // it sags in and falls (the sight lines follow its height down)
    T.fireT-=dt; if(T.fireT<=0){ T.fireT=MOBILE?0.06:0.03; const a=(Math.random()*2-1)*T.hl, w=(Math.random()*2-1)*T.hw*(1-Math.abs(a)/T.hl*0.3), h=gy+(0.3+Math.random()*1.9)*T.sy*(1-0.8*sg);   // flames all over the canvas
      spawnPart(T.x+a*s+w*c, h, T.z+a*c-w*s, (Math.random()-0.5)*0.6, 2.2+Math.random()*2, (Math.random()-0.5)*0.6, { tex:'fire', color:0xffd090, color2:0xff3a08, size:(1.0+Math.random()*0.9)*T.ms, life:0.45+Math.random()*0.3, grav:1.5, drag:1.6, grow:0.7 });
      if(Math.random()<0.45) spawnPart(T.x+a*s*0.6, gy+2.4*T.sy, T.z+a*c*0.6, 0.6+(Math.random()-0.5)*0.6, 2.2+Math.random(), 0.3+(Math.random()-0.5)*0.6, { color:0x1e1a16, size:(1.4+Math.random())*T.ms, life:1.4, smoke:true, grav:0.3, drag:0.8, grow:1.6, op:0.5 }); }
    if(k<1) continue;
    burst({ x:T.x, z:T.z }, 0x2a2420, MOBILE?3:5, 2.5, { y:gy+0.8, life:1.1, size:1.8, smoke:true, grav:-0.4, drag:1.6, up:1.2, op:0.5 }); burst({ x:T.x, z:T.z }, 0xffa040, MOBILE?6:12, 4, { y:gy+0.6, life:0.6, size:0.12, grav:-6, drag:1, up:3 });   // the last of it: a puff of smoke, a shower of sparks
    decalScorch(T.x, T.z, Math.max(T.hl, T.hw)*1.1, 0.8); dropTent(T); TENTS.splice(i, 1); addScore(CAMP.tentScore, new THREE.Vector3(T.x, gy+2, T.z)); } }
// gone: off the field (its block), out of the scene, its own geometry (a camp tent's) and its charred materials freed — the shared ones are left alone
function dropTent(T){ const i=blocks.indexOf(T.b); if(i>=0) blocks.splice(i, 1); T.g.parent && T.g.parent.remove(T.g);
  if(T.own) T.g.traverse(o=>{ if(o.isMesh && o.geometry) o.geometry.dispose(); }); if(T.mats) for(const m of T.mats.values()) m.dispose(); T.mats=null; }
// does a standing tent hide (bx, by, bz) from an eye at (ax, ay, az)? — its box crossed below its top (a tent the eye or the target is in does not count)
export function tentHides(ax, ay, az, bx, by, bz){ for(const T of TENTS){ const b=T.b; if(!segBlock(b, ax, az, bx, bz, 0, _sb) || inShape(b, ax, az) || inShape(b, bx, bz)) continue;
    const top=blockTop(b), y0=ay+(by-ay)*_sb.t0, y1=ay+(by-ay)*_sb.t1; if(Math.min(y0, y1)<top) return true; } return false; }
// the player's auto-aim / lock-on: is this enemy behind a tent from where the player stands
export function tentHidesFromPlayer(t){ const p=S.player; if(!p || !TENTS.length || !t || !t.pos) return false; const E=TENT.eye, gy=heightAt(p.pos.x, p.pos.z), ty=t.pos.y>2 ? t.pos.y : heightAt(t.pos.x, t.pos.z)+E.mid;   // (a helicopter up high is above any tent)
  return tentHides(p.pos.x, gy+E.man, p.pos.z, t.pos.x, ty, t.pos.z); }
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
