// combat/guns.js — ARMS DOCTRINE helpers: damage class × armour, range falloff, battlefield conditions, smart gun pick
import * as THREE from 'three';
import { DMG_TYPE, ARMOR, ENV, FORT, GIFT, LOOT } from '../../config.js';
import { BIOME, GUNS, S, TANK_SCALE, WAVE, boss, enemies, floatText, gunMagMul, gunReloadMul, gunRngMul, muzzleLight, ringPulse, scene, sfx, spawnPart, updateGunHUD, weatherDef, weatherRange } from '../hub.js';

// ---- ARMS DOCTRINE helpers: damage class × armour, range falloff, battlefield conditions ----
export let ENVMOD = { night:false, fire:1, freeze:1, cryo:1, he:1, longRange:1 };
export function computeEnv(){ const b=BIOME.name, t=S.tod; ENVMOD={ night:t==='night', fire:1, freeze:1, cryo:1, he:1, longRange:1 };
  if(ENV.hot.biomes.includes(b)||ENV.hot.hours.includes(t)){ ENVMOD.fire*=ENV.hot.fire; ENVMOD.freeze*=ENV.hot.freeze; }
  if(ENV.cold.biomes.includes(b)){ ENVMOD.fire*=ENV.cold.fire; ENVMOD.freeze*=ENV.cold.freeze; ENVMOD.cryo*=ENV.cold.cryo; }
  if(ENV.urban.biomes.includes(b)) ENVMOD.he*=ENV.urban.he;
  if(ENV.open.biomes.includes(b) && t!=='night') ENVMOD.longRange=ENV.open.longRange; }
export function conditionsText(){ const c=[];
  if(ENVMOD.night) c.push('BAN ĐÊM — tầm bắn −15% (pháo điện từ & tên lửa khoá không ảnh hưởng), địch ngắm kém hơn');
  if(ENVMOD.fire>1) c.push('NẮNG NÓNG — lửa +25%, đóng băng −30%'); if(ENVMOD.freeze>1) c.push('GIÁ RÉT — đóng băng +50%, súng băng +20%, lửa −25%');
  if(S.weather && S.weather!=='clear'){ const W=weatherDef(S.weather); c.push(W.vi+' — tầm bắn −'+Math.round((1-W.range)*100)+'%'); }
  if(ENVMOD.he>1) c.push('ĐỔ NÁT ĐÔ THỊ — đạn nổ +20%'); if(ENVMOD.longRange>1) c.push('ĐỊA HÌNH TRỐNG — tầm pháo 120 / pháo điện từ / pháo HESH +10%');
  return c.join('  ·  '); }
export function envDmg(type){ return type==='FIRE'?ENVMOD.fire : type==='CRYO'?ENVMOD.cryo : type==='HE'?ENVMOD.he : 1; }
export function typeMul(type, armor){ const m=type&&DMG_TYPE[type]; return m ? (m[armor]||1) : 1; }
export function armorOf(e){ return e===boss ? 'H' : (ARMOR[e.type]||'M'); }
export function siegeMul(){ const p=S.player; return p && p.buffUntil && performance.now()/1000 < (p.buffUntil.siege||0) ? LOOT.siege.mul : 1; }   // Z111b ĐẠN PHÁ THÀNH buff
export function structMul(type, bl){ const m=type&&DMG_TYPE[type]; if(!m) return 1; if(bl.kind==='gate'||bl.kind==='fortwall') return Math.max(FORT.shotStructMin, m.struct); return (bl.kind==='tower' && m.tower) ? m.tower : m.struct; }   // Z111 fortress gate / wall: no gun is weak against it
export function gunReach(id){ const g=GUNS[id]||GUNS.rifle; let r=(g.rng||1)*gunRngMul(id); if(ENVMOD.night && !ENV.night.exempt.includes(id)) r*=ENV.night.range; if(ENV.open.guns.includes(id)) r*=ENVMOD.longRange; return r*weatherRange(); }   // Z115 + NÒNG parts
export function bulletFalloff(b){ if(!b.reach || b.fall>=1) return 1; const d=Math.hypot(b.x-b.ox, b.z-b.oz), f=Math.max(0, Math.min(1, (d/b.reach-0.55)/0.45)); return 1 - f*(1-b.fall); }
export let _effT=0;
export function effectFeedback(mul, pos){ const n=performance.now(); if(n-_effT<1100) return; if(mul>=1.3){ _effT=n; floatText('HIỆU QUẢ ×'+mul.toFixed(1), '#ffb84a', new THREE.Vector3(pos.x,3.2,pos.z), 14); } else if(mul<=0.6){ _effT=n; floatText('YẾU TRƯỚC GIÁP', '#9aa3ad', new THREE.Vector3(pos.x,3.2,pos.z), 13); } }
// gun drops are distributed across stages — stronger / new guns unlock later (still random within the set)
// SMART GIFT: weight each droppable gun by how well its damage class counters what's on the field (alive + queued),
// and favour guns you don't carry yet (duplicates still level MASTERY). Keeps gifts relevant instead of random noise.
export function smartGunPick(){
  const pool=gunDropPool(S.stage), cnt={L:0,M:0,H:0,A:0}; let tot=0;
  for(const e of enemies){ cnt[armorOf(e)]++; tot++; } for(const t of (WAVE.spawnQueue||[])){ cnt[t==='squad'?'L':(ARMOR[t]||'M')]++; tot++; } if(boss&&boss.alive){ cnt.H+=4; tot+=4; }
  const held=new Set((S.player?S.player.guns:[]).map(g=>g.id));
  const w=pool.map(id=>{ const m=DMG_TYPE[GUNS[id].type]||{L:1,M:1,H:1}; let x=1;
    if(tot) for(const c of ['L','M','H','A']) x += GIFT.counterW * (cnt[c]/tot) * Math.max(0, m[c]-1) * 2;
    if(!held.has(id)) x *= GIFT.newGunW; return x; });
  let r=Math.random()*w.reduce((a,b)=>a+b,0); for(let i=0;i<pool.length;i++){ if((r-=w[i])<=0) return pool[i]; } return pool[0];
}
export function gunDropPool(stage){
  const pool=['smg','shotgun','cryo'];
  if(stage>=2) pool.push('flak','cannon','minigun','hesh','agl');
  if(stage>=3) pool.push('missile','tesla','flamer','mortar');   // railgun & rocket are VIP — shop-only (diamonds), never gifted in battle
  if(stage>=4) pool.push('arty','thermo');                // howitzer: a rare late-stage drop (also buyable in the shop)
  return pool;
}
export function muzzleFlash(x,z,ang,color,rec,y){
  y=y||1.6; const fx=Math.sin(ang), fz=Math.cos(ang), s=1+Math.min(1.4,(rec||0)*0.3);
  muzzleLight.position.set(x+fx,y+0.2,z+fz); muzzleLight.color.setHex(0xffc87a); muzzleLight.intensity=3.4+(rec||0)*0.9;
  spawnPart(x,y,z, fx*2,0,fz*2, {tex:'flash', color:0xfff4dc, size:2.1*s, life:0.055, grav:0, drag:8});                                  // star-shaped flash
  spawnPart(x+fx*0.5*s,y,z+fz*0.5*s, fx*16,0.2,fz*16, {tex:'fire', color:0xfff2c8, color2:0xff6a14, size:1.2*s, life:0.1, grav:0, drag:11, grow:0.9*s});   // forward flame tongue
  spawnPart(x,y,z, fx*4,0,fz*4, {color, size:1.4*s, life:0.07, grav:0, drag:8});                                                     // gun-coloured core
  if(rec>=1.4) for(const sd of [-1,1]) spawnPart(x,y,z, -fz*sd*10, 0.3, fx*sd*10, {tex:'fire', color:0xffe6b0, color2:0xff5a10, size:0.9*s, life:0.09, grav:0, drag:12});   // muzzle-brake side jets
  for(let i=0;i<2+Math.round(rec);i++){ const sp=9+Math.random()*12, sa=ang+(Math.random()-0.5)*0.6;
    spawnPart(x,y,z, Math.sin(sa)*sp,0.5+Math.random()*1.7,Math.cos(sa)*sp, {color:0xffe2a0, size:0.28, life:0.14+Math.random()*0.12, grav:-7, drag:2.4}); }   // burning propellant sparks
  const nS = rec>=2 ? 3 : (Math.random()<0.5?1:0);
  for(let i=0;i<nS;i++) spawnPart(x+fx*(0.4+i*0.5),y+0.1,z+fz*(0.4+i*0.5), fx*(1.5+i)+(Math.random()-0.5), 0.5+Math.random()*0.5, fz*(1.5+i)+(Math.random()-0.5), {color:0x8a8478, size:(0.8+i*0.3)*s, life:1.1+i*0.3, smoke:true, grav:0.3, drag:2.6, grow:1.2*s, op:0.32});   // propellant smoke
  if(rec>=2.4){ for(let i=0;i<10;i++){ const a=i/10*6.283; spawnPart(x-fx*1.2, 0.3, z-fz*1.2, Math.cos(a)*9+fx*4, 0.4, Math.sin(a)*9+fz*4, {color:BIOME.ground, size:1.1, life:0.7, smoke:true, grav:-0.1, drag:3.4, grow:1.3, op:0.42}); } }   // blast overpressure kicks up the dust
}
export const CASING = { hesh:{n:1,s:0.4}, rifle:{n:1,s:0.16}, smg:{n:2,s:0.12}, minigun:{n:2,s:0.14}, flak:{n:2,s:0.2}, cannon:{n:1,s:0.36}, shotgun:{n:1,s:0.3} };
export function equippedGun(){ const p=S.player; return p&&p.guns.length ? GUNS[p.guns[p.gunIdx].id] : GUNS.rifle; }
const _GID=new Map(); export function gunIdOf(g){ if(!_GID.size) for(const k in GUNS) _GID.set(GUNS[k],k); return _GID.get(g); }
export function magCap(g){ const id=gunIdOf(g); return Math.round(g.mag * S.player.ammoMul * (S.player.magMul||1) * (id?gunMagMul(id):1)); }   // Z115 + BĂNG ĐẠN parts   // ammoMul = buff, magMul = BIG MAGAZINE upgrade
export function startReload(now, inst){ const p=S.player; inst=inst||p.guns[p.gunIdx]; if(!inst||p.infiniteAmmo||inst.rU) return; const r=GUNS[inst.id].reload*(p.reloadMul||1)*gunReloadMul(inst.id); inst.rD=r; inst.rU=now+r; if(inst===p.guns[p.gunIdx]){ sfx('reload'); updateGunHUD(); } }   // MASTERY: higher level reloads faster
// ----- reload countdown dial: a glowing circular chart billboarded above the tank, flashes ✓ when ready -----
export const reloadCanvas=document.createElement('canvas'); reloadCanvas.width=reloadCanvas.height=160;
export const reloadCtx=reloadCanvas.getContext('2d');
export const reloadTex=new THREE.CanvasTexture(reloadCanvas); reloadTex.colorSpace=THREE.SRGBColorSpace;
export const reloadSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:reloadTex,transparent:true,depthWrite:false,depthTest:false}));
reloadSprite.scale.set(3.4,3.4,1); reloadSprite.visible=false; reloadSprite.renderOrder=999; scene.add(reloadSprite);
export function drawReloadDial(prog, secs, ready){
  const x=reloadCtx, c=80, r=56; x.clearRect(0,0,160,160);
  x.beginPath(); x.arc(c,c,r+12,0,Math.PI*2); x.fillStyle='rgba(8,12,6,0.55)'; x.fill();             // backdrop disc
  x.lineWidth=13; x.lineCap='round';
  x.strokeStyle='rgba(255,255,255,0.13)'; x.beginPath(); x.arc(c,c,r,0,Math.PI*2); x.stroke();        // full track
  const col = ready ? '#9be35a' : '#ffce4a';
  x.strokeStyle=col; x.shadowColor=col; x.shadowBlur=18;                                              // glowing progress arc (12 o'clock, clockwise)
  x.beginPath(); x.arc(c,c,r,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,Math.max(0,prog))); x.stroke(); x.shadowBlur=0;
  if(ready){ x.strokeStyle=col; x.lineWidth=12; x.beginPath(); x.moveTo(c-24,c+1); x.lineTo(c-5,c+20); x.lineTo(c+27,c-21); x.stroke(); }   // ✓
  else { x.fillStyle=col; x.textAlign='center'; x.font='bold 46px system-ui,Arial,sans-serif'; x.textBaseline='middle'; x.fillText(secs.toFixed(1), c, c+2);
         x.fillStyle='rgba(255,255,255,0.6)'; x.font='bold 15px system-ui,Arial,sans-serif'; x.fillText('NẠP ĐẠN', c, c+28); }
  reloadTex.needsUpdate=true;
}
export function updateReload(now){
  const p=S.player; if(!p||!p.guns.length){ reloadSprite.visible=false; return; }
  const eq=p.guns[p.gunIdx];
  // complete reloads on time for EVERY gun — a reloading gun finishes in the background while you use another
  for(const gi of p.guns){
    if(gi.rU && now>=gi.rU){ gi.ammo=magCap(GUNS[gi.id]); gi.rU=0;
      if(gi===eq){ p.readyUntil=now+0.55; ringPulse(p.pos, 0x9be35a, p.radius*1.9); sfx('reloaded'); }
      else { floatText(GUNS[gi.id].name+' SẴN SÀNG', '#9be35a', p.pos, 14); }
      updateGunHUD();
    }
  }
  const reloading = !p.infiniteAmmo && eq.rU>now && eq.rD>0;
  const ready = !reloading && now < (p.readyUntil||0);
  if(reloading || ready){
    reloadSprite.visible=true;
    reloadSprite.position.set(p.pos.x, 3.4*p.scale*TANK_SCALE + 3.2, p.pos.z);
    const rem = reloading ? eq.rU-now : 0;
    drawReloadDial(reloading ? 1-rem/eq.rD : 1, rem, ready);
  } else reloadSprite.visible=false;
}
export function nearestTarget(maxR){
  const p=S.player; let best=null, bd=maxR*maxR;
  for(const e of enemies){ if(e.abandoned) continue; const dx=e.pos.x-p.pos.x, dz=e.pos.z-p.pos.z, d2=dx*dx+dz*dz; if(d2<bd){ bd=d2; best=e; } }
  if(boss&&boss.alive){ const dx=boss.pos.x-p.pos.x, dz=boss.pos.z-p.pos.z, d2=dx*dx+dz*dz; if(d2<bd){ bd=d2; best=boss; } }
  return best;
}
