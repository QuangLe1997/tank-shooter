// world/real-props.js — Z252 REAL COVER: the Meshy-generated low-poly cover pieces (sandbags, concrete block, container, crates, drums, jersey barrier, logs, pipes, dragon's teeth, tyres, car wreck) put in place of the procedural ones — each turned so its long side runs the procedural piece's way, scaled uniformly into the same footprint (height capped) and stood on the same ground line, so placement, collision and the hit / crumble code are untouched. Every placed piece is tracked; when the files arrive they all swap geometry and material (a piece's own hit-flash material keeps its paint and damage tint). The Czech hedgehog (Meshy could not build it) and the HESCO (the generated one read as shiny panels) stay procedural. Until loaded, or on failure, the procedural pieces stay.
import * as THREE from 'three';
import { REALPROP, REALROCK } from '../../config.js';
import { COVER_GEO, COVER_K, COVER_MAT, coverGeo, loadGLTF } from '../hub.js';

export const REAL_COVER = { live:new Set(), done:false, fits:{} };
let _p = null;
// every cover mesh, however it was made, registers here (added → tracked, removed → dropped)
export function trackCover(m){ m.addEventListener('added', () => REAL_COVER.live.add(m)); m.addEventListener('removed', () => REAL_COVER.live.delete(m)); return m; }
export function loadRealCover(){
  if(_p) return _p;
  if(typeof window === 'undefined') return (_p = Promise.resolve(false));
  const files = k => (REALPROP.variants[k] || [k]);   // Z420 a kind with variants loads each (its first is the kind's own file)
  return (_p = Promise.all(REALPROP.kinds.map(k => Promise.all(files(k).map(v => loadGLTF('cover_' + v))).then(gls => [k, gls]))).then(list => {
    for(const [k, gls] of list){ const fits = gls.map(gl => gl && fitCover(k, gl)).filter(Boolean); if(fits.length) swapCover(k, fits); }
    REAL_COVER.done = true; return true; })); }

function fitCover(k, gl){
  const pb = coverGeo(k).boundingBox || (coverGeo(k).computeBoundingBox(), coverGeo(k).boundingBox);
  let g = null, src = null; gl.scene.updateMatrixWorld(true);
  gl.scene.traverse(o => { if(o.isMesh && !g){ g = o.geometry.clone().applyMatrix4(o.matrixWorld); src = o.material; } }); if(!g) return null;
  g.computeBoundingBox(); let b = g.boundingBox;
  const pw = pb.max.x - pb.min.x, pd = pb.max.z - pb.min.z, ph = pb.max.y - pb.min.y, long = (w, d) => w > d * 1.25 ? 'x' : d > w * 1.25 ? 'z' : '-';
  { const lp = long(pw, pd), lm = long(b.max.x - b.min.x, b.max.z - b.min.z); if(lp !== '-' && lm !== '-' && lp !== lm){ g.rotateY(Math.PI / 2); g.computeBoundingBox(); b = g.boundingBox; } }   // long side the same way
  const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y, F = REALPROP.fit, s = REALPROP.trueH[k] ? REALPROP.trueH[k] / COVER_K / h : Math.min(pw / w, pd / d, ph * REALPROP.hMax / h) * F;   // (Z420 trueH: a piece stood at its real height, m)
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  if(REALPROP.stretch.includes(k)) g.scale(pw / w * F, ph / h * F, pd / d * F); else g.scale(s, s, s); g.translate((pb.min.x + pb.max.x) / 2, pb.min.y, (pb.min.z + pb.max.z) / 2);
  g.computeBoundingBox(); g.computeBoundingSphere();
  const mat = src.clone(); mat.envMapIntensity = REALPROP.env; mat.vertexColors = false;
  if(REALPROP.tint[k]) mat.color.setHex(REALPROP.tint[k]);
  if(REALPROP.matte.includes(k)){ mat.metalness = 0; mat.metalnessMap = null; }
  return { geo:g, mat }; }
// Z420 fits = [{ geo, mat }, …] — a piece with a variant index (userData.cv) takes that one; the kind's shared geometry / material are the first
function swapCover(k, fits){ const { geo, mat } = fits[0], sh = REALPROP.shade[k];
  COVER_GEO[k] = geo; COVER_MAT[k] = mat; REAL_COVER.fits[k] = fits;
  for(const m of REAL_COVER.live){ let q = m; while(q.parent) q = q.parent; if(q.type !== 'Scene'){ REAL_COVER.live.delete(m); continue; }   // (Z396 a piece gone with its group)
    if(m.userData.kind !== k) continue; const F = fits[(m.userData.cv ?? 0) % fits.length]; m.geometry = F.geo;
    const old = m.material; if(old && old.userData && old.userData.own){ const n = F.mat.clone(); n.userData.own = true; if(sh) n.color.setScalar(m.userData.cb ?? sh[1]); else n.color.copy(old.color); m.material = n; } else m.material = F.mat; } }   // (a textured box keeps its own paint, only its shade)   // the old material is left to the GC: disposing it mid-compileAsync breaks three's readiness poll
// Z420 a piece of a kind with variants (the container) picks its box and its shade when it is made; once the files are in it wears that box at once
export function coverVariant(m){ const k = m.userData.kind, V = REALPROP.variants[k]; if(!V) return m; const sh = REALPROP.shade[k];
  m.userData.cv = (Math.random() * V.length) | 0; if(sh) m.userData.cb = sh[0] + Math.random() * (sh[1] - sh[0]);
  const F = REAL_COVER.fits[k]; if(!F) return m; const f = F[m.userData.cv % F.length]; m.geometry = f.geo;
  if(m.material && m.material.userData && m.material.userData.own){ const n = f.mat.clone(); n.userData.own = true; if(sh) n.color.setScalar(m.userData.cb); m.material = n; } else m.material = f.mat;
  return m; }

// Z429 REAL ROCKS: a rock scan in the drawn lump's place — the lump's unit radius → the scan's half-width, its foot sunk REALROCK.sink of its height (the
//   drawn lump stood r × 0.2 up: that is taken back); one geometry and one material per scan and land (tinted per land), shared by every stone
const RR = {};
function rockGeo(k, bn){ const id = k + ':' + bn; if(RR[id]) return RR[id];
  return (RR[id] = loadGLTF('cover_' + k).then(gl => { if(!gl) return null; let g = null, src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !g){ g = o.geometry.clone().applyMatrix4(o.matrixWorld); src = o.material; } }); if(!g) return null;
    g.computeBoundingBox(); let b = g.boundingBox; const s = 2 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z); g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(s, s, s); g.computeBoundingBox(); b = g.boundingBox;
    g.translate(0, -0.19 - REALROCK.sink * (b.max.y - b.min.y), 0); g.computeBoundingBox(); g.computeBoundingSphere();
    const mat = src.clone(); mat.envMapIntensity = REALROCK.env; mat.vertexColors = false; mat.metalness = 0; mat.metalnessMap = null; if(REALROCK.tint[bn]) mat.color.setHex(REALROCK.tint[bn]); return { geo:g, mat }; })); }
const rockKinds = bn => REALROCK.biomes[bn] || REALROCK.biomes._;
// a boulder (world/cover.js): it takes one of its land's rock scans once it is in
export function dressRock(m, bn){ if(typeof window === 'undefined') return m; const L = rockKinds(bn), k = L[(Math.random() * L.length) | 0];
  Promise.resolve().then(() => rockGeo(k, bn)).then(R => { if(R && m.parent){ m.geometry = R.geo; m.material = R.mat; } }); return m; }   // (after the modules are all in: the field is laid while they load)
// the loose stones (world/decor.js instanced lumps): each instanced set takes one of the land's scans
export function realStones(im, i, bn){ if(typeof window === 'undefined') return; const L = rockKinds(bn); Promise.resolve().then(() => rockGeo(L[i % L.length], bn)).then(R => { if(R && im.parent){ im.geometry = R.geo; im.material = R.mat; } }); }
