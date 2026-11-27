// campaign/side-missions.js — EVENT 1 SIDE MISSIONS IN THE MIDDLE OF A FIGHT (config.js SIDEMISSION): when the director has room for more, the radio offers something
//   nobody planned — optional, one at a time, a ring and a badge on the field, a mark on the minimap, a card with its timer; ignored, it costs only its reward.
//   · DOWNED PILOT: one of our transports crosses the sky trailing smoke and goes down; the pilot comes down under a canopy and lights flares; an enemy patrol is
//     sent for him over the field's edge (campaign/entries.js). Stand by him while he is patched up and he joins the squad (and an air strike falls on the enemy).
//   · STUCK SUPPLY TRUCK: a truck of ours is bogged; hold the circle round it while its crew digs (the enemy is drawn to it); it drives off and leaves a medkit
//     and an ammunition crate — or burns, when the enemy has it to himself for long enough.
//   · PRISONERS ON THE MOVE: an escort marches our men to the field's edge; the whole escort down before it gets there and they take up rifles and join.
//   What a mission puts on the field is taken off when it ends; what it leaves behind (a burnt truck, a fallen pilot) goes with the stage (clearSideMissions:
//   the stage won, a restart, the menu). A life lost ends the mission in hand. One slow tick (SIDEMISSION.tick) does the thinking; a frame only moves what moves.
import * as THREE from 'three';
import { ENTRY, OUTPOST, SIDEMISSION, STORY, TROOPS } from '../../config.js';
import { BIGEV, AMMO, ARENA, POWERUPS, S, UNDER, addScore, animateSoldier, aoeDamage, bigExplode, blocks, buildTransport, burst, callStrike, chute, dirOfferOk, dropPowerup, edgeEntry, enemies, entrySeen, fieldEdgePoint, fireball, floatText, gainXp, hatchEntry, heightAt, holoRing, inCamView, inField, loadGLTF, makeSoldierMesh, radio, ringPulse, scene, sfx, showBanner, soldierKneel, spawnAlly, spawnPart, spawnSquad, squadTypes, storyCue, svgBadgeTex, medalEvent } from '../hub.js';

const C = SIDEMISSION, R2 = a => a[0] + Math.random() * (a[1] - a[0]), _pt = { x:0, y:0, z:0 }, _v = new THREE.Vector3();
const OFF = typeof location !== 'undefined' && /noevents/.test(location.search + location.hash);
const VI = { pilot:['CỨU PHI CÔNG', 'heart'], truck:['GIỮ XE TIẾP TẾ', 'mag'], pows:['GIẢI CỨU TÙ BINH', 'team'] };
// the particles' options, kept (fx/particles.js spawnPart reads them and keeps nothing): no object is made in a frame
const O_SMOKE = { color:0x15120f, size:1.9, life:1.8, smoke:true, grav:0.4, drag:1, grow:1.6, op:0.55 }, O_FIRE = { tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:1.1, life:0.4, grav:1, drag:2 },
  O_FLARE = { color:0xff4a3a, size:0.7, life:1.5, grav:-2.2, drag:0.5 }, O_GLOW = { color:0xff9a8a, size:1.3, life:2.4, smoke:true, grav:0.3, drag:1.2, grow:1.8, op:0.4 }, O_DUST = { color:0x8a7a5a, size:1.3, life:0.9, smoke:true, grav:-0.2, drag:2, grow:1.2, op:0.35 };
// what is on (dev/probes read it): cur the mission in hand (null: none; its state go | won | lost) · wait s to the next offer · done: offered this stage ·
//   props: what the missions left on the field until the stage ends · stats: what became of them
export const SIDEM = { on:false, cur:null, wait:0, done:0, last:'', lives:-1, tickAt:0, props:[], stats:{ offered:0, won:0, lost:0, expired:0, aborted:0, patrols:0 }, log:[] };
function note(k, why){ const L = SIDEM.log; if(L.length >= 30) L.shift(); L.push({ k, why:why || '', stage:S.stage, wave:S.wave }); }
// a line of the story's pool for the event (campaign/story.js) — the commander's first variant when the story is off
function say(key, must){ if(storyCue(key, null, must)) return; const L = STORY.lines[key]; if(L) radio(STORY.cast.cmd.tag + ': ' + L.t[0]); }

// ---- the marker on the field (one ring, one badge, made once) and the card on the HUD ----
let _mk = null, _el = null, _sig = '';
function marker(){ if(_mk) return _mk; const ring = holoRing(C.ring, { kind:'ally', depthTest:true }), badge = new THREE.Sprite(new THREE.SpriteMaterial({ map:svgBadgeTex('team', '#7fd0ff'), transparent:true, depthWrite:false }));
  badge.scale.set(2.6, 2.6, 1); ring.visible = badge.visible = false; scene.add(ring); scene.add(badge); return (_mk = { ring, badge }); }
function markAt(M, now){ const k = marker(), gy = heightAt(M.x, M.z); k.ring.visible = k.badge.visible = true; k.ring.position.set(M.x, gy + 0.12, M.z); k.ring.scale.setScalar(M.r / C.ring);
  k.badge.position.set(M.x, gy + C.badgeY + Math.sin(now * 2.2) * 0.2, M.z); }
function markOff(){ if(_mk) _mk.ring.visible = _mk.badge.visible = false; }
function card(M){ if(!_el){ const el = typeof document !== 'undefined' && document.getElementById('sideChip'); if(!el) return; _el = { el, name:el.querySelector('.sc-name'), t:el.querySelector('.sc-t'), bar:el.querySelector('.sc-bar i'), fx:el.querySelector('.sc-fx') }; }
  if(!M){ if(_sig !== ''){ _sig = ''; _el.el.classList.add('hidden'); } return; }
  const t = Math.max(0, Math.ceil(M.t)), sig = M.kind + '|' + M.state + '|' + t + '|' + Math.round(M.prog * 50) + '|' + M.sub; if(sig === _sig) return; _sig = sig;
  _el.el.classList.remove('hidden'); _el.el.classList.toggle('done', M.state === 'won'); _el.el.classList.toggle('fail', M.state === 'lost');
  _el.name.textContent = VI[M.kind][0]; _el.t.textContent = M.state === 'go' ? ((t / 60) | 0) + ':' + String(t % 60).padStart(2, '0') : M.state === 'won' ? 'XONG' : 'HỎNG';
  _el.bar.style.width = Math.round(M.prog * 100) + '%'; _el.fx.textContent = M.sub; }

// ---- what the missions share ----
// a spot d0…d1 m from him: inside the field with m to spare, clear of anything solid, and (hidden) out of the camera's frame
function spot(d0, d1, m, hidden){ const p = S.player;
  for(let k = 0; k < 30; k++){ const a = Math.random() * 6.283, d = d0 + Math.random() * (d1 - d0), x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if(!inField(x, z, m) || hidden && inCamView(x, z)) continue;
    let ok = true; for(let i = 0; i < blocks.length && ok; i++){ const b = blocks[i], r = (b.r || 1) + m * 0.6; ok = (b.x - x) ** 2 + (b.z - z) ** 2 >= r * r; } if(ok) return [x, z]; }
  return null; }
// a squad sent to (x, z) through the entries: over the field's edge near it, out of the frame (campaign/entries.js edgeEntry) — else up out of a hatch beyond
//   it that he cannot see; the men go into `out` as they come onto the field. false: no way in he would not see
function sendTo(x, z, out){ if(enemies.length >= C.maxFoes) return false;   // EVENT 3 (a crowded field gets no more men for a side mission)
  const e = edgeEntry(Math.atan2(z, x), 1.2), n0 = enemies.length, p = S.player;
  if(e){ spawnSquad({ x:e.x, z:e.z, how:'edge' }); for(let i = n0; i < enemies.length; i++) out.push(enemies[i]); return out.length > 0; }
  const a = Math.atan2(x - p.pos.x, z - p.pos.z);
  for(let k = 0; k < 6; k++){ const b = a + (Math.random() - 0.5) * 1.4, hx = x + Math.sin(b) * 28, hz = z + Math.cos(b) * 28; if(!inField(hx, hz, 4) || entrySeen(hx, hz)) continue; hatchEntry(hx, hz, squadTypes(), { each:m => out.push(m) }); return true; }
  return false; }
// the men of `men` who have not found him are marched on to (x, z) — their own search of the last known place does the walking (ai/awareness.js e.lk); the dead
//   are dropped from the list. Returns how many are left
function steer(men, x, z){ for(let i = men.length - 1; i >= 0; i--){ const e = men[i]; if(!(e.hp > 0) || !enemies.includes(e)){ men.splice(i, 1); continue; } if(e.alert !== undefined && e.alert < 2 && e.lk){ e.lk.x = x; e.lk.z = z; e.srAt = 0; } } return men.length; }
function unblock(b){ const i = b ? blocks.indexOf(b) : -1; if(i >= 0) blocks.splice(i, 1); }
function base(kind, K, x, z, r){ return { kind, K, t:K.t, x, z, r, prog:0, state:'go', endT:0, sub:'', men:[], strike:0 }; }
// the mission is over: won (the reward, the line), lost or expired (the line) — its marker goes now, its card shows the outcome for endHold s, then cleanup
function finish(M, state, now, key, sub){ const K = M.K, st = SIDEM.stats; M.state = state === 'won' ? 'won' : 'lost'; M.endT = C.endHold; M.sub = sub; markOff(); SIDEM.wait = R2(C.every); st[state]++; note(M.kind + ' ' + state, sub);
  if(state === 'won'){ addScore(K.score, _v.set(M.x, heightAt(M.x, M.z) + 4, M.z)); gainXp(K.xp, M); medalEvent('side'); showBanner('NHIỆM VỤ PHỤ HOÀN THÀNH', '#9be04a'); sfx('levelup'); }
  else if(state !== 'aborted') showBanner(state === 'expired' ? 'NHIỆM VỤ PHỤ: HẾT GIỜ' : 'NHIỆM VỤ PHỤ THẤT BẠI', '#ff9a7a');
  if(key) say(key, state === 'won'); }
// everything the mission still has on the field (what it left behind was handed to SIDEM.props)
function cleanup(M){ if(M.air) M.air.visible = false; if(M.can) scene.remove(M.can); if(M.man) scene.remove(M.man); if(M.g) scene.remove(M.g); unblock(M.blk);
  if(M.crew) for(let i = 0; i < M.crew.length; i++) scene.remove(M.crew[i]); if(M.pr) for(let i = 0; i < M.pr.length; i++) scene.remove(M.pr[i]);
  M.air = M.can = M.man = M.g = M.blk = null; if(M.crew) M.crew.length = 0; if(M.pr) M.pr.length = 0; M.men.length = 0; }
const keep = (g, blk, kind, x, z, life) => SIDEM.props.push({ g, blk:blk || null, kind:kind || 'keep', t:0, pe:0, x:x || 0, z:z || 0, a:0, v:0, sp:0, life:life || 0 });

// ---- DOWNED PILOT ----
let _air = null;
function startPilot(now){ const P = C.pilot, p = S.player, at = spot(P.crashD[0], P.crashD[1], 6, false); if(!at) return null; let dir = -1, any = -1;
  for(let k = 0; k < 10 && dir < 0; k++){ const a = Math.random() * 6.283, cx = at[0] + Math.sin(a) * P.past, cz = at[1] + Math.cos(a) * P.past; if(Math.hypot(cx - p.pos.x, cz - p.pos.z) < C.minD * 0.8) continue;
    any = a; if(!inCamView(cx - Math.sin(a) * P.speed * P.fly, cz - Math.cos(a) * P.speed * P.fly)) dir = a; }   // (it comes into the sky from where he is not looking, when it can)
  if(dir < 0) dir = any; if(dir < 0) return null;
  const M = base('pilot', P, at[0], at[1], P.r); if(!_air){ _air = buildTransport(); scene.add(_air); }
  M.dir = dir; M.cx = at[0] + Math.sin(dir) * P.past; M.cz = at[1] + Math.cos(dir) * P.past; M.ft = 0; M.pe = 0; M.air = _air; _air.visible = true; _air.rotation.set(0.1, dir, 0, 'YXZ');
  M.man = null; M.can = null; M.cy = 0; M.down = false; M.caught = 0; M.flare = 1; M.smoke = 0; M.sent = false; M.sub = 'Phi công đang nhảy dù — tới chỗ vòng sáng'; pilotFrame(M, 0, now); sfx('flybyHeavy'); return M; }
function pilotFrame(M, dt, now){ const P = M.K, sd = Math.sin(M.dir), cd = Math.cos(M.dir); M.pe += dt;
  if(M.air){ M.ft += dt; const al = (M.ft / P.fly - 1) * P.speed * P.fly, x = M.cx + sd * al, z = M.cz + cd * al, y = heightAt(M.cx, M.cz) + 1.5 + P.alt * Math.min(1, -al / P.glide), g = M.air, rt = g.userData.rotors;
    g.position.set(x, y, z); g.rotation.z = Math.sin(M.ft * 2.3) * 0.12; if(rt) for(let i = 0; i < rt.length; i++) rt[i].rotation.y += dt * 22;
    if(M.pe > 0.035){ M.pe = 0; spawnPart(x, y + 0.6, z, 0, 1.2, 0, O_SMOKE); if(Math.random() < 0.5) spawnPart(x, y, z, (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2, O_FIRE); }
    if(!M.man && al >= -P.past){ const m = makeSoldierMesh(); m.scale.setScalar(TROOPS.look.scale); m.userData.gun.visible = false; M.cy = y - 1.5; m.position.set(M.x, M.cy, M.z); scene.add(m); M.man = m;   // he bails out over his spot
      M.can = chute(); M.can.position.set(M.x, M.cy, M.z); scene.add(M.can); }
    if(al >= 0){ g.visible = false; M.air = null; _pt.x = M.cx; _pt.z = M.cz; const s0 = S.shake, d = Math.hypot(S.player.pos.x - M.cx, S.player.pos.z - M.cz); bigExplode(_pt, 0xff7a3d, 2.2); aoeDamage(M.cx, M.cz, 6, 60, false, now, 'HE');   // (the blast's look and report: fx/explosions.js)
      S.shake = d < 90 ? Math.min(3, s0 + 1.2 * (1 - d / 90)) : s0; M.smoke = 30;
      if(!M.sent){ M.sent = true; if(sendTo(M.x, M.z, M.men)) SIDEM.stats.patrols++; } } }
  else if(M.smoke > 0){ M.smoke -= dt; if(M.pe > 0.25){ M.pe = 0; spawnPart(M.cx + (Math.random() - 0.5) * 3, heightAt(M.cx, M.cz) + 1.2, M.cz + (Math.random() - 0.5) * 3, 0.4, 2.4, 0.3, O_SMOKE); } }
  if(M.can){ M.cy -= P.sink * dt; const gy = heightAt(M.x, M.z);
    if(M.cy <= gy){ scene.remove(M.can); M.can = null; M.down = true; M.man.position.set(M.x, gy, M.z); M.man.rotation.z = 0; soldierKneel(M.man, true); M.sub = 'Tới bên phi công, ở lại ' + P.patch + ' giây';
      _pt.x = M.x; _pt.y = gy + 2.4; _pt.z = M.z; floatText('PHI CÔNG', '#7fd0ff', _pt, 15); }
    else { M.can.position.set(M.x, M.cy, M.z); M.man.position.set(M.x, M.cy, M.z); M.can.rotation.z = M.man.rotation.z = Math.sin(now * 1.7) * 0.07; } }
  if(M.down && (M.flare -= dt) <= 0){ M.flare = P.flareEvery; const gy = heightAt(M.x, M.z); for(let i = 0; i < 5; i++) spawnPart(M.x, gy + 1.2 + i * 0.5, M.z, (Math.random() - 0.5) * 0.6, 11 + i, (Math.random() - 0.5) * 0.6, O_FLARE);   // the flare: a red streak up, its smoke after it
    spawnPart(M.x, gy + 2, M.z, 0.3, 3, 0.2, O_GLOW); _pt.x = M.x; _pt.z = M.z; ringPulse(_pt, 0xff5a3a, 3); } }
function pilotTick(M, tk, now){ const P = M.K, p = S.player; if(!M.down) return;
  const left = steer(M.men, M.x, M.z);
  if(Math.hypot(p.pos.x - M.x, p.pos.z - M.z) < P.r){ M.caught = 0; M.prog = Math.min(1, M.prog + tk / P.patch); M.sub = 'Đang băng bó phi công — giữ vị trí';
    if(M.prog >= 1){ const a = spawnAlly(M.x, M.z, p.facing || 0, 'rifle'); a.name = 'Phi công'; a.hp = Math.max(1, Math.round(a.maxHp * P.hp)); scene.remove(M.man); M.man = null; if(P.strike) M.strike = 1.2;
      finish(M, 'won', now, 'ev_pilot_ok', 'Phi công theo tổ · +' + P.score + ' điểm'); }
    return; }
  let near = false; for(let i = 0; i < M.men.length && !near; i++){ const e = M.men[i]; near = (e.pos.x - M.x) ** 2 + (e.pos.z - M.z) ** 2 < P.catchR * P.catchR; }
  M.caught = near ? M.caught + tk : 0; M.sub = left ? 'Tốp địch đang tới chỗ phi công — nhanh lên' : 'Tới bên phi công, ở lại ' + P.patch + ' giây';
  if(M.caught >= P.catchT){ pilotGone(M, true); finish(M, 'lost', now, 'ev_pilot_lost', 'Địch tới trước — mất phi công'); } }
// he stays where he is until the stage ends: fallen (the patrol got to him) or still waiting (nobody came)
function pilotGone(M, shot){ const m = M.man; if(!m) return; if(M.can){ scene.remove(M.can); M.can = null; m.position.set(M.x, heightAt(M.x, M.z), M.z); m.rotation.z = 0; }
  if(shot){ soldierKneel(m, false); m.rotation.x = -Math.PI / 2; m.position.y = heightAt(M.x, M.z) + 0.25; } keep(m); M.man = null; }

// ---- STUCK SUPPLY TRUCK ----
let _trk = null, _tm = null;
// the truck's scan (assets/models/real/camp/mil_truck.glb) as one shape: on the ground, its long side along z, as long as the camps' own (OUTPOST.size)
function truckShape(gl){ if(_trk && _trk.gl === gl) return _trk; if(_trk) _trk.geo.dispose(); let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
  const g = src.geometry.clone().applyMatrix4(src.matrixWorld); g.computeBoundingBox(); let b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); if(b.max.x - b.min.x > b.max.z - b.min.z) g.rotateY(Math.PI / 2);
  g.computeBoundingBox(); b = g.boundingBox; const f = OUTPOST.size.mil_truck.w / (b.max.z - b.min.z); g.scale(f, f, f); g.computeBoundingBox(); g.computeBoundingSphere(); return (_trk = { gl, geo:g, mat:src.material }); }
// a truck: drawn from boxes at once, the scan over it when the file is in
function makeTruck(){ const T = _tm || (_tm = { body:new THREE.MeshStandardMaterial({ color:0x4c5838, roughness:0.85, metalness:0.2 }), tarp:new THREE.MeshStandardMaterial({ color:0x6a6a4a, roughness:0.95 }),
    dark:new THREE.MeshStandardMaterial({ color:0x1c1c18, roughness:0.8 }), box:new THREE.BoxGeometry(1, 1, 1), wheel:new THREE.CylinderGeometry(0.5, 0.5, 0.36, 12) });
  const g = new THREE.Group(), draw = new THREE.Group(), put = (geo, mat, sx, sy, sz, x, y, z, rz) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.z = rz || 0; m.castShadow = m.receiveShadow = true; draw.add(m); };
  put(T.box, T.body, 2.3, 1.5, 2.0, 0, 1.6, 2.5); put(T.box, T.body, 2.4, 0.5, 7.2, 0, 0.95, 0); put(T.box, T.tarp, 2.4, 1.7, 4.6, 0, 2.05, -1.2);
  for(let k = 0; k < 6; k++) put(T.wheel, T.dark, 1, 1, 1, k % 2 ? 1.15 : -1.15, 0.5, [2.5, -0.9, -2.3][k >> 1], Math.PI / 2);
  g.add(draw); loadGLTF('mil_truck').then(gl => { if(!gl || !g.parent) return; const P = truckShape(gl), m = new THREE.Mesh(P.geo, P.mat); m.castShadow = m.receiveShadow = true; g.add(m); draw.visible = false; });
  return g; }
function startTruck(now){ const P = C.truck, at = spot(C.minD, C.maxD, 8, true); if(!at) return null; const M = base('truck', P, at[0], at[1], P.r), g = makeTruck(), gy = heightAt(at[0], at[1]);
  M.face = Math.atan2(at[0] * 0.4, ARENA * 1.1 - at[1]);   // (its nose to our rear, a little outward: the way it will drive off)
  g.position.set(at[0], gy - P.sink, at[1]); g.rotation.set(0.03, M.face, 0.07, 'YXZ'); scene.add(g); M.g = g;
  M.blk = { mesh:g, x:at[0], z:at[1], r:P.block, hp:Infinity, maxHp:Infinity, steel:true, heavy:true, loot:false, kind:'outpost' }; blocks.push(M.blk);   // it stops rounds: cover while it stands
  M.crew = []; for(let k = 0; k < 2; k++){ const s = k ? 1 : -1, a = M.face + Math.PI / 2, x = at[0] + Math.sin(a) * 1.9 * s - Math.sin(M.face) * 2.2 * s, z = at[1] + Math.cos(a) * 1.9 * s - Math.cos(M.face) * 2.2 * s, c = makeSoldierMesh();
    c.scale.setScalar(TROOPS.look.scale); c.userData.gun.visible = false; c.position.set(x, heightAt(x, z), z); c.rotation.y = s > 0 ? a + Math.PI : a; soldierKneel(c, true); scene.add(c); M.crew.push(c); }
  M.hold = 0; M.pull = 0; M.over = 0; M.came = false; M.pe = 0; M.sub = 'Vào vòng tròn quanh xe, giữ đủ ' + P.hold + ' giây'; return M; }
function truckFrame(M, dt, now){ for(let i = 0; i < M.crew.length; i++){ const a = M.crew[i].userData.arms; if(a) a.rotation.x = -0.7 + Math.sin(now * 5 + i * 2) * 0.45; }   // the crew digs
  if((M.pe += dt) > 0.4){ M.pe = 0; const c = M.crew[(Math.random() * M.crew.length) | 0]; if(c) spawnPart(c.position.x, c.position.y + 0.3, c.position.z, (Math.random() - 0.5) * 2, 1.6, (Math.random() - 0.5) * 2, O_DUST); } }
function truckTick(M, tk, now){ const P = M.K, p = S.player, inC = Math.hypot(p.pos.x - M.x, p.pos.z - M.z) < P.r, o2 = P.overrunR * P.overrunR, r2 = P.pullR * P.pullR; let foes = 0;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(e.def.inf && !e.gaveUp && !e.rise && (e.pos.x - M.x) ** 2 + (e.pos.z - M.z) ** 2 < o2) foes++; }
  steer(M.men, M.x, M.z);
  if((M.pull -= tk) <= 0){ M.pull = P.pull; let n = 0;   // the enemy is drawn to it: men who have not found him are sent there
    for(let i = 0; i < enemies.length && n < P.pullN; i++){ const e = enemies[i]; if(!e.def.inf || e.guard || e.gaveUp || !e.lk || e.alert === undefined || e.alert >= 2 || (e.pos.x - M.x) ** 2 + (e.pos.z - M.z) ** 2 > r2) continue;
      e.lk.x = M.x + (Math.random() - 0.5) * 6; e.lk.z = M.z + (Math.random() - 0.5) * 6; e.srAt = 0; n++; } }
  if(inC){ if(!M.came){ M.came = true; for(let k = 0; k < P.squads; k++) if(sendTo(M.x, M.z, M.men)) SIDEM.stats.patrols++; }
    M.hold += tk; M.prog = Math.min(1, M.hold / P.hold); M.over = Math.max(0, M.over - tk); M.sub = 'Giữ vững — tổ lái đang đào bánh xe';
    if(M.prog >= 1){ unblock(M.blk); M.blk = null; for(let i = 0; i < M.crew.length; i++) scene.remove(M.crew[i]); M.crew.length = 0;   // out: the crew aboard, it drives off and leaves the crate
      _pt.x = M.x - Math.sin(M.face) * 5; _pt.z = M.z - Math.cos(M.face) * 5; dropPowerup(_pt, 1, POWERUPS.find(u => u.id === 'heal')); dropPowerup(_pt, 0, AMMO); ringPulse(_pt, 0xffd86a, 4);
      keep(M.g, null, 'drive', M.x, M.z, P.leave); const q = SIDEM.props[SIDEM.props.length - 1]; q.a = M.face; q.sp = P.speed; M.g = null; finish(M, 'won', now, 'ev_truck_ok', 'Xe đã ra · thùng đạn + cứu thương'); }
    return; }
  M.over = foes ? M.over + tk : Math.max(0, M.over - tk * 0.5); M.sub = foes ? 'Địch đang áp sát xe — quay lại vòng tròn!' : 'Vào vòng tròn quanh xe, giữ đủ ' + P.hold + ' giây';
  if(M.over >= P.overrunT){ _pt.x = M.x; _pt.z = M.z; bigExplode(_pt, 0xff8a3a, 2); fireball(_pt, 1.4); truckLeft(M, 'smoke'); finish(M, 'lost', now, 'ev_truck_lost', 'Xe tiếp tế bị đốt'); } }
// it stays where it is until the stage ends (burning, or still bogged with its crew): the hulk keeps stopping rounds
function truckLeft(M, kind){ if(!M.g) return; keep(M.g, M.blk, kind, M.x, M.z, 30); M.g = null; M.blk = null;
  for(let i = 0; i < M.crew.length; i++){ if(kind === 'smoke') scene.remove(M.crew[i]); else keep(M.crew[i]); } M.crew.length = 0; }

// ---- PRISONERS ON THE MOVE ----
function startPows(now){ const P = C.pows, p = S.player, E = edgeEntry(null); if(!E) return null; const aE = Math.atan2(E.z, E.x); let X = null, bd = 1e9;
  for(let s = -1; s <= 1; s += 2) for(let da = 0.45; da < 1.5; da += 0.2){ const q = fieldEdgePoint(aE + s * da, ENTRY.edgeIn + 2), L = Math.hypot(q[0] - E.x, q[1] - E.z); if(L < P.march[0] || L > P.march[1]) continue;
      const d = Math.hypot((q[0] + E.x) / 2 - p.pos.x, (q[1] + E.z) / 2 - p.pos.z); if(d < bd){ bd = d; X = q; } break; }   // (the way out whose road passes nearer to him)
  if(!X) return null; const n0 = enemies.length; spawnSquad({ x:E.x, z:E.z, how:'edge' }); if(enemies.length === n0) return null;
  const M = base('pows', P, E.x, E.z, 4); for(let i = n0; i < enemies.length; i++) M.men.push(enemies[i]); M.n0 = M.men.length; M.ex = X[0]; M.ez = X[1]; M.kn = false; M.pr = [];
  for(let i = 0; i < P.n; i++){ const g = makeSoldierMesh(), x = E.x + (Math.random() - 0.5) * 3, z = E.z + (Math.random() - 0.5) * 3; g.scale.setScalar(TROOPS.look.scale); g.userData.gun.visible = false; g.position.set(x, heightAt(x, z), z); scene.add(g); M.pr.push(g); }
  M.sub = 'Hạ hết tốp áp giải trước khi chúng ra khỏi trận'; return M; }
function powsFrame(M, dt, now){ const P = M.K; let L = null, fight = false, sx = 0, sz = 0;
  for(let i = 0; i < M.men.length; i++){ const e = M.men[i]; if(!(e.hp > 0)) continue; if(!L) L = e; if(e.alert >= 2) fight = true; }
  const stop = !L || fight; if(stop !== M.kn){ M.kn = stop; for(let i = 0; i < M.pr.length; i++) soldierKneel(M.pr[i], stop); }   // the escort is fighting: they go down on one knee where they are
  if(!stop){ const dx = M.ex - L.pos.x, dz = M.ez - L.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    for(let i = 0; i < M.pr.length; i++){ const g = M.pr[i], mx = L.pos.x - ux * (2.4 + i * P.gap) - g.position.x, mz = L.pos.z - uz * (2.4 + i * P.gap) - g.position.z, md = Math.hypot(mx, mz), st = md > 0.15 ? Math.min(md, P.walk * dt) : 0;
      if(st > 0){ g.position.x += mx / md * st; g.position.z += mz / md * st; g.rotation.y = Math.atan2(mx, mz); } g.position.y = heightAt(g.position.x, g.position.z); animateSoldier(g, st, dt, false); } }
  for(let i = 0; i < M.pr.length; i++){ sx += M.pr[i].position.x; sz += M.pr[i].position.z; } if(M.pr.length){ M.x = sx / M.pr.length; M.z = sz / M.pr.length; } }
function powsTick(M, tk, now){ const P = M.K, left = steer(M.men, M.ex, M.ez); M.prog = 1 - left / M.n0; M.sub = 'Còn ' + left + ' lính áp giải — hạ hết trước khi chúng ra khỏi trận';
  if(!left){ const n = M.pr.length; for(let i = 0; i < n; i++){ const g = M.pr[i], a = spawnAlly(g.position.x, g.position.z, g.rotation.y, 'rifle'); a.hp = Math.max(1, Math.round(a.maxHp * P.hp));   // free: each takes up a rifle
      _pt.x = g.position.x; _pt.z = g.position.z; burst(_pt, 0x9be04a, 4, 3, { y:g.position.y + 1.2, life:0.5, size:0.4, grav:-6, drag:2, up:3 }); scene.remove(g); }
    M.pr.length = 0; finish(M, 'won', now, 'ev_pows_ok', n + ' tù binh cầm súng theo anh · +' + P.score + ' điểm'); return; }
  for(let i = 0; i < M.men.length; i++){ const e = M.men[i]; if((e.pos.x - M.ex) ** 2 + (e.pos.z - M.ez) ** 2 < P.exitR * P.exitR){ powsGone(M); finish(M, 'lost', now, 'ev_pows_lost', 'Tốp áp giải đã ra khỏi trận'); return; } } }
function powsGone(M){ for(let i = 0; i < M.pr.length; i++){ const g = M.pr[i]; if(inCamView(g.position.x, g.position.z)){ soldierKneel(g, true); keep(g); } else scene.remove(g); } M.pr.length = 0; }   // EVENT 4 (in the frame they stay, on one knee, until the stage ends: nobody vanishes in plain sight)

const START = { pilot:startPilot, truck:startTruck, pows:startPows }, FRAME = { pilot:pilotFrame, truck:truckFrame, pows:powsFrame }, TICK = { pilot:pilotTick, truck:truckTick, pows:powsTick };
// the timer ran out: the pilot stays hidden where he is, the truck stays bogged, the escort gets away
function expire(M, now){ if(M.kind === 'pilot'){ pilotGone(M, false); finish(M, 'expired', now, 'ev_side_gone', 'Hết giờ — không ai tới kịp'); }
  else if(M.kind === 'truck'){ truckLeft(M, 'keep'); finish(M, 'expired', now, 'ev_side_gone', 'Hết giờ — xe vẫn sa lầy'); }
  else { powsGone(M); finish(M, 'expired', now, 'ev_pows_lost', 'Hết giờ — tốp áp giải đã đi xa'); } }
// what a mission left on the field: the freed truck drives off (gone once out of the frame), a burnt one smokes for a while
function propsFrame(dt){ const L = SIDEM.props;
  for(let i = L.length - 1; i >= 0; i--){ const q = L[i]; if(q.kind === 'keep') continue; q.t += dt; q.pe += dt;
    if(q.kind === 'drive'){ q.v = Math.min(q.sp, q.v + dt * 3); q.x += Math.sin(q.a) * q.v * dt; q.z += Math.cos(q.a) * q.v * dt; const gy = heightAt(q.x, q.z); q.g.position.set(q.x, gy, q.z); q.g.rotation.set(0, q.a, 0);
      if(q.pe > 0.08){ q.pe = 0; spawnPart(q.x - Math.sin(q.a) * 3.5, gy + 0.3, q.z - Math.cos(q.a) * 3.5, 0, 0.8, 0, O_DUST); }
      if(q.t > 2.5 && !inCamView(q.x, q.z) || q.t > q.life * 2){ scene.remove(q.g); L.splice(i, 1); } }
    else if(q.t < q.life && q.pe > 0.22){ q.pe = 0; const gy = heightAt(q.x, q.z); spawnPart(q.x + (Math.random() - 0.5) * 2, gy + 1.8, q.z + (Math.random() - 0.5) * 2, 0.3, 2.2, 0.2, O_SMOKE); if(Math.random() < 0.5) spawnPart(q.x + (Math.random() - 0.5) * 2, gy + 1.2, q.z + (Math.random() - 0.5) * 2, 0, 1.4, 0, O_FIRE); } } }

// ---- the offer, the frame, the resets ----
// a mission of this kind begins now (dev / probes call it too: whatever is in hand is dropped first). false: it found no place for itself
export function sideMissionStart(kind, now){ if(!START[kind] || !S.player) return false; if(SIDEM.cur){ cleanup(SIDEM.cur); SIDEM.cur = null; markOff(); }
  const M = START[kind](now); if(!M) return false; SIDEM.cur = M; SIDEM.last = kind; SIDEM.done++; SIDEM.stats.offered++; SIDEM.tickAt = 0; SIDEM.lives = S.player.lives; note(kind + ' offered');
  const b = marker().badge.material; b.map = svgBadgeTex(VI[kind][1], '#7fd0ff'); b.needsUpdate = true; showBanner('NHIỆM VỤ PHỤ: ' + VI[kind][0], '#7fd0ff'); say('ev_' + kind, true); card(M); return true; }
function offer(now){ let tot = 0, r = 0; for(const k in START) if(S.stage >= (C.from[k] || 1) && k !== SIDEM.last && C.w[k] > 0) tot += C.w[k];
  r = Math.random() * tot; for(const k in START){ if(S.stage < (C.from[k] || 1) || k === SIDEM.last || !(C.w[k] > 0)) continue; r -= C.w[k]; if(r <= 0){ if(!sideMissionStart(k, now)) SIDEM.wait = C.retry; return; } }
  SIDEM.wait = C.retry; }
// once a frame in battle (game/loop.js)
export function updateSideMissions(dt, now){ const p = S.player; if(!SIDEM.on || !p) return;
  if(S.awaitingUpgrade){ clearSideMissions(); SIDEM.on = false; return; }                                             // the stage is won: everything of ours leaves the field
  if(SIDEM.props.length) propsFrame(dt);
  const M = SIDEM.cur, died = p.lives < SIDEM.lives; SIDEM.lives = p.lives;
  if(!M){ if(UNDER.on || S.stage < C.fromStage || SIDEM.done >= C.perStage || (SIDEM.wait -= dt) > 0) return; if(BIGEV.cur || !dirOfferOk(now)){ SIDEM.wait = C.retry; return; } offer(now); return; }
  if(died && M.state === 'go'){ finish(M, 'aborted', now, '', 'Huỷ'); cleanup(M); SIDEM.cur = null; card(null); return; }   // a life lost: the mission in hand is over
  if(M.state !== 'go'){ if(M.strike > 0 && (M.strike -= dt) <= 0 && enemies.length) callStrike(); if((M.endT -= dt) <= 0){ cleanup(M); SIDEM.cur = null; card(null); } return; }
  M.t -= dt; FRAME[M.kind](M, dt, now); markAt(M, now);
  if((SIDEM.tickAt -= dt) > 0) return; SIDEM.tickAt = C.tick; TICK[M.kind](M, C.tick, now); if(M.state === 'go' && M.t <= 0) expire(M, now); card(M); }
// nothing of the side missions left on the field (a restart, the menu, the stage won)
export function clearSideMissions(){ if(SIDEM.cur){ cleanup(SIDEM.cur); SIDEM.cur = null; } const L = SIDEM.props; for(let i = 0; i < L.length; i++){ scene.remove(L[i].g); unblock(L[i].blk); } L.length = 0;
  if(_air) _air.visible = false; markOff(); card(null); }
// a stage begins (ui/briefing.js goLive)
export function sideMissionsReset(now){ const st = SIDEM.stats; clearSideMissions(); for(const k in st) st[k] = 0; SIDEM.log.length = 0;
  SIDEM.on = C.on && !OFF; SIDEM.wait = R2(C.first); SIDEM.done = 0; SIDEM.last = ''; SIDEM.tickAt = 0; SIDEM.lives = S.player ? S.player.lives : -1; }
// EVENT 3 dev / probes: what of the side missions is on show right now (after clearSideMissions: nothing)
export function sideMissionsShown(){ return { cur:SIDEM.cur ? SIDEM.cur.kind : '', props:SIDEM.props.length, marker:!!(_mk && _mk.ring.visible), air:!!(_air && _air.visible), card:!!(_el && !_el.el.classList.contains('hidden')) }; }
// the minimap's mark (ui/radar.js): a pulsing blue ring and a cross where the mission is; the prisoners' way out as a small cross
export function radarSide(c, toX, toY){ const M = SIDEM.cur; if(!M || M.state !== 'go') return; const x = toX(M.x), y = toY(M.z); c.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 170); c.strokeStyle = '#7fd0ff'; c.lineWidth = 1.6;
  c.beginPath(); c.arc(x, y, 5.5, 0, 6.283); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.moveTo(x, y - 3); c.lineTo(x, y + 3); c.stroke();
  if(M.kind === 'pows'){ const ex = toX(M.ex), ey = toY(M.ez); c.beginPath(); c.moveTo(ex - 3, ey - 3); c.lineTo(ex + 3, ey + 3); c.moveTo(ex + 3, ey - 3); c.lineTo(ex - 3, ey + 3); c.stroke(); }
  c.globalAlpha = 1; }
