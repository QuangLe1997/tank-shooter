// actors/fort-boss-glb.js — BOSS 2 THE FORT BOSS AS A REAL RIGGED MODEL (FORTBOSS.model 'glb', FORTBOSS.looks): a Meshy community character on the
//   Mixamo skeleton with his own motions (packed by tools/boss-pack.mjs out of the game's Mixamo library: walk, run, aim, fire, fire on the walk, crouch,
//   hit, stagger, throw, two deaths) stands in for the rifleman's rig, which stays underneath — unseen (its batch body off: userData.clipDraw), still
//   moved and aimed by the infantry AI, its muzzle laid on the heavy gun's every frame. The model is scaled to FORTBOSS.h (the guards are 1.8 m); the
//   squad machine gun (the game's own lmg scan) is held between his hands, laid from the right hand toward the left every frame; the breakable plates
//   (actors/fort-boss-look.js shapes, × plateK) are bolted to his bones where his own surface is — chest, both shoulders, the crown of the head, the
//   power pack on his back. fortBossAnim picks the motion from what he is doing; at his death the model leaves the rig, plays its fall and sinks.
//   The body and the plates fade together in the camera's see-through (render/see-through.js seeMat). Which look a fort gets: FORTBOSS.pick.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { FORTBOSS, INFGUN } from '../../config.js';
import { BIOME, MODEL_FILES, fbBolt, fbGeos, fbMats, fbMesh, heightAt, loadGLTF, renderer, scene, seeMat } from '../hub.js';

const C = FORTBOSS, GL = {}, CORPSES = [], _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const GUNS = {};
const keyOf = k => 'boss_' + k;
// which look a fort's boss wears: the capital's and some lands' are the revenant, the rest the titan (open for more: add a row to FORTBOSS.looks)
export function fortBossLookId(def){ const P = C.pick, L = (def.capital && P.capital) || (def.tier === 2 && P.second && P.second[BIOME.name]) || P.lands[BIOME.name] || P._;
  for(const id of [].concat(L)) if(C.looks[id] && C.looks[id].file) return id; return P._; }   // (BOSS 3 a land's list: the first whose file is in — a row still to come stands aside for the next)   // (BOSS 3 a row whose file is still to come: the default look)
// the battle's looks fetched ahead (and the heavy gun): ids → their glTF once in
export function fortBossPreload(ids){ for(const id of ids){ const L = C.looks[id]; if(!L || GL[id] !== undefined) continue; GL[id] = null; MODEL_FILES[keyOf(id)] = L.file; loadGLTF(keyOf(id)).then(gl => { GL[id] = gl || false; }); }
  for(const g of new Set([C.gun, ...ids.map(id => C.looks[id] && C.looks[id].gun).filter(Boolean)])) if(GUNS[g] === undefined){ GUNS[g] = null; loadGLTF('inf_' + g).then(gl => { GUNS[g] = gl || null; }); } }
// his maps sent to the GPU now (the horn's beat), not on the frame he first shows
export function fortBossWarm(def){ const gl = GL[fortBossLookId(def)]; if(!gl) return; gl.scene.traverse(o => { if(o.isMesh) for(const k of ['map', 'normalMap']){ const t = o.material[k]; if(t && !t.userData.fbWarm){ t.userData.fbWarm = 1; try{ renderer.initTexture(t); }catch(err){} } } }); }
// where his own surface is (bind pose, model metres): the extreme of axis ax over the vertices within the box [x0,x1]×[y0,y1]×[z0,z1]
function surf(P, ax, sign, x0, x1, y0, y1, z0, z1){ let best = sign > 0 ? -Infinity : Infinity; for(let i = 0; i < P.count; i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if(x < x0 || x > x1 || y < y0 || y > y1 || z < z0 || z > z1) continue; const v = ax === 0 ? x : ax === 1 ? y : z; if(sign > 0 ? v > best : v < best) best = v; } return isFinite(best) ? best : null; }
function shape(look, gl){ if(look.shape) return look.shape; let sm = null; gl.scene.traverse(o => { if(o.isSkinnedMesh && !sm) sm = o; }); const P = sm.geometry.attributes.position, B = {};
  gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isBone) B[o.name.replace('mixamorig', '')] = o.getWorldPosition(new THREE.Vector3()); });
  const ch = B.Spine2, hd = B.Head, sl = B.LeftArm, sr = B.RightArm, cy = ch.y + 0.03;
  const S = { chest:[0, cy, (surf(P, 2, 1, -0.12, 0.12, cy - 0.05, cy + 0.05, -1, 1) ?? ch.z + 0.15) + 0.02], back:[0, B.Spine1.y + 0.04, (surf(P, 2, -1, -0.12, 0.12, B.Spine1.y - 0.04, B.Spine1.y + 0.12, -1, 1) ?? ch.z - 0.18) - 0.07],
    crown:[hd.x, (surf(P, 1, 1, hd.x - 0.08, hd.x + 0.08, hd.y, hd.y + 0.5, hd.z - 0.1, hd.z + 0.12) ?? hd.y + 0.2) - 0.05, hd.z],
    shL:[sl.x, (surf(P, 1, 1, sl.x - 0.06, sl.x + 0.08, sl.y - 0.2, sl.y + 0.4, sl.z - 0.15, sl.z + 0.15) ?? sl.y + 0.12) + 0.01, sl.z], shR:[sr.x, (surf(P, 1, 1, sr.x - 0.08, sr.x + 0.06, sr.y - 0.2, sr.y + 0.4, sr.z - 0.15, sr.z + 0.15) ?? sr.y + 0.12) + 0.01, sr.z],
    face:[hd.x, hd.y + 0.09, (surf(P, 2, 1, hd.x - 0.06, hd.x + 0.06, hd.y + 0.04, hd.y + 0.14, hd.z - 0.05, hd.z + 0.3) ?? hd.z + 0.1) + 0.012],
    headW:Math.max(0.1, ((surf(P, 0, 1, hd.x, hd.x + 0.3, hd.y + 0.05, hd.y + 0.15, hd.z - 0.12, hd.z + 0.12) ?? hd.x + 0.12) - (surf(P, 0, -1, hd.x - 0.3, hd.x, hd.y + 0.05, hd.y + 0.15, hd.z - 0.12, hd.z + 0.12) ?? hd.x - 0.12)) / 2) };
  return (look.shape = S); }
// THE MODEL ON THE MAN: null while his file is not in (the rig look stands in, actors/fort-boss-look.js)
export function fortBossGlb(e, def){ const id = fortBossLookId(def), look = C.looks[id], gl = GL[id]; if(!look || !gl) return null;
  const m = e.mesh, u = m.userData, H = (C.h[def.tier - 1] || 3) * (look.hK || 1), k = H / C.baseH, S = shape(look, gl), G = fbGeos(), M = fbMats(def), s = look.plateK || C.plateK;
  if(look.plate != null){ const c = new THREE.Color(look.plate).lerp(new THREE.Color((def.land && def.land.c) ?? look.plate), 0.25); M.plate.color.copy(c); M.trim.color.copy(c).multiplyScalar(0.55); }   // (his plates in his own armour's steel, a touch of the land)
  m.scale.multiplyScalar(k); m.updateMatrixWorld(true); u.clipDraw = true;   // (the rig is no longer drawn: the model is the man)
  const gp = u.parts && u.parts.find(p => p.kind === 'gun'); if(gp) gp.o.visible = false;
  const root = skClone(gl.scene), wrap = new THREE.Group(); wrap.add(root); wrap.scale.setScalar(H / look.h / m.scale.x); m.add(wrap);
  const mats = []; root.traverse(o => { if(o.isMesh){ o.material = o.material.clone(); if(look.emit && o.material.map){ o.material.emissiveMap = o.material.map; o.material.emissive.setRGB(1, 1, 1); o.material.emissiveIntensity = look.emit; }   /* (BOSS 3 emit: his own colours glow — the magma brute's lava) */ o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; mats.push(o.material); seeMat(o.material); } });   // (fades with his plates in the see-through)
  for(const q of Object.values(M)) if(q && q.isMaterial) seeMat(q);
  const B = {}; root.traverse(o => { if(o.isBone) B[o.name.replace('mixamorig', '')] = o; }); wrap.updateMatrixWorld(true);
  const L = { e, k, M, glb:true, id, look, ws:H / look.h, wrap, gk:look.gun || C.gun, root, mats, B, pieces:[], plates:{}, gun:null, gp, glowT:0, mixer:new THREE.AnimationMixer(root), acts:{}, cur:null, once:null, flashT:0, muz0:u.muzzle.position.clone() };
  for(const c of gl.animations){ const a = L.mixer.clipAction(c); a.enabled = true; L.acts[c.name] = a; }
  L.sway = {}; for(const j of ['wingL', 'wingR', 'tail']){ const b = root.getObjectByName('boss_' + j); if(b) L.sway[j] = { b, q0:b.quaternion.clone() }; } L.swayT = Math.random() * 6;   // (the demon's wings and tail)
  const P = (key, bone, at, build) => { const g = new THREE.Group(), inner = new THREE.Group(); build(inner); inner.scale.setScalar(s); g.add(inner); fbBolt(root, bone, g, at[0], at[1], at[2]); L.pieces.push(g); if(key) L.plates[key] = g; return g; };
  P('chest', B.Spine2, S.chest, g => { g.add(fbMesh(G.chest, M.plate, 0, 0, 0)); g.add(fbMesh(G.ridge, M.trim, 0, 0, 0.045)); g.add(fbMesh(G.belly, M.trim, 0, -0.19, -0.01, -0.12)); });
  P('pack', B.Spine1, S.back, g => { g.add(fbMesh(G.pack, M.dark, 0, 0, 0)); for(const sx of [-1, 1]){ g.add(fbMesh(G.cell, M.glow, sx * 0.075, 0, -0.07)); g.add(fbMesh(G.stack, M.trim, sx * 0.08, 0.2, 0.01)); } });
  for(const [key, sx] of [['shL', 1], ['shR', -1]]) P(key, B[key === 'shL' ? 'LeftArm' : 'RightArm'], S[key], g => { g.add(fbMesh(G.paul, M.plate, 0, 0.02, 0, 0, 0, -sx * 0.25)); g.add(fbMesh(G.paul2, M.trim, sx * 0.04, -0.03, 0, 0, 0, -sx * 0.55)); });   // (his left is +X)
  if(look.helm === 'mask') P('helmet', B.Head, S.face, g => { const w = S.headW / 0.11 / s; g.add(fbMesh(G.visor, M.plate, 0, 0, 0, 0, 0, 0, w, 0.9, 0.6)); g.add(fbMesh(G.slit, M.eye, 0, 0.005, 0.02, 0, 0, 0, w, 1.2, 1)); });   // (a mask over the eyes, not a helmet: her horns stay)
  else P('helmet', B.Head, S.crown, g => { const hw = S.headW / 0.165 / s * 0.9, cap = look.helm === 'cap'; g.add(fbMesh(G.helm, M.plate, 0, cap ? 0.01 : -0.04, 0, 0, 0, 0, hw, hw * (cap ? 0.42 : 0.8), hw * 1.05)); if(cap){ g.add(fbMesh(G.crest, M.trim, 0, 0.07 * hw, 0)); return; } g.add(fbMesh(G.crest, M.trim, 0, 0.11 * hw, 0)); g.add(fbMesh(G.slit, M.eye, 0, -0.02, 0.165 * hw * 1.05, 0.12, 0, 0, hw, 1, 1)); });   // (BOSS 3 cap: a flat skull plate, the masked face left seen)
  // the heavy gun between his hands (its grip at the origin, the barrel along +Z)
  const GN = GUNS[look.gun || C.gun]; if(GN && GN.scene){ const g0 = GN.scene.clone(true), bb = new THREE.Box3().setFromObject(g0), c = bb.getCenter(new THREE.Vector3()), L0 = bb.max.z - bb.min.z || 1, G2 = INFGUN.guns[look.gun || C.gun], len = G2.len * (look.gunK || C.gunK) * look.h / 1.8;
    g0.position.sub(c); const t = new THREE.Group(); t.add(g0); t.rotation.y = G2.muzzle > 0 ? 0 : Math.PI; const sg = new THREE.Group(); sg.add(t); sg.scale.setScalar(len / L0); sg.position.set(0, -0.06 * len, G2.grip * len);
    const gun = new THREE.Group(); gun.add(sg); gun.userData.len = len; gun.traverse(o => { if(o.isMesh){ o.castShadow = true; o.material = o.material.clone(); seeMat(o.material); } }); root.add(gun); L.gun = gun; }
  play(L, 'aim', 0); e.fbLook = L; return L; }
// a motion: cross-faded in over f s (loops), or once and then back (once: true)
function play(L, name, f, once){ const a = L.acts[name]; if(!a || L.cur === a && !once) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!once; a.setEffectiveWeight(1); a.play();
  if(L.cur && L.cur !== a){ if(f > 0) L.cur.crossFadeTo(a, f, false); else L.cur.stop(); } L.cur = a; if(once) L.once = { a, until:once === true ? Infinity : once }; }
// what he is doing → his motion (st: the fight's state; v m/s over the ground; firing; hit: a plate just went) — once a frame, host and guest
export function fortBossAnim(L, dt, st, v, firing, now){ if(!L || !L.glb || L.dead) return; const A = C.anim;
  if(L.once){ if(L.once.a.isRunning() && now < L.once.until) return void step(L, dt); L.once = null; L.cur = null; }
  let want = 'aim', ts = 1;
  if(st === 'stagger') want = 'stagger'; else if(st === 'chargeT') want = 'crouch'; else if(st === 'charge'){ want = 'run'; ts = v / (A.v.run * L.look.hipK * L.ws); }
  else if(st === 'sweep' || st === 'rocket') want = firing ? 'fire' : 'aim';
  else if(v > A.runV){ want = 'run'; ts = v / (A.v.run * L.look.hipK * L.ws); } else if(v > A.walkV){ want = firing ? 'fireWalk' : 'walk'; ts = v / (A.v[want] * L.look.hipK * L.ws); } else want = firing ? 'fire' : 'aim';
  play(L, want, A.fade); if(L.cur) L.cur.timeScale = Math.max(0.5, Math.min(1.8, ts)); step(L, dt); }
// a one-off: the throw, a plate's blow
export function fortBossAct(L, name, now){ if(!L || !L.glb || L.dead || !L.acts[name]) return; play(L, name, 0.12, now + L.acts[name].getClip().duration * 0.92); }
function step(L, dt){ L.mixer.update(dt); sway(L, dt); L.root.updateMatrixWorld(true); hold(L);
  if(L.flashT > 0){ L.flashT -= dt; const k = Math.max(0, L.flashT / 0.12); const e0 = L.look.emit ? 1 : 0; for(const m of L.mats){ m.emissive.setRGB(e0 + 0.5 * k, e0 + 0.12 * k, e0 + 0.08 * k); } } }
// the wings beat slowly standing, hard on the run; the tail sways (rest × a turn: the wings about his front–back axis, the tail about the upright)
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
function sway(L, dt){ const W = L.look.sway, S2 = L.sway; if(!W || !S2) return; const run = L.cur && (L.cur === L.acts.run) ? 1 : 0, hz = W.hz[0] + (W.hz[1] - W.hz[0]) * run, amp = W.wing[0] + (W.wing[1] - W.wing[0]) * run;
  L.swayT += dt * hz * Math.PI * 2; const fl = Math.sin(L.swayT) * amp;
  for(const [j, sgn] of [['wingL', 1], ['wingR', -1]]){ const s = S2[j]; if(s) s.b.quaternion.copy(s.q0).multiply(_q.setFromAxisAngle(_ax.set(0, 0, 1), sgn * fl)); }
  const t = S2.tail; if(t) t.b.quaternion.copy(t.q0).multiply(_q.setFromAxisAngle(_ax.set(0, 1, 0), Math.sin(L.swayT * 0.45) * W.tail)); }
// the gun laid from his right hand toward his left; the rig's muzzle put on its muzzle (the rounds leave the real gun)
function hold(L){ const g = L.gun, B = L.B; if(!g || !B.RightHand || !B.LeftHand) return; B.RightHand.getWorldPosition(_a); B.LeftHand.getWorldPosition(_b);
  g.parent.worldToLocal(_c.copy(_a)); g.position.copy(_c); g.lookAt(_d.copy(_b).addScaledVector(_c.subVectors(_b, _a), 2)); g.updateMatrixWorld(true);
  const u = L.e.mesh.userData; if(u.muzzle && u.muzzle.parent){ _d.subVectors(_b, _a).normalize(); _c.copy(_a).addScaledVector(_d, g.userData.len * (0.5 + INFGUN.guns[L.gk].grip) * L.ws); u.muzzle.parent.updateWorldMatrix(true, false); u.muzzle.position.copy(u.muzzle.parent.worldToLocal(_c)); } }
export function fortBossFlash(L){ if(L && L.glb) L.flashT = 0.12; }
// he is down (or the battle is gone): the plates fly (fort-boss-look.js), the model leaves the rig and falls — or, reset, is simply taken away
export function fortBossGlbStrip(L, fly){ const u = L.e.mesh.userData; u.clipDraw = false; if(u.muzzle && L.muz0) u.muzzle.position.copy(L.muz0);
  if(fly && L.wrap.parent){ L.dead = true; scene.attach(L.wrap); const a = L.acts[Math.random() < 0.5 ? 'deathB' : 'deathF']; if(a){ if(L.cur) L.cur.stop(); a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.time = C.anim.deathAt || 0; }   /* (BOSS 3 the fall begins at once: the clip's first beat of standing skipped) */ CORPSES.push({ L, t:0 }); }
  else { if(L.wrap.parent) L.wrap.parent.remove(L.wrap); drop(L); } }
function drop(L){ for(const m of L.mats) m.dispose(); L.mixer.stopAllAction(); }
// once a frame (host and guest): the fallen play out their fall, lie, then sink away
export function fortBossCorpseTick(dt){ for(let i = CORPSES.length - 1; i >= 0; i--){ const c = CORPSES[i], L = c.L; c.t += dt; L.mixer.update(dt); if(L.gun) hold(L);
    if(c.t > C.anim.lie){ const w = L.wrap; w.position.y -= dt * 0.6; if(c.t > C.anim.lie + 3 || w.position.y < heightAt(w.position.x, w.position.z) - 3){ scene.remove(w); drop(L); CORPSES.splice(i, 1); } } } }
export function fortBossCorpsesClear(){ for(const c of CORPSES){ scene.remove(c.L.wrap); drop(c.L); } CORPSES.length = 0; }
