// game/player-damage.js — PLAYER DAMAGE / DEATH
import * as THREE from 'three';
import { LOOT } from '../../config.js';
import { ARENA, BEST, PLAYER_PAL, S, bigExplode, burst, camera, enemies, floatText, haptic, padHit, recordRun, refreshWallet, ringPulse, saveProfile, setEraTiles, sfx, show, spawnDebris, spawnPart, tankExplode, updateHUD } from '../hub.js';

// ----------------------------- PLAYER DAMAGE / DEATH -----------------------------
export function damagePlayer(dmg, now, dx, dz){ if((now||performance.now()/1000)>=(S.player&&S.player.invincibleUntil||0)){ const P=S.player, f=P?P.facing:0, L=Math.hypot(dx||0,dz||0)||1; padHit(dmg, dx||dz ? -Math.sign(((dx||0)*Math.cos(f)-(dz||0)*Math.sin(f))/L) : 0); }   // Z118 shake hardest on the side it came from   // Z117 a hit kicks the heavy motor    // dx/dz = direction the shot travelled (for the hit-spot burn); optional
  const p=S.player; if(now < p.invincibleUntil) return;
  dmg *= (1 - (p.armor||0));                 // ARMOR upgrade soaks a fraction of incoming damage
  if(p.era>0 && dmg>=LOOT.era.minHit){ p.era--; dmg*=1-LOOT.era.absorb; setEraTiles(p);                 // Z93 REACTIVE ARMOUR: a tile detonates outward and eats most of the hit
    const a=Math.atan2(dx||0, dz||1); burst({x:p.pos.x-Math.sin(a)*1.6, z:p.pos.z-Math.cos(a)*1.6}, 0xffd27a, 8, 8, {y:1.5, life:0.25, size:0.4, grav:-10, drag:2, up:2}); sfx('clang'); floatText('ERA', '#e0c070', p.pos, 14); }
  p.hp -= dmg;
  // HIT REACTION — every hit is FELT: hull flinch/rattle + shake scaled by the blow + red splash
  p.hitT = Math.max(p.hitT||0, 0.26);
  S.shake = Math.min(2.8, S.shake + Math.min(1.3, 0.34 + dmg*0.028)); haptic(Math.min(60, 20+dmg*1.5));
  sfx('hurt');
  burst(p.pos, 0xff5040, 8, 9, {life:0.28, size:1.0, up:3, drag:5}); ringPulse(p.pos, 0xff4632, 1.6);
  addPlayerBurn(dx, dz);                      // a flaming hit-mark on the hull where it was struck (rides with the tank)
  const v=document.getElementById('vignette'); v.style.opacity='1'; setTimeout(()=>v.style.opacity='0', 170);
  updateHUD();
  if(p.hp<=0) playerDie(now);
}
// lingering FIRE + SMOKE on the hull at the spot that was hit (in hull-local angle → rides + rotates with the tank)
export function addPlayerBurn(dx, dz){
  const p=S.player; if(!p.burns) p.burns=[];
  const la = (dx||dz) ? (Math.atan2(-dx,-dz) - p.facing) : Math.random()*6.283;   // struck side faces the shooter
  p.burns.push({ la, r:p.radius*0.72, ly:1.5+Math.random()*0.5, t:1.5+Math.random()*0.7 });
  if(p.burns.length>4) p.burns.shift();       // cap concurrent burn marks
}
// ===== DEATH → RESPAWN cinematic: tank flips, burns & smokes; camera swoops in close; then it rights itself,
// blinks 3× (invincible) and the fight resumes. Makes losing a life land emotionally (not an instant teleport). =====
export const DEATH = { active:false, t:0, dur:2.4, wreck:new THREE.Vector3(), flipDir:1, tilt:0 };
export const _dcam = new THREE.Vector3();   // dedicated temp for the death-cam (don't clobber the shared _v)
export function playerDie(now){
  const p=S.player; p.lives--;
  if(p.lives < 0){ tankExplode(p.pos, 0xffd27a, 2.4, PLAYER_PAL, p.mesh.scale.x); gameOver('HẾT MẠNG'); return; }   // final death → shatter + game over
  beginDeath(now);
}
export function beginDeath(now){
  const p=S.player; S.mode='dying'; S.firing=false;
  DEATH.active=true; DEATH.t=0; DEATH.wreck.copy(p.pos);
  DEATH.flipDir = Math.random()<0.5?1:-1; DEATH.tilt = 0.4+Math.random()*0.4;
  // catastrophic hit — big blast, knock a few parts loose, hard shake
  bigExplode(p.pos, 0xffd27a, 1.9); spawnDebris(p.pos, 1.6, 0x4a3c28);
  S.shake = Math.min(6, S.shake + 4); sfx('bigexplode');
  floatText('XE BỊ HẠ', '#ff5a3c', new THREE.Vector3(p.pos.x,3.2,p.pos.z), 28);
  const v=document.getElementById('vignette'); if(v){ v.style.opacity='1'; }   // hold the red vignette through the death beat
  updateHUD();
}
export const _eoCube = u => 1-Math.pow(1-Math.max(0,Math.min(1,u)),3);
export function updateDeath(dt, now){
  const p=S.player, m=p.mesh; DEATH.t+=dt;
  const wx=DEATH.wreck.x, wz=DEATH.wreck.z;
  // 1) the hull tips over (first ~0.7s) and settles, sinking a touch
  const f=_eoCube(DEATH.t/0.7);
  m.position.set(wx, -0.25*f, wz);
  m.rotation.set(DEATH.tilt*1.7*f*DEATH.flipDir, p.facing, DEATH.tilt*1.3*f);
  // 2) roiling fire + black smoke pouring off the wreck
  if(Math.random()<0.92) spawnPart(wx+(Math.random()-0.5)*1.8, 0.9+Math.random()*1.3, wz+(Math.random()-0.5)*1.8, (Math.random()-0.5)*1.8, 1.6+Math.random()*1.8, (Math.random()-0.5)*1.8, {color: Math.random()<0.5?0xff6a1c:0xffb24a, size:1.0+Math.random()*0.9, life:0.5, grav:0.4, drag:2});
  if(Math.random()<0.85) spawnPart(wx+(Math.random()-0.5)*1.5, 1.5, wz+(Math.random()-0.5)*1.5, (Math.random()-0.5)*1.1, 1.9+Math.random()*1.2, (Math.random()-0.5)*1.1, {color:0x17120c, size:2.0+Math.random()*1.4, life:1.1, smoke:true, grav:-0.6, drag:1.3, op:0.55});
  if(Math.random()<0.045) bigExplode({x:wx+(Math.random()-0.5)*2.2, z:wz+(Math.random()-0.5)*2.2}, 0xff7a3d, 1.1);   // secondary cook-off pops
  // 3) camera swoops in CLOSE + low, slowly circling the burning hulk
  const ang = 2.2 + DEATH.t*0.55, r = 8.5 - 2.0*f;
  _dcam.set(wx+Math.cos(ang)*r, 4.6, wz+Math.sin(ang)*r);
  camera.position.lerp(_dcam, Math.min(1, dt*3.2)); camera.lookAt(wx, 1.0, wz);
  if(DEATH.t >= DEATH.dur) respawnPlayer(now);
}
export function respawnPlayer(now){
  const p=S.player, m=p.mesh; DEATH.active=false;
  // right the hull + reset to the spawn point
  p.hp=p.maxHp; p.pos.set(0,0,ARENA*0.45); p.vel.set(0,0,0); p.facing=p.aim=p.aimSmoothed=-Math.PI;
  m.position.set(p.pos.x,0,p.pos.z); m.rotation.set(0, p.facing, 0); m.visible=true; p.hitT=0; p.burns=[];   // fresh hull, no leftover fires
  p.invincibleUntil = now + 2.6; p.respawnBlinkUntil = now + 1.5;   // brief shield → blink 3× while it holds
  for(const e of enemies){ if(e.pos.distanceTo(p.pos)<13){ const aw=new THREE.Vector3().subVectors(e.pos,p.pos).setLength(17); e.pos.add(aw); } }   // clear the spawn
  S.mode='playing';
  ringPulse(p.pos, 0x8cbf3f, 4); ringPulse(p.pos, 0x8cbf3f, 7);
  showBanner('TRỞ LẠI CHIẾN ĐẤU', '#8cbf3f'); sfx('levelup');
  const v=document.getElementById('vignette'); if(v) v.style.opacity='0';
  updateHUD();
}
export function gameOver(reason){
  if(S.mode==='gameover') return;
  S.mode='gameover';
  document.getElementById('go-score').textContent=S.score.toLocaleString();
  document.getElementById('go-stage').textContent=S.stage;
  document.getElementById('go-wave').textContent=S.wave;
  const beat=recordRun(); const gb=document.getElementById('go-best');
  if(gb){ gb.textContent = beat ? ('★ KỶ LỤC MỚI  '+S.score.toLocaleString()+' ★') : ('KỶ LỤC  '+(BEST.score||0).toLocaleString()); gb.classList.toggle('newbest', beat); }
  const gw=document.getElementById('go-wallet'); if(gw) gw.innerHTML='Đã cất vào kho · <b class="w-coins">0</b> xu · <b class="w-dia">0</b> ◆';
  saveProfile(); refreshWallet();              // bank the coins/diamonds earned this run
  document.body.classList.remove('corelow');
  show('gameover');
}
// banner (reuses combo styling spot)
export let bannerTimer=0;
export function showBanner(text, color){
  const el=document.getElementById('combo');
  el.textContent=text; el.style.color=color||'#e7b54a'; el.style.opacity='1'; el.classList.toggle('long', text.length>34);   // Z84: long notices drop to a calm, readable size
  el.style.transform='translateX(-50%) scale(1.1)';
  bannerTimer = performance.now()/1000 + 1.4;
}
export function __set_bannerTimer(v){ bannerTimer=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
