// world/iceberg.js — Z462 THE ICEBERG CITADELS (FORTHILL.biomes.ARCTIC.berg): the arctic's capital, and the fort with the most room round it, stand
//   cut off on great icebergs — a flat snow-crowned top the fort fills, sheer ice walls all round, crevasses split into their edges, open water between
//   the berg and the land (a lagoon inside the island's rim: the carve fades out before the fence), floes adrift in it. Taller shards of the same ice
//   stand on the berg's lip and out in the water, and photographed ice faces front its cliffs. The one way over is a rope suspension bridge from a
//   snow ramp on the shore to the berg's lip by the gate — its sagging plank deck walkable (RIVER.bridges, rope: heightAt reads the curve), the way
//   the field's tracks and the enemy's way round the water (world/river.js navGrid) both take.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA, CLIMBS, HF, MOBILE, RIVER, ZONES, _R, blocks, campMats, crushables, depthTex, fieldDepth, heightAt, propTex, scene, sceneDims, scenePiece } from '../hub.js';

export const BERGS = [];   // { f, x, z, top, bed, rim(a), moat(a), ga, span } one per fort set on a berg
const ICE = { meshes:[] }, _Z = new THREE.Matrix4().makeScale(0, 0, 0);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rag = (a, s) => Math.sin(a * 3 + s) * 0.5 + Math.sin(a * 7 + s * 2.3) * 0.3 + Math.sin(a * 13 + s * 0.7) * 0.2;
const dA = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function clearBergs(){ for(const m of ICE.meshes){ if(m.parent) m.parent.remove(m); m.traverse(o => { if(o.geometry && o.userData.own) o.geometry.dispose(); }); } ICE.meshes.length = 0; BERGS.length = 0; }

// the land: each chosen fort's berg raised, its moat cut, its cracks split, the shore's ramp heaped, the span laid (called by raiseFortHills once its hills are up)
export function raiseBergs(forts, C){ const B = C.berg; if(!B) return; const W = HF.W, h = HF.h, st = HF.step;
  const room = f => fieldDepth(f.x, f.z) - f.R * 1.1 - B.rim - B.rag + B.back, sp = ARENA * 0.55, L = C.land || {}, cl = L.clear || [0, 0];   // (its back may run out past the fence, over the island's edge, so far)
  const clear = (x, z) => sm(cl[0], cl[1], Math.hypot(x, z)) * sm(14, 26, Math.hypot(x, z - sp));   // (our compound and the spawn: the water stops short of them)
  const shore = f => { const ga = Math.atan2(ARENA * 0.55 - f.z, -f.x), d = f.R * 1.1 + B.rim + B.sheer + B.moat[1] + B.pad; let q = 1;   // (the water before its gate, the landing and the ramp's start all clear of our ground)
    for(const s of [d - B.moat[1], d, d + B.pad + 6]){ const x = f.x + Math.cos(ga) * s, z = f.z + Math.sin(ga) * s; q = Math.min(q, clear(x, z) * sm(4, 10, fieldDepth(x, z))); } return q; };
  const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) > (a.R + b.R) * 1.1 + 2 * (B.rim + B.rag + B.sheer) + B.moat[1] + B.bank, pick = [];   // (one berg's moat never cuts into the other's lip)
  for(const f of forts.filter(f => room(f) > 0 && shore(f) > 0.9).sort((a, b) => (b.tier === 3) - (a.tier === 3) || room(b) - room(a))) if(pick.length < (MOBILE ? 1 : B.n) && pick.every(p => apart(p, f))) pick.push(f);
  for(const f of pick){ const s2 = Math.random() * 9, ga = Math.atan2(ARENA * 0.55 - f.z, -f.x), ux = Math.cos(ga), uz = Math.sin(ga);
    let sum = 0, n = 0; for(let a = 0; a < 6.28; a += 0.4) for(const r of [0, f.R * 0.5, f.R]){ sum += heightAt(f.x + Math.cos(a) * r, f.z + Math.sin(a) * r); n++; }
    const base = sum / n, top = base + B.top, bed = RIVER.y + B.bed, rim = a => f.R * 1.1 + B.rim + B.rag * rag(a, s2), moat = a => B.moat[0] + (B.moat[1] - B.moat[0]) * (0.5 + 0.5 * Math.sin(a * 2 + s2));
    const cracks = []; for(let t = 0, k = (B.cracks[0] + Math.random() * (B.cracks[1] - B.cracks[0] + 1)) | 0; t < 40 && cracks.length < k; t++){ const a = Math.random() * 6.283;
      if(Math.abs(dA(a, ga)) > 0.7 && !cracks.some(c => Math.abs(dA(a, c.a)) < 0.5)) cracks.push({ a, L:_R(B.crack.L[0], B.crack.L[1]), w:_R(B.crack.w[0], B.crack.w[1]) }); }
    const dL = rim(ga) + B.sheer + moat(ga), Hl = B.top - B.land, Lr = Hl / B.ramp, pd = B.pad, Lc = [f.x + ux * (dL + pd), f.z + uz * (dL + pd)];   // the landing: a snow knoll pd m round, Hl up, on the shore across from the gate
    let V = null; for(const sd of [1, -1]){ const vx = -uz * sd, vz = ux * sd; let q = 1; for(let s = pd; s <= pd + Lr; s += 3){ const x = Lc[0] + vx * s, z = Lc[1] + vz * s; q = Math.min(q, clear(x, z) * sm(2, 8, fieldDepth(x, z))); } if(!V || q > V.q) V = { q, vx, vz }; }   // the ramp down from it runs along the shore, to the side with more open field (never at our compound or the spawn)
    const Rt = f.R * 1.1 + B.rim + B.rag + B.sheer + B.moat[1] + B.bank + 2, P = pd + 1.5 + B.side + 2, Le = [Lc[0] + V.vx * (pd + Lr), Lc[1] + V.vz * (pd + Lr)];   // the cells worked: the berg's ring, and the landing with its ramp wherever they reach
    const xs = [f.x - Rt, f.x + Rt, Lc[0] - P, Lc[0] + P, Le[0] - P, Le[0] + P], zs = [f.z - Rt, f.z + Rt, Lc[1] - P, Lc[1] + P, Le[1] - P, Le[1] + P];
    const i0 = Math.max(0, Math.floor((Math.min(...xs) + ARENA) / st)), i1 = Math.min(HF.N, Math.ceil((Math.max(...xs) + ARENA) / st)), j0 = Math.max(0, Math.floor((Math.min(...zs) + ARENA) / st)), j1 = Math.min(HF.N, Math.ceil((Math.max(...zs) + ARENA) / st));
    const onRamp = (x, z) => { const s = Math.max(0, Math.min(pd + Lr, (x - Lc[0]) * V.vx + (z - Lc[1]) * V.vz)); return Math.hypot(x - Lc[0] - V.vx * s, z - Lc[1] - V.vz * s) < P; };
    for(const c of crushables) if(c.alive && c.im && (Math.hypot(c.x - f.x, c.z - f.z) < Rt || onRamp(c.x, c.z))){ c.im.setMatrixAt(c.k, _Z); c.im.instanceMatrix.needsUpdate = true; c.alive = false; }   // (the loose stones and tufts of the old ground)
    for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const x = -ARENA + i * st, z = -ARENA + j * st, dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx), k = j * W + i, h0 = h[k];
      const rr = rim(a), mw = moat(a); let t;
      if(d < rr + B.sheer){ t = d < rr ? top : top + (bed - top) * sm(rr, rr + B.sheer, d);
        for(const c of cracks){ const q = Math.max(0, rr - d), lat = Math.abs(d * Math.sin(dA(a, c.a))), w = c.w * (1 - q / c.L); if(q < c.L && lat < w && Math.cos(dA(a, c.a)) > 0) t = Math.min(t, bed + (top - bed) * Math.max(q / c.L, lat / w)); } }   // a crevasse: a V split down to the water through the lip, closing inward
      else if(d < rr + B.sheer + mw) t = bed;
      else { const u = (d - rr - B.sheer - mw) / B.bank; t = u >= 1 ? h0 : bed + (h0 - bed) * sm(0, 1, u); }
      if(d >= rr + B.sheer){ const lx = x - Lc[0], lz = z - Lc[1], s = lx * V.vx + lz * V.vz, w = Math.abs(lz * V.vx - lx * V.vz), ll = Math.hypot(lx, lz) || 1, knoll = 1 - sm(pd, pd + 1.5 + B.side * sm(-0.3, 0.3, (lx * ux + lz * uz) / ll), ll);   // (a sheer bank over the water, the field's side sloping)
        const rp = s > 0 ? Math.max(0, 1 - Math.max(0, s - pd) / Lr) * (1 - sm(B.rampW, B.rampW + B.side, w)) : 0, k2 = Math.max(knoll, rp); if(k2 > 0) t = Math.max(t, base + Hl * k2); }
      const fk = d < rr ? 1 : sm(B.fence[0], B.fence[1], fieldDepth(x, z)) * clear(x, z); h[k] = h0 + (t - h0) * fk; }   // (the water stops short of the fence: behind, the berg's wall drops to the island's rim)
    HF.dj0 = Math.min(HF.dj0 ?? 1e9, j0 - 1); HF.dj1 = Math.max(HF.dj1 ?? -1, j1 + 1); HF.dirty = true;
    const Z = ZONES.find(q => q.fort === f); if(Z) Z.r = Math.max(Z.r, f.R * 1.1 + B.rim + B.rag + B.sheer + 2);   // (the cover, the flora and the land's set pieces keep off the berg)
    const g = { f, x:f.x, z:f.z, top, bed, rim, moat, ga, cracks, span:null, Lc, V }; BERGS.push(g); f.berg = g; span(g, B, dL, ux, uz, Lr); }
  if(BERGS.length && RIVER.mesh){ const U = RIVER.mesh.material.userData.u; if(U.uDepth.value) U.uDepth.value.dispose(); U.uDepth.value = depthTex(); } }   // (the water now lies in the moats)
// the span: from the berg's lip by the gate over the moat to the ramp's top — a sagging deck on RIVER.bridges (rope: y0 at the berg, y1 on the shore) —
//   and the way it makes for the field's tracks (CLIMBS: lip → over the span → down the ramp to its foot)
function span(g, B, dL, ux, uz, Lr){ const S = B.span, f = g.f; if(!RIVER.on) return; const ax = f.x + ux * (dL + 2), az = f.z + uz * (dL + 2), bx = f.x + ux * (g.rim(g.ga) - 0.3), bz = f.z + uz * (g.rim(g.ga) - 0.3);   // (the deck leaves the berg at its lip, level with its top)
  const hl = Math.hypot(ax - bx, az - bz) / 2, y0 = heightAt(bx, bz), y1 = heightAt(ax, az), b = { x:(ax + bx) / 2, z:(az + bz) / 2, ang:Math.atan2(uz, ux), ca:ux, sa:uz, hw:S.hw, hl, y:Math.max(y0, y1), rope:true, y0, y1, sag:Math.min(S.sag[1], hl * 2 * S.sag[0]) };
  RIVER.bridges.push(b); RIVER.top = Math.max(RIVER.top, b.y + 0.01); g.span = b;
  const pts = [], { Lc, V } = g, pd = B.pad; for(let s = g.rim(g.ga) - 3; s < dL + pd; s += 2) pts.push([f.x + ux * s, f.z + uz * s]);
  for(let s = 0; s <= pd + Lr + 2; s += 2) pts.push([Lc[0] + V.vx * s, Lc[1] + V.vz * s]);   // (over the span to the landing, then down the ramp along the shore)
  const c = { f, pts, w:S.path, foot:[Lc[0] + V.vx * (pd + Lr + 6), Lc[1] + V.vz * (pd + Lr + 6)], legs:0, grade:B.ramp }; CLIMBS.push(c); f.climb = c;
  for(let q = 0; q < pts.length; q += 3) ZONES.push({ kind:'climb', x:pts[q][0], z:pts[q][1], r:B.rampW + B.side * 0.6 }); }   // (the landing and the ramp's slopes too)

// the ice: faces along the cliffs, shards on the lip and out in the water, floes adrift, the bridge drawn (called once the land is laid, with a window)
export function dressBergs(C){ const B = C.berg; if(!B || typeof window === 'undefined') return;
  for(const g of BERGS){ const F = B.faces, near = a => Math.abs(dA(a, g.ga)) < F.gap;
    for(let a = Math.random() * 6.283, a1 = a + 6.283; a < a1;){ const key = F.keys[(Math.random() * F.keys.length) | 0], D = sceneDims(key), Hh = (g.top - g.bed + _R(F.lip[0], F.lip[1])) / (1 - F.sink), sc = Hh / D.y, wide = D.x * sc;
      const kx = Math.min(1, (Math.abs(dA(a, g.ga)) * g.rim(a) - B.span.hw - 1.5) * 2 / wide); if(near(a) || kx * wide < F.minW){ a += 0.04; continue; }   // (by the bridge narrowed to stop short of its lane)
      const cr = g.cracks.find(c => Math.abs(dA(c.a, a)) < wide * 0.4 / g.rim(a) + c.w / g.rim(a)); if(cr){ a = Math.max(a + 0.04, a + dA(cr.a, a) + (cr.w * 1.3 + wide * 0.3) / g.rim(a)); continue; }   // (the crevasses left open: a dark split between the faces)
      const o = _R(F.o[0], F.o[1]), rr = g.rim(a) + o, x = g.x + Math.cos(a) * rr, z = g.z + Math.sin(a) * rr, m = put(key, sc, x, g.bed - Hh * F.sink, z, -a + Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0) + _R(-0.15, 0.15));
      m.scale.set(sc * kx, sc, sc * F.deep); blocks.push({ mesh:new THREE.Object3D(), x, z, r:Math.min(D.x * kx, D.z * F.deep) * sc * 0.4, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); a += wide * kx * F.overlap / rr * (MOBILE ? 1.5 : 1); }
    const P = B.shards, tall = (a, d, Hs) => { const key = P.keys[(Math.random() * P.keys.length) | 0], D = sceneDims(key), x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d, sc = (Hs + 1.5) / D.y, thin = P.thin[key] || 0.4;
      const m = put(key, sc, x, g.top - 1.5, z, Math.random() * 6.283); m.scale.set(sc * thin, sc, sc * thin); blocks.push({ mesh:new THREE.Object3D(), x, z, r:Math.min(D.x, D.z) * sc * thin * 0.42, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'shard' }); };
    for(const c of g.cracks) for(const s of [-1, 1]) tall(c.a + s * (c.w + 2.2) / g.rim(c.a), g.rim(c.a) - _R(0.5, 2), _R(P.h[0], P.h[1]) * _R(0.8, 1.15));   // (the split flanked by its two broken pillars)
    for(let t = 0, n = 0, cap = Math.round(P.n * (MOBILE ? 0.5 : 1)); t < cap * 8 && n < cap; t++){ const a = Math.random() * 6.283; if(Math.abs(dA(a, g.ga)) < P.gap) continue;
      const lip = Math.random() < P.lip, d = lip ? g.rim(a) - _R(0, 2.5) : g.rim(a) + B.sheer + _R(2, g.moat(a) * 0.6), x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d, key = P.keys[(Math.random() * P.keys.length) | 0], D = sceneDims(key);
      if(blocks.some(b => b.kind === 'shard' && Math.hypot(b.x - x, b.z - z) < b.r + 3)) continue; const Hs = _R(P.h[0], P.h[1]) * (lip ? 1 : 0.8), y0 = lip ? g.top - 1.5 : g.bed, sc = (Hs + g.top - y0) / D.y, thin = P.thin[key] || 0.4;
      const m = put(key, sc, x, y0, z, Math.random() * 6.283); m.scale.set(sc * thin, sc, sc * thin); m.rotation.set(_R(-0.06, 0.06), m.rotation.y, _R(-0.06, 0.06));
      blocks.push({ mesh:new THREE.Object3D(), x, z, r:Math.min(D.x, D.z) * sc * thin * 0.42, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'shard' }); n++; }
    const Fl = B.floes; for(let n = 0, cap = Math.round(Fl.n * (MOBILE ? 0.5 : 1)); n < cap; n++){ const a = Math.random() * 6.283, d = g.rim(a) + B.sheer + _R(1.5, g.moat(a) - 2), key = Fl.keys[(Math.random() * Fl.keys.length) | 0], D = sceneDims(key), w = _R(Fl.w[0], Fl.w[1]), sc = w / D.x;
      if(fieldDepth(g.x + Math.cos(a) * d, g.z + Math.sin(a) * d) < 8) continue; const m = put(key, sc, g.x + Math.cos(a) * d, RIVER.y - D.y * sc * Fl.sink, g.z + Math.sin(a) * d, Math.random() * 6.283); m.scale.set(sc, sc * Fl.flat, sc); }
    if(g.Lc){ const ux = Math.cos(g.ga), uz = Math.sin(g.ga), flank = (key, cx, cz, Hk, w) => { const D = sceneDims(key), sc = Hk / D.y, kx = w / (D.x * sc);   // ice either side of the bridge's ends: the landing's face to the moat, the berg's lip
        for(const s of [-1, 1]){ const off = B.span.hw + 1.2 + w / 2, m = put(key, sc, cx - uz * s * off, g.bed - 0.5, cz + ux * s * off, Math.atan2(-ux, -uz) + (s < 0 ? Math.PI : 0)); m.scale.set(sc * kx, sc, sc * F.deep); } };
      flank('ice_block', g.Lc[0] - ux * (B.pad + 0.8), g.Lc[1] - uz * (B.pad + 0.8), heightAt(g.Lc[0], g.Lc[1]) - g.bed + 1, 9);
      const rl = g.rim(g.ga) + 1.6; flank('ice_serac', g.x + ux * rl, g.z + uz * rl, g.top - g.bed + 1.6, 7); }
    if(g.span) ropeBridge(g.span, B.span); } }
const dull = (lv, m) => m.traverse(q => { const M = q.isMesh && q.material; if(M && M.emissiveMap){ M.emissiveMap = null; M.emissive.setRGB(0, 0, 0); M.needsUpdate = true; } });   // (the ice scans' glow maps: ice gives no light)
function put(key, sc, x, y, z, ry){ const m = scenePiece(key, sc, { shadow:!MOBILE, onLevel:dull }); m.scale.setScalar(sc); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); ICE.meshes.push(m); return m; }

// the rope bridge: planks across a sagging pair of deck ropes (the walkable curve's surface), hand ropes above them hung less slack, hangers between,
//   a pair of timber posts at each end with their backstays pegged into the snow
export function ropeBridge(b, S){ const M = campMats(), wood = new THREE.MeshStandardMaterial({ map:propTex('wood'), color:0x8a6a44, roughness:0.92 }), Wd = [], Rp = [], yaw = Math.atan2(b.ca, b.sa);
  const at = (u, ac = 0, up = 0) => { const al = -b.hl + 2 * b.hl * u; return new THREE.Vector3(b.x + b.ca * al - b.sa * ac, b.y0 + (b.y1 - b.y0) * u - b.sag * 4 * u * (1 - u) + up, b.z + b.sa * al + b.ca * ac); };
  const n = Math.round(b.hl * 2 / S.plank); for(let k = 0; k < n; k++){ const u = (k + 0.5) / n; if(Math.random() < S.gaps) continue; const P = at(u), pitch = Math.atan(((b.y1 - b.y0) - b.sag * 4 * (1 - 2 * u)) / (2 * b.hl));
    const pl = new THREE.BoxGeometry(b.hw * 2 * _R(0.94, 1.02), 0.08, S.plank * 0.82); pl.rotateX(-pitch + _R(-0.03, 0.03)); pl.rotateY(yaw + _R(-0.03, 0.03)); pl.translate(P.x, P.y - 0.04, P.z); Wd.push(pl); }
  const rope = (pts, r) => Rp.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 5));
  for(const sd of [-1, 1]){ const ac = sd * (b.hw - 0.08), deck = [], hand = []; for(let k = 0; k <= 16; k++){ const u = k / 16; deck.push(at(u, ac, -0.1)); hand.push(at(u, ac, S.rail + b.sag * 0.55 * 4 * u * (1 - u))); }
    rope(deck, 0.055); rope(hand, 0.04); for(let k = 1; k < 16; k++){ const lo = deck[k], hi = hand[k], hg = new THREE.CylinderGeometry(0.014, 0.014, hi.y - lo.y, 3); hg.translate(lo.x, (lo.y + hi.y) / 2, lo.z); Rp.push(hg); }
    for(const [u, out] of [[0, -1], [1, 1]]){ const P = at(u, sd * (b.hw + 0.2)), gy = heightAt(P.x, P.z), post = new THREE.CylinderGeometry(0.13, 0.17, S.post + 0.6, 7); post.translate(P.x, gy + (S.post + 0.6) / 2 - 0.6, P.z); Wd.push(post);
      const tx = P.x + b.ca * out * 3.2, tz = P.z + b.sa * out * 3.2; rope([new THREE.Vector3(P.x, gy + S.post - 0.15, P.z), new THREE.Vector3((P.x + tx) / 2, (gy + S.post + heightAt(tx, tz)) / 2 - 0.25, (P.z + tz) / 2), new THREE.Vector3(tx, heightAt(tx, tz) + 0.1, tz)], 0.035);
      const stake = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5); stake.translate(tx, heightAt(tx, tz) + 0.2, tz); Wd.push(stake); } }
  const g = new THREE.Group(); for(const [arr, mat] of [[Wd, wood], [Rp, M.rope]]){ const geo = mergeGeometries(arr.map(q => q.index ? q.toNonIndexed() : q)); arr.forEach(q => q.dispose()); const me = new THREE.Mesh(geo, mat); me.userData.own = true; me.castShadow = me.receiveShadow = true; g.add(me); }
  scene.add(g); ICE.meshes.push(g); return g; }
