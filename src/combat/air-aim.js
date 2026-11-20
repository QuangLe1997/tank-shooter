// combat/air-aim.js — Z313 SHOOTING AT HELICOPTERS IN 3D (tank and soldier alike): the gun is laid on an aircraft, height and all. With the mouse, point
//   at the helicopter on screen — within a few dozen pixels the aim snaps onto it (and holds it a little further) instead of the ground behind it; with a
//   pad or on a phone, the aircraft nearest the line of the aim is taken up — no extra button, no third axis on a stick: the elevation is worked out. The
//   rounds lead it (its own speed) and climb to its height, the tank's gun / the soldier's rifle tips up to it, and a round aimed at it hits only near it
//   in the air. A red ring sits on it with a dashed line down to the ground and its height and range beside it.
import * as THREE from 'three';
import { AIRAIM } from '../../config.js';
import { MOBILE, PAD, S, VIEW, camera, enemies, heightAt, playerRange, scene } from '../hub.js';

export const AIR = { e:null, mx:-1, my:-1, vx:0, vy:0, vz:0, last:null, ring:null, line:null, dot:null, label:null };
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
export function airMouse(cx, cy){ AIR.mx = cx; AIR.my = cy; }   // (from the mouse ray)
const alive = e => !!e && enemies.includes(e) && e.hp > 0;
// every frame: which aircraft the gun is laid on (null = the ground, as before)
export function updateAirAim(dt){ const p = S.player; if(!p || S.mode !== 'playing'){ lay(null, dt); return; }
  const range = playerRange() * 1.15, C = AIRAIM; let t = null;
  if(!MOBILE && !PAD.active){ if(S.pointerActive && AIR.mx >= 0){ let bd = 1e9;   // mouse: the aircraft nearest the cursor on screen
      for(const e of enemies){ if(!e.def.air || !(e.hp > 0) || Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > range) continue; _v.copy(e.pos).project(camera); if(_v.z > 1) continue;
        const d = Math.hypot((_v.x + 1) / 2 * VIEW.w - AIR.mx, (1 - _v.y) / 2 * VIEW.h - AIR.my), lim = e === AIR.e ? C.keepPx : C.snapPx; if(d < lim && d < bd){ bd = d; t = e; } } } }
  else { const a = p.aimSmoothed ?? p.aim ?? p.facing; let bd = C.padCone;   // pad / phone: the aircraft nearest the line of the aim
    for(const e of enemies){ if(!e.def.air || !(e.hp > 0)) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz); if(d > range || d < 2) continue;
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a))) * (e === AIR.e ? 0.7 : 1); if(da < bd){ bd = da; t = e; } } }
  lay(t, dt);
  if(t && !MOBILE && !PAD.active){ const L = lead(p.pos.x, p.pos.z, 80); S.aimPoint.set(L.x, heightAt(L.x, L.z), L.z); } }   // the turret / rifle swings onto it
// where it will be when a round of this speed gets there
function lead(sx, sz, speed){ const e = AIR.e, t = Math.hypot(e.pos.x - sx, e.pos.z - sz) / Math.max(20, speed);
  return { x:e.pos.x + AIR.vx * t, y:e.pos.y + AIR.vy * t, z:e.pos.z + AIR.vz * t }; }
// a round fired at the aircraft: its yaw, the height (above the ground there) it climbs to and over what distance — null when the gun is on the ground
export function airShot(sx, sz, speed){ if(!alive(AIR.e)) return null; const L = lead(sx, sz, speed), d = Math.max(1, Math.hypot(L.x - sx, L.z - sz));
  return { a:Math.atan2(L.x - sx, L.z - sz), dropTo:L.y - heightAt(L.x, L.z), dropDist:d, e:AIR.e }; }
// how far up the gun tips to it from a muzzle at (x, y, z)
export function airPitch(x, y, z){ if(!alive(AIR.e)) return null; const e = AIR.e; return Math.atan2(e.pos.y - y, Math.max(1, Math.hypot(e.pos.x - x, e.pos.z - z))); }
function lay(t, dt){ const prev = AIR.e; AIR.e = alive(t) ? t : null; const e = AIR.e;
  if(e){ if(AIR.last && prev === e && dt > 0){ const k = Math.min(1, dt * 6); AIR.vx += ((e.pos.x - AIR.last.x) / dt - AIR.vx) * k; AIR.vy += ((e.pos.y - AIR.last.y) / dt - AIR.vy) * k; AIR.vz += ((e.pos.z - AIR.last.z) / dt - AIR.vz) * k; }
    else { AIR.vx = AIR.vy = AIR.vz = 0; } AIR.last = { x:e.pos.x, y:e.pos.y, z:e.pos.z }; }
  else AIR.last = null;
  reticle(e); }
// the ring on it, the dashed line to the ground, its height and range
function reticle(e){ if(typeof document === 'undefined') return; if(!AIR.ring) build(); if(!AIR.ring.parent) scene.add(AIR.ring, AIR.line, AIR.dot);
  const on = !!e; AIR.ring.visible = AIR.line.visible = AIR.dot.visible = on; AIR.label.style.display = on ? 'block' : 'none'; if(!on) return;
  const gy = heightAt(e.pos.x, e.pos.z), s = Math.max(1.4, (e.r || 2) * 0.9);
  AIR.ring.position.copy(e.pos); AIR.ring.quaternion.copy(camera.getWorldQuaternion(_q)); AIR.ring.scale.setScalar(s);
  const P = AIR.line.geometry.attributes.position; P.setXYZ(0, e.pos.x, e.pos.y - s, e.pos.z); P.setXYZ(1, e.pos.x, gy + 0.05, e.pos.z); P.needsUpdate = true; AIR.line.computeLineDistances();
  AIR.dot.position.set(e.pos.x, gy + 0.06, e.pos.z);
  const p = S.player; _v.copy(e.pos).project(camera); const x = (_v.x + 1) / 2 * VIEW.w, y = (1 - _v.y) / 2 * VIEW.h;
  AIR.label.style.transform = 'translate(' + Math.round(x + 28) + 'px,' + Math.round(y - 30) + 'px)';
  const txt = '▲ ' + Math.round(e.pos.y - gy) + ' m · ' + Math.round(Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z)) + ' m'; if(AIR.label.textContent !== txt) AIR.label.textContent = txt; }
function build(){ const m = c => new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:0.9, depthTest:false, depthWrite:false, side:THREE.DoubleSide });
  AIR.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), m(AIRAIM.col)); AIR.ring.renderOrder = 998;
  AIR.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineDashedMaterial({ color:AIRAIM.col, dashSize:0.5, gapSize:0.35, transparent:true, opacity:0.75, depthTest:false }));
  AIR.line.renderOrder = 997; AIR.line.frustumCulled = false;
  AIR.dot = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.6, 24).rotateX(-Math.PI / 2), m(AIRAIM.col)); AIR.dot.renderOrder = 997;
  scene.add(AIR.ring, AIR.line, AIR.dot);
  AIR.label = document.createElement('div'); AIR.label.style.cssText = 'position:fixed;left:0;top:0;z-index:30;pointer-events:none;display:none;font:700 13px/1 "Share Tech Mono",monospace;color:#ffd0c4;text-shadow:0 1px 2px #000;letter-spacing:0.04em';
  document.body.appendChild(AIR.label); }
