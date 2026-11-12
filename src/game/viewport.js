// game/viewport.js — Z103 split from game/loop.js: canvas/render-target sizing, the soft-keyboard guard, landscape gate,
// and the resize / orientation / fullscreen / visualViewport listeners.
import { BLOOM_SCALE, MOBILE, S, VIEW, bloom, camera, composer, renderer, shopCam, togglePause } from '../hub.js';

export function doResize(force){
  const c=renderer.domElement;
  const w=Math.max(1, c.clientWidth||innerWidth), h=Math.max(1, c.clientHeight||innerHeight);   // the canvas box, not innerWidth/innerHeight
  if(!force && w===VIEW.w && h===VIEW.h) return;   // mobile fires resize continuously while the URL bar slides — reallocating
  VIEW.w=w; VIEW.h=h;                              // the render targets on every one of those was a guaranteed hitch
  camera.aspect = w/h; camera.updateProjectionMatrix();
  if(typeof shopCam!=='undefined'){ shopCam.aspect = w/h; shopCam.updateProjectionMatrix(); }   // keep the 3D shop camera in sync
  renderer.setSize(w, h, false); composer.setSize(w, h);   // buffer follows the viewport; CSS keeps the canvas full-screen
  if(bloom && bloom.setSize) bloom.setSize(Math.round(w*BLOOM_SCALE), Math.round(h*BLOOM_SCALE));
}
export let _rsT=0;
export function queueResize(){ if(document.body.classList.contains('typing')) return; clearTimeout(_rsT); _rsT=setTimeout(()=>doResize(), 150); }   // Z97: the soft keyboard must not re-allocate the 3D canvas   // refit once the size SETTLES — iOS fires
// resize/visualViewport-resize on every frame of a URL-bar slide, and re-allocating the render targets that often flickers
// mobile is landscape-only: auto-pause if rotated to portrait (the #rotate gate covers the screen via CSS)
export function checkOrientation(){ _readOrient(); if(MOBILE && ORIENT.portrait && S.mode==='playing') togglePause(); }
export const PLAY_MODES = { playing:1, paused:1, intro:1, dying:1, countdown:1 };   // modes that need landscape; menus/game-over do not
// Z107: orientation is cached on resize — reading innerWidth/innerHeight every frame forced a style/layout flush (3% of a phone frame)
export const ORIENT = { portrait: innerHeight > innerWidth };
export function _readOrient(){ ORIENT.portrait = innerHeight > innerWidth; }
export function gated(){ return document.hidden || (MOBILE && ORIENT.portrait && !!PLAY_MODES[S.mode]); }   // nothing to draw behind the rotate gate
addEventListener('resize', ()=>{ queueResize(); checkOrientation(); });
// the mobile viewport keeps changing AFTER load (toolbar hide, fullscreen, orientation lock) — refit when it settles
addEventListener('orientationchange', ()=>{ _readOrient(); setTimeout(()=>{ queueResize(); checkOrientation(); }, 250); setTimeout(()=>{ _readOrient(); queueResize(); }, 650); });
document.addEventListener('fullscreenchange', ()=>setTimeout(queueResize, 150));
document.addEventListener('webkitfullscreenchange', ()=>setTimeout(queueResize, 150));
if(window.visualViewport) window.visualViewport.addEventListener('resize', ()=>{ _readOrient(); queueResize(); });
