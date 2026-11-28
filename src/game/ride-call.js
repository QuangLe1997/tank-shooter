// game/ride-call.js — Z306 CALL THE RIDE (soldier mode only): on foot, a button (and G) tells you where your ride stands — LÊN XE beside it, GỌI XE ĐÓN
//   when you are away from it, the driver's ETA once he is on his way, XE ĐANG SỬA / BÁC TÀI ĐANG DỰNG XE while he can't come yet (the call waits, and he
//   sets off the moment he can). He rides straight to you; when you are far off, or he is stuck behind a wall, he comes round by the streets: after a short
//   wait he turns up a block away from you and rides in. He stops beside you; after a spill, if you stayed by it, you climb straight back on.
//   The button is its own: it shows itself only in soldier mode, on foot, in play (HUDCLEAN 1: a small chip at the lower left, see below).
import { CAV, FEELFX, HUDCLEAN, XEOM } from '../../config.js';
import { CV, FEELX, MOBILE, S, blocks, cavToggleMount, driverReady, inField } from '../hub.js';

const now = () => performance.now() / 1000;
const isBike = () => !!(CV.H && CV.H.bike);
export const rideCanCome = () => !!CV.H && !CV.H.broken && driverReady(CV.H);
// the call: he comes now, or as soon as the ride is fit to
export function callRide(p, quiet){ const C = XEOM.call; CV.call = true; CV.callAt = now(); CV.hop = false; CV.prog = { d:dist(p), t:now() }; CV.far = dist(p) > C.farR; if(quiet) return;   // (Z363 quiet: the driver calls himself over, after a repair or his break)
  if(!isBike() || !rideCanCome()) return; if(CV.far) rideNote('BÁC TÀI ĐI ĐƯỜNG VÒNG', '#9be04a'); }   // HUDCLEAN 1 the chip shows the call (BÁC TÀI TỚI · 9s, XE ĐANG SỬA · ĐÃ GỌI…): only the long way round is worth a word
const dist = p => Math.hypot(CV.hPos.x - p.pos.x, CV.hPos.z - p.pos.z);
// every frame while he is called and can come (from cavalry.js): far away or stuck → he comes round and turns up a block away
export function rideCallStep(p){ const C = XEOM.call, t = now(), d = dist(p);
  if(!CV.prog) CV.prog = { d, t };
  if(d < CV.prog.d - 1){ CV.prog.d = d; CV.prog.t = t; }
  const late = t - (CV.callAt || t) > C.delay;
  if((CV.far && late && !CV.hop && d > C.dropR) || (t - CV.prog.t > C.stuckT && d > C.dropR * 0.6)) hop(p); }   // (far: once the wait is up he is a block away, however far he had got)
function hop(p){ const C = XEOM.call, a0 = Math.atan2(CV.hPos.x - p.pos.x, CV.hPos.z - p.pos.z);   // from his side of you, at a free spot a block away
  for(let k = 0; k < 16; k++){ const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.39, x = p.pos.x + Math.sin(a) * C.dropR, z = p.pos.z + Math.cos(a) * C.dropR;
    if(!inField(x, z, 4) || blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.r || 1) + 2.5)) continue;
    CV.hPos.set(x, 0, z); CV.facing = Math.atan2(p.pos.x - x, p.pos.z - z); CV.speed = CAV.call.speed * 0.6; CV.hop = true; CV.prog = { d:C.dropR, t:now() }; return; }
  CV.prog.t = now(); }   // nowhere free just now: try again in a while
// seconds until he is beside you (null: not called · -1: can't set off yet)
export function rideEta(p){ if(!CV.call) return null; if(!rideCanCome()) return -1; const C = XEOM.call, d = dist(p), v = CAV.call.speed;
  if(CV.far && !CV.hop && d > C.dropR) return Math.max(0, C.delay - (now() - CV.callAt)) + C.dropR / v; return Math.max(0, d - CAV.call.arrive) / v; }

// ---- the chip (HUDCLEAN 1): the ride's one status line at the lower left, off the line of sight (was a pill above the gun bar + toasts over the soldier) ----
//   an icon, 2–4 words, a hairline ETA bar while he comes; a ride note (rideNote) holds it for a moment, on foot or in the saddle; quiet when nothing is new.
//   On a phone it is also the call / mount button.
let el = null, ic = null, tx = null, kb = null, bar = null, tick = 0, note = null, sk = '', skT = 0, eta0 = 0;
export function rideNote(text, col){ note = { text, col:col || '#ffcf5a', until:now() + HUDCLEAN.chip.noteT }; if(el) paint(); }
export function rideCallUi(){ if(el || typeof document === 'undefined') return; const K = HUDCLEAN.chip, P = MOBILE ? K.touch : K.desk;
  el = document.createElement('div'); el.id = 'rideCall';
  el.style.cssText = 'position:fixed;left:' + P.left + 'px;' + (P.top != null ? 'top:' + P.top + 'px;' : 'bottom:' + P.bottom + 'px;') + 'z-index:40;display:none;align-items:center;gap:6px;' +
    'padding:' + (MOBILE ? '6px 10px' : '3px 8px') + ';border-radius:4px;background:rgba(8,10,6,0.55);border-left:2px solid #9be04a;color:#e6eed8;' +
    'font:600 ' + (MOBILE ? 11 : 11.5) + 'px/1.2 "Saira Condensed",Rajdhani,system-ui,sans-serif;letter-spacing:0.06em;white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;transition:opacity .6s';
  el.innerHTML = '<span style="font-size:11px;line-height:1"></span><span></span><span style="font-size:9.5px;opacity:.6;border:1px solid rgba(230,238,216,.4);border-radius:2px;padding:0 3px"></span>' +
    '<i style="position:absolute;left:0;right:0;bottom:0;height:1px;background:rgba(255,255,255,.08)"><b style="display:block;height:100%;width:0;background:#9be04a"></b></i>';
  [ic, tx, kb] = el.children; bar = el.querySelector('i');
  el.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); if(el.dataset.off !== '1') cavToggleMount(); });
  document.body.appendChild(el); const loop = () => { requestAnimationFrame(loop); if(++tick % 6) return; paint(); }; loop(); }
function paint(){ const K = HUDCLEAN.chip, p = S.player, t = now(), live = !!(p && p.cav && CV.H && S.mode === 'playing' && !CV.dead), foot = live && !CV.mounted && !CV.trans;
  if(note && t > note.until) note = null;
  const show = live && (foot || !!note); el.style.display = show ? 'flex' : 'none'; if(!show){ sk = ''; return; }
  const bike = isBike(); let i = bike ? '🛵' : '🐎', txt = '', col = '#9be04a', off = !foot, key = '', k = -1, idle = false;
  if(foot){ const d = dist(p), eta = rideEta(p);
    if(bike && CV.H.broken){ i = '🔧'; txt = 'XE ĐANG SỬA' + (CV.call ? ' · ĐÃ GỌI' : ''); col = '#ffcf5a'; off = !!CV.call; key = CV.call ? '' : 'G'; }
    else if(bike && CV.H.onBreak){ i = '🚬'; txt = 'BÁC TÀI ĐANG NGHỈ'; col = '#ffcf5a'; off = !!CV.call; }   // Z363 his break
    else if(bike && !driverReady(CV.H)){ txt = 'ĐANG DỰNG XE'; col = '#ffcf5a'; off = !!CV.call; }
    else if(d <= CAV.mountR){ txt = bike ? 'LÊN XE' : 'LÊN NGỰA'; key = 'G'; }
    else if(CV.call){ const e = Math.max(0, eta ?? 0); txt = (bike ? 'BÁC TÀI TỚI · ' : 'NGỰA TỚI · ') + (FEELFX.on && FEELX.want ? Math.max(0, Math.round(d - CAV.mountR)) + ' m · TỰ LÊN' : Math.ceil(e) + 's'); /* FEEL 6 G pressed: the metres counted down here, at the edge (not over him), and he gets on when it is there */ off = true; if(e > eta0) eta0 = e; k = eta0 > 0 ? 1 - e / eta0 : 1; }
    else { i = bike ? '📞' : '🐎'; txt = (bike ? 'GỌI XE · ' : 'GỌI NGỰA · ') + Math.round(d) + 'm'; key = 'G'; idle = true; }
    if(!CV.call) eta0 = 0; }
  if(note){ txt = note.text; col = note.col; idle = false; key = ''; k = -1; }
  const s = i + txt.replace(/[\d·]+m$|\d+s$/, ''); if(s !== sk){ sk = s; skT = t; }
  if(ic.textContent !== i) ic.textContent = i; if(tx.textContent !== txt) tx.textContent = txt;
  const kk = MOBILE ? '' : key; if(kb.textContent !== kk){ kb.textContent = kk; kb.style.display = kk ? '' : 'none'; }
  bar.style.display = k >= 0 ? '' : 'none'; if(k >= 0) bar.firstChild.style.width = (Math.min(1, k) * 100).toFixed(0) + '%';
  el.dataset.off = off ? '1' : '0'; el.style.borderLeftColor = col;
  el.style.opacity = String(idle && t - skT > K.idleT ? (MOBILE ? K.op.touch : K.op.idle) : K.op.live); }
