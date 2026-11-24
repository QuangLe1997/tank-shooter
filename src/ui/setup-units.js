// ui/setup-units.js — Z354 WHO GOES INTO BATTLE (TRANG BỊ, the first step of CHUẨN BỊ TRẬN, ui/battle-setup.js runs the steps; no-tanks: no
//   BINH CHỦNG step, the soldier is the only unit): who he is (two troopers, the look is his choice) and what carries him — the war horse he rides himself, or the xe ôm / ba gác / bán tải and the bác tài who drives it — with
//   honest bars (how quick, how tough, how wide he can fire) and what the driver does for him. Every picture is a photo from the game (assets/units).
//   Also the loadout chips in the footer and the "ĐỘI HÌNH XUẤT KÍCH" strip on the briefing.
import { TROOPER } from '../../config.js';
import { GUNS, KIT_GUN, PRIMARY_GUNS, PROFILE, capVi, gunPicEl, saveProfile, sfx, tapEl } from '../hub.js';

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
const BARS = ['Cơ động', 'Độ bền', 'Góc bắn'];
let _pgX = 0;   // (Z411 where the row of guns was slid to)
const rideOf = () => RIDES[PROFILE.unit] ? PROFILE.unit : (PROFILE.lastRide && RIDES[PROFILE.lastRide] ? PROFILE.lastRide : 'xeom');
const trooperOf = () => TROOPERS[PROFILE.trooper] ? PROFILE.trooper : 's2';
const el = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; };
const img = (src, cls) => { const i = new Image(); i.decoding = 'async'; i.alt = ''; i.className = cls || ''; i.src = src; i.onload = () => i.classList.add('in'); return i; };
const pips = (n, of = 5) => '<span class="su-pips">' + Array.from({ length:of }, (_, i) => '<i' + (i < n ? ' class="on"' : '') + '></i>').join('') + '</span>';
// ---- ② TRANG BỊ ----
export function renderGear(host, refresh){ host.replaceChildren(); soldierGear(host, refresh); }
function soldierGear(host, refresh){ const wrap = el('div', 'su-eq inf'), tr = trooperOf(), rd = rideOf();
  const men = el('div', 'su-col su-men'); men.appendChild(el('div', 'su-h', 'Người lính <small>khác ngoại hình, sức mạnh như nhau</small>'));
  const mg = el('div', 'su-mgrid'); for(const [k, T] of Object.entries(TROOPERS)){ const c = el('div', 'su-man' + (k === tr ? ' on' : '')); c.dataset.pad = '1'; c.appendChild(img(PIC(k), 'su-ph'));
    c.appendChild(el('div', 'su-cap', '<b>' + capVi(T.nm) + '</b><small>' + T.sub + '</small>')); tapEl(c, () => { PROFILE.trooper = k; saveProfile(); sfx('click'); refresh(); }); mg.appendChild(c); }
  men.appendChild(mg); const S0 = TROOPER.squad.start.map(r => r === 'mg' ? 'xạ thủ máy' : r === 'medic' ? 'y tá' : r).join(' + ');
  men.appendChild(el('div', 'su-sq', '<b>Tổ đồng đội</b> ' + S0 + ', thêm người khi lên quân hàm')); wrap.appendChild(men);
  const rides = el('div', 'su-col su-rides'); rides.appendChild(el('div', 'su-h', 'Phương tiện <small>ngựa tự cưỡi, hoặc xe có bác tài lái</small>'));
  const rg = el('div', 'su-rgrid'); for(const [k, R] of Object.entries(RIDES)){ const c = el('div', 'su-ride' + (k === rd ? ' on' : '')); c.dataset.pad = '1'; c.appendChild(img(PIC(k), 'su-ph'));
    c.appendChild(el('div', 'su-badge' + (R.drv ? '' : ' self'), R.drv ? 'Bác tài lái' : 'Tự cưỡi'));
    c.appendChild(el('div', 'su-cap', '<b>' + capVi(R.nm) + '</b><small>' + R.sub + '</small>' + BARS.map((l, i) => '<div class="su-pr"><span>' + l + '</span>' + pips(R.bars[i]) + '</div>').join('')));
    tapEl(c, () => { PROFILE.unit = PROFILE.lastRide = k; saveProfile(); sfx('click'); refresh(); }); rg.appendChild(c); }
  rides.appendChild(rg); wrap.appendChild(rides);
  // Z359 the rifle he carries in (the B41 always comes too); the rest he finds on the field · Z411 every one of his guns (PRIMARY_GUNS), four in view and the
  //   row slid sideways for the rest (where it was left, the one picked always in view), the B41 last, marked as always carried
  const gk = PRIMARY_GUNS.includes(PROFILE.trooperGun) ? PROFILE.trooperGun : 'carbine', gw = el('div', 'su-pg'); gw.appendChild(el('div', 'su-h', 'Súng chính <small>' + PRIMARY_GUNS.length + ' khẩu, luôn kèm B41 — súng khác nhặt trong trận</small>'));
  const gg = el('div', 'su-pgrid'); for(const id of [...PRIMARY_GUNS, KIT_GUN]){ const G = GUNS[id], kit = id === KIT_GUN, c = el('div', 'su-pgun' + (id === gk ? ' on' : '') + (kit ? ' kit' : '')); if(!kit) c.dataset.pad = '1'; c.appendChild(gunPicEl(id, 'su-pgpic'));
    c.appendChild(el('div', 'su-pgtx', '<b>' + G.name + '</b>' + (kit ? '<small class="su-kit">Luôn mang theo</small>' : '') + [['Sát thương', G.dmg * (G.frags || 1) / 16], ['Nhịp bắn', 0.068 / G.fireCd], ['Tầm', (G.rng || 1) / 1.15]].map(([l, k]) => '<div class="su-pr"><span>' + l + '</span>' + pips(Math.max(1, Math.round(k * 5))) + '</div>').join('')));
    if(!kit) tapEl(c, () => { PROFILE.trooperGun = id; saveProfile(); sfx('click'); refresh(); }); gg.appendChild(c); }
  gg.addEventListener('scroll', () => { _pgX = gg.scrollLeft; }, { passive:true });
  const place = () => { gg.scrollLeft = _pgX; const on = gg.querySelector('.su-pgun.on'); if(!on) return; const a = on.getBoundingClientRect(), b = gg.getBoundingClientRect();
    if(a.left < b.left || a.right > b.right) gg.scrollLeft += a.left - b.left - (b.width - a.width) / 2; };
  if(typeof ResizeObserver === 'function'){ const ro = new ResizeObserver(() => { if(gg.clientWidth){ ro.disconnect(); place(); } }); ro.observe(gg); } else requestAnimationFrame(place);   // (once the step is shown and the row has a width)
  gw.appendChild(gg); wrap.appendChild(gw);
  const R = RIDES[rd]; wrap.appendChild(el('div', 'su-drv' + (R.drv ? '' : ' self'), R.drv
    ? '<b>Bác tài — ' + capVi(R.nm) + '</b><span>' + R.tx + '</span><ul><li>Lái theo hướng anh điều khiển — anh chỉ việc ngắm và bắn</li><li>Xe ngã: bác hấp tấp bò lại dựng xe</li><li>Xuống xe đánh bộ: bấm <kbd>G</kbd> gọi bác tới đón</li><li>Anh gục: bác quỳ xuống đầu hàng bên cạnh</li></ul>'
    : '<b>Chiến mã — không có bác tài</b><span>' + R.tx + '</span><ul><li>Giữ tăng tốc để phi nước đại</li><li>Xuống ngựa đánh bộ: bấm <kbd>G</kbd> huýt gọi ngựa về</li><li>Trúng đòn nặng, ngựa có thể hất anh xuống</li></ul>'));
  host.appendChild(wrap); }
// ---- the footer's loadout chips (a tap goes back to that step) ----
export function loadoutChips(host, goStep){ host.replaceChildren(); const add = (t, s, step) => { const c = el('div', 'su-chip', t + (s ? '<small>' + s + '</small>' : '')); c.dataset.pad = '1'; tapEl(c, () => { sfx('click'); goStep(step); }); host.appendChild(c); };
  const R = RIDES[rideOf()]; add(capVi(TROOPERS[trooperOf()].nm), 'người lính', 2); add(capVi(R.nm), R.drv ? 'bác tài lái' : 'tự cưỡi', 2);   // (XK-UI the 'NGƯỜI LÍNH · bộ binh' chip went: the soldier is the only unit since no-tanks)
  add((GUNS[PRIMARY_GUNS.includes(PROFILE.trooperGun) ? PROFILE.trooperGun : 'carbine'] || {}).name || 'SÚNG', 'súng chính', 2); }
// ---- the briefing: who is going in ----
export function briefTeam(){ const host = document.getElementById('br-team'); if(!host) return; host.replaceChildren();
  const tile = (src, html, cls) => { const t = el('div', 'br-tm' + (cls ? ' ' + cls : '')); if(src) t.appendChild(img(src, 'br-tmp')); else t.appendChild(el('div', 'br-tmp', html[1])); t.appendChild(el('div', 'br-tmt', html[0])); host.appendChild(t); };
  const R = RIDES[rideOf()], T = TROOPERS[trooperOf()];
  tile(PIC(trooperOf()), ['<small>Người lính</small><b>' + capVi(T.nm) + '</b>']); tile(PIC(rideOf()), ['<small>' + (R.drv ? 'Bác tài lái' : 'Tự cưỡi') + '</small><b>' + capVi(R.nm) + '</b>']);
  tile(null, ['<small>Tổ đồng đội</small><b>Xạ thủ máy, y tá</b>', '<span class="br-ic">2</span>'], 'wide'); }
