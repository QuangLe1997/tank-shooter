// loot/gift-crate.js — Z369 / Z370 THE RANK'S SUPPLY BUNDLE (soldier mode): what the HQ drops when he climbs a rank — a real airdrop, not a toy:
//   · a small wooden crate in olive paint (planks, a stencilled TIẾP TẾ and star), two dark webbing straps round it with buckles, rope handles at the ends
//   · it comes down under an olive cargo parachute from GIFTBOX.drop.h m, swaying; it lands on the ground (no floating) with a puff of dust; the canopy
//     sags, slides off and lies beside it, then fades
//   · a smoke marker by it puts up green smoke (as an airdrop is marked), and a faint ring on the ground says where — nothing glows, nothing spins
//   · he walks to it (GIFTBOX.reach m): the straps give, the lid swings open on its back edge with a little dust, and the reward is his (onOpen); the
//     crate stays a moment, then sinks away. Cleared with the battle.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GIFTBOX as GIFT } from '../../config.js';
import { S, burst, heightAt, ringPulse, scene, sfx } from '../hub.js';

export const GIFTS = [];
let K = null;
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
// painted planks: olive, the grain and the seams, worn at the edges; `label` stencilled on the long sides
function planks(label){ return canvasTex(256, 192, (g, w, h) => { g.fillStyle = '#4d5634'; g.fillRect(0, 0, w, h);
  for(let i = 0; i < 2600; i++){ const x = Math.random() * w, y = Math.random() * h, l = 6 + Math.random() * 30; g.strokeStyle = `rgba(${Math.random() < 0.5 ? '30,34,20' : '98,106,72'},${0.06 + Math.random() * 0.1})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (Math.random() - 0.5) * 1.5); g.stroke(); }
  g.fillStyle = 'rgba(20,22,14,0.75)'; for(let y = h / 4; y < h; y += h / 4) g.fillRect(0, y - 1, w, 2);
  const e = g.createLinearGradient(0, 0, 0, h); e.addColorStop(0, 'rgba(160,150,110,0.22)'); e.addColorStop(0.08, 'rgba(0,0,0,0)'); e.addColorStop(0.92, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(160,150,110,0.22)'); g.fillStyle = e; g.fillRect(0, 0, w, h);
  if(label){ g.fillStyle = 'rgba(214,196,120,0.85)'; g.font = 'bold 34px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.fillText(label, w / 2, h * 0.58);
    g.beginPath(); const cx = w / 2, cy = h * 0.3, R = 15; for(let i = 0; i < 10; i++){ const r = i % 2 ? R * 0.42 : R, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.fill(); } }); }
// the shared shapes and pictures, made once
function kit(){ if(K) return K; const w = GIFT.size[0], h = GIFT.size[1], d = GIFT.size[2], st = 0.05;
  const gores = canvasTex(256, 32, (g, W, H) => { for(let i = 0; i < 8; i++){ g.fillStyle = i % 2 ? '#5d6340' : '#6f7550'; g.fillRect(i * W / 8, 0, W / 8, H); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(i * W / 8, 0, 1.5, H); } });
  const side = planks('TIẾP TẾ'), plain = planks('');
  K = { body:new RoundedBoxGeometry(w, h * 0.8, d, 2, 0.012), lid:new RoundedBoxGeometry(w + 0.02, h * 0.2, d + 0.02, 2, 0.012),
    strapA:new THREE.BoxGeometry(st, h + 0.012, d + 0.014), strapT:new THREE.BoxGeometry(w + 0.03, 0.012, st), buckle:new THREE.BoxGeometry(st * 1.3, 0.05, 0.012),
    handle:new THREE.TorusGeometry(0.045, 0.012, 6, 14, Math.PI), can:new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10),
    canopy:new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), ring:new THREE.RingGeometry(0.9, 1, 48),
    mSide:new THREE.MeshStandardMaterial({ map:side, roughness:0.86, metalness:0.02 }), mPlain:new THREE.MeshStandardMaterial({ map:plain, roughness:0.86, metalness:0.02 }),
    mStrap:new THREE.MeshStandardMaterial({ color:0x26271f, roughness:0.95 }), mMetal:new THREE.MeshStandardMaterial({ color:0x8a8a80, roughness:0.4, metalness:0.8 }),
    mRope:new THREE.MeshStandardMaterial({ color:0x9c8a62, roughness:0.95 }), mCan:new THREE.MeshStandardMaterial({ color:0x3c4a2c, roughness:0.6, metalness:0.3 }), tGores:gores };
  return K; }
const add = (p, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
// the crate: its base standing on y = 0, the lid on a hinge along its back edge (so it can swing open)
function crate(){ const k = kit(), [w, h, d] = GIFT.size, box = new THREE.Group(), hinge = new THREE.Group(), straps = new THREE.Group(), bh = h * 0.8;
  const mats = [k.mPlain, k.mPlain, k.mPlain, k.mPlain, k.mSide, k.mSide]; add(box, k.body, mats, 0, bh / 2, 0);
  hinge.position.set(0, bh, -d / 2); box.add(hinge); add(hinge, k.lid, k.mPlain, 0, h * 0.1, d / 2);
  for(const x of [-w * 0.28, w * 0.28]){ add(straps, k.strapA, k.mStrap, x, h / 2, 0); add(straps, k.buckle, k.mMetal, x, h * 0.55, d / 2 + 0.012); }
  add(straps, k.strapT, k.mStrap, 0, h + 0.006, 0); box.add(straps);
  for(const sd of [1, -1]){ const r = add(box, k.handle, k.mRope, sd * (w / 2 + 0.01), bh * 0.6, 0); r.rotation.set(Math.PI, sd * Math.PI / 2, 0); }
  return { box, hinge, straps }; }
// the cargo parachute: an olive canopy and its rigging down to the crate's top
function chute(){ const k = kit(), g = new THREE.Group(), R = GIFT.drop.canopy, L = GIFT.drop.lines, mat = new THREE.MeshStandardMaterial({ map:k.tGores, side:THREE.DoubleSide, roughness:0.9, transparent:true });
  const c = add(g, k.canopy, mat, 0, L, 0); c.scale.set(R, R * 0.5, R); const pts = [], top = GIFT.size[1];
  for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4; pts.push(Math.cos(a) * R * 0.97, L + R * 0.06, Math.sin(a) * R * 0.97, 0, top, 0); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color:0x2a2820, transparent:true })); g.add(lines); return { g, canopy:c, lines }; }

// the HQ drops one over `at` ({x, z}); onOpen() when he reaches it
export function spawnGift(at, onOpen){ const k = kit(), D = GIFT.drop, gy = heightAt(at.x, at.z), root = new THREE.Group(), { box, hinge, straps } = crate(), ch = chute();
  root.position.set(at.x, gy + D.h, at.z); root.rotation.y = Math.random() * 6.283; root.add(box); root.add(ch.g); scene.add(root);
  const ring = new THREE.Mesh(k.ring, new THREE.MeshBasicMaterial({ color:0xd8d0a0, transparent:true, opacity:0, depthWrite:false })); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(GIFT.ring); ring.position.set(at.x, gy + 0.03, at.z); scene.add(ring);
  const can = add(scene, k.can, k.mCan, at.x + GIFT.smoke.off, gy + 0.04, at.z + GIFT.smoke.off * 0.4); can.rotation.z = 1.4; can.visible = false;
  const u = { x:at.x, z:at.z, gy, root, box, hinge, straps, ch, ring, can, st:'fall', t:0, puff:0, onOpen }; GIFTS.push(u); return u; }

function disposeGift(u){ scene.remove(u.root); scene.remove(u.ring); scene.remove(u.can); u.ring.material.dispose(); u.ch.canopy.material.dispose(); u.ch.lines.material.dispose(); u.ch.lines.geometry.dispose(); }
export function clearGifts(){ for(const u of GIFTS) disposeGift(u); GIFTS.length = 0; }

const ease = t => t * t * (3 - 2 * t);
// once a frame (game/loop.js): coming down, landing, waiting with its smoke, opening
export function updateGifts(dt, now){ if(!GIFTS.length) return; const G = GIFT, D = G.drop, p = S.player;
  for(let i = GIFTS.length - 1; i >= 0; i--){ const u = GIFTS[i], r = u.root; u.t += dt;
    if(u.st === 'fall'){ r.position.y -= D.v * dt; r.rotation.z = Math.sin(u.t * D.swayF) * D.sway; r.rotation.x = Math.cos(u.t * D.swayF * 0.8) * D.sway * 0.6;
      if(r.position.y <= u.gy){ r.position.y = u.gy; r.rotation.x = r.rotation.z = 0; u.st = 'wait'; u.t = 0; u.can.visible = true; sfx('thud');
        burst({ x:u.x, z:u.z }, 0xcbb994, 7, 3, { y:u.gy + 0.15, life:1.0, size:1.0, smoke:true, grav:-0.2, drag:2, up:0.8, op:0.5 }); }
      continue; }
    const c = u.ch, k = Math.min(1, (u.st === 'wait' ? u.t : 99) / G.chute);
    if(c.g.visible){ c.canopy.scale.y = D.canopy * 0.5 * (1 - 0.9 * ease(k)); c.g.position.set(1.3 * ease(k), -D.lines * 0.95 * ease(k), 0.4 * ease(k)); c.g.rotation.z = -1.25 * ease(k);
      const fade = u.st === 'wait' ? Math.max(0, 1 - Math.max(0, u.t - G.chuteStay) / 1.5) : c.canopy.material.opacity * (1 - Math.min(1, dt * 3)); c.canopy.material.opacity = fade; c.lines.material.opacity = fade; if(fade <= 0.01) c.g.visible = false; }
    if(u.st === 'wait'){ u.ring.material.opacity = 0.26 + 0.08 * Math.sin(now * 2);
      if((u.puff -= dt) <= 0){ u.puff = G.smoke.every; burst({ x:u.can.position.x, z:u.can.position.z }, G.smoke.col, 2, 0.6, { y:u.gy + 0.25, life:G.smoke.life, size:G.smoke.size, smoke:true, grav:-1.1, drag:0.8, up:1.6, op:0.55 }); }
      if(p && (p.pos.x - u.x) ** 2 + (p.pos.z - u.z) ** 2 < G.reach * G.reach) openGift(u); continue; }
    u.ring.material.opacity *= 1 - Math.min(1, dt * 4); const o = Math.min(1, u.t / 0.35); u.hinge.rotation.x = -1.9 * ease(o); u.straps.visible = u.t < 0.08;
    if(u.t > G.open){ const s = Math.min(1, (u.t - G.open) / 0.8); r.position.y = u.gy - s * GIFT.size[1] * 1.1; u.can.position.y = u.gy + 0.04 - s * 0.2; if(s >= 1){ disposeGift(u); GIFTS.splice(i, 1); } } } }
function openGift(u){ u.st = 'open'; u.t = 0; const at = { x:u.x, z:u.z }; sfx('click'); sfx('powerup'); ringPulse(at, 0xd8d0a0, 2.2);
  burst(at, 0xcbb994, 6, 1.5, { y:u.gy + GIFT.size[1], life:0.7, size:0.6, smoke:true, grav:-0.4, drag:2, up:1.2, op:0.45 });
  if(u.onOpen) u.onOpen(); }
