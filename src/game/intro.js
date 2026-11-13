// game/intro.js — INTRO CINEMATIC (deploy showcase)
import * as THREE from 'three';
import { INTRO } from '../../config.js';
import { BIOME, FORTS, MOBILE, PROFILE, RIVER, S, SKY, TOD_LABEL, WAVE, WONDER, arena, biomeVi, camOff, camera, composer, doResize, openBriefing, renderer, saveProfile, scene, spawnPart } from '../hub.js';

// ----------------------------- INTRO CINEMATIC (deploy showcase) -----------------------------
// A Catmull-Rom camera sweep: low hero shot of the tank → orbiting parade rise →
// wide overview → settles EXACTLY onto the gameplay framing, then play begins. Skippable.
export const intro = { active:false, t:0, dur:6.0, camCurve:null, lookCurve:null, warm:false, warming:false, t0:0, far0:600, fog0:null };
export const _easeIO = u => u<0.5 ? 2*u*u : 1 - Math.pow(-2*u+2,2)/2;
// Z119 the sweep stays lower and tighter (it used to rise to 20 m / 24 m back and draw the WHOLE field: 1,480 draw calls, 3M triangles)
const OFFS=[[0.5,1.1,-8.5],[8,2.2,-5.5],[12,5,2],[7,8.5,12],[-4,12,17]], LOOKS=[[0,2.3,1.2],[0,2.1,0.3],[0,1.9,0],[0,1.5,0],[0,1.1,0],[0,1.0,0]];
// Z140 BATTLEFIELD TOUR: fly over every point of interest — enemy forts (biggest last), the river bridges, our walled Core — then dive to the tank
function buildTour(T){ const P=[], S0=S;
  const forts=FORTS.slice().sort((a,b)=>Math.atan2(a.z,a.x)-Math.atan2(b.z,b.x));
  for(const f of forts) P.push({ x:f.x, z:f.z, h:f.tier===3?34:28, r:f.tier===3?30:24, txt:(f.tier===3?'ĐẠI BẢN DOANH ĐỊCH · ':'CỨ ĐIỂM ĐỊCH · ')+f.name });
  if(RIVER.on) for(const b of RIVER.bridges.slice(0,2)) P.push({ x:b.x, z:b.z, h:20, r:18, txt:'CẦU QUA SÔNG — XE LỘI NƯỚC SẼ CHẬM' });
  if(WONDER.name) P.push({ x:WONDER.x, z:WONDER.z, h:46, r:70, txt:'DI SẢN · '+WONDER.name });   // Z144 the landmark
  P.push({ x:0, z:0, h:26, r:26, txt:'LÕI CỦA TA — TƯỜNG THÀNH · PHÁO CANH SẴN SÀNG' });
  if(P.length<2) return null;
  // order: start from the stop farthest from the tank, sweep round, end on our Core, then down to the tank
  const core0=P.pop(); P.sort((a,b)=>Math.hypot(b.x-T.x,b.z-T.z)-Math.hypot(a.x-T.x,a.z-T.z)); P.push(core0);
  const cam=[], look=[], caps=[];
  P.forEach((q,i)=>{ const a=Math.atan2(q.z-T.z, q.x-T.x)+(i%2?0.6:-0.6); cam.push(new THREE.Vector3(q.x-Math.cos(a)*q.r, q.h, q.z-Math.sin(a)*q.r)); look.push(new THREE.Vector3(q.x, 2, q.z)); caps.push(q.txt); });
  const first=intro.camCurve.getPoint(0), firstL=intro.lookCurve.getPoint(0);
  cam.push(T.clone().add(new THREE.Vector3(0, 16, 22)), first.clone()); look.push(T.clone().add(new THREE.Vector3(0,1.5,0)), firstL.clone());
  return { cam:new THREE.CatmullRomCurve3(cam), look:new THREE.CatmullRomCurve3(look), caps, n:P.length, dur:Math.max(9, Math.min(18, P.length*2.6+2)) }; }
export function startIntro(){
  const p=S.player; if(!p){ S.mode='playing'; return; }
  p.mesh.position.set(p.pos.x,0,p.pos.z); p.mesh.rotation.y=p.facing; p.turret.rotation.y=0;
  const T=new THREE.Vector3(p.pos.x,0,p.pos.z);
  const offs=OFFS.concat([[camOff.x,camOff.y,camOff.z]]);   // low hero close-up on the gun → sweep around → rise to a parade view → settle to gameplay
  const mk=a=>new THREE.CatmullRomCurve3(a.map(o=>T.clone().add(new THREE.Vector3(o[0],o[1],o[2]))));
  intro.camCurve=mk(offs); intro.lookCurve=mk(LOOKS); intro.t=0; intro.active=true; intro.t0=performance.now()/1000;
  intro.quick = !!(PROFILE.introSeen && PROFILE.introSeen[BIOME.name]);   // Z152 seen this battlefield's tour before → compile behind the veil, then go
  const sub=document.getElementById('cine-sub'); if(sub) sub.textContent=(S.loop>0?'VÒNG+'+S.loop+' · ':'')+'MÀN '+S.stage+' · '+biomeVi(BIOME.name)+(S.tod?' · '+TOD_LABEL[S.tod]:'');
  document.getElementById('cine').classList.add('on'); document.body.classList.add('cine');
  intro.tour = MOBILE ? null : buildTour(T); intro.tt=0;                       // Z140 desktop: a full 3D tour of the battlefield first (enemy forts → landmarks → our stronghold → your tank)
  // Z119 cinematic view distance: the far end of the field is fogged out and not drawn at all during the sweep (phones only now — the tour needs the whole field)
  if(!intro.tour){ if(scene.fog && scene.fog.density!=null){ intro.fog0=scene.fog.density; scene.fog.density=Math.max(scene.fog.density, INTRO.fog); }
  cullFar(T, true); }   // Z119 the far field is hidden while the camera sweeps (fog covers it; play's top-down view never sees it anyway)
  if(intro.tour){ camera.position.copy(intro.tour.cam.getPointAt(0)); camera.lookAt(intro.tour.look.getPointAt(0)); } else { camera.position.copy(intro.camCurve.getPoint(0)); camera.lookAt(intro.lookCurve.getPoint(0)); }
  intro.warm=true; intro.warming=false; showVeil(true);   // Z119 compile every shader + draw the widest shot once BEHIND the veil, then fly
  S.mode='intro';
}
// Z119 warm-up: every material this stage uses is compiled (in parallel where the browser can), then the overview is rendered once so the
//   shadow / post passes and texture uploads happen now — not as hitches in the middle of the sweep
async function warmUp(){ const keep=camera.position.clone(), q=camera.quaternion.clone();
  try{ camera.position.copy(intro.camCurve.getPoint(0.72)); camera.lookAt(intro.lookCurve.getPoint(0.72)); camera.updateMatrixWorld();
    if(renderer.compileAsync) await Promise.race([renderer.compileAsync(scene, camera), new Promise(r=>setTimeout(r, INTRO.compileWait))]); else renderer.compile(scene, camera);
    if(!intro.active) return; camera.position.copy(intro.camCurve.getPoint(0.72)); camera.lookAt(intro.lookCurve.getPoint(0.72)); composer.render();
    camera.position.copy(intro.camCurve.getPoint(0.35)); camera.lookAt(intro.lookCurve.getPoint(0.35)); composer.render(); }
  catch(e){}
  camera.position.copy(keep); camera.quaternion.copy(q); }
// Z119 hide every compact scene object farther than INTRO.cullR from the tank (forts, towers, rocks, props, wrecks…); big field-wide meshes
//   (terrain, sky, decals, scattered instanced decor) stay. Restored when the intro ends.
const _hidden=[], _bs=new THREE.Sphere(), _wp=new THREE.Vector3();
function cullFar(T, on){ if(!on){ for(const o of _hidden) o.visible=true; _hidden.length=0; return; }
  const R=INTRO.cullR, p=S.player;
  for(const o of scene.children){ if(!o.visible || o===SKY || o===arena || o.isLight || o.isCamera || (p && o===p.mesh) || o.isPoints) continue;
    let r=0; if(o.geometry){ if(!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); r=o.geometry.boundingSphere.radius*(o.scale.x||1); }
    if(r>INTRO.bigR) continue; o.getWorldPosition(_wp); if(_wp.lengthSq()<1 && !o.geometry && o.children.length>6) continue;   // field-wide holders at the origin stay
    if(Math.hypot(_wp.x-T.x, _wp.z-T.z) > R){ o.visible=false; _hidden.push(o); } } }
export function endIntro(){
  if(!intro.active) return; intro.active=false; intro.warm=false; showVeil(false);
  if(!PROFILE.introSeen || typeof PROFILE.introSeen!=='object') PROFILE.introSeen={}; if(!PROFILE.introSeen[BIOME.name]){ PROFILE.introSeen[BIOME.name]=1; saveProfile(); }
  cullFar(null, false); if(intro.fog0!=null && scene.fog){ scene.fog.density=intro.fog0; intro.fog0=null; }
  document.getElementById('cine').classList.remove('on'); document.body.classList.remove('cine');
  WAVE.active=false; S.wave=0;
  doResize();   // viewport may have changed during the intro (fullscreen/orientation) → refit so play renders full-screen
  openBriefing({ first:true });   // STAGE 1 briefing: pick a contract → waves begin on confirm
}
export function updateIntro(dt, now){
  if(!intro.active) return;
  if(intro.warm){ if(!intro.warming){ intro.warming=true; warmUp().then(()=>{ if(intro.active){ intro.warm=false; showVeil(false); if(intro.quick) endIntro(); } }); }
    camera.position.copy(intro.camCurve.getPoint(0)); camera.lookAt(intro.lookCurve.getPoint(0)); return; }
  if(intro.tour){ const R=intro.tour; intro.tt=Math.min(1, intro.tt + Math.min(dt,1/30)/R.dur); const u=_easeIO(intro.tt);
    camera.position.copy(R.cam.getPointAt(u)); camera.lookAt(R.look.getPointAt(u));
    const k=Math.min(R.n-1, Math.floor(u*(R.n+1))); const sub=document.getElementById('cine-sub'); if(sub && R.caps[k] && sub.textContent!==R.caps[k]) sub.textContent=R.caps[k];
    if(intro.tt>=1){ intro.tour=null; const sub2=document.getElementById('cine-sub'); if(sub2) sub2.textContent=(S.loop>0?'VÒNG+'+S.loop+' · ':'')+'MÀN '+S.stage+' · '+biomeVi(BIOME.name)+(S.tod?' · '+TOD_LABEL[S.tod]:''); }
    return; }
  intro.t=Math.min(1, intro.t + Math.min(dt, 1/30)/intro.dur);   // Z119 a slow frame slows the camera for a moment instead of making it jump
  const u=_easeIO(intro.t);
  camera.position.copy(intro.camCurve.getPoint(u));
  camera.lookAt(intro.lookCurve.getPoint(u));
  const p=S.player; if(p) p.turret.rotation.y=Math.sin(intro.t*Math.PI*1.5)*0.55;   // slow showcase sweep
  if(p && Math.random()<0.35) spawnPart(p.pos.x+(Math.random()-0.5)*6, 0.3, p.pos.z+(Math.random()-0.5)*6,   // drifting battlefield dust for atmosphere
    (Math.random()-0.5)*2, 0.4+Math.random()*0.9, (Math.random()-0.5)*2, {color:0xccbf94, size:1.6+Math.random(), life:1.1, smoke:true, grav:-0.25, drag:1.4, op:0.26});
  if(intro.t>=1) endIntro();
}
export function skipIntro(){ if(intro.active && performance.now()/1000-intro.t0>INTRO.skipGuard) endIntro(); }   // (not the very click that started the battle)
// Z119 the "deploying" veil: up from the moment you press PLAY until the sweep can run smoothly
export function showVeil(on){ const v=document.getElementById('loadVeil'); if(v) v.classList.toggle('on', !!on); }
