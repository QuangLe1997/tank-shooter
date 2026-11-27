// ui/medals-ui.js — MEDAL 3 THE CAREER ON SCREEN: the shoulder board a rank wears, the medal discs, a medal's toast and the rank-up card in battle, the battle
//   report over an end screen (best moments, the counts, the XP bar filling to the next rank, the medals won), the Quân hàm & huân chương screen from home,
//   the rank line on the home screen, and the lock on a gun the rank has not opened (ui/loadout.js, ui/setup-units.js). Built in code (index.html stays a
//   shell), styled by css/medals.css in the XK-UI palette (olive, sand, brass; bronze / silver / gold only on the medals).
import { MEDALS } from '../../config.js';
import { GUNS, MEDAL_TIER_VI, carInsignia, carRank, carRankName, carTop, escapeHtml, gunOpen, gunRankReq, hide, medalCareer, medalDef, medalMoments, sfx, show, svgMarkup,
  tapEl } from '../hub.js';

const M = () => MEDALS, fmt = n => Math.round(n).toLocaleString('vi-VN'), TIER_CLS = ['none', 'bronze', 'silver', 'gold'];
// ---- glyphs: the icon set's, plus two of the career's own ----
const OWN = { blade:'<path d="M5 19 17.5 6.5 20 4l-.6 3.2L7 19.6"/><path d="M4 16.8 7.2 20M3.2 20.8l2-2"/>',
  bike:'<circle cx="5.5" cy="16.5" r="3.2"/><circle cx="18.5" cy="16.5" r="3.2"/><path d="M5.5 16.5 9.5 9h5l4 7.5M9.5 9 8 6.5H5.5M12 13h3.5l2-4h2"/>' };
export function medalGlyph(name){ return OWN[name] ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + OWN[name] + '</svg>' : svgMarkup(name); }
// ---- the shoulder board (cấp hiệu): chevrons for the men, bars for the NCOs, one / two stripes and stars for the officers, a gold board for a general ----
const star = (x, y, r, fill) => { let d = ''; for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * q).toFixed(1) + ' ' + (y + Math.sin(a) * q).toFixed(1); } return '<path d="' + d + 'Z" fill="' + fill + '"/>'; };
export function insigniaSVG(r){ const I = carInsignia(r), gen = I.kind === 'tuong', board = gen ? '#d9a948' : '#3d4628', edge = gen ? '#f3d58e' : '#8d8a5c', mark = gen ? '#3a2a10' : '#e2b45c';
  let s = '<svg class="mdl-ins" viewBox="0 0 120 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 6h96l16 16-16 16H4z" fill="' + board + '" stroke="' + edge + '" stroke-width="2"/><circle cx="104" cy="22" r="3.2" fill="' + edge + '"/>';
  if(I.kind === 'binh') for(let i = 0; i < I.n; i++){ const x = 30 + i * 16; s += '<path d="M' + x + ' 12l12 10-12 10" fill="none" stroke="#ece0c2" stroke-width="4.5" stroke-linejoin="miter"/>'; }
  else if(I.kind === 'si') for(let i = 0; i < I.n; i++){ const x = 24 + i * 15; s += '<rect x="' + x + '" y="10" width="7" height="24" fill="' + mark + '"/>'; }
  else { if(I.kind === 'uy') s += '<rect x="6" y="19.5" width="92" height="5" fill="' + mark + '"/>'; else if(I.kind === 'ta') s += '<rect x="6" y="13.5" width="92" height="4" fill="' + mark + '"/><rect x="6" y="26.5" width="92" height="4" fill="' + mark + '"/>';
    else s += '<path d="M8 22h88" stroke="#b8862e" stroke-width="1.4" stroke-dasharray="3 3"/>';
    const n = I.n, gap = gen ? 21 : 18, x0 = 54 - (n - 1) * gap / 2; for(let i = 0; i < n; i++) s += star(x0 + i * gap, 22, gen ? 9.5 : 7.5, gen ? '#3a2a10' : '#ece0c2'); }
  return s + '</svg>'; }
// ---- a medal: the ribbon, the disc in its tier's metal, the icon struck in it ----
export function medalDiscHTML(d, tier, cls){ const t = TIER_CLS[tier || 0];
  return '<span class="mdl-disc ' + t + (cls ? ' ' + cls : '') + '"><i class="rb"></i><span class="dc">' + medalGlyph(d.ic) + '</span></span>'; }
const tierRow = (d, have) => [1, 2, 3].map(t => d.tiers[t - 1] == null ? '' : '<span class="tp ' + TIER_CLS[t] + (have >= t ? ' on' : '') + '"><i></i>' + MEDAL_TIER_VI[t].charAt(0) + MEDAL_TIER_VI[t].slice(1).toLocaleLowerCase('vi') + ' ' + d.tiers[t - 1] + '</span>').join('');
function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
// ---- the toasts in battle: one at a time, a short queue ----
const TQ = { q:[], busy:false, el:null };
function toastHost(){ if(TQ.el && TQ.el.isConnected) return TQ.el; TQ.el = el('div', 'mdl-toasts'); TQ.el.id = 'mdlToasts'; TQ.el.setAttribute('aria-live', 'polite'); document.body.appendChild(TQ.el); return TQ.el; }
export function medalToast(d, tier, v){ if(typeof document === 'undefined') return; const T = M().toast; if(TQ.q.length >= T.max) TQ.q.shift(); TQ.q.push({ d, tier, v }); if(!TQ.busy) nextToast(); }
function nextToast(){ const it = TQ.q.shift(); if(!it){ TQ.busy = false; return; } TQ.busy = true; const T = M().toast, h = toastHost(), d = it.d;
  const n = el('div', 'mdl-toast ' + TIER_CLS[it.tier], medalDiscHTML(d, it.tier) + '<span class="tx"><small>Huân chương · <em>' + capTier(it.tier) + '</em></small><b>' + escapeHtml(d.nm) + '</b><span>' + escapeHtml(d.ds) + ' · ' + fmt(it.v) + '</span></span>');
  h.appendChild(n); requestAnimationFrame(() => n.classList.add('in')); try{ sfx('powerup'); }catch(e){}
  setTimeout(() => { n.classList.remove('in'); n.classList.add('out'); setTimeout(() => { n.remove(); setTimeout(nextToast, T.gap * 1000); }, 320); }, T.hold * 1000); }
const capTier = t => { const s = MEDAL_TIER_VI[t] || ''; return s.charAt(0) + s.slice(1).toLocaleLowerCase('vi'); };
// ---- the career's rank-up in battle: the board, the new rank, what it opens ----
let _rk = null;
export function medalRankCard(r, guns){ if(typeof document === 'undefined') return; if(_rk) _rk.remove();
  const gl = (guns || []).filter(id => GUNS[id]).map(id => escapeHtml(GUNS[id].name)).join(' · ');
  _rk = el('div', 'mdl-rankup', '<small>Thăng quân hàm</small>' + insigniaSVG(r) + '<b>' + escapeHtml(capName(carRankName(r))) + '</b>' + (gl ? '<span>Mở khoá súng: ' + gl + '</span>' : '<span>Chiến công được ghi vào hồ sơ</span>'));
  document.body.appendChild(_rk); requestAnimationFrame(() => _rk && _rk.classList.add('in')); try{ sfx('levelup'); }catch(e){}
  const me = _rk; setTimeout(() => { me.classList.remove('in'); me.classList.add('out'); setTimeout(() => { me.remove(); if(_rk === me) _rk = null; }, 420); }, M().rankUp.hold * 1000); }
const capName = s => { s = String(s).toLocaleLowerCase('vi'); return s.charAt(0).toLocaleUpperCase('vi') + s.slice(1); };   // Binh nhất, Thiếu úy (XK-UI sentence case)
// ---- the battle report (over the end screen) ----
let _board = null;
function board(){ if(_board && _board.isConnected) return _board; _board = el('div', 'overlay hidden xk-screen mdl-board'); _board.id = 'mdlBoard'; document.body.appendChild(_board); return _board; }
export function medalBoardLater(rep){ if(typeof document === 'undefined') return; setTimeout(() => medalBoardOpen(rep), M().board.delay); }
const mmss = t => { t = Math.max(0, Math.round(t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
export function medalBoardOpen(rep){ if(!rep || typeof document === 'undefined') return; const B = board(), R = rep.res, L = rep.L, oc = rep.outcome, won = oc === 'won' || oc === 'final';
  const kick = oc === 'final' ? 'Chiến dịch hoàn thành' : won ? 'Màn ' + rep.stage + ' · đã thắng' : 'Màn ' + rep.stage + ' · thất bại', mom = medalMoments(L), top = mom[0];
  const tiles = [['Địch anh hạ', fmt(L.kills)], ['Tổ của anh hạ', fmt(L.team)], ['Bắn xa nhất', L.longest ? L.longest + ' m' : '—'], ['Đa sát', L.multiBest ? '×' + L.multiBest : '—'],
    ['Hạ gục êm', fmt(L.stealth)], ['Trúng đạn', fmt(L.hits) + ' lần'], ['Xe ôm', fmt(L.rides) + ' chuyến'], ['Thời gian', mmss(L.t)]];
  const lines = R.lines.slice().sort((a, b) => b.xp - a.xp), shown = lines.slice(0, 5), rest = lines.slice(5).reduce((s, l) => s + l.xp, 0);
  const medals = R.medals.map(m => { const d = medalDef(m.id); return d ? '<div class="mdl-won ' + TIER_CLS[m.tier] + '">' + medalDiscHTML(d, m.tier) + '<span><b>' + escapeHtml(d.nm) + '</b><small>' + capTier(m.tier) + (m.up ? ' · <em>mới</em>' : '') + '</small></span></div>' : ''; }).join('');
  const ga = R.after, up = ga.r > R.before.r, guns = (R.guns || []).filter(id => GUNS[id]).map(id => escapeHtml(GUNS[id].name)).join(' · ');
  B.innerHTML = '<header class="xk-top"><div class="xk-head"><p class="xk-kick' + (won ? '' : ' xk-lost') + '">' + kick + '</p><h2 class="xk-ttl">Báo cáo chiến đấu</h2></div>'
    + '<div class="mdl-sc"><small>Điểm</small><b>' + fmt(rep.score) + '</b></div></header>'
    + '<div class="xk-body"><div class="mdl-grid">'
    + '<section class="mdl-col">'
    + (top ? '<div class="mdl-hero"><span class="ic">' + medalGlyph(top.ic) + '</span><span><small>Khoảnh khắc đẹp nhất</small><b>' + escapeHtml(top.tx) + '</b></span></div>' : '<div class="mdl-hero quiet"><span class="ic">' + medalGlyph('rifle') + '</span><span><small>Khoảnh khắc đẹp nhất</small><b>Chưa có — lần sau hãy bắn xa, hạ liền tay hoặc ra đòn không ai hay</b></span></div>')
    + (mom.length > 1 ? '<div class="mdl-moms">' + mom.slice(1).map(m => '<div><span class="ic">' + medalGlyph(m.ic) + '</span>' + escapeHtml(m.tx) + '</div>').join('') + '</div>' : '')
    + '<div class="mdl-tiles">' + tiles.map(t => '<div><small>' + t[0] + '</small><b>' + t[1] + '</b></div>').join('') + '</div>'
    + '<div class="mdl-h">Huân chương trận này</div><div class="mdl-wonrow">' + (medals || '<p class="mdl-none">Chưa có. Điều kiện từng huân chương ở màn Quân hàm & huân chương.</p>') + '</div>'
    + '</section><section class="mdl-col mdl-rk">'
    + '<div class="mdl-rkcard"><div class="mdl-rkb">' + insigniaSVG(up ? R.before.r : ga.r) + '</div><div class="mdl-rkt"><small>Quân hàm</small><b class="nm">' + escapeHtml(capName(carRankName(up ? R.before.r : ga.r))) + '</b>'
    + '<span class="gain">+' + fmt(R.xp) + ' KN' + (R.capped ? ' <em>· chạm trần trận</em>' : '') + '</span></div></div>'
    + '<div class="mdl-xp"><i></i></div><div class="mdl-xpl"><span class="a"></span><span class="b"></span></div>'
    + '<div class="mdl-up" hidden><b>Thăng quân hàm!</b>' + (guns ? '<span>Mở khoá súng: ' + guns + '</span>' : '') + '</div>'
    + '<div class="mdl-lines">' + shown.map(l => '<div><span>' + escapeHtml(l.vi) + (l.n > 1 ? ' <small>×' + l.n + '</small>' : '') + '</span><b>+' + fmt(l.xp) + '</b></div>').join('') + (rest > 0 ? '<div><span>Khác</span><b>+' + fmt(rest) + '</b></div>' : '') + '</div>'
    + '</section></div></div>'
    + '<footer class="xk-foot"><span class="xk-hint">Kinh nghiệm và huân chương đã ghi vào hồ sơ.</span><div class="xb xb-sec" id="mdlBoardMed" role="button"><span class="ic">' + medalGlyph('star') + '</span><span>Huân chương</span></div><div class="xb xb-pri" id="mdlBoardGo" role="button" data-back="1"><span>Tiếp tục</span><span class="ic">' + svgMarkup('play') + '</span></div></footer>';
  show('mdlBoard'); B.dataset.open = '1'; fillXp(B, R);
  tapEl(B.querySelector('#mdlBoardGo'), () => medalBoardClose()); tapEl(B.querySelector('#mdlBoardMed'), () => { medalBoardClose(); openMedals('board'); }); }
// the bar: from where the rank stood to where it stands; a rank crossed fills to the end, the board changes, and it fills again from the start
function fillXp(B, R){ const bar = B.querySelector('.mdl-xp i'), a = B.querySelector('.mdl-xpl .a'), b = B.querySelector('.mdl-xpl .b'), F = M().board.fill, b0 = R.before, b1 = R.after, top = b1.r >= carTop();
  const pct = (into, need) => need > 0 ? Math.min(100, 100 * into / need) : 100, label = (r, into, need) => { a.textContent = fmt(into) + ' / ' + (need ? fmt(need) : '—') + ' KN'; b.textContent = r >= carTop() ? 'Quân hàm cao nhất' : 'Tới ' + capName(carRankName(r + 1)) + ': còn ' + fmt(need - into); };
  bar.style.transition = 'none'; bar.style.width = pct(b0.into, b0.need) + '%'; label(b0.r, b0.into, b0.need); void bar.offsetWidth;
  const end = () => { bar.style.transition = 'width ' + (F / 1000).toFixed(2) + 's cubic-bezier(.2,.7,.2,1)'; bar.style.width = (top ? 100 : pct(b1.into, b1.need)) + '%'; label(b1.r, b1.into, b1.need); };
  if(b1.r === b0.r){ requestAnimationFrame(() => requestAnimationFrame(end)); return; }
  requestAnimationFrame(() => { bar.style.transition = 'width ' + (F / 2000).toFixed(2) + 's ease-in'; bar.style.width = '100%'; });
  setTimeout(() => { if(B.dataset.open !== '1') return; const up = B.querySelector('.mdl-up'); if(up) up.hidden = false; B.querySelector('.mdl-rkb').innerHTML = insigniaSVG(b1.r); B.querySelector('.mdl-rkt .nm').textContent = capName(carRankName(b1.r));
    B.querySelector('.mdl-rkcard').classList.add('up'); try{ sfx('levelup'); }catch(e){} bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; requestAnimationFrame(end); }, F / 2 + 60); }
export function medalBoardClose(){ const B = board(); B.dataset.open = ''; hide('mdlBoard'); try{ sfx('click'); }catch(e){} }
// ---- the screen: Quân hàm & huân chương ----
let _scr = null, _from = 'start';
function screen(){ if(_scr && _scr.isConnected) return _scr; _scr = el('div', 'overlay hidden xk-screen mdl-screen'); _scr.id = 'mdlScreen'; document.body.appendChild(_scr); return _scr; }
export function openMedals(from){ _from = from || 'start'; if(_from === 'start') hide('start'); renderMedals(); show('mdlScreen'); try{ sfx('click'); }catch(e){} }
export function closeMedals(){ hide('mdlScreen'); if(_from === 'start') show('start'); try{ sfx('click'); }catch(e){} }
export function renderMedals(){ const E = screen(), c = medalCareer(), k = carRank(c.xp), got = M().list.filter(d => c.m[d.id]).length, nx = k.r < carTop() ? capName(carRankName(k.r + 1)) : '';
  const next = Object.keys(M().unlock).filter(id => GUNS[id] && gunRankReq(id) === k.r + 1).map(id => escapeHtml(GUNS[id].name)).join(' · ');
  const stats = [['Trận', fmt(c.battles)], ['Thắng', fmt(c.won)], ['Địch đã hạ', fmt(c.kills)], ['Bắn xa nhất', c.best.longest ? c.best.longest + ' m' : '—'], ['Đa sát nhất', c.best.multi ? '×' + c.best.multi : '—']];
  const cards = M().list.map(d => { const v = c.m[d.id], t = v ? v[0] : 0;
    return '<div class="mdl-card ' + TIER_CLS[t] + (t ? '' : ' locked') + '">' + medalDiscHTML(d, t) + '<div class="mc-tx"><b>' + escapeHtml(d.nm) + (v ? ' <small>×' + v[1] + '</small>' : '') + '</b><span>' + escapeHtml(d.ds) + '</span><div class="mc-tiers">' + tierRow(d, t) + '</div></div></div>'; }).join('');
  const guns = Object.keys(M().unlock).filter(id => GUNS[id]).sort((a, b) => gunRankReq(a) - gunRankReq(b)).map(id => { const open = gunOpen(id, c), r = gunRankReq(id);
    return '<div class="mdl-gun' + (open ? ' open' : '') + '"><b>' + escapeHtml(GUNS[id].name) + '</b><span>' + (open ? (r ? 'Đã mở' : 'Có sẵn') : 'Mở ở ' + escapeHtml(capName(carRankName(r)))) + '</span></div>'; }).join('');
  E.innerHTML = '<header class="xk-top"><div class="xb xb-ghost xk-back" id="mdlBack" role="button" data-back="1"><span class="ic">' + svgMarkup('back') + '</span><span>' + (_from === 'start' ? 'Trang chủ' : 'Quay lại') + '</span></div>'
    + '<div class="xk-head"><h2 class="xk-ttl">Quân hàm & huân chương</h2><p class="xk-sub">' + got + ' / ' + M().list.length + ' huân chương · ' + fmt(c.battles) + ' trận</p></div></header>'
    + '<div class="xk-body"><div class="mdl-me"><div class="mdl-rkb">' + insigniaSVG(k.r) + '</div><div class="mdl-rkt"><small>Quân hàm hiện tại</small><b class="nm">' + escapeHtml(capName(carRankName(k.r))) + '</b>'
    + '<div class="mdl-xp"><i style="width:' + (k.need ? Math.min(100, 100 * k.into / k.need) : 100).toFixed(1) + '%"></i></div><div class="mdl-xpl"><span>' + fmt(k.into) + ' / ' + (k.need ? fmt(k.need) : '—') + ' KN</span><span>' + (nx ? 'Tới ' + nx + ': còn ' + fmt(k.need - k.into) : 'Quân hàm cao nhất') + '</span></div>'
    + (next ? '<p class="mdl-next">Lên ' + nx + ' mở khoá: <b>' + next + '</b></p>' : '') + '</div>'
    + '<div class="mdl-cst">' + stats.map(s => '<div><small>' + s[0] + '</small><b>' + s[1] + '</b></div>').join('') + '</div></div>'
    + '<div class="mdl-h">Huân chương</div><div class="mdl-cards">' + cards + '</div>'
    + '<div class="mdl-h">Súng theo quân hàm <small>B41 luôn mang theo · súng chưa mở vẫn nhặt được trong trận</small></div><div class="mdl-guns">' + guns + '</div></div>';
  tapEl(E.querySelector('#mdlBack'), closeMedals); }
// ---- home: the rank under the call-sign (ui/menus.js refreshStartUI), the button into the screen ----
export function medalHomeLine(){ if(typeof document === 'undefined' || !M().on) return; const h = document.getElementById('hello'); if(!h) return; let s = document.getElementById('mdlHome');
  if(!s){ s = el('div', 'mdl-home'); s.id = 'mdlHome'; s.setAttribute('role', 'button'); s.tabIndex = 0; h.insertAdjacentElement('afterend', s); tapEl(s, () => openMedals('start')); }
  const c = medalCareer(), k = carRank(c.xp); s.innerHTML = insigniaSVG(k.r) + '<span><small>Quân hàm · huân chương ›</small><b>' + escapeHtml(capName(carRankName(k.r))) + '</b><i><u style="width:' + (k.need ? Math.min(100, 100 * k.into / k.need) : 100).toFixed(1) + '%"></u></i></span>'; }
// ---- the gun strips: is this gun his to carry in, and what does a locked one say ----
export function medalGunLock(id){ const c = medalCareer(); if(gunOpen(id, c)) return ''; return 'Mở ở ' + capName(carRankName(gunRankReq(id))); }
// (Esc / B: the nav takes the screen's data-back — the last open overlay is the report or this screen; the home's way in is the rank strip itself)
