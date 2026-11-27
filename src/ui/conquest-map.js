// ui/conquest-map.js — CONQ 1 THE CONQUEST'S ROAD on the battle setup's "Chiến dịch" tab (config CONQUEST; the battles: campaign/conquest.js). Ten forts on
//   one road, top to bottom: taken = our flag, the next = lit, the rest = locked. A tap shows the fort's card in the hero (ui/battle-setup.js setHero): the
//   fort, its general, the approach mission, the treasure to win and the one to bring; XUẤT KÍCH goes in (a taken fort again: a replay; a locked one: nothing).
import { CONQUEST, WEATHER } from '../../config.js';
import { BIOMES, TOD_LABEL, capVi, biomeVi, conqCarryFor, conqLaunch, conqState, conqStore, escapeHtml, fillTx, mapPhoto, saveProfile, setHero, sfx, svgMarkup, tapEl } from '../hub.js';

const C = CONQUEST, Y = C.say, T = C.treasures, N = C.forts.length;
export const CMAP = { sel:-1 };
const bOf = f => BIOMES.find(b => b.name === f.biome) || BIOMES[0];
const tq = (id, cls) => id && T[id] ? '<span class="cq-tqi' + (cls ? ' ' + cls : '') + '">' + svgMarkup(T[id].icon, 1.7) + '</span>' : '';
export function conqSel(){ const q = conqStore(); if(CMAP.sel < 0 || CMAP.sel >= N) CMAP.sel = q.sel >= 0 && q.sel < N ? Math.min(q.sel, q.cap < N ? q.cap : N - 1) : Math.min(q.cap, N - 1); return CMAP.sel; }
export function buildConquest(){ const g = document.getElementById('bsLadder'); if(!g) return; const q = conqStore(), sel = conqSel(); g.replaceChildren(); g.classList.add('cq-road'); g.style.setProperty('--cq-fill', Math.round(Math.min(1, (q.cap + 0.5) / N) * 100) + '%');
  const hint = document.querySelector('#bsCampaign .bs-hint'); if(hint) hint.textContent = Y.hint;
  for(let i = 0; i < N; i++){ const f = C.forts[i], st = conqState(i), w = document.createElement('div'), c = document.createElement('div');
    w.className = 'cq-step ' + st + (i === sel ? ' on' : ''); w.dataset.i = i;
    w.insertAdjacentHTML('beforeend', '<span class="cq-node">' + (st === 'taken' ? svgMarkup('flag', 2) : st === 'lock' ? svgMarkup('lock', 2) : '<b>' + (i + 1) + '</b>') + '</span>');
    c.className = 'bs-lv cq-fort ' + st + (i === sel ? ' on' : '') + (i === N - 1 ? ' boss' : ''); c.setAttribute('role', 'button'); c.dataset.biome = f.biome.toLowerCase();
    c.appendChild(mapPhoto(bOf(f), 'bs-ph'));
    c.insertAdjacentHTML('beforeend', '<div class="cq-ft"><small>' + escapeHtml(fillTx(Y.fort, { n:i + 1 })) + '</small><b>' + escapeHtml(f.name) + '</b><span>' + escapeHtml(f.boss) + ' · ' + escapeHtml(capVi(biomeVi(f.biome))) + '</span></div>'
      + '<div class="bs-st ' + (st === 'taken' ? 'ok' : st === 'next' ? 'go' : 'lk') + '">' + escapeHtml(st === 'taken' ? Y.taken : st === 'next' ? Y.next : Y.locked) + '</div>' + tq(f.prize, i < q.cap ? 'got' : ''));
    c.title = f.name; tapEl(c, () => { CMAP.sel = i; q.sel = i; saveProfile(true); buildConquest(); refreshConqSum(); sfx('click'); });
    w.appendChild(c); g.appendChild(w); }
  const on = g.querySelector('.cq-step.on'); if(on) requestAnimationFrame(() => on.scrollIntoView({ block:'nearest', inline:'nearest' }));
  conqCard(sel); }
function refreshConqSum(){ const el = document.getElementById('bsSum'); if(el) el.innerHTML = conqSummary(); }
// the fort's card in the hero: the photo of its land, its name and general, the approach, the treasure to win and the one to bring
export function conqCard(i){ const f = C.forts[i], st = conqState(i), P = f.prize && T[f.prize], R = f.rec && T[f.rec], b = bOf(f), carry = conqCarryFor(i);
  const fact = (lb, v, sm, ic) => '<div class="bs-fact cq-fact"><span>' + lb + '</span><b>' + (ic || '') + escapeHtml(v) + '</b><small>' + escapeHtml(sm) + '</small></div>';
  setHero(b, { kick:fillTx(Y.fort, { n:i + 1 }) + ' · ' + C.acts[f.act], name:f.name, place:'Tướng giữ thành: ' + f.boss + ' · ' + capVi(biomeVi(f.biome)) + ' · ' + capVi(TOD_LABEL[f.tod] || '').toLocaleLowerCase('vi') + ', ' + WEATHER[f.wx].vi.toLocaleLowerCase('vi'),
    blurb:escapeHtml(f.blurb) + '<br><b>Tiếp cận:</b> ' + escapeHtml(f.go.tx) + '.', tod:f.tod, wx:f.wx,
    badges:(st === 'taken' ? '<span class="bs-badge cq-taken">' + Y.taken + '</span>' : '') + (i === N - 1 ? '<span class="bs-badge boss">Trùm cuối</span>' : '') + (st === 'lock' ? '<span class="bs-badge cq-lock">' + escapeHtml(Y.locked) + '</span>' : ''),
    facts:fact('Tiếp cận', f.go.kind === 'rescue' ? 'Giải cứu' : 'Phá mục tiêu', f.go.tx)
      + fact('Báu vật nhận', P ? P.name : 'Kết thúc chiến tranh', P ? P.fx : 'Lõi được giữ', P ? tq(f.prize) : '')
      + fact('Khuyên mang', R ? R.name : 'Không cần', R ? (carry.includes(f.rec) ? '✓ đang mang · ' : (st === 'lock' || !conqStore().cap ? '' : 'chưa mang · ')) + f.threat.vi : 'thành đầu tiên', R ? tq(f.rec) : '')
      + fact('Độ khó', '★'.repeat(Math.min(5, 1 + Math.floor((f.lvl - 1) / 2))), 'địch cấp ' + f.lvl) }); }
export function conqSummary(){ const i = conqSel(), f = C.forts[i], st = conqState(i); return '<b>' + escapeHtml(fillTx(Y.fort, { n:i + 1 })) + '</b> ' + escapeHtml(f.name) + ' · ' + escapeHtml(f.boss) + (st === 'lock' ? ' · <i>' + escapeHtml(Y.locked) + '</i>' : st === 'taken' ? ' · ' + escapeHtml(Y.taken.toLocaleLowerCase('vi')) : ''); }
// XUẤT KÍCH on the Chiến dịch tab (ui/battle-setup.js goBattle): false = the fort is locked
export function conqGo(){ return conqLaunch(conqSel()); }
// the home screen's PLAY line (ui/menus.js refreshStartUI): the next fort
export function conqPlayLine(){ const q = conqStore(), i = Math.min(q.cap, N - 1), f = C.forts[i]; return q.cap >= N ? 'Đã chiếm đủ 10 thành' : fillTx(Y.fort, { n:i + 1 }) + ' · ' + f.name + ' · ' + f.boss; }
