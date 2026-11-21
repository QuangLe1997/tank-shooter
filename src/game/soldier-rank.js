// game/soldier-rank.js — Z350 THE SOLDIER'S CAREER (soldier mode only): every man he or his squad drops is experience, and experience is rank — Binh nhì
//   to Đại tá, worn as a stripe over his health bar with a thin gold line filling toward the next one. A new rank: a little more health, a breath back, and a
//   choice of one of three perks (the battle holds still while he picks — never while a stage is being won). Some ranks bring a reward of their own over the
//   radio: a man for the squad, a supply drop, a tank of ours, a stick of paratroopers, a barrage. Perks stack in levels; one card in three may be a call for help.
//   Past the last rank, every step is a medal: one more pick. The same cards close a stage won against the general (loot/upgrades.js asks soldierStagePerks).
import { TROOPER } from '../../config.js';
import { MODE, S, airstrike, armsDrop, clampFieldXZ, enemies, floatText, hide, iconEl, launchParadrop, magCap, GUNS, radio, ringPulse, sfx, show, showBanner,
  spawnAllyTank, squadGrow, squadRankUp, squadRoom, supplyDrop, updateGunHUD, updateHUD } from '../hub.js';

export const CAREER = { xp:0, rank:0, pend:0, lv:{}, openAt:0, chip:null, keys:false, cards:null };
const R = CAREER, T = () => TROOPER;
const NOW = () => performance.now() / 1000;
// XP from rank r to r + 1
export function rankNeed(r){ const [a, b, c] = T().step, n = r; return a + b * n + c * n * n; }
export function rankName(r){ const L = T().ranks; return L[Math.min(r, L.length - 1)]; }
const INS = ['›', '››', '▰', '▰▰', '▰▰▰', '★', '★★', '★★★', '★★★★', '★', '★★', '★★★', '★★★★'];
const tierOf = r => r < 2 ? 0 : r < 5 ? 1 : r < 9 ? 2 : 3;   // enlisted · NCO · company officer · field officer
export function rankReset(){ R.xp = 0; R.rank = 0; R.pend = 0; R.lv = {}; R.openAt = 0; paintChip(); }
function xpFor(e){ const K = T().xp.kill; if(e.general) return K.general;
  let x = K[e.type] ?? (e.def.inf ? K._inf : e.def.air ? K._air : K._veh); if(e.elite) x *= T().xp.eliteK; if(e.genGuard) x *= 2; return x; }
// killEnemy asks this for every kill (his, his squad's, a strike's)
export function soldierKill(e){ if(MODE.id !== 'soldier' || !S.player) return; gainXp(xpFor(e), e.pos); armsDrop(e); }
export function gainXp(n, at){ if(MODE.id !== 'soldier' || !S.player || !(n > 0)) return; R.xp += n;
  if(n >= 40 && at) floatText('+' + n + ' KN', '#ffd86a', { x:at.x, y:2.6, z:at.z }, 15);
  while(R.xp >= rankNeed(R.rank)){ R.xp -= rankNeed(R.rank); rankUp(); }
  paintChip(); }
function rankUp(){ const p = S.player, top = R.rank >= T().ranks.length - 1, U = T().rankUp;
  if(!top){ R.rank++; p.maxHp += U.hp; } p.hp = Math.min(p.maxHp, p.hp + p.maxHp * U.heal); updateHUD();
  const nm = top ? 'HUÂN CHƯƠNG CHIẾN CÔNG' : rankName(R.rank);
  showBanner((top ? '★ ' : 'THĂNG CẤP: ') + nm, '#ffd86a'); ringPulse(p.pos, 0xffd86a, 4.5); sfx('levelup'); floatText('▲ ' + nm, '#ffd86a', p.pos, 22);
  squadRankUp(R.rank); if(!top) milestone(R.rank);
  R.pend++; R.openAt = NOW() + U.delay; }
// what a rank brings by itself, over the radio
function milestone(r){ const m = T().milestone[r]; if(!m) return; const nm = rankName(r);
  if(m === 'at' || m === 'mg'){ if(squadGrow(m === 'at' ? 'at' : 'mg')) radio('SCH: Chúc mừng ' + nm.toLowerCase() + '! Bổ sung cho tổ anh một ' + (m === 'at' ? 'lính B40 chống tăng.' : 'xạ thủ súng máy.')); }
  else if(m === 'supply'){ supplyDrop(); radio('SCH: ' + nm + ' — bộ chỉ huy thả dù tiếp tế cạnh anh: súng mới và cứu thương.'); }
  else if(m === 'tank'){ callTank(); radio('SCH: ' + nm + ' — một xe tăng ta được điều tới yểm trợ tổ anh.'); }
  else if(m === 'para'){ callPara(); radio('SCH: ' + nm + ' — trực thăng đang thả một tiểu đội lính dù xuống cạnh anh!'); }
  else if(m === 'barrage'){ callStrike(); setTimeout(callStrike, 1600); radio('SCH: ' + nm + '! Pháo kích toàn tuyến theo toạ độ của anh — cúi đầu xuống!'); } }
const behind = d => { const p = S.player, f = p.facing || 0; return clampFieldXZ(p.pos.x - Math.sin(f) * d, p.pos.z - Math.cos(f) * d, 6); };
export function callTank(){ const [x, z] = behind(14); spawnAllyTank(x, z, S.player.facing || 0, R.rank >= 9); ringPulse({ x, z }, 0x9be04a, 4); floatText('XE TĂNG TA!', '#9be04a', { x, y:3, z }, 20); }
export function callPara(){ const p = S.player; launchParadrop(NOW(), { friendly:true, at:[p.pos.x, p.pos.z] }); }
// a strike on the thickest knot of enemies near him (the airstrike falls where S.aimPoint is: aim it there for the call, then give the aim back)
export function callStrike(){ const p = S.player; if(!p || S.mode !== 'playing') return; let best = null, bn = 0;
  for(const e of enemies){ if(e.def.air) continue; const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if(d < 9 || d > 48) continue;
    let n = 0; for(const o of enemies) if(!o.def.air && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 9) n += o.def.inf ? 1 : 2.5; if(n > bn){ bn = n; best = e; } }
  const ap = S.aimPoint, ox = ap.x, oz = ap.z; if(best){ ap.x = best.pos.x; ap.z = best.pos.z; } airstrike(NOW()); ap.x = ox; ap.z = oz; }
// ---- PERKS: { id, ic, nm, ds, max (levels), apply(p) } · call = a one-off call for help (no level) ----
const P = () => S.player;
export const PERKS = [
  { id:'tough',  ic:'shield',    nm:'THÂN THÉP',        ds:'+25 máu tối đa',                       max:5, apply(p){ p.maxHp += 25; p.hp += 25; } },
  { id:'marks',  ic:'burst',     nm:'XẠ THỦ',           ds:'+15% sát thương mọi súng',             max:5, apply(p){ p.dmgMul *= 1.15; } },
  { id:'quick',  ic:'bolt',      nm:'TAY NHANH',        ds:'Bắn nhanh hơn 12%',                    max:4, apply(p){ p.fireMul *= 0.88; } },
  { id:'reload', ic:'mag',       nm:'THAY BĂNG NHANH',  ds:'Nạp đạn nhanh hơn 20%',                max:3, apply(p){ p.reloadMul = (p.reloadMul || 1) * 0.8; } },
  { id:'bigmag', ic:'mag',       nm:'BĂNG ĐẠN LỚN',     ds:'+25% số viên mỗi băng (nạp đầy ngay)', max:3, apply(p){ p.magMul = (p.magMul || 1) * 1.25; for(const g of p.guns) g.ammo = magCap(GUNS[g.id]); updateGunHUD(); } },
  { id:'eagle',  ic:'crosshair', nm:'MẮT ƯNG',          ds:'+8% cơ hội chí mạng (×2 sát thương)',  max:4, apply(p){ p.crit = Math.min(0.6, p.crit + 0.08); } },
  { id:'legs',   ic:'dash',      nm:'CHÂN CHẠY',        ds:'Chạy và cưỡi nhanh hơn 10%',           max:3, apply(p){ p.speedMul *= 1.1; } },
  { id:'vest',   ic:'shield',    nm:'ÁO CHỐNG ĐẠN',     ds:'Nhận ít hơn 10% sát thương',           max:4, apply(p){ p.armor = 1 - (1 - (p.armor || 0)) * 0.9; } },
  { id:'leech',  ic:'drop',      nm:'KHÁT MÁU',         ds:'+4 máu mỗi tên địch bị hạ',             max:3, apply(p){ p.lifesteal += 4; } },
  { id:'tactic', ic:'spark',     nm:'CHIẾN THUẬT',      ds:'Hồi kỹ năng nhanh hơn 18%',             max:3, apply(p){ p.spellCdMul *= 0.82; } },
  { id:'nade',   ic:'bomb',      nm:'LÍNH NÉM LỰU',     ds:'Lựu đạn +35% sát thương, nổ rộng hơn',  max:3, apply(p){ p.nadeK = (p.nadeK || 1) * 1.35; } },
  { id:'medic',  ic:'heart',     nm:'CỨU THƯƠNG GIỎI',  ds:'Băng bó hồi +50% · y tá chữa nhanh hơn', max:2, apply(p){ p.medK = (p.medK || 1) * 1.5; } },
  { id:'leader', ic:'team',      nm:'CHỈ HUY',          ds:'Đồng đội +25% máu và sát thương',       max:3, apply(){ squadRankUp(R.rank); } },
  { id:'recruit',ic:'team',      nm:'THÊM ĐỒNG ĐỘI',    ds:'Một người nữa vào tổ của anh',          max:4, ok:() => squadRoom() > 0, apply(){ squadGrow(); } },
  { id:'life',   ic:'tank',      nm:'+1 MẠNG',          ds:'Thêm một lần đứng dậy',                 max:2, rare:true, apply(p){ p.lives++; updateHUD(); } },
  { id:'c_tank', ic:'tank',      nm:'XE TĂNG YỂM TRỢ',  ds:'Một xe tăng ta tới đánh cạnh anh',      call:true, apply(){ callTank(); } },
  { id:'c_para', ic:'team',      nm:'LÍNH DÙ',          ds:'Một tiểu đội lính dù nhảy xuống cạnh anh', call:true, apply(){ callPara(); } },
  { id:'c_strk', ic:'crosshair', nm:'PHÁO KÍCH',        ds:'Không kích ngay cụm địch đông nhất',     call:true, apply(){ setTimeout(callStrike, 350); } },
  { id:'c_sup',  ic:'up',        nm:'THẢ DÙ TIẾP TẾ',   ds:'Súng mới + cứu thương rơi cạnh anh',     call:true, apply(){ supplyDrop(); } },
];
const lvOf = k => R.lv[k.id] || 0;
const can = k => (k.call || lvOf(k) < k.max) && (!k.ok || k.ok());
// three cards: stat perks, maybe one call for help, rarely the extra life
export function pickPerks(n = 3){ const C = T().perk, out = [], take = L => { const q = L.filter(k => can(k) && !out.includes(k)); if(q.length) out.push(q[(Math.random() * q.length) | 0]); };
  if(Math.random() < C.lifeChance) take(PERKS.filter(k => k.rare));
  if(Math.random() < C.callShare) take(PERKS.filter(k => k.call));
  while(out.length < n){ const before = out.length; take(PERKS.filter(k => !k.call && !k.rare)); if(out.length === before) break; }
  return out.sort(() => Math.random() - 0.5); }
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const tagOf = k => k.call ? 'VIỆN BINH · dùng ngay' : 'CẤP ' + ROMAN[lvOf(k) + 1] + ' / ' + ROMAN[k.max];
// a card the stage-won screen can show (loot/upgrades.js builds and applies it): the same perk, its level counted
const asCard = k => ({ ic:k.ic, nm:k.nm, ds:k.ds, tag:tagOf(k), apply(p){ take(k, p); } });
function take(k, p){ if(!k.call) R.lv[k.id] = lvOf(k) + 1; k.apply(p || P()); updateHUD(); floatText(k.nm, '#ffd86a', P().pos, 18); }
export function soldierStagePerks(){ return pickPerks(3).map(asCard); }
// ---- the cards, mid-battle: the stage-won overlay's frame, its own title, the battle paused ----
function openPerks(){ const wrap = document.getElementById('upcards'), ov = document.getElementById('upgrade'); if(!wrap || !ov) return;
  const top = R.rank >= T().ranks.length - 1 && R.pend > 0, tt = ov.querySelector('.title'), st = ov.querySelector('.subtitle');
  ov._tt = ov._tt || [tt && tt.textContent, st && st.textContent];
  if(tt) tt.textContent = top ? 'HUÂN CHƯƠNG' : rankName(R.rank); if(st) st.textContent = 'Chọn một phần thưởng · phím 1 2 3';
  const picks = pickPerks(3); R.cards = picks; wrap.replaceChildren();
  picks.forEach((k, i) => { const card = document.createElement('div'); card.className = 'upcard' + (k.call ? ' call' : k.rare ? ' rare' : '');
    const ic = document.createElement('div'); ic.className = 'ic'; ic.appendChild(iconEl(k.ic));
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = (i + 1) + ' · ' + k.nm;
    const ds = document.createElement('div'); ds.className = 'ds'; ds.textContent = k.ds;
    const pw = document.createElement('div'); pw.className = 'pw'; pw.textContent = tagOf(k);
    card.append(ic, nm, ds, pw); const go = ev => { if(ev) ev.preventDefault(); choose(i); };
    card.addEventListener('click', go); card.addEventListener('touchstart', go, { passive:false }); wrap.appendChild(card); });
  if(!R.keys){ R.keys = true; window.addEventListener('keydown', ev => { if(S.mode !== 'perk') return; const i = '123'.indexOf(ev.key); if(i < 0) return; ev.preventDefault(); ev.stopImmediatePropagation(); choose(i); }, true); }
  S.mode = 'perk'; show('upgrade'); sfx('powerup'); }
function choose(i){ if(S.mode !== 'perk' || !R.cards || !R.cards[i]) return; const k = R.cards[i]; R.cards = null; R.pend = Math.max(0, R.pend - 1);
  const ov = document.getElementById('upgrade'); hide('upgrade'); if(ov && ov._tt){ const tt = ov.querySelector('.title'), st = ov.querySelector('.subtitle'); if(tt) tt.textContent = ov._tt[0]; if(st) st.textContent = ov._tt[1]; }
  S.mode = 'playing'; take(k); sfx('powerup'); R.openAt = NOW() + 0.6; }
// once a frame in battle: open the cards when it is safe to (not dying, no stage being won, the general's duel not ending)
export function updateRank(){ if(MODE.id !== 'soldier') return; const p = S.player;
  if(R.pend > 0 && S.mode === 'playing' && !S.awaitingUpgrade && p && p.hp > 0 && NOW() > R.openAt) openPerks();
  if(R.chip && !R.chip.isConnected) paintChip(); }
// the stripe over his health bar: insignia, rank, the gold line to the next one
export function paintChip(){ const bar = document.getElementById('phpbar'); if(!bar) return; let c = R.chip;
  if(!c || !c.isConnected){ c = R.chip = document.createElement('em'); c.className = 'rk'; c.innerHTML = '<s></s><span></span><u><i></i></u>'; bar.appendChild(c); }
  const on = MODE.id === 'soldier'; c.style.display = on ? '' : 'none'; if(!on) return;
  c.className = 'rk t' + tierOf(R.rank); c.children[0].textContent = INS[Math.min(R.rank, INS.length - 1)]; c.children[1].textContent = rankName(R.rank);
  c.querySelector('u i').style.width = Math.min(100, Math.round(100 * R.xp / rankNeed(R.rank))) + '%'; }
