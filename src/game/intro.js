// game/intro.js — INTRO CINEMATIC (deploy showcase)
import * as THREE from 'three';
import { INTRO } from '../../config.js';
import { ARENA, BIOME, FORTS, MOBILE, PROFILE, RIVER, S, SKY, TOD_LABEL, WAVE, WONDER, arena, biomeVi, camOff, camRestPose, camera, composer, doResize, openBriefing, renderer, saveProfile, scene, smoother, spawnPart } from '../hub.js';

// ----------------------------- INTRO CINEMATIC (deploy showcase) -----------------------------
// Z239 desktop: ONE grand, wide, unhurried move — the camera opens high over the whole battlefield, glides a quarter of the way round it
//   while the points of interest are named, then swoops down behind your tank and lands EXACTLY on the gameplay framing (camRestPose),
//   so play begins without a jolt. The path is reparameterised by what the eye feels (screen-angle per second, not metres), so the high
//   orbit and the low arrival move at the same perceived speed — no lurches, no whip pans. Phones keep the short close sweep (Z119).
export const intro = { active:false, t:0, dur:6.0, camCurve:null, lookCurve:null, warm:false, warming:false, t0:0, far0:600, fog0:null };
export const _easeIO = u => u<0.5 ? 2*u*u : 1 - Math.pow(-2*u+2,2)/2;
const _easeSine = u => 0.5-0.5*Math.cos(Math.PI*u);   // gentle departure and arrival
// Z119 the phone sweep stays low and tight (the far field is fogged and culled)
const OFFS=[[0.5,1.1,-8.5],[8,2.2,-5.5],[12,5,2],[7,8.5,12],[-4,12,17]], LOOKS=[[0,2.3,1.2],[0,2.1,0.3],[0,1.9,0],[0,1.5,0],[0,1.1,0],[0,1.0,0]];
const _rp=new THREE.Vector3(), _rl=new THREE.Vector3();
// ---- the grand tour (desktop) ----
const TOUR = { dur:7.2, split:0.6, sweep:1.15, fogK:0.42 };   // seconds · share of the path spent on the high orbit · orbit angle (rad) · fog thinned to see the whole field
function buildGrandTour(T){
  const fov=camRestPose(_rp, _rl); if(!fov) return null;
  const rp=_rp.clone(), rl=_rl.clone();
  const caps=[];   // what the voice-over names while we circle (big stronghold first, the landmark, then home)
  const forts=FORTS.slice().sort((a,b)=>(b.tier||0)-(a.tier||0));
  for(const f of forts.slice(0,2)) caps.push((f.tier===3?'ĐẠI BẢN DOANH ĐỊCH · ':'CỨ ĐIỂM ĐỊCH · ')+f.name);
  if(RIVER.on && RIVER.bridges.length) caps.push('CẦU QUA SÔNG — XE LỘI NƯỚC SẼ CHẬM');
  if(WONDER.name) caps.push('DI SẢN · '+WONDER.name);
  caps.push('LÕI CỦA TA — TƯỜNG THÀNH · PHÁO CANH SẴN SÀNG');
  const C=new THREE.Vector3(T.x*0.35, 0, T.z*0.35);                      // the heart of the field, leaning a little toward our side
  const aEnd=Math.atan2(rp.z-T.z, rp.x-T.x);                             // finish the orbit on the side the play camera sits → the swoop never doubles back
  const R=ARENA*0.92, H=ARENA*0.56, A=TOUR.sweep, wA=TOUR.split, rate=A/wA;
  const orbit=(a, s, out)=>out.set(C.x+Math.cos(a)*R*(1-0.1*s), H*(1-0.14*s), C.z+Math.sin(a)*R*(1-0.1*s));
  const _o=new THREE.Vector3(), _ol=new THREE.Vector3();
  // pose(w): w∈[0,1] along the move. Orbit, then a blend from the still-turning orbit onto the rest pose (smootherstep → the hand-over has
  //   no kink in velocity: the swoop starts in exactly the direction the orbit was already travelling)
  const pose=(w, pos, look)=>{
    if(w<=wA){ const s=w/wA; orbit(aEnd-A+rate*w, s, pos); look.set(C.x+(T.x-C.x)*0.12*s, 0, C.z+(T.z-C.z)*0.12*s); return; }
    const s=(w-wA)/(1-wA), e=smoother(s), eh=smoother(Math.min(1, s*1.06))**1.25, el=smoother(Math.min(1, s*1.12));
    orbit(aEnd-A+rate*w, 1, _o); _ol.set(C.x+(T.x-C.x)*0.12, 0, C.z+(T.z-C.z)*0.12);
    pos.set(_o.x+(rp.x-_o.x)*e, _o.y+(rp.y-_o.y)*eh, _o.z+(rp.z-_o.z)*e);   // height lets go a touch later: a swoop, not a slide
    look.lerpVectors(_ol, rl, el); };
  // perceived-motion table: cost of each step = how far the picture slides (camera travel ÷ distance to what it looks at + the turn of the gaze)
  const N=360, cum=new Float32Array(N+1), p0=new THREE.Vector3(), l0=new THREE.Vector3(), p1=new THREE.Vector3(), l1=new THREE.Vector3(), d0=new THREE.Vector3(), d1=new THREE.Vector3();
  pose(0, p0, l0); d0.subVectors(l0, p0).normalize();
  for(let i=1;i<=N;i++){ pose(i/N, p1, l1); d1.subVectors(l1, p1).normalize();
    const dist=Math.max(10, p1.distanceTo(l1)), turn=Math.acos(Math.min(1, Math.max(-1, d0.dot(d1))));
    cum[i]=cum[i-1] + p0.distanceTo(p1)/dist + turn*1.4; p0.copy(p1); d0.copy(d1); }
  const total=cum[N]||1;
  const wAt=u=>{ const c=u*total; let lo=0, hi=N; while(hi-lo>1){ const m=(lo+hi)>>1; if(cum[m]<c) lo=m; else hi=m; } const span=cum[hi]-cum[lo]||1; return Math.min(1, (lo+(c-cum[lo])/span)/N); };
  return { pose, wAt, caps, fov, wA, dur:TOUR.dur, fog:null, capK:-1 }; }
export function startIntro(){
  const p=S.player; if(!p){ S.mode='playing'; return; }
  p.mesh.position.set(p.pos.x,0,p.pos.z); p.mesh.rotation.y=p.facing; p.turret.rotation.y=0;
  const T=new THREE.Vector3(p.pos.x,0,p.pos.z);
  // phones: low hero close-up on the gun → sweep around → rise → land on the real play framing (zoom + view turn included)
  const offs=OFFS.slice(), looks=LOOKS.slice(0,5);
  if(camRestPose(_rp, _rl)){ offs.push([_rp.x-T.x, _rp.y, _rp.z-T.z]); looks.push([_rl.x-T.x, _rl.y, _rl.z-T.z]); } else { offs.push([camOff.x,camOff.y,camOff.z]); looks.push(LOOKS[5]); }
  const mk=a=>new THREE.CatmullRomCurve3(a.map(o=>T.clone().add(new THREE.Vector3(o[0],o[1],o[2]))), false, 'centripetal');   // centripetal: no overshoot loops between close points
  intro.camCurve=mk(offs); intro.lookCurve=mk(looks); intro.t=0; intro.active=true; intro.t0=performance.now()/1000;
  intro.quick = !!(PROFILE.introSeen && PROFILE.introSeen[BIOME.name]);   // Z152 seen this battlefield's tour before → compile behind the veil, then go
  const sub=document.getElementById('cine-sub'); if(sub){ clearTimeout(sub._t); sub._next=null; sub.style.transition='opacity .22s ease'; sub.style.opacity='1'; sub.textContent=stageLine(); }
  document.getElementById('cine').classList.add('on'); document.body.classList.add('cine');
  intro.tour = MOBILE ? null : buildGrandTour(T); intro.tt=0;
  if(intro.tour){ if(scene.fog && scene.fog.density!=null){ intro.fog0=scene.fog.density; intro.tour.fog=scene.fog.density; }   // the wide shot sees through thinner haze, thickening back as we land
    camera.fov=intro.tour.fov; camera.updateProjectionMatrix(); }
  // Z119 phones: the far end of the field is fogged out and not drawn at all during the sweep
  if(!intro.tour){ if(scene.fog && scene.fog.density!=null){ intro.fog0=scene.fog.density; scene.fog.density=Math.max(scene.fog.density, INTRO.fog); }
  cullFar(T, true); }
  placeAt(0);
  intro.warm=true; intro.warming=false; showVeil(true);   // Z119 compile every shader + draw the widest shot once BEHIND the veil, then fly
  S.mode='intro';
}
function stageLine(){ return (S.loop>0?'VÒNG+'+S.loop+' · ':'')+'MÀN '+S.stage+' · '+biomeVi(BIOME.name)+(S.tod?' · '+TOD_LABEL[S.tod]:''); }
function setCap(txt){ const sub=document.getElementById('cine-sub'); if(!sub || sub.textContent===txt || sub._next===txt) return; sub._next=txt;   // captions cross-fade instead of flicking
  sub.style.opacity='0'; clearTimeout(sub._t); sub._t=setTimeout(()=>{ sub.textContent=txt; sub.style.opacity='1'; sub._next=null; }, 220); }
// place the camera at progress u of whichever move is playing (also used by the warm-up)
function placeAt(u){ const R=intro.tour;
  if(R){ const w=R.wAt(_easeSine(u)); R.pose(w, _rp, _rl); camera.position.copy(_rp); camera.lookAt(_rl);
    if(R.fog!=null && scene.fog) scene.fog.density=R.fog*(w<=R.wA ? TOUR.fogK : TOUR.fogK+(1-TOUR.fogK)*smoother((w-R.wA)/(1-R.wA)));
    return w; }
  const e=_easeIO(u); camera.position.copy(intro.camCurve.getPoint(e)); camera.lookAt(intro.lookCurve.getPoint(e)); return e; }
// Z119 warm-up: every material this stage uses is compiled (in parallel where the browser can), then the widest shots are rendered once so
//   the shadow / post passes and texture uploads happen now — not as hitches in the middle of the move
async function warmUp(){ const keep=camera.position.clone(), q=camera.quaternion.clone(), fog=scene.fog?scene.fog.density:null;
  const A=intro.tour?0.05:0.72, B=intro.tour?0.5:0.35;
  try{ placeAt(A); camera.updateMatrixWorld();
    if(renderer.compileAsync) await Promise.race([renderer.compileAsync(scene, camera), new Promise(r=>setTimeout(r, INTRO.compileWait))]); else renderer.compile(scene, camera);
    if(!intro.active) return; placeAt(A); composer.render(); placeAt(B); composer.render(); }
  catch(e){}
  camera.position.copy(keep); camera.quaternion.copy(q); if(fog!=null && scene.fog) scene.fog.density=fog; }
// Z119 hide every compact scene object farther than INTRO.cullR from the tank (forts, towers, rocks, props, wrecks…); big field-wide meshes
//   (terrain, sky, decals, scattered instanced decor) stay. Restored when the intro ends.
const _hidden=[], _wp=new THREE.Vector3();
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
  const fov=camRestPose(_rp, _rl); if(fov){ camera.position.copy(_rp); camera.lookAt(_rl); camera.fov=fov; camera.updateProjectionMatrix(); }   // a skip lands on the play framing too
  intro.tour=null; const p=S.player; if(p) p.turret.rotation.y=0;
  { const sub=document.getElementById('cine-sub'); if(sub){ clearTimeout(sub._t); sub._next=null; sub.style.opacity='1'; } }
  document.getElementById('cine').classList.remove('on'); document.body.classList.remove('cine');
  WAVE.active=false; S.wave=0;
  doResize();   // viewport may have changed during the intro (fullscreen/orientation) → refit so play renders full-screen
  openBriefing({ first:true });   // STAGE 1 briefing: pick a contract → waves begin on confirm
}
export function updateIntro(dt, now){
  if(!intro.active) return;
  if(intro.warm){ if(!intro.warming){ intro.warming=true; warmUp().then(()=>{ if(intro.active){ intro.warm=false; showVeil(false); if(intro.quick) endIntro(); } }); }
    placeAt(0); return; }
  const step=Math.min(dt, 1/30);   // Z119 a slow frame slows the camera for a moment instead of making it jump
  if(intro.tour){ const R=intro.tour; intro.tt=Math.min(1, intro.tt + step/R.dur); const w=placeAt(intro.tt);
    if(w<R.wA*0.98){ const k=Math.min(R.caps.length-1, Math.floor(w/R.wA*R.caps.length)); if(k!==R.capK){ R.capK=k; setCap(R.caps[k]); } }
    else if(R.capK!==-2){ R.capK=-2; setCap(stageLine()); }
    if(intro.tt>=1) endIntro();
    return; }
  intro.t=Math.min(1, intro.t + step/intro.dur);
  placeAt(intro.t);
  const p=S.player; if(p) p.turret.rotation.y=Math.sin(intro.t*Math.PI*2)*0.5;   // slow showcase sweep, back on the bow when we land
  if(p && Math.random()<0.35) spawnPart(p.pos.x+(Math.random()-0.5)*6, 0.3, p.pos.z+(Math.random()-0.5)*6,   // drifting battlefield dust for atmosphere
    (Math.random()-0.5)*2, 0.4+Math.random()*0.9, (Math.random()-0.5)*2, {color:0xccbf94, size:1.6+Math.random(), life:1.1, smoke:true, grav:-0.25, drag:1.4, op:0.26});
  if(intro.t>=1) endIntro();
}
export function skipIntro(){ if(intro.active && performance.now()/1000-intro.t0>INTRO.skipGuard) endIntro(); }   // (not the very click that started the battle)
// Z119 the "deploying" veil: up from the moment you press PLAY until the move can run smoothly
export function showVeil(on){ const v=document.getElementById('loadVeil'); if(v) v.classList.toggle('on', !!on); }
