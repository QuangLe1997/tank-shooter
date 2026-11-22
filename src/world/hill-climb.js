// world/hill-climb.js — Z456 THE WAY UP (FORTHILL…spur.path): the capital's crag is sheer all round but for a narrow tongue toward its gate, and
//   up that tongue one track winds in hairpins — a level shelf cut into the slope, a bank above it and a drop below — from the foot to the plateau's
//   rim (world/trails.js then lays it as the fort's road, on to the gate, and routes the field's tracks to its foot). Legs cross the tongue
//   corner to corner, narrower toward the top; as many as keep the grade under `grade`; the hairpins rounded.
import { ARENA, HF, ZONES, heightAt } from '../hub.js';

export const CLIMBS = [];   // { f, pts:[[x, z]…] rim → foot every 2 m, w, foot:[x, z] (where the field's tracks meet it), legs, grade }
export const onClimb = (x, z, r = 0) => CLIMBS.some(C => C.pts.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < (C.w / 2 + 1 + r) ** 2));
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function chaikin(P, n){ for(let r = 0; r < n; r++){ const Q = [P[0]]; for(let i = 0; i < P.length - 1; i++){ const [a, b] = [P[i], P[i + 1]];
      Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } Q.push(P[P.length - 1]); P = Q; } return P; }
function resample(P, st){ const out = [P[0].slice()]; let carry = 0;
  for(let i = 1; i < P.length; i++){ const [x0, z0] = P[i - 1], [x1, z1] = P[i], L = Math.hypot(x1 - x0, z1 - z0); let t = st - carry;
    while(t <= L){ out.push([x0 + (x1 - x0) * t / L, z0 + (z1 - z0) * t / L]); t += st; } carry = L - (t - st); }
  const e = P[P.length - 1], l = out[out.length - 1]; if(Math.hypot(e[0] - l[0], e[1] - l[1]) > st * 0.3) out.push(e.slice()); return out; }

export function clearClimbs(){ CLIMBS.length = 0; }
// cut the track up fort f's tongue: S = the spur's config, rim = the plateau's radius (m from the fort's centre), L = the tongue's length
export function carveClimb(f, S, rim, L){ const P = S.path, ga = f.hillGa, ux = Math.cos(ga), uz = Math.sin(ga), vx = -uz, vz = ux, W = HF.W, h = HF.h, st = HF.step;
  const at = (u, v) => [f.x + ux * u + vx * v, f.z + uz * u + vz * v], uR = rim - 1, uF = rim + L + P.foot, yR = heightAt(...at(uR, 0)), yF = heightAt(...at(uF, 0)), drop = yR - yF;
  const s0 = Math.random() < 0.5 ? 1 : -1, track = n => { const C = [at(uF, 0)]; for(let k = 1; k < n; k++){ const t = k / n, v = s0 * (k % 2 ? 1 : -1) * (P.W[0] + (P.W[1] - P.W[0]) * t); C.push(at(uF + (uR - uF) * t, v)); }   // (wide at the foot, narrower up the tongue)
    C.push(at(uR, 0)); const pts = resample(chaikin(C, 3), 2), sL = [0]; for(let i = 1; i < pts.length; i++) sL.push(sL[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, sL }; };
  let n = P.legs[0], T = track(n); while(n < P.legs[1] && drop / (T.sL[T.sL.length - 1] || 1) > P.grade) T = track(++n);   // more hairpins till the rounded track keeps under the grade
  const { pts, sL } = T;
  const tot = sL[sL.length - 1] || 1, y = sL.map(s => yF + drop * s / tot), half = P.w / 2 + 0.5, reach = half + P.sh;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for(const [x, z] of pts){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const i0 = Math.max(0, Math.floor((x0 - reach + ARENA) / st)), i1 = Math.min(HF.N, Math.ceil((x1 + reach + ARENA) / st)), j0 = Math.max(0, Math.floor((z0 - reach + ARENA) / st)), j1 = Math.min(HF.N, Math.ceil((z1 + reach + ARENA) / st));
  for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const x = -ARENA + i * st, z = -ARENA + j * st; let bd = Infinity, bi = 0;
    for(let q = 0; q < pts.length; q++){ const d = (pts[q][0] - x) ** 2 + (pts[q][1] - z) ** 2; if(d < bd){ bd = d; bi = q; } }
    const d = Math.sqrt(bd); if(d >= reach) continue; const k = 1 - sm(half, reach, d), o = h[j * W + i]; h[j * W + i] = o + (y[bi] - o) * k; }   // (the nearest stretch's level: a bank between one leg and the next)
  HF.dj0 = Math.min(HF.dj0 ?? 1e9, j0 - 1); HF.dj1 = Math.max(HF.dj1 ?? -1, j1 + 1); HF.dirty = true;
  for(let q = 0; q < pts.length; q += 3) ZONES.push({ kind:'climb', x:pts[q][0], z:pts[q][1], r:P.w / 2 + 2 });   // (the cover, the flora, the enemy's belt keep off it)
  const c = { f, pts:pts.slice().reverse(), w:P.w, foot:at(uF + P.foot, 0), legs:n, grade:drop / tot }; CLIMBS.push(c); f.climb = c; return c; }
