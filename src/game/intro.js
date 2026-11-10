// game/intro.js — INTRO CINEMATIC (deploy showcase)
import * as THREE from 'three';
import { BIOME, S, TOD_LABEL, WAVE, biomeVi, camOff, camera, doResize, openBriefing, spawnPart } from '../hub.js';

// ----------------------------- INTRO CINEMATIC (deploy showcase) -----------------------------
// A Catmull-Rom camera sweep: low hero shot of the tank → orbiting parade rise →
// wide overview → settles EXACTLY onto the gameplay framing, then play begins. Skippable.
export const intro = { active:false, t:0, dur:6.0, camCurve:null, lookCurve:null };
export const _easeIO = u => u<0.5 ? 2*u*u : 1 - Math.pow(-2*u+2,2)/2;
export function startIntro(){
  const p=S.player; if(!p){ S.mode='playing'; return; }
  p.mesh.position.set(p.pos.x,0,p.pos.z); p.mesh.rotation.y=p.facing; p.turret.rotation.y=0;
  const T=new THREE.Vector3(p.pos.x,0,p.pos.z);
  const offs =[[0.5,1.1,-8.5],[8,2.2,-5.5],[13,5.5,2],[6,12,15],[-7,20,24],[camOff.x,camOff.y,camOff.z]]; // low hero close-up on the gun → sweep around → rise to a parade view → settle to gameplay
  const looks=[[0,2.3,1.2],[0,2.1,0.3],[0,1.9,0],[0,1.5,0],[0,1.1,0],[0,1.0,0]];
  const mk=a=>new THREE.CatmullRomCurve3(a.map(o=>T.clone().add(new THREE.Vector3(o[0],o[1],o[2]))));
  intro.camCurve=mk(offs); intro.lookCurve=mk(looks); intro.t=0; intro.active=true;
  const sub=document.getElementById('cine-sub'); if(sub) sub.textContent=(S.loop>0?'VÒNG+'+S.loop+' · ':'')+'MÀN '+S.stage+' · '+biomeVi(BIOME.name)+(S.tod?' · '+TOD_LABEL[S.tod]:'');
  document.getElementById('cine').classList.add('on'); document.body.classList.add('cine');
  S.mode='intro';
}
export function endIntro(){
  if(!intro.active) return; intro.active=false;
  document.getElementById('cine').classList.remove('on'); document.body.classList.remove('cine');
  WAVE.active=false; S.wave=0;
  doResize();   // viewport may have changed during the intro (fullscreen/orientation) → refit so play renders full-screen
  openBriefing({ first:true });   // STAGE 1 briefing: pick a contract → waves begin on confirm
}
export function updateIntro(dt, now){
  if(!intro.active) return;
  intro.t=Math.min(1, intro.t + dt/intro.dur);
  const u=_easeIO(intro.t);
  camera.position.copy(intro.camCurve.getPoint(u));
  camera.lookAt(intro.lookCurve.getPoint(u));
  const p=S.player; if(p) p.turret.rotation.y=Math.sin(intro.t*Math.PI*1.5)*0.55;   // slow showcase sweep
  if(p && Math.random()<0.5) spawnPart(p.pos.x+(Math.random()-0.5)*6, 0.3, p.pos.z+(Math.random()-0.5)*6,   // drifting battlefield dust for atmosphere
    (Math.random()-0.5)*2, 0.4+Math.random()*0.9, (Math.random()-0.5)*2, {color:0xccbf94, size:1.6+Math.random(), life:1.1, smoke:true, grav:-0.25, drag:1.4, op:0.26});
  if(intro.t>=1) endIntro();
}
export function skipIntro(){ if(intro.active && intro.t>0.05) endIntro(); }
