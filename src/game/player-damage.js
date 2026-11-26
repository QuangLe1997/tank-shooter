// game/player-damage.js — PLAYER DAMAGE / DEATH
import * as THREE from 'three';
import { CAV, RIDE_ACT } from '../../config.js';
import { modeOver, reportRun, soldierHitFX, BEST, CV, S, clampField, heightAt, burst, camera, cavDeathStart, cavDeathUpdate, cavRespawn, enemies, floatText, haptic, padHit, recordRun, ringPulse, saveProfile, sayVoice, sfx, show, updateHUD, rideHit, driverBack, driverDone, driverSurrender, dirDeath, nemDeathLine, nemPlayerDied } from '../hub.js';

// ----------------------------- PLAYER DAMAGE / DEATH -----------------------------
export function damagePlayer(dmg, now, dx, dz){ if((now||performance.now()/1000)>=(S.player&&S.player.invincibleUntil||0)){ const P=S.player, f=P?P.facing:0, L=Math.hypot(dx||0,dz||0)||1; padHit(dmg, dx||dz ? -Math.sign(((dx||0)*Math.cos(f)-(dz||0)*Math.sin(f))/L) : 0); }   // Z118 shake hardest on the side it came from   // Z117 a hit kicks the heavy motor    // dx/dz = direction the shot travelled (for the hit-spot burn); optional
  const p=S.player; if(now < p.invincibleUntil) return;
  dmg *= (1 - (p.armor||0));                 // ARMOR upgrade soaks a fraction of incoming damage
  dmg *= p.defK||1;                          // Z245 plate armour, and lying flat / kneeling makes a smaller target
  p.hp -= dmg; if(p.cav && p.bike) rideHit(dmg, dx, dz);   // Z296 the driver ducks — a heavy hit may bring the bike down
  if(p.hp > 0 && p.hp < p.maxHp*0.3 && p.hp+dmg >= p.maxHp*0.3) sayVoice('lowhp');
  // HIT REACTION — every hit is FELT: a flinch + shake scaled by the blow + red splash
  p.hitT = Math.max(p.hitT||0, 0.26);
  S.shake = Math.min(2.8, S.shake + Math.min(1.3, 0.34 + dmg*0.028)); haptic(Math.min(60, 20+dmg*1.5));
  sfx('hurt');
  burst(p.pos, 0xff5040, 8, 9, {life:0.28, size:1.0, up:3, drag:5}); ringPulse(p.pos, 0xff4632, 1.6);
  soldierHitFX(p, dx, dz, dmg);   // he bleeds, and a red marker pointing at the shooter
  const v=document.getElementById('vignette'); v.style.opacity='1'; setTimeout(()=>v.style.opacity='0', 170);
  updateHUD();
  if(p.hp<=0) playerDie(now);
}
// ===== DEATH → RESPAWN: the soldier falls (game/cavalry.js), the camera circles where he lies; then he is back in the saddle where he fell
// (NO-TANKS 10: he was sent back to the spawn point, a long way from the fight), facing as he was, blinks 3× (invincible) and the fight resumes; the last life lost, the driver gives himself up beside him and the battle is lost =====
export const DEATH = { active:false, t:0, dur:2.4, wreck:new THREE.Vector3(), face:0, flipDir:1, tilt:0, final:false };   // (Z331 final: the last life — the fall plays out, then the battle is lost)
export const _dcam = new THREE.Vector3();   // dedicated temp for the death-cam (don't clobber the shared _v)
export function playerDie(now){
  const p=S.player; p.lives--; dirDeath(); nemPlayerDied();   // DIR 3 the director counts the deaths on this stage (the second eases its thresholds)
  if(p.lives < 0){ beginDeath(now, true); return; }   // final death → (Z331 his fall and the driver giving himself up play out first)
  beginDeath(now);
}
export function beginDeath(now, final){
  const p=S.player; S.mode='dying'; S.firing=false;
  DEATH.active=true; DEATH.t=0; DEATH.wreck.copy(p.pos); DEATH.face=p.facing||0; DEATH.final=!!final;
  cavDeathStart(p, now); driverSurrender(CV.H); floatText('TƯỚNG TRÚNG ĐẠN', '#ff5a3c', new THREE.Vector3(p.pos.x,3.2,p.pos.z), 28); const v=document.getElementById('vignette'); if(v) v.style.opacity='1'; updateHUD();   // Z254 the soldier is shot off his ride
}
export function updateDeath(dt, now){
  const p=S.player, m=p.mesh; DEATH.t+=dt;
  cavDeathUpdate(dt, now); const w=CV.dead ? CV.dead.pos : p.pos, ang=2.2+DEATH.t*0.45, r=6.5;   // Z254 the camera circles where the general fell
    _dcam.set(w.x+Math.cos(ang)*r, w.y+3.4, w.z+Math.sin(ang)*r); camera.position.lerp(_dcam, Math.min(1, dt*3)); camera.lookAt(w.x, w.y+0.6, w.z);
    if(DEATH.t >= CAV.death.dur){ if(!DEATH.final) respawnPlayer(now); else if(driverDone(CV.H) || DEATH.t >= CAV.death.dur + RIDE_ACT.give.wait){ DEATH.active=false; DEATH.final=false; gameOver('HẾT MẠNG'); } }   // Z331 the last life: held until the driver is on his knees by the body
}
export function respawnPlayer(now){
  const p=S.player, m=p.mesh, B=CV.dead && CV.dead.pos, at={ x:B ? B.x : DEATH.wreck.x, z:B ? B.z : DEATH.wreck.z }, face=DEATH.face;   // where he lies (the ride may have run on)
  DEATH.active=false; cavRespawn(p); driverBack(CV.H);   // Z245 the soldier is back in the saddle (Z331 and the driver back on his seat)
  clampField(at, 3); p.hp=p.maxHp; p.pos.set(at.x,0,at.z); p.vel.set(0,0,0); p.facing=p.aim=p.aimSmoothed=CV.facing=face;   // NO-TANKS 10 up where he fell, facing as he was
  m.position.set(p.pos.x,heightAt(p.pos.x,p.pos.z),p.pos.z); m.rotation.set(0, p.facing, 0); m.visible=true; p.hitT=0;
  p.invincibleUntil = now + 2.6; p.respawnBlinkUntil = now + 1.5;   // brief shield → blink 3× while it holds
  for(const e of enemies){ if(e.pos.distanceTo(p.pos)<13){ const aw=new THREE.Vector3().subVectors(e.pos,p.pos).setLength(17); e.pos.add(aw); } }   // clear the spot
  S.mode='playing';
  ringPulse(p.pos, 0x8cbf3f, 4); ringPulse(p.pos, 0x8cbf3f, 7);
  showBanner('TRỞ LẠI CHIẾN ĐẤU', '#8cbf3f'); sfx('levelup');
  const v=document.getElementById('vignette'); if(v) v.style.opacity='0';
  updateHUD();
}
export function gameOver(reason){
  if(S.mode==='gameover') return;
  if(modeOver(reason)) return;   // MODE 3 a night defence / a daily challenge ends on its own result card: no campaign record, no report (campaign/mode-run.js)
  S.mode='gameover'; try{ reportRun({ cleared:false }); }catch(e){}
  { const w=document.getElementById('go-why'), L=Math.max(0, S.player ? S.player.lives : 0);   // Z133 say WHY the battle was lost (the base core can fall while you still have lives)
    const nm=t=>{ t=String(t||'').toLocaleLowerCase('vi'); return t.charAt(0).toLocaleUpperCase('vi')+t.slice(1); };   // XK-UI the reason in plain sentence case
    if(w) w.innerHTML = reason==='HẾT MẠNG' ? '<b>Hết mạng.</b> Người lính ngã xuống khi không còn lượt hồi sinh.' : '<b>'+nm(reason)+'.</b> Mất Lõi căn cứ là thua ngay, dù còn ×'+L+' mạng. Để mắt tới thanh Lõi và chạy về chặn địch khi nó tụt.'; nemDeathLine(w); }   // NEMESIS 3 the general's word when the last life went to him
  document.getElementById('go-score').textContent=S.score.toLocaleString('vi-VN');
  document.getElementById('go-stage').textContent=S.stage;
  document.getElementById('go-wave').textContent=S.wave;
  const beat=recordRun(); const gb=document.getElementById('go-best');
  if(gb){ gb.textContent = beat ? ('Kỷ lục mới: '+S.score.toLocaleString('vi-VN')+' điểm') : ('Kỷ lục của bạn: '+(BEST.score||0).toLocaleString('vi-VN')+' điểm'); gb.classList.toggle('newbest', beat); }
  saveProfile();
  document.body.classList.remove('corelow');
  show('gameover');
}
// banner (reuses combo styling spot)
export let bannerTimer=0;
export function showBanner(text, color){
  const el=document.getElementById('combo');
  el.textContent=text; el.style.color=color||'#e7b54a'; el.style.opacity='1'; el.classList.toggle('long', text.length>34); el.classList.toggle('warn', /^⚠|!$/.test(text));   // Z228 a warning gets the hazard-striped plate   // Z84: long notices drop to a calm, readable size
  el.style.transform='translateX(-50%) scale(1.1)';
  bannerTimer = performance.now()/1000 + 1.4;
}
export function __set_bannerTimer(v){ bannerTimer=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
