// tank/kit.js — Z161 WORKSHOP + CREW logic: per-tank upgrade levels, signature modules, the four-seat crew, XP / level-ups, and baking it all into the player
import { AMMO_SHOP } from '../../config.js';
import { CREW_RECRUITS, CREW_SEATS, CREW_TRAITS, CREW_XP, GUNS, KIT_MAX, KIT_SIG, KIT_SIG_NEED, KIT_TRACKS, PROFILE, S, TANK_MODELS, addEra, canAfford, econBuy, econOn, econPend, floatText, kitPrice, magCap, radio, saveProfile, sfx } from '../hub.js';

// ---------------- profile slots (created on first use; old saves just get the defaults) ----------------
export function kitState(id){ if(!PROFILE.kit || typeof PROFILE.kit!=='object') PROFILE.kit={};
  const k=PROFILE.kit[id] || (PROFILE.kit[id]={}); for(const t of KIT_TRACKS) k[t.key]=Math.max(0, Math.min(KIT_MAX, k[t.key]|0)); k.sig=!!k.sig; return k; }
export function crewState(){ let c=PROFILE.crew;
  if(!c || typeof c!=='object') c=PROFILE.crew={ roster:[], seats:{} };
  if(!Array.isArray(c.roster)) c.roster=[]; if(!c.seats || typeof c.seats!=='object') c.seats={};
  for(const r of CREW_RECRUITS) if(!r.price && !c.roster.some(m=>m.id===r.id)) c.roster.push({ id:r.id, lvl:r.lvl, xp:0 });   // the starting four are always yours
  c.roster=c.roster.filter(m=>CREW_RECRUITS.some(r=>r.id===m.id));
  for(const s of CREW_SEATS){ const cur=crewMember(c.seats[s.key], c); if(!cur || cur.seat!==s.key) c.seats[s.key]='d_'+s.key; }
  return c; }
export function crewMember(id, c){ c=c||PROFILE.crew; const m=c && c.roster && c.roster.find(x=>x.id===id), R=CREW_RECRUITS.find(x=>x.id===id); if(!m||!R) return null;
  return { ...R, lvl:Math.max(1, Math.min(CREW_XP.max, m.lvl|0)), xp:Math.max(0, m.xp|0), _m:m }; }

// ---------------- workshop prices + purchases ----------------
export function kitCost(id, track){ const M=TANK_MODELS[id]; return kitPrice(M&&M.price, kitState(id)[track]); }
export function kitSigReady(id){ const k=kitState(id); return KIT_TRACKS.every(t=>k[t.key]>=KIT_SIG_NEED); }
export async function buyKit(id, track){ const cost=kitCost(id, track); if(!cost || !canAfford(cost)){ sfx('alarm'); return false; }   // Z162 via the server when linked
  const ok=await econBuy('kit', id, track, cost, ()=>{ kitState(id)[track]++; }); sfx(ok?'levelup':'alarm'); return ok; }
export async function buySig(id){ const S0=KIT_SIG[id], k=kitState(id); if(!S0 || k.sig || !kitSigReady(id) || !canAfford({ d:S0.d })){ sfx('alarm'); return false; }
  const ok=await econBuy('sig', id, null, { d:S0.d }, ()=>{ kitState(id).sig=true; }); sfx(ok?'levelup':'alarm'); return ok; }

// ---------------- crew: hire, seat, effects, XP ----------------
export function crewNeed(L){ return CREW_XP.base + CREW_XP.step*(L-1); }
export async function hireCrew(rid){ const c=crewState(), R=CREW_RECRUITS.find(x=>x.id===rid); if(!R || c.roster.some(m=>m.id===rid) || !R.price || !canAfford(R.price)){ sfx('alarm'); return false; }
  const ok=await econBuy('crew', rid, null, R.price, ()=>{ const cc=crewState(); if(!cc.roster.some(m=>m.id===rid)) cc.roster.push({ id:rid, lvl:R.lvl, xp:0 }); });
  if(ok){ crewState().seats[R.seat]=rid; saveProfile(); } sfx(ok?'levelup':'alarm'); return ok; }   // a fresh hire takes the seat straight away
// Z162 SPECIAL AMMO: buy a box (= `box` stages), pick one kind to load; it is spent at each stage start
export async function buyAmmo(kind){ const A=AMMO_SHOP.find(a=>a.id===kind); if(!A || !canAfford(A.price)){ sfx('alarm'); return false; }
  const ok=await econBuy('ammo', kind, null, A.price, ()=>{ PROFILE.ammo=PROFILE.ammo||{}; PROFILE.ammo[kind]=(PROFILE.ammo[kind]|0)+A.box; }); sfx(ok?'levelup':'alarm'); return ok; }
export function pickAmmo(kind){ PROFILE.ammoPick = PROFILE.ammoPick===kind ? null : kind; saveProfile(); sfx('click'); }
export function stageAmmo(p){ const prev=p._ammoFx;   // undo last stage's load, then load the picked kind if a box is left
  if(prev){ p.dmgMul/=1+(prev.dmg||0); p.bossMul=(p.bossMul||1)/(1+(prev.boss||0)); p.magMul=(p.magMul||1)/(1+(prev.mag||0)); p.reloadMul=(p.reloadMul||1)*(1+(prev.reload||0)); }
  p._ammoFx=null; p.ammoKind=null; p.ammoFront=0; p.ammoSplash=0; p.ammoBurn=0;
  const k=PROFILE.ammoPick, A=AMMO_SHOP.find(a=>a.id===k); if(!A || !PROFILE.ammo || (PROFILE.ammo[k]|0)<=0) return;
  PROFILE.ammo[k]--; if(econOn()){ const pd=econPend(); pd.ammo[k]=(pd.ammo[k]|0)+1; } saveProfile();
  const f=A.fx; p._ammoFx=f; p.ammoKind=k; p.dmgMul*=1+(f.dmg||0); p.bossMul=(p.bossMul||1)*(1+(f.boss||0)); p.magMul=(p.magMul||1)*(1+(f.mag||0)); p.reloadMul=(p.reloadMul||1)/(1+(f.reload||0));
  p.ammoFront=f.front||0; p.ammoSplash=f.splash||0; p.ammoBurn=f.burn||0; if(f.mag) for(const gi of p.guns) gi.ammo=magCap(GUNS[gi.id]);
  floatText(A.vi+' · CÒN '+PROFILE.ammo[k]+' TRẬN', '#ffd24a', p.pos, 18); }
export function seatCrew(seat, rid){ const c=crewState(), m=crewMember(rid, c); if(!m || m.seat!==seat) return false; c.seats[seat]=rid; saveProfile(); sfx('click'); return true; }
function addFx(T, fx, k){ if(!fx) return; k=k==null?1:k; for(const key in fx) T[key]=(T[key]||0)+fx[key]*k; }
export function crewEffects(){ const c=crewState(), T={};
  for(const s of CREW_SEATS){ const m=crewMember(c.seats[s.key], c); if(!m) continue;
    addFx(T, s.fx, m.lvl); if(m.lvl>=5) addFx(T, s.l5.fx); if(m.lvl>=10) addFx(T, s.l10.fx); if(m.trait) addFx(T, CREW_TRAITS[m.trait].fx); }
  return T; }
export function kitEffects(id){ const k=kitState(id), T={}; for(const t of KIT_TRACKS) addFx(T, t.fx, k[t.key]); if(k.sig && KIT_SIG[id]) addFx(T, KIT_SIG[id].fx); return T; }
// XP for the seated four after a stage (won=true) or a lost run; returns the level-ups
export function grantCrewXp(won){ const c=crewState(), F=crewEffects(), kills=S.kitKills|0;
  const xp=Math.round(((won ? CREW_XP.stage + CREW_XP.boss : 0) + kills*CREW_XP.kill) * (won ? 1 : CREW_XP.lossMul) * (1+(F.xp||0))); S.kitKills=0;
  const ups=[]; if(xp<=0) return ups;
  for(const s of CREW_SEATS){ const m=crewMember(c.seats[s.key], c); if(!m) continue; const st=m._m; st.lvl=m.lvl; st.xp=(st.xp|0)+xp;
    while(st.lvl<CREW_XP.max && st.xp>=crewNeed(st.lvl)){ st.xp-=crewNeed(st.lvl); st.lvl++; ups.push({ seat:s.vi, name:m.name, lvl:st.lvl }); }
    if(st.lvl>=CREW_XP.max) st.xp=0; }
  saveProfile();
  if(ups.length){ const u=ups[ups.length-1]; setTimeout(()=>radio('KÍP XE: '+u.seat.toLowerCase().replace(/^./,ch=>ch.toUpperCase())+' '+u.name+' lên cấp '+u.lvl+(ups.length>1?' (và '+(ups.length-1)+' người khác)':'')+'!'), 1800); }
  return ups; }

// ---------------- bake into a fresh run (after the model's own stats) ----------------
export function applyTankKit(p, id){ const W=kitEffects(id), C=crewEffects(), T={}; addFx(T, W); addFx(T, C);
  p.maxHp = Math.round(p.maxHp*(1+(T.hp||0)) + (T.hpFlat||0));
  p.speedMul *= 1+(T.spd||0); p.accelMul = (p.accelMul||1)*(1+(T.acc||0)); p.turnMul = (p.turnMul||1)*(1+(T.turn||0));
  p.dmgMul *= 1+(T.dmg||0); p.reloadMul = (p.reloadMul||1)/(1+(T.reload||0)); p.rangeMul *= 1+(T.range||0); p.magMul = (p.magMul||1)*(1+(T.mag||0));
  p.crit = (p.crit||0)+(T.crit||0); p.dashCdMul = (p.dashCdMul||1)*Math.max(0.4, 1+(T.dashCd||0)); p.fireMul = (p.fireMul||1)*(1+(T.fire||0));
  p.bossMul = (p.bossMul||1)*(1+(T.boss||0)); p.armor = Math.max(0, Math.min(0.7, (p.armor||0)+(T.armor||0)));
  p.ramDealMul = (p.ramDealMul||1)*(1+(T.ramDeal||0)); p.ramTakeMul = (p.ramTakeMul||1)*Math.max(0.3, 1+(T.ramTake||0));
  p._ammoFx=null; p.sig = { era:T.era|0, shtora:T.shtora||0, trophy:T.trophy||0, capsule:!!T.capsule }; p.hp=p.maxHp; return T; }
// every stage start: refill the reactive tiles, re-arm the crew capsule, count kills afresh
export function stageTankKit(p){ if(!p) return; stageAmmo(p); if(!p.sig) return; if(p.sig.era && (p.era||0)<p.sig.era) addEra(p.sig.era-(p.era||0)); p.capsuleReady=p.sig.capsule; p.apsCd=0; }
// T-14 crew capsule: called by damagePlayer when a blow would kill
export function capsuleSave(p, now){ if(!p.capsuleReady || p.hp>0) return false; p.capsuleReady=false; p.hp=1; p.invincibleUntil=now+2;
  floatText('KHOANG KÍP CỨU MẠNG', '#9fe8ff', p.pos, 20); sfx('clang'); return true; }
