// world/real-city.js — Z264 THE REAL CITY: Meshy-generated buildings (glass tower, stone office tower, apartment tower, mid-rise hotel with shops,
// a row of tube houses) and vehicles (sedan, taxi, SUV, van, city bus). The buildings are cut into floor slices by height so they join the city's
// breakable-floor system (world/city.js: each slice is one piece — shells bring them down one by one from the top); the vehicles replace the
// procedural cars along the kerbs (crushable, burn out as before). The files load in the background from boot, so they are ready by the time a
// city battlefield is built; a city built before that keeps its procedural buildings and cars.
import * as THREE from 'three';
import { REALCITY } from '../../config.js';
import { loadGLTF } from '../hub.js';

const M = {}, BANDS = new Map(); let _p = null;
export const REAL_CITY = M;
export function loadRealCity(){ if(_p) return _p; if(typeof window === 'undefined' || /proccity/.test(location.search + location.hash)) return (_p = Promise.resolve(false));
  const keys = Object.keys(REALCITY.blds).concat(Object.keys(REALCITY.cars));
  return (_p = Promise.all(keys.map(k => loadGLTF(k).then(gl => [k, gl]))).then(L => { for(const [k, gl] of L){ if(gl) try{ M[k] = prep(gl, k); } catch(e){ console.warn('[city]', k, e.message); } } return true; })); }
export const realCityReady = () => Object.keys(M).length > 0;

// one geometry: position / normal / uv only, its foot on y = 0, centred, turned so its front faces +Z (config yaw), and its size
function prep(gl, k){ let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
  let g = src.geometry.clone().applyMatrix4(src.matrixWorld); g = g.index ? g.toNonIndexed() : g;
  for(const a of Object.keys(g.attributes)) if(a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
  const S = REALCITY.blds[k] || REALCITY.cars[k]; if(S.yaw) g.rotateY(S.yaw);
  g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.computeBoundingBox(); g.computeBoundingSphere();
  const mat = src.material.clone(); mat.envMapIntensity = S.env ?? REALCITY.env; if(S.tint) mat.color.setRGB(...S.tint);
  return { key:k, geo:g, mat, size:g.boundingBox.getSize(new THREE.Vector3()) }; }

// a building's model cut into n floor slices (triangles by the height of their middle), in its own frame
export function floorBands(m, n){ const key = m.key + ':' + n; if(BANDS.has(key)) return BANDS.get(key);
  const P = m.geo.attributes.position, T = P.count / 3, H = m.size.y, lists = Array.from({ length:n }, () => []);
  for(let t = 0; t < T; t++){ const cy = (P.getY(t * 3) + P.getY(t * 3 + 1) + P.getY(t * 3 + 2)) / 3; lists[Math.min(n - 1, Math.max(0, Math.floor(cy / H * n)))].push(t); }
  const out = lists.map(tris => { const g = new THREE.BufferGeometry();
    for(const a of ['position', 'normal', 'uv']){ const A = m.geo.attributes[a]; if(!A) continue; const sz = A.itemSize, arr = new Float32Array(tris.length * 3 * sz); let o = 0;
      for(const t of tris) for(let j = 0; j < 3; j++) for(let q = 0; q < sz; q++) arr[o++] = A.getComponent(t * 3 + j, q);
      g.setAttribute(a, new THREE.BufferAttribute(arr, sz)); }
    return g; });
  BANDS.set(key, out); return out; }
// a building model for a role ('tower', 'apartment', 'row'), or null
export function pickBuilding(role){ const ks = Object.keys(REALCITY.blds).filter(k => REALCITY.blds[k].role === role && M[k]); return ks.length ? M[ks[(Math.random() * ks.length) | 0]] : null; }
// the vehicle model for a procedural car body name, or null
export function carModel(name){ const k = REALCITY.carFor[name]; return k && M[k] ? M[k] : null; }
