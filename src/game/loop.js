// game/loop.js — MAIN LOOP: per-frame update + render orchestration, frame pacing, ability cooldown dials
import { HF, MOBILE, PERF, PLAYER, PLAY_MODES, PROFILE, S, SKY, SPELLS, __set_bannerTimer, bannerTimer, bloom, camera, composer, doResize, dprCap, drawRadar, flushParticles, gated, gradePass, muzzleLight, pumpTips, radarCanvas, radarCtx, rangeRing, renderer, separateTanks, shop3dUpdate, shopOpen, syncTerrainMesh, updateAllyDead, updateAllyTanks, updateArtStrikes, updateArtillery, updateBoss, updateBridges, updateBuffHUD, updateBullets, updateCamera, updateCamps, updateCmdUI, updateCore, updateCoreAlarm, updateCrush, updateDeath, updateDebris, updateDecals, updateDepots, updateDrone, updateDying, updateEnemies, updateEnemyMissiles, updateEngine, updateEquip, updateFireteam, updateFlags, updateFlameJet, updateFlashes, updateForts, updateFuses, updateGunStatus, updateHeliDown, updateInfDead, updateIntro, updateLOD, updateLocks, updateLootBeacons, updateMines, updateNightLights, updateObjective, updatePOWs, updateParadrops, updateParticles, updatePickups, updatePlayer, updatePowerHud, updateRally, updateReload, updateRiders, updateRings, updateRocketAim, updateRockets, updateSoldiers, updateSunFollow, updateTankRigs, updateTowers, updateTrails, updateWalls, updateWaves, updateWeather, updateWorldBars, updateWrecks } from '../hub.js';

// ----------------------------- MAIN LOOP -----------------------------
export let last = performance.now();
export function __set_last(v){ last=v; }   // (dev/hooks tick) — imports are read-only, writes go through a setter
export function loop(nowMs){
  requestAnimationFrame(loop);
  const now = nowMs/1000;
  let dt = (nowMs - last)/1000; last = nowMs;
  dt = Math.min(dt, 0.05);
  { const ig=!!PLAY_MODES[S.mode]; if(ig!==_ingame){ _ingame=ig; document.body.classList.toggle('ingame', ig); } }   // drives the portrait gate (menus stay usable upright) — Z107: only on change
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
    updateForts(gdt, now);              // Z107 fortresses: garrison, sallies, gate, capture
    updateBridges(gdt, now); updateCamps(gdt, now);   // Z90 rope bridges + enemy camps
    updateWaves(dt, now);               // wave timers run real-time
    updatePickups(gdt, now);
    updateLootBeacons(dt);               // glowing markers on bricks/tanks that hide a power-up
    updateMines(gdt, now);
    updateDrone(gdt, now);
    updateSoldiers(gdt, now);            // friendly squad guarding the Core
    updateFireteam(gdt, now); updateAllyDead(gdt);   // Z89 friendly fireteam + their APC (Z104: autonomous squad) · Z113 our fallen
    updateAllyTanks(gdt, now); updatePOWs(gdt, now); updateDepots(gdt, now); updateRally(gdt, now); updateParadrops(gdt, now);   // Z104 allied tanks · POW stockades · depots · rally point · paratroopers
    updateRiders(gdt, now);              // crew mounted on the player's tank
    updateCmdUI(now);                    // Z107 paratrooper cooldown on the phone strip
    updateLOD(now);                      // Z107 render budget: near-only soldier shadows, far guards hidden
    updatePowerHud(now);                 // Z107 live power rating vs this stage (1×/s)
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
  if(!shopOpen) updateWeather(dt);   // Z107 rain / sand / snow drift with the camera + lightning
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
export let _fpsAcc=0, _fpsN=0, _ingame=null;
export let _abC=null;
export function updateAbilityUI(now){
  const p=S.player; if(!p) return;
  const dc = Math.round(Math.max(0, (p.dashCdUntil - now)/PLAYER.dashCd)*50)/50;      // Z92 quantised + cached → no DOM write unless the dial actually moves
  const spCd = SPELLS[S.spell].cd * p.spellCdMul, sc = Math.round(Math.max(0, (p.spellCdUntil - now)/spCd)*50)/50;
  const C=_abC||(_abC={ d:document.getElementById('cool-dash'), ad:document.getElementById('ab-dash'), s:document.getElementById('cool-spell'), m:document.getElementById('cool-mspell'), as:document.getElementById('ab-spell'), dc:-1, sc:-1 });
  if(dc!==C.dc){ C.dc=dc; if(C.d) C.d.style.transform='scaleY('+dc+')'; C.ad?.classList.toggle('ready', dc<=0); }
  if(sc!==C.sc){ C.sc=sc; const t='scaleY('+sc+')'; if(C.s) C.s.style.transform=t; if(C.m) C.m.style.transform=t; C.as?.classList.toggle('ready', sc<=0); }
}
