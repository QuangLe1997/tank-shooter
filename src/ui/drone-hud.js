// ui/drone-hud.js — DRONE 1 WHAT THE DRONE WAR SHOWS HIM: the red diamond over every marked enemy (one instanced mesh drawn over everything — walls do
//   not hide it — its size held up with the camera's distance), the cyan ring on the ground of what the recon drone watches, the map's part (a diamond round
//   a marked man's dot, our drone and its circle, the enemy's drones), and the time left of what he flies as a chip in the buff bar (loot/powerups.js draws
//   p.buffUntil: the drones' keys are added to its icon table). Built on first use; nothing here allocates per frame.
import * as THREE from 'three';
import { DRONEWAR } from '../../config.js';
import { ARENA, BUFF_COL, BUFF_ICON, DW, RECON, S, camera, enemies, heightAt, holoRing, radarCanvas, scene } from '../hub.js';

const D = DRONEWAR, UP = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const H = { marks:null, ring:null, chips:false };

function marksMesh(){ const g = new THREE.OctahedronGeometry(0.2, 0); g.scale(1, 1.5, 1);
  const m = new THREE.MeshBasicMaterial({ color:new THREE.Color(0xff2a1e).multiplyScalar(1.7), transparent:true, opacity:0.92, depthTest:false, depthWrite:false, fog:false });
  const im = new THREE.InstancedMesh(g, m, D.recon.markMax); im.count = 0; im.frustumCulled = false; im.renderOrder = 30; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); return (H.marks = im); }
function ringMesh(){ const r = holoRing(1, { kind:'friend', core:0.002, halo:0.007, ticks:72, tickLen:0.014, sweep:0.22, gain:5, dark:0.08, depthTest:false, order:5, seg:120 }); r.visible = false; scene.add(r); return (H.ring = r); }
// the buff bar's chips for what he is flying (their icons and colours join loot/powerups.js's tables once)
export function droneChip(key, until){ const p = S.player; if(!p || !p.buffUntil) return; if(!H.chips){ H.chips = true; BUFF_ICON.recon = 'drone'; BUFF_ICON.fpv = 'drone'; BUFF_COL.recon = '#3ee8ff'; BUFF_COL.fpv = '#ffb84a'; } p.buffUntil[key] = until; }
// every frame in play: the diamonds over the marked, the ring under the recon drone
export function updateDroneHud(dt, now){ const live = now < RECON.markedUntil; let im = H.marks, n = 0;
  if(live){ im = im || marksMesh(); const max = D.recon.markMax, sp = now * 1.6;
    for(let i = 0; i < enemies.length && n < max; i++){ const e = enemies[i], left = e.markUntil - now; if(!(left > 0)) continue; if(left < 1.5 && (now * 6) % 1 < 0.4) continue;   // (its last moments: it blinks)
      _v.set(e.pos.x, (e.mesh ? e.mesh.position.y : heightAt(e.pos.x, e.pos.z)) + 2.6 + Math.sin(now * 3 + i) * 0.07, e.pos.z); const k = Math.max(1, _v.distanceTo(camera.position) / 22);
      _s.set(k, k, k); _q.setFromAxisAngle(UP, sp + i); _m.compose(_v, _q, _s); im.setMatrixAt(n++, _m); } }
  if(im && (n || im.count)){ im.count = n; im.instanceMatrix.needsUpdate = true; im.visible = n > 0; }
  const d = RECON.d; if(d && !d.dead){ const r = H.ring || ringMesh(); r.visible = true; r.scale.setScalar(D.recon.r); r.position.set(d.x, heightAt(d.x, d.z) + 0.35, d.z); }
  else if(H.ring && H.ring.visible) H.ring.visible = false; }
// out of play (a menu, the death, the end of a stage): nothing of it stays on the screen
export function droneHudOff(){ if(H.marks && H.marks.count){ H.marks.count = 0; H.marks.visible = false; } if(H.ring && H.ring.visible) H.ring.visible = false; }
// the minimap (ui/radar.js, after the enemies' dots): a red diamond round each marked man, our recon drone and its circle, the enemy's drones
export function drawDroneRadar(c){ if(!DW.on) return; const now = performance.now() / 1000, W = radarCanvas.width, cx = W / 2, sc = (W / 2 - 7) / ARENA;
  if(now < RECON.markedUntil){ c.strokeStyle = '#ff4a3a'; c.lineWidth = 1.3; c.beginPath();
    for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!(e.markUntil > now)) continue; const x = cx + e.pos.x * sc, y = cx + e.pos.z * sc; c.moveTo(x, y - 3.6); c.lineTo(x + 3.6, y); c.lineTo(x, y + 3.6); c.lineTo(x - 3.6, y); c.closePath(); }
    c.stroke(); }
  for(let i = 0; i < DW.list.length; i++){ const d = DW.list[i], x = cx + d.x * sc, y = cx + d.z * sc;
    if(d.foe){ c.strokeStyle = '#ff4ad0'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); c.stroke(); }
    else { c.fillStyle = '#3ee8ff'; c.beginPath(); c.arc(x, y, 2.2, 0, 6.2832); c.fill();
      if(d.kind === 'recon'){ c.strokeStyle = 'rgba(62,232,255,0.55)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, D.recon.r * sc, 0, 6.2832); c.stroke(); } } } }
