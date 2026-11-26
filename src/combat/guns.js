// combat/guns.js — ARMS DOCTRINE helpers: damage class × armour, range falloff, battlefield conditions, smart gun pick
import * as THREE from 'three';
import { DMG_TYPE, ARMOR, ENV, FORT, GUNHOLD, INFGUN, LOOT } from '../../config.js';
import { BIOME, CV, GUNS, S, reloadPlan, brakeBlast, enemies, floatText, gunFlash, gunLight, heightAt, ringPulse, scene, sfx, spawnPart, updateGunHUD, weatherDef, weatherRange, tentHidesFromPlayer } from '../hub.js';

// ---- ARMS DOCTRINE helpers: damage class × armour, range falloff, battlefield conditions ----
export let ENVMOD = { night:false, fire:1, he:1 };
export function computeEnv(){ const b=BIOME.name, t=S.tod; ENVMOD={ night:t==='night', fire:1, he:1 };
  if(ENV.hot.biomes.includes(b)||ENV.hot.hours.includes(t)){ ENVMOD.fire*=ENV.hot.fire; }
  if(ENV.cold.biomes.includes(b)){ ENVMOD.fire*=ENV.cold.fire; }
  if(ENV.urban.biomes.includes(b)) ENVMOD.he*=ENV.urban.he; }
export function conditionsText(){ const c=[];
  if(ENVMOD.night) c.push('BAN ĐÊM — tầm bắn −15%, địch ngắm kém hơn');
  if(ENVMOD.fire>1) c.push('NẮNG NÓNG — lửa +25%'); else if(ENVMOD.fire<1) c.push('GIÁ RÉT — lửa −25%');
  if(S.weather && S.weather!=='clear'){ const W=weatherDef(S.weather); c.push(W.vi+' — tầm bắn −'+Math.round((1-W.range)*100)+'%'); }
  if(ENVMOD.he>1) c.push('ĐỔ NÁT ĐÔ THỊ — đạn nổ +20%');
  return c.join('  ·  '); }
export function envDmg(type){ return type==='FIRE'?ENVMOD.fire : type==='HE'?ENVMOD.he : 1; }
export function typeMul(type, armor){ const m=type&&DMG_TYPE[type]; return m ? (m[armor]||1) : 1; }
export function armorOf(e){ return ARMOR[e.type]||'M'; }
export function siegeMul(){ const p=S.player; return p && p.buffUntil && performance.now()/1000 < (p.buffUntil.siege||0) ? LOOT.siege.mul : 1; }   // Z111b ĐẠN PHÁ THÀNH buff
export function structMul(type, bl){ const m=type&&DMG_TYPE[type]; if(!m) return 1; if(bl.kind==='gate'||bl.kind==='fortwall') return Math.max(FORT.shotStructMin, m.struct); return (bl.kind==='tower' && m.tower) ? m.tower : m.struct; }   // Z111 fortress gate / wall: no gun is weak against it
export function gunReach(id){ const g=GUNS[id]||GUNS.carbine; let r=(g.rng||1); if(ENVMOD.night) r*=ENV.night.range; return r*weatherRange(); }
export function bulletFalloff(b){ if(!b.reach || b.fall>=1) return 1; const d=Math.hypot(b.x-b.ox, b.z-b.oz), f=Math.max(0, Math.min(1, (d/b.reach-0.55)/0.45)); return 1 - f*(1-b.fall); }
export let _effT=0;
export function effectFeedback(mul, pos){ const n=performance.now(); if(n-_effT<1100) return; if(mul>=1.3){ _effT=n; floatText('HIỆU QUẢ ×'+mul.toFixed(1), '#ffb84a', new THREE.Vector3(pos.x,3.2,pos.z), 14); } else if(mul<=0.6){ _effT=n; floatText('YẾU TRƯỚC GIÁP', '#9aa3ad', new THREE.Vector3(pos.x,3.2,pos.z), 13); } }
// gun drops are distributed across stages — stronger / new guns unlock later (still random within the set)
// SMART GIFT: weight each droppable gun by how well its damage class counters what's on the field (alive + queued),
// and favour guns you don't carry yet (duplicates still level MASTERY). Keeps gifts relevant instead of random noise.
export function muzzleFlash(x,z,ang,color,rec,y){   // Z419 a SHAPED flash along the bore (fx/gunfx.js gunFlash) — was a round star billboard + a gun-coloured glow ball
  y=y||1.6; const fx=Math.sin(ang), fz=Math.cos(ang), s=1+Math.min(1.4,(rec||0)*0.3);
  gunLight(x+fx,y+0.2,z+fz, 0xffc87a, 3.4+(rec||0)*0.9);
  gunFlash(x,y,z, ang, 1.7*s, 1.0*s, 0xfff0d4, 1);                                                                                     // petals along the bore + a star down it
  spawnPart(x+fx*0.5*s,y,z+fz*0.5*s, fx*16,0.2,fz*16, {tex:'fire', color:0xfff2c8, color2:0xff6a14, size:1.0*s, life:0.07, grav:0, drag:11, grow:0.8*s});   // forward flame tongue
  if(rec>=1.4) brakeBlast(x,y,z, ang, 0.7*s);                                                                                          // muzzle-brake side jets + their smoke blown sideways
  for(let i=0;i<1+Math.round(rec*0.6);i++){ const sp=9+Math.random()*12, sa=ang+(Math.random()-0.5)*0.6;
    spawnPart(x,y,z, Math.sin(sa)*sp,0.5+Math.random()*1.7,Math.cos(sa)*sp, {color:0xffe2a0, size:0.12, life:0.12+Math.random()*0.1, grav:-7, drag:2.4}); }   // burning propellant sparks
  const nS = rec>=2 ? 3 : (Math.random()<0.5?1:0);
  for(let i=0;i<nS;i++) spawnPart(x+fx*(0.4+i*0.5),y+0.1,z+fz*(0.4+i*0.5), fx*(1.5+i)+(Math.random()-0.5), 0.5+Math.random()*0.5, fz*(1.5+i)+(Math.random()-0.5), {color:0x8a8478, size:(0.8+i*0.3)*s, life:1.1+i*0.3, smoke:true, grav:0.3, drag:2.6, grow:1.2*s, op:0.32});   // propellant smoke
  if(rec>=2.4){ const gy=heightAt(x,z); for(let i=0;i<10;i++){ const a=i/10*6.283; spawnPart(x-fx*1.2, gy+0.3, z-fz*1.2, Math.cos(a)*9+fx*4, 0.4, Math.sin(a)*9+fz*4, {color:BIOME.ground, size:1.1, life:0.7, smoke:true, grav:-0.1, drag:3.4, grow:1.3, op:0.42}); } }   // blast overpressure kicks up the dust (Z419 at the ground's real height)
}
export function equippedGun(){ const p=S.player; return p&&p.guns.length ? GUNS[p.guns[p.gunIdx].id] : GUNS.rifle; }
const _GID=new Map(); export function gunIdOf(g){ if(!_GID.size) for(const k in GUNS) _GID.set(GUNS[k],k); return _GID.get(g); }
export function magCap(g){ const id=gunIdOf(g); return Math.round(g.mag * S.player.ammoMul * (S.player.magMul||1)); }   // Z115 + BĂNG ĐẠN parts   // ammoMul = buff, magMul = BIG MAGAZINE upgrade
// GUN 2 the reload is a plan of real steps (actors/gun-reload.js reloadPlan): run dry it takes the gun's own time, as ever; begun with rounds left (reloadNow) there is
//   no bolt to rack — that much shorter — and a gun loaded round by round takes only as long as the rounds missing; each step makes its own sound when the hands are seen doing it
export function startReload(now, inst){ const p=S.player; inst=inst||p.guns[p.gunIdx]; if(!inst||p.infiniteAmmo||inst.rU) return; const g=GUNS[inst.id], cap=magCap(g), dry=inst.ammo<=0, P=reloadPlan(INFGUN.map[inst.id], dry, 1-Math.max(0,inst.ammo)/cap);
  const r=g.reload*(p.reloadMul||1)*P.k; inst.rD=r; inst.rU=now+r; inst.rDry=dry; inst.rLoad=P.load; inst.rN=Math.max(1, cap-Math.max(0,inst.ammo));
  if(inst===p.guns[p.gunIdx]){ if(!(CV.real && CV.real.pup && r>=GUNHOLD.reload.min)) sfx('reload'); updateGunHUD(); } }
export function reloadNow(){ const p=S.player; if(!p||!p.guns.length||S.mode!=='playing') return; const inst=p.guns[p.gunIdx]; if(inst.rU||p.infiniteAmmo||inst.ammo>=magCap(GUNS[inst.id])) return; startReload(performance.now()/1000, inst); }   // MASTERY: higher level reloads faster
// ----- reload countdown dial: a glowing circular chart billboarded above the tank, flashes ✓ when ready -----
export const reloadCanvas=document.createElement('canvas'); reloadCanvas.width=reloadCanvas.height=160;
export const reloadCtx=reloadCanvas.getContext('2d');
export const reloadTex=new THREE.CanvasTexture(reloadCanvas); reloadTex.colorSpace=THREE.SRGBColorSpace;
export const reloadSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:reloadTex,transparent:true,depthWrite:false,depthTest:false}));
reloadSprite.scale.set(2.1,2.1,1);   /* Z324 smaller */ reloadSprite.visible=false; reloadSprite.renderOrder=999; scene.add(reloadSprite);
export function drawReloadDial(prog, secs, ready){   // Z324 compact: a thin ring filling round and the seconds left — nothing more (no disc, no label, no tick)
  const x=reloadCtx, c=80, r=52; x.clearRect(0,0,160,160); x.lineCap='round';
  x.lineWidth=9; x.strokeStyle='rgba(0,0,0,0.38)'; x.beginPath(); x.arc(c,c,r,0,Math.PI*2); x.stroke();                // a dark track so it reads on sand or sky
  x.lineWidth=5; x.strokeStyle='rgba(255,255,255,0.16)'; x.beginPath(); x.arc(c,c,r,0,Math.PI*2); x.stroke();
  const col = ready ? '#9be35a' : '#ffce4a'; x.lineWidth=6; x.strokeStyle=col;
  x.beginPath(); x.arc(c,c,r,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,Math.max(0,prog))); x.stroke();
  if(!ready){ x.fillStyle=col; x.textAlign='center'; x.textBaseline='middle'; x.font='bold 36px "Share Tech Mono",monospace'; x.shadowColor='rgba(0,0,0,.85)'; x.shadowBlur=5; x.fillText(secs.toFixed(1), c, c+1); x.shadowBlur=0; }
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
    reloadSprite.position.set(p.pos.x, (p.lift||0) + 4.4, p.pos.z);   // over his head
    const rem = reloading ? eq.rU-now : 0;
    drawReloadDial(reloading ? 1-rem/eq.rD : 1, rem, ready);
  } else reloadSprite.visible=false;
}
export function nearestTarget(maxR){
  const p=S.player; let best=null, bd=maxR*maxR;
  for(const e of enemies){ if(e.abandoned) continue; const dx=e.pos.x-p.pos.x, dz=e.pos.z-p.pos.z, d2=dx*dx+dz*dz; if(d2<bd && !tentHidesFromPlayer(e)){ bd=d2; best=e; } }   // Z402 not one hidden behind a tent
  return best;
}
