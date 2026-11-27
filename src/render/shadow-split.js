// render/shadow-split.js — SPLIT 1 (A1) THE SUN'S SHADOW IN TWO PARTS: what stands still (ground, walls, houses, rocks, trees, the field's instanced
//   stones) is drawn into the shadow map ONCE and kept in a copy; every frame the copy is put back (one blit of colour + depth) and only what moves —
//   soldiers, horses, bikes, debris, anything new — is drawn on top. The receivers are unchanged: they read the same one map (sun.shadow.map), so
//   LIGHT 1's contact shadows, the dust and the light shafts see exactly what they saw. Nothing is listed by hand: a caster that has not moved, shown,
//   hidden, changed its geometry or its instances for PERF_SPLIT.shadow.settle frames becomes "still"; a still one that changes (a wall knocked down,
//   a bush crushed, a crater in the ground) goes back to moving and the still part is drawn again within minGap s. The map's box no longer slides
//   with every step: it is re-centred once the soldier is `step` m off its centre (a little wider, `pad`), and the still part is drawn again then —
//   and whenever the box's size (zoom), the sun's direction (hour, battlefield) or the scene changes. `?nosplit` switches it off (before / after).
import * as THREE from 'three';
import { PERF_SPLIT } from '../../config.js';
import { MOBILE, S, SHADOW_EXT, scene, sun } from '../hub.js';

export const SSHADOW = { on:true, full:false, bake:false, stat:{ bakes:0, why:'', still:0, moving:0, inBake:0, restores:0, recs:0 } };
const REC = new Map(), OFF = [], ST = [], LO = [], _dir = new THREE.Vector3(), _off = new THREE.Vector3(), _d = new THREE.Vector3();
let RT = null, _map = null, _scene = null, _n = 0, _bakeAt = -1e9, _ax = NaN, _az = NaN, _r = 0, _mode = 0, _demote = false, _promote = 0;
const CF = () => PERF_SPLIT.shadow;
// the caster's state, compared frame to frame: where it is, whether it is drawn at all, its geometry and its instances
function live(o){ for(let q = o; q; q = q.parent){ if(q.visible === false) return false; if(q === _scene) return true; } return false; }
//   0 = the same · 1 = moved · 2 = edited in place (shown / hidden, new geometry or vertices, other instances)
function changed(R){ const o = R.o, e = o.matrixWorld.elements, m = R.m; let ch = 0;
  for(let i = 0; i < 16; i++) if(m[i] !== e[i]){ m[i] = e[i]; ch = 1; }
  const g = o.geometry, pv = g && g.attributes.position ? g.attributes.position.version : -1, lv = live(o) && o.castShadow && !!(o.layers.mask & 1);
  const im = o.isInstancedMesh ? o.instanceMatrix.version * 100003 + o.count : 0;
  if(g !== R.g || pv !== R.pv || lv !== R.lv || im !== R.im){ R.g = g; R.pv = pv; R.lv = lv; R.im = im; ch = ch || 2; }
  return ch; }
function eligible(o){ return (o.isMesh || o.isInstancedMesh) && o.castShadow && !o.isSkinnedMesh && !o.morphTargetInfluences && !(o.userData && o.userData.shadowMoving); }
function rescan(){ const seen = new Set();
  _scene.traverse(o => { if(!eligible(o)) return; seen.add(o); if(!REC.has(o)){ const R = { o, m:new Float64Array(16), g:null, pv:0, lv:false, im:0, still:0, settle:CF().settle, st:false, inB:false, ed:-1e9 }; changed(R); REC.set(o, R); } });
  for(const [o, R] of REC) if(!seen.has(o)){ if(R.st && R.inB) _demote = true; REC.delete(o); } }   // gone from the battle: its still shadow has to go too
// the box re-centred only once the soldier has walked `step` m off it; texel-snapped like updateSunFollow
function anchor(){ const C = CF(), t = sun.target.position, r = SHADOW_EXT.r + C.pad, tx = 2 * r / (sun.shadow.mapSize.x || 2048);
  _off.subVectors(sun.position, t); let why = '';
  if(!(Math.abs(t.x - _ax) <= C.step && Math.abs(t.z - _az) <= C.step)){ _ax = Math.round(t.x / tx) * tx; _az = Math.round(t.z / tx) * tx; why = 'move'; }
  const sc = sun.shadow.camera; if(Math.abs(sc.right - r) > 1e-3 || r !== _r){ _r = r; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.far = 180 + r; sc.updateProjectionMatrix(); why = why || 'size'; }
  _d.copy(_off).normalize(); if(_dir.distanceToSquared(_d) > 1e-8){ _dir.copy(_d); why = why || 'sun'; }
  t.set(_ax, t.y, _az); sun.position.copy(t).add(_off); sun.updateMatrixWorld(); sun.target.updateMatrixWorld(); return why; }
function makeRT(map){ if(RT) RT.dispose(); RT = new THREE.WebGLRenderTarget(map.width, map.height, { minFilter:THREE.NearestFilter, magFilter:THREE.NearestFilter });
  const cur = shadowSplit.r.getRenderTarget(); shadowSplit.r.setRenderTarget(RT); shadowSplit.r.setRenderTarget(cur); _map = map; }
// one blit of the whole map, colour (the packed depth the receivers read) and depth (what the movers are tested against)
function blit(from, to){ const r = shadowSplit.r, gl = r.getContext(), P = r.properties, a = P.get(from).__webglFramebuffer, b = P.get(to).__webglFramebuffer; if(!a || !b) return false;
  r.state.bindFramebuffer(gl.READ_FRAMEBUFFER, a); r.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, b);
  gl.blitFramebuffer(0, 0, from.width, from.height, 0, 0, to.width, to.height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST); return true; }
function castOff(set){ for(const o of set) if(o.castShadow){ o.castShadow = false; OFF.push(o); } }
function castBack(){ for(const o of OFF) o.castShadow = true; OFF.length = 0; }
function split(base, lights, sc, camera){
  const C = CF(), now = performance.now() / 1000; if(sc !== _scene){ _scene = sc; REC.clear(); _ax = NaN; }
  LO.length = 0; for(const l of lights) if(l !== sun) LO.push(l); if(LO.length) base(LO, sc, camera);   // the night floodlights: as before, every caster
  let why = anchor(); sun.shadow.updateMatrices(sun); const F = sun.shadow.getFrustum();
  if(_n++ % C.rescan === 0) rescan();
  let still = 0, moving = 0, mv = 0, ed = 0;
  for(const R of REC.values()){ const ch = changed(R); if(ch){ R.lc = _n; R.lk = ch; if(ch === 1) mv++; else ed++; }
    if(R.st){ if(ch === 2 && now - R.ed > C.editWin){ R.ed = now; if(R.inB || (R.lv && (!R.o.frustumCulled || F.intersectsObject(R.o)))) _demote = true; still++; }   // edited once (a wall down, a crater): stays still, drawn again
      else if(ch){ R.st = false; R.still = 0; R.ed = now; R.settle = Math.min(C.settleMax, R.settle * 2); if(R.inB) _demote = true; } else still++; }   // moved, or edited again soon: it moves now
    else{ moving++; if(ch) R.still = 0; else if(++R.still === R.settle && R.lv && (!R.o.frustumCulled || F.intersectsObject(R.o))) _promote++; } }
  const map = sun.shadow.map; if(!map) return base(SUN1, sc, camera);   // three makes the map on its first pass
  if(map !== _map || !RT || RT.width !== map.width) why = why || 'map';
  if(!why && _demote && now - _bakeAt >= C.minGap) why = 'change';
  if(!why && _promote && now - _bakeAt >= C.promoteGap) why = 'still';
  if(SSHADOW.bake){ SSHADOW.bake = false; why = why || 'asked'; }   // (a probe's request)
  const T = SSHADOW.stat; T.still = still; T.moving = moving; T.recs = REC.size; T.mv = mv; T.ed = ed;
  if(SSHADOW.full) return base(SUN1, sc, camera);
  if(why){   // the still part, drawn again: every caster that is not still is switched off for this one pass
    if(map !== _map || !RT || RT.width !== map.width) makeRT(map);
    let inB = 0; for(const R of REC.values()){ if(!R.st && R.still >= R.settle) R.st = true; R.inB = R.st && R.lv && (!R.o.frustumCulled || F.intersectsObject(R.o)); if(R.inB) inB++; }
    const cut = []; sc.traverse(o => { if(o.castShadow && (o.isMesh || o.isLine || o.isPoints)){ const R = REC.get(o); if(!R || !R.st) cut.push(o); } });
    castOff(cut); try{ base(SUN1, sc, camera); } finally{ castBack(); }
    blit(map, RT); _bakeAt = now; _demote = false; _promote = 0; T.bakes++; T.why = why; T.inBake = inB; _mode = 2; }
  else _mode = 1;   // the still part put back by the clear (below)
  ST.length = 0; for(const R of REC.values()) if(R.st) ST.push(R.o);
  castOff(ST); try{ base(SUN1, sc, camera); } finally{ castBack(); _mode = 0; } }
// PERF_SPLIT.shadow on, a desktop with shadows, the battle's own scene (the shop's showroom and the warm-up draws go through untouched)
export function shadowSplit(renderer){ if(MOBILE || /[?&]nosplit\b/.test(location.search)) return; shadowSplit.r = renderer;   // (called while render/renderer.js loads: nothing of this module's own state is touched until the first draw)
  const sm = renderer.shadowMap, base = sm.render.bind(sm), clr = renderer.clear.bind(renderer);
  renderer.clear = (c, d, s) => { if(_mode && renderer.getRenderTarget() === sun.shadow.map){ if(_mode === 1){ if(blit(RT, sun.shadow.map)) SSHADOW.stat.restores++; else clr(c, d, s); } return; } return clr(c, d, s); };
  sm.render = (lights, sc, camera) => {
    if(sc !== scene || !lights.length || !lights.includes(sun)) return base(lights, sc, camera);   // every post pass's full-screen quad comes through here too
    if(!SSHADOW.on || !PERF_SPLIT.shadow.on || !sm.enabled || (!sm.autoUpdate && !sm.needsUpdate) || S.mode === 'intro'){
      if(_r){ _r = 0; const c = sun.shadow.camera, r = SHADOW_EXT.r; c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.far = 180 + r; c.updateProjectionMatrix(); }   // back to the box that follows every step
      _ax = NaN; return base(lights, sc, camera); }
    SUN1[0] = sun; return split(base, lights, sc, camera); }; }
const SUN1 = [null];
// (debug) what keeps moving: the casters changed in the last `frames` frames, by name — `H.shadowSplitWho()` in a probe
export function shadowSplitWho(frames = 10){ const by = {}; for(const R of REC.values()) if(R.lc > _n - frames){ const o = R.o, k = (R.lk === 1 ? 'mv ' : 'ed ') + (o.isInstancedMesh ? 'I:' : '') + (o.name || (o.parent && o.parent.name) || o.geometry?.type || '?');
  by[k] = (by[k] || 0) + 1; } return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 14); }
