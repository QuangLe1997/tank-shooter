// render/fight-warm.js — SPLIT 2 (A6) NOTHING COMPILED OR UPLOADED IN THE FIGHT'S FIRST FRAMES, AND THE LOAD NEVER WAITS FOR IT. Two jobs started at the
//   3-2-1 (ui/briefing.js beginStage, beside prewarmStage's compile of the scene):
//   · maps: three sends a texture to the GPU the first time something wearing it is drawn — a house behind the camera, a far fort, a model out of a
//     LOD — so the first turns of the camera paid for the uploads (an ARCTIC test battle: 16 maps still cold at the 3-2-1, 69 ms in all). Every map of
//     every material in the battle's scene the GPU does not hold yet is uploaded (renderer.initTexture), biggest first, PERF_SPLIT.warm.ms of work a
//     frame (always one) — only while the countdown runs: when it ends, whatever is left is left to the first draw as before.
//   · shaders: what rises at GO is not in the scene during the 3-2-1, so prewarmStage never saw it and its programs were built in the first live frame
//     (~280 ms, two programs). The props of FWARM.props (the relic, its downloaded altar and glowing crystal; fightWarmProp adds more) are built off
//     the scene and compiled with the battle's own lights (renderer.compile(props, camera, scene)) — waiting at most warm.propWait s for their models.
//   FWARM.stat: maps found / uploaded / ms / left when the countdown ended · props compiled / new programs (the fight's long frames are in PH.long).
import * as THREE from 'three';
import { PERF_SPLIT } from '../../config.js';
import { S, camera, lootPreload, relicWarm, renderer, scene } from '../hub.js';

export const FWARM = { stat:{ found:0, up:0, ms:0, left:0, props:0, progs:0 }, run:0 };
const PROPS = [() => relicWarm()];
export function fightWarmProp(fn){ PROPS.push(fn); }   // another module's thing that first appears at GO: fn() → an Object3D built off the scene (userData.real: a promise of its models)
const KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap', 'specularMap', 'clearcoatNormalMap', 'sheenColorMap', 'transmissionMap', 'specularColorMap', 'specularIntensityMap'];
function cold(t){ if(!t || !t.isTexture || t.isRenderTargetTexture || t.isVideoTexture || t.version === 0) return false;
  const im = t.image; if(!t.isDataTexture && !t.isCompressedTexture && !(im && (im.width || im.length))) return false;
  return renderer.properties.get(t).__version !== t.version; }
const px = t => { const im = t.image, a = Array.isArray(im) ? im[0] : im; return a ? (a.width || 0) * (a.height || 0) * (Array.isArray(im) ? im.length : 1) : 0; };
const counting = () => S.mode === 'countdown';
export function fightWarm(){ const W = PERF_SPLIT.warm; if(!W.on) return; const run = ++FWARM.run, T = FWARM.stat, seen = new Set(), Q = [];
  const take = t => { if(t && t.isTexture && !seen.has(t)){ seen.add(t); if(cold(t)) Q.push(t); } };
  scene.traverse(o => { const m = o.material; if(!m) return; for(const x of Array.isArray(m) ? m : [m]){ for(const k of KEYS) take(x[k]); const U = x.uniforms; if(U) for(const k in U){ const v = U[k] && U[k].value; if(v && v.isTexture) take(v); } } });
  Q.sort((a, b) => px(b) - px(a)); Object.assign(T, { found:Q.length, up:0, ms:0, left:Q.length, props:0, progs:0 });
  const step = () => { if(run !== FWARM.run || !counting()) return; const t0 = performance.now();   // the fight is on: stop, never hold it
    do{ const t = Q.shift(); if(cold(t)){ try{ renderer.initTexture(t); T.up++; }catch(e){} } } while(Q.length && performance.now() - t0 < W.ms);
    T.ms += performance.now() - t0; T.left = Q.length; if(Q.length) requestAnimationFrame(step); };
  requestAnimationFrame(step); warmProps(run); }
async function warmProps(run){ const W = PERF_SPLIT.warm, T = FWARM.stat, g = new THREE.Group(), waits = [];
  try{ lootPreload(); }catch(e){}   // (spawnRelic asked for the loot models only at GO)
  for(const f of PROPS){ try{ const o = f(); if(!o) continue; g.add(o); if(o.userData && o.userData.real) waits.push(o.userData.real); }catch(e){} }
  if(waits.length) await Promise.race([Promise.all(waits).catch(() => {}), new Promise(r => setTimeout(r, W.propWait * 1000))]);
  if(run !== FWARM.run || !counting() || !g.children.length) return;
  const n0 = renderer.info.programs ? renderer.info.programs.length : 0;
  try{ T.props = renderer.compile(g, camera, scene).size; }catch(e){ return; }   // (programs built now link in the background where the browser can: KHR_parallel_shader_compile)
  T.progs = (renderer.info.programs ? renderer.info.programs.length : 0) - n0;
  g.traverse(o => { const m = o.material; if(m) for(const x of Array.isArray(m) ? m : [m]) for(const k of KEYS) if(cold(x[k])) try{ renderer.initTexture(x[k]); T.up++; }catch(e){} }); }   // + their few maps
