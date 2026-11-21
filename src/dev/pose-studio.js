// dev/pose-studio.js — Z349 THE POSE STUDIO: calibrate and judge how a soldier holds each of his weapons — for every new soldier model and every
//   regenerated gun model (Meshy / Tripo) — without hand-made test scripts. In the page it is window.poseStudio:
//     await poseStudio.start({ trooper:'s2' })   a quiet desert battle by day: no enemies, the soldier off his horse, aiming toward the sun (front lit)
//     await poseStudio.equip('t_sniper')         the weapon in his hands (an id of GUNS with trooper:true; poseStudio.guns() lists them)
//     await poseStudio.stance('crouch')          stand · crouch (kneel) · prone · mount (back on the horse / ride) — and waits for it to settle
//     poseStudio.measure()                       each palm to the gun's surface (cm), each arm's stretch (share of its length), the flags
//     await poseStudio.view('handsL')            the camera on a named view (POSE_STUDIO.views), the game paused, rendered at 2× — poseStudio.resume()
//     poseStudio.suggest('lmg')                  a gun model's side profile and the GUNHOLD numbers it suggests (butt, grip, palm) — for a new gun
//   tools/pose-studio.mjs drives it headless: every soldier × weapon × view → PNGs + report.json + report.html (failures in red).
//   Nothing in the game calls it.
import * as THREE from 'three';
import { GUNHOLD, POSE_STUDIO } from '../../config.js';
import { BIOMES, CV, GUNS, PROFILE, S, TROOP_BATCH, WAVE, camera, cavStance, cavToggleMount, composer, doResize, enemies, heightAt, launchGame, renderer, scene, trooperGive } from '../hub.js';

const ST = { b:0, aimT:0, quietT:0, dpr:1, was:'playing' }, V3 = () => new THREE.Vector3();
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 60000){ const t0 = performance.now(); while(!fn()){ if(performance.now() - t0 > ms) throw new Error('poseStudio: timed out'); await wait(80); } }
const frames = n => new Promise(r => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });

// ---- a quiet battle with the soldier in it ----
async function start(o = {}){ PROFILE.introSeen = Object.assign(PROFILE.introSeen || {}, { DESERT:1 }); PROFILE.unit = o.unit || 'cav'; PROFILE.trooper = o.trooper || 's2'; PROFILE.nick = PROFILE.nick || 'STUDIO'; PROFILE.quality = 'high';
  launchGame({ mode:'custom', biome:BIOMES.findIndex(b => b.name === (o.biome || 'DESERT')), tod:'day', wx:'clear', space:'wide', level:1 });
  await until(() => ['briefing', 'playing', 'countdown'].includes(S.mode));
  for(let i = 0; i < 2; i++){ S.mode = 'playing'; for(const id of ['briefing', 'boot', 'start']){ const e = document.getElementById(id); if(e){ e.classList.add('hidden'); if(id === 'boot') e.style.display = 'none'; } } await wait(1500); }
  await until(() => CV.real && CV.real.pup);
  const p = S.player; p.invincibleUntil = 1e9; p.infiniteAmmo = true;
  clearInterval(ST.quietT); ST.quietT = setInterval(() => { for(const e of enemies) e.mesh.visible = false; enemies.length = 0; WAVE.betweenUntil = 1e12; WAVE.spawnQueue.length = 0; for(const t of TROOP_BATCH.roots) if(t !== CV.G) t.visible = false; }, 200);
  document.querySelectorAll('#hud, .hud, #radar, #minimap, #nick, #rideCall').forEach(e => { e.style.visibility = 'hidden'; });   // (and the first-launch nickname card: it fades in late)
  if(!o.mounted){ await dismount(); CV.H.root.visible = false; CV.hPos.x += 30; }
  let sun = null; scene.traverse(x => { if(!sun && x.isDirectionalLight && x.castShadow) sun = x; }); const d = sun ? sun.position.clone().sub(sun.target.position) : V3().set(0, 1, 1); ST.b = Math.atan2(d.x, d.z);
  S.pointerActive = true; S.firing = false; clearInterval(ST.aimT); ST.aimT = setInterval(() => S.aimPoint.set(p.pos.x + Math.sin(ST.b) * 14, 0, p.pos.z + Math.cos(ST.b) * 14), 30);
  return { trooper:PROFILE.trooper, sun:ST.b }; }
async function dismount(){ if(CV.mounted && !CV.trans) cavToggleMount(); await until(() => !CV.mounted && !CV.trans, 15000); }
// every weapon the soldier can carry
function guns(){ return Object.keys(GUNS).filter(id => GUNS[id].trooper); }
async function equip(id){ const p = S.player; if(!p.guns.find(g => g.id === id)) trooperGive(id); p.gunIdx = p.guns.findIndex(g => g.id === id); if(p.gunIdx < 0) throw new Error('poseStudio: no weapon ' + id); await wait(POSE_STUDIO.settle.equip * 1000); return id; }
async function stance(s){ const T = POSE_STUDIO.settle;
  if(s === 'mount'){ if(!CV.mounted){ const p = S.player, f = CV.facing = ST.b - 1.2; CV.H.root.visible = true; CV.hPos.set(p.pos.x - Math.cos(f) * 2.4, 0, p.pos.z + Math.sin(f) * 2.4); await wait(300); cavToggleMount(); await until(() => CV.mounted && !CV.trans, 20000); } }
  else { if(CV.mounted){ await dismount(); CV.H.root.visible = false; CV.hPos.x += 30; } if(CV.stance !== s) cavStance(s); }
  await wait((T[s] || T.stand) * 1000); return s; }

// ---- how the hands sit on the gun ----
const _tri = new THREE.Triangle(), _cp = V3(), _a = V3(), _b = V3(), _c = V3();
function surfaceDist(obj, pt){ let best = Infinity; obj.updateWorldMatrix(true, true);
  obj.traverse(m => { if(!m.isMesh || !m.visible) return; const P = m.geometry.attributes.position, I = m.geometry.index, n = I ? I.count : P.count, M = m.matrixWorld;
    for(let i = 0; i < n; i += 3){ const ia = I ? I.getX(i) : i, ib = I ? I.getX(i + 1) : i + 1, ic = I ? I.getX(i + 2) : i + 2;
      _tri.set(_a.fromBufferAttribute(P, ia).applyMatrix4(M), _b.fromBufferAttribute(P, ib).applyMatrix4(M), _c.fromBufferAttribute(P, ic).applyMatrix4(M)); _tri.closestPointToPoint(pt, _cp); const d = _cp.distanceTo(pt); if(d < best) best = d; } });
  return best; }
function measure(){ const R = CV.real, D = R && R.pup && R.pup.D; if(!D) return null; const met = R.arms._metric && R.arms._metric[R.armK], W = b => b.getWorldPosition(V3()), Q = POSE_STUDIO.ok;
  const palm = s => { const h = W(D[s + 'Hand']), m = D[s + 'HandMiddle1']; return m ? h.lerp(W(m), 0.55) : h; };
  const stretch = s => { const a = W(D[s + 'Arm']), f = W(D[s + 'ForeArm']), h = W(D[s + 'Hand']); return a.distanceTo(h) / (a.distanceTo(f) + f.distanceTo(h)); };
  const cm = x => Math.round(x * 1000) / 10, out = { gun:S.player.guns[S.player.gunIdx].id, kind:R.armK, len:met ? +met.userData.len.toFixed(2) : null, stance:CV.mounted ? 'mount' : CV.stance,
    palmL:met ? cm(surfaceDist(met, palm('Left'))) : null, palmR:met ? cm(surfaceDist(met, palm('Right'))) : null, stretchL:+stretch('Left').toFixed(3), stretchR:+stretch('Right').toFixed(3), notes:[] };
  if(out.palmL > Q.palm) out.notes.push(`tay trái cách súng ${out.palmL} cm`); if(out.palmR > Q.palm) out.notes.push(`tay phải cách súng ${out.palmR} cm`);
  if(out.stretchL > Q.stretch) out.notes.push('tay trái duỗi hết cỡ'); if(out.stretchR > Q.stretch) out.notes.push('tay phải duỗi hết cỡ');
  out.ok = !out.notes.length; return out; }

// ---- the camera on a named view (relative to where he aims: side − = his left), paused, at 2× ----
async function view(name){ const v = POSE_STUDIO.views[name]; if(!v) throw new Error('poseStudio: no view ' + name); const D = CV.real.pup.D, p = S.player.pos;
  const t = v.on === 'handL' ? W2(D.LeftHand) : v.on === 'handR' ? W2(D.RightHand) : v.on === 'hips' ? W2(D.Hips) : V3().set(p.x, heightAt(p.x, p.z), p.z);
  if(S.mode !== 'paused'){ ST.was = S.mode; ST.dpr = S.dpr; } S.mode = 'paused'; document.querySelectorAll('.overlay').forEach(o => { o.classList.add('hidden'); o.style.visibility = 'hidden'; });
  const a = ST.b + v.side; camera.position.set(t.x + Math.sin(a) * v.dist, t.y + v.up, t.z + Math.cos(a) * v.dist); camera.lookAt(t.x, t.y + v.look, t.z);
  S.dpr = 2; renderer.setPixelRatio(2); if(composer.setPixelRatio) composer.setPixelRatio(2); doResize(true); await frames(3); return name; }
const W2 = b => b.getWorldPosition(V3());
function resume(){ S.dpr = ST.dpr; renderer.setPixelRatio(S.dpr); if(composer.setPixelRatio) composer.setPixelRatio(S.dpr); doResize(true); S.mode = ST.was || 'playing'; document.querySelectorAll('.overlay').forEach(o => { if(o.id !== 'nick') o.style.visibility = ''; }); }

// ---- a gun model's side profile (in the hold's frame: x along it as a share of its length, + toward the butt; y up, m) and the GUNHOLD it suggests:
//   the magazine = the deepest drop round the middle, the pistol grip = the deepest drop behind it, the support palm = just ahead of the magazine,
//   the butt = the back end. A starting point to look at in the studio, not a verdict.
function suggest(kind){ const R = CV.real, met = R && R.arms._metric && R.arms._metric[kind || R.armK]; if(!met) return null; const len = met.userData.len, vs = []; met.updateWorldMatrix(true, true); const inv = met.matrixWorld.clone().invert();
  met.traverse(m => { if(!m.isMesh) return; const P = m.geometry.attributes.position; for(let i = 0; i < P.count; i++) vs.push(V3().fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv)); });
  const N = 40, rows = []; for(let k = 0; k < N; k++){ const x0 = -0.5 + k / N, x1 = x0 + 1 / N; let lo = Infinity, hi = -Infinity; for(const v of vs){ const x = v.x / len; if(x >= x0 && x < x1){ lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } } rows.push({ x:+(x0 + 0.5 / N).toFixed(3), lo:isFinite(lo) ? +lo.toFixed(3) : null, hi:isFinite(hi) ? +hi.toFixed(3) : null }); }
  const has = r => r.lo != null, deep = (a, b) => rows.filter(r => has(r) && r.x >= a && r.x <= b).sort((p, q) => p.lo - q.lo)[0] || null;
  const mag = deep(-0.2, 0.15), grip = mag ? deep(mag.x + 0.08, 0.42) : deep(0.05, 0.42), bore = rows.filter(r => has(r) && r.x < -0.2).map(r => (r.lo + r.hi) / 2).sort((p, q) => p - q);
  const guard = mag ? rows.filter(r => has(r) && r.x < mag.x - 0.05 && r.x > mag.x - 0.3 && r.lo > mag.lo + 0.06).sort((p, q) => q.x - p.x)[0] : null;
  return { kind:kind || R.armK, len, rows, now:GUNHOLD[kind || R.armK] || null,
    suggest:{ butt:[0.5, bore.length ? +bore[bore.length >> 1].toFixed(3) : 0], grip:grip ? [+(grip.x - 0.03).toFixed(3), +(grip.lo * 0.6).toFixed(3)] : null, palm:guard ? +(guard.x - 0.04).toFixed(3) : null, magazine:mag ? mag.x : null } }; }

export const poseStudio = { start, guns, equip, stance, measure, view, resume, suggest };
if(typeof window !== 'undefined') window.poseStudio = poseStudio;
