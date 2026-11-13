// ui/gunart.js — Z150 ONE PICTURE PER GUN, EVERYWHERE: the shop cases, the KHO SÚNG cards, the battle HUD, the deploy list and the
//   "new gun" card all show the same studio photo of the gun's REAL 3D barrel assembly (the very model mounted on your tank), rendered
//   once per gun (and again when its look grade rises with mastery / parts). Transparent background, auto-cropped so every gun fills
//   its frame the same way. Rendered off-screen in idle time, one gun per slice → never a hitch.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VIP_GUNS } from '../../config.js';
import { GUNS, MOBILE, barrelGrade, buildTank, disposeBarrel, makeGunBarrel, renderer, svgMarkup } from '../hub.js';

export const GUNART = { cache:{}, queue:[], busy:false, scene:null, cam:null, rt:null, float:false };
const OW = MOBILE ? 240 : 320, OH = Math.round(OW*0.46), SS = 2, RW = OW*SS, RH = OH*SS;
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
export function gunArtKey(id){ let gr=0; try{ gr=barrelGrade(id); }catch(e){} return id+':'+gr; }
function stage(){ if(GUNART.scene) return;
  const s=new THREE.Scene(), pm=new THREE.PMREMGenerator(renderer); s.environment=pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); s.environmentIntensity=0.9;
  s.add(new THREE.HemisphereLight(0xfff4e0, 0x30302a, 0.7));
  const key=new THREE.DirectionalLight(0xfff0d8, 2.6); key.position.set(-4, 6, 5); s.add(key);
  const rim=new THREE.DirectionalLight(0xbfd8ff, 1.6); rim.position.set(5, 3, -6); s.add(rim);
  GUNART.scene=s; GUNART.cam=new THREE.PerspectiveCamera(18, RW/RH, 0.1, 200);
  GUNART.float = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
  GUNART.rt=new THREE.WebGLRenderTarget(RW, RH, { type: GUNART.float ? THREE.FloatType : THREE.UnsignedByteType });
  GUNART.buf = GUNART.float ? new Float32Array(RW*RH*4) : new Uint8Array(RW*RH*4); }
const _box=new THREE.Box3(), _c=new THREE.Vector3(), _sz=new THREE.Vector3(), _vp=new THREE.Vector4(), _cc=new THREE.Color();
// linear HDR → filmic (ACES fit) → sRGB, done here because a render target skips the renderer's own tone mapping
const aces=x=>{ x*=1.05; return Math.max(0, Math.min(1, (x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14))); };
const srgb=x=>x<=0.0031308 ? x*12.92 : 1.055*Math.pow(x, 1/2.4)-0.055;
let _lutF=null; function lutF(){ if(_lutF) return _lutF; _lutF=new Uint8ClampedArray(4096); for(let i=0;i<4096;i++) _lutF[i]=Math.round(srgb(aces(i/1024))*255); return _lutF; }   // linear 0..4 → display byte
let _lut=null; function lut8(){ if(_lut) return _lut; _lut=new Uint8ClampedArray(256); for(let i=0;i<256;i++) _lut[i]=Math.round(srgb(aces(i/255))*255); return _lut; }
function renderGun(id){ const root=new THREE.Group(), g=makeGunBarrel(id); root.add(g); if(g.userData.mount) root.add(g.userData.mount); root.rotation.y=Math.PI/2;
  const url=renderObject(root, new THREE.Vector3(-0.32, 0.42, 1), 0.62); disposeBarrel(g); if(g.userData.mount) disposeBarrel(g.userData.mount); return url; }
// Z155 a studio photo of any object (tank models for the garage use it too); dir = where the camera sits, k = framing tightness
export function renderObject(root, dir, k, ow, oh){ stage(); const S=GUNART.scene, cam=GUNART.cam; const OWr=ow||OW, OHr=oh||OH;
  S.add(root); root.updateMatrixWorld(true);
  _box.setFromObject(root); _box.getCenter(_c); _box.getSize(_sz); const r=_sz.length()*0.5;
  dir=dir.clone().normalize(); const d=r/Math.sin(THREE.MathUtils.degToRad(cam.fov)*0.5)*(k||0.62);
  cam.position.copy(_c).addScaledVector(dir, d); cam.lookAt(_c); cam.near=d*0.2; cam.far=d*3; cam.updateProjectionMatrix();
  const prevT=renderer.getRenderTarget(); renderer.getViewport(_vp); renderer.getClearColor(_cc); const prevA=renderer.getClearAlpha();
  renderer.setRenderTarget(GUNART.rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(S, cam);
  renderer.readRenderTargetPixels(GUNART.rt, 0, 0, RW, RH, GUNART.buf);
  renderer.setRenderTarget(prevT); renderer.setViewport(_vp); renderer.setClearColor(_cc, prevA);
  S.remove(root);
  // pixels (bottom-up) → canvas, tone-mapped, and the bounding box of what was drawn
  const B=GUNART.buf, cv=document.createElement('canvas'); cv.width=RW; cv.height=RH; const x=cv.getContext('2d'), im=x.createImageData(RW, RH), D=im.data, L=lut8(), F=lutF(), q=v=>F[Math.min(4095, Math.max(0, v*1024)|0)];
  let x0=RW, y0=RH, x1=-1, y1=-1;
  for(let yy=0; yy<RH; yy++){ const sy=RH-1-yy; for(let xx=0; xx<RW; xx++){ const s=(sy*RW+xx)*4, o=(yy*RW+xx)*4; let a=B[s+3];
      if(GUNART.float){ a=Math.max(0,Math.min(1,a)); D[o]=q(B[s]); D[o+1]=q(B[s+1]); D[o+2]=q(B[s+2]); D[o+3]=a*255; if(a>0.04){ if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(yy<y0)y0=yy; if(yy>y1)y1=yy; } }
      else { D[o]=L[B[s]]; D[o+1]=L[B[s+1]]; D[o+2]=L[B[s+2]]; D[o+3]=a; if(a>10){ if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(yy<y0)y0=yy; if(yy>y1)y1=yy; } } } }
  x.putImageData(im, 0, 0);
  if(x1<0){ x0=0; y0=0; x1=RW-1; y1=RH-1; }
  // fit the drawn gun into the output frame with a little air round it (same framing for every gun)
  const out=document.createElement('canvas'); out.width=OWr; out.height=OHr; const o=out.getContext('2d'); o.imageSmoothingEnabled=true; o.imageSmoothingQuality='high';
  const cw=x1-x0+1, ch=y1-y0+1, pad=0.06, kk=Math.min(OWr*(1-2*pad)/cw, OHr*(1-2*pad)/ch), dw=cw*kk, dh=ch*kk;
  o.shadowColor='rgba(0,0,0,0.55)'; o.shadowBlur=OWr*0.025; o.shadowOffsetY=OWr*0.012;   // a soft drop shadow lifts it off any card
  o.drawImage(cv, x0, y0, cw, ch, (OWr-dw)/2, (OHr-dh)/2, dw, dh);
  return out.toDataURL('image/png'); }
function pump(){ if(GUNART.busy) return; const id=GUNART.queue.shift(); if(!id) return; GUNART.busy=true;
  const go=()=>{ const key=gunArtKey(id); try{ if(!GUNART.cache[key]){ GUNART.cache[key]=renderGun(id); } paint(id); }catch(e){ console.warn('gun art', id, e); GUNART.cache[key]=GUNART.cache[key]||''; }
    GUNART.busy=false; if(GUNART.queue.length) pump(); };
  (window.requestIdleCallback||((f)=>setTimeout(f,30)))(go, { timeout:400 }); }
// every <img data-gunpic="id"> on the page picks up the photo as soon as it exists
function paint(id){ const url=GUNART.cache[gunArtKey(id)]; if(!url) return; document.querySelectorAll('img[data-gunpic="'+id+'"]').forEach(im=>{ if(im.src!==url) im.src=url; im.classList.add('ok'); }); }
export function queueGunArt(ids){ for(const id of ids){ if(!GUNS[id] || GUNART.cache[gunArtKey(id)] || GUNART.queue.includes(id)) continue; GUNART.queue.push(id); } pump(); }
export function gunArtURL(id){ const u=GUNART.cache[gunArtKey(id)]; if(u==null) queueGunArt([id]); return u||''; }
// markup for a gun picture: the photo once ready, the gun's line icon underneath until then (never an empty box)
export function gunPicHTML(id, cls){ const u=gunArtURL(id), g=GUNS[id]||{};
  return '<span class="gunpic '+(cls||'')+'"><i class="gp-ic">'+svgMarkup(g.svg||'gun')+'</i><img data-gunpic="'+id+'" class="'+(u?'ok':'')+'" alt="'+(g.name||'')+'" src="'+(u||BLANK)+'"></span>'; }
export function gunPicEl(id, cls){ const t=document.createElement('template'); t.innerHTML=gunPicHTML(id, cls); return t.content.firstChild; }
// the tier tag every screen prints for a gun (shop case, arsenal card, new-gun card)
export function gunTierTx(id){ return VIP_GUNS.includes(id) ? 'VIP ◆' : 'BẬC '+((GUNS[id]||{}).tier||1); }
// warm the cache for every gun right after boot, in idle slices (the shop and the arsenal then open with photos already there)
export function warmGunArt(){ queueGunArt(Object.keys(GUNS)); }

// ---- Z155 tank model photos (garage cards) ----
export const TANKART = { cache:{}, queue:[], busy:false };
function pumpTank(){ if(TANKART.busy) return; const id=TANKART.queue.shift(); if(!id) return; TANKART.busy=true;
  (window.requestIdleCallback||((f)=>setTimeout(f,30)))(()=>{ try{ if(!TANKART.cache[id]){ const t=buildTank({ detail:true, model:id }); t.rotation.y=0; const url=renderObject(t, new THREE.Vector3(1.0, 0.62, 1.15), 0.58, OW, Math.round(OW*0.62));
        t.traverse(o=>{ if(o.geometry && !o.geometry._shared) {} }); TANKART.cache[id]=url; }
      document.querySelectorAll('img[data-tankpic="'+id+'"]').forEach(im=>{ im.src=TANKART.cache[id]; im.classList.add('ok'); }); }catch(e){ console.warn('tank art', id, e); TANKART.cache[id]=''; }
    TANKART.busy=false; if(TANKART.queue.length) pumpTank(); }, { timeout:500 }); }
export function queueTankArt(ids){ for(const id of ids) if(TANKART.cache[id]==null && !TANKART.queue.includes(id)) TANKART.queue.push(id); pumpTank(); }
export function tankPicHTML(id, cls){ const u=TANKART.cache[id]; if(u==null) queueTankArt([id]);
  return '<span class="gunpic tankpic '+(cls||'')+'"><i class="gp-ic">'+svgMarkup('tank')+'</i><img data-tankpic="'+id+'" class="'+(u?'ok':'')+'" alt="" src="'+(u||BLANK)+'"></span>'; }
