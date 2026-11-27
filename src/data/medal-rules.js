// data/medal-rules.js — MEDAL 1 THE CAREER'S RULES, AS DATA (pure — test.js calls it): the rank an amount of experience is, the insignia a rank wears, the guns
//   a rank opens, a battle's ledger (cleaned, capped), the experience it earned line by line, the medals it earned tier by tier, its best moments, the co-op
//   kill credit the host sends with a death, and what a finished battle adds to the career (config.js MEDALS; the battle side is game/medals.js, the screens
//   ui/medals-ui.js). PROFILE.career = { v, xp, battles, won, kills, time, best:{ longest, multi }, m:{ <medal id>:[best tier, times] }, keep:[gun ids] }.
//   medalCareerClean takes ANYTHING (an old save, a cloud copy, garbage) and gives back a valid record; it never throws.
import { MEDALS } from '../../config.js';
import { GUNS } from './guns.js';

const M = MEDALS, int = (v, lo, hi) => { v = Math.floor(+v); return v === v ? Math.max(lo, Math.min(hi, v)) : lo; };
export const MEDAL_TIER_VI = ['', 'ĐỒNG', 'BẠC', 'VÀNG'];
export const MEDAL_STATS = Object.keys(M.statCap);
// ---- the rank ----
export function carNeed(r){ const [a, b, c] = M.need; return a + b * r + c * r * r; }
export function carTop(){ return M.ranks.length - 1; }
export function carRankName(r){ return M.ranks[int(r, 0, carTop())]; }
// experience → { r: the rank, into: experience past its start, need: from it to the next (0 at the top), at: the experience the rank starts at }
export function carRank(xp){ xp = Math.max(0, +xp || 0); let r = 0, at = 0; while(r < carTop() && xp >= at + carNeed(r)){ at += carNeed(r); r++; }
  return { r, at, into:xp - at, need:r < carTop() ? carNeed(r) : 0 }; }
// what a rank wears on its shoulder board: binh (enlisted: chevrons) · si (NCO: bars) · uy / ta (one / two long stripes + stars) · tuong (a gold board, stars)
export function carInsignia(r){ r = int(r, 0, carTop()); if(r < 2) return { kind:'binh', n:r + 1 }; if(r < 5) return { kind:'si', n:r - 1 };
  if(r < 9) return { kind:'uy', n:r - 4 }; if(r < 13) return { kind:'ta', n:r - 8 }; return { kind:'tuong', n:r - 12 }; }
// ---- guns by rank ----
export function gunRankReq(id){ return M.unlock[id] ?? 0; }
export function gunOpen(id, c){ return !M.on || carRank(c ? c.xp : 0).r >= gunRankReq(id) || !!(c && Array.isArray(c.keep) && c.keep.includes(id)); }
// the guns a step from rank a to rank b opens (a < b)
export function gunsOpenedBy(a, b){ return Object.keys(M.unlock).filter(id => M.unlock[id] > a && M.unlock[id] <= b); }
// ---- the career record ----
export function medalCareerNew(){ return { v:M.v, xp:0, battles:0, won:0, kills:0, time:0, best:{ longest:0, multi:0 }, m:{}, keep:[] }; }
export function medalCareerClean(c, legacyGun){ const o = medalCareerNew(); let fresh = !c || typeof c !== 'object';
  if(!fresh){ o.xp = int(c.xp, 0, 1e8); o.battles = int(c.battles, 0, 1e6); o.won = int(c.won, 0, 1e6); o.kills = int(c.kills, 0, 1e8); o.time = int(c.time, 0, 1e9);
    const b = c.best && typeof c.best === 'object' ? c.best : {}; o.best.longest = int(b.longest, 0, M.statCap.longest); o.best.multi = int(b.multi, 0, M.statCap.multiBest);
    if(c.m && typeof c.m === 'object') for(const d of M.list){ const v = c.m[d.id]; if(!Array.isArray(v)) continue; const t = int(v[0], 0, 3), n = int(v[1], 0, 1e5); if(t > 0 && d.tiers[t - 1] != null) o.m[d.id] = [t, Math.max(1, n)]; }
    if(Array.isArray(c.keep)) for(const id of c.keep) if(typeof id === 'string' && id in M.unlock && !o.keep.includes(id) && o.keep.length < 16) o.keep.push(id); }
  if(fresh && typeof legacyGun === 'string' && gunRankReq(legacyGun) > 0 && GUNS[legacyGun]) o.keep.push(legacyGun);   // (the gun he already carried in stays his)
  return o; }
// ---- a battle's ledger ----
export function medalLedger(){ const L = {}; for(const k of MEDAL_STATS) L[k] = 0; L.longGun = ''; L.multiT = 0; return L; }
// every count clamped to its bound; the kills he is credited with never more than the enemies that fell; a kill by kind never more than his kills
export function medalLedgerClean(L){ const C = M.statCap; for(const k of MEDAL_STATS) L[k] = int(L[k], 0, C[k]);
  L.kills = Math.min(L.kills, L.total); L.team = Math.min(L.team, L.total - L.kills);
  const by = L.inf + L.veh + L.air; if(by > L.kills){ const k = L.kills / by; L.inf = Math.floor(L.inf * k); L.veh = Math.floor(L.veh * k); L.air = Math.floor(L.air * k); }
  for(const k of ['elite', 'long', 'stealth', 'blade', 'nade', 'trample', 'boss', 'general', 'nemesis']) L[k] = Math.min(L[k], L.kills);
  L.multiBest = Math.min(L.multiBest, L.kills); L.streakBest = Math.min(L.streakBest, L.kills); L.nemesis = Math.min(L.nemesis, L.general + L.boss);
  if(typeof L.longGun !== 'string' || !GUNS[L.longGun]) L.longGun = ''; return L; }
// ---- the medals ----
export function medalDef(id){ return M.list.find(d => d.id === id) || null; }
export function medalTierOf(d, v){ let t = 0; for(let i = 0; i < 3; i++) if(d.tiers[i] != null && v >= d.tiers[i]) t = i + 1; return t; }
export function medalsOf(L){ const out = []; for(const d of M.list){ const t = medalTierOf(d, L[d.stat] || 0); if(t) out.push({ id:d.id, tier:t }); } return out; }
// ---- the experience: line by line (the end report shows them), the total capped ----
export function battleXp(L, outcome){ const X = M.xp, lines = [], add = (k, vi, n, each) => { const xp = Math.round(n * each); if(n > 0 && xp > 0) lines.push({ k, vi, n, xp }); };
  add('inf', 'Hạ bộ binh', L.inf, X.inf); add('veh', 'Phá xe', L.veh, X.veh); add('air', 'Bắn rơi', L.air, X.air); add('elite', 'Tinh nhuệ', L.elite, X.elite);
  add('general', 'Hạ tướng', L.general, X.general); add('boss', 'Hạ trùm thành', L.boss, X.boss); add('nemesis', 'Kẻ thù truyền kiếp', L.nemesis, X.nemesis);
  add('long', 'Bắn xa', L.long, X.long); add('stealth', 'Hạ gục êm', L.stealth, X.stealth); add('blade', 'Đao', L.blade, X.blade); add('nade', 'Lựu đạn', L.nade, X.nade);
  add('trample', 'Xung phong', L.trample, X.trample); add('multi', 'Đa sát', L.multiX, X.multi); add('team', 'Tổ của anh hạ', L.team, X.team);
  add('save', 'Cứu đồng đội', L.save, X.save); add('side', 'Nhiệm vụ phụ', L.side, X.side); add('escape', 'Thoát chết', L.escape, X.escape);
  if(outcome === 'won' || outcome === 'final') add('won', 'Thắng màn', 1, X.won); if(outcome === 'final') add('final', 'Hoàn thành chiến dịch', 1, X.final);
  { let n = 0, xp = 0; for(const m of medalsOf(L)){ n++; xp += X.tier[m.tier]; } if(xp > 0) lines.push({ k:'medal', vi:'Huân chương', n, xp }); }
  const raw = lines.reduce((s, l) => s + l.xp, 0), total = Math.min(raw, X.cap); return { lines, raw, total, capped:raw > X.cap }; }
// ---- the battle's best moments (the report's headline first) ----
export function medalMoments(L){ const out = [], gun = id => GUNS[id] ? ' · ' + GUNS[id].name : '';
  if(L.nemesis > 0) out.push({ k:'nemesis', score:1000, ic:'alert', tx:'Hạ viên tướng từng thoát khỏi tay anh' });
  if(L.boss > 0) out.push({ k:'boss', score:900 + L.boss, ic:'bunker', tx:L.boss > 1 ? 'Hạ ' + L.boss + ' trùm giữ thành' : 'Hạ trùm giữ thành' });
  if(L.general > 0) out.push({ k:'general', score:800 + L.general, ic:'star', tx:'Hạ tướng địch' });
  if(L.multiBest >= 3) out.push({ k:'multi', score:100 * L.multiBest, ic:'burst', tx:'Hạ liền ' + L.multiBest + ' địch' });
  if(L.longest >= 30) out.push({ k:'long', score:3 * L.longest, ic:'crosshair', tx:'Phát bắn xa nhất ' + L.longest + ' m' + gun(L.longGun) });
  if(L.streakBest >= 10) out.push({ k:'streak', score:15 * L.streakBest, ic:'shield', tx:L.streakBest + ' lần hạ địch liền không trúng đạn' });
  if(L.stealth >= 2) out.push({ k:'stealth', score:40 * L.stealth, ic:'eyeOpen', tx:L.stealth + ' lần hạ gục không ai hay' });
  if(L.save > 0) out.push({ k:'save', score:120 * L.save, ic:'heart', tx:L.save > 1 ? 'Cứu ' + L.save + ' lần' : 'Cứu đồng đội' });
  return out.sort((a, b) => b.score - a.score).slice(0, 3); }
// ---- co-op: the host's credit for a kill by the guest, carried in the DEATH event's p (16 bits) ----
//   bit 15: the guest's kill · bits 0–2: how (0 gun, 1 blade, 2 grenade, 3 charge, 4 other) · 3 unseen · 4 elite · 5 fort boss · 6 general · 7–14 metres / 2
export const MEDAL_HOW = ['gun', 'blade', 'nade', 'trample', 'other'];
export function medalCreditWord(o){ if(!o) return 0; const h = Math.max(0, MEDAL_HOW.indexOf(o.how)), d = int((o.d || 0) / 2, 0, 255);
  return 0x8000 | (h & 7) | (o.quiet ? 8 : 0) | (o.elite ? 16 : 0) | (o.boss ? 32 : 0) | (o.general ? 64 : 0) | (d << 7); }
export function medalCreditRead(p){ p = int(p, 0, 65535); if(!(p & 0x8000)) return null;
  return { how:MEDAL_HOW[Math.min(4, p & 7)], quiet:!!(p & 8), elite:!!(p & 16), boss:!!(p & 32), general:!!(p & 64), d:((p >> 7) & 255) * 2 }; }
// ---- the battle done: what it adds to the career (c is changed). → { xp, before, after, medals:[{ id, tier, best, up }], guns:[ids opened] } ----
export function medalCareerAdd(c, L, outcome, t){ medalLedgerClean(L); const X = battleXp(L, outcome), b = carRank(c.xp), was = {}; for(const k in c.m) was[k] = c.m[k][0];
  c.xp = Math.min(1e8, c.xp + X.total); c.battles++; if(outcome === 'won' || outcome === 'final') c.won++; c.kills += L.kills; c.time += int(t, 0, M.statCap.t);
  c.best.longest = Math.max(c.best.longest, L.longest); c.best.multi = Math.max(c.best.multi, L.multiBest);
  const medals = medalsOf(L).map(m => { const o = c.m[m.id] || [0, 0]; o[0] = Math.max(o[0], m.tier); o[1] = Math.min(1e5, o[1] + 1); c.m[m.id] = o; return { id:m.id, tier:m.tier, best:o[0], up:m.tier > (was[m.id] || 0) }; });
  const a = carRank(c.xp); return { xp:X.total, lines:X.lines, capped:X.capped, before:b, after:a, medals, guns:gunsOpenedBy(b.r, a.r) }; }
