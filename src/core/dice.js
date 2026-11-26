// core/dice.js — SYNC 1 TWO DICE: in a seeded battle (the daily challenge, a co-op room, ?seed) the battlefield's LAYOUT is the seed's value only.
//   The fault it ends: the builders drew their layout from Math.random, and so did everything a builder happens to make on the way — a texture or a rock
//   shape made on first use, the procedural stand-in while a model file is still loading, a soldier mesh the pool did not have — and so did three.js itself:
//   EVERY Object3D / BufferGeometry / Material / Texture / Source / Shape costs four draws for its uuid. How many of those happen depends on what the page
//   has already loaded, cached, pooled or evicted, so the same seed gave a different field on a fresh page than on a relaunch, and on the two co-op pages.
//   Four pieces, none of which does anything while Math.random is the page's own generator (every unseeded battle is exactly as it was):
//   1. A seeded generator can step BACK (data/mode-math.js modeRng, boot/safety.js: `.back(n)`, `.at()` = draws taken). three's uuid draws are handed
//      back the moment they are spent: the first write of `uuid` on a new three object (and of `_uuid` on an interleaved model's ArrayBuffer, tagged on its first
//      clone) goes through a prototype setter that makes it the plain own property it always was and rewinds the generator by what one uuid costs
//      (measured at load, checked at load: DICE.uuidProof).
//   2. cosmetic(fn, …): fn runs on the page's own generator. Put round what is made once and kept, round a fall-back mesh, round a pool that may or may
//      not have the piece — the game's own draws that are not layout (world/props.js, world/flora.js, world/regional.js, render/materials.js, …).
//   3. A size read off a MODEL must not decide a seeded layout. world/cover.js placeLone takes a container's / a wreck's box from the piece's geometry —
//      the drawn stand-in's until the real pieces (world/real-props.js) are in, theirs after: a seeded battle waits for those files under the loading
//      veil before it builds (fieldWait: bounded by FIELD_SYNC.waitMs; a file that never comes leaves the stand-in's box, as before). A giant's trunk
//      takes its scan's girth after the build, not in the middle of it (world/real-trees.js); the tracks are laid round the layout's shapes, not round
//      whatever model was drawn at that moment (world/trails.js · world/solid-shape.js planShape). DICE.building: true while a field is being built.
//   4. The build's steps, when asked (FIELD_SYNC.trace / ?fieldtrace / DICE.trace = true before a launch): campaign/mode-run.js modeSeed(k) closes a
//      step with the draws it took and a hash of the field so far; fieldSteps() gives the last build's list, fieldStepsDiff(a, b) the first step two
//      pages (or two launches) part at — by name.
import * as THREE from 'three';
import { FIELD_SYNC } from '../../config.js';
import { ARENA, FORTS, REAL_COVER, TREES, blocks, coopActive, enemies, heightAt, loadRealCover, towers } from '../hub.js';

const NATIVE = (typeof globalThis !== 'undefined' && globalThis.__rand0) || Math.random;   // the page's own generator (boot/safety.js keeps it when ?seed replaces Math.random before any module runs)
const Q = typeof location !== 'undefined' ? (location.search || '') : '';
export const DICE = { uuidDraws:0, uuidProof:false, backs:0, cos:0, trace:!!FIELD_SYNC.trace || /[?&]fieldtrace\b/.test(Q), off:/[?&]nofieldsync\b/.test(Q), building:false, open:null, cur:[], last:[] };
export function diceSeeded(){ return typeof Math.random.back === 'function'; }
// ---- 2. fn(a, b, c, d) on the page's own generator; the seeded one is back when it returns (or throws) ----
export function cosmetic(fn, a, b, c, d){ const r = Math.random; if(typeof r.back !== 'function' || !FIELD_SYNC.cosmetic || DICE.off) return fn(a, b, c, d);
  Math.random = NATIVE; DICE.cos++; try{ return fn(a, b, c, d); } finally{ Math.random = r; } }

// ---- 1. three's uuid draws handed back ----
// BODY 2 …and the id itself is then drawn AFRESH on the page's own generator. Rewound, the seeded one gave the next object the very same four draws:
//   every three object made in a row (no layout draw between) had ONE uuid — and AnimationMixer.clipAction keys its actions by the clip's: all ten of the
//   operator's clips were a single action, the horse's gaits another. In every seeded battle (the daily challenge, a co-op room, ?seed) no clip played:
//   the soldier stood, ran and lay in his rest pose (running on straight legs, "prone" bolt upright with his legs laid out behind him)
const fresh = r => { Math.random = NATIVE; try{ return THREE.MathUtils.generateUUID(); } finally{ Math.random = r; } };
const uuidSet = key => function(v){ const r = Math.random, b0 = DICE.backs; if(typeof r.back === 'function' && FIELD_SYNC.uuid && !DICE.off){ r.back(DICE.uuidDraws); DICE.backs++; }
  if(DICE.backs !== b0) v = fresh(r); Object.defineProperty(this, key, { value:v, writable:true, enumerable:true, configurable:true }); };   // (the own data property the plain write made before: later writes never come here)
const uuidTrap = (P, key) => { if(P && !Object.getOwnPropertyDescriptor(P, key)) Object.defineProperty(P, key, { configurable:true, enumerable:false, get(){ return undefined; }, set:uuidSet(key) }); };
function uuidHook(){ let n = 0; const r = Math.random;
  Math.random = () => { n++; return 0.5; }; try{ new THREE.BufferGeometry(); } finally{ Math.random = r; }   // what one uuid costs in this three (r169: 4)
  DICE.uuidDraws = n; if(!n) return;
  for(const k of FIELD_SYNC.uuidOf) uuidTrap(THREE[k] && THREE[k].prototype, 'uuid');
  if(FIELD_SYNC.uuidBuf) uuidTrap(ArrayBuffer.prototype, '_uuid');   // (InterleavedBuffer.clone / .toJSON tag the buffer itself, on its first clone only: `array.buffer._uuid = generateUUID()`)
  // the check: a seeded generator is where it was after one of each is made
  const mk = () => { let a = 7, c = 0; const f = () => { c++; a = a + 0x6D2B79F5 | 0; return (a >>> 0) / 4294967296; }; f.back = k => { c -= k; a = a - Math.imul(k, 0x6D2B79F5) | 0; }; f.at = () => c; return f; }, g = mk();
  Math.random = g; try{ const o = new THREE.Object3D(), b = new THREE.BufferGeometry(), m = new THREE.MeshBasicMaterial(), t = new THREE.Texture(), ib = new THREE.InterleavedBuffer(new Float32Array(4), 2), ic = ib.clone({});
    DICE.uuidProof = (!FIELD_SYNC.uuid || DICE.off || g.at() === 0) && [o, b, m, t, t.source, ib, ic, ib.array.buffer].every(x => { const u = x instanceof ArrayBuffer ? x._uuid : x.uuid; return typeof u === 'string' && u.length === 36 && Object.prototype.hasOwnProperty.call(x, x instanceof ArrayBuffer ? '_uuid' : 'uuid'); }); m.dispose(); t.dispose(); b.dispose(); }
  finally{ Math.random = r; } DICE.backs = 0; }
try{ uuidHook(); }catch(e){ console.warn('[dice] uuid hook not set:', e && e.message); }

// ---- 3. a seeded battle waits for the real cover pieces (game/flow.js launchGame): null = no wait ----
export function fieldWait(run){ if(DICE.off || !(FIELD_SYNC.waitMs > 0) || REAL_COVER.done || typeof window === 'undefined') return null;
  if(!(globalThis.__seed > 0 || coopActive() || (run && typeof run === 'object' && run.daily))) return null;
  return Promise.race([loadRealCover(), new Promise(ok => setTimeout(ok, FIELD_SYNC.waitMs))]).catch(() => {}); }

// ---- 4. the build's steps, when asked ----
const hs = (h, v) => Math.imul(h ^ (v | 0), 16777619) >>> 0;
// what is where: the heights, every block that is not a gate (place, kind, size, hit points), the towers, the forts, the trees' count
//   (k: the step just done — a list the build has not reached yet still holds the LAST battle's, and is left out: FIELD_SYNC.from)
export function fieldHash(k){ let h = 2166136261; const n = 16, R = ARENA * 0.9, F = FIELD_SYNC.from; if(k == null) k = FIELD_SYNC.last;
  for(let i = 0; i < n; i++) for(let j = 0; j < n; j++) h = hs(h, Math.round(heightAt((i / (n - 1) * 2 - 1) * R, (j / (n - 1) * 2 - 1) * R) * 20));
  if(k >= F.blocks) for(let i = 0; i < blocks.length; i++){ const b = blocks[i], kd = String(b.kind || ''); if(kd === 'gate') continue; h = hs(h, Math.round(b.x * 10)); h = hs(h, Math.round(b.z * 10)); h = hs(h, Math.round((b.r || 0) * 100)); h = hs(h, Math.round(b.maxHp || 0)); for(let c = 0; c < kd.length; c++) h = hs(h, kd.charCodeAt(c)); }
  if(k >= F.towers){ h = hs(h, towers.length); for(let i = 0; i < towers.length; i++){ h = hs(h, Math.round(towers[i].x * 10)); h = hs(h, Math.round(towers[i].z * 10)); } }
  if(k >= F.forts){ h = hs(h, FORTS.length); for(let i = 0; i < FORTS.length; i++){ h = hs(h, Math.round(FORTS[i].x * 10)); h = hs(h, Math.round(FORTS[i].z * 10)); } }
  return k >= F.trees ? hs(h, TREES.length) : h; }
const drawsAt = () => typeof Math.random.at === 'function' ? Math.random.at() : -1;
// modeSeed(k) calls it twice: before the step's seed is set (the step before is closed: its draws, the field's hash now) and after (the count starts)
export function fieldMark(k, after){ const D = DICE; D.building = k < FIELD_SYNC.last; if(!D.trace) return;   // (building: campaign/entries.js — a garrison placed while a field is built stands at its post)
  if(after){ D.open = { k, base:drawsAt() }; return; }
  if(k === 1){ D.cur = []; D.open = null; }
  if(D.open){ const a = drawsAt(), o = D.open; D.cur.push({ k:o.k, name:FIELD_SYNC.steps[o.k] || '', draws:a >= 0 && o.base >= 0 ? a - o.base : -1, hash:fieldHash(o.k).toString(16), blocks:o.k >= FIELD_SYNC.from.blocks ? blocks.length : 0, men:enemies.length }); D.open = null; }
  if(k >= FIELD_SYNC.last){ D.last = D.cur; D.cur = []; } }
export function fieldSteps(){ return DICE.last.map(s => Object.assign({}, s)); }
// the first step two lists part at (null = the same): { k, name, a, b } — a hash that differs names the builder, draws alone that differ name a cosmetic draw still on the seeded dice
export function fieldStepsDiff(A, B){ const n = Math.max(A.length, B.length);
  for(let i = 0; i < n; i++){ const a = A[i], b = B[i]; if(!a || !b || a.k !== b.k || a.hash !== b.hash) return { k:(a || b).k, name:(a || b).name, why:'field', a:a || null, b:b || null }; }
  for(let i = 0; i < n; i++){ const a = A[i], b = B[i]; if(a.draws !== b.draws) return { k:a.k, name:a.name, why:'draws', a, b }; }
  return null; }
