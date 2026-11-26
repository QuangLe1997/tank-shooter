// campaign/big-events.js — EVENT 2 BIG BATTLEFIELD EVENTS (config.js BIGEVENT): now and then the battle itself does something big — drawn out of the surprises' hat with
//   the others (campaign/surprises.js surpriseAdd), only where the director allows a surprise and he is not hurt, one at a time, never while a side mission runs,
//   and always announced before it can hurt: a banner, the radio, a siren or an engine, the danger drawn on the ground and on the minimap.
//   · CARPET BOMBING: three bombers cross the field along a line shown on the ground; a walking line of blasts that takes no side.
//   · AIRCRAFT DOWN: a burning transport comes in low, hits, skids on in fire, and its wreck — cover from then on — cooks off for a while.
//   · BRUSH FIRE: on a dry field a stray shell sets the scrub alight; the fire creeps downwind from tuft to tuft, burns whoever stands in it, hides what is behind
//     its smoke (game/stealth.js VEILS) and dies at bare ground, trails and water.
//   · RADIO BLACKOUT: the enemy jams the net — no radio, static on the minimap and the squad's cards — and the director holds the flank's cue until it is back.
//   Everything is made once and reused (the strip, the bombs, the flames, the aircraft); a frame makes no object. clearBigEvents: a stage won, a restart, the menu.
import * as THREE from 'three';
import { BIGEVENT, STORY } from '../../config.js';
import { AIR_SCALE, BIOME, DIR, FT, MOBILE, S, SIDEM, UNDER, VEILS, WX, aoeDamage, bigExplode, blastAllies, blocks, buildHind, buildTransport, core, crushAt, crushables, damageAlly, damageEnemy, damagePlayer, decalScorch, deformCrater, dirEventOk, dirSay, duelOn, enemies, fireball, flameFX, floatText, heightAt, holoRing, inCamView, inField, infBlastK, onTrail, radio, ringPulse, scene, sfx, showBanner, spawnPart, storyCue, surpriseAdd } from '../hub.js';

const C = BIGEVENT, R2 = a => a[0] + Math.random() * (a[1] - a[0]), _pt = { x:0, y:0, z:0 };
const OFF = typeof location !== 'undefined' && /noevents/.test(location.search + location.hash);
// the particles' options, kept (fx/particles.js spawnPart reads them and keeps nothing)
const O_SMOKE = { color:0x15120f, size:2.2, life:2.2, smoke:true, grav:0.5, drag:0.9, grow:1.9, op:0.6 }, O_FIRE = { tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:1.3, life:0.45, grav:1, drag:2 },
  O_SPARK = { color:0xffc060, size:0.22, life:0.6, grav:-12, drag:1 }, O_HAZE = { color:0x8a8478, size:1.6, life:1.9, smoke:true, grav:0.5, drag:1, grow:1.4, op:0.35 }, O_EMBER = { color:0xff8a2a, size:0.16, life:1.4, grav:1.2, drag:0.6 };
// what is on (dev/probes read it): cur the event running (its kind, its clock t) · clock: s of battle this stage · freeAt: no event before this · count this stage ·
//   jam: the net is jammed · nCells / nHot: fire cells alight / burning · wrecks: the aircraft that stay as cover · stats: what happened
export const BIGEV = { on:false, cur:null, clock:0, freeAt:0, count:0, jam:false, nCells:0, nHot:0, lineOn:false, lx0:0, lz0:0, lx1:0, lz1:0, wrecks:[],
  stats:{ bombing:0, crash:0, fire:0, jam:0, blasts:0, cooks:0, cells:0, hits:0, kills:0 }, log:[] };
function note(k){ const L = BIGEV.log; if(L.length >= 30) L.shift(); L.push({ k, t:+BIGEV.clock.toFixed(1), stage:S.stage, wave:S.wave }); }
function say(key, must){ if(storyCue(key, null, must)) return; const L = STORY.lines[key]; if(L) radio(STORY.cast.cmd.tag + ': ' + L.t[0]); }
function tell(banner, key){ showBanner(banner, '#ff5a3a'); sfx('alarm'); say(key, true); }
// a blast that takes no side: the enemy's men and the cover round them (combat/spells.js aoeDamage), our men (blastAllies), and him — never the base's core
function blast(x, z, R, dmg, now){ const p = S.player, n0 = enemies.length; aoeDamage(x, z, R, dmg, false, now, 'HE', false); blastAllies(x, z, R, dmg); BIGEV.stats.kills += n0 - enemies.length;
  if(now >= (p.invincibleUntil || 0)){ const k = infBlastK(Math.hypot(p.pos.x - x, p.pos.z - z), R); if(k > 0){ BIGEV.stats.hits++; damagePlayer(dmg * C.playerK * k, now, p.pos.x - x, p.pos.z - z, 'blast'); } } }
function shake(x, z, k, far){ const d = Math.hypot(S.player.pos.x - x, S.player.pos.z - z); if(d < far) S.shake = Math.min(4, S.shake + k * (1 - d / far)); }
// an explosion's look and sound (fx/explosions.js bigExplode: scorch, crater, fireball, dust, the report) — its shake by how far from him it is, not flat
function boom(q, col, sc, k, far){ const s0 = S.shake; bigExplode(q, col, sc); S.shake = s0; shake(q.x, q.z, k, far); }
// the distance from a point to the segment a → b
function segDist(px, pz, ax, az, bx, bz){ const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; let u = ((px - ax) * dx + (pz - az) * dz) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u; return Math.hypot(px - ax - dx * u, pz - az - dz * u); }

// ---- the danger drawn on the ground: one red strip that follows the terrain (made once), and one ring for a wreck that cooks off ----
const SN = 28; let _strip = null, _ring = null;
function strip(x0, z0, x1, z1, w){ if(!_strip){ const g = new THREE.BufferGeometry(), ix = []; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SN + 1) * 9), 3));
    for(let i = 0; i < SN; i++){ const a = i * 3; ix.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); } g.setIndex(ix);
    _strip = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0xff3a2a, transparent:true, opacity:0.2, depthWrite:false, side:THREE.DoubleSide, fog:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
    _strip.frustumCulled = false; _strip.renderOrder = 4; scene.add(_strip); }
  const P = _strip.geometry.attributes.position, dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, px = dz / L * w / 2, pz = -dx / L * w / 2;
  for(let i = 0; i <= SN; i++){ const u = i / SN, cx = x0 + dx * u, cz = z0 + dz * u; for(let k = -1; k <= 1; k++){ const x = cx + px * k, z = cz + pz * k; P.setXYZ(i * 3 + k + 1, x, heightAt(x, z) + 0.22, z); } }
  P.needsUpdate = true; _strip.visible = true; BIGEV.lineOn = true; BIGEV.lx0 = x0; BIGEV.lz0 = z0; BIGEV.lx1 = x1; BIGEV.lz1 = z1; }
function stripBlink(t){ _strip.material.opacity = 0.13 + 0.11 * (0.5 + 0.5 * Math.sin(t * 9)); }
function stripOff(){ if(_strip) _strip.visible = false; BIGEV.lineOn = false; }
function ringAt(x, z){ if(!_ring){ _ring = holoRing(C.crash.cookR + 3, { kind:'danger' }); scene.add(_ring); } _ring.position.set(x, heightAt(x, z) + 0.2, z); _ring.visible = true; }
function ringOff(){ if(_ring) _ring.visible = false; }

// ---- CARPET BOMBING ----
const HIND = [], SHAD = [], BOMB = [], _bs = new Float32Array(96); let _bgeo = null, _bmat = null, _sgeo = null, _smat = null;
// the bombers (actors/helis.js buildHind puts each in the scene), their shadows on the ground and the bombs: made the first time, kept
function fleet(K){ while(HIND.length < K.planes){ const g = buildHind(); g.scale.setScalar(AIR_SCALE); g.visible = false; HIND.push(g); }
  if(!_sgeo){ _sgeo = new THREE.CircleGeometry(1, 18); _smat = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.3, depthWrite:false, fog:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
    _bgeo = new THREE.CapsuleGeometry(0.24, 0.9, 3, 8); _bgeo.rotateX(Math.PI / 2); _bmat = new THREE.MeshStandardMaterial({ color:0x3a4030, roughness:0.6, metalness:0.4 }); }
  while(SHAD.length < K.planes){ const m = new THREE.Mesh(_sgeo, _smat); m.rotation.x = -Math.PI / 2; m.scale.set(6, 10, 1); m.visible = false; m.renderOrder = 3; scene.add(m); SHAD.push(m); }
  while(BOMB.length < Math.min(32, K.n)){ const m = new THREE.Mesh(_bgeo, _bmat); m.visible = false; scene.add(m); BOMB.push(m); } }
// where bomb i falls (into _pt): along the line, across the lane by the bomber that carries it
function bombAt(B, i){ const K = C.bombing, s = K.len * i / (K.n - 1), lat = K.planes > 1 ? ((i % K.planes) - (K.planes - 1) / 2) * K.lane / (K.planes - 1) : 0; _pt.x = B.x0 + B.ux * s + B.uz * lat; _pt.z = B.z0 + B.uz * s - B.ux * lat; _pt.y = heightAt(_pt.x, _pt.z); return _pt; }
function startBombing(now){ const K = C.bombing, p = S.player, f = p.facing || 0; let cx = p.pos.x + Math.sin(f) * K.ahead, cz = p.pos.z + Math.cos(f) * K.ahead, bn = 0, a = -1;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(e.def.air) continue; const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if(d < K.knotR[0] || d > K.knotR[1]) continue; let n = 0;   // the thickest knot of enemies: the line goes through it
    for(let j = 0; j < enemies.length; j++){ const o = enemies[j]; if(!o.def.air && (o.pos.x - e.pos.x) ** 2 + (o.pos.z - e.pos.z) ** 2 < 144) n++; } if(n > bn){ bn = n; cx = e.pos.x; cz = e.pos.z; } }
  for(let k = 0; k < 14 && a < 0; k++){ const t = Math.random() * Math.PI, h = K.len / 2 + K.R, sx = Math.sin(t) * h, sz = Math.cos(t) * h; if(core && segDist(core.pos.x, core.pos.z, cx - sx, cz - sz, cx + sx, cz + sz) <= C.coreR) continue;
    if(k < 10 && segDist(p.pos.x, p.pos.z, cx - sx, cz - sz, cx + sx, cz + sz) < K.clear) continue; a = t; }   // EVENT 3 never over the base's core; and not over where he stands now, when another line will do
  if(a < 0) return null; let ux = Math.sin(a), uz = Math.cos(a); const v = K.len / ((K.n - 1) * K.gap), back = K.warn * v + K.len / 2;
  if(inCamView(cx - ux * back, cz - uz * back) && !inCamView(cx + ux * back, cz + uz * back)){ ux = -ux; uz = -uz; }   // they come in from where he is not looking, when they can
  fleet(K); const B = { kind:'bombing', t:0, x0:cx - ux * K.len / 2, z0:cz - uz * K.len / 2, ux, uz, v, gy:heightAt(cx, cz), i:0, rel:0, mk:0, mkT:0, siren:1.5, drone:false, fly:true };
  strip(B.x0 - ux * K.R, B.z0 - uz * K.R, B.x0 + ux * (K.len + K.R), B.z0 + uz * (K.len + K.R), K.lane + K.R * 2); tell('⚠ BOM RẢI THẢM — RỜI KHỎI VỆT ĐỎ!', 'ev_bomb'); sfx('flybyHeavy');
  _pt.x = cx; _pt.z = cz; _pt.y = B.gy + 3; floatText('VỆT BOM', '#ff5a3a', _pt, 18); bombingFrame(B, 0, now); return B; }
function bombingFrame(B, dt, now){ const K = C.bombing, P = K.planes, t = B.t, d0 = (t - K.warn) * B.v, yaw = Math.atan2(B.ux, B.uz), n = Math.min(K.n, 32);
  for(let k = 0; k < P; k++){ const g = HIND[k], off = k - (P - 1) / 2, d = d0 - Math.abs(off) * 9, lat = off * K.wing, x = B.x0 + B.ux * d + B.uz * lat, z = B.z0 + B.uz * d - B.ux * lat, ud = g.userData;   // the bombers, in a vee, and their shadows
    g.visible = B.fly; g.position.set(x, B.gy + K.alt + Math.sin(t * 1.3 + k) * 0.4, z); g.rotation.set(0, yaw, 0); ud.body.rotation.set(0.1, 0, Math.sin(t * 0.9 + k) * 0.04); ud.rotor.rotation.y += dt * 38; ud.trot.rotation.x += dt * 50;
    SHAD[k].visible = B.fly; SHAD[k].position.set(x, heightAt(x, z) + 0.15, z); SHAD[k].rotation.z = yaw; }
  if(B.siren > 0 && (B.siren -= dt) <= 0) sfx('alarm'); if(!B.drone && t >= K.warn - 2){ B.drone = true; sfx('flybyHeavy'); sfx('jet'); }
  if(B.i < n){ stripBlink(t); if((B.mkT -= dt) <= 0){ B.mkT = 0.16; ringPulse(bombAt(B, B.i + (B.mk++ % (n - B.i))), 0xff3a2a, K.R * 0.7); } } else stripOff();   // the line blinks, a ring runs along where the bombs will fall
  while(B.rel < n && t >= K.warn + B.rel * K.gap - K.fall){ const j = B.rel++, g = HIND[j % P]; _bs[j * 3] = g.position.x; _bs[j * 3 + 1] = g.position.y - 1.2; _bs[j * 3 + 2] = g.position.z; BOMB[j].visible = true; if(j % 3 === 0) sfx('whistle', bombAt(B, j)); }
  for(let j = B.i; j < B.rel; j++){ const u = Math.min(1, (t - (K.warn + j * K.gap - K.fall)) / K.fall), q = bombAt(B, j), m = BOMB[j], x = _bs[j * 3] + (q.x - _bs[j * 3]) * u, z = _bs[j * 3 + 2] + (q.z - _bs[j * 3 + 2]) * u, y = _bs[j * 3 + 1] + (q.y - _bs[j * 3 + 1]) * u * u;   // each bomb: thrown forward, falling faster
    m.position.set(x, y, z); m.rotation.set(0.5 + u * 0.9, yaw, 0, 'YXZ'); }
  while(B.i < B.rel && t >= K.warn + B.i * K.gap){ const j = B.i++, q = bombAt(B, j), x = q.x, z = q.z; BOMB[j].visible = false; blast(x, z, K.R, K.dmg, now); q.x = x; q.z = z; boom(q, 0xff7a3d, K.R / 3, 1.3, 75);
    if(j % 2 === 0) deformCrater(x, z, 2.2, 0.5); BIGEV.stats.blasts++; }
  if(d0 < K.len + K.off) return false; B.fly = false; for(let k = 0; k < P; k++) HIND[k].visible = SHAD[k].visible = false; stripOff(); return true; }

// ---- AIRCRAFT DOWN ----
const AIR = [];   // the transports (actors/paradrop.js buildTransport): one flies in and stays as a wreck until the stage ends
function airGet(){ let a = null; for(let i = 0; i < AIR.length && !a; i++) if(!AIR[i].busy) a = AIR[i]; if(!a){ a = { g:buildTransport(), busy:false }; AIR.push(a); } a.busy = true; if(a.g.parent !== scene) scene.add(a.g); a.g.visible = true; return a; }
function startCrash(now){ const K = C.crash, p = S.player; let ix = 0, iz = 0, ux = 0, uz = 0, ok = false;
  for(let k = 0; k < 30 && !ok; k++){ const a = Math.random() * 6.283, b = Math.random() * 6.283, d = K.minD + Math.random() * (K.maxD - K.minD); ix = p.pos.x + Math.sin(a) * d; iz = p.pos.z + Math.cos(a) * d; ux = Math.sin(b); uz = Math.cos(b);
    const ex = ix + ux * K.skid, ez = iz + uz * K.skid; if(!inField(ix, iz, 6) || !inField(ex, ez, 5) || !inField((ix + ex) / 2, (iz + ez) / 2, 3)) continue;
    if(segDist(p.pos.x, p.pos.z, ix, iz, ex, ez) < K.clear || core && segDist(core.pos.x, core.pos.z, ix, iz, ex, ez) < C.coreR) continue; ok = true;
    for(let i = 0; i < blocks.length && ok; i++){ const q = blocks[i]; if((q.r || 0) >= 2 && segDist(q.x, q.z, ix, iz, ex, ez) < q.r + 2.5) ok = false; } }   // (not through a house, a wall or a rock: it needs open ground to skid on)
  if(!ok) return null; const A = airGet(), E = { kind:'crash', t:0, ph:0, ix, iz, ux, uz, A, yaw:Math.atan2(ux, uz), next:0, wx:0, wz:0, cooks:0, cookAt:0, cookGap:0, mkT:0, pe:0, jet:false };
  strip(ix - ux * K.R, iz - uz * K.R, ix + ux * (K.skid + 3), iz + uz * (K.skid + 3), K.R * 2); tell('⚠ MÁY BAY RƠI — TRÁNH XA VỆT ĐỎ!', 'ev_crash'); sfx('flybyHeavy'); crashFrame(E, 0, now); return E; }
function crashFrame(E, dt, now){ const K = C.crash, g = E.A.g, rt = g.userData.rotors; E.pe += dt;
  if(E.ph === 0){ const u = Math.min(1, E.t / K.warn), back = K.speed * (K.warn - E.t), x = E.ix - E.ux * back, z = E.iz - E.uz * back, y = heightAt(E.ix, E.iz) + 1.6 + K.alt * (1 - u);   // in: low, burning, straight at the mark
    g.position.set(x, y, z); g.rotation.set(0.22, E.yaw, Math.sin(E.t * 3) * 0.18, 'YXZ'); if(rt) for(let i = 0; i < rt.length; i++) rt[i].rotation.y += dt * 14;
    if(E.pe > 0.03){ E.pe = 0; spawnPart(x, y + 0.8, z, 0, 1.4, 0, O_SMOKE); spawnPart(x, y, z, (Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2, O_FIRE); }
    stripBlink(E.t); if((E.mkT -= dt) <= 0){ E.mkT = 0.3; _pt.x = E.ix; _pt.z = E.iz; ringPulse(_pt, 0xff3a2a, K.R); } if(!E.jet && E.t >= K.warn - 1.6){ E.jet = true; sfx('jet'); }
    if(E.t < K.warn) return false; E.ph = 1; _pt.x = E.ix; _pt.z = E.iz; blast(E.ix, E.iz, K.R, K.dmg, now); _pt.x = E.ix; _pt.z = E.iz; boom(_pt, 0xff7a3d, 2.4, 2, 110); fireball(_pt, 1.5); deformCrater(E.ix, E.iz, 2.6, 0.55); return false; }
  if(E.ph === 1){ const k = Math.min(1, (E.t - K.warn) / K.skidT), s = K.skid * (1 - (1 - k) * (1 - k)), x = E.ix + E.ux * s, z = E.iz + E.uz * s, gy = heightAt(x, z);   // the skid: fire laid along it, whoever is in its way
    g.position.set(x, gy + 1.2, z); g.rotation.set(0.22 * (1 - k), E.yaw + k * 0.5, 0.38 * k + (1 - k) * Math.sin(E.t * 40) * 0.05, 'YXZ');
    while(E.next <= s){ const cx = E.ix + E.ux * E.next, cz = E.iz + E.uz * E.next; cellAdd(cx, cz, false, C.fire.warn, K.burnSkid * (0.7 + Math.random() * 0.5), K.skidR); blast(cx, cz, K.skidR, K.skidDmg, now); decalScorch(cx, cz, 3, 0.9);
      for(let i = 0; i < 4; i++) spawnPart(cx, heightAt(cx, cz) + 0.6, cz, (Math.random() - 0.5) * 9, 3 + Math.random() * 4, (Math.random() - 0.5) * 9, O_SPARK); E.next += K.cellGap; }
    if(E.pe > 0.04){ E.pe = 0; spawnPart(x, gy + 1.5, z, 0, 2, 0, O_SMOKE); } if(k < 1) return false;
    E.ph = 2; E.wx = x; E.wz = z; stripOff(); const blk = { mesh:g, x, z, r:K.block, hp:Infinity, maxHp:Infinity, steel:true, heavy:true, loot:false, kind:'outpost' }; blocks.push(blk); BIGEV.wrecks.push({ A:E.A, blk, x, z });   // the wreck: it stops rounds from now on
    cellAdd(x, z, false, C.fire.warn, K.burn, K.skidR + 0.5); E.cooks = Math.round(R2(K.cookN)); E.cookGap = (K.cook - K.cookWarn) / Math.max(1, E.cooks); E.cookAt = E.t + K.cookWarn; ringAt(x, z); say('ev_crash_cook', false);
    _pt.x = x; _pt.y = gy + 4; _pt.z = z; floatText('XÁC MÁY BAY CÒN NỔ', '#ff5a3a', _pt, 16); return false; }
  if(E.cooks > 0 && E.t >= E.cookAt){ E.cooks--; E.cookAt = E.t + E.cookGap * (0.7 + Math.random() * 0.6); const x = E.wx + (Math.random() - 0.5) * 6, z = E.wz + (Math.random() - 0.5) * 6;   // its ammunition and fuel go up, one blast after another
    blast(x, z, K.cookR, K.cookDmg, now); _pt.x = x; _pt.z = z; boom(_pt, 0xffae5c, 1.3 + Math.random() * 0.5, 0.8, 60); BIGEV.stats.cooks++; if(!E.cooks) ringOff(); }
  return E.t >= K.warn + K.skidT + K.burn; }

// ---- fire on the ground: cells that smoulder, burn and go out (the brush fire's spread from one to the next; the skid's and the wreck's just burn) ----
const CELL = [], FLAME = [], VL = [], _fuel = [], _hot = []; let _fgeo = null, _fmat = null, _emit = 0, _dmgT = 0, _sayAt = 0;
function flameGet(){ for(let i = 0; i < FLAME.length; i++) if(!FLAME[i].visible){ FLAME[i].visible = true; return FLAME[i]; } if(!_fgeo){ const t = flameFX(1, 1).children[0]; _fgeo = t.geometry; _fmat = t.material; }   // (fx/flames.js: one shader for every flame; a quad a cell)
  const m = new THREE.Mesh(_fgeo, _fmat); m.renderOrder = 5; m.frustumCulled = false; scene.add(m); FLAME.push(m); return m; }
// a cell at (x, z): sp it lights its neighbours · age s old already (a cell burns — hurts — from fire.warn on) · life s · r its radius
function cellAdd(x, z, sp, age, life, r){ let c = null; for(let i = 0; i < CELL.length && !c; i++) if(!CELL[i].on) c = CELL[i];
  if(!c){ if(CELL.length >= C.fire.max + 20) return null; c = { on:false, x:0, z:0, y:0, age:0, life:0, sp:false, r:0, hot:false, m:null }; CELL.push(c); }
  c.on = true; c.x = x; c.z = z; c.y = heightAt(x, z); c.age = age; c.life = life; c.sp = sp; c.r = r; c.hot = false; c.m = flameGet(); BIGEV.nCells++; BIGEV.stats.cells++; return c; }
function cellsFrame(dt, now){ const F = C.fire; let n = 0, hot = 0;
  for(let i = 0; i < CELL.length; i++){ const c = CELL[i]; if(!c.on) continue; c.age += dt; if(c.age >= c.life){ c.on = false; c.m.visible = false; c.m = null; continue; } n++;
    if(!c.hot && c.age >= F.warn){ c.hot = true; decalScorch(c.x, c.z, c.r * 1.2, 0.75); if(c.sp) for(let k = 0; k < _fuel.length; k++){ const f = _fuel[k]; if(f.alive && (f.x - c.x) ** 2 + (f.z - c.z) ** 2 < c.r * c.r) crushAt(f); } }   // alight: the scrub in it burns down
    if(c.hot) hot++; const k = Math.min(1, c.age / F.warn), out = Math.min(1, (c.life - c.age) / 2), s = c.r / F.cell; c.m.position.set(c.x, c.y, c.z); c.m.scale.set((0.8 + 1.6 * k) * out * s, (0.5 + 2.4 * k) * out * s, 1); }
  BIGEV.nCells = n; BIGEV.nHot = hot; if(!n) return;
  for(_emit += dt * n * 1.2; _emit >= 1; _emit -= 1){ const c = CELL[(Math.random() * CELL.length) | 0]; if(!c.on) continue; const x = c.x + (Math.random() - 0.5) * c.r, z = c.z + (Math.random() - 0.5) * c.r;   // smoke leaning with the wind, embers
    if(c.hot){ spawnPart(x, c.y + 1.4, z, WX.wind.x * 0.22, 2.3, WX.wind.y * 0.22, O_SMOKE); if(Math.random() < 0.3) spawnPart(x, c.y + 0.8, z, (Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2, O_EMBER); } else spawnPart(x, c.y + 0.5, z, WX.wind.x * 0.15, 1.2, WX.wind.y * 0.15, O_HAZE); }
  if((_dmgT -= dt) <= 0){ _dmgT = F.tick; cellsBurn(now); } }
function inFire(x, z){ for(let i = 0; i < CELL.length; i++){ const c = CELL[i]; if(c.on && c.hot && (c.x - x) ** 2 + (c.z - z) ** 2 < c.r * c.r) return true; } return false; }
// every fire.tick s: whoever stands in a burning cell burns — him, the enemy's men (not the general), ours
function cellsBurn(now){ const F = C.fire, p = S.player, d = F.dps * F.tick; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for(let i = 0; i < CELL.length; i++){ const c = CELL[i]; if(!c.on || !c.hot) continue; if(c.x - c.r < x0) x0 = c.x - c.r; if(c.x + c.r > x1) x1 = c.x + c.r; if(c.z - c.r < z0) z0 = c.z - c.r; if(c.z + c.r > z1) z1 = c.z + c.r; }
  if(x0 > x1) return;
  if(p.pos.x > x0 && p.pos.x < x1 && p.pos.z > z0 && p.pos.z < z1 && now >= (p.invincibleUntil || 0) && inFire(p.pos.x, p.pos.z)){ BIGEV.stats.hits++; damagePlayer(d * C.playerK, now, 0, 0, 'fire'); if(now > _sayAt){ _sayAt = now + 2; floatText('ĐANG CHÁY — RA KHỎI LỬA!', '#ff9a3a', p.pos, 15); } }
  for(let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if(!e.def.inf || e.general || e.pos.x < x0 || e.pos.x > x1 || e.pos.z < z0 || e.pos.z > z1 || !inFire(e.pos.x, e.pos.z)) continue; damageEnemy(e, d * F.enemyK); }
  for(let i = FT.length - 1; i >= 0; i--){ const a = FT[i]; if(a.pos.x > x0 && a.pos.x < x1 && a.pos.z > z0 && a.pos.z < z1 && inFire(a.pos.x, a.pos.z)) damageAlly(a, d); } }
// the fire's smoke shuts sight lines (game/stealth.js VEILS): a few banks laid over the burning cells, moved once a second
function veils(now, on){ const F = C.fire; while(VL.length < F.veils) VL.push({ x:0, z:0, R:F.smokeR, until:0 }); _hot.length = 0; if(on) for(let i = 0; i < CELL.length; i++) if(CELL[i].on && CELL[i].hot && CELL[i].sp) _hot.push(i);
  for(let k = 0; k < VL.length; k++){ const v = VL[k], i = VEILS.indexOf(v); if(!on){ if(i >= 0) VEILS.splice(i, 1); v.until = 0; continue; } if(i < 0) VEILS.push(v);
    if(_hot.length){ const c = CELL[_hot[Math.min(_hot.length - 1, ((k + 0.5) * _hot.length / VL.length) | 0)]]; v.x = c.x; v.z = c.z; v.until = now + 1.6; } else v.until = 0; } }

// ---- BRUSH FIRE ----
const dry = () => C.fire.biomes.indexOf(BIOME.name) >= 0 && C.fire.wet.indexOf(S.weather) < 0;
function fuelNear(x, z, r){ const r2 = r * r; for(let k = 0; k < _fuel.length; k++){ const f = _fuel[k]; if(f.alive && (f.x - x) ** 2 + (f.z - z) ** 2 < r2) return true; } return false; }
function cellNear(x, z, r){ const r2 = r * r; for(let i = 0; i < CELL.length; i++){ const c = CELL[i]; if(c.on && (c.x - x) ** 2 + (c.z - z) ** 2 < r2) return true; } return false; }
function startFire(now){ const F = C.fire, p = S.player, f2 = F.fuelR * F.fuelR; if(!dry()) return null; let ox = 0, oz = 0, bn = 0;
  for(let k = 0; k < F.tries; k++){ const a = Math.random() * 6.283, d = F.d[0] + Math.random() * (F.d[1] - F.d[0]), x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if(!inField(x, z, 4) || onTrail(x, z)) continue; let n = 0;   // where the scrub is thickest
    for(let i = 0; i < crushables.length; i++){ const c = crushables[i]; if(c.alive && c.kind === 'grass' && (c.x - x) ** 2 + (c.z - z) ** 2 < f2) n++; } if(n > bn){ bn = n; ox = x; oz = z; } }
  if(bn < F.minFuel) return null; _fuel.length = 0; const r2 = (F.reach + F.cell) ** 2; for(let i = 0; i < crushables.length; i++){ const c = crushables[i]; if(c.alive && c.kind === 'grass' && (c.x - ox) ** 2 + (c.z - oz) ** 2 < r2) _fuel.push(c); }
  let wx = WX.wind.x, wz = WX.wind.y; const wl = Math.hypot(wx, wz); if(wl < 0.01){ const a = Math.random() * 6.283; wx = Math.sin(a); wz = Math.cos(a); }
  const E = { kind:'fire', t:0, ox, oz, wa:Math.atan2(wx, wz), lit:false, step:0, vt:0, mkT:0, fuel:bn }; tell('⚠ CHÁY ĐỒNG CỎ — LỬA LAN THEO GIÓ!', 'ev_fire'); _pt.x = ox; _pt.z = oz; sfx('whistle', _pt); return E; }
function fireFrame(E, dt, now){ const F = C.fire;
  if(!E.lit){ if((E.mkT -= dt) <= 0){ E.mkT = 0.3; _pt.x = E.ox; _pt.z = E.oz; ringPulse(_pt, 0xff7a2a, F.cell * 1.5); } if(E.t < F.lit) return false;   // the stray shell: a ring where it will land, then the scrub is alight
    E.lit = true; _pt.x = E.ox; _pt.z = E.oz; boom(_pt, 0xff7a3d, 1.3, 0.5, 50); cellAdd(E.ox, E.oz, true, 0, R2(F.burn), F.cell); return false; }
  if((E.vt -= dt) <= 0){ E.vt = 1; veils(now, true); }
  if((E.step -= dt) <= 0){ E.step = F.step; let made = 0, n = 0, live = 0; const N = CELL.length, s0 = (Math.random() * N) | 0; for(let i = 0; i < N; i++) if(CELL[i].on){ n++; if(CELL[i].sp) live++; }
    if(!live){ veils(now, false); _fuel.length = 0; return true; }                                                     // every cell of it has gone out
    for(let q = 0; q < N && made < F.perStep && n < F.max * (MOBILE ? F.mobileK : 1) && E.t < F.life; q++){ const c = CELL[(s0 + q) % N]; if(!c.on || !c.sp || !c.hot || c.life - c.age < 2 || Math.random() > F.p) continue;
      const a = Math.random() < F.creep ? Math.random() * 6.283 : E.wa + (Math.random() - 0.5) * 2 * F.cone, d = F.cell * (0.9 + Math.random() * 0.4), x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
      if((x - E.ox) ** 2 + (z - E.oz) ** 2 > F.reach * F.reach || !inField(x, z, 2) || onTrail(x, z) || !fuelNear(x, z, F.near) || cellNear(x, z, F.cell * 0.75)) continue;   // only onto scrub that has not burnt: bare ground, a trail, water stop it
      cellAdd(x, z, true, 0, R2(F.burn), F.cell); made++; n++; } }
  return false; }

// ---- RADIO BLACKOUT ----
function jamSet(on){ BIGEV.jam = on; radio.jam = on; if(typeof document !== 'undefined') document.body.classList.toggle('jam', on); }
function startJam(now){ tell('⚠ ĐỊCH GÂY NHIỄU — SẮP MẤT LIÊN LẠC', 'ev_jam'); sfx('lockwarn'); return { kind:'jam', t:0, air:false, lives:S.player.lives }; }
function jamFrame(E, dt, now){ const K = C.jam; if(!E.air){ if(E.t < K.warn) return false; E.air = true; jamSet(true); sfx('lockwarn'); return false; }
  if(E.t < K.warn + K.t && !duelOn() && S.player.lives >= E.lives) return false;                                      // (the general comes out, or a life is lost: the net is given back at once)
  jamSet(false); say('ev_jam_end', true); if(DIR.phase === 'finale' && DIR.fin > 0) dirSay(now, 'finale', true); return true; }   // (the general's coming, if it was announced into the static, is said again)

// ---- the hat, the frame, the resets ----
const START = { bombing:startBombing, crash:startCrash, fire:startFire, jam:startJam }, FRAME = { bombing:bombingFrame, crash:crashFrame, fire:fireFrame, jam:jamFrame }; let _hat = false;
// may this event be drawn now: one at a time, its stage reached, the stage's count and the gap kept, no side mission in hand, and the director's word (a surprise
//   may play and his health is over hpMin)
function eventOk(k, now){ return BIGEV.on && !BIGEV.cur && !UNDER.on && BIGEV.count < C.perStage && BIGEV.clock >= BIGEV.freeAt && S.stage >= (C.from[k] || 1) && !SIDEM.cur && (k !== 'fire' || dry()) && dirEventOk(now, C.hpMin); }
// the event begins now (force: dev / probes — the gates are not asked). false: it may not, or it found no place for itself
export function bigEventStart(kind, now, force){ if(!START[kind] || !S.player || BIGEV.cur || !force && !eventOk(kind, now)) return false; const E = START[kind](now); if(!E) return false;
  BIGEV.cur = E; BIGEV.count++; BIGEV.stats[kind]++; note(kind); return true; }
// once a frame in battle (game/loop.js)
export function updateBigEvents(dt, now){ if(!S.player) return; if(S.awaitingUpgrade){ if(BIGEV.on){ clearBigEvents(); BIGEV.on = false; } return; }   // the stage is won: nothing of ours stays on the field
  BIGEV.clock += dt; const E = BIGEV.cur; if(E){ E.t += dt; if(FRAME[E.kind](E, dt, now)){ BIGEV.cur = null; BIGEV.freeAt = BIGEV.clock + C.gap; note(E.kind + ' over'); } }
  if(BIGEV.nCells) cellsFrame(dt, now); }
export function clearBigEvents(){ BIGEV.cur = null; jamSet(false); stripOff(); ringOff(); for(let i = 0; i < HIND.length; i++) HIND[i].visible = false; for(let i = 0; i < SHAD.length; i++) SHAD[i].visible = false; for(let i = 0; i < BOMB.length; i++) BOMB[i].visible = false;
  for(let i = 0; i < BIGEV.wrecks.length; i++){ const k = blocks.indexOf(BIGEV.wrecks[i].blk); if(k >= 0) blocks.splice(k, 1); } BIGEV.wrecks.length = 0; for(let i = 0; i < AIR.length; i++){ AIR[i].busy = false; AIR[i].g.visible = false; }
  for(let i = 0; i < CELL.length; i++){ CELL[i].on = false; CELL[i].m = null; } for(let i = 0; i < FLAME.length; i++) FLAME[i].visible = false; BIGEV.nCells = BIGEV.nHot = 0; veils(0, false); _fuel.length = 0; _emit = 0; }
// a stage begins (ui/briefing.js goLive): nothing left over, and — the first time — the events put into the surprises' hat
export function bigEventsReset(now){ const st = BIGEV.stats; clearBigEvents(); for(const k in st) st[k] = 0; BIGEV.log.length = 0; BIGEV.on = C.on && !OFF; BIGEV.clock = 0; BIGEV.freeAt = 0; BIGEV.count = 0;
  if(!_hat){ _hat = true; for(const k in START) surpriseAdd(k, n => bigEventStart(k, n), { from:C.from[k], w:C.w[k], ok:n => eventOk(k, n) }); } }
// EVENT 3 dev / probes: what of the events is on show right now (after clearBigEvents: nothing)
export function bigEventsShown(){ let hind = 0, bomb = 0, air = 0, flame = 0; for(let i = 0; i < HIND.length; i++) if(HIND[i].visible) hind++; for(let i = 0; i < BOMB.length; i++) if(BOMB[i].visible) bomb++;
  for(let i = 0; i < AIR.length; i++) if(AIR[i].g.visible) air++; for(let i = 0; i < FLAME.length; i++) if(FLAME[i].visible) flame++;
  return { hind, bomb, air, flame, cells:BIGEV.nCells, hot:BIGEV.nHot, strip:!!(_strip && _strip.visible), ring:!!(_ring && _ring.visible), veils:VEILS.length, wrecks:BIGEV.wrecks.length, jam:BIGEV.jam, pool:[HIND.length, BOMB.length, AIR.length, FLAME.length, CELL.length] }; }
// ui/radar.js asks right after it has wiped the canvas: true = jammed, the set shows nothing but static
const JAMCOL = ['rgba(190,220,170,0.5)', 'rgba(120,150,110,0.35)', 'rgba(230,240,220,0.7)']; let _jf = '', _jw = 0;
export function radarJam(c, W, H){ if(!BIGEV.jam) return false; c.fillStyle = 'rgba(8,12,7,0.9)'; c.fillRect(0, 0, W, H); for(let i = 0; i < 80; i++){ c.fillStyle = JAMCOL[(Math.random() * 3) | 0]; c.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 16, 1); }
  if(_jw !== W){ _jw = W; _jf = '600 ' + Math.round(W * 0.085) + 'px "Share Tech Mono",monospace'; } c.fillStyle = '#ffcf5a'; c.font = _jf; c.textAlign = 'center'; c.textBaseline = 'middle'; if(Math.sin(performance.now() / 140) > -0.4) c.fillText('MẤT SÓNG', W / 2, H / 2); return true; }
// …and for its marks: the bombs' line or the skid (red, blinking), the cells on fire (orange), a wreck (a dark red square)
export function radarEvents(c, toX, toY){ if(BIGEV.lineOn){ c.globalAlpha = 0.55 + 0.4 * Math.sin(performance.now() / 110); c.strokeStyle = '#ff3a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(toX(BIGEV.lx0), toY(BIGEV.lz0)); c.lineTo(toX(BIGEV.lx1), toY(BIGEV.lz1)); c.stroke(); c.globalAlpha = 1; }
  if(BIGEV.nCells){ c.fillStyle = '#ff9a3a'; for(let i = 0; i < CELL.length; i++){ const q = CELL[i]; if(q.on) c.fillRect(toX(q.x) - 1, toY(q.z) - 1, 2.5, 2.5); } }
  if(BIGEV.wrecks.length){ c.fillStyle = '#b03a2a'; for(let i = 0; i < BIGEV.wrecks.length; i++){ const w = BIGEV.wrecks[i]; c.fillRect(toX(w.x) - 2, toY(w.z) - 2, 4, 4); } } }
