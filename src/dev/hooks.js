// dev/hooks.js — Z103 split from game/loop.js: window._* inspection/driving hooks used by Playwright smoke tests and the
// #dev console. Nothing in the game reads these; a production build may drop this module from hub.js.
import { CONTRACTS } from '../../config.js';
import { ART, BIOME, BIOMES, DEATH, DRONE, FT, GUNS, OBJ, PH, POWERUPS, PROFILE, S, WAVE, __set_last, __set_soldierLvl, aimDots, applyAtmosphere, applyBiome, applyPowerup, artImpact, artLockStrike, artStrikes, beginDeath, blocks, bootHide, bootReady, buildObjective, buildTerrainDecor, buildTerrainPicker, bullets, cMod, camera, chooseContract, clearProgress, composer, core, cycleGun, damageBlock, damageDrone, damageEnemy, damagePlayer, debris, decorGroup, deployOwnedDrone, deploySoldiers, doResize, droneBonusHp, droneDmgMul, droneOwned, dropPowerup, enemies, enemyBarPool, fireFlame, guardFireMul, heightAt, impactFX, intro, killEnemy, launchParadrop, loop, makeElite, openBriefing, openLoadout, openUpgrade, ownGun, parts, pickups, playerDie, renderer, respawnPlayer, rocketTarget, rockets, rollWaveEvent, saveProgress, scene, selectGun, skipIntro, soldierLvl, soldiers, spawnDrone, spawnEnemy, spawnTankWreck, startBoss, startGame, tankExplode, towers, trySpell, updateArtStrikes, updateArtillery, updateDeath, updateDrone, updateEnemies, updateEnemyBar, updateRockets } from '../hub.js';

// diagnostics hooks (used for automated testing)
window._game = S;
window._dbg = { enemies, bullets, pickups, get core(){return core;} };
window._spawn = spawnEnemy;
window._cycleGun = cycleGun; window._drop = dropPowerup;
window._dbg.blocks = blocks; window._dbg.debris = debris; window._dbg.rockets = rockets;
window._intro = intro;   // deploy-cinematic state (debug/inspection)
window._profile = PROFILE; window._ownGun = ownGun; window._openLoadout = openLoadout;   // profile/arsenal hooks
window._saveProgress = saveProgress; window._clearProgress = clearProgress;              // checkpoint hooks (debug/test)
window._WAVE = WAVE; window._rollWaveEvent = rollWaveEvent; window._makeElite = makeElite; window._dbg.killEnemy = killEnemy; window._dbg.damageEnemy = damageEnemy;   // NG+/event hooks (debug/test)
window._selectGun = selectGun;
window._openBriefing = openBriefing; window._chooseContract = chooseContract; window._cMod = cMod; Object.defineProperty(window,'_contract',{get:()=>S.contract});   // CONTRACT hooks (debug/test)
window._GUNS = GUNS; window._impactFX = impactFX; window._tankExplode = tankExplode;   // FEEL hooks (debug/test): knock/fx
window._updateEnemyBar = updateEnemyBar; window._enemyBarPool = enemyBarPool;   // enemy HP-bar hooks (debug/test)
window._artStrikes = artStrikes; window._artLockStrike = artLockStrike; window._artImpact = artImpact; window._updateArtillery = updateArtillery; window._updateArtStrikes = updateArtStrikes; Object.defineProperty(window,'_ART',{get:()=>ART});   // ARTILLERY hooks (debug/test)
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
window._tankExplode = tankExplode; window._wreck = spawnTankWreck;   // (debug) trigger the death FX / part-wreck
window._spawnDrone = spawnDrone; window._damageDrone = (dmg)=>damageDrone(dmg,null); window._updateDrone = updateDrone; window._DRONE = DRONE; Object.defineProperty(window,'_drone',{get:()=>S.drone});   // (debug) support drone
window._deployOwnedDrone = deployOwnedDrone; window._droneOwned = droneOwned; window._droneDmgMul = droneDmgMul; window._guardFireMul = guardFireMul; window._droneBonusHp = droneBonusHp;   // (debug) support-unit shop upgrades
window._resize = ()=>doResize(true);   // (debug) force a refit
window._perf = PH;   // (debug) Z240 frame-time probe: PH.frm / upd / ren / gpu rings, perfAvg(PH.gpu)
if(location.hash==='#dev') window.__dev = { S, GUNS, enemies, blocks, towers, rockets, heightAt, damageBlock:(b,d)=>damageBlock(b,d), selectGun:(i)=>selectGun(i), spawnEnemy:(t,x,z)=>spawnEnemy(t,x,z), camera, scene, renderer, start:()=>startGame(), skip:()=>skipIntro(), get PROFILE(){ return PROFILE; }, get FT(){ return FT; }, startBoss:()=>startBoss(performance.now()/1000), drop:(x,z,t)=>dropPowerup({x,z},t), give:(id)=>applyPowerup(POWERUPS.find(u=>u.id===id)), get pickups(){ return pickups; }, hurt:(e,d)=>damageEnemy(e,d), obj:(st)=>{ S.stage=st; buildObjective(); return OBJ; }, spell:(i)=>{ S.spell=i; S.player.spellCdUntil=0; trySpell(); }, contract:(i)=>chooseContract(CONTRACTS[i||0]), setBiome:(i)=>{ PROFILE.terrain=i; applyBiome(1); }, setTod:(t)=>{ S.tod=t; applyAtmosphere(BIOME); }, tick:(n)=>{ window.__forceFrame=true; for(let i=0;i<(n||1);i++){ const t=performance.now(); __set_last(t-16.7); loop(t); } window.__forceFrame=false; } };   // QA hook (only with #dev in the URL)
window._bootReady = bootReady; window._bootHide = bootHide;   // (debug/test) drive the boot gate
window._paradrop = ()=>launchParadrop(performance.now()/1000);   // (debug) Z104 call in a transport helicopter now
