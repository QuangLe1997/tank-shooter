// campaign/night-defence.js — MODE 1 NIGHT DEFENCE ("THỦ ĐÊM", config NIGHTDEF; the run kit: campaign/mode-run.js; its arithmetic: data/mode-math.js).
//   A custom battle at night on any battlefield: the player and his squad hold OUR base from dusk to dawn. The night has a clock on the HUD (text in the side
//   mission's card: 21:00 → 05:00, NIGHTDEF.len seconds; it runs faster while the field is quiet and the next assault is far) and is NIGHTDEF.assaults.length
//   assaults with lulls between them. Nothing of the campaign's battle is rebuilt: an assault is a queue handed to the campaign's own wave spawner
//   (campaign/waves.js: WAVE.spawnQueue, WAVE.fixedEdge = the side it comes from), so the director still meters it, flanks with it and grounds it
//   (campaign/director.js), the tactics tier still gives its men a plan (ai/tiers.js — the later assaults raise the tier: marksmen, MG teams), and the campaign's
//   own waves never start (WAVE.betweenUntil is held far away every frame). On top of the queue the night plays what the game already has: a mortar barrage
//   (campaign/surprises.js's shells), a drone raid (campaign/drone-raid.js), men up out of a hatch inside the wire (campaign/entries.js), and in the last
//   assault the stage's general with his guards (campaign/general-duel.js — he does not wait in his citadel on a night like this: mode-run.js modeBossHold).
//   An assault's side is never marked: the enemy's red signal flare goes up there and a sentry calls it on the radio, NIGHTDEF.warn s ahead.
//   THE BASE IS THE TARGET: the men who have not found him march on the base (their report of where we are — ai/awareness.js e.lk — is a point by the Core), and a
//   man who stands by the wall for a few seconds lays charges (the Core loses health while he lives). Lose: the Core destroyed, or no lives left. Win: dawn —
//   the hour really changes (world/atmosphere.js), whoever is left of them runs. Then NEXT NIGHT: the same base one campaign loop harder; the longest run of
//   nights and the best night's score are kept in PROFILE.modes.nd.
//   HIS TOOLS: the FLARE, a skill added to the wheel for the night (combat/trooper-spells.js's list; taken out again when the mode ends): it burns NIGHTDEF.flare.burn s
//   over the point he aims at — the ground under it glows, the whole field's fill light rises a little, every enemy soldier in its circle is marked as the recon
//   drone marks (a diamond through walls, a blip on the map) and he is lit himself if he stands in it (game/stealth.js). Between assaults the base's gun that
//   faced the last one is out of ammunition: he re-arms it by standing by it. Smoke, the recon drone, the fireteam and the ammunition point are the campaign's.
import * as THREE from 'three';
import { NIGHTDEF, SIDEMISSION, SPACE, WEATHER } from '../../config.js';
import { MIX, composeBattle, nightSpec, mixBegin, mixGo, mixSeed, mixNightApply } from '../hub.js';   // MIX 5 a night IS a battle spec with a night block (data/mixer-math.js nightSpec / nightBlock · campaign/mixer.js)
import { BIOME, BIOMES, CORE_DEF, MODE, RECON, S, SURP, TROOPER_SPELLS, WAVE, WX, _canvasTex, ambient, applyAtmosphere, applyWeather, biomeVi, blHot, bossForStage, capVi, celebrate, clampFieldXZ, computeEnv, core, damageCore, dirCount, dirDiff, dirNoFlank, dirPass, droneRaid, duelOn, duelReset, enemies, fieldEdgePoint, fillTx, floatText, generalStart, hatchEntry, heightAt, lowVi, modeCard, modeChip, modeDefine, modeKnob, modeNum, modeOn, modeSay, modeShare, modeStats, modeStore, modeUndo, modeWhere, ndClock, ndQueue, ndScore, openBattleSetup, pickTx, saveProfile, scene, sfx, showBanner, spawnPart, stealthLight, tapBtn, updateHUD, updateSpellHUD } from '../hub.js';

const C = NIGHTDEF, Y = C.say, EDGE = [-Math.PI / 2, Math.PI / 2, Math.PI, 0], OPP = [1, 0, 3, 2], R2 = a => a[0] + Math.random() * (a[1] - a[0]);   // EDGE: campaign/waves.js's four sides (their side · ours · west · east) as world/field.js bearings
// the night as it stands (dev / probes read it): t — seconds of the night · k — the assault in hand (−1: none yet) · phase first | warn | assault | lull | wait
export const ND = { night:1, base:1, t:0, k:-1, phase:'first', dir:-1, open:false, ax:0, ex:[], survived:0, genDown:false, done:false, won:false, doneT:0, dawnIn:0, pre:false, pushAt:0, sapAt:0, sapSay:-99, sapRadio:-1, hudAt:0,
  guns:[], nDry:0, gunSay:-99, fl:[], liftK:1, ambSet:NaN, flAt:0, warm:null, tier:null, stats:{ flares:0, sig:0, shells:0, hatch:0, drones:0, sapDmg:0, pushed:0, rearmed:0, dried:0, cut:0, marked:0 } };
let _pass = null;   // the word NEXT NIGHT hands to the battle it starts: a restart, or anything else carrying a later night, begins at night one again
const _at = { x:0, y:0, z:0 }, _lit = { on:true, r:0, st:1, ux:0, uz:1, hit:{ x:0, z:0 } }, SMOKE = { color:0xcfc8b8, size:1.1, life:1.6, smoke:true, grav:-0.2, drag:1, grow:1.2, op:0.22 };
const hh = u => ndClock(u, C.h0, C.h1, C.clockStep), wxNow = () => lowVi((WEATHER[WX.id] || WEATHER.clear).vi);
const foe = e => !e.guard && !e.fortOf && !e.abandoned;

// ---- from the menus ----
// CHUẨN BỊ TRẬN's third tab (ui/battle-setup.js): the battlefield, weather, size and enemy level of a custom battle — the hour is the night
export function nightDefSetup(o){ const b = BIOMES[o.biome] || BIOMES[0]; return { kick:fillTx(Y.kick, { h0:hh(0), h1:hh(1) }), sum:fillTx(Y.sum, { b:capVi(biomeVi(b.name)), wx:lowVi(WEATHER[o.wx].vi), sp:lowVi(SPACE[o.space].vi), lvl:o.lvl }) }; }
export function nightDefLaunch(o){ composeBattle(nightSpec({ ...o, nd:{ night:1, base:o.lvl } })); }   // MIX 5 the night's spec (its night block: clock, assaults, lulls, flare, sappers, the wall's guns)
if(typeof document !== 'undefined') tapBtn('nightBtn', () => openBattleSetup('night'));

// ---- the flares: his (ours: a pool of light on the ground, marks, the lift) and the enemy's signal (a red star over the fence) ----
let _tex = null, _geo = null; const POOL = [];
function glowTex(){ return _tex || (_tex = _canvasTex(128, 128, (x, W, H) => { const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.16, 'rgba(255,255,255,0.72)'); g.addColorStop(0.5, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); })); }
function flareObj(){ const o = POOL.pop(); if(o) return o;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false }));
  const pool = new THREE.Mesh(_geo || (_geo = new THREE.CircleGeometry(1, 40)), new THREE.MeshBasicMaterial({ map:glowTex(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2; sp.visible = pool.visible = false; scene.add(sp); scene.add(pool); return { sp, pool }; }
function flareFree(o){ o.sp.visible = o.pool.visible = false; POOL.push(o); }
// one goes up from (x0, z0) to burn over (x, z)
function flareUp(ours, x0, z0, x, z){ const F = C.flare, G = ours ? F : F.sig, o = flareObj(), a = Math.random() * 6.283;
  o.sp.material.color.copy(blHot(G.col, 2.4)); o.pool.material.color.setHex(G.col);
  ND.fl.push({ ours, o, x0, z0, y0:heightAt(x0, z0) + 1.6, x, z, gy:heightAt(x, z), alt:G.alt, burn:G.burn, size:G.size, dx:Math.cos(a) * F.drift, dz:Math.sin(a) * F.drift, t:0, k:0, pe:0 }); }
function flaresFrame(dt){ const F = C.flare, p = S.player; let lift = 0;
  for(let i = ND.fl.length - 1; i >= 0; i--){ const f = ND.fl[i], o = f.o; f.t += dt;
    if(f.t < F.rise){ const u = f.t / F.rise, e = 1 - (1 - u) * (1 - u); o.sp.position.set(f.x0 + (f.x - f.x0) * u, f.y0 + (f.gy + f.alt - f.y0) * e, f.z0 + (f.z - f.z0) * u); o.sp.scale.setScalar(f.size * 0.22); o.sp.material.opacity = 1; o.sp.visible = true; o.pool.visible = false; f.k = 0; continue; }
    const b = f.t - F.rise; if(b >= f.burn){ flareFree(o); ND.fl.splice(i, 1); continue; }
    f.x += f.dx * dt; f.z += f.dz * dt; const k = Math.min(1, (f.burn - b) / 2, 0.3 + b / 0.25) * (1 - F.flick * Math.random()), gy = heightAt(f.x, f.z), y = Math.max(gy + 4, f.gy + f.alt - F.sink * b); f.k = k;
    o.sp.position.set(f.x, y, f.z); o.sp.scale.setScalar(f.size * (0.8 + 0.2 * k)); o.sp.material.opacity = k; o.sp.visible = true;
    if(f.ours){ o.pool.visible = true; o.pool.position.set(f.x, gy + 0.22, f.z); o.pool.scale.setScalar(F.R); o.pool.material.opacity = F.pool * k;
      if(p){ const d = Math.hypot(p.pos.x - f.x, p.pos.z - f.z); lift = Math.max(lift, k * (d < F.R ? 1 : Math.max(0.25, 1 - (d - F.R) / (F.R * 2)))); } }
    if((f.pe -= dt) <= 0){ f.pe = 0.3; spawnPart(f.x, y + 0.6, f.z, 0, 0.5, 0, SMOKE); } }
  liftSet(1 + F.lift * lift); }
// the field's fill light × K while a flare of his burns. Whoever else sets it meanwhile (a weather surge starts from the battlefield's own value: fx/weather.js)
//   is taken as the new base, so the lift never stacks and never leaves the night darker than it found it
function liftSet(K){ if(K === ND.liftK) return; const base = ambient.intensity === ND.ambSet ? ND.ambSet / ND.liftK : ambient.intensity; ambient.intensity = ND.ambSet = base * K; ND.liftK = K; }
// what a burning flare of his does, every NIGHTDEF.flare.tick s: the men in its circle are marked, and he is lit if he stands in it
function flaresTick(now){ const F = C.flare, r2 = F.R * F.R;
  for(let i = 0; i < ND.fl.length; i++){ const f = ND.fl[i]; if(!f.ours || !(f.k > 0)) continue;
    _lit.r = F.R; _lit.hit.x = f.x; _lit.hit.z = f.z; stealthLight(_lit);
    for(let j = 0; j < enemies.length; j++){ const e = enemies[j]; if(!e.def.inf || !(e.hp > 0) || e.rise) continue; const dx = e.pos.x - f.x, dz = e.pos.z - f.z; if(dx * dx + dz * dz > r2) continue;
      if(!(e.markUntil > now)) ND.stats.marked++; e.markUntil = now + F.mark; if(e.markUntil > RECON.markedUntil) RECON.markedUntil = e.markUntil; } } }
function flaresOff(){ for(let i = 0; i < ND.fl.length; i++) flareFree(ND.fl[i].o); ND.fl.length = 0; if(ND.warm){ flareFree(ND.warm); ND.warm = null; } liftSet(1); }
// THE SKILL (his own clock, like the drones': combat/spells.js spellReady): over the point under the pointer, or ahead of him with no pointer; false = none went up
function flareCast(){ const p = S.player, F = C.flare; if(!p || !modeOn('nd')) return false; let n = 0; for(let i = 0; i < ND.fl.length; i++) if(ND.fl[i].ours) n++;
  if(n >= F.max){ floatText(Y.flareMax, '#ffd86a', p.pos, 14); return false; }
  const a = p.aimSmoothed ?? p.facing ?? 0; let x = p.pos.x + Math.sin(a) * F.ahead, z = p.pos.z + Math.cos(a) * F.ahead;
  if(S.pointerActive && S.aimPoint){ const dx = S.aimPoint.x - p.pos.x, dz = S.aimPoint.z - p.pos.z, k = Math.min(1, F.reach / (Math.hypot(dx, dz) || 1)); x = p.pos.x + dx * k; z = p.pos.z + dz * k; }
  [x, z] = clampFieldXZ(x, z, 2); flareUp(true, p.pos.x, p.pos.z, x, z); ND.stats.flares++; floatText(Y.flareUp, '#fff0c8', p.pos, 15); sfx('rocketlaunch', p.pos, 0.6); return true; }
const FLARE = { id:'flare', name:'FLARE', get vi(){ return Y.flare; }, svg:'burst', own:true, get cd(){ return C.flare.cd; }, cast(){ return flareCast(); } };

// ---- an assault: its side given away, its queue, what the director plays with it ----
function announce(k, now){ if(ND.open) close(now, 'next'); let d = ND.dir; while(d === ND.dir) d = (Math.random() * 4) | 0; ND.dir = d; ND.phase = 'warn';
  const A = C.assaults[k], q = fieldEdgePoint(EDGE[d] + (Math.random() - 0.5) * 0.5, 6); flareUp(false, q[0], q[1], q[0], q[1]); ND.stats.sig++; _at.x = q[0]; _at.y = 0; _at.z = q[1]; sfx('rocketlaunch', _at, 0.9);
  modeSay(fillTx(A.heli ? Y.warnHeli : pickTx(Y.warn), { d:Y.dirs[d] })); }
function assault(k, now){ const A = C.assaults[k], T = ND.tier; ND.k = k; ND.phase = 'assault'; ND.open = true; ND.ax = 0; ND.ex.length = 0; for(let i = 0; i < A.extra.length; i++) ND.ex.push(A.extra[i]);
  if(T) T.a[T.i] = Math.min(3, T.v0 + (A.tier || 0));   // the tactics tier of this assault (ai/tiers.js tacTier reads the difficulty's row; the knob goes back with the mode)
  const q = ndQueue(A, dirCount() * (1 + (ND.night - 1) * C.nightK), Math.random); S.wave = k + 1; dirNoFlank();   // (a flank the director chose while the field was quiet is dropped: this assault opens from the side the sentry called — one he decides in the fight still comes)
  Object.assign(WAVE, { event:null, eventBanner:null, treasure:false, eliteForce:0, assault:false, columnLeft:0, plan:null, pk:0, probeHeld:false, fixedEdge:ND.dir });
  if(!WAVE.active) WAVE.spawnQueue.length = 0; for(let i = 0; i < q.length; i++) WAVE.spawnQueue.push(q[i]);   // (the last one still on the field: this one comes on top of it)
  WAVE.spawnAt = now + 0.4; WAVE.active = true; sfx('alarm'); modeSay(pickTx(Y.go)); updateHUD(); }
// seen off: cleared, cut short before the next (its men still on the field are his to finish), or simply outlived when the next is called
function close(now, why){ if(!ND.open) return; ND.open = false; ND.survived++; if(why === 'next') return; ND.phase = ND.k + 1 < C.assaults.length ? 'lull' : 'wait';
  modeSay(why === 'cut' ? Y.cut : pickTx(Y.lull)); }
function mortar(){ const M = C.mortar, c = EDGE[ND.dir], p = S.player;
  for(let i = 0; i < M.n; i++){ let x, z; if(p && Math.random() < M.pP){ const a = Math.random() * 6.283, r = Math.random() * M.nearP; x = p.pos.x + Math.cos(a) * r; z = p.pos.z + Math.sin(a) * r; }
    else { const a = c + (Math.random() - 0.5) * 2 * M.arc, r = R2(M.ring); x = core.pos.x + Math.cos(a) * r; z = core.pos.z + Math.sin(a) * r; }
    SURP.shells.push({ x, z, t:M.t + i * M.gap + Math.random() * 0.2, warn:M.warn, R:M.R, dmg:M.dmg, ours:false, pulse:0, wh:false }); ND.stats.shells++; }   // (campaign/surprises.js lands them: the red ring, the whistle)
  modeSay(fillTx(Y.mortar, { d:Y.dirs[ND.dir] }), 1.2); }
function hatch(){ const o = OPP[ND.dir], a = EDGE[o] + (Math.random() - 0.5) * 0.8, r = R2(C.hatch.r), q = clampFieldXZ(core.pos.x + Math.cos(a) * r, core.pos.z + Math.sin(a) * r, 6);
  hatchEntry(q[0], q[1], C.hatch.types.slice(), { alert:true }); ND.stats.hatch++; sfx('alarm'); modeSay(fillTx(Y.hatch, { d:Y.dirs[o] })); }
function general(){ const def = bossForStage(S.stage), q = fieldEdgePoint(EDGE[ND.dir], C.general.inset), k = MODE.seq;
  if(!generalStart({ x:q[0], z:q[1] }, def, () => { if(MODE.seq !== k || ND.done) return; ND.genDown = true; showBanner(fillTx(Y.generalDown, { g:def.name }), '#ffd24a', true); })) return;
  dirPass(WAVE.spawnQueue.length); modeSay(fillTx(Y.general, { g:def.name }), 4.5); }
function extra(x, now){ if(x.k === 'mortar') mortar(); else if(x.k === 'drone'){ if(droneRaid(now, x.kind)) ND.stats.drones++; } else if(x.k === 'hatch') hatch(); else if(x.k === 'general') general(); }

// ---- the base under attack ----
// the men who have not found him march on the base: their report of where we are is a point by the Core, on their own side of it
function push(){ const P = C.push, cx = core.pos.x, cz = core.pos.z, far = (P.ringR[1] + 12) ** 2;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.def.inf || !foe(e) || e.alert !== 0 || !e.lk || (e.lk.x - cx) ** 2 + (e.lk.z - cz) ** 2 < far) continue;
    const a = Math.atan2(e.pos.z - cz, e.pos.x - cx) + (Math.random() - 0.5) * 0.9, r = R2(P.ringR); e.lk.x = cx + Math.cos(a) * r; e.lk.z = cz + Math.sin(a) * r; ND.stats.pushed++; } }
// a man by the wall long enough is laying charges: the Core loses health while he lives
function sap(){ const Q = C.sap, cx = core.pos.x, cz = core.pos.z, r2 = Q.r * Q.r; let n = 0, one = null;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.def.inf || e.guard || e.abandoned || e.gaveUp || e.rise || !(e.hp > 0)){ continue; }
    if((e.pos.x - cx) ** 2 + (e.pos.z - cz) ** 2 > r2){ if(e._sap) e._sap = 0; continue; } e._sap = (e._sap || 0) + Q.tick; if(e._sap >= Q.arm && n < Q.maxN){ n++; one = one || e; } }
  if(!n) return; if(MODE.t - ND.sapSay >= Q.sayT){ ND.sapSay = MODE.t; _at.x = one.pos.x; _at.z = one.pos.z; _at.y = heightAt(_at.x, _at.z) + 2.4; floatText(Y.sap, '#ff8a4a', _at, 15); }
  if(ND.sapRadio !== ND.k){ ND.sapRadio = ND.k; modeSay(Y.sapRadio); }
  const d = n * Q.dps * Q.tick; ND.stats.sapDmg += d; damageCore(d); }   // (last: the Core falling ends the battle — mode-run.js modeOver — inside this call)
// THE BASE'S GUNS HAVE A NIGHT'S AMMUNITION EACH, NOT AN ARSENAL: a guard cannon fires NIGHTDEF.gun.shells shells, an MG tower NIGHTDEF.gun.rounds rounds (counted off
//   their own fire clock: world/core-walls.js moves G.fireAt on every shot), then it is silent until he stands by it for NIGHTDEF.gun.t s — in the lull, or
//   under fire. Left alone the wall goes quiet gun by gun and the men at it lay their charges in peace.
function gunsReady(){ ND.guns.length = 0; ND.nDry = 0; for(const L of [CORE_DEF.guns, CORE_DEF.mgs]) for(let i = 0; i < L.length; i++){ const G = L[i]; ND.guns.push({ G, mg:L === CORE_DEF.mgs, left:L === CORE_DEF.mgs ? C.gun.rounds : C.gun.shells, f:G.fireAt, t:0, tag:0 }); } }
function gunSide(G){ const a = Math.atan2(G.z - core.pos.z, G.x - core.pos.x); let best = 0, bd = 9; for(let i = 0; i < 4; i++){ const d = Math.abs(Math.atan2(Math.sin(a - EDGE[i]), Math.cos(a - EDGE[i]))); if(d < bd){ bd = d; best = i; } } return Y.dirs[best]; }
function gunsFrame(dt, now){ const p = S.player, G0 = C.gun, r2 = G0.r * G0.r, t2 = G0.tagR * G0.tagR;
  for(let i = 0; i < ND.guns.length; i++){ const q = ND.guns[i], G = q.G;
    if(q.left > 0){ if(G.fireAt === q.f) continue; q.f = G.fireAt; if(--q.left > 0) continue;   // it fired
      G.fireAt = q.f = 1e12; q.t = 0; q.tag = 0; ND.nDry++; ND.stats.dried++; if(MODE.t - ND.gunSay >= G0.sayT){ ND.gunSay = MODE.t; modeSay(fillTx(Y.gunDry, { d:gunSide(G) })); } continue; }
    if(!p) continue; const d2 = (p.pos.x - G.x) ** 2 + (p.pos.z - G.z) ** 2; _at.x = G.x; _at.y = (G.y || 0) + 2.4; _at.z = G.z;
    if(d2 < r2){ if(q.t === 0) floatText(Y.gunLoad, '#ffd86a', _at, 14); q.t += dt;
      if(q.t >= G0.t){ q.left = q.mg ? G0.rounds : G0.shells; G.fireAt = q.f = now + 0.4; ND.nDry--; ND.stats.rearmed++; floatText(Y.gunUp, '#9be04a', _at, 16); sfx('powerup'); } continue; }
    q.t = 0; if((q.tag -= dt) <= 0){ q.tag = G0.tag; if(d2 < t2) floatText(Y.gunTag, '#ffb060', _at, 14); } } }
function gunsBack(){ for(let i = 0; i < ND.guns.length; i++) if(!(ND.guns[i].left > 0)) ND.guns[i].G.fireAt = 0; ND.guns.length = 0; ND.nDry = 0; }

// ---- the HUD (text in the side mission's card), the end ----
function hud(){ const N = C.assaults.length, u = ND.t / C.len, H = Y.hud; let line, left = WAVE.spawnQueue.length; for(let i = 0; i < enemies.length; i++) if(foe(enemies[i])) left++;
  if(ND.phase === 'first') line = H.first; else if(ND.phase === 'warn') line = fillTx(H.warn, { d:Y.dirs[ND.dir] }); else if(ND.phase === 'assault') line = fillTx(H.assault, { k:ND.k + 1, n:N, e:left }); else line = ND.phase === 'wait' ? H.wait : H.lull;
  if(ND.nDry && !ND.done) line += fillTx(H.gun, { n:ND.nDry });
  modeChip(Y.name + (ND.night > 1 ? ' · ' + fillTx(Y.night, { n:ND.night }) : ''), hh(u), u, line, ''); }
// DAWN: the hour changes for real, whoever is left of them runs, the men cheer — then the result
function win(now){ const p = S.player; ND.done = ND.won = true; ND.doneT = 0; if(ND.open){ ND.open = false; ND.survived++; } flaresOff(); gunsBack(); WAVE.spawnQueue.length = 0; ND.ex.length = 0; duelReset();
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(e.def.inf && !e.guard && !e.fortOf) e.def = { ...e.def, range:0, keep:90, speed:e.def.speed * 1.3 }; }   // (as a fallen general's guards do: campaign/general-duel.js)
  ND.dawnIn = 2;   // the hour itself changes two frames on (frame, below): the switch is a hitch — a new sky, the lights — and the banner should be on the screen before it
  if(p) p.invincibleUntil = now + C.dawn.hold + 6; celebrate('victory', 0, 0); showBanner(Y.dawn, '#ffd86a', true); modeSay(Y.dawnRadio, 0.1); ND.phase = 'wait'; hud(); }   // (after celebrate: its banner and radio line are the campaign's — the dawn's own go over them)
function card(won, reason){ const st = modeStats(), W = modeWhere(), E = Y.end, N = C.assaults.length, coreK = core && core.maxHp ? Math.max(0, core.hp) / core.maxHp : 0;
  const score = ndScore({ base:S.score, survived:ND.survived, core:coreK, acc:st.acc, won, general:ND.genDown, night:ND.night }, C.score), M = modeStore().nd, streak = won ? ND.night : ND.night - 1;
  const beat = streak > (M.nights | 0) || score > (M.score | 0); if(streak > (M.nights | 0)) M.nights = streak; if(score > (M.score | 0)) M.score = score; saveProfile();
  const o = { b:W.b, wx:wxNow(), night:fillTx(Y.night, { n:ND.night }), k:ND.survived, n:N, kills:st.kills, clock:hh(ND.t / C.len), score:modeNum(score), core:Math.round(coreK * 100), acc:Math.round(st.acc * 100), diff:W.diff, name:W.name, gen:ND.genDown ? E.gen : '', won };
  const more = won && ND.night < C.maxNight, run = MODE.cfg || {}, cfg = { biome:run.biome, tod:'night', wx:run.wx, space:run.space }, base = ND.base, night = ND.night;
  flaresOff(); gunsBack();
  modeCard({ kick:fillTx(won ? E.kickWon : E.kickLost, o), lost:!won, big:won ? E.won : E.lost, why:fillTx(won ? E.whyWon : /MẠNG/.test(reason || '') ? E.whyDead : E.whyCore, o),
    stats:[[E.stats[0], o.score], [E.stats[1], ND.survived + '/' + N], [E.stats[2], o.core + '%'], [E.stats[3], o.acc + '%']], best:(beat ? E.newBest : '') + fillTx(E.best, { n:M.nights, s:modeNum(M.score) }), newBest:beat,
    hint:won ? E.hintWon : E.hintLost, go:more ? E.next : E.retry, share:modeShare(o, Y.share), copy:{ label:Y.copy, done:Y.copied, fail:Y.copyFail },
    onGo:() => { if(more){ _pass = 'n' + night + ':' + MODE.seq; composeBattle(nightSpec({ ...cfg, lvl:base + 5 * night, nd:{ night:night + 1, base, pass:_pass } })); } else composeBattle(nightSpec({ ...cfg, lvl:base, nd:{ night:1, base } })); } }); }   // MIX 5 (as specs)

// ---- the mode (campaign/mode-run.js calls these) ----
modeDefine('nd', {
  // the run is known, the world not yet built: which night this is (a later one only with NEXT NIGHT's word), the side missions off (their card is the clock)
  begin(run){ const q = run.nd || {}, ok = (q.night | 0) > 1 && !!q.pass && q.pass === _pass; _pass = null;
    Object.assign(ND, { night:ok ? Math.min(C.maxNight, q.night | 0) : 1, base:Math.max(1, (q.base | 0) || (run.level | 0) || 1), t:0, k:-1, phase:'first', dir:-1, open:false, ax:0, survived:0, genDown:false, done:false, won:false, doneT:0, dawnIn:0, pre:false, pushAt:0, sapAt:0, sapSay:-99, sapRadio:-1, hudAt:0, flAt:0, tier:null });
    ND.ex.length = 0; ND.guns.length = 0; ND.nDry = 0; ND.gunSay = -99; for(const k in ND.stats) ND.stats[k] = 0;
    // MIX 5 the night's spec: the mixer's plan (its numbers, its seed) and its night block turned onto NIGHTDEF (only what differs from today's) — the queue below runs from it
    if(!(MIX.spec && MIX.spec.night)){ MIX.spec = nightSpec({ lvl:run.level, biome:run.biome, wx:run.wx, space:run.space, nd:run.nd }); MIX.score = null; }   // (a launch that did not come through composeBattle)
    mixBegin(null); mixNightApply(); modeKnob(SIDEMISSION, 'on', false); },
  seed(k){ mixSeed(k); },
  go(now, first){ mixGo(first); },
  // the soldier stands ready: the night's loop (one harder a night), the flare in his skill wheel and in hand, the flare's two materials on the field for the
  //   shader warm-up the briefing and the countdown run (ui/briefing.js prewarmStage) — the first one he fires must not hitch
  ready(p){ const lv = ND.base + 5 * (ND.night - 1); S.loop = Math.floor((lv - 1) / 5); if(S.run){ S.run.level = lv; S.run.nd = { night:ND.night, base:ND.base }; } if(S.runCfg){ S.runCfg.level = lv; S.runCfg.nd = { night:ND.night, base:ND.base }; }
    if(!(MIX.plan && MIX.plan.night && MIX.plan.night.flare.on === false) && !TROOPER_SPELLS.includes(FLARE)) TROOPER_SPELLS.push(FLARE); modeUndo(() => { const i = TROOPER_SPELLS.indexOf(FLARE); if(i >= 0) TROOPER_SPELLS.splice(i, 1); if(S.spell >= TROOPER_SPELLS.length) S.spell = 0; updateSpellHUD(); });   // (MIX 5 a night block may leave the flare out)
    S.spell = Math.max(0, TROOPER_SPELLS.indexOf(FLARE)); updateSpellHUD();
    if(p){ const o = ND.warm = flareObj(); o.sp.position.set(p.pos.x, 3, p.pos.z); o.pool.position.set(p.pos.x, 0.3, p.pos.z); o.sp.scale.setScalar(0.5); o.pool.scale.setScalar(0.5); o.sp.material.opacity = o.pool.material.opacity = 0.004; o.sp.visible = o.pool.visible = true; }
    updateHUD(); },
  // the fight goes live: dusk
  live(){ if(ND.warm){ flareFree(ND.warm); ND.warm = null; } const a = dirDiff().tier, i = Math.max(0, Math.min(a.length - 1, (S.stage || 1) - 1)); ND.tier = { a, i, v0:a[i] }; modeKnob(a, i, a[i]);
    gunsReady(); S.wave = 0; modeSay(Y.first, 0.6); hud(); updateHUD(); },
  frame(dt, now){ const N = C.assaults.length; WAVE.betweenUntil = 1e12;   // the campaign's own waves never begin: the night's assaults fill the queue
    flaresFrame(dt); if((ND.flAt -= dt) <= 0){ ND.flAt = C.flare.tick; flaresTick(now); }
    if(ND.done){ if(ND.dawnIn > 0 && --ND.dawnIn === 0){ S.tod = C.dawn.tod; applyAtmosphere(BIOME); applyWeather(WX.id); computeEnv(); } else if((ND.doneT += dt) >= C.dawn.hold) card(true); return; }
    const nk = ND.k + 1, tNext = nk < N ? C.at[nk] - C.warn : C.len, quiet = !WAVE.active && ND.phase !== 'warn' && ND.k >= 0 && !ND.ex.length && !duelOn();
    ND.t = Math.min(C.len, ND.t + dt * (quiet && tNext - ND.t > (nk < N ? C.lull.max : 0) ? C.fastK : 1));
    if(ND.k >= 0){ ND.ax += dt; for(let i = ND.ex.length - 1; i >= 0; i--) if(ND.ax >= ND.ex[i].t) extra(ND.ex.splice(i, 1)[0], now); }
    if(ND.phase === 'assault'){ if(WAVE.spawnQueue.length && ND.t >= tNext - C.lull.min){ WAVE.spawnQueue.length = 0; ND.stats.cut++; close(now, 'cut'); } else if(!WAVE.active && ND.ax > 2) close(now, 'clear'); }
    if(nk < N){ if(ND.phase !== 'warn' && ND.t >= tNext) announce(nk, now); if(ND.phase === 'warn' && ND.t >= C.at[nk]) assault(nk, now); }
    if(!ND.pre && ND.t >= C.len * C.dawn.pre){ ND.pre = true; modeSay(Y.predawn); }
    gunsFrame(dt, now);
    if((ND.pushAt -= dt) <= 0){ ND.pushAt = C.push.every; push(); }
    if((ND.hudAt -= dt) <= 0){ ND.hudAt = C.hud; hud(); }
    if(ND.t >= C.len){ win(now); return; }
    if((ND.sapAt -= dt) <= 0){ ND.sapAt = C.sap.tick; sap(); } },
  over(reason){ if(!ND.done) card(false, reason); },   // (dawn has come: a shell still in the air changes nothing)
  bossHold(){ return true; },
  pauseTx(){ return fillTx(Y.pause, { clock:hh(ND.t / C.len), k:Math.max(0, ND.k + 1), n:C.assaults.length }); },
  brief(){ return { op:fillTx(Y.briefOp, { h1:hh(1) }), brief:fillTx(Y.brief, { n:C.assaults.length }), obj:fillTx(Y.obj, { h0:hh(0), h1:hh(1) }) }; },
  end(){ flaresOff(); gunsBack(); ND.done = false; ND.ex.length = 0; } });
