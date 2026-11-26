// actors/drone.js — DRONE 1 THE DRONE WAR'S AIRFRAMES. The old "support drone" power-up (a sci-fi gatling gunship circling a man on foot) is retired; what
//   stays of it is the airframe idea and the repo's own UAV model. Here: the pooled drones of both sides — a quadcopter built once from primitives (one merged,
//   vertex-coloured body, one mesh of four rotor discs, four blades, a nav light: 7 draw calls) in four kinds: recon (ours; dressed in the real UAV model once
//   it is in, actors/real-air.js), fpv (ours, a charge slung under it), spot and kami (the enemy's) — their list (DW.list, at most DRONEWAR.max in the air), a
//   hit on one, its death (a burst in the air, the wreck tumbling down trailing smoke, burning a few seconds where it lands), the BUZZ (synthesised from the
//   existing tone() calls on a bus of its own: pitch and loudness by how near it is, panned by where it is off the camera's right), the squad's radio lines on
//   their own clock, and the one frame step that runs the rest (combat/drone-skills.js his own, campaign/drone-raid.js the enemy's, ui/drone-hud.js). Nothing is built until the
//   first drone flies; nothing allocates per frame. DRONEWAR.on false / ?nodrones: droneSpawn refuses, so nothing ever flies.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRONEWAR } from '../../config.js';
import { CO, coopDroneHit, coopHostDeath, S, audio, blockTop, blocksNear, burst, camera, clearDroneRaid, clearDroneSkills, decalScorch, droneHudOff, droneRaidReset, droneSkillsIdle, droneSkillsReset, heightAt, inShape, master, muted, radio, realAir, scene, sfx, spawnPart, tone, updateDroneHud, updateDroneRaid, updateDroneSkills } from '../hub.js';

const D = DRONEWAR, ARMS = [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]];
// what is in the air (dev / probes read it): list — the live drones · wrecks — the ones coming down or burning · n — what happened this stage
export const DW = { on:D.on, list:[], wrecks:[], sayAt:-1e9, n:{ flown:0, downed:0, lost:0 } };
const POOL = { recon:[], fpv:[], spot:[], kami:[] }, G = { body:{} }, _p = { x:0, y:0, z:0 }, _bn = [];

// ---- the airframe: shared geometry and materials, built on the first launch ----
function paint(g, hex){ const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for(let i = 0; i < n; i++){ a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function at(g, hex, x, y, z, rx, ry){ if(rx) g.rotateX(rx); if(ry) g.rotateY(ry); g.translate(x, y, z); return paint(g, hex); }
function shared(){ if(G.blade) return;
  G.blade = new THREE.BoxGeometry(0.25, 0.004, 0.022); G.bladeM = new THREE.MeshBasicMaterial({ color:0x0c0d0e });
  G.disc = mergeGeometries(ARMS.map(([x, z]) => new THREE.CircleGeometry(0.13, 12).rotateX(-Math.PI / 2).translate(x, 0.062, z)));
  G.discM = new THREE.MeshBasicMaterial({ color:0xd8dee4, transparent:true, opacity:0.14, depthWrite:false, side:THREE.DoubleSide });
  G.bodyM = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.62, metalness:0.35 });
  G.led = new THREE.SphereGeometry(0.024, 6, 5); G.ledFoe = new THREE.MeshBasicMaterial({ color:0xff2a1e }); G.ledOwn = new THREE.MeshBasicMaterial({ color:0x3ee8ff }); }
// one merged body (nose toward +z, metres at life size): the plate, two crossed arms, four motors, the battery, the camera, the aerial — and under it the
//   charge (fpv, kami: a rocket's warhead, its cone forward) or the gimbal ball and skids (recon, spot)
function bodyGeo(kind){ const foe = kind === 'spot' || kind === 'kami', L = [];
  L.push(at(new THREE.BoxGeometry(0.16, 0.035, 0.34), 0x1a1c1e, 0, 0, 0));
  L.push(at(new THREE.BoxGeometry(0.62, 0.02, 0.035), 0x121314, 0, 0, 0, 0, Math.PI / 4), at(new THREE.BoxGeometry(0.62, 0.02, 0.035), 0x121314, 0, 0, 0, 0, -Math.PI / 4));
  for(const [x, z] of ARMS) L.push(at(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 8), 0x3a3d40, x, 0.03, z));
  L.push(at(new THREE.BoxGeometry(0.09, 0.05, 0.18), foe ? 0x55552c : 0x2a4654, 0, 0.043, -0.03), at(new THREE.BoxGeometry(0.05, 0.05, 0.04), 0x08090a, 0, 0.03, 0.18), at(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 5), 0x0c0c0c, 0.03, 0.11, -0.15));
  if(kind === 'kami' || kind === 'fpv') L.push(at(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), 0x4a5230, 0, -0.06, 0.03, Math.PI / 2), at(new THREE.ConeGeometry(0.056, 0.15, 8), 0x6a7040, 0, -0.06, 0.255, Math.PI / 2));
  else { L.push(at(new THREE.SphereGeometry(0.05, 8, 6), 0x0e0f11, 0, -0.055, 0.1)); for(const s of [-1, 1]) L.push(at(new THREE.BoxGeometry(0.012, 0.09, 0.2), 0x18191b, s * 0.09, -0.06, 0)); }
  return mergeGeometries(L); }
function build(kind){ shared(); const g = new THREE.Group(), u = g.userData = { kind, props:[], nav:null, disc:null }, foe = kind === 'spot' || kind === 'kami'; g.rotation.order = 'YXZ';
  const body = new THREE.Mesh(G.body[kind] || (G.body[kind] = bodyGeo(kind)), G.bodyM); body.castShadow = true; g.add(body);
  u.disc = new THREE.Mesh(G.disc, G.discM); g.add(u.disc);
  for(const [x, z] of ARMS){ const b = new THREE.Mesh(G.blade, G.bladeM); b.position.set(x, 0.058, z); b.rotation.y = Math.random() * 3; g.add(b); u.props.push(b); }
  u.nav = new THREE.Mesh(G.led, foe ? G.ledFoe : G.ledOwn); u.nav.position.set(0, 0.035, -0.2); g.add(u.nav);
  g.scale.setScalar(kind === 'recon' ? D.size.recon : D.size.quad); g.visible = false; scene.add(g);
  if(kind === 'recon') realAir(g, 'air_uav');   // the repo's UAV model takes the frame's place once it is in (the nav light is kept; ?procair: the quadcopter stays)
  return g; }

// ---- the list ----
// a drone takes the air at (x, y, z), nose to yaw: the record its owner flies (x y z, yaw / pitch / roll, hp…), or null — the war is off, or the sky is full
export function droneSpawn(kind, x, y, z, yaw){ if(!DW.on || DW.list.length >= D.max) return null; const g = POOL[kind].pop() || build(kind), u = g.userData;
  const d = { kind, foe:kind === 'spot' || kind === 'kami', g, x, y, z, vx:0, vy:0, vz:0, yaw:yaw || 0, pitch:0, roll:0, hp:1, t:0, hitT:0, jamT:0, bzAt:0, dead:false };
  u.disc.visible = !u.realAir; g.visible = true; g.position.set(x, y, z); g.rotation.set(0, d.yaw, 0); DW.list.push(d); DW.n.flown++; return d; }
function unlist(d){ const i = DW.list.indexOf(d); if(i >= 0) DW.list.splice(i, 1); d.dead = true; }
// gone without a wreck (its time is up, it flew off the field, the stage is over)
export function droneFree(d){ if(!d || !d.g) return; unlist(d); d.g.visible = false; POOL[d.kind].push(d.g); d.g = null; }
function wreckEnd(i){ const w = DW.wrecks[i]; DW.wrecks.splice(i, 1); w.g.visible = false; w.g.rotation.set(0, 0, 0); POOL[w.kind].push(w.g); }
// shot out of the air: a burst where it was, and the wreck goes down
export function droneKill(d){ if(!d || d.dead || !d.g) return; if(d.nid && CO.ai) coopHostDeath(d);   /* COOP 9 the guest's copy goes down with it */ unlist(d); DW.n.downed++; const g = d.g; d.g = null; g.visible = true; g.userData.disc.visible = false; _p.x = d.x; _p.z = d.z;
  spawnPart(d.x, d.y, d.z, 0, 0, 0, { tex:'flash', color:0xfff2d0, size:2.4, life:0.07, grav:0, drag:0 });
  burst(_p, 0xffb050, 8, 7, { y:d.y, life:0.3, size:0.5, grav:-8, drag:3 }); burst(_p, 0x2a2420, 3, 2.4, { y:d.y, life:0.8, size:1.4, smoke:true, grav:-0.4, drag:2, op:0.45 }); sfx('explode', _p, 0.4);
  if(DW.wrecks.length >= D.wrecks) wreckEnd(0);
  DW.wrecks.push({ g, kind:d.kind, x:d.x, y:d.y, z:d.z, vx:d.vx * 0.5 + (Math.random() - 0.5) * 3, vy:Math.min(2, d.vy * 0.3), vz:d.vz * 0.5 + (Math.random() - 0.5) * 3, sx:4 + Math.random() * 5, sz:(Math.random() - 0.5) * 9, t:0, sm:0, down:false }); }
// a round struck it: true when that brought it down
export function droneHurt(d, dmg){ if(!d || d.dead) return false; if(d.puppet && coopDroneHit(d, dmg)) return false;   /* COOP 9 on a co-op guest the drone is the host's: the hit is reported */ d.hp -= dmg; d.hitT = 0.16; _p.x = d.x; _p.z = d.z;
  spawnPart(d.x, d.y, d.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, { color:0xffd27a, size:0.35, life:0.28, grav:-6, drag:2 }); sfx('hit', _p, 0.6);
  if(d.hp > 0) return false; droneKill(d); return true; }
// is there a roof over (x, z): he stands inside a block's footprint (a tent, a house, a bunker) whose top is DRONEWAR.recon.roof m above the ground under him
export function roofOver(x, z){ const top = heightAt(x, z) + D.recon.roof, L = blocksNear(x, z, 3, _bn); for(let i = 0; i < L.length; i++){ const bl = L[i]; if(inShape(bl, x, z) && blockTop(bl) > top) return true; } return false; }

// ---- the wrecks: down under gravity, tumbling, trailing smoke and a lick of flame; a thud, a scorch mark, a small fire for DRONEWAR.wreck.burn s ----
function wrecks(dt){ const W = D.wreck; for(let i = DW.wrecks.length - 1; i >= 0; i--){ const w = DW.wrecks[i], g = w.g; w.sm -= dt;
    if(!w.down){ w.vy -= W.fall * dt; w.x += w.vx * dt; w.y += w.vy * dt; w.z += w.vz * dt; g.rotation.x += w.sx * dt; g.rotation.z += w.sz * dt; const gy = heightAt(w.x, w.z) + 0.14;
      if(w.sm <= 0){ w.sm = W.smoke; spawnPart(w.x, w.y, w.z, 0, 0.6, 0, { color:0x1e1a16, size:0.9, life:0.9, smoke:true, grav:0.3, drag:1.2, grow:1.4, op:0.5 });
        spawnPart(w.x, w.y, w.z, 0, 0, 0, { tex:'fire', color:0xffd090, color2:0xff3a08, size:0.6, life:0.2, grav:0, drag:2 }); }
      if(w.y <= gy){ w.y = gy; w.down = true; w.t = 0; g.rotation.set(0.3, g.rotation.y, 0.5); _p.x = w.x; _p.z = w.z;
        burst(_p, 0xffa040, 6, 4, { y:gy + 0.3, life:0.4, size:0.3, grav:-8, drag:2, up:2 }); sfx('thud', _p, 0.6); decalScorch(w.x, w.z, 0.9, 0.5); }
      g.position.set(w.x, w.y, w.z); continue; }
    w.t += dt; if(w.t >= W.burn){ wreckEnd(i); continue; }
    if(w.sm <= 0){ w.sm = W.smoke * 1.5; const k = 1 - w.t / W.burn;
      spawnPart(w.x + (Math.random() - 0.5) * 0.4, w.y + 0.2, w.z + (Math.random() - 0.5) * 0.4, 0, 1.6 + Math.random(), 0, { tex:'fire', color:0xffd090, color2:0xff3a08, size:0.5 + 0.6 * k, life:0.35, grav:1.5, drag:1.6, grow:0.7 });
      if(Math.random() < 0.4) spawnPart(w.x, w.y + 0.7, w.z, 0.3, 1.4, 0.2, { color:0x1e1a16, size:1.1, life:1.2, smoke:true, grav:0.3, drag:0.9, grow:1.5, op:0.45 }); } } }
// a live drone drawn where its owner put it: blades turning (slow when jammed), the nav light blinking (lit while it is being hit)
function frame(d, dt, now){ const g = d.g, u = g.userData; d.t += dt; if(d.hitT > 0) d.hitT -= dt; if(d.jamT > 0) d.jamT -= dt;
  g.position.set(d.x, d.y, d.z); g.rotation.set(-d.pitch, d.yaw, d.roll);
  if(!u.realAir){ const s = dt * (d.jamT > 0 ? 14 : 55); for(let i = 0; i < 4; i++) u.props[i].rotation.y += i & 1 ? -s : s; }
  u.nav.visible = d.hitT > 0 || (now * (d.foe ? 3.2 : 1.6)) % 1 < 0.5; }

// ---- the buzz: every B.every s a short sawtooth (and its octave, square) on a bus of its own — the chunks overlap into a rattling whine. B = { hz:[far, near],
//   every, vol:[far, near], r }: silent past r m; k2 lifts the pitch (the dive). The bus is panned by where the drone is off the camera's right. ----
let _ctx = null, _bus = null, _pan = null;
function buzzBus(){ const a = audio(); if(!a) return null; if(_ctx !== a){ _ctx = a; _bus = null;
    try{ const g = a.createGain(); _pan = a.createStereoPanner ? a.createStereoPanner() : null; if(_pan){ g.connect(_pan); _pan.connect(master || a.destination); } else g.connect(master || a.destination); _bus = g; } catch(e){ _bus = null; } }
  return _bus; }
export function droneBuzz(d, now, B, k2){ if(muted || now < d.bzAt) return; d.bzAt = now + B.every; const p = S.player; if(!p) return;
  const dx = d.x - p.pos.x, dz = d.z - p.pos.z, k = 1 - Math.hypot(dx, d.y - heightAt(p.pos.x, p.pos.z) - 1.5, dz) / B.r; if(k <= 0) return; const bus = buzzBus(); if(!bus) return;
  if(_pan){ const m = camera.matrixWorld.elements, L = Math.hypot(dx, dz) || 1; _pan.pan.value = Math.max(-0.9, Math.min(0.9, (dx * m[0] + dz * m[2]) / L)); }
  const f = (B.hz[0] + (B.hz[1] - B.hz[0]) * k * k) * (k2 || 1) * (0.985 + Math.random() * 0.03), v = B.vol[0] + (B.vol[1] - B.vol[0]) * k;
  tone(f, B.every * 2.1, { type:'sawtooth', vol:v, slideTo:f * 1.04, bus }); tone(f * 2.02, B.every * 1.7, { type:'square', vol:v * 0.3, bus }); }
// DRONE 2 his own FPV drone as he hears it through the goggles: the same chunks, straight down the middle (f Hz, v loud)
let _own = null, _octx = null;
export function droneWhine(f, v){ if(muted) return; const a = audio(); if(!a) return; if(_octx !== a){ _octx = a; try{ _own = a.createGain(); _own.connect(master || a.destination); } catch(e){ _own = null; } } if(!_own) return;
  const j = 0.985 + Math.random() * 0.03; tone(f * j, 0.2, { type:'sawtooth', vol:v, slideTo:f * j * 1.03, bus:_own }); tone(f * j * 2.02, 0.16, { type:'square', vol:v * 0.3, bus:_own }); }
// a radio line of the drone war (DRONEWAR.say, its own clock; never on top of a line that has just gone up unless it must be heard)
export function droneSay(key, must){ const Y = D.say, L = Y[key], now = performance.now() / 1000; if(!L || !must && (now - DW.sayAt < Y.gap || now - (radio.at || -9) < 2.5)) return false;
  DW.sayAt = now; radio(typeof L === 'string' ? L : L[(Math.random() * L.length) | 0]); return true; }

// ---- the frame, the stage, the end ----
export function updateDroneWar(dt, now){ if(!DW.on) return; updateDroneSkills(dt, now); updateDroneRaid(dt, now);
  for(let i = DW.list.length - 1; i >= 0; i--) frame(DW.list[i], dt, now);
  if(DW.wrecks.length) wrecks(dt); updateDroneHud(dt, now); }
// COOP 9 the guest's frame (game/coop-puppets.js): the drones are the host's — drawn where the snapshot put them, the wrecks come down; no skill, no raid of this page's own
export function droneWarGuest(dt, now){ if(!DW.on) return; for(let i = DW.list.length - 1; i >= 0; i--) frame(DW.list[i], dt, now); if(DW.wrecks.length) wrecks(dt); }
// not in play (game/loop.js, every frame of a menu, a pause, the death, a won stage): the pause holds everything as it is; anything else ends what he was flying
export function droneWarIdle(){ if(DW.on && S.mode !== 'paused'){ droneSkillsIdle(); droneHudOff(); } }
// the field is cleared (game/flow.js: a new run, back to the menu)
export function clearDroneWar(){ clearDroneSkills(); clearDroneRaid(); while(DW.list.length) droneFree(DW.list[0]); while(DW.wrecks.length) wreckEnd(0); droneHudOff(); }
// a stage begins (ui/briefing.js)
export function droneWarReset(now){ clearDroneWar(); DW.sayAt = -1e9; DW.n.flown = DW.n.downed = DW.n.lost = 0; droneSkillsReset(now); droneRaidReset(now); }
