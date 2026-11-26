// actors/fort-boss-look.js — BOSS 1 THE FORT BOSS'S LOOK (campaign/fort-boss.js drives him): the enemy rifleman's rig scaled to a 2.6–2.9 m giant
//   (FORTBOSS.h by the fort's tier) and armoured — a domed helmet with a glowing eye slit, a chest plate over a belly plate, two layered pauldrons, a
//   power pack on his back with glowing cells (the weak point), thigh tassets — and a heavy gun (receiver, ammo box, finned barrel jacket) in place of the
//   rifle. Every piece is bolted to the bone it rides (placed in the rig's rest frame, so it follows every stance); a plate shot off flies off whole
//   (fortBossPlateOff → tumbling debris, then gone). ONE entry point, fortBossLook(e, def) (FORTBOSS.model 'rig'): a downloaded rigged model replaces
//   this file's body without touching the fight. Its colour is the land's (FORTBOSS.lands).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FORTBOSS } from '../../config.js';
import { S, fortBossGlb, fortBossGlbStrip, heightAt, scene, spawnPart } from '../hub.js';

const DEBRIS = [], _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _w = new THREE.Vector3();
let _geo = null;
// the shapes, made once (rig units: the rifleman is 1.44 tall in his mesh's own frame, +z his front, +x his right)
export function fbGeos(){ return geos(); }
function geos(){ if(_geo) return _geo; const G = {};
  G.chest = new RoundedBoxGeometry(0.37, 0.3, 0.085, 2, 0.028); G.belly = new RoundedBoxGeometry(0.31, 0.11, 0.06, 2, 0.02);
  G.ridge = new RoundedBoxGeometry(0.05, 0.24, 0.03, 2, 0.012);
  G.pack = new RoundedBoxGeometry(0.27, 0.31, 0.13, 2, 0.025); G.cell = new THREE.CylinderGeometry(0.024, 0.024, 0.22, 10); G.stack = new THREE.CylinderGeometry(0.022, 0.028, 0.12, 8);
  G.paul = new RoundedBoxGeometry(0.2, 0.055, 0.23, 2, 0.022); G.paul2 = new RoundedBoxGeometry(0.17, 0.045, 0.2, 2, 0.018); G.side = new RoundedBoxGeometry(0.05, 0.22, 0.2, 2, 0.018);
  G.helm = new THREE.SphereGeometry(0.165, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58); G.brim = new THREE.CylinderGeometry(0.17, 0.175, 0.035, 20, 1, true);
  G.visor = new RoundedBoxGeometry(0.22, 0.13, 0.06, 2, 0.02); G.slit = new THREE.BoxGeometry(0.16, 0.016, 0.01); G.crest = new RoundedBoxGeometry(0.035, 0.07, 0.24, 2, 0.012);
  G.tasset = new RoundedBoxGeometry(0.11, 0.13, 0.03, 2, 0.012);
  G.recv = new RoundedBoxGeometry(0.1, 0.12, 0.42, 2, 0.02); G.box = new RoundedBoxGeometry(0.13, 0.11, 0.15, 2, 0.015); G.barrel = new THREE.CylinderGeometry(0.02, 0.02, 1, 10);
  G.jacket = new THREE.CylinderGeometry(0.045, 0.045, 1, 12); G.fin = new THREE.TorusGeometry(0.048, 0.007, 4, 14); G.grip = new RoundedBoxGeometry(0.04, 0.12, 0.05, 2, 0.012);
  return (_geo = G); }
export function fbMats(def){ return mats(def); }
function mats(def){ const L = def.land || {}, c = new THREE.Color(L.c ?? 0x55584e), glow = L.glow ?? 0x4ad8ff, M = (o) => new THREE.MeshStandardMaterial(o);
  c.lerp(new THREE.Color(0x3a3c3e), 0.45);   // (the land's colour on gunmetal: the plates read as steel against its ground)
  return { plate:M({ color:c, metalness:0.7, roughness:0.4 }), trim:M({ color:c.clone().multiplyScalar(0.5), metalness:0.75, roughness:0.36 }),
    dark:M({ color:0x1c1d1f, metalness:0.75, roughness:0.4 }), glow:M({ color:0x111111, emissive:new THREE.Color(glow), emissiveIntensity:2.2, roughness:0.3 }),
    eye:M({ color:0x110000, emissive:new THREE.Color(0xff2a10), emissiveIntensity:3, roughness:0.4 }), glowC:new THREE.Color(glow) }; }
export const fbMesh = (g, m, x, y, z, rx, ry, rz, sx, sy, sz) => mesh(g, m, x, y, z, rx, ry, rz, sx, sy, sz);
const mesh = (g, m, x, y, z, rx, ry, rz, sx, sy, sz) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); if(sx) o.scale.set(sx, sy ?? sx, sz ?? sx); o.castShadow = true; return o; };
// bolt group g onto bone b so that it sits at P (rig units, in the mesh's own frame) at rest
export function fbBolt(root, b, g, x, y, z){ return bolt(root, b, g, x, y, z); }
function bolt(root, b, g, x, y, z){ _inv.copy(root.matrixWorld).invert(); _rel.multiplyMatrices(_inv, b.matrixWorld).invert(); _m.compose(_p.set(x, y, z), _q.identity(), _one);
  _m.premultiply(_rel); _m.decompose(g.position, g.quaternion, g.scale); b.add(g); return g; }
// THE ONE ENTRY: dress enemy e (an infantry rig) as the boss described by def ({ tier, land }); returns the look (kept on e.fbLook)
export function fortBossLook(e, def){ const G = FORTBOSS.model === 'glb' && fortBossGlb(e, def); if(G) return G; return rigLook(e, def); }   // BOSS 2 the real rigged model when it is in (actors/fort-boss-glb.js), else the rig
function rigLook(e, def){ const m = e.mesh, u = m.userData, G = geos(), M = mats(def), k = (FORTBOSS.h[def.tier - 1] || 2.75) / FORTBOSS.baseH;
  m.scale.multiplyScalar(k); m.scale.x *= 1.12; m.scale.z *= 1.1; m.updateMatrixWorld(true);   // (a heavy man: broader than he is tall)
  const gp = u.parts && u.parts.find(p => p.kind === 'gun'); if(gp) gp.o.visible = false;   // (the batch's rifle goes: he carries the heavy gun)
  const head = u.head.getWorldPosition(_w).clone(); m.worldToLocal(head); const hx = head.x, hy = head.y, hz = head.z;
  const L = { e, k, M, pieces:[], plates:{}, gun:null, gp, glowT:0 };
  const P = (key, bone, x, y, z, build) => { const g = new THREE.Group(); build(g); bolt(m, bone, g, x, y, z); L.pieces.push(g); if(key) L.plates[key] = g; return g; };
  P('chest', u.up, 0, 1.0, 0.105, g => { g.add(mesh(G.chest, M.plate, 0, 0.02, 0)); g.add(mesh(G.ridge, M.trim, 0, 0.02, 0.04)); g.add(mesh(G.belly, M.trim, 0, -0.17, -0.006, -0.12)); for(const sx of [-1, 1]) g.add(mesh(G.side, M.plate, sx * 0.19, -0.03, -0.1)); });
  P('pack', u.up, 0, 1.0, -0.145, g => { g.add(mesh(G.pack, M.dark, 0, 0, 0)); for(const sx of [-1, 1]){ g.add(mesh(G.cell, M.glow, sx * 0.075, 0, -0.07)); g.add(mesh(G.stack, M.trim, sx * 0.08, 0.2, 0.01)); } g.add(mesh(G.belly, M.plate, 0, -0.17, 0.01)); });
  for(const [key, sx] of [['shR', -1], ['shL', 1]]) P(key, u.up, sx * 0.21, 1.14, -0.03, g => { g.add(mesh(G.paul, M.plate, sx * 0.02, 0.02, 0, 0, 0, sx * -0.42)); g.add(mesh(G.paul2, M.trim, sx * 0.07, -0.05, 0, 0, 0, sx * -0.85)); g.add(mesh(G.paul2, M.plate, sx * 0.1, -0.11, 0, 0, 0, sx * -1.1, 0.85, 1, 0.9)); });
  P('helmet', u.head, hx, hy + 0.12, hz + 0.07, g => { g.add(mesh(G.helm, M.plate, 0, 0, 0, 0, 0, 0, 1.18, 1.06, 1.2)); g.add(mesh(G.brim, M.trim, 0, 0.005, 0, 0, 0, 0, 1.18, 1, 1.2));
    g.add(mesh(G.visor, M.dark, 0, -0.06, 0.14, 0.12)); g.add(mesh(G.slit, M.eye, 0, -0.035, 0.172, 0.12)); g.add(mesh(G.crest, M.trim, 0, 0.155, -0.01)); });
  for(const sx of [-1, 1]) P(null, u.body, sx * 0.085, 0.69, 0.075, g => g.add(mesh(G.tasset, M.plate, 0, 0, 0, -0.15, 0, sx * 0.12)));
  // the heavy gun along the gun joint, from its grip to its muzzle (in the joint's own frame)
  { const gun = new THREE.Group(), mz = u.muzzle.position, len = mz.length() || 0.7; gun.quaternion.setFromUnitVectors(_p.set(0, 0, 1), _w.copy(mz).normalize());
    const s = 1 / 0.85; gun.add(mesh(G.recv, M.dark, 0, 0.01 * s, 0.12 * s)); gun.add(mesh(G.box, M.trim, -0.02 * s, -0.09 * s, 0.1 * s)); gun.add(mesh(G.grip, M.dark, 0, -0.08 * s, -0.02 * s, 0.3));
    const jl = len * 0.42, jz = 0.36 * s + jl / 2; gun.add(mesh(G.jacket, M.dark, 0, 0.02 * s, jz, Math.PI / 2, 0, 0, 1, jl, 1)); for(let i = 0; i < 5; i++) gun.add(mesh(G.fin, M.trim, 0, 0.02 * s, 0.36 * s + jl * (0.1 + i * 0.2), 0, 0, 0));
    gun.add(mesh(G.barrel, M.dark, 0, 0.02 * s, (0.36 * s + jl + len) / 2, Math.PI / 2, 0, 0, 1, Math.max(0.05, len - 0.36 * s - jl + 0.05), 1));
    gun.scale.setScalar(0.85); u.gun.add(gun); L.gun = gun; L.pieces.push(gun); }
  e.r *= k; e.fbLook = L; return L; }
// the pack's cells breathe (k 0–1 = how hot: faster and brighter as he weakens; rage = red)
export function fortBossGlow(L, dt, hot, rage){ if(!L) return; L.glowT += dt * (2 + hot * 5); const g = L.M.glow; g.emissiveIntensity = 1.4 + Math.sin(L.glowT) * 0.8 + hot * 1.6;
  if(rage) g.emissive.setHex(0xff3010); L.M.eye.emissiveIntensity = rage ? 4 + Math.sin(L.glowT * 1.7) * 1.5 : 3; }
// a plate shot off: it leaves the bone where it is and tumbles away from the shot (ux, uz = the way the round flew)
export function fortBossPlateOff(L, key, ux, uz, hard){ const g = L && L.plates[key]; if(!g || !g.parent) return false; L.plates[key] = null;
  g.getWorldPosition(_w); scene.attach(g); const a = Math.random() * 6.283, sp = (hard ? 6 : 3.5) + Math.random() * 2;
  DEBRIS.push({ g, vx:(ux || Math.cos(a)) * sp, vy:3.5 + Math.random() * 2.5, vz:(uz || Math.sin(a)) * sp, rx:(Math.random() - 0.5) * 12, rz:(Math.random() - 0.5) * 12, t:0, life:2.6 + Math.random() });
  for(let i = 0; i < 14; i++) spawnPart(_w.x, _w.y, _w.z, (Math.random() - 0.5) * 8, 2 + Math.random() * 5, (Math.random() - 0.5) * 8, { color:i % 3 ? 0xffd080 : 0xffffff, size:0.18 + Math.random() * 0.2, life:0.35 + Math.random() * 0.3, grav:12, drag:1 });
  return true; }
// he is down (or gone): every piece left flies off, the rifle part comes back, the rig is an ordinary man again for the pool
export function fortBossStrip(L, fly){ if(!L || L.gone) return; L.gone = true; const u = L.e.mesh.userData; if(L.glb) fortBossGlbStrip(L, fly);
  for(const key in L.plates) if(L.plates[key]) fortBossPlateOff(L, key, 0, 0, true);
  for(const g of L.pieces){ if(!g.parent || g.parent === scene) continue; if(fly && g !== L.gun){ scene.attach(g); DEBRIS.push({ g, vx:(Math.random() - 0.5) * 5, vy:3, vz:(Math.random() - 0.5) * 5, rx:(Math.random() - 0.5) * 9, rz:(Math.random() - 0.5) * 9, t:0, life:2.2 }); } else { g.parent.remove(g); disposeTree(g, false); } }
  if(L.gp) L.gp.o.visible = true; if(u && u.gun && L.gun && L.gun.parent) u.gun.remove(L.gun);
  L.dispose = true; }
function disposeTree(g, mats){ g.traverse(o => { if(mats && o.material) o.material.dispose(); }); }
// once a frame (host and guest): the plates in the air
export function fortBossLookTick(dt){ for(let i = DEBRIS.length - 1; i >= 0; i--){ const d = DEBRIS[i], g = d.g; d.t += dt; d.vy -= 18 * dt;
    g.position.x += d.vx * dt; g.position.y += d.vy * dt; g.position.z += d.vz * dt; g.rotation.x += d.rx * dt; g.rotation.z += d.rz * dt;
    const gy = heightAt(g.position.x, g.position.z) + 0.12; if(g.position.y < gy){ g.position.y = gy; d.vy *= -0.25; d.vx *= 0.55; d.vz *= 0.55; d.rx *= 0.5; d.rz *= 0.5; }
    if(d.t > d.life){ const s = Math.max(0, 1 - (d.t - d.life) / 0.6); g.scale.setScalar(Math.max(0.001, g.scale.x * (0.9 + 0.1 * s))); if(s <= 0){ scene.remove(g); DEBRIS.splice(i, 1); } } } }
export function fortBossLookClear(){ for(const d of DEBRIS) scene.remove(d.g); DEBRIS.length = 0; }
