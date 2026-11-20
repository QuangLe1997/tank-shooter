// world/real-props.js — Z252 REAL COVER: the Meshy-generated low-poly cover pieces (sandbags, concrete block, container, crates, drums, jersey barrier, logs, pipes, dragon's teeth, tyres, car wreck) put in place of the procedural ones — each turned so its long side runs the procedural piece's way, scaled uniformly into the same footprint (height capped) and stood on the same ground line, so placement, collision and the hit / crumble code are untouched. Every placed piece is tracked; when the files arrive they all swap geometry and material (a piece's own hit-flash material keeps its paint and damage tint). The Czech hedgehog (Meshy could not build it) and the HESCO (the generated one read as shiny panels) stay procedural. Until loaded, or on failure, the procedural pieces stay.
import * as THREE from 'three';
import { REALPROP } from '../../config.js';
import { COVER_GEO, COVER_MAT, coverGeo, loadGLTF } from '../hub.js';

export const REAL_COVER = { live:new Set(), done:false };
let _p = null;
// every cover mesh, however it was made, registers here (added → tracked, removed → dropped)
export function trackCover(m){ m.addEventListener('added', () => REAL_COVER.live.add(m)); m.addEventListener('removed', () => REAL_COVER.live.delete(m)); return m; }
export function loadRealCover(){
  if(_p) return _p;
  if(typeof window === 'undefined') return (_p = Promise.resolve(false));
  return (_p = Promise.all(REALPROP.kinds.map(k => loadGLTF('cover_' + k).then(gl => [k, gl]))).then(list => {
    for(const [k, gl] of list){ const f = gl && fitCover(k, gl); if(f) swapCover(k, f.geo, f.mat); }
    REAL_COVER.done = true; return true; })); }

function fitCover(k, gl){
  const pb = coverGeo(k).boundingBox || (coverGeo(k).computeBoundingBox(), coverGeo(k).boundingBox);
  let g = null, src = null; gl.scene.updateMatrixWorld(true);
  gl.scene.traverse(o => { if(o.isMesh && !g){ g = o.geometry.clone().applyMatrix4(o.matrixWorld); src = o.material; } }); if(!g) return null;
  g.computeBoundingBox(); let b = g.boundingBox;
  const pw = pb.max.x - pb.min.x, pd = pb.max.z - pb.min.z, ph = pb.max.y - pb.min.y, long = (w, d) => w > d * 1.25 ? 'x' : d > w * 1.25 ? 'z' : '-';
  { const lp = long(pw, pd), lm = long(b.max.x - b.min.x, b.max.z - b.min.z); if(lp !== '-' && lm !== '-' && lp !== lm){ g.rotateY(Math.PI / 2); g.computeBoundingBox(); b = g.boundingBox; } }   // long side the same way
  const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y, s = Math.min(pw / w, pd / d, ph * REALPROP.hMax / h) * REALPROP.fit, F = REALPROP.fit;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  if(REALPROP.stretch.includes(k)) g.scale(pw / w * F, ph / h * F, pd / d * F); else g.scale(s, s, s); g.translate((pb.min.x + pb.max.x) / 2, pb.min.y, (pb.min.z + pb.max.z) / 2);
  g.computeBoundingBox(); g.computeBoundingSphere();
  const mat = src.clone(); mat.envMapIntensity = REALPROP.env; mat.vertexColors = false;
  if(REALPROP.tint[k]) mat.color.setHex(REALPROP.tint[k]);
  if(REALPROP.matte.includes(k)){ mat.metalness = 0; mat.metalnessMap = null; }
  return { geo:g, mat }; }
function swapCover(k, geo, mat){
  COVER_GEO[k] = geo; COVER_MAT[k] = mat;
  for(const m of REAL_COVER.live){ if(m.userData.kind !== k) continue; m.geometry = geo;
    const old = m.material; if(old && old.userData && old.userData.own){ const n = mat.clone(); n.userData.own = true; n.color.copy(old.color); m.material = n; } else m.material = mat; } }   // the old material is left to the GC: disposing it mid-compileAsync breaks three's readiness poll
