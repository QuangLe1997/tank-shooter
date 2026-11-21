// render/near-detail.js — Z395 NEAR DETAIL: every model the game ships was packed small (1K maps), so up close a palm's fronds fray white at their
//   edges, sandbags and tents smear, a rifle in the soldier's hands is a blur. The originals' maps (assets/models/real/hd, tools/hd-maps.mjs: the same
//   UV atlas at 2K) are swapped in while the camera is near something wearing them, and handed back once it has gone: the GPU holds the sharp maps
//   only for the few models in view and close. Nothing else changes — the shipped mesh, its material, its shader, its instancing, its shadow.
//   How: three's per-object hook (onBeforeRender, called for each object as it is drawn in the main pass) notes which objects wear a tagged map;
//   every NEARDETAIL.every s the nearest of them (each instance of an instanced mesh) is measured from the camera against its own size. Within reach
//   (radius × rK, between min and at m; the maxKeys closest models at most) the key's maps are fetched (WebP, decoded off the main thread) and put
//   in, one texture a frame; past reach × out — or crowded out by closer ones — for hold s they go back and the sharp ones are freed. A texture is never resized in place (three's storage is immutable): it is disposed and given a new Source, so the next draw
//   uploads it afresh. Desktop only; `?nohd` switches it off (before / after).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { NEARDETAIL } from '../../config.js';
import { MOBILE, camera, loadGLTF, scene } from '../hub.js';

const DIR = 'assets/models/real/hd/', SRC = new WeakMap(), KEYS = {}, QUEUE = [], SLOT = { map:'map', nrm:'normalMap' };
let INDEX = null, _last = 0, ON = null, _ldr = null; const GEO = {}, FRAME = [], SHAPES = new Set(), ASIS = {};
const on = () => ON ?? (ON = typeof window !== 'undefined' && NEARDETAIL.on && !MOBILE && !/nohd/.test(location.search + location.hash) && install());   // (decided on first use: the hub is whole by then)
const index = () => INDEX || (INDEX = fetch(DIR + 'index.json').then(r => r.ok ? r.json() : {}).catch(() => ({})));
export const NEAR_DETAIL = { keys:KEYS, shapes:SHAPES, swaps:0, off:false };   // (off: every key handed back at once — a before / after toggle for screenshots)

// a model just loaded (actors/models.js loadGLTF): its maps are tagged with the key, when the key has sharp ones (a clone shares its maps' Source)
export function nearTag(key, gl){ if(!gl || !on()) return; index().then(IX => { const have = IX[key]; if(!have || KEYS[key]) return;
  const R = KEYS[key] = { key, srcs:[], seen:new Set(), tex:new Set(), near:false, farFor:0, hd:null, d:Infinity }, mats = [], A = gl.parser && gl.parser.associations;
  gl.scene.traverse(o => { if(o.isMesh) for(const m of [].concat(o.material)) if(m && !mats.includes(m)) mats.push(m); });
  for(const m of mats){ const a = A && A.get(m), mi = a && a.materials != null ? a.materials : mats.indexOf(m);   // (the material's index in the file)
    for(const [s, slot] of Object.entries(SLOT)){ const t = m[slot]; if(!t || !have.includes(mi + '.' + s) || SRC.has(t.source)) continue;
      const e = { R, file:`${DIR}${key}.${mi}.${s}.webp`, lo:t.source, hi:null }; R.srcs.push(e); SRC.set(t.source, e); } } }); }

// the whole shape of a model (hd/<key>.glb: the original's triangles, meshopt-compressed) for whoever draws it whole up close — attributes back to
//   plain floats, so it can be cut and scaled like the shipped one; null when the key has none (or on a phone / with ?nohd)
export function nearModel(key){ if(GEO[key]) return GEO[key]; if(!on()) return Promise.resolve(null);
  return (GEO[key] = index().then(IX => (IX[key] || []).includes('geo') ? (_ldr || (_ldr = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder))).loadAsync(DIR + key + '.glb') : null).then(gl => {
    if(gl) gl.scene.traverse(o => { if(!o.isMesh) return; const g = o.geometry;
      for(const [n, a] of Object.entries(g.attributes)) if(a.normalized || a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array)){ const f = new Float32Array(a.count * a.itemSize);
        for(let i = 0; i < a.count; i++) for(let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent ? a.getComponent(i, c) : [a.getX(i), a.getY(i), a.getZ(i), a.getW(i)][c];
        g.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize)); } });
    return gl; }).catch(e => { console.warn('[near detail]', key, e && e.message); return null; })); }
// a job run once a frame just before the battle is drawn (the near trees pick their few closest here)
export function nearFrame(fn){ if(on()) FRAME.push(fn); }

// (every object as it is drawn in the main pass: is it wearing a tagged map?)
function see(o, m){ if(!m) return; for(const s of ['map', 'normalMap']){ const t = m[s], e = t && SRC.get(t.source); if(e){ e.R.seen.add(o); e.R.tex.add(t); } } }
// how near the nearest drawn wearer of a key is, as a share of its own reach: distance from the camera to its surface ÷ clamp(radius × rK, min, at) —
//   a barracks is worth its sharp maps from 30 m, a sandbag only within a few (each instance of an instanced mesh; a skinned body by where it stands)
const _c = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Sphere();
const reach = r => Math.min(NEARDETAIL.at, Math.max(NEARDETAIL.min, r * NEARDETAIL.rK)), score = (d, r) => Math.max(0, d - r) / reach(r);
function nearest(R){ _c.setFromMatrixPosition(camera.matrixWorld); let d = Infinity;
  for(const o of R.seen){ const g = o.geometry; if(!g) continue; if(!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere;
    if(o.isInstancedMesh){ const n = Math.min(o.count, NEARDETAIL.maxInst); for(let i = 0; i < n; i++){ o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld); _s.copy(bs).applyMatrix4(_m); const x = score(_c.distanceTo(_s.center), _s.radius); if(x < d) d = x; } }
    else if(o.isSkinnedMesh){ _p.setFromMatrixPosition(o.matrixWorld); const x = score(_c.distanceTo(_p), 1); if(x < d) d = x; }
    else { _s.copy(bs).applyMatrix4(o.matrixWorld); const x = score(_c.distanceTo(_s.center), _s.radius); if(x < d) d = x; } }   // (a NaN never wins)
  return d; }
// every texture wearing this map takes the other source (a fresh upload: disposed, then a new Source)
function wear(e, src){ for(const t of e.R.tex) if(t.source !== src && (t.source === e.lo || t.source === e.hi)){ t.dispose(); t.source = src; t.needsUpdate = true; } }
const bitmap = f => fetch(f).then(r => r.ok ? r.blob() : null).then(b => b && window.createImageBitmap(b, { imageOrientation:'none' })).catch(() => null);   // (as three's GLTFLoader reads its own)
// (the sharp source is watched too: what wears it is still near)
function swapIn(R){ R.near = true; if(!R.hd || R.srcs.some(e => !e.hi && !e.ask)) R.hd = Promise.all(R.srcs.map(e => e.hi || e.ask || (e.ask = bitmap(e.file).then(b => { e.ask = null; if(b){ e.hi = new THREE.Source(b); SRC.set(e.hi, e); } }))));
  R.hd.then(() => { if(R.near) for(const e of R.srcs) if(e.hi) QUEUE.push([e, 1]); }); }
function swapOut(R){ R.near = false; for(const e of R.srcs) QUEUE.push([e, 0]); }

// Z395b NEAR SHAPES: a mesh a system has placed (a camp's barracks, a parked truck, a ruin, an animal, the gun in the soldier's hands) drawn from its
//   whole original (hd/<key>.glb) while the camera is within its reach. prep(gl) makes of the original what the system made of the shipped file (the
//   same frame and size — usually the system's own preparing function run on it); only the mesh's geometry is swapped, its material, place, collision
//   and everything that refers to the mesh stay. The NEARDETAIL.shapes closest at most; handed back past reach × out for hold s.
export function nearShape(m, key, prep){ if(m && on()) SHAPES.add({ m, key, prep, lo:null, hd:null, ask:null, near:false, farFor:0, d:Infinity }); return m; }
// prep for a system that draws the file's own mesh (a scene clone, a rigged body): the original's mesh brought into the shipped mesh's frame
//   (a rigged one is already in it: the same bind pose and bones); null when either file has more than one mesh
export const asShipped = key => gl => ASIS[key] || (ASIS[key] = loadGLTF(key).then(lg => { const one = r => { const L = []; r.updateMatrixWorld(true); r.traverse(o => { if(o.isMesh) L.push(o); }); return L.length === 1 ? L[0] : null; };
  const a = lg && one(lg.scene), b = one(gl.scene); if(!a || !b || !!a.isSkinnedMesh !== !!b.isSkinnedMesh) return null; if(b.isSkinnedMesh) return b.geometry;
  const g = b.geometry.clone().applyMatrix4(a.matrixWorld.clone().invert().multiply(b.matrixWorld)); g.computeBoundingSphere(); return g; }));
// (is the mesh in the battle and shown? a hidden gun or a fallen-away camp is not near)
function shown(o){ for(let p = o; p; p = p.parent){ if(!p.visible) return false; if(p === scene) return true; } return false; }
function shapes(dt){ const cand = [];
  for(const S of SHAPES){ const m = S.m; if(!m.parent){ SHAPES.delete(S); continue; } const g = S.lo || m.geometry; S.d = Infinity;
    if(!NEAR_DETAIL.off && shown(m) && g){ if(!g.boundingSphere) g.computeBoundingSphere(); _s.copy(g.boundingSphere).applyMatrix4(m.matrixWorld); S.d = score(_c.distanceTo(_s.center), _s.radius); if(S.d < 1) cand.push(S); } }
  cand.sort((a, b) => a.d - b.d); const want = new Set(cand.slice(0, NEARDETAIL.shapes));
  for(const S of SHAPES){ if(want.has(S)){ S.farFor = 0; if(!S.near) shapeIn(S); continue; } if(!S.near) continue;
    S.farFor = NEAR_DETAIL.off ? 1e9 : S.farFor + dt; if(S.farFor > NEARDETAIL.hold){ S.farFor = 0; shapeOut(S); } } }
function shapeIn(S){ S.near = true; S.ask = S.ask || nearModel(S.key).then(gl => gl ? S.prep(gl) : null).catch(() => null);
  S.ask.then(hd => { if(!hd || !S.near || S.m.geometry === hd) return; S.hd = hd; S.lo = S.m.geometry; S.m.geometry = hd; NEAR_DETAIL.swaps++; }); }
function shapeOut(S){ S.near = false; if(S.hd && S.m.geometry === S.hd) S.m.geometry = S.lo; }   // (unless the system has given the mesh another shape since)

function tick(){ for(const f of FRAME) f(camera); const q = QUEUE.shift();
  if(q){ const [e, hi] = q; if(!!hi === e.R.near && e.hi){ wear(e, hi ? e.hi : e.lo); NEAR_DETAIL.swaps++;   // (one texture a frame: each is an upload)
      if(!hi){ const h = e.hi; e.hi = null; setTimeout(() => h.data && h.data.close && h.data.close(), 2000); } } }   // (the sharp copy freed once handed back)
  const now = performance.now(); if(now - _last < NEARDETAIL.every * 1000) return; const dt = _last ? (now - _last) / 1000 : 0; _last = now;
  const L = []; for(const R of Object.values(KEYS)){ R.d = R.seen.size && !NEAR_DETAIL.off ? nearest(R) : Infinity; R.seen.clear(); if(NEAR_DETAIL.off && R.near) swapOut(R); else L.push(R); }
  _c.setFromMatrixPosition(camera.matrixWorld); shapes(dt);
  L.sort((a, b) => a.d - b.d);   // (the closest first: at most maxKeys models wear their sharp maps at once — the GPU's memory)
  L.forEach((R, i) => { if(!R.near){ if(R.d < 1 && i < NEARDETAIL.maxKeys) swapIn(R); return; }
    for(const e of R.srcs) if(e.hi && !QUEUE.some(q => q[0] === e) && [...R.tex].some(t => t.source === e.lo)) QUEUE.push([e, 1]);   // (a wearer that came in since: a clone made while sharp)
    R.farFor = R.d > NEARDETAIL.out || i >= NEARDETAIL.maxKeys ? R.farFor + dt : 0; if(R.farFor > NEARDETAIL.hold){ R.farFor = 0; swapOut(R); } }); }

function install(){ const base = THREE.Mesh.prototype.onBeforeRender;   // (three's own is a no-op; an object with a hook of its own keeps it and is simply not watched)
  THREE.Mesh.prototype.onBeforeRender = function(r, sc, cam, geo, mat, grp){ see(this, mat); return base.call(this, r, sc, cam, geo, mat, grp); };
  const prev = scene.onBeforeRender; scene.onBeforeRender = function(...a){ tick(); return prev.apply(this, a); }; return true; }
