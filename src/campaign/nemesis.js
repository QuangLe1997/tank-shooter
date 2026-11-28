// campaign/nemesis.js — NEMESIS 1–3 THE ENEMY GENERAL REMEMBERS YOU (config.js NEMESIS; the record, its sanitiser and the rules are data/nemesis-mem.js, pure).
//   THE MEMORY: PROFILE.nemesis, a record a general — times he met the player, killed him, got away, fell; how the player last put him down; his scar, his
//     lessons, his rank. Read through mem(): whatever sits in the profile (an old save, a cloud copy that replaced it) is cleaned before it is believed.
//   HE CAN GET AWAY (nemSlip, asked by actors/damage.js killEnemy when the duel's general would die): a roll — once a general a campaign loop, never on the
//     last stage, never on the easy setting, never in a custom battle — and he does not die: smoke, a run for the field's edge behind him (nemFleeStep, his
//     whole behaviour while he runs: actors/infantry.js), his guns left on the ground. The duel (campaign/general-duel.js) sees him run and still calls the
//     stage won; the banner and the epilogue's first line say he slipped away. He is AT LARGE: at the next duel that is not his own he comes out beside
//     that stage's general when the guards are called (nemJoin) — in this loop or the next. If that general falls first he leaves again, and may be shot as he goes.
//   HE COMES BACK DIFFERENT (nemTune: TROOPER.general as he fights by it; nemDress): a rank an escape — more health, quicker moves, tighter fire —, the scar
//     of what was done to him (his star and name plate in its colour, his kit tinted, a bandage hung on his rig by the kit's own anchors) and ONE lesson
//     against it, told by our commander beforehand: mobile (never stands, guards spread) · rush (closes behind smoke) · wall (two close-quarter guards in front).
//   HE REMEMBERS OUT LOUD: his lines by the player's call-sign and their history — first meeting, "you again" with the count, after he killed him, after he
//     got away, when the player dies to him (the radio, and the defeat screen on the last life), when he falls. They wait for N.say.gap s of silence on the
//     net (campaign/operations.js radio.at), so they never talk over the story's lines; a moment that cannot wait is said at once.
//   A KILL MARK a time he killed the player, and a star a rank, beside his name on the boss bar (nemPlateEl).
import * as THREE from 'three';
import { AWARE, NEMESIS, STORY, TROOPER } from '../../config.js';
import { BOSS_DEFS, BOSS_NEW, NEM_IDS, PROFILE, S, animateSoldier, armsDrop, clampField, clampFieldXZ, duelMan, enemies, enemyPool, fieldEdgePoint, floatText, freeEnemyBar, gainXp, heightAt, inCamView, inField, infPushBlocks, kitAttach, nemAdapt, nemAfterEscape, nemAfterFall, nemAfterKill, nemAfterMeet, nemBadge, nemBlankRec, nemCanEscape, nemClean, nemFill, nemGreet, nemHow, nemNick, nemPool, nemTitle, nemTuneOf, poseSoldier, radio, reviveSoldierMesh, saveProfile, sfx, showBanner, spawnEnemy, spawnPart, storyText, svgBadgeTex, throwSmoke } from '../hub.js';

const N = NEMESIS, NOW = () => performance.now() / 1000, FAR = -1e9, GOLD = '#ffd24a', SMOKE = '#e6e2d6';
// this duel (dev / probes read it): id, name = the stage's general · tune = TROOPER.general as he fights by it (null: as written) · e = the man · acts = the
//   lessons being played · wall = the close guards and whom they screen · gN = guards dressed · join = the general who came back beside him · hostGone ·
//   esc = the escape of this duel { id, name, stage, loop } · q = lines waiting for the radio · force (dev, kept over a reset): 'escape' / 'die'
export const NEM = { live:false, id:'', name:'', tune:null, e:null, acts:[], wall:[], gN:0, join:null, hostGone:false, esc:null, q:[], at:0, saidAt:FAR, deathLine:'', force:null, lastPool:null, lastI:-1, stats:{ said:0, dropped:0 } };
const WORN = [];                       // what a scar put on a man: { m, objs, tint } — taken off again whatever happens to him
let _mem = null, _geo = null, _mat = null;

// ---- the save ----
function mem(){ if(!_mem || PROFILE.nemesis !== _mem){ _mem = nemClean(PROFILE.nemesis); PROFILE.nemesis = _mem; } return _mem; }   // (not the object cleaned last: a first read, a cloud pull)
function peek(id){ return mem().g[id] || null; }
function recOf(id){ if(!NEM_IDS.includes(id)) return null; const g = mem().g; return g[id] || (g[id] = nemBlankRec()); }
function store(quiet){ mem(); saveProfile(quiet); }
const campaign = () => !!NEM.force || !(S.run && S.run.mode === 'custom');
const nameOf = id => { const d = BOSS_DEFS.find(b => b.id === id) || BOSS_NEW.find(b => b.id === id); return d ? d.name : String(id).toUpperCase(); };
const gunId = () => { const p = S.player, g = p && p.guns && p.guns[p.gunIdx]; return g ? g.id : ''; };
const distTo = e => { const p = S.player; return p && e ? Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) : 0; };

// ---- the words ----
function vars(name, rec){ return { nick:nemNick(PROFILE.nickname), name:nemTitle(name), n:rec ? Math.max(1, rec.met) : 1, k:rec ? rec.kills : 0, f:rec ? rec.fled : 0, r:rec ? rec.rank : 0 }; }
function text(pool, name, rec){ if(!pool || !pool.length) return ''; let i = (Math.random() * pool.length) | 0; if(pool.length > 1 && pool === NEM.lastPool && i === NEM.lastI) i = (i + 1) % pool.length;
  NEM.lastPool = pool; NEM.lastI = i; return storyText(nemFill(pool[i], vars(name, rec))); }
const his = (kind, id, name, rec) => text(nemPool(kind, id, Math.random()), name, rec);
// a line for the radio: at once (now0 — a moment that cannot wait), else in its turn. over: 'host' / 'join' — his shout of the call-sign floats over that man
function say(tag, txt, now0, over){ const R = NEM, now = S.timeNow || NOW(); if(!txt) return;
  if(now0){ radio(tag + ': ' + txt, STORY.noVoice); R.saidAt = now; R.stats.said++; return; }
  if(R.q.length >= N.say.queue){ R.stats.dropped++; return; } R.q.push({ msg:tag + ': ' + txt, from:now, until:now + N.say.hold, over:over || '' }); }
// the first line waiting: gap s after our own last one, and once the net has been quiet gap s — or, having waited `wait` s on a busy net, once the line
//   on the air is `cut` s old (the one test battle talked every 2–3 s: a greeting that only waited for silence was never said)
function flush(now){ const R = NEM, Y = N.say, it = R.q[0], quiet = now - (radio.at ?? FAR); if(now > it.until){ R.q.shift(); R.stats.dropped++; return; }
  if(now - R.saidAt < Y.gap || quiet < Y.gap && (now - it.from < Y.wait || quiet < Y.cut)) return;
  R.q.shift(); radio(it.msg, STORY.noVoice); R.saidAt = now; R.stats.said++; const e = it.over === 'join' ? R.join && R.join.e : it.over ? R.e : null;
  if(e && enemies.includes(e)) floatText(nemNick(PROFILE.nickname).toLocaleUpperCase('vi') + '!', '#ff9a4a', { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.7, z:e.pos.z }, 20); }

// ---- the duel begins (campaign/general-duel.js) ----
export function nemReset(){ const R = NEM; sweep(); stripMan(null); R.live = false; R.id = ''; R.name = ''; R.tune = null; R.e = null; R.acts.length = 0; R.wall.length = 0; R.gN = 0; R.join = null;
  R.hostGone = false; R.esc = null; R.q.length = 0; R.at = 0; R.saidAt = FAR; R.deathLine = ''; R.lastPool = null; R.lastI = -1; }
// generalStart: the meeting is counted, his greeting and our commander's word about his lesson wait for their turn on the radio
export function nemMeet(id, name){ const R = NEM; if(!N.on) return; const rec = recOf(id); if(!rec) return; const greet = nemGreet(rec), t = nemTuneOf(TROOPER.general, rec), ad = nemAdapt(rec);
  R.live = true; R.id = id; R.name = name; R.tune = t === TROOPER.general ? null : t; nemAfterMeet(rec); rec.out = 0; store(true);   // (his own stage: the man at large is back)
  say(name, his(greet, id, name, rec), false, 'host'); if(ad) say('SCH', text(N.say.hint[ad], name, rec)); }
export function nemTune(base){ return NEM.tune || base; }
// spawnGeneral, before his guards: what the years did to him
export function nemDress(e){ const R = NEM; if(!R.live || !e) return; const rec = peek(R.id); R.e = e; R.gN = 0; if(rec) wear(e, rec, R.tune, true); }
function wear(e, rec, tune, host){ const sc = rec.scar ? N.scar[rec.scar] : null, ad = nemAdapt(rec), A = N.adapt[ad];
  if(tune && tune.restK){ const F = AWARE.fire; e.def = { ...e.def, rest:[F.rest[0] * tune.restK, F.rest[1] * tune.restK], spreadK:(e.def.spreadK || 1) * tune.groupK }; }   // (the rifleman's own knobs: actors/infantry.js fireRound)
  if(sc) scarOn(e, sc);
  if(ad === 'mobile'){ e.def = { ...e.def, speed:e.def.speed * A.speed }; NEM.acts.push({ e, kind:ad, at:0, keep0:e.def.keep, k:0 }); }
  else if(ad === 'rush'){ e.def = { ...e.def, keep:A.keep, speed:e.def.speed * A.speed }; NEM.acts.push({ e, kind:ad, at:0, keep0:A.keep, k:0 }); }
  else if(ad === 'wall' && !host) for(let i = 0; i < A.n; i++){ const a = Math.random() * 6.283, [x, z] = clampFieldXZ(e.pos.x + Math.cos(a) * 3, e.pos.z + Math.sin(a) * 3, 4); closeMan(spawnEnemy('rifle', x, z), e); } }
// guards(): each of the duel's guards as it is made — the wall's two close men first, a spread-out guard each his own distance
export function nemGuard(g){ const R = NEM; if(!R.live || !R.e || !g) return; const ad = nemAdapt(peek(R.id)), A = N.adapt[ad]; R.gN++;
  if(ad === 'wall' && R.gN <= A.n && !g.def.rpg) closeMan(g, R.e);
  else if(ad === 'mobile') g.def = { ...g.def, keep:g.def.keep + (R.gN % 3) * A.stagger }; }
function closeMan(g, of){ const A = N.adapt.wall; if(!g) return; g.def = { ...g.def, range:A.range, dmg:g.def.dmg * A.dmgK, burst:A.burst, gap:A.gap, rest:A.rest, spreadK:A.spreadK };
  g.maxHp = g.hp = Math.round(g.maxHp * A.hpK); g.genGuard = true; g.loot = false; g.guard = { kind:'nem' }; g.post = [g.pos.x, g.pos.z]; NEM.wall.push({ g, of, side:NEM.wall.length % 2 ? 1 : -1 });
  floatText('CẬN VỆ ÁP SÁT', '#ff9a4a', { x:g.pos.x, y:heightAt(g.pos.x, g.pos.z) + 2.5, z:g.pos.z }, 13); }

// ---- the scar ----
function starOn(e, col){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:svgBadgeTex('star', col), transparent:true, depthWrite:false }));
  s.name = 'eliteFX'; s.scale.set(0.5, 0.5, 1); s.position.y = 2.3; e.mesh.add(s); }   // (killEnemy / the mesh pool strip 'eliteFX')
function piece(sc){ const K = N.scar; _geo = _geo || { ball:new THREE.SphereGeometry(0.5, 10, 8), band:new THREE.BoxGeometry(1, 1, 1) };
  _mat = _mat || [new THREE.MeshStandardMaterial({ color:K.cloth, roughness:0.9 }), new THREE.MeshStandardMaterial({ color:K.blood, roughness:0.8 })];
  const g = new THREE.Group(), c = new THREE.Mesh(_geo[sc.shape] || _geo.ball, _mat[0]), b = new THREE.Mesh(_geo.ball, _mat[1]); c.scale.fromArray(sc.size); g.add(c);
  b.scale.setScalar(sc.blot[3]); b.position.set(sc.blot[0], sc.blot[1], sc.blot[2]); g.add(b); g.name = 'nemFX'; return g; }
function scarOn(e, sc){ const m = e.mesh, u = m.userData, w = { m, objs:[], tint:null }, star = m.getObjectByName('eliteFX'); stripMan(m);
  if(star && star.material && star.material.map){ star.material.map = svgBadgeTex('star', sc.star); star.material.needsUpdate = true; }
  if(u.tint && sc.tint){ w.tint = u.tint.clone(); u.tint.setRGB(w.tint.r * sc.tint[0], w.tint.g * sc.tint[1], w.tint.b * sc.tint[2]); }   // (the troop batch reads his tint every frame: actors/soldiers.js)
  if(N.scar.rig && u.up && sc.at){ const g = piece(sc); kitAttach(u, u.up, g, sc.at, sc.off); w.objs.push(g); }                                   // (on the kit's own anchor: actors/real-troops.js)
  WORN.push(w); floatText(sc.vi, sc.star, { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.9, z:e.pos.z }, 15); }
// off again (m: that man only; none: everybody) — the mesh goes back to the pool as it came
function stripMan(m){ for(let i = WORN.length - 1; i >= 0; i--){ const w = WORN[i]; if(m && w.m !== m) continue; const u = w.m.userData;
  for(const o of w.objs){ if(o.parent) o.parent.remove(o); const k = u.kitAtt ? u.kitAtt.findIndex(a => a.obj === o) : -1; if(k >= 0) u.kitAtt.splice(k, 1); }
  if(w.tint && u.tint) u.tint.copy(w.tint); WORN.splice(i, 1); } }
const stripLater = m => { if(m) setTimeout(() => stripMan(m), N.scar.keep * 1000); };
// the boss bar's name plate: his stars and kill marks, the scar's name and colour
export function nemPlateEl(el, id, name){ const rec = N.on ? peek(id) : null, sc = rec && rec.scar ? N.scar[rec.scar] : null; el.textContent = name + nemBadge(rec) + (sc ? ' · ' + sc.vi : '');   /* HUDUX 4 no class tag: the name, his badge, a scar if he has one */ el.style.color = sc ? sc.star : ''; }

// ---- he gets away ----
// killEnemy asks: does this general die? true = no (he slips away, or is already running)
export function nemSlip(e){ const R = NEM, f = e.nemFlee; if(f){ if(f.mortal) return false; e.hp = Math.max(1, e.hp); return true; }
  if(!N.on || !R.live || e.nemJoin || e !== duelMan()) return false; const rec = peek(R.id); if(!rec || R.force === 'die') return false;
  if(R.force !== 'escape' && !(nemCanEscape(rec, { stage:S.stage || 1, stages:BOSS_DEFS.length, loop:S.loop || 0, diff:PROFILE.difficulty, custom:!!(S.run && S.run.mode === 'custom') }) && Math.random() < N.escape.chance)) return false;
  const E = N.escape, p = S.player, now = S.timeNow || NOW(), how = nemHow(!!e._blast, distTo(e));
  e.hp = Math.max(1, Math.round(e.maxHp * E.hpLeft)); fleeTo(e, now, false); nemAfterEscape(rec, how, gunId(), S.loop || 0); store();
  R.hostGone = true; R.esc = { id:R.id, name:R.name, stage:S.stage || 1, loop:S.loop || 0 };
  throwSmoke(e.pos.x, e.pos.z, 'e', now); if(p && E.smokes > 1) throwSmoke((e.pos.x + p.pos.x) * 0.5, (e.pos.z + p.pos.z) * 0.5, 'e', now);
  floatText('KHÓI!', SMOKE, { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3, z:e.pos.z }, 18);
  if(E.loot){ armsDrop(e); gainXp(Math.round(TROOPER.xp.kill.general * E.xpK), e.pos); }   // (his guns and the medal stay behind: the stage's prize is not lost with him)
  say(R.name, his('escape', R.id, R.name, rec), true); return true; }
// the field's edge behind him: of three bearings the one farthest from the player
function fleeTo(e, now, mortal){ const E = N.escape, p = S.player, a0 = Math.atan2(e.pos.z, e.pos.x); let bx = e.pos.x, bz = e.pos.z, bd = -1;
  for(let k = -1; k <= 1; k++){ const q = fieldEdgePoint(a0 + k * E.fan, 1.5), d = p ? Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z) : 1; if(d > bd){ bd = d; bx = q[0]; bz = q[1]; } }
  e.nemFlee = { tx:bx, tz:bz, t0:now, end:now + E.leaveMax, puff:0, stuck:0, gone:0, mortal:!!mortal }; e.aimT = 0; e.burstLeft = 0; e.loot = false; }
// actors/infantry.js, instead of everything else he does: he runs for the edge trailing smoke, and is gone there — or once out of the frame, or when it has taken too
//   long. Held up (a wall of his own citadel in the way: no ground made for `stuck` s) he pops one more canister at his feet and is gone inside it `vanish` s later
export function nemFleeStep(e, dt, now, edt){ const f = e.nemFlee, m = e.mesh, E = N.escape, x0 = e.pos.x, z0 = e.pos.z, dx = f.tx - x0, dz = f.tz - z0, d = Math.hypot(dx, dz) || 1, sp = e.def.speed * E.run;
  if(d < 2.5 || now > f.end || f.gone && now > f.gone || now - f.t0 > E.leaveMin && (!inField(x0, z0, 2.2) || !inCamView(x0, z0))){ nemLeave(e); return; }
  e.pos.x += dx / d * sp * edt; e.pos.z += dz / d * sp * edt; infPushBlocks(e.pos); clampField(e.pos, 1.5);
  f.stuck = d - Math.hypot(f.tx - e.pos.x, f.tz - e.pos.z) < sp * edt * 0.35 ? f.stuck + dt : Math.max(0, f.stuck - dt);   // (ground MADE toward the edge: sliding along a wall is being held up too — the test run's general slid 9 s)
  if(!f.gone && (f.stuck > E.stuck || now > f.end - E.vanish)){ f.gone = now + E.vanish; throwSmoke(e.pos.x, e.pos.z, 'e', now); }
  let a = Math.atan2(dx, dz) - e.facing; while(a > Math.PI) a -= 6.283185; while(a < -Math.PI) a += 6.283185; e.facing += a * Math.min(1, dt * 8);
  const y = heightAt(e.pos.x, e.pos.z); m.position.set(e.pos.x, y, e.pos.z); m.rotation.y = e.facing; e.intent = 'flee'; e.r = 0.55;
  if(now > f.puff){ f.puff = now + E.puff; spawnPart(e.pos.x, y + 1, e.pos.z, (Math.random() - 0.5) * 0.8, 0.4, (Math.random() - 0.5) * 0.8, { color:0xd9d6cc, size:2.2, life:2.6, smoke:true, grav:0.05, drag:1, grow:1.5, op:0.5 }); }
  animateSoldier(m, Math.hypot(e.pos.x - x0, e.pos.z - z0) / (e.def.scale || 1), dt, false); poseSoldier(m, 'stand', dt); }
function nemLeave(e){ const i = enemies.indexOf(e), m = e.mesh, J = NEM.join; if(i < 0) return; if(J && J.e === e) J.left = true; e.nemFlee = null;
  enemies.splice(i, 1); freeEnemyBar(e.bar); e.bar = null; stripMan(m); m.visible = false; reviveSoldierMesh(m); (enemyPool[e.type] = enemyPool[e.type] || []).push(m); }
// nobody is left running (a new duel, a new game, the stage's reward screen)
function sweep(){ for(let i = enemies.length - 1; i >= 0; i--) if(enemies[i].nemFlee) nemLeave(enemies[i]); }

// ---- the man who comes back beside this stage's general (general-duel.js, when the guards are called) ----
export function nemJoin(host){ const R = NEM; if(!N.on || !R.live || R.join || !host || !campaign()) return; const g = mem().g; let id = '', rec = null;
  for(const k of NEM_IDS){ const r = g[k]; if(r && r.out && k !== R.id && (!rec || r.rank > rec.rank)){ rec = r; id = k; } } if(!rec) return;
  const name = nameOf(id), c = TROOPER.general, J = N.join, p = S.player, tune = nemTuneOf(c, rec), sc = rec.scar ? N.scar[rec.scar] : null;
  const a = p ? Math.atan2(host.pos.x - p.pos.x, host.pos.z - p.pos.z) + (Math.random() - 0.5) : 0, [x, z] = clampFieldXZ(host.pos.x + Math.sin(a) * J.off, host.pos.z + Math.cos(a) * J.off, 4), e = spawnEnemy('rifle', x, z); if(!e) return;
  e.general = true; e.nemJoin = id; e.loot = false; e.def = { ...e.def, dmg:c.dmg, fireCd:c.fireCd, range:c.range, keep:c.keep, speed:c.speed, score:1500 };
  e.maxHp = e.hp = Math.round(e.maxHp * tune.hpK * J.hpK); e.hitCap = e.maxHp * J.hitCap; e.mesh.scale.multiplyScalar(c.scale); if(e.bar) e.bar.g.scale.setScalar(1.25);
  R.join = { id, name, e, done:false, left:false }; const greet = nemGreet(rec); nemAfterMeet(rec); rec.last = 'fled'; store(true);   // (still at large until he falls)
  starOn(e, sc ? sc.star : GOLD); wear(e, rec, tune, false);
  showBanner(name + ' QUAY LẠI!', '#ff9a4a'); sfx('alarm'); floatText(name + nemBadge(rec), sc ? sc.star : '#ff9a4a', { x, y:heightAt(x, z) + 3.2, z }, 20);
  say('SCH', text(N.say.join, name, rec), true); say(name, his(greet, id, name, rec), false, 'join'); const ad = nemAdapt(rec); if(ad) say('SCH', text(N.say.hint[ad], name, rec)); }
function joinFell(J){ const rec = recOf(J.id), e = J.e; if(!rec) return; const last = his('fall', J.id, J.name, rec); nemAfterFall(rec, nemHow(!!e._blast, distTo(e)), gunId()); store(); stripLater(e.mesh);
  showBanner('ĐÃ HẠ ' + J.name + ' · HẾT NỢ!', GOLD, true); say(J.name, last, true); say('SCH', text(N.say.paid, J.name, rec)); }

// ---- the duel ends ----
// fallen(): the stage's general is dead. true = his last words went out (a man with a history); false = the story's own line is said
export function nemFell(){ const R = NEM; if(!R.live) return false; const rec = peek(R.id), e = R.e; R.hostGone = true; if(!rec) return false;
  const had = rec.fled > 0 || rec.kills > 0 || rec.met > 1, owed = rec.fled > 0, last = had ? his('fall', R.id, R.name, rec) : '';
  nemAfterFall(rec, nemHow(!!(e && e._blast), distTo(e)), gunId()); store(); if(e) stripLater(e.mesh);
  if(owed) say('SCH', text(N.say.paid, R.name, rec)); if(!last) return false; say(R.name, last, true); return true; }
// boss.js bossStageWon: the banner of a stage won while its general ran
const wonText = E => 'THÀNH ĐÃ HẠ · ' + E.name + ' ĐÃ THOÁT!';
export function nemWinBanner(id){ const E = NEM.esc; return N.on && E && E.id === id && E.stage === (S.stage || 1) && E.loop === (S.loop || 0) ? wonText(E) : ''; }
// boss.js bossStageWon, after the celebration has had its say: the banner stays his, and our commander says what the win left open
export function nemWon(id){ const E = NEM.esc; if(!N.on || !E || E.id !== id || E.stage !== (S.stage || 1) - 1 || E.loop !== (S.loop || 0)) return;   // (the stage counter has moved on)
  showBanner(wonText(E), GOLD, true); say('SCH', text(N.say.won, E.name, peek(E.id)), true); }
// loot/upgrades.js openUpgrade: the epilogue of the stage just won — its first line (the general's fall) gives way to his escape
export function nemEpilogue(el, stage){ const E = NEM.esc, s = el && el.firstElementChild; sweep(); if(!N.on || !E || E.stage !== stage || E.loop !== (S.loop || 0) || !s) return;
  const t = text(N.say.epi, E.name, peek(E.id)); if(t) s.textContent = t; }
// ui/briefing.js: what the dossier adds about a man who knows the player — and word of a general at large
export function nemBrief(id){ if(!N.on) return ''; const B = N.say.brief, rec = peek(id), g = mem().g; let s = '';
  if(rec && rec.met > 0){ const sc = rec.scar ? N.scar[rec.scar] : null; s = nemFill(B.met, { n:rec.met }); if(rec.kills) s += ' · ' + nemFill(B.kills, { k:rec.kills }); if(rec.fled) s += ' · ' + nemFill(B.fled, { f:rec.fled });
    if(rec.rank) s += ' · ' + nemFill(B.rank, { r:rec.rank }); if(sc) s += ' · ' + sc.vi.toLocaleLowerCase('vi'); s += '.'; }
  if(campaign()) for(const k of NEM_IDS){ const r = g[k]; if(r && r.out && k !== id){ s += (s ? ' ' : '') + nemFill(B.large, { name:nemTitle(nameOf(k)) }); break; } }
  return s; }

// ---- the player dies to him (game/player-damage.js) ----
// playerDie: the duel's general — or the one who came back, when he stands nearer — takes the kill: a mark, and a word
export function nemPlayerDied(){ const R = NEM; if(!N.on || !R.live) return; const p = S.player, h = duelMan(), J = R.join, j = J && !J.done && !J.e.nemFlee && enemies.includes(J.e) ? J.e : null; if(!p || !h && !j) return;
  const byJ = !!j && (!h || distTo(j) < distTo(h)), id = byJ ? J.id : R.id, name = byJ ? J.name : R.name, e = byJ ? j : h, rec = recOf(id); if(!rec) return;
  nemAfterKill(rec); if(byJ) rec.out = 1; store(); const t = his('death', id, name, rec); say(name, t, true);
  floatText('☠', '#ff5a3c', { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.5, z:e.pos.z }, 28);
  if(p.lives < 0 && t) R.deathLine = '“' + t + '” — ' + nemTitle(name); const el = document.getElementById('boss-name'); if(el && h) nemPlateEl(el, R.id, R.name); }
// gameOver: his word under the reason the battle was lost (the last life went to him)
export function nemDeathLine(el){ const t = NEM.deathLine; NEM.deathLine = ''; if(!t || !el) return; const s = document.createElement('span'); s.textContent = t; s.style.cssText = 'display:block;margin-top:8px;font-style:italic;opacity:.92'; el.appendChild(s); }

// ---- once a frame in battle (general-duel.js updateGeneralDuel); the work is done NEMESIS.tick s apart ----
function act(a, e, p, now){ const A = N.adapt[a.kind]; if(now < a.at) return;
  if(a.kind === 'mobile'){ a.at = now + A.every; a.k ^= 1; e.def.keep = a.keep0 + A.swing[a.k]; e.side = -(e.side || 1); e.cover = null; e.coverAt = now + A.every; return; }   // never still: in, out, the other side — and no cover to sit behind
  const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1; if(d < A.smokeD){ a.at = now + 1; return; }
  const k = Math.min(d * 0.5, A.ahead), x = e.pos.x + dx / d * k, z = e.pos.z + dz / d * k; a.at = now + A.smokeCd; throwSmoke(x, z, 'e', now); floatText('ĐỊCH THẢ KHÓI', SMOKE, { x, y:heightAt(x, z) + 2.8, z }, 14); }
export function nemTick(){ const R = NEM; if(!R.live) return; const now = S.timeNow || NOW(); if(now < R.at) return; R.at = now + N.tick; const p = S.player; if(!p) return;
  if(R.q.length) flush(now);
  for(let i = 0; i < R.acts.length; i++){ const a = R.acts[i], e = a.e; if(enemies.includes(e) && !e.nemFlee) act(a, e, p, now); }
  for(let i = R.wall.length - 1; i >= 0; i--){ const w = R.wall[i], g = w.g, o = w.of; if(!enemies.includes(g)){ R.wall.splice(i, 1); continue; }
    if(!enemies.includes(o) || o.nemFlee){ g.guard = null; g.post = null; g.genGuard = false; g.def = { ...g.def, range:0, keep:90 }; R.wall.splice(i, 1); continue; }   // (nobody left to screen: he breaks like the other guards)
    const A = N.adapt.wall, dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z, d = Math.hypot(dx, dz) || 1, f = Math.min(A.front, d * 0.5), s = A.wide * 0.5 * w.side;
    g.post[0] = o.pos.x + dx / d * f - dz / d * s; g.post[1] = o.pos.z + dz / d * f + dx / d * s; }
  const J = R.join; if(J && !J.done){ const e = J.e;
    if(!enemies.includes(e)){ J.done = true; if(!J.left) joinFell(J); }
    else if(R.hostGone && !e.nemFlee){ fleeTo(e, now, true); floatText('RÚT!', SMOKE, { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3, z:e.pos.z }, 16); say('SCH', text(N.say.withdraw, J.name, peek(J.id))); } } }
