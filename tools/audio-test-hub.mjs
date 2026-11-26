// tools/audio-test-hub.mjs — AUDIO 1 the hub as src/audio/afx*.js sees it inside tools/audio-test.mjs (Node, no page): the REAL maths and the REAL layer,
//   and a stand-in for everything else they import — the context (a fake one, set by the test), the player, the bank, the world's ground and walls.
//   T holds what the test sets and reads. Nothing here is loaded by the game.
export * from '../src/audio/afx-math.js';
export * from '../src/audio/afx.js';

export const T = { clear:() => true, lines:0, wade:() => 1, paved:() => false, sfx:[], samples:true, bank:true, floats:[], radios:[] };
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
export function heightAt(){ return 0; }
export function lineClear(ax, ay, az, bx, by, bz){ T.lines++; return T.clear(bx, bz, ax, az); }
export function wadeAt(x, z){ return T.wade(x, z); }
export function onPaved(x, z){ return T.paved(x, z); }
