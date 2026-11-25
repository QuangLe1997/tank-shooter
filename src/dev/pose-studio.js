// dev/pose-studio.js — Z349 THE POSE STUDIO: calibrate and judge how a soldier holds each of his weapons — for every new soldier model and every
//   regenerated gun model (Meshy / Tripo) — without hand-made test scripts. In the page it is window.poseStudio:
//     await poseStudio.start({ trooper:'s2' })   a quiet desert battle by day: no enemies, the soldier off his horse, aiming toward the sun (front lit)
//     await poseStudio.equip('t_sniper')         the weapon in his hands (an id of GUNS with trooper:true; poseStudio.guns() lists them)
//     await poseStudio.stance('crouch')          stand · crouch (kneel) · prone · mount (back on the horse / ride) — and waits for it to settle
//     poseStudio.measure()                       each palm to the gun's surface (cm), each arm's stretch (share of its length), the flags
//     await poseStudio.view('handsL')            the camera on a named view (POSE_STUDIO.views), the game paused, rendered at 2× — poseStudio.resume()
//     poseStudio.aim(bearing)                    aim (and turn the named views) along a bearing — e.g. ahead of his ride
//     poseStudio.suggest('lmg')                  the hold read off a gun model (actors/gun-fit.js fitHold) beside its hand-set GUNHOLD — for a new gun
//     poseStudio.sheet('lmg')                    Z360 its fit sheet: the gun side on with what the fit found drawn over it (a PNG data URL)
//     poseStudio.kick() / reloadAt(0.5) / carry(true)   Z360 a shot's recoil at its peak · the reload frozen part way (0…1) · the sprint carry (port arms)
//   tools/pose-studio.mjs drives it headless: every soldier × weapon × view → PNGs + report.json + report.html (failures in red).
//   Nothing in the game calls it.
import * as THREE from 'three';
import { GUNFEEL, GUNFIT, GUNHOLD, INFGUN, POSE_STUDIO } from '../../config.js';
import { BIOMES, CV, FIT, GUNKICK, GUNS, eyePoint, triggerAt, wristBend, PROFILE, S, boreOf, fitHold, sideProfile, underAt, TROOP_BATCH, WAVE, camera, cavStance, cavToggleMount, composer, doResize, enemies, heightAt, launchGame, renderer, scene, trooperGive } from '../hub.js';

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
  // Z360 how far the gun was dragged off his shoulder pocket for the left hand to reach it (cm: his arm too short for where the palm goes, even slid
  //   back along the handguard — the stock then goes into his shoulder), how far the palm slid back (fitted weapons), the muzzle the rounds leave from
  //   against the model's own bore at its tip (cm), and what the hold is (fitted off the model, or hand-set) with the parts found
  const G = GUNFIT.ok; out.pull = cm(R.pull || 0); if(out.pull > G.pull) out.notes.push(`súng bị kéo khỏi vai ${out.pull} cm (tay trái không với tới)`);
  if(met){ const L = met.userData.len, rows = sideProfile(met, L).filter(r => r.lo != null).slice(0, 2), bore = rows.length ? boreOf(rows, (INFGUN.guns[R.armK] || {}).bore) : 0;   // (Z390 the gun's own bore rule)
    out.muzzle = cm(Math.abs((met.userData.muzzle || [0, 0])[1] - bore)); if(out.muzzle > G.muzzle) out.notes.push(`điểm bắn lệch đầu nòng ${out.muzzle} cm`);
    const f = met.userData.fit, K = GUNKICK[R.armK]; if(K){ out.kick = K.kick; out.shake = K.shake; } out.hold = FIT[R.armK] ? 'fit' : 'tay'; if(FIT[R.armK]) out.slide = cm(R.pslide || 0); if(f) out.parts = f.parts;
    out.fitted = f ? { palm:f.palm, slideTo:f.slideTo, grip:f.grip, butt:f.butt, sightX:f.sightX, bore:f.bore } : null; out.set = GUNHOLD[R.armK] || null; }
  // GUN 1 held to his joints (actors/gun-hands.js): the index fingertip to the trigger (cm), each wrist's bend (deg), the right eye off the sight line [over, to its left] (cm)
  { const K = GUNFEEL.hold.ok, g = FIT[R.armK] || GUNHOLD[R.armK], L = met && met.userData.len, tip = D.RightHandIndex4 || D.RightHandIndex3;
    if(met && g && tip){ met.updateWorldMatrix(true, false); const t = triggerAt(g, L); out.trig = cm(met.localToWorld(V3().set(t[0] * L, t[1], 0)).distanceTo(W(tip))); if(!CV.mounted && out.trig > K.trig) out.notes.push(`ngón trỏ cách cò ${out.trig} cm`); }
    out.wristL = Math.round(wristBend(D, 'Left') * 57.3); out.wristR = Math.round(wristBend(D, 'Right') * 57.3); if(!CV.mounted) for(const [s, v] of [['trái', out.wristL], ['phải', out.wristR]]) if(v > K.wrist) out.notes.push(`cổ tay ${s} gập ${v}°`);
    if(met && g && !g.hold && met.userData.sight != null && D.Head){ const f = V3().setFromMatrixColumn(met.matrixWorld, 0).negate().setY(0).normalize(), e = met.worldToLocal(eyePoint(D, GUNHOLD.cheek.eye, V3().set(0, 1, 0), f, V3()));
      out.eye = [cm(e.y - met.userData.sight), cm(e.z)]; if(!CV.mounted && Math.hypot(out.eye[0], out.eye[1]) > K.eye) out.notes.push(`mắt lệch đường ngắm ${out.eye[0]} / ${out.eye[1]} cm`); }
    if(!CV.mounted) for(const [s, v] of [['trái', out.stretchL], ['phải', out.stretchR]]) if(v > K.stretch && v <= Q.stretch) out.notes.push(`tay ${s} duỗi ${Math.round(v * 100)} %`); }
  out.ok = !out.notes.length; return out; }

// ---- the camera on a named view (relative to where he aims: side − = his left), paused, at 2× ----
async function view(name){ const v = POSE_STUDIO.views[name]; if(!v) throw new Error('poseStudio: no view ' + name); const D = CV.real.pup.D, p = S.player.pos;
  const t = v.on === 'handL' ? W2(D.LeftHand) : v.on === 'handR' ? W2(D.RightHand) : v.on === 'hips' ? W2(D.Hips) : V3().set(p.x, heightAt(p.x, p.z), p.z);
  if(S.mode !== 'paused'){ ST.was = S.mode; ST.dpr = S.dpr; } S.mode = 'paused'; document.querySelectorAll('.overlay').forEach(o => { o.classList.add('hidden'); o.style.visibility = 'hidden'; });
  const a = ST.b + v.side; camera.position.set(t.x + Math.sin(a) * v.dist, t.y + v.up, t.z + Math.cos(a) * v.dist); camera.lookAt(t.x, t.y + v.look, t.z);
  S.dpr = 2; renderer.setPixelRatio(2); if(composer.setPixelRatio) composer.setPixelRatio(2); doResize(true); await frames(3); return name; }
const W2 = b => b.getWorldPosition(V3());
function resume(){ S.dpr = ST.dpr; renderer.setPixelRatio(S.dpr); if(composer.setPixelRatio) composer.setPixelRatio(S.dpr); doResize(true); S.mode = ST.was || 'playing'; document.querySelectorAll('.overlay').forEach(o => { if(o.id !== 'nick') o.style.visibility = ''; }); }

// ---- Z360 the hold read off a gun model (actors/gun-fit.js) beside the hand-set one ----
function suggest(kind){ const R = CV.real, k = kind || (R && R.armK), met = R && R.arms._metric && R.arms._metric[k]; if(!met) return null; const len = met.userData.len, f = fitHold(sideProfile(met, len), len, { bore:(INFGUN.guns[k] || {}).bore, gripAt:(INFGUN.guns[k] || {}).gripAt });
  return { kind:k, len, fit:f && Object.assign({}, f, { rows:undefined }), rows:f && f.rows, now:GUNHOLD[k] || null, held:FIT[k] ? 'fit' : 'tay' }; }
// ---- Z360 THE FIT SHEET: the gun alone, side on, true size (muzzle left), and over it what the fit read off it — the outline it measured (cyan), the
//   bore, each part it found (pistol grip orange, magazine blue, foregrip violet, stock grey), the right hand (red), the left palm (green) and how far back
//   along the handguard it may slide for a short arm (hollow green), the butt's contact (magenta), the sight (yellow); the hand-set GUNHOLD as hollow
//   marks where the gun is still held by hand. A new gun model is checked against it at a glance, before any soldier holds it
let _sr = null;
function sheet(kind){ const R = CV.real, k = kind || (R && R.armK), met = R && R.arms._metric && R.arms._metric[k]; if(!met) return null; const len = met.userData.len, f = fitHold(sideProfile(met, len), len, { bore:(INFGUN.guns[k] || {}).bore, gripAt:(INFGUN.guns[k] || {}).gripAt }); if(!f) return null;
  const W = 1200, pxm = W / (len * 1.1), top = 0.26, bot = -0.3, H = Math.round((top - bot) * pxm), X = s => (s * len + len * 0.55) * pxm, Y = y => (top - y) * pxm, gap = GUNHOLD.palmGap;
  if(!_sr) _sr = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true }); _sr.setPixelRatio(1); _sr.setSize(W, H, false);
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-len * 0.55, len * 0.55, top, bot, 0.01, 10); cam.position.set(0, 0, 3); cam.lookAt(0, 0, 0);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x505050, 2.4)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(0.4, 1, 1.2); sc.add(dl);
  const g = met.children[0].clone(true); sc.add(g); _sr.render(sc, cam); sc.remove(g);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H + 70; const c = cv.getContext('2d'); c.fillStyle = '#1d1f22'; c.fillRect(0, 0, W, H + 70); c.drawImage(_sr.domElement, 0, 0);
  c.font = '15px system-ui'; c.lineWidth = 1; c.strokeStyle = '#3a3f46'; c.fillStyle = '#8a929c'; c.setLineDash([4, 6]);
  for(let s = -5; s <= 5; s++){ const x = X(s / 10); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); c.fillText((s / 10).toFixed(1), x - 12, H + 18); }
  c.setLineDash([]); const N = f.rows.length, rx = i => X(-0.5 + (i + 0.5) / N);
  for(const [j, col] of [[0, '#3fd0e0'], [1, '#2a8f9a']]){ c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); let on = false; f.rows.forEach((r, i) => { if(!r){ on = false; return; } const y = Y(r[j]); if(on) c.lineTo(rx(i), y); else { c.moveTo(rx(i), y); on = true; } }); c.stroke(); }
  c.strokeStyle = '#ffffff'; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(0, Y(f.bore)); c.lineTo(W, Y(f.bore)); c.stroke(); c.setLineDash([]);
  const box = (sp, col, name) => { if(!sp) return; const i0 = Math.round((sp[0] + 0.5) * N - 0.5), i1 = Math.round((sp[1] + 0.5) * N - 0.5); let lo = Infinity; for(let i = i0; i <= i1; i++) if(f.rows[i]) lo = Math.min(lo, f.rows[i][0]);
    const x0 = X(sp[0] - 0.5 / N), x1 = X(sp[1] + 0.5 / N); c.fillStyle = col + '40'; c.fillRect(x0, Y(f.bore), x1 - x0, Y(lo) - Y(f.bore)); c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(x0, Y(f.bore), x1 - x0, Y(lo) - Y(f.bore)); c.fillStyle = col; c.fillText(name, x0 + 3, Y(lo) + 17); };
  box(f.parts.grip, '#ff9a3c', 'BÁNG TAY CẦM'); box(f.parts.mag, '#4c9dff', 'HỘP ĐẠN'); box(f.parts.vfg, '#b47cff', 'TAY CẦM TRƯỚC'); box(f.parts.stock, '#9aa3ad', 'BÁNG VAI');
  const dot = (x, y, col, name, hollow, dy = -14) => { c.beginPath(); c.arc(X(x), Y(y), 9, 0, Math.PI * 2); c.lineWidth = 3; if(hollow){ c.strokeStyle = col; c.stroke(); } else { c.fillStyle = col; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke(); } if(name){ c.fillStyle = col; c.fillText(name, X(x) - 30, Y(y) + dy); } };
  const pY = x => underAt(f, x) - gap; c.strokeStyle = '#43d17a'; c.lineWidth = 4; c.beginPath(); c.moveTo(X(f.palm), Y(pY(f.palm)) + 16); c.lineTo(X(f.slideTo), Y(pY(f.slideTo)) + 16); c.stroke();
  dot(f.slideTo, pY(f.slideTo), '#43d17a', 'trượt tới', true, 34); dot(f.palm, pY(f.palm), '#43d17a', 'TAY TRÁI', false, 34); dot(f.grip[0], f.grip[1], '#ff4d4d', 'TAY PHẢI', false, 30);
  dot(0.5 - 0.012, f.butt[1], '#ff4dd2', 'BÁNG', false); dot(-0.5 + 0.012, f.bore, '#ffffff', 'NÒNG', false);
  { const m = f.mag, b = f.bolt; c.fillStyle = '#7fd4ff'; c.fillRect(X(m[0]) - 6, Y(m[1]) - 6, 12, 12); c.fillText('NẠP', X(m[0]) + 9, Y(m[1]) + 5); c.fillStyle = '#c9f27a'; c.fillRect(X(b[0]) - 6, Y(b[1]) - 6, 12, 12); c.fillText(f.magDrop ? 'KÉO KHÓA' : 'KÉO ỐP', X(b[0]) + 9, Y(b[1]) - 8); }
  { const i = Math.round((f.sightX + 0.5) * N - 0.5), r = f.rows[i]; if(r){ const x = X(f.sightX), y = Y(r[1]); c.fillStyle = '#ffd84d'; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x - 9, y - 18); c.lineTo(x + 9, y - 18); c.fill(); c.fillText('NGẮM', x - 20, y - 22); } }
  const set = GUNHOLD[k]; if(set && !FIT[k]){ dot(set.grip[0], set.grip[1], '#ff4d4d', '', true); if(set.palm != null) dot(set.palm, pY(set.palm), '#43d17a', '', true); }
  c.fillStyle = '#e8e8e8'; c.font = '600 17px system-ui'; c.fillText(`${k} · dài ${len} m · đang cầm theo: ${FIT[k] ? 'CÔNG THỨC' : 'SỐ CHỈNH TAY (vòng rỗng)'}`, 12, H + 44);
  const K = GUNKICK[k] || {}; c.font = '14px system-ui'; c.fillStyle = '#aab'; c.fillText(`nòng y ${f.bore} · tay phải [${f.grip}] · tay trái ${f.palm} (trượt tới ${f.slideTo}) · báng y ${f.butt[1]} · ngắm x ${f.sightX} · giật ${K.kick ? `${Math.round(K.kick[0] * 1000)} mm, ngóc ${(K.kick[1] * 57.3).toFixed(1)}°, rung ±${(K.shake[0] * 57.3).toFixed(1)}° / lăn ±${(K.shake[1] * 57.3).toFixed(1)}°` : '?'}`, 12, H + 64);
  return cv.toDataURL('image/png'); }

// ---- Z360 the actions, frozen to look at: a shot (its kick at the peak), the reload part way through, the sprint carry ----
async function kick(){ const p = S.player; p.fireAt = performance.now() / 1000 + 0.3; await wait(45); return GUNKICK[CV.real.armK] || null; }
async function reloadAt(t){ const p = S.player, inst = p.guns[p.gunIdx], D = Math.max(GUNHOLD.reload.min + 0.6, 2.4); inst.rD = D; inst.rU = performance.now() / 1000 + (1 - t) * D; await frames(3); return t; }
function reloadEnd(){ const inst = S.player.guns[S.player.gunIdx]; inst.rU = 0; }
async function carry(on){ CV.real.sprDev = on ? true : null; await wait(on ? 900 : 600); return on; }
// the bearing he aims along (rad; the views turn with it) — e.g. straight ahead of his ride
function aim(bearing){ ST.b = bearing; return bearing; }
export const poseStudio = { start, guns, equip, stance, measure, view, resume, suggest, sheet, aim, kick, reloadAt, reloadEnd, carry };
if(typeof window !== 'undefined') window.poseStudio = poseStudio;
