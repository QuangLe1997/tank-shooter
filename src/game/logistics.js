// game/logistics.js — SUPPLY 1 AMMUNITION IS A SUPPLY LINE (soldier mode): the reserve of rounds behind every magazine, what a reload takes from it, the HUD's readout and its warnings.
//   Every gun of his used to reload for ever. Now each ammunition CLASS he carries (data/guns.js ammoKind: rifle rounds, pistol rounds, a belt, buckshot, 12.7, rockets, 40 mm
//   grenades, fuel, cells, blades) has a reserve counted in rounds (LOGI.res); guns of one class share it. A reload tops the magazine up out of the reserve — what was left in the
//   magazine stays in it, nothing is thrown away (combat/guns.js updateReload → ammoLoad) — and with nothing in reserve a gun cannot be reloaded: it is dry until rounds come
//   (startReload → ammoDry). The weapon chip shows magazine / reserve and says ÍT ĐẠN, BĂNG CUỐI, HẾT ĐẠN (ui/briefing.js updateGunHUD → ammoHud).
//   He sets out with LOGISTICS.start magazines a class (× the difficulty), is brought back up to that by a new stage and a new life, and never holds more than capK × it.
//   Never a dead end: the reserve of his issue weapon (the first gun of his rack) fills back by itself up to a magazine (LOGISTICS.regen), a gun picked up brings magazines
//   of its own, the THÙNG ĐẠN loot brings a share of every class. p.infiniteAmmo (the ĐẠN VÔ HẠN buff, the pose studio) spends nothing, as before.
// SUPPLY 2 RESUPPLY HE PLAYS FOR: a fallen enemy leaves his pouch (more often the lower he runs) — walk over it; an AMMUNITION POINT stands at our base (crates and a ring
//   at the rally point) and every captured depot / fortress is a forward one with a limited stock — stand there and the magazines come one by one; when his reserves run
//   low and the director allows, the HQ drops a crate by PARACHUTE a few dozen metres off on the side away from the enemy, names distance and bearing on the radio — and
//   the enemy's idle men go and look at the canopy too; a SQUAD-MATE close by hands a magazine over when the gun in his hands is on its last rounds. All of it is on the
//   minimap (radarLogi). And it WEIGHS: guns and rounds over a comfortable load take a little off his sprint and make the combat roll come back later (p.loadK, read by
//   game/cavalry.js and game/soldier-moves.js) — a chip shows how much; firing it off lightens him.
import * as THREE from 'three';
import { LOGISTICS } from '../../config.js';
import { BUFF_COL, BUFF_ICON, CV, DEPOTS, FORTS, FT, GIFTS, GUNS, PROFILE, RALLY_PT, S, ammoKind, blocksNear, clampFieldXZ, core, dirSupply, dropPowerup, enemies, floatText, heightAt, holoRing, inBlock, inField, magCap, radio, scene, sfx, spawnGift, startReload, suspectEnemy, updateGunHUD } from '../hub.js';

const L = LOGISTICS, NOW = () => performance.now() / 1000, R2 = a => a[0] + Math.random() * (a[1] - a[0]);
const fmt = (s, o) => s.replace(/\{(\w)\}/g, (m, k) => o[k] ?? '');
// res: rounds in reserve by class, for the rack `guns` (a new run makes a new rack → a fresh load) · warn: what the chip says of the gun in his hands ('' · low · last · dry)
//   base: the ammunition point { src, x, z, g } · fwd: the stock left at each captured depot / fortress · at: the point he stands in · drops: parachutes not opened yet { x, z, u }
export const LOGI = { guns:null, res:{}, acc:0, key:'', lives:0, tickAt:0, prev:0, n:0, warn:'', warnGun:null, dryAt:-9, kg:0, base:null, fwd:new Map(), at:null, full:false, stockAt:0, drops:[], dropAt:0, mateAt:0,
  stats:{ loaded:0, regen:0, crate:0, given:0, dry:0, pouch:0, depot:0, called:0, drops:0, mate:0 } };
const _hud = { t:'', w:'' }, RANK = { '':0, low:1, last:2, dry:3 }, _at = { x:0, y:0, z:0 }, _near = [], BASE = { stock:Infinity, said:false };
const diffK = () => L.diff[PROFILE.difficulty] || 1, stageKey = () => (S.loop || 0) + ':' + (S.stage || 1);
const startOf = (c, g) => Math.round((L.start[c] || 0) * g.mag * diffK());
// the largest magazine he carries in a class (0: he carries no gun of it)
function bigMag(p, c){ let m = 0; for(let i = 0; i < p.guns.length; i++){ const g = GUNS[p.guns[i].id]; if(ammoKind(g) === c && g.mag > m) m = g.mag; } return m; }
// a class's start load and the most its reserve holds, in rounds, for the guns he carries now
export function ammoStart(p, c){ return Math.round((L.start[c] || 0) * bigMag(p, c) * diffK()); }
function capOf(p, c){ return Math.round(ammoStart(p, c) * L.capK); }
// the reserves of this rack (a new run's rack starts from the start loads)
function ensure(p){ if(LOGI.guns === p.guns) return LOGI.res; LOGI.guns = p.guns; const r = LOGI.res = {};
  for(let i = 0; i < p.guns.length; i++){ const g = GUNS[p.guns[i].id], c = ammoKind(g); r[c] = Math.max(r[c] || 0, startOf(c, g)); }
  LOGI.acc = 0; LOGI.warn = ''; LOGI.warnGun = null; LOGI.key = stageKey(); LOGI.lives = p.lives; LOGI.fwd.clear(); LOGI.drops.length = 0; LOGI.dropAt = NOW() + L.drop.wait; LOGI.mateAt = 0; return r; }
// a new stage, a new life: every class back up to its start load (what he had over it he keeps)
function refill(p){ const r = ensure(p); for(const c in r) r[c] = Math.max(r[c], ammoStart(p, c)); updateGunHUD(); }
// rounds in reserve behind this gun
export function ammoReserve(inst){ const p = S.player; if(!p || !inst || !GUNS[inst.id]) return 0; return ensure(p)[ammoKind(GUNS[inst.id])] || 0; }
// combat/guns.js updateReload: the reload is done — the magazine topped up out of the reserve (what was left in it stays); → the rounds now in it
export function ammoLoad(inst){ const p = S.player, g = GUNS[inst.id], cap = magCap(g), have = Math.max(0, inst.ammo); if(p.infiniteAmmo) return Math.max(have, cap);
  const r = ensure(p), c = ammoKind(g), n = Math.max(0, Math.min(cap - have, r[c] || 0)); r[c] = (r[c] || 0) - n; LOGI.stats.loaded += n; return have + n; }
// combat/guns.js startReload: nothing in reserve — the gun in his hands says so (a dry click, the tip), no reload
export function ammoDry(inst, now){ const p = S.player; if(!p || inst !== p.guns[p.gunIdx] || now - LOGI.dryAt < L.warn.say) return; LOGI.dryAt = now; LOGI.stats.dry++;
  floatText(L.say.dryTip, '#ff7a5a', p.pos, 16); sfx('click', p.pos, 0.6); }
// rounds into a class's reserve (never over its cap; a class he carries no gun of takes none) → what went in. An empty gun in his hands of that class is reloaded at once
export function ammoGain(c, n){ const p = S.player; if(!p || !(n > 0)) return 0; const r = ensure(p); if(!(c in r)) return 0;
  const add = Math.max(0, Math.min(Math.round(n), capOf(p, c) - r[c])); if(!add) return 0; r[c] += add;
  const eq = p.guns[p.gunIdx]; if(eq && !eq.rU && eq.ammo <= 0 && !p.infiniteAmmo && ammoKind(GUNS[eq.id]) === c) startReload(NOW(), eq);
  updateGunHUD(); return add; }
// combat/soldier-fire.js trooperGive: a gun into his rack brings magazines of its own (a new class starts from them)
export function ammoOnGive(id, fresh){ const p = S.player, g = GUNS[id]; if(!p || !g) return; const r = ensure(p), c = ammoKind(g); if(!(c in r)) r[c] = 0;
  LOGI.stats.given += ammoGain(c, (fresh ? L.give.fresh : L.give.again) * g.mag); }
// the THÙNG ĐẠN loot (loot/soldier-arms.js AMMO): `share` of every class's start load, a magazine at least → rounds in all
export function ammoCrate(share){ const p = S.player; if(!p) return 0; const r = ensure(p), k = share ?? L.crate.share; let n = 0;
  for(const c in r) n += ammoGain(c, Math.max(bigMag(p, c), ammoStart(p, c) * k)); LOGI.stats.crate += n; return n; }
// what the chip says of a gun: '' · low (a magazine or less behind it) · last (nothing behind it) · dry (nothing in it either)
function warnOf(inst, g){ const r = ammoReserve(inst); return r > L.warn.low * magCap(g) ? '' : r > 0 ? 'low' : inst.ammo > 0 || inst.rU ? 'last' : 'dry'; }
// ui/briefing.js updateGunHUD: the chip's text "magazine/reserve" and its warning (one shared record, read at once)
export function ammoHud(inst, g){ const w = warnOf(inst, g); _hud.w = w; _hud.t = w === 'dry' ? L.say.dry : inst.ammo + '/' + ammoReserve(inst) + (w ? ' · ' + L.say[w] : ''); return _hud; }
// the way out: the issue weapon's reserve fills back by itself up to regen.mags magazines
function regen(p, r, dt){ const g = GUNS[p.guns[0].id], c = ammoKind(g), floor = L.regen.mags * g.mag; if(!(r[c] < floor)){ LOGI.acc = 0; return; }
  LOGI.acc += dt * g.mag / L.regen.magT; if(LOGI.acc < 1) return; const n = Math.floor(LOGI.acc); LOGI.acc -= n; LOGI.stats.regen += ammoGain(c, Math.min(n, floor - r[c])); }
// the gun in his hands got worse off: said once over his head (and the chip redrawn)
function warn(p){ const eq = p.guns[p.gunIdx], w = warnOf(eq, GUNS[eq.id]); if(w === LOGI.warn && eq === LOGI.warnGun) return;
  if(eq === LOGI.warnGun && RANK[w] > RANK[LOGI.warn]){ floatText(L.say[w], w === 'low' ? '#ffd86a' : '#ff7a5a', p.pos, 16); if(w !== 'low') sfx('beep', p.pos, 0.6); }
  LOGI.warn = w; LOGI.warnGun = eq; updateGunHUD(); }
// once a frame in battle (game/loop.js); the work is done LOGISTICS.tick s apart
export function updateLogistics(dt, now){ const p = S.player; if(!p || !p.cav || !p.guns || !p.guns.length || now < LOGI.tickAt) return;
  const sdt = Math.min(1, now - LOGI.prev); LOGI.prev = now; LOGI.tickAt = now + L.tick; const r = ensure(p), key = stageKey();
  if(key !== LOGI.key || p.lives < LOGI.lives){ if(key !== LOGI.key){ LOGI.fwd.clear(); LOGI.dropAt = now + L.drop.wait; } LOGI.key = key; refill(p); } LOGI.lives = p.lives;
  weigh(p, r); if((LOGI.n++ & 3) === 0) baseAt();
  for(let i = LOGI.drops.length - 1; i >= 0; i--){ const u = LOGI.drops[i].u; if(u.st === 'open' || !GIFTS.includes(u) || now - LOGI.drops[i].t > L.drop.stale) LOGI.drops.splice(i, 1); }   // (opened, cleared, or left lying so long that the HQ may send another)
  if(S.awaitingUpgrade || p.infiniteAmmo) return;
  regen(p, r, sdt); warn(p); restock(p, now); mateHand(p, now); if(wantDrop(p, r, now)) callDrop(p, now); }
// the text of a gain, for the modules that hand rounds over ("+30 ĐẠN 7.62")
export function ammoSay(n, c){ return fmt(L.say.got, { n, c:L.say.cls[c] || '' }); }

// ---- SUPPLY 2 what a fallen enemy soldier carried: a pouch on the ground, picked up like any loot (no toast: a line over his head) ----
const POUCH = {};
function pouchDef(c){ return POUCH[c] || (POUCH[c] = { id:'pouch_' + c, svg:'mag', color:0xd8c070, vi:L.say.pouch, ds:L.say.pouchDs, cat:'ammo', tier:0, quiet:true,
  apply(p){ const n = ammoGain(c, c === 'rocket' ? 1 : R2(L.pouch.n) * diffK()); LOGI.stats.pouch += n; floatText(n ? ammoSay(n, c) : L.say.full, n ? '#ffd86a' : '#9aa3ad', p.pos, 15); } }); }
// loot/soldier-arms.js armsDrop: this man has fallen — his pouch, maybe (sure: always — the man a knife took never fired a round)
export function ammoPouch(e, sure){ const p = S.player; if(!p || !e.def || !e.def.inf) return; const r = ensure(p), P = L.pouch; let c = null;
  if(e.def.rpg && 'rocket' in r && Math.random() < P.rocket) c = 'rocket'; else for(let i = 0; i < P.fits.length && !c; i++) if(P.fits[i] in r) c = P.fits[i];
  if(!c || !sure && Math.random() >= (r[c] < P.lowMags * bigMag(p, c) ? P.pLow : P.p)) return; dropPowerup(e.pos, 0, pouchDef(c)); }

// ---- the ammunition point at our base (a few olive crates and a ring), and the captured places that serve as forward points ----
let _geo = null, _mat = null;
function depotMesh(x, z){ _geo = _geo || new THREE.BoxGeometry(1, 1, 1); _mat = _mat || [new THREE.MeshStandardMaterial({ color:0x4d5634, roughness:0.85 }), new THREE.MeshStandardMaterial({ color:0x23241c, roughness:0.9 })];
  const g = new THREE.Group(), box = (w, h, d, ox, oy, oz, ry) => { const b = new THREE.Mesh(_geo, _mat[0]); b.scale.set(w, h, d); b.position.set(ox, oy + h / 2, oz); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; g.add(b);
    const s = new THREE.Mesh(_geo, _mat[1]); s.scale.set(w * 0.14, h + 0.012, d + 0.014); s.position.copy(b.position); s.rotation.y = ry; g.add(s); };   // (a crate and the webbing strap round it)
  box(0.95, 0.4, 0.5, 0, 0, 0, 0.12); box(0.95, 0.4, 0.5, 0.06, 0.4, 0.02, -0.07); box(0.7, 0.34, 0.44, 1.05, 0, 0.2, 0.7); box(0.5, 0.26, 0.34, -0.85, 0, -0.25, -0.4);
  const ring = holoRing(L.depot.r, { kind:'ally' }); ring.position.y = 0.07; g.add(ring); g.userData.ring = ring; g.position.set(x, heightAt(x, z), z); scene.add(g); return g; }
function dropBase(){ const b = LOGI.base; if(!b) return; scene.remove(b.g); const r = b.g.userData.ring; r.material.dispose(); r.geometry.dispose(); LOGI.base = null; }
// the base's point follows the field: built beside the rally point (else the core) the stage has, rebuilt when the field is
function baseAt(){ const rally = !!RALLY_PT.g, src = RALLY_PT.g || (core && core.mesh) || null, b = LOGI.base; if(b && b.src === src) return; dropBase(); if(!src) return;
  const D = L.depot, o = rally ? D.off : D.coreOff, x = (rally ? RALLY_PT.x : core.pos.x) + o[0], z = (rally ? RALLY_PT.z : core.pos.z) + o[1]; LOGI.base = { src, x, z, g:depotMesh(x, z) }; }
function fwdOf(o){ let s = LOGI.fwd.get(o); if(!s){ s = { stock:L.depot.fwdStock, said:false }; LOGI.fwd.set(o, s); } return s; }
// the point he stands in: the base's (no end to it), a captured depot's or fortress's (its stock) — or null
function pointAt(p){ const D = L.depot, b = LOGI.base, x = p.pos.x, z = p.pos.z; if(b && (x - b.x) ** 2 + (z - b.z) ** 2 < D.r * D.r) return BASE;
  for(let i = 0; i < DEPOTS.length; i++){ const d = DEPOTS[i]; if(d.state === 'ours' && (x - d.x) ** 2 + (z - d.z) ** 2 < D.fwdR * D.fwdR) return fwdOf(d); }
  for(let i = 0; i < FORTS.length; i++){ const f = FORTS[i], r = Math.max(D.fwdR, (f.R || 0) * D.fortK); if(f.captured && (x - f.x) ** 2 + (z - f.z) ** 2 < r * r) return fwdOf(f); }
  return null; }
// standing in a point: a magazine every depot.every s — the gun in his hands first, then the emptiest class
function restock(p, now){ const src = pointAt(p); if(src !== LOGI.at){ LOGI.at = src; LOGI.full = false; } if(!src || now < LOGI.stockAt) return; LOGI.stockAt = now + L.depot.every;
  const r = ensure(p); let c = ammoKind(GUNS[p.guns[p.gunIdx].id]), worst = 1;
  if(!(r[c] < capOf(p, c))){ c = null; for(const k in r){ const cap = capOf(p, k), f = cap ? r[k] / cap : 1; if(f < worst){ worst = f; c = k; } } }
  if(!c){ if(!LOGI.full){ LOGI.full = true; floatText(L.say.full, '#9be04a', p.pos, 15); } return; }
  if(src.stock <= 0){ if(!src.said){ src.said = true; floatText(L.say.depotOut, '#ffb35a', p.pos, 15); } return; }
  const n = ammoGain(c, bigMag(p, c)); if(!n) return; src.stock--; LOGI.stats.depot += n; floatText(ammoSay(n, c), '#9be04a', p.pos, 14); sfx('magIn', p.pos, 0.5); }

// ---- the director's parachute ----
// how full his reserves are against the start loads, on average over the classes he carries (0…1)
export function ammoShare(){ const p = S.player; if(!p || !p.guns) return 1; const r = ensure(p); let s = 0, n = 0; for(const c in r){ const st = ammoStart(p, c); if(!st) continue; s += Math.min(1, r[c] / st); n++; } return n ? s / n : 1; }
function wantDrop(p, r, now){ if(now < LOGI.dropAt || LOGI.drops.length) return false; const g = GUNS[p.guns[0].id]; return ammoShare() < L.drop.low || (r[ammoKind(g)] || 0) < g.mag; }
function blocked(x, z){ const B = blocksNear(x, z, 4, _near); for(let i = 0; i < B.length; i++) if(inBlock(B[i], x, z, 1.4)) return true; return false; }   // (not onto a house, a wall, a rock)
// a crate under a canopy (loot/gift-crate.js), d[0]…d[1] m off on the side away from the enemy, where the fewest of them stand; the idle men near it go and look
function callDrop(p, now){ const D = L.drop, px = p.pos.x, pz = p.pos.z; let ex = 0, ez = 0, bx = 0, bz = 0, bn = 1e9;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i], dx = e.pos.x - px, dz = e.pos.z - pz; if(dx * dx + dz * dz < D.sideR * D.sideR){ ex += dx; ez += dz; } }
  const a0 = ex || ez ? Math.atan2(-ex, -ez) : (p.facing || 0) + Math.PI;
  for(let k = 0; k < D.tries; k++){ const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.55, d = R2(D.d), q = clampFieldXZ(px + Math.sin(a) * d, pz + Math.cos(a) * d, 5), x = q[0], z = q[1];
    if(!inField(x, z, 4) || (x - px) ** 2 + (z - pz) ** 2 < (D.d[0] * 0.7) ** 2 || blocked(x, z)) continue; let f = 0;
    for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if((e.pos.x - x) ** 2 + (e.pos.z - z) ** 2 < D.foeR * D.foeR) f++; }
    if(f < bn){ bn = f; bx = x; bz = z; if(f <= D.foes) break; } }
  if(bn === 1e9){ LOGI.dropAt = now + 5; return false; } if(!dirSupply(now)){ LOGI.dropAt = now + 2; return false; }
  const u = spawnGift({ x:bx, z:bz }, () => { ammoCrate(D.share); LOGI.stats.drops++; if(S.player) floatText(L.say.dropGot, '#ffd86a', S.player.pos, 18); });
  LOGI.drops.push({ x:bx, z:bz, u, t:now }); LOGI.dropAt = now + D.cd; LOGI.stats.called++;
  const dx = bx - px, dz = bz - pz, T = L.say.drop; radio(fmt(T[(Math.random() * T.length) | 0], { d:Math.round(Math.hypot(dx, dz) / 5) * 5, b:L.say.bearings[(Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8] }));   // (north is up the minimap: −z)
  for(let i = 0, m = 0; i < enemies.length && m < D.noticeN; i++){ const e = enemies[i]; if(!e.def.inf || e.guard || e.alert >= 2 || (e.pos.x - bx) ** 2 + (e.pos.z - bz) ** 2 > D.noticeR * D.noticeR) continue; suspectEnemy(e, now, bx, bz); m++; }
  return true; }

// ---- a squad-mate's magazine: nothing behind the gun in his hands, next to nothing in it, a man of his own close by ----
function mateHand(p, now){ const M = L.mate, eq = p.guns[p.gunIdx], g = GUNS[eq.id], c = ammoKind(g), rocket = c === 'rocket';
  if(now < LOGI.mateAt || eq.rU || ammoReserve(eq) > 0 || eq.ammo > magCap(g) * M.magK || !rocket && !M.cls.includes(c)) return; const wk = S.stage + ':' + S.wave; let best = null, bd = M.r * M.r;
  for(let i = 0; i < FT.length; i++){ const a = FT[i], r = a.mate; if(!r || a.dead || !(a.hp > 0) || rocket && r.role !== 'at') continue; if(r.magWave !== wk){ r.magWave = wk; r.mags = M.stock; } if(r.mags <= 0) continue;
    const d2 = (a.pos.x - p.pos.x) ** 2 + (a.pos.z - p.pos.z) ** 2; if(d2 < bd){ bd = d2; best = a; } }
  if(!best) return; const n = ammoGain(c, rocket ? 1 : Math.min(g.mag, M.rounds)); if(!n) return; best.mate.mags--; LOGI.mateAt = now + M.cd; LOGI.stats.mate += n;
  _at.x = best.pos.x; _at.z = best.pos.z; _at.y = heightAt(best.pos.x, best.pos.z) + 2.3;
  floatText(fmt(rocket ? L.say.mateRocket : L.say.mate[(Math.random() * L.say.mate.length) | 0], { n:String(best.mate.name).toUpperCase() }), '#cfe8a0', _at, 15); sfx('magIn', p.pos, 0.6); }

// ---- the weight of it: guns and rounds over a comfortable load slow his sprint and his roll a little (p.loadK: 1 … 1 − weight.max) ----
function weigh(p, r){ const W = L.weight; let kg = 0; for(let i = 0; i < p.guns.length; i++){ const gi = p.guns[i], c = ammoKind(GUNS[gi.id]); kg += (W.gun[c] || 0) + Math.max(0, gi.ammo) * (W.round[c] || 0); }
  for(const c in r) kg += r[c] * (W.round[c] || 0); LOGI.kg = kg; p.loadK = 1 - Math.max(0, Math.min(1, (kg - W.comfort) / W.span)) * W.max; }
// loot/powerups.js updateBuffHUD: the module's chips among the buffs' — the load, once it costs him something on foot
export function hudChips(items){ const p = S.player; if(!p || !p.cav || CV.mounted) return; if(!BUFF_ICON.load){ BUFF_ICON.load = 'pack'; BUFF_COL.load = '#ffb35a'; }
  const k = 1 - (p.loadK || 1); if(k >= L.weight.show) items.push(['load', fmt(L.say.load, { n:Math.round(k * 100) }), '']); }

// ---- the minimap (ui/radar.js): a small crate at every ammunition point that still has stock, a crate under a canopy where a drop waits ----
function crateMark(c, x, y){ c.strokeRect(x - 3, y - 2.5, 6, 5); c.beginPath(); c.moveTo(x, y - 2.5); c.lineTo(x, y + 2.5); c.stroke(); }
export function radarLogi(c, toX, toY){ const b = LOGI.base; c.lineWidth = 1.3; c.strokeStyle = '#9be04a'; if(b) crateMark(c, toX(b.x), toY(b.z));
  for(let i = 0; i < DEPOTS.length; i++){ const d = DEPOTS[i], s = LOGI.fwd.get(d); if(d.state === 'ours' && !(s && s.stock <= 0)) crateMark(c, toX(d.x) + 8, toY(d.z) - 8); }
  for(let i = 0; i < FORTS.length; i++){ const f = FORTS[i], s = LOGI.fwd.get(f); if(f.captured && !(s && s.stock <= 0)) crateMark(c, toX(f.x + (f.R || 0)), toY(f.z - (f.R || 0))); }
  if(!LOGI.drops.length) return; c.strokeStyle = '#ffd86a'; c.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 170);
  for(let i = 0; i < LOGI.drops.length; i++){ const x = toX(LOGI.drops[i].x), y = toY(LOGI.drops[i].z); c.strokeRect(x - 2.5, y - 0.5, 5, 4); c.beginPath(); c.arc(x, y - 2.5, 4.5, Math.PI, 0); c.stroke(); }
  c.globalAlpha = 1; }
// a new battle, the menu (game/flow.js): the base's crates off the field, nothing waiting
export function clearLogistics(){ dropBase(); LOGI.fwd.clear(); LOGI.drops.length = 0; LOGI.at = null; }
