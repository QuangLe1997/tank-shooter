// game/loop.js — MAIN LOOP: per-frame update + render orchestration, frame pacing, ability cooldown dials
import { updateTraffic, AO, APPLE, HF, MOBILE, PERF, PLAYER, PLAY_MODES, PROFILE, S, SKY, SPELLS, TRAIN, __set_bannerTimer, aoPass, bannerTimer, bloom, buildUnitGrid, camera, cavIdle, composer, doResize, dprCap, drawRadar, enemyDamageFX, flushParticles, gated, gradePass, muzzleLight, perfFrameBegin, perfFrameEnd, perfFrameMs, perfGpuMs, perfRenderBegin, pollGamepad, pumpTips, radarCanvas, radarCtx, rangeRing, renderPass, renderer, saveProfile, scene, separateTanks, shop3dUpdate, shopOpen, syncTerrainMesh, tickTip, trainTick, updateAllyDead, updateAllyTanks, updateArtStrikes, updateArtillery, updateBolts, updateBoss, updateBridges, updateBuffHUD, updateBullets, updateCamera, updateCamps, updateCavalry, updateCavern, updateCelebration, updateCinematic, updateCity, updateClouds, updateCmdUI, updateCore, updateCoreAlarm, updateCoreGuns, updateCountdown, updateCrowd, updateCrush, updateDeath, updateDebris, updateDecals, updateDepots, updateDrone, updateDying, updateEnemies, updateEnemyMissiles, updateEngine, updateEnvEvents, updateEquip, updateFieldcraft, updateFireteam, updateFlags, updateFlameJet, updateFlames, updateFlashes, updateForts, updateFuses, updateGore, updateGrass, updateGunStatus, updateHeliCrew, updateHeliDown, updateHorizon, updateInfDead, updateInstr, updateIntro, updateLOD, updateLava, updateLockWarn, updateLocks, updateMagma, updateLootBeacons, updateMines, updateNightLights, updateNightMarks, updateObjective, updatePOWs, updateParadrops, updateParticles, updatePickups, updatePlayer, updatePowerHud, updatePylonMarks, updateRally, updateRelic, updateReload, updateRiders, updateRings, updateRocketAim, updateRockets, updateRoofMG, updateRubble, updateScore, updateShatter, updateSkyLife, updateSkyMood, updateSmokeTrails, updateSoldiers, updateSquadHud, updateSquads, updateSunFollow, updateSupply, updateSurprises, updateTankRigs, updateTowers, updateTrails, updateTreeFall, updateTroopBatch, updateTunnels, updateUltimates, updateUnder, updateWallMarks, updateWalls, updateWater, updateWaves, updateWeather, updateWildlife, updateWonder, updateWorldBars, updateWrecks } from '../hub.js';

// ----------------------------- MAIN LOOP -----------------------------
const PERF_GOV = { low:54, aim:59, high:58, upK:0.55, upHold:6, upEvery:10 };   // Z240 + step back up in play when the GPU sits under upK × frame budget for upHold s (≤ once per upEvery s)   // Z239 frame governor: step down under low fps, aim the one resize step at aim fps, creep back up above high
export let last = performance.now();
export function __set_last(v){ last=v; }   // (dev/hooks tick) — imports are read-only, writes go through a setter
export function loop(nowMs){
  requestAnimationFrame(loop);
  const now = nowMs/1000;
  const rawMs = nowMs - last; let dt = rawMs/1000; last = nowMs;
  dt = Math.min(dt, 0.05);
  { const ig=!!PLAY_MODES[S.mode]; if(ig!==_ingame){ _ingame=ig; document.body.classList.toggle('ingame', ig); } }   // drives the portrait gate (menus stay usable upright) — Z107: only on change
  if(gated() && !window.__forceFrame) return;   // portrait gate up or tab hidden → don't burn a frame behind the curtain (QA tick may force)
  perfFrameBegin();   // Z240 frame-time probe (render/perfhud.js)

  if(shopOpen) shop3dUpdate(dt);          // animate the showroom (pedestal + detail hero) whenever the shop is open

  updateFlames(dt); updateSkyLife(dt, now);                 // Z235 living flames · swallows, raptors, high aircraft                                          // Z235 living flames (camp fires, braziers, torches)
  updateHorizon(dt, now);                                    // Z189 the world beyond the fence (menu backdrop too)
  pumpTips(); tickTip();                                     // Z94 a queued first-time tip · Z168 shown as a side card, the battle keeps going
  pollGamepad(dt, now);                                      // Z117 controller: battle, menus, rumble
  if(S.mode==='playing'){
    S.timeNow = now;
    const gdt = dt * S.timeScale * (now < (S.hitStop||0) ? 0.35 : 1);   // Z239 hit-stop softened (was 0.12: read as a dropped frame)       // slow-mo on boss kill · Z168 a heavy kill freezes the action for a few frames (hit-stop)
    updateReload(now);              // complete reload on time + drive the countdown dial
    if((PERF.fc&(MOBILE?3:1))===0) updateGunStatus(now);   // ✓/reloading badges (every 4th frame on phones)
    if(S.player.cav) updateCavalry(gdt, now); else updatePlayer(gdt, now);   // Z245 cavalry mode
    if(TRAIN.on) trainTick(gdt, now);   // Z182 the onboarding steps watch what you do
    buildUnitGrid(now);             // Z172 who-is-near-whom, once a frame
    updateSquads(gdt, now); updateFieldcraft(gdt, now); updateHeliCrew(gdt, now); updateSurprises(gdt, now);   // Z173 squad plans (enemy squads + our fireteam teams / focus) · Z220 grenades in flight + smoke screens
    updateEnemies(gdt, now);
    updateBoss(gdt, now);
    updateBullets(gdt, now);
    updateUltimates(gdt, now);
    updateLockWarn(gdt, now);
    updateCinematic(gdt, now); enemyDamageFX(gdt); updateRubble(gdt); updateSupply(gdt, now); updateCrowd(gdt); updateWallMarks(gdt); updateCity(gdt);   // Z193 burning heaps   // Z192 hurt enemy tanks smoke, then burn      // Z189 shock domes · fire light · damage smoke       // Z188 "BỊ KHOÁ" brackets while a guided missile hunts you
    updateLava(gdt, now);           // Z187 caldera lava: glow, embers, burns      // Z186 orbital lances · plasma suns · black holes · photon beams
    updateLocks(gdt);               // MISSILE lock-on reticles track their locked targets
    updateRockets(gdt, now); updateFuses(dt, now);   // siege-rocket flight + landing fuse
    updateArtillery(dt, now); updateArtStrikes(dt, now);
    updateEnemyMissiles(gdt, now); updateInfDead(gdt); updateGore(gdt, now); updateHeliDown(gdt); updateEquip(gdt, now); updateObjective(gdt, now);   // Z82 smoke · APS · mines   // Z79 rockets/missiles in flight · fallen soldiers   // enemy ARTILLERY: barrage director + locked missile strikes
    separateTanks(now);                 // resolve overlaps so tanks never merge
    updateWalls(dt);                    // Z86 toppling masonry
    updateTankRigs(gdt);                // tracks + wheels + suspension + gun lay/recoil on every tank
    updateCrush();                      // tracks grind stones / flatten grass
    updateTowers(gdt, now);             // watchtower guards fire down; collapsing towers + falling guards
    updateForts(gdt, now);              // Z107 fortresses: garrison, sallies, gate, capture
    updateBridges(gdt, now); updateCamps(gdt, now);   // Z90 rope bridges + enemy camps
    updateWaves(dt, now);               // wave timers run real-time
    updatePickups(gdt, now); updateRelic(gdt, now);
    updateLootBeacons(dt);               // glowing markers on bricks/tanks that hide a power-up
    updateMines(gdt, now);
    updateDrone(gdt, now);
    updateSoldiers(gdt, now);            // friendly squad guarding the Core
    updateFireteam(gdt, now); updateAllyDead(gdt);   // Z89 friendly fireteam + their APC (Z104: autonomous squad) · Z113 our fallen
    updateCoreGuns(gdt, now);           // Z140 guard cannons on our bastions
    updateWildlife(gdt, now);           // Z143 herds graze and bolt from tanks
    updateEnvEvents(gdt, now);          // Z140 floods · rockslides · collapses · weather surges
    updateCavern(gdt, now); updateTunnels(gdt, now); updateUnder(gdt, now);   // Z225 torches · shafts · roof falls · the enemy tunnel network
    updateAllyTanks(gdt, now); updatePOWs(gdt, now); updateDepots(gdt, now); updateRally(gdt, now); updateParadrops(gdt, now);   // Z104 allied tanks · POW stockades · depots · rally point · paratroopers
    updateRiders(gdt, now);              // crew mounted on the player's tank
    updateRoofMG(gdt, now);              // Z167 the roof machine gun (manned by the first rider)
    updateCmdUI(now);                    // Z107 paratrooper cooldown on the phone strip
    updateLOD(now);                      // Z107 render budget: near-only soldier shadows, far guards hidden
    updatePowerHud(now);                 // Z107 live power rating vs this stage (1×/s)
    updateBuffHUD(now); updateSquadHud(now);   // Z220 squad panel
    updateCamera(dt, now);
    updateWorldBars(); updatePylonMarks();   // Z243
    updateAbilityUI(now);
    if(PERF.fc%(MOBILE?3:2)===0) drawRadar();   // Z239 desktop too: every 2nd frame (a canvas repaint the eye can't tell from every frame)   // Z92 the 2D radar is a canvas repaint → every 3rd frame on phones
    updateInstr(now);                            // Z228 commander's instrument panel (desktop only)
    // combo timeout
    if(S.combo>0 && now>S.comboUntil && now>bannerTimer){ S.combo=0; document.getElementById('combo').style.opacity='0'; }
    if(bannerTimer>0 && now>bannerTimer && S.combo===0){ document.getElementById('combo').style.opacity='0'; __set_bannerTimer(0); }
  }
  else if(S.mode==='intro'){ S.timeNow=now; updateIntro(dt, now); updateTankRigs(dt); updateWildlife(dt, now); cavIdle(dt); updateTraffic(dt); }   // Z288 the city's traffic moves under the opening shots
  else if(S.mode==='countdown'){ S.timeNow=now; updateCountdown(dt); updateCamera(dt, now); updateTankRigs(dt); cavIdle(dt); }   // Z136 3 · 2 · 1: the world waits
  else if(S.mode==='dying'){ S.timeNow=now; updateDeath(dt, now); }   // death → respawn cinematic (flip + burn + close cam)
  // always-on FX + core idle
  if(S.mode!=='playing'){ updatePylonMarks(); updateSquadHud(now); gradePass.uniforms.aberr.value*=0.85; rangeRing.visible=false; radarCtx.clearRect(0,0,radarCanvas.width,radarCanvas.height); }
  S.timeScale += (1 - S.timeScale) * Math.min(1, dt*1.8);   // ease slow-mo back to normal
  updateCore(dt, now); updateCoreAlarm(now); updateCelebration(dt, now);   // Z140 fireworks + cheering after a win
  updateRings(dt); updateFlashes(dt); updateParticles(dt); updateTrails(dt); updateSmokeTrails(dt); updateDebris(dt); updateShatter(dt); updateTreeFall(dt); updateWrecks(dt); updateFlameJet(dt); updateBolts(dt); updateRocketAim(now); flushParticles();
  if(muzzleLight.intensity>0) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt*12);
  if(HF.dirty){ HF.dirty=false; syncTerrainMesh(HF.dj0, HF.dj1); HF.dj0=HF.dj1=undefined; }   // apply this frame's new craters (one rebuild max)
  updateEngine(dt); updateScore(dt);   // Z161 the score follows the fight
  if(!shopOpen) updateWeather(dt);   // Z107 rain / sand / snow drift with the camera + lightning
  SKY.position.copy(camera.position); updateClouds(dt, camera); updateSkyMood(dt); updateSunFollow(); updateDecals(dt); updateNightLights(dt, now); updateNightMarks(dt, now); updateWater(dt); updateGrass(dt); updateWonder(dt, now); updateMagma(dt, now); if(!MOBILE || (PERF.fc&1)===0) updateFlags(now); updateDying(dt); PERF.fc++; gradePass.uniforms.time.value = now%100;
  aoPass.enabled = AO.on && renderPass.scene===scene && S.mode!=='intro';   // Z239 not during the wide intro move either (the whole field on screen, AO is the priciest pass)   // Z145 not in the 3D shop showroom
  updateTroopBatch(now);   // Z172 every soldier's joints → the batched body-part meshes
  perfRenderBegin(); composer.render(); perfFrameEnd(rawMs);
  // adaptive quality: drop internal resolution one-way if frames get heavy
  _fpsAcc+=dt; _fpsN++;
  if(_fpsAcc>=1){ const fps=_fpsN/_fpsAcc; _fpsAcc=0; _fpsN=0; const dprFloor=MOBILE?(APPLE?1.25:0.8):1, dprTop=(PROFILE.quality==='low')?(MOBILE?0.8:1):dprCap();
    const calib = S.mode==='countdown';                                      // Z150 the 3-2-1 countdown is the calibration window: the world is static, a resize there costs nothing you can feel
    if(S.mode!=='playing' && !calib) AO.on = AO.want && PROFILE.quality!=='low' && PROFILE.perfAO!==false;   // re-armed between battles — unless this machine already proved it can't afford it
    if(S.mode==='playing' || calib){                                          // Z92 governor: step DOWN fast when frames run long, creep back UP after 6 smooth seconds
      if(fps<PERF_GOV.low){ PERF.fastT=0; PERF.slowT++;   // Z239 smoothness first: shed load below ~54 fps (was 47 — a visible judder band)
        if(AO.on && (PERF.slowT>=2 || calib)){ AO.on=false; PERF.slowT=0; PROFILE.perfAO=false; saveProfile(); }   // Z145 the occlusion pass goes first — sharpness stays
        const shedFirst = MOBILE && (PERF.parts>0.6 || bloom.enabled);                          // Z120 phones: particles + glow go BEFORE sharpness
        if(!shedFirst && S.dpr>dprFloor){ const want=Math.floor(S.dpr*Math.sqrt(fps/PERF_GOV.aim)*20)/20;   // Z150 ONE step straight to the resolution that holds ~56 fps (was −0.1 per second → a resize hitch every second for 5 s)
          S.dpr=Math.max(dprFloor, Math.min(S.dpr-0.1, want)); renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); PROFILE.perfDpr=S.dpr; saveProfile(); }
        PERF.parts=Math.max(0.45, PERF.parts-(fps<34?0.2:0.1));
        if(MOBILE && fps<44 && PERF.slowT>=2 && bloom.enabled) bloom.enabled=false; }   // still heavy → drop the glow, keep the frames
      else if(fps>PERF_GOV.high){ PERF.slowT=0; PERF.fastT++;
        if(calib && S.dpr<dprTop-0.01){ S.dpr=Math.min(dprTop,S.dpr+0.1); renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); PROFILE.perfDpr=S.dpr; saveProfile(); }   // Z150 sharper again only in the countdown — a resize mid-fight is a hitch you feel
        if(PERF.fastT>=6){ PERF.fastT=0; PERF.parts=Math.min(1, PERF.parts+0.1); }
        // Z240 DYNAMIC RESOLUTION, upward too: the GPU timer shows real headroom (vsync hides it from the fps count) → one step sharper,
        //   never more often than PERF_GOV.upEvery s, only after PERF_GOV.upHold s of headroom in a row (a resize is a small hitch)
        { const g=perfGpuMs(60), budget=Math.min(16.7, Math.max(6, perfFrameMs(60)));
          if(!calib && g>0 && g<budget*PERF_GOV.upK && S.dpr<dprTop-0.01){ PERF.upT=(PERF.upT|0)+1;
            if(PERF.upT>=PERF_GOV.upHold && now>(PERF.upAt||0)){ PERF.upT=0; PERF.upAt=now+PERF_GOV.upEvery; S.dpr=Math.min(dprTop, S.dpr+0.1); renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); PROFILE.perfDpr=S.dpr; saveProfile(); } }
          else PERF.upT=0; } } } }
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
