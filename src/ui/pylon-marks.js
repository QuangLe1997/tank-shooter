// ui/pylon-marks.js — Z243 SHIELD-PYLON MARKERS: while the general's shield stands, every pylon gets a screen marker — a reticle with "TRỤ KHIÊN · 42 m" when it is in view, an arrow pinned to the screen edge pointing at it (with its distance) when it is not
import { PYLONS, S, VIEW, camera } from '../hub.js';
import * as THREE from 'three';

const _v=new THREE.Vector3(), MK=[];
let _wrap=null;
function wrap(){ if(_wrap) return _wrap; _wrap=document.createElement('div'); _wrap.id='pylonMarks'; document.body.appendChild(_wrap); return _wrap; }
function mark(i){ if(MK[i]) return MK[i]; const el=document.createElement('div'); el.className='pym'; el.innerHTML='<i class="pym-arrow"></i><b class="pym-ring"></b><span class="pym-txt"></span>'; wrap().appendChild(el);
  MK[i]={ el, arrow:el.firstChild, txt:el.lastChild, last:'' }; return MK[i]; }
export function updatePylonMarks(){
  const p=S.player, on=S.mode==='playing' && p && PYLONS.length;
  for(let i=0;i<MK.length;i++) if(!on || i>=PYLONS.length) MK[i].el.style.display='none';
  if(!on) return;
  const W=VIEW.w, H=VIEW.h, cx=W/2, cy=H/2, rx=W/2-150, ry=H/2-120;   // pinned on an ellipse inside the screen: clear of the HUD panels in the corners
  PYLONS.forEach((b,i)=>{ const M=mark(i); _v.set(b.x, (b.mesh?b.mesh.position.y:0)+5.5, b.z).project(camera);
    let sx=_v.x*W/2, sy=-_v.y*H/2; const behind=_v.z>1, inView=!behind && Math.abs(sx)<W/2-24 && Math.abs(sy)<H/2-24;
    const d=Math.round(Math.hypot(b.x-p.pos.x, b.z-p.pos.z)), t='TRỤ KHIÊN · '+d+' m';
    if(behind){ sx=-sx; sy=-sy; if(Math.abs(sx)<1 && Math.abs(sy)<1) sy=1; }
    if(!inView){ const a=Math.atan2(sy, sx); sx=Math.cos(a)*rx; sy=Math.sin(a)*ry; }   // pin to the rim along the direction to it
    M.el.style.display='block'; M.el.classList.toggle('edge', !inView);
    M.el.style.transform='translate('+(cx+sx).toFixed(1)+'px,'+(cy+sy).toFixed(1)+'px)';
    if(!inView) M.arrow.style.transform='rotate('+Math.atan2(sy/ry, sx/rx).toFixed(3)+'rad) translateX(30px)';   // the arrow sits outside the diamond, pointing the way
    if(t!==M.last){ M.last=t; M.txt.textContent=t; } });
}
