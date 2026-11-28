// tools/audio-test-hub.mjs — AUDIO 1 the hub as src/audio/afx*.js sees it inside tools/audio-test.mjs (Node, no page): the REAL maths and the REAL layer,
//   and a stand-in for everything else they import — the context (a fake one, set by the test), the player, the bank, the world's ground and walls.
//   T holds what the test sets and reads. Nothing here is loaded by the game.
export * from '../src/audio/afx-math.js';
export * from '../src/audio/afx.js';
export * from '../src/audio/afx-space.js';
export * from '../src/audio/afx-move.js';
export * from '../src/audio/afx-mix.js';

export const T = { clear:() => true, lines:0, wade:() => 1, paved:() => false, sfx:[], samples:true, bank:true, floats:[], radios:[], hit:() => null, rays:0, high:() => 0, roof:false, men:[], duel:false, squad:[], floatAt:null };
export let actx = null, master = null, duck = null, verbSend = null, muted = false, musicBus = null, limiter = null;
export function __ctx(c){ actx = c; master = duck = verbSend = musicBus = limiter = null; if(!c) return;
  limiter = c.createDynamicsCompressor(); limiter.connect(c.destination); master = c.createGain(); master.connect(limiter); duck = c.createGain(); duck.connect(master);
  verbSend = c.createGain(); verbSend.connect(master); musicBus = c.createGain(); musicBus.connect(master); }
export function __muted(v){ muted = v; }
export function audio(){ return actx; }
export const MOBILE = false, PROFILE = {}, S = { player:null, mode:'playing', stage:1 }, LOUD = { shot:0, big:0 }, BIOME = { name:'DESERT', cave:0 }, RIVER = { on:false, bridges:[] };
export const camera = { matrixWorld:{ elements:[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };   // (looking down −z: its right is +x)
// the bank: every key the layer asks for, a second of "recording" each
export const SND = new Proxy({}, { get:(o, k) => o[k] || (o[k] = { g:k === 'bigboom' || k === 'boom' || k === 'cannon' ? 0.8 : 0.3, big:k === 'bigboom' || k === 'boom' || k === 'cannon' ? 1 : 0, gap:0.03 }) });
const _bufs = {};
const one = k => actx ? _bufs[k] || (_bufs[k] = actx.createBuffer(1, Math.round(actx.sampleRate * (k === 'bigboom' ? 2.5 : 0.5)), actx.sampleRate)) : null;
export function sampleGet(k){ return T.samples ? one(k) : null; }
export function bankGet(k){ return T.bank ? one(k) : null; }
export function sfx(name, pos, vol){ T.sfx.push(name); }
export function heightAt(x, z){ return T.high(x, z); }
const _hit = { bl:{ kind:'fortwall' }, t:0 };
export function lineHit(ax, ay, az, bx, by, bz, pad, over, skip){ T.rays++; const t = T.hit(ax, az, bx, bz); if(t == null || skip && skip(_hit.bl)) return null; _hit.t = t; return _hit; }
export function underActive(){ return T.roof; }
export function underInside(){ return T.roof; }
export const CV = { mounted:false, stance:'stand', jump:null, roll:null }, FT = [], UGRID = { inf:new Map() };
export function unitsNear(M, x, z, r, out){ out.length = 0; for(const m of T.men) out.push(m); return out; }
export function lineClear(ax, ay, az, bx, by, bz){ T.lines++; return T.clear(bx, bz, ax, az); }
export function wadeAt(x, z){ return T.wade(x, z); }
export const DIR = { on:false, phase:'build', P:0, fin:0, near:0, flank:null }, NADES = [], VOICE = { playing:null };
export function duelOn(){ return T.duel; }
export function squadList(){ return T.squad; }
export function banterBark(k){ (T.barked || (T.barked = [])).push(k); return !!T.voiced; }   // FEEL 4 a squad call spoken when its takes are loaded (T.voiced) — the text then stays off
export function sfxLevel(){ return 0.5; }
export function floatText(text, color, pos, size){ T.floats.push(text); T.floatAt = { x:pos.x, y:pos.y, z:pos.z }; }
export function radio(msg){ T.radios.push(msg); radio.at = 0; }
export function onPaved(x, z){ return T.paved(x, z); }
