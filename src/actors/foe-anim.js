// actors/foe-anim.js — FOE 1 THE ENEMY MOVES LIKE A MAN (FOEANIM; ?nofoeanim → none of it runs): every enemy rifleman on screen within TROOPLOD.far is drawn
//   with the trooper's own skeleton (actors/foe-bake.js) playing the Mixamo library, driven from what his AI is doing — his stance (u.stance, the one
//   poseSoldier commits), his ground speed and heading (read off his mesh frame to frame, so a co-op puppet moves the same way), his shots (u.shots),
//   his reload (u.reload), the hit (u.flinch), his cover (e.inCover), a grenade (foeAct), his squad's plan (e.sq.state). Two tiers, one draw each:
//   · NEAR (the FOEANIM.cap nearest within FOEANIM.near): the graph below, on the CPU, for each man —
//       – THE BLEND SPACE: his velocity in his legs' own frame picks the 8-way rifle walk / run sets (the crouch-walk set bent low, the sprint over
//         gaits.sprint), two bearings × two gaits at most, all on ONE stride phase that runs at his real speed ÷ the blend's own stride, so the feet keep
//         to the ground; idle below a walk, blended in by speed (setting off and pulling up are a ramp, not a cut).
//       – STANCES by the library's own transition clips (stand → knee → belly and back; knocked flat by a blast = the knock-down clip); on the move
//         stand ↔ crouch go straight across.
//       – TURNING BY STEPPING: stood (or knelt) still his legs stay put while the chest swings with the aim (the lag taken back up the spine), and once
//         the aim is turn.deg off his feet a turn-90 clip steps him round, its root's own turn laid on his legs.
//       – LOOK FIRST: his head turns to where the AI aims at once (swing.head), the chest and rifle swing after it no faster than a man can
//         (swing.chest), the legs after them (swing.legs) — the AI's own instant flips of heading never reach his body.
//       – THE FEET: a foot the clip puts down is locked where it landed (two-bone IK) until lifted; on a slope each stands on its own ground.
//       – LAYERS on spine + arms (fade in / out): the reload (stood, knelt, lying), the grenade (an arm swing timed to its release), the squad leader's
//         point onward, a shout and point when it dawns on him, a flinch when hit; the rifle's recoil on the arms and chest.
//       – IN COVER: knelt behind it he sits with his back to it (the cover clip, his body turned cover.yaw off the enemy); to fire he leans out —
//         turns to the enemy and comes up to the kneeling fire pose cover.lean s BEFORE the first round (foeLean holds the shot) — and back after.
//       – EVERY CUT INERTIALIZED: when the pose's source changes (a stance, a turn, a layer's clip, a cover pivot, a tier change) the difference
//         between what was shown and the new target fades out on a smooth ramp (blend s) — no pose ever jumps.
//   · CROWD (the rest): two clips a man crossfaded by the GPU from the baked texture (foe-skin.js), the clip and its time picked here from the same
//     inputs (a few lines a man, no bones). A man moving up from the crowd starts his graph from the crowd's pose (inertialized).
//   The game's own nine-joint rig keeps running under both (its gun joint is laid on the skeleton's right palm each frame, so the muzzle, the launcher
//   and every shot leave from the rifle that is seen); the dead, the flung, the climbing and every man past TROOPLOD.far are the rig's (its far body
//   swap untouched). FOE: what a probe reads.
import * as THREE from 'three';
import { FOEANIM, REALTROOP, TROOPLOD } from '../../config.js';
import { MOBILE, S, SHADOW_EXT, SOLDIER_KIT, bakeFoeRig, camera, dazed, enemies, heightAt, foeBoneRows, foeCrowdMesh, foeFK, foeMeshFree, foeNearMesh, foeRootAt, foeSample, foeSkin, foeVatData, foeVatTex, fqLerp, fqMul, fqYaw, loadAnimGroup, loadGLTF, scene } from '../hub.js';

export const FOE = { f:0, ready:false, booting:false, failed:false, near:0, crowd:0, ms:0, msSum:0, msMax:0, frames:0, cuts:0, turns:0, layers:0, trans:0, leans:0, throws:0, signals:0,
  measure:false, slip:null, jump:null };   // (a probe sets measure: per near man the planted toe's slide and the largest per-frame turn of any bone)
const C = FOEANIM, CL = C.clips, NB = 22, PQ = NB * 4, NP = PQ + 3, TAU = Math.PI * 2;
let R = null, VAT = null, NEAR = null, CROWD = null, GUN = null, KIT = null, _last = 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, smooth = k => k * k * (3 - 2 * k), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), frac = x => x - Math.floor(x);
const TGT = new Float32Array(NP), LAY = new Float32Array(NP), TMP = new Float32Array(NP), WQ = new Float32Array(PQ), WP = new Float32Array(NB * 3), TW = new Float32Array(NB), TP = new Float32Array(NB), HR = new Float32Array(12), R3 = [0, 0, 0];
const _im = new THREE.Matrix4(), _hm = new THREE.Matrix4(), _gm = new THREE.Matrix4(), _pm = new THREE.Matrix4(), _gq = new THREE.Matrix4(), _sc = new THREE.Matrix4(), _fr = new THREE.Frustum(), _sp = new THREE.Sphere();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _hit = new THREE.Color(1.12, 0.62, 0.58), _white = new THREE.Color(1, 1, 1);
const CANDS = [], BIG = 1e9;
const clip = id => (R && R.clips.get(id)) || null;

// ---- boot: the files, the bake, the baked texture (once a session) ----
function boot(){ FOE.booting = true;
  Promise.all([loadGLTF('trooper'), loadGLTF('operator'), loadGLTF('troopGun'), ...C.groups.map(loadAnimGroup)]).then(async ([tg, og, gg, ...ok]) => {
    if(!tg || !og || !gg || ok.some(x => !x)) throw new Error('a file is missing');
    const r = await bakeFoeRig(tg, og, gg); if(!r || !r.gun || r.clips.size < 20) throw new Error('the trooper\'s skeleton did not bake');
    VAT = foeVatTex(await foeVatData(r)); R = r; sets(); FOE.ready = true;
  }).catch(e => { FOE.failed = true; console.warn('[foe-anim] off — the nine-joint rig draws the enemy:', e && e.message); }); }
// the blend sets: each clip with the bearing it goes (radians, + = to his left), sorted
const SETS = {};
function sets(){ for(const k of ['walk', 'run', 'low']){ const L = []; for(const id of Object.values(CL[k])){ const c = clip(id); if(c && c.dir) L.push({ c, a:Math.atan2(c.dir[0], c.dir[1]) }); } L.sort((x, y) => x.a - y.a); SETS[k] = L; } }
// the meshes, for the side's real kit (its material) — made again if the kit is swapped
function build(K){ for(const m of [NEAR, CROWD, GUN]) foeMeshFree(m); KIT = K; const cap = MOBILE ? C.capMobile : C.cap, sh = !MOBILE;
  NEAR = foeNearMesh(R.geo, K.mat, cap); CROWD = C.crowd ? foeCrowdMesh(R.geo, K.mat, C.crowdCap, VAT) : null;
  GUN = new THREE.InstancedMesh(R.gun.geo, (K.mats && K.mats.gun) || R.gun.mat, cap + C.crowdCap); GUN.frustumCulled = false; GUN.count = 0; GUN.instanceMatrix.setUsage(THREE.DynamicDrawUsage); GUN.userData.own = [];
  for(const m of [NEAR, CROWD, GUN]) if(m){ m.castShadow = sh; m.receiveShadow = true; }
  const gq = K.anchor && K.anchor.gripQ; _gq.makeRotationFromQuaternion(gq ? _q.fromArray(gq).invert() : _q.identity()); }
function hideAll(){ for(const m of [NEAR, CROWD, GUN]) if(m) m.count = 0; FOE.near = FOE.crowd = 0; }

// ---- per man ----
const newA = () => ({ tier:0, seen:-9, has:false, px:0, pz:0, vx:0, vz:0, sp:0, fy:0, om:0, ly:0, ro:0, rov:0, mode:'stand', tr:null, trT:0, trTo:'stand', trRate:1, turn:null, tT:0, tY0:0, tDY:0,
  ph:0, it:0, ct:0, uy:0, hy:0, hd:0, lk:[{ on:false, wait:false, x:0, y:0, z:0, ox:0, oy:0, oz:0, ot:9 }, { on:false, wait:false, x:0, y:0, z:0, ox:0, oy:0, oz:0, ot:9 }], idle:null, base:null, lay:null, layT:0, layW:0, layRate:1, layEnd:0, layOut:false, layK:'', kick:0, shots:-1, fireT:-9, expT:0, act:'', actT:-9, sqs:null, sigT:0, lint:'', cs:Math.random() < 0.5 ? -1 : 1,
  S:new Float32Array(NP), OFF:new Float32Array(NP), ot:9, cut:false, init:false, ca:null, cb:null, ta:0, tb:0, cw:1, pw:null, plx:BIG, plz:0 });
// something he does that the graph cannot see in his state: 'throw' (a grenade leaves his hand now), 'signal', 'react'
export function foeAct(e, what){ const u = e && e.mesh && e.mesh.userData; if(!u) return; const A = u.fa || (u.fa = newA()); A.act = what; A.actT = performance.now() / 1000; }
// AI 1 + FOE 1: an enemy hidden behind his cover is about to fire — true holds the shot while he leans out (the caller pushes e.fireAt)
export function foeLean(e, now){ const u = e.mesh && e.mesh.userData, A = u && u.fa; if(!FOE.ready || !A || A.tier !== 1 || A.mode !== 'kneel' || A.base !== clip(CL.cover)) return false;
  if(now < A.expT) return false; A.expT = now + C.cover.lean + C.cover.hold; FOE.leans++; return true; }
const cut = A => { A.cut = true; };
function startTr(A, id, to, rate){ const c = clip(id); if(!c){ A.mode = to; cut(A); return; } A.tr = c; A.trT = 0; A.trTo = to; A.trRate = rate; A.turn = null; cut(A); FOE.trans++; }
function layStart(A, c, rate, from, end, kind){ if(!c) return; if(A.lay !== c) cut(A); A.lay = c; A.layT = from; A.layRate = rate; A.layEnd = end; A.layK = kind; A.layOut = false; FOE.layers++; }
// the blend of one set at bearing `be` into o (weights w0 → the two clips nearest); returns the blend's stride (his metres a cycle) for the phase
function setPose(L, be, ph, o, wOut){ const n = L.length; let i = 0; while(i < n && L[i].a <= be) i++; const a = L[(i - 1 + n) % n], b = L[i % n];
  let span = b.a - a.a; if(span <= 0) span += TAU; let k = wrapA(be - a.a); if(k < 0) k += TAU; k = clamp(k / span, 0, 1);
  foeSample(a.c, frac(ph + a.c.ph0) * a.c.dur, o, 0); foeSample(b.c, frac(ph + b.c.ph0) * b.c.dur, TMP, 0); blend(o, TMP, k);
  wOut[0] = (a.c.speed * a.c.dur) * (1 - k) + (b.c.speed * b.c.dur) * k; return (a.c.speed * (1 - k) + b.c.speed * k); }
function blend(o, b, k){ if(k <= 0) return; for(let q = 0; q < PQ; q += 4) fqLerp(o, q, b, q, k, o, q); for(let c = PQ; c < NP; c++) o[c] += (b[c] - o[c]) * k; }
const LEGB = [0, 14, 15, 16, 17, 18, 19, 20, 21], SW1 = [0], SW2 = [0], P2 = new Float32Array(NP), P3 = new Float32Array(NP);

// the graph's step for one near man: A → TGT (the target), the twists TW / TP
function nearPose(e, u, A, dt, now){
  const G = C.gaits, st = u.stance || 'stand', dz = dazed(e, now), want = dz || st === 'prone' ? 'prone' : st === 'crouch' ? 'kneel' : 'stand', low = st === 'low';
  const moving = A.sp > G.still, aimed = (u.aimT || 0) > 0 || (e.aimT || 0) > 0 || (e.burstLeft || 0) > 0; if(aimed || (e.alert | 0) >= 2 || e.alert === undefined && now - A.fireT < 6) A.alT = now;
  const alert = now - (A.alT || -9) < 3;   // (held 3 s: the idle does not flicker between the rifle up and the rifle down)
  // shots and the recoil
  const sh = u.shots | 0; if(sh !== A.shots){ if(A.shots >= 0){ A.kick = 1; A.fireT = now; if(A.mode === 'kneel' && e.inCover) A.expT = Math.max(A.expT, now + C.cover.hold); } A.shots = sh; }
  A.kick *= Math.exp(-C.kick.back * dt);
  // stance changes
  if(!A.tr && A.mode !== want){ const T = C.tr;
    if(dz && A.mode === 'stand') startTr(A, CL.knock, 'prone', T.knock);
    else if(A.sp > 0.9 && A.mode !== 'prone' && want !== 'prone'){ A.mode = want; cut(A); }
    else if(A.mode === 'stand') startTr(A, CL.toKneel, 'kneel', want === 'prone' ? T.dive : T.toKneel);
    else if(A.mode === 'kneel') want === 'prone' ? startTr(A, CL.toProne, 'prone', T.toProne) : startTr(A, CL.toStand, 'stand', T.toStand);
    else startTr(A, CL.fromProne, 'kneel', want === 'stand' ? T.dive : T.fromProne); }
  if(A.tr){ A.trT += dt * A.trRate; if(A.trT >= A.tr.dur){ A.mode = A.trTo; A.tr = null; cut(A); } }
  // cover: hidden behind it unless leaning out to fire
  const hide = A.mode === 'kneel' && !A.tr && !moving && !!e.inCover && now >= A.expT && !(e.aimT > 0);
  { const tgt = hide ? A.cs * C.cover.yaw : 0, k = 7; A.rov += (-k * k * wrapA(A.ro - tgt) - 2 * k * A.rov) * dt; A.ro += A.rov * dt; }
  // LOOK FIRST, THEN THE RIFLE: the head turns to where his AI aims (fast), the chest and rifle swing after it no faster than a man can (swing.chest),
  //   the legs after them (stepped round when still, carried along when moving)
  { const W = C.swing, du = wrapA(A.fy - A.uy), mu = W.chest * dt; A.uy += clamp(du * (1 - Math.exp(-dt * W.k)), -mu, mu);
    const hm = W.head * dt, ht = A.uy + clamp(wrapA(A.fy - A.uy), -C.lead.max, C.lead.max); A.hy += clamp(wrapA(ht - A.hy), -hm, hm); }
  const legT = A.uy + A.ro, dl = wrapA(legT - A.ly);
  const pivot = A.mode === 'kneel' && !!e.inCover && !A.tr;   // (in cover he pivots on his knees to lean out and back: no stepping)
  if(A.turn){ A.tT += dt * C.turn.rate; const p = clamp(foeRootAt(A.turn, A.tT, R3)[2] / (A.turn.yaw || 1), 0, 1); A.ly = A.tY0 + A.tDY * p;
    if(A.tT >= A.turn.dur || moving || A.tr || A.mode === 'prone'){ A.turn = null; cut(A); } }
  else if(!moving && !pivot && !A.tr && A.mode !== 'prone' && Math.abs(dl) > C.turn.deg * Math.PI / 180){ const L = dl > 0, kn = A.mode === 'kneel', c = clip(kn ? (L ? CL.kTurnL : CL.kTurnR) : (L ? CL.turnL : CL.turnR));
    if(c){ A.turn = c; A.tT = 0; A.tY0 = A.ly; A.tDY = clamp(dl, -C.turn.max * Math.PI / 180, C.turn.max * Math.PI / 180); cut(A); FOE.turns++; } }
  if(!A.turn && (moving || pivot || A.mode === 'prone')){ const ml = C.swing.legs * dt; A.ly += clamp(dl * (1 - Math.exp(-dt * (A.mode === 'prone' ? 3 : pivot ? 10 : 8))), -ml, ml); }
  // the base pose
  let base = null, lean = 0;
  if(A.tr){ foeSample(A.tr, A.trT, TGT, 0); base = A.tr; }
  else if(A.mode === 'prone'){ if(moving){ const c = clip(CL.crawl); A.ct += dt * clamp(A.sp / (c.speed || 0.25), 0.5, 2.2); foeSample(c, A.ct, TGT, 0); base = c; }
    else { base = clip(now - A.fireT < 1.4 ? CL.proneFire : CL.prone); A.it += dt; foeSample(base, A.it, TGT, 0); } }
  else { // on his feet or on a knee: the idle (or the cover / the kneeling fire), and the moving blend over it by speed
    const kn = A.mode === 'kneel';
    base = kn ? clip(hide ? CL.cover : now - A.fireT < 1.4 || (e.burstLeft || 0) > 0 ? CL.kneelFire : alert ? CL.kneelAim : CL.kneel) : clip(alert ? CL.aimIdle : e.alert === 1 ? CL.look : CL.idle);
    A.it += dt; foeSample(base, A.it, TGT, 0);
    const wl = smooth(clamp((A.sp - G.still) / (G.still * 2.5), 0, 1));
    { const fy = A.ly, lx = A.vx * Math.cos(fy) - A.vz * Math.sin(fy), lz = A.vx * Math.sin(fy) + A.vz * Math.cos(fy), b0 = Math.atan2(lx, lz), mb = C.swing.bearing * dt;   // (the bearing in the blend space eased: a jittery path is not a jittery stride)
      A.be = wl > 0.05 && A.bon ? wrapA(A.be + clamp(wrapA(b0 - A.be) * (1 - Math.exp(-dt * 10)), -mb, mb)) : b0; A.bon = wl > 0.05; }
    if(wl > 0){ const be = A.be;
      let stride;
      if(kn || low){ const L = SETS.low, vL = L[0] ? L[0].c.speed : 1.7, run = SETS.run, vR = run[0] ? run[0].c.speed : 4, k = clamp((A.sp - vL * G.lowMax) / Math.max(0.3, vR - vL * G.lowMax), 0, 1);
        setPose(L, be, A.ph, P2, SW1); stride = SW1[0]; if(k > 0){ setPose(run, be, A.ph, P3, SW2); blend(P2, P3, k); stride = SW1[0] * (1 - k) + SW2[0] * k; } lean = C.lowLean * k; }
      else { const W = SETS.walk, Rn = SETS.run, vW = W[0] ? W[0].c.speed : 1.6, vR = Rn[0] ? Rn[0].c.speed : 4, k = clamp((A.sp - vW) / (vR - vW), 0, 1);
        setPose(W, be, A.ph, P2, SW1); stride = SW1[0]; if(k > 0){ setPose(Rn, be, A.ph, P3, SW2); blend(P2, P3, k); stride = SW1[0] * (1 - k) + SW2[0] * k; }
        const ks = clamp((A.sp - G.sprint) / 0.8, 0, 1) * clamp(Math.cos(be) * 2 - 1, 0, 1), sc = clip(CL.sprint);
        if(ks > 0 && sc){ foeSample(sc, frac(A.ph + sc.ph0) * sc.dur, P3, 0); blend(P2, P3, ks); stride = stride * (1 - ks) + sc.speed * sc.dur * ks; } }
      A.ph = frac(A.ph + A.sp * dt / Math.max(0.2, stride));
      blend(TGT, P2, wl); }
    if(A.turn){ foeSample(A.turn, A.tT, P3, 0); for(const b of LEGB) for(let c = 0; c < 4; c++) TGT[b * 4 + c] = P3[b * 4 + c]; for(let c = PQ; c < NP; c++) TGT[c] = P3[c]; } }   // (a turn steps the legs; the arms keep the rifle where the idle holds it)
  if(base !== A.base){ if(A.base) cut(A); A.base = base; }
  // the upper-body layers
  if(A.act && now - A.actT > 1.2) A.act = ''; if(!((u.reload || 0) > 0)) A.rl = false;   // (one reload clip a reload)
  const md = A.mode, pick = (s, k, p) => clip(md === 'prone' ? p : md === 'kneel' ? k : s);
  if(A.act === 'throw'){ const c = pick(CL.toss, CL.kToss, CL.pToss); if(c){ layStart(A, c, C.throwRate, Math.max(0, (c.rel || 1) - C.throwLead * C.throwRate), Math.min(c.dur, (c.rel || 1) + 0.9), 'throw'); FOE.throws++; A.gHand = true; } A.act = ''; }
  else if((u.reload || 0) > 0 && !A.rl && A.layK !== 'throw'){ const c = pick(CL.reload, CL.kReload, CL.pReload); A.rl = true; if(c) layStart(A, c, Math.min(C.reloadRate, c.dur / 1.7), 0, c.dur, 'reload'); }
  else if(!A.lay && (A.act === 'signal' || A.act === 'react') && md !== 'prone'){ const c = clip(A.act === 'signal' ? CL.onward : CL.point); if(c){ layStart(A, c, 1.25, A.act === 'signal' ? 0.6 : 0.3, A.act === 'signal' ? 3.1 : 1.6, A.act); if(A.act === 'signal') FOE.signals++; } A.act = ''; }
  else if(!A.lay && (u.flinch || 0) > 0.9){ const c = clip(CL.flinch); if(c) layStart(A, c, 1.5, 0, 0.75, 'flinch'); }
  if(A.lay){ A.layT += dt * A.layRate; if(!A.layOut && (A.layT >= A.layEnd || A.layK === 'reload' && !((u.reload || 0) > 0))) A.layOut = true;
    A.layW = A.layOut ? A.layW - dt / C.layer.out : Math.min(1, A.layW + dt / C.layer.in);
    if(A.layW <= 0){ A.layW = 0; A.lay = null; A.layK = ''; }
    else { foeSample(A.lay, Math.min(A.layT, A.lay.dur), LAY, 0); const w = smooth(A.layW); for(let b = 1; b < 14; b++) fqLerp(TGT, b * 4, LAY, b * 4, w, TGT, b * 4); } }
  // the twists: the legs' lag taken back up the spine, the head ahead of the rifle, the recoil, the low run's lean
  const up = wrapA(A.uy + A.ro - A.ly), Tw = C.twist; TW.fill(0); TP.fill(0);
  TW[0] = wrapA(A.ly - A.fy); TW[1] = up * Tw[0]; TW[2] = up * Tw[1]; TW[3] = up * Tw[2];
  const lead = clamp(wrapA(A.hy - A.uy - A.ro), -C.lead.max, C.lead.max); TW[4] = lead * C.lead.neck; TW[5] = lead * (1 - C.lead.neck);
  TP[2] = lean * 0.5; TP[3] = lean * 0.5 - A.kick * C.kick.chest; TP[7] = TP[11] = -A.kick * C.kick.arm; }

// inertialization: on a cut, the offset (shown ⊗ target⁻¹) — then shown = (offset scaled by a falling ramp) ⊗ target. A cut while an offset is still
//   fading (k ≥ 0.35 left) keeps the ramp's clock and stretches the new offset to it (offset^(1/k)): the fade goes on at the pace it had — no stall
function inert(A, dt){ const O = A.OFF, Sh = A.S, T = C.blend;
  if(A.cut || !A.init){
    if(A.init){ const kc = A.ot < T ? 1 - smooth(A.ot / T) : 0, keep = kc >= 0.35, p = keep ? 1 / kc : 1;
      for(let q = 0; q < PQ; q += 4){ const ax = Sh[q], ay = Sh[q + 1], az = Sh[q + 2], aw = Sh[q + 3], bx = -TGT[q], by = -TGT[q + 1], bz = -TGT[q + 2], bw = TGT[q + 3];
        let x = ax * bw + aw * bx + ay * bz - az * by, y = ay * bw + aw * by + az * bx - ax * bz, z = az * bw + aw * bz + ax * by - ay * bx, w = aw * bw - ax * bx - ay * by - az * bz; if(w < 0){ x = -x; y = -y; z = -z; w = -w; }
        if(keep){ const sn = Math.hypot(x, y, z); if(sn > 1e-6){ const an = Math.min(Math.PI * 0.95, 2 * Math.atan2(sn, w) * p) / 2, f = Math.sin(an) / sn; x *= f; y *= f; z *= f; w = Math.cos(an); } }
        O[q] = x; O[q + 1] = y; O[q + 2] = z; O[q + 3] = w; }
      for(let c = PQ; c < NP; c++) O[c] = (Sh[c] - TGT[c]) * p; if(!keep) A.ot = 0; FOE.cuts++; } else A.ot = 9;
    A.cut = false; A.init = true; }
  const k = A.ot < T ? 1 - smooth(A.ot / T) : 0; A.ot += dt;
  if(k <= 0){ Sh.set(TGT); return; }
  for(let q = 0; q < PQ; q += 4){ const sn = Math.hypot(O[q], O[q + 1], O[q + 2]); if(sn < 1e-7){ Sh[q] = TGT[q]; Sh[q + 1] = TGT[q + 1]; Sh[q + 2] = TGT[q + 2]; Sh[q + 3] = TGT[q + 3]; continue; }
    const h = Math.atan2(sn, O[q + 3]) * k, f = Math.sin(h) / sn; TMP[0] = O[q] * f; TMP[1] = O[q + 1] * f; TMP[2] = O[q + 2] * f; TMP[3] = Math.cos(h); fqMul(TMP, 0, TGT, q, Sh, q); }   // (the offset's own angle × k: exact)
  for(let c = PQ; c < NP; c++) Sh[c] = TGT[c] + O[c] * k; }

// the crowd: one clip (and the one it fades from) and its time, from the same inputs
function crowdPick(e, u, A, now){ const st = u.stance || 'stand', G = C.gaits, moving = A.sp > G.still, aimed = (u.aimT || 0) > 0 || (e.alert | 0) >= 2;
  if(st === 'prone' || dazed(e, now)) return moving ? clip(CL.crawl) : clip(CL.prone);
  if(st === 'crouch' && !moving) return clip(aimed ? CL.kneelAim : CL.kneel);
  if(!moving) return clip(aimed ? CL.aimIdle : CL.idle);
  const fy = A.fy, lx = A.vx * Math.cos(fy) - A.vz * Math.sin(fy), lz = A.vx * Math.sin(fy) + A.vz * Math.cos(fy), be = Math.atan2(lx, lz);
  const W = st === 'low' || st === 'crouch' ? SETS.low : A.sp > (SETS.walk[0].c.speed + SETS.run[0].c.speed) / 2 ? SETS.run : SETS.walk; let best = W[0], bd = 9;
  for(const s of W){ const d = Math.abs(wrapA(be - s.a)); if(d < bd){ bd = d; best = s; } } return best.c; }
const frameOf = (c, t) => { let x = Math.round(t * 30); const last = c.n - 1; if(c.loop){ x %= last; if(x < 0) x += last; } else x = x < 0 ? 0 : x > last ? last : x; return c.row + x; };
function crowdStep(e, u, A, dt, now){ const c = crowdPick(e, u, A, now), rate = c.loop && c.speed > 0.05 && c.dir ? clamp(A.sp / c.speed, 0.4, 2.5) : 1;
  if(c !== A.cb){ if(!A.cb){ A.ca = A.cb = c; A.ta = A.tb = 0; A.cw = 1; }
    else { if(A.cw >= 0.5){ A.ca = A.cb; A.ta = A.tb; } A.cb = c; A.tb = c.loop && A.ca.loop && A.ca.dir && c.dir ? frac(A.ta / A.ca.dur - A.ca.ph0 + c.ph0) * c.dur : 0; A.cw = 0; } }
  A.ta += dt * rate; A.tb += dt * rate; A.cw = Math.min(1, A.cw + dt / C.crowdFade); }
// the crowd's pose, made on the CPU once — when he moves up to the near graph
function crowdPose(A, o){ foeSample(A.ca, A.ta, o, 0); if(A.cw < 1){ foeSample(A.cb, A.tb, TMP, 0); blend(o, TMP, smooth(A.cw)); } else foeSample(A.cb, A.tb, o, 0); }

// THE GRENADE HAND: a throw is the right arm's — the rifle passes to the left hand where it is as the swing begins, and back as the arm returns
//   (its rows lerped by the layer's own weight: no jump either way)
const HL = new Float32Array(12), HM = new Float32Array(12);
function mul34(a, b, o){ for(let r = 0; r < 3; r++){ const a0 = a[r * 4], a1 = a[r * 4 + 1], a2 = a[r * 4 + 2], a3 = a[r * 4 + 3];
  for(let c = 0; c < 4; c++) o[r * 4 + c] = a0 * b[c] + a1 * b[4 + c] + a2 * b[8 + c] + (c === 3 ? a3 : 0); } }
function inv34(a, o){ for(let r = 0; r < 3; r++) for(let c = 0; c < 3; c++) o[r * 4 + c] = a[c * 4 + r]; for(let r = 0; r < 3; r++) o[r * 4 + 3] = -(o[r * 4] * a[3] + o[r * 4 + 1] * a[7] + o[r * 4 + 2] * a[11]); }   // (rigid: the transpose)
function leftHold(A){ const on = A.layK === 'throw' && !!A.lay; if(!on){ A.gHand = false; if(!(A.gW > 0)) return; }
  foeBoneRows(WQ, WP, 9, HL, 0);
  if(A.gHand){ A.gHand = false; if(!A.gOff) A.gOff = new Float32Array(12); inv34(HL, HM); mul34(HM, HR, A.gOff); }   // (as the swing starts: where the rifle is, in the left hand's frame)
  if(!A.gOff) return; const w = on && !A.layOut ? 1 : on ? smooth(Math.max(0, A.layW)) : 0; A.gW = w; if(w <= 0) return;
  mul34(HL, A.gOff, HM); for(let q = 0; q < 12; q++) HR[q] += (HM[q] - HR[q]) * w; }
// THE FEET (FOEANIM.foot): the clip stands him on level ground at his root, its feet only as still as his AI's path is clean. Here (1) on a slope the hips
//   come down for the lower foot (at most foot.drop, eased) and each foot stands on the ground under IT; (2) a foot the clip has put down (ankle within
//   lockH of its rest height, toe on the ground) is LOCKED where it landed in the world until the clip lifts it — or until his leg would have to reach
//   more than foot.reach for it, when it is let go; a foot let go eases back onto the clip over foot.ease s. Each leg is laid by two-bone IK to its
//   ankle's spot; the foot keeps the clip's own turn
const _H = new THREE.Vector3(), _K = new THREE.Vector3(), _A = new THREE.Vector3(), _T = new THREE.Vector3(), _n = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _w = new THREE.Vector3(), _imI = new THREE.Matrix4();
const LEGS = [[14, 15, 16, 17], [18, 19, 20, 21]], DG = [0, 0], PL = [false, false];
function feet(A, me, sy, dt){ const gy0 = me[13], FT = C.foot; _imI.copy(_im).invert();
  for(let i = 0; i < 2; i++){ const f = LEGS[i][2], t = LEGS[i][3], hy = A.lk[i].on ? 0.02 : 0; PL[i] = WP[f * 3 + 1] < R.ankle + FT.lockH + hy && WP[t * 3 + 1] < 0.06 + hy;   // (a planted foot is let go a little higher than it is put down)
    _w.set(WP[f * 3], WP[f * 3 + 1], WP[f * 3 + 2]).applyMatrix4(_im); DG[i] = clamp((heightAt(_w.x, _w.z) - gy0) / sy, -FT.drop * 1.6, FT.drop * 1.6); }
  const want = clamp(Math.min(DG[0], DG[1]), -FT.drop, FT.drop); A.hd += (want - A.hd) * (1 - Math.exp(-dt * 12)); const hd = A.hd;
  if(Math.abs(hd) > 1e-4) for(let b = 0; b < NB; b++) WP[b * 3 + 1] += hd;
  for(let i = 0; i < 2; i++){ const [u, k, f, t] = LEGS[i], L = A.lk[i]; _A.fromArray(WP, f * 3); _T.copy(_A); _T.y += DG[i] - hd;
    let rel = false; if(!PL[i]) L.wait = false;   // (a foot let go for over-reaching is locked again only after the clip has lifted it)
    if(PL[i] && L.wait){ /* not again until lifted */ }
    else if(PL[i] && !L.on && L.ot < FT.ease){ const e = 1 - smooth(L.ot / FT.ease); _T.x += L.ox * e; _T.y += L.oy * e; _T.z += L.oz * e; L.ot = 9; }   // (put down again while still easing back: locked where it is seen)
    if(PL[i] && !L.wait){ if(!L.on){ L.on = true; _w.copy(_T).applyMatrix4(_im); L.x = _w.x; L.y = _w.y; L.z = _w.z; }
      _w.set(L.x, L.y, L.z).applyMatrix4(_imI); if(_w.distanceTo(_T) > FT.reach){ rel = true; L.wait = true; } else _T.copy(_w); }
    else if(L.on){ rel = true; _w.set(L.x, L.y, L.z).applyMatrix4(_imI); }
    if(rel){ L.on = false; L.ox = _w.x - _T.x; L.oy = _w.y - _T.y; L.oz = _w.z - _T.z; const ol = Math.hypot(L.ox, L.oy, L.oz); if(ol > FT.reach){ const f = FT.reach / ol; L.ox *= f; L.oy *= f; L.oz *= f; } L.ot = 0; }
    if(!L.on && L.ot < FT.ease){ const e = 1 - smooth(L.ot / FT.ease); _T.x += L.ox * e; _T.y += L.oy * e; _T.z += L.oz * e; L.ot += dt; }
    if(_T.distanceToSquared(_A) < 1.6e-5) continue;
    _H.fromArray(WP, u * 3); _K.fromArray(WP, k * 3);
    const a = _K.distanceTo(_H), b = _A.distanceTo(_K), Lm = (a + b) * 0.999, Ls = (a + b) * FT.soft, c0 = _T.distanceTo(_H);
    const c = clamp(c0 > Ls ? Ls + (Lm - Ls) * (1 - Math.exp(-(c0 - Ls) / (Lm - Ls))) : c0, Math.abs(a - b) + 1e-3, Lm);   // (GRAPH 6's soft reach: never snapped straight)
    _d1.subVectors(_H, _K).normalize(); _d2.subVectors(_A, _K).normalize(); _n.crossVectors(_d1, _d2);
    _qa.set(WP[t * 3] - _A.x, 0, WP[t * 3 + 2] - _A.z, 0); _w.subVectors(_H, _A); const fx = -(_w.y * _qa.z), fy = _w.x * _qa.z - _w.z * _qa.x, fz = _w.y * _qa.x;   // (the knee's way when the leg is straight: toward the toes)
    if(_n.lengthSq() < 4e-4 || _n.x * fx + _n.y * fy + _n.z * fz < 0){ _n.set(fx, fy, fz); if(_n.lengthSq() < 1e-10) continue; }
    _n.normalize();
    const cur = Math.acos(clamp(_d1.dot(_d2), -1, 1)), wnt = Math.acos(clamp((a * a + b * b - c * c) / (2 * a * b), -1, 1)); _q1.setFromAxisAngle(_n, wnt - cur);
    _d2.subVectors(_A, _K).applyQuaternion(_q1).add(_K).sub(_H).normalize(); _d1.subVectors(_T, _H).normalize(); _q2.setFromUnitVectors(_d2, _d1);
    _qa.fromArray(WQ, u * 4).premultiply(_q2).toArray(WQ, u * 4); _qa.fromArray(WQ, k * 4).premultiply(_q1).premultiply(_q2).toArray(WQ, k * 4);
    _K.sub(_H).applyQuaternion(_q2).add(_H); _K.toArray(WP, k * 3); const tx = WP[t * 3] - WP[f * 3], ty = WP[t * 3 + 1] - WP[f * 3 + 1], tz = WP[t * 3 + 2] - WP[f * 3 + 2];
    const nx = _H.x + _d1.x * c, ny = _H.y + _d1.y * c, nz = _H.z + _d1.z * c; WP[f * 3] = nx; WP[f * 3 + 1] = ny; WP[f * 3 + 2] = nz; WP[t * 3] = nx + tx; WP[t * 3 + 1] = ny + ty; WP[t * 3 + 2] = nz + tz; } }
// ---- every frame, right before the troop batch (updateTroopBatch) ----
export function foeBatch(now){ FOE.f++; if(!C.on){ if(NEAR) hideAll(); return; } const K = SOLDIER_KIT.e;
  if(!R){ if(!FOE.booting && K && K.real && K.skin) boot(); return; }
  if(!K || !K.real || !K.skin){ hideAll(); return; }
  if(K !== KIT) build(K);
  for(const m of [NEAR, CROWD, GUN]) if(m && m.parent !== scene) scene.add(m);
  const t0 = performance.now(), dtR = Math.min(0.05, Math.max(0, now - _last)); _last = now; const dt = S.mode === 'paused' ? 0 : dtR * (S.timeScale || 1);
  const pl = S.player && S.player.pos, px = pl ? pl.x : camera.position.x, pz = pl ? pl.z : camera.position.z, far2 = TROOPLOD.on ? TROOPLOD.far * TROOPLOD.far : BIG, sr = SHADOW_EXT.r * TROOPLOD.shadowK + TROOPLOD.shadowPad, sh2 = MOBILE ? -1 : sr * sr;
  camera.updateMatrixWorld(); _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  CANDS.length = 0;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i], m = e.mesh; if(!e.def || !e.def.inf || !m || e.dead) continue; const u = m.userData;
    if(u.kitKey !== 'e' || !u.realKit || u.clipDraw || !u.parts || u.fall || m.rotation.x || m.rotation.z || !shown(m)) continue;
    m.updateWorldMatrix(true, false); const me = m.matrixWorld.elements, dx = me[12] - px, dz = me[14] - pz, d2 = dx * dx + dz * dz; if(d2 > far2) continue;
    _sp.center.set(me[12], me[13] + 1, me[14]); _sp.radius = 2.5 * (m.scale.x || 1); if(!_fr.intersectsSphere(_sp)) continue;
    const A = u.fa || (u.fa = newA()); e._fd2 = d2 * (A.tier === 1 && A.seen === FOE.f - 1 ? C.hyst : 1); CANDS.push(e); }
  CANDS.sort(byD); const nCap = MOBILE ? C.capMobile : C.cap, near2 = C.near * C.near, crowdOK = !!CROWD;
  let ni = 0, ci = 0, gi = 0; const ND = NEAR.userData.ft.image.data, CD = CROWD ? CROWD.userData.fi.image.data : null, kH = REALTROOP.top / R.H;
  for(let r = 0; r < CANDS.length; r++){ const e = CANDS[r], m = e.mesh, u = m.userData, A = u.fa, tier = ni < nCap && e._fd2 < near2 ? 1 : crowdOK && ci < C.crowdCap ? 2 : 0; if(!tier) continue;
    // where he is, how fast he goes (his own metres), how fast his aim swings
    const me = m.matrixWorld.elements, sy = u.body.scale.y / KIT.bodyK * kH, sx = u.body.scale.x / KIT.bodyK * kH, sz = u.body.scale.z / KIT.bodyK * kH, sw = sy * (m.scale.x || 1);
    if(A.seen !== FOE.f - 1){ A.has = false; A.init = false; A.cb = null; A.tr = A.turn = A.lay = null; A.layK = ''; A.layW = 0; A.tier = 0; A.pw = null; A.plx = BIG; A.lk[0].on = A.lk[1].on = false; A.lk[0].ot = A.lk[1].ot = 9; A.hd = 0; }   // (off screen a while: start clean)
    if(!A.has){ A.px = me[12]; A.pz = me[14]; A.vx = A.vz = 0; A.fy = A.ly = A.uy = A.hy = m.rotation.y; A.om = 0; A.has = true; }
    if(dt > 0){ const ivd = 1 / dt; let vx = (me[12] - A.px) * ivd, vz = (me[14] - A.pz) * ivd; if(vx * vx + vz * vz > 900){ vx = vz = 0; } const k = 1 - Math.exp(-dt * 7); A.vx += (vx - A.vx) * k; A.vz += (vz - A.vz) * k;
      const om = wrapA(m.rotation.y - A.fy) * ivd; A.om += (om - A.om) * (1 - Math.exp(-dt * 12)); }
    if(Math.abs(me[12] - A.px) + Math.abs(me[14] - A.pz) > 1.5){ for(const L of A.lk){ L.on = false; L.wait = false; L.ot = 9; } }   // (put somewhere else: his feet are not dragged there)
    A.px = me[12]; A.pz = me[14]; A.fy = m.rotation.y; A.sp = Math.hypot(A.vx, A.vz) / sw;
    // the squad leader's signal, the moment it dawns on him (the host's AI: e.sq / e.intent)
    if(e.sq && e.sq.m && e.sq.m[0] === e){ const s = e.sq.state; if(A.sqs !== null && s !== A.sqs && now > A.sigT && Math.random() < C.signal.chance){ A.act = 'signal'; A.actT = now; A.sigT = now + C.signal.cd; } A.sqs = s; }
    if(e.intent === 'react' && A.lint !== 'react'){ A.act = 'react'; A.actT = now; } A.lint = e.intent || '';
    _im.copy(m.matrixWorld).multiply(_sc.makeScale(sx, sy, sz));
    const hit = (u.flashUntil || 0) > now || u.torso.material.emissiveIntensity > 0, col = hit ? _hit : (u.tint || _white);
    if(tier === 1){ if(A.tier === 2 && A.cb){ crowdPose(A, A.S); A.init = true; A.cut = true; A.mode = (u.stance === 'prone' ? 'prone' : u.stance === 'crouch' ? 'kneel' : 'stand'); A.tr = A.turn = null; A.ly = A.uy = A.hy = A.fy; }
      nearPose(e, u, A, dt, now); inert(A, dt); foeFK(R, A.S, 0, WQ, WP, TW, TP); if(C.foot.on && A.mode !== 'prone') feet(A, me, sy, dt); else if(FOE.measure) for(let i = 0; i < 2; i++) PL[i] = WP[LEGS[i][2] * 3 + 1] < R.ankle + C.foot.lockH && WP[LEGS[i][3] * 3 + 1] < 0.06; foeSkin(R, WQ, WP, ND, ni * NB * 12); foeBoneRows(WQ, WP, 13, HR, 0); leftHold(A);
      if(FOE.measure && dt > 0) measure(A, dt);
      _im.toArray(NEAR.instanceMatrix.array, ni * 16); col.toArray(NEAR.instanceColor.array, ni * 3); ni++; }
    else { if(A.tier !== 2){ A.cb = null; } crowdStep(e, u, A, dt, now); const fa = frameOf(A.ca, A.ta), fb = frameOf(A.cb, A.tb), w = smooth(A.cw), o = ci * 4;
      CD[o] = fa; CD[o + 1] = fb; CD[o + 2] = w; CD[o + 3] = d2Of(me, px, pz) < sh2 ? 1 : 0; const H = R.hand; for(let q = 0; q < 12; q++) HR[q] = H[fa * 12 + q] + (H[fb * 12 + q] - H[fa * 12 + q]) * w;
      _im.toArray(CROWD.instanceMatrix.array, ci * 16); col.toArray(CROWD.instanceColor.array, ci * 3); ci++; }
    A.tier = tier; A.seen = FOE.f; u.foeF = FOE.f;
    // the rifle in his right palm, and the rig's gun joint laid on it (the muzzle, a launcher, every shot)
    _hm.set(HR[0], HR[1], HR[2], HR[3], HR[4], HR[5], HR[6], HR[7], HR[8], HR[9], HR[10], HR[11], 0, 0, 0, 1); _gm.multiplyMatrices(_im, _hm);
    if(!u.fGun) u.fGun = u.parts.find(p => p.kind === 'gun') || { o:{ visible:false } };
    if(u.fGun.o.visible && !u.droppedGun){ _gm.toArray(GUN.instanceMatrix.array, gi * 16); gi++; }
    const g = u.gun; if(g && g.parent && g.parent !== scene && !u.droppedGun){ _gm.multiply(R.gun.joint).multiply(_gq); g.parent.updateWorldMatrix(true, false); _pm.copy(g.parent.matrixWorld).invert().multiply(_gm); _pm.decompose(g.position, g.quaternion, g.scale); g.updateMatrixWorld(true); } }
  NEAR.count = ni; NEAR.instanceMatrix.needsUpdate = NEAR.instanceColor.needsUpdate = true; if(ni) NEAR.userData.ft.needsUpdate = true;
  if(CROWD){ CROWD.count = ci; CROWD.instanceMatrix.needsUpdate = CROWD.instanceColor.needsUpdate = true; if(ci) CROWD.userData.fi.needsUpdate = true; }
  GUN.count = gi; GUN.instanceMatrix.needsUpdate = true;
  FOE.near = ni; FOE.crowd = ci; const ms = performance.now() - t0; FOE.ms = ms; FOE.msSum += ms; FOE.frames++; if(ms > FOE.msMax) FOE.msMax = ms; }
const byD = (a, b) => a._fd2 - b._fd2, d2Of = (me, px, pz) => (me[12] - px) * (me[12] - px) + (me[14] - pz) * (me[14] - pz);
function shown(o){ while(o){ if(!o.visible) return false; if(o === scene) return true; o = o.parent; } return false; }
// dev: a planted foot's slide (m/s, his world: the ankle of a foot the clip has down this frame and the last — a frame he was put somewhere else is left out),
//   the bones' angular speed (deg/s) and its frame-to-frame jumps (> 600 deg/s: a pop), counted per bone
function measure(A, dt){ const M = FOE.slip || (FOE.slip = { n:0, sum:0, over:0, max:0, jn:0, jmax:0, j20:0, j10:0, bones:new Array(NB).fill(0), w:[] }), jumped = Math.hypot(A.vx, A.vz) > 12;
  for(let i = 0; i < 2; i++){ const f = LEGS[i][2], pk = 'pa' + i; _p.set(WP[f * 3], WP[f * 3 + 1], WP[f * 3 + 2]).applyMatrix4(_im);
    const P0 = A[pk] || (A[pk] = { on:false, x:0, z:0 });
    if(PL[i] && P0.on && !jumped){ const v = Math.hypot(_p.x - P0.x, _p.z - P0.z) / dt; if(v < 20){ M.n++; M.sum += v; if(v > 0.3) M.over++; if(v > M.max) M.max = v; const k = A.sp > C.gaits.still ? 'mv' : 'st'; M[k] = M[k] || [0, 0]; M[k][0]++; M[k][1] += v; } }
    P0.on = PL[i]; P0.x = _p.x; P0.z = _p.z; }
  const WW = MW; WW.set(WQ); for(let q = 0; q < PQ; q += 4) fqYaw(WW, q, A.fy);   // (in the world: his root's own turn laid on)
  if(!A.pw){ A.pw = new Float32Array(PQ); A.pv = new Float32Array(NB).fill(-1); A.pw.set(WW); return; } let j = 0, jb = 0, bb = -1;
  for(let q = 0; q < PQ; q += 4){ const d = Math.abs(A.pw[q] * WW[q] + A.pw[q + 1] * WW[q + 1] + A.pw[q + 2] * WW[q + 2] + A.pw[q + 3] * WW[q + 3]), w = 2 * Math.acos(Math.min(1, d)) * 57.3 / dt, b = q >> 2, dw = A.pv[b] >= 0 ? Math.abs(w - A.pv[b]) : 0;
    if(w > j) j = w; if(dw > jb){ jb = dw; bb = b; } A.pv[b] = w; }
  A.pw.set(WW); M.jn++; if(j > M.jmax) M.jmax = j; if(j > 1500) M.j20++; if(jb > 600){ M.j10++; M.bones[bb]++; } if(M.w.length < 4000) M.w.push(Math.round(j)); }
const MW = new Float32Array(PQ);
// a probe's look at one man's graph
export const foeState = e => e && e.mesh && e.mesh.userData.fa || null;
