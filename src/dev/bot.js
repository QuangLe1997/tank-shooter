// dev/bot.js — BOT 1 THE FIGHTING BOT: a player at the keyboard and mouse for calibrating the battle mixer (tools/calib.mjs) — asleep unless ?bot[=skill] or botStart()
//   It plays through the game's own input layer only: key events on window (the bindings' own keys — move, sprint, crouch, reload, skills, ride, gun, the cards' 1 / 2 / Esc)
//   and mouse events (the cursor laid on the screen point it wants: input/input.js casts it into the world as for a real mouse; the left button fires and is held).
//   It never writes health, enemies or positions, and it reads only what the screen, the HUD and the minimap give a player: the radar's dots (where the fight is),
//   a man shot at only while he is on screen with a clear line, the objective's rings and markers and its rail (the sector's phase), the cards on offer.
//   Skill (config.js BOT.skill): reaction time, aim error and how fast the cursor follows, bursts and pauses, how long it stays up out of cover, when it falls back,
//   how far it keeps off, how keen it is on cover, grenades, skills and loot. B.stats is what it did — the harness reads it (botState()).
import * as THREE from 'three';
import { BOT } from '../../config.js';
import { CV, FBOSS, FORTS, GUNS, blocksNear, inBlock, LOGI, OBJ, S, SECT, SGOAL, SIDEM, VIEW, WAVE, ammoReserve, camera, clampFieldXZ, core, coverSpot, duelMan, enemies, heightAt, keysFor, lineStop, magCap,
  mainFort, pickups, playerRange, renderer, scene, sectorCur, sectorForkShown, sectorStoryShown, spellList, spellNow, spellReady } from '../hub.js';

const B = { on:false, skill:'average', K:null, iv:0, t:0, keys:new Set(), mx:-1, my:-1, down:false, aim:new THREE.Vector3(), aimSet:false, tgt:null, react:0, err:0, firstShot:0,
  burstEnd:0, pauseEnd:0, goal:{ k:'', x:0, z:0, r:0, o:null, y:0 }, goalAt:0, thr:{ x:0, z:0, on:false }, cover:null, coverAt:0, coverWant:false, peekUntil:0, hideUntil:0,
  stanceAt:0, rideAt:0, rideTry:0, rideOff:0, stuckT:0, unstuck:0, side:1, sx:0, sz:0, unN:0, unAt:0, nadeAt:0, skillAt:0, medAt:0, act:null, cardAt:0, loot:null, lootAt:0,
  home:{ x:0, z:0, set:false }, sect:-2, retreat:0, rFire:false, hitEl:null, wasM:null, losN:0, camAt:0, reloadAt:0, gunAt:0, hitN:0, hitAt:-9, hitA:0, lastErr:'', stats:null };
export const BOT_STATE = B;
const POOL = [], VIS = [], LOS = new WeakMap(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _scr = { x:0, y:0 };
const rnd = r => r[0] + Math.random() * (r[1] - r[0]), gauss = () => { let u = 0; for(let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / 0.7071; };
const KEY = id => (keysFor(id) || [])[0];
const fresh = () => ({ t:0, playT:0, shots:0, bursts:0, eng:0, kills:0, ttk:[], nades:0, skills:{}, loot:0, covers:0, retreats:0, rides:0, stuck:0, climbs:0, forks:[], stories:0, cards:0,
  ringT:0, modes:{}, errs:0, hits:0, seenHits:0, cams:0 });

// ---- the hands: keys and the mouse ----
//   (sent where a real one lands — keys on the focused element, the mouse on the canvas — and bubbling up to window, so a card's capture-phase handler that stops one stops it)
function key(k, down){ if(!k || down === B.keys.has(k)) return; if(down) B.keys.add(k); else B.keys.delete(k);
  (document.activeElement || document.body).dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key:k, bubbles:true, cancelable:true })); }
const pad = () => renderer.domElement || document.body;
function tap(k){ key(k, true); key(k, false); }
function mouseTo(x, y){ x = Math.max(4, Math.min(VIEW.w - 4, x)); y = Math.max(4, Math.min(VIEW.h - 4, y)); if(Math.abs(x - B.mx) < 0.5 && Math.abs(y - B.my) < 0.5) return; B.mx = x; B.my = y;
  pad().dispatchEvent(new MouseEvent('mousemove', { clientX:x, clientY:y, bubbles:true })); }
function trigger(down, now){ if(down === B.down) return; B.down = down; pad().dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { clientX:B.mx, clientY:B.my, button:0, bubbles:true }));
  if(down){ B.stats.bursts++; if(B.tgt && !B.firstShot) B.firstShot = now; } }
function letGo(){ for(const k of [...B.keys]) key(k, false); trigger(false, 0); }
// a world point on the screen (null: behind the lens or outside the window)
function scr(x, y, z){ _v.set(x, y, z).project(camera); if(!(_v.z < 1) || _v.z < -1) return null; const sx = (_v.x * 0.5 + 0.5) * VIEW.w, sy = (1 - (_v.y * 0.5 + 0.5)) * VIEW.h;
  if(sx < 8 || sx > VIEW.w - 8 || sy < 8 || sy > VIEW.h - 8) return null; _scr.x = sx; _scr.y = sy; return _scr; }
const chestY = e => Math.max(e.pos.y || 0, heightAt(e.pos.x, e.pos.z)) + 1.1;
// BAL 1 a few feelers ahead along the way he wants to go: a wall, a tower, a tank of the foundry in it — he turns to the nearest clear way (left or right, wider and wider)
const _bn = [];
function clearWay(p, a){ const P = BOT.steer; for(const d of P.probe){ const x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; for(const bl of blocksNear(x, z, P.near, _bn)) if(!bl.ours && inBlock(bl, x, z, P.pad)) return false; } return true; }   // (near: a container's centre is metres from its end)
function steer(p, wx, wz){ const L = Math.hypot(wx, wz); if(L < 1e-3 || CV.mounted) return; const a0 = Math.atan2(wx, wz); if(clearWay(p, a0)) return;
  for(const f of BOT.steer.fan) for(const s of B.side > 0 ? [1, -1] : [-1, 1]){ const a = a0 + f * s; if(clearWay(p, a)){ B.wx = Math.sin(a) * L; B.wz = Math.cos(a) * L; B.stats.steer = (B.stats.steer || 0) + 1; return; } } }
// the keys that push him toward world direction (wx, wz): the screen-relative scheme (core/helpers.js getMoveDir turns the keys by the camera's yaw)
function push(wx, wz, sprint){ const L = Math.hypot(wx, wz); let u = false, d = false, l = false, r = false;
  if(L > 1e-3){ const c = Math.cos(S.camYaw || 0), s = Math.sin(S.camYaw || 0), kx = (wx * c - wz * s) / L, kz = (wx * s + wz * c) / L; r = kx > 0.38; l = kx < -0.38; d = kz > 0.38; u = kz < -0.38; }
  key(KEY('up'), u); key(KEY('down'), d); key(KEY('left'), l); key(KEY('right'), r); key(KEY('sprint'), !!sprint && L > 1e-3); return L > 1e-3; }

// ---- the eyes ----
function clearLine(e, now, p){ let c = LOS.get(e); if(c && now - c.t < BOT.losEvery) return c.ok; if(B.losN <= 0) return c ? c.ok : false; B.losN--;
  const ok = !lineStop(p.pos.x, heightAt(p.pos.x, p.pos.z) + BOT.eye, p.pos.z, e.pos.x, chestY(e), e.pos.z, _s); if(c){ c.t = now; c.ok = ok; } else LOS.set(e, { t:now, ok }); return ok; }
// BAL 1 how far a man can be made out, as for a player at the screen: the fog's own reach (the distance it leaves a fifth of the contrast), at night a few tens of metres
//   unless his muzzle flashes (BOT.sight)
function sightOf(e, now, R){ const Q = BOT.sight, fog = scene.fog, night = S.tod === 'night'; let r = R * BOT.sightK;
  if(fog && fog.density > 0) r = Math.min(r, Q.fogK / fog.density); if(night) r = Math.min(r, now - (e.shotAt || -9) < Q.flashT ? Q.flash : Q.night); return r; }
function see(now, p, R){ VIS.length = 0; B.losN = BOT.losPerTick; let tx = 0, tz = 0, tw = 0, n = 0; const F2 = BOT.front.r * BOT.front.r;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!(e.hp > 0) || e.rise || e.gaveUp) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d2 = dx * dx + dz * dz;
    if(d2 < F2){ const w = 1 / (1 + Math.sqrt(d2) / 12); tx += e.pos.x * w; tz += e.pos.z * w; tw += w; }   // the minimap's dots: where the fight is
    const sr = sightOf(e, now, R); if(d2 > sr * sr || !scr(e.pos.x, chestY(e), e.pos.z)) continue; const q = POOL[n] || (POOL[n] = { e:null, d:0 }); q.e = e; q.d = Math.sqrt(d2); VIS.push(q); n++; }
  VIS.sort(byD); B.thr.on = tw > 0; if(tw){ B.thr.x = tx / tw; B.thr.z = tz / tw; }
  const H = typeof document !== 'undefined' && document.getElementById('hitDir'), hn = H ? H.children.length : 0;   // the red hit markers round the crosshair (fx/cinematic.js)
  if(hn && H.lastElementChild !== B.hitEl){ B.hitEl = H.lastElementChild; B.hitAt = now; B.stats.seenHits++; const a = parseFloat(B.hitEl.style.getPropertyValue('--a')) || 0; B.hitA = a; } }
const byD = (a, b) => a.d - b.d;
const bossOn = () => { for(const Q of FBOSS.list) if(Q.e && Q.e.hp > 0 && Q.st !== 'dead' && Q.st !== 'pending' && Q.st !== 'intro') return Q.e; return null; };
function pickTarget(now, p, R){ const G = duelMan() || bossOn(); let best = null, bs = 1e9;
  for(let i = 0, n = 0; i < VIS.length && n < 5; i++){ const q = VIS[i]; if(q.d > R * 1.08) break; n++; if(!clearLine(q.e, now, p)) continue;
    const s = q.d - (q.e === B.tgt ? 7 : 0) - (q.e === G ? 20 : 0) - (q.e.alert >= 2 ? 3 : 0); if(s < bs){ bs = s; best = q.e; } }
  if(best !== B.tgt){ B.tgt = best; B.firstShot = 0; if(best){ B.react = now + rnd(B.K.react) / 1000; B.err = gauss() * B.K.err; B.stats.eng++; B.coverWant = Math.random() < B.K.cover; } } }
// the view: a chase camera of a fixed heading — a shooter off the screen (a hit marker) or the radar's fight behind him and he turns the camera 45° at a time toward it
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
function camTurn(now, p){ if(now < B.camAt || B.tgt) return; let b = null;
  if(now - B.hitAt < 1.5){ const f = B.hitA - (S.camYaw || 0); b = Math.atan2(Math.sin(f), -Math.cos(f)); }   // (fx/cinematic.js hitMarker: --a = the shooter's bearing on the screen)
  else if(B.thr.on && Math.hypot(B.thr.x - p.pos.x, B.thr.z - p.pos.z) > 6) b = Math.atan2(B.thr.x - p.pos.x, B.thr.z - p.pos.z);
  if(b == null) return; const d = wrapA(b - Math.PI - (S.camYaw || 0)); if(Math.abs(d) < BOT.cam.off) return; B.camAt = now + BOT.cam.every; if(Math.random() > B.K.cam) return;
  tap(KEY(d > 0 ? 'rotR' : 'rotL')); B.stats.cams++; }   // (screen-up looks along camYaw + π: input/input.js rotStep, core/helpers.js getMoveDir)
function tgtGone(now){ const t = B.tgt; if(!t || t.hp > 0 && enemies.includes(t)) return; if(B.firstShot){ B.stats.kills++; if(B.stats.ttk.length < 600) B.stats.ttk.push(+(now - B.firstShot).toFixed(2)); } B.tgt = null; B.firstShot = 0; }

// ---- the goal: what the HUD asks of him (the sector's rail, its rings and markers, the radar) ----
function mk(i){ const M = SGOAL.marks[i]; return M && M.ring.visible ? M : null; }
function setG(k, x, z, r, o, y){ const g = B.goal; g.k = k; g.x = x; g.z = z; g.r = r; g.o = o || null; g.y = y == null ? heightAt(x, z) + 1.4 : y; return g; }
function goalOf(now, p, R){ if(now < B.goalAt) return B.goal; B.goalAt = now + 0.5; const c = SECT.on ? sectorCur() : null, ty = c ? c.type : '', gen = duelMan() || bossOn();
  if(SECT.on && SECT.state !== 'fight') return setG('idle', p.pos.x, p.pos.z, 99);
  if(gen && gen.hp > 0) return setG('hunt', gen.pos.x, gen.pos.z, R * 0.7, gen);
  const M = SIDEM.cur; if(M && M.state === 'go' && M.kind === 'truck') return setG('ring', M.x, M.z, M.K.r * BOT.ringIn);
  if(ty === 'sabotage' && OBJ && OBJ.alive) return setG('shoot', OBJ.x, OBJ.z, R * 0.6, OBJ.b);
  if(ty && ty !== 'hold' && ty !== 'sabotage' && ty !== 'boss'){ const g = SGOAL.g || {}, m0 = mk(0), m1 = mk(1), rr = m => m.ring.scale.x * 6;
    if(ty === 'rescue'){ const D = SGOAL.cell && SGOAL.cell.door, hx = m0 ? m0.ring.position.x : 0, hz = m0 ? m0.ring.position.z : 0;   // BAL 1 into the cell by its open end (a straight line ends at a container)
      if(g.ph === 'held' && m0 && D && Math.hypot(p.pos.x - hx, p.pos.z - hz) > 3 && Math.hypot(p.pos.x - D[0], p.pos.z - D[1]) > 2 && lineStop(p.pos.x, heightAt(p.pos.x, p.pos.z) + 1, p.pos.z, hx, heightAt(hx, hz) + 1, hz, _s)) return setG('go', D[0], D[1], 1.5);
      if(g.ph === 'held' && m0) return setG('go', m0.ring.position.x, m0.ring.position.z, Math.max(1.2, (g.Y && g.Y.reach || 2.6) - 0.5));   /* (inside his release reach — no closer: he kneels by a wall) */ if(m1) return setG('ring', m1.ring.position.x, m1.ring.position.z, rr(m1) * 0.5); }
    else if(ty === 'breach'){ if(m0) return setG('shoot', m0.ring.position.x, m0.ring.position.z, R * 0.55, null); if(m1) return setG('ring', m1.ring.position.x, m1.ring.position.z, rr(m1) * 0.6); }
    else if(ty === 'infiltrate'){ if(m0) return setG('go', m0.ring.position.x, m0.ring.position.z, 4.5); if(m1) return setG('ring', m1.ring.position.x, m1.ring.position.z, rr(m1) * 0.5); }
    else if(ty === 'pursuit' && m0) return setG('shoot', m0.ring.position.x, m0.ring.position.z, R * 0.5, null); }
  const fortGoal = ty === 'boss' || !SECT.on && S.wave >= WAVE.perStage && !WAVE.active && FORTS.length;
  if(fortGoal){ const f = mainFort(); if(f && !f.captured){ const gx = f.gx != null ? f.gx : f.x, gz = f.gz != null ? f.gz : f.z, atGate = Math.hypot(p.pos.x - gx, p.pos.z - gz) < 10 || B.goal.k === 'fort' && B.goal.o === f;
    if(!f.breached && f.gateShut && f.gate && f.gate.hp > 0) return setG('shoot', gx, gz, R * 0.55, f.gate);   // BAL 1 the citadel's gate shut: shoot it in (world/fortress.js breachFort)
    return atGate ? setG('fort', f.x, f.z, 6, f) : setG('go', gx, gz, 8); } }
  if(M && M.state === 'go') return setG('ring', M.x, M.z, Math.max(2, (M.K && M.K.r || 6) * BOT.ringIn));   // a side mission on offer: its ring
  if(B.thr.on) return setG('front', B.thr.x, B.thr.z, R * B.K.keep);
  let ne = null, nd = 1e9; for(const e of enemies){ if(!(e.hp > 0) || e.gaveUp) continue; const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if(d < nd){ nd = d; ne = e; } }
  if(ne) return setG('front', ne.pos.x, ne.pos.z, R * 0.8);
  return setG('idle', B.home.x, B.home.z, 6); }

// BAL 1 a goal inside a fort's walls while he is outside them: round by the gate — the spot outside it, then the gate itself (a straight line ends at the stone)
function viaGate(p, g){ for(const f of FORTS){ if(f.captured || f.gx == null) continue; const R = (f.Rin || f.R || 12) + 1.5, inG = Math.hypot(g.x - f.x, g.z - f.z) < R, inP = Math.hypot(p.pos.x - f.x, p.pos.z - f.z) < R;
    if(!inG || inP) continue; const ox = f.ox != null ? f.ox : f.gx, oz = f.oz != null ? f.oz : f.gz;
    if(Math.hypot(p.pos.x - ox, p.pos.z - oz) > 3 && Math.hypot(p.pos.x - f.gx, p.pos.z - f.gz) > 4.5) return _gw.set(ox, 0, oz); return _gw.set(f.gx + (f.x - f.gx) * 0.35, 0, f.gz + (f.z - f.gz) * 0.35); }
  return null; }
const _gw = new THREE.Vector3();
// ---- cards and screens a player clicks through ----
function menus(now){
  if(sectorForkShown()){ if(!B.cardAt) B.cardAt = now + BOT.cardWait; if(now < B.cardAt) return true; B.cardAt = 0;   // the fork: novice the easier route, good the harder, average the default
    const C = [...document.querySelectorAll('.sf-r')]; let k = 0; if(C.length > 1){ const st = C.map(el => ((el.querySelector('.sf-d i') || {}).textContent || '').length), def = C.findIndex(el => !!el.querySelector('.sf-d u'));
      const pol = BOT.fork[B.skill] || 'def'; k = pol === 'easy' ? (st[1] < st[0] ? 1 : 0) : pol === 'hard' ? (st[1] > st[0] ? 1 : 0) : Math.max(0, def); }
    tap(String(k + 1)); B.stats.forks.push(k); return true; }
  if(sectorStoryShown()){ if(!B.cardAt) B.cardAt = now + BOT.cardWait * 0.6; if(now >= B.cardAt){ B.cardAt = 0; tap('Escape'); B.stats.stories++; } return true; }
  if(S.mode === 'upgrade' || S.mode === 'relic'){ if(!B.cardAt) B.cardAt = now + BOT.cardWait; if(now >= B.cardAt){ B.cardAt = 0; const el = document.querySelector(S.mode === 'upgrade' ? '#upcards > *' : '#relicCards > *'); if(el){ el.click(); B.stats.cards++; } } return true; }
  B.cardAt = 0; return false; }

// ---- a skill from the wheel: pick it (the skill-next key), lay the cursor, press ----
function skillReady(id, now){ const sp = spellList().find(s => s.id === id); return sp && now >= spellReady(sp, S.player) ? sp : null; }
function cast(id, x, z, now){ if(B.act || !skillReady(id, now)) return false; B.act = { id, x, z, at:now + 0.25, until:now + 2.5 }; return true; }
function doAct(now){ const a = B.act; if(!a) return false; if(now > a.until){ B.act = null; return false; }
  if(spellNow().id !== a.id){ if(now >= (a.qAt || 0)){ tap(KEY('skillNext')); a.qAt = now + 0.12; } return true; }
  if(a.x != null){ const s = scr(a.x, heightAt(a.x, a.z) + 0.3, a.z); if(s) mouseTo(s.x, s.y); }
  if(now >= a.at){ tap(KEY('skill')); B.stats.skills[a.id] = (B.stats.skills[a.id] || 0) + 1; if(a.id === 'grenade') B.stats.nades++; B.act = null; } return true; }
function tactics(now, p){ const K = B.K, hpF = p.hp / p.maxHp;
  if(hpF < K.med && now >= B.medAt){ B.medAt = now + 1.5; if(cast('medkit', null, null, now)) return; }
  if(now >= B.nadeAt && VIS.length >= BOT.nade.min){ B.nadeAt = now + BOT.nade.every; if(Math.random() < K.nade){ let bx = 0, bz = 0, bn = 0;
    for(const q of VIS){ if(q.d < BOT.nade.d[0] || q.d > BOT.nade.d[1]) continue; let n = 0, sx = 0, sz = 0; for(const r of VIS){ const dd = Math.hypot(r.e.pos.x - q.e.pos.x, r.e.pos.z - q.e.pos.z); if(dd < BOT.nade.r){ n++; sx += r.e.pos.x; sz += r.e.pos.z; } } if(n > bn){ bn = n; bx = sx / n; bz = sz / n; } }
    if(bn >= BOT.nade.min && cast('grenade', bx, bz, now)) return; } }
  if(now >= B.skillAt && VIS.length >= BOT.skillMin){ B.skillAt = now + BOT.skillEvery; if(Math.random() < K.skill){ const id = Math.random() < 0.5 ? 'airstrike' : 'fireteam'; const t = VIS[Math.min(2, VIS.length - 1)].e; cast(id, t.pos.x, t.pos.z, now); } } }

// ---- the gun ----
function gunCare(now, p, R){ const inst = p.guns && p.guns[p.gunIdx]; if(!inst) return; const g = GUNS[inst.id], cap = g ? magCap(g) : 1, res = ammoReserve(inst);
  if(inst.ammo <= 0 && res <= 0 && p.guns.length > 1 && now >= B.gunAt){ B.gunAt = now + 1.2; tap(KEY('gunNext')); return; }   // dry: the next gun
  if(!B.tgt && !inst.rU && inst.ammo < cap * BOT.reloadAt && res > 0 && now >= B.reloadAt){ B.reloadAt = now + 3; if(Math.random() < B.K.reload) tap(KEY('reload')); } }
function dry(p){ for(const inst of p.guns || []) if(inst.ammo > 0 || ammoReserve(inst) > 0) return false; return true; }
function fireCd(p){ const inst = p.guns && p.guns[p.gunIdx], g = inst && GUNS[inst.id]; return g ? Math.max(0.06, g.fireCd * (p.fireMul || 1)) : 0.15; }
// lay the cursor on (x, y, z) the way a hand does: after the reaction, following at the skill's rate, off by the skill's error (drifting), then the bursts
function aimFire(now, dt, p, x, y, z, R, isMan){ const K = B.K, d = Math.hypot(x - p.pos.x, z - p.pos.z) || 1;
  B.err += (gauss() * K.err - B.err) * Math.min(1, dt * 1.5); const off = d * Math.tan(B.err * Math.PI / 180), ux = (z - p.pos.z) / d, uz = -(x - p.pos.x) / d;
  _t.set(x + ux * off, y + off * 0.25, z + uz * off); if(!B.aimSet){ B.aim.copy(_t); B.aimSet = true; }
  if(!isMan || now >= B.react) B.aim.lerp(_t, 1 - Math.exp(-K.track * dt));
  const s = scr(B.aim.x, B.aim.y, B.aim.z); if(s) mouseTo(s.x, s.y);
  const a1 = Math.atan2(B.aim.x - p.pos.x, B.aim.z - p.pos.z), a2 = Math.atan2(x - p.pos.x, z - p.pos.z), da = Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) * 180 / Math.PI;
  const may = (!isMan || now >= B.react) && d <= R * 1.02 && da < BOT.onTol + Math.abs(B.err) && s;
  if(!may){ trigger(false, now); return false; }
  if(B.down){ if(now >= B.burstEnd){ trigger(false, now); B.pauseEnd = now + rnd(K.pause); } }
  else if(now >= B.pauseEnd){ B.burstEnd = now + rnd(K.burst) * fireCd(p); trigger(true, now); }
  return true; }
function lookAhead(p, wx, wz){ const L = Math.hypot(wx, wz); if(L < 1e-3) return; B.aim.set(p.pos.x + wx / L * 10, heightAt(p.pos.x, p.pos.z) + 1.2, p.pos.z + wz / L * 10); B.aimSet = true;   // he looks where he goes: the cursor starts from there
  const s = scr(B.aim.x, B.aim.y, B.aim.z); if(s) mouseTo(s.x, s.y); }

// ---- one look at the battle, one decision (BOT.think a second) ----
function think(now, dt){ const p = S.player, st = B.stats;
  if(menus(now)){ letGo(); return; }
  if(S.mode !== 'playing' || !p){ letGo(); B.tgt = null; B.act = null; return; }
  st.playT += dt; if(!B.home.set || SECT.on && SECT.i !== B.sect && SECT.state === 'fight'){ B.home.x = p.pos.x; B.home.z = p.pos.z; B.home.set = true; B.sect = SECT.on ? SECT.i : -1; }
  const K = B.K, R = playerRange(), hpF = p.hp / p.maxHp; see(now, p, R); tgtGone(now); pickTarget(now, p, R); camTurn(now, p); const g = goalOf(now, p, R); gunCare(now, p, R);
  if(g.k === 'shoot' && SECT.on && (sectorCur() || {}).type === 'pursuit' && B.tgt && Math.hypot(B.tgt.pos.x - p.pos.x, B.tgt.pos.z - p.pos.z) > BOT.ride.chase + 3) B.tgt = null;   // (the trucks first)
  if(!doAct(now)) tactics(now, p);
  // where to go
  let mx = 0, mz = 0, sprint = false, mode = 'goal', crouch = false; const dG = Math.hypot(g.x - p.pos.x, g.z - p.pos.z), ring = g.k === 'ring', inRing = ring && dG < g.r / BOT.ringIn;
  if(ring && inRing) st.ringT += dt;
  if(hpF < K.retreat && (B.tgt || now - B.hitAt < 3) && !inRing){ if(!B.retreat){ st.retreats++; B.rFire = Math.random() < K.retreatFire; } B.retreat = now + 4; }
  if(B.retreat && (now > B.retreat && (hpF > K.retreat + 0.25 || !B.tgt && now - B.hitAt > 5))) B.retreat = 0;
  if(B.act){ mode = 'cast'; }
  else if(B.retreat){ mode = 'retreat'; const hx = core ? core.pos.x : B.home.x, hz = core ? core.pos.z : B.home.z; let ax = p.pos.x - (B.thr.on ? B.thr.x : p.pos.x), az = p.pos.z - (B.thr.on ? B.thr.z : p.pos.z); const al = Math.hypot(ax, az) || 1;
    const [rx, rz] = clampFieldXZ(p.pos.x + ax / al * 20 + (hx - p.pos.x) * 0.15, p.pos.z + az / al * 20 + (hz - p.pos.z) * 0.15, 4); mx = rx - p.pos.x; mz = rz - p.pos.z; sprint = !B.rFire;
    const h = pickups.find(u => u.landed && u.def && u.def.id === 'heal' && Math.hypot(u.x - p.pos.x, u.z - p.pos.z) < BOT.loot.r * 1.2); if(h){ mx = h.x - p.pos.x; mz = h.z - p.pos.z; } }
  else if(ring && !inRing){ mode = 'ring'; const w = viaGate(p, g); mx = (w ? w.x : g.x) - p.pos.x; mz = (w ? w.z : g.z) - p.pos.z; sprint = !B.tgt && dG > 15; }
  else if(B.tgt){ mode = 'fight'; const t = B.tgt, d = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
    if(B.coverWant && !CV.mounted && now >= B.coverAt){ B.coverAt = now + BOT.cover.every; const c = coverSpot(p.pos.x, p.pos.z, B.thr.on ? B.thr.x : t.pos.x, B.thr.on ? B.thr.z : t.pos.z, BOT.cover.r);
      B.cover = c && (!ring || Math.hypot(c.x - g.x, c.z - g.z) < g.r / BOT.ringIn) ? { x:c.x, z:c.z, at:false } : null; }
    const C = B.cover; if(C && B.coverWant){ const dc = Math.hypot(C.x - p.pos.x, C.z - p.pos.z); if(dc > 1.2){ mx = C.x - p.pos.x; mz = C.z - p.pos.z; mode = 'tocover'; }
      else { mode = 'cover'; if(!C.at){ C.at = true; st.covers++; B.peekUntil = now + K.expose; B.hideUntil = 0; }
        if(B.hideUntil){ crouch = true; if(now >= B.hideUntil){ B.hideUntil = 0; B.peekUntil = now + K.expose; } } else if(now >= B.peekUntil){ B.hideUntil = now + K.hide; const inst = p.guns[p.gunIdx]; if(inst && GUNS[inst.id] && inst.ammo < magCap(GUNS[inst.id]) * 0.6) tap(KEY('reload')); } } }
    else if(d > R * 0.95){ mx = t.pos.x - p.pos.x; mz = t.pos.z - p.pos.z; }
    else if(d < R * K.keep * 0.55){ mx = p.pos.x - t.pos.x; mz = p.pos.z - t.pos.z; }
    else if(K.strafe && Math.sin(now * 0.9) > 0.2){ mx = (t.pos.z - p.pos.z) * B.side; mz = -(t.pos.x - p.pos.x) * B.side; }
    if(ring && inRing && mode !== 'cover' && mode !== 'tocover' && dG > g.r * 0.6){ mx = g.x - p.pos.x; mz = g.z - p.pos.z; } }
  else { const L = B.loot && pickups.includes(B.loot) ? B.loot : null; B.loot = L;
    if(!L && now >= B.lootAt){ B.lootAt = now + 0.8; let bd = BOT.loot.r; for(const u of pickups){ if(!u.landed) continue; const d = Math.hypot(u.x - p.pos.x, u.z - p.pos.z); if(d < bd && Math.random() < K.loot && (!ring || Math.hypot(u.x - g.x, u.z - g.z) < g.r / BOT.ringIn)){ bd = d; B.loot = u; } } }   // (holding a ring: only what lies inside it)   // (a novice does not notice every drop)
    if(B.loot && !(ring && !inRing)){ mode = 'loot'; mx = B.loot.x - p.pos.x; mz = B.loot.z - p.pos.z; if(Math.hypot(mx, mz) < 2.2){ st.loot++; B.loot = null; } }
    else if(dry(p) && (LOGI.base || LOGI.drops.length)){ mode = 'ammo'; const a = LOGI.drops.length ? LOGI.drops[0] : LOGI.base; mx = a.x - p.pos.x; mz = a.z - p.pos.z; sprint = true; }
    else if(dG > g.r || g.k === 'shoot' && B.shotBlocked && dG > 4){ const w = viaGate(p, g); mx = (w ? w.x : g.x) - p.pos.x; mz = (w ? w.z : g.z) - p.pos.z; sprint = dG > 30 && g.k !== 'front'; if(w) mode = 'gate'; } }
  if(B.detour && now < B.detour.until){ mx = B.detour.x - p.pos.x; mz = B.detour.z - p.pos.z; mode = 'detour'; } else B.detour = null;
  if(B.unstuck > now){ mx = -B.sz * B.side; mz = B.sx * B.side; mode = 'unstuck'; }
  // BAL 1 no progress toward the goal for BOT.stuck.prog s while pushing for it (a wall that is not a block, a ridge, a slide along a container): a longer side-step; the third time a detour
  if(mode === 'goal' || mode === 'ring' || mode === 'gate'){ if(!B.pg || now - B.pg.t > 30){ B.pg = { t:now, d:dG, n:0 }; } else if(now - B.pg.t >= BOT.stuck.prog){ if(B.pg.d - dG < 1 && dG > g.r + 1){ B.pg.n++; B.stats.stuck++;
        if(B.pg.n >= 3){ const a = Math.atan2(g.x - p.pos.x, g.z - p.pos.z) + (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random() * 0.8), r = 15 + Math.random() * 10, q = clampFieldXZ(p.pos.x + Math.sin(a) * r, p.pos.z + Math.cos(a) * r, 4); B.detour = { x:q[0], z:q[1], until:now + 5 }; B.pg.n = 0; B.stats.detours = (B.stats.detours || 0) + 1; }
        else { const L = Math.hypot(mx, mz) || 1; B.sx = mx / L; B.sz = mz / L; B.side = -B.side || 1; B.unstuck = now + BOT.stuck.side * 2; } } B.pg.t = now; B.pg.d = dG; } }
  // the ride: on for a long way with nobody in sight, off for a fight, a ring, a cover
  const chase = SECT.on && (sectorCur() || {}).type === 'pursuit' && g.k === 'shoot';   // BAL 1 a convoy: after it on the ride, shooting from the saddle
  if(!CV.trans && now >= B.rideAt && now >= B.rideOff){ const far = Math.hypot(mx, mz) > 0 && (chase ? dG > BOT.ride.chase : dG > (g.k === 'shoot' ? BOT.ride.near * 1.3 : BOT.ride.far) && !B.tgt && !B.retreat && mode === 'goal'), near = !chase && (B.tgt || dG < BOT.ride.near || mode === 'ring' || mode === 'cover' || mode === 'tocover' || mode === 'loot');
    if(CV.mounted ? near && !far : far){ if(CV.mounted && Math.abs(CV.speed) > 3){ mx = mz = 0; } else { tap(KEY('crew')); B.rideAt = now + 3; B.rideTry++; st.rides++; B.wasM = CV.mounted; } }
    if(B.rideTry > 3){ B.rideOff = now + 20; B.rideTry = 0; } }
  if(B.wasM != null && CV.mounted !== B.wasM){ B.rideTry = 0; B.wasM = null; }
  if(chase && CV.mounted && dG > BOT.ride.chase * 1.6 && now >= (B.surgeAt || 0)){ B.surgeAt = now + BOT.ride.surge; tap(KEY('dash')); }   // BAL 1 the mount's burst of speed to close on the convoy
  // stance: down only to hide behind cover
  if(!CV.mounted && now >= B.stanceAt && (CV.want === 'crouch') !== crouch && CV.want !== 'prone'){ tap(KEY('camAuto')); B.stanceAt = now + 0.35; }
  B.mode = mode; B.dG = dG; B.wx = mx; B.wz = mz; if(mode !== 'unstuck') steer(p, mx, mz); mx = B.wx; mz = B.wz;
  const moving = push(mx, mz, sprint && !B.down); st.modes[mode] = +((st.modes[mode] || 0) + dt).toFixed(2);
  // stuck: pushing, going nowhere — sidestep, hop; the third time on one spot, climb
  const v = Math.hypot(p.vel.x, p.vel.z); if(moving && mode !== 'unstuck' && v < BOT.stuck.v){ B.stuckT += dt; if(B.stuckT > BOT.stuck.t){ B.stuckT = 0; const L = Math.hypot(mx, mz) || 1; B.sx = mx / L; B.sz = mz / L; B.side = Math.random() < 0.5 ? -1 : 1;
      B.unstuck = now + BOT.stuck.side; st.stuck++; if(now - B.unAt < 8) B.unN++; else B.unN = 1; B.unAt = now; if(B.unN >= 3 && !CV.mounted){ tap(KEY('climb')); st.climbs++; B.unN = 0; } else tap(KEY('dash')); } } else B.stuckT = 0;
  // the cursor and the trigger
  if(B.act) return;
  if(B.tgt && (mode !== 'retreat' || B.rFire)){ if(mode === 'cover' && B.hideUntil) trigger(false, now); else aimFire(now, dt, p, B.tgt.pos.x, chestY(B.tgt), B.tgt.pos.z, R, true); return; }
  if(g.k === 'shoot' && dG < R * 1.02){ if(now >= (B.shotLosAt || 0)){ B.shotLosAt = now + 0.5; B.shotBlocked = !!lineStop(p.pos.x, heightAt(p.pos.x, p.pos.z) + BOT.eye, p.pos.z, g.x, g.y, g.z, _s) && dG > 5; }
    if((dG > g.r + 2 || B.shotBlocked) && !moving){ const w = viaGate(p, g); push((w ? w.x : g.x) - p.pos.x, (w ? w.z : g.z) - p.pos.z, false); } aimFire(now, dt, p, g.x, g.y, g.z, R, false); return; }   // (a wall between: closer, round it)
  trigger(false, now); if(moving) lookAhead(p, mx, mz); }
function tick(){ const now = performance.now() / 1000, dt = Math.min(0.5, now - (B.t || now)); B.t = now; B.stats.t += dt;
  try{ think(now, dt); }catch(e){ B.stats.errs++; B.lastErr = String(e && e.message || e).slice(0, 200); } }

// ---- on / off (a probe: H.botStart({ skill:'average' }) … H.botState() … H.botStop()) ----
export function botStart(o){ o = o || {}; if(B.on) botStop(); B.skill = BOT.skill[o.skill] ? o.skill : 'average'; B.K = BOT.skill[B.skill]; B.stats = fresh(); B.on = true; B.t = 0; B.tgt = null; B.act = null;
  B.home.set = false; B.sect = -2; B.cover = null; B.loot = null; B.retreat = 0; B.aimSet = false; B.iv = setInterval(tick, 1000 / BOT.think); return B; }
export function botStop(){ if(!B.on) return; clearInterval(B.iv); B.on = false; letGo(); }
export function botState(){ const s = B.stats || fresh(), t = s.ttk.slice().sort((a, b) => a - b);
  return { on:B.on, skill:B.skill, playT:+s.playT.toFixed(1), bursts:s.bursts, eng:s.eng, kills:s.kills, ttkMed:t.length ? t[t.length >> 1] : null, ttkN:t.length, nades:s.nades, skills:s.skills, loot:s.loot,
    covers:s.covers, cams:s.cams, retreats:s.retreats, rides:s.rides, stuck:s.stuck, climbs:s.climbs, forks:s.forks, stories:s.stories, cards:s.cards, ringT:+s.ringT.toFixed(1), modes:s.modes, seenHits:s.seenHits, errs:s.errs, lastErr:B.lastErr }; }
// ?bot[=novice|average|good]: the bot plays every battle of this page (dev)
if(typeof location !== 'undefined' && /[?&]bot\b/.test(location.search)){ const m = location.search.match(/[?&]bot=(\w+)/); setTimeout(() => botStart({ skill:m ? m[1] : 'average' }), 0); }
