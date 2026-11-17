// ui/squad-hud.js — Z220 TỔ BỘ BINH panel (desktop HUD, bottom-left): the squad order in force ([U] cycles it), how the squad reads the fight
//   (press / hold / fall back), and one tile per man — his kit, his health, and what he is doing right now (colour = task). Rebuilt only when
//   something visible changes (4×/s check).
import { FT, FTSQ, MOBILE, S, squadOrderLabel } from '../hub.js';

const ROLE={ rifle:'BB', mg:'ĐL', mortar:'CỐI', sapper:'CB' };
const TASK={ fight:'f', cover:'c', evade:'c', fallback:'r', post:'g', form:'g', advance:'a', order:'a', muster:'a', assault:'a', fetch:'l', rally:'l' };
const LEG=[['f','GIAO CHIẾN'],['c','ẨN NẤP'],['a','VẬN ĐỘNG'],['r','RÚT / BĂNG'],['g','HỘ TỐNG'],['l','NHẶT ĐỒ'],['j','NHIỆM VỤ']];
const POST={ advance:['ÁP SÁT','adv'], hold:['GIỮ THẾ','hold'], fallback:['RÚT LUI','fb'] };
let _el=null, _at=0, _sig='';
function taskOf(a){ if(a.healing && a.task==='fallback') return 'r'; if(a.goalKind==='form') return 'g'; return TASK[a.task] || 'j'; }
export function updateSquadHud(now){
  if(!_el){ _el=document.getElementById('sqHud'); if(!_el) return; }
  if(now<_at) return; _at=now+0.25;
  const show = S.mode==='playing' && FT.length>0 && !MOBILE;
  if(!show){ if(_sig!==''){ _sig=''; _el.classList.add('hidden'); } return; }
  const cnt={}, men=FT.map(a=>{ const t=taskOf(a); cnt[t]=(cnt[t]||0)+1; return [a.at?'B41':(ROLE[a.role]||'BB'), Math.max(0, Math.round(a.hp/a.maxHp*10)), t]; });
  const post=POST[FTSQ.posture||'hold']||POST.hold, ord=squadOrderLabel();
  const sig=ord+'|'+post[0]+'|'+men.map(m=>m.join(':')).join(',');
  if(sig===_sig) return; _sig=sig; _el.classList.remove('hidden');
  let h='<div class="sq-h"><b>TỔ BỘ BINH</b><span class="sq-n">'+FT.length+'</span><span class="sq-p '+post[1]+'">'+post[0]+'</span></div>';
  h+='<div class="sq-o"><kbd>U</kbd> LỆNH: <b>'+ord+'</b></div><div class="sq-g">';
  for(const [r,hp,t] of men) h+='<i class="t-'+t+(hp<=3?' low':'')+'"><s>'+r+'</s><u style="width:'+(hp*10)+'%"></u></i>';
  h+='</div><div class="sq-l">';
  for(const [k,tx] of LEG) if(cnt[k]) h+='<span class="t-'+k+'"><em></em>'+tx+' '+cnt[k]+'</span>';
  _el.innerHTML=h+'</div>'; }
