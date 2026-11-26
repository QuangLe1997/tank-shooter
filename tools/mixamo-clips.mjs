#!/usr/bin/env node
// tools/mixamo-clips.mjs — ANIM 1 THE MIXAMO LIBRARY ONTO THE OPERATOR'S SKELETON: every Mixamo FBX under <fbxRoot>/<folder>/ (binary 7.x, 30 fps,
// X Bot's skeleton) is retargeted to assets/models/real/operator.glb and packed into assets/anim/<group>.bin + index.json + SOURCE.txt, which
// src/actors/anim-lib.js plays. No dependency: the binary FBX is read here (three's FBXLoader stops on one file in five of this set).
//
//   node tools/mixamo-clips.mjs <fbxRoot>                         convert (writes assets/anim/)
//   node tools/mixamo-clips.mjs <fbxRoot> --verify --three <dir>  the packed clips through the game's own loader and three's mixer against the source rig
//   node tools/mixamo-clips.mjs --group blade --root <dir>        BLADE 1 ADD one more group (blade.bin) from another folder of bundles: the six files
//                                                                 above are not touched (byte-identical), index.json gains the group's rows, SOURCE-blade.txt its notes;
//                                                                 ids blade-gs-… (great sword) · blade-axe-… (melee axe) · blade-ss-… (sword and shield) · blade-misc-…;
//                                                                 add --verify --three <dir> to check that group alone
//   options: --out <dir> (instead of assets/anim), --info (the calibration numbers + one line a clip), --fps20 (clips over 4 s outside loco/stance
//   at 20 fps — also switched on by itself if the 4 MB budget is passed; not needed today: 1.55 MB at 30 fps)
//
// THE RETARGET. The two rigs share bone names, nothing else: X Bot rests in a T pose with its own joint axes and centimetres; the operator (Meshy)
// rests in an A pose, Z-up armature, shorter legs, higher ankles. Per frame and per bone the source's WORLD turn away from its own T pose
// (D = Qsrc(t)·Qsrc(T)⁻¹) is laid over the operator's reference pose (Qop(t) = D·Qref), then brought back to local. Qref is the operator's rest
// with the upper arms, forearms, thighs and shins swung (shortest way) to point where X Bot's do in its T pose and the hands turned to X Bot's
// (fingers' direction, then the knuckle line about it); trunk, head, clavicles and feet keep their rest orientation (both models rest upright and
// square, soles flat — matching joint-to-joint directions there would only copy where each rigger put the joints). Fingers are not stored (the
// game lays the hands on the weapon). Hips: sideways/forward motion scaled by the leg-length ratio (so a stride fits his legs), height by ground
// contact — on his feet his lowest sole clears the ground as the source's does (scaled by the hip-height ratio; his ankles sit twice as high as
// X Bot's, so a plain ratio of hip heights would sink his feet in every crouch), lying down his lowest joint lies as high as the source's lowest.
// THE ROOT. A looping clip that travels straight and evenly is pinned in place (speed m/s on his scale and heading kept in the index). A clip that
// goes somewhere or turns (starts, stops, turns, arcs, vaults, rolls, climbs, deaths) carries a separate root track (x, z, yaw; smoothed, the sway
// left in the hips), so the clip itself never leaves the spot. A climbing cycle has its even rise taken out too (index: rise, metres a cycle).
// THE SOURCE'S GAPS. Mixamo retimes a motion and snaps its keys to the frame grid: frames are missing inside a clip and often at its end. Inside,
// the curves are read as FBX reads them (cubic, auto tangents); at the end a cycle is closed onto its first pose (index: tail = frames rebuilt).
import fs from 'fs'; import path from 'path'; import zlib from 'zlib'; import crypto from 'crypto'; import { fileURLToPath, pathToFileURL } from 'url'; import { register } from 'node:module';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const C = {
  operator: 'assets/models/real/operator.glb', out: 'assets/anim', prefix: 'mixamorig', fps: 30,
  // parents before children; index = the track's place in a packed clip
  bones: ['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand',
    'LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'],
  align: { LeftArm:'LeftForeArm', LeftForeArm:'LeftHand', RightArm:'RightForeArm', RightForeArm:'RightHand', LeftUpLeg:'LeftLeg', LeftLeg:'LeftFoot', RightUpLeg:'RightLeg', RightLeg:'RightFoot' },
  hipsAt: [0, 0.07],                 // the library frame: the operator's own clips stand with the hips ~0.08 m ahead of the armature origin (x, forward)
  lie: [0.15, 0.27],                 // hips below 15% of standing height: lying (his lowest joint as high as the source's lowest) … above 27%: on his feet (his lowest sole as clear of the ground as the source's)
  tolDeg: { Hips:0.15, Spine:0.2, Spine1:0.2, Spine2:0.2, Neck:0.3, Head:0.3, Shoulder:0.3, Arm:0.25, ForeArm:0.3, Hand:0.6, UpLeg:0.15, Leg:0.15, Foot:0.3, ToeBase:0.8 },   // keyframe reduction: the most a joint may stray, degrees
  tolPos: 0.001, tolRoot: [0.002, 0.002, 0.15 * Math.PI / 180],   // hips 1 mm; root 2 mm / 0.15°
  loop: { deg: 4, y: 0.02, bend: 0.2, bendY: 0.6 },   // first pose = last pose within 4°: the clip loops; ending > 2 cm higher it is a climbing cycle (the rise taken out, kept in the index) — if it rises within 0.6 m of evenly
  seam: { gap: 3, ahead: 1.6, slack: 2, near: 0.6, blend: 4 },   // the last 1–3 frames missing: a loop if the first pose is where the motion was heading (≤ 1.6 frames' travel a missing frame + 2°); a seam under 0.6 of a frame's travel is closed over the last 4 frames
  inPlace: 0.2, travel: 0.3,         // a loop that ends ≥ 0.2 m away, going straight and evenly, is pinned in place; anything straying ≥ 0.3 m carries a root track
  yaw: { min: 12, upright: 55, agree: [6, 0.35] },   // a net turn ≥ 12° goes to the root track too — the hips within 55° of upright all the way, the chest turning with them (within 6° or 35%)
  smooth: 0.12,                      // the root path: a Gaussian of this many seconds
  dupe: { deg: 1.5, pos: 0.01 },     // two sources are one motion when no joint differs by more (the same motion from two packs differs by up to ~0.6°)
  budget: { all: 4e6, boot: 900e3, bootGroups: ['loco', 'stance'] }, fps20: 4,   // --fps20: clips longer than 4 s outside loco/stance
  groups: ['loco', 'stance', 'air', 'combat', 'react', 'social'],
};

// ---------- small maths: quaternions [x,y,z,w], vectors [x,y,z] ----------
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const qmul = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qinv = q => [-q[0], -q[1], -q[2], q[3]];
const qnorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0]/l, q[1]/l, q[2]/l, q[3]/l]; };
const qrot = (q, v) => { const [x, y, z, w] = q, ix = w*v[0]+y*v[2]-z*v[1], iy = w*v[1]+z*v[0]-x*v[2], iz = w*v[2]+x*v[1]-y*v[0], iw = -x*v[0]-y*v[1]-z*v[2]; return [ix*w-iw*x-iy*z+iz*y, iy*w-iw*y-iz*x+ix*z, iz*w-iw*z-ix*y+iy*x]; };
const qeul = (x, y, z) => { const cx = Math.cos(x/2), sx = Math.sin(x/2), cy = Math.cos(y/2), sy = Math.sin(y/2), cz = Math.cos(z/2), sz = Math.sin(z/2); return qmul(qmul([0,0,sz,cz], [0,sy,0,cy]), [sx,0,0,cx]); };   // FBX eEulerXYZ: R = Rz·Ry·Rx
const qyaw = a => [0, Math.sin(a/2), 0, Math.cos(a/2)];
const qang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3])));   // radians between two orientations
const qslerp = (a, b, t) => { let c = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3], s = 1; if(c < 0){ c = -c; s = -1; } let k0 = 1 - t, k1 = t; if(c < 0.9999){ const th = Math.acos(c), sn = Math.sin(th); k0 = Math.sin(k0 * th) / sn; k1 = Math.sin(k1 * th) / sn; } k1 *= s; return qnorm([a[0]*k0+b[0]*k1, a[1]*k0+b[1]*k1, a[2]*k0+b[2]*k1, a[3]*k0+b[3]*k1]); };
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]], dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2], len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }, cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const qfromTo = (a, b) => { const d = dot(a, b); if(d < -0.999999){ const ax = unit(Math.abs(a[0]) > 0.9 ? cross(a, [0,1,0]) : cross(a, [1,0,0])); return [ax[0], ax[1], ax[2], 0]; } const c = cross(a, b); return qnorm([c[0], c[1], c[2], 1 + d]); };
const vang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * R2D;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

// ---------- binary FBX (7.x): the node tree, then bones + animation curves ----------
function parseFbx(buf){ if(buf.toString('latin1', 0, 20) !== 'Kaydara FBX Binary  ') throw new Error('not a binary FBX'); const ver = buf.readUInt32LE(23), big = ver >= 7500; let p = 27;
  const u = () => { const v = big ? Number(buf.readBigUInt64LE(p)) : buf.readUInt32LE(p); p += big ? 8 : 4; return v; };
  const arr = (sz, rd) => { const n = buf.readUInt32LE(p), enc = buf.readUInt32LE(p + 4), cl = buf.readUInt32LE(p + 8); p += 12; let b = buf.subarray(p, p + cl); p += cl; if(enc) b = zlib.inflateSync(b); const o = new Array(n); for(let i = 0; i < n; i++) o[i] = rd(b, i * sz); return o; };
  function prop(){ const t = String.fromCharCode(buf[p++]); let v;
    switch(t){ case 'Y': v = buf.readInt16LE(p); p += 2; break; case 'C': v = buf[p++]; break; case 'I': v = buf.readInt32LE(p); p += 4; break; case 'F': v = buf.readFloatLE(p); p += 4; break; case 'D': v = buf.readDoubleLE(p); p += 8; break; case 'L': v = buf.readBigInt64LE(p); p += 8; break;
      case 'f': v = arr(4, (b, o) => b.readFloatLE(o)); break; case 'd': v = arr(8, (b, o) => b.readDoubleLE(o)); break; case 'l': v = arr(8, (b, o) => Number(b.readBigInt64LE(o))); break; case 'i': v = arr(4, (b, o) => b.readInt32LE(o)); break; case 'b': v = arr(1, (b, o) => b[o]); break;
      case 'S': case 'R': { const n = buf.readUInt32LE(p); p += 4; v = t === 'S' ? buf.toString('utf8', p, p + n) : null; p += n; break; } default: throw new Error('FBX property type ' + JSON.stringify(t) + ' at byte ' + p); } return v; }
  function node(){ const end = u(), np = u(); u(); const nl = buf[p++]; if(!end) return null; const name = buf.toString('latin1', p, p + nl); p += nl; const props = []; for(let i = 0; i < np; i++) props.push(prop()); const kids = []; while(p < end){ const k = node(); if(k) kids.push(k); } p = end; return { name, props, kids }; }
  const top = []; for(;;){ if(p + (big ? 25 : 13) > buf.length) break; const n = node(); if(!n) break; top.push(n); } return top; }
const KTIME = 46186158000;   // FBX time units in a second
function fbxRig(file){ const top = parseFbx(fs.readFileSync(file)), O = top.find(n => n.name === 'Objects'), CO = top.find(n => n.name === 'Connections'), GS = top.find(n => n.name === 'GlobalSettings'); if(!O || !CO) throw new Error('no Objects / Connections');
  const P70 = n => { const o = {}, p = n && n.kids.find(k => k.name === 'Properties70'); if(p) for(const k of p.kids) o[k.props[0]] = k.props.slice(4); return o; };
  const M = new Map(), by = {}, CN = new Map(), CV = new Map(); let meshes = 0, stack = null;
  for(const n of O.kids){
    if(n.name === 'Model'){ const p = P70(n), m = { name: String(n.props[1]).split('\0')[0].replace(/^.*:/, ''), pre: p.PreRotation || [0,0,0], t: p['Lcl Translation'] || [0,0,0], r: p['Lcl Rotation'] || [0,0,0], parent: null, T: null, R: null };
      if((p.RotationOrder || [0])[0] !== 0 || p.PostRotation) throw new Error('bone ' + m.name + ': a rotation order / post-rotation this reader does not do'); M.set(n.props[0], m); if(n.props[2] === 'LimbNode' && !by[m.name]) by[m.name] = m; }
    else if(n.name === 'AnimationCurveNode') CN.set(n.props[0], { d: P70(n), x: null, y: null, z: null });
    else if(n.name === 'AnimationCurve') CV.set(n.props[0], { t: n.kids.find(k => k.name === 'KeyTime').props[0], v: n.kids.find(k => k.name === 'KeyValueFloat').props[0] });
    else if(n.name === 'Geometry') meshes++; else if(n.name === 'AnimationStack' && !stack) stack = P70(n); }
  for(const c of CO.kids){ const [k, a, b, prop] = c.props;
    if(k === 'OO'){ if(M.has(a) && M.has(b)) M.get(a).parent = M.get(b); }
    else if(k === 'OP'){ if(CN.has(a) && M.has(b)){ if(prop === 'Lcl Translation') M.get(b).T = CN.get(a); else if(prop === 'Lcl Rotation') M.get(b).R = CN.get(a); } else if(CV.has(a) && CN.has(b)){ const ch = String(prop).slice(-1).toLowerCase(); if('xyz'.includes(ch)) CN.get(b)[ch] = CV.get(a); } } }
  let t1 = -Infinity, tail = Infinity; for(const b of C.bones){ const m = by[b]; if(m) for(const cn of [m.T, m.R]) if(cn) for(const c of [cn.x, cn.y, cn.z]) if(c && c.t.length > 1){ t1 = Math.max(t1, c.t[c.t.length - 1]); tail = Math.min(tail, c.t[c.t.length - 1]); } }   // (the scale curves are keyed to the end even where the motion is not)
  const start = stack && stack.LocalStart ? Number(stack.LocalStart[0]) / KTIME : 0, stop = stack && stack.LocalStop ? Number(stack.LocalStop[0]) / KTIME : (isFinite(t1) ? t1 / KTIME : 0);
  return { by, meshes, start, stop, tail: isFinite(tail) ? Math.min(stop, tail / KTIME) : stop, unit: 0.01 * ((P70(GS).UnitScaleFactor || [1])[0] || 1) }; }   // unit: file units → metres
// a curve at a time: FBX "cubic, auto tangent, progressive clamp" (flag 0x2108, what Mixamo writes) — a Hermite spline through the keys, each key's slope the one
//   through its two neighbours, flat at a peak and never steeper than three times either side (no overshoot); held before the first key and after the last
function slopes(c){ const t = c.t, v = c.v, n = t.length, m = new Array(n); for(let i = 0; i < n; i++){ const a = i ? (v[i] - v[i - 1]) / (t[i] - t[i - 1]) : null, b = i < n - 1 ? (v[i + 1] - v[i]) / (t[i + 1] - t[i]) : null;
    if(a === null || b === null) m[i] = a ?? b ?? 0; else if(a * b <= 0) m[i] = 0; else { const s = (v[i + 1] - v[i - 1]) / (t[i + 1] - t[i - 1]); m[i] = Math.sign(s) * Math.min(Math.abs(s), 3 * Math.abs(a), 3 * Math.abs(b)); } } return m; }
const curve = (c, d, tk) => { if(!c) return d; const t = c.t, v = c.v, n = t.length; if(tk <= t[0]) return v[0]; if(tk >= t[n - 1]) return v[n - 1]; let lo = 0, hi = n - 1; while(hi - lo > 1){ const m = (lo + hi) >> 1; if(t[m] <= tk) lo = m; else hi = m; }
  if(tk === t[lo]) return v[lo]; const m = c.m || (c.m = slopes(c)), h = t[hi] - t[lo], u = (tk - t[lo]) / h, u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * v[lo] + (u3 - 2 * u2 + u) * h * m[lo] + (-2 * u3 + 3 * u2) * v[hi] + (u3 - u2) * h * m[hi]; };
// world position + orientation of the named bones at a time in seconds ('T': every animated rotation zero = Mixamo's T pose)
function fbxPose(rig, names, time){ const W = new Map(), tk = time === 'T' ? 0 : time * KTIME;
  const go = m => { let w = W.get(m); if(w) return w; const p = m.parent ? go(m.parent) : { p: [0,0,0], q: [0,0,0,1] };
    const t = m.T && time !== 'T' ? [curve(m.T.x, m.t[0], tk), curve(m.T.y, m.t[1], tk), curve(m.T.z, m.t[2], tk)] : m.t, r = time === 'T' ? [0,0,0] : m.R ? [curve(m.R.x, m.r[0], tk), curve(m.R.y, m.r[1], tk), curve(m.R.z, m.r[2], tk)] : m.r;
    w = { p: add(p.p, qrot(p.q, t)), q: qmul(p.q, qmul(qeul(m.pre[0]*D2R, m.pre[1]*D2R, m.pre[2]*D2R), qeul(r[0]*D2R, r[1]*D2R, r[2]*D2R))) }; W.set(m, w); return w; };
  const out = {}; for(const n of names){ const m = rig.by[n]; if(m) out[n] = go(m); } return out; }

// ---------- the operator: rest pose out of the glb's JSON chunk ----------
function readGlb(file){ const b = fs.readFileSync(file), jl = b.readUInt32LE(12); return { j: JSON.parse(b.subarray(20, 20 + jl).toString()), bin: b.subarray(20 + jl + 8) }; }
function operatorRig(){ const { j } = readGlb(path.join(ROOT, C.operator)), par = {}; j.nodes.forEach((n, i) => (n.children || []).forEach(c => { par[c] = i; }));
  const world = i => { const n = j.nodes[i], p = par[i] === undefined ? { p: [0,0,0], q: [0,0,0,1] } : world(par[i]); if(n.scale && n.scale.some(s => Math.abs(s - 1) > 1e-3)) throw new Error('operator: a scaled node (' + n.name + ')'); return { p: add(p.p, qrot(p.q, n.translation || [0,0,0])), q: qmul(p.q, n.rotation || [0,0,0,1]) }; };
  const R = { rest: {}, off: {}, parent: {}, arm: null }, idx = n => j.nodes.findIndex(x => x.name === 'mixamorig:' + n);
  for(const n of [...C.bones, ...HANDX]){ const i = idx(n); if(i < 0) throw new Error('operator: no bone ' + n); R.rest[n] = world(i); R.off[n] = j.nodes[i].translation || [0,0,0]; R.parent[n] = (j.nodes[par[i]].name || '').replace('mixamorig:', ''); }
  R.arm = world(par[idx('Hips')]); return R; }
// the operator's reference pose against one source T pose + the scale factors and the height his joints rest at
const FEET = ['LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase'], LEG = ['LeftUpLeg', 'LeftLeg', 'LeftFoot'], HANDX = ['Left', 'Right'].flatMap(s => ['HandMiddle1', 'HandIndex1', 'HandPinky1'].map(n => s + n)), SRC = [...C.bones, ...HANDX];
function reference(op, srcT, unitM){ const ref = {}; for(const b of C.bones) ref[b] = op.rest[b].q;
  for(const b in C.align){ const c = C.align[b], dt = unit(sub(op.rest[c].p, op.rest[b].p)), ds = unit(sub(srcT[c].p, srcT[b].p)); ref[b] = qmul(qfromTo(dt, ds), op.rest[b].q); }
  for(const h of ['LeftHand', 'RightHand']){ const D = P => unit(sub(P[h + 'Middle1'].p, P[h].p)), X = (P, d) => { const a = sub(P[h + 'Pinky1'].p, P[h + 'Index1'].p), k = dot(a, d); return unit([a[0] - d[0] * k, a[1] - d[1] * k, a[2] - d[2] * k]); };   // the hands: the fingers' direction, then the knuckle line about it
    const ds = D(srcT), a1 = qfromTo(D(op.rest), ds), xt = X({ [h + 'Pinky1']: { p: qrot(a1, op.rest[h + 'Pinky1'].p) }, [h + 'Index1']: { p: qrot(a1, op.rest[h + 'Index1'].p) } }, ds), xs = X(srcT, ds), th = Math.atan2(dot(cross(xt, xs), ds), dot(xt, xs)), sn = Math.sin(th / 2);
    ref[h] = qmul(qmul([ds[0] * sn, ds[1] * sn, ds[2] * sn, Math.cos(th / 2)], a1), op.rest[h].q); }
  const seg = (P, a, b) => len(sub(P[b].p, P[a].p)), kLeg = (seg(op.rest, LEG[0], LEG[1]) + seg(op.rest, LEG[1], LEG[2])) / ((seg(srcT, LEG[0], LEG[1]) + seg(srcT, LEG[1], LEG[2])) * unitM);
  const restY = {}, srcY = {}; for(const f of FEET){ restY[f] = op.rest[f].p[1]; srcY[f] = srcT[f].p[1] * unitM; }
  const R = { ref, kLeg, restY, srcY, refInv: {}, srcTinv: {}, srcHipsT: srcT.Hips.p.map(v => v * unitM) }; for(const b of C.bones){ R.refInv[b] = qinv(ref[b]); R.srcTinv[b] = qinv(srcT[b].q); }
  R.hipH = -lowSole(op, ref, R.restY); R.srcHipH = srcT.Hips.p[1] * unitM; R.kHip = R.hipH / R.srcHipH; return R; }
// with the hips at height 0: the least (joint height − the height that joint rests at) over both feet — how far the lowest sole is off the ground
function lowSole(op, Q, restY){ let lo = Infinity; for(const side of ['Left', 'Right']){ let p = [0,0,0], par = 'Hips'; for(const b of [side + 'UpLeg', side + 'Leg', side + 'Foot', side + 'ToeBase']){ p = add(p, qrot(Q[par], op.off[b])); par = b; if(restY[b] !== undefined) lo = Math.min(lo, p[1] - restY[b]); } } return lo; }

// with the hips at height 0: the lowest of all his joints (lying down it is whatever touches the ground)
function lowJoint(op, Q){ const y = { Hips: [0, 0, 0] }; let lo = 0; for(const b of C.bones) if(b !== 'Hips'){ const p = add(y[op.parent[b]], qrot(Q[op.parent[b]], op.off[b])); y[b] = p; lo = Math.min(lo, p[1]); } return lo; }

// ---------- one clip: sample the source at 30 fps, retarget, split root from pose ----------
function gauss(a, sig){ if(sig < 0.3) return a.slice(); const n = a.length, r = Math.ceil(sig * 3), w = []; let ws = 0; for(let i = -r; i <= r; i++){ const k = Math.exp(-i * i / (2 * sig * sig)); w.push(k); ws += k; }
  const at = i => i < 0 ? 2 * a[0] - a[Math.min(n - 1, -i)] : i >= n ? 2 * a[n - 1] - a[Math.max(0, 2 * (n - 1) - i)] : a[i];   // odd reflection: the ends keep their slope
  return a.map((_, i) => { let s = 0; for(let k = -r; k <= r; k++) s += w[k + r] * at(i + k); return s / ws; }); }
function retarget(rig, op, fps, closed = 0){ const need = [...C.bones]; if(need.some(n => !rig.by[n])) throw new Error('not a Mixamo skeleton (' + need.filter(n => !rig.by[n]).slice(0, 3).join(', ') + ' missing)');
  const dur = rig.stop - rig.start, S = Math.max(1, Math.round(dur * fps)), N = S + 1, T = reference(op, fbxPose(rig, SRC, 'T'), rig.unit), U = rig.unit, armInv = qinv(op.arm.q), nb = C.bones.length;
  const world = [], hx = new Array(N), hy = new Array(N), hz = new Array(N), head = new Array(N), chest = new Array(N); let tilt = 0;
  const yawOf = (q, prev) => { let a = 2 * Math.atan2(q[1], q[3]); if(prev !== undefined){ let da = a - prev; da -= 2 * Math.PI * Math.round(da / (2 * Math.PI)); a = prev + da; } return a; };
  for(let f = 0; f < N; f++){ const S0 = fbxPose(rig, need, rig.start + f / fps), Q = {}; for(const b of C.bones) Q[b] = qnorm(qmul(qmul(S0[b].q, T.srcTinv[b]), T.ref[b])); world.push(Q);
    const d = qmul(S0.Hips.q, T.srcTinv.Hips), up = qrot(d, [0,1,0]); tilt = Math.max(tilt, Math.acos(Math.max(-1, Math.min(1, up[1]))) * R2D); head[f] = yawOf(d, head[f - 1]); chest[f] = yawOf(qmul(S0.Spine2.q, T.srcTinv.Spine2), chest[f - 1]);
    hx[f] = S0.Hips.p[0] * U * T.kLeg; hz[f] = S0.Hips.p[2] * U * T.kLeg;
    let lo = Infinity; for(const j of FEET) lo = Math.min(lo, S0[j].p[1] * U - T.srcY[j]);
    let lj = Infinity; for(const b of C.bones) lj = Math.min(lj, S0[b].p[1] * U);
    const ys = S0.Hips.p[1] * U, yFoot = T.kHip * lo - lowSole(op, Q, T.restY), yLie = T.kHip * lj - lowJoint(op, Q); hy[f] = yLie + (yFoot - yLie) * smooth(C.lie[0], C.lie[1], ys / T.srcHipH); }
  // the root's yaw: only a real turn (hips AND chest come round, the body upright all the way) — a stance that merely blades the hips stays in the pose
  const sig = C.smooth * fps, netYaw = (head[S] - head[0]) * R2D, netChest = (chest[S] - chest[0]) * R2D, yawOn = tilt < C.yaw.upright && Math.abs(netYaw) >= C.yaw.min && Math.abs(netChest - netYaw) <= Math.max(C.yaw.agree[0], C.yaw.agree[1] * Math.abs(netYaw));
  let ry = new Array(N).fill(0); if(yawOn){ const s = gauss(head, sig); ry = s.map(v => v - s[0]); }
  const HQ = world.map((Q, f) => qmul(qyaw(-ry[f]), Q.Hips)), L = world.map((Q, f) => C.bones.map((b, i) => i ? qnorm(qmul(qinv(Q[op.parent[b]]), Q[b])) : qnorm(qmul(armInv, HQ[f]))));
  const poseGap = (a, b) => { let m = 0; for(let i = 0; i < nb; i++) m = Math.max(m, qang(L[a][i], L[b][i]) * R2D); return m; }, step = median(Array.from({ length: S }, (_, f) => poseGap(f, f + 1)));
  // THE LAST FRAMES. Mixamo retimes a motion and snaps its keys to the frame grid: frames go missing inside (the curves' own interpolation fills them) and
  //   the last key often lands 1–3 frames short — the pose then just hangs to the end, and a cycle no longer closes. If the first pose is where the motion
  //   was heading when its keys ran out, it is a cycle: every curve that stops short gets its closing key and the clip is read again.
  const E = Math.round((rig.tail - rig.start) * fps + 1e-6), gap = S - E;
  if(!closed && gap > 0 && gap <= C.seam.gap && E > 1 && poseGap(0, E) <= C.seam.ahead * gap * step + C.seam.slack){ closeCurves(rig, rig.start + S / fps, fps); return retarget(rig, op, fps, gap); }
  const seam = poseGap(0, S); let loop = seam <= Math.max(C.loop.deg, C.seam.near * step);
  const vx = (hx[S] - hx[0]) / S, vz = (hz[S] - hz[0]) / S, vy0 = (hy[S] - hy[0]) / S; let far = 0, bend = 0, bendY = 0; for(let f = 0; f < N; f++){ far = Math.max(far, Math.hypot(hx[f] - hx[0], hz[f] - hz[0])); bend = Math.max(bend, Math.hypot(hx[f] - hx[0] - vx * f, hz[f] - hz[0] - vz * f)); bendY = Math.max(bendY, Math.abs(hy[f] - hy[0] - vy0 * f)); }
  // a loop that ends higher or lower: a climbing cycle if it rises evenly (the rise goes to the index), otherwise not a loop at all
  let vy = 0; if(loop && Math.abs(hy[S] - hy[0]) > C.loop.y){ if(bendY <= C.loop.bendY) vy = vy0; else loop = false; }
  const net = Math.hypot(vx, vz) * S, mode = loop && !yawOn && net >= C.inPlace && bend <= C.loop.bend ? 'inplace' : (yawOn || far >= C.travel) ? 'root' : 'still';
  let rx = new Array(N).fill(0), rz = new Array(N).fill(0), speed = 0, dir = null;
  if(mode === 'inplace'){ for(let f = 0; f < N; f++){ rx[f] = vx * f; rz[f] = vz * f; } speed = Math.hypot(vx, vz) * fps; dir = [vx / Math.hypot(vx, vz), vz / Math.hypot(vx, vz)]; }
  else if(mode === 'root'){ const sx = gauss(hx, sig), sz = gauss(hz, sig); rx = sx.map(v => v - sx[0]); rz = sz.map(v => v - sz[0]); }
  // per frame: the pose (local turns), the hips in the root's frame, the root
  const rot = C.bones.map((_, i) => L.map(l => l[i])), P = new Array(N), root = mode === 'root' ? new Array(N) : null;
  for(let f = 0; f < N; f++){ const c = Math.cos(ry[f]), s = Math.sin(ry[f]), dx = hx[f] - rx[f], dz = hz[f] - rz[f]; P[f] = [dx * c - dz * s, hy[f] - vy * f, dx * s + dz * c]; if(root) root[f] = [rx[f], rz[f], ry[f]]; }
  let tail = closed; if(loop && seam > 0.05){ const K = Math.max(1, Math.min(C.seam.blend, N >> 2)), dP = P[0].map((v, c) => v - P[S][c]), dq = rot.map(r => qmul(r[0], qinv(r[S]))), dh = qmul(HQ[0], qinv(HQ[S])); tail = Math.max(tail, K);   // a small seam left: the last pose brought onto the first over a few frames
    for(let f = S - K + 1; f <= S; f++){ const w = (f - (S - K)) / K; P[f] = P[f].map((v, c) => v + dP[c] * w); HQ[f] = qslerp(HQ[f], qmul(dh, HQ[f]), w); for(let i = 0; i < nb; i++) rot[i][f] = qslerp(rot[i][f], qmul(dq[i], rot[i][f]), w); } }
  if(root){ let pl = 0; for(let f = 1; f < N; f++) pl += Math.hypot(root[f][0] - root[f - 1][0], root[f][1] - root[f - 1][1]); speed = pl / (S / fps); }
  const off = [C.hipsAt[0] - T.srcHipsT[0] * T.kLeg, C.hipsAt[1] - T.srcHipsT[2] * T.kLeg], pos = P.map(p => qrot(armInv, sub([p[0] + off[0], p[1], p[2] + off[1]], op.arm.p)));
  return { N, fps, dur: S / fps, rot, pos, root, mode, loop, speed, dir, yaw: root && yawOn ? root[S][2] * R2D : 0, rise: vy ? vy * S : hy[S] - hy[0], climb: !!vy, seam, step, far, closed, tail, T, cmp: { hq: HQ, P } }; }
// a cycle whose keys stop short: each such curve gets a key at the end — its first value again (an angle: the nearest whole turn of it; a channel that travels: carried on at its mean rate)
function closeCurves(rig, tEnd, fps){ const tk = tEnd * KTIME, F = KTIME / fps, fix = (c, kind) => { if(!c || c.t.length < 2) return; const n = c.t.length, t0 = c.t[0], tl = c.t[n - 1]; if(tl >= tk - F / 100) return; let v = c.v[0], rate = 0;
    for(let i = 1; i < n; i++) rate = Math.max(rate, Math.abs(c.v[i] - c.v[i - 1]) / ((c.t[i] - c.t[i - 1]) / F));   // the most it moves in a frame
    if(kind === 'R'){ v += 360 * Math.round((c.v[n - 1] - v) / 360); if(Math.abs(v - c.v[n - 1]) > C.seam.ahead * rate * (tk - tl) / F + C.seam.slack) return; }   // (a turn in place: the hips' yaw is not coming back)
    else if(Math.abs(c.v[n - 1] - v) > 3 * rate) v += (c.v[n - 1] - v) / (tl - t0) * (tk - t0);
    c.t = [...c.t, tk]; c.v = [...c.v, v]; c.m = null; };
  for(const b of C.bones){ const m = rig.by[b]; if(m.R) for(const a of 'xyz') fix(m.R[a], 'R'); if(m.T) for(const a of 'xyz') fix(m.T[a], 'T'); } }
// 30 → 20 fps (every pose re-read at the new times)
function resample(K, fps){ const N = Math.max(2, Math.round(K.dur * fps) + 1), at = (arr, f, mix) => { const x = Math.min(K.N - 1, f * K.fps / fps), i = Math.min(K.N - 2, Math.floor(x)); return mix(arr[i], arr[i + 1], x - i); }, lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  const o = { ...K, cmp: null, tail: K.tail && Math.ceil(K.tail * fps / K.fps), N, fps, dur: (N - 1) / fps, rot: K.rot.map(r => Array.from({ length: N }, (_, f) => at(r, f, qslerp))), pos: Array.from({ length: N }, (_, f) => at(K.pos, f, lerp)), root: K.root && Array.from({ length: N }, (_, f) => at(K.root, f, lerp)) };
  o.rot.forEach(r => { r[N - 1] = K.rot[o.rot.indexOf(r)][K.N - 1]; }); o.pos[N - 1] = K.pos[K.N - 1]; if(o.root) o.root[N - 1] = K.root[K.N - 1]; return o; }

// ---------- names: a stable id, a group ----------
const STOP = new Set('a an the while when with and or of in on at for by from being someone something position male his her it then them make their ro eveade'.split(' '));
const CANON = { walking:'walk', running:'run', sprinting:'sprint', crouching:'crouch', crouched:'crouch', kneeling:'kneel', standing:'stand', jumping:'jump', firing:'fire', reloading:'reload', throwing:'throw', turning:'turn', aiming:'aim', climbing:'climb',
  rolling:'roll', stabbing:'stab', backwards:'backward', forwards:'forward', degrees:'deg', degree:'deg', falling:'fall', laying:'lying', getting:'get', crawling:'crawl', moving:'move', sneaking:'sneak', carrying:'carry', carried:'carry', pointing:'point',
  yelling:'yell', calling:'call', cheering:'cheer', rallying:'rally', pushing:'push', picking:'pick', putting:'put', grabbing:'grab', hiding:'hide', ducking:'duck', dodging:'dodge', stumbling:'stumble', tripping:'trip', sitting:'sit', swimming:'swim', looking:'look',
  holding:'hold', pulling:'pull', advancing:'advance', punching:'punch', taking:'take', stepping:'step', opening:'open', intercepting:'intercept', jogging:'jog', shaking:'shake', treading:'tread', floating:'float', reaction:'react', into:'to', gri:'grip', grabs:'grab', falls:'fall' };
const PACK = { 'pack-rifle-8way-locomotion':'rifle', 'pack-lite-rifle':'rifle', 'pack-male-locomotion':'plain', 'pack-action-adventure':'adv', 'pack-basic-shooter':'shooter', 'pack-shooter':'shooter' };
const GROUP = [   // first match wins, tested on "folder/file name" lower-cased
  ['social', /carry|carri/], ['combat', /kick|around corner|picking up gun/], ['react', /death|dying|\bdies\b|reaction|knocked|getting up|stand(ing)? up|standing from|injured|stumbl|tripping|slip and|hit and fall|tired|dizzy/],
  ['social', /cheer|rally|salute|point|yell|calling|gesture|\bnod\b|head shake|shaking head|acknowledg|cocky|sigh|weight shift|look away|dismiss|\bwave\b|intercept|radio|door|pick(ing)? up an|pick up item|pushing|sitting|swimming|treading|nervously|putting|put back|grab rifle/],
  ['air', /jump|fall|landing|\broll|climb|vault|ladder|dodg/], ['combat', /fir(e|ing)\b|reload|grenade|toss|throw|stab|bayonet|punch|cover|hiding|duck/],
  ['stance', /idle|kneel|prone|crawl/], ['loco', /walk|run|sprint|strafe|turn|jog|sneak|start|stop/], ['social', /./]];
// Mixamo titles too vague to stand as an id on their own ("Jumping", "Opening", "Pushing" …): the words to use instead (keyed by the file name, lower case)
const RENAME = { 'jumping - male jumping down from 4ft with a rifle': 'jump down 4ft', 'kneeling - kneeling on one knee idle': 'kneel idle', 'kneeling down - standing to kneeling down': 'stand to kneel', 'opening - attempting to open a door': 'open door try',
  'calling - calling for help in a sneaky position': 'call help sneaky', 'pushing - pushing a heavy object': 'push heavy', 'picking up - picking up an object': 'pick up object', 'ducking - ducking for cover from standing idle': 'duck for cover',
  'hiding - crouched hiding to ducking': 'hide crouch to duck', 'hiding grab - grabs radio while hiding': 'hide grab radio', 'aiming gun - picking up gun from ground to aiming': 'pick up gun to aim', 'stumbling - stumbling over crate': 'stumble over crate',
  'tripping - tripping forward while walking': 'trip forward walk', 'rifle death - dying reaction while standing holding a rifle': 'death stand hold rifle', 'knocked down - knocked down to stomach': 'knocked down to stomach',
  'charge - pointing onward charge': 'charge point onward', 'intercepting - intercept and wave to stop': 'intercept wave stop', 'rallying - rallying the crowd to make them cheer': 'rally crowd', 'cheering - male cheering with two fists pump': 'cheer fists',
  'moving backward in crawl position - moving backward in crawl position with rifle': 'crawl backward rifle', 'toss grenade - throwing something holding rifle aimed': 'toss grenade rifle aimed', 'swimming - swimming underwater': 'swim underwater',
  'running tired - running tired to dizzy': 'run tired to dizzy', 'yelling out - stepping forward and yelling out': 'yell step forward', 'salute - formal military salute': 'salute military', 'taking cover - taking cover against a wall with rifle': 'take cover wall',
  'taking cover idle - cover idle against a wall with rifle': 'cover idle wall', 'rifle put away - putting rifle away': 'rifle put away', 'low crawl - super low crawl, or crawling up a wall': 'low crawl', 'jogging stumble - brief stumble while jogging': 'jog stumble',
  'rifle turn and kick - rifle turn and kick in door': 'turn kick door', 'crouch look around corner - crouch looking around corner': 'crouch look around corner', 'sprinting forward roll - sprint to forward roll to sprinting': 'sprint roll to sprint',
  'run to rolling - run ro roll eveade to run': 'run roll to run', 'running dive roll - rifle run dive roll to stopped': 'run dive roll to stop', 'dodging back - jumping backwards dodge': 'dodge back jump' };
const toks = s => s.toLowerCase().replace(/\((\d+)\)/g, ' v$1 ').split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)).map(w => CANON[w] || w);
const titleOf = (folder, file) => { const base = file.replace(/\.fbx$/i, ''), i = base.indexOf(' - '), tag = PACK[folder], as = RENAME[base.toLowerCase()]; if(as) return { base, title: toks(as), desc: [] }; return { base, title: [...(tag && !/rifle|pistol/i.test(base) ? [tag] : []), ...toks(i < 0 ? base : base.slice(0, i))], desc: i < 0 ? [] : toks(base.slice(i + 3)) }; };
function nameOf(folder, file, shared){ const { base, title, desc } = titleOf(folder, file), group = GROUP.find(g => g[1].test(base.toLowerCase()))[0], seen = new Set(title);
  let out = [...title]; if(shared.get(title.join('-')) > 1) for(const w of desc) if(!seen.has(w)){ seen.add(w); out.push(w); }
  const v = out.filter(w => /^v\d+$/.test(w)); out = out.filter(w => !/^v\d+$/.test(w)).slice(0, 7); while(out.length > 1 && out[out.length - 1] === 'to') out.pop(); return { group, id: [group, ...out, ...v].join('-') }; }

// ---------- packing (the reader is src/actors/anim-lib.js: decodeAnimClip) ----------
// which frames to keep so that the in-between ones, interpolated, stay within tolerance: [0] alone when nothing moves
function keysOf(N, bad){ let still = true; for(let f = 1; f < N && still; f++) if(bad(0, 0, f)) still = false; if(still) return [0];
  const ok = (i, j) => { for(let k = i + 1; k < j; k++) if(bad(i, j, k)) return false; return true; }, keys = [0]; let i = 0;
  while(i < N - 1){ let lo = i + 1, step = 1, hi = lo; while(hi < N - 1 && ok(i, Math.min(N - 1, i + step * 2))){ step *= 2; hi = Math.min(N - 1, i + step); lo = hi; } hi = Math.min(N - 1, i + step * 2);
    while(hi - lo > 1){ const m = (lo + hi) >> 1; if(ok(i, m)) lo = m; else hi = m; } if(hi === N - 1 && ok(i, hi)) lo = hi; keys.push(lo); i = lo; } return keys; }
const quatKeys = (q, tol) => keysOf(q.length, (i, j, k) => qang(i === j ? q[i] : qslerp(q[i], q[j], (k - i) / (j - i)), q[k]) > tol);
const vecKeys = (v, tol) => keysOf(v.length, (i, j, k) => v[k].some((x, c) => Math.abs((i === j ? v[i][c] : v[i][c] + (v[j][c] - v[i][c]) * (k - i) / (j - i)) - x) > (tol[c] ?? tol[0])));
const tolOf = b => (C.tolDeg[b] ?? C.tolDeg[b.replace(/^(Left|Right)/, '')] ?? 0.5) * D2R, Q1 = Math.SQRT1_2;
function packClip(K){ const wide = K.N > 256, parts = [], u8 = a => Buffer.from(Uint8Array.from(a)), u16 = a => { const b = Buffer.alloc(a.length * 2); a.forEach((v, i) => b.writeUInt16LE(v, i * 2)); return b; }, f32 = a => { const b = Buffer.alloc(a.length * 4); a.forEach((v, i) => b.writeFloatLE(v, i * 4)); return b; };
  let keys = 0; const frames = k => (wide ? u16 : u8)(k);
  const vec = (v, tol) => { const k = vecKeys(v, tol), mn = [0, 1, 2].map(c => Math.min(...v.map(x => x[c]))), st = [0, 1, 2].map(c => (Math.max(...v.map(x => x[c])) - mn[c]) / 65535); keys += k.length;
    parts.push(u16([k.length]), f32([...mn, ...st]), frames(k), u16(k.flatMap(f => v[f].map((x, c) => st[c] ? Math.round((x - mn[c]) / st[c]) : 0)))); };
  parts.push(u16([K.N]), u8([K.fps, (K.root ? 1 : 0) | (K.loop ? 2 : 0)])); vec(K.pos, [C.tolPos]); if(K.root) vec(K.root, C.tolRoot);
  K.rot.forEach((q, bi) => { const k = quatKeys(q, tolOf(C.bones[bi])); keys += k.length; parts.push(u16([k.length]), frames(k), u16(k.flatMap(f => { const v = q[f]; let m = 0; for(let c = 1; c < 4; c++) if(Math.abs(v[c]) > Math.abs(v[m])) m = c; const s = v[m] < 0 ? -1 : 1, r = [0, 1, 2, 3].filter(c => c !== m).map(c => v[c] * s / Q1);
    const cl = (x, n) => Math.max(-n, Math.min(n, Math.round(x * n))); return [cl(r[0], 32767) & 0xffff, cl(r[1], 32767) & 0xffff, (m << 14) | (cl(r[2], 8191) & 0x3fff)]; }))); });
  return { buf: Buffer.concat(parts), keys }; }

// ---------- convert ----------
function listSources(fbxRoot){ const out = []; for(const folder of fs.readdirSync(fbxRoot).sort()){ const d = path.join(fbxRoot, folder); if(!fs.statSync(d).isDirectory()) continue; for(const file of fs.readdirSync(d).sort()) if(/\.fbx$/i.test(file)) out.push({ folder, file, path: path.join(d, file) }); } return out; }
// the same motion? → the yaw (degrees) by which b must be turned to lie on a (Mixamo hands out one motion facing two ways), or null
function sameMotion(a, b){ if(a.N !== b.N || a.mode !== b.mode) return null; const A = a.cmp, B = b.cmp, Y = qnorm(qmul(A.hq[0], qinv(B.hq[0]))); if(Math.hypot(Y[0], Y[2]) > 0.02) return null; const y = qnorm([0, Y[1], 0, Y[3]]), tq = C.dupe.deg * D2R, tp = C.dupe.pos;
  for(let f = 0; f < a.N; f++){ if(qang(A.hq[f], qmul(y, B.hq[f])) > tq) return null; const p = qrot(y, B.P[f]); if(A.P[f].some((v, c) => Math.abs(v - p[c]) > tp)) return null; for(let i = 1; i < a.rot.length; i++) if(qang(a.rot[i][f], b.rot[i][f]) > tq) return null;
    if(a.root){ const r = qrot(y, [b.root[f][0], 0, b.root[f][1]]); if(Math.abs(r[0] - a.root[f][0]) > tp || Math.abs(r[2] - a.root[f][1]) > tp || Math.abs(a.root[f][2] - b.root[f][2]) > tq) return null; } }
  let d = 2 * Math.atan2(y[1], y[3]) * R2D; d -= 360 * Math.round(d / 360); return d; }
function convert(fbxRoot, opt){ const op = operatorRig(), src = listSources(fbxRoot), clips = [], dropped = [], skipped = [], ids = new Map(), shared = new Map(); let T = null;
  for(const s of src){ const k = titleOf(s.folder, s.file).title.join('-'); shared.set(k, (shared.get(k) || 0) + 1); }
  for(const s of src){ let rig; try{ rig = fbxRig(s.path); }catch(e){ skipped.push([s, 'unreadable: ' + e.message]); continue; }
    if(rig.meshes || rig.stop - rig.start < 2.5 / C.fps){ skipped.push([s, rig.meshes ? 'the character file (mesh + T pose), not a motion' : 'no motion (under 3 frames)']); continue; }
    let K; try{ K = retarget(rig, op, C.fps); }catch(e){ skipped.push([s, e.message]); continue; } T = T || K.T;
    let turned = null; const twin = clips.find(c => (turned = sameMotion(c.K, K)) !== null); if(twin){ dropped.push([s, twin, turned]); continue; }
    const nm = nameOf(s.folder, s.file, shared), n = (ids.get(nm.id) || 0) + 1; ids.set(nm.id, n); clips.push({ id: n > 1 ? nm.id + '-' + n : nm.id, group: nm.group, src: s.folder + '/' + s.file, K }); }
  if(opt.info) info(op, T, clips);
  const build = fps20 => { const G = {}; for(const g of C.groups) G[g] = { parts: [Buffer.alloc(8)], at: 8, n: 0 }; const meta = []; let keys = 0, frames = 0;
    for(const c of clips){ const K = fps20 && !C.budget.bootGroups.includes(c.group) && c.K.dur > C.fps20 ? resample(c.K, 20) : c.K, P = packClip(K), g = G[c.group]; keys += P.keys; frames += K.N * (C.bones.length + 1);
      const m = { id: c.id, g: c.group, src: c.src, dur: +K.dur.toFixed(4), fps: K.fps, frames: K.N, loop: K.loop, speed: +K.speed.toFixed(3), travels: K.mode === 'root' };
      if(K.dir) m.dir = K.dir.map(v => +v.toFixed(3)); if(K.yaw) m.yaw = +K.yaw.toFixed(1); if(K.climb) m.rise = +K.rise.toFixed(3); if(K.tail) m.tail = K.tail; m.o = g.at; m.b = P.buf.length; g.parts.push(P.buf); g.at += P.buf.length; g.n++; meta.push(m); }
    const files = {}; for(const g of C.groups){ const b = Buffer.concat(G[g].parts); b.write('XKA1', 0, 'latin1'); b.writeUInt16LE(G[g].n, 4); b.writeUInt16LE(C.bones.length, 6); files[g] = b; }
    return { files, meta, keys, frames }; };
  let fps20 = !!opt.fps20, B = build(fps20); const sizeOf = B => { const o = {}; let all = 0; for(const g of C.groups){ o[g] = B.files[g].length; all += o[g]; } return { o, all, boot: C.budget.bootGroups.reduce((s, g) => s + o[g], 0) }; };
  if(!fps20 && sizeOf(B).all + 60e3 > C.budget.all){ fps20 = true; B = build(true); }
  const index = { v: 1, fps: C.fps, prefix: C.prefix, bones: C.bones, hips: 'Hips', scale: { leg: +T.kLeg.toFixed(4), hip: +T.kHip.toFixed(4) }, groups: {}, clips: B.meta };
  for(const g of C.groups) index.groups[g] = { file: g + '.bin', bytes: B.files[g].length, clips: B.meta.filter(m => m.g === g).length, sha: crypto.createHash('sha1').update(B.files[g]).digest('hex').slice(0, 12) };
  const out = path.resolve(ROOT, opt.out || C.out); fs.mkdirSync(out, { recursive: true }); for(const g of C.groups) fs.writeFileSync(path.join(out, g + '.bin'), B.files[g]);
  const J = JSON.stringify(index).replace(/\{"id"/g, '\n{"id"').replace(/\],"groups"/, '],\n"groups"').replace(/\]\}$/, '\n]}\n'); fs.writeFileSync(path.join(out, 'index.json'), J);
  fs.writeFileSync(path.join(out, 'SOURCE.txt'), sourceTxt(clips, dropped, skipped, fps20));
  const S = sizeOf(B), tot = S.all + J.length;
  console.log(`sources ${src.length} → clips ${clips.length} (dropped as the same motion ${dropped.length}, skipped ${skipped.length})`);
  for(const g of C.groups) console.log('  ' + g.padEnd(7), String(index.groups[g].clips).padStart(4), 'clips', String(S.o[g]).padStart(8), 'bytes');
  console.log(`  index.json ${J.length} bytes · total ${tot} bytes (budget ${C.budget.all}) · loco+stance ${S.boot} (budget ${C.budget.boot})${fps20 ? ' · clips over ' + C.fps20 + ' s outside loco/stance at 20 fps' : ''}`);
  console.log(`  keys kept ${B.keys} of ${B.frames} (${(100 * B.keys / B.frames).toFixed(1)}%) · loop ${B.meta.filter(m => m.loop).length} · in place ${B.meta.filter(m => m.dir).length} · root track ${B.meta.filter(m => m.travels).length}`);
  for(const [s, why] of skipped) console.log('  skipped', s.folder + '/' + s.file, '—', why); for(const [s, t, y] of dropped) console.log('  dropped', s.folder + '/' + s.file, '= ' + t.id + (Math.abs(y) > 1 ? ' (facing ' + y.toFixed(0) + '° round)' : ''));
  if(tot > C.budget.all || S.boot > C.budget.boot){ console.error('✗ over the size budget'); process.exitCode = 1; } }
// ---------- BLADE 1 one more group from its own folder of bundles: <group>.bin + its rows in index.json; nothing else is rewritten ----------
const GTAG = { 'bundle-great-sword':'gs', 'bundle-melee-axe':'axe' };
function groupId(g, folder, file){ const base = file.replace(/\.fbx$/i, ''), i = base.indexOf(' - '), pack = i < 0 ? '' : base.slice(0, i), rest = i < 0 ? base : base.slice(i + 3), tag = GTAG[folder] || (/^pro sword and shield$/i.test(pack) ? 'ss' : 'misc');
  let w = (tag === 'misc' ? pack || rest : rest).toLowerCase().replace(/ver\. ?/g, ' '); if(tag === 'gs') w = w.replace(/\b(a )?great sword\b/g, ' '); if(tag === 'ss') w = w.replace(/\bsword and shield\b/g, ' '); if(tag === 'axe') w = w.replace(/^standing /, '').replace(/\bmelee\b/g, ' '); if(tag === 'misc') w = w.replace(/\b(a|an|the)\b/g, ' ');
  const words = w.split(/[^a-z0-9]+/).filter(Boolean); return [g, tag, ...(words.length ? words : ['move'])].join('-'); }
function convertGroup(fbxRoot, opt){ const g = opt.group; if(C.groups.includes(g) || !/^[a-z]+$/.test(g)){ console.error('--group: a new group name (not one of ' + C.groups.join(', ') + ')'); process.exit(2); }
  const op = operatorRig(), src = listSources(fbxRoot), clips = [], dropped = [], skipped = [], ids = new Map();
  for(const s of src){ let rig; try{ rig = fbxRig(s.path); }catch(e){ skipped.push([s, 'unreadable: ' + e.message]); continue; }
    if(rig.meshes || rig.stop - rig.start < 2.5 / C.fps){ skipped.push([s, rig.meshes ? 'the character file (mesh + T pose), not a motion' : 'no motion (under 3 frames)']); continue; }
    let K; try{ K = retarget(rig, op, C.fps); }catch(e){ skipped.push([s, e.message]); continue; }
    let turned = null; const twin = clips.find(c => (turned = sameMotion(c.K, K)) !== null); if(twin){ dropped.push([s, twin, turned]); continue; }
    const id0 = groupId(g, s.folder, s.file), n = (ids.get(id0) || 0) + 1; ids.set(id0, n); clips.push({ id: n > 1 ? id0 + '-' + n : id0, group: g, src: s.folder + '/' + s.file, K }); }
  if(opt.info) info(op, clips[0].K.T, clips);
  const parts = [Buffer.alloc(8)], meta = []; let at = 8, keys = 0, frames = 0;
  for(const c of clips){ const K = opt.fps20 && c.K.dur > C.fps20 ? resample(c.K, 20) : c.K, P = packClip(K); keys += P.keys; frames += K.N * (C.bones.length + 1);
    const m = { id: c.id, g, src: c.src, dur: +K.dur.toFixed(4), fps: K.fps, frames: K.N, loop: K.loop, speed: +K.speed.toFixed(3), travels: K.mode === 'root' };
    if(K.dir) m.dir = K.dir.map(v => +v.toFixed(3)); if(K.yaw) m.yaw = +K.yaw.toFixed(1); if(K.climb) m.rise = +K.rise.toFixed(3); if(K.tail) m.tail = K.tail;
    if(K.root){ const e = K.root[K.N - 1]; m.end = [+e[0].toFixed(3), +e[1].toFixed(3)]; }   // where a travelling clip's root ends (x, z metres on his scale): the length of a lunge without decoding it
    m.o = at; m.b = P.buf.length; parts.push(P.buf); at += P.buf.length; meta.push(m); }
  const bin = Buffer.concat(parts); bin.write('XKA1', 0, 'latin1'); bin.writeUInt16LE(meta.length, 4); bin.writeUInt16LE(C.bones.length, 6);
  const out = path.resolve(ROOT, opt.out || C.out), ixf = path.join(out, 'index.json'); if(!fs.existsSync(ixf)){ console.error('--group adds to an existing library: no ' + ixf); process.exit(2); }
  const index = JSON.parse(fs.readFileSync(ixf, 'utf8')); index.clips = index.clips.filter(c => c.g !== g).concat(meta);
  index.groups[g] = { file: g + '.bin', bytes: bin.length, clips: meta.length, sha: crypto.createHash('sha1').update(bin).digest('hex').slice(0, 12) };
  const J = JSON.stringify(index).replace(/\{"id"/g, '\n{"id"').replace(/\],"groups"/, '],\n"groups"').replace(/\]\}$/, '\n]}\n'); fs.writeFileSync(path.join(out, g + '.bin'), bin); fs.writeFileSync(ixf, J);
  fs.writeFileSync(path.join(out, 'SOURCE-' + g + '.txt'), ['XUNG KÍCH — assets/anim/' + g + '.bin: the ' + g + ' motions (BLADE 1)', '',
    'Source: Mixamo (mixamo.com), downloaded 2026-11-26 with the owner\'s Adobe account — default X Bot character, FBX binary, 30 fps (the Great Sword pack, the Pro Melee Axe pack,',
    'the Pro Sword and Shield pack and single sword / staff motions). Licence and treatment: as assets/anim/SOURCE.txt (retargeted to the game\'s own skeleton, fingers dropped,',
    'root travel split from the pose, keyframes reduced, packed) — these are not the Mixamo files.', 'Rebuild: node tools/mixamo-clips.mjs --group ' + g + ' --root <folder holding the bundle-* folders>', '',
    clips.length + ' clips. ' + dropped.length + ' sources dropped as the same motion as one already taken:', ...dropped.map(([s, t, y]) => '  ' + s.folder + '/' + s.file + '  =  ' + t.id + (Math.abs(y) > 1 ? '  (facing ' + y.toFixed(0) + '° round)' : '')), '',
    skipped.length + ' files skipped:', ...skipped.map(([s, why]) => '  ' + s.folder + '/' + s.file + '  —  ' + why), ''].join('\n'));
  let all = J.length; for(const k in index.groups) all += index.groups[k].bytes;
  console.log(`group ${g}: sources ${src.length} → clips ${clips.length} (dropped as the same motion ${dropped.length}, skipped ${skipped.length}) · ${g}.bin ${bin.length} bytes · index.json ${J.length} bytes · the whole library ${all} bytes (budget ${C.budget.all})`);
  console.log(`  keys kept ${keys} of ${frames} (${(100 * keys / frames).toFixed(1)}%) · loop ${meta.filter(m => m.loop).length} · in place ${meta.filter(m => m.dir).length} · root track ${meta.filter(m => m.travels).length}`);
  for(const [s, why] of skipped) console.log('  skipped', s.folder + '/' + s.file, '—', why); for(const [s, t, y] of dropped) console.log('  dropped', s.folder + '/' + s.file, '= ' + t.id);
  if(all > C.budget.all){ console.error('✗ over the size budget'); process.exitCode = 1; } }
function sourceTxt(clips, dropped, skipped, fps20){ return [
  'XUNG KÍCH — assets/anim: the soldier\'s motion library', '',
  'Source: Mixamo (mixamo.com), downloaded 2026-11-26 with the owner\'s Adobe account — default X Bot character, FBX binary, 30 fps, keyframe reduction off',
  '(the files still miss frames where Mixamo retimed a motion: the converter fills them from the curves and closes the cycles whose last frames are missing).',
  'Licence: Adobe\'s Mixamo terms allow use inside a game, commercial games included; they do not allow redistributing the files as an asset pack.',
  'These files are not the Mixamo files: tools/mixamo-clips.mjs retargeted every motion to the game\'s own skeleton (assets/models/real/operator.glb),',
  'dropped the fingers, split the root travel from the pose, reduced the keyframes (' + Object.entries(C.tolDeg).map(([k, v]) => k + ' ' + v + '°').join(', ') + '; hips ' + C.tolPos * 1000 + ' mm)',
  'and packed them (int16 smallest-three quaternions) into one file per group' + (fps20 ? '; clips over ' + C.fps20 + ' s outside loco/stance were resampled to 20 fps' : '') + '.',
  'Rebuild: node tools/mixamo-clips.mjs <folder holding the 14 pack-*/bundle-* folders>', '',
  clips.length + ' clips. ' + dropped.length + ' sources dropped as the same motion as one already taken (compared after retargeting, joint by joint):',
  ...dropped.map(([s, t, y]) => '  ' + s.folder + '/' + s.file + '  =  ' + t.id + '  (' + t.src + (Math.abs(y) > 1 ? ', facing ' + y.toFixed(0) + '° round' : '') + ')'), '',
  skipped.length + ' files skipped:', ...skipped.map(([s, why]) => '  ' + s.folder + '/' + s.file + '  —  ' + why), ''].join('\n'); }
function info(op, T, clips){ console.log('scale: legs', T.kLeg.toFixed(4), 'hip height', T.kHip.toFixed(4), '(operator', T.hipH.toFixed(3), 'm, source', T.srcHipH.toFixed(3), 'm) · joints rest at', JSON.stringify(Object.fromEntries(FEET.map(f => [f, +T.restY[f].toFixed(3)]))), 'source', JSON.stringify(Object.fromEntries(FEET.map(f => [f, +T.srcY[f].toFixed(3)]))));
  for(const b in C.align) console.log('  reference', b.padEnd(13), 'swung', (qang(T.ref[b], op.rest[b].q) * R2D).toFixed(1) + '° from rest');
  for(const c of clips) console.log(' ', c.id.padEnd(58), c.K.mode.padEnd(8), c.K.loop ? 'loop' : '    ', 'n', String(c.K.N).padStart(4), 'v', c.K.speed.toFixed(2), 'far', c.K.far.toFixed(2), 'yaw', c.K.yaw.toFixed(0).padStart(4), 'seam', c.K.seam.toFixed(1).padStart(6), 'step', c.K.step.toFixed(1).padStart(5), c.K.closed ? 'closed+' + c.K.closed : '', c.K.tail && !c.K.closed ? 'blend' + c.K.tail : '', c.K.climb ? 'climb ' + c.K.rise.toFixed(2) : '', ' ←', c.src); }

// ---------- verify: the packed clips through the game's loader + three's mixer, against the source rig ----------
const PICK = [['run forward', /^loco-rifle-run-forward$/], ['strafe left', /^loco-rifle-walk-left$|strafe-left/], ['crouch walk', /^loco-rifle-walk-crouch-forward$/], ['prone forward', /^stance-prone-forward/], ['grenade throw', /^combat-grenade-throw/], ['death', /^react-death-front/],
  ['climb', /^air-climb-up-wall/], ['hit reaction', /^react-hit-react/], ['kneel to prone', /kneel-to-prone/], ['rifle idle', /^stance-rifle-idle/], ['reload', /^combat-reload/], ['vault', /^air-vault/]];
const GPICK = [['sword idle', /-gs-idle$/], ['sword slash', /-gs-slash$/], ['sword run', /-gs-run$/], ['sword jump attack', /-gs-jump-attack$/], ['sword draw', /-gs-draw-1$/], ['axe idle', /-axe-idle$/], ['axe horizontal', /-axe-attack-horizontal$/], ['axe 360 high', /-axe-attack-360-high$/],
  ['axe run', /-axe-run-forward$/], ['axe combo', /-axe-combo-attack-1$/], ['one-hand slash', /-ss-slash$/], ['sheath', /-misc-sheath-sword-1$/]];
const SEG = { 'upper arm': ['Arm', 'ForeArm'], forearm: ['ForeArm', 'Hand'], hand: ['Hand', 'HandMiddle1'], thigh: ['UpLeg', 'Leg'], shin: ['Leg', 'Foot'] }, COLS = ['upper arm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'spine', 'head'];
async function verify(fbxRoot, opt){ const out = path.resolve(ROOT, opt.out || C.out);
  if(opt.three){ const url = pathToFileURL(path.join(path.resolve(opt.three), 'build/three.module.js')).href; register('data:text/javascript,' + encodeURIComponent(`export function resolve(s, c, n){ return s === 'three' ? { url: ${JSON.stringify(url)}, shortCircuit: true } : n(s, c); }`)); }
  let THREE, LIB; try{ THREE = await import('three'); LIB = await import(pathToFileURL(path.join(ROOT, 'src/actors/anim-lib.js')).href); }catch(e){ console.error('--verify needs three r169: pass --three <a folder holding build/three.module.js> (npm install three@0.169.0 somewhere outside the repo)\n  ' + e.message); process.exit(2); }
  const { ANIMLIB } = await import(pathToFileURL(path.join(ROOT, 'config.js')).href);
  globalThis.fetch = async u => { const f = String(u).startsWith(ANIMLIB.path) ? path.join(out, String(u).slice(ANIMLIB.path.length).split('?')[0]) : path.join(ROOT, String(u).split('?')[0]); if(!fs.existsSync(f)) return { ok: false, status: 404 }; const b = fs.readFileSync(f); return { ok: true, status: 200, json: async () => JSON.parse(b.toString()), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
  // the operator as three sees him: bones named as GLTFLoader names them, at rest
  const { j } = readGlb(path.join(ROOT, C.operator)), nodes = j.nodes.map(n => { const o = new THREE.Bone(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if(n.translation) o.position.fromArray(n.translation); if(n.rotation) o.quaternion.fromArray(n.rotation); return o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach(c => nodes[i].add(nodes[c]))); const scene = new THREE.Group(), rootG = new THREE.Group(); scene.add(rootG); for(const i of j.scenes[0].nodes) rootG.add(nodes[i]);
  const bone = n => nodes.find(o => o.name === C.prefix + n), wp = n => bone(n).getWorldPosition(new THREE.Vector3()).toArray(), wq = n => bone(n).getWorldQuaternion(new THREE.Quaternion()).toArray();
  const warns = []; const cw = console.warn, ce = console.error; console.warn = console.error = (...a) => warns.push(a.join(' '));
  const GR = opt.group ? [opt.group] : C.groups, ok = await Promise.all(GR.map(g => LIB.loadAnimGroup(g))); console.warn = cw; console.error = ce; if(ok.some(v => !v)){ console.error('✗ a group did not load:', GR.filter((g, i) => !ok[i]).join(', '), warns.join(' | ')); process.exit(1); }
  const op = operatorRig(), index = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8')), mixer = new THREE.AnimationMixer(rootG), rootAt = [0, 0, 0], rigs = new Map();
  const ALL = index.clips.filter(c => !opt.group || c.g === opt.group), picks = (opt.group ? GPICK : PICK).map(([label, re]) => [label, ALL.find(c => re.test(c.id))]); for(const [label, c] of picks) if(!c) console.log('  (no clip for "' + label + '")');
  const measure = (m, fracs) => { const clip = LIB.animClip(m.id), info = LIB.animInfo(m.id); if(!clip || !info || info.id !== m.id || clip.userData !== info) throw new Error('animClip / animInfo gave nothing for ' + m.id);
    let rig = rigs.get(m.src); if(!rig){ rig = fbxRig(path.join(fbxRoot, m.src)); rigs.set(m.src, rig); } const T = reference(op, fbxPose(rig, SRC, 'T'), rig.unit), last = m.frames - 1 - (m.tail || 0);
    const act = mixer.clipAction(clip); act.setLoop(THREE.LoopOnce); act.clampWhenFinished = true; act.play(); const R = { limb: [], trunk: [], sole: [], srcSole: [], low: Infinity, bound: clip.tracks.length };
    for(const fr of fracs){ const t = Math.min(last, Math.round(fr * (m.frames - 1))) / m.fps; act.time = t; mixer.update(0); rootG.position.set(0, 0, 0); rootG.quaternion.set(0, 0, 0, 1);   // on a frame, and never in the frames the converter rebuilt at the end of a loop
      if(m.travels){ LIB.animRootAt(m.id, t, rootAt); rootG.position.set(rootAt[0], 0, rootAt[1]); rootG.quaternion.fromArray(qyaw(rootAt[2])); } scene.updateMatrixWorld(true);
      const S = fbxPose(rig, SRC, rig.start + t);
      for(const side of ['Left', 'Right']){ for(const k in SEG){ const [a, b] = SEG[k]; R.limb.push([k, vang(sub(wp(side + b), wp(side + a)), sub(S[side + b].p, S[side + a].p))]); } R.trunk.push(['foot', qang(qmul(wq(side + 'Foot'), T.refInv[side + 'Foot']), qmul(S[side + 'Foot'].q, T.srcTinv[side + 'Foot'])) * R2D]); }
      for(const [k, b] of [['spine', 'Spine2'], ['head', 'Head']]) R.trunk.push([k, qang(qmul(wq(b), T.refInv[b]), qmul(S[b].q, T.srcTinv[b])) * R2D]);
      let lo = Infinity, slo = Infinity; for(const f of FEET){ const y = wp(f)[1]; R.low = Math.min(R.low, y); lo = Math.min(lo, y - T.restY[f]); slo = Math.min(slo, S[f].p[1] * rig.unit - T.srcY[f]); } R.sole.push(lo); R.srcSole.push(slo * T.kHip); }
    act.stop(); mixer.uncacheClip(clip); return R; };
  const stat = a => a.length ? [a.reduce((s, v) => s + v, 0) / a.length, Math.max(...a)] : [0, 0], fmt = ([mean, max]) => (mean.toFixed(2) + ' / ' + max.toFixed(2)).padStart(12);
  console.log('RETARGET CHECK — packed clips decoded by src/actors/anim-lib.js, played by THREE.AnimationMixer on the operator\'s bones, against the FBX rig at the same time.');
  console.log('degrees, mean / max over 5 frames (at 10 30 50 70 90% of the clip) · arms, hands, legs: joint-to-joint direction in the world, both sides · foot, spine, head: the bone\'s whole turn away from its own reference pose');
  console.log('clip'.padEnd(15) + 'id'.padEnd(40) + COLS.map(s => s.padStart(12)).join('') + '   lowest foot joint, cm over the ground');
  const F5 = [0.1, 0.3, 0.5, 0.7, 0.9], all = { limb: [], trunk: [] }; let fail = 0;
  for(const [label, m] of picks){ if(!m) continue; const R = measure(m, F5), col = k => stat([...R.limb, ...R.trunk].filter(e => e[0] === k).map(e => e[1])); all.limb.push(...R.limb.map(e => e[1])); all.trunk.push(...R.trunk.map(e => e[1]));
    console.log(label.padEnd(15) + m.id.padEnd(40) + COLS.map(k => fmt(col(k))).join('') + '   ' + (R.low * 100).toFixed(1)); }
  const A = stat([...all.limb, ...all.trunk]); console.log('the 12 clips: mean ' + A[0].toFixed(2) + '°, max ' + A[1].toFixed(2) + '° (target: mean ≤ 3°, max ≤ 8°)'); if(A[0] > 3 || A[1] > 8) fail++;
  // every clip, 9 frames each: the same errors; the feet of the locomotion group against the source's own clearance; no foot under the ground anywhere
  const F9 = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], E = [], worst = [], feet = { lo: Infinity, hi: -Infinity, d: 0, id: '' }, under = { y: Infinity, id: '' }; let tracks = 0, tails = 0;
  for(const m of ALL){ const R = measure(m, F9), e = [...R.limb, ...R.trunk].map(x => x[1]); E.push(...e); worst.push([Math.max(...e), m.id]); tracks += R.bound; if(m.tail) tails++; if(R.low < under.y){ under.y = R.low; under.id = m.id; }
    if(m.g === 'loco' || (opt.group && m.loop && m.speed > 0.5)) R.sole.forEach((v, i) => { feet.lo = Math.min(feet.lo, v); feet.hi = Math.max(feet.hi, v); const d = Math.abs(v - R.srcSole[i]); if(d > feet.d){ feet.d = d; feet.id = m.id; } }); }
  const AA = stat(E); worst.sort((a, b) => b[0] - a[0]);
  console.log(`all ${ALL.length} clips × 9 frames (${tails} loops had their last 1–4 frames rebuilt to close: those frames are not compared): mean ${AA[0].toFixed(2)}°, max ${AA[1].toFixed(2)}° · worst: ${worst.slice(0, 4).map(w => w[1] + ' ' + w[0].toFixed(1) + '°').join(', ')}`);
  console.log(`loco: the lowest foot joint against the height it stands at: ${(feet.lo * 100).toFixed(1)} … ${(feet.hi * 100).toFixed(1)} cm · furthest from the source's own (scaled) clearance ${(feet.d * 100).toFixed(1)} cm (${feet.id}) · lowest foot joint in any clip: ${(under.y * 100).toFixed(1)} cm over the ground (${under.id})`);
  console.log(`tracks ${tracks}, all bound to operator bones by three (PropertyBinding warnings: ${warns.length})${warns.length ? ' — ' + warns.slice(0, 3).join(' | ') : ''}`);
  if(AA[0] > 3 || AA[1] > 8 || warns.length || feet.d > 0.08 || under.y < -0.05) fail++; console.log(fail ? '✗ verify: outside the targets' : '✓ verify: retarget within the targets'); process.exitCode = fail ? 1 : 0; }

// ---------- main ----------
const argv = process.argv.slice(2), opt = {}, rest = []; for(let i = 0; i < argv.length; i++){ const a = argv[i]; if(a === '--three' || a === '--out' || a === '--group' || a === '--root') opt[a.slice(2)] = argv[++i]; else if(a.startsWith('--')) opt[a.slice(2)] = true; else rest.push(a); }
if(opt.root && !rest[0]) rest[0] = opt.root;
if(!rest[0] || !fs.existsSync(rest[0])){ console.error('usage: node tools/mixamo-clips.mjs <fbxRoot> [--verify --three <three module dir>] [--out <dir>] [--info] [--fps20] · add a group: --group <name> --root <dir>'); process.exit(2); }
if(opt.verify) await verify(path.resolve(rest[0]), opt); else if(opt.group) convertGroup(path.resolve(rest[0]), opt); else convert(path.resolve(rest[0]), opt);
