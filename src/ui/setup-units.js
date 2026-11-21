// ui/setup-units.js — Z354 WHO GOES INTO BATTLE (the first two steps of CHUẨN BỊ TRẬN, ui/battle-setup.js runs the steps): ① BINH CHỦNG — two big cards,
//   THIẾT GIÁP (the tank) and BỘ BINH (the soldier), each saying what that war is about · ② TRANG BỊ — the tank: the hull from the garage with its armour /
//   speed / turn and the guns it carries, the garage and the arsenal a tap away (they come back here) · the soldier: who he is (two troopers, the look
//   is his choice) and what carries him — the war horse he rides himself, or the xe ôm / ba gác / bán tải and the bác tài who drives it — with
//   honest bars (how quick, how tough, how wide he can fire) and what the driver does for him. Every picture is a photo from the game (assets/units).
//   Also the loadout chips in the footer and the "ĐỘI HÌNH XUẤT KÍCH" strip on the briefing.
import { TROOPER } from '../../config.js';
import { GUNS, MODE, PROFILE, currentTank, gunPicEl, loadoutGuns, openGarage, openLoadout, saveProfile, sfx, tankModel, tankPicHTML, tapEl } from '../hub.js';

const PIC = k => 'assets/units/' + k + '.webp';
export const RIDES = {
  cav:    { nm:'CHIẾN MÃ', sub:'tự cưỡi · phi nước đại', drv:false, bars:[5, 3, 3], tx:'Không có bác tài — anh tự cưỡi. Phi nước đại thì giẫm ngã lính địch; xoay người trên yên để bắn ra sau.' },
  xeom:   { nm:'XE ÔM', sub:'bác tài chở · anh ngồi sau', drv:true, bars:[4, 2, 4], tx:'Gọn và nhanh luồn phố. Bác tài lái, anh ngồi yên sau xoay người bắn gần trọn vòng.' },
  bagac:  { nm:'BA GÁC', sub:'bác tài lái · anh đứng thùng', drv:true, bars:[3, 3, 5], tx:'Thùng hàng rộng phía sau: anh đứng bắn quanh mình, xe chịu đòn tốt hơn xe ôm.' },
  bantai: { nm:'BÁN TẢI', sub:'bác tài lái · khung chống lật', drv:true, bars:[3, 5, 5], tx:'Nặng và lì nhất: húc văng vật cản, khung chống lật che anh đứng trên thùng xe.' },
};
export const TROOPERS = {
  s2: { nm:'LÍNH ĐẶC NHIỆM', sub:'giáp đủ đồ · kính nhìn đêm · tai nghe' },
  op: { nm:'LÍNH THÉP', sub:'rằn ri · ba lô chiến đấu · operator cũ' },
};
const BARS = ['CƠ ĐỘNG', 'BỀN', 'GÓC BẮN'];
export const isSoldier = () => (PROFILE.unit || 'tank') !== 'tank';
const rideOf = () => RIDES[PROFILE.unit] ? PROFILE.unit : (PROFILE.lastRide && RIDES[PROFILE.lastRide] ? PROFILE.lastRide : 'xeom');
const trooperOf = () => TROOPERS[PROFILE.trooper] ? PROFILE.trooper : 's2';
const el = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; };
const img = (src, cls) => { const i = new Image(); i.decoding = 'async'; i.alt = ''; i.className = cls || ''; i.src = src; i.onload = () => i.classList.add('in'); return i; };
const pips = (n, of = 5) => '<span class="su-pips">' + Array.from({ length:of }, (_, i) => '<i' + (i < n ? ' class="on"' : '') + '></i>').join('') + '</span>';
const bar = (lbl, k) => '<div class="su-bar"><span>' + lbl + '</span><i><b style="width:' + Math.round(Math.max(0.06, Math.min(1, k)) * 100) + '%"></b></i></div>';
// a tank's stat as a bar: 0.7× → near empty, 1.4× → full
const tk = v => (v - 0.62) / 0.8;
function pick(k){ if(k === 'tank'){ PROFILE.unit = 'tank'; } else { PROFILE.unit = rideOf(); PROFILE.lastRide = PROFILE.unit; } saveProfile(); }
// ---- ① BINH CHỦNG ----
export function renderModes(host, onPick){ host.replaceChildren(); const sol = isSoldier(), T = tankModel(currentTank()), R = RIDES[rideOf()];
  const card = (k, on, art, kick, nm, tag, list, now) => { const c = el('div', 'su-mode ' + k + (on ? ' on' : '')); c.dataset.pad = '1';
    c.appendChild(img(art, 'su-art')); c.appendChild(el('i', 'su-shade'));
    c.appendChild(el('div', 'su-mtx', '<small>' + kick + '</small><h3>' + nm + '</h3><p>' + tag + '</p><ul>' + list.map(t => '<li>' + t + '</li>').join('') + '</ul><div class="su-now">' + now + '</div>'));
    c.appendChild(el('div', 'su-check', '✓ ĐÃ CHỌN')); tapEl(c, () => { pick(k); sfx('click'); onPick(k); }); host.appendChild(c); };
  card('tank', !sol, PIC('tank'), 'BINH CHỦNG · THIẾT GIÁP', 'XE TĂNG', 'Cầm lái một cỗ xe tăng — giữ Lõi căn cứ, phá vòng vây thiết giáp địch.',
    ['Gara xe tăng · kho súng · cửa hàng nâng cấp', 'Kíp lính trên nóc, súng máy nóc xe', 'Cán nát bộ binh, húc đổ vật cản', 'Đấu tay đôi với siêu xe tăng của tướng'], 'ĐANG DÙNG · ' + T.name.split(' ')[0]);
  card('inf', sol, PIC('xeom'), 'BINH CHỦNG · BỘ BINH', 'NGƯỜI LÍNH', 'Một người lính, một bác tài, một tổ đồng đội — lên quân hàm giữa trận.',
    ['Quân hàm Binh nhì → Đại tá, chọn thẻ sức mạnh', 'Tổ đồng đội: xạ thủ máy, y tá, lính B40…', 'Nhặt súng của địch, súng lên ★', 'Hạ xe tướng rồi đấu tay đôi với tướng bộ chiến'],
    TROOPERS[trooperOf()].nm + ' · ' + R.nm + (R.drv ? ' · BÁC TÀI' : '')); }
// ---- ② TRANG BỊ ----
export function renderGear(host, refresh){ host.replaceChildren(); if(isSoldier()) soldierGear(host, refresh); else tankGear(host); }
function tankGear(host){ const id = currentTank(), M = tankModel(id), st = M.stats || {}, wrap = el('div', 'su-eq tank');
  const card = el('div', 'su-tank'); card.appendChild(el('div', 'su-tpic', tankPicHTML(id, 'su-tankpic')));
  card.appendChild(el('div', 'su-tinfo', '<small>' + (M.origin || 'XE TĂNG') + '</small><h3>' + M.name + '</h3><p>' + (M.role || '') + '</p>' +
    bar('GIÁP', tk(st.hp || 1)) + bar('TỐC ĐỘ', tk(st.spd || 1)) + bar('BỨT TỐC', tk(st.acc || 1)) + bar('XOAY XE', tk(st.turn || 1)))); wrap.appendChild(card);
  const side = el('div', 'su-tside'); side.appendChild(el('div', 'su-h', 'SÚNG MANG THEO'));
  const guns = el('div', 'su-guns'); for(const g of loadoutGuns()){ const d = GUNS[g.id]; if(!d) continue; const c = el('div', 'su-gun'); c.appendChild(gunPicEl(g.id, 'su-gpic')); c.appendChild(el('span', '', d.name)); guns.appendChild(c); } side.appendChild(guns);
  const btns = el('div', 'su-btns');
  for(const [t, fn] of [['GARA · ĐỔI XE', openGarage], ['KHO SÚNG · ĐỔI SÚNG', openLoadout]]){ const b = el('div', 'btn su-btn', t); b.dataset.pad = '1'; tapEl(b, fn); btns.appendChild(b); }
  side.appendChild(btns);
  side.appendChild(el('div', 'su-drv self su-play', '<b>TRONG TRẬN</b><span>Giữ Lõi căn cứ, phá mục tiêu của màn, hạ siêu xe tăng của tướng.</span><ul><li><kbd>Cách</kbd> lướt né đạn</li><li><kbd>E</kbd> kỹ năng · <kbd>Q</kbd> đổi kỹ năng</li><li><kbd>R</kbd>/<kbd>F</kbd> đổi súng</li><li><kbd>G</kbd> kíp lính xuống xe đánh bộ</li><li>Cán qua bộ binh địch</li></ul>'));
  side.appendChild(el('div', 'su-note', 'Nâng cấp ở cửa hàng, bộ đồ nghề gara và kíp lính đều theo xe vào trận.')); wrap.appendChild(side); host.appendChild(wrap); }
function soldierGear(host, refresh){ const wrap = el('div', 'su-eq inf'), tr = trooperOf(), rd = rideOf();
  const men = el('div', 'su-col su-men'); men.appendChild(el('div', 'su-h', 'NGƯỜI LÍNH <small>· ngoại hình, sức mạnh như nhau</small>'));
  const mg = el('div', 'su-mgrid'); for(const [k, T] of Object.entries(TROOPERS)){ const c = el('div', 'su-man' + (k === tr ? ' on' : '')); c.dataset.pad = '1'; c.appendChild(img(PIC(k), 'su-ph'));
    c.appendChild(el('div', 'su-cap', '<b>' + T.nm + '</b><small>' + T.sub + '</small>')); tapEl(c, () => { PROFILE.trooper = k; saveProfile(); sfx('click'); refresh(); }); mg.appendChild(c); }
  men.appendChild(mg); const S0 = TROOPER.squad.start.map(r => r === 'mg' ? 'xạ thủ máy' : r === 'medic' ? 'y tá' : r).join(' + ');
  men.appendChild(el('div', 'su-sq', '<b>TỔ ĐỒNG ĐỘI</b> ' + S0 + ' · thêm người khi lên quân hàm')); wrap.appendChild(men);
  const rides = el('div', 'su-col su-rides'); rides.appendChild(el('div', 'su-h', 'PHƯƠNG TIỆN · BÁC TÀI'));
  const rg = el('div', 'su-rgrid'); for(const [k, R] of Object.entries(RIDES)){ const c = el('div', 'su-ride' + (k === rd ? ' on' : '')); c.dataset.pad = '1'; c.appendChild(img(PIC(k), 'su-ph'));
    c.appendChild(el('div', 'su-badge' + (R.drv ? '' : ' self'), R.drv ? 'BÁC TÀI LÁI' : 'TỰ CƯỠI'));
    c.appendChild(el('div', 'su-cap', '<b>' + R.nm + '</b><small>' + R.sub + '</small>' + BARS.map((l, i) => '<div class="su-pr"><span>' + l + '</span>' + pips(R.bars[i]) + '</div>').join('')));
    tapEl(c, () => { PROFILE.unit = PROFILE.lastRide = k; saveProfile(); sfx('click'); refresh(); }); rg.appendChild(c); }
  rides.appendChild(rg); wrap.appendChild(rides);
  const R = RIDES[rd]; wrap.appendChild(el('div', 'su-drv' + (R.drv ? '' : ' self'), R.drv
    ? '<b>BÁC TÀI · ' + R.nm + '</b><span>' + R.tx + '</span><ul><li>Lái theo hướng anh điều khiển — anh chỉ việc ngắm và bắn</li><li>Xe ngã: bác hấp tấp bò lại dựng xe</li><li>Xuống xe đánh bộ: bấm <kbd>G</kbd> gọi bác tới đón</li><li>Anh gục: bác quỳ xuống đầu hàng bên cạnh</li></ul>'
    : '<b>CHIẾN MÃ · KHÔNG BÁC TÀI</b><span>' + R.tx + '</span><ul><li>Giữ tăng tốc để phi nước đại</li><li>Xuống ngựa đánh bộ: bấm <kbd>G</kbd> huýt gọi ngựa về</li><li>Trúng đòn nặng, ngựa có thể hất anh xuống</li></ul>'));
  host.appendChild(wrap); }
// ---- the footer's loadout chips (a tap goes back to that step) ----
export function loadoutChips(host, goStep){ host.replaceChildren(); const add = (t, s, step) => { const c = el('div', 'su-chip', t + (s ? '<small>' + s + '</small>' : '')); c.dataset.pad = '1'; tapEl(c, () => { sfx('click'); goStep(step); }); host.appendChild(c); };
  if(!isSoldier()){ const M = tankModel(currentTank()); add('XE TĂNG', 'thiết giáp', 1); add(M.name.split(' ')[0], loadoutGuns().length + ' khẩu súng', 2); return; }
  const R = RIDES[rideOf()]; add('NGƯỜI LÍNH', 'bộ binh', 1); add(TROOPERS[trooperOf()].nm, 'người lính', 2); add(R.nm, R.drv ? 'bác tài lái' : 'tự cưỡi', 2); }
// ---- the briefing: who is going in ----
export function briefTeam(){ const host = document.getElementById('br-team'); if(!host) return; host.replaceChildren();
  const tile = (src, html, cls) => { const t = el('div', 'br-tm' + (cls ? ' ' + cls : '')); if(src) t.appendChild(img(src, 'br-tmp')); else t.appendChild(el('div', 'br-tmp', html[1])); t.appendChild(el('div', 'br-tmt', html[0])); host.appendChild(t); };
  if(MODE.id !== 'soldier'){ const id = currentTank(), M = tankModel(id); tile(null, ['<small>XE TĂNG</small><b>' + M.name.split(' ')[0] + '</b>', tankPicHTML(id, 'br-tpic')]);
    tile(null, ['<small>SÚNG</small><b>' + loadoutGuns().map(g => (GUNS[g.id] || {}).name).filter(Boolean).slice(0, 3).join(' · ') + '</b>', '<span class="br-ic">' + loadoutGuns().length + '</span>'], 'wide'); return; }
  const R = RIDES[rideOf()], T = TROOPERS[trooperOf()];
  tile(PIC(trooperOf()), ['<small>NGƯỜI LÍNH</small><b>' + T.nm + '</b>']); tile(PIC(rideOf()), ['<small>' + (R.drv ? 'BÁC TÀI LÁI' : 'TỰ CƯỠI') + '</small><b>' + R.nm + '</b>']);
  tile(null, ['<small>TỔ ĐỒNG ĐỘI</small><b>Xạ thủ máy · Y tá</b>', '<span class="br-ic">2</span>'], 'wide'); }
