// game/xeom.js — Z282 XE ÔM / XÍCH LÔ MODE: the cavalry mode (game/cavalry.js) with a Vietnamese ride instead of the war horse. On the xe ôm
// the driver — green jacket, helmet, honeycomb sandals (the Tripo driver posed and baked) — rides the scooter and our soldier sits on the pillion,
// turning to fire all round; on the xích lô the driver pedals from the rear saddle and the soldier sits in the passenger seat up front, firing
// ahead. The driver only drives: he goes where you steer and stops when you let go. The bike leans into turns and bobs on the road, and the
// driver has a word or two. It answers to the same calls as the horse (root, body B, animate), so mounting, dismounting, firing from the seat
// and being thrown off all work as they do on horseback.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { XEOM } from '../../config.js';
import { S, floatText, loadGLTF, mountModel } from '../hub.js';

// Z293 the war ride itself: one Tripo model, vehicle and driver together (the driver modelled in his seat, hands on the bars, feet down), turned nose to
//   +z, set on the ground, centred and scaled to its true length; the old scooter / cyclo assembled from the city's parts stay as the fallback
const HERO = {};
function heroGeo(gl, kind){ if(HERO[kind]) return HERO[kind]; const X = XEOM[kind], geos = [], mats = []; gl.scene.updateMatrixWorld(true);
  gl.scene.traverse(o => { if(o.isMesh){ const g = o.geometry.clone().applyMatrix4(o.matrixWorld); for(const k of Object.keys(g.attributes)) if(!['position','normal','uv'].includes(k)) g.deleteAttribute(k); geos.push(g); const m = o.material.clone(); m.envMapIntensity = 0.8; mats.push(m); } });
  const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, true); if(X.yaw) g.rotateY(X.yaw); g.computeBoundingBox(); const b = g.boundingBox, sz = b.getSize(new THREE.Vector3());
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); const s = X.len / XEOM.k / sz.z; g.scale(s, s, s); g.computeBoundingBox(); g.computeBoundingSphere();
  return (HERO[kind] = { geo:g, mats:mats.length === 1 ? mats[0] : mats }); }
export function buildBikeMount(kind){ const root = new THREE.Group(), B = new THREE.Group(); root.add(B);
  const H = { root, B, bike:kind, t:0, v:0, lean:0, wantGraze:false, onStep:null, sayAt:0, gait:'stand', phase:0 };
  const put = m => { if(!m) return; const mesh = new THREE.Mesh(m.geo, m.mats); mesh.castShadow = true; mesh.receiveShadow = true; B.add(mesh); H.mesh = mesh; };
  loadGLTF('ride_' + kind).then(gl => gl ? put(heroGeo(gl, kind)) : (XEOM[kind].driver ? mountModel(kind).then(put) : null));
  return H; }
// the bike's motion: lean into the turn, a little bob on the road, a word from the driver now and then
export function animateBike(H, dt, v, yawRate){ H.t += dt; H.v = v; const sp = Math.min(1, Math.abs(v) / 8); H.gait = Math.abs(v) < 0.5 ? 'stand' : 'walk'; H.phase = (H.phase + dt * 0.8) % 1;
  H.lean += (-yawRate * sp * (XEOM[H.bike].lean ?? XEOM.lean) - H.lean) * Math.min(1, dt * 6); H.B.rotation.z = H.lean; H.B.position.y = Math.sin(H.t * 13) * 0.012 * sp;
  const now = performance.now() / 1000, p = S.player;
  if(p && now > H.sayAt){ H.sayAt = now + 18 + Math.random() * 20; if(H.sayAt > 0 && Math.abs(v) > 1) floatText(XEOM.lines[(Math.random() * XEOM.lines.length) | 0], '#ffe9a8', new THREE.Vector3(p.pos.x, p.pos.y + 3, p.pos.z), 13); } }
