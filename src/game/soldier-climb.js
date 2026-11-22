// game/soldier-climb.js — Z451 THE SOLDIER CLIMBS (soldier mode, on foot): with a rock, a fortress wall or gate, a ruin, a container, a T-wall in reach
//   ahead the LEO prompt shows (J, or the button on a phone): he steps up to the face, slings the rifle on his back, goes up it hand over hand (a rock
//   slower than a wall), pulls himself over the top edge (a knee up, then on his feet) and stands ON it — his feet on its real top (a ray onto the drawn
//   model for stone and rock, its box for the rest), walking, crouching, lying, aiming and firing from up there (his muzzle is that high, the rounds clear
//   the parapet, enemies aim up at him, a little more reach for the height). Low cover (≤ stepH) is a quick vault up. On top a higher part (a merlon,
//   a tower) stops him like a wall; at the rim he holds a moment, pushed on he steps off and falls — a landing that gives at the knees, and hurts from
//   high up; J on top drops him off the nearest rim. While on the face J / S lets go. The pose: actors/soldier-climb-pose.js.
import * as THREE from 'three';
import { CLIMB } from '../../config.js';
import { CV, MOBILE, S, blockTop, blocksNear, damagePlayer, floatText, heightAt, sfx, solidShape, spawnPart, heldAction } from '../hub.js';

const C = CLIMB, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => k * k * (3 - 2 * k), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const _near = [], _near2 = [];
// ---- what can be climbed, and how its top is found ----
export function climbKind(bl){ if(bl._clS !== undefined) return bl._clS; let s = C.kinds[bl.kind] || null;
  if(bl.scenery) s = C.noScene.test(bl.scenery) ? null : C.rockScene.test(bl.scenery) ? 'rock' : 'stone';
  if(bl.ours || bl.tent || bl.cache) s = null; return (bl._clS = s); }
const rayKind = bl => C.rayKinds.includes(climbKind(bl)) && !bl.ridge && bl.mesh && bl.mesh.isObject3D;
// a ridge rock is one instance of a shared mesh: its top from its own matrix
const _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
function topOf(bl){ if(!bl.ridge) return blockTop(bl); if(bl._clTop != null) return bl._clTop; const im = bl.mesh, g = im && im.geometry; if(!g || !im.getMatrixAt) return (bl._clTop = heightAt(bl.x, bl.z) + 2);
  if(!g.boundingBox) g.computeBoundingBox(); im.getMatrixAt(bl.inst * 2, _m4); _m4.decompose(_p, _q, _s); return (bl._clTop = _p.y + g.boundingBox.max.y * _s.y); }
const _cs = { x:0, z:0, r:1, obb:null };
function shapeOf(bl){ const S2 = solidShape(bl, true); if(S2) return S2; _cs.x = bl.x; _cs.z = bl.z; _cs.r = bl.r || 1; return _cs; }
// the nearest face of its footprint to (px, pz): the point on it, its outward normal, his distance from it (− inside), how thick it is through that face
function nearOn(S2, px, pz, o){ if(S2.obb){ const f = S2.obb.f, s = Math.sin(f), c = Math.cos(f), dx = px - S2.x, dz = pz - S2.z, al = dx * s + dz * c, ac = dx * c - dz * s, hl = S2.obb.hl, hw = S2.obb.hw;
    const across = Math.abs(ac) - hw > Math.abs(al) - hl, sg = across ? Math.sign(ac) || 1 : Math.sign(al) || 1, qa = across ? clamp(al, -hl, hl) : sg * hl, qc = across ? sg * hw : clamp(ac, -hw, hw);
    const ea = across ? 0 : sg, ec = across ? sg : 0; o.nx = ea * s + ec * c; o.nz = ea * c - ec * s; o.qx = S2.x + qa * s + qc * c; o.qz = S2.z + qa * c - qc * s;
    o.d = across ? Math.abs(ac) - hw : Math.abs(al) - hl; o.th = across ? hw * 2 : hl * 2; return o; }
  const dx = px - S2.x, dz = pz - S2.z, L = Math.hypot(dx, dz) || 1; o.nx = dx / L; o.nz = dz / L; o.qx = S2.x + o.nx * S2.r; o.qz = S2.z + o.nz * S2.r; o.d = L - S2.r; o.th = S2.r * 2; return o; }
function inside(bl, x, z, pad){ const S2 = shapeOf(bl); if(S2.obb){ const s = Math.sin(S2.obb.f), c = Math.cos(S2.obb.f), dx = x - S2.x, dz = z - S2.z; return Math.abs(dx * s + dz * c) < S2.obb.hl - pad && Math.abs(dx * c - dz * s) < S2.obb.hw - pad; }
  return Math.hypot(x - S2.x, z - S2.z) < S2.r * (bl.ridge || climbKind(bl) === 'rock' ? 0.8 : 1) - pad; }
// ---- the top surface at (x, z): stone and rock by a ray onto the drawn model (its light copy), cached on a grid; the rest is its box ----
const _rc = new THREE.Raycaster(), _h = new THREE.Vector3(), _o = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0), _hit = [], _n = new THREE.Vector3(), _sq = { y:0, ny:1 };
const seen = (o, top) => { for(let q = o; q && q !== top; q = q.parent) if(!q.visible) return false; const mt = [].concat(o.material)[0]; return !(mt && (mt.transparent || mt.depthWrite === false)); };
function rayList(bl){ const t = performance.now(); if(bl._clL && t < bl._clLT) return bl._clL; bl._clLT = t + 4000; const L = bl._clL || (bl._clL = []); L.length = 0; let m = bl.mesh;
  if(m.isLOD && m.levels && m.levels.length) m = m.levels[m.levels.length - 1].object;
  m.traverse(o => { if(o.isMesh && !o.isSprite && !o.isSkinnedMesh && !o.isInstancedMesh && o.geometry && seen(o, m)) L.push(o); }); return L; }
const _cache = new Map(), CHEAP = { on:false, n:0 };   // (the prompt's look: at most deck.scanRays new rays a look — a heavy model's ray can take several ms)
export function surfAt(bl, x, z){ const top = topOf(bl);
  if(!rayKind(bl)){ const S2 = shapeOf(bl); if(bl.ridge){ const d = Math.min(1, Math.hypot(x - S2.x, z - S2.z) / S2.r); _sq.y = top - C.dome.sag * d * d; _sq.ny = 1 - d * 0.4; } else { _sq.y = top; _sq.ny = 1; } return _sq; }
  const q = C.deck.q, key = Math.round(x / q) * 65536 + Math.round(z / q), M = bl._clC || (bl._clC = new Map()); let v = M.get(key);
  if(v === undefined && CHEAP.on && CHEAP.n++ >= C.deck.scanRays){ _sq.y = top; _sq.ny = 1; return _sq; }   // (the prompt guesses by the box; the climb itself measures)
  if(v === undefined){ const L = rayList(bl); v = null; if(L.length){ _o.set(x, top + 0.3, z); _rc.set(_o, _dn); _rc.far = top - heightAt(x, z) + 0.6; _hit.length = 0; _rc.intersectObjects(L, false, _hit);
      const h = _hit[0]; if(h) v = [h.point.y, h.face ? _n.copy(h.face.normal).transformDirection(h.object.matrixWorld).y : 1]; } else v = [top, 1];
    if(M.size > 3000) M.clear(); M.set(key, v); }
  if(!v) return null; _sq.y = v[0]; _sq.ny = v[1]; return _sq; }
// ---- the prompt's look: the best face ahead in reach, and the top he would stand on over it ----
const SC = { bl:null }, _f = { qx:0, qz:0, nx:0, nz:0, d:0, th:0 };
export function climbScan(p, cheap){ CHEAP.on = !!cheap; CHEAP.n = 0; try { return scanFace(p); } finally { CHEAP.on = false; } }
function scanFace(p){ const F = p.facing, fx = Math.sin(F), fz = Math.cos(F); let best = null, bs = 1e9; SC.bl = null;
  for(const bl of blocksNear(p.pos.x, p.pos.z, C.reach + 9, _near)){ if(!climbKind(bl) || bl.hp <= 0) continue; nearOn(shapeOf(bl), p.pos.x, p.pos.z, _f);   // (a fortress wall's thick footprint reaches far past its grid circle)
    const d = _f.d - (p.radius || 0.45), sq = -(fx * _f.nx + fz * _f.nz); if(d > C.reach || d < -0.6 || sq < C.cone || _f.th < C.minW) continue;
    const gy = heightAt(_f.qx, _f.qz); if(topOf(bl) - gy < C.minH) continue; const sc = d - sq * 0.5; if(sc < bs){ bs = sc; best = bl; Object.assign(SC, _f, { bl, y0:gy }); } }
  if(!best) return null;
  // the top: down-rays stepping in from the face (the first flat one — a fortress wall's walk behind its talus, a rock's crown); a box is its own top
  let top = null; const inMax = Math.min(SC.th - C.deck.padIn, rayKind(best) ? 9 : C.mantleIn);
  for(let i = Math.min(C.mantleIn, SC.th * 0.5); i <= inMax + 1e-3; i += 0.75){ const x = SC.qx - SC.nx * i, z = SC.qz - SC.nz * i, s = surfAt(best, x, z);
    if(s && s.ny >= C.flat && s.y - SC.y0 >= C.minH){ top = s.y; SC.lx = x; SC.lz = z; SC.in = i; break; } if(!rayKind(best)) break; }
  SC.why = top == null ? 'steep' : top - SC.y0 > C.maxH ? 'high' : null; SC.top = top; SC.h = top == null ? 0 : top - SC.y0; SC.vault = SC.h <= C.stepH; return SC; }

// ---- the state: CV.climb = { ph:'reach'|'climb'|'mantle'|'vault'|'top'|'fall', t, … }; p.lift = his soles over the ground ----
export function climbing(){ const K = CV.climb; return !!(K && K.ph !== 'top' && K.ph !== 'fall'); }
export function climbPh(){ return CV.climb ? CV.climb.ph : null; }
export function climbPerch(){ const K = CV.climb; return K && K.ph === 'top' ? K.bl : null; }
export function footY(p){ const K = CV.climb; return K && K.fy != null ? K.fy : heightAt(p.pos.x, p.pos.z); }
// where his soles go down on (for the rig's feet: actors/soldier-legs.js): on top, the deck's level
export function soleAt(x, z){ const K = CV.climb; return K && K.ph === 'top' ? K.fy : heightAt(x, z); }
// J / the LEO button
export function soldierClimb(){ const p = S.player; if(!p || !p.cav || S.mode !== 'playing' || CV.dead) return;
  if(CV.mounted || CV.trans){ say(p, 'XUỐNG XE / NGỰA RỒI MỚI LEO ĐƯỢC', '#ffcf5a'); return; }
  const K = CV.climb; if(K){ if(K.ph === 'reach' || K.ph === 'climb') letGo(p); else if(K.ph === 'top') dropNearest(p); return; }
  if(CV.roll || CV.jump) return; const s = climbScan(p);
  if(!s){ say(p, 'KHÔNG CÓ CHỖ LEO PHÍA TRƯỚC', '#ffcf5a'); return; }
  if(s.why === 'high'){ say(p, 'QUÁ CAO (' + Math.round(s.h) + ' m)', '#ffcf5a'); return; } if(s.why){ say(p, 'MẶT TRÊN KHÔNG ĐỨNG ĐƯỢC', '#ffcf5a'); return; }
  const v = C.surf[climbKind(s.bl)] * (1 - C.hiK * Math.max(0, s.h - C.hiFrom));
  CV.climb = { ph:s.vault ? 'vault' : 'reach', t:0, bl:s.bl, kind:climbKind(s.bl), v, qx:s.qx, qz:s.qz, nx:s.nx, nz:s.nz, y0:s.y0, top:s.top, h:s.h, lx:s.lx, lz:s.lz,
    c:0, cTop:Math.max(0, s.h - mantle0()), fx0:p.pos.x, fz0:p.pos.z, f0:p.facing, fy:s.y0, last:new THREE.Vector3(), edgeT:0, onT:0, vy:0 };
  const N1 = CV.climb; N1.rec = [0, 0, 0]; if(rayKind(s.bl)){ const L = rayList(s.bl), hs = [s.y0 + 0.3, s.y0 + s.h * 0.5, s.top - 0.35];   // (stone and rock: how far the face leans back up its height — three rays across it)
    for(let i = 0; i < 3; i++){ _o.set(s.qx + s.nx * 1.5, hs[i], s.qz + s.nz * 1.5); _rc.set(_o, _h.set(-s.nx, 0, -s.nz)); _rc.far = 1.5 + Math.min(6, s.th); _hit.length = 0; _rc.intersectObjects(L, false, _hit);
      N1.rec[i] = _hit[0] ? clamp(_hit[0].distance - 1.5, -0.3, 4) : i ? N1.rec[i - 1] : 0; }
    const st = Math.max(s.in, N1.rec[2] + C.mantleIn * 0.85); if(st > s.in + 0.05){ const x = s.qx - s.nx * st, z = s.qz - s.nz * st, q = surfAt(s.bl, x, z); if(q && q.ny >= C.flat && Math.abs(q.y - s.top) < 0.6){ N1.lx = x; N1.lz = z; N1.top = q.y; } } }
  N1.in = Math.hypot(N1.lx - s.qx, N1.lz - s.qz) - N1.rec[2]; N1.hs = [s.y0 + 0.3, s.y0 + s.h * 0.5, s.top - 0.35];
  CV.stance = CV.want = 'stand'; CV.cover = null; p.vel.set(0, 0, 0); S.firing = false; sfx('click'); }
// how far in from its foot the face stands at height y (linear between the three measured heights)
export function climbRecess(K, y){ if(!K || !K.hs) return 0; const H = K.hs, R = K.rec; if(y <= H[0]) return R[0]; if(y <= H[1]) return R[0] + (R[1] - R[0]) * (y - H[0]) / Math.max(0.01, H[1] - H[0]);
  if(y <= H[2]) return R[1] + (R[2] - R[1]) * (y - H[1]) / Math.max(0.01, H[2] - H[1]); return R[2]; }
const mantle0 = () => C.hipStand + C.off.handY + 0.45;   // (the hips' rise at which his hands come onto the top edge: the pull-over starts there)
function say(p, t, col){ floatText(t, col, { x:p.pos.x, y:footY(p) + 2.3, z:p.pos.z }, 14); }
// let go of the face: he drops off it, pushed a little out
function letGo(p){ const K = CV.climb; if(K.fy - K.y0 < 0.35){ CV.climb = null; return; } p.vel.set(K.nx * 1.2, 0, K.nz * 1.2); fall(p, K.fy); }
function fall(p, fy){ const K = CV.climb; K.ph = 'fall'; K.t = 0; K.vy = 0; K.fy = fy; K.h0 = fy; CV.jump = { vy:0, y:0, t:0, climb:true }; }
// J on top: over the nearest rim
function dropNearest(p){ const K = CV.climb; nearOn(shapeOf(K.bl), p.pos.x, p.pos.z, _f); const a = Math.atan2(_f.nx, _f.nz); p.facing = a; p.vel.set(_f.nx * 2.4, 0, _f.nz * 2.4); K.push = 2; K.edgeT = C.edge; }   // (walks out over it until he drops)
// ---- every frame on foot, before his own movement: true while the climb moves him (game/cavalry.js) ----
export function climbStep(p, dt, now){ const K = CV.climb; if(!K) return false; K.t += dt; const wy = Math.atan2(-K.nx, -K.nz);
  if(K.ph === 'reach'){ const u = smooth(clamp(K.t / C.reachT, 0, 1)), ax = K.qx + K.nx * C.off.stand, az = K.qz + K.nz * C.off.stand;
    p.pos.x = K.fx0 + (ax - K.fx0) * u; p.pos.z = K.fz0 + (az - K.fz0) * u; p.facing = wrapA(K.f0 + wrapA(wy - K.f0) * u); K.fy = heightAt(p.pos.x, p.pos.z);
    if(K.t >= C.reachT){ K.ph = 'climb'; K.t = 0; } }
  else if(K.ph === 'climb'){ if(heldAction('down') && K.t > 0.3){ letGo(p); return false; }
    K.c = Math.min(K.cTop, K.c + K.v * dt); p.facing = wy; const rc = C.off.stand - climbRecess(K, K.y0 + C.hipStand + K.c); p.pos.x = K.qx + K.nx * rc; p.pos.z = K.qz + K.nz * rc;
    K.fy = K.y0 + Math.max(0, K.c - 0.15); if(Math.random() < dt * 2) spawnPart(K.qx, K.y0 + K.c + 0.5, K.qz, K.nx * 0.4, -0.5, K.nz * 0.4, { color:0xb8a888, size:0.25, life:0.6, grav:-6, drag:1 });
    if(K.c >= K.cTop){ K.ph = 'mantle'; K.t = 0; sfx('thud', p.pos, 0.25); } }
  else if(K.ph === 'mantle' || K.ph === 'vault'){ const vt = K.ph === 'vault', T = vt ? C.vaultT : C.mantleT, u = clamp(K.t / T, 0, 1), e = smooth(clamp((u - 0.35) / 0.65, 0, 1)), rs = C.off.stand - (vt ? 0 : climbRecess(K, K.top)), ax = K.qx + K.nx * rs, az = K.qz + K.nz * rs;
    if(vt && u < 0.35){ const w = smooth(u / 0.35); p.pos.x = K.fx0 + (ax - K.fx0) * w; p.pos.z = K.fz0 + (az - K.fz0) * w; p.facing = wrapA(K.f0 + wrapA(wy - K.f0) * w); }
    else { p.facing = wy; p.pos.x = ax + (K.lx - ax) * e; p.pos.z = az + (K.lz - az) * e; }
    K.fy = vt ? K.y0 + (K.top - K.y0) * smooth(clamp((u - 0.25) / 0.45, 0, 1)) : K.y0 + K.cTop + (K.top - K.y0 - K.cTop) * smooth(clamp(u / 0.7, 0, 1));
    if(u >= 1){ K.ph = 'top'; K.t = 0; K.fy = K.top; K.last.copy(p.pos); K.onT = 0; sfx('thud', p.pos, 0.3); if(!K.said){ K.said = true; say(p, 'ĐÃ LÊN CAO — J: NHẢY XUỐNG', '#9be04a'); } } }
  else return false;
  p.vel.set(0, 0, 0); p.lift = K.fy - heightAt(p.pos.x, p.pos.z); return true; }
// ---- after his own movement (and the world's push): on top he stays on the deck — a higher part stops him, the rim holds him a moment, then he steps
//   off; falling, he comes down on the ground or a lower deck ----
let _dy = 0, _dbl = null;
function deckAt(x, z, fy){ let best = -Infinity, high = false; _dbl = null;
  for(const bl of blocksNear(x, z, 2.5, _near2)){ if(!climbKind(bl) || bl.hp <= 0 || !inside(bl, x, z, C.deck.padIn)) continue; const s = surfAt(bl, x, z); if(!s || s.ny < 0.45) continue;   // (a rock's steep flank is no floor)
    if(s.y > fy + C.deck.stepUp){ high = true; continue; } if(s.y > best){ best = s.y; _dbl = bl; } }
  _dy = best; return best > fy - C.deck.stepTol ? 1 : high ? 2 : 0; }   // 1 on the deck · 2 a wall · 0 over the rim (_dy: a lower deck, if any)
export function climbAfter(p, dt, now){ const K = CV.climb; if(!K) { p.lift = 0; return; }
  if(K.ph === 'top'){ K.onT += dt; const r = deckAt(p.pos.x, p.pos.z, K.fy);
    if(r === 1){ K.fy += (_dy - K.fy) * Math.min(1, dt * 14); K.bl = _dbl; K.last.copy(p.pos); if(!K.push) K.edgeT = 0; }
    else if(r === 2){ p.pos.x = K.last.x; p.pos.z = K.last.z; p.vel.x *= 0.3; p.vel.z *= 0.3; }
    else if(_dy > K.fy - C.deck.stepDown && _dy > -Infinity){ fall(p, K.fy); }   // a step down onto a lower part: a hop
    else { K.edgeT += dt; if(K.edgeT < C.edge){ p.pos.x = K.last.x; p.pos.z = K.last.z; if(!K.rimSaid || now > K.rimSaid){ K.rimSaid = now + 3; say(p, 'MÉP — ĐI TIẾP ĐỂ NHẢY XUỐNG', '#ffcf5a'); } }
      else fall(p, K.fy); }
    if(K.push){ K.push -= dt; if(K.push <= 0) K.push = 0; else { p.vel.x = Math.sin(p.facing) * 2.4; p.vel.z = Math.cos(p.facing) * 2.4; } } }
  if(K.ph === 'fall'){ K.vy -= C.fall.g * dt; K.fy += K.vy * dt; if(CV.jump && CV.jump.climb) CV.jump.vy = K.vy;
    const r = deckAt(p.pos.x, p.pos.z, K.fy + 0.3), floor = r === 1 ? _dy : heightAt(p.pos.x, p.pos.z);
    if(K.fy <= floor){ const dh = K.h0 - floor; CV.jump = null; CV.land = C.fall.land * (dh > C.fall.far ? 1 + C.fall.long / C.fall.land : 1); sfx('thud', p.pos, Math.min(1, 0.35 + dh * 0.06));
      for(let n = 0; n < 4; n++) spawnPart(p.pos.x, floor + 0.05, p.pos.z, (Math.random() - 0.5) * 1.6, 0.4, (Math.random() - 0.5) * 1.6, { color:0xb8a888, size:0.45, life:0.6, smoke:true, grav:-0.5, drag:2, op:0.32 });
      if(dh > C.fall.hurt){ damagePlayer(Math.min(C.fall.max, (dh - C.fall.hurt) * C.fall.perM), now, 0, 0); S.shake = Math.min(3, (S.shake || 0) + 0.6); }
      if(r === 1){ K.ph = 'top'; K.fy = floor; K.bl = _dbl; K.t = 0; K.onT = 1; K.last.copy(p.pos); K.edgeT = 0; K.push = 0; } else { CV.climb = null; p.lift = 0; return; } } }
  p.lift = Math.max(0, K.fy - heightAt(p.pos.x, p.pos.z)); }
// a block he is standing over (the world's push leaves it, and the ones under his soles, alone: game/cavalry.js collide)
export function climbOver(bl){ const K = CV.climb; if(!K) return false; if(K.ph !== 'top' && K.ph !== 'fall') return bl === K.bl || K.ph === 'mantle' || K.ph === 'vault';
  return bl === K.bl || (K.bl && bl.mesh && bl.mesh === K.bl.mesh) || topOf(bl) < K.fy + 0.3; }
// how far through the hands' move between his hold and the wall (0 his rifle in his hands · 1 slung, his hands on the face): actors/real-cav.js
export function climbW(){ const K = CV.climb; if(!K) return 0; if(K.ph === 'reach') return smooth(clamp(K.t / C.reachT, 0, 1)); if(K.ph === 'climb' || K.ph === 'mantle' || K.ph === 'vault') return 1;
  if(K.ph === 'top') return 1 - smooth(clamp(K.onT / C.unslingT, 0, 1)); return 0; }
export function climbReset(){ CV.climb = null; if(S.player) S.player.lift = 0; }

// ---- the LEO button / prompt (shown only with a climbable face in reach ahead, on foot) ----
let el = null, tick = 0, scanAt = 0;
export function climbUi(){ if(el || typeof document === 'undefined') return;
  el = document.createElement('div'); el.id = 'climbBtn';
  el.style.cssText = 'position:fixed;left:50%;bottom:' + (MOBILE ? '268px' : '240px') + ';transform:translateX(-50%);z-index:40;display:none;padding:9px 18px;border-radius:999px;' +
    'background:rgba(12,16,10,0.8);border:1.5px solid #ffcf5a;color:#fff3d6;font:700 14px/1.2 system-ui,sans-serif;letter-spacing:0.04em;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;box-shadow:0 2px 10px rgba(0,0,0,0.45)';
  el.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); soldierClimb(); });
  document.body.appendChild(el); const loop = () => { requestAnimationFrame(loop); if(++tick % 4) return; paint(); }; loop(); }
function paint(){ const p = S.player, on = !!(p && p.cav && S.mode === 'playing' && !CV.mounted && !CV.trans && !CV.dead); let txt = null; const key = MOBILE ? '' : '  [J]', K = CV.climb;
  if(on && K){ txt = K.ph === 'top' ? '⬇ NHẢY XUỐNG' + key : K.ph === 'fall' ? null : '✋ BUÔNG TAY' + key; }
  else if(on && !CV.roll && !CV.jump){ const t = performance.now() / 1000; if(t > scanAt){ scanAt = t + C.scanT; el._s = climbScan(p, true); } const s = el._s;
    if(s) txt = s.why === 'high' ? 'QUÁ CAO ĐỂ LEO (' + Math.round(s.h) + ' m)' : s.why ? null : (s.vault ? '⤴ TRÈO LÊN' : '⛰ LEO') + ' · ' + s.h.toFixed(1) + ' m' + key; }
  el.style.display = txt ? 'block' : 'none'; if(txt && el.textContent !== txt) el.textContent = txt; }
