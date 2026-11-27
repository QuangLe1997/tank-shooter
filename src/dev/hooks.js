// dev/hooks.js — Z103 split from game/loop.js: window._* inspection/driving hooks used by Playwright smoke tests and the
// #dev console. Nothing in the game reads these; a production build may drop this module from hub.js.
import { CONTRACTS, DAILY } from '../../config.js';
import { composeBattle } from '../hub.js';   // MIX 1 (campaign/mixer.js)
import { dailyDay, dailyLaunch, nightDefLaunch, launchGame, launchStage, BIOME, BIOMES, DEATH, FT, GUNS, OBJ, PH, POWERUPS, PROFILE, S, WAVE, __set_last, __set_soldierLvl, aimDots, applyAtmosphere, applyBiome, applyPowerup, beginDeath, blocks, bootHide, bootReady, buildObjective, buildTerrainDecor, buildTerrainPicker, bullets, cMod, camera, chooseContract, clearProgress, composer, core, cycleGun, damageBlock, damageEnemy, damagePlayer, debris, decorGroup, deploySoldiers, doResize, dropPowerup, enemies, enemyBarPool, fireFlame, heightAt, impactFX, intro, killEnemy, launchParadrop, loop, makeElite, openBriefing, openLoadout, openUpgrade, parts, pickups, playerDie, renderer, respawnPlayer, rocketTarget, rockets, rollWaveEvent, saveProgress, scene, selectGun, skipIntro, soldierLvl, soldiers, spawnEnemy, startBoss, startGame, vehicleExplode, towers, trySpell, updateDeath, updateEnemies, updateEnemyBar, updateRockets } from '../hub.js';

// diagnostics hooks (used for automated testing)
window._game = S;
window._dbg = { enemies, bullets, pickups, get core(){return core;} };
window._spawn = spawnEnemy;
window._cycleGun = cycleGun; window._drop = dropPowerup;
window._dbg.blocks = blocks; window._dbg.debris = debris; window._dbg.rockets = rockets;
window._intro = intro;   // deploy-cinematic state (debug/inspection)
window._profile = PROFILE; window._openLoadout = openLoadout;   // profile/arsenal hooks
window._saveProgress = saveProgress; window._clearProgress = clearProgress;              // checkpoint hooks (debug/test)
window._WAVE = WAVE; window._rollWaveEvent = rollWaveEvent; window._makeElite = makeElite; window._dbg.killEnemy = killEnemy; window._dbg.damageEnemy = damageEnemy;   // NG+/event hooks (debug/test)
window._selectGun = selectGun;
window._openBriefing = openBriefing; window._chooseContract = chooseContract; window._cMod = cMod; Object.defineProperty(window,'_contract',{get:()=>S.contract});   // CONTRACT hooks (debug/test)
window._GUNS = GUNS; window._impactFX = impactFX; window._vehicleExplode = vehicleExplode;   // FEEL hooks (debug/test): knock/fx
window._updateEnemyBar = updateEnemyBar; window._enemyBarPool = enemyBarPool;   // enemy HP-bar hooks (debug/test)
window._playerDie = playerDie; window._beginDeath = beginDeath; window._updateDeath = updateDeath; window._respawnPlayer = respawnPlayer; Object.defineProperty(window,'_DEATH',{get:()=>DEATH});   // DEATH→respawn hooks (debug/test)
window._damagePlayer = damagePlayer; window._updateEnemies = updateEnemies;   // hit-reaction + enemy-AI hooks (debug/test)
window._updateRockets = updateRockets;   // lobbed rounds (debug/test)
window._dbg.aimDots = aimDots; window._rocketTarget = rocketTarget;   // M79 aim-preview hooks (debug/test)
window._fireFlame = fireFlame; window._dbg.parts = parts;   // flamethrower hook (debug/test)
window._applyBiome = applyBiome; window._BIOMES = BIOMES; window._buildTerrainDecor = buildTerrainDecor; window._buildTerrainPicker = buildTerrainPicker;   // TERRAIN hooks (debug/test)
Object.defineProperty(window,'_BIOME',{get:()=>BIOME}); Object.defineProperty(window,'_decorCount',{get:()=>decorGroup.children.length});
window._openUpgrade = openUpgrade;   // (debug) preview the stage-won reward screen
window._startBoss = startBoss;   // (debug) the general takes the field
window._powerup = (id)=>{ const d=POWERUPS.find(x=>x.id===id); if(d) applyPowerup(d); return !!d; };   // (debug) grant a power-up
window._view = { get camera(){return camera;}, get scene(){return scene;}, get renderer(){return renderer;}, get composer(){return composer;} };   // (debug) inspect/drive the view
window._dbg.soldiers = soldiers; window._deploy = deploySoldiers; window._armory = ()=>{ __set_soldierLvl(soldierLvl + 1); return soldierLvl; };   // (debug) friendly squad
window._vehicleExplode = vehicleExplode;   // (debug) trigger the blast FX
window._resize = ()=>doResize(true);   // (debug) force a refit
window._perf = PH;   // (debug) Z240 frame-time probe: PH.frm / upd / ren / gpu rings, perfAvg(PH.gpu)
if(location.hash==='#dev') window.__dev = { S, GUNS, enemies, blocks, towers, rockets, heightAt, damageBlock:(b,d)=>damageBlock(b,d), selectGun:(i)=>selectGun(i), spawnEnemy:(t,x,z)=>spawnEnemy(t,x,z), camera, scene, renderer, start:()=>startGame(), skip:()=>skipIntro(), get PROFILE(){ return PROFILE; }, get FT(){ return FT; }, startBoss:()=>startBoss(performance.now()/1000), drop:(x,z,t)=>dropPowerup({x,z},t), give:(id)=>applyPowerup(POWERUPS.find(u=>u.id===id)), get pickups(){ return pickups; }, hurt:(e,d)=>damageEnemy(e,d), obj:(st)=>{ S.stage=st; buildObjective(); return OBJ; }, spell:(i)=>{ S.spell=i; S.player.spellCdUntil=0; trySpell(); }, contract:(i)=>chooseContract(CONTRACTS[i||0]), setBiome:(i)=>{ PROFILE.terrain=i; applyBiome(1); }, setTod:(t)=>{ S.tod=t; applyAtmosphere(BIOME); }, tick:(n)=>{ window.__forceFrame=true; for(let i=0;i<(n||1);i++){ const t=performance.now(); __set_last(t-16.7); loop(t); } window.__forceFrame=false; } };   // QA hook (only with #dev in the URL)
window._bootReady = bootReady; window._bootHide = bootHide;   // (debug/test) drive the boot gate
window._paradrop = ()=>launchParadrop(performance.now()/1000);   // (debug) Z104 call in a transport helicopter now

// TEST 1 ?test=BIOME — straight into a battle, for tests and for looking at one thing quickly: no menu, briefing, intro or countdown.
//   ?test=DESERT[&tod=noon][&wx=clear][&level=3][&seed=7][&at=x,z]   at: the soldier put down at that spot. window.__ready turns true once the fight is on
//   (tools/ts.mjs waits on it). With ?seed the same battlefield comes out every time (boot/safety.js). &mode=nd | daily: one of the extra modes (campaign/mode-run.js).
{ const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null, want = Q && Q.get('test');
  if(want){ const bi = Math.max(0, BIOMES.findIndex(b => b.name === want.toUpperCase())); let launched = false, n = 0;
    const tick = () => { if(window.__ready || ++n > 400) return;
      for(const id of ['briefing', 'start', 'deploy', 'nick', 'tip']){ const e = document.getElementById(id); if(e) e.classList.add('hidden'); }
      if(!launched){ launched = true; document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); const b = document.getElementById('boot'); if(b) b.style.display = 'none';
        PROFILE.onboarded = true; PROFILE.coached = true;
        const md = Q.get('mode');   // MODE 3 &mode=nd: a night defence on this battlefield · &mode=daily: today's daily challenge (its own battlefield, hour and weather)
        if(md === 'nd') nightDefLaunch({ lvl:+(Q.get('level') || 3), biome:bi, wx:Q.get('wx') || 'clear', space:'wide' }); else if(md === 'daily') dailyLaunch(dailyDay(Date.now(), DAILY.tz));
        else launchGame({ mode:'custom', biome:bi, tod:Q.get('tod') || 'noon', wx:Q.get('wx') || 'clear', space:'wide', level:+(Q.get('level') || 3) }); }
      else if(S.mode === 'intro'){ try{ skipIntro(); }catch(e){} }
      else if(S.mode !== 'playing' && S.mode !== 'countdown'){ try{ launchStage(false); }catch(e){} }
      if(S.mode === 'playing' && S.player){ const at = (Q.get('at') || '').split(',').map(Number);
        if(at.length === 2 && isFinite(at[0]) && isFinite(at[1])){ S.player.pos.x = at[0]; S.player.pos.z = at[1]; }
        window.__ready = true; return; }
      setTimeout(tick, 250); };
    addEventListener('load', () => setTimeout(tick, 200)); } }
// MIX 1 ?spec=<name> — tools/specs/<name>.json composed by the battle mixer (campaign/mixer.js composeBattle), straight into the fight like ?test (window.__mix: its plan and scores)
{ const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null, want = Q && !Q.get('test') && Q.get('spec');
  if(want && /^[\w-]+$/.test(want)){ let n = 0, sent = false;
    const tick = () => { if(window.__ready || ++n > 400) return;
      for(const id of ['briefing', 'start', 'deploy', 'nick', 'tip']){ const e = document.getElementById(id); if(e) e.classList.add('hidden'); }
      if(sent && S.mode === 'intro'){ try{ skipIntro(); }catch(e){} } else if(sent && S.run && S.run.mix && S.mode !== 'playing' && S.mode !== 'countdown'){ try{ launchStage(false); }catch(e){} }
      if(sent && S.mode === 'playing' && S.run && S.run.mix){ window.__ready = true; return; } setTimeout(tick, 250); };
    addEventListener('load', () => fetch('tools/specs/' + want + '.json').then(r => r.json()).then(sp => { document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
      const b = document.getElementById('boot'); if(b) b.style.display = 'none'; PROFILE.onboarded = true; PROFILE.coached = true; window.__mix = composeBattle(sp); sent = true; setTimeout(tick, 200); })
      .catch(e => console.warn('?spec: ' + want + ' — ' + e.message))); } }
