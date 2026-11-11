// ui/shop.js — SHOP (buy guns + leveled upgrades with coins / diamonds)
import * as THREE from 'three';
import { BALANCE, RAR_COL, SHOP_UP, GUN_PRICE, VIP_GUNS, GUN_BLURB, UP_BLURB } from '../../config.js';
import { GUNS, PROFILE, S, SHOW, VIEW, __set_BEST, __set_soldierLvl, bloom, camera, canAfford, catVi, currentGunId, delta, deployOwnedDrone, deploySoldiers, dressShowroom, effGrade, escapeHtml, fmtP, guardTarget, gunDmgMul, gunEffect, gunFireMul, gunLevel, gunMagMul, gunMax, gunModRows, gunNums, gunReloadMul, gunRole, gunSiege, gunTraits, gunXpToNext, hide, launchGame, ownGun, payCost, powerKit, powerRating, pumpThumbs, queueThumbs, refreshBestLine, refreshStartUI, refreshWallet, renderPass, saveProfile, scene, setShowEmblem, setShowGun, sfx, shopPowerLine, show, showSalvo, soldierLvl, spawnDrone, svgBadgeTex, svgMarkup, tapBtn, tapEl, thumbURL, upLevel, upMax, updateShowroom } from '../hub.js';

// ---- SHOP (buy guns + leveled upgrades with coins / diamonds) ----
export function shopModel(){
  const cats={}; const push=(c,it)=>{ (cats[c]=cats[c]||[]).push(it); };
  Object.keys(GUN_PRICE).forEach(id=>{ if(!GUNS[id]) return;
    const tier=GUNS[id].tier, vip=VIP_GUNS.includes(id), owned=PROFILE.ownedGuns.includes(id);
    push('WEAPONS', {type:'gun', id, name:GUNS[id].name, icon:GUNS[id].svg||'gun', tier, cost:GUN_PRICE[id], vip, owned, rar: vip?'vip':('t'+tier)}); });
  if(cats.WEAPONS) cats.WEAPONS.sort((a,b)=>(a.owned?1:0)-(b.owned?1:0) || a.tier-b.tier);   // buyable first, owned last
  SHOP_UP.forEach(u=>{ const L=upLevel(u.key), max=upMax(u.key), cost=L<max?u.costs[L]:null;
    push(u.cat, {type:'up', key:u.key, name:u.name, icon:u.icon, per:u.per, level:L, max, cost, vip:!!(cost&&cost.d), rar:(cost&&cost.d)?'vip':'up'}); });
  return ['WEAPONS','FIREPOWER','AMMO','CHASSIS','SUPPORT'].filter(c=>cats[c]&&cats[c].length).map(c=>({cat:c, items:cats[c]}));
}
export const CAT_ICON = { WEAPONS:'rifle', FIREPOWER:'burst', AMMO:'mag', CHASSIS:'shield', SUPPORT:'drone' };
export function priceHTML(cost){ return '<span class="ic">'+svgMarkup(cost.d?'diamond':'coin')+'</span>'+(cost.d? cost.d : cost.c.toLocaleString()); }
// ===== 3D showroom (Z107): the shop scene is dressed as a patch of the current battlefield by ui/showroom.js — your own tank,
// the real barrel of each gun, the battlefield's sky / ground / sun. This module keeps the scene + camera and the shop logic. =====
export const shopScene = new THREE.Scene();
shopScene.background = new THREE.Color(0x05070b);
export const shopCam = new THREE.PerspectiveCamera(34, innerWidth/Math.max(1,innerHeight), 0.1, 120);
shopCam.position.set(0, 3.6, 11); shopCam.lookAt(0, 1.35, 0);
export const _shMetal=(c)=>new THREE.MeshStandardMaterial({color:c,metalness:.85,roughness:.36});
export const _shGlow=(c)=>new THREE.MeshStandardMaterial({color:0x0a0a0a,emissive:c,emissiveIntensity:2.1,metalness:.4,roughness:.4});
export const _shopRay=new THREE.Raycaster();
export function _box(w,h,d,m){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m); }
export function _barX(rt,rb,h,m){ const c=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,18), m); c.rotation.z=Math.PI/2; return c; }   // cylinder lying along X
export function buildGunModel(id){
  const g=GUNS[id]||GUNS.rifle, col=g.color||0xaef0a0, sv=g.svg||'rifle', grp=new THREE.Group();
  // tier/VIP-graded skin: higher tier = shinier + brighter accents; VIP = bright chrome. Reads the rank at a glance.
  const tier=g.tier||1, vip=VIP_GUNS.includes(id), rc=RAR_COL[vip?'vip':('t'+tier)]||0x9fb07a;
  const rough = vip?0.3 : (tier>=3?0.32 : tier===2?0.38 : 0.46), metal = vip?0.9:0.86;
  const dark=new THREE.MeshStandardMaterial({color: vip?0x565b5e:(tier>=3?0x4a4f50:0x3e443e), metalness:metal, roughness:rough});
  const steel=new THREE.MeshStandardMaterial({color: vip?0x787e82:(tier>=3?0x646a6c:0x5c6163), metalness:metal, roughness:rough});
  const acc=new THREE.MeshStandardMaterial({color:0x0a0a0a, emissive:col, emissiveIntensity: vip?2.2:(tier>=3?1.9:tier===2?1.6:1.3), metalness:.4, roughness:.36});
  grp.add(_box(1.5,0.5,0.42,dark));                                            // receiver
  const grip=_box(0.3,0.72,0.34,steel); grip.position.set(-0.36,-0.52,0); grip.rotation.z=0.24; grp.add(grip);
  const stock=_box(0.72,0.42,0.34,dark); stock.position.set(-0.98,-0.06,0); grp.add(stock);
  const mag=_box(0.34,0.62,0.3,acc); mag.position.set(0.16,-0.52,0); grp.add(mag);
  const sight=_box(0.3,0.16,0.1,steel); sight.position.set(-0.12,0.34,0); grp.add(sight);
  const bar=(len,rad,y,z,mat)=>{ const c=_barX(rad,rad,len,mat||dark); c.position.set(0.75+len/2, y||0, z||0); grp.add(c); return c; };
  if(id==='mortar'){ const b=bar(1.5,0.19,0.22,0,steel); b.rotation.z=0.34;   // slim, longer tube at a moderate angle (refined mortar)
      const mb=_barX(0.22,0.24,0.26,acc); mb.position.set(1.78,0.62,0); mb.rotation.z=0.34; grp.add(mb);   // fine muzzle
      const plate=_box(0.5,0.14,0.6,dark); plate.position.set(0.38,-0.32,0); grp.add(plate); }   // compact baseplate
  else if(sv==='shotgun'){ bar(1.5,0.1,0.09,0.11); bar(1.5,0.1,0.09,-0.11); }
  else if(sv==='shell'){ bar(1.4,0.23,0.05,0); const mb=_barX(0.3,0.3,0.3,acc); mb.position.set(2.05,0.05,0); grp.add(mb); }     // cannon
  else if(sv==='minigun'){ const hub=_barX(0.34,0.34,0.5,steel); hub.position.set(1.05,0,0); grp.add(hub);
      const cl=new THREE.Group(); for(let i=0;i<6;i++){ const c=_barX(0.07,0.07,1.5,dark); const an=i/6*6.283; c.position.set(1.75,Math.sin(an)*0.22,Math.cos(an)*0.22); cl.add(c);} grp.add(cl); grp._spinPart=cl; }
  else if(sv==='missile'||sv==='rocket'){ const tubes=sv==='rocket'?1:3, rad=sv==='rocket'?0.3:0.14;
      for(let i=0;i<tubes;i++){ const o=(i-(tubes-1)/2); const yy=sv==='rocket'?0:o*0.34, zz=sv==='rocket'?0:o*0.0; const tube=_barX(rad,rad,1.4,steel); tube.position.set(1.25,yy,zz); grp.add(tube);
        const tip=new THREE.Mesh(new THREE.ConeGeometry(rad,0.42,12),acc); tip.rotation.z=-Math.PI/2; tip.position.set(2.05,yy,zz); grp.add(tip); } }
  else if(sv==='rail'){ const r1=_box(1.9,0.07,0.12,steel); r1.position.set(1.2,0.13,0); const r2=r1.clone(); r2.position.y=-0.13; grp.add(r1,r2);
      const core=_barX(0.1,0.1,1.7,acc); core.position.set(1.2,0,0); grp.add(core); for(let i=0;i<3;i++){ const rg=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.04,8,18),acc); rg.position.set(0.65+i*0.6,0,0); grp.add(rg);} }
  else if(sv==='bolt'){ bar(1.2,0.1,0,0,steel); for(let i=0;i<3;i++){ const co=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.06,10,22),acc); co.position.set(0.95+i*0.4,0,0); co.rotation.y=Math.PI/2; grp.add(co);} }
  else if(sv==='snow'){ bar(1.4,0.13,0,0,steel); for(let i=0;i<4;i++){ const cr=new THREE.Mesh(new THREE.OctahedronGeometry(0.15,0),acc); const an=i/4*6.283; cr.position.set(1.7,Math.sin(an)*0.2,Math.cos(an)*0.2); grp.add(cr);} }
  else if(id==='flamer'){ bar(1.3,0.16,0,0,steel); const noz=_barX(0.3,0.16,0.42,dark); noz.position.set(1.75,0,0); grp.add(noz);
      const tank=_barX(0.24,0.24,0.95,acc); tank.position.set(0.35,-0.4,0.16); grp.add(tank);   // fuel tank
      const pilot=new THREE.Mesh(new THREE.SphereGeometry(0.11,10,8),acc); pilot.position.set(2.05,0,0); grp.add(pilot); }   // pilot flame
  else if(id==='arty'){ const b=bar(1.7,0.26,0.12,0,steel); b.rotation.z=0.3;   // thick barrel angled UP (howitzer)
      const mb=_barX(0.42,0.42,0.5,acc); mb.position.set(2.05,0.62,0); mb.rotation.z=0.3; grp.add(mb);   // big muzzle brake
      const base=_barX(0.5,0.6,0.55,dark); base.position.set(0.55,-0.18,0); grp.add(base); }   // recoil base
  else { bar(sv==='smg'?1.0:1.6,0.1); const mz=_barX(0.14,0.14,0.18,acc); mz.position.set(sv==='smg'?1.4:1.7,0,0); grp.add(mz); }   // rifle/smg/default
  const auraN = vip?2:(tier>=3?1:0);   // slim energy rings orbit the higher tiers — a tasteful halo, not a blast
  if(auraN){ const aura=new THREE.Group();
    for(let i=0;i<auraN;i++){ const r=new THREE.Mesh(new THREE.TorusGeometry(1.25+i*0.22,0.028,8,52), new THREE.MeshStandardMaterial({color:0x000000,emissive:rc,emissiveIntensity:1.5,roughness:.4}));
      r.rotation.x=Math.PI/2.3 + i*0.55; aura.add(r); }
    grp.add(aura); grp._aura=aura; }
  grp.scale.setScalar(vip?1.32:(tier>=3?1.26:tier===2?1.16:1.06));   // bigger = stronger
  return grp;
}
export function buildUpgradeModel(item){
  const grp=new THREE.Group(); const rc=RAR_COL[item.rar]||0x9bd14a;
  const isVip=item.rar==='vip';
  const mat=new THREE.MeshStandardMaterial({color:0x0a0d0a,emissive:rc,emissiveIntensity:isVip?1.7:1.1,metalness:.65,roughness:isVip?0.18:0.3});
  let core;
  if(item.key==='dronePow'||item.key==='droneRof'||item.key==='droneArm'){          // mini escort drone (quad-rotor)
    core=new THREE.Group();
    core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.6,0), mat));
    const rotMat=new THREE.MeshStandardMaterial({color:0x0a0d0a,emissive:rc,emissiveIntensity:0.8,transparent:true,opacity:0.5,metalness:.5,roughness:.3});
    for(const [ax,az] of [[0.78,0.78],[-0.78,0.78],[0.78,-0.78],[-0.78,-0.78]]){
      const arm=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.08,Math.hypot(ax,az)), mat); arm.position.set(ax/2,0,az/2); arm.rotation.y=Math.atan2(ax,az); core.add(arm);
      const rotor=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.04,18), rotMat); rotor.position.set(ax,0.12,az); core.add(rotor);
    }
  } else if(item.key==='guardRof'||item.key==='guardArm'){                          // mini guard (helmet + torso)
    core=new THREE.Group();
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,1.0,14), mat); torso.position.y=-0.1; core.add(torso);
    core.add(new THREE.Mesh(new THREE.SphereGeometry(0.34,16,12), mat).translateY(0.62));
    const helm=new THREE.Mesh(new THREE.SphereGeometry(0.4,16,8,0,6.3,0,1.45), mat); helm.position.y=0.66; core.add(helm);
  } else {
    let geo;
    switch(item.key){
      case 'damage': geo=new THREE.TetrahedronGeometry(1.05,0); break;
      case 'range':  geo=new THREE.CylinderGeometry(0.22,0.22,2.0,22); break;
      case 'reload': case 'mag': geo=new THREE.BoxGeometry(0.9,1.3,0.62); break;
      case 'hp':     geo=new THREE.IcosahedronGeometry(1.05,0); break;
      case 'armor':  geo=new THREE.CylinderGeometry(1.1,1.1,0.26,8); break;
      case 'engine': geo=new THREE.TorusGeometry(0.74,0.3,18,30); break;
      default:       geo=new THREE.OctahedronGeometry(1.05,0);
    }
    core=new THREE.Mesh(geo, mat);
  }
  core.position.y=1.55; core.scale.setScalar(isVip?1.18:1); grp.add(core); grp._spinPart=core;
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:svgBadgeTex(item.icon,'#'+rc.toString(16).padStart(6,'0')),transparent:true,depthWrite:false}));
  spr.scale.set(1.25,1.25,1); spr.position.set(0,3.0,0); grp.add(spr);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.45,0.045,10,44), _shGlow(rc)); halo.rotation.x=Math.PI/2; halo.position.y=0.28; grp.add(halo);
  if(isVip){ const aura=new THREE.Group();   // VIP upgrade gets slim orbiting energy rings too
    for(let i=0;i<2;i++){ const r=new THREE.Mesh(new THREE.TorusGeometry(1.3+i*0.22,0.028,8,52), new THREE.MeshStandardMaterial({color:0x000000,emissive:rc,emissiveIntensity:1.5,roughness:.4}));
      r.rotation.x=Math.PI/2.3+i*0.55; r.position.y=1.55; aura.add(r); }
    grp.add(aura); grp._aura=aura; }
  grp._floatLock=true;
  return grp;
}
export function disposeObj(o){ o.traverse&&o.traverse(c=>{ if(c.geometry)c.geometry.dispose(); if(c.material){ (Array.isArray(c.material)?c.material:[c.material]).forEach(m=>{ if(m.map)m.map.dispose(); m.dispose&&m.dispose(); }); } }); }
// GUN_BLURB / UP_BLURB now imported from config.js
export function itemBlurb(it){ return it.type==='gun' ? (GUN_BLURB[it.id]||'') : (UP_BLURB[it.key]||''); }
export let _focusAt=0;
export let shopOpen=false, shopDetail3D=false, shopCats=[], activeCat='', shopList=[], shopIdx=0, shopHero=null, _shopT=0;
export function shopRefreshData(){ shopCats=shopModel(); if(!shopCats.find(c=>c.cat===activeCat)) activeCat=shopCats.length?shopCats[0].cat:''; shopList=(shopCats.find(c=>c.cat===activeCat)||{items:[]}).items; }
export function buildShopTabs(){ const tb=document.getElementById('shopTabs'); if(!tb) return; tb.innerHTML='';
  shopCats.forEach(g=>{ const t=document.createElement('div'); t.className='shop-tab'+(g.cat===activeCat?' on':''); t.dataset.cat=g.cat; t.textContent=catVi(g.cat); tapEl(t, ()=>setActiveCat(g.cat)); tb.appendChild(t); }); }
export function setActiveCat(cat){ activeCat=cat; shopRefreshData(); buildShopTabs(); renderCaseGrid(); showGrid(); sfx('click'); }
// Z106 how much more you need, e.g. '400 xu' / '6 ◆'
export function shortBy(cost){ if(!cost) return ''; if(cost.d) return Math.max(0, cost.d-(PROFILE.diamonds||0))+' ◆'; return Math.max(0, cost.c-(PROFILE.coins||0)).toLocaleString()+' xu'; }
export function caseState(it){ const owned=it.type==='gun'&&it.owned, maxed=it.type==='up'&&it.level>=it.max;
  return owned?'owned':maxed?'maxed':(!(it.cost&&canAfford(it.cost))?'cant':''); }
export function renderCaseGrid(){
  { const sp=document.getElementById('shopPower'); if(sp) sp.innerHTML='⚔ <b>'+fmtP(powerRating(powerKit(false)))+'</b>'; }
  const grid=document.getElementById('caseGrid'); if(!grid) return; grid.innerHTML=''; refreshWallet();
  shopList.forEach((it,i)=>{
    const st=caseState(it), badge=it.type==='gun'?(it.vip?'VIP ◆':('BẬC '+it.tier)):('CẤP '+it.level+'/'+it.max);
    const short = st==='cant' && it.cost ? shortBy(it.cost) : '';
    const price = (it.type==='gun'&&it.owned)?('✓ ĐÃ CÓ · ★'+gunLevel(it.id)) : (it.type==='up'&&it.level>=it.max)?'✓ TỐI ĐA' : '<span class="pr">'+priceHTML(it.cost)+'</span>'+(short?'<small class="short">thiếu '+short+'</small>':'');
    let extra='';
    if(it.type==='gun'){ const r=gunRole(it.id), n=gunNums(it.id), M=gunMax(), bar=(lb,v)=>'<div class="cb"><span>'+lb+'</span><i style="--v:'+Math.max(0.06,Math.min(1,v)).toFixed(2)+'"></i></div>';   // Z106 what it is for + how it compares, at a glance
      extra='<div class="case-role" style="--rc:'+r.col+'">'+r.tx+'</div><div class="case-bars">'+bar('ST', n.dmg/M.dmg)+bar('NHỊP', n.rof/M.rof)+bar('TẦM', n.rng/M.rng)+'</div>'; }
    else { let pips=''; for(let k=0;k<it.max;k++) pips+='<i class="'+(k<it.level?'on':'')+'"></i>'; extra='<div class="case-role up">'+escapeHtml(it.per||'')+'</div><div class="case-pips">'+pips+'</div>'; }
    const c=document.createElement('div'); c.className='case rar-'+it.rar+(st?' '+st:'');
    const disp = it.type==='gun'                                                                          // Z107 guns: a photo of YOUR tank carrying that gun
      ? '<div class="case-disp photo'+(thumbURL(it.id)?' shot-ok':'')+'"><img class="case-shot" data-thumb="'+it.id+'" alt="" src="'+(thumbURL(it.id)||'data:image/gif;base64,R0lGODlhAQABAAAAACw=')+'"><span class="case-ic">'+svgMarkup(it.icon)+'</span></div>'
      : '<div class="case-disp"><span class="case-ic">'+svgMarkup(it.icon)+'</span></div>';
    c.innerHTML='<span class="case-badge">'+badge+'</span>'+disp+
      '<div class="case-nm">'+it.name+'</div>'+extra+'<div class="case-price">'+price+'</div>';
    tapEl(c, ()=>openDetail(i)); grid.appendChild(c);
  });
  queueThumbs(shopList.filter(it=>it.type==='gun').map(it=>it.id));
}
export function shopStat(label,val,tag){ return '<span class="st'+(tag?' tag':'')+'">'+(label?label+' ':'')+'<b>'+val+'</b></span>'; }
export function shopStats(it){
  if(it.type==='gun'){ const g=GUNS[it.id], out=[];
    out.push(shopStat('Sát thương', g.dmg)); out.push(shopStat('Nhịp', (1/g.fireCd).toFixed(g.fireCd<0.2?0:1)+' phát/s')); out.push(shopStat('Băng', g.mag));
    if(g.frags>1) out.push(shopStat('', g.frags+' VIÊN/PHÁT', true));
    if(g.pierce) out.push(shopStat('','XUYÊN',true)); if(g.aoe||g.aoeR) out.push(shopStat('','NỔ LAN',true));
    if(g.homing||g.lock) out.push(shopStat('','TỰ DẪN',true)); if(g.freeze) out.push(shopStat('','ĐÓNG BĂNG',true)); if(g.chain) out.push(shopStat('','LAN ĐIỆN',true));
    return out.join(''); }
  const out=[shopStat('', it.per)]; out.push(shopStat('Cấp', it.level+' / '+it.max));
  if(it.level>=it.max) out.push(shopStat('','TỐI ĐA',true)); return out.join('');
}
// rich side panel (bars) — the eye-candy stat sheet beside the 3D item
export function spBar(label,val,frac){ frac=Math.max(0.05,Math.min(1,frac));
  return '<div class="sp-bar"><div class="sp-bl">'+label+'<b>'+val+'</b></div><div class="sp-track"><div class="sp-fill" style="width:'+(frac*100).toFixed(0)+'%"></div></div></div>'; }
export function siPanelHTML(it){
  const PW=shopPowerLine(it);   // Z107 what this purchase does to your power rating
  if(it.type==='gun'){ const g=GUNS[it.id], lv=gunLevel(it.id);
    const dMul=gunDmgMul(it.id), fMul=gunFireMul(it.id), rMul=gunReloadMul(it.id);
    const edmg=Math.round(g.dmg*dMul), rof=1/(g.fireCd*fMul), dps=Math.round(edmg*(g.frags||1)*rof), erel=g.reload*rMul;
    const T=gunTraits(it.id), mods=gunModRows(it.id), emag=Math.round(g.mag*gunMagMul(it.id));   // Z115 full traits + gun parts
    const nx=gunXpToNext(it.id);
    const mastery = it.owned ? ('<div class="sp-mastery">★ THÔNG THẠO <b>CẤP '+lv+' / '+BALANCE.mastery.maxLevel+'</b>'+
        (nx?'<span class="sp-xp">'+nx.have+' / '+nx.need+' ▸ CẤP '+(lv+1)+'</span>':'<span class="sp-xp">★ TỐI ĐA</span>')+'</div>'+
        (lv>1?'<div class="sp-mbuff">+'+Math.round((dMul-1)*100)+'% sát thương · +'+Math.round((1/fMul-1)*100)+'% tốc bắn · −'+Math.round((1-rMul)*100)+'% nạp</div>':''))
      : '';
    const role=gunRole(it.id), cur=currentGunId(), cmp = cur!==it.id ? gunNums(cur) : null, me=gunNums(it.id), M=gunMax();
    const eff='<div class="sp-eff">'+gunEffect(it.id).map(e=>{ const G=effGrade(e.x); return '<span class="ef '+G.c+'"><small>'+e.vi+'</small><b>'+(e.x>0?'×'+e.x.toFixed(2).replace(/0$/,''):'—')+'</b><em>'+G.tx+'</em></span>'; }).join('')+'</div>';
    return PW+'<div class="sp-tier">'+(it.vip?'★ VŨ KHÍ VIP':'VŨ KHÍ BẬC '+g.tier)+'</div>'+
      '<div class="sp-role" style="--rc:'+role.col+'">'+role.tx+'</div>'+ mastery+
      spBar('Sát thương / phát', edmg*(g.frags||1)+(lv>1?' ▲':'')+(cmp?delta(me.dmg,cmp.dmg):''), me.dmg/M.dmg)+ spBar('Nhịp bắn', rof.toFixed(rof<1?2:1)+' /s'+(cmp?delta(me.rof,cmp.rof):''), rof/M.rof)+
      spBar('Sát thương / giây', dps+(cmp?delta(me.dps,cmp.dps):''), dps/M.dps)+ spBar('Tầm bắn', '×'+me.rng.toFixed(2)+(cmp?delta(me.rng,cmp.rng):''), me.rng/M.rng)+
      (()=>{ const sg=gunSiege(it.id); return '<div class="sp-bl sp-siege">Phá tường thành<b>'+sg.shot+' / phát · '+sg.dps+' /s'+(sg.k>1?' ×'+sg.k.toFixed(1):'')+'</b></div>'; })()+
      '<div class="sp-bl">Băng đạn<b>'+emag+' viên'+(emag>g.mag?' ▲':'')+'</b></div>'+
      (g.aoe?'<div class="sp-bl">Nổ lan<b>'+g.aoe.toFixed(1)+' m · '+Math.round(edmg*0.8)+' / phát</b></div>':'')+
      ((g.frags||1)>1?'<div class="sp-bl">Số viên / phát<b>'+g.frags+' × '+edmg+'</b></div>':'')+
      (g.pierce?'<div class="sp-bl">Xuyên mục tiêu<b>'+g.pierce+'</b></div>':'')+'<div class="sp-bl">Nạp đạn<b>'+erel.toFixed(1)+' s'+(cmp?delta(g.reload,GUNS[cur].reload,true):'')+'</b></div>'+
      '<div class="sp-sub">HIỆU QUẢ VỚI</div>'+eff+
      '<div class="sp-note">Bộ binh: mọi phát pháo xe tăng đều hạ gục 1 lính'+((g.aoe||g.aoeR)?' · nổ lan diệt cả cụm':'')+'</div>'+
      (cmp?'<div class="sp-note">So với <b>'+escapeHtml(GUNS[cur].name)+'</b> (súng chính đang dùng)</div>':'')+
      (T.length?'<div class="sp-sub">ĐẶC TÍNH</div><div class="sp-tags">'+T.map(t=>'<span class="st" title="'+escapeHtml(t.d)+'">'+t.t+'</span>').join('')+'</div>':'')+
      '<div class="sp-sub">LINH KIỆN (nhặt trong trận · vĩnh viễn)</div><div class="sp-mods">'+mods.map(r=>'<div class="sp-mod'+(r.lv?' on':'')+'"><span>'+r.vi+'</span><i>'+'■'.repeat(r.lv)+'<u>'+'□'.repeat(r.max-r.lv)+'</u></i><small>'+(r.lv?r.fx:'chưa lắp')+'</small></div>').join('')+'</div>'; }
  return PW+'<div class="sp-tier">'+(it.level>=it.max?'CẤP TỐI ĐA':(it.vip?'★ NÂNG CẤP VIP':'NÂNG CẤP'))+'</div>'+
    spBar('Level', it.level+' / '+it.max, it.level/it.max)+
    '<div class="sp-bl">Mỗi cấp<b>'+it.per+'</b></div>'+
    '<div class="sp-bl">Đang có<b>×'+it.level+'</b></div>'+
    (it.level<it.max?'<div class="sp-bl">Tiếp theo<b>CẤP '+(it.level+1)+'</b></div>':'<div class="sp-tags"><span class="st">ĐÃ NÂNG TỐI ĐA</span></div>');
}
export function updateShopInfo(){
  { const sp=document.getElementById('shopPower'); if(sp) sp.innerHTML='⚔ <b>'+fmtP(powerRating(powerKit(false)))+'</b>'; }
  const it=shopList[shopIdx]; if(!it) return;
  const hex='#'+(RAR_COL[it.rar]||0xffce4a).toString(16).padStart(6,'0');
  document.getElementById('shopInfo').style.setProperty('--rar',hex);
  document.getElementById('si-cat').textContent = catVi(activeCat) + (it.type==='gun'?(it.vip?' · VIP':' · BẬC '+it.tier):'');
  document.getElementById('si-name').textContent = it.name;
  document.getElementById('si-desc').textContent = itemBlurb(it);
  document.getElementById('si-stats').innerHTML = shopStats(it);
  const sp=document.getElementById('siPanel'); if(sp){ sp.style.setProperty('--rar',hex); sp.innerHTML=siPanelHTML(it); }
  const owned = it.type==='gun' && it.owned, maxed = it.type==='up' && it.level>=it.max;
  const cant = !owned && !maxed && !(it.cost && canAfford(it.cost));
  const buy=document.getElementById('si-buy');
  buy.className='si-buy '+(owned?'owned':maxed?'maxed':cant?'cant':(it.vip?'vip':''));
  buy.innerHTML = owned?'✓ ĐÃ CÓ — chọn trong KHO SÚNG' : maxed?'✓ ĐÃ NÂNG TỐI ĐA' : cant ? ('CẦN THÊM '+shortBy(it.cost)+' <small>(giá '+priceHTML(it.cost)+')</small>') : (it.cost? ('MUA · '+priceHTML(it.cost)) : 'TỐI ĐA');
  document.getElementById('si-pos').textContent = catVi(activeCat)+'  ·  '+(shopIdx+1)+' / '+shopList.length;
  refreshWallet();
}
export function spawnShopHero(){
  setShowEmblem(null); shopHero=null;
  const it=shopList[shopIdx]; if(!it) return;
  if(it.type==='gun') setShowGun(it.id);                                       // the real barrel of this gun, on your tank
  else { setShowGun(currentGunId()); shopHero=setShowEmblem(buildUpgradeModel(it)); }   // upgrades: your tank as it is now + the upgrade emblem
  updateShopInfo();
}
export function showGrid(){ shopDetail3D=false; renderPass.scene=shopScene; renderPass.camera=shopCam;   // your tank parked behind the cabinets
  setShowEmblem(null); shopHero=null; setShowGun(currentGunId()); document.body.classList.remove('shopdetail');
  document.getElementById('caseGrid').classList.remove('hidden'); document.getElementById('shopHint').classList.remove('hidden');
  document.getElementById('shopDone').classList.remove('hidden'); document.getElementById('shopDetailView').classList.add('hidden'); }
export function openDetail(i){ shopIdx=i;
  document.getElementById('caseGrid').classList.add('hidden'); document.getElementById('shopHint').classList.add('hidden');
  document.getElementById('shopDone').classList.add('hidden'); document.getElementById('shopDetailView').classList.remove('hidden');
  renderPass.scene=shopScene; renderPass.camera=shopCam; shopDetail3D=true; document.body.classList.add('shopdetail'); _focusAt=0; spawnShopHero(); sfx('click'); }
export function backToGrid(){ shopRefreshData(); renderCaseGrid(); showGrid(); sfx('click'); }
export function shopGo(d){ if(!shopList.length) return; shopIdx=(shopIdx+d+shopList.length)%shopList.length; sfx('click'); spawnShopHero(); }
export function buyShop(it){
  it = it || shopList[shopIdx]; if(!it) return;
  if(it.type==='gun' && PROFILE.ownedGuns.includes(it.id)){ sfx('click'); return; }   // own it → never re-buy
  if(it.type==='up' && upLevel(it.key)>=upMax(it.key)){ sfx('click'); return; }        // maxed
  if(!it.cost || !canAfford(it.cost)){ sfx('click'); return; }                          // can't afford
  if(it.type==='up'){ payCost(it.cost); PROFILE.upgrades[it.key]=upLevel(it.key)+1;
    if(S.mode==='playing'){                                                              // live effect if bought mid-run
      if(it.key.startsWith('drone')){ if(S.drone) spawnDrone(S.drone.owned); else deployOwnedDrone(); }
      else if(it.key==='guards'){ deploySoldiers(guardTarget()); }                        // extra guard joins the line now
      else if(it.key==='troops'){ __set_soldierLvl(Math.max(soldierLvl, PROFILE.upgrades.troops||0)); }
    } }
  else { payCost(it.cost); ownGun(it.id); }
  saveProfile(); sfx('powerup'); refreshStartUI();
  const key = it.type==='gun'?('g:'+it.id):('u:'+it.key);
  shopRefreshData(); const ni=shopList.findIndex(x=> (x.type==='gun'?'g:'+x.id:'u:'+x.key)===key); shopIdx = ni>=0?ni:Math.min(shopIdx,shopList.length-1);
  if(shopDetail3D){ spawnShopHero(); if(it.type==='gun') showSalvo(); } else renderCaseGrid();   // Z107 a new gun: the tank fires it three times
}
export function openShop(){ shopOpen=true; document.body.classList.add('shopopen'); dressShowroom(); if(SHOW.bloom0==null) SHOW.bloom0=bloom.strength; bloom.strength=SHOW.bloom0*0.5; shopRefreshData();   // Z107 softer glow in daylight close-ups
  buildShopTabs(); renderCaseGrid(); showGrid(); hide('start'); show('shop'); refreshWallet(); sfx('click'); }
export function closeShop(){ shopOpen=false; shopDetail3D=false; document.body.classList.remove('shopopen','shopdetail'); renderPass.scene=scene; renderPass.camera=camera; if(SHOW.bloom0!=null) bloom.strength=SHOW.bloom0;
  setShowEmblem(null); shopHero=null;
  saveProfile(); hide('shop'); if(S.mode==='start') show('start'); refreshStartUI(); sfx('click'); }
export function shop3dUpdate(dt){
  _shopT += dt;
  if(_shopT>_focusAt){ _focusAt=_shopT+0.5; const sp=document.getElementById('siPanel');   // keep the tank clear of the stat panel (measured twice a second, not every frame)
    SHOW.focusX = shopDetail3D && sp && sp.offsetParent ? (sp.getBoundingClientRect().right/Math.max(1,VIEW.w))*0.42 : 0; }
  updateShowroom(dt, shopDetail3D);
  if(!shopDetail3D) pumpThumbs();                                              // one card photo per frame (drawn over by this frame's render)
}
tapBtn('shopBtn', openShop);
tapBtn('shopDone', closeShop);
tapBtn('shopBack', backToGrid);
tapBtn('shopPrev', ()=>shopGo(-1));
tapBtn('shopNext', ()=>shopGo(1));
tapBtn('si-buy', ()=>buyShop());
addEventListener('pagehide', saveProfile);
addEventListener('visibilitychange', ()=>{ if(document.hidden) saveProfile(); });
// ---- continue / reset (tap-to-arm, no native dialog) ----
tapBtn('continueBtn', ()=>launchGame(true));
export let _resetArm=0;
tapBtn('resetBtn', ()=>{
  const lbl=document.querySelector('#resetBtn span:last-child'); const now=performance.now();
  if(now<_resetArm){ _resetArm=0;                       // CLEAR SESSION → wipe the whole account (wallet, upgrades, arsenal, progress); keep nickname
    PROFILE.save=null; PROFILE.best={score:0,stage:1}; __set_BEST(PROFILE.best); PROFILE.coins=0; PROFILE.diamonds=0; PROFILE.upgrades={}; PROFILE.gunXp={}; PROFILE.ownedGuns=['rifle']; PROFILE.loadout=['rifle'];
    saveProfile(); refreshBestLine(); refreshStartUI(); refreshWallet(); if(lbl) lbl.textContent='ĐÃ XOÁ ✓'; sfx('click'); setTimeout(()=>{ if(lbl) lbl.textContent='XOÁ'; },1400); }
  else { _resetArm=now+2600; if(lbl) lbl.textContent='CHẮC CHƯA?'; sfx('click'); setTimeout(()=>{ if(performance.now()>=_resetArm && lbl) lbl.textContent='XOÁ'; },2700); }
});
