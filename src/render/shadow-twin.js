// render/shadow-twin.js — PERF 20 ONE SHADOW DRAW FOR A MANY-MATERIAL MODEL: a street lamp, a kerb set, a café table, a traffic car are one geometry in 4–6
//   material groups; three draws a shadow caster once PER GROUP, though the shadow pass paints depth only (the same depth material for every group) —
//   CITY sent ~60 such shadow draws a frame. Here each opaque caster of PERF_BUDGET.shadowTwin.minGroups groups or more stops casting itself, and a twin
//   casts for it: the same vertex buffers (and, for an instanced mesh, the same instance matrices) with no groups — ONE draw — on a layer only the
//   shadow cameras see. Every frame (scene.onBeforeRender) the twin takes the caster's place, count and visibility. The picture is the caster's own;
//   its shadow is the same depth. Leaf cards, cut-outs and see-through materials keep their own per-group shadows. ?notwin turns it off.
import * as THREE from 'three';
import { PERF_BUDGET } from '../../config.js';
import { renderer, scene } from '../hub.js';

const C = PERF_BUDGET.shadowTwin, OFF = typeof location === 'undefined' || /[?&]notwin\b/.test(location.search), LAYER = 5;
const TW = new Map(), ROOT = new THREE.Group(); ROOT.name = 'shadowTwins'; ROOT.userData.keep = true; ROOT.matrixAutoUpdate = false;
const DEPTH = new THREE.MeshBasicMaterial({ colorWrite:false }); let _scanT = 0;
export const STWIN = { n:0 };
const opaque = m => m && m.visible !== false && !m.transparent && !(m.alphaTest > 0) && !m.alphaMap && !m.alphaToCoverage && !m.map?.userData?.cut;
function eligible(o){ if(!o.isMesh || o.isSkinnedMesh || !o.castShadow || !Array.isArray(o.material) || !o.geometry || TW.has(o) || o.userData.twin) return false;
  const g = o.geometry; if(!g.groups || g.groups.length < C.minGroups || o.customDepthMaterial || o.morphTargetInfluences) return false;
  if(o.isInstancedMesh && !o.userData.viewOf && !o.userData.noView && o.instanceMatrix.usage === THREE.StaticDrawUsage) return false;   // (a field-wide family render/inst-view.js may still take: its views are twinned instead)
  if(Object.getOwnPropertyDescriptor(o, 'count')?.get) return false;   // (one it took: it draws nothing itself)
  if(!o.material.every(opaque)) return false; const sides = new Set(o.material.map(m => m.shadowSide ?? m.side)); if(sides.size > 1) return false;   // (one depth pass: one side for all)
  for(let p = o.parent; p; p = p.parent){ if(p === scene) return true; if(p === ROOT) return false; } return false; }
function twin(o){ const g = o.geometry, t = new THREE.BufferGeometry(); for(const k in g.attributes) t.setAttribute(k, g.attributes[k]); if(g.index) t.setIndex(g.index);
  if(!g.boundingSphere) g.computeBoundingSphere(); t.boundingSphere = g.boundingSphere; t.boundingBox = g.boundingBox; const s0 = o.material[0], mat = DEPTH.clone(); mat.side = s0.shadowSide ?? s0.side;
  const m = o.isInstancedMesh ? new THREE.InstancedMesh(t, mat, 1) : new THREE.Mesh(t, mat);
  if(o.isInstancedMesh){ m.instanceMatrix = o.instanceMatrix; m.count = 0; m.frustumCulled = o.frustumCulled; } else m.frustumCulled = o.frustumCulled;
  m.matrixAutoUpdate = false; m.castShadow = true; m.receiveShadow = false; m.layers.set(LAYER); m.userData.twin = true; m.userData.keep = true; m.raycast = () => {}; ROOT.add(m);
  o.castShadow = false; TW.set(o, { m, geo:g }); }
function drop(o, R){ R.m.removeFromParent(); R.m.material.dispose(); o.castShadow = true; TW.delete(o); }   // (its geometry shares the caster's buffers: never disposed here)
const inScene = o => { for(let p = o; p; p = p.parent) if(p === scene) return true; return false; };
const shown = o => { for(let q = o; q; q = q.parent){ if(q.visible === false) return false; if(q === scene) return true; } return false; };
function scan(){ scene.traverse(o => { if(eligible(o)) twin(o); if(o.isLight && o.shadow && o.shadow.camera) o.shadow.camera.layers.enable(LAYER); }); STWIN.n = TW.size; }   // (every shadow camera sees the twins' layer)
function frame(){ const now = performance.now() / 1000; if(now > _scanT){ _scanT = now + C.scan; scan(); }
  if(ROOT.parent !== scene) scene.add(ROOT);
  for(const [o, R] of TW){ if(!inScene(o) || o.geometry !== R.geo || !Array.isArray(o.material)){ drop(o, R); continue; }
    const m = R.m, on = shown(o) && (o.layers.mask & 1) !== 0; m.visible = on; if(!on) continue; m.matrixWorld.copy(o.matrixWorld);
    if(o.isInstancedMesh){ if(m.instanceMatrix !== o.instanceMatrix) m.instanceMatrix = o.instanceMatrix; m.count = o.count; if(o.boundingSphere) m.boundingSphere = o.boundingSphere; } } }
export function shadowTwinSwitch(on){ C.on = !!on; if(!C.on) for(const [o, R] of [...TW]) drop(o, R); _scanT = 0; }
if(!OFF && typeof window !== 'undefined' && renderer){ const prev = scene.onBeforeRender; scene.onBeforeRender = function(r, sc, cam, ...a){ if(C.on && cam && cam.isPerspectiveCamera){ try{ frame(); }catch(e){} } if(prev) return prev.call(this, r, sc, cam, ...a); }; }
