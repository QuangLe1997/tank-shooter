// loot/gift-crate.js — Z369 THE RANK'S GIFT CRATE, FOR REAL (soldier mode): what the HQ drops when he climbs a rank. It was a loot gem — a blue fleck
//   the magnet pulled into him before he saw it. Now it is a crate worth walking to:
//   · an olive-drab crate with a gold satin ribbon round it, a bow on the lid and a yellow star stencilled on its flanks (rounded edges, real shadows)
//   · it comes down under a small striped parachute from GIFTBOX.drop.h m, swaying; on touching down the canopy sags, slides off to one side and fades
//   · then it floats: GIFTBOX.hover m off the ground, bobbing, turning slowly, rocking a little — a warm glow round it, a soft shaft of light up from it,
//     a pool of light on the ground under it, gold sparks spiralling up round it (no real light: nothing for every material to recompile for)
//   · he walks into it (GIFTBOX.reach m) and it opens: the lid flies off spinning, a flash, a ring and a burst of gold, and the reward is his (onOpen);
//     the crate shrinks away. No magnet: he goes to it. Cleared with the battle.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GIFTBOX as GIFT } from '../../config.js';
import { S, burst, heightAt, ringPulse, scene, sfx } from '../hub.js';

export const GIFTS = [];
let K = null;
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const radial = (stops) => canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); for(const [o, c] of stops) r.addColorStop(o, c); g.fillStyle = r; g.fillRect(0, 0, w, w); });
// the shared shapes and pictures, made once
function kit(){ if(K) return K; const s = GIFT.size, h = GIFT.h, rb = s * 0.18;
  const star = canvasTex(128, 128, (g, w) => { g.fillStyle = '#f2c230'; g.beginPath(); for(let i = 0; i < 10; i++){ const r = i % 2 ? w * 0.19 : w * 0.44, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); });
  const gores = canvasTex(256, 32, (g, w, hh) => { for(let i = 0; i < 8; i++){ g.fillStyle = i % 2 ? '#f4f1e8' : '#e8762c'; g.fillRect(i * w / 8, 0, w / 8, hh); } });
  const shaft = canvasTex(64, 128, (g, w, hh) => { const v = g.createLinearGradient(0, hh, 0, 0); v.addColorStop(0, 'rgba(255,225,130,1)'); v.addColorStop(0.3, 'rgba(255,215,120,0.45)'); v.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = v; g.fillRect(0, 0, w, hh);
    g.globalCompositeOperation = 'destination-in'; const x = g.createLinearGradient(0, 0, w, 0); x.addColorStop(0, 'rgba(0,0,0,0)'); x.addColorStop(0.5, 'rgba(0,0,0,1)'); x.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = x; g.fillRect(0, 0, w, hh); });
  K = { body:new RoundedBoxGeometry(s, h, s, 3, 0.035), lid:new RoundedBoxGeometry(s + 0.05, h * 0.24, s + 0.05, 3, 0.03),
    bandA:new THREE.BoxGeometry(rb, h * 1.002, s + 0.014), bandB:new THREE.BoxGeometry(rb, h * 0.24 + 0.012, s + 0.064), bandC:new THREE.BoxGeometry(s + 0.064, h * 0.24 + 0.012, rb),
    loop:new THREE.TorusGeometry(s * 0.17, s * 0.045, 8, 24), knot:new THREE.SphereGeometry(s * 0.075, 14, 10), tail:new THREE.BoxGeometry(rb * 0.8, 0.01, s * 0.32),
    decal:new THREE.PlaneGeometry(s * 0.62, s * 0.62), canopy:new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
    ground:new THREE.PlaneGeometry(1, 1),
    mBody:new THREE.MeshStandardMaterial({ color:0x4a5530, roughness:0.62, metalness:0.08 }), mRib:new THREE.MeshStandardMaterial({ color:0xe0b040, roughness:0.26, metalness:0.85, emissive:0x6a4a10, emissiveIntensity:0.6 }),
    mStar:new THREE.MeshStandardMaterial({ map:star, transparent:true, roughness:0.5, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 }),
    tGores:gores, tShaft:shaft, tGlow:radial([[0, 'rgba(255,230,150,1)'], [0.25, 'rgba(255,200,90,0.55)'], [1, 'rgba(255,170,60,0)']]),
    tSpark:radial([[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,220,120,0.8)'], [1, 'rgba(255,190,80,0)']]) };
  return K; }
const add = (p, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
const glowMat = (map, op) => new THREE.SpriteMaterial({ map, color:0xffffff, transparent:true, opacity:op, depthWrite:false, blending:THREE.AdditiveBlending });
// the crate itself: body, ribbon, lid (its own group: it flies off), bow, stars
function crate(){ const k = kit(), s = GIFT.size, h = GIFT.h, box = new THREE.Group(), lid = new THREE.Group();
  add(box, k.body, k.mBody); add(box, k.bandA, k.mRib);
  for(const sd of [1, -1]){ const d = add(box, k.decal, k.mStar, sd * (s / 2 + 0.004), 0, 0); d.rotation.y = sd * Math.PI / 2; d.castShadow = false; }
  lid.position.y = h / 2 + h * 0.1; add(lid, k.lid, k.mBody); add(lid, k.bandB, k.mRib); add(lid, k.bandC, k.mRib);
  const top = h * 0.12 + 0.006; for(const sd of [1, -1]){ const l = add(lid, k.loop, k.mRib, sd * s * 0.13, top + s * 0.12, 0); l.rotation.set(0, sd * 0.25, sd * 0.5); l.scale.set(1, 0.8, 1);
    const t = add(lid, k.tail, k.mRib, sd * s * 0.07, top, sd * s * 0.12); t.rotation.y = sd * 0.5; }
  add(lid, k.knot, k.mRib, 0, top + s * 0.06, 0); box.add(lid); return { box, lid }; }
// the parachute over it: a striped canopy and its rigging lines down to the lid
function chute(){ const k = kit(), g = new THREE.Group(), R = GIFT.drop.canopy, mat = new THREE.MeshStandardMaterial({ map:k.tGores, side:THREE.DoubleSide, roughness:0.85, transparent:true });
  const c = add(g, k.canopy, mat, 0, GIFT.drop.lines, 0); c.scale.set(R, R * 0.55, R); const pts = [];
  for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4, rx = Math.cos(a) * R * 0.97, rz = Math.sin(a) * R * 0.97; pts.push(rx, GIFT.drop.lines + R * 0.08, rz, 0, GIFT.h * 0.62, 0); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color:0x2a2620, transparent:true })); g.add(lines); return { g, canopy:c, lines }; }

// the HQ drops one over `at` ({x, z}); onOpen() when he walks into it
export function spawnGift(at, onOpen){ const k = kit(), D = GIFT.drop, gy = heightAt(at.x, at.z), root = new THREE.Group(), { box, lid } = crate(), ch = chute();
  root.position.set(at.x, gy + D.h, at.z); root.add(box); root.add(ch.g); scene.add(root);
  const glow = new THREE.Sprite(glowMat(k.tGlow, 0.0)); glow.scale.setScalar(GIFT.glow); root.add(glow);
  const flash = new THREE.Sprite(glowMat(k.tGlow, 0)); flash.scale.setScalar(0.1); root.add(flash);
  const pillar = new THREE.Sprite(glowMat(k.tShaft, 0)); pillar.center.set(0.5, 0); pillar.scale.set(GIFT.shaftW, GIFT.shaft, 1); scene.add(pillar);   // (a soft shaft that faces the camera: no tube edges)
  const pool = new THREE.Mesh(k.ground, new THREE.MeshBasicMaterial({ map:k.tGlow, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.scale.setScalar(GIFT.pool); scene.add(pool);
  const N = GIFT.sparks, sg = new THREE.BufferGeometry(), seeds = []; sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  for(let i = 0; i < N; i++) seeds.push({ a:Math.random() * 6.283, r:0.35 + Math.random() * 0.45, t:Math.random(), v:0.25 + Math.random() * 0.35 });
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ map:k.tSpark, size:0.13, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending })); sparks.frustumCulled = false; scene.add(sparks);
  const u = { x:at.x, z:at.z, gy, root, box, lid, ch, glow, flash, pillar, pool, sparks, seeds, st:'fall', t:0, onOpen, lv:null };
  GIFTS.push(u); return u; }

function disposeGift(u){ scene.remove(u.root); scene.remove(u.pillar); scene.remove(u.pool); scene.remove(u.sparks);
  for(const m of [u.glow.material, u.flash.material, u.pillar.material, u.pool.material, u.sparks.material, u.ch.canopy.material, u.ch.lines.material]) m.dispose(); u.sparks.geometry.dispose(); u.ch.lines.geometry.dispose(); }
export function clearGifts(){ for(const u of GIFTS) disposeGift(u); GIFTS.length = 0; }

const ease = t => t * t * (3 - 2 * t);
// once a frame (game/loop.js): coming down, landing, floating, opening
export function updateGifts(dt, now){ if(!GIFTS.length) return; const G = GIFT, D = G.drop, p = S.player;
  for(let i = GIFTS.length - 1; i >= 0; i--){ const u = GIFTS[i]; u.t += dt; const r = u.root, base = u.gy + G.hover;
    if(u.st === 'fall'){ r.position.y -= D.v * dt; const sw = Math.sin(u.t * D.swayF) * D.sway; r.rotation.z = sw; r.rotation.x = Math.cos(u.t * D.swayF * 0.8) * D.sway * 0.6; r.rotation.y += dt * 0.25;
      u.glow.material.opacity = 0.35 + 0.15 * Math.sin(u.t * 6);
      if(r.position.y <= base){ r.position.y = base; u.st = 'land'; u.t = 0; sfx('thud'); burst({ x:u.x, z:u.z }, 0xd9c7a0, 6, 3, { y:u.gy + 0.25, life:0.9, size:1.1, smoke:true, grav:-0.3, drag:2, up:1, op:0.45 }); } }
    else if(u.st === 'land'){ const k = Math.min(1, u.t / G.chute), c = u.ch;
      r.rotation.z *= 1 - Math.min(1, dt * 4); r.rotation.x *= 1 - Math.min(1, dt * 4);
      c.canopy.scale.y = G.drop.canopy * 0.55 * (1 - 0.85 * ease(k)); c.g.position.set(1.4 * ease(k), -D.lines * 0.9 * ease(k), 0.5 * ease(k)); c.g.rotation.z = -1.1 * ease(k);
      c.canopy.material.opacity = 1 - ease(Math.max(0, (k - 0.45) / 0.55)); c.lines.material.opacity = c.canopy.material.opacity; if(k >= 1){ c.g.visible = false; u.st = 'hover'; u.t = 0; } }
    if(u.st === 'land' || u.st === 'hover'){ const on = u.st === 'hover' ? Math.min(1, u.t / 0.8) : 0;
      r.position.y = base + Math.sin(now * G.bobF) * G.bob * on; u.box.rotation.y += dt * G.spin * on; u.box.rotation.z = Math.sin(now * 1.3) * 0.05 * on; u.box.rotation.x = Math.cos(now * 1.1) * 0.04 * on;
      const pulse = 0.5 + 0.5 * Math.sin(now * 3.1); u.glow.material.opacity = 0.32 + 0.18 * pulse; u.box.children[1].material.emissiveIntensity = 0.45 + 0.4 * pulse;
      u.pillar.material.opacity = (0.22 + 0.08 * pulse) * on; u.pool.material.opacity = (0.5 + 0.15 * pulse) * on; u.sparks.material.opacity = on;
      const P = u.sparks.geometry.attributes.position; for(let j = 0; j < u.seeds.length; j++){ const s = u.seeds[j]; s.t = (s.t + dt * s.v) % 1; const a = s.a + s.t * 4.5, rr = s.r * (1 - s.t * 0.5);
        P.setXYZ(j, u.x + Math.cos(a) * rr, base - 0.35 + s.t * G.sparkH, u.z + Math.sin(a) * rr); } P.needsUpdate = true;
      u.pillar.position.set(u.x, u.gy + 0.05, u.z); u.pool.position.set(u.x, u.gy + 0.04, u.z);
      if(p && u.st === 'hover' && (p.pos.x - u.x) ** 2 + (p.pos.z - u.z) ** 2 < G.reach * G.reach) openGift(u); }
    else if(u.st === 'open'){ const k = Math.min(1, u.t / G.open), L = u.lv;
      u.lid.position.x += L.x * dt; u.lid.position.y += L.y * dt; u.lid.position.z += L.z * dt; L.y -= 14 * dt; u.lid.rotation.x += dt * 9; u.lid.rotation.z += dt * 6;
      u.flash.material.opacity = Math.max(0, 1 - k * 2.5); u.flash.scale.setScalar(0.5 + 4.5 * ease(Math.min(1, k * 2.2)));
      u.box.scale.setScalar(Math.max(0.001, 1 - ease(Math.max(0, (k - 0.35) / 0.65)))); u.glow.material.opacity *= 1 - Math.min(1, dt * 4);
      for(const m of [u.pillar.material, u.pool.material, u.sparks.material]) m.opacity *= 1 - Math.min(1, dt * 5);
      if(k >= 1){ disposeGift(u); GIFTS.splice(i, 1); } } } }
function openGift(u){ u.st = 'open'; u.t = 0; u.lv = { x:(Math.random() - 0.5) * 2, y:6.5, z:(Math.random() - 0.5) * 2 }; const at = { x:u.x, z:u.z }, y = u.root.position.y;
  sfx('powerup'); ringPulse(at, 0xffd86a, 3.5);
  burst(at, 0xffd86a, 26, 7, { y:y + 0.3, life:0.9, size:0.42, grav:-6, drag:1.6, up:6 }); burst(at, 0xfff2c0, 12, 4, { y:y + 0.2, life:0.6, size:0.3, grav:-2, drag:2, up:3 });
  if(u.onOpen) u.onOpen(); }
