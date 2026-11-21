// combat/solid-line.js — Z380 NOTHING GOES THROUGH A WALL: a round was tested against the obstacles only where it stood at the end of each frame, so a
//   fast one (a guard's or an MG's at 72–90 m/s moves 1.2–1.5 m a frame) stepped clean over a brick wall or a ruin's wall 0.6 m thick, and a house or
//   a city block (kept as rows of circles, all but the first 2 m high) let a round from a tower through its upper floors. Here: the first solid thing a
//   straight stretch meets — tested along the whole stretch against each obstacle's true footprint (its box, or its circle) and its true height — for the
//   rounds in flight (combat/lock-on.js) and for an enemy's eye looking for the soldier (game/stealth.js): nobody sees, or shoots, through a wall.
import { blockTop, blocksNear, solidShape } from '../hub.js';

const _near = [], _seen = new Set();
// where a body of radius pad going a → b first touches the footprint of block bl: the share of the way (0…1), its way out, or null if it does not
//   (Z378 a fortress section cut back from a breach: its stone only — a round, like a man, goes through the breach)
export function segBlock(bl, ax, az, bx, bz, pad, out){ const S = solidShape(bl, true); let t0 = 0, t1 = 1;
  if(S){ const o = S.obb, s = Math.sin(o.f), c = Math.cos(o.f), dx = ax - S.x, dz = az - S.z, ex = bx - ax, ez = bz - az;
    for(const [p0, d, h] of [[dx * s + dz * c, ex * s + ez * c, o.hl + pad], [dx * c - dz * s, ex * c - ez * s, o.hw + pad]]){   // along · across: clip to each slab
      if(Math.abs(d) < 1e-9){ if(Math.abs(p0) > h) return null; continue; }
      let e0 = (-h - p0) / d, e1 = (h - p0) / d; if(e0 > e1){ const q = e0; e0 = e1; e1 = q; } if(e0 > t0) t0 = e0; if(e1 < t1) t1 = e1; if(t0 > t1) return null; } }
  else { const R = (bl.r || 1) + pad, fx = ax - bl.x, fz = az - bl.z, ex = bx - ax, ez = bz - az, A = ex * ex + ez * ez, B = 2 * (fx * ex + fz * ez), C = fx * fx + fz * fz - R * R;
    if(A < 1e-12){ if(C > 0) return null; } else { const D = B * B - 4 * A * C; if(D < 0) return null; const q = Math.sqrt(D); t0 = Math.max(0, (-B - q) / (2 * A)); t1 = Math.min(1, (-B + q) / (2 * A)); if(t0 > t1) return null; } }
  out.t0 = t0; out.t1 = t1; return out; }
// is (x, z) inside block bl's footprint (its true box, or its circle)
export function inShape(bl, x, z){ const S = solidShape(bl, true); if(S){ const o = S.obb, s = Math.sin(o.f), c = Math.cos(o.f), dx = x - S.x, dz = z - S.z; return Math.abs(dx * s + dz * c) < o.hl && Math.abs(dx * c - dz * s) < o.hw; }
  const dx = x - bl.x, dz = z - bl.z, r = bl.r || 1; return dx * dx + dz * dz < r * r; }
// the obstacles whose footprint may come near the stretch a → b (each once; a wall section's or a building's box reaches well past its circle)
export function blocksAlong(ax, az, bx, bz, pad, out){ out.length = 0; _seen.clear(); const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 4));
  for(let k = 0; k <= n; k++){ const f = k / n; for(const bl of blocksNear(ax + (bx - ax) * f, az + (bz - az) * f, 2.5 + pad, _near)) if(!_seen.has(bl)){ _seen.add(bl); out.push(bl); } }
  return out; }
// the first solid thing on the straight line from (ax, ay, az) to (bx, by, bz) (world heights) for a body of radius pad: { bl, t } or null.
//   It counts where the line runs through the footprint lower than the top (+ over); skip(bl) leaves some out (the shooter's own tower, ...)
const _hit = { bl:null, t:1 }, _sb = { t0:0, t1:1 }, _cand = [];
export function lineHit(ax, ay, az, bx, by, bz, pad, over, skip){ let best = null, bt = 2;
  for(const bl of blocksAlong(ax, az, bx, bz, pad, _cand)){ if(skip && skip(bl)) continue; if(!segBlock(bl, ax, az, bx, bz, pad, _sb)) continue;
    if(_sb.t0 >= bt) continue;
    const top = blockTop(bl) + (over || 0), y0 = ay + (by - ay) * _sb.t0, y1 = ay + (by - ay) * _sb.t1; if(Math.min(y0, y1) >= top) continue;   // (above it the whole way across)
    const t = y0 >= top ? _sb.t0 + (_sb.t1 - _sb.t0) * (y0 - top) / Math.max(1e-6, y0 - y1) : _sb.t0;   // (coming down onto it: where it drops below the top)
    if(t < bt){ bt = t; best = bl; } }
  if(!best) return null; _hit.bl = best; _hit.t = bt; return _hit; }
// is the line of sight from (ax, ay, az) to (bx, by, bz) open — nothing solid standing in it higher than the line (what the eye stands on or in —
//   the tower under a guard, the wall under a rifleman on its walk — and what the far end is in do not count)
let _sa = 0, _sz = 0, _sbx = 0, _sbz = 0; const _own = bl => inShape(bl, _sa, _sz) || inShape(bl, _sbx, _sbz);
export function lineClear(ax, ay, az, bx, by, bz){ _sa = ax; _sz = az; _sbx = bx; _sbz = bz; return !lineHit(ax, ay, az, bx, by, bz, 0, 0, _own); }
