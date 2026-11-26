// data/mode-math.js — MODE 1–2 THE TWO EXTRA MODES' ARITHMETIC, AS DATA (pure — test.js calls it; the game side is campaign/mode-run.js, night-defence.js, daily.js):
//   the daily challenge's generator (a date → the same battle for everyone), the result's share text, the knob paths a modifier turns, the night's clock and both scores.
//   Nothing here reads the clock, the profile or Math.random: every function is its arguments' value only.

// ---- a small deterministic generator (mulberry32) and a string / number hash to seed it ----
export function modeRng(seed){ let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function modeHash(n, salt){ let h = (Math.imul((n | 0) ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul((salt | 0) + 0x7F4A7C15, 0xC2B2AE35)) >>> 0; h ^= h >>> 16; h = Math.imul(h, 0x45D9F3B) >>> 0; h ^= h >>> 15; return h >>> 0; }

// ---- the day: one number for everybody (the calendar day in UTC+tz) and its date ----
export function dailyDay(ms, tzH){ return Math.floor((ms + (tzH ?? 7) * 3600000) / 86400000); }
export function dailyDate(day){ const d = new Date(day * 86400000), p = n => String(n).padStart(2, '0'); return { y:d.getUTCFullYear(), m:d.getUTCMonth() + 1, d:d.getUTCDate(), iso:d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()), vi:p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() }; }
// the list in the order of cycle c (a seeded shuffle), its first never the last one of the cycle before: over one cycle every entry comes once, and no
//   two days in a row get the same one
function cycleOrder(list, c, salt){ const sh = k => { const r = modeRng(modeHash(k, salt)), a = list.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const a = sh(c); if(a.length > 2 && c > 0){ const prev = sh(c - 1); if(prev[prev.length - 1] === a[0]){ const t = a[0]; a[0] = a[1]; a[1] = t; } } return a; }   // (the swap never moves a cycle's last entry, so the cycle before needs no fixing of its own)
function pickOf(list, day, salt){ const n = list.length, c = Math.floor(day / n); return cycleOrder(list, Math.max(0, c), salt)[((day % n) + n) % n]; }
// THE DAY'S CHALLENGE (D = config DAILY): battlefield, hour, weather, battlefield size, enemy level, seed, the modifier and the gun — the same for the same day,
//   whoever asks and whenever. A modifier may fix the hour, the weather or the guns itself (D.mods[i].tod / .wx / .guns).
export function dailyChallenge(day, D){ day = Math.floor(day); const r = modeRng(modeHash(day, 17)), mod = pickOf(D.mods, day, 3), biome = pickOf(D.biomes, day, 5);
  const wxL = D.wx.concat(D.wxBiome[biome] ? [D.wxBiome[biome]] : []), tod = mod.tod || D.tod[Math.floor(r() * D.tod.length)], wx = mod.wx || wxL[Math.floor(r() * wxL.length)];
  const level = D.level[0] + Math.floor(r() * (D.level[1] - D.level[0] + 1)), space = D.space[Math.floor(r() * D.space.length)], gun = pickOf(D.guns, day, 11);
  return { day, date:dailyDate(day).iso, biome, tod, wx, space, level, seed:(modeHash(day, 29) % 2000000000) + 1, mod:mod.id, guns:mod.guns ? mod.guns.slice() : [gun].concat(D.kit) }; }
// the scored number of a daily attempt: the battle's own score, the win, the accuracy (0…1), and the seconds a win took under the par
export function dailyScore(o, D){ const K = D.score, acc = Math.max(0, Math.min(1, o.acc || 0));
  return Math.max(0, Math.round((o.base || 0) + (o.won ? K.win + Math.max(0, K.par - (o.secs || 0)) * K.perSec : 0) + acc * K.acc)); }
export function modeClockTx(secs){ secs = Math.max(0, Math.round(secs || 0)); return Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'); }
const fill = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => o[k] != null ? o[k] : '');
// the block of text COPY RESULT puts on the clipboard (T = D.say.share's lines): no link, no account — the nickname is the only thing of the player's in it
export function modeShare(o, T){ const L = [fill(T.head, o), fill(T.where, o), fill(T.rule, o), fill(o.won ? T.won : T.lost, o), fill(T.stats, o)]; if(o.practice) L.push(T.practice); if(o.name) L.push(fill(T.by, o)); return L.join('\n'); }
// the history with this day's entry in it: one entry a day, the newest first, nothing older than `keep` days before the newest (h = [{ d, s, … }])
export function dailyKeep(h, entry, keep){ const out = (Array.isArray(h) ? h : []).filter(e => e && Number.isFinite(e.d) && e.d !== entry.d); out.push(entry); out.sort((a, b) => b.d - a.d);
  const top = out[0].d; return out.filter(e => e.d > top - keep).slice(0, keep); }

// ---- a modifier's knobs: 'DIRECTOR.lull.drop.hp' → [[object, key]] (a last segment '*' = every numeric entry of that object / array) ----
export function knobRefs(root, path){ const seg = String(path).split('.'); let o = root; for(let i = 0; i < seg.length - 1; i++){ if(o == null || typeof o !== 'object') return []; o = o[seg[i]]; }
  if(o == null || typeof o !== 'object') return []; const k = seg[seg.length - 1];
  if(k === '*') return Object.keys(o).filter(q => typeof o[q] === 'number').map(q => [o, q]); return typeof o[k] === 'number' ? [[o, k]] : []; }
export function knobApply(v, op, x){ return op === '*' ? v * x : op === '+' ? v + x : x; }

// ---- night defence: the clock on the HUD and the night's score ----
// u = 0…1 of the night → 'HH:MM' between h0 (dusk) and h1 (dawn, the next day), to the nearest step minutes
export function ndClock(u, h0, h1, step){ const span = ((h1 - h0) % 24 + 24) % 24 || 24, st = step || 5, m = Math.round(Math.max(0, Math.min(1, u)) * span * 60 / st) * st, t = (h0 * 60 + m) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
// o: base (the battle's own score: every enemy down) · survived (assaults seen off) · core (0…1 of the base's health left) · acc (0…1) · won · general (he fell) · night (1, 2, …)
export function ndScore(o, K){ const acc = Math.max(0, Math.min(1, o.acc || 0)), core = Math.max(0, Math.min(1, o.core || 0));
  return Math.max(0, Math.round(((o.base || 0) + (o.survived || 0) * K.assault + (o.won ? K.dawn + core * K.core : 0) + acc * K.acc + (o.general ? K.general : 0)) * (1 + ((o.night || 1) - 1) * K.nightK))); }
// the assault's queue as the waves take it (campaign/waves.js): n men (an RPG with chance rpg), `squads` squads slipped in, `heli` troop helicopters last
export function ndQueue(A, k, rand){ const q = [], n = Math.max(1, Math.round(A.n * k)); for(let i = 0; i < n; i++) q.push(rand() < (A.rpg || 0) ? 'rpg' : 'rifle');
  const ns = Math.max(0, Math.round((A.squads || 0) * k)); for(let i = 0; i < ns; i++) q.splice(Math.min(q.length, 1 + Math.floor(rand() * q.length)), 0, 'squad');
  for(let i = 0; i < (A.heli || 0); i++) q.push('heliTroop'); return q; }
