// ui/drone-hud.js — DRONE 1 WHAT THE DRONE WAR SHOWS HIM: the red diamond over every marked enemy (one instanced mesh drawn over everything — walls do
//   not hide it — its size held up with the camera's distance), the cyan ring on the ground of what the recon drone watches, the map's part (a diamond round
//   a marked man's dot, our drone and its circle, the enemy's drones), and the time left of what he flies as a chip in the buff bar (loot/powerups.js draws
//   p.buffUntil: the drones' keys are added to its icon table). DRONE 2 the FPV feed's frame · DRONE 3 the enemy's drones (brackets, edge arrows, what to do).
//   Built on first use; no object is made per frame (a few short strings for the DOM's transforms while a marker moves).
import * as THREE from 'three';
import { DRONEWAR } from '../../config.js';
import { ARENA, BUFF_COL, BUFF_ICON, DW, MOBILE, RECON, S, VIEW, camera, enemies, heightAt, holoRing, ncBattle, ncHit, radarCanvas, scene } from '../hub.js';

const D = DRONEWAR, UP = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const H = { marks:null, ring:null, chips:false };

function marksMesh(){ const g = new THREE.OctahedronGeometry(0.27, 0); g.scale(1, 1.5, 1);
  const m = new THREE.MeshBasicMaterial({ color:new THREE.Color(0xff2a1e).multiplyScalar(1.7), transparent:true, opacity:0.92, depthTest:false, depthWrite:false, fog:false });
  const im = new THREE.InstancedMesh(g, m, D.recon.markMax); im.count = 0; im.frustumCulled = false; im.renderOrder = 30; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); return (H.marks = im); }
function ringMesh(){ const r = holoRing(1, { kind:'friend', core:0.0012, halo:0.004, ticks:72, tickLen:0.012, sweep:0.22, gain:3.2, dark:0.06, depthTest:false, order:5, seg:120 }); r.visible = false; scene.add(r); return (H.ring = r); }
// the buff bar's chips for what he is flying (their icons and colours join loot/powerups.js's tables once)
export function droneChip(key, until){ const p = S.player; if(!p || !p.buffUntil) return; if(!H.chips){ H.chips = true; BUFF_ICON.recon = 'drone'; BUFF_ICON.fpv = 'drone'; BUFF_COL.recon = '#3ee8ff'; BUFF_COL.fpv = '#ffb84a'; } p.buffUntil[key] = until; }
// every frame in play: the diamonds over the marked, the ring under the recon drone
export function updateDroneHud(dt, now){ const live = now < RECON.markedUntil; let im = H.marks, n = 0;
  if(live){ im = im || marksMesh(); const max = D.recon.markMax, sp = now * 1.6;
    for(let i = 0; i < enemies.length && n < max; i++){ const e = enemies[i], left = e.markUntil - now; if(!(left > 0)) continue; if(left < 1.5 && (now * 6) % 1 < 0.4) continue;   // (its last moments: it blinks)
      _v.set(e.pos.x, (e.mesh ? e.mesh.position.y : heightAt(e.pos.x, e.pos.z)) + 2.6 + Math.sin(now * 3 + i) * 0.07, e.pos.z); const k = Math.max(1, _v.distanceTo(camera.position) / 22);
      _s.set(k, k, k); _q.setFromAxisAngle(UP, sp + i); _m.compose(_v, _q, _s); im.setMatrixAt(n++, _m); } }
  if(im && (n || im.count)){ im.count = n; im.instanceMatrix.needsUpdate = true; im.visible = n > 0; }
  const d = RECON.d; if(d && !d.dead){ const r = H.ring || ringMesh(); r.visible = true; r.scale.setScalar(D.recon.r); r.position.set(d.x, heightAt(d.x, d.z) + 0.35, d.z); }
  else if(H.ring && H.ring.visible) H.ring.visible = false;
  if(DW.list.length || MK.sig) foeMarks(); }   // DRONE 3 the enemy's drones: brackets, edge arrows, the strip
// out of play (a menu, the death, the end of a stage): nothing of it stays on the screen
export function droneHudOff(){ if(H.marks && H.marks.count){ H.marks.count = 0; H.marks.visible = false; } if(H.ring && H.ring.visible) H.ring.visible = false; foeMarksOff(); }
// the minimap (ui/radar.js, after the enemies' dots): a red diamond round each marked man, our recon drone and its circle, the enemy's drones
export function drawDroneRadar(c){ if(!DW.on) return; const now = performance.now() / 1000, W = radarCanvas.width, cx = W / 2, sc = (W / 2 - 7) / ARENA;
  if(now < RECON.markedUntil){ c.strokeStyle = '#ff4a3a'; c.lineWidth = 1.3; c.beginPath();
    for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!(e.markUntil > now)) continue; const x = cx + e.pos.x * sc, y = cx + e.pos.z * sc; c.moveTo(x, y - 3.6); c.lineTo(x + 3.6, y); c.lineTo(x, y + 3.6); c.lineTo(x - 3.6, y); c.closePath(); }
    c.stroke(); }
  for(let i = 0; i < DW.list.length; i++){ const d = DW.list[i], x = cx + d.x * sc, y = cx + d.z * sc;
    if(d.foe){ c.strokeStyle = '#ff4ad0'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); c.stroke(); }
    else { c.fillStyle = '#3ee8ff'; c.beginPath(); c.arc(x, y, 2.2, 0, 6.2832); c.fill();
      if(d.kind === 'recon'){ c.strokeStyle = 'rgba(62,232,255,0.55)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, D.recon.r * sc, 0, 6.2832); c.stroke(); } } } }

// ---- DRONE 2 the FPV feed: a frame over the view from the drone's nose (css/drone-war.css) — scan lines, the battery, speed and height, the link's bars, the
//   stick's dot round the middle ring; body.fpv hides the soldier's own pointer and crosshair meanwhile ----
const FV = { el:null, t:null, spd:null, alt:null, sig:null, dot:null, at:0, sx:9, sy:9 };
function fpvBuild(){ const el = document.createElement('div'); el.id = 'fpvHud'; el.className = 'hidden';
  el.innerHTML = '<i class="fv-scan"></i><i class="fv-noise"></i><div class="fv-l"><b class="fv-nm">FPV</b><span class="fv-rec">● REC</span><span>TỐC ĐỘ <b class="fv-spd">0</b> km/h · CAO <b class="fv-alt">0</b> m</span></div>'   // (both strips low on the sides: the corners above belong to the objective panel and the map)
    + '<div class="fv-r"><span>TÍN HIỆU <b class="fv-sig">▮▮▮▮</b></span><span class="fv-bat">PIN <b class="fv-t">0.0</b> s</span></div><i class="fv-c"></i><i class="fv-dot"></i>'
    + '<div class="fv-hint">' + (MOBILE ? 'CẦN LÁI: ĐIỀU KHIỂN · BẮN / KỸ NĂNG: CHO NỔ' : 'CHUỘT hoặc WASD: LÁI · CHÚI XUỐNG ĐỂ TĂNG TỐC · CHUỘT TRÁI / E: CHO NỔ') + '</div>';
  document.body.appendChild(el); FV.el = el; FV.t = el.querySelector('.fv-t'); FV.spd = el.querySelector('.fv-spd'); FV.alt = el.querySelector('.fv-alt'); FV.sig = el.querySelector('.fv-sig'); FV.dot = el.querySelector('.fv-dot'); return el; }
export function fpvHud(on){ if(typeof document === 'undefined') return; const el = FV.el || (on ? fpvBuild() : null); document.body.classList.toggle('fpv', !!on); if(el) el.classList.toggle('hidden', !on); FV.at = 0; FV.sx = FV.sy = 9; }
// every frame of the flight: the stick's dot (only when it moved), and ten times a second the numbers — F: the flight (combat/drone-skills.js FPV)
export function fpvHudTick(now, F, left, v, alt){ const el = FV.el; if(!el) return;
  if(Math.abs(F.sx - FV.sx) > 0.01 || Math.abs(F.sy - FV.sy) > 0.01){ FV.sx = F.sx; FV.sy = F.sy; FV.dot.style.transform = 'translate(' + Math.round(F.sx * 90) + 'px,' + Math.round(-F.sy * 90) + 'px)'; }
  if(now < FV.at) return; FV.at = now + 0.1; const n = Math.max(0, Math.min(4, Math.ceil(F.sig * 4)));
  FV.t.textContent = Math.max(0, left).toFixed(1); FV.spd.textContent = Math.round(v * 3.6); FV.alt.textContent = Math.max(0, Math.round(alt)); FV.sig.textContent = '▮▮▮▮'.slice(0, n) + '▯▯▯▯'.slice(0, 4 - n);
  el.style.setProperty('--fvn', (0.05 + (1 - F.sig) * 0.5 + (left < 2 ? 0.12 : 0)).toFixed(2)); el.classList.toggle('low', left < 3 || F.sig < 0.4); }

// ---- DRONE 3 their drones on his screen: a bracket on each one in the frame, an arrow on the edge toward one that is not (as the core's arrow, ui/alarm.js),
//   its kind and range beside it — FPV 42m · LAO XUỐNG · BỊ SOI 60% · NHIỄU — and one strip under the banner that says what to do while any is up ----
const MK = { els:[], warn:null, sig:'' };
function mkBuild(){ for(let i = 0; i < 3; i++){ const e = document.createElement('div'); e.className = 'dr-mark'; e.innerHTML = '<i></i><b></b>'; document.body.appendChild(e); MK.els.push({ e, i:e.firstChild, b:e.lastChild, on:false, txt:'', edge:null, kami:null }); }
  const w = document.createElement('div'); w.id = 'droneWarn'; document.body.appendChild(w); MK.warn = w; }
function foeMarks(){ const p = S.player, W = VIEW.w, Hh = VIEW.h, m = 54; let k = 0, kami = false, spot = null;
  for(let i = 0; i < DW.list.length && k < 3; i++){ const d = DW.list[i]; if(!d.foe) continue; if(!MK.els.length) mkBuild(); const M = MK.els[k++];
    _v.set(d.x, d.y, d.z).project(camera); let x = (_v.x * 0.5 + 0.5) * W, y = (1 - (_v.y * 0.5 + 0.5)) * Hh; const front = _v.z < 1, off = !front || x < m || x > W - m || y < m || y > Hh - m;
    if(off){ if(!front){ x = W - x; y = Hh - y; } const cx = W / 2, cy = Hh / 2, dx = x - cx, dy = y - cy, s = Math.min((cx - m) / Math.abs(dx || 1e-3), (cy - m) / Math.abs(dy || 1e-3)); x = cx + dx * s; y = cy + dy * s; M.i.style.transform = 'rotate(' + Math.atan2(dy, dx).toFixed(2) + 'rad)'; }
    if(M.edge !== off){ M.edge = off; M.e.classList.toggle('edge', off); if(!off) M.i.style.transform = ''; }
    M.e.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%,-50%)'; if(!M.on){ M.on = true; M.e.classList.add('on'); }
    const isK = d.kind === 'kami', dist = Math.round(Math.hypot(d.x - p.pos.x, d.z - p.pos.z)), jam = d.jamT > 0;
    const txt = isK ? (jam ? 'NHIỄU ' : d.st === 'dive' ? 'LAO XUỐNG ' : 'FPV ') + dist + 'm' : jam ? 'NHIỄU' : d.fix > 0.2 ? 'BỊ SOI ' + Math.min(99, Math.round(d.fix / D.enemy.spot.hold * 100)) + '%' : 'TRINH SÁT ' + dist + 'm';
    if(txt !== M.txt){ M.txt = txt; M.b.textContent = txt; } const nc = !off && ncBattle() && ncHit(x - 45, y - 20, x + 45, y + 30); if(M.nc !== nc){ M.nc = nc; M.e.classList.toggle('nc-txt', nc); }   // NOCENTER over the aim: the ring, no words
    if(M.kami !== isK){ M.kami = isK; M.e.classList.toggle('kami', isK); }
    if(isK) kami = true; else spot = d; }
  for(let i = k; i < MK.els.length; i++){ const M = MK.els[i]; if(M.on){ M.on = false; M.e.classList.remove('on'); } }
  if(MK.warn){ const Y = D.say.hint, sig = kami ? 'k' : spot ? (spot.fix > 0.2 ? 'f' : 's') : ''; if(sig !== MK.sig){ MK.sig = sig; const w = MK.warn; w.classList.toggle('on', !!sig); w.classList.toggle('spot', sig === 's');
      if(sig) w.textContent = sig === 'k' ? Y.kami + ' — ' + Y.kamiSub + (MOBILE ? '' : ' [I]') : sig === 'f' ? Y.fix : Y.spot + ' — BẮN HẠ · NẰM XUỐNG · NẤP DƯỚI MÁI'; } } }
function foeMarksOff(){ for(let i = 0; i < MK.els.length; i++){ const M = MK.els[i]; if(M.on){ M.on = false; M.e.classList.remove('on'); } } if(MK.warn && MK.sig){ MK.sig = ''; MK.warn.classList.remove('on'); } }
