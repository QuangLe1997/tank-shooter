// dev/gltf-trace.js — GLTF 1 THE MODEL LOADER'S BLOB LEDGER (dev only, asleep unless ?gltftrace): every blob: URL made and revoked, every embedded
//   picture's load (which file, which reader — the KTX2 transcoder or the plain image reader — its start, end and the reader's own error), every model
//   file's fetch, every texture dispose and the asset diet's heap releases, each stamped with the battle phase (S.mode · battle n · sector i). A failed
//   picture is kept whole with what was live around it (open blobs, the transcoder's queue, the heap). Probes read gltfTraceReport().
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { DIET_STATE, S, SECT } from '../hub.js';

const ON = typeof window !== 'undefined' && /[?&]gltftrace\b/.test(location.search);
const T = { on:ON, battles:0, mode:'', ev:[], blobs:new Map(), files:new Map(), fails:[], n:{ blob:0, revoke:0, revokeEarly:0, img:0, ktx2:0, ok:0, fail:0, glb:0, glbTwin:0, dispose:0, disposeDiet:0, blobMB:0 }, pend:[] };
export const GLTFTRACE = T;
const now = () => Math.round(performance.now());
const ph = () => (S.mode || '?') + '·b' + T.battles + (SECT && SECT.on ? '·s' + SECT.i : '');
const short = u => String(u).replace(/^blob:[^/]*\/\/[^/]+\//, '').slice(0, 8);
const ev = (k, o) => { T.ev.push(Object.assign({ t:now(), k, ph:ph() }, o)); if(T.ev.length > 600) T.ev.splice(0, 100); };
const who = () => (new Error().stack || '').split('\n').slice(3, 9).map(l => (l.match(/(src\/[\w/-]+\.js|examples\/jsm\/[\w/]+\.js|three\.module\.js):(\d+)/) || [])[0]).filter(Boolean).slice(0, 4).join(' < ');
const live = () => { let open = 0; for(const b of T.blobs.values()) if(b.pic && !b.end) open++; return open; };
let CUR = null, K2 = null;
function errOf(e){ if(e == null) return String(e); if(typeof e === 'string') return e; return (e.name || '') + ': ' + (e.message || (e.error ?? '') || JSON.stringify(e).slice(0, 120)); }
function settle(u, ok, e){ const b = T.blobs.get(u); if(!b || b.end) return; b.end = now(); b.ok = ok; if(ok){ T.n.ok++; return; } T.n.fail++; b.err = errOf(e);
  const W = K2 && K2.workerPool; T.fails.push({ t:b.end, ph:ph(), blob:short(u), file:b.file, img:b.img, kind:b.kind, type:b.type, size:b.size, age:b.end - b.at, revoked:b.rev ? b.rev - b.at : null, revBy:b.revBy || null,
    err:b.err, open:live(), queue:W ? W.queue.length : null, busy:W ? W.workerStatus : null, heapMB:performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, diet:Object.assign({}, DIET_STATE), recent:T.ev.slice(-14).map(q => q.t + ' ' + q.k + ' ' + (q.f || q.u || '') + ' ' + q.ph) }); }
if(ON){
  const mk = URL.createObjectURL.bind(URL), rv = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function(o){ const u = mk(o); T.n.blob++; T.n.blobMB += (o && o.size || 0) / 1048576; const m = o && o.type || '', P = T.pend.findIndex(q => q.type === m && q.size === (o && o.size)), q = P >= 0 ? T.pend.splice(P, 1)[0] : null;
    T.blobs.set(u, { at:now(), ph:ph(), size:o && o.size, type:m, file:q ? q.file : null, img:q ? q.img : null, pic:!!q || /^image\//.test(m), by:q ? null : who() }); ev('blob', { u:short(u), f:q && q.file }); return u; };
  URL.revokeObjectURL = function(u){ const b = T.blobs.get(u); T.n.revoke++; if(b){ b.rev = now(); if(b.pic && !b.end){ T.n.revokeEarly++; b.revBy = who(); ev('revokeEarly', { u:short(u), f:b.file, by:b.revBy }); } } return rv(u); };
  const wrapLoad = (C, kind) => { const L0 = C.prototype.load; C.prototype.load = function(url, onLoad, onProg, onErr){ const b = T.blobs.get(url); if(b){ b.kind = kind; b.start = now(); T.n[kind === 'ktx2' ? 'ktx2' : 'img']++; }
    return L0.call(this, url, x => { settle(url, true); return onLoad && onLoad(x); }, onProg, e => { settle(url, false, e); return onErr && onErr(e); }); }; };
  wrapLoad(THREE.ImageBitmapLoader, 'img'); wrapLoad(THREE.ImageLoader, 'img0'); wrapLoad(KTX2Loader, 'ktx2');
  const I0 = KTX2Loader.prototype.init; KTX2Loader.prototype.init = function(){ K2 = this; return I0.call(this); };
  const CF = KTX2Loader.prototype._createTextureFrom; KTX2Loader.prototype._createTextureFrom = function(r, c){ if(r && r.type === 'error') ev('ktx2err', { u:String(r.error).slice(0, 120) }); return CF.call(this, r, c); };
  const FL = THREE.FileLoader.prototype.load; THREE.FileLoader.prototype.load = function(url, onLoad, onProg, onErr){ const glb = /\.glb(\?|$)/.test(url); if(!glb) return FL.call(this, url, onLoad, onProg, onErr);
    const F = T.files.get(url) || { n:0, live:0 }; T.files.set(url, F); F.n++; F.live++; T.n.glb++; if(F.live > 1){ T.n.glbTwin++; ev('glbTwin', { f:url }); } ev('glb', { f:url });
    return FL.call(this, url, d => { F.live--; const p = CUR; CUR = url; try{ return onLoad && onLoad(d); } finally { CUR = p; } }, onProg, e => { F.live--; ev('glbFail', { f:url, u:errOf(e) }); return onErr && onErr(e); }); };
  const PA = GLTFLoader.prototype.parse; GLTFLoader.prototype.parse = function(data, path, onLoad, onErr){ if(!this.__trace){ this.__trace = 1; this.register(p => { const file = CUR; const LIS = p.loadImageSource;
    p.loadImageSource = function(si, loader){ const d = p.json.images[si], v = d && d.bufferView != null ? p.json.bufferViews[d.bufferView] : null; if(v && this.sourceCache[si] === undefined) T.pend.push({ file:(file || '?').split('/').slice(-2).join('/'), img:si, type:d.mimeType, size:v.byteLength }); if(T.pend.length > 200) T.pend.splice(0, 100); return LIS.call(this, si, loader); };   // (blobless pictures make no blob to claim theirs)
    return { name:'GLTF_TRACE' }; }); } return PA.call(this, data, path, onLoad, onErr); };
  const TD = THREE.Texture.prototype.dispose; THREE.Texture.prototype.dispose = function(){ T.n.dispose++; if(this.source && this.source.diet){ T.n.disposeDiet++; if(T.n.disposeDiet % 25 === 1) ev('disposeDiet', { f:this.source.diet.url }); } return TD.call(this); };
  const CE = console.error.bind(console); console.error = function(...a){ if(/Couldn't load texture/.test(String(a[0]))) ev('gltfErr', { u:short(a[1]) }); return CE(...a); };
  setInterval(() => { const m = S.mode || ''; if(m !== T.mode){ if(m === 'playing' && T.mode !== 'paused' && T.mode !== 'dying') T.battles++; ev('mode', { u:T.mode + '>' + m }); T.mode = m; } }, 100);
}
// (probes) how many MB of new Blobs this page can still make before a blob: URL fails to fetch (8 MB each, up to max): Chrome's live-blob headroom
export async function blobHeadroom(max = 1600){ const ab = new Uint8Array(8 << 20); let mb = 0; for(; mb < max; mb += 8){ const u = URL.createObjectURL(new Blob([ab])); try{ await (await fetch(u)).arrayBuffer(); }catch(e){ URL.revokeObjectURL(u); return mb; } URL.revokeObjectURL(u); } return mb; }
// (probes) the counts, every failure in full, the early revokes and the files fetched while a copy was still on its way
export function gltfTraceReport(){ const open = []; for(const [u, b] of T.blobs) if(b.pic && !b.end && now() - b.at > 4000) open.push([short(u), b.file, b.kind || '-', now() - b.at]);
  T.n.blobMB = Math.round(T.n.blobMB); return { on:T.on, n:T.n, battles:T.battles, fails:T.fails, stuck:open.slice(0, 8), early:T.ev.filter(q => q.k === 'revokeEarly' || q.k === 'ktx2err' || q.k === 'glbFail').slice(0, 12), twins:T.ev.filter(q => q.k === 'glbTwin').slice(0, 8).map(q => q.f + ' ' + q.ph) }; }
