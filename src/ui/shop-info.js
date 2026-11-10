// ui/shop-info.js — Z106 what a gun is FOR, in plain words: role tag, effect vs each armour class, comparable numbers + deltas vs your gun
import { DMG_TYPE, ROSTER } from '../../config.js';
import { GUNS, PROFILE, gunDmgMul, gunFireMul } from '../hub.js';

// one short role line per gun (Vietnamese) + a colour family
export function gunRole(id){ const g=GUNS[id]||{};
  if(g.special==='rocket') return { tx:'PHÁO PHÁ ĐỘI HÌNH', col:'#ffb04a' };
  if(g.special==='arty'||g.special==='mortar') return { tx:'PHÁO VÒNG CẦU', col:'#ffb04a' };
  if(g.special==='flame'||g.type==='FIRE') return { tx:'PHUN LỬA TẦM GẦN', col:'#ff7a3a' };
  if(g.type==='TBX') return { tx:'NHIỆT ÁP · DIỆT CỤM', col:'#ff7a3a' };
  if(g.type==='AP') return { tx:'DIỆT TĂNG NẶNG', col:'#ff5a5a' };
  if(g.type==='HESH') return { tx:'PHÁ CÔNG SỰ · THÁP', col:'#ffcf5a' };
  if(g.type==='FRAG') return { tx:'BẮN CHÙM TẦM GẦN', col:'#ffcf5a' };
  if(g.type==='CRYO') return { tx:'ĐÓNG BĂNG ĐỊCH', col:'#7fe7ff' };
  if(g.type==='ELEC') return { tx:'LAN ĐIỆN NHIỀU MỤC TIÊU', col:'#9fd0ff' };
  if(g.lock||g.homing) return { tx:'TÊN LỬA TỰ DẪN', col:'#c08bff' };
  if(id==='flak') return { tx:'PHÒNG KHÔNG · NỔ CHÙM', col:'#9fe07a' };
  if(g.type==='HE') return { tx:'NỔ LAN · DIỆT CỤM', col:'#ffcf5a' };
  if(g.type==='KIN') return { tx: g.fireCd<0.1 ? 'XẢ ĐẠN CỰC NHANH' : 'ĐA NĂNG · XE NHẸ', col:'#9fe07a' };
  return { tx:'ĐA NĂNG', col:'#9fe07a' }; }
// how hard it hits each kind of target (×) — lobbed shells can't reach aircraft; FLAK shreds them
export const ARMOR_VI=[['L','Xe nhẹ'],['M','Xe vừa'],['H','Xe nặng'],['A','Trực thăng']];
export function gunEffect(id){ const g=GUNS[id]||{}, m=DMG_TYPE[g.type]||{}, arc=g.special==='arty'||g.special==='mortar'||g.special==='rocket';
  return ARMOR_VI.map(([k,vi])=>{ let x=m[k]||1; if(k==='A'){ if(arc) x=0; else if(id==='flak') x*=ROSTER.aaBonus; } return { k, vi, x }; }); }
export function effGrade(x){ return x<=0 ? { tx:'KHÔNG VỚI', c:'no' } : x>=1.25 ? { tx:'MẠNH', c:'good' } : x>=0.9 ? { tx:'TỐT', c:'ok' } : { tx:'YẾU', c:'bad' }; }
// comparable numbers (mastery included) and the field-wide maxima used to scale the bars
export function gunNums(id){ const g=GUNS[id]||{}, dMul=gunDmgMul(id), fMul=gunFireMul(id), dmg=g.dmg*dMul*(g.frags||1), rof=1/(g.fireCd*fMul);
  return { dmg:Math.round(dmg), rof, dps:Math.round(dmg*rof), mag:g.mag, reload:g.reload, rng:g.rng||1 }; }
let _max=null; export function gunMax(){ if(_max) return _max; _max={ dmg:1, rof:1, dps:1, rng:1 };
  for(const id of Object.keys(GUNS)){ const g=GUNS[id]; if(!g.dmg) continue; const d=g.dmg*(g.frags||1), r=1/g.fireCd; _max.dmg=Math.max(_max.dmg,d); _max.rof=Math.max(_max.rof,r); _max.dps=Math.max(_max.dps,d*r); _max.rng=Math.max(_max.rng,g.rng||1); }
  return _max; }
// the gun you would compare against: the first one in your loadout
export function currentGunId(){ const L=PROFILE.loadout||[]; return L[0]||'rifle'; }
export function delta(a, b, lowerIsBetter){ if(b==null||a===b) return ''; const better = lowerIsBetter ? a<b : a>b, pct=Math.round(Math.abs(a-b)/Math.max(1e-6,Math.abs(b))*100);
  return '<i class="dl '+(better?'up':'dn')+'">'+(better?'▲':'▼')+pct+'%</i>'; }
