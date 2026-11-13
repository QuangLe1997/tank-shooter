// campaign/boss.js — BOSS FIGHT (Z96): weak-point parts, angle armour, multi-phase attacks, shield pylons, stuns, escorts
import * as THREE from 'three';
import { BALANCE, BOSSFIGHT } from '../../config.js';
import { ARENA, BOSS_DEFS, PROFILE, S, _v, addCoins, addDiamonds, addScore, bigExplode, blocks, buildTank, burst, cMod, camera, campaignCleared, celebrate, clampField, clampFieldXZ, damagePlayer, diffRewardMul, dropBeam, enemyGroundStrike, fieldDepth, flashMat, floatText, fortBossDown, freeEnemyBar, getEnemyBar, heightAt, inBlock, launchEnemyMissile, loopBossMul, loopHpMul, loopRewardMul, opFor, openUpgrade, radio, recordRun, refreshStartUI, ringPulse, saveProfile, saveProgress, scene, setBeam, sfx, show, showBanner, spawnBullet, spawnDebris, spawnEnemy, spawnPart, spawnTankWreck, spawnWreck, takeBeam, tip, updateHUD, wrapAngle } from '../hub.js';

export function bossForStage(st){ return BOSS_DEFS[Math.min(st-1, BOSS_DEFS.length-1)]; }
export let boss=null;
export const BF=BOSSFIGHT;
export function bossAlive(id){ const pt=boss&&boss.parts.find(q=>q.id===id); return !!(pt && pt.hp>0); }
export function startBoss(now){
  const def = bossForStage(S.stage);
  const mesh = buildTank({...def.pal, detail:true, model:'b_'+def.id}); mesh.scale.setScalar(def.scale);   // Z159 the general's own super-heavy
  scene.add(mesh);
  const hp=def.hp*(1+(S.stage-1)*BALANCE.boss.stageRamp)*BALANCE.boss.flat*loopBossMul();
  boss = {
    mesh, turret:mesh.userData.turret, muzzle:mesh.userData.muzzle, def, id:def.id,
    pos:new THREE.Vector3(0,0,-ARENA*0.5), vel:new THREE.Vector3(),
    hp, maxHp:hp, r:3.2*def.scale/3, alive:true, phase:0, invulnUntil:now+1.5, shielded:false,
    facing:0, aim:0, atkAt:now+2.5, mode:'idle', chargeUntil:0, chargeLeft:0, ramAt:0, stunUntil:0, ventUntil:0, attacks:0,
    spiralAng:0, spiralAt:0, laserTelUntil:0, laserFireUntil:0, laserAng:0, laserN:1, blinkAt:now+6, aimTimeout:0, arcFxAt:0, partFxAt:0,
    parts: def.parts.map(pd=>({ ...pd, hp:pd.hp*hp, maxHp:pd.hp*hp, mk:null, bar:null })),
  };
  const mkMat=new THREE.MeshStandardMaterial({color:0x221a10, emissive:0xff8a2a, emissiveIntensity:1.4, roughness:0.4});
  const HP=mesh.userData.hard||{};
  for(const pt of boss.parts){ const mk=new THREE.Mesh(new THREE.OctahedronGeometry(0.2,0), mkMat), hp2=HP[pt.id]; if(hp2){ mk.position.set(hp2.at[0], hp2.at[1]+0.3, hp2.at[2]); (hp2.on==='turret'?mesh.userData.turret:mesh.userData.body).add(mk); } else { mk.position.set(pt.at[0],pt.at[1]+0.25,pt.at[2]); mesh.userData.body.add(mk); } pt.mk=mk; pt.bar=getEnemyBar(); pt.bar.g.scale.setScalar(0.9); }   // Z159 the marker sits ON the real part (and turns with the turret) · glowing weak-point marker + its own HP bar
  boss.dome=new THREE.Mesh(new THREE.SphereGeometry(1,28,18), new THREE.MeshBasicMaterial({color:0x7fd8ff, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
  boss.dome.visible=false; scene.add(boss.dome);
  const bb=document.getElementById('bossbar'); bb.style.display='block';
  document.getElementById('boss-name').textContent = def.name;
  document.getElementById('boss-hp').style.width='100%'; bossStatus();
  showBanner('TƯỚNG ĐỊCH: '+def.name, '#e0603a'); sfx('levelup'); setTimeout(()=>radio(opFor(S.stage).boss), 1200); tip('boss');
}
export function clearBossFight(){ clearPylons(); if(laserMesh) laserMesh.visible=false; if(boss){ for(const pt of boss.parts||[]){ if(pt.bar){ freeEnemyBar(pt.bar); pt.bar=null; } } if(boss.dome) scene.remove(boss.dome); } const st=document.getElementById('boss-st'); if(st){ st.innerHTML=''; st._h=''; } }
export function bossStatus(){ const el=document.getElementById('boss-st'); if(!el||!boss) return; const now=performance.now()/1000;
  const pips=[0,1,2].map(i=>'<i class="'+(i<boss.phase?'done':i===boss.phase?'on':'')+'"></i>').join('');
  let st=''; if(boss.shielded) st='<b class="sh">KHIÊN · PHÁ '+PYLONS.length+' TRỤ</b>'; else if(now<boss.stunUntil) st='<b class="vu">CHOÁNG ×'+BF.stun.mul+'</b>'; else if(now<boss.ventUntil) st='<b class="vu">XẢ NHIỆT ×'+BF.vent.mul+'</b>'; else if(now<boss.invulnUntil) st='<b>ĐỔI PHA…</b>';
  const ph=boss.def.phases[boss.phase]||''; const html='<span class="pp">'+pips+'</span><span class="pn">'+ph+'</span>'+st;
  if(el._h!==html){ el._h=html; el.innerHTML=html; } }
export function bossArcMul(hx, hz){ const dx=hx-boss.pos.x, dz=hz-boss.pos.z, L=Math.hypot(dx,dz)||1, dot=(dx*Math.sin(boss.facing)+dz*Math.cos(boss.facing))/L;
  return dot < -0.35 ? (boss.def.rear||BF.arc.rear) : dot > 0.5 ? (boss.def.front||BF.arc.front) : 1; }
export const _bpw=new THREE.Vector3();
export function partWorld(pt){ pt.mk.getWorldPosition(_bpw); return _bpw; }
export function damageBoss(dmg, hx, hz){
  if(!boss||!boss.alive) return; const now=performance.now()/1000, p=S.player;
  if(boss.shielded){ if(now-boss.arcFxAt>0.5){ boss.arcFxAt=now; floatText('KHIÊN · PHÁ TRỤ!', '#7fd8ff', {x:boss.pos.x,y:boss.r*2.4,z:boss.pos.z}, 15); } boss.dome.material.opacity=0.5; return; }
  if(now<boss.invulnUntil) return;
  let mul=(p&&p.bossMul)||1;
  if(hx!=null){ const am=bossArcMul(hx,hz); mul*=am;
    if(am>1.05 && now-boss.arcFxAt>0.8){ boss.arcFxAt=now; floatText('ĐUÔI XE ×'+am.toFixed(1), '#ffd24a', {x:hx,y:3.4,z:hz}, 15); }
    else if(am<0.7 && now-boss.arcFxAt>1.2){ boss.arcFxAt=now; floatText('GIÁP TRƯỚC ×'+am.toFixed(2), '#9aa3ad', {x:hx,y:3.4,z:hz}, 13); }
    for(const pt of boss.parts){ if(pt.hp<=0) continue; const w=partWorld(pt); if((w.x-hx)**2+(w.z-hz)**2 < (pt.r*boss.def.scale*0.75)**2){ pt.hp-=dmg*mul; flashMat(pt.mk.material,0.1,1); if(pt.hp<=0) breakPart(pt); mul*=BF.part.share; break; } } }
  if(now<boss.stunUntil) mul*=BF.stun.mul; else if(now<boss.ventUntil) mul*=BF.vent.mul;
  boss.hp -= dmg*mul; if(now-(boss.flashAt||0)>0.2){ boss.flashAt=now; boss.mesh.traverse(o=>{ if(o.material && !Array.isArray(o.material) && o!==boss.dome) flashMat(o.material, 0.07, 0.4); }); }   // throttled, soft hit flash (no white-out under sustained fire)
  document.getElementById('boss-hp').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';
  if(boss.hp<=0){ boss.hp=0; killBoss(now); return; }
  const f=boss.hp/boss.maxHp; if(boss.phase<BF.phases.length && f<=BF.phases[boss.phase]) bossPhase(now);
}
export function breakPart(pt){ const w=partWorld(pt).clone(); pt.hp=0; pt.mk.visible=false; freeEnemyBar(pt.bar); pt.bar=null;
  bigExplode({x:w.x,z:w.z}, 0xff8a3a, 1.3); spawnDebris({x:w.x,z:w.z}, 0.8, 0x3a3a34); S.shake=Math.min(3,S.shake+0.8); sfx('bigexplode');
  floatText('PHÁ HUỶ: '+pt.vi, '#ffcf5a', {x:w.x,y:5,z:w.z}, 20); showBanner(pt.vi+' ĐÃ BỊ PHÁ — '+pt.fx, '#ffcf5a');
  boss.hp -= boss.maxHp*0.03; addScore(400, new THREE.Vector3(w.x,3,w.z));                             // breaking a system rocks the whole hull
  if(pt.id==='trackL'||pt.id==='trackR') boss.slow=(boss.slow||1)*0.72; }
// ---- phase change: invulnerable roar, shockwave shoves you back, escorts roll in, shield pylons rise for the shield phases ----
export function bossPhase(now){
  boss.phase++; const T=BF.transition, p=S.player; boss.invulnUntil=now+T.invuln; boss.mode='idle'; boss.atkAt=now+T.invuln+0.6; boss.laserFireUntil=0; boss.laserTelUntil=0;
  ringPulse(boss.pos, 0xffffff, T.blastR); setTimeout(()=>ringPulse(boss.pos,0xff5028,T.blastR*1.3),180); bigExplode(boss.pos, boss.def.pal.accent, 2.2); S.shake=Math.min(3.5,S.shake+2);
  const dx=p.pos.x-boss.pos.x, dz=p.pos.z-boss.pos.z, d=Math.hypot(dx,dz)||1; if(d<T.blastR*2){ p.kbx+=dx/d*T.push; p.kbz+=dz/d*T.push; if(d<T.blastR) damagePlayer(T.blastDmg, now, dx, dz); }
  showBanner('PHA '+(boss.phase+1)+' · '+boss.def.phases[boss.phase], '#ff6a3a'); sfx('alarm');
  radio(boss.def.name+': "'+boss.def.taunt[(boss.phase-1)%boss.def.taunt.length]+'"');
  const n=T.escorts[boss.phase]||0, types=boss.id==='tempest'?['scout','gunship']:boss.id==='goliath'?['heavy','grunt']:boss.id==='reaper'?['sniper','scout']:['grunt','shield'];
  for(let i=0;i<n;i++){ const a=Math.random()*6.283; spawnEnemy(types[i%types.length], boss.pos.x+Math.cos(a)*9, boss.pos.z+Math.sin(a)*9); }
  if(boss.def.shield.includes(boss.phase)) raiseShield(now);
  bossStatus();
}
// ---- SHIELD PYLONS ----
export const PYLONS=[];
export function raiseShield(now){
  const P=BF.pylon, hp=Math.round(P.hp*(1+(S.stage-1)*P.perStage)*loopHpMul()); boss.shielded=true; boss.dome.visible=true;
  for(let i=0;i<P.n;i++){ const a=i/P.n*6.283+Math.random()*0.5; let x=Math.cos(a)*P.ring, z=Math.sin(a)*P.ring*0.85; [x,z]=clampFieldXZ(x, z, 6);
    const g=new THREE.Group(); g.position.set(x,heightAt(x,z),z); scene.add(g);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.4,0.7,8), new THREE.MeshStandardMaterial({color:0x2a2e34,roughness:0.5,metalness:0.8})); base.position.y=0.35; g.add(base);
    const col=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.55,4.2,8), new THREE.MeshStandardMaterial({color:0x3a4048,roughness:0.4,metalness:0.85})); col.position.y=2.6; g.add(col);
    for(const y of [1.6,2.6,3.6]){ const rr=new THREE.Mesh(new THREE.TorusGeometry(0.62,0.07,8,20), new THREE.MeshStandardMaterial({color:0x101418,emissive:0x5fd0ff,emissiveIntensity:1.6})); rr.rotation.x=Math.PI/2; rr.position.y=y; g.add(rr); }
    const orb=new THREE.Mesh(new THREE.SphereGeometry(0.55,16,12), new THREE.MeshStandardMaterial({color:0x0a1418,emissive:0x8fe8ff,emissiveIntensity:2.4})); orb.position.y=5.0; g.add(orb);
    g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
    const beam=takeBeam(); beam.material.color.setHex(0x7fd8ff);
    const b={ mesh:g, x, z, r:1.4, hp, maxHp:hp, steel:false, loot:false, kind:'pylon', beam, orb }; blocks.push(b); PYLONS.push(b); }
  radio('SCH: '+boss.def.name+' đang được khiên năng lượng bảo vệ — phá '+P.n+' trụ phát!'); tip('shield');
}
export function damagePylon(b, dmg){ b.hp-=dmg; flashMat(b.orb.material,0.1,1); burst({x:b.x,z:b.z}, 0x8fe8ff, 3, 4, {y:3.5, life:0.3, size:0.3, grav:-8, drag:2, up:2});
  if(b.hp>0) return; const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1); const j=PYLONS.indexOf(b); if(j>=0) PYLONS.splice(j,1);
  dropBeam(b.beam); scene.remove(b.mesh); bigExplode({x:b.x,z:b.z}, 0x7fd8ff, 1.6); sfx('bigexplode'); floatText('TRỤ ĐÃ SẬP', '#7fd8ff', {x:b.x,y:5,z:b.z}, 20);
  if(!PYLONS.length && boss && boss.alive){ boss.shielded=false; boss.dome.visible=false; const now=performance.now()/1000; boss.ventUntil=now+4; boss.mode='vent';
    showBanner('KHIÊN ĐÃ SẬP — DỒN HOẢ LỰC!', '#7fd8ff'); sfx('levelup'); bossStatus(); } }
export function clearPylons(){ for(const b of PYLONS){ dropBeam(b.beam); scene.remove(b.mesh); const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1); } PYLONS.length=0; }
// ---- attack toolkit ----
export function bossSpread(now, n, spd){
  boss.muzzle.getWorldPosition(_v);
  for(let i=0;i<n;i++){ const a = (n>3 ? (i/n*Math.PI*2) : boss.aim + (i-(n-1)/2)*0.35);
    spawnBullet(_v.x,_v.z,a,{owner:'e',dmg:14,speed:spd,color:0xff6030,r:0.5,life:3.2,scale:1.4}); }
  sfx('enemyShoot', boss&&boss.pos);
}
export const mines=[];
export function bossMine(x,z){
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.7,12,10), new THREE.MeshStandardMaterial({color:0x802018,emissive:0xff3020,emissiveIntensity:0.6,roughness:0.5}));
  m.position.set(x,heightAt(x,z)+0.5,z); scene.add(m);
  mines.push({mesh:m,x,z,armAt:performance.now()/1000+0.6, life:9});
}
export function updateMines(dt, now){
  const p=S.player;
  for(let i=mines.length-1;i>=0;i--){ const mn=mines[i]; mn.life-=dt;
    mn.mesh.material.emissiveIntensity = 0.4 + Math.sin(now*8)*0.3;
    if(now>mn.armAt && (p.pos.x-mn.x)**2+(p.pos.z-mn.z)**2 < 9){ enemyGroundStrike(mn.x,mn.z,4.5,26,now); scene.remove(mn.mesh); mines.splice(i,1); continue; }
    if(mn.life<=0){ scene.remove(mn.mesh); mines.splice(i,1); }
  }
}
export function clearMines(){ for(const mn of mines){ scene.remove(mn.mesh); } mines.length=0; }
export let laserMesh=null;
export function getLaser(){ if(!laserMesh){ laserMesh=new THREE.Mesh(new THREE.BoxGeometry(1,0.4,1).translate(0,0,0.5),
  new THREE.MeshBasicMaterial({color:0xff4060,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); laserMesh.position.y=1.2; scene.add(laserMesh);} return laserMesh; }
// how far a beam travels before solid cover stops it (walls, rocks, towers, camps, pylons)
export function beamReach(x, z, ang, max){ const sx=Math.sin(ang), sz=Math.cos(ang);
  for(let t=2; t<max; t+=0.8){ const px=x+sx*t, pz=z+sz*t; for(const b of blocks){ if(b.kind==='pylon') continue; if((b.x-px)**2+(b.z-pz)**2 < 64 && inBlock(b, px, pz, 0.2)) return t; } } return max; }
export function bossSummon(type, n){ for(let i=0;i<n;i++){ const a=Math.random()*6.28, r=7; spawnEnemy(type, boss.pos.x+Math.cos(a)*r, boss.pos.z+Math.sin(a)*r); } }
export function bossMissiles(now, n){                                                          // real missiles: shoot them down, pop smoke, APS eats them
  const pods = boss.parts.filter(q=>q.id.startsWith('pod')), live = pods.length ? pods.filter(q=>q.hp>0).length : 2; if(!live) return false;
  const k = Math.max(1, Math.round(n*live/2)), guided = bossAlive('radar')||!boss.parts.some(q=>q.id==='radar') ? 1.9 : 0;
  boss.muzzle.getWorldPosition(_v);
  for(let i=0;i<k;i++) setTimeout(()=>{ if(!boss||!boss.alive) return; const a=boss.aim+(i-(k-1)/2)*0.32; launchEnemyMissile(_v.x, _v.y+1, _v.z, a, { speed:24, dmg:13, aoe:3, guided, life:3.6, kind:'atgm' }); }, i*140);
  return true;
}
export function artyBarrage(now){                                                              // a walking line of shells marching onto your position
  const B=BF.barrage, p=S.player, a=Math.atan2(p.pos.x-boss.pos.x, p.pos.z-boss.pos.z), d0=Math.max(6, Math.hypot(p.pos.x-boss.pos.x, p.pos.z-boss.pos.z)-B.step*(B.shells/2));
  for(let i=0;i<B.shells;i++){ const d=d0+i*B.step, x=boss.pos.x+Math.sin(a)*d+(Math.random()-0.5)*1.5, z=boss.pos.z+Math.cos(a)*d+(Math.random()-0.5)*1.5;
    setTimeout(()=>ringPulse({x,z}, 0xff3020, B.r), i*B.gap*1000);
    setTimeout(()=>{ if(S.mode!=='playing') return; enemyGroundStrike(x, z, B.r, B.dmg, performance.now()/1000); }, (B.lead+i*B.gap)*1000); }
  radio('SCH: Pháo kích theo hàng — chạy ngang ra!');
}
export function groundPound(now){
  const x=boss.pos.x, z=boss.pos.z; ringPulse({x,z},0xffffff,8); setTimeout(()=>ringPulse({x,z},0xffffff,8),260);
  setTimeout(()=>{ if(S.mode!=='playing') return; S.shake=2; ringPulse({x,z},0xff5028,14); bigExplode({x,z},0xb0b0c0,2.2);
    const p=S.player, n=performance.now()/1000; if(n>=p.invincibleUntil && (p.pos.x-x)**2+(p.pos.z-z)**2 < 121) damagePlayer(30,n); }, 600);
}
export function stunBoss(now, why){ if(!boss||now<boss.stunUntil) return; boss.stunUntil=now+BF.stun.time; boss.mode='stun'; boss.chargeLeft=0; boss.vel.set(0,0,0);
  S.shake=Math.min(3.2,S.shake+1.6); sfx('clang'); bigExplode(boss.pos, 0xffd27a, 1.2); floatText('CHOÁNG! ×'+BF.stun.mul, '#ffe08a', {x:boss.pos.x,y:boss.r*2.6,z:boss.pos.z}, 26);
  if(why) radio('SCH: '+why); bossStatus(); }
export function ventBoss(now){ boss.ventUntil=now+BF.vent.time; boss.mode='vent'; floatText('XẢ NHIỆT — BẮN NGAY!', '#ff9a5a', {x:boss.pos.x,y:boss.r*2.6,z:boss.pos.z}, 22); bossStatus(); }
export function updateBoss(dt, now){
  if(!boss || !boss.alive) return;
  const p=S.player, B=boss, sc=B.def.scale; B._px=B.pos.x; B._pz=B.pos.z;
  B.aim = Math.atan2(p.pos.x-B.pos.x, p.pos.z-B.pos.z);
  const lim=ARENA-4, laser=getLaser();
  // part markers pulse + HP bars; broken systems smoke
  { const sp=B.mesh.userData.spin; if(sp && bossAlive('radar')) sp.rotation.y+=dt*1.8; }   // Z159 the radar sweeps until it's shot off
  for(const pt of B.parts){ if(pt.hp>0){ pt.mk.rotation.y+=dt*2; pt.mk.material.emissiveIntensity=1.1+Math.sin(now*6)*0.5; const w=partWorld(pt);
      pt.bar.g.position.set(w.x, w.y+1.4, w.z); pt.bar.g.quaternion.copy(camera.quaternion); const f=pt.hp/pt.maxHp; pt.bar.fill.scale.x=Math.max(0.001,f); pt.bar.fill.position.x=-(1-f)*0.5; pt.bar.fill.material.color.setHex(0xffa040); }
    else if(Math.random()<0.15){ const w=partWorld(pt); spawnPart(w.x,w.y,w.z,(Math.random()-0.5),2,(Math.random()-0.5),{color:0x1a1612,size:1.2,life:1.2,smoke:true,grav:-0.4,drag:1.4,op:0.5}); } }
  if(B.shielded){ B.dome.position.set(B.pos.x, B.r*0.9, B.pos.z); B.dome.scale.setScalar(B.r*2.1); B.dome.material.opacity += (0.2+Math.sin(now*3)*0.05 - B.dome.material.opacity)*Math.min(1,dt*5);
    for(const py of PYLONS) setBeam(py.beam, py.x, heightAt(py.x,py.z)+5, py.z, B.pos.x, B.r*1.2, B.pos.z); }
  if((Math.floor(now*4))!==B._stT){ B._stT=Math.floor(now*4); bossStatus(); }
  // ---- LASER: telegraph, then a beam that WALLS BLOCK ----
  if(now < B.laserTelUntil || now < B.laserFireUntil){
    const fire = now >= B.laserTelUntil, n=B.laserN||1;
    if(!fire) B.laserAng += wrapAngle(B.aim-B.laserAng)*Math.min(1,dt*1.6); else B.laserAng += B.laserSweep*dt;   // tracks during charge-up, then sweeps
    const reach = beamReach(B.pos.x, B.pos.z, B.laserAng, 80);
    laser.visible=true; laser.position.set(B.pos.x,1.4,B.pos.z); laser.rotation.y=B.laserAng; laser.scale.set(fire?2.2:0.3,1,reach); laser.material.opacity = fire?0.85:0.25+Math.sin(now*22)*0.15;
    if(fire && reach<79 && Math.random()<0.6){ const hx=B.pos.x+Math.sin(B.laserAng)*reach, hz=B.pos.z+Math.cos(B.laserAng)*reach; spawnPart(hx,1.4,hz,(Math.random()-0.5)*6,3,(Math.random()-0.5)*6,{color:0xff8090,size:0.4,life:0.25,grav:-10,drag:2}); }   // sparks where cover eats the beam
    if(fire){ const dx=p.pos.x-B.pos.x, dz=p.pos.z-B.pos.z, fx=Math.sin(B.laserAng), fz=Math.cos(B.laserAng), along=dx*fx+dz*fz;
      if(along>0 && along<reach && Math.abs(-fz*dx+fx*dz)<2.4 && now>B.ramAt){ damagePlayer(24, now, fx, fz); B.ramAt=now+0.35; } }
    B.vel.multiplyScalar(0.85);
  } else laser.visible=false;
  const lasering = now < B.laserFireUntil;
  // ---- LOCOMOTION (hull must turn to face you before it can charge — the readable tell) ----
  const slow=B.slow||1, turnRate = (B.id==='goliath'?1.2 : B.id==='reaper'?2.6 : 1.9) * dt * (B.phase>=2?1.25:1);
  const angP=B.aim, distP=Math.hypot(p.pos.x-B.pos.x, p.pos.z-B.pos.z);
  const steer=(tgt)=>{ let d=wrapAngle(tgt-B.facing); if(d>turnRate)d=turnRate; else if(d<-turnRate)d=-turnRate; B.facing=wrapAngle(B.facing+d); };
  const driveFwd=(spd)=>{ B.pos.x += Math.sin(B.facing)*spd*dt*slow; B.pos.z += Math.cos(B.facing)*spd*dt*slow; };
  if(now < B.invulnUntil || B.mode==='stun' || B.mode==='vent'){
    if(B.mode==='stun'){ if(Math.random()<0.4) spawnPart(B.pos.x+(Math.random()-0.5)*B.r, B.r*1.6, B.pos.z+(Math.random()-0.5)*B.r, 0,1.5,0,{color:0xffe08a,size:0.5,life:0.4,grav:0,drag:2}); if(now>=B.stunUntil){ B.mode='idle'; B.atkAt=now+0.6; } }
    if(B.mode==='vent'){ if(Math.random()<0.7) spawnPart(B.pos.x+(Math.random()-0.5)*B.r, B.r*1.3, B.pos.z+(Math.random()-0.5)*B.r, (Math.random()-0.5)*2, 5, (Math.random()-0.5)*2, {color:0xe8e4dc, size:1.6, life:0.9, smoke:true, grav:-1, drag:1.2, op:0.55});
      B.turret.traverse(o=>{ if(o.material&&o.material.emissive&&!Array.isArray(o.material)){ o.material.emissive.setHex(0xff3a10); o.material.emissiveIntensity=0.25+0.2*Math.sin(now*10); } });
      if(now>=B.ventUntil){ B.mode='idle'; B.atkAt=now+0.5; B.turret.traverse(o=>{ if(o.material&&o.material.emissive&&!Array.isArray(o.material)) o.material.emissiveIntensity=0; }); } }
  } else if(lasering){ /* hold while the beam fires */ }
  else if(B.mode==='aim'){
    steer(angP); if(Math.random()<0.3) ringPulse(B.pos, 0xff3020, B.r*1.7);
    if(Math.abs(wrapAngle(angP - B.facing)) < 0.16){ B.mode='charge'; B.chargeUntil = now + (B.phase>=1?0.95:0.8); sfx('hurt'); }
    else if(now > B.aimTimeout){ B.mode='idle'; B.atkAt = now + 1.0; }
  } else if(B.mode==='charge'){
    if(now < B.chargeUntil){ const ox=B.pos.x, oz=B.pos.z; driveFwd(B.phase>=1?56:46);
      if(Math.random()<0.6) burst(B.pos,0xff5028,2,5,{y:1.5});
      if(fieldDepth(B.pos.x, B.pos.z) < 4){ stunBoss(now, B.def.name+' đâm vào hàng rào — nó đang choáng!'); }
      if(distP < B.r+p.radius+0.6 && now>B.ramAt){ damagePlayer(bossAlive('plow')||B.id!=='bull'?34:17,now); B.ramAt=now+0.6; } }
    else if(B.chargeLeft>0){ B.chargeLeft--; B.mode='aim'; B.aimTimeout=now+1.6; }        // chained charges in later phases
    else { B.mode='idle'; B.atkAt = now + 1.4; }
  } else {
    B.mode='idle';
    const keep = B.id==='goliath' ? 20 : 23; steer(angP);
    const facingP = Math.abs(wrapAngle(angP - B.facing)) < 0.8; let spd=0;
    if(distP > keep+3) spd = (B.id==='goliath'?9:13); else if(distP < keep-3) spd = -(B.id==='goliath'?6:8);
    if(spd>0 ? facingP : true) driveFwd(spd);
    if(B.id==='tempest' && now>B.spiralAt){ B.spiralAng+=0.5; spawnBullet(B.pos.x,B.pos.z,B.spiralAng,{owner:'e',dmg:7,speed:20,color:0x9fe0ff,r:0.4,life:4.2}); B.spiralAt=now+(B.phase>=2?0.07:0.1); }
    if(now>B.atkAt && !B.shielded || (B.shielded && now>B.atkAt)) bossAttack(now, B.phase);
  }
  clampField(B.pos, 4);
  if(dt>0){ B.vel.set((B.pos.x-B._px)/dt, 0, (B.pos.z-B._pz)/dt); }   // real hull velocity → collisions know how hard it hit
  B.mesh.position.set(B.pos.x,0,B.pos.z); B.mesh.rotation.y=B.facing;
  B.turret.rotation.y=wrapAngle(B.aim-B.facing);
}
// each general's attack menu by phase (0,1,2) — systems that are broken drop out of the menu
export function bossAttack(now, ph){
  const B=boss, id=B.id, r=Math.random(), big=()=>{ B.attacks++; if(B.attacks%BF.vent.every===0 && !B.shielded){ setTimeout(()=>{ if(boss===B&&B.alive&&B.mode==='idle') ventBoss(performance.now()/1000); }, 1400); } };
  const laser=(n,sweep,tel)=>{ if(B.parts.some(q=>q.id==='emitter') && !bossAlive('emitter')) return false; B.laserTelUntil=now+(tel||0.9); B.laserFireUntil=B.laserTelUntil+0.6+0.2*n; B.laserAng=B.aim; B.laserN=n; B.laserSweep=(Math.random()<0.5?-1:1)*sweep; return true; };
  if(id==='bull'){
    if(r<(ph===0?0.65:0.75)){ B.mode='aim'; B.aimTimeout=now+2.4; B.chargeLeft=ph; big(); }   // turn-to-face then charge (chains of 1/2/3)
    else if(ph>=1 && r<0.88){ groundPound(now); B.atkAt=now+2.4; }
    else { bossSpread(now, ph===2?9:ph===1?5:3, 30); B.atkAt=now+2.2; }
  } else if(id==='tempest'){
    if(r<0.45 && bossMissiles(now, ph===2?6:ph===1?4:3)){ B.atkAt=now+(ph===2?2.0:2.8); big(); }
    else if(r<0.75){ bossSpread(now, ph===2?14:ph===1?10:8, 28); B.atkAt=now+1.6; }
    else if(ph>=1 && r<0.88){ artyBarrage(now); B.atkAt=now+3; big(); }
    else { bossSummon(ph>=2?'gunship':'scout', ph>=1?2:1); B.atkAt=now+3.5; }
  } else if(id==='goliath'){
    if(r<0.4 && bossAlive('gun')){ bossSpread(now, ph===2?16:12, 24); B.atkAt=now+(ph===2?1.6:2.2); }
    else if(r<0.62){ groundPound(now); B.atkAt=now+2.6; big(); }
    else if(r<0.82){ artyBarrage(now); B.atkAt=now+3.2; big(); }
    else if(bossAlive('mines')){ for(let i=0;i<(ph===2?6:4);i++){ const a=Math.random()*6.28,rr=4+Math.random()*12; bossMine(B.pos.x+Math.cos(a)*rr, B.pos.z+Math.sin(a)*rr); } B.atkAt=now+3; }
    else { B.atkAt=now+1.2; }
  } else if(id==='reaper'){
    if(r<0.5 && laser(ph>=1?2:1, ph>=2?0.9:0.55, ph>=2?0.7:0.9)){ B.atkAt=now+2.8; big(); }
    else if(r<0.8){ if(now>B.blinkAt && bossAlive('drive')){ const a=Math.random()*6.28,rr=18; B.pos.set(S.player.pos.x+Math.cos(a)*rr,0,S.player.pos.z+Math.sin(a)*rr); bigExplode(B.pos,0xa066ff,1.4); B.blinkAt=now+(ph>=2?2.2:3.5); } bossSpread(now, ph===2?10:6, 30); B.atkAt=now+1.8; }
    else { bossSummon(ph>=1?'sniper':'scout', ph>=1?2:3); B.atkAt=now+3; }
  } else {                                                                     // OVERLORD — everything, faster each phase
    const q=ph===2?0.75:1;
    if(r<0.18){ B.mode='aim'; B.aimTimeout=now+2.2; B.chargeLeft=ph>=2?1:0; big(); }
    else if(r<0.34 && bossAlive('gun')){ bossSpread(now, ph===2?18:14, 26); B.atkAt=now+1.6*q; }
    else if(r<0.52 && bossMissiles(now, ph===2?6:4)){ B.atkAt=now+2.2*q; big(); }
    else if(r<0.68 && laser(ph>=2?2:1, 0.7, 0.8)){ B.atkAt=now+2.6*q; big(); }
    else if(r<0.84){ artyBarrage(now); B.atkAt=now+2.8*q; }
    else if(r<0.92){ for(let i=0;i<4;i++){ const a=Math.random()*6.28,rr=5+Math.random()*12; bossMine(B.pos.x+Math.cos(a)*rr, B.pos.z+Math.sin(a)*rr); } B.atkAt=now+2.4*q; }
    else { bossSummon('bomber', 2); B.atkAt=now+3; }
  }
}
export function killBoss(now){
  if(!boss) return; boss.alive=false;
  document.getElementById('bossbar').style.display='none';
  S.timeScale=0.35;                                   // slow-mo
  const pos=boss.pos.clone(); const bs=boss.r/1.5;            // boss scale → huge shatter
  const bpal=boss.def.pal, bms=boss.mesh.scale.x;             // capture before boss=null (used in the delayed bursts below)
  spawnTankWreck(pos, bms, bpal);                             // boss bursts into giant components
  spawnWreck(pos, boss.facing, bms, bpal, true);              // and its huge turret is hurled into the air
  for(let k=0;k<6;k++) setTimeout(()=>{ const ep=new THREE.Vector3(pos.x+(Math.random()-0.5)*6,1,pos.z+(Math.random()-0.5)*6);
    bigExplode(ep, 0xff7a3d, 2.2); if(k<3) spawnTankWreck(ep, bms*0.55, bpal); }, k*130);   // a few extra part-bursts (pool-budget friendly)
  addScore(2500*S.stage, new THREE.Vector3(pos.x,3,pos.z));
  const bcoin = Math.round((BALANCE.boss.coinBase + BALANCE.boss.coinPerStage*S.stage)*loopRewardMul()*cMod('coinMul')), bdia = BALANCE.boss.dia + (S.loop||0)*BALANCE.loop.bossDia + cMod('bossDiaBonus',0);   // bigger payout each NG+ loop + CONTRACT bonus
  addCoins(bcoin); addDiamonds(bdia);
  showBanner('ĐÃ HẠ '+boss.def.name+'!  +'+bcoin+' xu · +'+bdia+' ◆', '#8cbf3f'); sfx('levelup');
  const m=boss.mesh; setTimeout(()=>{ scene.remove(m); }, 900);
  if(laserMesh) laserMesh.visible=false; clearMines(); clearPylons(); for(const pt of boss.parts){ if(pt.bar){ freeEnemyBar(pt.bar); pt.bar=null; } } scene.remove(boss.dome); { const st=document.getElementById('boss-st'); if(st){ st.innerHTML=''; st._h=''; } }
  fortBossDown();                                   // Z107 the citadel falls with its commander
  const wasFinal = S.stage >= BOSS_DEFS.length;     // beat the last boss → victory
  boss=null;
  S.awaitingUpgrade=true; S.wave=0;                 // freeze wave system until upgrade chosen
  S.stage++; addCoins(Math.round(BALANCE.stageClearCoin*S.stage*cMod('coinMul')*diffRewardMul())); updateHUD(); saveProgress(); campaignCleared((S.loop||0)*5 + S.stage-1);   // Z107 next campaign level opens   // stage-clear coin bonus (×CONTRACT ×DIFFICULTY) + advance the resumable checkpoint
  celebrate('victory', 0, 0);                                                         // Z140 fireworks, cheering troops — then the next screen
  if(wasFinal){ setTimeout(()=>{ if(S.mode!=='gameover') victory(); }, 5600); }
  else { setTimeout(()=>{ if(S.mode!=='gameover') openUpgrade(); }, 5400); }
}
export function victory(){
  S.mode='victory';
  document.getElementById('vic-score').textContent = S.score.toLocaleString();
  recordRun();
  const nl=(S.loop||0)+1;
  if(!(S.run && S.run.mode==='custom')){ PROFILE.save={ loop:nl, stage:1, score:S.score }; saveProfile(); } else S.runCfg={ ...S.run, level:nl*5+1 }; refreshStartUI();   // custom: the next loop keeps your map/hour/weather   // advance the campaign into the next NG+ loop
  const nb=document.getElementById('ngplusBtn'); if(nb) nb.textContent='VÀO VÒNG MỚI+'+nl+' ▶';
  const vs=document.querySelector('#victory .subtitle'); if(vs) vs.textContent='Vòng mới+'+nl+' đang chờ — địch mạnh hơn, thưởng lớn hơn';
  document.body.classList.remove('corelow');
  show('victory'); sfx('levelup');
}
export function __set_boss(v){ boss=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
