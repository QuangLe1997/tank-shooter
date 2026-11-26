// game/swim.js — SWIM 1 THE SOLDIER IN THE RIVER (soldier mode, on foot; config SWIM): the water's depth at his feet (RIVER.y − the ground there; a bridge's
//   deck or the ice is dry) sets what he can do. Ankle-deep he splashes; knee- and thigh-deep he wades — slower, a splash at every step, a wake and rings
//   spreading; waist- and chest-deep slower still, turning slowly, the rifle kept at his shoulder above the water (he fires as ever, throws a grenade, can
//   kneel only to waist-deep, cannot lie down, jump or roll). Deeper than SWIM.deep[0] he leaves the bed and SWIMS: the library's tread-water clip on the
//   spot and its stroke on the move (actors/real-cav.js plays them on the hidden operator), the rifle slung on his back (actors/gun-carry.js why 'swim'),
//   his head above the surface, bobbing with it, rings and a wake round him, strokes and breaths heard. Swimming he cannot aim a rifle (the game has no
//   pistol): the trigger is the knife, at arm's length (game/quiet.js quietKnife); no grenade, smoke or medkit; the long blade stays on his back. Holding C
//   ducks him under — the stroke a metre down, a blue tint, the world muffled, a breath meter; under the water he is hard to make out (game/stealth.js
//   treats him as one lying flat) and what reaches him of a round is SWIM.dive.defK. Wading, what would strike under the waterline is spent in it.
//   He climbs out where the bed rises: his feet find it, he stands and wades up the bank (his height eased, never popped).
//   The rivers as carved were never deeper than ~1.3 m: swimPools digs a pool into the main channel's middle, clear of every bridge and ford (world/river.js).
//   Enemy infantry and the fireteam do not swim in their kit: swimFoeK stops a man at chest-deep water (they cross by the bridges and fords, Z415).
//   Co-op: two bits of the stance byte (NET_STANCE.SWIM / DIVE) carry it to the other page, whose puppet of him plays the same clips (game/coop-*.js).
import * as THREE from 'three';
import { AUDIOFX, CAV, LOGISTICS, REALCAV, SWIM } from '../../config.js';
import { horseSwimFire, horseSwimNoHand } from '../hub.js';   // HSWIM 1 (game/horse-swim.js)
import { HSWIM2 } from '../../config.js';
import { waterFoam, waterRing, waterSplash } from '../hub.js';   // HSWIM 2 (fx/water-spray.js)
import { AFXX, ARENA, BLADEST, CV, HF, MOBILE, NET_STANCE, RIVER, S, TIPS, TIP_SHOW, actx, afxOn, afxPlay, animClip, animInfo, bladeHold, bladeSwitch, carryBack, enemies, floatText, heightAt, heldAction, loadAnimGroup, quietKnife, scene, spawnPart, tip, wadeAt } from '../hub.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const BAND = ['', 'NƯỚC NGANG MẮT CÁ', 'LỘI NƯỚC · NGANG GỐI', 'LỘI NƯỚC · NGANG HÔNG', 'LỘI NƯỚC · NGANG NGỰC', 'ĐANG BƠI'];
// mode: 'dry' | 'wade' | 'swim' · band 0 dry … 4 chest, 5 swimming · d the depth at his feet · y his eased height (null: on the bed) · headOff his head over his
//   soles as the clip has him (measured on the seen soldier every frame) · breath 0–1 · cost: ms spent here (the probe's cost a frame)
export const SWST = { mode:'dry', band:0, d:0, under:false, diveKey:false, breath:1, y:null, headOff:1.6, face:null, lib:false, enterAt:-9, noteAt:-9, knifeAt:-9,
  stepT:0, side:1, wakeT:0, ringT:0, strokeT:0, breathT:0, warned:false, ms:0, n:0, swims:0, dives:0, stabs:0 };

// ---- the depth of the water at a spot (≤ 0: dry; a bridge's deck and the ice are dry) ----
export function swimDepth(x, z){ return RIVER.on ? RIVER.y - heightAt(x, z) : -9; }
function bandOf(d){ let b = 0; for(const t of SWIM.bands) if(d >= t) b++; return b; }
function speedAt(d){ const P = SWIM.speed; if(d <= P[0][0]) return P[0][1]; for(let i = 1; i < P.length; i++) if(d <= P[i][0]){ const a = P[i - 1], b = P[i]; return a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]); } return P[P.length - 1][1]; }
function note(txt, now, col){ if(now - SWST.noteAt < SWIM.swim.fireMsg) return; SWST.noteAt = now; const p = S.player; if(p) floatText(txt, col || '#9fd8e8', p.pos, 14); }

// ---- cavalry.js updateCavalry, in place of wadeAt: the state for this frame; → his pace × (the stroke's own pace is held in swimPlace) ----
export function swimStep(p, dt, now){ const W = SWST, t0 = performance.now();
  if(!SWIM.on || !RIVER.on || CV.mounted || CV.trans || CV.dead || p.downed){ if(W.mode !== 'dry') leave(now); CV.diving = false; W.d = 0; W.band = 0; return wadeAt(p.pos.x, p.pos.z); }
  if(!W.lib){ W.lib = true; loadAnimGroup('social'); }
  const d = swimDepth(p.pos.x, p.pos.z), band = bandOf(d), dp = SWIM.deep, swim = W.mode === 'swim' ? d > dp[1] : d > dp[0]; W.d = d;
  if(swim && W.mode !== 'swim') enter(p, now); else if(!swim && W.mode === 'swim') leave(now);
  if(!swim) W.mode = band > 0 ? 'wade' : 'dry'; W.band = swim ? 5 : band; let k;
  if(swim){ const D = SWIM.dive, ask = heldAction('camAuto') || (!MOBILE && CV.want === 'crouch') || CV.want === 'prone';   // (C held, or the crouch / prone toggle: on phones he kneels by himself when still — only prone dives there)
    if(!W.under && ask){ CV.want = 'stand'; if(d < dp[0] + D.floor){ note('NƯỚC NÔNG — KHÔNG LẶN ĐƯỢC', now); } else if(W.breath < D.msgAt){ note('CHƯA LẤY LẠI HƠI', now); } else { W.under = true; W.diveKey = heldAction('camAuto'); W.dives++; splash(p.pos.x, p.pos.z, 7, 2.4); sound('stroke', p.pos, 1.1, 0.8); } }
    else if(W.under){ const up = W.breath <= 0 || (W.diveKey ? !heldAction('camAuto') : CV.want === 'crouch' || CV.want === 'prone'); if(up){ surface(p, now); if(W.breath <= 0) note('HẾT HƠI — NỔI LÊN!', now, '#ffcf5a'); } }
    W.breath = clamp(W.breath + (W.under ? -dt / D.breath : dt * D.back / D.breath), 0, 1);
    if(BLADEST.held) bladeSwitch(false);   // (the long blade goes back on his back: not a thing to swim with)
    k = (W.under ? D.v : SWIM.swim.v) / CAV.foot.walk; }
  else { W.breath = Math.min(1, W.breath + dt * SWIM.dive.back / SWIM.dive.breath);
    if(CV.want === 'prone' && d > SWIM.prone){ CV.want = d > SWIM.crouch ? 'stand' : 'crouch'; note('NƯỚC SÂU — KHÔNG NẰM ĐƯỢC', now); }
    if(CV.want === 'crouch' && d > SWIM.crouch && !MOBILE){ CV.want = 'stand'; note('NƯỚC SÂU — KHÔNG QUỲ ĐƯỢC', now); }
    if(MOBILE && d > SWIM.crouch) CV.still = 0;   // (phones: no kneeling by himself in deep water)
    k = d > 0 ? speedAt(d) : 1; }
  CV.diving = W.mode === 'swim' && W.under;   // (game/stealth.js playerHidden: under the water he is as hard to make out as a man lying flat)
  W.ms += performance.now() - t0; return k; }
function enter(p, now){ const W = SWST; W.mode = 'swim'; W.enterAt = now; W.under = false; W.strokeT = 0; W.breathT = 0; W.swims++; W.face = p.facing;
  if(CV.want !== 'stand') CV.want = 'stand'; CV.cover = null; if(BLADEST.held) bladeSwitch(false);
  if(!W.warned){ W.warned = true; if(TIPS && !TIPS.swim){ TIPS.swim = ['spark', 'Bơi qua sông', 'Nước sâu quá đầu người thì anh <b>bơi</b>: súng đeo sau lưng, <b>không bắn được</b> — áp sát địch thì bóp cò để <b>đâm dao</b>, không ném được lựu đạn. Giữ <b>C</b> để <b>lặn</b>: khó bị nhìn thấy, đạn mất sức trong nước — để ý <b>thanh hơi</b>. Lội nước tới ngực vẫn bắn được, đi chậm hơn.']; TIP_SHOW.swim = 1; } tip('swim'); }
  floatText('ĐANG BƠI', '#9fd8e8', p.pos, 15); }
function leave(now){ const W = SWST; if(W.under) surface(S.player, now); W.mode = 'dry'; W.under = false; if(CV.want === 'swim') CV.want = 'stand'; hud(now, true); }
function surface(p, now){ const W = SWST; W.under = false; CV.want = 'stand'; if(p) sound('gasp', p.pos, 1, 1); muffle(false); }

// ---- cavalry.js, right after his body is set on the ground: off the bed and afloat, his pace, his heading, what reaches him, the water round him ----
const _bob = { t:0 };
export function swimPlace(p, dt, now){ const W = SWST; if(W.mode === 'dry' && W.y == null){ if(W.shown) hud(now); return; } const t0 = performance.now(), bed = p.mesh.position.y, v = Math.hypot(p.vel.x, p.vel.z);
  if(W.mode === 'swim'){ const SW = SWIM.swim, D = SWIM.dive;
    CV.stance = 'swim'; CV.aimUp = false; CV.cover = null; CV.moveT = 0;   // (his legs are the clip's: actors/soldier-legs.js plants no foot for a stance it does not know)
    const vmax = W.under ? D.v : SW.v; if(v > vmax){ const k = vmax / v, ex = (1 - k) * dt; p.pos.x -= p.vel.x * ex; p.pos.z -= p.vel.z * ex; p.vel.x *= k; p.vel.z *= k; p.mesh.position.x = p.pos.x; p.mesh.position.z = p.pos.z; }   // (the stroke's own pace, whatever the keys ask)
    const want = v > SW.moveV ? Math.atan2(p.vel.x, p.vel.z) : p.aimSmoothed; if(W.face == null) W.face = p.facing; W.face = wrapA(W.face + clamp(wrapA(want - W.face), -SWIM.turn * dt, SWIM.turn * dt)); p.facing = W.face;   // (along his stroke; treading, round to where he looks — slowly)
    _bob.t += dt; const bob = Math.sin(_bob.t * SW.bob[1]) * SW.bob[0], tgt = W.under ? Math.max(bed + D.floor, RIVER.y - W.headOff - D.depth) : Math.max(bed, RIVER.y - W.headOff + SW.head + bob);
    if(W.y == null) W.y = bed; W.y += (tgt - W.y) * Math.min(1, dt * SW.yRate); p.mesh.position.y = Math.max(bed, W.y);
    p.defK = (W.under ? D.defK : SW.defK) * CAV.defK.stand; }
  else { if(W.y != null){ W.y += (bed - W.y) * Math.min(1, dt * SWIM.swim.yRate * 1.4); if(W.y - bed < 0.01) W.y = null; else p.mesh.position.y = W.y; }   // (his feet find the bed: he settles onto it, never dropped)
    if(W.face == null || Math.abs(p.pos.x - (W.px ?? p.pos.x)) + Math.abs(p.pos.z - (W.pz ?? p.pos.z)) > 3) W.face = p.facing; W.px = p.pos.x; W.pz = p.pos.z; /* (a respawn / a jump across the map: his heading as it is, not turned round slowly from where he was) */ if(W.band >= 3){ W.face = wrapA(W.face + clamp(wrapA(p.facing - W.face), -SWIM.turn * dt, SWIM.turn * dt)); p.facing = W.face; CV.aimUp = true; } else W.face = p.facing;   // (waist-deep: he turns against the water, the rifle up out of it)
    if(W.d > 0) p.defK *= 1 - SWIM.wade.defLoss * clamp(W.d / SWIM.deep[0], 0, 1); }
  fx(p, dt, now, v); hud(now); W.ms += performance.now() - t0; W.n++; }

// ---- soldier-fire.js: the trigger while he swims → the knife at arm's length, or nothing (true: no round) ----
export function swimFire(now){ const W = SWST, p = S.player; if(W.mode !== 'swim' || !p) return horseSwimFire(now);   // (HSWIM 1 on a swimming horse: no shot either — game/horse-swim.js)
  if(now - W.knifeAt < 0.25) return true; W.knifeAt = now;
  const R = LOGISTICS.quiet.knife.reach * 1.1; let near = false; for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(e.hp > 0 && Math.abs(e.pos.x - p.pos.x) < R && Math.abs(e.pos.z - p.pos.z) < R && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < R){ near = true; break; } }
  if(near && !W.under){ if(quietKnife()) W.stabs++; } else note(W.under ? 'ĐANG LẶN — KHÔNG BẮN ĐƯỢC' : 'ĐANG BƠI — KHÔNG BẮN ĐƯỢC (ÁP SÁT ĐỂ ĐÂM DAO)', now); return true; }
// combat/spells.js castSpell: no grenade, smoke or medkit while swimming (true: refused, nothing spent)
const HAND = { grenade:1, smokeHand:1, medkit:1 };
export function swimNoSkill(sp){ if(sp && HAND[sp.id] && horseSwimNoHand()) return true; if(SWST.mode !== 'swim' || !sp || !HAND[sp.id]) return false; note('ĐANG BƠI — KHÔNG NÉM ĐƯỢC', performance.now() / 1000); return true; }
// game/soldier-moves.js: no jump or combat roll in deep water
export const swimNoMove = () => SWST.mode === 'swim' || SWST.d > SWIM.jump;
// actors/gun-carry.js why(): the rifle on his back while he swims
export const swimSlung = cv => cv === CV && SWST.mode === 'swim';
// co-op: this page's soldier → the stance byte's bits (game/coop-glue.js myState) · the byte → the other page's puppet (game/coop-remote.js): 0 dry / 1 swimming / 2 under
export const swimNet = () => SWST.mode !== 'swim' ? 0 : NET_STANCE.SWIM | (SWST.under ? NET_STANCE.DIVE : 0);
export const swimOfNet = st => st & NET_STANCE.SWIM ? (st & NET_STANCE.DIVE ? 2 : 1) : 0;
function swimOf(cv){ return cv === CV ? (SWST.mode === 'swim' ? (SWST.under ? 2 : 1) : 0) : (cv && cv.swim | 0); }

// ---- enemy infantry / the fireteam (actors/infantry.js, actors/fireteam.js), in place of wadeAt: × his pace, 0 = he does not step on into deeper water ----
export function swimFoeK(e, mx, mz){ const w = wadeAt(e.pos.x, e.pos.z); if(w >= 1 || !SWIM.on) return w; const L = Math.hypot(mx, mz); if(L < 1e-4) return w;
  const F = SWIM.foe, ax = e.pos.x + mx / L * F.look, az = e.pos.z + mz / L * F.look, dA = RIVER.y - heightAt(ax, az);
  return dA > F.maxD && dA > RIVER.y - heightAt(e.pos.x, e.pos.z) ? 0 : w; }

// ---- world/river.js carveRivers: a pool dug into the main channel's middle, clear of the crossings (the rivers were nowhere deep enough to swim) ----
export function swimPools(h, lines){ const P = SWIM.pool, L = lines && lines[0]; if(!SWIM.on || !P.on || !L || L.ice) return 0;
  const pts = L.pts, R = L.w * P.u, W = HF.W, st = HF.step, A = ARENA, add = new Float32Array(W * W); let n = 0;
  const crossD = (x, z) => { let m = 1e9; for(const f of RIVER.fords) m = Math.min(m, Math.hypot(x - f.x, z - f.z) - f.r); for(const b of RIVER.bridges) m = Math.min(m, Math.hypot(x - b.x, z - b.z) - b.hl); return m; };
  for(let s = 0; s < pts.length - 1; s++){ const a = pts[s], b = pts[s + 1], vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1;
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - R + A) / st)), i1 = Math.min(HF.N, Math.ceil((Math.max(a.x, b.x) + R + A) / st)), j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - R + A) / st)), j1 = Math.min(HF.N, Math.ceil((Math.max(a.z, b.z) + R + A) / st));
    for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const x = -A + i * st, z = -A + j * st, t = clamp(((x - a.x) * vx + (z - a.z) * vz) / L2, 0, 1), dx = x - (a.x + vx * t), dz = z - (a.z + vz * t), u = Math.sqrt(dx * dx + dz * dz) / L.w;
      if(u >= P.u) continue; const v = P.deep * smooth(P.u, P.u * (P.flat ?? 0.35), u) * smooth(P.gap, P.gap + P.ramp, crossD(x, z)), k = j * W + i; if(v > add[k]) add[k] = v; } }
  for(let k = 0; k < add.length; k++) if(add[k] > 0){ h[k] -= add[k]; n++; } return n; }

// ---- actors/real-cav.js poseRealCav, before the mixer: the clip he plays afloat (null: the rifle's own, as ever) ----
const ARM = ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'], _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _g = new THREE.Vector3();
const rootK = () => REALCAV.opH / 1.88 * (REALCAV.s2 && REALCAV.s2.on ? REALCAV.s2.k || 1 : 1);   // (the library's metres → the world's, as actors/blade.js)
function rig(R){ return R.swm || (R.swm = { t:0, take:0, prev:new Float32Array(ARM.length * 4), ok:false, ts:1 }); }
function act(R, id){ let a = R.OA[id]; if(a) return a; const c = animClip(id); if(!c){ const m = animInfo(id); if(m) loadAnimGroup(m.g); return null; }
  a = R.om.clipAction(c); a.enabled = true; a.setEffectiveWeight(0); a.play(); R.OA[id] = a; return a; }   // (into the rifle clips' own set: their cross-fade takes him in and out)
export function swimClip(cv, R, dt, P, mounted){ if(!R.pup || !R.om || !R.OA) return null; const M = rig(R), st = swimOf(cv);
  if(!st || mounted || P.dead){ M.t = 0; M.take = 0; return null; } M.t += dt;
  const D = R.pup.D; M.ok = true; for(let i = 0; i < ARM.length; i++){ const b = D[ARM[i]]; if(b) b.quaternion.toArray(M.prev, i * 4); else M.ok = false; }   // (his arms as the last frame left them: eased from, below)
  if(M.t < SWIM.swim.slingT) return null;   // (first the rifle onto his back)
  const SW = SWIM.swim, v = P.footV || 0, id = v > SW.moveV || st === 2 ? SW.stroke : SW.tread; if(!act(R, SW.tread) || !act(R, SW.stroke)) return null;
  const I = animInfo(id); M.ts = id === SW.tread ? 1 : st === 2 && v < SW.moveV ? 0.55 : clamp(v / ((I && I.speed || 0.4) * rootK()), SW.ts[0], SW.ts[1]);
  if(cv === CV && id === SW.stroke){ SWST.strokeT += dt * M.ts * SW.strokeRate / ((I && I.dur) || 4.5); if(SWST.strokeT >= 1){ SWST.strokeT -= 1; stroke(S.player); } }
  return id; }
// ---- …after his legs and trunk (before the hold): true = his arms are the clip's (eased in from where they were) and the rifle is on his back ----
export function swimPose(cv, R, G, dt, P){ const M = R.swm; if(!M) return false; const st = swimOf(cv); if(!st || P.dead || M.t < SWIM.swim.slingT){ if(M) M.take = 0; return false; }
  const D = R.pup.D; if(cv === CV && D.Head){ D.Head.getWorldPosition(_v); G.getWorldPosition(_g); SWST.headOff += (clamp(_v.y - _g.y, 0.2, 2.2) - SWST.headOff) * Math.min(1, dt * 6); }
  carryBack(R, G); const cy = R.cy; if(cy){ cy.why = 'swim'; if(cy.st) for(const m of cy.st) if(m) m.visible = false; } bladeHold(cv, R, G, dt, P);   // (the straps hang by the world's down: on a man lying in the water they hung into it — hidden while he swims)
  M.take += dt; const SW = SWIM.swim, k = Math.min(1, dt * (SW.armRate[0] + (SW.armRate[1] - SW.armRate[0]) * smooth(0, SW.armT, M.take)));
  if(M.ok && k < 1){ for(let i = 0; i < ARM.length; i++){ const b = D[ARM[i]]; _q.fromArray(M.prev, i * 4).slerp(b.quaternion, k); b.quaternion.copy(_q); } if(D.LeftShoulder) D.LeftShoulder.updateMatrixWorld(true); if(D.RightShoulder) D.RightShoulder.updateMatrixWorld(true); }
  return true; }

// ---- the water round him: splashes at his steps, a wake, rings spreading, a stroke's splash, his breath ----
const RINGS = []; let _ringGeo = null;
function ring(x, z){ if(HSWIM2.on && HSWIM2.ring.soft){ waterRing(x, z); return; }   // HSWIM 2 a soft-edged ripple on the water (fx/water-spray.js)
  const F = SWIM.fx; if(!_ringGeo){ _ringGeo = new THREE.RingGeometry(0.94, 1, 48); _ringGeo.rotateX(-Math.PI / 2); }
  let r = RINGS.find(o => o.t >= 1); if(!r){ if(RINGS.length >= F.rings) return; const m = new THREE.Mesh(_ringGeo, new THREE.MeshBasicMaterial({ color:F.col, transparent:true, opacity:0, depthWrite:false }));
    m.renderOrder = 4; m.frustumCulled = false; scene.add(m); r = { m, t:1 }; RINGS.push(r); }
  r.t = 0; r.m.position.set(x, RIVER.y + 0.025, z); r.m.visible = true; }
function rings(dt){ const F = SWIM.fx; for(let i = 0; i < RINGS.length; i++){ const r = RINGS[i]; if(r.t >= 1) continue; r.t = Math.min(1, r.t + dt / F.ringT); const e = 1 - (1 - r.t) * (1 - r.t);
  r.m.scale.setScalar(F.ringR[0] + (F.ringR[1] - F.ringR[0]) * e); r.m.material.opacity = SWIM.fx.ringOp * (1 - r.t) * (1 - r.t); if(r.t >= 1) r.m.visible = false; } }
// HSWIM 2 water, not puffs: thin spray, a crown, foam (fx/water-spray.js) — n the old puff count and up their throw: its size n × up / 8 (a toe ~0.4 … a stroke 1 … a hoof at a gallop 2)
function splash(x, z, n, up){ if(HSWIM2.on){ waterSplash(x, z, clamp(n * up / 8, 0.3, 2), up / 2.2); return; } const y = RIVER.y + 0.05, c = SWIM.fx.col; for(let i = 0; i < n; i++){ const a = Math.random() * 6.283, s = 0.3 + Math.random() * 0.9;
  spawnPart(x, y, z, Math.cos(a) * s, up * (0.6 + Math.random() * 0.7), Math.sin(a) * s, { color:c, size:0.09 + Math.random() * 0.09, life:0.5, smoke:true, grav:-14, drag:0.6, op:1.6, keep:true }); } }
function fx(p, dt, now, v){ const W = SWST, F = SWIM.fx; rings(dt); if(S.mode !== 'playing') return; const sw = W.mode === 'swim', fa = p.facing, fx_ = Math.sin(fa), fz = Math.cos(fa);
  if(!sw && W.band >= 1 && W.band <= 2 && v > 0.4){ W.stepT -= dt * clamp(1.1 + v * 0.45, 1.1, 3.2); if(W.stepT <= 0){ W.stepT = 1; W.side = -W.side; const k = W.band >= 2 ? 1 : 0.6;
      splash(p.pos.x - fz * 0.14 * W.side + fx_ * 0.25, p.pos.z + fx_ * 0.14 * W.side + fz * 0.25, W.band >= 2 ? F.step[1] : F.step[0], F.up * k); } }   // (his boot comes out ahead of him and goes down; deeper than the knee his legs push through it: the wake, not a splash)
  if((sw && !W.under || W.band >= 2) && v > 0.3){ W.wakeT -= dt; if(W.wakeT <= 0){ W.wakeT = F.wake; const bx = p.pos.x - fx_ * 0.45, bz = p.pos.z - fz * 0.45, s = (Math.random() - 0.5) * 0.6;
      if(HSWIM2.on) wake(bx - fz * s, bz + fx_ * s, 1); else spawnPart(bx - fz * s, RIVER.y + 0.04, bz + fx_ * s, -fx_ * 0.3 - fz * s, 0.05, -fz * 0.3 + fx_ * s, { color:F.col, size:0.2, life:0.9, smoke:true, grav:0, drag:3, grow:0.45, op:F.wakeOp, keep:true }); } }   // (the wake: puffs left astern, drifting out · HSWIM 2 foam on the water)
  if(sw || W.band >= 2){ W.ringT -= dt * (v > 0.3 ? 1.6 : 1); if(W.ringT <= 0){ W.ringT = F.ring * (0.8 + Math.random() * 0.4); if(!W.under || Math.random() < 0.25) ring(p.pos.x + (Math.random() - 0.5) * 0.3, p.pos.z + (Math.random() - 0.5) * 0.3); } }   // (rings round him; diving, a few from his bubbles)
  if(sw && !W.under){ W.breathT -= dt; if(W.breathT <= 0){ W.breathT = SWIM.swim.breathT * (0.85 + Math.random() * 0.3); sound('breath', p.pos, 0.7, 1); } }
  else if(sw && W.under && Math.random() < dt * 3 && HSWIM2.on) waterFoam(p.pos.x + (Math.random() - 0.5) * 0.3, p.pos.z + (Math.random() - 0.5) * 0.3, 0.04, 0.16, 0.6, HSWIM2.foam.op);   // (HSWIM 2 his bubbles breaking: a fleck of foam)
  else if(sw && W.under && !HSWIM2.on && Math.random() < dt * 3) spawnPart(p.pos.x + (Math.random() - 0.5) * 0.3, RIVER.y + 0.03, p.pos.z + (Math.random() - 0.5) * 0.3, 0, 0.15, 0, { color:F.col, size:0.08, life:0.35, smoke:true, grav:0, drag:2, op:1.2, keep:true }); }   // (his bubbles breaking)
function stroke(p){ if(!p || S.mode !== 'playing') return; const W = SWST, fa = p.facing; if(W.under){ sound('stroke', p.pos, 0.35, 0.7); return; }
  splash(p.pos.x + Math.sin(fa) * 0.7, p.pos.z + Math.cos(fa) * 0.7, 5, 1.6); sound('stroke', p.pos, 0.8, 0.95 + Math.random() * 0.1); }

// HSWIM 1 the same water for the swimming horse (game/horse-swim.js): a splash, a ring, the rings' tick, a sound
// HSWIM 2 a wake's patch of white water left on the surface (k × its opacity)
function wake(x, z, k){ const W2 = HSWIM2.foam; waterFoam(x, z, W2.wake[0], W2.wake[1], W2.life[0] + Math.random() * (W2.life[1] - W2.life[0]), W2.op * 0.55 * k); }
export const swimFxKit = { splash, ring, rings, sound, wake };
// ---- sound: synthesised one-shots on the foley bus (audio/afx.js) — a stroke's sploosh, a breath, the gasp coming up; the world muffled under ----
function mkStroke(sr, rnd){ const n = Math.round(sr * 0.42), x = new Float32Array(n); let a = 0, b = 0; for(let i = 0; i < n; i++){ const t = i / sr, env = Math.min(1, t / 0.035) * Math.exp(-t / 0.11), w = rnd() * 2 - 1; a += (w - a) * 0.22; b += (a - b) * 0.35;
  x[i] = (a - b * 0.7) * env * 1.8 + Math.sin(6.283 * (150 - t * 160) * t) * Math.exp(-t / 0.05) * 0.3; } return x; }
function mkBreath(sr, rnd, gasp){ const T = gasp ? 0.42 : 0.62, n = Math.round(sr * T), x = new Float32Array(n); let a = 0, b = 0; for(let i = 0; i < n; i++){ const t = i / sr, u = t / T, env = gasp ? Math.min(1, u * 9) * Math.pow(1 - u, 1.4) : Math.pow(Math.sin(Math.PI * u), 1.6), w = rnd() * 2 - 1;
  a += (w - a) * 0.5; b += (a - b) * 0.08; x[i] = (a - b) * env * (gasp ? 0.8 : 0.42); } return x; }
const MK = { stroke:[mkStroke, 0], breath:[mkBreath, 0], gasp:[mkBreath, 1] };
function sound(kind, pos, lvl, rate){ if(!afxOn()) return; const m = MK[kind]; try{ afxPlay('swim-' + kind, m[0], m[1], 0, pos, 'foley', AUDIOFX.prio.own, lvl, rate || 1, 0); }catch(e){} }
let _muffled = false;
function muffle(on){ if(on === _muffled) return; _muffled = on; const F = AFXX.wired && AFXX.dLp && AFXX.dLp.frequency; if(!F || !actx) return; const t = actx.currentTime; F.cancelScheduledValues(t); F.setTargetAtTime(on ? SWIM.dive.lp : AUDIOFX.deaf.lp[0], t, on ? 0.06 : 0.18); }

// ---- the HUD: "ĐANG BƠI" / "ĐANG LẶN" and the breath bar under it; a blue veil while he is under ----
const H = { el:null, txt:null, bar:null, fill:null, tint:null, s:'', w:-1 };
function hudEl(){ if(H.el || typeof document === 'undefined') return H.el; const el = H.el = document.createElement('div'); el.id = 'swimHud';
  el.style.cssText = 'position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:40;pointer-events:none;display:none;text-align:center;font:700 14px/1.2 system-ui,sans-serif;letter-spacing:1.5px;color:#cdeef6;text-shadow:0 1px 3px #000c';
  el.innerHTML = '<div style="display:flex;align-items:center;gap:7px;justify-content:center"><svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="#9fd8e8" stroke-width="2" stroke-linecap="round"><path d="M1 5c3-3 5 3 8 0s5 3 8 0"/><path d="M1 11c3-3 5 3 8 0s5 3 8 0"/></svg><span></span></div><div style="margin:6px auto 0;width:120px;height:6px;border-radius:3px;background:#0008;border:1px solid #9fd8e866;display:none"><div style="height:100%;width:100%;border-radius:3px;background:#7fd6ee"></div></div>';
  H.txt = el.querySelector('span'); H.bar = el.children[1]; H.fill = H.bar.firstChild; document.body.appendChild(el);
  const t = H.tint = document.createElement('div'); t.id = 'swimTint'; t.style.cssText = 'position:fixed;inset:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .35s;background:' + SWIM.dive.tint; document.body.appendChild(t); return el; }
function hud(now, off){ const W = SWST, show = !off && S.mode === 'playing' && (W.mode === 'swim' || W.band >= 3); W.shown = show; if(!show && !H.el) return; const el = hudEl(); if(!el) return;
  const s = !show ? '' : W.mode === 'swim' ? (W.under ? 'ĐANG LẶN' : 'ĐANG BƠI') : BAND[W.band]; if(s !== H.s){ H.s = s; el.style.display = s ? 'block' : 'none'; H.txt.textContent = s; }
  const w = show && W.mode === 'swim' && (W.under || W.breath < 0.99) ? Math.round(W.breath * 50) : -1; if(w !== H.w){ H.w = w; H.bar.style.display = w < 0 ? 'none' : 'block'; if(w >= 0){ H.fill.style.width = (w * 2) + '%'; H.fill.style.background = w < 12 ? '#ff7a5a' : '#7fd6ee'; } }
  const u = show && W.under; if(H.tint && (H.tint.style.opacity === '1') !== u){ H.tint.style.opacity = u ? '1' : '0'; } muffle(u); }
// dev / test: what the water is doing to him
export function swimProbe(){ const W = SWST; return { mode:W.mode, band:W.band, d:+W.d.toFixed(2), under:W.under, breath:+W.breath.toFixed(2), y:W.y == null ? null : +W.y.toFixed(2), headOff:+W.headOff.toFixed(2), msAvg:W.n ? +(W.ms / W.n).toFixed(4) : 0, swims:W.swims, dives:W.dives, stabs:W.stabs }; }
