// ui/coop-lobby.js — COOP 4 THE CO-OP LOBBY'S SCREEN (shown instead of the home screen when the address has ?room=CODE) and the two small co-op lines of the
// battle HUD (a warning, the down / revive line). Built in the page only when a room is joined: without ?room= none of this exists. The logic is game/coop-glue.js;
// this draws a model { room, host, me, peer, peerIn, ready, peerReady, canStart, battle, seed, rtt, note, error, link, biomes } and calls back.
import { COOP, WEATHER } from '../../config.js';
import { BIOME_VI, TOD_LABEL, escapeHtml, tapEl } from '../hub.js';

let _el = null, _cb = null, _key = '';
const CSS = '#coopLobby .cl-row{display:flex;align-items:center;gap:10px;padding:7px 10px;margin:4px 0;background:rgba(0,0,0,.28);border-left:3px solid #6a6a55;font:600 15px "Rajdhani",sans-serif;letter-spacing:.03em}'
  + '#coopLobby .cl-row.ok{border-left-color:#9be04a}#coopLobby .cl-row b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#coopLobby .cl-role{font:12px "Share Tech Mono",monospace;opacity:.7;min-width:74px}'
  + '#coopLobby .cl-st{font:12px "Share Tech Mono",monospace}#coopLobby .cl-set{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;margin:10px 0;font:14px "Rajdhani",sans-serif}'
  + '#coopLobby select{background:#1a1c14;color:#e9e3cf;border:1px solid #5a5a44;padding:5px 6px;font:600 14px "Rajdhani",sans-serif;width:100%}#coopLobby .cl-note{font:13px "Rajdhani",sans-serif;opacity:.85;margin:6px 0;min-height:18px}'
  + '#coopLobby .cl-err{color:#ff8a6a;font-weight:700;opacity:1}#coopLobby .cl-link{font:12px "Share Tech Mono",monospace;word-break:break-all;opacity:.8;margin:4px 0;user-select:all}#coopLobby .xb.off{opacity:.4;pointer-events:none}'
  + '#coopLine{position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:41;pointer-events:none;font:700 17px "Rajdhani",sans-serif;letter-spacing:.05em;text-shadow:0 1px 4px #000,0 0 8px #000;text-align:center;display:none}'
  + '#coopLine i{display:block;height:5px;width:220px;margin:5px auto 0;background:rgba(0,0,0,.6)}#coopLine i u{display:block;height:100%;background:currentColor;transform-origin:0 50%}'
  + '#coopWarn{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:41;pointer-events:none;max-width:86vw;padding:5px 12px;background:rgba(60,14,6,.86);border:1px solid #ff8a5a;color:#ffd9c8;font:600 13px "Rajdhani",sans-serif;text-align:center;display:none}'
  + 'body.coop-lobby #start,body.coop-lobby #nick{display:none !important}';
function mount(){ if(_el) return _el; const st = document.createElement('style'); st.id = 'coopCss'; st.textContent = CSS; document.head.appendChild(st);
  _el = document.createElement('div'); _el.id = 'coopLobby'; _el.className = 'overlay xk-dlg hidden'; _el.innerHTML = '<div class="xk-card" style="max-width:520px;width:92vw"><h2 class="xk-ttl" id="clT"></h2><p class="xk-sub" id="clS"></p><div id="clP"></div><div id="clB"></div><div class="cl-note" id="clN"></div><div class="cl-link" id="clL"></div>'
    + '<div class="xk-acts"><div class="xb xb-sec" id="clLeave" role="button">Rời phòng</div><div class="xb xb-sec" id="clReady" role="button"></div><div class="xb xb-pri" id="clGo" role="button">Bắt đầu</div></div></div>';
  document.body.appendChild(_el); const $ = id => _el.querySelector('#' + id);
  tapEl($('clReady'), () => _cb && _cb.ready()); tapEl($('clGo'), () => _cb && _cb.start()); tapEl($('clLeave'), () => _cb && _cb.leave());
  $('clB').addEventListener('change', e => { const t = e.target; if(t && t.dataset && t.dataset.k && _cb) _cb.pick(t.dataset.k, t.value); });
  return _el; }
const cap = s => { s = String(s || '').toLocaleLowerCase('vi'); return s.charAt(0).toLocaleUpperCase('vi') + s.slice(1); };
export function coopBattleText(b){ if(!b || !b.biome) return 'chủ phòng đang chọn…'; return cap(BIOME_VI[b.biome] || b.biome) + ' · màn ' + (b.level || 1) + ' · ' + cap(TOD_LABEL[b.tod] || b.tod) + ' · ' + cap((WEATHER[b.wx] || {}).vi || b.wx); }
// draw the lobby from the model m; cb = { ready(), start(), leave(), pick(key, value) }
export function coopLobbyShow(m, cb){ const el = mount(), $ = id => el.querySelector('#' + id); _cb = cb; document.body.classList.add('coop-lobby'); el.classList.remove('hidden'); document.body.classList.add('inmenu');
  $('clT').textContent = 'Phòng co-op · ' + m.room; $('clS').textContent = m.host ? 'Bạn là chủ phòng: chọn chiến trường, chờ đồng đội vào, cả hai sẵn sàng rồi bắt đầu.' : 'Bạn là khách: chủ phòng chọn chiến trường. Bấm Sẵn sàng khi đã xong.';
  const row = (role, name, here, rdy) => '<div class="cl-row' + (rdy ? ' ok' : '') + '"><span class="cl-role">' + role + '</span><b>' + escapeHtml(here ? name || '—' : 'đang chờ vào phòng…') + '</b><span class="cl-st">' + (here ? (rdy ? '✓ SẴN SÀNG' : 'chưa sẵn sàng') : '') + '</span></div>';
  $('clP').innerHTML = row('CHỦ PHÒNG', m.host ? m.me : m.peer, m.host || m.peerIn, m.host ? m.ready : m.peerReady) + row('KHÁCH', m.host ? m.peer : m.me, !m.host || m.peerIn, m.host ? m.peerReady : m.ready);
  // the battlefield: the host picks (rebuilt only when the choice or the role changes, so an open list is not closed under his finger); the guest reads it
  const b = m.battle || {}, key = (m.host ? 'h' : 'g') + [b.biome, b.level, b.tod, b.wx, m.seed].join('|');
  if(key !== _key){ _key = key; const L = COOP.lobby, sel = (k, opts, cur) => '<select data-k="' + k + '">' + opts.map(o => '<option value="' + escapeHtml(String(o[0])) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + escapeHtml(o[1]) + '</option>').join('') + '</select>';
    $('clB').innerHTML = m.host ? '<div class="cl-set"><span>Chiến trường</span>' + sel('biome', (m.biomes || []).map(n => [n, cap(BIOME_VI[n] || n)]), b.biome) + '<span>Màn</span>' + sel('level', Array.from({ length:L.levelMax }, (_, i) => [i + 1, 'Màn ' + (i + 1)]), b.level)
      + '<span>Giờ</span>' + sel('tod', L.tod.map(t => [t, cap(TOD_LABEL[t] || t)]), b.tod) + '<span>Thời tiết</span>' + sel('wx', L.wx.filter(w => WEATHER[w]).map(w => [w, cap(WEATHER[w].vi)]), b.wx) + '<span>Seed</span><span>' + (m.seed || '—') + '</span></div>'
      : '<div class="cl-set"><span>Chiến trường</span><b>' + escapeHtml(coopBattleText(b)) + '</b><span>Seed</span><span>' + (m.seed || '—') + '</span></div>'; }
  const n = $('clN'); n.className = 'cl-note' + (m.error ? ' cl-err' : ''); n.textContent = m.error || ((m.peerIn ? 'Ping ' + Math.round(m.rtt || 0) + ' ms. ' : '') + (m.note || ''));
  $('clL').textContent = m.link || ''; const rb = $('clReady'), go = $('clGo'); rb.textContent = m.ready ? 'Huỷ sẵn sàng' : 'Sẵn sàng'; rb.classList.toggle('off', !!m.error || !m.canReady); rb.classList.toggle('xb-pri', !m.host && !m.ready); rb.classList.toggle('xb-sec', m.host || m.ready);
  go.style.display = m.host ? '' : 'none'; go.classList.toggle('off', !m.canStart); $('clLeave').textContent = m.error ? 'Về trang chủ' : 'Rời phòng'; }
export function coopLobbyHide(){ if(!_el) return; _el.classList.add('hidden'); document.body.classList.remove('coop-lobby'); }
export function coopLobbyOpen(){ return !!_el && !_el.classList.contains('hidden'); }
// the line over the battle: "you are down — 45 %" / "stay beside him — 45 %" (k < 0: no bar; text '' hides it)
export function coopLine(text, color, k){ mount(); let e = document.getElementById('coopLine'); if(!e){ e = document.createElement('div'); e.id = 'coopLine'; e.innerHTML = '<span></span><i><u></u></i>'; document.body.appendChild(e); }
  if(!text){ if(e._t){ e._t = ''; e.style.display = 'none'; } return; } if(e._t !== text){ e._t = text; e.firstChild.textContent = text; e.style.display = 'block'; } if(e._c !== color){ e._c = color; e.style.color = color || '#fff'; }
  const q = k == null || k < 0 ? -1 : Math.round(k * 50); if(e._k !== q){ e._k = q; e.lastChild.style.display = q < 0 ? 'none' : 'block'; if(q >= 0) e.lastChild.firstChild.style.transform = 'scaleX(' + (q / 50) + ')'; } }
// a warning that stays at the top of the screen (the two pages built different land; the other player is gone)
export function coopWarn(text){ mount(); let e = document.getElementById('coopWarn'); if(!e){ e = document.createElement('div'); e.id = 'coopWarn'; document.body.appendChild(e); } e.textContent = text || ''; e.style.display = text ? 'block' : 'none'; }
