// actors/gun-fit.js — Z360 THE HOLD READ OFF THE GUN ITSELF: no common template — every hand weapon's model is measured once when it loads, and the
//   numbers the soldier holds it by (config GUNHOLD: where the right hand closes, where the left palm lies, the butt in the shoulder, the sight line for the
//   cheek, the muzzle the rounds leave from) are worked out from its own shape and the reach of his arms:
//   · its SIDE PROFILE in the hold frame (x = share of its length, −0.5 the muzzle … +0.5 the butt; y metres): the bottom and top of each slice
//   · the BORE: the barrel at the muzzle — its underside plus half of it (never more than a barrel's thickness: a front sight does not lift it)
//   · what hangs DEEPER than GUNFIT.depth under the bore, slice after slice: the rearmost is the PISTOL GRIP (its front trimmed to where it is properly
//     deep), the deepest in front of it the MAGAZINE, a narrow one in front of that a VERTICAL FOREGRIP
//   · the RIGHT HAND: at the grip's front edge (just behind the trigger guard), down most of its depth
//   · the LEFT PALM: right behind a foregrip if it has one, else on the handguard ahead of the magazine; and how far back along the handguard it may
//     slide (`slideTo`: a palm's half-width short of the magazine, or two clear of the right hand) when a soldier's arm is too short for its spot — the
//     soldier's side of it (his own arm, this stance, this aim) is worked out as he holds it (actors/real-cav.js palmFit), not fixed here
//   · the BUTT: its end, GUNFIT.boreUp under the bore (every gun's sight line at the same height over his shoulder), inside its pad; the SIGHT: the
//     highest point over the receiver (optic or rear sight)
//   · the RELOAD: the left hand takes the magazine at its lower middle (a gun without one: its loading port ahead of the trigger guard), racks the bolt on
//     the receiver between the magazine and the grip (without a magazine: the pump / forend under the palm); only a magazine drops, sized as it hangs
//   · the RECOIL of every hand weapon, fitted or not (gunRecoil): the round's push (damage × pellets × kickK, the carbine's = 1) over the gun's weight
//     (∝ its length², the carbine's = 1), eased by a power — the kick straight back and the muzzle's climb, and a random shake (a twitch aside, a roll)
//   Checked against the hand-tuned carbine: it gives its numbers back within a centimetre. A weapon flagged fit:true in INFGUN.guns is held by these.
import * as THREE from 'three';
import { GUNFIT, GUNHOLD } from '../../config.js';

export const FIT = {}, GUNKICK = {};
// Z360 the recoil a hand weapon is worked out to (gun = its GUNS entry, len = its true length, m): { kick:[back m, climb rad], shake:[aside rad, roll rad], s }
export function gunRecoil(gun, len){ const K = GUNFIT.recoil, E = ((gun && gun.dmg) || K.dmg) * ((gun && gun.frags) || 1) / K.dmg * ((gun && gun.kickK) || 1), m = (len / K.ref) ** 2;
  const s = Math.max(K.s[0], Math.min(K.s[1], (E / m) ** K.pow)), r3 = v => +v.toFixed(4); return { kick:[r3(K.back * s), r3(K.climb * s)], shake:[r3(K.yaw * s), r3(K.roll * s)], s:+s.toFixed(2) }; }
// the side profile of a model already placed in the hold frame (root = the hold group: metres, muzzle −X): each slice's lowest and highest point. Its
//   corners and the points along its edges are counted (a long flat face has corners only at its ends: the slices between would come out empty). Each part's
//   matrix is worked out here from its own position / turn / scale, not read off matrixWorld: render/renderer.js skips hidden things when it updates those,
//   and a weapon is measured hidden, as it loads
const _M = () => new THREE.Matrix4();
export function sideProfile(root, len, N = 40){ const rows = [], step = len / N / 2;
  for(let k = 0; k < N; k++) rows.push({ x:-0.5 + (k + 0.5) / N, lo:null, hi:null });
  const put = (x, y) => { const r = rows[Math.min(N - 1, Math.max(0, Math.floor((x / len + 0.5) * N)))]; r.lo = r.lo == null ? y : Math.min(r.lo, y); r.hi = r.hi == null ? y : Math.max(r.hi, y); };
  const add = (o, M) => { const P = o.geometry.attributes.position, I = o.geometry.index, X = new Float32Array(P.count), Y = new Float32Array(P.count);
    for(let i = 0; i < P.count; i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i); X[i] = M[0] * x + M[4] * y + M[8] * z + M[12]; Y[i] = M[1] * x + M[5] * y + M[9] * z + M[13]; put(X[i], Y[i]); }
    const e = (a, b) => { const dx = X[b] - X[a], k = Math.ceil(Math.abs(dx) / step); for(let j = 1; j < k; j++) put(X[a] + dx * j / k, Y[a] + (Y[b] - Y[a]) * j / k); };
    const n = I ? I.count : P.count, at = t => (I ? I.getX(t) : t); for(let t = 0; t + 2 < n; t += 3){ const a = at(t), b = at(t + 1), c = at(t + 2); e(a, b); e(b, c); e(c, a); } };
  const walk = (o, M) => { for(const c of o.children){ if(c.visible === false) continue; if(c.matrixAutoUpdate) c.updateMatrix(); const W = _M().multiplyMatrices(M, c.matrix); if(c.isMesh) add(c, W.elements); walk(c, W); } };
  walk(root, _M()); return rows; }
// the hold from the profile (o.gun = the gun's GUNS entry, for its recoil). Lengths in GUNFIT are metres: the same hand on a short gun and a long one
export function fitHold(rows, len, o = {}){ const F = GUNFIT, has = r => r.lo != null, R = rows.filter(has), N = rows.length, S = len / N; if(R.length < 6) return null;
  const front = R.slice(0, 2), bore = front.reduce((s, r) => s + r.lo + Math.min(r.hi - r.lo, F.barrel) / 2, 0) / front.length, d = rows.map(r => (has(r) ? bore - r.lo : 0));
  // the parts hanging under the bore: runs of slices deeper than F.depth (behind the muzzle end), each split where it comes back up toward the receiver
  //   between two deeper hangs (F.split: at least [0] shallower than both, and no deeper than depth + [1]); narrower than F.minW is a swivel, not a part
  const max = (a, b) => { let m = 0; for(let i = a; i <= b; i++) m = Math.max(m, d[i]); return m; }, runs = []; let cur = null;
  for(let i = 0; i < N; i++){ if(has(rows[i]) && rows[i].x > F.front && d[i] > F.depth){ if(!cur) runs.push(cur = [i, i]); cur[1] = i; } else cur = null; }
  const split = ([a, b]) => { let at = -1; for(let i = a + 1; i < b; i++) if(d[i] <= Math.min(max(a, i - 1), max(i + 1, b)) - F.split[0] && d[i] <= F.depth + F.split[1] && (at < 0 || d[i] < d[at])) at = i;
    return at < 0 ? [[a, b]] : [...split([a, at - 1]), ...split([at + 1, b])]; };
  const parts = runs.flatMap(split).filter(([a, b]) => (b - a + 1) * S >= F.minW).map(([a, b]) => ({ a:rows[a].x, b:rows[b].x, i:a, j:b, d:max(a, b) }));
  // the one that runs out to the butt is the stock; the rearmost other is the PISTOL GRIP (its front edge where it is firm × its full depth)
  const stock = parts.length > 1 && parts[parts.length - 1].j >= N - 2 ? parts.pop() : null; if(!parts.length) return null;
  const grip = parts[parts.length - 1], ahead = parts.slice(0, -1); for(let i = grip.i; i <= grip.j; i++) if(d[i] >= grip.d * F.firm){ grip.a = rows[i].x; break; }
  // the MAGAZINE: the nearest hang in front of the grip; a FOREGRIP: the nearest narrow one in front of that, within F.vfgReach of it (further is a bipod)
  const mag = ahead.length ? ahead[ahead.length - 1] : null, vfg = mag ? ahead.slice(0, -1).reverse().find(p => (p.b - p.a) * len <= F.vfgW && (mag.a - p.b) * len <= F.vfgReach) || null : null;
  const gx = grip.a - F.gripAhead / len, gy = bore - F.gripDown * grip.d;
  const slideTo = (mag ? mag.a : gx - 2 * F.hand / len) - F.hand / len, px = Math.min(vfg ? vfg.b + F.vfgBehind / len : mag ? mag.a - F.palmAhead / len : gx - F.noMag / len, slideTo);
  // the reload: the magazine taken at its lower middle (or the loading port), the bolt racked between it and the grip (or the pump under the palm)
  const magAt = mag ? [(mag.a + mag.b) / 2, bore - 0.6 * mag.d] : [gx - F.loadPort / len, bore - 0.05], boltAt = mag ? [(mag.b + grip.a) / 2, bore + 0.02] : null;
  const last = R[R.length - 1]; let sx = F.sight[0], sh = -Infinity; for(const r of R) if(r.x >= F.sight[0] && r.x <= F.sight[1] && r.hi > sh){ sh = r.hi; sx = r.x; }
  const r3 = v => +v.toFixed(3), span = p => p && [r3(p.a), r3(p.b)], rc = gunRecoil(o.gun, len);
  const out = { palm:r3(px), slideTo:r3(slideTo), grip:[r3(gx), r3(gy)], fore:[r3(px), -0.04], butt:[0.5, r3(Math.min(last.hi - 0.02, Math.max(last.lo + 0.02, bore - F.boreUp)))], sightX:r3(sx), kick:rc.kick, shake:rc.shake,
    mag:magAt.map(r3), bolt:boltAt ? boltAt.map(r3) : null, magDrop:!!mag, magSize:mag ? r3(mag.d) : 0, bore:r3(bore), parts:{ grip:span(grip), mag:span(mag), vfg:span(vfg), stock:span(stock) },
    rows:rows.map(r => (has(r) ? [r3(r.lo), r3(r.hi)] : null)) };
  if(!out.bolt) out.bolt = [out.palm, r3(underAt(out, out.palm) - GUNHOLD.palmGap)]; return out; }
// the gun's underside at x (share of its length) off its profile, between slices; never lower than a grip or a magazine would hang (the palm stays on the handguard)
export function underAt(f, x){ const N = f.rows.length, t = (x + 0.5) * N - 0.5, i = Math.max(0, Math.min(N - 2, Math.floor(t))), u = Math.max(0, Math.min(1, t - i));
  const a = f.rows[i], b = f.rows[i + 1], lo = a && b ? a[0] + (b[0] - a[0]) * u : (a || b || [f.bore - 0.03])[0]; return Math.max(lo, f.bore - GUNFIT.depth); }
