// actors/anim-lib.js — ANIM 1 THE SOLDIER'S MOTION LIBRARY: some 290 Mixamo motions (walk / run / sprint / strafe / crouch-walk eight ways, turns,
// idles, kneel, prone and the changes between them, jumps, rolls, climbs, a vault, fire / reload / grenade / knife / rifle butt, cover, hits, deaths,
// getting up, the injured set, gestures) retargeted off line to the hidden operator's skeleton by tools/mixamo-clips.mjs and packed in assets/anim:
// one binary a group (ANIMLIB.groups — loco + stance are the ones a battle wants first, the rest when asked) + index.json (id, group, source file,
// seconds, fps, frames, loop, speed m/s, travels …). This module only LOADS them: loadAnimGroup(g) fetches a group once, animClip(id) hands back a
// cached THREE.AnimationClip whose tracks are named as GLTFLoader names the operator's own clips ('mixamorigHips.position', 'mixamorig<Bone>.quaternion',
// 22 bones, no fingers) so one mixer plays both, animInfo(id) its index row, animRootAt(id, t, out) where a travelling clip's root is (the clips
// themselves stay on the spot: the hips keep their sway and height, the game moves the man). Nothing is fetched, decoded or run until asked, and
// nothing here runs per frame except animRootAt (no allocation). Not wired into the soldier yet — the blend graph is the next step.
//
// AN INDEX ROW (animInfo): id · g group · src the Mixamo file · dur seconds · fps · frames · loop (the last pose is the first: play it LoopRepeat;
//   otherwise LoopOnce) · travels (it has a root track: animRootAt) · speed m/s on the operator's own scale (a clip pinned in place: how fast it
//   was going — move the man that fast or his feet slide; a travelling clip: its root's path length / dur) · and, only where they apply:
//   dir [x, z] the way a pinned clip was going in the man's own frame (+z ahead, +x to his LEFT) · yaw the whole turn of its root track, degrees
//   (+ = to his left) · rise metres a cycle taken out of a climbing loop's height (raise the man that much a cycle) · tail the last n frames were
//   rebuilt by the converter to close the loop (Mixamo's file ran out of keys there).
//   The hips' height is over the ground at the operator's own scale (his feet on y = 0, as in his own clips); lying down the new clips lie
//   ~0.15 m up at the hips where his old Prone_Reload lies 0.32 m up — REALCAV's proneDrop is for the old one.
//
// THE PACKED FORMAT (little-endian; written by tools/mixamo-clips.mjs packClip, read by decodeAnimClip):
//   <group>.bin  'XKA1' · u16 clips · u16 bones · then the clips, each at index.clips[i].o, .b bytes long
//   a clip       u16 frames · u8 fps · u8 flags (1 root track, 2 loops) · VEC hips (armature-local metres) · [VEC root: x, z metres, yaw radians] · QUAT × bones
//   VEC          u16 keys · f32 min[3] · f32 step[3] · key frames (u8 each; u16 when the clip has > 256 frames) · u16[3] a key (min + step·u)
//   QUAT         u16 keys · key frames · u16[3] a key — "smallest three": the largest of x y z w is dropped (its index in the top 2 bits of the third
//                word, its sign made +), the other three as int16, int16, int14 of ±1/√2. One key alone = the bone does not move.
import * as THREE from 'three';
import { ANIMLIB } from '../../config.js';

export const ANIMLIB_READY = { index: false, groups: {}, clips: 0, failed: [] };   // what is in: groups[g] true once its file is decoded-ready
let _index = null, INDEX = null;
const BY = new Map(), BIN = {}, GROUP = {}, CLIP = new Map(), ROOT = new Map(), IDS = {}, Q1 = Math.SQRT1_2, NOROOT = { t: null, v: null };

export function loadAnimIndex(){ return _index || (_index = fetch(ANIMLIB.path + ANIMLIB.index).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))).then(J => {
    if(J.v !== ANIMLIB.version || !Array.isArray(J.clips) || !Array.isArray(J.bones)) throw new Error('index version ' + J.v);
    INDEX = J; for(const c of J.clips) BY.set(c.id, c); ANIMLIB_READY.index = true; return J;
  }).catch(e => { console.warn('[anim-lib] no index —', e && e.message); ANIMLIB_READY.failed.push('index'); return null; })); }
// one group's file, fetched and checked once → true when its clips can be asked for
export function loadAnimGroup(group){ if(!ANIMLIB.on) return Promise.resolve(false); return GROUP[group] || (GROUP[group] = loadAnimIndex().then(J => { const G = J && J.groups[group]; if(!G) throw new Error('no such group');
    return fetch(ANIMLIB.path + G.file).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error('HTTP ' + r.status))).then(buf => { const dv = new DataView(buf);
      if(buf.byteLength !== G.bytes || dv.getUint32(0, true) !== 0x31414b58 || dv.getUint16(4, true) !== G.clips || dv.getUint16(6, true) !== J.bones.length) throw new Error('file does not match the index (a stale copy?)');
      BIN[group] = dv; ANIMLIB_READY.groups[group] = true; ANIMLIB_READY.clips += G.clips; if(ANIMLIB.decode.eager) for(const c of J.clips) if(c.g === group) animClip(c.id); return true; });
  }).catch(e => { console.warn('[anim-lib]', group, 'not loaded —', e && e.message); ANIMLIB_READY.failed.push(group); return false; })); }
export const preloadAnimLib = () => Promise.all(ANIMLIB.preload.map(loadAnimGroup));   // the groups a battle wants from its first second
export const animInfo = id => BY.get(id) || null;                                       // the index row: { id, g, src, dur, fps, frames, loop, speed, travels, dir?, yaw?, rise?, tail? }
export function animIds(group){ return IDS[group] || (IDS[group] = INDEX ? INDEX.clips.filter(c => !group || c.g === group).map(c => c.id) : []); }

// the bytes of one clip → key times (seconds) and values, as three's tracks want them
export function decodeAnimClip(dv, o, bones){ const N = dv.getUint16(o, true), fps = dv.getUint8(o + 2), flags = dv.getUint8(o + 3), wide = N > 256; o += 4;
  const times = n => { const t = new Float32Array(n); for(let i = 0; i < n; i++) t[i] = (wide ? dv.getUint16(o + i * 2, true) : dv.getUint8(o + i)) / fps; o += wide ? n * 2 : n; return t; };
  const vec = () => { const n = dv.getUint16(o, true), m = o + 2; o += 26; const t = times(n), v = new Float32Array(n * 3);
    for(let c = 0; c < 3; c++){ const mn = dv.getFloat32(m + c * 4, true), st = dv.getFloat32(m + 12 + c * 4, true); for(let i = 0; i < n; i++) v[i * 3 + c] = mn + st * dv.getUint16(o + (i * 3 + c) * 2, true); } o += n * 6; return { t, v }; };
  const quat = () => { const n = dv.getUint16(o, true); o += 2; const t = times(n), v = new Float32Array(n * 4);
    for(let i = 0; i < n; i++, o += 6){ const w2 = dv.getUint16(o + 4, true), m = w2 >> 14, a = dv.getInt16(o, true) / 32767 * Q1, b = dv.getInt16(o + 2, true) / 32767 * Q1, c = ((w2 & 0x3fff) << 18 >> 18) / 8191 * Q1, k = i * 4;
      let d = Math.sqrt(Math.max(0, 1 - a * a - b * b - c * c)), x = m === 0 ? d : a, y = m === 0 ? a : m === 1 ? d : b, z = m <= 1 ? b : m === 2 ? d : c, w = m === 3 ? d : c;
      if(i && x * v[k - 4] + y * v[k - 3] + z * v[k - 2] + w * v[k - 1] < 0){ x = -x; y = -y; z = -z; w = -w; }   // each key on the same side as the one before
      v[k] = x; v[k + 1] = y; v[k + 2] = z; v[k + 3] = w; } return { t, v }; };
  const hips = vec(), root = flags & 1 ? vec() : null, rot = []; for(let i = 0; i < bones; i++) rot.push(quat()); return { frames: N, fps, loop: !!(flags & 2), hips, root, rot }; }

// the clip, built once: null while its group is not in (or the id is unknown). clip.userData = its index row.
export function animClip(id){ let clip = CLIP.get(id); if(clip !== undefined) return clip; const m = BY.get(id), dv = m && BIN[m.g]; if(!dv) return null;
  try{ const D = decodeAnimClip(dv, m.o, INDEX.bones.length), pre = INDEX.prefix, tracks = [];
    if(ANIMLIB.decode.hips) tracks.push(new THREE.VectorKeyframeTrack(pre + INDEX.hips + '.position', D.hips.t, D.hips.v));
    INDEX.bones.forEach((b, i) => tracks.push(new THREE.QuaternionKeyframeTrack(pre + b + '.quaternion', D.rot[i].t, D.rot[i].v)));
    clip = new THREE.AnimationClip(id, m.dur, tracks); clip.userData = m; ROOT.set(id, ANIMLIB.decode.root && D.root ? D.root : NOROOT);
  }catch(e){ console.warn('[anim-lib]', id, 'not decoded —', e && e.message); clip = null; }
  CLIP.set(id, clip); return clip; }
// where a travelling clip's root is at time t: out = [x, z, yaw] (metres on the operator's scale, radians; all 0 at t = 0, and for a clip without a root track)
export function animRootAt(id, t, out){ out[0] = out[1] = out[2] = 0; let R = ROOT.get(id); if(R === undefined){ animClip(id); R = ROOT.get(id); } if(!R || !R.t) return out;
  const T = R.t, V = R.v, n = T.length; let lo = 0, hi = n - 1; if(t <= T[0]) hi = 0; else if(t >= T[hi]) lo = hi; else { while(hi - lo > 1){ const m = (lo + hi) >> 1; if(T[m] <= t) lo = m; else hi = m; } }
  const u = hi > lo ? (t - T[lo]) / (T[hi] - T[lo]) : 0, a = Math.min(lo, hi) * 3, b = hi * 3; out[0] = V[a] + (V[b] - V[a]) * u; out[1] = V[a + 1] + (V[b + 1] - V[a + 1]) * u; out[2] = V[a + 2] + (V[b + 2] - V[a + 2]) * u; return out; }
