// world/tree-fall.js — Z262 A TREE GOES DOWN FOR REAL: rammed by a tank, struck by a shell or caught in a blast, a tree topples about its foot —
// slowly at first, then faster (θ'' = g/ℓ·sin θ, ℓ = where its weight sits), the way it was pushed; the crown strikes the ground (a burst of leaves
// and twigs, a dust cloud, a thud and a shake when it is close), bounces once and settles along the slope, and lies there. Shells and rounds that
// pass through a trunk fell it in their line of flight; a blast fells every tree within reach, outward. Every standing tree is listed here.
import * as THREE from 'three';
import { TREEFALL } from '../../config.js';
import { S, haptic, heightAt, sfx, spawnPart } from '../hub.js';

export const TREES = [];   // the standing trees (crushables of kind 'tree')
export const TRUNKS_DOWN = [];   // Z404 the trees lying where they fell: foot, the way they lie, the trunk's length and radius (a ride climbs over them)
const FALL = [], _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(), _R = new THREE.Quaternion(), _ax = new THREE.Vector3();
export function clearTrees(){ TREES.length = 0; FALL.length = 0; TRUNKS_DOWN.length = 0; }
// Z404 THE TRUNK A VEHICLE MEETS: the drawn bark (the wood, not the leaves) between TREEFALL.band m over the foot, as its median distance from the axis —
//   read once per tree geometry (the procedural tree, then the real species that takes its place: an oak's trunk is 0.8 m, a birch's 0.2 m, where the
//   old collider gave every tree c.r × 0.75 ≈ 0.45 m, so a ride ran 0.35 m into an oak and stopped 0.25 m short of a birch) and scaled by the tree's own size
const TRUNK = new WeakMap();
export function trunkOf(g, sy, band){ const P = g && g.attributes.position, L = g && g.attributes.aLeaf, d = [], lo = band[0] / sy, hi = band[1] / sy; if(!P) return 0;
  for(let i = 0; i < P.count; i++){ if(L && L.getX(i) > 0.3) continue; const y = P.getY(i); if(y < lo || y > hi) continue; d.push(Math.hypot(P.getX(i), P.getZ(i))); }
  if(d.length < 6) return 0; d.sort((a, b) => a - b); return d[d.length >> 1]; }
export function trunkR(c){ const g = c.im && c.im.geometry; if(!g) return c.r * 0.75; if(c._trG === g) return c._tr;
  c.im.getMatrixAt(c.k, _M); _M.decompose(_P, _Q, _S); let k = TRUNK.get(g); if(k === undefined){ k = trunkOf(g, _S.y || 1, TREEFALL.band); TRUNK.set(g, k); }
  c._trG = g; c._tr = k > 0 ? k * Math.max(_S.x, _S.z) : c.r * 0.75; return c._tr; }

// fell tree c toward (dx, dz) with a starting swing w0 (rad/s)
export function fellTree(c, dx, dz, w0){ if(!c || c.falling) return; const tr = trunkR(c); c.alive = false; c.falling = true; const i = TREES.indexOf(c); if(i >= 0) TREES.splice(i, 1);
  c.im.getMatrixAt(c.k, _M); _M.decompose(_P, _Q, _S); const L = Math.hypot(dx, dz) || 1, g = c.im.geometry; if(!g.boundingBox) g.computeBoundingBox();
  const h = Math.max(2, g.boundingBox.max.y * _S.y);
  FALL.push({ c, base:_P.clone(), q0:_Q.clone(), s:_S.clone(), dx:dx / L, dz:dz / L, th:0.015, w:w0 || TREEFALL.push, h, tr, bounced:false, rest:false, t:0 });
  const p = S.player; if(p && (p.pos.x - c.x) ** 2 + (p.pos.z - c.z) ** 2 < 900) sfx('crunch', { x:c.x, z:c.z }, 0.5); }

// a round at (x, z), height above ground y, flying (vx, vz): a trunk it passes through goes down along the line of fire
export function shotTree(x, z, y, vx, vz){ const R = TREEFALL.trunk; for(const c of TREES){ const dx = x - c.x, dz = z - c.z, r = R * (c.s || 1);
  if(dx * dx + dz * dz < r * r && y < TREEFALL.hitH * (c.s || 1)){ fellTree(c, vx, vz, TREEFALL.shotPush); chips(c.x, c.z, y); return c; } } return null; }
// a blast: every tree within r falls away from it, the nearer the harder
export function blastTrees(x, z, r){ if(r < TREEFALL.minBlast) return; for(const c of TREES.slice()){ const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
  if(d < r * TREEFALL.blastK) fellTree(c, dx || Math.random() - 0.5, dz || Math.random() - 0.5, TREEFALL.shotPush * (1.4 - d / (r * TREEFALL.blastK))); } }
function chips(x, z, y){ for(let k = 0; k < 10; k++) spawnPart(x, heightAt(x, z) + y, z, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, { color:Math.random() < 0.5 ? 0x6a5038 : 0xc8a878, size:0.12 + Math.random() * 0.15, life:0.6, grav:-14, drag:1.2 }); }   // bark and white wood

export function updateTreeFall(dt){ if(!FALL.length) return; dt = Math.min(dt, 0.05); const F = TREEFALL;
  for(let i = FALL.length - 1; i >= 0; i--){ const f = FALL[i]; if(f.rest){ FALL.splice(i, 1); continue; } f.t += dt;
    const reach = f.h * 0.92, hx = f.base.x + f.dx * reach, hz = f.base.z + f.dz * reach, end = Math.PI / 2 - Math.atan2(heightAt(hx, hz) - f.base.y, reach) - 0.06;
    const a = F.g / (f.h * F.cg) * Math.sin(f.th); f.w += a * dt; f.th += f.w * dt;
    if(f.th >= end){ f.th = end;
      if(!f.bounced){ f.bounced = true; const hit = f.w; f.w = -hit * F.bounce; impact(f, hx, hz); }
      else if(Math.abs(f.w) < 0.05 || f.t > 6){ f.w = 0; f.rest = true; TRUNKS_DOWN.push({ x:f.base.x, z:f.base.z, dx:f.dx, dz:f.dz, L:f.h * 0.6, r:f.tr }); } else f.w = -f.w * F.bounce; }   // Z404 down: its trunk lies along the ground
    _ax.set(f.dz, 0, -f.dx); _R.setFromAxisAngle(_ax, f.th); _Q.copy(_R).multiply(f.q0); _M.compose(f.base, _Q, f.s); f.c.im.setMatrixAt(f.c.k, _M); f.c.im.instanceMatrix.needsUpdate = true; } }
function impact(f, hx, hz){ const gy = heightAt(hx, hz), leafy = f.c.leafy !== false, n = Math.round(f.h * 1.6);
  for(let k = 0; k < n; k++){ const t = 0.4 + Math.random() * 0.6, x = f.base.x + f.dx * f.h * t + (Math.random() - 0.5) * 3, z = f.base.z + f.dz * f.h * t + (Math.random() - 0.5) * 3;
    spawnPart(x, gy + 0.6 + Math.random() * 2, z, (Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4, { color:leafy ? (Math.random() < 0.5 ? 0x4e7e32 : 0x6a9a40) : 0x5a4a38, size:0.2 + Math.random() * 0.25, life:1.4, grav:-4, drag:1.5 }); }
  for(let k = 0; k < 3; k++) spawnPart(f.base.x + f.dx * f.h * (0.5 + k * 0.2), gy + 0.5, f.base.z + f.dz * f.h * (0.5 + k * 0.2), 0, 0.8, 0, { color:0x9a8a6a, size:2.2 + f.h * 0.12, life:1.8, smoke:true, grav:-0.3, drag:1.6, grow:1.8, op:0.4 });
  const p = S.player; if(p){ const d2 = (p.pos.x - hx) ** 2 + (p.pos.z - hz) ** 2; if(d2 < 400){ sfx('crunch', { x:hx, z:hz }, 0.8); haptic(8); S.shake = Math.min(1.2, (S.shake || 0) + 0.25 * (1 - d2 / 400)); } } }
