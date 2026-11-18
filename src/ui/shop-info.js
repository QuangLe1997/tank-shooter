// ui/shop-info.js — Z106 what a gun is FOR, in plain words: role tag, effect vs each armour class, comparable numbers + deltas vs your gun
import { DMG_TYPE, ROSTER, FORT, GUN_MODS, GUN_BARRELS } from '../../config.js';
import { GUNS, PROFILE, gunMod, gunSplash, gunStatMax, gunStats } from '../hub.js';

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
  const st=gunStats(id);   // Z230 the real multipliers: lobbed shells ignore armour type and never reach aircraft, flak airbursts ×aaBonus on aircraft
  return ARMOR_VI.map(([k,vi])=>{ let x = st ? st.vs[k] : (m[k]||1); if(!st && k==='A'){ if(arc) x=0; else if(id==='flak') x*=ROSTER.aaBonus; } return { k, vi, x }; })
    .concat([{ k:'S', vi:'Công trình', x:m.struct||1 }]); }   // Z111b vs barricades, towers, camps (fortress walls: never below ×1)
// Z111b siege: damage one round does to a fortress wall / gate
export function gunSiege(id){ const g=GUNS[id]||{}, m=DMG_TYPE[g.type]||{}, k=Math.max(FORT.shotStructMin, m.struct||1), st=gunStats(id); return { k, shot:Math.round(st?st.siegeShot:0), dps:Math.round(st?st.siegeDps:0) }; }   // Z230 from the shared gun model (pellets that land, lobbed shells ×0.8)
export function effGrade(x){ return x<=0 ? { tx:'KHÔNG VỚI', c:'no' } : x>=1.25 ? { tx:'MẠNH', c:'good' } : x>=0.9 ? { tx:'TỐT', c:'ok' } : { tx:'YẾU', c:'bad' }; }
// comparable numbers (mastery included) and the field-wide maxima used to scale the bars
export function gunNums(id){ const s=gunStats(id); if(!s) return { dmg:0, rof:0, dps:0, burst:0, mag:0, reload:0, rng:1, hits:1, v0:0, ttk:0 };   // Z230 the shared gun model (real mechanics at the fighting distance)
  const fin=v=>isFinite(v)?v:9999;
  return { dmg:Math.round(fin(s.shot)), rof:s.rof, dps:Math.round(fin(s.sus)), burst:Math.round(fin(s.burst)), mag:s.mag, reload:s.rel, rng:s.reach, hits:s.hits, v0:s.v0, ttk:s.ttk, st:s }; }
export function gunMax(){ const m=gunStatMax(); return { dmg:m.shot, rof:m.rof, dps:m.sus, rng:m.reach, hits:m.hits, v0:m.v0 }; }
// the gun you would compare against: the first one in your loadout
export function currentGunId(){ const L=PROFILE.loadout||[]; return L[0]||'rifle'; }
export function delta(a, b, lowerIsBetter){ if(b==null||a===b) return ''; const better = lowerIsBetter ? a<b : a>b, pct=Math.round(Math.abs(a-b)/Math.max(1e-6,Math.abs(b))*100);
  return '<i class="dl '+(better?'up':'dn')+'">'+(better?'▲':'▼')+pct+'%</i>'; }

// Z115 everything a gun does, as tags with numbers (pellets, barrels, splash, pierce, guidance, freeze, chain, arc, delayed fuse, roles)
export function gunTraits(id){ const g=GUNS[id]||{}, m=DMG_TYPE[g.type]||{}, T=[], arc=g.special==='mortar'||g.special==='arty'||g.special==='rocket';
  const nB=GUN_BARRELS[id]||1; if(nB>1) T.push({ t:nB+' NÒNG', d:'Bắn luân phiên từ '+nB+' nòng — nhịp đều hơn, không nhân đôi sát thương' });
  if((g.frags||1)>1) T.push({ t:'CHÙM ×'+g.frags, d:g.frags+' viên mỗi phát, toả '+Math.round((g.spread||0)*57)+'°' });
  if(g.aoe) T.push({ t:'NỔ LAN '+g.aoe.toFixed(1)+' m', d:'Nổ lan bán kính '+g.aoe.toFixed(1)+' m, '+Math.round(gunSplash(g)*100)+'% sát thương' });
  if(g.pierce) T.push({ t:'XUYÊN '+g.pierce, d:'Xuyên qua '+g.pierce+' mục tiêu' });
  if(g.homing || g.lock) T.push({ t:'DẪN ĐƯỜNG', d:'Tự bám mục tiêu' });
  if(g.freeze) T.push({ t:'ĐÓNG BĂNG '+g.freeze+' s', d:'Làm địch đứng hình' });
  if(g.chain) T.push({ t:'GIẬT LAN '+g.chain, d:'Tia điện nhảy sang '+g.chain+' địch gần' });
  if(arc) T.push({ t:'CẦU VỒNG', d:'Bắn vòng qua tường thành và vật cản' });
  if(g.special==='rocket') T.push({ t:'NỔ CHẬM', d:'Ngòi nổ trễ khi chạm đất' });
  if(g.special==='flame') T.push({ t:'THIÊU', d:'Gây cháy liên tục' });
  if((m.H||1)>=1.3) T.push({ t:'CHỐNG TĂNG', d:'×'+m.H+' vào xe nặng' });
  if((m.L||1)>=1.3 || g.type==='FRAG') T.push({ t:'DIỆT BỘ BINH', d:'×'+(m.L||1)+' vào mục tiêu nhẹ' });
  if(id==='flak') T.push({ t:'PHÒNG KHÔNG', d:'Xé nát trực thăng' });
  if((m.struct||1)>=1.5) T.push({ t:'PHÁ THÀNH ×'+m.struct, d:'Mạnh vào tường, cổng, tháp' });
  if(g.bspeed && !g.special){ const st=gunStats(id); T.push({ t:'ĐẠN '+Math.round(st.v0)+' m/s', d:'Sơ tốc đầu nòng (đạn chậm dần theo lực cản không khí; tên lửa tăng tốc sau khi rời ống)' }); }   // Z230 the real muzzle velocity
  return T; }
// Z115 parts fitted to a gun: [{k, vi, lv, max, fx}]
export function gunModRows(id){ const M=GUN_MODS; return [
  { k:'barrel', vi:'Nòng tinh chế', lv:gunMod(id,'barrel'), fx:'+'+Math.round(gunMod(id,'barrel')*M.barrel.dmg*100)+'% sát thương · +'+Math.round(gunMod(id,'barrel')*M.barrel.rng*100)+'% tầm' },
  { k:'action', vi:'Khoá nòng', lv:gunMod(id,'action'), fx:'−'+Math.round(gunMod(id,'action')*M.action.fire*100)+'% giãn bắn · −'+Math.round(gunMod(id,'action')*M.action.reload*100)+'% nạp' },
  { k:'mag', vi:'Băng đạn mở rộng', lv:gunMod(id,'mag'), fx:'+'+Math.round(gunMod(id,'mag')*M.mag.mag*100)+'% số viên' } ].map(r=>({ ...r, max:M.max })); }
