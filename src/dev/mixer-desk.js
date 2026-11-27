// dev/mixer-desk.js — MIX 3 THE MIXER DESK (mixer.html): ten macro faders, the channel strips, live scores / clamps / warnings / the predicted pressure curve, presets, A/B, ĐÁNH THỬ
//   A dev page of its own: it imports only config.js and the pure data modules (no hub, no three), so it opens in a blink and runs the same normalizeSpec / scoreBattle /
//   planCurve the game does (data/mixer-math.js). Inert on the game page (it does nothing without #mixDesk). ĐÁNH THỬ puts the spec in sessionStorage (xk.mixspec)
//   and opens index.html?spec=_session&desk=1 (dev/hooks.js); the battle's card comes back here (#log) and its measurement sits beside its prediction (localStorage
//   xk.mixlog, written by campaign/mixer.js). The desk's own specs live in localStorage xk.mixdesk (saved) and xk.mixdesk.cur (the one on the desk).
import { MIXER, SECTOR, OBJECTIVES, WEATHER, SPACE } from '../../config.js';
import { normalizeSpec, scoreBattle, planCurve, mixToken } from '../data/mixer-math.js';
import { BIOME_VI, TOD_LABEL, DIFF_META } from '../data/text-vi.js';

const M = MIXER, KEY = { saved:'xk.mixdesk', cur:'xk.mixdesk.cur', log:'xk.mixlog', spec:'xk.mixspec' };
const EXAMPLES = ['standard', 'easy-short-day', 'hard-night-long', 'chaos-rescue', 'bounty-farm', 'fast-forward', 'elite-few', 'horde', 'broken'];
const SC = [['difficulty', 'Độ khó'], ['intensity', 'Độ căng'], ['joy', 'Độ sướng'], ['appeal', 'Hấp dẫn'], ['variety', 'Đa dạng'], ['fairness', 'Công bằng']];
const PROF = [['foe', 'Lính thường'], ['elite', 'Tinh nhuệ'], ['boss', 'Tướng'], ['mate', 'Đồng đội']], SUB = [['iq', 'Trí'], ['aware', 'Nhạy'], ['aim', 'Thiện xạ'], ['tough', 'Bền'], ['move', 'Cơ động'], ['aggro', 'Hung hăng'], ['morale', 'Tinh thần']];
const LB = { 'enemy.count':'Số địch', 'enemy.cap':'Trần quân', 'enemy.cadence':'Nhịp vào trận', 'enemy.air':'Trực thăng · lính dù', 'enemy.rpg':'Lính B41', 'enemy.waveEvents':'Biến đợt', 'enemy.waves':'Số đợt',
  'enemy.hp':'Máu địch', 'enemy.dmg':'Sát thương địch', 'boss.guards':'Cận vệ tướng (+)', 'pace.ease':'Ngưỡng đạo diễn', 'pace.lull':'Quãng nghỉ', 'pace.build':'Dồn quân', 'pace.peak':'Cao trào',
  'events.surprise':'Bất ngờ', 'events.big':'Sự kiện lớn / màn', 'events.side':'Nhiệm vụ phụ / màn', 'events.drones':'Drone địch', 'events.cards':'Thẻ biến cố', 'loot.drop':'Rơi đồ', 'loot.relief':'Cứu trợ',
  'loot.ammo':'Đạn mang theo', 'player.hp':'Máu', 'player.lives':'Mạng', 'player.squad':'Tổ tối đa', 'story.radio':'Mật độ bộ đàm', 'story.finale':'Lặng trước tướng', 'sim.timeScale':'Tốc độ mô phỏng',
  'enemy.haste':'Địch nhanh', 'clock.events':'Đồng hồ trận' };
const STRIPS = [['Quân địch', ['enemy.count', 'enemy.cap', 'enemy.cadence', 'enemy.air', 'enemy.rpg', 'enemy.waveEvents', 'enemy.waves', 'enemy.hp', 'enemy.dmg', 'boss.guards']],
  ['Đạo diễn & nhịp', ['pace.ease', 'pace.lull', 'pace.build', 'pace.peak']], ['Biến cố', ['events.surprise', 'events.big', 'events.side', 'events.drones', 'events.cards']],
  ['Vật phẩm', ['loot.drop', 'loot.relief', 'loot.ammo']], ['Người chơi', ['player.hp', 'player.lives', 'player.squad']], ['Cốt truyện', ['story.radio', 'story.finale']],
  ['Tốc độ', ['sim.timeScale', 'enemy.haste', 'clock.events']]];
const TYPES = Object.keys(SECTOR.types), PLACES = Object.keys(SECTOR.places), WHO = Object.keys(SECTOR.types.rescue.who || {}), OBJS = Object.keys(OBJECTIVES);
const D = { spec:null, n:null, sc:null, A:null, device:'desktop', open:{}, raf:0 };
const $ = (s, r) => (r || document).querySelector(s), h = (t, a, ...c) => { const e = document.createElement(t); for(const k in a || {}){ if(k === 'on') for(const ev in a.on) e.addEventListener(ev, a.on[ev]); else if(k === 'cls') e.className = a[k]; else if(k in e && k !== 'list') e[k] = a[k]; else e.setAttribute(k, a[k]); } for(const x of c.flat(Infinity)) if(x != null) e.append(x.nodeType ? x : String(x)); return e; };
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 10 || Number.isInteger(v) ? String(Math.round(v * 10) / 10) : v.toFixed(2)) : String(v ?? '—');
const ld = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; }catch(e){ return d; } }, sv = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const blank = () => ({ v:1, name:'Trận mới', world:{ land:'DESERT' } });
const grp = id => id.split('.')[0], key = id => id.slice(id.indexOf('.') + 1);
const getP = id => { const g = D.spec[grp(id)]; return g && typeof g === 'object' ? g[key(id)] : undefined; };
function setP(id, v){ const g = grp(id); if(v == null){ if(D.spec[g]){ delete D.spec[g][key(id)]; if(!Object.keys(D.spec[g]).length) delete D.spec[g]; } } else (D.spec[g] = D.spec[g] && typeof D.spec[g] === 'object' ? D.spec[g] : {})[key(id)] = v; upd(); }
function setSpec(s){ D.spec = JSON.parse(JSON.stringify(s || blank())); if(!D.spec.world) D.spec.world = { land:'DESERT' }; build(); upd(); }

// ---- live: every change → normalize + score + curve, then the panels ----
function upd(){ cancelAnimationFrame(D.raf); D.raf = requestAnimationFrame(() => { sv(KEY.cur, D.spec);
  D.n = normalizeSpec(D.spec, { device:D.device }); D.sc = scoreBattle(D.n); D.curve = planCurve(D.n, D.sc); paintKnobs(); paintRight(); }); }
function evalSpec(s){ const n = normalizeSpec(s, { device:D.device }), sc = scoreBattle(n); return { n, sc, curve:planCurve(n, sc) }; }

// ---- the faders ----
function fader(k){ const v = D.spec.macro && D.spec.macro[k], inp = h('input', { type:'range', min:0, max:100, step:1, value:v ?? 50, cls:'mx-vr', 'aria-label':M.macros[k] });
  let tap = 0; const reset = () => { if(D.spec.macro){ delete D.spec.macro[k]; } inp.value = 50; upd(); };
  inp.addEventListener('input', () => { (D.spec.macro = D.spec.macro || {})[k] = +inp.value; upd(); });
  inp.addEventListener('dblclick', reset); inp.addEventListener('pointerup', () => { const t = performance.now(); if(t - tap < 320) reset(); tap = t; });
  return h('div', { cls:'mx-fader', 'data-k':k }, h('b', { cls:'mx-fv' }, String(v ?? 50)), h('div', { cls:'mx-track' }, inp), h('span', { cls:'mx-fl' }, M.macros[k])); }
// ---- one channel param ----
function knob(id, short){ const d = M.params[id], dial = d.in === 'dial', lo = dial ? 0 : d.lo, hi = dial ? 100 : d.hi, st = dial || d.int ? 1 : 0.01;
  const inp = h('input', { type:'range', min:lo, max:hi, step:st, cls:'mx-hr', 'aria-label':LB[id] || id });
  inp.addEventListener('input', () => setP(id, +inp.value)); inp.addEventListener('dblclick', () => setP(id, null));
  const rs = h('button', { cls:'mx-rs', title:'Về theo fader', on:{ click:() => setP(id, null) } }, '⟲');
  return h('div', { cls:'mx-knob' + (d.wired === false ? ' off' : ''), 'data-id':id, title:d.wired === false ? 'Chưa nối vào game' : id }, h('span', { cls:'mx-kl' }, short || LB[id] || id), inp, h('b', { cls:'mx-kv' }), rs); }
function paintKnobs(){ const P = D.n.plan.params;
  document.querySelectorAll('.mx-knob').forEach(el => { const id = el.dataset.id, set = getP(id) != null, p = P[id], inp = $('input', el); if(document.activeElement !== inp) inp.value = p.v;
    el.classList.toggle('set', set); el.classList.toggle('clamp', D.n.clamped.some(c => c.key === id)); $('.mx-kv', el).textContent = fmt(p.v) + (p.k !== p.v && M.params[id].in === 'dial' ? ' ×' + fmt(p.k) : ''); });
  document.querySelectorAll('.mx-fader').forEach(el => { const k = el.dataset.k, v = D.n.plan.macro[k]; $('.mx-fv', el).textContent = Math.round(v); el.classList.toggle('set', D.spec.macro && D.spec.macro[k] != null); const i = $('input', el); if(document.activeElement !== i) i.value = v; }); }

// ---- the strips ----
function strip(ttl, body, id){ const d = h('details', { cls:'mx-strip', open:!!D.open[id] }, h('summary', null, ttl), body); d.addEventListener('toggle', () => { D.open[id] = d.open; }); return d; }
function sel(list, val, on, lab){ const s = h('select', { on:{ change:() => on(s.value) } }, list.map(v => h('option', { value:v, selected:v === val }, lab ? lab(v) : v))); return s; }
function worldStrip(){ const w = D.spec.world, put = (k, v) => { if(v === '' || v == null) delete w[k]; else w[k] = v; upd(); };
  const lv = h('input', { type:'number', min:1, max:30, value:w.level ?? M.defaults.level, on:{ change:() => put('level', +lv.value) } }), seed = h('input', { type:'number', min:0, value:D.spec.seed ?? '', placeholder:'tự sinh', on:{ change:() => { if(seed.value === '') delete D.spec.seed; else D.spec.seed = +seed.value; upd(); } } });
  return h('div', { cls:'mx-grid' }, h('label', null, 'Chiến trường', sel(M.lands, w.land, v => put('land', v), v => BIOME_VI[v] || v)), h('label', null, 'Giờ', sel(M.tods, w.tod || M.defaults.tod, v => put('tod', v), v => TOD_LABEL[v])),
    h('label', null, 'Thời tiết', sel(M.wxs, w.wx || M.defaults.wx, v => put('wx', v), v => WEATHER[v].vi)), h('label', null, 'Bản đồ', sel(M.spaces, w.space || M.defaults.space, v => put('space', v), v => SPACE[v].vi)),
    h('label', null, 'Cấp (1–30)', lv), h('label', null, 'Độ khó người chơi', sel(M.diffs, w.diff || M.defaults.diff, v => put('diff', v), v => DIFF_META[v].label)),
    h('label', null, 'Hạt gốc', h('span', { cls:'mx-row' }, seed, h('button', { cls:'mx-b sm', on:{ click:() => { D.spec.seed = (Math.random() * 1e9) | 0; seed.value = D.spec.seed; upd(); } } }, '🎲')))); }
function structStrip(){ const box = h('div', { cls:'mx-struct' }), st = () => D.spec.structure = D.spec.structure || {}, toks = () => st().sectors || [];
  const put = L => { st().sectors = L.length ? L : null; if(!st().sectors) delete D.spec.structure; draw(); upd(); };
  const draw = () => { box.replaceChildren(); const L = toks();
    L.forEach((t, i) => { const c = mixToken(t) || { type:'*' }, star = t === '*', a = String(t).split(':');
      const tyS = sel(['*', ...TYPES], star ? '*' : c.type, v => { L[i] = v === '*' ? '*' : v; put(L); }, v => v === '*' ? '★ ngẫu nhiên' : SECTOR.types[v].vi);
      const row = h('div', { cls:'mx-tok' + (star ? ' star' : '') }, h('b', null, String(i + 1)), tyS);
      if(!star){ row.append(sel(PLACES, c.place, v => { L[i] = [v, c.type].concat(a[2] ? [a[2]] : []).join(':'); put(L); }, v => SECTOR.places[v].vi));
        const objL = c.type === 'rescue' ? WHO : c.type === 'sabotage' || c.type === 'infiltrate' ? OBJS : null;
        if(objL) row.append(sel(objL, a[2] || objL[0], v => { L[i] = [c.place, c.type, v].join(':'); put(L); })); }
      row.append(h('button', { cls:'mx-b sm', on:{ click:() => { if(i){ [L[i - 1], L[i]] = [L[i], L[i - 1]]; put(L); } } } }, '◀'), h('button', { cls:'mx-b sm', on:{ click:() => { L.splice(i, 1); put(L); } } }, '✕'));
      box.append(row); });
    box.append(h('div', { cls:'mx-row' }, h('button', { cls:'mx-b', on:{ click:() => put(toks().concat(['outskirts:hold'])) } }, '+ khu'), h('button', { cls:'mx-b', on:{ click:() => put(toks().concat(['*'])) } }, '+ ★'),
      h('button', { cls:'mx-b', on:{ click:() => put(toks().concat(['hq:boss'])) } }, '+ tướng'), h('button', { cls:'mx-b', on:{ click:() => put([]) } }, 'Một màn (không chia khu)')),
      h('p', { cls:'mx-note' }, L.length ? 'Chuỗi khu: ★ bốc từ bộ bài của chiến trường theo hạt.' : 'Một màn: số đợt theo fader Chiều dài (từ 65 trở lên tự chia khu).')); };
  draw(); return box; }
function qualityStrip(){ return h('div', { cls:'mx-q' }, h('span'), SUB.map(([k, l]) => h('span', { cls:'mx-qh' }, l)), PROF.map(([p, pl]) => [h('span', { cls:'mx-qh row' }, pl), SUB.map(([k, l]) => knob(p + '.' + k, l))])); }
function advStrip(){ const box = h('div'), draw = () => { box.replaceChildren(); const A = D.spec.advanced || {};
    for(const k of Object.keys(A)){ const [lo, hi] = M.advanced[k] || [0, 1], i = h('input', { type:'number', min:lo, max:hi, step:'any', value:A[k], on:{ change:() => { A[k] = +i.value; upd(); } } });
      box.append(h('div', { cls:'mx-adv' }, h('code', null, k), i, h('small', null, lo + '–' + hi), h('button', { cls:'mx-b sm', on:{ click:() => { delete A[k]; if(!Object.keys(A).length) delete D.spec.advanced; draw(); upd(); } } }, '✕'))); }
    const free = Object.keys(M.advanced).filter(k => !(k in A)); if(free.length) box.append(h('div', { cls:'mx-row' }, sel(['', ...free], '', v => { if(!v) return; (D.spec.advanced = D.spec.advanced || {})[v] = M.advanced[v][0]; draw(); upd(); }, v => v || '+ thêm khoá (chỉ danh sách cho phép)'))); };
  draw(); return box; }
function build(){ const L = $('#mxLeft'); L.replaceChildren();
  L.append(h('div', { cls:'mx-faders' }, Object.keys(M.macros).map(fader)));
  L.append(strip('Chiến trường', worldStrip(), 'world'), strip('Cấu trúc', structStrip(), 'struct'));
  for(const [t, ids] of STRIPS){ if(t === 'Tốc độ') L.append(strip('Chất lượng quân (4 hồ sơ × 7 núm)', qualityStrip(), 'quality')); L.append(strip(t, h('div', { cls:'mx-knobs' }, ids.map(id => knob(id))), t)); }
  L.append(strip('Chuyên sâu (danh sách cho phép)', advStrip(), 'adv'));
  if(D.spec.threat || D.spec.conq) L.append(h('p', { cls:'mx-note' }, 'Kịch bản: ' + (D.spec.general ? D.spec.general.name : '') + (D.spec.threat ? ' · đe doạ ' + D.spec.threat.id + ' (' + D.spec.threat.knobs.length + ' núm)' : '') + (D.spec.conq ? ' · thành ' + (D.spec.conq.i + 1) : '')));
  $('#mxName').value = D.spec.name || ''; }

// ---- the right side: scores, warnings, clamps, the curve, A/B, the log ----
function meters(sc, A){ return SC.map(([k, l]) => { const v = sc[k], a = A && A.sc[k], dl = A ? v - a : null;
  return h('div', { cls:'mx-m' }, h('div', { cls:'mx-mh' }, h('span', null, l), A ? h('em', { cls:dl > 0 ? 'up' : dl < 0 ? 'dn' : '' }, 'A ' + a + ' → ' + (dl > 0 ? '+' : '') + dl) : null, h('b', null, String(v))),
    h('div', { cls:'mx-bar' }, h('i', { style:'width:' + v + '%' }), A ? h('u', { style:'left:' + a + '%' }) : null), h('small', null, (sc.reasons[k] || []).join(' · '))); }); }
function curveSvg(c, A){ const W = 600, H = 150, T = Math.max(c.total, A ? A.curve.total : 0), x = t => 30 + (W - 40) * t / T, y = p => H - 18 - (H - 30) * p;
  const line = (cc, cls) => `<polyline class="${cls}" points="${cc.pts.map(([t, p]) => x(t).toFixed(1) + ',' + y(p).toFixed(1)).join(' ')}"/>`;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="mx-svg" role="img" aria-label="Áp lực dự báo"><rect x="30" y="${y(1)}" width="${W - 40}" height="${y(0) - y(1)}" class="bg"/>`;
  for(const g of [0.18, 0.58]) s += `<line x1="30" x2="${W - 10}" y1="${y(g)}" y2="${y(g)}" class="thr"/>`;
  for(let m = 0; m <= T; m += T > 20 ? 5 : 2) s += `<text x="${x(m)}" y="${H - 4}" class="ax">${m}′</text>`;
  for(const mk of c.marks) s += `<line x1="${x(mk.t)}" x2="${x(mk.t)}" y1="${y(1)}" y2="${y(0)}" class="mk"/><text x="${x(mk.t) + 2}" y="${y(1) + 9}" class="ml">${mk.label}</text>`;
  if(A) s += line(A.curve, 'a'); s += line(c, 'b'); return s + '</svg>'; }
function paintRight(){ const sc = D.sc, n = D.n, A = D.A ? evalSpec(D.A) : null, R = $('#mxRight');
  R.replaceChildren(h('div', { cls:'mx-top' }, h('div', { cls:'mx-min' }, h('b', null, fmt(sc.minutes)), h('span', null, 'phút' + (A ? ' (A ' + fmt(A.sc.minutes) + ')' : ''))),
      h('div', { cls:'mx-meta' }, n.plan.structure.sectors ? n.plan.structure.sectors.join(' → ') : n.plan.params['enemy.waves'].v + ' đợt + tướng', h('br'), n.plan.knobs.length + ' núm game · hạt ' + n.plan.seed)),
    h('div', { cls:'mx-meters' }, meters(sc, A)));
  const cv = h('div', { cls:'mx-curve' }); cv.innerHTML = curveSvg(D.curve, A); R.append(h('h4', null, 'Áp lực dự báo' + (A ? ' — A (nét đứt) / hiện tại' : '')), cv);
  R.append(h('h4', null, 'Cảnh báo (' + sc.warnings.length + ')'), h('div', { cls:'mx-warn' }, sc.warnings.length ? sc.warnings.map(w => h('span', { cls:'mx-chip ' + w.id }, w.vi)) : h('span', { cls:'mx-chip ok' }, 'Không có')));
  R.append(h('h4', null, 'Bị kéo về (' + n.clamped.length + ')'), h('ul', { cls:'mx-clamp' }, n.clamped.map(c => h('li', null, h('code', null, c.key), ' ', fmt(c.from), ' → ', h('b', null, fmt(c.to)), h('small', null, ' — ' + c.why)))));
  const kn = h('details', { cls:'mx-plan' }, h('summary', null, 'Kế hoạch: ' + n.plan.knobs.length + ' tham số game'), h('ul', null, n.plan.knobs.map(q => h('li', null, h('i', null, q.read), ' ', h('code', null, q.path), ' ', fmt(q.from), ' → ', h('b', null, fmt(q.to))))));
  R.append(kn); paintLog(R); }
function paintLog(R){ const L = ld(KEY.log, []).slice(-10).reverse(); R.append(h('h4', { id:'mxLog' }, 'Nhật ký đánh thử (dự báo → đo)'));
  if(!L.length){ R.append(h('p', { cls:'mx-note' }, 'Chưa có trận nào. Bấm ĐÁNH THỬ, đánh xong bấm VỀ BÀN TRỘN.')); return; }
  R.append(h('table', { cls:'mx-log' }, h('tr', null, ['Trận', 'Khó', 'Phút dự / đo', 'Áp lực TB / đỉnh', 'Máu mất / phút', 'Hạ / phút dự / đo', 'Chết', 'Kết'].map(t => h('th', null, t))),
    L.map((e, i) => h('tr', { cls:i === 0 && location.hash === '#log' ? 'new' : '' }, h('td', null, e.name || e.id || '—'), h('td', null, String(e.score.difficulty)), h('td', null, fmt(e.score.minutes) + ' / ' + fmt(e.meas.min)),
      h('td', null, fmt(e.meas.pMean) + ' / ' + fmt(e.meas.pPeak)), h('td', null, fmt(e.meas.dpm)), h('td', null, fmt(e.score.kpm) + ' / ' + fmt(e.meas.kpm)), h('td', null, String(e.meas.deaths)), h('td', null, e.meas.won ? 'thắng' : 'thua'))))); }

// ---- presets, files, A/B, ĐÁNH THỬ ----
function presets(){ const s = $('#mxPreset'), saved = ld(KEY.saved, {}); s.replaceChildren(h('option', { value:'' }, '— Mẫu / đã lưu —'),
  h('optgroup', { label:'Mẫu' }, EXAMPLES.map(x => h('option', { value:'ex:' + x }, x))), h('optgroup', { label:'Chinh phạt 10 thành' }, M.presets.conquest.map((x, i) => h('option', { value:'cq:' + i }, x.name))),
  h('optgroup', { label:'Đã lưu' }, Object.keys(saved).map(x => h('option', { value:'sv:' + x }, x)))); }
function loadPreset(v){ if(!v) return; const [t, x] = [v.slice(0, 2), v.slice(3)];
  if(t === 'ex') fetch('tools/specs/' + x + '.json').then(r => r.json()).then(setSpec); else if(t === 'cq') setSpec(M.presets.conquest[+x]); else if(t === 'sv') setSpec(ld(KEY.saved, {})[x]); }
function init(){ D.spec = ld(KEY.cur, null) || blank(); presets(); if(matchMedia('(pointer:coarse)').matches){ D.device = 'phone'; $('#mxDev').value = 'phone'; }   // (a phone's budgets on a phone)
  $('#mxPreset').addEventListener('change', e => loadPreset(e.target.value)); $('#mxName').addEventListener('input', e => { D.spec.name = e.target.value; sv(KEY.cur, D.spec); });
  $('#mxNew').addEventListener('click', () => setSpec(blank()));
  $('#mxSave').addEventListener('click', () => { const S = ld(KEY.saved, {}), nm = D.spec.name || 'spec'; S[nm] = D.spec; sv(KEY.saved, S); presets(); flash('Đã lưu: ' + nm); });
  $('#mxDown').addEventListener('click', () => { const a = h('a', { href:URL.createObjectURL(new Blob([JSON.stringify(D.n.spec, null, 1)], { type:'application/json' })), download:(D.spec.id || D.spec.name || 'spec').replace(/\W+/g, '-') + '.json' }); a.click(); });
  $('#mxUp').addEventListener('change', e => { const f = e.target.files[0]; if(f) f.text().then(t => setSpec(JSON.parse(t))).catch(() => flash('Tệp không đọc được')); });
  $('#mxPin').addEventListener('click', () => { D.A = JSON.parse(JSON.stringify(D.spec)); $('#mxAB').hidden = false; flash('Đã ghim làm A'); upd(); });
  $('#mxSwap').addEventListener('click', () => { if(!D.A) return; const b = D.spec; setSpec(D.A); D.A = b; upd(); });
  $('#mxUnpin').addEventListener('click', () => { D.A = null; $('#mxAB').hidden = true; upd(); });
  $('#mxDev').addEventListener('change', e => { D.device = e.target.value; upd(); });
  $('#mxGo').addEventListener('click', () => { try{ sessionStorage.setItem(KEY.spec, JSON.stringify(D.spec)); }catch(e){} location.href = 'index.html?spec=_session&desk=1'; });
  build(); upd(); if(location.hash === '#log') setTimeout(() => { const e = $('#mxLog'); if(e) e.scrollIntoView({ block:'start' }); }, 300); }
function flash(t){ const e = $('#mxFlash'); e.textContent = t; e.classList.add('on'); clearTimeout(flash.t); flash.t = setTimeout(() => e.classList.remove('on'), 1600); }
export function mixDeskOn(){ return !!D.spec; }
if(typeof document !== 'undefined' && document.getElementById('mixDesk')) init();
