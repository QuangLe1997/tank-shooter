#!/usr/bin/env node
// tools/boss-pack.mjs — BOSS 2 THE FORT BOSSES PACKED (maintainer tool; the game never loads it): a Meshy community character auto-rigged by Mixamo (binary
//   FBX, T pose, the standard mixamorig skeleton, skin) → assets/models/real/boss/<name>.glb: ONE skinned mesh on the Mixamo skeleton (bones named as
//   GLTFLoader names them: 'mixamorigHips' …), ONE material (colour + normal, JPEG ≤ 2K), metres, feet on y = 0, facing +Z (the game's forward) —
//   and HIS OWN MOTIONS: the clips the fight asks for (BOSS2_CLIPS below), taken from the game's Mixamo library (assets/anim — already retargeted to the
//   operator's skeleton by tools/mixamo-clips.mjs) and carried over to this skeleton here, frame by frame:
//     the operator's WORLD turn away from his T-pose reference, D(t) = Qop(t)·Qref⁻¹, is laid over this character's own T-pose rest, Qb(t) = D(t)·Qb_rest,
//     then brought back to local. Qref = the operator's rest with arms, forearms, thighs and shins swung to point where THIS character's do in his T pose,
//     the hands turned to his (as tools/mixamo-clips.mjs does against X Bot); trunk, head, clavicles and feet keep their rest. The hips' path is scaled by
//     his hip height over the operator's (index.json scale.hip). The clips stay on the spot (the game moves the man); fingers keep their rest.
//   node tools/boss-pack.mjs [name …] --src <dir of <name>.fbx> --tex <dir of <name>/<name>.jpg + <name>/work/<name>_normal.jpg> --deps <dir> [--out <dir>]
//   (<deps>: npm i --prefix <dir> three@0.169.0 · ImageMagick's `magick` on the PATH re-encodes the maps)
//   Prints one JSON line a character: triangles, joints, height, hip height, bytes, and how far his soles stray from the ground over the clips.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SPEC = {
  'titan-exosuit': { q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.45, credit:'"Titan Exosuit" — Meshy Community https://www.meshy.ai/posts/019c1b94-cd21-78aa-a5d7-ddcac384780c (task 019c1ae1-3337-73b3-8026-551fa4996b53), CC0' },
  'demon-commander': { fbx:'demon-commander', col:'demon-commander-apose/demon-commander-apose.jpg', nrm:null, extras:'demon-commander-extras.obj', extrasTris:12000, q:[84], px:2048, rough:0.55, metal:0.15,
    credit:'"Female Demonic Commnader" by jurafjvs — Meshy Community https://www.meshy.ai/posts/019baa52-110f-77fd-b517-9b36cb1999c3 (task 019baa33-b2d5-7167-932f-a29f3b3dc88e), CC0' },
  // BOSS 3 the second pack (one fitting boss a battlefield): --src ~/Downloads/3dnew/boss2/rigged --tex <boss-prep>/out2
  '01-steel-titanium-guardian': { col:'01-steel-titanium-guardian/01-steel-titanium-guardian-v2.jpg', nrm:'01-steel-titanium-guardian/work/01-steel-titanium-guardian-v2_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.45, metal:0.6, credit:'"Titanium Guardian" by Ghostface — Meshy Community https://www.meshy.ai/posts/019bde48-b500-78a5-90e4-1638a7007140 (task 019bde44-0a09-7637-b111-78567fcc12de), CC0' },
  '02-robot-mining-killer': { col:'02-robot-mining-killer/02-robot-mining-killer.jpg', nrm:'02-robot-mining-killer/work/02-robot-mining-killer_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"mining killer robot from a sci-fi dream, high sharp resolution texture, hyperrealistic,…" by jurafjvs — Meshy Community https://www.meshy.ai/posts/01975b7f-41c4-77b1-83b6-29981c8e22f0 (task 0197596c-53ad-7fb9-a7b0-896fdd6766b4), CC0' },
  '03-specops-cbrn-operator': { col:'03-specops-cbrn-operator/03-specops-cbrn-operator.jpg', nrm:'03-specops-cbrn-operator/work/03-specops-cbrn-operator_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"CBRN Tactical Operator" by TechnoSyndrome — Meshy Community https://www.meshy.ai/posts/019fa7e3-4f14-75cd-be80-f7bbe0a51145 (task 019fa7e0-a33e-7587-a6f6-0375aef6f068), CC0' },
  '04-heavy-green-mech': { col:'04-heavy-green-mech/04-heavy-green-mech.jpg', nrm:'04-heavy-green-mech/work/04-heavy-green-mech_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"Green Heavy Mech" by kaesar3d — Meshy Community https://www.meshy.ai/posts/019f2e6b-9490-7d71-8bae-20ceaa73a2b8 (task 019f27c2-d01c-7591-950d-7c8dcaa2b484), CC0' },
  '05-arctic-explorer': { col:'05-arctic-explorer/05-arctic-explorer.jpg', nrm:'05-arctic-explorer/work/05-arctic-explorer_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"Arctic Explorer" by Illustros — Meshy Community https://www.meshy.ai/posts/019bd0a0-6b87-73e0-9222-ad72ccece0d3 (task 019bd09c-0e2a-7ca0-b7a9-d03483adcd03), CC0' },
  '06-desert-wastelander': { col:'06-desert-wastelander/06-desert-wastelander.jpg', nrm:'06-desert-wastelander/work/06-desert-wastelander_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"Wastelander - Survivor" by bitstyler — Meshy Community https://www.meshy.ai/posts/019b958e-8214-7e49-8332-94ba4bf50c8b (task 019b958b-1c6f-7da9-afd4-a0fcd1789ca0), CC0' },
  '07-female-soldier': { col:'07-female-soldier/07-female-soldier.jpg', nrm:'07-female-soldier/work/07-female-soldier_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"full body T-pose of a female soldier, 28 years old, athletic build, strict T-pose,… - Femalesoldier" by davincix2 — Meshy Community https://www.meshy.ai/posts/01a11b00-68c5-7130-ada9-ed2a7ac048db (task 01a11a60-7a4d-772a-b678-a764431de7bb), CC0' },
  '08-female-cyborg-trooper': { col:'08-female-cyborg-trooper/08-female-cyborg-trooper.jpg', nrm:'08-female-cyborg-trooper/work/08-female-cyborg-trooper_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"T-PEA Female Trooper Basic" by bureauofsabotage — Meshy Community https://www.meshy.ai/posts/01a02e58-330b-76e3-a4b6-d22fc73b7972 (task 01a02e40-eb50-709f-9f94-33fc4f78e4c1), CC0' },
  '09-female-spy': { col:'09-female-spy/09-female-spy.jpg', nrm:'09-female-spy/work/09-female-spy_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"Female Spy, wearing a black tactical suit, detailed face and hair, high resolution, and her… - Agent" by rudrakshpal32 — Meshy Community https://www.meshy.ai/posts/0196ce59-bc71-7198-8c9d-c8f590ecb072 (task 0194919b-f89c-7de6-8122-b3fb28311fa1), CC0' },
  '10-magma-inferno-sentinel': { col:'10-magma-inferno-sentinel/10-magma-inferno-sentinel.jpg', nrm:'10-magma-inferno-sentinel/work/10-magma-inferno-sentinel_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"Inferno Sentinel" by Furio — Meshy Community https://www.meshy.ai/posts/01963544-39e1-7c95-8c91-5e112d8686af (task 01963540-0fc7-7900-afef-2de7b8884f43), CC0' },
  '12-shadow-stalker': { col:'12-shadow-stalker/12-shadow-stalker.jpg', nrm:'12-shadow-stalker/work/12-shadow-stalker_normal.jpg', q:[82, 80], px:2048, npx:1536, rough:0.55, metal:0.35, credit:'"Son of the Mother Zone" by 79873151621a — Meshy Community https://www.meshy.ai/posts/01a10af6-8ed8-71ab-81c1-892f364bcc91 (task 01a10af1-ea50-7092-98a5-8d63fb7a0d8f), CC0' },
  'cyborg-revenant': { q:[82, 80], px:2048, npx:1536, rough:0.5, metal:0.5, credit:'"Cyborg Revenant" — Meshy Community https://www.meshy.ai/posts/019c3529-6f12-7a46-84f2-d573ff136f8b (task 019c3287-cc50-76e5-a2a5-9430656e1882), CC0' },
};
// the motions a fort boss plays (src/campaign/fort-boss.js FORTBOSS.anim): game name → library id
export const BOSS2_CLIPS = { walk:'loco-rifle-walk-forward', run:'loco-rifle-run-forward', aim:'stance-rifle-aim-idle-stand', fire:'combat-fire-rifle-stand', fireWalk:'combat-fire-rifle-walk',
  crouch:'stance-idle-crouch-aim', hit:'react-hit-react-hold-rifle', stagger:'react-injured-stumble-idle', throw:'combat-toss-grenade-rifle-aimed', deathF:'react-death-front', deathB:'react-death-back' };
const BONES = ['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'];
const ALIGN = { LeftArm:'LeftForeArm', LeftForeArm:'LeftHand', RightArm:'RightForeArm', RightForeArm:'RightHand', LeftUpLeg:'LeftLeg', LeftLeg:'LeftFoot', RightUpLeg:'RightLeg', RightLeg:'RightFoot' };
// ---------- quaternions [x,y,z,w], vectors ----------
const qmul = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qinv = q => [-q[0], -q[1], -q[2], q[3]], qnorm = q => { const l = Math.hypot(...q) || 1; return q.map(v => v / l); };
const qrot = (q, v) => { const [x, y, z, w] = q, ix = w*v[0]+y*v[2]-z*v[1], iy = w*v[1]+z*v[0]-x*v[2], iz = w*v[2]+x*v[1]-y*v[0], iw = -x*v[0]-y*v[1]-z*v[2]; return [ix*w-iw*x-iy*z+iz*y, iy*w-iw*y-iz*x+ix*z, iz*w-iw*z-ix*y+iy*x]; };
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]], dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); }, cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const qfromTo = (a, b) => { const d = dot(a, b); if(d < -0.999999){ const ax = unit(Math.abs(a[0]) > 0.9 ? cross(a, [0,1,0]) : cross(a, [1,0,0])); return [ax[0], ax[1], ax[2], 0]; } const c = cross(a, b); return qnorm([c[0], c[1], c[2], 1 + d]); };
const qslerp = (a, b, t) => { let c = dot(a, b) + a[3]*b[3], s = 1; if(c < 0){ c = -c; s = -1; } let k0 = 1 - t, k1 = t; if(c < 0.9999){ const th = Math.acos(c), sn = Math.sin(th); k0 = Math.sin(k0 * th) / sn; k1 = Math.sin(k1 * th) / sn; } k1 *= s; return qnorm([a[0]*k0+b[0]*k1, a[1]*k0+b[1]*k1, a[2]*k0+b[2]*k1, a[3]*k0+b[3]*k1]); };
// ---------- the library (assets/anim, the format of src/actors/anim-lib.js decodeAnimClip) ----------
const Q1 = Math.SQRT1_2;
function decode(dv, o, bones){ const N = dv.getUint16(o, true), fps = dv.getUint8(o + 2), flags = dv.getUint8(o + 3), wide = N > 256; o += 4;
  const times = n => { const t = []; for(let i = 0; i < n; i++) t.push((wide ? dv.getUint16(o + i * 2, true) : dv.getUint8(o + i)) / fps); o += wide ? n * 2 : n; return t; };
  const vec = () => { const n = dv.getUint16(o, true), m = o + 2; o += 26; const t = times(n), v = []; for(let i = 0; i < n; i++){ const k = []; for(let c = 0; c < 3; c++) k.push(dv.getFloat32(m + c * 4, true) + dv.getFloat32(m + 12 + c * 4, true) * dv.getUint16(o + (i * 3 + c) * 2, true)); v.push(k); } o += n * 6; return { t, v }; };
  const quat = () => { const n = dv.getUint16(o, true); o += 2; const t = times(n), v = [];
    for(let i = 0; i < n; i++, o += 6){ const w2 = dv.getUint16(o + 4, true), m = w2 >> 14, a = dv.getInt16(o, true) / 32767 * Q1, b = dv.getInt16(o + 2, true) / 32767 * Q1, c = ((w2 & 0x3fff) << 18 >> 18) / 8191 * Q1, d = Math.sqrt(Math.max(0, 1 - a*a - b*b - c*c));
      v.push([m === 0 ? d : a, m === 0 ? a : m === 1 ? d : b, m <= 1 ? b : m === 2 ? d : c, m === 3 ? d : c]); } return { t, v }; };
  const hips = vec(), root = flags & 1 ? vec() : null, rot = []; for(let i = 0; i < bones; i++) rot.push(quat()); return { frames:N, fps, loop:!!(flags & 2), hips, root, rot }; }
const at = (tr, t, isQ) => { const T = tr.t, V = tr.v, n = T.length; if(n === 1 || t <= T[0]) return V[0]; if(t >= T[n - 1]) return V[n - 1]; let i = 0; while(T[i + 1] < t) i++; const u = (t - T[i]) / (T[i + 1] - T[i]);
  return isQ ? qslerp(V[i], V[i + 1], u) : V[i].map((v, c) => v + (V[i + 1][c] - v) * u); };
function library(){ const dir = path.join(ROOT, 'assets/anim'), J = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')), BIN = {};
  const clip = id => { const m = J.clips.find(c => c.id === id); if(!m) throw new Error('no library clip ' + id); if(!BIN[m.g]){ const b = fs.readFileSync(path.join(dir, J.groups[m.g].file)); BIN[m.g] = new DataView(b.buffer, b.byteOffset, b.byteLength); }
    return { m, D:decode(BIN[m.g], m.o, J.bones.length) }; };
  if(J.bones.join() !== BONES.join()) throw new Error('library bones differ from this tool\'s list'); return { J, clip }; }
// ---------- the operator's rest (the library's skeleton), out of the glb's JSON ----------
function operator(){ const b = fs.readFileSync(path.join(ROOT, 'assets/models/real/operator.glb')), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()), par = {};
  j.nodes.forEach((n, i) => (n.children || []).forEach(c => { par[c] = i; }));
  const world = i => { const n = j.nodes[i], p = par[i] === undefined ? { p:[0,0,0], q:[0,0,0,1] } : world(par[i]); return { p:add(p.p, qrot(p.q, n.translation || [0,0,0])), q:qmul(p.q, n.rotation || [0,0,0,1]) }; };
  const idx = n => j.nodes.findIndex(x => x.name === 'mixamorig:' + n), R = { rest:{}, parent:{} };
  for(const n of [...BONES, ...['Left', 'Right'].flatMap(s => ['HandMiddle1', 'HandIndex1', 'HandPinky1'].map(k => s + k))]){ const i = idx(n); if(i < 0) throw new Error('operator: no ' + n); R.rest[n] = world(i); R.parent[n] = (j.nodes[par[i]].name || '').replace('mixamorig:', ''); }
  R.arm = world(par[idx('Hips')]); return R; }
// the operator's reference pose against THIS character's T pose (src = his rest, world)
function reference(op, src){ const ref = {}; for(const b of BONES) ref[b] = op.rest[b].q;
  for(const b in ALIGN){ const c = ALIGN[b]; ref[b] = qmul(qfromTo(unit(sub(op.rest[c].p, op.rest[b].p)), unit(sub(src[c].p, src[b].p))), op.rest[b].q); }
  const fin = src.LeftHandMiddle1 ? 'Middle1' : 'Index1', twist = !!src.LeftHandPinky1;   // (a rig with the index finger only: the hand by its index, no knuckle-line turn)
  for(const h of ['LeftHand', 'RightHand']){ if(!src[h + 'Index1']){ const fa = h.replace('Hand', 'ForeArm'); ref[h] = qmul(qfromTo(unit(sub(op.rest[h].p, op.rest[fa].p)), unit(sub(src[h].p, src[fa].p))), op.rest[h].q); continue; }   // (BOSS 3 a rig with no finger bones: the hand swung as its forearm is)
    const D = P => unit(sub(P[h + fin].p, P[h].p)), X = (P, d) => { const a = sub(P[h + 'Pinky1'].p, P[h + 'Index1'].p), k = dot(a, d); return unit([a[0] - d[0]*k, a[1] - d[1]*k, a[2] - d[2]*k]); };
    const ds = D(src), a1 = qfromTo(D(op.rest), ds), xt = !twist ? null : X({ [h + 'Pinky1']:{ p:qrot(a1, op.rest[h + 'Pinky1'].p) }, [h + 'Index1']:{ p:qrot(a1, op.rest[h + 'Index1'].p) } }, ds), xs = twist ? X(src, ds) : null, th = twist ? Math.atan2(dot(cross(xt, xs), ds), dot(xt, xs)) : 0, sn = Math.sin(th / 2);
    ref[h] = qmul(qmul([ds[0]*sn, ds[1]*sn, ds[2]*sn, Math.cos(th / 2)], a1), op.rest[h].q); }
  return ref; }

// ---------- the character ----------
async function load(THREE, file){ THREE.TextureLoader.prototype.load = function(){ return new THREE.Texture(); }; globalThis.window = globalThis.window || globalThis; globalThis.self = globalThis.self || globalThis;
  const { FBXLoader } = await import(pathToFileURL(path.join(DEPS, 'node_modules/three/examples/jsm/loaders/FBXLoader.js')).href);
  const buf = fs.readFileSync(file), wr = console.warn; console.warn = () => {}; let root; try{ root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), ''); }finally{ console.warn = wr; }
  root.updateMatrixWorld(true); const sk = []; root.traverse(o => { if(o.isSkinnedMesh) sk.push(o); }); if(sk.length !== 1) throw new Error(file + ': ' + sk.length + ' skinned meshes (one expected)'); return sk[0]; }
async function pack(THREE, name, S){ const mesh = S.mesh, G = mesh.geometry, bones = mesh.skeleton.bones, nb = bones.length, short = b => b.name.replace(/^mixamorig:?/, '');
  // the bind pose, world: W = bindMatrix · boneInverse⁻¹ (the FBX root carries no transform; the mesh is in metres already)
  const W = bones.map((b, i) => new THREE.Matrix4().copy(mesh.bindMatrix).multiply(new THREE.Matrix4().copy(mesh.skeleton.boneInverses[i]).invert()));
  const wp = W.map(m => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return { p:p.toArray(), q:[q.x, q.y, q.z, q.w], s:s.toArray() }; });
  const byName = {}; bones.forEach((b, i) => { byName[short(b)] = i; }); for(const b of BONES) if(byName[b] === undefined) throw new Error(name + ': no bone ' + b);
  const parentOf = i => { const p = bones[i].parent; return p && p.isBone ? bones.indexOf(p) : -1; };
  // the mesh welded (FBXLoader hands it out as a triangle soup), positions through the bind matrix
  const P = G.attributes.position, N = G.attributes.normal, U = G.attributes.uv, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, BM = mesh.bindMatrix, NM = new THREE.Matrix3().getNormalMatrix(BM);
  const map = new Map(), pos = [], nor = [], uv = [], jo = [], we = [], idx = [], v = new THREE.Vector3(), n = new THREE.Vector3();
  for(let i = 0; i < P.count; i++){ v.fromBufferAttribute(P, i).applyMatrix4(BM); n.fromBufferAttribute(N, i).applyMatrix3(NM).normalize(); const u0 = U.getX(i), u1 = 1 - U.getY(i);   // (FBX v runs up; glTF's down)
    const w = [SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)], j = [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)], ws = w[0] + w[1] + w[2] + w[3] || 1, wq = w.map(x => Math.round(x / ws * 255)); let d = 255 - wq.reduce((a, b) => a + b, 0); wq[wq.indexOf(Math.max(...wq))] += d;
    const key = [v.x, v.y, v.z].map(x => Math.round(x * 1e5)).join() + '|' + [n.x, n.y, n.z].map(x => Math.round(x * 1e3)).join() + '|' + Math.round(u0 * 1e5) + ',' + Math.round(u1 * 1e5);
    let k = map.get(key); if(k === undefined){ k = pos.length / 3; map.set(key, k); pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uv.push(u0, u1); jo.push(...j); we.push(...wq); } idx.push(k); }
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for(let i = 0; i < pos.length; i += 3) for(let c = 0; c < 3; c++){ lo[c] = Math.min(lo[c], pos[i + c]); hi[c] = Math.max(hi[c], pos[i + c]); }
  const lift = -lo[1]; for(let i = 1; i < pos.length; i += 3) pos[i] += lift; for(const w of wp) w.p[1] += lift; lo[1] = 0; hi[1] += lift;   // feet on y = 0
  // the joints: node TRS in the bind pose (local to the parent joint; the root joint local to the scene) + the inverse bind matrices
  const nodes = bones.map((b, i) => { const pi = parentOf(i), pw = pi < 0 ? { p:[0,0,0], q:[0,0,0,1] } : wp[pi], iq = qinv(pw.q); return { name:short(b) === b.name ? b.name : 'mixamorig' + short(b), translation:qrot(iq, sub(wp[i].p, pw.p)), rotation:qnorm(qmul(iq, wp[i].q)), children:[] }; });
  bones.forEach((b, i) => { const pi = parentOf(i); if(pi >= 0) nodes[pi].children.push(i); });
  const ibm = []; for(const w of wp){ const m = new THREE.Matrix4().compose(new THREE.Vector3(...w.p), new THREE.Quaternion(...w.q), new THREE.Vector3(1, 1, 1)).invert(); ibm.push(...m.elements); }
  // HIS MOTIONS out of the library
  const op = operator(), lib = library(), src = {}; for(const b of [...BONES, ...['Left', 'Right'].flatMap(s => ['HandMiddle1', 'HandIndex1', 'HandPinky1'].map(k => s + k))]) if(byName[b] !== undefined) src[b] = wp[byName[b]];
  const ref = reference(op, src), refI = {}; for(const b of BONES) refI[b] = qinv(ref[b]);
  const hipK = src.Hips.p[1] / lib.J.scale.hip, anims = []; let soleLo = Infinity, soleHi = -Infinity;
  for(const [game, id] of Object.entries(BOSS2_CLIPS)){ const { m, D } = lib.clip(id), fps = D.fps, F = Math.max(2, Math.round(m.dur * fps) + 1), times = [], H = [], R = BONES.map(() => []);
    for(let f = 0; f < F; f++){ const t = Math.min(m.dur, f / fps); times.push(t); const Qo = {}, Qb = {};
      BONES.forEach((b, i) => { const L = at(D.rot[i], t, true), pw = b === 'Hips' ? op.arm.q : Qo[op.parent[b]]; Qo[b] = qmul(pw, L); });
      BONES.forEach(b => { Qb[b] = qmul(qmul(Qo[b], refI[b]), src[b].q); });
      BONES.forEach((b, i) => { const bi = byName[b], pi = parentOf(bi), pq = pi < 0 ? [0,0,0,1] : (Qb[short(bones[pi])] || wp[pi].q); R[i].push(qnorm(qmul(qinv(pq), Qb[b]))); });
      const hp = add(op.arm.p, qrot(op.arm.q, at(D.hips, t, false))); H.push([hp[0] * hipK, hp[1] * hipK, hp[2] * hipK]);
      // his soles this frame (forward kinematics on his own bones): how far off the ground
      const wq = {}, wpos = {}; for(const b of BONES){ const bi = byName[b], pi = parentOf(bi), pn = pi < 0 ? null : short(bones[pi]);
        const pq = pn ? wq[pn] : [0,0,0,1], pp = pn ? wpos[pn] : [0,0,0], k = BONES.indexOf(b); wq[b] = qmul(pq, R[k][f]); wpos[b] = b === 'Hips' ? H[f] : add(pp, qrot(pq, nodes[bi].translation)); }
      if(!/death|throw|crouch/.test(game)){ const y = Math.min(wpos.LeftToeBase[1], wpos.RightToeBase[1], wpos.LeftFoot[1], wpos.RightFoot[1]); soleLo = Math.min(soleLo, y); soleHi = Math.max(soleHi, y); } }
    anims.push({ name:game, src:id, loop:D.loop, times, H, R }); }
  const roots = bones.map((b, i) => i).filter(i => parentOf(i) < 0);
  if(S.extras) await extras(THREE, S, { pos, nor, uv, jo, we, idx, nodes, ibm, wp, byName, hipY:src.Hips.p[1], lift });
  const nJ = nodes.length;
  return { roots, pos, nor, uv, jo, we, idx, nodes, ibm, nb:nJ, lo, hi, hipY:+src.Hips.p[1].toFixed(3), anims, sole:[+soleLo.toFixed(3), +soleHi.toFixed(3)], tris:idx.length / 3, verts:pos.length / 3 }; }
// ---------- BOSS 2 parts cut off before the auto-rig (wings, a tail: an OBJ in the same bind space as the FBX): simplified, each piece its own joint
//   (wingL / wingR on Spine2, tail on Hips — the game sways them), skinned whole to it ----------
async function extras(THREE, S, M){ const txt = fs.readFileSync(path.join(S.dir, S.extras), 'utf8'), V = [], T = [], N = [], F = [];
  for(const l of txt.split('\n')){ const a = l.trim().split(/\s+/); if(a[0] === 'v') V.push(a.slice(1, 4).map(Number)); else if(a[0] === 'vt') T.push(a.slice(1, 3).map(Number)); else if(a[0] === 'vn') N.push(a.slice(1, 4).map(Number));
    else if(a[0] === 'f'){ const c = a.slice(1).map(x => x.split('/').map(n => +n - 1)); for(let k = 1; k + 1 < c.length; k++) F.push(c[0], c[k], c[k + 1]); } }
  // corners → welded vertices (position, uv, normal), then simplified with the UV seams held
  const map = new Map(), P = [], U = [], Nn = [], PI = [], I = []; for(const c of F){ const key = c.join('/'); let k = map.get(key); if(k === undefined){ k = P.length / 3; map.set(key, k); P.push(...V[c[0]]); U.push(T[c[1]][0], 1 - T[c[1]][1]); Nn.push(...(N[c[2]] || [0, 1, 0])); PI.push(c[0]); } I.push(k); }
  const { MeshoptSimplifier:MS } = await import(pathToFileURL(path.join(DEPS, 'node_modules/meshoptimizer/index.js')).href); await MS.ready;
  const [si] = MS.simplify(new Uint32Array(I), new Float32Array(P), 3, Math.min(I.length, (S.extrasTris || 12000) * 3), 0.01, ['LockBorder']);
  // the pieces: connected by shared positions; a piece low on his back (its middle under the hips + 0.1 m) is the tail, the others the wings by side
  const par = PI.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i])), byPos = new Map(); PI.forEach((p, i) => { const r = byPos.get(p); if(r === undefined) byPos.set(p, i); else par[find(i)] = find(r); });
  for(let t = 0; t < si.length; t += 3){ par[find(si[t])] = find(si[t + 1]); par[find(si[t + 1])] = find(si[t + 2]); }
  const lift = M.lift, comp = new Map(); for(const i of si){ const r = find(i); let c = comp.get(r); if(!c){ c = { n:0, s:[0, 0, 0], v:new Set() }; comp.set(r, c); } if(!c.v.has(i)){ c.v.add(i); c.n++; for(let k = 0; k < 3; k++) c.s[k] += P[i * 3 + k]; } }
  const kind = c => { const y = c.s[1] / c.n + lift, x = c.s[0] / c.n; return y < M.hipY + 0.1 && Math.abs(x) < 0.25 ? 'tail' : x > 0 ? 'wingL' : 'wingR'; };   // (his left is +X)
  const groups = { wingL:[], wingR:[], tail:[] }; for(const c of comp.values()) groups[kind(c)].push(...c.v);
  const parentJ = { wingL:'Spine2', wingR:'Spine2', tail:'Hips' }, out = { tris:si.length / 3, joints:{} }, jointOf = new Map();
  for(const [g, vs] of Object.entries(groups)){ if(!vs.length) continue; const ys = vs.map(i => P[i * 3 + 1] + lift), xs = vs.map(i => Math.abs(P[i * 3]));
    const jp = M.wp[M.byName[parentJ[g]]].p, dj = i => Math.hypot(P[i * 3] - jp[0], P[i * 3 + 1] + lift - jp[1], P[i * 3 + 2] - jp[2]), dmin = Math.min(...vs.map(dj));
    const pick = g === 'tail' ? vs.filter(i => dj(i) < dmin + 0.05) : vs.filter(i => Math.abs(P[i * 3]) < Math.min(...xs) + 0.05), root = [0, 1, 2].map(k => pick.reduce((s, i) => s + P[i * 3 + k] + (k === 1 ? lift : 0), 0) / pick.length);
    const pi = M.byName[parentJ[g]], pw = M.wp[pi], iq = qinv(pw.q), j = M.nodes.length; M.nodes.push({ name:'boss_' + g, translation:qrot(iq, sub(root, pw.p)), rotation:qnorm(iq), children:[] }); M.nodes[pi].children.push(j);
    M.ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -root[0], -root[1], -root[2], 1); for(const i of vs) jointOf.set(i, j); out.joints[g] = { n:vs.length, root:root.map(v => +v.toFixed(3)) }; }
  const remap = new Map(); for(const i of jointOf.keys()){ remap.set(i, M.pos.length / 3); M.pos.push(P[i * 3], P[i * 3 + 1] + lift, P[i * 3 + 2]); M.nor.push(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]); M.uv.push(U[i * 2], U[i * 2 + 1]); M.jo.push(jointOf.get(i), 0, 0, 0); M.we.push(255, 0, 0, 0); }
  for(const i of si) M.idx.push(remap.get(i)); console.error('extras', JSON.stringify(out)); return out; }
// ---------- the GLB ----------
function writeGlb(file, M, imgs, S, name){ const chunks = [], views = [], acc = []; let off = 0;
  const view = (buf, target, stride) => { const pad = (4 - (buf.length % 4)) % 4, b = Buffer.concat([buf, Buffer.alloc(pad)]); views.push({ buffer:0, byteOffset:off, byteLength:buf.length, ...(stride ? { byteStride:stride } : {}), ...(target ? { target } : {}) }); chunks.push(b); off += b.length; return views.length - 1; };
  const add = (arr, Type, ct, type, count, target, mm, norm) => { const bv = view(Buffer.from(new Type(arr).buffer), target), a = { bufferView:bv, componentType:ct, count, type }; if(mm){ a.min = mm[0]; a.max = mm[1]; } if(norm) a.normalized = true; acc.push(a); return acc.length - 1; };
  const nv = M.pos.length / 3, iPos = add(M.pos, Float32Array, 5126, 'VEC3', nv, 34962, [M.lo, M.hi]), iUv = add(M.uv.map(x => Math.max(0, Math.min(65535, Math.round(x * 65535)))), Uint16Array, 5123, 'VEC2', nv, 34962, null, true);   // (UVs as normalised 16-bit: core glTF)
  const nb8 = new Int8Array(nv * 4); for(let i = 0; i < nv; i++) for(let c = 0; c < 3; c++) nb8[i * 4 + c] = Math.round(Math.max(-1, Math.min(1, M.nor[i * 3 + c])) * 127);   // normals as normalised bytes, 4 a vertex (KHR_mesh_quantization)
  acc.push({ bufferView:view(Buffer.from(nb8.buffer), 34962, 4), componentType:5120, count:nv, type:'VEC3', normalized:true }); const iNor = acc.length - 1;
  const iJo = add(M.jo, Uint8Array, 5121, 'VEC4', nv, 34962), iWe = add(M.we, Uint8Array, 5121, 'VEC4', nv, 34962, null, true), iIdx = add(M.idx, nv < 65536 ? Uint16Array : Uint32Array, nv < 65536 ? 5123 : 5125, 'SCALAR', M.idx.length, 34963);
  const iIbm = add(M.ibm, Float32Array, 5126, 'MAT4', M.nb);
  const images = imgs.map(b => ({ bufferView:view(b), mimeType:'image/jpeg' }));
  const animations = M.anims.map(A => { const n = A.times.length, iT = add(A.times, Float32Array, 5126, 'SCALAR', n, null, [[A.times[0]], [A.times[n - 1]]]), samplers = [], channels = [];
    const ch = (node, pathK, arr, type) => { samplers.push({ input:iT, output:add(arr, Float32Array, 5126, type, n), interpolation:'LINEAR' }); channels.push({ sampler:samplers.length - 1, target:{ node, path:pathK } }); };
    ch(M.hipsNode, 'translation', A.H.flat(), 'VEC3'); BONES.forEach((b, k) => ch(M.boneNode[b], 'rotation', A.R[k].flat(), 'VEC4')); return { name:A.name, samplers, channels, extras:{ src:A.src, loop:A.loop } }; });
  const meshNode = M.nodes.length, J = { extensionsUsed:['KHR_mesh_quantization'], extensionsRequired:['KHR_mesh_quantization'], asset:{ version:'2.0', generator:'XUNG KICH tools/boss-pack.mjs', copyright:S.credit }, scene:0, scenes:[{ nodes:[...M.roots, meshNode] }],
    nodes:[...M.nodes, { name, mesh:0, skin:0 }], meshes:[{ name, primitives:[{ attributes:{ POSITION:iPos, NORMAL:iNor, TEXCOORD_0:iUv, JOINTS_0:iJo, WEIGHTS_0:iWe }, indices:iIdx, material:0 }] }],
    skins:[{ inverseBindMatrices:iIbm, joints:M.nodes.map((_, i) => i), skeleton:M.roots[0] }],
    materials:[{ name:name + '-mat', pbrMetallicRoughness:{ baseColorTexture:{ index:0 }, metallicFactor:S.metal, roughnessFactor:S.rough }, ...(imgs.length > 1 ? { normalTexture:{ index:1 } } : {}) }],
    textures:imgs.map((_, i) => ({ source:i, sampler:0 })), images, samplers:[{ magFilter:9729, minFilter:9987, wrapS:10497, wrapT:10497 }], animations, accessors:acc, bufferViews:views, buffers:[{ byteLength:off }] };
  const js = Buffer.from(JSON.stringify(J)), jp = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]), bin = Buffer.concat(chunks), hd = Buffer.alloc(12);
  hd.writeUInt32LE(0x46546c67, 0); hd.writeUInt32LE(2, 4); hd.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8), c2 = Buffer.alloc(8); c1.writeUInt32LE(jp.length, 0); c1.writeUInt32LE(0x4e4f534a, 4); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([hd, c1, jp, c2, bin])); return 12 + 8 + jp.length + 8 + bin.length; }
const jpeg = (file, px, q) => execFileSync('magick', [file, '-resize', px + 'x' + px + '>', '-strip', '-sampling-factor', '4:2:0', '-quality', String(q), 'jpg:-'], { maxBuffer:64 << 20 });

// ---------- main ----------
const argv = process.argv.slice(2), opt = {}, names = []; for(let i = 0; i < argv.length; i++){ if(argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else names.push(argv[i]); }
const DEPS = opt.deps; if(!DEPS || !opt.src || !opt.tex){ console.error('usage: node tools/boss-pack.mjs [name …] --src <fbx dir> --tex <maps dir> --deps <dir holding node_modules/three> [--out <dir>]'); process.exit(2); }
const THREE = await import(pathToFileURL(path.join(DEPS, 'node_modules/three/build/three.module.js')).href), OUT = opt.out || path.join(ROOT, 'assets/models/real/boss'); fs.mkdirSync(OUT, { recursive:true });
for(const name of (names.length ? names : Object.keys(SPEC))){ const S = SPEC[name]; if(!S){ console.error('no spec for ' + name); process.exitCode = 1; continue; }
  const mesh = await load(THREE, path.join(opt.src, (S.fbx || name) + '.fbx')), M = await pack(THREE, name, { mesh, ...S, dir:opt.src });
  M.boneNode = {}; M.nodes.forEach((n, i) => { M.boneNode[n.name.replace(/^mixamorig/, '')] = i; }); M.hipsNode = M.boneNode.Hips;
  const imgs = [jpeg(path.join(opt.tex, S.col || path.join(name, name + '.jpg')), S.px, S.q[0])]; if(S.nrm !== null) imgs.push(jpeg(path.join(opt.tex, S.nrm || path.join(name, 'work', name + '_normal.jpg')), S.npx || S.px, S.q[1]));
  const bytes = writeGlb(path.join(OUT, name + '.glb'), M, imgs, S, name);
  console.log(JSON.stringify({ name, tris:M.tris, verts:M.verts, joints:M.nb, h:+M.hi[1].toFixed(3), w:+(M.hi[0] - M.lo[0]).toFixed(3), hipY:M.hipY, clips:M.anims.length, sole:M.sole, maps:imgs.map(b => b.length), bytes })); }
