// game/loop.js — MAIN LOOP: per-frame update + render orchestration, frame pacing, ability cooldown dials
import { updateFootfall, updateBigEvents, updateSideMissions, updateDirector, updateInstViews, cavIdle, updateBarBatch, updateCavalry, updateGeneralDuel, updateRank, updateSoldierWar, updateSquadMates, AO, APPLE, HF, MOBILE, PERF, PLAYER, PLAY_MODES, PROFILE, S, SKY, __set_bannerTimer, aoPass, bannerTimer, bloom, buildUnitGrid, camera, composer, doResize, dprCap, drawRadar, flushParticles, gated, gradePass, muzzleLight, perfFrameBegin, perfFrameEnd, perfFrameMs, perfGpuMs, perfRenderBegin, pollGamepad, pumpTips, radarCanvas, radarCtx, rangeRing, renderPass, renderer, saveProfile, scene, spellNow, syncTerrainMesh, tickTip, updateAirAim, updateAllyDead, updateBolts, updateBridges, updateBuffHUD, updateBullets, updateCamera, updateCamps, updateCelebration, updateCinematic, updateCity, updateAerial, updateBackdrop, updateClouds, updateCmdUI, updateCore, updateCoreAlarm, updateCoreGuns, updateCountdown, updateCrosshair, updateCrowd, updateDeath, updateDebris, updateDecals, updateDepots, updateEnemies, updateEnemyMissiles, updateAmbience, updateEngine, updateEnvEvents, updateEquip, updateFieldcraft, updateFireteam, updateFlags, updateFlames, updateFlashes, updateForts, updateGifts, updateGore, updateGrass, updateGunStatus, updateHeliCrew, updateHeliDown, updateHorizon, updateInfDead, updateInstr, updateIntro, updateLOD, updateLava, updateLockWarn, updateLootBeacons, updateMagma, updateNightLights, updateNightMarks, updateObjective, updatePOWs, updateParadrops, updateParticles, updatePickups, updateRally, updateRelic, updateReload, updateRings, updateRocketAim, updateRockets, updateRubble, updateScore, updateShatter, updateSkyLife, updateSkyMood, updateSmokeTrails, updateSoldiers, updateSquadHud, updateSquads, updateSunFollow, updateSupply, updateSurprises, updateTowers, updateTraffic, updateTrails, updateTreeFall, updateTroopBatch, updateTunnels, updateUnder, updateWallMarks, updateWalls, updateWater, updateWaves, updateWeather, updateWildlife, updateWonder, updateWorldBars, updateGunFX, updateSpinners, updateTowerFalls, storyTick, updateDroneWar, droneWarIdle, spellReady, fpvCam, updateAfx, updateLogistics, updateQuiet, updateFireFX, updateModes, coopGuestFrame, coopTick } from '../hub.js';
import { FRAME_PACE } from '../../config.js';
import { updateWaterSpray } from '../hub.js';   // HSWIM 2 (fx/water-spray.js)
import { updateFortBoss } from '../hub.js';   // BOSS 1 (campaign/fort-boss.js)
import { tierDprTop } from '../hub.js';   // SPLIT 3 (render/quality.js)
import { comboTick } from '../hub.js';   // HUDCLEAN 2 (game/score.js)
import { updateSectors, updateSectorTransit } from '../hub.js';   // SECTOR 1 (campaign/sectors.js)

// ----------------------------- MAIN LOOP -----------------------------
const NOGOV=typeof location!=='undefined' && /[?&]nogov\b/.test(location.search);   // PERF 1 ?nogov holds the governor still (the resolution and the occlusion pass stay as they start): for measuring
const PERF_GOV = { low:54, aim:59, high:58, upK:0.55, upHold:6, upEvery:10 };   // Z240 + step back up in play when the GPU sits under upK × frame budget for upHold s (≤ once per upEvery s)   // Z239 frame governor: step down under low fps, aim the one resize step at aim fps, creep back up above high
export let last = performance.now();
export function __set_last(v){ last=v; }   // (dev/hooks tick) — imports are read-only, writes go through a setter
// PERF 8 STEADY FRAMES THAT STAY SHARP (CÀI ĐẶT → KHUNG HÌNH, FRAME_PACE): the display ticks 60 (or 120) times a second and a frame that takes 25 ms
//   lands on every second tick or on the next, so a battle judders between 60 and 30 — and the FPS governor, chasing 54, blurred the picture and switched
//   the occlusion off without ever reaching it. Now a frame is drawn at most every 1/cap s. Auto starts at 60; frames held under low60 fps for slowS
//   seconds lock it to an even 30 (every frame 33 ms, the resolution and AO kept); while at 30, the display tick right after a drawn frame tells whether
//   the GPU was done inside one tick (under probeMs) — when nearly all were (upShare of probeN), it tries 60 again; a try that falls back waits longer.
//   The governor sheds quality only when even the cap cannot be held.
export const PACE = { cap:60, drawn:0, after:false, probe:0, fast:0, slowT:0, until:0, tries:0, frames:0, sum:0, hp:0, hf:0, playAt:0, was:'' };
function paceMode(){ let m; try{ m=PROFILE.fps; }catch(e){} return m==='30' || m==='60' ? m : 'auto'; }
export function paceCap(){ const m=paceMode(); return m==='30' ? 30 : m==='60' ? 60 : PACE.cap; }
const NOPACE=typeof location!=='undefined' && /[?&]nopace\b/.test(location.search);   // TEST 1 ?nopace: every tick draws a frame (with Chrome's vsync off, the frame time is the real cost — tools/ts.mjs --novsync)
function paceSkip(nowMs){ const P=PACE, C=FRAME_PACE; if(NOPACE){ P.drawn=nowMs; return false; } if(!P.init){ P.init=true; try{ if(PROFILE.paceCap===30) P.cap=30; }catch(e){} }   // (start where this machine settled last time)
  if(S.mode==='playing' && P.was!=='playing') P.playAt=nowMs/1000; P.was=S.mode;   // (a fight starts: its first seconds load and settle)
  const cap=paceCap(), since=nowMs-P.drawn;
  if(since < 1000/cap - C.slackMs){ if(P.after){ P.after=false; if(cap===30 && S.mode==='playing'){ const f=since < C.probeMs; P.probe++; P.hp++; if(f){ P.fast++; P.hf++; } } } return true; }   // a tick between frames: skipped (the first one after a frame is the probe)
  if(P.drawn && S.mode==='playing' && paceMode()==='auto'){ const now=nowMs/1000; P.frames++; P.sum+=since;
    if(P.sum>=1000){ const fps=P.frames*1000/P.sum; P.frames=0; P.sum=0;
      if(P.cap===60){ P.slowT = fps<C.low60 ? P.slowT+1 : 0; if(P.slowT>=C.slowS){ P.cap=30; P.slowT=0; P.probe=P.fast=0; P.until=now+C.hold*Math.pow(2, Math.min(4, P.tries)); try{ PROFILE.paceCap=30; }catch(e){} } }
      else if(P.probe>=C.probeN){ const ok=P.fast/P.probe>=C.upShare; P.probe=P.fast=0; if(ok && now>=P.until){ P.cap=60; P.tries++; P.slowT=0; try{ PROFILE.paceCap=60; }catch(e){} } } } }
  P.drawn=nowMs; P.after=true; return false; }
export function loop(nowMs){
  requestAnimationFrame(loop);
  if(paceSkip(nowMs)) return;   // PERF 8
  const now = nowMs/1000;
  const rawMs = nowMs - last; let dt = rawMs/1000; last = nowMs;
  dt = Math.min(dt, 0.05);
  { const ig=!!PLAY_MODES[S.mode]; if(ig!==_ingame){ _ingame=ig; document.body.classList.toggle('ingame', ig); } }   // drives the portrait gate (menus stay usable upright) — Z107: only on change
  if(gated() && !window.__forceFrame) return;   // portrait gate up or tab hidden → don't burn a frame behind the curtain (QA tick may force)
  perfFrameBegin();   // Z240 frame-time probe (render/perfhud.js)


  updateFlames(dt); updateSkyLife(dt, now);                 // Z235 living flames · swallows, raptors, high aircraft                                          // Z235 living flames (camp fires, braziers, torches)
  updateHorizon(dt, now);                                    // Z189 the world beyond the fence (menu backdrop too)
  pumpTips(); tickTip();                                     // Z94 a queued first-time tip · Z168 shown as a side card, the battle keeps going
  pollGamepad(dt, now);                                      // Z117 controller: battle, menus, rumble
  if(S.mode==='playing' && coopGuestFrame(dt, now, nowMs)){}   // COOP 6 the guest of a co-op room: his own soldier and rounds, the enemy drawn from the host's snapshots (game/coop-puppets.js) — false at once without a room
  else if(S.mode==='playing'){
    S.timeNow = now;
    const gdt = dt * S.timeScale * (now < (S.hitStop||0) ? 0.35 : 1);   // Z239 hit-stop softened (was 0.12: read as a dropped frame)       // slow-mo on boss kill · Z168 a heavy kill freezes the action for a few frames (hit-stop)
    updateReload(now);              // complete reload on time + drive the countdown dial
    if((PERF.fc&(MOBILE?3:1))===0) updateGunStatus(now);   // ✓/reloading badges (every 4th frame on phones)
    updateCrosshair(gdt, now); updateAirAim(gdt);   // Z376 the point under the crosshair (combat/crosshair.js) · Z313 the gun laid on an aircraft (combat/air-aim.js)
    updateCavalry(gdt, now); updateSoldierWar(gdt, now); updateRank(); updateSquadMates(); updateGeneralDuel(gdt); updateFortBoss(gdt, now);   // Z245 the soldier · Z350 rank · Z351 squad · Z353 the general's duel
    buildUnitGrid(now);             // Z172 who-is-near-whom, once a frame
    updateSquads(gdt, now); updateFieldcraft(gdt, now); updateHeliCrew(gdt, now); updateDirector(gdt, now); updateSurprises(gdt, now); storyTick(now); updateSideMissions(gdt, now); updateBigEvents(gdt, now);   // Z173 squad plans (enemy squads + our fireteam teams / focus) · Z220 grenades in flight + smoke screens
    updateEnemies(gdt, now);
    updateBullets(gdt, now);
    updateLockWarn(gdt, now);
    updateCinematic(gdt, now); updateRubble(gdt); updateSupply(gdt, now); updateCrowd(gdt); updateWallMarks(gdt); updateCity(gdt);   // Z193 burning heaps   // Z192 hurt enemy tanks smoke, then burn      // Z189 shock domes · fire light · damage smoke       // Z188 "BỊ KHOÁ" brackets while a guided missile hunts you
    updateLava(gdt, now);           // Z187 caldera lava: glow, embers, burns      // Z186 orbital lances · plasma suns · black holes · photon beams
    updateRockets(gdt, now);   // lobbed rounds in flight (the M79, the hand grenade)
    updateEnemyMissiles(gdt, now); updateInfDead(gdt); updateGore(gdt, now); updateHeliDown(gdt); updateEquip(gdt, now); updateObjective(gdt, now);   // Z82 smoke · APS · mines   // Z79 rockets/missiles in flight · fallen soldiers   // enemy ARTILLERY: barrage director + locked missile strikes
    updateWalls(dt);                    // Z86 toppling masonry
    updateTowers(gdt, now);             // watchtower guards fire down; collapsing towers + falling guards
    updateForts(gdt, now);              // Z107 fortresses: garrison, sallies, gate, capture
    updateBridges(gdt, now); updateCamps(gdt, now);   // Z90 rope bridges + enemy camps
    updateWaves(dt, now);               // wave timers run real-time
    updateModes(gdt, now);              // MODE 3 night defence / the daily challenge, right after the waves they steer (campaign/mode-run.js)
    updateSectors(gdt, now);            // SECTOR 1 the sector's goal, its clock, its climax (campaign/sectors.js)
    updatePickups(gdt, now); updateGifts(gdt, now); updateRelic(gdt, now); updateLogistics(gdt, now); updateQuiet(gdt, now);   // SUPPLY 1 ammunition reserves (game/logistics.js) · SUPPLY 3 the knife, bodies, the alarm, the eye (game/quiet.js)
    updateLootBeacons(dt);               // glowing markers on bricks/tanks that hide a power-up
    updateDroneWar(gdt, now);   // DRONE 1 the drones of both sides (actors/drone.js)
    updateSoldiers(gdt, now);            // friendly squad guarding the Core
    updateFireteam(gdt, now); updateAllyDead(gdt);   // Z89 friendly fireteam + their APC (Z104: autonomous squad) · Z113 our fallen
    updateCoreGuns(gdt, now);           // Z140 guard cannons on our bastions
    updateWildlife(gdt, now);           // Z143 herds graze and bolt from tanks
    updateEnvEvents(gdt, now);          // Z140 floods · rockslides · collapses · weather surges
    updateTunnels(gdt, now); updateUnder(gdt, now);   // Z225 the enemy tunnel network
    updatePOWs(gdt, now); updateDepots(gdt, now); updateRally(gdt, now); updateParadrops(gdt, now);   // Z104 POW stockades · depots · rally point · paratroopers
    updateCmdUI(now);                    // Z107 paratrooper cooldown on the phone strip
    updateLOD(now);                      // Z107 render budget: near-only soldier shadows, far guards hidden
    updateBuffHUD(now); updateSquadHud(now);   // Z220 squad panel
    if(!fpvCam(dt, now)) updateCamera(dt, now);   // DRONE 2 the view from the FPV drone's nose while he flies it (combat/drone-skills.js), else the follow camera
    updateWorldBars();
    updateAbilityUI(now);
    if(PERF.fc%(MOBILE?3:2)===0) drawRadar();   // Z239 desktop too: every 2nd frame (a canvas repaint the eye can't tell from every frame)   // Z92 the 2D radar is a canvas repaint → every 3rd frame on phones
    updateInstr(now);                            // Z228 commander's instrument panel (desktop only)
    // combo timeout
    if(S.combo>0 && now>S.comboUntil) S.combo=0; comboTick(now);   // HUDCLEAN 2 the combo is its own small chip by the score (game/score.js), no longer the banner
    if(bannerTimer>0 && now>bannerTimer){ document.getElementById('combo').style.opacity='0'; __set_bannerTimer(0); }
  }
  else if(S.mode==='intro'){ S.timeNow=now; updateIntro(dt, now); updateWildlife(dt, now); cavIdle(dt); updateTraffic(dt); }   // Z288 the city's traffic moves under the opening shots
  else if(S.mode==='countdown'){ S.timeNow=now; updateCountdown(dt); updateCamera(dt, now); cavIdle(dt); }   // Z136 3 · 2 · 1: the world waits
  else if(S.mode==='dying'){ S.timeNow=now; updateDeath(dt, now); }   // death → respawn cinematic (flip + burn + close cam)
  else if(S.mode==='transit'){ S.timeNow=now; updateSectorTransit(dt, now); }   // SECTOR 1 between two sectors: the black, the build, the drop onto the new field
  coopTick(dt, now, nowMs);   // COOP 5 each page's soldier to the other, the host's snapshot (returns at once without a room)
  // always-on FX + core idle
  if(S.mode!=='playing'){ droneWarIdle(); updateSquadHud(now); gradePass.uniforms.aberr.value*=0.85; rangeRing.visible=false; radarCtx.clearRect(0,0,radarCanvas.width,radarCanvas.height); }
  S.timeScale += (1 - S.timeScale) * Math.min(1, dt*1.8);   // ease slow-mo back to normal
  updateCore(dt, now); updateCoreAlarm(now); updateCelebration(dt, now);   // Z140 fireworks + cheering after a win
  updateRings(dt); updateFlashes(dt); updateParticles(dt); updateFireFX(dt); updateTrails(dt); updateSmokeTrails(dt); updateDebris(dt); updateShatter(dt); updateTreeFall(dt); updateTowerFalls(dt); updateBolts(dt); updateGunFX(dt); updateRocketAim(now); flushParticles();   // Z419 shaped flashes, brass, the muzzle light's strobe
  updateWaterSpray(dt);   // HSWIM 2 the water's spray, crowns, foam and rings (fx/water-spray.js)
  if(muzzleLight.intensity>0) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt*12);
  if(HF.dirty){ HF.dirty=false; syncTerrainMesh(HF.dj0, HF.dj1); HF.dj0=HF.dj1=undefined; }   // apply this frame's new craters (one rebuild max)
  updateEngine(dt); updateScore(dt); updateAfx(dt, now); updateAmbience(dt, now);   // Z161 the score follows the fight · the nature ambience under it (audio/ambience.js)
  updateWeather(dt);   // Z107 rain / sand / snow drift with the camera + lightning
  SKY.position.copy(camera.position); updateClouds(dt, camera); updateAerial(camera); updateBackdrop(); updateSkyMood(dt); updateSunFollow(); updateDecals(dt); updateFootfall(dt, now); updateNightLights(dt, now); updateNightMarks(dt, now); updateWater(dt); updateGrass(dt); updateWonder(dt, now); updateSpinners(dt); updateMagma(dt, now); if(!MOBILE || (PERF.fc&1)===0) updateFlags(now); PERF.fc++; gradePass.uniforms.time.value = now%100;
  aoPass.enabled = AO.on && renderPass.scene===scene && S.mode!=='intro';   // Z239 not during the wide intro move either (the whole field on screen, AO is the priciest pass)   // Z145 not in the 3D shop showroom
  updateTroopBatch(now);   // Z172 every soldier's joints → the batched body-part meshes
  updateInstViews();   // VIEW 1 the field-wide instanced meshes follow the soldier
  updateBarBatch();   // PERF 5 every health bar showing → two instanced meshes
  perfRenderBegin(); composer.render(); perfFrameEnd(rawMs);
  // adaptive quality: drop internal resolution one-way if frames get heavy
  _fpsAcc+=dt; _fpsN++;
  if(_fpsAcc>=1){ const fps=_fpsN/_fpsAcc; _fpsAcc=0; _fpsN=0; const dprFloor=MOBILE?(APPLE?1.25:0.8):1, dprTop=tierDprTop();   // SPLIT 3 the quality level's top (render/quality.js)
    const calib = S.mode==='countdown';                                      // Z150 the 3-2-1 countdown is the calibration window: the world is static, a resize there costs nothing you can feel
    if(S.mode!=='playing' && !calib) AO.on = AO.want && PROFILE.quality!=='low' && PROFILE.perfAO!==false;   // re-armed between battles — unless this machine already proved it can't afford it
    const capK=paceCap()/60, paceFirst=paceMode()==='auto' && PACE.cap===60, warm=S.mode==='playing' && now-PACE.playAt<FRAME_PACE.warmS;   // PERF 8 at 30 the governor wants 27, not 54; at auto-60 the lock to 30 comes first; a fight's first seconds (loading hitches) are not judged
    const room=PACE.hp>=10 && PACE.hf/PACE.hp>=FRAME_PACE.roomK; PACE.hp=PACE.hf=0;   // PERF 8 locked at 30, most frames done inside one display tick: room to spare
    if(!NOGOV && (S.mode==='playing' || calib)){                              // Z92 governor: step DOWN fast when frames run long, creep back UP after 6 smooth seconds
      if(fps<PERF_GOV.low*capK && !paceFirst && !warm){ PERF.fastT=0; PERF.slowT++; PERF.roomT=0; if(now-(PERF.lastUp||-1e9)<FRAME_PACE.upEvery*1.5) PERF.upBack=Math.min(16, (PERF.upBack||1)*2);   // (a step back up that did not hold: the next waits twice as long)
        PERF.upAt=Math.max(PERF.upAt||0, now+FRAME_PACE.upEvery*2*(PERF.upBack||1));   // Z239 smoothness first: shed load below ~54 fps (was 47 — a visible judder band)
        if(AO.on && (PERF.slowT>=2 || calib)){ AO.on=false; PERF.slowT=0; PROFILE.perfAO=false; saveProfile(); }   // Z145 the occlusion pass goes first — sharpness stays
        const shedFirst = MOBILE && (PERF.parts>0.6 || bloom.enabled);                          // Z120 phones: particles + glow go BEFORE sharpness
        if(!shedFirst && S.dpr>dprFloor){ const want=Math.floor(S.dpr*Math.sqrt(fps/(PERF_GOV.aim*capK))*20)/20;   // (PERF 8 aimed at the cap: locked at 30 it gives up only what 30 needs)   // Z150 ONE step straight to the resolution that holds ~56 fps (was −0.1 per second → a resize hitch every second for 5 s)
          S.dpr=Math.max(dprFloor, Math.min(S.dpr-0.1, want)); renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); PROFILE.perfDpr=S.dpr; saveProfile(); }
        PERF.parts=Math.max(0.45, PERF.parts-(fps<34?0.2:0.1));
        if(MOBILE && fps<44 && PERF.slowT>=2 && bloom.enabled) bloom.enabled=false; }   // still heavy → drop the glow, keep the frames
      else if(fps>PERF_GOV.high*capK){ PERF.slowT=0; PERF.fastT++;
        if(calib && S.dpr<dprTop-0.01){ S.dpr=Math.min(dprTop,S.dpr+0.1); renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); PROFILE.perfDpr=S.dpr; saveProfile(); }   // Z150 sharper again only in the countdown — a resize mid-fight is a hitch you feel
        if(PERF.fastT>=6){ PERF.fastT=0; PERF.parts=Math.min(1, PERF.parts+0.1); }
        // PERF 8 QUALITY BACK AT 30: what was shed (in a fight's loading hitches, or a heavy moment) comes back while the lock has room — the occlusion first,
        //   then the resolution a step at a time — after FRAME_PACE.roomS s of room in a row, at most every upEvery s
        if(!calib && paceCap()===30 && room){ PERF.roomT=(PERF.roomT|0)+1; if(PERF.roomT>=FRAME_PACE.roomS && now>(PERF.upAt||0)){ PERF.roomT=0; PERF.upAt=now+FRAME_PACE.upEvery; PERF.lastUp=now;
          if(!AO.on && AO.want && PROFILE.quality!=='low'){ AO.on=true; PROFILE.perfAO=true; saveProfile(); }
          else if(S.dpr<dprTop-0.01){ S.dpr=Math.min(dprTop, S.dpr+0.1); renderer.setPixelRatio(S.dpr); composer.setPixelRatio?.(S.dpr); doResize(true); PROFILE.perfDpr=S.dpr; saveProfile(); } } }
        else if(!room) PERF.roomT=0;
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
  const spCd = spellNow().cd * p.spellCdMul, sc = Math.round(Math.max(0, (spellReady(spellNow(), p) - now)/spCd)*50)/50;   // (DRONE 1 a drone skill's own clock)
  const C=_abC||(_abC={ d:document.getElementById('cool-dash'), ad:document.getElementById('ab-dash'), s:document.getElementById('cool-spell'), m:document.getElementById('cool-mspell'), as:document.getElementById('ab-spell'), dc:-1, sc:-1 });
  if(dc!==C.dc){ C.dc=dc; if(C.d) C.d.style.transform='scaleY('+dc+')'; C.ad?.classList.toggle('ready', dc<=0); }
  if(sc!==C.sc){ C.sc=sc; const t='scaleY('+sc+')'; if(C.s) C.s.style.transform=t; if(C.m) C.m.style.transform=t; C.as?.classList.toggle('ready', sc<=0); }
}
