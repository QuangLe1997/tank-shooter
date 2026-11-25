// game/flow.js — GAME FLOW: start / pause / quit-to-menu, loadout guns for the run, menu ↔ HUD state, show/hide panels
import { CAV, CORE_DEF } from '../../config.js';
import { modelEpoch, veilOrder, askConfirm, confirmOpen, opFor, biomeVi, BIOME, SOLDIER, reportRun, CV, GUNS, cavRespawn, clearSoldierWar, driverBack, magCap, makeCavPlayer, rankReset, squadReset, trooperGuns, duelReset, gpuHeld, gpuRelease, clearGifts, VOICE_RULES, ARENA, MOBILE, PROFILE, S, WAVE, __set__alarmAt, __set_soldierLvl, applyBiome, applyContractHUD, audio, buildBlocks, buildCore, buildLava, buildObjective, buildTrails, buildUnderground, bullets, clearAllyOrdnance, clearDrone, clearEnemyMissiles, clearEquip, clearFieldcraft, clearFireteam, clearHeliDown, clearHelis, clearInfDead, clearLadders, clearLootBeacons, clearObjective, clearParadrops, clearPickups, clearRelic, clearSoldiers, clearSquads, clearSurprises, core, deploySoldiers, dropCavPlayer, enemies, enemyPool, freeEnemyBar, preloadVoices, queueResize, recycleBullet, refreshStartUI, reqFs, saveProfile, scene, sfx, showVeil, skipIntro, startIntro, startMusic, tapBtn, updateHUD, updateSpellHUD, updateWeaponHUD, openBattleSetup } from '../hub.js';

// ----------------------------- GAME FLOW -----------------------------
// Z107 startGame(arg): true = CONTINUE the campaign checkpoint · {mode:'campaign'|'custom', level, …} = a battle from the setup screen ·
// anything else (a click Event from RETRY/RESTART, or nothing) = the same battle again (S.runCfg), else campaign level 1
// Z119 from the menus: put the DEPLOYING veil up, let it paint, then build the world (it used to freeze on the menu)
export function launchGame(arg){ S.launchFrom = (arg && typeof arg==='object' && arg.mode) ? 'setup' : 'home';   // XK-UI where the stage-1 briefing's back button goes
  veilOrder(arg); showVeil(true); requestAnimationFrame(()=>requestAnimationFrame(()=>{ try{ startGame(arg); }catch(e){ showVeil(false); throw e; } })); }
export function startGame(arg){
  if(globalThis.__reseed) globalThis.__reseed(0);   // TEST 1 ?seed=N: the same battlefield every time (boot/safety.js)
  const held=gpuHeld(); modelEpoch();   // Z396 what the old battlefield holds on the GPU, released once the new one stands · MEM 1 a new field: the models it asks for from here on are kept
  try{ audio(); preloadVoices(['open', 'streak', ...VOICE_RULES.map(r=>r[1]), 'x_scream', 'x_cheer', 'f_rally_1', 'f_rally_2', 'f_rally_3']); }catch(e){}   // diesel loop runs for the whole run (silent outside play)
  const resume = !!(arg===true && PROFILE.save && (PROFILE.save.stage>1 || (PROFILE.save.loop|0)>0));   // CONTINUE passes true; click-handler Events do not
  let cfg = (arg && typeof arg==='object' && arg.mode) ? arg : null;
  if(!cfg && !resume) cfg = S.runCfg || { mode:'campaign', level:1 };
  const L = cfg ? Math.max(1, cfg.level|0) : 0;
  const stStage = resume ? (PROFILE.save.stage|0||1) : ((L-1)%5)+1;
  const stScore = resume ? (PROFILE.save.score|0) : 0;
  const stLoop  = resume ? (PROFILE.save.loop|0) : Math.floor((L-1)/5);
  S.runId = Date.now().toString(36)+Math.random().toString(36).slice(2,6);   // Z163 the leaderboard follows one run's score
  S.run = cfg ? { ...cfg, level:L } : { mode:'campaign', level:stLoop*5+stStage }; S.runCfg = { ...S.run };
  if(!['cav','xeom','bagac','bantai'].includes(PROFILE.unit)) PROFILE.unit = ['cav','xeom','bagac','bantai'].includes(PROFILE.lastRide) ? PROFILE.lastRide : 'xeom';   // (no-tanks: an old profile's tank or xích lô → his last ride, else the xe ôm)
  const cavKind = PROFILE.unit==='cav' ? null : PROFILE.unit;   // Z245 the unit picked in CHUẨN BỊ TRẬN · Z282 or the xe ôm / ba gác / bán tải
  if(S.player && (!S.player.cav || (S.player.bike||null)!==cavKind)){ if(S.player.cav) dropCavPlayer(S.player); else scene.remove(S.player.mesh); S.player=null; }   // a different ride was picked → the new one rolls out
  S.player = S.player || makeCavPlayer(cavKind);
  clearRelic();                          // Z154 a new run: no relic power carried over
  buildCore(stStage);                    // monument matching the (resumed) stage
  const p=S.player;
  p.maxHp=100; p.hp=100; p.lives=5; p.fireAt=0; p.weaponLvl=0;
  p.pos.set(0,0,ARENA*0.55); p.vel.set(0,0,0);
  p.dashUntil=0; p.dashCdUntil=0; p.invincibleUntil=0; p.respawnBlinkUntil=0; p.hitT=0; p.burns=[]; p.aimSmoothed=p.aim=-Math.PI;
  p.mesh.visible=true; p.mesh.rotation.set(0,p.aim,0); p.mesh.position.set(p.pos.x,0,p.pos.z);   // ensure upright (clear any death-flip)
  p.overUntil=0; p.spellCdUntil=0; p.shieldUntil=0; if(p.shieldMesh) p.shieldMesh.visible=false;
  // gun inventory → the player's chosen battle loadout (≤5), each full mag
  p.readyUntil=0; p._barrelId=null; p.infiniteAmmo=false; p.ammoMul=1;
  p.buffUntil={ rapid:0, power:0, infammo:0, ammoup:0 }; p.buffLv={};
  // reset roguelite multipliers
  p.dmgMul=1; p.fireMul=1; p.speedMul=1; p.dashCdMul=1; p.spellCdMul=1; p.crit=0; p.lifesteal=0; p.rangeMul=1; p.reloadMul=1; p.armor=0;
  // the soldier's rifle and his own toughness (Z331 a new run: back in the saddle, the driver on his seat, whatever the last one ended in)
  clearSoldierWar(); if(CV.dead || !CV.mounted) cavRespawn(p); driverBack(CV.H); p.guns = trooperGuns(); p.gunIdx = 0; p.dmgMul = CAV.atk; p.crit = CAV.crit; p.fireMul = CAV.fireK;   // a marksman's eye, quick hands, heavy rifle rounds
  p.maxHp = CAV.soldier.hp; p.hp = p.maxHp; p.accelMul = p.turnMul = p._size = 1; for(const gi of p.guns) gi.ammo = magCap(GUNS[gi.id]); p.radius = CAV.radius.mounted; p.mesh.scale.setScalar(1);
  rankReset(); squadReset(); duelReset();   // Z350 Binh nhì again · Z351 his two men · Z353 no duel left over
  p.buffUntil.range=0; p.scale=1;
  // clear combat
  for(let i=bullets.length-1;i>=0;i--) recycleBullet(i);
  for(const e of enemies){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); freeEnemyBar(e.bar); e.bar=null; }
  enemies.length=0; clearSquads(); clearFieldcraft(); clearHelis(); clearSurprises(); clearPickups(); clearGifts(); clearDrone(); clearSoldiers(); clearFireteam(); clearLootBeacons(); clearEnemyMissiles(); clearInfDead(); clearHeliDown(); clearEquip(); clearObjective(); clearParadrops(); clearAllyOrdnance(); __set_soldierLvl(0); deploySoldiers(SOLDIER.base); document.body.classList.remove('corelow'); __set__alarmAt(0);
  duelReset();   // (no-tanks: the stage's general, on foot)
  document.getElementById('bossbar').style.display='none';
  S.timeScale=1; S.awaitingUpgrade=false; S.cmd=null; S.contract=null; applyContractHUD();   // fresh run → no contract until the stage-1 briefing
  core.maxHp=CORE_DEF.hp; core.hp=CORE_DEF.hp; core.shieldReady=0; core.shieldUntil=0;
  S.score=stScore; S.stage=stStage; S.loop=stLoop; S.wave=0; S.firing=false; S.combo=0; S.comboUntil=0; S.shake=0;
  S.weapon=0; S.spell=0; S.enemySlowUntil=0;
  applyBiome(stStage); buildBlocks(); buildObjective(); buildLava(); buildUnderground(); buildTrails(); gpuRelease(held);   // Z187 lava pools go in last (clear of forts and cover) · Z225 the tunnels + the cavern
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
// Z180 a new stage: the soldier goes back to the spawn the world generator keeps clear — the last stage's
// position may be inside a fort, a wall or a building of the next battlefield. Ladder parties let go of the old walls.
export function parkAtSpawn(){ const p=S.player; if(!p) return; const sz=ARENA*0.55;
  p.pos.set(0,0,sz); p.vel.set(0,0,0); p.facing=p.aim=p.aimSmoothed=-Math.PI; p.mesh.position.set(0,0,sz); p.mesh.rotation.set(0,p.aim,0);
  clearLadders(); }
export function togglePause(){
  if(S.mode==='briefing' || S.mode==='deploy'){ quitToMenu(); return; }   // Z111b Esc before the battle starts = back to the home menu
  if(S.mode==='playing'){ S.mode='paused'; pauseWhere(); show('pause'); saveProfile(); }
  else if(S.mode==='paused'){ if(confirmOpen() || PAUSE_SUBS.some(id=>{ const o=document.getElementById(id); return o && !o.classList.contains('hidden'); })) return;   // XK-UI P / ☰ in a screen opened from the pause (settings, key sheet, arsenal, a question) does not drop you into the fight under it
    S.mode='playing'; hide('pause'); }
}
const PAUSE_SUBS = ['settings', 'keysDlg', 'loadout', 'padWiz'];
// XK-UI the pause screen says where you are: the stage, the battlefield, the wave
function pauseWhere(){ const el=document.getElementById('pauseWhere'); if(!el) return; let op=null; try{ op=opFor(S.stage); }catch(e){}
  const nm=s=>{ s=String(s||'').toLocaleLowerCase('vi'); return s.charAt(0).toLocaleUpperCase('vi')+s.slice(1); };
  el.textContent='Màn '+S.stage+(BIOME ? ' · '+nm(biomeVi(BIOME.name)) : '')+(S.wave ? ' · đợt '+S.wave : '')+(op && op.title ? ' — '+nm(op.title) : ''); }
// XK-UI leaving a battle in progress asks first (the stage's progress would be lost); from the end screens it just goes
export function askLeave(){ askConfirm({ title:'Rời trận?', body:'Tiến độ màn này sẽ mất. Kỷ lục và các màn đã thắng vẫn được giữ.', yes:'Rời trận', no:'Ở lại', danger:true }, quitToMenu); }
export function askRestart(){ askConfirm({ title:'Chơi lại màn này?', body:'Trận đang đánh dở sẽ bắt đầu lại từ đầu.', yes:'Chơi lại', no:'Ở lại' }, ()=>launchGame()); }
// end the current match → back to the HOME menu (replay or re-pick terrain/loadout). Mirrors startGame's teardown.
export function quitToMenu(){
  S.firing=false; try{ reportRun({ cleared:false }); }catch(e){}   // Z163 the run's score goes to the leaderboard
  for(let i=bullets.length-1;i>=0;i--) recycleBullet(i);                                   // pool all live bullets
  for(const e of enemies){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); freeEnemyBar(e.bar); e.bar=null; }
  enemies.length=0; clearPickups(); clearGifts(); clearDrone(); clearSoldiers(); clearLootBeacons(); clearEnemyMissiles(); clearInfDead(); clearHeliDown(); clearEquip(); clearObjective(); clearParadrops(); clearAllyOrdnance();
  duelReset();
  if(S.player){ S.player.pos.set(0,0,ARENA*0.55); S.player.vel.set(0,0,0); S.player.mesh.position.set(0,0,ARENA*0.55); S.player.mesh.visible=true; }   // park at spawn for a clean home
  document.body.classList.remove('corelow','shopopen'); __set__alarmAt(0);
  S.mode='start';
  hide('pause'); hide('gameover'); for(const id of ['briefing','deploy','upgrade','victory','tip','relicDlg','settings','keysDlg','loadout','padWiz','xkConfirm']){ const o=document.getElementById(id); if(o && !o.classList.contains('hidden')) hide(id); } show('start');   // Z111b also from the briefing / deploy screens · XK-UI and whatever the pause had open
  { const cd=document.getElementById('countdown'), sub=document.getElementById('cdSub'), co=document.getElementById('combo'), sw=document.getElementById('stagewipe'), ch=document.getElementById('coach');   // XK-UI nothing of the battle is left painted over the home screen
    if(cd){ cd.className=''; cd.textContent=''; } if(sub) sub.classList.remove('on'); if(co) co.style.opacity='0'; if(sw) sw.classList.remove('show'); if(ch) ch.classList.remove('on'); }
  refreshStartUI(); saveProfile(); sfx('click');
}
// any open menu hides the battle HUD + the mobile control pads — on a phone they used to sit right
// on top of the menu buttons (FIRE/DASH/SWAP behind PLAY), which read as "broken, overlapping UI"
export function syncMenuState(){
  const open = [...document.querySelectorAll('.overlay')].some(o=>!o.classList.contains('hidden'));
  document.body.classList.toggle('inmenu', open);
}
export function show(id){ document.getElementById(id).classList.remove('hidden'); syncMenuState(); }
export function hide(id){ document.getElementById(id).classList.add('hidden'); syncMenuState(); }
tapBtn('playBtn', ()=>openBattleSetup());   // Z354 PLAY opens CHUẨN BỊ TRẬN at its first step (tank or soldier · his gear · where) — XUẤT KÍCH there still goes in at once with the last choices · (Z152 it went straight into the next campaign level)
// skip the deploy cinematic on any input (after a short grace window)
addEventListener('pointerdown', ()=>skipIntro());
addEventListener('keydown', ()=>skipIntro());
document.getElementById('resumeBtn').onclick = ()=>{ togglePause(); if(!document.fullscreenElement && PROFILE.autoFs!==false){ reqFs(); setTimeout(queueResize,300); } };   // Z97 back to fullscreen after Esc
tapBtn('restartBtn', askRestart);   // XK-UI asks first, then rebuilds behind the deployment veil
tapBtn('homeBtn', askLeave); tapBtn('goHomeBtn', quitToMenu); tapBtn('vicHomeBtn', quitToMenu);   // pause (asks) / game over / victory → home
tapBtn('upHome', ()=>askConfirm({ title:'Về trang chủ?', body:'Màn vừa thắng đã được lưu — bấm Chơi tiếp ở trang chủ để đánh tiếp màn sau. Phần thưởng chưa chọn sẽ bỏ qua.', yes:'Về trang chủ', no:'Ở lại' }, quitToMenu));
document.getElementById('retryBtn').onclick = ()=>launchGame();
document.getElementById('retryBtn').addEventListener('touchstart', e=>{e.preventDefault();launchGame();},{passive:false});
export const ngp=document.getElementById('ngplusBtn');
ngp.onclick = ()=>launchGame(S.run&&S.run.mode==='custom' ? S.runCfg : true);                                            // resume into the NG+ loop the victory() set up
ngp.addEventListener('touchstart', e=>{e.preventDefault();launchGame(S.run&&S.run.mode==='custom' ? S.runCfg : true);},{passive:false});
