// world/towers.js — WATCHTOWERS: wood towers with guards who fire plunging rounds + night searchlights; shoot them down to collapse
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BRIDGE } from '../../config.js';
import { AREA_K, ARENA, BIOME, FT, MOBILE, NIGHT, S, TOWER, _R, _mergeColored, _xf, addCoins, addLootBeacon, addScore, animateSoldier, bigExplode, blocks, buildBridge, burst, cMod, clearBridges, clearCamps, coverMat, detailize, diffDmgMul, diffHpMul, diffRewardMul, dropSearchlight, floatText, heightAt, inField, inZone, loopDmgMul, loopHpMul, loopRewardMul, makeSearchlight, makeSoldierMesh, propTex, scene, sfx, spawnBullet, spawnEnemy, spawnPart, updateBeams, updateSearchSpot, updateSearchlight } from '../hub.js';

export const towers=[], fallers=[];
export let _towerGeo=null;
export function towerGeos(){
  if(_towerGeo) return _towerGeo; const W=[], R=[], P=[];
  const nI=(q)=>{ const n=q.index?q.toNonIndexed():q; for(const a of Object.keys(n.attributes)) if(!['position','normal','uv'].includes(a)) n.deleteAttribute(a); n.clearGroups(); return n; };
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const leg=new THREE.BoxGeometry(0.22,6.6,0.22); leg.translate(0,3.3,0); _xf(leg, sx*1.35,0,sz*1.35, -sz*0.06,0,sx*0.06); W.push(nI(leg)); }   // splayed timber legs
  for(const y of [1.6,3.6]) for(const [ax,az,ry] of [[0,-1.32,0],[0,1.32,0],[-1.32,0,Math.PI/2],[1.32,0,Math.PI/2]]){ const br=new THREE.BoxGeometry(0.12,0.12,3.3); br.rotateX(0.55); _xf(br, ax,y+0.9,az, 0,ry,0); W.push(nI(br)); }   // X-bracing
  const deck=new THREE.BoxGeometry(3.4,0.22,3.4); deck.translate(0,TOWER.h,0); W.push(nI(deck));
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const post=new THREE.BoxGeometry(0.14,2.3,0.14); post.translate(sx*1.55,TOWER.h+1.15,sz*1.55); W.push(nI(post)); }
  for(let k=0;k<9;k++){ const rung=new THREE.BoxGeometry(0.7,0.06,0.08); rung.translate(0,0.55+k*0.65,1.75); W.push(nI(rung)); }   // ladder
  for(const lx of [-0.34,0.34]){ const rail=new THREE.BoxGeometry(0.08,6.2,0.08); rail.translate(lx,3.1,1.75); W.push(nI(rail)); }
  const roof=new THREE.BoxGeometry(4.0,0.12,4.0); roof.rotateX(0.12); roof.translate(0,TOWER.h+2.35,0); R.push(nI(roof));                      // corrugated tin roof
  const tones=[0xc9b48a,0xb8a276,0xa8936a]; const bags=[];
  for(const [ax,az,ry] of [[0,-1.55,0],[0,1.55,0],[-1.55,0,Math.PI/2],[1.55,0,Math.PI/2]]) for(let k=-1;k<=1;k++){ const b=new RoundedBoxGeometry(1.0,0.34,0.46,2,0.12);
    _xf(b, ax+(ry?0:k*1.02), TOWER.h+0.3, az+(ry?k*1.02:0), 0, ry+_R(-0.06,0.06), 0); bags.push({geo:b, col:tones[(Math.random()*3)|0]}); }
  P.push(_mergeColored(bags));
  _towerGeo={ wood:mergeGeometries(W), roof:mergeGeometries(R), bags:P[0] }; return _towerGeo;
}
export let _woodMat=null, _tinMat=null;
export function buildTower(x, z){
  const G=towerGeos();
  if(!_woodMat){ _woodMat=detailize(new THREE.MeshStandardMaterial({ map:propTex('wood'), color:0x9a7a52, roughness:0.9 }), { scale:0.7, bump:0.012, alb:0.3, foot:1.0, streak:0.25 }); _tinMat=detailize(new THREE.MeshStandardMaterial({ color:0x6a6e66, roughness:0.45, metalness:0.75, map:propTex('drum') }), { scale:0.8, bump:0.004, alb:0.3, foot:0, streak:0.4 }); }
  const g=new THREE.Group(); const gy=heightAt(x,z); g.position.set(x,gy,z);                 // outer: topples about world axes
  const body=new THREE.Group(); body.rotation.y=Math.random()*6.283; g.add(body);             // inner: the tower's own heading
  const wm=_woodMat.clone(); const add=(geo,mat)=>{ const m=new THREE.Mesh(geo,mat); m.castShadow=true; m.receiveShadow=true; body.add(m); return m; };
  add(G.wood, wm); add(G.roof, _tinMat); add(G.bags, coverMat('sandbag'));
  // searchlight (sweeps at night)
  const sl=new THREE.Group(); sl.position.set(1.2,TOWER.h+1.0,-1.2); body.add(sl);
  const lamp=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.4,12), _tinMat); lamp.rotation.x=Math.PI/2; sl.add(lamp);
  const bg=new THREE.Group(); bg.rotation.x=0.55; sl.add(bg); const light=makeSearchlight(sl, bg, 26, 0.24, 3.4, gy), beam=light.beam;   // Z146 volumetric beam + ground pool + glare
  const guards=[];
  for(let k=0;k<2;k++){ const s=makeSoldierMesh({enemy:true}); s.scale.setScalar(1.55); s.position.set(k?0.7:-0.7, TOWER.h+0.11, k?0.4:-0.4); body.add(s); guards.push({ g:s, alive:true, fireAt:performance.now()/1000+1+Math.random()*2 }); }
  scene.add(g);
  const hp=Math.round(TOWER.hp*loopHpMul()*diffHpMul());
  const t={ g, body, x, z, guards, sl, beam, light, wm, hp, falling:false };
  towers.push(t);
  const bobj={ mesh:g, x, z, r:2.0, hp, maxHp:hp, steel:false, loot:Math.random()<0.5, kind:'tower', tower:t };
  blocks.push(bobj); t.block=bobj; if(bobj.loot) addLootBeacon(bobj,'block');
}
export function buildTowers(){
  for(const t of towers){ scene.remove(t.g); dropSearchlight(t.light); } towers.length=0; for(const f of fallers) scene.remove(f.g); fallers.length=0; clearBridges();
  const n=Math.round(((MOBILE?2:3)+Math.min(2, Math.floor((S.stage-1)/2)))*Math.min(AREA_K,1.7)), okAt=(x,z)=>Math.abs(x)<ARENA-9&&Math.abs(z)<ARENA-9&&Math.hypot(x,z)>22 && Math.hypot(x,z-ARENA*0.55)>16 && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<7) && !inZone(x,z,6) && inField(x,z,9);
  for(let i=0;i<n;i++){ let x=0,z=0,ok=false;
    for(let tr=0;tr<30&&!ok;tr++){ x=(Math.random()*2-1)*(ARENA-9); z=(Math.random()*2-1)*(ARENA-9); ok=okAt(x,z); }
    if(!ok) continue; buildTower(x,z); const t0=towers[towers.length-1];
    if(i<n-1 && Math.random()<BRIDGE.pairChance){ for(let tr=0;tr<16;tr++){ const a=Math.random()*6.283, d=BRIDGE.minD+Math.random()*(BRIDGE.maxD-BRIDGE.minD), x2=x+Math.cos(a)*d, z2=z+Math.sin(a)*d;   // Z90 a paired guard post across a rope bridge
      if(okAt(x2,z2)){ buildTower(x2,z2); buildBridge(t0, towers[towers.length-1]); i++; break; } } } }
}
// guards spot your tank and fire plunging rifle rounds; searchlights sweep at night
export const _tw=new THREE.Vector3();
export function updateTowers(dt, now){
  updateBeams(dt); updateSearchSpot(towers.map(t=>t.light), NIGHT.k);
  const p=S.player; if(!p) return;
  for(const t of towers){
    t.sl.rotation.y = Math.sin(now*0.5+t.x)*1.2 + Math.sin(now*0.17+t.z)*0.35;   // Z146 an operator's uneven sweep
    if(t.light){ if(t.falling){ t.light.beam.visible=false; t.light.pool.visible=false; t.light.on=false; } else updateSearchlight(t.light, NIGHT.k); }
    if(t.falling) continue;
    for(const gd of t.guards){ if(!gd.alive) continue;
      gd.g.getWorldPosition(_tw); gd.wx=_tw.x; gd.wy=_tw.y; gd.wz=_tw.z;                         // Z104 cached for our soldiers to aim at
      const tg=towerGuardAim(_tw.x, _tw.z), dx=tg.x-_tw.x, dz=tg.z-_tw.z, d=Math.hypot(dx,dz);   // Z104 the tank, or one of our men if he is closer
      gd.g.rotation.y = Math.atan2(dx,dz) - t.body.rotation.y;
      const fired = d<TOWER.range && now>=gd.fireAt && S.mode==='playing';
      if(fired){ gd.fireAt = now + TOWER.fireCd*(0.8+Math.random()*0.5);
        gd.g.userData.muzzle.getWorldPosition(_tw); const ang=Math.atan2(tg.x-_tw.x, tg.z-_tw.z)+(Math.random()-0.5)*0.08;
        const dmg=(TOWER.guardDmg + S.stage*0.7)*loopDmgMul()*diffDmgMul()*cMod('enemyDmgMul');
        spawnBullet(_tw.x, _tw.z, ang, {owner:'e', inf:true, dmg, speed:72, color:0xffb04a, r:0.24, life:1.4, maxDist:TOWER.range+4, arcDist:d, noArc:true, y:_tw.y, dropTo:1.4, ignore:t.block});
        spawnPart(_tw.x,_tw.y,_tw.z, Math.sin(ang)*5,-1,Math.cos(ang)*5, {tex:'flash', color:0xfff0c0, size:0.7, life:0.05, grav:0, drag:8}); sfx('rifleShot', {x:_tw.x, z:_tw.z}); }
      animateSoldier(gd.g, 0, dt, fired); }
  }
  for(let i=fallers.length-1;i>=0;i--){ const f=fallers[i]; f.t+=dt;                                          // guards tumbling off the collapsing tower
    if(!f.down){ f.vy-=26*dt; f.g.position.x+=f.vx*dt; f.g.position.y+=f.vy*dt; f.g.position.z+=f.vz*dt; f.g.rotation.x+=f.rx*dt; f.g.rotation.z+=f.rz*dt;
      const gy=heightAt(f.g.position.x,f.g.position.z); if(f.g.position.y<=gy){ f.g.position.y=gy; f.down=true; f.g.rotation.x=Math.PI/2*(f.rx>0?1:-1);
        burst({x:f.g.position.x,z:f.g.position.z}, BIOME.ground, 4, 3, {y:gy+0.3, life:0.7, size:1.0, smoke:true, grav:-0.3, drag:2, up:1, op:0.5});
        sfx('thud');
        if(f.live){ const x=f.g.position.x, z=f.g.position.z; scene.remove(f.g); fallers.splice(i,1);                       // Z112 survived the fall: picks himself up and fights
          const e=spawnEnemy(Math.random()<0.25?'rpg':'rifle', x, z); if(e){ e.stunUntil=performance.now()/1000+TOWER.getUp; e.hp=e.maxHp*0.6; if(f.fort) e.fortOf=f.fort; floatText('LÍNH GÁC NGÃ — VẪN SỐNG!', '#ffb35a', new THREE.Vector3(x, gy+2.2, z), 13); }
          continue; }
        addScore(150, new THREE.Vector3(f.g.position.x, gy+1.5, f.g.position.z)); addCoins(Math.round(15*loopRewardMul()*diffRewardMul()*cMod('coinMul'))); } }
    else if(f.t>4){ const k=Math.max(0,1-(f.t-4)/1.5); f.g.scale.setScalar(1.55*Math.max(0.001,k)); if(k<=0){ scene.remove(f.g); fallers.splice(i,1); } } }
  for(const t of towers){ if(!t.falling) continue; t.ft+=dt; const k=Math.min(1, t.ft/1.25), e=k*k;          // topple about the base with a hard landing
    t.g.rotation.x = t.fdx*e*1.45; t.g.rotation.z = t.fdz*e*1.45;
    if(k>=1 && !t.landed){ t.landed=true; const ex=t.x+t.fdz*-5, ez=t.z+t.fdx*5;
      bigExplode({x:ex,z:ez}, 0xc8a070, 1.4); burst({x:ex,z:ez}, 0x8a6a40, 14, 9, {y:heightAt(ex,ez)+1, life:0.7, size:0.45, grav:-18, drag:1.2, up:4}); S.shake=Math.min(3,S.shake+1.2); }
    if(t.ft>7){ const k2=Math.max(0,1-(t.ft-7)/1.5); t.wm.opacity=k2; t.wm.transparent=true; if(k2<=0){ scene.remove(t.g); t.gone=true; } } }
  for(let i=towers.length-1;i>=0;i--) if(towers[i].gone) towers.splice(i,1);
}
export function collapseTower(t){
  t.falling=true; t.ft=0; const p=S.player; const ax=t.x-(p?p.pos.x:0), az=t.z-(p?p.pos.z:0), L=Math.hypot(ax,az)||1;   // falls AWAY from the shooter
  t.fdx=az/L; t.fdz=-ax/L;
  floatText('THÁP ĐÃ ĐỔ', '#ffcf5a', new THREE.Vector3(t.x, 8, t.z), 22); addScore(200, new THREE.Vector3(t.x,6,t.z)); sfx('bigexplode'); S.shake=Math.min(3,S.shake+0.8);
  burst({x:t.x,z:t.z}, 0x8a6a40, 18, 8, {y:heightAt(t.x,t.z)+3, life:0.8, size:0.5, grav:-16, drag:1.2, up:3}); burst({x:t.x,z:t.z}, 0xb09a7a, 5, 3, {y:heightAt(t.x,t.z)+1.5, life:1.4, size:2.4, smoke:true, grav:-0.4, drag:1.5, up:1.5, op:0.5});
  const rammed = t._ramAt && performance.now()/1000 - t._ramAt < 0.3;                                         // Z112 knocked over by a tank: the men ride it down and live
  for(const gd of t.guards) dropGuard(t, gd, ax/L, az/L, rammed);
}
// a guard leaves the tower: shot off it by our infantry (Z104) or thrown when it collapses — he tumbles to the ground (score on landing)
export function dropGuard(t, gd, ux, uz, live){ if(!gd.alive) return; gd.alive=false; gd.g.visible=true; const wp=new THREE.Vector3(); gd.g.getWorldPosition(wp); const wq=new THREE.Quaternion(); gd.g.getWorldQuaternion(wq);
  t.body.remove(gd.g); scene.add(gd.g); gd.g.position.copy(wp); gd.g.quaternion.copy(wq);
  fallers.push({ g:gd.g, t:0, vx:ux*(3+Math.random()*3)+(Math.random()-0.5)*3, vy:3+Math.random()*3, vz:uz*(3+Math.random()*3)+(Math.random()-0.5)*3, rx:(Math.random()<0.5?-1:1)*(2+Math.random()*3), rz:(Math.random()-0.5)*4, down:false, live:!!live, fort:t.fort||null }); }
// Z104 one of our riflemen hits a guard up top (x,z = the shooter) — he falls off the platform
export function shootGuard(t, gd, x, z){ if(!gd.alive || t.falling) return false; const ux=(gd.wx||t.x)-x, uz=(gd.wz||t.z)-z, L=Math.hypot(ux,uz)||1;
  dropGuard(t, gd, ux/L, uz/L); floatText('HẠ LÍNH GÁC', '#9be04a', new THREE.Vector3(t.x, 8, t.z), 15); return true; }
// Z104 who a tower guard shoots: the tank, unless one of our foot soldiers is clearly closer
export function towerGuardAim(x, z){ const p=S.player; let best=p.pos, bd=Math.hypot(p.pos.x-x, p.pos.z-z)*0.8;
  for(const a of FT){ const d=Math.hypot(a.pos.x-x, a.pos.z-z); if(d<bd && d<TOWER.range){ bd=d; best=a.pos; } }
  return best; }
// every live guard (cached world position) — for our soldiers' target picking
export function* liveGuards(){ for(const t of towers){ if(t.falling) continue; for(const gd of t.guards) if(gd.alive && gd.wx!=null) yield { t, gd }; } }
export function clearTowers(){ for(const t of towers) scene.remove(t.g); towers.length=0; for(const f of fallers) scene.remove(f.g); fallers.length=0; clearBridges(); clearCamps(); }
export function __set__woodMat(v){ _woodMat=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
export function __set__tinMat(v){ _tinMat=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
