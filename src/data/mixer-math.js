// data/mixer-math.js — MIX 1 THE BATTLE MIXER'S ARITHMETIC (pure: config + data only — tools/spec.mjs and test.js run it in node; the game side is campaign/mixer.js).
//   normalizeSpec(spec, opts) → { spec, plan, clamped:[{ key, from, to, why }], warnings:[{ id, vi }] }: the spec's defaults filled in, its macros resolved to channel
//   params (config.js MIXER.params), each param and then each config leaf clamped, the cross-rules and the device budget applied; the plan lists every leaf the battle
//   turns ({ path, from, to, read 'build' | 'go', by }) — nothing outside it reaches the game. scoreBattle(spec, opts) → the seven scores 0–100 (minutes in minutes)
//   with their reasons and warnings, from the same plan. Both are a function of their arguments only: the same spec and seed give the same plan.
//   SCORES are first-principles estimates around today's battle (level 3, every param 50) — to be calibrated against measured battles (mixer-mapping.md §6).
import * as CFG from '../../config.js';
import { ENEMY_DEFS } from './enemies.js';
import { modeHash, knobApply } from './mode-math.js';

const { MIXER, BALANCE, SECTOR, SECROUTE } = CFG;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x, r3 = x => Math.round(x * 1000) / 1000;
// the curve [at 0, at 50, at 100] read at x (piecewise linear) and back
export function mixCurve(c, x){ x = clamp(x, 0, 100); return x <= 50 ? c[0] + (c[1] - c[0]) * x / 50 : c[1] + (c[2] - c[1]) * (x - 50) / 50; }
export function mixCurveInv(c, v){ const lo = (c[0] - c[1]), hi = (c[2] - c[1]), d = v - c[1];
  if(d === 0) return 50; if(hi !== 0 && Math.sign(d) === Math.sign(hi)) return clamp(50 + 50 * d / hi, 0, 100); if(lo !== 0 && Math.sign(d) === Math.sign(lo)) return clamp(50 - 50 * d / lo, 0, 100); return 50; }
// a param's default from the macros: 50 + Σ w·(macro − 50)
export function mixDrive(def, macro){ let v = 50; for(const k in def.drive || {}) v += def.drive[k] * ((macro[k] ?? 50) - 50); return clamp(v, 0, 100); }
// a stable hash of any JSON value (the seed a spec without one gets)
export function mixHash(o){ const s = stable(o); let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function stable(o){ if(Array.isArray(o)) return '[' + o.map(stable).join(',') + ']'; if(o && typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'; return JSON.stringify(o ?? null); }

// ---- the roots a knob path starts from (node: the pristine config; the game passes its live WAVE) ----
export function mixRoots(extra){ return { ...CFG, ENEMY_DEFS, WAVE:{ perStage:BALANCE.wave.perStageCount }, ...(extra || {}) }; }
// 'A.b.c' → [container, key] (null: no such number); '{d}' and a last '*' are expanded by mixLeaves
export function mixRef(roots, path){ const seg = String(path).split('.'); let o = roots; for(let i = 0; i < seg.length - 1; i++){ if(o == null || typeof o !== 'object') return null; o = o[seg[i]]; }
  const k = seg[seg.length - 1]; return o != null && typeof o === 'object' && typeof o[k] === 'number' ? [o, k] : null; }
export function mixLeaves(roots, path, M){ M = M || MIXER; const out = [], ps = String(path).includes('{d}') ? M.diffs.map(d => path.replace('{d}', d)) : [path];
  for(const p of ps){ if(p.endsWith('.*')){ const base = p.slice(0, -2), seg = base.split('.'); let o = roots; for(const s of seg){ if(o == null || typeof o !== 'object'){ o = null; break; } o = o[s]; }
      if(o && typeof o === 'object') for(const k of Object.keys(o)) if(typeof o[k] === 'number') out.push(base + '.' + k); }
    else if(mixRef(roots, p)) out.push(p); }
  return out; }
function boundOf(M, path){ if(M.bounds[path]) return M.bounds[path]; const seg = path.split('.');
  for(const k in M.bounds){ const b = k.split('.'); if(b.length === seg.length && b.every((x, i) => x === '*' || x === seg[i])) return M.bounds[k]; } return null; }

// ---- sector tokens ----
const DEF_PLACE = { hold:'outskirts', sabotage:'bridge', boss:'hq', rescue:'village', breach:'gate', infiltrate:'village', pursuit:'outskirts' };
export function mixToken(t){ if(t === '*') return { tok:'*', type:'*' }; let o = t;
  if(typeof t === 'string'){ const a = t.trim().split(':'); o = SECTOR.types[a[0]] ? { type:a[0], obj:a[1] } : { place:a[0], type:a[1], obj:a[2] }; }
  if(!o || typeof o !== 'object' || !SECTOR.types[o.type]) return null; const place = SECTOR.places[o.place] ? o.place : DEF_PLACE[o.type] || 'village';
  return { tok:place + ':' + o.type + (o.obj ? ':' + o.obj : ''), type:o.type, place }; }
function deckTypes(land){ const d = SECROUTE.decks[land] || SECROUTE.decks._ || []; return d.map(x => mixToken(x)).filter(Boolean).map(c => c.type); }

const GROUPS = () => [...new Set(Object.keys(MIXER.params).map(id => id.split('.')[0]))];
const TOP = ['v', 'id', 'name', 'seed', 'macro', 'world', 'structure', 'advanced', 'coop', 'note', 'threat', 'general', 'storyline', 'conq'];   // MIX 3 threat · general · storyline · conq: a scenario's own fields (the conquest's forts)

// ================= NORMALIZE =================
export function normalizeSpec(spec, opts){ opts = opts || {}; const M = opts.M || MIXER, roots = opts.roots || mixRoots(), device = opts.device === 'phone' ? 'phone' : 'desktop', B = M.budget[device];
  const clamped = [], warnings = [], C = (key, from, to, why) => { clamped.push({ key, from, to, why }); }, W = (id, vi) => { if(!warnings.some(w => w.id === id && w.vi === vi)) warnings.push({ id, vi }); };
  let s; try{ s = JSON.parse(JSON.stringify(spec && typeof spec === 'object' ? spec : {})); }catch(e){ s = {}; W('spec', 'Spec không đọc được — dùng mặc định'); }
  if(!spec || typeof spec !== 'object') W('spec', 'Spec trống — dùng mặc định');
  if(s.v !== 1){ if(s.v != null) C('v', s.v, 1, 'chỉ có phiên bản 1'); s.v = 1; }
  const groups = GROUPS(); for(const k of Object.keys(s)) if(!TOP.includes(k) && !groups.includes(k)){ W('key', 'Bỏ khoá lạ: ' + k); delete s[k]; }
  // macros
  const macro = {}; s.macro = s.macro && typeof s.macro === 'object' ? s.macro : {};
  for(const k of Object.keys(s.macro)) if(!M.macros[k]){ W('macro', 'Bỏ fader lạ: ' + k); delete s.macro[k]; }
  for(const k in M.macros){ const x = s.macro[k]; if(x == null){ macro[k] = 50; continue; } const n = Number(x); if(!Number.isFinite(n)){ C('macro.' + k, x, 50, 'không phải số'); macro[k] = 50; continue; }
    const c = clamp(n, 0, 100); if(c !== n) C('macro.' + k, n, c, 'fader 0–100'); macro[k] = c; }
  s.macro = { ...macro };
  // world
  const w = s.world && typeof s.world === 'object' ? s.world : {}, D = M.defaults; let land = w.land;
  if(typeof land === 'number') land = M.lands[land]; if(typeof land === 'string') land = land.toUpperCase();
  if(!M.lands.includes(land)){ C('world.land', w.land ?? null, M.lands[0], 'thiếu hoặc sai chiến trường (bắt buộc)'); land = M.lands[0]; }
  const pick = (k, list, d) => { const x = w[k]; if(x == null) return d; if(list.includes(x)) return x; C('world.' + k, x, d, 'giá trị không có'); return d; };
  const tod = pick('tod', M.tods, D.tod), wx = pick('wx', M.wxs, D.wx), space0 = pick('space', M.spaces, D.space), diff = pick('diff', M.diffs, opts.diff && M.diffs.includes(opts.diff) ? opts.diff : D.diff);
  let level = w.level == null ? D.level : Math.round(Number(w.level)); if(!Number.isFinite(level)) level = D.level; { const l2 = clamp(level, M.levels[0], M.levels[1]); if(l2 !== level || (w.level != null && +w.level !== level)) C('world.level', w.level, l2, 'cấp 1–30, số nguyên'); level = l2; }
  let space = space0; const coop = !!s.coop; if(coop && space !== 'wide'){ C('world.space', space, 'wide', 'co-op chỉ có bản đồ rộng'); space = 'wide'; }
  s.world = { land, tod, wx, space, level, diff };
  // seed
  let seed = Number(s.seed); if(!Number.isFinite(seed) || s.seed == null){ seed = Number.isFinite(opts.seed) ? opts.seed >>> 0 : mixHash({ ...s, seed:null }); } else seed = Math.abs(Math.floor(seed)) % (M.seedMax + 1);
  s.seed = seed;
  // ---- params ----
  const vals = {};
  for(const id in M.params){ const def = M.params[id], [g, k] = [id.split('.')[0], id.slice(id.indexOf('.') + 1)], grp = s[g] && typeof s[g] === 'object' ? s[g] : null, raw = grp ? grp[k] : undefined, dv = mixDrive(def, macro);
    let v, kk, src = 'macro';
    if(raw != null){ const n = Number(raw); if(!Number.isFinite(n)){ C(id, raw, null, 'không phải số — lấy theo fader'); } else { src = 'spec';
        if(def.in === 'dial'){ v = clamp(n, 0, 100); if(v !== n) C(id, n, v, 'núm 0–100'); }
        else { v = clamp(n, def.lo, def.hi); if(def.int) v = Math.round(v); if(v !== n) C(id, n, v, 'biên cứng ' + def.lo + '–' + def.hi + (def.int ? ', số nguyên' : '')); } } }
    if(v == null){ v = def.in === 'dial' ? dv : clamp(mixCurve(def.curve, dv), def.lo, def.hi); if(def.int) v = Math.round(v); }
    kk = def.in === 'dial' ? mixCurve(def.curve, v) : v;
    if(def.wired === false && src === 'spec' && v !== 50) W('unwired', 'Núm ' + id + ' chưa nối vào game (không có tham số thật) — bỏ qua');
    vals[id] = { v:r3(v), k:r3(kk), src }; }
  for(const g of groups) if(s[g] && typeof s[g] === 'object') for(const k of Object.keys(s[g])) if(!M.params[g + '.' + k]){ W('param', 'Bỏ núm lạ: ' + g + '.' + k); delete s[g][k]; }
  const P = id => vals[id], setK = (id, k, why) => { const p = vals[id], def = M.params[id], was = p.k; if(def.in === 'dial'){ p.v = r3(mixCurveInv(def.curve, k)); p.k = r3(mixCurve(def.curve, p.v)); } else { p.v = p.k = r3(def.int ? Math.round(k) : k); } if(p.k !== was) C(id, was, p.k, why); };
  const dialOf = id => M.params[id].in === 'dial' ? vals[id].v : mixCurveInv(M.params[id].curve, vals[id].k);
  // ---- structure ----
  const st = s.structure && typeof s.structure === 'object' ? s.structure : {}; let toks = null, auto = false;
  if(st.sectors != null && st.sectors !== false){ const L = Array.isArray(st.sectors) ? st.sectors : typeof st.sectors === 'string' ? st.sectors.split(/[, ]+/).filter(Boolean) : [];
    toks = []; for(const t of L){ const c = mixToken(t); if(c) toks.push(c.tok); else C('structure.sectors', t, null, 'không phải khu hợp lệ — bỏ'); }
    if(toks.length > M.sectors.max){ C('structure.sectors', toks.length, M.sectors.max, 'tối đa ' + M.sectors.max + ' khu'); toks.length = M.sectors.max; }
    if(!toks.length) toks = null; }
  else if(macro.length >= M.auto.sectorsFrom){ let n = 0; for(const [at, k] of M.auto.n) if(macro.length >= at) n = k; auto = true;
    toks = macro.variety < M.auto.fixedBelow ? (SECTOR.runs[land] || SECTOR.runs._).map(o => mixToken(o).tok) : Array.from({ length:n - 1 }, () => '*').concat(['hq:boss']);
    if(toks.length > n){ toks = toks.slice(0, n - 1).concat([toks[toks.length - 1]]); } }
  if(toks && coop){ C('structure.sectors', toks.join(' '), null, 'co-op chưa đánh theo khu'); toks = null; }
  if(toks) for(let i = 1; i < toks.length; i++){ const a = mixToken(toks[i - 1]), b = mixToken(toks[i]); if(a.type === 'hold' && b.type === 'hold'){ C('structure.sectors.' + i, toks[i], '*', 'không để 2 khu đứng giữ liền nhau'); toks[i] = '*'; } }
  if(toks && !toks.some(t => mixToken(t).type === 'boss')) W('noBoss', 'Không có khu tướng — trận thắng khi xong khu cuối');
  s.structure = { sectors:toks ? toks.slice() : null };
  // ---- cross-rules (thresholds: MIXER.rules) ----
  const R = M.rules, dd = dialOf('enemy.dmg'), den = dialOf('enemy.count'), simK0 = P('sim.timeScale').k;
  if(dd > R.hardStingy.diff && dialOf('loot.drop') < R.hardStingy.bounty){ setK('loot.drop', mixCurve(M.params['loot.drop'].curve, R.hardStingy.bounty), 'khó cao mà keo kiệt: trận không qua nổi'); setK('loot.relief', Math.max(P('loot.relief').k, mixCurve(M.params['loot.relief'].curve, R.hardStingy.bounty)), 'khó cao mà keo kiệt: trận không qua nổi'); }
  const spd = Math.max(dialOf('sim.timeScale'), dialOf('enemy.haste'), dialOf('clock.events'));
  if(spd > R.speedDense.speed && den > R.speedDense.density){ setK('enemy.count', mixCurve(M.params['enemy.count'].curve, R.speedDense.density), 'tốc độ cao: mật độ bị giới hạn để còn đọc được trận'); }
  { const need = Math.max(0.6, den > R.denseLull.density ? R.denseLull.lull : 0, spd > R.speedDense.speed ? R.speedDense.lull : 0), eff = P('pace.lull').k / (P('clock.events').k * simK0);
    if(eff < need) setK('pace.lull', clamp(need * P('clock.events').k * simK0, M.params['pace.lull'].lo, M.params['pace.lull'].hi), 'quãng nghỉ tối thiểu (mật độ / tốc độ cao)'); }
  if(simK0 > B.simK) setK('sim.timeScale', B.simK, 'ngân sách thiết bị (' + device + ')');
  const simK = P('sim.timeScale').k;
  if(P('clock.events').k * simK > R.effClock) setK('clock.events', R.effClock / simK, 'đồng hồ trận tổng ≤ ×' + R.effClock);
  if(P('enemy.haste').k * simK > R.effClock) setK('enemy.haste', R.effClock / simK, 'địch nhanh tổng ≤ ×' + R.effClock);
  if(P('foe.aware').v > R.unfair.aware && P('foe.aim').v > R.unfair.aim && dialOf('enemy.count') >= R.unfair.density) setK('foe.aim', mixCurve(M.params['foe.aim'].curve, R.unfair.aimCap), 'nhạy + thiện xạ + đông cùng cực: không công bằng');
  if(tod === 'night' && wx !== 'clear' && P('elite.aim').v > R.nightMarks.aim) setK('elite.aim', mixCurve(M.params['elite.aim'].curve, R.nightMarks.aim), 'đêm + thời tiết xấu: không đặt xạ thủ ưu tú');
  { const mate = (P('mate.aware').v + P('mate.aim').v + P('mate.tough').v + P('mate.move').v) / 4, elite = (P('elite.iq').v + P('elite.aim').v + P('elite.tough').v) / 3;
    if(mate > elite + R.mateGap){ const cut = mate - elite - R.mateGap; for(const id of ['mate.aware', 'mate.aim', 'mate.tough', 'mate.move']) setK(id, mixCurve(M.params[id].curve, clamp(P(id).v - cut, 0, 100)), 'đồng đội không giỏi hơn tinh nhuệ địch quá ' + R.mateGap); } }
  { const t = P('foe.tough').k * P('enemy.hp').k * Math.sqrt(P('enemy.count').k); if(t > R.ttk.budget) setK('foe.tough', P('foe.tough').k * R.ttk.budget / t, 'máu × mật độ vượt ngân sách thời gian hạ địch'); }
  if(P('enemy.count').k > B.countK) setK('enemy.count', B.countK, 'ngân sách thiết bị (' + device + ')');
  { const m0 = device === 'phone' ? CFG.INFANTRY.squad.maxMobile : CFG.INFANTRY.squad.maxOnField; if(m0 * P('enemy.cap').k > B.liveInf) setK('enemy.cap', B.liveInf / m0, 'ngân sách thiết bị (' + device + '): lính sống cùng lúc'); }
  { const e5 = events5(vals); if(e5 > B.events5) setK('events.surprise', Math.max(M.params['events.surprise'].lo, P('events.surprise').k * Math.max(0, B.events5 - (e5 - ev5Surprise(vals))) / Math.max(0.01, ev5Surprise(vals))), 'ngân sách bất ngờ ≤ ' + B.events5 + ' sự kiện / 5 phút'); }
  // long battle: at least longTypes.types kinds of mission
  if(toks){ const est = minutesOf(vals, { stage:((level - 1) % 5) + 1, loop:Math.floor((level - 1) / 5), toks, land }); const ty = new Set(toks.filter(t => t !== '*').map(t => mixToken(t).type));
    const kinds = () => new Set(toks.filter(t => t !== '*').map(t => mixToken(t).type)).size + toks.filter(t => t === '*').length;
    if(est > R.longTypes.min && ty.size < R.longTypes.types) for(let i = 0; i < toks.length && kinds() < R.longTypes.types; i++){ const ty0 = mixToken(toks[i]).type;
      if(toks[i] !== '*' && ty0 !== 'boss' && toks.some((t, j) => j < i && t !== '*' && mixToken(t).type === ty0)){ C('structure.sectors.' + i, toks[i], '*', 'trận dài trên ' + R.longTypes.min + ' phút cần ≥ ' + R.longTypes.types + ' kiểu nhiệm vụ'); toks[i] = '*'; } }
    s.structure.sectors = toks.slice(); }
  // ---- channel values back into the spec (what was asked, filled in) ----
  for(const id in vals){ const [g, k] = [id.split('.')[0], id.slice(id.indexOf('.') + 1)]; if(!s[g] || typeof s[g] !== 'object') s[g] = {}; s[g][k] = vals[id].v; }
  // ---- the leaves ----
  const leaves = new Map(), leaf = (path, by) => { let L = leaves.get(path); if(!L){ const r = mixRef(roots, path); if(!r) return null; L = { path, from:r[0][r[1]], to:r[0][r[1]], read:'go', t:false, int:false, by:[] }; leaves.set(path, L); } if(by && !L.by.includes(by)) L.by.push(by); return L; };
  for(const id in M.params){ const def = M.params[id], p = vals[id];
    for(const [path, op, e0, fl] of def.knobs){ const e = e0 ?? 1, f = fl || '';
      for(const lp of mixLeaves(roots, path, M)){ let x;
        if(def.in === 'abs') x = op === '+' ? p.v * e : op === '*' ? Math.pow(p.v, e) : p.v; else x = op === '*' ? Math.pow(p.k, e) : op === '+' ? e * (p.k - 1) : p.k;
        const ident = op === '*' ? x === 1 : op === '+' ? x === 0 : false, r = mixRef(roots, lp);
        if(f.includes('t') && simK !== 1){ const L = leaf(lp, 'sim.timeScale'); L.t = true; if(f.includes('b')) L.read = 'build'; }
        if(ident || (op === '=' && !leaves.has(lp) && r[0][r[1]] === x)) continue;
        const L = leaf(lp, id); if(!L) continue; L.to = op === '*' ? L.to * x : op === '+' ? L.to + x : x; if(f.includes('b')) L.read = 'build'; if(f.includes('i')) L.int = true; if(f.includes('t')) L.t = true; } } }
  // MIX 3 THE THREAT: a scenario's own relative knobs [path, op, x] (a conquest fort's: CONQUEST.forts[i].threat.knobs) — roots MIXER.threat.roots only, '$d' = the
  //   difficulty, turned before the build, each leaf inside MIXER.bounds or else MIXER.threat.k × today (wider than a param's: a fort's gate is ×5)
  { const th = s.threat && typeof s.threat === 'object' ? s.threat : null; s.threat = null;
    if(th){ const ok = []; for(const q of Array.isArray(th.knobs) ? th.knobs : []){ const [p0, op, x] = Array.isArray(q) ? q : [], p = String(p0).replace('$d', diff);
        if(!M.threat.roots.includes(p.split('.')[0]) || !['*', '+', '='].includes(op) || !Number.isFinite(Number(x))){ W('threat', 'Bỏ núm đe doạ: ' + p0); continue; }
        const ls = mixLeaves(roots, p, M); if(!ls.length){ W('threat', 'Núm đe doạ không có trong game: ' + p0); continue; } ok.push([String(p0), op, Number(x)]);
        for(const lp of ls){ const L = leaf(lp, 'threat'); L.to = knobApply(L.to, op, Number(x)); L.read = 'build'; L.wide = true; } }
      s.threat = { id:String(th.id || ''), knobs:ok }; } }
  for(const k of ['general', 'conq']) if(s[k] != null && (typeof s[k] !== 'object' || Array.isArray(s[k]))){ W(k, 'Bỏ trường hỏng: ' + k); delete s[k]; }
  if(s.general) s.general = { name:String(s.general.name || ''), look:s.general.look ? String(s.general.look) : null };
  if(s.conq){ const i = Math.round(Number(s.conq.i)); if(!(i >= 0 && i < CFG.CONQUEST.forts.length)){ C('conq.i', s.conq.i, null, 'không có thành này'); delete s.conq; } else s.conq = { i }; }
  if(s.storyline != null && typeof s.storyline !== 'string'){ W('storyline', 'Bỏ trường hỏng: storyline'); delete s.storyline; }
  // advanced keys (allow-listed, '=' and clamped)
  const adv = s.advanced && typeof s.advanced === 'object' ? s.advanced : {}; s.advanced = {};
  for(const k of Object.keys(adv)){ const lim = M.advanced[k], n = Number(adv[k]); if(!lim){ W('advanced', 'Khoá chuyên sâu không được phép: ' + k); continue; } if(!Number.isFinite(n)){ C('advanced.' + k, adv[k], null, 'không phải số'); continue; }
    const v = clamp(n, lim[0], lim[1]); if(v !== n) C('advanced.' + k, n, v, 'biên ' + lim[0] + '–' + lim[1]); const L = leaf(k, 'advanced'); if(!L){ W('advanced', 'Khoá chuyên sâu không có trong game: ' + k); continue; } L.to = v; L.read = 'build'; s.advanced[k] = v; }
  // the sim's time scale: a wall-clock second (the game's `now`) is 1/simK of a sim second
  for(const L of leaves.values()){ if(L.t && simK !== 1) L.to /= simK;
    const b = boundOf(M, L.path), wl = L.wide ? M.threat.k[0] : 0.25, wh = L.wide ? M.threat.k[1] : 4, lo = b ? b[0] : L.from >= 0 ? L.from * wl : L.from * wh, hi = b ? b[1] : L.from >= 0 ? L.from * wh : L.from * wl;
    let v = L.int ? Math.round(L.to) : L.to; const c = clamp(v, Math.min(lo, hi), Math.max(lo, hi)); if(Math.abs(c - v) > 1e-9){ C(L.path, r3(v), r3(c), 'biên cứng của tham số'); v = c; }
    L.to = L.int ? Math.round(v) : v; }   // (MIX 3 no rounding: a fort's threat lands on exactly the number the old conquest code made)
  const knobs = [...leaves.values()].filter(L => L.to !== L.from).map(L => ({ path:L.path, from:L.from, to:L.to, read:L.read, by:L.by }));
  const stage = ((level - 1) % 5) + 1, loop = Math.floor((level - 1) / 5);
  const plan = { v:1, seed, seeds:{ build:modeHash(seed, 1), deal:modeHash(seed, 2), play:modeHash(seed, 3) }, device, coop,
    world:{ land, biome:M.lands.indexOf(land), tod, wx, space, level, stage, loop, diff }, structure:{ sectors:toks ? toks.slice() : null, auto, stars:toks ? toks.filter(t => t === '*').length : 0 },
    macro, params:vals, player:{ lives:vals['player.lives'].v }, knobs, conq:s.conq ? s.conq.i : null, storyline:s.storyline || null };
  return { spec:s, plan, clamped, warnings }; }

// ---- events in five minutes (surprises · big events · side missions · drone raids), from the params ----
function ev5Surprise(V){ const ev = CFG.REAL.surprise.every, k = V['events.surprise'].k * V['clock.events'].k * V['sim.timeScale'].k; return k > 0 ? 300 / ((ev[0] + ev[1]) / 2 / k) : 0; }
function events5(V){ const st = 7, big = Math.min(V['events.big'].v, st * 60 / (CFG.BIGEVENT.gap / V['clock.events'].k)) * 5 / st, side = V['events.side'].v * 5 / st;
  const dr = V['events.drones'].k * V['clock.events'].k * V['sim.timeScale'].k, drones = dr > 0 ? 300 / (CFG.DRONEWAR.enemy.gap / dr) * 0.5 : 0; return ev5Surprise(V) + big + side + drones; }
let _e5 = 0; function refE5(){ return _e5 || (_e5 = events5(normalizeSpec({ v:1, world:{ land:'DESERT' } }).plan.params)); }   // today's battle
// ---- the battle's minutes ----
function speedEff(V){ return V['sim.timeScale'].k * Math.pow(V['clock.events'].k, 0.3) * Math.pow(V['enemy.cadence'].k, 0.2); }
function baseX(V, w){ const T = MIXER.score.ref, s = w.stage, L = w.loop, hpS = (1 + CFG.RAMP.hpPerStage * (s - 1)) * (1 + BALANCE.loop.hp * L), hpR = 1 + CFG.RAMP.hpPerStage * (T.stage - 1);
  const men = s2 => (BALANCE.wave.base + 3 * BALANCE.wave.perWave + (s2 - 1) * BALANCE.wave.perStage), d = BALANCE.difficulty[w.diff || 'soldier'] || BALANCE.difficulty.soldier;
  const hpX = V['enemy.hp'].k * V['foe.tough'].k * hpS / hpR * d.hp;
  const numX = Math.pow(V['enemy.count'].k, 0.85) * Math.pow(V['enemy.cap'].k, 0.35) * men(s) / men(T.stage) * (1 + 0.12 * (V['enemy.air'].k - 1) + 0.08 * (V['enemy.rpg'].k - 1));
  return { hpX, numX, d }; }
function minutesOf(V, w){ const T = MIXER.score, { hpX, numX } = baseX(V, w), se = speedEff(V), lullMin = 15 / 60 * V['pace.lull'].k / (V['clock.events'].k * V['sim.timeScale'].k);
  const fightK = Math.pow(numX, 0.7) * Math.pow(hpX, 0.45) / Math.pow(se, 0.8);
  if(w.toks && w.toks.length){ const dk = deckTypes(w.land), avg = dk.length ? dk.reduce((a, t) => a + (T.typeMin[t] || 4), 0) / dk.length : 4; let m = 0;
    for(const t of w.toks){ const ty = t === '*' ? null : mixToken(t).type; m += (ty ? T.typeMin[ty] || 4 : avg) * (0.6 + 0.4 * fightK) * (ty === 'boss' ? Math.sqrt(V['boss.tough'].k) : 1); }
    return m + T.ref.transitMin * (w.toks.length - 1); }
  return V['enemy.waves'].v * (T.ref.waveMin * fightK + lullMin) + T.ref.bossMin * Math.sqrt(V['boss.tough'].k) / Math.pow(se, 0.5); }

// ================= SCORE =================
export function scoreBattle(spec, opts){ const n = spec && spec.plan && spec.clamped ? spec : normalizeSpec(spec, opts), p = n.plan, V = p.params, w = { ...p.world, toks:p.structure.sectors }, M = MIXER, S = M.score;
  const k = id => V[id].k, dv = id => V[id].v, ln2 = Math.LN2, R = { difficulty:[], intensity:[], joy:[], appeal:[], variety:[], fairness:[], minutes:[] }, warn = n.warnings.slice(), W = (id, vi) => warn.push({ id, vi });
  const x2 = (v, what) => (v >= 1 ? '×' : '×') + v.toFixed(2) + ' ' + what;
  const { hpX, numX, d } = baseX(V, w), s = w.stage, L = w.loop, dmgS = (0.7 + 0.3 * Math.min(1, (s - 1) / 4)) * (1 + BALANCE.loop.dmg * L) / (0.7 + 0.3 * Math.min(1, (S.ref.stage - 1) / 4));
  const simK = k('sim.timeScale'), rateX = k('enemy.haste') * simK;
  const dmgX = k('enemy.dmg') * dmgS * d.dmg, accX = Math.pow(k('foe.aim'), 0.8) * Math.pow(k('foe.aware'), 0.4) * Math.pow(k('foe.iq'), 0.3) * Math.pow(k('elite.iq') * k('elite.aim'), 0.15);
  const mateX = Math.cbrt(k('mate.tough') * k('mate.aim') * k('mate.aware'));
  const threat = dmgX * accX * Math.pow(rateX, 1.5) *   /* MIX 2 calibrated: speed 100 measured ×3.6 damage taken / min, ×2.4 pressure (one 55 s run) — 0.8 predicted ×1.3 */  Math.pow(numX, 0.7) * Math.pow(k('pace.ease'), 0.6);
  const sustain = (V['player.hp'].v / 150) * Math.pow((V['player.lives'].v + 1) / 6, 0.35) * Math.pow(k('loot.relief'), 0.3) * Math.pow(k('loot.drop'), 0.12) * Math.pow(k('loot.ammo'), 0.2) * Math.pow(k('pace.lull'), 0.15) * Math.pow(mateX, 0.25) * Math.pow(V['player.squad'].v / 6, 0.2);
  const grind = hpX * Math.pow(numX, 0.3) * Math.pow(k('boss.tough'), 0.15);
  const diffRaw = Math.log(threat * Math.sqrt(grind) / sustain), difficulty = clamp(50 + S.diffK * diffRaw / ln2, 0, 100);
  R.difficulty.push(x2(dmgX, 'sát thương địch'), x2(accX, 'độ chính xác / nhạy của địch'), x2(numX, 'quân số'), x2(hpX, 'máu địch'), x2(sustain, 'sức trụ của mình (máu, mạng, hồi phục)'));
  if(rateX !== 1) R.difficulty.push(x2(rateX, 'tốc độ bắn của địch'));
  // events, pace
  const e5 = events5(V), evX = e5 / refE5(), lullX = k('pace.lull') / (k('clock.events') * simK);
  const intRaw = Math.log(numX * k('enemy.cadence') * simK * Math.sqrt(k('clock.events') * k('enemy.haste')) / Math.sqrt(lullX) * Math.pow(k('pace.peak'), 0.3) * Math.pow(evX, 0.3) * Math.pow(dmgX * accX, 0.2) * Math.pow(k('foe.aggro'), 0.3));
  const intensity = clamp(50 + S.intK * intRaw / ln2, 0, 100);
  R.intensity.push(x2(numX, 'quân số'), x2(k('enemy.cadence') * simK, 'nhịp quân vào'), x2(1 / lullX, 'độ ngắn quãng nghỉ'), x2(evX, 'sự kiện / 5 phút (' + e5.toFixed(1) + ')'));
  // time to kill, kills a minute
  const ttk = S.ref.ttk * hpX, kpm = S.ref.kpm * Math.pow(numX, 0.6) * Math.pow(k('enemy.cadence') * simK, 0.3) / Math.pow(hpX, 0.7);
  const ttkJoy = 25 * (1 - Math.abs(Math.log(hpX)) / Math.log(2.5)), kpmJoy = clamp(12 * Math.log(kpm / S.ref.kpm) / ln2, -15, 15), lootJoy = clamp(8 * Math.log(Math.max(0.05, k('loot.drop'))) / ln2, -12, 10);
  const nSec = w.toks ? w.toks.length : 0, wins = 3 * Math.max(0, nSec - 1) + 2 * (dv('events.side') - 2);
  const joy = clamp(50 + ttkJoy - 12.5 + kpmJoy + lootJoy + wins + 4 * (mateX - 1) * 5 - Math.max(0, difficulty - 70) * 0.8 - Math.max(0, 35 - intensity) * 0.6, 0, 100);
  R.joy.push('hạ một lính ~' + ttk.toFixed(2) + ' s', '~' + kpm.toFixed(1) + ' địch / phút', x2(k('loot.drop'), 'đồ rơi'));
  if(difficulty > 70) R.joy.push('khó ' + Math.round(difficulty) + ': bớt sướng'); if(intensity < 35) R.joy.push('ít căng: nhạt');
  // variety
  const dk = new Set(deckTypes(w.land)), named = w.toks ? new Set(w.toks.filter(t => t !== '*').map(t => mixToken(t).type)) : new Set(), stars = w.toks ? w.toks.filter(t => t === '*').length : 0;
  const types = w.toks ? Math.min(7, named.size + Math.min(stars, [...dk].filter(t => !named.has(t)).length)) : 1;
  const variety = clamp(12 * types + (w.toks ? 0 : 6) + 5 * dv('events.side') + 4 * dv('events.big') + 30 * dv('enemy.waveEvents') + (w.toks ? 15 * Math.min(1, 0.45 * k('events.cards')) + (stars ? 8 : 0) : 0) + (w.tod !== 'noon' ? 4 : 0) + (w.wx !== 'clear' ? 6 : 0) + 4 * Math.min(1.5, k('events.drones')) - 4, 0, 100);
  R.variety.push(types + ' kiểu nhiệm vụ', dv('events.side') + ' nhiệm vụ phụ, ' + dv('events.big') + ' sự kiện lớn / màn', 'biến đợt ' + Math.round(dv('enemy.waveEvents') * 100) + '%');
  // drama, appeal
  const drama = clamp(mixCurveInv(M.params['story.radio'].curve, k('story.radio')) * 0.7 + (w.toks ? 15 : 0) + 10 * (k('story.finale') - 1) * 2.5 + 8, 0, 100);
  const tempoD = mixCurveInv(M.params['pace.lull'].curve, lullX), wCurve = clamp(100 - 2.2 * Math.abs((100 - tempoD) - 55) - (lullX < 0.75 ? 25 : 0), 0, 100), choices = clamp((stars ? 50 : 0) + 15 * dv('events.side'), 0, 100);
  const appeal = clamp(0.35 * variety + 0.25 * drama + 0.25 * wCurve + 0.15 * choices + 12 - Math.max(0, 35 - intensity) * 0.5 - Math.max(0, difficulty - 85) * 0.5, 0, 100);
  R.appeal.push('đa dạng ' + Math.round(variety), 'kịch tính ' + Math.round(drama), 'nhịp căng–nghỉ ' + Math.round(wCurve), 'lựa chọn ' + Math.round(choices));
  // fairness
  let fair = 85; const pen = (v, why) => { if(v > 0.5){ fair -= v; R.fairness.push('−' + Math.round(v) + ' ' + why); } };
  pen(Math.max(0, k('foe.aware') * k('foe.aim') - 1.3) * 60, 'địch vừa nhạy vừa bắn trúng');
  pen(Math.max(0, 0.9 - Math.pow(k('elite.aim'), -0.5)) * 80, 'xạ thủ báo trước ngắn');
  pen(w.tod === 'night' && w.wx !== 'clear' ? Math.max(0, k('elite.iq') - 1) * 20 : 0, 'đêm + thời tiết xấu + xạ thủ');
  pen(Math.max(0, rateX - 1.3) * 50, 'địch nhanh hơn mắt kịp đọc');
  pen(Math.max(0, simK * numX - 1.6) * 20, 'đông và nhanh: khó đọc trận');
  pen(Math.max(0, e5 - M.budget[p.device].events5) * 8, 'quá nhiều bất ngờ');
  pen(Math.max(0, difficulty - 85) * 0.6, 'khó cực độ');
  pen(Math.max(0, 1 - sustain) * 15 * (difficulty > 60 ? 1 : 0.3), 'ít đường hồi phục');
  const fairness = clamp(fair, 0, 100); if(!R.fairness.length) R.fairness.push('không có điểm trừ');
  const minutes = Math.round(minutesOf(V, w) * 10) / 10;
  R.minutes.push(w.toks ? nSec + ' khu' : V['enemy.waves'].v + ' đợt + tướng', x2(speedEff(V), 'tốc độ'), x2(Math.pow(numX, 0.7) * Math.pow(hpX, 0.45), 'khối lượng giao tranh'));
  // warnings (MIXER.score.warn)
  const T = S.warn, out = { difficulty:Math.round(difficulty), intensity:Math.round(intensity), joy:Math.round(joy), appeal:Math.round(appeal), variety:Math.round(variety), fairness:Math.round(fairness), minutes };
  if(out.appeal < T.flat) W('flat', 'Trận phẳng: hấp dẫn ' + out.appeal + ' < ' + T.flat);
  if(out.difficulty > T.grind.diff && out.joy < T.grind.joy) W('grind', 'Trận hành xác: khó ' + out.difficulty + ', sướng ' + out.joy);
  { const sp = Math.max(dv('sim.timeScale') === 1 ? 0 : mixCurveInv(M.params['sim.timeScale'].curve, simK), mixCurveInv(M.params['enemy.haste'].curve, k('enemy.haste'))), de = mixCurveInv(M.params['enemy.count'].curve, k('enemy.count'));
    if(sp > T.unreadable && de > T.unreadable && out.difficulty > T.unreadable) W('unreadable', 'Nhanh + đông + khó cùng lúc: trận khó đọc'); }
  if(out.fairness < T.unfair) W('unfair', 'Công bằng thấp: ' + out.fairness);
  if(out.intensity > T.hot.int && out.fairness < T.hot.fair) W('hot', 'Quá căng mà thiếu công bằng');
  if(minutes < T.short) W('short', 'Trận quá ngắn: ~' + minutes + ' phút'); if(minutes > T.long) W('long', 'Trận quá dài: ~' + minutes + ' phút');
  if(out.variety < T.samey) W('samey', 'Lặp lại: đa dạng ' + out.variety);
  return { ...out, reasons:R, warnings:warn, est:{ ttk:r3(ttk), kpm:r3(kpm), events5:r3(e5), threat:r3(threat), sustain:r3(sustain), hpX:r3(hpX), numX:r3(numX) } }; }

// ================= MIX 3 THE PREDICTED PRESSURE CURVE (the mixer desk draws it) =================
// n = a normalizeSpec result → { pts:[[minute, pressure 0–1]], marks:[{ t, label }], total } — a sketch of the director's pressure across the battle from the scores:
//   each wave (or sector) builds up to a peak and falls into a lull; a sector chain follows each mission's own shape; the general's fight is the last peak.
export function planCurve(n, sc){ sc = sc || scoreBattle(n); const p = n.plan, V = p.params, T = MIXER.score, total = Math.max(1, sc.minutes), pts = [[0, 0.05]], marks = [];
  const pk = Math.min(0.95, 0.3 + 0.45 * sc.intensity / 100 + 0.15 * sc.difficulty / 100), lo = Math.max(0.04, 0.16 - 0.06 * (V['pace.lull'].k - 1)), at = (t, v) => pts.push([+t.toFixed(2), +Math.max(0, Math.min(1, v)).toFixed(3)]);
  const toks = p.structure.sectors, dk = toks ? toks.map(t => t === '*' ? null : mixToken(t).type) : null;
  if(toks){ const w = dk.map(ty => ty ? T.typeMin[ty] || 4 : 4), sum = w.reduce((a, b) => a + b, 0); let t = 0;
    dk.forEach((ty, i) => { const d = total * w[i] / sum, k = ty === 'boss' ? 1 : ty === 'hold' ? 0.85 : ty === 'breach' ? 0.9 : 0.75; marks.push({ t:+t.toFixed(2), label:(i + 1) + '·' + (ty || '*') });
      if(ty === 'hold'){ at(t + d * 0.15, pk * k * 0.7); at(t + d * 0.5, pk * k); at(t + d * 0.8, pk * k * 0.9); }
      else if(ty === 'boss'){ at(t + d * 0.3, pk * 0.55); at(t + d * 0.45, lo + 0.1); at(t + d * 0.85, pk); }
      else { at(t + d * 0.35, pk * k * 0.6); at(t + d * 0.6, lo + 0.08); at(t + d * 0.85, pk * k); }
      at(t + d * 0.97, lo); t += d; }); }
  else { const waves = V['enemy.waves'].v, boss = Math.min(total * 0.3, T.ref.bossMin * Math.sqrt(V['boss.tough'].k)), d = (total - boss) / waves; let t = 0;
    for(let i = 0; i < waves; i++){ marks.push({ t:+t.toFixed(2), label:'Đ' + (i + 1) }); const r = 0.75 + 0.25 * (i + 1) / waves; at(t + d * 0.45, pk * r * 0.7); at(t + d * 0.62, pk * r); at(t + d * 0.8, lo); t += d; }
    marks.push({ t:+t.toFixed(2), label:'Tướng' }); at(t + boss * 0.4, pk * 0.8); at(t + boss * 0.85, Math.min(1, pk * 1.05)); at(total, lo); }
  return { pts, marks, total }; }
