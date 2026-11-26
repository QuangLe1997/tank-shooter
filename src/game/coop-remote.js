// game/coop-remote.js — COOP 5 THE OTHER PLAYER'S SOLDIER on this page: the same rig the local soldier wears (buildGeneral + his horse / war ride + the real models
// of actors/real-cav.js) posed by the same code (animateSoldier / poseSoldier / poseRider / updateRealCav) from his state as net/interp.js gives it; his muzzle
// flash and tracers while he holds the trigger; his name over his head, an outline when something hides him, an arrow at the screen's edge with the distance when
// he is out of the picture, a dot on the map. Nothing here exists until the other player's first state arrives (mateUpdate), and nothing runs without a room.
import * as THREE from 'three';
import { CAV, COOP, HORSE, HUMAN_SCALE, XEOM } from '../../config.js';
import { CV, GUNS, NET_PFLAG, NET_STANCE, S, addTrail, playerRange, animateHorse, animateSoldier, buildBikeMount, buildGeneral, buildHorse, camera, cloakFoot, fitRealCav, gunFlash, gunSound, heightAt, lineClear, lineHit, poseRider, poseSoldier, scene, seatTurnOff, updateRealCav } from '../hub.js';
import { swimOfNet } from '../hub.js';   // SWIM 1 (game/swim.js)

const RIDES = [null, 'cav', 'xeom', 'bagac', 'bantai'], wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), _v = new THREE.Vector3();
let _gunIds = null; const gunIds = () => _gunIds || (_gunIds = Object.keys(GUNS));
export function mateGunIndex(id){ const i = gunIds().indexOf(id); return i < 0 ? 0 : i; }
export function mateGunId(i){ return gunIds()[i] || ''; }
export function mateRideCode(p){ return p && p.bike ? Math.max(1, RIDES.indexOf(p.bike)) : 1; }
// what this page knows of the other soldier (plain numbers, set every frame from the interpolated state) + his rig
export const MATE = { on:false, name:'', root:null, G:null, H:null, RC:null, p:null, base:null, mount:0, x:0, y:0, z:0, heading:0, aim:0, pitch:0, vx:0, vz:0, speed:0, stance:'stand', gun:'', flags:0, hp:0, hpMax:1,
  mounted:false, down:false, dead:false, firing:false, hidden:false, losAt:0, fireAt:0, lastX:0, lastZ:0, lastH:0, yawRate:0, dist:0, onScreen:false, shots:0, err:0, lastErr:'', frames:0, revive:0, mark:null };
const TR = [];   // his rounds as drawn: { x, y, z, vx, vy, vz, life } — light only, they strike nothing
let _tag = null, _arrow = null, _xray = null;

function seat(on){ const G = MATE.G, H = MATE.H; if(G.parent) G.parent.remove(G);
  if(on){ (H.bike && H.body || H.B).add(G); G.rotation.set(0, 0, 0); if(H.bike){ const X = XEOM[H.bike]; G.position.set(0, X.seat[0], X.seat[1]); G.scale.setScalar(HUMAN_SCALE / XEOM.k); } else { G.position.set(0, 0, -0.1); G.scale.setScalar(HUMAN_SCALE / HORSE.size); } H.root.visible = true; }
  else { MATE.root.add(G); G.position.set(0, 0, 0); G.rotation.set(0, 0, 0); G.scale.setScalar(HUMAN_SCALE); seatTurnOff(G); H.root.visible = false; }   // (his ride is not drawn while he is off it)
  MATE.RC.mounted = on; }
function unbuild(){ if(MATE.root && MATE.root.parent) MATE.root.parent.remove(MATE.root); if(MATE.H && MATE.H.drv && MATE.H.drv.w && MATE.H.drv.w.parent) MATE.H.drv.w.parent.remove(MATE.H.drv.w); MATE.root = MATE.G = MATE.H = MATE.RC = MATE.p = null; _xray = null; }
// his rig: the ride he reports (1 = the horse, 2–4 = the war rides), the general on it, the real models once they have loaded
function build(mount){ unbuild(); const kind = mount > 1 ? RIDES[mount] || null : null, H = kind ? buildBikeMount(kind) : buildHorse(), G = buildGeneral(), root = new THREE.Group(); root.name = 'coopMate';
  if(kind) H.root.scale.setScalar(XEOM.k); if(H.drv){ H.drv.onCrash = null; H.drv.onBack = null; } root.add(H.root); scene.add(root);
  MATE.root = root; MATE.G = G; MATE.H = H; MATE.mount = mount; MATE.RC = { mate:true, on:true, mounted:false, H, G, real:null, realP:null, trans:null, speed:0, stance:'stand', aimUp:true }; seat(true);
  try{ fitRealCav(MATE.RC); }catch(e){ fail(e); }
  // the outline seen through walls: a flat figure that ignores depth, shown only while something stands between the camera and him
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d'); c.strokeStyle = COOP.mate.css; c.lineWidth = 5; c.lineJoin = 'round'; c.shadowColor = COOP.mate.css; c.shadowBlur = 6;
  c.beginPath(); c.arc(32, 18, 10, 0, 6.283); c.stroke(); c.beginPath(); c.moveTo(16, 34); c.lineTo(48, 34); c.lineTo(52, 76); c.lineTo(42, 76); c.lineTo(42, 122); c.lineTo(34, 122); c.lineTo(32, 84); c.lineTo(30, 122); c.lineTo(22, 122); c.lineTo(22, 76); c.lineTo(12, 76); c.closePath(); c.stroke();
  _xray = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), transparent:true, opacity:0.95, depthTest:false, depthWrite:false, fog:false })); _xray.renderOrder = 999; _xray.scale.set(COOP.mate.xrayW, COOP.mate.xrayH, 1); _xray.position.y = COOP.mate.xrayH / 2; _xray.visible = false; root.add(_xray); }
function fail(e){ MATE.err++; MATE.lastErr = String(e && e.message || e).slice(0, 200); if(MATE.err <= 3) console.warn('coop: the other soldier\'s rig', e); }
// a player-shaped object for him: the pose code reads the gun in S.player's hands, and on the host the enemy's AI regards "the player" (game/coop-glue.js swaps
// it in for the men who regard him). Anything not set here is read off the local player (the same kind of soldier).
function proxy(){ const base = MATE.base, p = Object.create(base);
  Object.assign(p, { mate:true, pos:new THREE.Vector3(), vel:new THREE.Vector3(), facing:0, aim:0, aimSmoothed:0, mesh:MATE.root, muzzle:MATE.G.userData.muzzle, guns:[{ id:MATE.gun || base.guns[0].id, ammo:30, rU:0, rD:0, star:1 }], gunIdx:0,
    hp:100, maxHp:100, radius:CAV.radius.foot, hitT:0, kbx:0, kbz:0, invincibleUntil:0, shieldUntil:0, respawnBlinkUntil:0, fireAt:0, cav:MATE.RC, bike:MATE.H.bike || null, burns:[], defK:1, armor:0, lives:9, fwdSpeed:0, throttle:0 });
  return p; }
export function mateProxy(){ return MATE.on ? MATE.p : null; }
// how far the gun in his hands reaches, by this page's own table (the host judges his hit reports with it)
export function mateRange(){ if(!MATE.p) return 0; const sp = S.player; S.player = MATE.p; try{ return playerRange(); }catch(e){ return 0; }finally{ S.player = sp; } }
// the pose code is written for ONE soldier and reads him off globals: for the length of fn they describe the other one (always put back)
const _sv = { p:null, f:false, trans:null, jump:null, climb:null, roll:null, land:0, cover:null, aimUp:false };
function asMate(fn){ _sv.p = S.player; _sv.f = S.firing; _sv.trans = CV.trans; _sv.jump = CV.jump; _sv.climb = CV.climb; _sv.roll = CV.roll; _sv.land = CV.land; _sv.cover = CV.cover; _sv.aimUp = CV.aimUp;
  S.player = MATE.p; S.firing = MATE.firing; CV.trans = CV.jump = CV.climb = CV.roll = CV.cover = null; CV.land = 0; CV.aimUp = MATE.RC.aimUp;
  try{ fn(); }catch(e){ fail(e); }finally{ S.player = _sv.p; S.firing = _sv.f; CV.trans = _sv.trans; CV.jump = _sv.jump; CV.climb = _sv.climb; CV.roll = _sv.roll; CV.land = _sv.land; CV.cover = _sv.cover; CV.aimUp = _sv.aimUp; } }
let _dt = 0, _now = 0;
function pose(){ const M = MATE, G = M.G, H = M.H, tw = wrapA(M.aim - M.heading);
  if(M.mounted){ const v = M.vx * Math.sin(M.heading) + M.vz * Math.cos(M.heading); M.RC.speed = v;
    if(!H.bike){ H.root.position.copy(M.root.position); H.root.rotation.y = M.heading; } animateHorse(H, _dt, v, M.yawRate); H.root.position.set(0, 0, 0); H.root.rotation.y = 0; poseRider(G, H, _dt, tw, M.firing); }
  else { animateSoldier(G, Math.hypot(M.x - M.lastX, M.z - M.lastZ), _dt, M.firing); poseSoldier(G, M.stance, _dt); const u = G.userData; if(u.up) u.up.rotation.y += (Math.max(-0.9, Math.min(0.9, tw)) - u.up.rotation.y) * Math.min(1, _dt * 10); cloakFoot(G, M.speed, M.stance === 'prone'); }
  updateRealCav(M.RC, _dt, { twist:tw, footV:M.mounted ? 0 : M.speed, stance:M.stance, trans:false, hit:M.p.hitT > 0, ride:M.mounted && H.inert ? H.inert : null, move:null, climb:null, dead:M.dead }); }
// every frame: st = the other player's interpolated state (net/interp.js out.pl[i]) or null while there is none; name = his nickname
export function mateUpdate(dt, now, st, name){ const M = MATE;
  if(!st || !st.id || typeof document === 'undefined'){ if(M.on){ M.on = false; if(M.root) M.root.visible = false; marks(false); } return; }
  const mount = st.mount >= 1 && st.mount < RIDES.length ? st.mount : 1; if(!M.root || M.mount !== mount){ try{ build(mount); }catch(e){ fail(e); return; } M.base = null; }
  if(M.base !== S.player || !M.p){ M.base = S.player; M.p = proxy(); }   // (a new local soldier — another ride picked — is a new thing to inherit from)
  const F = NET_PFLAG, first = !M.on; M.on = true; M.name = name || M.name || 'ĐỒNG ĐỘI'; M.frames++; M.root.visible = true;
  M.lastX = first ? st.x : M.x; M.lastZ = first ? st.z : M.z; M.x = st.x; M.z = st.z; { const gy = heightAt(st.x, st.z); M.y = Math.abs(st.y - gy) < 12 ? st.y : gy; }
  M.yawRate += ((first || dt <= 0 ? 0 : wrapA(st.heading - M.heading) / dt) - M.yawRate) * Math.min(1, dt * 8); M.heading = st.heading; M.aim = st.aimYaw; M.pitch = st.aimPitch; M.vx = st.vx; M.vz = st.vz; M.speed = Math.hypot(st.vx, st.vz);
  M.flags = st.flags; M.hp = st.hp; M.hpMax = st.hpMax || 1; M.down = !!(st.flags & F.DOWNED); M.dead = !!(st.flags & F.DEAD); M.firing = !!(st.flags & F.FIRING) && !M.down && !M.dead; const mounted = !!(st.flags & F.MOUNTED) && !M.down && !M.dead;
  M.stance = M.down || st.stance === NET_STANCE.PRONE ? 'prone' : st.stance === NET_STANCE.CROUCH ? 'crouch' : 'stand'; M.gun = gunIds()[st.weapon] || gunIds()[0]; M.RC.stance = M.stance; M.RC.aimUp = !(st.flags & F.SPRINT); M.RC.slung = !!(st.stance & NET_STANCE.SLUNG); M.RC.blade = !!(st.stance & NET_STANCE.BLADE) && M.stance === 'stand'; M.bladeAt = M.RC.blade ? (M.bladeAt >= 0 ? M.bladeAt : now) : -1;   /* (AMBUSH 2 since when this page has seen the blade in his hands: the host takes no cut before BLADE.draw s of it) */   /* BLADE 3 the other player's blade in his hands: his stance and the weapon, not his cuts */   // (CARRY 1 the other player's rifle on his back: actors/gun-carry.js reads cv.slung)
  { const sw = M.down ? 0 : swimOfNet(st.stance); M.RC.swim = sw; if(sw) M.stance = M.RC.stance = 'swim'; }   // SWIM 1 he swims / is under: the puppet plays the same clips, no foot planted (game/swim.js)
  if(mounted !== M.mounted || first){ M.mounted = mounted; try{ seat(mounted); }catch(e){ fail(e); } }
  M.root.position.set(M.x, M.y, M.z); M.root.rotation.y = M.heading;
  // the player-shaped object follows him (the pose code and, on the host, the enemy read it)
  const p = M.p; p.pos.set(M.x, 0, M.z); p.vel.set(M.vx, 0, M.vz); p.facing = M.heading; p.aim = p.aimSmoothed = M.aim; p.hp = M.hp; p.maxHp = M.hpMax; p.fwdSpeed = M.speed; p.mesh = M.root; p.muzzle = M.G.userData.muzzle;
  p.radius = M.mounted ? CAV.radius.mounted : M.stance === 'prone' ? CAV.radius.prone : CAV.radius.foot; p.guns[0].id = M.gun; p.guns[0].rU = (st.flags & F.RELOADING) ? now + 0.5 : 0; p.invincibleUntil = M.down || M.dead ? Infinity : 0; if(p.hitT > 0) p.hitT -= dt;
  _dt = dt; _now = now; if(dt > 0) asMate(pose);
  if(M.firing && !M.RC.blade && now >= M.fireAt) shot(now); tracers(dt);   // (AMBUSH 1 the blade out: his FIRING flag is a cut — a swing on his rig, no flash, no report)
  M.dist = S.player ? Math.hypot(M.x - S.player.pos.x, M.z - S.player.pos.z) : 0; marks(true, now); }
// one of his shots as this page draws it: the flash at his muzzle, the report, a tracer along his aim that stops at the first wall — light and sound only
function shot(now){ const M = MATE, g = GUNS[M.gun] || {}, C = COOP.mate; M.fireAt = now + Math.max(C.fireEvery, g.fireCd || 0); M.shots++;
  M.G.userData.muzzle.getWorldPosition(_v); if(!(_v.y > -50 && _v.y < 500)) return; const cp = Math.cos(M.pitch), dx = Math.sin(M.aim) * cp, dy = Math.sin(M.pitch), dz = Math.cos(M.aim) * cp, R = Math.min(140, (g.rng || 1) * 70);
  try{ gunFlash(_v.x, _v.y, _v.z, M.aim, 0.6, 0.34, 0xfff0c0, 0.9); gunSound(g.snd || 'rifleShot', M.p.pos, 'p'); }catch(e){ fail(e); }
  let k = 1; try{ const h = lineHit(_v.x, _v.y, _v.z, _v.x + dx * R, _v.y + dy * R, _v.z + dz * R, 0.1, 0, null); if(h) k = h.t; }catch(e){}
  if(TR.length < C.tracerN) TR.push({ x:_v.x, y:_v.y, z:_v.z, vx:dx * C.tracerV, vy:dy * C.tracerV, vz:dz * C.tracerV, life:Math.min(C.tracerLife * 4, R * k / C.tracerV) }); }
function tracers(dt){ for(let i = TR.length - 1; i >= 0; i--){ const t = TR[i], st = Math.min(dt, t.life), n = 4;
    for(let k = 1; k <= n; k++){ const f = k / n * st; addTrail(t.x + t.vx * f, t.y + t.vy * f, t.z + t.vz * f, 0xffe6a0, 0.34, COOP.mate.tracerLife); }
    t.x += t.vx * st; t.y += t.vy * st; t.z += t.vz * st; t.life -= dt; if(t.life <= 0 || t.y < heightAt(t.x, t.z)){ TR[i] = TR[TR.length - 1]; TR.pop(); } } }
// ---- how he is found: the name tag, the outline through walls, the edge arrow, the map dot ----
function el(id, css){ let e = document.getElementById(id); if(!e){ e = document.createElement('div'); e.id = id; e.style.cssText = 'position:fixed;left:0;top:0;z-index:40;pointer-events:none;display:none;will-change:transform;font:600 12px/1.2 "Share Tech Mono",ui-monospace,monospace;text-shadow:0 1px 3px #000,0 0 6px #000;white-space:nowrap;' + css; document.body.appendChild(e); } return e; }
function marks(on, now){ const M = MATE, C = COOP.mate; if(typeof document === 'undefined') return;
  _tag = _tag || el('coopTag', 'text-align:center;'); _arrow = _arrow || el('coopArrow', 'text-align:center;');
  if(!on || !S.player || (S.mode !== 'playing' && S.mode !== 'countdown' && S.mode !== 'dying')){ _tag.style.display = _arrow.style.display = 'none'; if(_xray) _xray.visible = false; M.onScreen = false; return; }
  const col = M.down ? C.downCss : C.css, W = innerWidth, Hh = innerHeight; camera.updateMatrixWorld();   // (the camera moved this frame; its matrices are otherwise the last frame's — the tag would trail him in a pan)
  _v.set(M.x, M.y + (M.mounted ? C.rideTagY : M.stance === 'prone' ? C.tagY * 0.45 : C.tagY), M.z).project(camera); const front = _v.z < 1, sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * Hh, seen = front && sx > 8 && sx < W - 8 && sy > 8 && sy < Hh - 8; M.onScreen = seen;
  if(seen){ const t = (M.down ? '✚ ' : '') + M.name + (M.down ? ' — NGÃ' + (M.revive > 0 ? ' ' + Math.round(M.revive * 100) + '%' : '') : ''), hp = Math.max(0, Math.min(1, M.hp / M.hpMax));
    if(_tag._t !== t || _tag._c !== col){ _tag._t = t; _tag._c = col; _tag.textContent = t; _tag.style.color = col; const b = document.createElement('div'); b.style.cssText = 'height:3px;margin:2px auto 0;width:46px;background:rgba(0,0,0,.55);'; const f = document.createElement('div'); f.style.cssText = 'height:100%;background:' + col + ';transform-origin:0 50%;'; b.appendChild(f); _tag.appendChild(b); _tag._f = f; }
    if(_tag._f && _tag._hp !== (hp * 20 | 0)){ _tag._hp = hp * 20 | 0; _tag._f.style.transform = 'scaleX(' + hp.toFixed(2) + ')'; }
    _tag.style.display = 'block'; _tag.style.transform = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px) translate(-50%,-100%)'; _arrow.style.display = 'none'; }
  else { let dx = _v.x, dy = -_v.y; if(!front){ dx = -dx; dy = -dy; } const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; const hw = W / 2 - C.arrowPad, hh = Hh / 2 - C.arrowPad, k = Math.min(hw / Math.max(1e-3, Math.abs(dx)), hh / Math.max(1e-3, Math.abs(dy)));
    const ax = W / 2 + dx * k, ay = Hh / 2 + dy * k, deg = Math.round(Math.atan2(dy, dx) * 57.3), t = Math.round(M.dist) + ' m';
    if(!_arrow._a){ const a = document.createElement('div'); a.textContent = '➤'; a.style.cssText = 'font-size:22px;line-height:22px;'; const d = document.createElement('div'); _arrow.append(a, d); _arrow._a = a; _arrow._d = d; }
    const lab = (M.down ? '✚ ' : '') + M.name + ' · ' + t; if(_arrow._t !== lab){ _arrow._t = lab; _arrow._d.textContent = lab; } if(_arrow._c !== col){ _arrow._c = col; _arrow.style.color = col; } if(_arrow._g !== deg){ _arrow._g = deg; _arrow._a.style.transform = 'rotate(' + deg + 'deg)'; }
    _arrow.style.display = 'block'; _arrow.style.transform = 'translate(' + Math.round(ax) + 'px,' + Math.round(ay) + 'px) translate(-50%,-50%)'; _tag.style.display = 'none'; }
  // is something between the camera and him? (walls and buildings: combat/solid-line.js; a rise of the ground: sampled) — looked at a few times a second
  if(now >= M.losAt){ M.losAt = now + C.losEvery; let hid = false; const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, ty = M.y + 1.1;
    try{ hid = !lineClear(cx, cy, cz, M.x, ty, M.z); }catch(e){}
    if(!hid){ const d = Math.hypot(M.x - cx, M.z - cz), n = Math.min(40, Math.floor(d / C.losStep)); for(let i = 1; i < n; i++){ const f = i / n; if(heightAt(cx + (M.x - cx) * f, cz + (M.z - cz) * f) > cy + (ty - cy) * f + C.losClear){ hid = true; break; } } }
    M.hidden = hid; }
  if(_xray){ _xray.visible = M.hidden && seen; if(_xray.visible){ _xray.material.color.set(col); _xray.scale.set(C.xrayW * (M.stance === 'prone' ? 1.7 : 1), C.xrayH * (M.stance === 'prone' ? 0.45 : M.mounted ? 1.25 : 1), 1); _xray.position.y = _xray.scale.y / 2; } } }
// the map: a ring round a dot in his colour (ui/radar.js drawRadar calls it last)
export function mateRadar(c, toX, toY){ const M = MATE; if(!M.on) return; const x = toX(M.x), y = toY(M.z), col = M.down ? COOP.mate.downCss : COOP.mate.css;
  if(M.mark){ const mx = toX(M.mark.x), my = toY(M.mark.z); c.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 170); c.strokeStyle = '#7fd0ff'; c.lineWidth = 1.6; c.beginPath(); c.arc(mx, my, 6, 0, 6.283); c.stroke(); c.globalAlpha = 1; }   // (the host's side mission: its place)
  c.fillStyle = col; c.beginPath(); c.arc(x, y, 3, 0, 6.283); c.fill(); c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, 6, 0, 6.283); c.stroke(); }
export function mateClear(){ MATE.on = false; MATE.mark = null; TR.length = 0; marks(false); unbuild(); MATE.base = null; MATE.mount = 0; MATE.revive = 0; }
