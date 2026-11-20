// game/ride-call.js — Z306 CALL THE RIDE (soldier mode only): on foot, a button (and G) tells you where your ride stands — LÊN XE beside it, GỌI XE ĐÓN
//   when you are away from it, the driver's ETA once he is on his way, XE ĐANG SỬA / BÁC TÀI ĐANG DỰNG XE while he can't come yet (the call waits, and he
//   sets off the moment he can). He rides straight to you; when you are far off, or he is stuck behind a wall, he comes round by the streets: after a short
//   wait he turns up a block away from you and rides in. He stops beside you; after a spill, if you stayed by it, you climb straight back on.
//   The button is its own: it shows itself only in soldier mode, on foot, in play.
import { CAV, XEOM } from '../../config.js';
import { CV, MOBILE, S, blocks, cavToggleMount, driverReady, floatText, inField } from '../hub.js';

const now = () => performance.now() / 1000;
const isBike = () => !!(CV.H && CV.H.bike);
export const rideCanCome = () => !!CV.H && !CV.H.broken && driverReady(CV.H);
// the call: he comes now, or as soon as the ride is fit to
export function callRide(p){ const C = XEOM.call; CV.call = true; CV.callAt = now(); CV.hop = false; CV.prog = { d:dist(p), t:now() }; CV.far = dist(p) > C.farR;
  const far = dist(p) > C.farR, msg = !isBike() ? 'HUÝT SÁO GỌI NGỰA' : CV.H.broken ? 'ĐÃ GỌI — SỬA XE XONG BÁC TỚI ĐÓN' : !driverReady(CV.H) ? 'ĐÃ GỌI — DỰNG XE XONG BÁC TỚI' : far ? 'ĐÃ GỌI XE — BÁC TÀI ĐI ĐƯỜNG VÒNG TỚI ĐÓN' : 'ĐÃ GỌI XE — BÁC TÀI ĐANG TỚI';
  floatText(msg, '#9be04a', p.pos, 14); }
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

// ---- the button ----
let el = null, tick = 0;
export function rideCallUi(){ if(el || typeof document === 'undefined') return;
  el = document.createElement('div'); el.id = 'rideCall';
  el.style.cssText = 'position:fixed;left:50%;bottom:' + (MOBILE ? '220px' : '196px') + ';transform:translateX(-50%);z-index:40;display:none;padding:9px 18px;border-radius:999px;' +
    'background:rgba(12,16,10,0.8);border:1.5px solid #9be04a;color:#eaffd6;font:700 14px/1.2 system-ui,sans-serif;letter-spacing:0.04em;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;box-shadow:0 2px 10px rgba(0,0,0,0.45)';
  el.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); if(el.dataset.off !== '1') cavToggleMount(); });
  document.body.appendChild(el); const loop = () => { requestAnimationFrame(loop); if(++tick % 6) return; paint(); }; loop(); }
function paint(){ const p = S.player, on = !!(p && p.cav && CV.H && S.mode === 'playing' && !CV.mounted && !CV.trans && !CV.dead); el.style.display = on ? 'block' : 'none'; if(!on) return;
  const key = MOBILE ? '' : '  [G]', d = dist(p), bike = isBike(), eta = rideEta(p); let txt, off = false;
  if(bike && CV.H.broken){ txt = '🔧 XE ĐANG SỬA' + (CV.call ? ' · ĐÃ GỌI' : '  — GỌI' + key); off = !!CV.call; }
  else if(bike && !driverReady(CV.H)){ txt = 'BÁC TÀI ĐANG DỰNG XE' + (CV.call ? ' · ĐÃ GỌI' : ''); off = !!CV.call; }
  else if(d <= CAV.mountR) txt = (bike ? 'LÊN XE' : 'LÊN NGỰA') + key;
  else if(CV.call){ txt = (bike ? '🛵 BÁC TÀI ĐANG TỚI · ' : '🐎 NGỰA ĐANG TỚI · ') + Math.ceil(eta ?? 0) + 's'; off = true; }
  else txt = (bike ? '📞 GỌI XE ĐÓN' : 'HUÝT SÁO GỌI NGỰA') + ' · ' + Math.round(d) + 'm' + key;
  if(el.textContent !== txt) el.textContent = txt; el.dataset.off = off ? '1' : '0'; el.style.opacity = off ? '0.8' : '1'; el.style.borderColor = off ? '#ffcf5a' : '#9be04a'; }
