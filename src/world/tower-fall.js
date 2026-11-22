// world/tower-fall.js — Z452 A TOWER COMES DOWN FOR REAL: a watchtower, a guard post or the radar mast shot down topples about the side of its base that gave way
//   (θ'' = g·hc·sin θ / (H²/3 + u0²): slow at first, then faster), tears its footing out of the ground as it goes (the concrete pad with its piers and torn
//   rebar comes up with it, a pit with bent anchor bolts is left where it stood), strikes the ground top first (the tallest reach of its real shape, read
//   once off its drawn model), bounces, slews down the slope and rolls a little about its own length, then lies there askew for the rest of the battle —
//   dust bursting at the foot, a long dust cloud along where it struck, a slight shake by distance. Asleep it costs nothing: no update, a box that stops
//   tanks and takes rounds. A piece that tears off on impact (the radar's array / dish) tumbles away on its own and lies where it stops.
import * as THREE from 'three';
import { TOWERFALL } from '../../config.js';
import { ARENA, BIOME, HF, MOBILE, S, blocks, decalAsh, decalCrater, decalScorch, detailize, dirtGeyser, dustSkirt, haptic, heightAt, propTex, scene, sfx, spawnPart } from '../hub.js';

export const TOWER_FALLS = [], TOWER_WRECKS = [], TOWER_CHUNKS = [];   // falling (stepped each frame) · lying (asleep, no cost) · torn-off pieces tumbling
const UP = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _box = new THREE.Box3();
const rr = (a, b) => a + Math.random() * (b - a);

// ---- shared materials + footing / pit geometries (built once per size, reused by every tower of that size) ----
let _conc = null, _steel = null; const _FOOT = new Map(), _PIT = new Map();
function mats(){ if(_conc) return; const F = TOWERFALL.foot;
  _conc = detailize(new THREE.MeshStandardMaterial({ map:propTex('concrete'), color:F.color, roughness:0.95, vertexColors:true }), { scale:0.5, bump:0.03, alb:0.34, foot:0, streak:0.2 });
  _steel = new THREE.MeshStandardMaterial({ color:F.rebar, roughness:0.62, metalness:0.55 }); }
// a box with chipped edges: shared corners move together (no cracks), the broken face (bottom / top) much rougher; caked with soil low down (vertex colours)
function chipped(w, h, d, rough, brokenBottom, soil){ const g = new THREE.BoxGeometry(w, h, d, 3, 2, 3), p = g.attributes.position, off = new Map(), c = new Float32Array(p.count * 3), sc = new THREE.Color(soil), cc = new THREE.Color(1, 1, 1);
  for(let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2);
    if(!off.has(key)){ const low = y < 0 ? brokenBottom : rough; off.set(key, [(Math.random() - 0.5) * rough * 2, (Math.random() - 0.5) * low * 2, (Math.random() - 0.5) * rough * 2]); }
    const o = off.get(key); p.setXYZ(i, x + o[0], y + o[1], z + o[2]); const k = Math.min(1, Math.max(0, 0.75 - (y + h / 2) / h * 1.3)); _cl.copy(cc).lerp(sc, k); c[i * 3] = _cl.r; c[i * 3 + 1] = _cl.g; c[i * 3 + 2] = _cl.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g; }
const _cl = new THREE.Color();
// a torn bar: out of (x,y,z) along (ux,uy,uz) for L1, then bent off at a random angle for L2 (two thin open cylinders)
function bar(list, x, y, z, ux, uy, uz, L1, L2, r){ const a = new THREE.Vector3(x, y, z), d1 = new THREE.Vector3(ux, uy, uz).normalize(), b = a.clone().addScaledVector(d1, L1);
  const side = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).cross(d1).normalize(), d2 = d1.clone().applyAxisAngle(side, rr(0.5, 1.5)), c = b.clone().addScaledVector(d2, L2);
  for(const [p0, p1] of [[a, b], [b, c]]){ const L = p0.distanceTo(p1), g = new THREE.CylinderGeometry(r, r, L, 5, 1, true); g.applyQuaternion(_q.setFromUnitVectors(UP, _v.subVectors(p1, p0).normalize())); g.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2); list.push(g); } }
const merge = L => { if(!L.length) return null; const g = mergeGeos(L); for(const q of L) q.dispose(); return g; };
function mergeGeos(L){ let n = 0, ni = 0; for(const g of L){ n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = L.some(g => g.attributes.color) ? new Float32Array(n * 3).fill(1) : null, I = new Uint32Array(ni); let o = 0, oi = 0;
  for(const g of L){ const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); if(g.attributes.uv) U.set(g.attributes.uv.array, o * 2); if(C && g.attributes.color) C.set(g.attributes.color.array, o * 3);
    if(g.index){ for(let i = 0; i < g.index.count; i++) I[oi++] = g.index.array[i] + o; } else for(let i = 0; i < c; i++) I[oi++] = o + i; o += c; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); if(C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g; }
// THE FOOTING that comes up with the tower: a pad under its base (w across × l along the fall), piers under it broken off at the bottom, rebar torn out of them
function footGeo(w, l){ const F = TOWERFALL.foot, key = Math.round(w * 2) + ':' + Math.round(l * 2) + ':' + BIOME.name; if(_FOOT.has(key)) return _FOOT.get(key);
  const C = [], R = [], soil = BIOME.ground || 0x7a6a50; C.push(chipped(w, F.t, l, 0.05, 0.1, soil).translate(0, -F.t / 2, 0));
  const four = Math.min(w, l) > 3.2, ph = F.d - F.t, piers = four ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (w / 2 - F.pier * 0.6), sz * (l / 2 - F.pier * 0.6), F.pier]) : [[0, 0, Math.min(w, l) * 0.6]];
  for(const [px, pz, s] of piers){ C.push(chipped(s, ph, s, 0.06, 0.28, soil).translate(px, -F.t - ph / 2, pz));
    const n = Math.round(rr(F.bars[0], F.bars[1]) * (four ? 0.6 : 1)); for(let k = 0; k < n; k++){ const bx = px + rr(-0.38, 0.38) * s, bz = pz + rr(-0.38, 0.38) * s;   // torn out of the pier's broken foot
      bar(R, bx, -F.d + 0.1, bz, rr(-0.3, 0.3), -1, rr(-0.3, 0.3), rr(0.25, 0.75), rr(0.15, 0.5), F.barR); } }
  for(let k = 0; k < (MOBILE ? 3 : 6); k++){ const sd = Math.random() < 0.5 ? -1 : 1, al = Math.random() < 0.5, x = al ? sd * w / 2 : rr(-0.45, 0.45) * w, z = al ? rr(-0.45, 0.45) * l : sd * l / 2;   // and out of the pad's torn edges
    bar(R, x, -F.t * rr(0.3, 0.7), z, al ? sd : rr(-0.3, 0.3), rr(-0.4, 0.2), al ? rr(-0.3, 0.3) : sd, rr(0.15, 0.45), rr(0.1, 0.35), F.barR); }
  const o = { conc:merge(C), steel:merge(R) }; _FOOT.set(key, o); return o; }
// THE PIT it leaves: bent anchor bolts and torn bars standing out of the hole, a broken pier stub or two half sunk in it
function pitGeo(r, v){ const key = Math.round(r * 2) + ':' + v + ':' + BIOME.name; if(_PIT.has(key)) return _PIT.get(key); const F = TOWERFALL.foot, C = [], R = [], soil = BIOME.ground || 0x7a6a50;
  const nb = Math.round(rr(5, 9)); for(let k = 0; k < nb; k++){ const a = rr(0, 6.283), d = r * rr(0.15, 0.75); bar(R, Math.cos(a) * d, -0.5, Math.sin(a) * d, rr(-0.35, 0.35), 1, rr(-0.35, 0.35), rr(0.5, 1.1), rr(0.2, 0.55), F.barR * 1.15); }
  for(let k = 0; k < 4; k++){ const a = k / 4 * 6.283 + rr(-0.3, 0.3), d = r * 0.55, g = new THREE.CylinderGeometry(0.05, 0.05, rr(0.35, 0.6), 6); g.rotateZ(rr(-0.5, 0.5)); g.rotateX(rr(-0.5, 0.5)); g.translate(Math.cos(a) * d, -0.15, Math.sin(a) * d); R.push(g);   // anchor bolts, sheared and bent
    const nut = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 6); nut.translate(Math.cos(a) * d, 0.02, Math.sin(a) * d); R.push(nut); }
  for(let k = 0; k < 1 + (v % 2); k++){ const s = rr(0.6, 1.0), g = chipped(s, s * 0.8, s * rr(0.7, 1.1), 0.08, 0.15, soil); g.rotateX(rr(-0.5, 0.5)); g.rotateZ(rr(-0.5, 0.5)); const a = rr(0, 6.283), d = r * rr(0.2, 0.5); g.translate(Math.cos(a) * d, -0.45, Math.sin(a) * d); C.push(g); }   // the pier stubs that stayed
  const o = { conc:merge(C), steel:merge(R) }; _PIT.set(key, o); return o; }
function pair(o){ const g = new THREE.Group(); if(o.conc){ const m = new THREE.Mesh(o.conc, _conc); m.castShadow = m.receiveShadow = true; g.add(m); } if(o.steel){ const m = new THREE.Mesh(o.steel, _steel); m.castShadow = true; g.add(m); } return g; }

// ---- the ground at its foot: dug out once, the rows of the terrain mesh that changed re-sent (heightfield.js syncs them next frame) ----
function dentGround(x, z, r, depth, rim){ const W = HF.W, h = HF.h, R = r * 1.8, i0 = Math.max(0, Math.floor((x - R + ARENA) / HF.step)), i1 = Math.min(HF.N, Math.ceil((x + R + ARENA) / HF.step)), j0 = Math.max(0, Math.floor((z - R + ARENA) / HF.step)), j1 = Math.min(HF.N, Math.ceil((z + R + ARENA) / HF.step));
  for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const px = -ARENA + i * HF.step, pz = -ARENA + j * HF.step, q = Math.hypot(px - x, pz - z) / r; if(q > 1.8) continue;
    h[j * W + i] += (q < 1 ? -depth * (1 - q * q) ** 2 * (0.85 + Math.random() * 0.3) : 0) + rim * Math.exp(-(((q - 1.15) / 0.3) ** 2)); }
  HF.dj0 = Math.min(HF.dj0 ?? 1e9, j0 - 1); HF.dj1 = Math.max(HF.dj1 ?? -1, j1 + 1); HF.dirty = true; }

// ---- its shape, read once off whatever is drawn: per height band the reach of its falling face (u along the fall, y up) and its half-width across ----
function measure(f, o){ const nb = TOWERFALL.bins, pu = new Float32Array(nb).fill(-1e9), py = new Float32Array(nb), g = o.g; g.updateMatrixWorld(true); _box.setFromObject(g);
  let H = Math.max(2, _box.max.y - f.F.y), W = 0, W0 = 0, uB = 0, n = 0;
  g.traverseVisible(m => { if(!m.isMesh || !m.geometry) return; const P = m.geometry.attributes.position, st = Math.max(1, Math.floor(P.count / 3000));
    for(let i = 0; i < P.count; i += st){ _v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); const rx = _v.x - f.F.x, ry = _v.y - f.F.y, rz = _v.z - f.F.z, u = rx * f.dx + rz * f.dz, l = Math.abs(rx * f.nx + rz * f.nz);
      const k = Math.min(nb - 1, Math.max(0, Math.floor(ry / H * nb))); if(u > pu[k]){ pu[k] = u; py[k] = Math.max(0, ry); } if(l > W) W = l; if(k < 2){ if(l > W0) W0 = l; if(-u > uB) uB = -u; } n++; } });
  if(n < 8){ H = o.h || 8; W = W0 = o.r || 2; uB = o.r || 2; for(let k = 0; k < nb; k++){ pu[k] = o.r || 2; py[k] = (k + 1) / nb * H; } }   // nothing drawn yet: its footprint circle
  for(let k = 0; k < nb; k++) if(pu[k] < -1e8){ pu[k] = k ? pu[k - 1] : (o.r || 2); py[k] = (k + 0.5) / nb * H; }
  f.H = H; f.W = Math.max(0.6, W); f.W0 = Math.max(0.5, W0 || W * 0.8); f.u0 = Math.max(0.4, Math.max(pu[0], pu[1])); f.uB = Math.max(0.4, uB || f.u0); f.pu = pu; f.py = py; }

// ---- topple: o = { g (the tower's group, origin at its foot), x, z, gy, dx, dz (the way it goes), kick (rad/s), top (a piece that tears off on impact),
//      burn (it was set alight: scorched pit), onImpact(x, z), h / r (fallbacks if nothing is drawn yet), cg (where its weight sits, × height) } ----
export function towerTopple(o){ mats(); const T = TOWERFALL, L = Math.hypot(o.dx, o.dz) || 1, dx = o.dx / L, dz = o.dz / L;
  const f = { g:o.g, dx, dz, nx:-dz, nz:dx, ax:new THREE.Vector3(dz, 0, -dx), F:new THREE.Vector3(o.x, o.gy ?? heightAt(o.x, o.z), o.z), q0:o.g.quaternion.clone(), top:o.top || null, burn:!!o.burn, metal:!!o.metal, onImpact:o.onImpact || null,
    th:0, w:o.kick ?? rr(T.kick[0], T.kick[1]), t:0, psi:0, psiT:rr(-T.twist, T.twist), rho:0, rhoV:0, rhoT:0, sl:0, slT:0, lat:0, latT:0, lift:0, hits:0, torn:false, down:false, restT:0, dustT:0 };
  if(f.top){ f.top.visible = false; measure(f, o); f.puB = f.pu; f.pyB = f.py; f.top.visible = true; }   // its reach without the piece that tears off (it lies on that once the piece is gone)
  measure(f, o); f.hc = (o.cg ?? T.cg) * f.H; f.I = f.H * f.H / 3 + f.u0 * f.u0; f.P = new THREE.Vector3(o.x + dx * f.u0, f.F.y, o.z + dz * f.u0);   // the pivot: the front edge of its base
  const fg = footGeo(f.W0 * 2 * 0.92, (f.u0 + f.uB) * 0.92), foot = pair(fg); foot.position.set(0, 0, 0); f.g.add(foot);   // the footing hangs under its base, ready to come up with it
  _qa.setFromAxisAngle(UP, Math.atan2(dx, dz)); foot.quaternion.copy(f.q0).invert().multiply(_qa); _v.set(0, -0.02, (f.u0 - f.uB) / 2).applyQuaternion(_qa); _v.applyQuaternion(_qb.copy(f.q0).invert()); foot.position.copy(_v);
  const sc = 1 / (f.g.scale.x || 1); foot.scale.setScalar(sc); foot.position.multiplyScalar(sc); f.foot = foot;
  dustSkirt(o.x, o.z, 1.0); for(let k = 0; k < (MOBILE ? 3 : 6); k++){ const a = rr(0, 6.283), d = rr(0.5, 1) * f.u0; spawnPart(o.x + Math.cos(a) * d, f.F.y + 0.4, o.z + Math.sin(a) * d, Math.cos(a) * 2, rr(0.6, 1.4), Math.sin(a) * 2, { color:BIOME.ground || 0x9a8a6a, size:rr(1.6, 2.6), life:rr(1.6, 2.4), smoke:true, grav:0.1, drag:1.6, grow:1.8, op:0.42 }); }   // the base shudders: dust off its foot
  TOWER_FALLS.push(f); return f; }

// where its falling face is now, against the ground: the band that is lowest under it (< 0: into the ground) → f._k, f._x, f._z
function clearance(f){ _qa.setFromAxisAngle(UP, f.psi); _qb.setFromAxisAngle(f.ax, f.th); _q.copy(_qa).multiply(_qb); _qr.setFromAxisAngle(UP, f.rho); _qb.copy(_q).multiply(_qr);
  let best = 1e9; const nb = f.pu.length, ox = f.g.position.x, oy = f.g.position.y, oz = f.g.position.z;
  for(let k = 1; k < nb; k++){ _v.set(f.dx * f.pu[k], f.py[k], f.dz * f.pu[k]).applyQuaternion(_qb); const x = ox + _v.x, z = oz + _v.z, c = oy + _v.y - heightAt(x, z); if(c < best){ best = c; f._k = k; f._x = x; f._z = z; } }
  return best; }
// lay the tower where the state says: turned about the pivot (and slewed about it), rolled about its own length, slid
function pose(f){ _qa.setFromAxisAngle(UP, f.psi); _qb.setFromAxisAngle(f.ax, f.th); _q.copy(_qa).multiply(_qb); _qr.setFromAxisAngle(UP, f.rho);
  f.g.quaternion.copy(_q).multiply(f.q0).multiply(_qr);
  _v.copy(f.F).sub(f.P).applyQuaternion(_q).add(f.P); _v.x += f.dx * f.sl + f.nx * f.lat; _v.z += f.dz * f.sl + f.nz * f.lat; _v.y += f.lift; f.g.position.copy(_v); }

export function updateTowerFalls(dt){ if(!TOWER_FALLS.length && !TOWER_CHUNKS.length) return; dt = Math.min(dt, 0.05); const T = TOWERFALL;
  for(let i = TOWER_FALLS.length - 1; i >= 0; i--){ const f = TOWER_FALLS[i]; if(f.hold) continue; f.t += dt;
    if(!f.down){ const th0 = f.th; f.w += T.g * T.gK * f.hc * Math.sin(f.th + T.lean) / f.I * dt; f.th += f.w * dt; f.psi = f.psiT * Math.min(1, f.th / 1.4);
      if(!f.torn && f.th > T.tearAt) tear(f);
      if((f.dustT -= dt) < 0 && f.th > 0.2){ f.dustT = 0.12; spawnPart(f.P.x - f.dx * f.u0 * 0.5 + rr(-1, 1), f.F.y + 0.3, f.P.z - f.dz * f.u0 * 0.5 + rr(-1, 1), rr(-0.5, 0.5), rr(0.4, 1.0), rr(-0.5, 0.5), { color:BIOME.ground || 0x9a8a6a, size:rr(1.2, 2), life:1.6, smoke:true, grav:0.1, drag:1.6, grow:1.6, op:0.35 }); }   // soil streaming off the torn footing
      pose(f); const c = clearance(f);
      if(c < 0 || f.th > Math.PI / 2 + 0.7){ f.th = th0; pose(f); const w = f.w; f.hits++;
        if(f.hits === 1) impact(f, w); else if(Math.abs(w) > 0.35) thump(f, 0.5);
        f.w = -w * T.bounce; if(Math.abs(f.w) < T.restW || f.hits >= 3){ f.w = 0; f.down = true; } } }
    else { f.restT += dt; const R = T.roll; f.rhoV += (-R.k * (f.rho - f.rhoT) - R.d * f.rhoV) * dt; f.rho += f.rhoV * dt; f.lat = f.rho * f.W * R.lat;   // it rolls a little about its length, rocks, and stops
      f.sl += (f.slT - f.sl) * Math.min(1, dt * 3); f.psi += (f.psiT - f.psi) * Math.min(1, dt * 2.5);
      pose(f); const c = clearance(f); f.lift += (Math.max(0, -c - 0.12) + (c > 0.4 ? -Math.min(f.lift, c - 0.4) : 0)) * Math.min(1, dt * 6);   // on the ground: never sunk, never hung in the air
      if(f.restT > T.settle && Math.abs(f.rhoV) < 0.02){ pose(f); sleep(f); TOWER_FALLS.splice(i, 1); } } }
  for(let i = TOWER_CHUNKS.length - 1; i >= 0; i--) if(stepChunk(TOWER_CHUNKS[i], dt)) TOWER_CHUNKS.splice(i, 1); }

// the footing gives: the ground at its foot heaves and is dug out, soil and concrete dust spray up the side that lifts
function tear(f){ f.torn = true; const T = TOWERFALL, P = T.pit, r = Math.max(f.u0, f.W0) * P.r, x = f.F.x, z = f.F.z, bx = x - f.dx * f.uB * 0.7, bz = z - f.dz * f.uB * 0.7;
  dentGround(x, z, r, P.depth, P.rim); decalCrater(x, z, r * P.decal, 0.95); if(f.burn) decalScorch(x, z, r * 1.6, 0.7); else decalAsh(x, z, r * 1.5, 0.45);
  const pit = pair(pitGeo(r, (Math.random() * 3) | 0)); pit.position.set(x, f.F.y - P.depth * 0.35, z); pit.rotation.y = rr(0, 6.283); scene.add(pit); f.pit = pit;
  dirtGeyser(bx, bz, 1.1); for(let k = 0; k < (MOBILE ? 6 : 14); k++) spawnPart(bx + rr(-1, 1) * f.W0, f.F.y + 0.3, bz + rr(-1, 1) * f.W0, rr(-2, 2) - f.dx * 2, rr(4, 9), rr(-2, 2) - f.dz * 2, { color:Math.random() < 0.5 ? 0x3e3024 : 0x8a847a, size:rr(0.12, 0.3), life:1.2, grav:-20, drag:0.4 });   // clods and concrete grit
  for(let k = 0; k < (MOBILE ? 2 : 4); k++) spawnPart(bx + rr(-1, 1) * f.W0, f.F.y + 0.6, bz + rr(-1, 1) * f.W0, rr(-0.6, 0.6), rr(0.8, 1.6), rr(-0.6, 0.6), { color:0xb4aea2, size:rr(2, 3.2), life:rr(2, 3), smoke:true, grav:0.1, drag:1.4, grow:2, op:0.4 });
  sfx('crunch', { x, z }, 0.9); shakeAt(x, z, 0.35); }
// it strikes the ground: a long dust cloud along it, a burst where the top hit, grit, the gouge, the shake, the sound; the piece on top tears away
function impact(f, w){ const T = TOWERFALL, D = T.dust, tx = f._x, tz = f._z, Lx = tx - f.P.x, Lz = tz - f.P.z, n = Math.round(D.n * (MOBILE ? 0.5 : 1)), gc = BIOME.ground || 0x9a8a6a;
  for(let k = 0; k < n; k++){ const s = 0.15 + 0.9 * k / n, x = f.P.x + Lx * s + rr(-1, 1) * f.W * 0.6, z = f.P.z + Lz * s + rr(-1, 1) * f.W * 0.6, sp = rr(2, 5) * (0.5 + s);
    spawnPart(x, heightAt(x, z) + 0.5, z, f.nx * sp * (Math.random() < 0.5 ? -1 : 1), rr(0.6, 1.6), f.nz * sp * (Math.random() < 0.5 ? -1 : 1), { color:Math.random() < 0.6 ? gc : 0xb0aaa0, size:rr(D.size[0], D.size[1]), life:rr(D.life[0], D.life[1]), smoke:true, grav:0.12, drag:1.3, grow:2.1, op:D.op }); }
  for(let k = 0; k < D.cloud; k++) spawnPart(f.P.x + Lx * rr(0.4, 1), heightAt(tx, tz) + 1.2 + k * 0.6, f.P.z + Lz * rr(0.4, 1), rr(-0.4, 0.4) + 0.3, rr(0.3, 0.7), rr(-0.4, 0.4) + 0.1, { color:0xaea89c, size:rr(4.5, 6.5), life:rr(5, 7), smoke:true, grav:0.06, drag:0.6, grow:1.6, op:0.3 });   // the cloud that hangs and drifts
  dustSkirt(tx, tz, 1.3); for(let k = 0; k < (MOBILE ? 8 : 18); k++){ const s = rr(0.3, 1); spawnPart(f.P.x + Lx * s, heightAt(tx, tz) + 0.4, f.P.z + Lz * s, rr(-3, 3), rr(3, 8), rr(-3, 3), { color:Math.random() < 0.5 ? 0x3a3026 : 0x77716a, size:rr(0.1, 0.26), life:1.1, grav:-18, drag:0.5 }); }
  decalCrater(tx, tz, Math.max(1.4, f.W * 0.6), 0.6); decalCrater(f.P.x + Lx * 0.55, f.P.z + Lz * 0.55, Math.max(1, f.W * 0.45), 0.35);
  const sp = Math.min(1.6, Math.abs(w) * f.H / 18); sfx('crunch', { x:tx, z:tz }, 1); sfx('thud', { x:tx, z:tz }, 1.2 * sp); if(f.metal) sfx('clang', { x:tx, z:tz }, 0.6); shakeAt(tx, tz, T.shake.k * sp);
  const R = T.roll, sL = (heightAt(f.P.x + Lx * 0.5 + f.nx * f.W, f.P.z + Lz * 0.5 + f.nz * f.W) - heightAt(f.P.x + Lx * 0.5 - f.nx * f.W, f.P.z + Lz * 0.5 - f.nz * f.W)) / (2 * f.W);   // which way the ground falls away across it
  f.rhoT = Math.max(-R.max, Math.min(R.max, -Math.atan(sL) * 1.2 + rr(-R.askew, R.askew))); f.rhoV = Math.sign(f.rhoT || 1) * rr(0.4, 0.9);   // it rolls toward the low side, a little past, and rocks back
  const sT = (heightAt(tx + f.nx * 2, tz + f.nz * 2) - heightAt(tx - f.nx * 2, tz - f.nz * 2)) / 4; f.psiT = f.psi + Math.max(-0.22, Math.min(0.22, sT * T.yawSlope + rr(-0.05, 0.05)));   // its top slews down the slope
  f.slT = rr(T.slide[0], T.slide[1]); if(f.onImpact) f.onImpact(tx, tz);
  if(f.top) tearOff(f, w); }
function thump(f, k){ const x = f._x, z = f._z; dustSkirt(x, z, 1.0); for(let j = 0; j < 3; j++) spawnPart(x + rr(-2, 2), heightAt(x, z) + 0.5, z + rr(-2, 2), rr(-1, 1), rr(0.5, 1), rr(-1, 1), { color:BIOME.ground || 0x9a8a6a, size:rr(2, 3), life:2.2, smoke:true, grav:0.1, drag:1.4, grow:1.8, op:0.35 }); sfx('thud', { x, z }, 0.7 * k); shakeAt(x, z, 0.4 * k); }
function shakeAt(x, z, k){ const p = S.player, Q = TOWERFALL.shake; if(!p) return; const d = Math.hypot(p.pos.x - x, p.pos.z - z); if(d > Q.r) return; const a = k * (1 - d / Q.r); S.shake = Math.min(Q.max, (S.shake || 0) + a); if(a > 0.3) haptic(Math.round(10 + a * 15)); }

// a piece torn away on impact (the radar's array): carried off with the speed its point had, it tumbles, bounces, slides and lies where it stops
function tearOff(f, w){ const o = f.top; f.top = null; if(f.puB){ f.pu = f.puB; f.py = f.pyB; } if(!o.parent) return; o.updateMatrixWorld(true); scene.attach(o); _box.setFromObject(o); const r = Math.max(0.5, _box.getSize(_v).length() / 2), c = _box.getCenter(_w);
  const ox = o.position.x, oy = o.position.y, oz = o.position.z, rx = c.x - f.P.x, ry = c.y - f.P.y, rz = c.z - f.P.z, sp = Math.abs(w) * Math.hypot(rx, ry, rz) * 0.45;   // (its tangential speed, much of it lost in the blow)
  const C = { o, r, off:new THREE.Vector3(ox - c.x, oy - c.y, oz - c.z), p:c.clone(), v:new THREE.Vector3(f.dx * sp + rr(-1, 1), rr(2, 4), f.dz * sp + rr(-1, 1)), wv:new THREE.Vector3(f.ax.x * rr(2, 4) + rr(-1, 1), rr(-1.5, 1.5), f.ax.z * rr(2, 4) + rr(-1, 1)), t:0, hits:0 };
  TOWER_CHUNKS.push(C); }
function stepChunk(C, dt){ const K = TOWERFALL.chunk; C.t += dt; C.v.y -= K.g * dt; C.p.addScaledVector(C.v, dt);
  const a = C.wv.length(); if(a > 1e-4){ _q.setFromAxisAngle(_v.copy(C.wv).divideScalar(a), a * dt); C.o.quaternion.premultiply(_q); _v.copy(C.off).applyQuaternion(_q); C.off.copy(_v); }
  const gy = heightAt(C.p.x, C.p.z), lo = C.r * 0.45;
  if(C.p.y - lo < gy){ C.p.y = gy + lo; if(C.v.y < -1.5){ C.hits++; const x = C.p.x, z = C.p.z; spawnPart(x, gy + 0.4, z, 0, 0.8, 0, { color:BIOME.ground || 0x9a8a6a, size:2 + C.r, life:2, smoke:true, grav:0.1, drag:1.5, grow:1.8, op:0.4 }); sfx('clang', { x, z }, 0.6); }
    C.v.y = Math.max(0, -C.v.y * K.e); C.v.x *= K.mu; C.v.z *= K.mu; C.wv.multiplyScalar(K.mu); }
  C.o.position.copy(C.p).add(C.off);
  if(C.t > 0.8 && C.p.y - lo <= gy + 0.02 && C.v.lengthSq() < 0.5 && C.wv.lengthSq() < 0.6 || C.t > 6){ C.o.updateMatrixWorld(true); _box.setFromObject(C.o); const gy2 = heightAt(C.p.x, C.p.z); C.o.position.y += gy2 - _box.min.y - 0.12; C.o.updateMatrixWorld(true); C.rest = true;   // laid on the ground, a little dug in
    TOWER_WRECKS.push({ g:C.o, chunk:true }); return true; }
  return false; }

// asleep: no more steps; a long low box where it lies (tanks stop at it, rounds strike it, a man can crouch behind it)
function sleep(f){ f.g.updateMatrixWorld(true); _v.set(0, 1, 0).applyQuaternion(f.g.quaternion); const hl = Math.max(1, Math.hypot(_v.x, _v.z) * f.H / 2 + 0.6), hw = f.W * 0.8;
  const cx = f.g.position.x + _v.x * f.H / 2, cz = f.g.position.z + _v.z * f.H / 2, b = { mesh:f.g, x:cx, z:cz, r:hl, obb:{ f:Math.atan2(_v.x, _v.z), hw, hl }, steel:true, loot:false, kind:'towerdown' };
  blocks.push(b); f.block = b; TOWER_WRECKS.push(f); trim(); }
// a battle keeps the last TOWERFALL.keep of them; past that the oldest one out of sight goes
function trim(){ const K = TOWERFALL.keep, p = S.player; while(TOWER_WRECKS.filter(q => !q.chunk).length > K){ const i = TOWER_WRECKS.findIndex(q => !q.chunk && (!p || Math.hypot(q.g.position.x - p.pos.x, q.g.position.z - p.pos.z) > 90)); if(i < 0) break; drop(TOWER_WRECKS[i]); TOWER_WRECKS.splice(i, 1); } }
function drop(f){ if(f.g && f.g.parent) f.g.parent.remove(f.g); if(f.pit && f.pit.parent) f.pit.parent.remove(f.pit); if(f.block){ const i = blocks.indexOf(f.block); if(i >= 0) blocks.splice(i, 1); } }
// a new battle: nothing of the last one's towers is left
export function clearTowerFalls(){ for(const f of TOWER_FALLS) drop(f); for(const f of TOWER_WRECKS) drop(f); for(const C of TOWER_CHUNKS) if(C.o.parent) C.o.parent.remove(C.o); TOWER_FALLS.length = TOWER_WRECKS.length = TOWER_CHUNKS.length = 0; }
