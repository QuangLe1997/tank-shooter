// campaign/sectors.js — SECTOR 1 A LONG BATTLE IS A CHAIN OF SECTORS (config.js SECTOR · the rail and the transit's overlay: ui/sector-hud.js).
//   A run carrying `sectors` (launchGame({…, sectors:[…]}) — true: the land's sample run · dev: ?sectors=1, ?sectors=hold,sabotage,boss or place:type[:obj] tokens) is
//   fought one sector at a time on the same land. A sector = a LAYOUT of the field (SECTOR.places: the builders read sectorLay() — world/fortress.js planForts how many
//   forts and whether the citadel stands, world/cover.js the cover ×, world/towers.js the towers ×; campaign/operations.js buildObjective reads sectorObj()) + a MISSION
//   (SECTOR.types) + a CLIMAX (a big event forced once the goal is `at` done). Only one sector exists at a time.
//   THE FLOW: startGame → sectorBegin(run) before the first field is built · the fight goes live (ui/briefing.js goLive → S.mode 'playing') → sectorLive: the goal
//   starts and the CHECKPOINT is taken (health, lives, guns and their rounds, reserves, the squad, the score) · updateSectors every frame of play: the goal's state,
//   its clock, the climax, the rail · the goal done → `hold` s of play (he cannot be hurt, the director stops: S.awaitingUpgrade) → THE TRANSIT (S.mode 'transit',
//   game/loop.js → updateSectorTransit): letterbox + black over the old field → clearField (game/flow.js) + the next layout built (the same calls as loot/upgrades.js
//   chooseUpgrade) + the partial REFILL → the warm-up behind the black (materials graded, shaders compiled, ≤ warmMs) → the black lifts over a camera drop onto his
//   spawn, the radio talking → ui/briefing.js beginStage (the 3-2-1 that waits for its shaders) → goLive. The LAST sector's goal calls campaign/boss.js stageWon:
//   the battle's one win. A battle lost inside a sector (game/player-damage.js gameOver → sectorOver) rebuilds that sector and puts the checkpoint back (≤ retries).
//   Hooks: campaign/boss.js startBoss → sectorBossHold (no general outside the boss sector) · bossStageWon → sectorStageWon (first, before a mode's own stageWon).
//   THE CONQUEST HOOK: sectorBattle(spec, onWon) — the one call by which a battle (CONQUEST's) declares itself a sector run and is handed its win: onWon(now, bdef)
//   runs once, when the LAST sector is won, in place of the ordinary win; without one the win goes the usual way (the mode's stageWon, else campaign/boss.js stageWon).
//   No text in the aim zone: the sector's start / its end go to the top edge (edgeNote), the rail sits in the top band, the transit's card in its letterbox bars.
//   SECTOR 2 four more missions — rescue · breach · infiltrate · pursuit — live in campaign/sector-goals.js (a start, a tick, a clear each); an infiltration's sector is
//   built at night (rebuild turns the run's hour for it). The rail carries the sector's objective line (g.sub) beside its clock; the side missions' card stays hidden.
//   Co-op: host-only for now — a co-op room plays the ordinary battle (sectorBegin stays off).
import * as THREE from 'three';
import { BAL, FORTBOSS, SECTOR, SIDEMISSION, CONTRACTS, OBJECTIVES, SECROUTE, CONQSTORY } from '../../config.js';
import { PERF_BUDGET } from '../../config.js';   // PERF 5 the transit's prime frames
import { dietFieldIdle as dietIdle } from '../hub.js';   // PERF 9 (render/asset-diet.js) · PERF 16 the new field's own files
import { sectorStoryCard } from '../hub.js';   // SECTOR 6
import { knobTurn, knobBack } from '../hub.js';   // MIX 1
import { FORTS, startBoss } from '../hub.js';   // SECTOR 4
import { enemies, bullets, parts, renderer } from '../hub.js';
import { sectorDeal, forkOpen, forkTake, consWon, consRefillK, routeLive, routeTick, routeEnd } from '../hub.js';   // SECTOR 4 (campaign/sector-route.js)
import { sectorGoalHas, sectorGoalStart, sectorGoalTick, sectorGoalClock, sectorGoalClear, sectorClimax, conqSectorLive } from '../hub.js';   // SECTOR 2 (campaign/sector-goals.js · campaign/conquest.js)
import { spawnClear, addScore, spawnSquad, inField, inCamView, wetAt, frontYaw, rearArc, mainFort, fortBossWake, sectorMark } from '../hub.js';   // BAL 6 (game/flow.js) · BAL 7 (game/score.js)
import { ARENA, BIOME, CV, LOGI, OBJ, S, SIDEM, SOLDIER, WAVE, ammoStart, applyBiome, beginStage, bigEventStart, blendScene, buildBlocks, buildLava, buildObjective, buildTrails, buildUnderground, camRestPose, camera,
  cavRespawn, clearField, clearSoldierWar, clearSoldiers, coopActive, compileReady, deploySoldiers, driverBack, gpuHeld, gpuRelease, modeSeed, modelEpoch, parkAtSpawn, radio, rebuildCore, scene,
  sectorRail, sectorTransitBlack, sectorTransitLine, sectorTransitShow, selectGun, gameOver, sfx, edgeNote, modeStageWon, sideMissionStart, squadList, stageWon, updateGunHUD, updateHUD, heightAt } from '../hub.js';

const T = SECTOR, NOW = () => performance.now() / 1000, DEF_PLACE = { hold:'outskirts', sabotage:'bridge', boss:'hq', rescue:'village', breach:'gate', infiltrate:'village', pursuit:'outskirts' };
// the run (dev / probes read it): list = the sectors [{ place, type, obj, vi, lay }] · i = the one in hand · state '' off | arm (built, waiting for the fight) | fight |
//   won (the goal done, the hold before the transit) | transit | done (the battle won) · tr = the transit under way · snap = the checkpoint · stats: what happened
export const SECT = { on:false, spec:null, list:[], i:0, state:'', t:0, tries:0, snap:null, g:null, tr:null, seq:0, onWon:null,
  stats:{ won:0, lost:0, restarts:0, transits:[], climax:0 }, log:[] };
function note(k, why){ const L = SECT.log; if(L.length >= 40) L.shift(); L.push({ k, why:why || '', i:SECT.i, t:+NOW().toFixed(1) }); }
const fill = (t, o) => String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => o && o[k] != null ? o[k] : '');
const clock = s => { s = Math.max(0, Math.ceil(s)); return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); };
// a config number turned for the run and put back by sectorEnd (last turned, first back)
function knob(o, k, v){ knobTurn(o, k, v, 'sector'); }   // MIX 1 the one knob stack (data/knob-stack.js): a sector's entries, put back at each sector's start
export const sectorKnob = knob;   // SECTOR 4 (campaign/sector-route.js: a consequence's or a card's number, put back with the sector's)
function unknob(){ knobBack('sector'); }

// ---- the run's list ----
// one entry: 'hold' · 'bridge:sabotage' · 'bridge:sabotage:radar' · { place, type, obj } → { place, type, obj, vi, lay } (null: not a sector)
export function sectorParse(x){ let o = x; if(typeof x === 'string'){ const a = x.trim().split(':'); o = T.types[a[0]] ? { type:a[0], obj:a[1] } : { place:a[0], type:a[1], obj:a[2] }; }
  if(!o || !T.types[o.type]) return null; const place = T.places[o.place] ? o.place : DEF_PLACE[o.type] || 'village';
  return { place, type:o.type, obj:o.type === 'sabotage' ? (o.obj || 'radio') : o.type === 'infiltrate' ? (o.obj || 'command') : o.type === 'rescue' ? (o.obj || 'civ') : '', vi:T.places[place].vi, lay:T.places[place] }; }   // (rescue: obj = who is held)
export function sectorRun(spec, land, seed, night){ if(spec === true || spec === 1 || spec === '1' || spec === 'true') spec = T.runs[land] || T.runs._;
  if(typeof spec === 'string') spec = spec.split(/[, ]+/).filter(Boolean); if(!Array.isArray(spec)) return []; return sectorDeal(spec, land, seed >>> 0, !!night); }   // SECTOR 4 '*' slots dealt from the land's deck (campaign/sector-route.js)
function devSeed(){ if(typeof location === 'undefined') return null; const m = /[?&]sseed=(\d+)/.exec(location.search); return m ? +m[1] : null; }
function devSpec(){ if(typeof location === 'undefined') return null; const m = /[?&]sectors=([^&#]*)/.exec(location.search); return m ? decodeURIComponent(m[1]) : null; }

// ---- what the builders and the flow ask ----
export function sectorOn(){ return SECT.on; }
export function sectorCur(){ if(!SECT.on) return null; if(SECT.spec != null){ _starting = false; SECT.list = sectorRun(SECT.spec, BIOME.name, SECT.seed, S.tod === 'night'); SECT.spec = null; note('list', SECT.list.map(s => s.fork ? '[' + s.fork.map(r => r.place + ':' + r.type).join('|') + ']' : s.place + ':' + s.type).join(' ')); if(!SECT.list.length){ sectorEnd(); return null; } }   // (the land's sample run is known once the land is: the first builder that asks)
  return SECT.list[SECT.i] || null; }
// the layout of the sector being built (null: no sector run — every builder keeps its own numbers)
export function sectorLay(){ const c = sectorCur(); return c ? c.lay : null; }
// the objective's kind for this sector: null no sector run (the operation's own) · '' none · a kind of OBJECTIVES
export function sectorObj(){ const c = sectorCur(); return c ? (c.type === 'sabotage' || c.type === 'infiltrate' ? c.obj : c.type === 'breach' ? (SECT.forceObj || '') : '') : null; }   // (SECTOR 3 a breach with no gated fort: a bunker's door)   // (SECTOR 2 an infiltration plants its charge on one)
// campaign/boss.js startBoss: outside the boss sector the general stays in his quarters
export function sectorBossHold(){ const c = sectorCur(); return !!c && c.type !== 'boss'; }

// a battle begins (game/flow.js startGame, the run known, nothing built yet — before the mode's own begin): the last run's traces go; this run's sectors, if it has any
//   (a declared run first — sectorBattle — then run.sectors, then the dev query)
let _decl = null, _starting = false;
export function sectorBegin(run){ sectorEnd(); _starting = true; const d = _decl; _decl = null; if(!T.on || !run || coopActive()) return;
  const spec = d ? d.spec : run.sectors != null ? run.sectors : devSpec(); if(spec == null || spec === false) return; openRun(spec, d && d.onWon, d && d.seed); }
const runTag = on => { if(typeof document !== 'undefined' && document.body) document.body.classList.toggle('sectrun', !!on); };   // (css/sector.css: the side missions' card hidden — the rail carries the goal)
function openRun(spec, onWon, seed){ runTag(true); const sd = devSeed() ?? (Number.isFinite(seed) ? seed >>> 0 : null);   /* MIX 1 a mixer battle's deal / forks / cards come from its master seed */ SECT.story = null; SECT.opened = false;   // SECTOR 4 the attempt's seed: a new one each battle (a checkpoint keeps the dealt list)
  Object.assign(SECT, { on:true, spec, list:[], i:0, state:'arm', t:0, tries:0, snap:null, g:null, tr:null, dark:false, onWon:onWon || null, seed:sd != null ? sd : (Math.random() * 4294967296) >>> 0, cons:new Set(), forks:[] }); SECT.seq++;
  SECT.stats = { won:0, lost:0, restarts:0, transits:[], climax:0 }; SECT.log.length = 0; note('begin', String(spec)); }
// THE CONQUEST HOOK: this battle is a sector run (spec: true = the land's sample run · 'hold,sabotage,boss' · [{ place, type, obj }]) and its win is onWon(now, bdef),
//   called once when the last sector is won (the battle's win condition, nowhere else). Call it before launchGame or from the mode's begin (game/flow.js startGame runs
//   sectorBegin first, then modeBegin); it holds for that one battle — a restart from the game-over screen asks the mode's begin again. spec null / false: no sector run.
export function sectorBattle(spec, onWon, seed){ const d = spec == null || spec === false ? null : { spec, onWon:typeof onWon === 'function' ? onWon : null, seed };   // MIX 1 seed: the attempt's route seed (else a fresh one)
  if(_starting && T.on && !coopActive()){ if(d) openRun(d.spec, d.onWon, d.seed); else sectorEnd(); return true; }   // the battle is being set up: it applies at once
  _decl = d; return false; }   // else the next battle's
// SECTOR 6 a run's story (campaign/conq-story.js — a conquest fort's): { open:[lines] before the first sector, go(c) a sector live, won(c) a sector won } — set after
//   sectorBattle for that battle (a new run starts with none)
export function sectorStory(hooks){ if(SECT.on) SECT.story = hooks || null; }
// nothing of a run is left: its knobs, its rail, its overlay (a new battle · quitting to the menu)
export function sectorEnd(){ unknob(); SECT.on = false; SECT.spec = null; SECT.state = ''; SECT.tr = null; SECT.g = null; SECT.onWon = null; SECT.seq++; _starting = false; goQuiet(false); sectorGoalClear(); routeEnd(); railFree(); sectorStoryCard(null); runTag(false); sectorRail(null); sectorTransitShow(null); }

// BAL 17 THE GENERAL FIGHTS IN THE OPEN: an open courtyard out of his citadel's gate (BAL.boss.arenaR m, its centre that far and a few metres more out), clear of the field's edge —
//   his leash (campaign/fort-boss.js home) and his way out (doorOf) go there; null when the field leaves no room (he keeps his walls)
function arenaOf(f){ if(f.gx == null) return null; const R = BAL.boss.arenaR, ux = f.gx - f.x, uz = f.gz - f.z, L = Math.hypot(ux, uz) || 1;
  for(const k of [1, 0.75, 0.55]){ const d = R * k + 4, x = f.gx + ux / L * d, z = f.gz + uz / L * d; if(inField(x, z, R * k * 0.6)) return { x, z, r:R * k }; } return null; }
// BAL 14 a hold's beat: n squads from in front of him or his sides (out of the frame, d m off), knowing where he is
function beatSquads(n, d){ const p = S.player; if(!p) return 0; let k = 0;
  for(let i = 0; i < n; i++){ for(let j = 0; j < 12; j++){ const a = frontYaw(), r = d[0] + Math.random() * (d[1] - d[0]), x = p.pos.x + Math.sin(a) * r, z = p.pos.z + Math.cos(a) * r;
      if(inField(x, z, 4) && !wetAt(x, z, 3) && !inCamView(x, z) && !rearArc(x, z)){ spawnSquad({ x, z, how:'edge', alert:true }); k++; break; } } }
  return k; }
// ---- the checkpoint ----
function snapTake(){ const p = S.player; if(!p) return null;
  return { hp:p.hp, maxHp:p.maxHp, lives:p.lives, gunIdx:p.gunIdx | 0, guns:p.guns.slice(), ammo:p.guns.map(g => g.ammo), res:Object.assign({}, LOGI.res), score:S.score,
    squad:squadList().map(r => ({ role:r.role, name:r.name, dead:!!r.dead })) }; }
function snapPut(c){ const p = S.player; if(!p || !c) return;
  p.maxHp = c.maxHp; p.hp = c.hp; p.lives = c.lives; p.guns.length = 0; for(let k = 0; k < c.guns.length; k++){ c.guns[k].ammo = c.ammo[k]; p.guns.push(c.guns[k]); }   // (the same array: logistics keys its reserves on it)
  const r = LOGI.res; for(const k in r) delete r[k]; Object.assign(r, c.res);   /* BAL 7 the score earned stays through a replay */
  const R = squadList(); R.length = 0; for(const q of c.squad) R.push({ role:q.role, name:q.name, a:null, back:!q.dead, dead:q.dead });
  if(p.gunIdx !== c.gunIdx && c.gunIdx < p.guns.length){ try{ selectGun(c.gunIdx); }catch(e){ p.gunIdx = c.gunIdx; } } }
// between two sectors: a share of his health, his reserves up to a share of a fresh issue, the men who fell brought back
function refill(){ const p = S.player, F = T.refill; if(!p) return;
  p.hp = Math.min(p.maxHp, Math.max(p.hp, 1) + p.maxHp * F.hp); const r = LOGI.res; for(const c in r) r[c] = Math.max(r[c], Math.round(ammoStart(p, c) * F.ammo * consRefillK()));   /* SECTOR 4 (a depot left to the enemy) */
  const dead = squadList().filter(q => q.dead); for(let k = 0, n = Math.ceil(dead.length * F.squad); k < n; k++){ dead[k].dead = false; dead[k].back = true; } }

// ---- the goals ----
// the fight of the sector in hand goes live (the first frame of play after its 3-2-1): the checkpoint, the goal set up
function sectorLive(now){ const c = sectorCur(); _starting = false; { const q = SECT.seq; setTimeout(() => { if(SECT.seq === q) goQuiet(false); }, 1300); }   // SECTOR 2 the 3-2-1's "XUẤT KÍCH!" (shown 0.9 s after GO) stays unseen too
  if(SECT.dark){ SECT.dark = false; const q = SECT.seq; sectorTransitBlack(false, T.transit.fade); setTimeout(() => { if(SECT.seq === q && SECT.state === 'fight') sectorTransitShow(null); }, T.transit.fade * 1000); }   // SECTOR 2 the black held through a new hour's 3-2-1
  SECT.state = 'fight'; SECT.t = 0; unknob(); SECT.snap = snapTake();
  const Y = T.types[c.type], g = SECT.g = { type:c.type, Y, start:0, again:0, lost0:0, clock:0, climax:false, k:0 };
  if(c.type === 'hold'){ knob(SIDEMISSION, 'perStage', 0); knob(SIDEMISSION.truck, 'hold', Y.hold); knob(SIDEMISSION.truck, 't', Y.t); knob(SIDEMISSION.truck, 'overrunT', Y.overrunT); g.again = Y.first; }   // only his truck: no other side mission offered
  else if(c.type === 'sabotage') g.clock = Y.time;
  if(c.type !== 'hold') knob(SIDEMISSION, 'perStage', 0);   // SECTOR 2 the sector's own mission is the only one
  if(sectorGoalHas(c.type)) sectorGoalStart(c.type, c, g, now);   // SECTOR 2 (campaign/sector-goals.js)
  conqSectorLive();   // SECTOR 2 a conquest's fort: what it lays on each field (its poison clouds)
  routeLive(c, g, now);   // SECTOR 4 the battle's consequences on this sector, its event card (campaign/sector-route.js)
  if(c.type === 'boss') g.noFort = !FORTS.some(f => f.tier === 3 && !f.captured);   // SECTOR 4 no citadel stood on this field (a crowded land): the general comes out in the open
  edgeNote(fill(T.say.go, { n:SECT.i + 1, place:c.vi }), '#ffd27a'); radio('SCH: ' + goalTx(c)); note('live', c.type); rail();
  if(SECT.story && SECT.story.go) SECT.story.go(c, SECT.i); }   // SECTOR 6 the fort's line for this sector, its beats (campaign/conq-story.js)
function goalTx(c){ const Y = T.types[c.type]; return fill(T.say[c.type], { s:Y.hold, who:c.type === 'rescue' ? (Y.who[c.obj] || Y.who.civ) : '', obj:c.obj && c.type !== 'rescue' ? String((OBJECTIVES[c.obj] || {}).vi || c.obj).toLocaleLowerCase('vi') : '' }); }   // (the target's own name: the transit tells it before the field is built)
function climax(now){ const g = SECT.g; if(g.climax || !g.Y.climax) return; g.climax = true; const ev = g.Y.climax.ev; if(sectorClimax(ev, g) || bigEventStart(ev, now, true)) SECT.stats.climax++; note('climax', ev); }   // SECTOR 2 a squad at the goal, a patrol at the target — else a big event
// every frame of play (game/loop.js, after the waves)
export function updateSectors(dt, now){ _starting = false; if(!SECT.on || !S.player) return;   // (a frame of play: the battle is set up, a late sectorBattle waits for the next)
  if(SECT.state === 'arm'){ if(SECT.i === 0 && !SECT.opened && SECT.story && SECT.story.open && SECT.story.open.length){ openingStart(SECT.story.open); return; } sectorLive(now); return; }   // SECTOR 6 the fort's opening lines first
  if(SECT.state === 'won'){ if((SECT.t -= dt) <= 0) transitStart(false); return; }
  if(SECT.state !== 'fight') return; SECT.t += dt; const g = SECT.g; routeTick(g, dt, now);   // SECTOR 4 (an air strike owed, a card's big event)
  if(g.type === 'hold'){ const M = SIDEM.cur;
    if(!g.start || !M || M.kind !== 'truck'){ if(g.start && !M) g.start = 0; if((g.again -= dt) <= 0){ g.lost0 = SIDEM.stats.lost; if(sideMissionStart('truck', now)){ g.start = 1; note('truck'); } else g.again = 1; if(!g.start) return; } else { g.k = 0; rail(); return; } }
    const M2 = SIDEM.cur; if(!M2) return; g.k = M2.prog || 0; g.sub = M2.sub || '';
    { const Q = BAL.hold; g.beat = g.beat || 0; if(Q.on && g.beat < Q.at.length && g.k >= Q.at[g.beat]){ beatSquads(Q.n[g.beat], Q.d); radio(Q.say[g.beat]); g.beat++; note('beat', g.beat); } }   // BAL 14 arrive · push · peak
    if(M2.state === 'won') return goalDone(now, null);
    if(M2.state === 'lost'){ if(SIDEM.stats.lost > g.lost0) return sectorFail('XE TIẾP TẾ BỊ ĐỐT'); g.start = 0; g.again = g.Y.again; note('again'); }   // expired / aborted (a life lost): offered again
    if(g.Y.climax && g.k >= g.Y.climax.at) climax(now); rail(); return; }
  if(sectorGoalHas(g.type)){ const r = sectorGoalTick(g, dt, now); if(r === 'won') return goalDone(now, null); if(r) return sectorFail(r);   // SECTOR 2
    if(g.Y.climax && g.k >= g.Y.climax.at) climax(now); rail(); return; }
  if(g.type === 'sabotage'){ if(OBJ && !OBJ.alive) return goalDone(now, null); g.clock -= dt; g.k = OBJ ? 1 - OBJ.b.hp / OBJ.b.maxHp : 0;
    if(g.Y.climax && (g.k >= g.Y.climax.at || g.clock <= g.Y.time * (1 - g.Y.climax.at))) climax(now);
    if(g.clock <= 0) return sectorFail('HẾT GIỜ'); rail(); return; }
  if(g.type === 'boss' && !g.noFort && !g.shown && SECT.t >= BAL.boss.revealT){ g.shown = true; const f = mainFort();   // BAL 15 the general shows: he comes out of his keep (not a quarter of an hour of his garrison first)
    if(f && !f.captured){ g.arena = arenaOf(f); if(g.arena) f.arena = g.arena; if(FORTBOSS.on && !f.boss) fortBossWake(f, now); else if(!FORTBOSS.on && !f.duel){ f.duel = true; startBoss(now, f); } note('general', 'revealed'); } }   // (the gates stand open: world/fortress.js Z315)
  if(g.type === 'boss' && g.arena){ const f = mainFort(), up = f && f.boss && f.boss.st !== 'dead'; sectorMark(1, up ? g.arena.x : null, g.arena.z, g.arena.r, 'flag', '#ff7a5a'); }   // BAL 17 the way to his arena, shown till he falls
  if(g.type === 'boss' && g.noFort && !g.called && SECT.t >= g.Y.wait){ g.called = true; note('general', 'no citadel'); startBoss(now, null); }   // SECTOR 4 (campaign/boss.js: at the far end of the field)
  rail(); }
// campaign/boss.js bossStageWon: true in a sector run (the boss sector's goal — any other sector has no general to fall)
export function sectorStageWon(now, bdef){ if(!SECT.on) return false; const c = sectorCur(); if(c && c.type === 'boss' && SECT.state === 'fight') goalDone(now, bdef); return true; }
function goalDone(now, bdef){ const last = SECT.i >= SECT.list.length - 1; addScore(BAL.score.goal, null);   /* BAL 7 a sector's goal: a round thousand */ SECT.stats.won++; consWon(sectorCur()); if(SECT.story && SECT.story.won) SECT.story.won(sectorCur(), SECT.i); note('won', last ? 'last' : '');   /* SECTOR 4 the route's reward */
  if(last){ const cb = SECT.onWon; SECT.state = 'done'; sectorEnd(); if(cb) cb(now, bdef); else if(!modeStageWon(now, bdef)) stageWon(now, bdef); return; }   // the battle's one win: the declared one (sectorBattle) · a mode's · the stage's (campaign/boss.js)
  SECT.state = 'won'; SECT.t = T.transit.hold; S.awaitingUpgrade = true; S.wave = 0; const p = S.player; if(p) p.invincibleUntil = now + T.transit.hold + 2;   // the director, the waves and the events stop; nothing touches him now
  edgeNote(fill(T.say.won, { n:SECT.i + 1 }), '#8cbf3f'); sfx('levelup'); rail(SECT.i + 1); }
// a sector lost by its own rule (the truck burnt, the clock out) — the same as the battle lost inside it
function sectorFail(why){ SECT.stats.lost++; note('fail', why); if(!sectorOver(why)){ SECT.state = 'done'; gameOver(why); } }   // (no tries left: the ordinary game over)
// game/player-damage.js gameOver: true = handled (the sector is played again from its checkpoint); false = the ordinary game over (no run, or no tries left)
export function sectorOver(reason){ if(!SECT.on || SECT.state === 'done' || SECT.state === '') return false; if(SECT.state === 'transit' || SECT.state === 'won') return true;   // (the goal already done: the transit goes on)
  if(SECT.tries >= T.retries){ note('over', reason); return false; } SECT.tries++; SECT.stats.restarts++; note('retry', reason); transitStart(true, reason); return true; }

// ---- the transit ----
function transitStart(retry, why){ const c0 = sectorCur(); if(!retry){ SECT.i++; SECT.tries = 0; } const c = sectorCur();
  SECT.state = 'transit'; S.mode = 'transit'; S.firing = false; S.awaitingUpgrade = true; unknob();
  SECT.tr = { retry:!!retry, t:0, ph:'fade', ms:0, warm:0, ride:0, rideT:0, lineI:0, lineT:0, seq:SECT.seq, from:c0 && c0.place, p0:null, p1:null, l0:null, l1:null };
  SECT.tr.fork = !retry && !!c.fork;   // SECTOR 4 a fork: the card first, the field once a route is picked
  sectorTransitShow({ kick:retry ? fill(T.say.lost) : 'HÀNH QUÂN', ttl:'KHU ' + (SECT.i + 1) + ' · ' + (SECT.tr.fork ? SECROUTE.say.fork : c.vi), goal:SECT.tr.fork ? '' : goalTx(c) }); sectorTransitBlack(true, T.transit.fade);
  sectorTransitLine((retry ? T.transit.retry : T.transit.lines)[0]); SECT.tr.lineI = 1; rail(); if(why) note('why', why); }
// what the field holds (the probes compare one clear with the next): enemies, rounds, live particles, the scene's top level, the GPU's geometries and maps
const count = () => ({ foes:enemies.length, rounds:bullets.length, parts:parts.length, top:scene.children.length, geo:renderer.info.memory.geometries, tex:renderer.info.memory.textures });
function rebuild(){ const tr = SECT.tr, t0 = performance.now(), held = gpuHeld(); modelEpoch();
  const n0 = count(); sectorGoalClear(); clearField(); const n1 = count(); const p = S.player; clearSoldierWar(); if(CV.dead || !CV.mounted) cavRespawn(p); driverBack(CV.H); p.mesh.visible = true; p.overUntil = 0; p.burns = [];
  parkAtSpawn(); { const R = S.run, t0 = R && R.tod, h0 = S.tod, c = sectorCur(); if(R && c && T.types[c.type].night) R.tod = 'night'; applyBiome(S.stage); if(R) R.tod = t0; tr.hour = S.tod !== h0; }   /* SECTOR 2 an infiltration's field at night (the run's own hour for the next) */ buildBlocks(); modeSeed(16); buildObjective(); modeSeed(17); buildLava(); modeSeed(18); buildUnderground(); modeSeed(19); buildTrails(); spawnClear();   /* BAL 6 */ modeSeed(20);
  rebuildCore(S.stage); gpuRelease(held); clearSoldiers(); deploySoldiers(SOLDIER.base);
  if(tr.retry) snapPut(SECT.snap); else refill(); p.invincibleUntil = 0; updateGunHUD(); updateHUD();
  S.awaitingUpgrade = false; S.wave = 0; WAVE.active = false; WAVE.betweenUntil = NOW() + 0.6; WAVE.spawnQueue.length = 0; WAVE.event = null; WAVE.eventBanner = null; WAVE.treasure = false; WAVE.eliteForce = 0; WAVE.assault = false;
  tr.ms = Math.round(performance.now() - t0); tr.n = { fight:n0, cleared:n1, built:count() };
  // the drop: from high behind his spawn, looking over the field, down onto the play framing (ui/briefing.js's 3-2-1 takes the camera from there)
  const P1 = camera.position.clone(), L1 = camera.position.clone(); if(!camRestPose(P1, L1)){ P1.set(p.pos.x, p.pos.y + 4, p.pos.z + 7); L1.set(p.pos.x, p.pos.y + 1, p.pos.z - 6); }
  const dx = P1.x - L1.x, dz = P1.z - L1.z, d = Math.hypot(dx, dz) || 1, R = T.transit;
  tr.p1 = P1; tr.l1 = L1; tr.p0 = P1.clone().set(P1.x + dx / d * R.rideBack, heightAt(P1.x, P1.z) + R.rideH, P1.z + dz / d * R.rideBack); tr.l0 = L1.clone().set(0, 0, -ARENA * 0.25); _look = _look || L1.clone();
  camera.position.copy(tr.p0); camera.lookAt(tr.l0); }
const ease = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
function warm(){ const tr = SECT.tr, seq = SECT.seq; tr.ph = 'warming';
  const go = () => { if(SECT.seq !== seq || !SECT.tr) return; tr.warm = Math.round((performance.now() - tr.w0));
    if(tr.pk == null && PERF_BUDGET.transit.prime > 0){ tr.pk = 0; tr.go = go; tr.ph = 'prime'; return; }   // PERF 5 first the camera's whole path, drawn under the black
    if(tr.hour){ tr.ph = 'dark'; return; }   // SECTOR 2 a new hour: the 3-2-1 compiles what only shows at GO (the props in hand, the troops) — it runs under the black too (sectorLive lifts it)
    tr.ph = 'ride'; sectorTransitBlack(false, T.transit.fade);
    tr.ride = Math.max(T.transit.ride, Math.min(T.transit.max - tr.t, T.transit.min - tr.t)); tr.rideT = 0; };
  tr.w0 = performance.now(); try{ blendScene(scene); }catch(e){}
  const ms = tr.hour ? T.transit.warmHour : T.transit.warmMs;   // SECTOR 2 a new hour (an infiltration's night) recompiles every lit material: wait for all of it under the black
  // SECTOR 2 … the hidden too: the pools' men, the props that appear at GO — three compiles only what is shown, and after a new hour each of those cost a 0.7–0.9 s frame
  //   in the 3-2-1 or the first wave. Shown for the one synchronous compile call (no light among them: the light count is what the programs are keyed on), hidden again.
  const hid = []; scene.traverse(o => { if(o.visible === false && !o.isLight){ let lit = false; o.traverse(q => { if(q.isLight) lit = true; }); if(!lit) hid.push(o); } });
  let P; for(const o of hid) o.visible = true; try{ P = compileReady(scene, ms); } finally { for(const o of hid) o.visible = false; } tr.hid = hid.length;
  // SECTOR 3 a new hour, once more with the lights that are off switched on too (a flare, a muzzle's light, a searchlight that wakes): each one lit later changes the light
  //   count every program is keyed on — the first night fight recompiled the whole field in one 0.75 s frame. The night variants are built here, under the black.
  if(tr.hour){ const off = []; scene.traverse(o => { if(o.visible === false) off.push(o); }); for(const o of off) o.visible = true; let P2; try{ P2 = compileReady(scene, ms); } finally { for(const o of off) o.visible = false; } tr.lit = off.filter(o => o.isLight).length; P = Promise.all([P, P2]); }
  if(PERF_BUDGET.transit.waitModels) P = Promise.all([P, dietIdle(ms)]);   // PERF 9 and the new field's model files in (they were parsed and swapped in during the ride: 100–170 ms frames)
  Promise.race([P, new Promise(r => setTimeout(r, ms))]).catch(() => {}).then(() => requestAnimationFrame(() => requestAnimationFrame(go))); }
// every frame of the transit (game/loop.js, S.mode 'transit')
export function updateSectorTransit(dt, now){ const tr = SECT.tr; if(!tr){ S.mode = 'playing'; return; } tr.t += dt;
  if(tr.ph === 'story'){ openingStep(tr, dt); return; }   // SECTOR 6
  const L = tr.retry ? T.transit.retry : T.transit.lines; if((tr.lineT += dt) >= T.transit.lineGap && tr.lineI < L.length){ tr.lineT = 0; sectorTransitLine(L[tr.lineI++]); }
  if(tr.ph === 'fade'){ if(tr.t >= T.transit.fade + 0.05){ if(tr.fork){ tr.ph = 'fork'; tr.F = forkOpen(sectorCur(), k => forkDone(tr, k)); } else tr.ph = 'build'; } return; }
  if(tr.ph === 'fork'){ tr.F.tick(dt); return; }   // SECTOR 4 the card up (the lines go on under it)
  if(tr.ph === 'build'){ rebuild(); warm(); return; }
  if(tr.ph === 'warming'){ if(tr.p0){ camera.position.copy(tr.p0); camera.lookAt(tr.l0); } return; }
  if(tr.ph === 'prime'){ primeStep(tr); return; }   // PERF 5
  if(tr.ph === 'primed'){ if(tr.p0){ camera.position.copy(tr.p0); camera.lookAt(tr.l0); } return; }   // PERF 13 (waiting on the files the path asked for)
  if(tr.ph === 'dark'){ if(tr.t >= T.transit.min - T.transit.dark){ camera.position.copy(tr.p1); camera.lookAt(tr.l1); transitEnd(); } return; }   // SECTOR 2 (no ride: the field shows at GO)
  if(tr.ph === 'ride'){ tr.rideT += Math.min(dt, 1 / 30); const u = ease(Math.min(1, tr.rideT / tr.ride));
    camera.position.lerpVectors(tr.p0, tr.p1, u); _look.lerpVectors(tr.l0, tr.l1, u); camera.lookAt(_look);
    if(tr.rideT >= tr.ride){ transitEnd(); } } }
let _look = null;
// PERF 7 (C1-025) NOTHING DRAWN WHILE THE NEW FIELD COMPILES UNDER THE BLACK: a frame drawn while the warm-up's programs were still linking waited for every
//   one of them (one 467 ms frame, then 143 ms ones, the transit's card frozen). game/loop.js skips the draw while this is true; the prime frames draw it.
export function sectorSkipDraw(){ const tr = SECT.tr; return !!tr && S.mode === 'transit' && PERF_BUDGET.transit.noDrawWarm && (tr.ph === 'warming' || tr.ph === 'build'); }
// PERF 5 (C1-025) THE PATH DRAWN ONCE UNDER THE BLACK: the ride's first second showed 56–111 ms frames as the camera dropped over a field drawn for the first time —
//   its maps and buffers sent to the GPU, programs finished, light copies swapped in, all in view. Now, compiled and still black, the camera visits PERF_BUDGET.transit
//   .prime points of the ride (its start, its end where the 3-2-1 begins, and between), one frame each, before the black lifts: what the ride will show is on the GPU.
function primeStep(tr){ const n = Math.max(2, PERF_BUDGET.transit.prime), u = ease(Math.min(1, tr.pk / (n - 1)));
  if(tr.p0 && tr.p1){ camera.position.lerpVectors(tr.p0, tr.p1, u); _look = _look || tr.l1.clone(); _look.lerpVectors(tr.l0, tr.l1, u); camera.lookAt(_look); }
  if(++tr.pk > n){ if(tr.p0){ camera.position.copy(tr.p0); camera.lookAt(tr.l0); } tr.ph = 'primed';   // PERF 13 the path asked for its near levels / sharp maps: those files in too (bounded), then the ride
    const go = () => { if(SECT.tr === tr && tr.ph === 'primed'){ tr.ph = 'warming'; tr.go(); } }; if(PERF_BUDGET.transit.waitModels) dietIdle(PERF_BUDGET.transit.afterPrimeMs).then(go); else go(); } }
// SECTOR 6 THE OPENING: the fort's lines one by one over its field before the first sector (the fight not begun: S.mode 'transit', letterboxed; a centred card is
//   fine here) — each lineT s, or the next at a tap / click / Enter / Space / the pad's A; Esc skips the rest. Then the first sector goes live as ever.
function openingStart(lines){ SECT.opened = true; S.mode = 'transit'; S.firing = false; SECT.tr = { ph:'story', t:0, lines, k:-1, left:0, seq:SECT.seq }; note('opening', lines.length + ' lines'); openingNext(SECT.tr); }
function openingNext(tr){ if(SECT.tr !== tr) return; tr.k++; if(tr.k >= tr.lines.length){ sectorStoryCard(null); SECT.tr = null; S.mode = 'playing'; return; }
  tr.left = CONQSTORY.lineT; sectorStoryCard({ line:tr.lines[tr.k], i:tr.k, n:tr.lines.length, hint:CONQSTORY.skip, next:() => openingNext(tr), skip:() => { tr.k = tr.lines.length; openingNext(tr); } }); }
function openingStep(tr, dt){ if((tr.left -= dt) <= 0) openingNext(tr); }
// SECTOR 4 a route picked: the sector is that route now, the card says where the column goes, the field is built
function forkDone(tr, k){ if(SECT.tr !== tr || tr.ph !== 'fork') return; const c = forkTake(SECT.i, k); tr.ph = 'build'; tr.took = k; note('fork', (k ? 'B ' : 'A ') + (c ? c.place + ':' + c.type : ''));
  if(c) sectorTransitShow({ kick:'HÀNH QUÂN', ttl:'KHU ' + (SECT.i + 1) + ' · ' + c.vi, goal:goalTx(c) }); }
function transitEnd(){ const tr = SECT.tr; SECT.stats.transits.push({ i:SECT.i, retry:tr.retry, s:+tr.t.toFixed(2), buildMs:tr.ms, warmMs:tr.warm, hid:tr.hid, lit:tr.lit || 0, n:tr.n }); note('arrive', tr.ms + ' ms');
  SECT.dark = tr.ph === 'dark'; SECT.tr = null; SECT.state = 'arm'; if(!SECT.dark) sectorTransitShow(null); S.mode = 'countdown';   // (beginStage sets it too: nothing runs a frame of play before its 3-2-1)
  goQuiet(true); const c = S.contract || CONTRACTS.find(x => x.id === 'steady') || CONTRACTS[0]; beginStage({ ...c, name:'' }, {}); }   // the 3-2-1 that waits for the shaders, heard (its beeps) but not shown: no number, mission line or contract name in the aim zone
// a sector's 3-2-1 runs hidden (css/sector.css body.sectgo): the place and the goal were on the transit's card, its start goes to the top edge
function goQuiet(on){ if(typeof document !== 'undefined' && document.body) document.body.classList.toggle('sectgo', !!on); }
// THE RAIL: the sectors, the one in hand lit; `upto` = how many are done (a sector just won is ticked before the transit)
// SECTOR 5 the rail's strip kept clear of the world's own labels: our base's core bar (core/helpers.js #chpbar: the monument at the field's middle, straight ahead
//   from the spawn, so it projects right under the score bar) and a fort's gate bar far ahead — hidden while they stand on the strip, shown again once they leave it
//   or the run ends. The boxes are read twice a second, the forts' bars projected each frame (a handful).
const _rv = new THREE.Vector3(); let _rb = null, _rbAt = 0;
function railClear(now){ if(now > _rbAt){ _rbAt = now + 0.5; const el = typeof document !== 'undefined' && document.getElementById('secRail'); _rb = el && !el.classList.contains('hidden') ? el.getBoundingClientRect() : null;
    const cb = typeof document !== 'undefined' && document.getElementById('chpbar'); if(cb){ const r = cb.getBoundingClientRect(), hit = !!_rb && r.width > 0 && r.right > _rb.left - 8 && r.left < _rb.right + 8 && r.bottom > _rb.top - 6 && r.top < _rb.bottom + 10; if(cb.classList.contains('sr-off') !== hit) cb.classList.toggle('sr-off', hit); } }
  for(const f of FORTS){ const b = f.bar; if(!b) continue; let inS = false;
    if(_rb && (b.g.visible || f._railHid)){ _rv.copy(b.g.position).project(camera); const x = (_rv.x + 1) / 2 * innerWidth, y = (1 - _rv.y) / 2 * innerHeight; inS = _rv.z < 1 && x > _rb.left - 70 && x < _rb.right + 70 && y > _rb.top - 14 && y < _rb.bottom + 26; }
    if(inS && b.g.visible){ b.g.visible = false; f._railHid = true; } else if(!inS && f._railHid){ b.g.visible = true; f._railHid = false; } } }
function railFree(){ for(const f of FORTS) if(f._railHid){ if(f.bar) f.bar.g.visible = true; f._railHid = false; } _rb = null; const cb = typeof document !== 'undefined' && document.getElementById('chpbar'); if(cb) cb.classList.remove('sr-off'); }
function rail(upto){ if(!SECT.on) return; const i = upto != null ? upto : SECT.i, g = SECT.g, F = SECT.state === 'fight' && g; if(F) railClear(performance.now() / 1000);
  const ck = F && g.type === 'sabotage' ? clock(g.clock) : F && g.type === 'hold' && g.start ? Math.round(g.k * 100) + '%' : F && sectorGoalHas(g.type) ? sectorGoalClock(g) : '';
  sectorRail(SECT.list, i, ck, F ? g.sub || '' : ''); }   // SECTOR 2 the objective's line beside the clock
// dev / probes: the run in a line
export function sectorState(){ const c = sectorCur(); return { on:SECT.on, i:SECT.i, n:SECT.list.length, state:SECT.state, type:c && c.type, place:c && c.place, tries:SECT.tries, k:SECT.g ? +SECT.g.k.toFixed(2) : 0, clock:SECT.g ? +(SECT.g.clock || 0).toFixed(1) : 0, mode:S.mode }; }
