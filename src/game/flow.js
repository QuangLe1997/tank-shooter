// game/flow.js — GAME FLOW: start / pause / quit-to-menu, loadout guns for the run, menu ↔ HUD state, show/hide panels
import { TROOPS } from '../../config.js';
import { AID, ARENA, GUNS, LOADOUT_MAX, MOBILE, PLAYER, PROFILE, S, TANK_SCALE, WAVE, __set__alarmAt, __set_boss, __set_ridersUnlocked, __set_soldierLvl, applyBiome, applyContractHUD, applyUpgrades, audio, boss, buildBlocks, buildCore, buildObjective, bullets, clearAllyOrdnance, clearAllyTanks, clearArtillery, clearBossFight, clearDrone, clearEnemyMissiles, clearEquip, clearFireteam, clearHeliDown, clearInfDead, clearLootBeacons, clearMines, clearObjective, clearParadrops, clearPickups, clearRiders, clearSoldiers, clearWrecks, core, crewTarget, defaultGunIdx, deployOwnedDrone, deployRiders, deploySoldiers, enemies, enemyPool, engineStart, freeEnemyBar, guardTarget, laserMesh, magCap, makePlayer, openBattleSetup, queueResize, recycleBullet, refreshStartUI, refreshWallet, reqFs, saveProfile, scene, setEraTiles, sfx, showVeil, skipIntro, startIntro, startMusic, tapBtn, updateHUD, updateSpellHUD, updateWeaponHUD } from '../hub.js';

// ----------------------------- GAME FLOW -----------------------------
export function loadoutGuns(){
  let ld=(PROFILE.loadout&&PROFILE.loadout.length?PROFILE.loadout:['rifle']).filter(k=>GUNS[k]).slice(0,LOADOUT_MAX);
  if(!ld.length) ld=['rifle'];
  return ld.map(id=>({ id, ammo:GUNS[id].mag, rU:0, rD:0 }));   // your chosen ≤5 weapons, full mags
}
// Z107 startGame(arg): true = CONTINUE the campaign checkpoint · {mode:'campaign'|'custom', level, …} = a battle from the setup screen ·
// anything else (a click Event from RETRY/RESTART, or nothing) = the same battle again (S.runCfg), else campaign level 1
// Z119 from the menus: put the DEPLOYING veil up, let it paint, then build the world (it used to freeze on the menu)
export function launchGame(arg){ showVeil(true); requestAnimationFrame(()=>requestAnimationFrame(()=>{ try{ startGame(arg); }catch(e){ showVeil(false); throw e; } })); }
export function startGame(arg){
  try{ audio(); engineStart(); }catch(e){}   // diesel loop runs for the whole run (silent outside play)
  const resume = !!(arg===true && PROFILE.save && (PROFILE.save.stage>1 || (PROFILE.save.loop|0)>0));   // CONTINUE passes true; click-handler Events do not
  let cfg = (arg && typeof arg==='object' && arg.mode) ? arg : null;
  if(!cfg && !resume) cfg = S.runCfg || { mode:'campaign', level:1 };
  const L = cfg ? Math.max(1, cfg.level|0) : 0;
  const stStage = resume ? (PROFILE.save.stage|0||1) : ((L-1)%5)+1;
  const stScore = resume ? (PROFILE.save.score|0) : 0;
  const stLoop  = resume ? (PROFILE.save.loop|0) : Math.floor((L-1)/5);
  S.run = cfg ? { ...cfg, level:L } : { mode:'campaign', level:stLoop*5+stStage }; S.runCfg = { ...S.run };
  S.player = S.player || makePlayer();
  buildCore(stStage);                    // monument matching the (resumed) stage
  const p=S.player;
  p.maxHp=100; p.hp=100; p.lives=5; p.fireAt=0; p.weaponLvl=0;
  p.pos.set(0,0,ARENA*0.55); p.vel.set(0,0,0);
  p.dashUntil=0; p.dashCdUntil=0; p.invincibleUntil=0; p.respawnBlinkUntil=0; p.hitT=0; p.burns=[]; p.aimSmoothed=p.aim=-Math.PI;
  p.mesh.visible=true; p.mesh.rotation.set(0,p.aim,0); p.mesh.position.set(p.pos.x,0,p.pos.z);   // ensure upright (clear any death-flip)
  p.overUntil=0; p.spellCdUntil=0; p.shieldUntil=0; if(p.shieldMesh) p.shieldMesh.visible=false;
  // gun inventory → the player's chosen battle loadout (≤5), each full mag
  p.guns=loadoutGuns(); p.gunIdx=defaultGunIdx(); p.readyUntil=0; p._barrelId=null; p.infiniteAmmo=false; p.ammoMul=1;
  p.buffUntil={ rapid:0, power:0, speed:0, infammo:0, ammoup:0, turbo:0, ram:0, siege:0 }; p.buffLv={ turbo:0 }; p.era=0; setEraTiles(p);
  // reset roguelite multipliers
  p.dmgMul=1; p.fireMul=1; p.speedMul=1; p.dashCdMul=1; p.spellCdMul=1; p.crit=0; p.lifesteal=0; p.rangeMul=1; p.reloadMul=1; p.armor=0;
  applyUpgrades(p); p.hp=p.maxHp;                          // bake in shop upgrades (HP/dmg/range/speed/mag/reload/armor)
  for(const gi of p.guns) gi.ammo = magCap(GUNS[gi.id]);    // start each gun with its (upgraded) full magazine
  p.buffUntil.range=0; p.scale=1; p.radius=PLAYER.radius*TANK_SCALE; p.mesh.scale.setScalar(TANK_SCALE);
  // clear combat
  for(let i=bullets.length-1;i>=0;i--) recycleBullet(i);
  for(const e of enemies){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); freeEnemyBar(e.bar); e.bar=null; }
  enemies.length=0; AID.at=0; AID.press=false; clearArtillery(); clearPickups(); clearMines(); clearDrone(); clearSoldiers(); clearFireteam(); clearRiders(); clearLootBeacons(); clearEnemyMissiles(); clearInfDead(); clearHeliDown(); clearEquip(); clearObjective(); clearAllyTanks(); clearParadrops(); clearAllyOrdnance(); __set_ridersUnlocked(false); if(1>=TROOPS.ridersFrom){ __set_ridersUnlocked(true); deployRiders(crewTarget()); }   /* Z89 crew ride from stage 1 */ __set_soldierLvl(PROFILE.upgrades.troops||0); deploySoldiers(guardTarget()); deployOwnedDrone(); document.body.classList.remove('corelow'); __set__alarmAt(0);
  if(boss){ scene.remove(boss.mesh); clearBossFight(); __set_boss(null); }
  if(laserMesh) laserMesh.visible=false;
  document.getElementById('bossbar').style.display='none';
  S.timeScale=1; S.awaitingUpgrade=false; S.cmd=null; S.contract=null; applyContractHUD();   // fresh run → no contract until the stage-1 briefing
  core.maxHp=240; core.hp=240;
  S.score=stScore; S.stage=stStage; S.loop=stLoop; S.wave=0; S.firing=false; S.combo=0; S.comboUntil=0; S.shake=0;
  S.weapon=0; S.spell=0; S.enemySlowUntil=0;
  applyBiome(stStage); buildBlocks(); clearWrecks(); buildObjective();
  updateWeaponHUD(); updateSpellHUD();
  WAVE.active=false; WAVE.betweenUntil=performance.now()/1000 + 0.6; WAVE.spawnQueue.length=0;
  WAVE.event=null; WAVE.eventBanner=null; WAVE.treasure=false; WAVE.eliteForce=0; WAVE.assault=false;
  document.getElementById('combo').style.opacity='0';
  hide('start'); hide('pause'); hide('gameover'); hide('upgrade'); hide('victory');
  audio(); startMusic(); sfx('click');
  if(MOBILE || PROFILE.autoFs!==false){ reqFs(); setTimeout(queueResize, 300); setTimeout(queueResize, 800); }   // go immersive (Z97: desktop too) + refit after fullscreen/orientation settle
  updateHUD();
  startIntro();          // deploy showcase → hands off to gameplay camera, then play begins
}
export function togglePause(){
  if(S.mode==='briefing' || S.mode==='deploy'){ quitToMenu(); return; }   // Z111b Esc before the battle starts = back to the home menu
  if(S.mode==='playing'){ S.mode='paused'; show('pause'); saveProfile(); }
  else if(S.mode==='paused'){ S.mode='playing'; hide('pause'); }
}
// end the current match → back to the HOME menu (replay or re-pick terrain/loadout). Mirrors startGame's teardown.
export function quitToMenu(){
  S.firing=false;
  for(let i=bullets.length-1;i>=0;i--) recycleBullet(i);                                   // pool all live bullets
  for(const e of enemies){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); freeEnemyBar(e.bar); e.bar=null; }
  enemies.length=0; clearArtillery(); clearPickups(); clearMines(); clearDrone(); clearSoldiers(); clearRiders(); clearLootBeacons(); clearEnemyMissiles(); clearInfDead(); clearHeliDown(); clearEquip(); clearObjective(); clearAllyTanks(); clearParadrops(); clearAllyOrdnance();
  if(boss){ scene.remove(boss.mesh); clearBossFight(); __set_boss(null); }
  if(S.player){ S.player.pos.set(0,0,ARENA*0.55); S.player.vel.set(0,0,0); S.player.mesh.position.set(0,0,ARENA*0.55); S.player.mesh.visible=true; }   // park at spawn for a clean home
  document.body.classList.remove('corelow','shopopen'); __set__alarmAt(0);
  S.mode='start';
  hide('pause'); hide('gameover'); for(const id of ['briefing','deploy','upgrade','victory','tip']){ const o=document.getElementById(id); if(o && !o.classList.contains('hidden')) hide(id); } show('start');   // Z111b also from the briefing / deploy screens
  refreshStartUI(); refreshWallet(); saveProfile(); sfx('click');
}
// any open menu hides the battle HUD + the mobile control pads — on a phone they used to sit right
// on top of the menu buttons (FIRE/DASH/SWAP behind PLAY), which read as "broken, overlapping UI"
export function syncMenuState(){
  const open = [...document.querySelectorAll('.overlay')].some(o=>!o.classList.contains('hidden'));
  document.body.classList.toggle('inmenu', open);
}
export function show(id){ document.getElementById(id).classList.remove('hidden'); syncMenuState(); }
export function hide(id){ document.getElementById(id).classList.add('hidden'); syncMenuState(); }
tapBtn('playBtn', ()=>openBattleSetup('campaign'));   // Z107 PLAY → battle setup (campaign ladder / custom battle)
// skip the deploy cinematic on any input (after a short grace window)
addEventListener('pointerdown', ()=>skipIntro());
addEventListener('keydown', ()=>skipIntro());
document.getElementById('resumeBtn').onclick = ()=>{ togglePause(); if(!document.fullscreenElement && PROFILE.autoFs!==false){ reqFs(); setTimeout(queueResize,300); } };   // Z97 back to fullscreen after Esc
document.getElementById('restartBtn').onclick = startGame;
tapBtn('homeBtn', quitToMenu); tapBtn('goHomeBtn', quitToMenu); tapBtn('brBack', quitToMenu); tapBtn('dp-back', quitToMenu);   // Z111b + briefing / deploy   // pause / game-over → back to home menu
document.getElementById('retryBtn').onclick = ()=>launchGame();
document.getElementById('retryBtn').addEventListener('touchstart', e=>{e.preventDefault();launchGame();},{passive:false});
export const ngp=document.getElementById('ngplusBtn');
ngp.onclick = ()=>launchGame(S.run&&S.run.mode==='custom' ? S.runCfg : true);                                            // resume into the NG+ loop the victory() set up
ngp.addEventListener('touchstart', e=>{e.preventDefault();launchGame(S.run&&S.run.mode==='custom' ? S.runCfg : true);},{passive:false});
