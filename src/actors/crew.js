// actors/crew.js — Z89/Z100 YOUR CREW command: tap = riders jump down and fight, hold = recall everyone on foot, + the crew button.
import { TROOPS } from '../../config.js';
import { FT, S, floatText, haptic, radio, riders, scene, sfx, spawnAlly } from '../hub.js';

// ---- from actors/troops.js ----
// ---- Z89 · YOUR CREW: the riflemen riding the tank dismount to fight on foot, then run back and mount up ----
// TAP = crew on the hull jump down · HOLD = recall everyone on foot (release to stop; latecomers stay on the ground)
export let _crewDownAt=0;
export function crewPress(){ if(S.mode!=='playing' || _crewDownAt) return; _crewDownAt=performance.now()/1000;
  if(FT.length){ S.recall=true; S.recallIn=0; radio('Kíp lính: rút về xe — giữ nguyên vị trí cho bọn tôi lên!'); sfx('click'); updateCrewBtn(); } }
export function crewRelease(){ if(!_crewDownAt) return; const held=performance.now()/1000-_crewDownAt; _crewDownAt=0;
  const wasRecall=S.recall; S.recall=false; const left=FT.length;
  if(wasRecall && held>=TROOPS.fireteam.tapMax){ if(S.recallIn) floatText('ĐÃ GOM '+S.recallIn+(left?' · CÒN '+left+' DƯỚI ĐẤT':''), '#9bd14a', S.player.pos, 15); }
  else if(riders.length) crewDismount();
  updateCrewBtn(); }
export function crewToggle(){ crewPress(); crewRelease(); }       // (kept for old callers: behaves like a tap)
export function crewDismount(){
  const p=S.player; if(!p || !riders.length) return; const F=TROOPS.fireteam;
  riders.slice().forEach((r,i)=>{ const wp=r.g.position, a=p.facing+Math.PI*0.5*(i%2?1:-1)+(Math.random()-0.5)*0.4;
    spawnAlly(wp.x, wp.z, a); const al=FT[FT.length-1]; al.fromTank=true; al.maxHp=F.hp; al.hp=Math.max(8, r.hp/r.maxHp*F.hp); al.jumpT=0.4; al.jy=wp.y;
    scene.remove(r.g); scene.remove(r.bar); });
  riders.length=0; radio('Kíp lính: xuống xe — bọn tôi tự lo phạm vi quanh xe!'); sfx('click'); haptic(20); updateCrewBtn();
}
export function updateCrewBtn(){ const on=riders.length>0, down=FT.length>0; document.body.classList.toggle('hascrew', on||down);
  const b=document.getElementById('mCrew'); if(b){ b.classList.toggle('up', down); b.classList.toggle('rec', !!S.recall);
    const ar=b.querySelector('.mc-ar'), tx=b.querySelector('.mc-tx'); if(ar) ar.textContent = S.recall ? '⇧' : (on ? '⇩' : '⇧'); if(tx) tx.textContent = S.recall ? 'ĐANG GOM' : (down ? 'GIỮ: GOM' : 'LÍNH'); } }
// the crew button: press = dismount / start recall, release = end recall (touch + mouse)
{ const b=document.getElementById('mCrew'); if(b){ const dn=(ev)=>{ ev.stopPropagation(); ev.preventDefault(); crewPress(); }, up=(ev)=>{ ev.stopPropagation(); ev.preventDefault(); crewRelease(); };
  b.addEventListener('touchstart', dn, {passive:false}); b.addEventListener('touchend', up, {passive:false}); b.addEventListener('touchcancel', up, {passive:false});
  b.addEventListener('mousedown', dn); b.addEventListener('mouseup', up); b.addEventListener('mouseleave', up); } }
