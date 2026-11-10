// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { CONTRACTS } from '../../config.js';
import { ART, BIOME, BIOMES, BLOOM_SCALE, DEATH, DRONE, ENEMY_DEFS, FT, FT_APC, GUNS, HF, MOBILE, NIGHT, OBJ, PERF, PLAYER, POWERUPS, PROFILE, PYLONS, S, SKY, SPELLS, VIEW, WAVE, __set__tinMat, __set__woodMat, __set_bannerTimer, __set_muted, __set_ridersUnlocked, __set_soldierLvl, _tinMat, _woodMat, _wreckGeo, _wreckGeos, addGunXp, aimDots, applyAtmosphere, applyBiome, applyPowerup, applyUpgrades, artImpact, artLockStrike, artStrikes, audio, bannerTimer, barrelGrade, beginDeath, blocks, bloom, boss, buildCore, buildObjective, buildTank, buildTerrainDecor, buildTerrainPicker, bullets, buyShop, cMod, camTarget, camera, chooseContract, clearProgress, composer, core, cycleGun, damageBlock, damageBoss, damageDrone, damageEnemy, damagePlayer, debris, decorGroup, deployOwnedDrone, deployRiders, deploySoldiers, dprCap, drawRadar, droneBonusHp, droneDmgMul, droneOwned, dropPowerup, emberTex, enemies, enemyBarPool, enemyPool, fireArty, fireFlame, fireGun, flameJet, flushParticles, fuses, getEnemyMesh, giveGun, gradePass, guardFireMul, gunDropPool, gunLevel, gunXp, heightAt, impactFX, initIcons, intro, killBoss, killEnemy, makeCoverMesh, makeElite, makeGunBarrel, makeMortarShell, makePlayer, makeRocketMesh, makeSoldierMesh, muted, muzzleLight, openBriefing, openGuide, openLoadout, openNick, openShop, openUpgrade, ownGun, panelTex, parts, pickups, playerDie, propTex, pumpTips, radarCanvas, radarCtx, rangeRing, refreshBestLine, refreshStartUI, renderer, reqFs, respawnPlayer, riders, ridersUnlocked, rocketTarget, rockets, rollWaveEvent, saveProgress, scene, selectGun, separateTanks, setMuted, setNightLights, setPlayerBarrel, setQuality, shop3dUpdate, shopCam, shopModel, shopOpen, skipIntro, soldierLvl, soldiers, spawnDrone, spawnEnemy, spawnTankWreck, startBoss, startGame, stunBoss, syncMenuState, syncTerrainMesh, tankExplode, togglePause, towerGeos, towers, trySpell, updateArtStrikes, updateArtillery, updateBoss, updateBridges, updateBuffHUD, updateBullets, updateCamera, updateCamps, updateCore, updateCoreAlarm, updateCrush, updateDeath, updateDebris, updateDecals, updateDrone, updateDying, updateEnemies, updateEnemyBar, updateEnemyMissiles, updateEngine, updateEquip, updateFireteam, updateFlags, updateFlameJet, updateFlashes, updateFuses, updateGunStatus, updateHeliDown, updateInfDead, updateIntro, updateLocks, updateLootBeacons, updateMines, updateNightLights, updateObjective, updateParticles, updatePickups, updatePlayer, updateReload, updateRiders, updateRings, updateRocketAim, updateRockets, updateSoldiers, updateSpellHUD, updateSunFollow, updateTankRigs, updateTowers, updateTrails, updateWalls, updateWaves, updateWorldBars, updateWrecks } from '../hub.js';

// ----------------------------- MAIN LOOP -----------------------------
export let last = performance.now();
export function loop(nowMs){
  requestAnimationFrame(loop);
  const now = nowMs/1000;
  let dt = (nowMs - last)/1000; last = nowMs;
  dt = Math.min(dt, 0.05);
  document.body.classList.toggle('ingame', !!PLAY_MODES[S.mode]);   // drives the portrait gate (menus stay usable upright)
  if(gated() && !window.__forceFrame) return;   // portrait gate up or tab hidden → don't burn a frame behind the curtain (QA tick may force)

  if(shopOpen) shop3dUpdate(dt);          // animate the showroom (pedestal + detail hero) whenever the shop is open

  pumpTips();                                                // Z94 a queued first-time tip pauses the battle
  if(S.mode==='playing'){
    S.timeNow = now;
    const gdt = dt * S.timeScale;       // slow-mo on boss kill
    updateReload(now);              // complete reload on time + drive the countdown dial
    if(!MOBILE || (PERF.fc&3)===0) updateGunStatus(now);   // ✓/reloading badges (every 4th frame on phones)
    updatePlayer(gdt, now);
    updateEnemies(gdt, now);
    updateBoss(gdt, now);
    updateBullets(gdt, now);
    updateLocks(gdt);               // MISSILE lock-on reticles track their locked targets
    updateRockets(gdt, now); updateFuses(dt, now);   // siege-rocket flight + landing fuse
    updateArtillery(dt, now); updateArtStrikes(dt, now);
    updateEnemyMissiles(gdt, now); updateInfDead(gdt); updateHeliDown(gdt); updateEquip(gdt, now); updateObjective(gdt, now);   // Z82 smoke · APS · mines   // Z79 rockets/missiles in flight · fallen soldiers   // enemy ARTILLERY: barrage director + locked missile strikes
    separateTanks(now);                 // resolve overlaps so tanks never merge
    updateWalls(dt);                    // Z86 toppling masonry
    updateTankRigs(gdt);                // tracks + wheels + suspension + gun lay/recoil on every tank
    updateCrush();                      // tracks grind stones / flatten grass
    updateTowers(gdt, now);             // watchtower guards fire down; collapsing towers + falling guards
    updateBridges(gdt, now); updateCamps(gdt, now);   // Z90 rope bridges + enemy camps
    updateWaves(dt, now);               // wave timers run real-time
    updatePickups(gdt, now);
    updateLootBeacons(dt);               // glowing markers on bricks/tanks that hide a power-up
    updateMines(gdt, now);
    updateDrone(gdt, now);
    updateSoldiers(gdt, now);            // friendly squad guarding the Core
    updateFireteam(gdt, now);            // Z89 friendly fireteam + their APC
    updateRiders(gdt, now);              // crew mounted on the player's tank
    updateBuffHUD(now);
    updateCamera(dt, now);
    updateWorldBars();
    updateAbilityUI(now);
    if(!MOBILE || PERF.fc%3===0) drawRadar();   // Z92 the 2D radar is a canvas repaint → every 3rd frame on phones
    // combo timeout
    if(S.combo>0 && now>S.comboUntil && now>bannerTimer){ S.combo=0; document.getElementById('combo').style.opacity='0'; }
    if(bannerTimer>0 && now>bannerTimer && S.combo===0){ document.getElementById('combo').style.opacity='0'; __set_bannerTimer(0); }
  }
  else if(S.mode==='intro'){ S.timeNow=now; updateIntro(dt, now); updateTankRigs(dt); }
  else if(S.mode==='dying'){ S.timeNow=now; updateDeath(dt, now); }   // death → respawn cinematic (flip + burn + close cam)
  // always-on FX + core idle
  if(S.mode!=='playing'){ gradePass.uniforms.aberr.value*=0.85; rangeRing.visible=false; radarCtx.clearRect(0,0,radarCanvas.width,radarCanvas.height); }
  S.timeScale += (1 - S.timeScale) * Math.min(1, dt*1.8);   // ease slow-mo back to normal
  updateCore(dt, now); updateCoreAlarm(now);
  updateRings(dt); updateFlashes(dt); updateParticles(dt); updateTrails(dt); updateDebris(dt); updateWrecks(dt); updateFlameJet(dt); updateRocketAim(now); flushParticles();
  if(muzzleLight.intensity>0) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt*12);
  if(HF.dirty){ HF.dirty=false; syncTerrainMesh(HF.dj0, HF.dj1); HF.dj0=HF.dj1=undefined; }   // apply this frame's new craters (one rebuild max)
  updateEngine(dt);
  SKY.position.copy(camera.position); updateSunFollow(); updateDecals(dt); updateNightLights(dt, now); if(!MOBILE || (PERF.fc&1)===0) updateFlags(now); updateDying(dt); PERF.fc++; gradePass.uniforms.time.value = now%100;
  composer.render();
  // adaptive quality: drop internal resolution one-way if frames get heavy
  _fpsAcc+=dt; _fpsN++;
  if(_fpsAcc>=1){ const fps=_fpsN/_fpsAcc; _fpsAcc=0; _fpsN=0; const dprFloor=MOBILE?0.7:1, dprTop=(PROFILE.quality==='low')?(MOBILE?0.8:1):dprCap();
    if(S.mode==='playing'){                                                   // Z92 governor: step DOWN fast when frames run long, creep back UP after 6 smooth seconds
      if(fps<47){ PERF.fastT=0; PERF.slowT++;
        if(S.dpr>dprFloor){ S.dpr=Math.max(dprFloor,S.dpr-(fps<34?0.25:0.12)); renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); }
        PERF.parts=Math.max(0.45, PERF.parts-(fps<34?0.2:0.1));
        if(MOBILE && fps<38 && PERF.slowT>=2 && bloom.enabled) bloom.enabled=false; }   // still heavy → drop the glow, keep the frames
      else if(fps>57){ PERF.slowT=0; PERF.fastT++;
        if(PERF.fastT>=6){ PERF.fastT=0; PERF.parts=Math.min(1, PERF.parts+0.1); if(S.dpr<dprTop-0.01){ S.dpr=Math.min(dprTop,S.dpr+0.1); renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); } } } } }
}
export let _fpsAcc=0, _fpsN=0;
export let _abC=null;
export function updateAbilityUI(now){
  const p=S.player; if(!p) return;
  const dc = Math.round(Math.max(0, (p.dashCdUntil - now)/PLAYER.dashCd)*50)/50;      // Z92 quantised + cached → no DOM write unless the dial actually moves
  const spCd = SPELLS[S.spell].cd * p.spellCdMul, sc = Math.round(Math.max(0, (p.spellCdUntil - now)/spCd)*50)/50;
  const C=_abC||(_abC={ d:document.getElementById('cool-dash'), ad:document.getElementById('ab-dash'), s:document.getElementById('cool-spell'), m:document.getElementById('cool-mspell'), as:document.getElementById('ab-spell'), dc:-1, sc:-1 });
  if(dc!==C.dc){ C.dc=dc; if(C.d) C.d.style.transform='scaleY('+dc+')'; C.ad?.classList.toggle('ready', dc<=0); }
  if(sc!==C.sc){ C.sc=sc; const t='scaleY('+sc+')'; if(C.s) C.s.style.transform=t; if(C.m) C.m.style.transform=t; C.as?.classList.toggle('ready', sc<=0); }
}
export function doResize(force){
  const c=renderer.domElement;
  const w=Math.max(1, c.clientWidth||innerWidth), h=Math.max(1, c.clientHeight||innerHeight);   // the canvas box, not innerWidth/innerHeight
  if(!force && w===VIEW.w && h===VIEW.h) return;   // mobile fires resize continuously while the URL bar slides — reallocating
  VIEW.w=w; VIEW.h=h;                              // the render targets on every one of those was a guaranteed hitch
  camera.aspect = w/h; camera.updateProjectionMatrix();
  if(typeof shopCam!=='undefined'){ shopCam.aspect = w/h; shopCam.updateProjectionMatrix(); }   // keep the 3D shop camera in sync
  renderer.setSize(w, h, false); composer.setSize(w, h);   // buffer follows the viewport; CSS keeps the canvas full-screen
  if(bloom && bloom.setSize) bloom.setSize(Math.round(w*BLOOM_SCALE), Math.round(h*BLOOM_SCALE));
}
export let _rsT=0;
export function queueResize(){ if(document.body.classList.contains('typing')) return; clearTimeout(_rsT); _rsT=setTimeout(()=>doResize(), 150); }   // Z97: the soft keyboard must not re-allocate the 3D canvas   // refit once the size SETTLES — iOS fires
// resize/visualViewport-resize on every frame of a URL-bar slide, and re-allocating the render targets that often flickers
window._resize = ()=>doResize(true);   // (debug) force a refit
if(location.hash==='#dev') window.__dev = { S, GUNS, enemies, blocks, towers, rockets, heightAt, damageBlock:(b,d)=>damageBlock(b,d), giveGun:(id)=>giveGun(id), selectGun:(i)=>selectGun(i), spawnEnemy:(t,x,z)=>spawnEnemy(t,x,z), camera, scene, renderer, get boss(){ return boss; }, start:()=>startGame(), skip:()=>skipIntro(), barrel:(id)=>setPlayerBarrel(id), grade:(id)=>barrelGrade(id), get PROFILE(){ return PROFILE; }, get FT(){ return FT; }, startBoss:()=>startBoss(performance.now()/1000), dmgBoss:(d,x,z)=>damageBoss(d,x,z), get pylons(){ return PYLONS; }, stun:()=>stunBoss(performance.now()/1000,''), drop:(x,z,t)=>dropPowerup({x,z},t), give:(id)=>applyPowerup(POWERUPS.find(u=>u.id===id)), get pickups(){ return pickups; }, get FT_APC(){ return FT_APC; }, get riders(){ return riders; }, hurt:(e,d)=>damageEnemy(e,d), obj:(st)=>{ S.stage=st; buildObjective(); return OBJ; }, spell:(i)=>{ S.spell=i; S.player.spellCdUntil=0; trySpell(); }, contract:(i)=>chooseContract(CONTRACTS[i||0]), setBiome:(i)=>{ PROFILE.terrain=i; applyBiome(1); }, setTod:(t)=>{ S.tod=t; applyAtmosphere(BIOME); }, tick:(n)=>{ window.__forceFrame=true; for(let i=0;i<(n||1);i++){ const t=performance.now(); last=t-16.7; loop(t); } window.__forceFrame=false; } };   // QA hook (only with #dev in the URL)
// mobile is landscape-only: auto-pause if rotated to portrait (the #rotate gate covers the screen via CSS)
export function checkOrientation(){ if(MOBILE && innerHeight > innerWidth && S.mode==='playing') togglePause(); }
export const PLAY_MODES = { playing:1, paused:1, intro:1, dying:1 };   // modes that need landscape; menus/game-over do not
export function gated(){ return document.hidden || (MOBILE && innerHeight > innerWidth && !!PLAY_MODES[S.mode]); }   // nothing to draw behind the rotate gate
addEventListener('resize', ()=>{ queueResize(); checkOrientation(); });
// the mobile viewport keeps changing AFTER load (toolbar hide, fullscreen, orientation lock) — refit when it settles
addEventListener('orientationchange', ()=>{ setTimeout(()=>{ queueResize(); checkOrientation(); }, 250); setTimeout(queueResize, 650); });
document.addEventListener('fullscreenchange', ()=>setTimeout(queueResize, 150));
document.addEventListener('webkitfullscreenchange', ()=>setTimeout(queueResize, 150));
if(window.visualViewport) window.visualViewport.addEventListener('resize', queueResize);
// build the scene actors up front so the title screen shows a live battlefield
buildCore(1);
S.player = makePlayer();
initIcons();          // paint all static HUD/menu glyphs (custom SVG icon set)
updateSpellHUD();     // show the equipped spell's icon from the start
refreshBestLine();    // show the saved high score on the title screen
refreshStartUI();     // greeting + CONTINUE button from the saved profile
__set_muted(!PROFILE.sound); setMuted(muted); setQuality(PROFILE.quality);   // apply saved audio + quality prefs
if(!PROFILE.nickname) openNick();   // first launch → ask for a call sign
else if(!PROFILE.onboarded) openGuide();   // returning player who hasn't seen the field manual → show it once

// diagnostics hooks (used for automated testing)
window._game = S;
window._dbg = { enemies, bullets, pickups, get core(){return core;}, get boss(){return boss;} };
window._spawn = spawnEnemy;
window._give = giveGun; window._cycleGun = cycleGun; window._drop = dropPowerup;
window._dbg.blocks = blocks; window._dbg.debris = debris; window._dbg.rockets = rockets; window._dbg.fuses = fuses; window._dbg.gunDropPool = gunDropPool;
window._intro = intro;   // deploy-cinematic state (debug/inspection)
window._profile = PROFILE; window._ownGun = ownGun; window._openLoadout = openLoadout;   // profile/arsenal hooks
window._saveProgress = saveProgress; window._clearProgress = clearProgress;              // checkpoint hooks (debug/test)
window._openShop = openShop; window._buyShop = buyShop; window._shopModel = shopModel; window._applyUpgrades = applyUpgrades;   // economy hooks (debug/test)
window._WAVE = WAVE; window._rollWaveEvent = rollWaveEvent; window._makeElite = makeElite; window._dbg.killEnemy = killEnemy; window._dbg.damageEnemy = damageEnemy;   // NG+/event hooks (debug/test)
window._gunLevel = gunLevel; window._gunXp = gunXp; window._addGunXp = addGunXp; window._giveGun = giveGun; window._selectGun = selectGun;   // MASTERY hooks (debug/test)
window._openBriefing = openBriefing; window._chooseContract = chooseContract; window._cMod = cMod; Object.defineProperty(window,'_contract',{get:()=>S.contract});   // CONTRACT hooks (debug/test)
window._GUNS = GUNS; window._impactFX = impactFX; window._tankExplode = tankExplode; window._fireGun = fireGun;   // FEEL hooks (debug/test): recoil/knock/fx
window._updateEnemyBar = updateEnemyBar; window._enemyBarPool = enemyBarPool;   // enemy HP-bar hooks (debug/test)
window._artStrikes = artStrikes; window._artLockStrike = artLockStrike; window._artImpact = artImpact; window._updateArtillery = updateArtillery; window._updateArtStrikes = updateArtStrikes; Object.defineProperty(window,'_ART',{get:()=>ART});   // ARTILLERY hooks (debug/test)
window._playerDie = playerDie; window._beginDeath = beginDeath; window._updateDeath = updateDeath; window._respawnPlayer = respawnPlayer; Object.defineProperty(window,'_DEATH',{get:()=>DEATH});   // DEATH→respawn hooks (debug/test)
window._damagePlayer = damagePlayer; window._updateEnemies = updateEnemies;   // hit-reaction + enemy-AI hooks (debug/test)
window._fireArty = fireArty; window._updateRockets = updateRockets; window._updateFuses = updateFuses; window._dbg.fuses = fuses;   // HOWITZER hooks (debug/test)
window._dbg.aimDots = aimDots; window._rocketTarget = rocketTarget;   // SIEGE ROCKET aim-preview hooks (debug/test)
window._fireFlame = fireFlame; window._dbg.parts = parts; window._updateFlameJet = updateFlameJet; Object.defineProperty(window,'_flameJet',{get:()=>flameJet});   // PYRO flame-jet hook (debug/test)
window._applyBiome = applyBiome; window._BIOMES = BIOMES; window._buildTerrainDecor = buildTerrainDecor; window._buildTerrainPicker = buildTerrainPicker;   // TERRAIN hooks (debug/test)
Object.defineProperty(window,'_BIOME',{get:()=>BIOME}); Object.defineProperty(window,'_decorCount',{get:()=>decorGroup.children.length});
window._openUpgrade = openUpgrade;   // (debug) preview the post-boss reward screen
window._startBoss = startBoss; window._killBoss = killBoss;   // (debug) drive the stage-clear flow
window._powerup = (id)=>{ const d=POWERUPS.find(x=>x.id===id); if(d) applyPowerup(d); return !!d; };   // (debug) grant a power-up
window._view = { get camera(){return camera;}, get scene(){return scene;}, get renderer(){return renderer;}, get composer(){return composer;} };   // (debug) inspect/drive the view
window._dbg.soldiers = soldiers; window._deploy = deploySoldiers; window._armory = ()=>{ __set_soldierLvl(soldierLvl + 1); return soldierLvl; };   // (debug) friendly squad
window._dbg.riders = riders; window._deployRiders = (n)=>{ __set_ridersUnlocked(true); deployRiders(n||3); return riders.length; };   // (debug) tank crew
window._tankExplode = tankExplode; window._wreck = spawnTankWreck;   // (debug) trigger the death FX / part-wreck
window._spawnDrone = spawnDrone; window._damageDrone = (dmg)=>damageDrone(dmg,null); window._updateDrone = updateDrone; window._DRONE = DRONE; Object.defineProperty(window,'_drone',{get:()=>S.drone});   // (debug) support drone
window._deployOwnedDrone = deployOwnedDrone; window._droneOwned = droneOwned; window._droneDmgMul = droneDmgMul; window._guardFireMul = guardFireMul; window._droneBonusHp = droneBonusHp;   // (debug) support-unit shop upgrades

// ---- BOOT GATE: hold the branded splash until real frames are on screen. On touch the tap that dismisses it
// is also the one user gesture browsers demand before audio, fullscreen and the landscape lock are allowed. ----
export function bootHide(){ const b=document.getElementById('boot'); if(!b||b._gone) return; b._gone=true;
  b.classList.add('gone'); setTimeout(()=>{ b.style.display='none'; }, 450); }
// ---- WARM-UP: compile every material variant (day AND night lighting) + pre-build the enemy pools while the menu is up →
//      no shader-compile hitches when the first tank, explosion, wreck or night stage appears ----
export let _warmed=false;
export async function warmUp(){
  if(_warmed) return; _warmed=true;
  const tmp=[], put=(o)=>{ o.position.set(0,-80,0); o.visible=true; scene.add(o); tmp.push(o); return o; };
  try{
    put(buildTank({detail:true, mighty:true}));
    const pooled=[]; for(const t of Object.keys(ENEMY_DEFS)){ for(let k=0;k<2;k++){ const m=getEnemyMesh(t); m.position.set(0,-80,0); m.visible=true; pooled.push([t,m]); } }
    for(const k of ['sandbag','drums','tires','crates','pipes','concrete','hesco','hedgehog']) put(makeCoverMesh(k, k==='drums'||k==='sandbag'));
    put(makeSoldierMesh()); put(makeSoldierMesh({enemy:true})); put(makeRocketMesh()); put(makeMortarShell());
    _wreckGeos(); put(new THREE.Mesh(_wreckGeo, new THREE.MeshStandardMaterial({ color:0x222222, roughness:0.95, metalness:0.3, map:panelTex(), emissive:0xff5a18, emissiveMap:emberTex(), emissiveIntensity:1, transparent:true })));
    { const G=towerGeos(); if(!_woodMat){ __set__woodMat(new THREE.MeshStandardMaterial({ map:propTex('wood'), color:0x9a7a52, roughness:0.9 })); __set__tinMat(new THREE.MeshStandardMaterial({ color:0x6a6e66, roughness:0.45, metalness:0.75, map:propTex('drum') })); }
      put(new THREE.Mesh(G.wood,_woodMat)); put(new THREE.Mesh(G.roof,_tinMat)); }
    for(const id of Object.keys(GUNS)) put(makeGunBarrel(id));
    if(renderer.compileAsync){ await renderer.compileAsync(scene, camera);
      const was=NIGHT.on; setNightLights(true); await renderer.compileAsync(scene, camera); setNightLights(was); NIGHT._was=was; }   // both light setups
    // one real (off-screen) draw with everything in view → also compiles shadow-depth + per-object variants; synchronous → never shown
    { const rt=new THREE.WebGLRenderTarget(96,96), tgt=camTarget.clone(), keep=[];
      const all=tmp.concat(pooled.map(x=>x[1])); all.forEach((o,i)=>{ keep.push(o.position.clone()); o.position.set(tgt.x+(i%6-2.5)*4, 0, tgt.z+((i/6|0)-2)*4); });
      for(const night of [false,true]){ setNightLights(night); renderer.setRenderTarget(rt); renderer.render(scene, camera); }
      setNightLights(NIGHT.on); renderer.setRenderTarget(null); rt.dispose(); all.forEach((o,i)=>o.position.copy(keep[i])); }
    for(const [t,m] of pooled){ m.visible=false; m.position.set(0,0,0); (enemyPool[t]=enemyPool[t]||[]).push(m); }   // ready-made enemy pool
  }catch(e){ console.warn('warm-up skipped', e); }
  for(const o of tmp) scene.remove(o);
  performance.mark('boot:warm');
}
export function idle(fn){ (window.requestIdleCallback||((f)=>setTimeout(f,60)))(fn, {timeout:1500}); }
export function bootReady(forceTap){
  performance.mark('boot:ready');
  idle(()=>{ warmUp(); });
  const b=document.getElementById('boot'); if(!b||b._gone) return;
  if(!(MOBILE||forceTap===true)){ bootHide(); return; }                 // desktop: straight into the menu
  b.classList.add('ready');
  const go=e=>{ if(e&&e.cancelable) e.preventDefault();
    b.removeEventListener('touchstart',go); b.removeEventListener('click',go);
    try{ audio(); }catch(_){}                                            // iOS: AudioContext only resumes inside a gesture
    reqFs(); bootHide();
    queueResize(); setTimeout(queueResize,300); setTimeout(queueResize,900); };   // refit once fullscreen/rotation settle
  b.addEventListener('touchstart',go,{passive:false}); b.addEventListener('click',go);
}
window._bootReady = bootReady; window._bootHide = bootHide;   // (debug/test) drive the boot gate
syncMenuState();                                               // the title screen is an open menu → HUD stays out of the way
document.getElementById('boot')?.setAttribute('data-live','1');
doResize(true);                                                // size the buffer from the real canvas box before frame 1
requestAnimationFrame(()=>requestAnimationFrame(bootReady));   // two frames in → the battlefield is genuinely on screen

requestAnimationFrame(loop);
