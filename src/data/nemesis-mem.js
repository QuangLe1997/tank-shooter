// data/nemesis-mem.js — NEMESIS 1 WHAT A GENERAL REMEMBERS, AS DATA (pure — test.js calls it): the record he keeps of the player, its sanitiser, the rules
//   (config.js NEMESIS; the game side is campaign/nemesis.js). PROFILE.nemesis = { v, g:{ <general id>:record } }; a record:
//     met / kills / fled / falls — times he met the player, killed him, got away, fell · out — 1: he is at large (he escaped and has not been met since)
//     loop — the campaign loop of his last escape (one a loop) · rank — his rank-up level · how / gun — how the player last put him down (blast · far · close;
//     the weapon in hand) · scar — the mark that left · traits — what he learned, oldest first (the last is the one he fights by) · last — how the last
//     meeting ended (met · killed: he killed the player · fled · fell).
//   nemClean takes ANYTHING (an old save, a cloud copy, garbage) and gives back a valid memory: unknown generals and fields dropped, numbers clamped to
//   NEMESIS.cap, strings checked against what the rules know, a scar or a trait only on a man who has a rank. It never throws.
import { NEMESIS } from '../../config.js';
import { BOSS_DEFS, BOSS_NEW } from './bosses.js';

const N = NEMESIS;
export const NEM_IDS = BOSS_DEFS.concat(BOSS_NEW).map(b => b.id);
export const NEM_HOW = ['blast', 'far', 'close'], NEM_LAST = ['met', 'killed', 'fled', 'fell'];
const SCARS = () => Object.keys(N.scar).filter(k => N.scar[k] && typeof N.scar[k] === 'object'), ADAPTS = () => Object.keys(N.adapt);
const int = (v, lo, hi) => typeof v === 'number' && v >= lo ? Math.min(hi, Math.floor(v)) : lo;   // (NaN, a string, an object: lo)
const one = (v, list) => typeof v === 'string' && list.includes(v) ? v : '';
export function nemBlankRec(){ return { met:0, kills:0, fled:0, falls:0, out:0, loop:-1, rank:0, how:'', gun:'', scar:'', traits:[], last:'' }; }
export function nemBlank(){ return { v:N.v, g:{} }; }
function cleanRec(r){ const C = N.cap, o = nemBlankRec(), ad = ADAPTS();
  o.met = int(r.met, 0, C.met); o.kills = int(r.kills, 0, C.kills); o.fled = int(r.fled, 0, C.fled); o.falls = int(r.falls, 0, C.met);
  o.out = (r.out === 1 || r.out === true) && o.fled > 0 ? 1 : 0; o.loop = int(r.loop, -1, 9999); o.rank = Math.min(int(r.rank, 0, C.rank), o.fled * N.rank.perFled);
  o.how = one(r.how, NEM_HOW); o.last = one(r.last, NEM_LAST); o.gun = typeof r.gun === 'string' ? r.gun.replace(/[^\w-]/g, '').slice(0, 24) : '';
  if(o.rank > 0){ o.scar = one(r.scar, SCARS());
    if(Array.isArray(r.traits)) for(let i = 0; i < r.traits.length && i < 16 && o.traits.length < C.traits; i++){ const t = r.traits[i]; if(typeof t === 'string' && ad.includes(t) && !o.traits.includes(t)) o.traits.push(t); } }
  return o; }
export function nemClean(raw){ const out = nemBlank();
  try{ const g = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.g : null; if(!g || typeof g !== 'object' || Array.isArray(g)) return out;
    for(const id of NEM_IDS){ if(!Object.prototype.hasOwnProperty.call(g, id)) continue; const r = g[id]; if(r && typeof r === 'object' && !Array.isArray(r)) out.g[id] = cleanRec(r); } }
  catch(e){ return nemBlank(); }
  return out; }

// ---- the rules ----
// how he went down: a blast, else by the distance the shot came from
export function nemHow(blast, dist){ return blast ? 'blast' : dist >= N.how.splitR ? 'far' : 'close'; }
// may he get away this time? (the roll comes after) c: { stage, stages, loop, diff, custom }
export function nemCanEscape(rec, c){ return !!(N.on && rec && c && !c.custom && c.diff !== N.escape.never && c.stage < c.stages && rec.loop !== c.loop); }
// how he greets the player (asked BEFORE the meeting is counted): first · fled (he got away last time) · killed (he killed him last time) · again
export function nemGreet(rec){ return !rec || !rec.met ? 'first' : rec.out || rec.last === 'fled' ? 'fled' : rec.last === 'killed' ? 'killed' : 'again'; }
export function nemAfterMeet(rec){ rec.met = Math.min(N.cap.met, rec.met + 1); rec.last = 'met'; return rec; }
export function nemAfterKill(rec){ rec.kills = Math.min(N.cap.kills, rec.kills + 1); rec.last = 'killed'; return rec; }
// he got away: a rank, the scar of what was done to him and the lesson he takes from it (the newest last; the oldest forgotten past the cap)
export function nemAfterEscape(rec, how, gun, loop){ const H = N.how[how] || N.how.far, C = N.cap, t = rec.traits, i = t.indexOf(H.adapt);
  rec.fled = Math.min(C.fled, rec.fled + 1); rec.out = 1; rec.loop = loop | 0; rec.rank = Math.min(C.rank, rec.rank + N.rank.perFled); rec.how = one(how, NEM_HOW); rec.gun = String(gun || '').replace(/[^\w-]/g, '').slice(0, 24);
  rec.scar = H.scar; if(i >= 0) t.splice(i, 1); t.push(H.adapt); while(t.length > C.traits) t.shift(); rec.last = 'fled'; return rec; }
// he fell: the debt is closed — the name's next bearer starts without the rank, the scar or the lessons (the counts stay with the name)
export function nemAfterFall(rec, how, gun){ rec.falls = Math.min(N.cap.met, rec.falls + 1); rec.out = 0; rec.rank = 0; rec.scar = ''; rec.traits.length = 0;
  rec.how = one(how, NEM_HOW); rec.gun = String(gun || '').replace(/[^\w-]/g, '').slice(0, 24); rec.last = 'fell'; return rec; }
export function nemAdapt(rec){ return rec && rec.traits.length ? rec.traits[rec.traits.length - 1] : ''; }
// TROOPER.general as this man fights by it: his rank (health, quicker moves, a shorter warning — never under telMin) and what his lesson asks of his guards.
//   No rank and no lesson: the base object itself.
export function nemTuneOf(base, rec){ const R = N.rank, r = rec ? rec.rank : 0, ad = nemAdapt(rec), A = N.adapt[ad]; if(!r && !A) return base; const k = Math.pow(R.cd, r);
  return { ...base, hpK:base.hpK * (1 + R.hp * r), fan:{ ...base.fan, cd:base.fan.cd * k, tel:Math.max(Math.min(R.telMin, base.fan.tel), base.fan.tel * Math.pow(R.tel, r)) }, nade:{ ...base.nade, cd:base.nade.cd * k },
    guards:base.guards + (ad === 'wall' ? A.n : 0), spreadK:ad === 'mobile' ? A.spread : 1, restK:Math.pow(R.rest, r), groupK:Math.pow(R.spread, r) }; }

// ---- the words ----
export function nemTitle(name){ return String(name || '').toLocaleLowerCase('vi').replace(/(^|[\s(.-])(\S)/g, (m, a, c) => a + c.toLocaleUpperCase('vi')); }   // "BÒ THÉP" → "Bò Thép"
export function nemNick(raw){ const s = typeof raw === 'string' ? raw.replace(/[{}<>]/g, '').trim().slice(0, 16) : ''; return s || N.say.anon; }
// {nick} {n} {k} {f} {r} {name} filled in; any other {key} is left for the story's own names (campaign/story.js storyText: {cmd} …)
export function nemFill(s, v){ return String(s || '').replace(/\{(nick|n|k|f|r|name)\}/g, (m, k) => v && v[k] != null ? String(v[k]) : m); }
// the pool of a line: the general's own ownP of the time (roll: 0…1), else everybody's
export function nemPool(kind, id, roll){ const Y = N.say, own = Y.by[id] && Y.by[id][kind]; return own && own.length && roll < Y.ownP ? own : Y[kind] || []; }
// beside his name on the boss bar: a star a rank, a mark a time he killed the player (capped)
export function nemBadge(rec){ if(!rec) return ''; const m = Math.min(N.cap.marks, rec.kills); return (rec.rank ? ' ' + '★'.repeat(rec.rank) : '') + (m ? ' ' + '☠'.repeat(m) : ''); }
