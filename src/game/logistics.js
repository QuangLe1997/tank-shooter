// game/logistics.js — SUPPLY 1 AMMUNITION IS A SUPPLY LINE (soldier mode): the reserve of rounds behind every magazine, what a reload takes from it, the HUD's readout and its warnings.
//   Every gun of his used to reload for ever. Now each ammunition CLASS he carries (data/guns.js ammoKind: rifle rounds, pistol rounds, a belt, buckshot, 12.7, rockets, 40 mm
//   grenades, fuel, cells, blades) has a reserve counted in rounds (LOGI.res); guns of one class share it. A reload tops the magazine up out of the reserve — what was left in the
//   magazine stays in it, nothing is thrown away (combat/guns.js updateReload → ammoLoad) — and with nothing in reserve a gun cannot be reloaded: it is dry until rounds come
//   (startReload → ammoDry). The weapon chip shows magazine / reserve and says ÍT ĐẠN, BĂNG CUỐI, HẾT ĐẠN (ui/briefing.js updateGunHUD → ammoHud).
//   He sets out with LOGISTICS.start magazines a class (× the difficulty), is brought back up to that by a new stage and a new life, and never holds more than capK × it.
//   Never a dead end: the reserve of his issue weapon (the first gun of his rack) fills back by itself up to a magazine (LOGISTICS.regen), a gun picked up brings magazines
//   of its own, the THÙNG ĐẠN loot brings a share of every class. p.infiniteAmmo (the ĐẠN VÔ HẠN buff, the pose studio) spends nothing, as before.
import { LOGISTICS } from '../../config.js';
import { GUNS, PROFILE, S, ammoKind, floatText, magCap, sfx, startReload, updateGunHUD } from '../hub.js';

const L = LOGISTICS, NOW = () => performance.now() / 1000;
const fmt = (s, o) => s.replace(/\{(\w)\}/g, (m, k) => o[k] ?? '');
// res: rounds in reserve by class, for the rack `guns` (a new run makes a new rack → a fresh load) · warn: what the chip says of the gun in his hands ('' · low · last · dry)
export const LOGI = { guns:null, res:{}, acc:0, key:'', lives:0, tickAt:0, prev:0, warn:'', warnGun:null, dryAt:-9, stats:{ loaded:0, regen:0, crate:0, given:0, dry:0 } };
const _hud = { t:'', w:'' }, RANK = { '':0, low:1, last:2, dry:3 };
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
  LOGI.acc = 0; LOGI.warn = ''; LOGI.warnGun = null; LOGI.key = stageKey(); LOGI.lives = p.lives; return r; }
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
  if(key !== LOGI.key || p.lives < LOGI.lives){ LOGI.key = key; refill(p); } LOGI.lives = p.lives;
  if(S.awaitingUpgrade || p.infiniteAmmo) return;
  regen(p, r, sdt); warn(p); }
// the text of a gain, for the modules that hand rounds over ("+30 ĐẠN 7.62")
export function ammoSay(n, c){ return fmt(L.say.got, { n, c:L.say.cls[c] || '' }); }
