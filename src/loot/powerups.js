// loot/powerups.js — Z93 DROPS: the loot is a real object — it pops out of the wreck in an arc, bounces, raises dust, then sits under a rarity-coloured light beam
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BALANCE, GIFT, LOOT, GUN_MODS } from '../../config.js';
import { BIOME, GEM_DEF, GUNS, S, __set_soldierLvl, addCoins, addGunMod, barrelGrade, boss, burst, clampField, core, crewTarget, damageBoss, damageEnemy, deployRiders, deploySoldiers, enemies, equippedGun, floatText, giveGun, guardTarget, gunPicEl, gunTierTx, heightAt, iconEl, magCap, riders, ridersUnlocked, ringPulse, scene, setIcon, setPlayerBarrel, sfx, smartGunPick, soldierLvl, soldiers, spawnDrone, svgBadgeTex, tip, updateGunHUD, updateHUD } from '../hub.js';

// ===== POWER-UPS (drops) =====
// Power-ups: TIMED buffs (longer now), PERMANENT buffs (∞ until death), instant, gun drops.
// Picking the same buff group again REPLACES it with the new one's power+duration (no stacking).
export const NOW=()=>performance.now()/1000;
export const POWERUPS = [
  // timed buffs (longer)
  { id:'rapid',  svg:'bolt', color:0xfff04a, buff:'rapid',  dur:28, label:'RAPID FIRE ×2', vi:'BẮN NHANH', ds:'Tốc độ bắn ×2', cat:'ammo', tier:0 },
  { id:'power',  svg:'burst', color:0xff7a3d, buff:'power',  dur:28, label:'DAMAGE ×1.6', vi:'HOẢ LỰC', ds:'Sát thương ×1,6', cat:'ammo', tier:0 },
  { id:'speed',  svg:'dash', color:0x6fe0a0, buff:'speed',  dur:LOOT.speed.dur, label:'ENGINE OVERDRIVE', vi:'ĐỘNG CƠ VƯỢT TẢI', ds:'Tốc độ tối đa & lực kéo +30%', cat:'fuel', tier:0 },
  { id:'turbo',  svg:'bolt', color:0x7fd0ff, buff:'turbo',  dur:LOOT.turbo.dur, stack:LOOT.turbo.maxLv, label:'TURBO', vi:'TĂNG ÁP', ds:'Gia tốc +35%/cấp, bứt khỏi chỗ đứng', cat:'fuel', tier:1 },   // Z93
  { id:'ram',    svg:'tank', color:0xffb040, buff:'ram',    dur:LOOT.ram.dur, label:'DOZER BLADE', vi:'LƯỠI ỦI', ds:'Húc ×2,2 · chịu húc −65% · phá tường khi chạy vừa', cat:'armor', tier:1 },   // Z93
  { id:'era',    svg:'shield', color:0xe0c070, label:'REACTIVE ARMOUR', vi:'GIÁP PHẢN ỨNG', ds:'+3 tấm: mỗi tấm chặn 60% một phát trúng', cat:'armor', tier:1, apply(p){ addEra(LOOT.era.charges); } },   // Z93
  { id:'siege',  svg:'bomb', color:0xff9a3a, buff:'siege',  dur:LOOT.siege.dur, label:'SIEGE ROUNDS', vi:'ĐẠN PHÁ THÀNH', ds:'×2,5 sát thương vào tường, cổng thành, rào chắn, tháp canh', cat:'ammo', tier:1 },   // Z111b
  { id:'inf',    svg:'infinity',  color:0xffffff, buff:'infammo',dur:18, label:'INFINITE AMMO', vi:'ĐẠN VÔ HẠN', ds:'Không cần nạp đạn', cat:'ammo', tier:1, onGet(p){ for(const g of p.guns) g.rU=0; } },
  // PERMANENT buffs (last until death) — rarer feel, lasting progression
  { id:'range',  svg:'target', color:0x9af0d4, buff:'range',  dur:Infinity, label:'RANGE ×1.4 (∞)', vi:'NÒNG DÀI', ds:'Tầm bắn ×1,4 tới khi mất mạng', cat:'tech', tier:1 },
  { id:'ammoup', svg:'mag', color:0xc0a060, buff:'ammoup', dur:Infinity, label:'MAGAZINE ×1.6 (∞)', vi:'BĂNG ĐẠN LỚN', ds:'Băng đạn ×1,6 tới khi mất mạng', cat:'ammo', tier:1, onGet(p){ const g=equippedGun(); p.guns[p.gunIdx].ammo=Math.round(g.mag*1.6); } },
  // instant
  { id:'heal',   svg:'heart', color:0xff6b81, vi:'CỨU THƯƠNG', ds:'+40 máu', cat:'med', tier:0, apply(p){ p.hp=Math.min(p.maxHp,p.hp+40); updateHUD(); } },
  { id:'repair', svg:'wrench', color:0xffb060, vi:'SỬA CĂN CỨ', ds:'+70 máu cho Lõi', cat:'tool', tier:0, apply(){ if(core){core.hp=Math.min(core.maxHp,core.hp+70); updateHUD();} } },
  { id:'shield', svg:'shield', color:0x4fd1ff, vi:'KHIÊN NĂNG LƯỢNG', ds:'Bất tử 5 giây', cat:'tech', tier:1, apply(p){ p.invincibleUntil=NOW()+5; p.shieldUntil=NOW()+5; } },
  { id:'bomb',   svg:'bomb', color:0xff6030, vi:'BOM CHÙM', ds:'80 sát thương mọi địch', cat:'bomb', tier:2, apply(){ for(const e of enemies.slice()) damageEnemy(e,80); if(boss&&boss.alive)damageBoss(120); S.shake=2; } },
  { id:'freeze', svg:'snow', color:0x6fd0ff, vi:'ĐÓNG BĂNG', ds:'Địch đứng hình 3,5 giây', cat:'tech', tier:0, apply(){ const n=NOW(); for(const e of enemies) e.stunUntil=n+3.5; } },
  { id:'drone',  svg:'drone', color:0x6fd0ff, vi:'DRONE YỂM TRỢ', ds:'Drone bắn tự động 22 giây', cat:'tech', tier:1, apply(){ spawnDrone(); } },     // 22s orbiting auto-turret
  { id:'troops', svg:'team', color:0x9bd14a, vi:'TĂNG VIỆN', ds:'Bổ sung & hồi máu lính', cat:'ammo', tier:0, apply(){ deploySoldiers(guardTarget()); for(const s of soldiers) s.hp=s.maxHp; if(ridersUnlocked){ deployRiders(crewTarget()); for(const r of riders) r.hp=r.maxHp; } if(S.player) floatText('TĂNG VIỆN ĐÃ TỚI', '#9bd14a', S.player.pos, 18); } },   // refill core guards + tank crew + heal
  { id:'armory', svg:'up',     color:0xffd24a, vi:'TRANG BỊ LÍNH', ds:'Lính bắn mạnh & nhanh hơn', cat:'ammo', tier:1, apply(){ __set_soldierLvl(soldierLvl + 1); for(const s of soldiers) s.hp=Math.min(s.maxHp,s.hp+25); if(S.player) floatText('TRANG BỊ LÍNH +'+soldierLvl, '#ffd24a', S.player.pos, 18); } },   // +35% soldier damage & faster fire
  // Z115 GUN PARTS — permanent, per gun, stacking (GUN_MODS)
  { id:'mod_barrel', svg:'gun',    color:0xffb35a, mod:'barrel', vi:'NÒNG TINH CHẾ',   ds:'Súng đang cầm: +6% sát thương, +4% tầm — vĩnh viễn, cộng dồn tới 5', cat:'gun', tier:2, apply(){ fitGunMod('barrel'); } },
  { id:'mod_action', svg:'wrench', color:0x9fd8ff, mod:'action', vi:'KHOÁ NÒNG',       ds:'Súng đang cầm: bắn nhanh hơn 5%, nạp nhanh hơn 6% — vĩnh viễn, cộng dồn tới 5', cat:'gun', tier:2, apply(){ fitGunMod('action'); } },
  { id:'mod_mag',    svg:'mag',    color:0xd8c070, mod:'mag',    vi:'BĂNG ĐẠN MỞ RỘNG', ds:'Súng đang cầm: +12% số viên mỗi băng — vĩnh viễn, cộng dồn tới 5', cat:'gun', tier:2, apply(){ fitGunMod('mag'); } },
  // gun drop — adds a random gun to the inventory
  { id:'gun',    svg:'gun', color:0xaef0a0, vi:'SÚNG MỚI', ds:'Thêm một khẩu vào kho', cat:'gun', tier:2, apply(p){ const id=smartGunPick(); p._gotGun=id; giveGun(id); } },
];
// Z93 STACKING RULES (numbers in LOOT.rules): same buff again → EXTEND by half its timer (capped at 1.5× a full timer), power never compounds;
// TURBO climbs a level (max 2) and refreshes; ERA adds tiles (max 6); a permanent buff you already hold pays out coins instead.
export function applyPowerup(def){
  const p=S.player, now=NOW(); let note='';
  if(def.buff){ const k=def.buff, rem=Math.max(0,(p.buffUntil[k]||0)-now);
    if(def.dur===Infinity){ if(p.buffUntil[k]===Infinity){ const c=Math.round(120*(1+S.stage*0.2)); addCoins(c); note='Đã có → +'+c+' xu'; } else { p.buffUntil[k]=Infinity; note='Vĩnh viễn tới khi mất mạng'; } }
    else if(def.stack){ const lv=rem>0 ? Math.min(def.stack, (p.buffLv[k]||1)+1) : 1; p.buffLv[k]=lv; p.buffUntil[k]=now+def.dur; note='Cấp '+lv+'/'+def.stack+' · '+def.dur+' giây'; }
    else { if(rem>0) tip('stack'); const full=def.dur, R=LOOT.rules, nd=rem>0 ? Math.min(full*R.maxDurMul, rem+full*R.extendShare) : full; p.buffUntil[k]=now+Math.max(nd, rem); note = rem>0 ? 'Gia hạn → '+Math.round(nd)+' giây' : full+' giây'; }
    if(def.onGet) def.onGet(p); }
  else if(def.apply) def.apply(p);
  lootToast(def, note);
}
export function addEra(n){ const p=S.player; p.era=Math.min(LOOT.era.cap, (p.era||0)+n); setEraTiles(p); }
export function setEraTiles(p){ const t=p.mesh&&p.mesh.userData.eraTiles; if(t) t.forEach((m,i)=>m.visible=i<(p.era||0)); }
// reward card — icon · name · effect · rule — slides in on the right, newest replaces the last
export let _ltT=null;
export function lootToast(def, note){
  const el=document.getElementById('lootToast'); if(!el) return; const col='#'+def.color.toString(16).padStart(6,'0'), tier=def.tier||0;
  el.style.setProperty('--lc', col); el.className='lt-'+tier;
  const gid = def.cat==='gun' && S.player && S.player._gotGun;   // Z150 a gun drop names the gun and shows its photo
  el.querySelector('.lt-ic').replaceChildren(gid ? gunPicEl(gid,'gp-loot') : iconEl(def.svg||'star')); el.classList.toggle('lt-gun', !!gid);
  el.querySelector('.lt-nm').textContent=gid ? GUNS[gid].name : (def.vi||def.label||def.id); el.querySelector('.lt-ds').textContent=gid ? ('SÚNG MỚI · '+gunTierTx(gid)) : (def.ds||''); el.querySelector('.lt-nt').textContent=note||'';
  el.querySelector('.lt-tr').textContent=['THƯỜNG','HIẾM','QUÝ'][tier];
  void el.offsetWidth; el.classList.add('on'); clearTimeout(_ltT); _ltT=setTimeout(()=>el.classList.remove('on'), 2600);
  if(S.player) floatText(def.vi||def.label||def.id, col, S.player.pos, 17);
}
export const PICKUP_LIFE=11;
export const pickups=[];
export const GUN_DROP_DEF = POWERUPS.find(u=>u.id==='gun');
// ---- Z93 DROPS: the loot is a real object — it pops out of the wreck in an arc, bounces, raises dust, then sits under a rarity-coloured light beam ----
export const RAR=[0x9fe07a, 0x5aa9ff, 0xc08bff];                                          // common · rare · epic
export const _LM={}; export let _lootGeo=null;
export function lootGeos(){ if(_lootGeo) return _lootGeo; const B=(w,h,d,x,y,z)=>new THREE.BoxGeometry(w,h,d).translate(x||0,y||0,z||0), mg=a=>{ const g=mergeGeometries(a.map(q=>q.index?q.toNonIndexed():q)); a.forEach(q=>q.dispose()); return g; };
  _lootGeo={
    case:mg([B(1.0,0.62,0.7,0,0.31,0), B(0.36,0.07,0.08,0,0.66,0)]),                                   // med case body + handle
    cross:mg([B(0.42,0.12,0.02,0,0.34,0.36), B(0.12,0.42,0.02,0,0.34,0.36), B(0.42,0.12,0.02,0,0.34,-0.36), B(0.12,0.42,0.02,0,0.34,-0.36)]),
    can:mg([new RoundedBoxGeometry(0.62,0.86,0.3,2,0.06).translate(0,0.43,0), B(0.16,0.1,0.22,0.18,0.92,0), B(0.36,0.06,0.08,-0.06,0.95,0)]),   // jerrycan + spout + handle
    ammo:mg([B(0.9,0.52,0.42,0,0.26,0), B(0.94,0.06,0.46,0,0.53,0), B(0.3,0.05,0.06,0,0.58,0)]),          // ammo can w/ lid + handle
    plate:mg([B(0.9,0.12,0.7,0,0.06,0), B(0.86,0.12,0.66,0.02,0.19,0.02), B(0.82,0.12,0.62,-0.02,0.32,-0.01)]),   // stacked ERA tiles
    tool:mg([B(0.9,0.42,0.42,0,0.21,0), B(0.5,0.06,0.06,0,0.5,0), B(0.06,0.1,0.06,-0.22,0.45,0), B(0.06,0.1,0.06,0.22,0.45,0)]),
    tech:mg([new RoundedBoxGeometry(0.8,0.5,0.6,2,0.08).translate(0,0.25,0)]),
    gun:mg([B(1.7,0.4,0.55,0,0.2,0), B(1.74,0.05,0.59,0,0.42,0)]),                                         // long weapon crate
    gem:new THREE.OctahedronGeometry(0.42,0).translate(0,0.55,0),
    beam:new THREE.CylinderGeometry(0.42,0.62,1.5,14,1,true).translate(0,0.75,0) };
  return _lootGeo; }
export function lootMat(k, col, emi){ return _LM[k]||(_LM[k]=new THREE.MeshStandardMaterial({ color:col, roughness:0.55, metalness:k==='steel'||k==='gem'?0.8:0.25, emissive:emi||0x000000, emissiveIntensity:emi?0.8:0 })); }
export function lootModel(def){ const G=lootGeos(), g=new THREE.Group(), cat=def.cat||'tech', add=(geo,mat)=>{ const m=new THREE.Mesh(geo,mat); m.castShadow=true; g.add(m); return m; };
  if(cat==='med'){ add(G.case, lootMat('white',0xe8e6de)); add(G.cross, lootMat('red',0xc8202a)); }
  else if(cat==='fuel'){ add(G.can, lootMat(def.id==='turbo'?'can2':'can', def.id==='turbo'?0x2c6ea8:0x6a7a32)); }
  else if(cat==='ammo'){ add(G.ammo, lootMat('olive',0x4a5a2a)); }
  else if(cat==='armor'){ add(G.plate, lootMat('steel',0x6e6a5c)); }
  else if(cat==='tool'){ add(G.tool, lootMat('toolred',0xb8302a)); }
  else if(cat==='gun'){ add(G.gun, lootMat('wood',0x7a5a34)); }
  else if(cat==='gem'){ add(G.gem, lootMat('gem',0x7fe7ff,0x2a8aa8)); }
  else if(cat==='bomb'){ const b=add(new THREE.SphereGeometry(0.42,14,10).translate(0,0.45,0), lootMat('bomb',0x2a2a26)); }
  else { add(G.tech, lootMat('tech',0x34404a,0x103040)); }
  return g; }
// Z115 fit a part: the gun in your hands first, else another carried gun that still has room, else coins
const MOD_VI={ barrel:'NÒNG', action:'KHOÁ NÒNG', mag:'BĂNG ĐẠN' };
export function fitGunMod(k){ const p=S.player; if(!p||!p.guns) return; const order=[p.guns[p.gunIdx]].concat(p.guns.filter((g,i)=>i!==p.gunIdx)).filter(Boolean);
  for(const inst of order){ const id=inst.id, before=barrelGrade(id), lv=addGunMod(id, k); if(lv<0) continue; const g=GUNS[id];
    if(k==='mag'){ const cap=magCap(g); inst.ammo=Math.min(cap, inst.ammo+Math.max(1,Math.round(g.mag*GUN_MODS.mag.mag))); }
    if(inst===p.guns[p.gunIdx] && barrelGrade(id)!==before) setPlayerBarrel(id);                                   // the barrel looks finer
    floatText(MOD_VI[k]+' +1 · '+g.name+' ('+lv+'/'+GUN_MODS.max+')', '#ffd27a', p.pos, 20); ringPulse(p.pos, 0xffd27a, 2.4); sfx('levelup'); updateGunHUD(); return; }
  addCoins(GUN_MODS.coins); floatText('SÚNG ĐÃ ĐỦ LINH KIỆN · +'+GUN_MODS.coins+' xu', '#ffd24a', p.pos, 18); }
export function modDrop(){ const pool=POWERUPS.filter(u=>u.mod); return pool[(Math.random()*pool.length)|0]; }
export function pickLoot(tier){                                                             // tier = how tough the source was (0 common · 1 rare · 2 epic)
  const p=S.player, low=(p.hp/p.maxHp<0.4)||(core&&core.hp/core.maxHp<0.4);
  if(low && Math.random()<0.6){ const pool=POWERUPS.filter(u=>['heal','repair','shield','era'].includes(u.id)); return pool[(Math.random()*pool.length)|0]; }
  if(Math.random()<BALANCE.drop.gem*(1+tier)) return GEM_DEF;
  let roll=0; if(tier>=2 && Math.random()<LOOT.rarity.epicShare) roll=2; else if(tier>=1 && Math.random()<LOOT.rarity.rareShare) roll=1;
  if(roll===2){ const r=Math.random(); if(r<0.55){ S.giftDry=0; return GUN_DROP_DEF; } if(r<0.55+GUN_MODS.epicShare) return modDrop(); return r<0.9 ? POWERUPS.find(u=>u.id==='bomb') : GEM_DEF; }   // EPIC: gun · gun part · cluster bomb · diamond
  if(roll===1 && Math.random()<GUN_MODS.rareShare) return modDrop();                                                   // Z115 rare: sometimes a gun part
  if(Math.random() < Math.min(GIFT.pityCap, GIFT.gunBase*0.35 + (S.giftDry||0)*GIFT.pityStep)){ S.giftDry=0; return GUN_DROP_DEF; }   // pity timer still guarantees guns on dry streaks
  const pool=POWERUPS.filter(u=>u.id!=='gun' && u.id!=='bomb' && !u.mod && (u.tier||0)===roll); S.giftDry=(S.giftDry||0)+1;   // Z115 parts come only from their own rolls
  return pool[(Math.random()*pool.length)|0];
}
export function dropPowerup(pos, tier, forced){
  tip('loot');
  tier=tier|0; const def=forced||pickLoot(tier), t=def.tier||0;   // Z104 forced = re-drop a carried item (rally point)
  const g=new THREE.Group(); scene.add(g); const model=lootModel(def); g.add(model);
  const beam=new THREE.Mesh(lootGeos().beam, _LM['beam'+t]||(_LM['beam'+t]=new THREE.MeshBasicMaterial({ color:RAR[t], transparent:true, opacity:0.0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }))); g.add(beam); beam.visible=false;
  const icon=new THREE.Sprite(new THREE.SpriteMaterial({map:svgBadgeTex(def.svg||'star','#'+def.color.toString(16).padStart(6,'0')),transparent:true,depthWrite:false})); icon.scale.set(1.05,1.05,1); icon.position.y=1.75; icon.visible=false; g.add(icon);
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.95,1.08,36), new THREE.MeshBasicMaterial({color:RAR[t],transparent:true,opacity:0.7,side:THREE.DoubleSide,depthWrite:false})); ring.rotation.x=-Math.PI/2; ring.position.y=0.08; ring.visible=false; g.add(ring);
  const a=Math.random()*6.283, sp=3+Math.random()*3;
  const u={def, g, model, beam, icon, ring, x:pos.x, z:pos.z, y:heightAt(pos.x,pos.z)+1.4, vx:Math.cos(a)*sp, vz:Math.sin(a)*sp, vy:7+Math.random()*2, landed:false, bounces:0, born:performance.now()/1000, tier:t};
  g.position.set(u.x,u.y,u.z); pickups.push(u);
  if(t>=1) burst(pos, RAR[t], 6, 5, {y:1.5, life:0.4, size:0.5, grav:-6, drag:2, up:3});
  return u;
}
// Z104 a soldier picks an item up to carry it home → { def, tier } (null if someone was faster)
export function takePickup(u){ const i=pickups.indexOf(u); if(i<0) return null; disposePickup(u); pickups.splice(i,1); return { def:u.def, tier:u.tier }; }
export function disposePickup(u){ scene.remove(u.g); u.icon.material.dispose(); u.ring.material.dispose(); u.ring.geometry.dispose(); }
export function updatePickups(dt, now){
  const p=S.player;
  for(let i=pickups.length-1;i>=0;i--){
    const u=pickups[i];
    if(!u.landed){ u.vy-=26*dt; u.x+=u.vx*dt; u.z+=u.vz*dt; u.y+=u.vy*dt; u.model.rotation.x+=dt*7; u.model.rotation.z+=dt*4;   // tumbling out of the wreck
      const gy=heightAt(u.x,u.z); if(u.y<=gy){ u.y=gy; if(u.bounces++<1 && u.vy<-5){ u.vy*=-0.32; u.vx*=0.5; u.vz*=0.5; burst({x:u.x,z:u.z}, BIOME.ground, 2, 2, {y:gy+0.2, life:0.5, size:0.8, smoke:true, grav:-0.3, drag:2, up:0.6, op:0.4}); }
        else { u.landed=true; u.born=now; u.model.rotation.set(0,Math.random()*6,0); u.beam.visible=u.icon.visible=u.ring.visible=true; sfx('thud');
          burst({x:u.x,z:u.z}, BIOME.ground, 4, 3, {y:gy+0.3, life:0.8, size:1.2, smoke:true, grav:-0.3, drag:2, up:1, op:0.45}); } }
      clampField(u, 3); u.g.position.set(u.x,u.y,u.z); continue; }
    const age=now-u.born, life=PICKUP_LIFE*(1+u.tier*0.4), rem=u.stash ? 1 : Math.max(0, 1-age/life);   // Z104 stashed at the rally point → never expires
    u.model.rotation.y += dt*0.9; u.model.position.y = 0.05+Math.sin(now*2.4+i)*0.06;
    u.icon.position.y = 1.7 + Math.sin(now*3+i)*0.1;
    u.beam.material.opacity = (0.08+0.03*Math.sin(now*4+i))*(1+u.tier*0.25); u.beam.scale.set(1, 0.6+0.4*rem, 1);   // low halo hugging the item (no tall pillar)
    u.ring.scale.setScalar(Math.max(0.05,rem)); u.ring.material.opacity = 0.7*rem; u.ring.rotation.z += dt*1.2;
    if(rem<0.25) u.g.visible = Math.floor(now*8)%2===0;                                  // blinks before it is gone
    const dx=p.pos.x-u.x, dz=p.pos.z-u.z, d2=dx*dx+dz*dz;
    if(d2 < 64){ const d=Math.sqrt(d2)||1; u.x+=dx/d*18*dt; u.z+=dz/d*18*dt; }           // magnet toward player when near
    u.g.position.set(u.x, heightAt(u.x,u.z), u.z);
    if(d2 < (p.radius+1.2)**2){ applyPowerup(u.def); sfx('powerup'); ringPulse(p.pos,u.def.color,3); burst(p.pos, RAR[u.tier], 10, 6, {y:1.6, life:0.5, size:0.45, grav:-4, drag:2, up:4}); disposePickup(u); pickups.splice(i,1); continue; }
    if(age>life && !u.stash){ disposePickup(u); pickups.splice(i,1); }
  }
}
export function clearPickups(){ for(const u of pickups) disposePickup(u); pickups.length=0; }
export const BUFF_ICON={ siege:'bomb', rapid:'bolt', power:'burst', speed:'dash', infammo:'infinity', ammoup:'mag', range:'target', turbo:'bolt', ram:'tank', era:'shield' };
export const BUFF_COL={ siege:'#ff9a3a', turbo:'#7fd0ff', ram:'#ffb040', speed:'#6fe0a0', era:'#e0c070' };
export let _buffKey='';
export function updateBuffHUD(now){                                                         // Z93: rebuilt only when something visible changes (was every frame)
  const bar=document.getElementById('buffbar'); if(!bar) return; const p=S.player, items=[];
  for(const k in p.buffUntil){ const until=p.buffUntil[k]; const rem=until-now; if(rem<=0) continue; items.push([k, until===Infinity?'∞':Math.ceil(rem)+'s', k==='turbo'&&p.buffLv.turbo>1?'×'+p.buffLv.turbo:'']); }
  if(p.era>0) items.push(['era', '×'+p.era, '']);
  const key=items.map(i=>i.join(':')).join('|'); if(key===_buffKey) return; _buffKey=key; bar.replaceChildren();
  for(const [k,txt,lv] of items){ const c=document.createElement('div'); c.className='buffchip'; if(BUFF_COL[k]) c.style.setProperty('--bc', BUFF_COL[k]);
    const ic=document.createElement('span'); ic.className='bic'; setIcon(ic, BUFF_ICON[k]);
    const t=document.createElement('span'); t.className='t'; t.textContent = txt + (lv?' '+lv:'');
    c.append(ic,t); bar.appendChild(c); }
}
