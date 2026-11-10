// combat/spells.js — SPELLS (one equipped; cast on cooldown)
import * as THREE from 'three';
import { BALANCE, EQUIP, TROOPS } from '../../config.js';
import { MOBILE, S, airstrike, armorOf, bigExplode, blocks, boss, bullets, burst, callFireteam, core, damageBlock, damageBoss, damageCore, damageEnemy, damagePlayer, decalScorch, deformCrater, dropBeam, enemies, envDmg, fireball, floatText, gradePass, haptic, heightAt, recycleBullet, ringPulse, scene, sfx, spawnPart, structMul, typeMul, updateHUD, updateSpellHUD } from '../hub.js';

// ===== SPELLS (one equipped; cast on cooldown) =====
export const SPELLS = [
  { id:'overdrive', name:'OVERDRIVE', vi:'TĂNG TỐC', svg:'bolt', cd:11, cast(now){ const p=S.player; p.overUntil=now+5; ringPulse(p.pos,0x8cbf3f,3); } },
  { id:'aegis',     name:'AEGIS', vi:'KHIÊN AEGIS',    svg:'shield', cd:13, cast(now){ const p=S.player; p.invincibleUntil=now+3; p.shieldUntil=now+3; } },
  { id:'emp',       name:'EMP', vi:'XUNG EMP',      svg:'emp', cd:12, cast(now){ const p=S.player; ringPulse(p.pos,0x6fd0ff,10); aoeDamage(p.pos.x,p.pos.z,16,40,true,now,null,true); bigExplode(p.pos,0x6fd0ff,1.6); } },
  { id:'repair',    name:'REPAIR', vi:'SỬA CHỮA', svg:'heart', cd:14, cast(now){ const p=S.player; p.hp=Math.min(p.maxHp,p.hp+45); if(core)core.hp=Math.min(core.maxHp,core.hp+45); ringPulse(p.pos,0x5fd06a,3); updateHUD(); } },
  { id:'airstrike', name:'AIRSTRIKE', vi:'KHÔNG KÍCH', svg:'crosshair', cd:15, cast(now){ airstrike(now); } },
  { id:'timewarp',  name:'TIME WARP', vi:'CHẬM THỜI GIAN', svg:'hourglass', cd:14, cast(now){ S.enemySlowUntil=now+4; ringPulse(S.player.pos,0xc0a0ff,12); } },
  { id:'smoke',     name:'SMOKE', vi:'LỰU KHÓI',     svg:'smoke', cd:12, cast(now){ castSmoke(now); } },        // Z82 equipment: smoke screen
  { id:'aps',       name:'APS', vi:'GIÁP CHỦ ĐỘNG',       svg:'aps',   cd:16, cast(now){ castAPS(now); } },          // Z82 active protection (hard-kill)
  { id:'mines',     name:'MINES', vi:'RẢI MÌN',     svg:'mine',  cd:14, cast(now){ castMines(now); } },        // Z82 anti-tank mines
  { id:'fireteam',  name:'FIRETEAM', vi:'GỌI TỔ BỘ BINH',  svg:'team',  cd:TROOPS.fireteam.cd, cast(now){ callFireteam(now); } },   // Z89 friendly APC drops an infantry squad
];
// ===== Z82 · TANK EQUIPMENT — each piece answers a specific threat =====
export function inSmoke(now){ const p=S.player; return !!(p && now<(p.smokeUntil||0) && Math.hypot(p.pos.x-p.smokeX, p.pos.z-p.smokeZ) < EQUIP.smoke.radius); }
export function castSmoke(now){ const p=S.player, E=EQUIP.smoke; p.smokeUntil=now+E.dur; p.smokeX=p.pos.x; p.smokeZ=p.pos.z;
  for(let k=0;k<8;k++){ const a=p.facing+(k-3.5)*0.42, sp=9+Math.random()*3;                       // 8 grenades fan out from the turret dischargers
    spawnPart(p.pos.x, 2.6, p.pos.z, Math.sin(a)*sp, 7, Math.cos(a)*sp, {color:0xf0f0e0, size:0.5, life:0.45, grav:-22, drag:0.6}); }
  for(const e of enemies) if(e.laser){ dropBeam(e.laser); e.laser=null; e.aimT=0; }                  // laser designators lose you
  sfx('dash'); floatText('MÀN KHÓI','#dfe6e0',p.pos,17); }
export function castAPS(now){ const p=S.player, E=EQUIP.aps; p.apsUntil=now+E.dur; p.apsCharges=E.charges; ringPulse(p.pos,0x7fe7ff,E.radius); floatText('APS BẬT · '+E.charges,'#7fe7ff',p.pos,17); sfx('beep'); }
export function apsIntercept(x,y,z){ const p=S.player; p.apsCharges--;
  spawnPart(p.pos.x,2.6,p.pos.z,(x-p.pos.x)*6,(y-2.6)*6,(z-p.pos.z)*6,{tex:'flash', color:0xbff6ff, size:1.2, life:0.08, grav:0, drag:0});   // counter-charge fires
  bigExplode({x,z}, 0xbff6ff, 0.55); burst({x,z}, 0xfff2c0, 8, 7, {y, life:0.25, size:0.3, grav:-12, drag:2});
  floatText(p.apsCharges>0?'APS · '+p.apsCharges:'APS ĐÃ CẠN','#7fe7ff',{x:p.pos.x,y:3.4,z:p.pos.z},14); sfx('hit'); haptic(12); }
export const PMINES=[]; export let _mineGeo=null, _mineMat=null, _mineLed=null;
export function castMines(now){ const p=S.player, E=EQUIP.mines;
  if(!_mineGeo){ _mineGeo=new THREE.CylinderGeometry(0.55,0.62,0.22,16); _mineMat=new THREE.MeshStandardMaterial({color:0x4a5230,roughness:0.7,metalness:0.35}); _mineLed=new THREE.MeshStandardMaterial({color:0,emissive:0xff2a1a,emissiveIntensity:2}); }
  for(let k=0;k<E.count;k++){ const a=p.facing+Math.PI+(k-(E.count-1)/2)*0.5, r=2.6+k%2*0.8, x=p.pos.x+Math.sin(a)*r, z=p.pos.z+Math.cos(a)*r;
    const m=new THREE.Mesh(_mineGeo,_mineMat); m.castShadow=true; m.position.set(x,heightAt(x,z)+0.1,z); const led=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,4),_mineLed); led.position.y=0.15; m.add(led); scene.add(m);
    PMINES.push({ m, led, x, z, arm:now+E.arm, die:now+E.life }); }
  sfx('clang'); floatText('ĐÃ RẢI MÌN ×'+E.count,'#c8d870',p.pos,16); }
export function updateEquip(dt, now){
  const p=S.player; if(!p) return;
  if(now<(p.smokeUntil||0)){ const left=p.smokeUntil-now, R=EQUIP.smoke.radius;                    // the screen billows, then thins out
    for(let k=0;k<(MOBILE?2:3);k++) if(Math.random()<Math.min(1,left/2)){ const a=Math.random()*6.283, r=Math.sqrt(Math.random())*R;
      spawnPart(p.smokeX+Math.cos(a)*r, heightAt(p.smokeX,p.smokeZ)+0.8+Math.random()*1.5, p.smokeZ+Math.sin(a)*r, (Math.random()-0.5)*0.8, 0.3+Math.random()*0.4, (Math.random()-0.5)*0.8, {color:0xd8dcd4, size:3+Math.random()*2, life:2.2, smoke:true, grav:-0.05, drag:0.8, grow:1.6, op:0.5}); } }
  if(p.apsCharges>0 && now<(p.apsUntil||0)){
    if(Math.random()<0.05) ringPulse(p.pos, 0x7fe7ff, EQUIP.aps.radius*0.6);
    for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; if(b.owner!=='e' || b.r<0.6) continue;   // heavy shells too
      if(Math.hypot(b.x-p.pos.x, b.z-p.pos.z) < EQUIP.aps.radius){ apsIntercept(b.x, b.by+heightAt(b.x,b.z), b.z); recycleBullet(i); if(p.apsCharges<=0) break; } } }
  for(let i=PMINES.length-1;i>=0;i--){ const M=PMINES[i]; M.led.visible = now<M.arm ? true : Math.floor(now*2.5+i)%2===0;
    let boom = now>M.die;
    if(!boom && now>=M.arm) for(const e of enemies){ if(e.def.air) continue; if(Math.hypot(e.pos.x-M.x, e.pos.z-M.z) < (e.def.inf?0.9:e.r+0.6)){ boom=true; break; } }
    if(!boom && now>=M.arm && boss && boss.alive && Math.hypot(boss.pos.x-M.x, boss.pos.z-M.z) < boss.r+0.6) boom=true;
    if(boom){ scene.remove(M.m); PMINES.splice(i,1); if(now>M.die) continue;
      const E=EQUIP.mines; bigExplode({x:M.x,z:M.z}, 0xff8a3a, 1.4); deformCrater(M.x,M.z,1.6,0.4); decalScorch(M.x,M.z,3,1);
      aoeDamage(M.x, M.z, E.radius, E.dmg, false, now, 'AP'); S.shake=Math.min(3,S.shake+0.8); sfx('bigexplode'); } }
}
export function clearEquip(){ for(const M of PMINES) scene.remove(M.m); PMINES.length=0; const p=S.player; if(p){ p.smokeUntil=0; p.apsUntil=0; p.apsCharges=0; } }
export function trySpell(){
  if(S.mode!=='playing') return; const p=S.player, now=performance.now()/1000;
  const sp=SPELLS[S.spell]; if(now < p.spellCdUntil) return;
  p.spellCdUntil = now + sp.cd * p.spellCdMul; sp.cast(now); sfx('spell'); updateSpellHUD();
}
export function cycleSpell(d=1){ S.spell=(S.spell+d+SPELLS.length)%SPELLS.length; updateSpellHUD(); sfx('click'); }
export function aoeDamage(x,z,r,dmg,stun,now,type,air){
  for(const b of blocks.slice()) if(b.kind==='tower'||b.kind==='obj'||b.kind==='brick'||b.kind==='camp'||b.kind==='pylon'){ const dx=b.x-x, dz=b.z-z; if(dx*dx+dz*dz < (r+b.r)*(r+b.r)) damageBlock(b, dmg*0.7*(type?structMul(type,b):1)); }   // blasts bring watchtowers down
  for(const e of enemies.slice()){ if(e.def.air && !air) continue; const dx=e.pos.x-x, dz=e.pos.z-z; if(dx*dx+dz*dz < r*r){ if(stun)e.stunUntil=(now||performance.now()/1000)+2; damageEnemy(e, dmg*(type?typeMul(type,armorOf(e))*envDmg(type):1)); } }
  if(boss&&boss.alive){ const dx=boss.pos.x-x,dz=boss.pos.z-z; if(dx*dx+dz*dz<r*r) damageBoss(dmg); }
}
export function detonate(b){
  if(b.type==='TBX'){ const now=performance.now()/1000, R=b.aoe;                  // THERMOBARIC: fuel-air flash → shock wave → everything inside burns
    fireball({x:b.x,z:b.z}, 2.4); bigExplode({x:b.x,z:b.z}, 0xffc070, R/2.4); ringPulse({x:b.x,z:b.z}, 0xffffff, R*1.1); ringPulse({x:b.x,z:b.z}, 0xff8a3a, R*0.8);
    for(let k=0;k<18;k++){ const a=Math.random()*6.283, sp=6+Math.random()*10; spawnPart(b.x, heightAt(b.x,b.z)+1, b.z, Math.cos(a)*sp, 2+Math.random()*4, Math.sin(a)*sp, {tex:'fire', color:0xfff0c0, color2:0xff3a08, size:1.4, grow:1.6, life:0.5+Math.random()*0.3, grav:1, drag:2}); }
    deformCrater(b.x,b.z,2.2,0.5); decalScorch(b.x,b.z,R,1); S.shake=Math.min(4,S.shake+1.6); gradePass.uniforms.aberr.value=Math.max(gradePass.uniforms.aberr.value,0.006);
    aoeDamage(b.x,b.z,R,b.aoeDmg||b.dmg,false,now,'TBX',true);
    for(const e of enemies){ if(e.def.air||e.def.bomber) continue; const d=Math.hypot(e.pos.x-b.x,e.pos.z-b.z); if(d<R){ if(!e.burn) e.burn={lvl:0,until:0}; e.burn.lvl=Math.min(BALANCE.flame.lvlMax, e.burn.lvl+2*(1-d/R)+0.8); e.burn.until=now+BALANCE.flame.duration*0.6; } }
    sfx('bigexplode'); return; }
  aoeDamage(b.x,b.z,b.aoe,b.aoeDmg||b.dmg,false,performance.now()/1000,b.type,true); bigExplode({x:b.x,z:b.z}, 0xffae5c, b.aoe/3.2); if(b.fx==='blast') deformCrater(b.x,b.z,0.9+b.aoe*0.25,0.28); }   // cannon/missile HE rounds scoop a shallow crater
// enemy AoE that hits the PLAYER + CORE (mortar shells, bomber self-destruct, boss bombs)
export function enemyGroundStrike(x,z,r,dmg,now){
  bigExplode({x,z}, 0xff7a3d, r/3);
  const p=S.player; if(now>=p.invincibleUntil && (p.pos.x-x)**2+(p.pos.z-z)**2 < r*r) damagePlayer(dmg, now);
  if(core && (core.pos.x-x)**2+(core.pos.z-z)**2 < r*r) damageCore(dmg*0.7);
}
