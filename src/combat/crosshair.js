// combat/crosshair.js — Z376 THE CROSSHAIR IS WHERE THE ROUND GOES. The mouse's aim used to be the GROUND under the cursor: laid on a man's chest it
//   was the ground some 6–15 m behind him (the camera looks down past him), the rounds flew from the middle of the body toward that, and they went
//   by him a hand's breadth or two to the side — the crosshair on him and nothing landing. Now one crosshair, the same for the mouse and the pad:
//   · the mouse: every frame the eye's ray through the cursor is followed into the world and stops at the first thing it meets — a man (an upright
//     body his height, the aim kept on his axis off his feet and head), a hull, a wall, a house, a sandbag line, the ground — and that point is the aim;
//     open sky: the point along the ray at the gun's reach. The camera moves, the cursor stays: the aim moves with what is under it;
//   · the pad: the right stick lays the aim as before (its direction and its reach); a man or a hull near that line is taken up (his chest), else it
//     is chest high over the ground there; the same crosshair is drawn on the screen at that point (the mouse's own pointer is hidden meanwhile);
//   · the round leaves the real muzzle and flies straight to that point (fireLine): through the chest it is laid on, into the wall, into the ground;
//   · a round cannot go through things: where the line of fire from the muzzle meets something before the crosshair, a red mark shows where it
//     will stop (the eye can see over a wall the muzzle cannot);
//   · aimAwake: the crosshair was moved a moment ago (or the trigger is down) — the soldier keeps his rifle up on it while he runs (game/cavalry.js,
//     actors/real-cav.js).
import * as THREE from 'three';
import { FORT, LINE, XHAIR } from '../../config.js';
import { AIR, DRAG, MOBILE, PAD, RDRAG, S, VIEW, blockTop, blocks, blocksNear, camera, enemies, equippedGun, fortIntactCross, heightAt, inBlock, playerRange } from '../hub.js';

export const XH = { mx:-1, my:-1, mouseAt:-1e9, movedAt:-1e9, src:'mouse', tgt:null, live:false, stop:null, far:false, state:'ok', sky:false, el:null, lookA:null, reLook:false, camOk:false, anchor:null };
// Z382 THE STEADY CAMERA the crosshair looks through: the follow camera's own pose before the shot's kick, the shake, the roll, the lens's kick and the
//   road's bumps (game/update.js sets it each frame). Every shot kicked the real camera back and widened its lens: the point under a still cursor
//   wandered 10–20 m in a burst, and the next rounds went there.
export const XCAM = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
export function steadyCam(pos, tx, ty, tz, fov, aspect, ok = true){ XH.camOk = ok; if(!ok) return; XCAM.position.copy(pos); XCAM.up.set(0, 1, 0); XCAM.lookAt(tx, ty, tz);
  if(Math.abs(XCAM.fov - fov) > 1e-3 || XCAM.aspect !== aspect){ XCAM.fov = fov; XCAM.aspect = aspect; XCAM.updateProjectionMatrix(); } XCAM.updateMatrixWorld(true); }
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector2(), _rc = new THREE.Raycaster(), _bn = [], _seen = new Set(), _stop = new THREE.Vector3();
const nowS = () => performance.now() / 1000;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// the mouse moved (input/input.js): where on the screen the crosshair is now
export function crosshairMouse(cx, cy){ XH.mx = cx; XH.my = cy; XH.src = 'mouse'; XH.movedAt = XH.mouseAt = nowS(); XH.reLook = true; }
// which way the follow camera leans ahead (game/update.js): with the mouse, the way it was laid when the mouse last moved — the camera leaning after the
//   aim moved the point under a still cursor, which moved the aim, which moved the camera… (the crosshair crept off a man it was put on)
export function camAimA(p){ return XH.live && XH.src === 'mouse' && XH.lookA != null ? XH.lookA : p.aim; }
// the right stick laid the aim somewhere new (input/gamepad.js)
export function crosshairPad(){ XH.src = 'pad'; XH.movedAt = nowS(); }
// the crosshair is in use: moved a moment ago, or the trigger is down
export function aimAwake(now = nowS()){ return !!S.firing || now - XH.movedAt < XHAIR.awake; }
const padNow = () => PAD.active && PAD.lastAt > XH.mouseAt;

// ---- what an eye's ray meets ----
// an upright round body (x, z, radius r, from y0 up to y1): how far along the ray (o, unit d) it first meets it, or -1
function rayCyl(o, d, x, z, r, y0, y1){ const ox = o.x - x, oz = o.z - z, a = d.x * d.x + d.z * d.z;
  if(a > 1e-9){ const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r, q = b * b - a * c; if(q < 0) return -1; const t = (-b - Math.sqrt(q)) / a;
    if(t > 0){ const y = o.y + d.y * t; if(y >= y0 && y <= y1) return t; } }
  if(d.y < -1e-6){ const t = (y1 - o.y) / d.y; if(t > 0){ const px = ox + d.x * t, pz = oz + d.z * t; if(px * px + pz * pz <= r * r) return t; } }   // (down onto its top)
  return -1; }
// an upright box (centre x, z; its length along (sin f, cos f) ± hl, across ± hw; from y0 up to y1)
let _t0 = 0, _t1 = 0;
function slab(p, v, h){ if(Math.abs(v) < 1e-9) return Math.abs(p) <= h; let a = (-h - p) / v, b = (h - p) / v; if(a > b){ const k = a; a = b; b = k; } if(a > _t0) _t0 = a; if(b < _t1) _t1 = b; return _t0 <= _t1; }
function rayBox(o, d, x, z, f, hl, hw, y0, y1){ const s = Math.sin(f), c = Math.cos(f), px = o.x - x, pz = o.z - z; _t0 = 0; _t1 = 1e9;
  if(!slab(px * s + pz * c, d.x * s + d.z * c, hl) || !slab(px * c - pz * s, d.x * c - d.z * s, hw) || !slab(o.y - (y0 + y1) / 2, d.y, (y1 - y0) / 2)) return -1;
  return _t0 > 0 ? _t0 : -1; }   // (an eye inside it: not this one)
// how tall a man stands to the eye: up, crouched, lying
export function manTall(e){ const st = e.g && e.g.userData && e.g.userData.stance, M = XHAIR.man; return st === 'prone' ? M.prone : (st === 'low' || st === 'crouch') ? M.low : M.h; }
const HIT = { t:0, x:0, y:0, z:0, e:null, bl:null, ground:false, sky:false };
// the first thing along the ray (o, unit d) within maxT: an enemy (HIT.e), a solid block (HIT.bl), the ground — or open sky (HIT.sky)
export function eyeRay(o, d, maxT){ let best = maxT, be = null, bb = null, ground = false;
  const ex = o.x + d.x * maxT, ez = o.z + d.z * maxT, sx = ex - o.x, sz = ez - o.z, sl = sx * sx + sz * sz || 1;
  const off = (x, z) => { const k = Math.max(0, Math.min(1, ((x - o.x) * sx + (z - o.z) * sz) / sl)); return Math.hypot(o.x + sx * k - x, o.z + sz * k - z); };   // (how far a thing stands off the ray's track on the ground)
  for(const e of enemies){ if(!(e.hp > 0) || e.alive === false || e.def.air || !e.mesh || e.mesh.visible === false) continue; if(off(e.pos.x, e.pos.z) > 6) continue;
    const gy = heightAt(e.pos.x, e.pos.z), t = rayCyl(o, d, e.pos.x, e.pos.z, XHAIR.man.r, gy - 0.1, gy + manTall(e));
    if(t > 0 && t < best){ best = t; be = e; } }
  _seen.clear();
  for(const bl of blocks){ if(bl.ours || bl.dead) continue; let t, sh = null;
    if(bl.kind === 'building' && bl.bld){ if(_seen.has(bl.bld)) continue; _seen.add(bl.bld); sh = bl.bld; if(off(sh.x, sh.z) > Math.hypot(sh.w, sh.d) / 2 + 1) continue; }
    else if(off(bl.x, bl.z) > (bl.obb ? bl.obb.hl + bl.obb.hw : (bl.r || 1) + 3)) continue;
    const gy = heightAt(bl.x, bl.z), top = blockTop(bl); if(top < gy + 0.2) continue;
    if(sh) t = rayBox(o, d, sh.x, sh.z, sh.ry, sh.d / 2, sh.w / 2, gy - 1, top);
    else if(bl.obb) t = rayBox(o, d, bl.x, bl.z, bl.obb.f, bl.obb.hl, bl.obb.hw, gy - 1, top);
    else if(bl.kind === 'fortwall' && bl.piece){ const pc = bl.piece; t = rayBox(o, d, bl.x, bl.z, Math.atan2(pc.ux, pc.uz), pc.pl / 2 + 0.05, FORT.wallT / 2 + 0.3, gy - 1, top); }   // (the wall as it stands, not its battered foot)
    else t = rayCyl(o, d, bl.x, bl.z, bl.r || 1, gy - 1, top);
    if(t > 0 && t < best){ best = t; be = null; bb = bl; } }
  // the ground: marched out in growing steps, then halved down onto it
  { const [s0, s1] = XHAIR.step; let tp = 0, t = s0;
    while(t < best){ const x = o.x + d.x * t, z = o.z + d.z * t; if(o.y + d.y * t < heightAt(x, z)){ let a = tp, b = t;
        for(let k = 0; k < 8; k++){ const m = (a + b) / 2; if(o.y + d.y * m < heightAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
        best = b; be = bb = null; ground = true; break; }
      tp = t; t += s0 + s1 * t; } }
  HIT.t = best; HIT.x = o.x + d.x * best; HIT.y = o.y + d.y * best; HIT.z = o.z + d.z * best; HIT.e = be; HIT.bl = bb; HIT.ground = ground; HIT.sky = !ground && !be && !bb; return HIT; }

// ---- the aim, every frame (game/loop.js, after the pad is read, before the gun is laid on an aircraft) ----
export function updateCrosshair(dt, now){ const p = S.player; XH.live = false;
  if(!p || S.mode !== 'playing' || (MOBILE && !PAD.active)){ marks(null); return; }
  const reach = playerRange() * 1.15 + 4, pad = padNow();
  if(pad) padAim(p, reach);
  else if(XH.mx >= 0 && (RDRAG.moved || DRAG.on)){ S.pointerActive = true; XH.live = true; marks(p, false); }   // CAM 1 the view being turned (right / middle drag): the gun holds the point it was on
  else if(XH.mx >= 0){ _n.set(XH.mx / VIEW.w * 2 - 1, -(XH.my / VIEW.h) * 2 + 1); _rc.setFromCamera(_n, XH.camOk ? XCAM : camera); _o.copy(_rc.ray.origin); _d.copy(_rc.ray.direction);   // (through the steady camera: the shot's kick and the shake no longer drag the point away)
    // Z382 A BURST HOLDS ITS MARK: the trigger held and the mouse still since it went down, the aim stays on the point (or the man) it was put on —
    //   the tank's recoil and the camera easing back while he fires shift the view a metre or two under a still cursor; the rounds no longer walk off it
    const A = XH.anchor; if(A && (!S.firing || XH.mouseAt > A.t || XCAM.position.distanceTo(A.cam) > XHAIR.anchor.cam || (A.e && !(A.e.hp > 0)))) XH.anchor = null;
    if(XH.anchor){ const e = XH.anchor.e; if(e){ const gy = heightAt(e.pos.x, e.pos.z); S.aimPoint.set(e.pos.x, gy + XH.anchor.dy, e.pos.z); } else S.aimPoint.copy(XH.anchor.p); S.pointerActive = true; XH.live = true; marks(p, false); return; }
    const h = eyeRay(_o, _d, XHAIR.reach); XH.tgt = h.e; XH.sky = h.sky;
    if(h.sky){ const ox = _o.x - p.pos.x, oz = _o.z - p.pos.z, a = _d.x * _d.x + _d.z * _d.z, b = ox * _d.x + oz * _d.z, c = ox * ox + oz * oz - reach * reach, q = b * b - a * c;   // open sky: along the ray to the gun's reach
      const t = a > 1e-6 && q >= 0 ? (-b + Math.sqrt(q)) / a : reach; S.aimPoint.set(_o.x + _d.x * t, _o.y + _d.y * t, _o.z + _d.z * t); }
    else if(h.e && h.e.def && h.e.def.inf){ const e = h.e, gy = heightAt(e.pos.x, e.pos.z), M = XHAIR.man; S.aimPoint.set(e.pos.x, Math.max(gy + M.lo, Math.min(gy + manTall(e) - M.hi, h.y)), e.pos.z); }   // on his axis, off his feet and head
    else S.aimPoint.set(h.x, h.y, h.z);
    S.pointerActive = true; }
  else { marks(null); return; }
  if(XH.reLook || XH.lookA == null){ XH.reLook = false; XH.lookA = Math.atan2(S.aimPoint.x - p.pos.x, S.aimPoint.z - p.pos.z); }
  if(!pad && S.firing && !XH.anchor){ const e = XH.tgt && XH.tgt.def ? XH.tgt : null; XH.anchor = { t:nowS(), p:S.aimPoint.clone(), cam:XCAM.position.clone(), e, dy:e ? S.aimPoint.y - heightAt(e.pos.x, e.pos.z) : 0 }; }   // (the burst's mark)
  XH.live = true; marks(p, pad); }
// the pad: a man near the stick's line is taken up, else chest high over the ground where the stick lays it
function padAim(p, reach){ const ap = S.aimPoint, ax = ap.x - p.pos.x, az = ap.z - p.pos.z, L = Math.hypot(ax, az); if(L < 0.5) return; const ux = ax / L, uz = az / L, P = XHAIR.pad;
  let best = null, bs = 1e9;
  for(const e of enemies){ if(!(e.hp > 0) || e.alive === false || e.def.air) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, al = dx * ux + dz * uz; if(al < P.near || al > reach) continue;
    const lat = Math.abs(dx * uz - dz * ux); if(lat > P.lat) continue; const sc = lat + Math.abs(al - L) * 0.12; if(sc < bs){ bs = sc; best = e; } }
  XH.tgt = best; XH.sky = false;
  if(best){ const gy = heightAt(best.pos.x, best.pos.z); ap.set(best.pos.x, gy + Math.min(XHAIR.chest, manTall(best) - XHAIR.man.hi), best.pos.z); }
  else ap.y = heightAt(ap.x, ap.z) + XHAIR.chest; }

// ---- a round from a muzzle at (sx, sy, sz) to the crosshair: its yaw, the height over the ground it comes to, and over what distance ----
// (null: no crosshair — a phone's auto-aim — or the crosshair right on the muzzle)
export function fireLine(sx, sy, sz){ if(!XH.live || !S.pointerActive) return null; const a = S.aimPoint, d = Math.hypot(a.x - sx, a.z - sz); if(d < 1.2) return null;
  return { a:Math.atan2(a.x - sx, a.z - sz), dropTo:a.y - heightAt(a.x, a.z), dropDist:d }; }
// where a straight round from (sx, sy, sz) to (ax, ay, az) first meets something (the ground, a block it cannot fly over, a sealed fort's wall), or null
export function lineStop(sx, sy, sz, ax, ay, az, out){ const D = Math.hypot(ax - sx, az - sz); if(D < 0.5) return null; const n = Math.ceil(D / 0.4);
  for(let i = 1; i < n; i++){ const k = i / n, x = sx + (ax - sx) * k, z = sz + (az - sz) * k, y = sy + (ay - sy) * k;
    if(y < heightAt(x, z) - 0.05) return out.set(x, heightAt(x, z), z);
    for(const bl of blocksNear(x, z, 0.3, _bn)){ if(bl.ours || bl.ridge) continue; if(inBlock(bl, x, z, 0.2) && y < blockTop(bl) + LINE.over) return out.set(x, Math.min(y, blockTop(bl)), z); } }
  if(Math.min(sy, ay) < heightAt(ax, az) + FORT.wallH + 0.3){ const w = fortIntactCross(sx, sz, ax, az); if(w) return out.set(w.x, Math.min(sy, ay), w.z); }
  return null; }

// ---- on the screen: ONE crosshair (the mouse's own pointer, or the pad's drawn one), its colour telling the shot:
//   yellow — the round gets there; red — something stands between the muzzle and it (the round stops on it: the eye sees over what the muzzle cannot);
//   grey — beyond the gun's reach (the round falls short). Z382: the red X drawn apart from the crosshair read as a second crosshair — gone.
const RING = { ok:'#ffce4a', block:'#ff3b2a', far:'#9a9a9a' };
const xsvg = c => "<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><g fill='none' stroke-linecap='round'><circle cx='20' cy='20' r='13' stroke='#000' stroke-width='5'/><path d='M20 2.5v8M20 29.5v8M2.5 20h8M29.5 20h8' stroke='#000' stroke-width='5'/><circle cx='20' cy='20' r='13' stroke='" + c + "' stroke-width='2.4'/><path d='M20 2.5v8M20 29.5v8M2.5 20h8M29.5 20h8' stroke='" + c + "' stroke-width='2.4'/></g><circle cx='20' cy='20' r='2.6' fill='#000'/><circle cx='20' cy='20' r='1.5' fill='#fff'/></svg>";
const CURSOR = {}; for(const k of Object.keys(RING)) CURSOR[k] = k === 'ok' ? '' : 'url("data:image/svg+xml,' + encodeURIComponent(xsvg(RING[k])) + '") 20 20, crosshair';   // (yellow: the stylesheet's own pointer)
function padMark(){ if(typeof document === 'undefined') return null; let e = document.getElementById('xhairPad'); if(!e){ e = document.createElement('div'); e.id = 'xhairPad';
    e.style.cssText = 'position:fixed;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;pointer-events:none;z-index:6;display:none;will-change:transform'; document.body.appendChild(e); } return e; }
function put(e, x, y, z){ if(!e) return; _v.set(x, y, z).project(camera); if(_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05){ e.style.display = 'none'; return; }
  e.style.transform = 'translate3d(' + ((_v.x + 1) / 2 * VIEW.w).toFixed(1) + 'px,' + ((1 - _v.y) / 2 * VIEW.h).toFixed(1) + 'px,0)'; e.style.display = 'block'; }
let _cur = null, _padSvg = null;
function pointer(v){ if(v === _cur) return; _cur = v; const a = document.getElementById('app'), cv = document.querySelector('canvas'); if(a) a.style.cursor = v; if(cv) cv.style.cursor = v; }
function marks(p, pad){ if(typeof document === 'undefined') return; const ui = !!p && !document.body.classList.contains('inmenu'), xe = XH.el || (XH.el = padMark());
  if(!ui){ if(xe) xe.style.display = 'none'; pointer(''); XH.stop = null; XH.state = 'ok'; return; }
  const air = AIR.e, ap = S.aimPoint, g = equippedGun && equippedGun(), lob = !g || g.special === 'mortar';
  // what the shot does: stopped short of the crosshair, out of the gun's reach, or there
  let st = null, far = false; if(!air && !lob && p.muzzle && !XH.sky){ p.muzzle.getWorldPosition(_v); const mx = _v.x, my = _v.y, mz = _v.z, d = Math.hypot(ap.x - mx, ap.z - mz);
    st = lineStop(mx, my, mz, ap.x, ap.y, ap.z, _stop); if(st && Math.hypot(st.x - ap.x, st.z - ap.z) < XHAIR.stop.min) st = null;
    far = !st && d > shotReach(g); }
  XH.stop = st; XH.far = far; XH.state = st ? 'block' : far ? 'far' : 'ok';
  if(pad){ pointer('none'); if(_padSvg !== XH.state){ _padSvg = XH.state; xe.innerHTML = xsvg(RING[XH.state]); } if(air) put(xe, air.pos.x, air.pos.y, air.pos.z); else put(xe, ap.x, ap.y, ap.z); }
  else { if(xe) xe.style.display = 'none'; pointer(CURSOR[XH.state]); } }
// how far the gun in hand throws its round (m): the reach its rounds are given when fired (combat/soldier-fire.js, combat/flame.js)
export function shotReach(g){ return playerRange() * ((S.player && S.player.cav && g && g.rng) || 1) + 2; }
