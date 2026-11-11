// game/boot-gate.js — Z103 split from game/loop.js: the branded splash, real boot progress, sliced shader warm-up,
// and the first user gesture (audio + fullscreen).
import * as THREE from 'three';
import { ENEMY_DEFS, FS_SUPPORTED, GUNS, MOBILE, NIGHT, __set__tinMat, __set__woodMat, _tinMat, _woodMat, _wreckGeo, _wreckGeos, audio, buildTank, buildTransport, camTarget, camera, chute, emberTex, enemyPool, getEnemyMesh, makeAllyTankMesh, makeCamoNet, makeCoverMesh, makeGunBarrel, makeMortarShell, makeRocketMesh, makeSoldierMesh, panelTex, propTex, queueResize, renderer, reqFs, scene, setNightLights, sfx, svgBadgeTex, towerGeos, wireMat } from '../hub.js';

// ---- BOOT GATE: hold the branded splash until real frames are on screen. On touch the tap that dismisses it
// is also the one user gesture browsers demand before audio, fullscreen and the landscape lock are allowed. ----
export function bootHide(){ const b=document.getElementById('boot'); if(!b||b._gone) return; b._gone=true;
  b.classList.add('leaving'); setTimeout(()=>{ b.classList.add('gone'); document.body.classList.add('menu-in'); }, 380); setTimeout(()=>{ b.style.display='none'; }, 950); }
// Z101 real boot progress: bar (transform only) + the three status lines tick off as the work actually finishes
export function setBootProgress(pct, step){ const f=document.getElementById('bootFill'), t=document.getElementById('bootPct');
  if(f){ f.style.animation='none'; f.style.transform='scaleX('+Math.max(0.04,Math.min(1,pct/100)).toFixed(3)+')'; } if(t) t.textContent=Math.round(pct)+'%';
  if(step!=null) document.querySelectorAll('#boot .ib-line').forEach(l=>{ if(+l.dataset.step<=step) l.classList.add('done'); }); }
const _frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
// Z109 iPhone in a Safari tab: there is no Fullscreen API, the browser bars always stay — the only full-screen way is the home-screen
// app (manifest + sw.js) or the native shell. Say so on the splash instead of promising "full screen" on tap.
export const IOS_TAB = MOBILE && !FS_SUPPORTED && !navigator.standalone && /^https?:$/.test(location.protocol) && !(window.matchMedia && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches);
if(IOS_TAB){ const n=document.getElementById('bootNote'); if(n){ n.textContent='Chơi toàn màn hình: bấm Chia sẻ → Thêm vào Màn hình chính'; n.classList.add('ios-tip'); } }
// ---- WARM-UP: compile every material variant (day AND night lighting) + pre-build the enemy pools behind the intro →
//      no shader-compile hitches when the first tank, explosion, wreck or night stage appears. Z101: done in small slices
//      with a frame between each, so the intro keeps animating and the progress bar moves for real. ----
export let _warmed=false;
export async function warmUp(onStep){
  if(_warmed) return; _warmed=true; const step=onStep||(()=>{});
  const tmp=[], put=(o)=>{ o.position.set(0,-80,0); o.visible=true; scene.add(o); tmp.push(o); return o; };
  try{
    put(buildTank({detail:true, mighty:true})); step(0.08); await _frame();
    const pooled=[]; const types=Object.keys(ENEMY_DEFS);
    for(let i=0;i<types.length;i++){ const t=types[i]; for(let k=0;k<2;k++){ const m=getEnemyMesh(t); m.position.set(0,-80,0); m.visible=true; pooled.push([t,m]); } if(i%3===2){ step(0.08+0.3*i/types.length); await _frame(); } }
    for(const k of ['sandbag','drums','tires','crates','pipes','concrete','hesco','hedgehog']) put(makeCoverMesh(k, k==='drums'||k==='sandbag'));
    put(makeSoldierMesh()); put(makeSoldierMesh({enemy:true})); put(makeRocketMesh()); put(makeMortarShell()); step(0.42); await _frame();
    // Z104 first-appearance models: transport helicopter + parachute, captured tank, depot net, stockade wire, rally / drop-zone rings
    put(buildTransport()); put(chute()); put(makeAllyTankMesh(false)); put(makeCamoNet()); put(new THREE.Mesh(new THREE.BoxGeometry(0.05,2,0.05), wireMat()));
    put(new THREE.Mesh(new THREE.RingGeometry(5,5.6,24), new THREE.MeshBasicMaterial({ color:0xff4a2a, transparent:true, opacity:0.6, side:THREE.DoubleSide, depthWrite:false })));
    { const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:svgBadgeTex('team','#9be04a'), transparent:true, depthWrite:false })); put(s); }
    _wreckGeos(); put(new THREE.Mesh(_wreckGeo, new THREE.MeshStandardMaterial({ color:0x222222, roughness:0.95, metalness:0.3, map:panelTex(), emissive:0xff5a18, emissiveMap:emberTex(), emissiveIntensity:1, transparent:true })));
    { const G=towerGeos(); if(!_woodMat){ __set__woodMat(new THREE.MeshStandardMaterial({ map:propTex('wood'), color:0x9a7a52, roughness:0.9 })); __set__tinMat(new THREE.MeshStandardMaterial({ color:0x6a6e66, roughness:0.45, metalness:0.75, map:propTex('drum') })); }
      put(new THREE.Mesh(G.wood,_woodMat)); put(new THREE.Mesh(G.roof,_tinMat)); }
    const gids=Object.keys(GUNS); for(let i=0;i<gids.length;i++){ put(makeGunBarrel(gids[i])); if(i%4===3){ step(0.45+0.15*i/gids.length); await _frame(); } }
    if(renderer.compileAsync){ step(0.62); await renderer.compileAsync(scene, camera); step(0.75); await _frame();
      const was=NIGHT.on; setNightLights(true); await renderer.compileAsync(scene, camera); setNightLights(was); NIGHT._was=was; step(0.86); await _frame(); }   // both light setups
    // one real (off-screen) draw with everything in view → also compiles shadow-depth + per-object variants
    { const rt=new THREE.WebGLRenderTarget(96,96), tgt=camTarget.clone(), keep=[];
      const all=tmp.concat(pooled.map(x=>x[1])); all.forEach((o,i)=>{ keep.push(o.position.clone()); o.position.set(tgt.x+(i%6-2.5)*4, 0, tgt.z+((i/6|0)-2)*4); });
      for(const night of [false,true]){ setNightLights(night); renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); step(night?0.97:0.92); await _frame(); }
      setNightLights(NIGHT.on); renderer.setRenderTarget(null); rt.dispose(); all.forEach((o,i)=>o.position.copy(keep[i])); }
    for(const [t,m] of pooled){ m.visible=false; m.position.set(0,0,0); (enemyPool[t]=enemyPool[t]||[]).push(m); }   // ready-made enemy pool
  }catch(e){ console.warn('warm-up skipped', e); }
  for(const o of tmp) scene.remove(o);
  step(1); performance.mark('boot:warm');
}
export function idle(fn){ (window.requestIdleCallback||((f)=>setTimeout(f,60)))(fn, {timeout:1500}); }
export async function bootReady(){
  performance.mark('boot:ready');
  const b=document.getElementById('boot'); if(!b||b._gone){ warmUp(); return; }
  setBootProgress(55, 1);                                                          // modules + world are up
  await warmUp(f=>setBootProgress(55+f*44, f>=1?2:1));                            // shaders + pools, sliced across frames
  setBootProgress(100, 2); await _frame();
  const msg=document.getElementById('bootMsg'); if(msg) msg.textContent='SẴN SÀNG CHIẾN ĐẤU';
  b.classList.add('ready');
  const go=e=>{ if(e&&e.cancelable && e.type!=='keydown') e.preventDefault();
    b.removeEventListener('touchstart',go); b.removeEventListener('click',go); removeEventListener('keydown',go);
    try{ audio(); sfx('levelup'); }catch(_){}                                     // the gesture browsers demand before audio …
    reqFs(); bootHide();                                                           // … and fullscreen (desktop too)
    queueResize(); setTimeout(queueResize,300); setTimeout(queueResize,900); };
  b.addEventListener('touchstart',go,{passive:false}); b.addEventListener('click',go); addEventListener('keydown',go);
}
