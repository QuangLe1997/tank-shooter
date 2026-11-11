// combat/power.js — Z107 POWER RATING: your tank's strength (sustained firepower × effective HP) and each level's threat (its real wave mix, HP / damage / accuracy ramps), on one scale — 1000 = new tank on level 1.
import { ARMOR, BALANCE, DMG_TYPE, INFANTRY, POWER, RAMP } from '../../config.js';
import { ENEMY_DEFS, GUNS, PROFILE, S, campaignMax, gunDmgMul, gunFireMul, gunMagMul, gunReloadMul, wavePool, waveSize, waveSquads } from '../hub.js';

// ---- your side ----
// kit: the numbers that decide a fight. live=true reads the tank in battle (run picks included), else the profile (shop + mastery)
export function powerKit(live, over){ const U={ ...(PROFILE.upgrades||{}), ...((over&&over.up)||{}) }, B=BALANCE.up, p=live && S.player && S.player.guns ? S.player : null;
  const k = p ? { dmgMul:p.dmgMul, fireMul:p.fireMul, reloadMul:p.reloadMul, magMul:p.magMul||1, maxHp:p.maxHp, armor:p.armor||0, speed:p.speedMul||1, guns:p.guns.map(g=>g.id), mastery:true }
              : { dmgMul:1+(U.damage||0)*B.damage, fireMul:1, reloadMul:1/(1+(U.reload||0)*B.reload), magMul:1+(U.mag||0)*B.mag, maxHp:100+(U.hp||0)*B.hp,
                  armor:Math.min(0.6,(U.armor||0)*B.armor), speed:1+(U.engine||0)*B.engine, guns:(PROFILE.loadout&&PROFILE.loadout.length?PROFILE.loadout:['rifle']).slice(), mastery:true };
  if(over && over.gun && !k.guns.includes(over.gun)) k.guns.push(over.gun);   // "what if I bought / carried this gun"
  return k; }
export const REF_KIT = { dmgMul:1, fireMul:1, reloadMul:1, magMul:1, maxHp:100, armor:0, speed:1, guns:['rifle'], mastery:false };
// one gun's sustained damage per second against an armour mix (mag + reload cycle, crowd bonus)
export function gunPower(id, K, mix){ const g=GUNS[id]; if(!g || !g.dmg) return { dps:0, shot:0 };
  const dM=K.mastery?gunDmgMul(id):1, fM=K.mastery?gunFireMul(id):1, rM=K.mastery?gunReloadMul(id):1;
  const shot=g.dmg*(g.frags||1)*dM*K.dmgMul, fcd=g.fireCd*fM*K.fireMul, mag=Math.max(1, Math.round(g.mag*K.magMul*(K.mastery?gunMagMul(id):1))), rel=g.reload*rM*K.reloadMul;
  const sus=shot*mag/(mag*fcd+rel), C=POWER.crowd, crowd=((g.aoe||g.aoeR)?C.aoe:1)*(g.pierce?C.pierce:1)*(g.chain?C.chain:1);
  const T=DMG_TYPE[g.type]||{}; let eff=0, tw=0; for(const k in mix){ eff+=mix[k]*(T[k]||1); tw+=mix[k]; } eff=tw?eff/tw:1;
  return { dps:sus*crowd*eff, shot }; }
// best gun you carry (you switch to it) → offense; HP, armour, dodge → effective HP
export function kitSides(K, mix){ let best={ dps:0, shot:1 }; for(const id of K.guns){ const r=gunPower(id, K, mix); if(r.dps>best.dps) best=r; }
  const ehp=K.maxHp/(1-Math.min(0.9,K.armor))*(1+POWER.dodgeK*Math.max(0,K.speed-1)); return { off:best.dps, shot:best.shot, ehp }; }
// ---- the level's side ----
const _lv={};
export function levelThreat(L, diff){ const key=L+'|'+(diff||PROFILE.difficulty); if(_lv[key]) return _lv[key];
  const loop=Math.floor((L-1)/5), stage=(L-1)%5+1, D=BALANCE.difficulty[diff||PROFILE.difficulty]||BALANCE.difficulty.soldier, A=BALANCE.aggro, ds=Math.min(1,(stage-1)/4), E=BALANCE.elite;
  const eliteP=Math.min(E.capChance, E.chancePerStage*(stage-1)+E.chancePerLoop*loop);
  const hpMul=(1+loop*BALANCE.loop.hp)*D.hp*(1+RAMP.hpPerStage*(stage-1)), dmgMul=(0.65+0.35*ds)*(1+loop*BALANCE.loop.dmg)*D.dmg;
  const rate=A.rateBase-A.rateDrop*ds, fire=Math.min(1, A.fireChanceBase+ds*A.fireChanceRamp), cap=Math.floor(BALANCE.wave.capBase+stage*BALANCE.wave.capPerStage);
  let pool=0, inDps=0, infN=0; const mix={ L:0, M:0, H:0, A:0 }, W=POWER.waves;
  for(const w of W){ const P=wavePool(stage, w), tw=P.reduce((s,q)=>s+q[1],0), n=waveSize(stage, w); let sumD=0;
    for(const [ty,wt] of P){ const def=ENEMY_DEFS[ty]; if(!def) continue; const cnt=n*wt/tw, eM=1+eliteP*(E.hpMul-1), hp=def.hp*hpMul*eM;
      pool+=cnt*hp; mix[ARMOR[ty]||'M']+=cnt*hp;
      let dps; if(def.canShoot && def.dmg){ const spread=A.spreadBase*(1-ds*A.spreadDrop)*(def.accurate?A.accurateMul:1)/(1+loop*A.loopAcc), hit=Math.min(1, 2*POWER.hitHalfW/Math.max(0.02,spread));
          const iv = def.burst ? (def.burst*def.fireCd + (def.reload||2)*rate)/def.burst : def.fireCd*rate; dps=def.dmg*dmgMul*hit*fire/iv; }
        else dps=(POWER.special[ty]||1)*dmgMul;
      sumD+=cnt*dps*(1+eliteP*(E.dmgMul-1)); }
    const sq=waveSquads(stage, w), men=sq*((INFANTRY.squad.size[0]+INFANTRY.squad.size[1])/2); infN+=men;
    const infD=men*(INFANTRY.rifle.dmg/INFANTRY.rifle.fireCd*0.8 + INFANTRY.rpg.dmg/INFANTRY.rpg.fireCd*0.2)*POWER.infHit*dmgMul;
    inDps += (sumD/n)*Math.min(n, cap)*POWER.engaged + infD*POWER.engaged*0.5; }
  const r={ L, stage, loop, pool:pool/W.length, infN:infN/W.length, inDps:inDps/W.length, mix };
  return (_lv[key]=r); }
// fight ratio: how long you live ÷ how long a wave takes you
export function fightRatio(K, L, diff){ const T=levelThreat(L, diff), m=T.mix, s=kitSides(K, m); if(s.off<=0) return 0;
  const ttc=(T.pool + T.infN*s.shot)/s.off, ttd=s.ehp/T.inDps; return ttd/ttc; }
let _Fref=null; export function refRatio(){ return _Fref || (_Fref=fightRatio(REF_KIT, 1, 'soldier')); }
// ---- what the UI shows ----
// your rating (neutral armour mix): 1000 = new tank
export function powerRating(K){ const a=kitSides(K, POWER.mix0), b=kitSides(REF_KIT, POWER.mix0); return Math.round(1000*Math.sqrt((a.off*a.ehp)/(b.off*b.ehp))); }
// a level: what it asks for (in rating points, for YOUR build) and how you stand
export function levelCheck(L, K, diff){ K=K||powerKit(false); const F=fightRatio(K, L, diff), Fr=refRatio(), q=F/Fr, ratio=Math.sqrt(q<1 ? Math.pow(q, POWER.calib) : q), P=powerRating(K), need=Math.round(P/Math.max(0.05,ratio));   // calib: harder-than-reference levels grow as measured
  const band=POWER.bands.find(b=>ratio>=b[0]); return { P, need, ratio, tx:band[1], col:band[2] }; }
// which purchase lifts you most per coin (for the "gợi ý" line)
export function powerGain(over){ const a=powerRating(powerKit(false)), b=powerRating(powerKit(false, over)); return b-a; }
// current campaign level of the battle in progress
export function liveLevel(){ return Math.max(1, (S.loop||0)*5 + (S.stage||1)); }
// rating of a would-be tank after a between-stage pick (applies the pick to a copy of the live kit)
export function pickGain(u){ const K=powerKit(true), fake={ maxHp:K.maxHp, hp:K.maxHp, dmgMul:K.dmgMul, fireMul:K.fireMul, reloadMul:K.reloadMul, magMul:K.magMul, armor:K.armor, speedMul:K.speed, rangeMul:1, crit:0, lifesteal:0, guns:K.guns.map(id=>({id})), dashCdMul:1, spellCdMul:1, bossMul:1 };
  try{ u.apply(fake); }catch(e){ return 0; }
  const K2={ ...K, maxHp:fake.maxHp, dmgMul:fake.dmgMul, fireMul:fake.fireMul, reloadMul:fake.reloadMul, magMul:fake.magMul, armor:fake.armor, speed:fake.speedMul };
  return powerRating(K2)-powerRating(K); }
export const fmtP = n => Math.round(n).toLocaleString('vi-VN');
// ---- UI ----
export function verdictHTML(c){ return '<i class="pv" style="--pc:'+c.col+'">'+c.tx+'</i>'; }
// home screen: your rating and what the next campaign level asks
export function refreshPowerChip(){ const el=document.getElementById('powerChip'); if(!el) return; const L=campaignMax(), c=levelCheck(L);
  el.innerHTML='<span class="ic">⚔</span> SỨC MẠNH XE <b>'+fmtP(c.P)+'</b><span class="sep">·</span>CẤP '+L+' CẦN <b>'+fmtP(c.need)+'</b> '+verdictHTML(c); }
// in battle: live rating (run picks included) vs this stage
let _ph='', _pt=0;
export function updatePowerHud(now){ if(now<_pt) return; _pt=now+1; const el=document.getElementById('powHud'); if(!el || !S.player) return;
  const c=levelCheck(liveLevel(), powerKit(true)); const h='⚔ <b>'+fmtP(c.P)+'</b> / CẦN '+fmtP(c.need)+' '+verdictHTML(c); if(h!==_ph){ _ph=h; el.innerHTML=h; } }
// shop: what buying this does to your rating
export function shopPowerLine(it){ const P=powerRating(powerKit(false)); let g=0, note='';
  if(it.type==='gun'){ g=powerGain({ gun:it.id }); note = g>0 ? '' : ' <small>(không mạnh hơn súng tốt nhất bạn mang)</small>'; }
  else if(it.level<it.max){ g=powerGain({ up:{ [it.key]:(it.level||0)+1 } }); if(!g) note=' <small>(hỗ trợ — không tính vào sức mạnh xe)</small>'; }
  return '<div class="sp-pw">⚔ SỨC MẠNH <b>'+fmtP(P)+'</b>'+(g?' → <b>'+fmtP(P+g)+'</b> <em class="'+(g>0?'up':'dn')+'">'+(g>0?'+':'')+fmtP(g)+'</em>':'')+note+'</div>'; }
