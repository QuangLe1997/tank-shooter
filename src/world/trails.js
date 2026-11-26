// world/trails.js — Z432 TRAILS: the tracks worn between the places of a battlefield (our gates, the spawn, the forts' gates, the bases, the depots, the checkpoints, the roads off the field), routed round what stands, painted into the floor, with stones and grass along both sides
import * as THREE from 'three';
import { TRAILS } from '../../config.js';
import { diceSeeded, ARENA, BIOME, DECAL_U, DEF, DEPOTS, FENCE_GAPS, FORTS, HILLWAY, MOBILE, OBJ, ROAD_EXITS, SCENE, SUPPLY, UNDER, _R, blocks, buildPerimeter, bushes, crushables, decorGroup, fieldDepth, grass, heightAt, inField, onPaved, photoDiff, plantFlora, roadRocks, realStones, rockSet, solidShape, wetAt } from '../hub.js';

// one trail = { pts:[[x, z], …] every 2 m, w (its width, m), len } · mask: a 1 m grid over the field's square, 2 = on the worn track, 1 = its verge
export const TRAIL = { paths:[], mask:null, mn:0 };
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _V = new THREE.Vector3(), _S = new THREE.Vector3(), _E = new THREE.Euler(), _Z = new THREE.Matrix4().makeScale(0, 0, 0);
export function onTrail(x, z){ const T = TRAIL, A = ARENA; if(!T.mask) return 0; const i = Math.floor(x + A), j = Math.floor(z + A); return i < 0 || j < 0 || i >= T.mn || j >= T.mn ? 0 : T.mask[j * T.mn + i]; }

// the places a track leads to: just outside each gate or yard, on the side that faces our compound
function sites(){ const out = [], A = ARENA, R = TRAILS.core;
  const inward = (x, z, d) => { const l = Math.hypot(x, z) || 1; d = Math.max(0, Math.min(d, l - R)); return [x - x / l * d, z - z / l * d]; };
  const add = (p, k, big) => { if(p && p[0] === p[0] && p[1] === p[1] && inField(p[0], p[1], 2)) out.push({ x:p[0], z:p[1], k, big:!!big }); };
  add([0, R], 'gate', 1); add([R, 0], 'gate'); add([-R, 0], 'gate'); add([0, -R], 'gate', 1); add([0, A * 0.55 + 6], 'spawn', 1);
  for(const f of FORTS) add(f.climb ? f.climb.foot : f.ox === f.ox ? [f.ox + (f.ox - f.gx) * 0.45, f.oz + (f.oz - f.gz) * 0.45] : inward(f.x, f.z, f.R + 9), 'fort', 1);   // (Z456 a spur's fort: the foot of its one way up)
  for(const B of SUPPLY.bases) add(inward(B.x, B.z, B.R + 3), B.kind);
  for(const d of DEPOTS) add(inward(d.x, d.z, ((d.q && d.q.r) || 12) + 3), 'depot');
  if(UNDER.gate) add(inward(UNDER.gate.x, UNDER.gate.z, 12), 'under');
  for(const L of DEF.cps || []) add([L.x, L.z], 'cp');
  if(OBJ && OBJ.x === OBJ.x) add(inward(OBJ.x, OBJ.z, (OBJ.r || 10) + 4), 'obj');
  for(const q of HILLWAY) add([q.x, q.z], 'path');   // Z455 a footpath up every knoll and over every ridge's saddle
  return out; }

// the cost grid: what stands (padded) is solid, our compound / the forts / the yards are walked round, water and the ground past the fence cost more
function grid(){ const C = TRAILS, A = ARENA, c = C.cell[MOBILE ? 1 : 0], n = Math.ceil(2 * A / c), N = n * n, H = new Float32Array(N), W = new Float32Array(N), F = new Uint8Array(N);
  const cc = i => -A + (i + 0.5) * c;
  for(let j = 0; j < n; j++) for(let i = 0; i < n; i++){ const x = cc(i), z = cc(j), k = j * n + i; H[k] = heightAt(x, z); F[k] = fieldDepth(x, z) < 1.5 ? 1 : 0; W[k] = 1 + F[k] * C.out + (wetAt(x, z, 0.5) ? C.wet : 0); }
  const span = (v, r) => [Math.max(0, Math.floor((v - r + A) / c)), Math.min(n - 1, Math.floor((v + r + A) / c))];
  const disc = (x, z, r) => { const [i0, i1] = span(x, r), [j0, j1] = span(z, r); for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++) if((cc(i) - x) ** 2 + (cc(j) - z) ** 2 < r * r) W[j * n + i] = Infinity; };
  const box = (s, p) => { const sn = Math.sin(s.obb.f), cs = Math.cos(s.obb.f), hl = s.obb.hl + p, hw = s.obb.hw + p, R = Math.hypot(hl, hw), [i0, i1] = span(s.x, R), [j0, j1] = span(s.z, R);   // (solid-shape.js: along (sin f, cos f) ± hl, across ± hw)
    for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const dx = cc(i) - s.x, dz = cc(j) - s.z; if(Math.abs(dx * sn + dz * cs) < hl && Math.abs(dx * cs - dz * sn) < hw) W[j * n + i] = Infinity; } };
  const p = C.pad, seen = new Set();
  const plan = diceSeeded();   // SYNC 1 a seeded battle's tracks go round what the layout put there, not round whichever model was drawn on it when the field was built
  for(const b of blocks){ if(!b || !(b.x === b.x) || b.air) continue; let s = null; try{ s = solidShape(b, false, plan); }catch(e){}
    if(s && s.obb){ if(!seen.has(s)){ seen.add(s); box(s, p); } } else if(b.r > 0.2) disc(b.x, b.z, b.r + p); }
  for(const q of SCENE.pieces || []) if(!q.far && q.r > 0.3) disc(q.x, q.z, q.r * 0.8 + p);
  for(const t of crushables) if(t.kind === 'tree' && t.alive) disc(t.x, t.z, (t.r || 0.5) + 1);
  disc(0, 0, C.core - 8); for(const f of FORTS) disc(f.x, f.z, (f.Rin || f.R * 0.8) * 0.95);
  for(const B of SUPPLY.bases) disc(B.x, B.z, B.R * 0.8); for(const d of DEPOTS) disc(d.x, d.z, ((d.q && d.q.r) || 12) * 0.8);
  return { n, c, A, H, W, F, used:new Uint8Array(N), cc }; }

// A* from a to b over the grid (8 ways, no corner cut past something solid): length × the ground's cost (× reuse on a stretch already worn) + the climb
const STEP = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
function route(G, a, b, out){ const { n, c, H, W, F, used } = G, N = n * n, C = TRAILS;
  const cell = (x, z) => Math.min(n - 1, Math.max(0, Math.floor((z + G.A) / c))) * n + Math.min(n - 1, Math.max(0, Math.floor((x + G.A) / c)));
  const ok = k => W[k] < Infinity && (out || !F[k]);
  const free = k0 => { if(ok(k0)) return k0; const i0 = k0 % n, j0 = (k0 / n) | 0;
    for(let r = 1; r < 8; r++) for(let j = j0 - r; j <= j0 + r; j++) for(let i = i0 - r; i <= i0 + r; i++){ if(i < 0 || j < 0 || i >= n || j >= n || (Math.abs(i - i0) < r && Math.abs(j - j0) < r)) continue; if(ok(j * n + i)) return j * n + i; }
    return -1; };
  const s = free(cell(a.x, a.z)), t = free(cell(b.x, b.z)); if(s < 0 || t < 0) return null;
  const g = G.g || (G.g = new Float32Array(N)), from = G.from || (G.from = new Int32Array(N)), seen = G.seen || (G.seen = new Uint32Array(N)), done = G.done || (G.done = new Uint32Array(N));
  const HK = G.hk || (G.hk = new Int32Array(N * 8)), HF = G.hf || (G.hf = new Float32Array(N * 8)), run = (G.run = (G.run || 0) + 1), ti = t % n, tj = (t / n) | 0, hK = C.reuse * c; let hn = 0;
  const push = (k, f) => { if(hn >= HK.length) return; let i = hn++; while(i > 0){ const q = (i - 1) >> 1; if(HF[q] <= f) break; HK[i] = HK[q]; HF[i] = HF[q]; i = q; } HK[i] = k; HF[i] = f; };
  const pop = () => { const top = HK[0], k = HK[--hn], f = HF[hn]; let i = 0; for(;;){ let m = 2 * i + 1; if(m >= hn) break; if(m + 1 < hn && HF[m + 1] < HF[m]) m++; if(HF[m] >= f) break; HK[i] = HK[m]; HF[i] = HF[m]; i = m; } HK[i] = k; HF[i] = f; return top; };
  seen[s] = run; g[s] = 0; from[s] = -1; push(s, 0); let found = false;
  while(hn){ const k = pop(); if(done[k] === run) continue; done[k] = run; if(k === t){ found = true; break; } const i = k % n, j = (k / n) | 0;
    for(const [di, dj, dl] of STEP){ const i2 = i + di, j2 = j + dj; if(i2 < 0 || j2 < 0 || i2 >= n || j2 >= n) continue; const k2 = j2 * n + i2; if(!ok(k2) || done[k2] === run) continue;
      if(di && dj && (W[j * n + i2] === Infinity || W[j2 * n + i] === Infinity)) continue;
      const dh = H[k2] - H[k], ng = g[k] + dl * c * (W[k2] * (used[k2] ? C.reuse : 1) + C.grade * (dh / (dl * c)) ** 2) + Math.abs(dh) * C.slope;   // (Z453 the grade squared: up a hill the track winds)
      if(seen[k2] !== run || ng < g[k2]){ seen[k2] = run; g[k2] = ng; from[k2] = k; push(k2, ng + Math.hypot(i2 - ti, j2 - tj) * hK); } } }
  if(!found) return null;
  const P = []; for(let k = t; k >= 0; k = from[k]) P.push([G.cc(k % n), G.cc((k / n) | 0)]); return P.reverse(); }

// even spacing along a polyline
function resample(Q, st){ const out = [Q[0].slice()]; let carry = 0;
  for(let i = 0; i < Q.length - 1; i++){ const [x0, z0] = Q[i], [x1, z1] = Q[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if(L < 1e-6) continue; let d = st - carry;
    while(d <= L){ const f = d / L; out.push([x0 + (x1 - x0) * f, z0 + (z1 - z0) * f]); d += st; } carry = L - (d - st); }
  const e = Q[Q.length - 1], l = out[out.length - 1]; if(Math.hypot(e[0] - l[0], e[1] - l[1]) > st * 0.3) out.push(e.slice()); return out; }
// the grid's stair-steps rounded off (Chaikin), then a slow meander laid across it, still at the ends
function smooth(P, a, b){ let Q = [[a.x, a.z]]; for(let i = 1; i < P.length - 1; i += 2) Q.push(P[i]); Q.push([b.x, b.z]);
  for(let it = 0; it < 3; it++){ const R = [Q[0]]; for(let i = 0; i < Q.length - 1; i++){ const [x0, z0] = Q[i], [x1, z1] = Q[i + 1]; R.push([x0 * 0.75 + x1 * 0.25, z0 * 0.75 + z1 * 0.25], [x0 * 0.25 + x1 * 0.75, z0 * 0.25 + z1 * 0.75]); } R.push(Q[Q.length - 1]); Q = R; }
  const pts = resample(Q, 2), n = pts.length, ph = Math.random() * 9, ph2 = Math.random() * 9, W = TRAILS.wig;
  return pts.map(([x, z], i) => { if(i < 2 || i > n - 3) return [x, z]; const [x0, z0] = pts[i - 1], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0) || 1, taper = Math.min(1, i / 8, (n - 1 - i) / 8), o = (Math.sin(i * 0.11 + ph) * 0.75 + Math.sin(i * 0.37 + ph2) * 0.25) * W * taper;
    return [x - (z1 - z0) / L * o, z + (x1 - x0) / L * o]; }); }
const lenOf = pts => { let L = 0; for(let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
// the across-the-track direction at point i
export function trailNormal(pts, i){ const [x0, z0] = pts[Math.max(0, i - 1)], [x1, z1] = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(x1 - x0, z1 - z0) || 1; return [-(z1 - z0) / L, (x1 - x0) / L]; }

// the stage is built: lay the network (called after buildUnderground — everything that stands is in), paint it in later (decals.js paintContact)
export function buildTrails(){ const C = TRAILS, T = TRAIL, had = FENCE_GAPS.length; T.paths = []; T.mask = null; FENCE_GAPS.length = 0; DECAL_U.trailK.value.x = 0;
  const bz = (C.biomes || {})[BIOME.name];
  if(!C.on || !bz || BIOME.cave){ if(had) buildPerimeter(BIOME, true); return 0; }
  let G = null; try{ G = grid(); }catch(e){ console.warn('[trails]', e && e.message); }
  const S = G ? sites() : []; if(S.length < 2){ if(had) buildPerimeter(BIOME, true); return 0; }
  const inT = new Uint8Array(S.length), best = S.map(s => [Math.hypot(s.x - S[0].x, s.z - S[0].z), 0]), legs = []; inT[0] = 1;   // the shortest tree over the places (Prim)
  for(let m = 1; m < S.length; m++){ let bi = -1; for(let i = 0; i < S.length; i++) if(!inT[i] && (bi < 0 || best[i][0] < best[bi][0])) bi = i; inT[bi] = 1;
    const a = S[best[bi][1]], b = S[bi]; legs.push({ a, b, w:a.k === 'path' || b.k === 'path' ? C.path : C.w[a.big && b.big ? 1 : 0] });
    for(let i = 0; i < S.length; i++) if(!inT[i]){ const d = Math.hypot(S[i].x - b.x, S[i].z - b.z); if(d < best[i][0]) best[i] = [d, bi]; } }
  for(const e of ROAD_EXITS){ const ox = Math.cos(e.a), oz = Math.sin(e.a), p = { x:e.x - ox * 14, z:e.z - oz * 14 }; let a = S[0], bd = Infinity;   // and out to each road over the hills
    for(const s of S){ const d = Math.hypot(s.x - p.x, s.z - p.z); if(d < bd){ bd = d; a = s; } } legs.push({ a, b:p, w:C.w[1], exit:e }); }
  for(const f of FORTS) if(f.climb){ const c = f.climb, pts = resample((f.ox === f.ox ? [[f.ox, f.oz]] : []).concat(c.pts), 2);   // Z456 the way up the capital's spur, laid first: from outside its gate, over the rim, down the hairpins
    for(const [x, z] of pts){ const i = Math.floor((x + G.A) / G.c), j = Math.floor((z + G.A) / G.c); if(i >= 0 && j >= 0 && i < G.n && j < G.n) G.used[j * G.n + i] = 1; }
    T.paths.push({ pts, w:c.w, len:lenOf(pts), exit:false, climb:true }); }
  legs.sort((p, q) => (q.w - p.w) || (Math.hypot(q.a.x - q.b.x, q.a.z - q.b.z) - Math.hypot(p.a.x - p.b.x, p.a.z - p.b.z)));   // the trunks first: the lanes join them
  for(const L of legs){ const P = route(G, L.a, L.b, !!L.exit); if(!P || P.length < 2) continue; let pts = smooth(P, L.a, L.b);
    if(L.exit){ const e = L.exit, ox = Math.cos(e.a), oz = Math.sin(e.a); pts = pts.concat(resample([pts[pts.length - 1], [e.x, e.z], [e.x + ox * 4, e.z + oz * 4]], 2).slice(1)); }
    for(const [x, z] of pts){ const i = Math.floor((x + G.A) / G.c), j = Math.floor((z + G.A) / G.c); if(i >= 0 && j >= 0 && i < G.n && j < G.n) G.used[j * G.n + i] = 1; }
    const path = { pts, w:L.w * _R(0.92, 1.08), len:lenOf(pts), exit:!!L.exit }; T.paths.push(path);
    if(L.exit){ const k = pts.findIndex(([x, z]) => fieldDepth(x, z) < 1.2); if(k >= 0) FENCE_GAPS.push({ x:pts[k][0], z:pts[k][1], r:path.w / 2 + 1.4, pts:pts.slice(k).filter((q, i) => !(i & 1)) }); } }
  if(had || FENCE_GAPS.length) buildPerimeter(BIOME, true);   // the fence again, open where the tracks run out (and the rocks beyond off them)
  mask(); clearOnTrail(); dress(bz); roadRocks(T.paths);   // (Z453 boulders along the roads, thick up a fort's hill)
  const want = BIOME.name; photoDiff(bz.set).then(t => { if(BIOME.name !== want || !T.paths.length) return; DECAL_U.trailMap.value = t; DECAL_U.trailK.value.set(1, 1 / bz.tile, bz.mid, C.rutDark); DECAL_U.trailCol.value.setRGB(...bz.tint); }).catch(() => {});
  return T.paths.length; }

function mask(){ const T = TRAIL, A = ARENA, mn = Math.ceil(2 * A), M = new Uint8Array(mn * mn); T.mn = mn; T.mask = M;
  for(const P of T.paths){ const r2 = P.w / 2, r1 = r2 + TRAILS.mask;
    for(const [x, z] of resample(P.pts, 1)){ const i0 = Math.max(0, Math.floor(x + A - r1)), i1 = Math.min(mn - 1, Math.floor(x + A + r1)), j0 = Math.max(0, Math.floor(z + A - r1)), j1 = Math.min(mn - 1, Math.floor(z + A + r1));
      for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const d = Math.hypot(i + 0.5 - A - x, j + 0.5 - A - z), k = j * mn + i; if(d < r2) M[k] = 2; else if(d < r1 && !M[k]) M[k] = 1; } } } }
// the loose stones, tufts, flowers and bushes already scattered on the worn track: gone (it is beaten bare)
function clearOnTrail(){ const seen = new Set(); for(const c of crushables){ if(!c.alive || c.kind === 'tree' || !c.im || (onTrail(c.x, c.z) !== 2 && !onPaved(c.x, c.z))) continue; c.im.setMatrixAt(c.k, _Z); c.alive = false; seen.add(c.im); }
  for(const im of seen) im.instanceMatrix.needsUpdate = true; }

// along both sides: loose stones (pebbles kicked to the edges, a kerb of bigger ones), then the land's grass, bushes and flowers (crushable like the rest)
function dress(bz){ const C = TRAILS, bn = BIOME.name, T = TRAIL, k = MOBILE ? 0.4 : 1, set = rockSet(bn), n = set.small.length, lists = [set.small.map(() => []), set.small.map(() => [])];
  for(const P of T.paths){ const hw = P.w / 2, ru = P.w * C.rut;
    for(let i = 1; i < P.pts.length - 1; i++){ const [x, z] = P.pts[i], [nx, nz] = trailNormal(P.pts, i), tx = nz, tz = -nx;
      for(let K = 0; K < 2; K++){ const [rate] = C.stones[K], cnt = Math.floor(rate * 2 * k + Math.random());
        for(let q = 0; q < cnt; q++){ const sd = Math.random() < 0.5 ? -1 : 1; let u = K ? sd * (hw + _R(0.2, 1.4)) : (bz.mid < 0.3 && Math.random() < 0.3 ? _R(-0.4, 0.4) * P.w : sd * (hw + _R(-0.7, 0.35)));
          if(!K && Math.abs(Math.abs(u) - ru) < C.rutW * 0.6) u += Math.sign(u || 1) * C.rutW;   // (the ruts stay clean)
          const t = _R(-1, 1), px = x + nx * u + tx * t, pz = z + nz * u + tz * t; if(!inField(px, pz, 0.5)) continue;
          lists[K][(Math.random() * n) | 0].push({ x:px, z:pz, r:K ? _R(0.22, 0.5) : _R(0.06, 0.2), ry:_R(0, 6.28), tilt:_R(-0.3, 0.3) }); } } } }
  lists.forEach((per, K) => per.forEach((L, gi) => { if(!L.length) return; const im = new THREE.InstancedMesh(set.small[gi], set.mat, L.length); im.castShadow = K === 1 && !MOBILE; im.receiveShadow = true;
    L.forEach((o, j) => { _E.set(o.tilt, o.ry, o.tilt * 0.5); _M.compose(_V.set(o.x, heightAt(o.x, o.z) + o.r * 0.18, o.z), _Q.setFromEuler(_E), _S.set(o.r, o.r * _R(0.6, 1), o.r)); im.setMatrixAt(j, _M);
      crushables.push({ x:o.x, z:o.z, r:o.r, im, k:j, alive:true, kind:'rock', ry:o.ry }); });
    im.computeBoundingSphere(); decorGroup.add(im); realStones(im, gi + K, bn); }));
  const tot = T.paths.reduce((a, P) => a + P.len, 0), th = (bz.thin || 1) * (MOBILE ? 0.35 : 1); if(!bz.tone || !tot) return;
  const pick = () => { let r = Math.random() * tot; for(const P of T.paths){ r -= P.len; if(r <= 0) return P; } return T.paths[T.paths.length - 1]; };
  const spot = (u0, u1, crown) => () => { const P = pick(), i = 1 + ((Math.random() * (P.pts.length - 2)) | 0), [x, z] = P.pts[i], [nx, nz] = trailNormal(P.pts, i);
    const u = crown ? _R(-0.1, 0.1) * P.w : (Math.random() < 0.5 ? -1 : 1) * (P.w / 2 + _R(u0, u1)), px = x + nx * u, pz = z + nz * u; return !crown && onTrail(px, pz) === 2 ? null : [px, pz]; };
  plantFlora(grass(bz.tone).slice(0, 3), Math.round(tot * 2 * C.verge[MOBILE ? 1 : 0] * (bz.thin || 1)), { s:[0.75, 1.3], near:spot(0.05, 1.8), shadow:false, cr:0.5 });
  if(bz.mid > 0.4) plantFlora(grass(bz.tone).slice(0, 1), Math.round(tot * 0.3 * th), { s:[0.4, 0.65], near:spot(0, 0, true), shadow:false, cr:0.4 });   // the grassy crown of a two-track lane
  if(bz.bush) plantFlora(bushes(bz.bush === 'dry'), Math.round(tot * 2 * C.bush[MOBILE ? 1 : 0]), { s:[0.6, 1.1], near:spot(1.8, 4.2), shadow:false });
  }
