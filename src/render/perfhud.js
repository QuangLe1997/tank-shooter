// render/perfhud.js — Z240 PERFORMANCE PROBE + HUD: per-frame logic / draw-submit / GPU time (EXT_disjoint_timer_query_webgl2), worst frame, draw calls, triangles, render scale; F3 or ?perf shows it
import { PERF_HUD, PERF_SPLIT } from '../../config.js';
import { AO, S, VIEW, detailCulled, renderer } from '../hub.js';

// ring buffers of the last PERF_HUD.n frames (ms)
const N=PERF_HUD.n, ring=()=>({ a:new Float32Array(N), i:0, k:0 });
export const PH = { on:/[?&]perf\b/.test(location.search), t0:0, tR:0, frm:ring(), upd:ring(), ren:ring(), gpu:ring(), calls:0, tris:0, el:null, at:0, gl:null, ext:null, pend:[], live:null, long:[], t1:0, pc:0 };   // SPLIT 2 (A6) long: the fight's long frames [s since it began, ms, logic ms, draw-submit ms, programs, textures, geometries, the shaders new since the last frame]
function push(r, v){ r.a[r.i]=v; r.i=(r.i+1)%N; if(r.k<N) r.k++; }
export function perfAvg(r, last){ const n=Math.min(r.k, last||N); if(!n) return -1; let s=0; for(let j=1;j<=n;j++) s+=r.a[(r.i-j+N)%N]; return s/n; }
function perfMax(r){ let m=0; for(let j=0;j<r.k;j++) m=Math.max(m, r.a[j]); return m; }
// GPU time of the whole frame — read back a few frames later (never stalls the pipeline); -1 where the browser has no timer queries
function gpuInit(){ if(PH.gl) return; PH.gl=renderer.getContext(); try{ PH.ext=PH.gl.getExtension('EXT_disjoint_timer_query_webgl2'); }catch(e){ PH.ext=null; } }
function gpuBegin(){ gpuInit(); const gl=PH.gl, X=PH.ext; if(!X || PH.live || PH.pend.length>=4) return; const q=gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q); PH.live=q; }
function gpuEnd(){ const gl=PH.gl, X=PH.ext; if(!X) return;
  if(PH.live){ gl.endQuery(X.TIME_ELAPSED_EXT); PH.pend.push(PH.live); PH.live=null; }
  while(PH.pend.length){ const q=PH.pend[0]; if(!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; const bad=gl.getParameter(X.GPU_DISJOINT_EXT);
    if(!bad) push(PH.gpu, gl.getQueryParameter(q, gl.QUERY_RESULT)/1e6); gl.deleteQuery(q); PH.pend.shift(); } }
// called by game/loop.js: frame start · just before composer.render() · after it
export function perfFrameBegin(){ PH.t0=performance.now(); if(PH.on){ renderer.info.autoReset=false; renderer.info.reset(); } gpuBegin(); }
export function perfRenderBegin(){ PH.tR=performance.now(); }
export function perfFrameEnd(dtMs){ const t=performance.now(); push(PH.upd, PH.tR-PH.t0); push(PH.ren, t-PH.tR); if(dtMs>0) push(PH.frm, dtMs); gpuEnd();
  if(S.mode==='playing'){ if(!PH.t1){ PH.t1=t; PH.long.length=0; } if((dtMs>PERF_SPLIT.hitchMs || t-PH.t0>PERF_SPLIT.hitchMs) && PH.long.length<PERF_SPLIT.hitchKeep){ /* the gap before this frame, or this frame's own work */ const I=renderer.info, P=I.programs||[]; PH.long.push([+((t-PH.t1)/1000).toFixed(2), Math.round(dtMs), Math.round(PH.tR-PH.t0), Math.round(t-PH.tR), P.length, I.memory.textures, I.memory.geometries, P.length>PH.pc ? P.slice(PH.pc).map(q=>q.name).join(',').slice(0,90) : '']); } PH.pc=(renderer.info.programs||[]).length; } else if(S.mode==='countdown'||S.mode==='intro'){ PH.t1=0; PH.pc=(renderer.info.programs||[]).length; }   // SPLIT 4 frame 1 names only what it builds   // SPLIT 2 (A6) every hitch of a fight, from its first frame
  if(PH.on){ PH.calls=renderer.info.render.calls; PH.tris=renderer.info.render.triangles; renderer.info.autoReset=true; if(t>PH.at){ PH.at=t+PERF_HUD.every*1000; perfDraw(); } } }
export function perfGpuMs(last){ return perfAvg(PH.gpu, last); }
export function perfFrameMs(last){ return perfAvg(PH.frm, last); }
const col=(ms)=>ms<0 ? '#8a8a80' : ms<=PERF_HUD.good ? '#9be04a' : ms<=PERF_HUD.warn ? '#ffcf5a' : '#ff6a4a';
const f1=v=>v<0 ? '—' : v.toFixed(1);
export function perfDraw(){ let el=PH.el; if(!el){ el=PH.el=document.createElement('div'); el.id='perfHud'; document.body.appendChild(el); }
  const fr=perfAvg(PH.frm), worst=perfMax(PH.frm), up=perfAvg(PH.upd), rn=perfAvg(PH.ren), gp=perfAvg(PH.gpu), px=Math.round(VIEW.w*VIEW.h*S.dpr*S.dpr/1e4)/100;
  el.innerHTML=`<b style="color:${col(fr)}">${fr>0?Math.round(1000/fr):'—'} FPS</b> · khung ${f1(fr)} ms · <span style="color:${col(worst)}">tệ nhất ${f1(worst)}</span>`
    +`<br>logic <span style="color:${col(up*2)}">${f1(up)}</span> · gửi lệnh vẽ ${f1(rn)} · GPU <span style="color:${col(gp)}">${f1(gp)}</span> ms`
    +`<br>${PH.calls} lệnh vẽ · ${(PH.tris/1e6).toFixed(2)} M tam giác · ẩn xa ${detailCulled()}`
    +`<br>độ phân giải ×${S.dpr.toFixed(2)} (${px} MP) · AO ${AO.on?'bật':'tắt'}`;
  el.style.display='block'; }
export function perfToggle(){ PH.on=!PH.on; if(PH.on){ PH.at=0; perfDraw(); } else if(PH.el) PH.el.style.display='none'; }
addEventListener('keydown', e=>{ if(e.key==='F3'){ e.preventDefault(); perfToggle(); } });
