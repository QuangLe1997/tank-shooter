// combat/gunstats.js — Z230 WHAT A GUN REALLY DOES: one mechanic-aware model per gun, shared by the arsenal, the shop and the power rating.
//   It follows the fight code, not the data sheet:
//   · ordinary rounds: pellets that actually land at the gun's fighting distance (spread cone vs a tank's width), accuracy, damage falloff
//     toward full reach, the blast's splash on the struck target and on its neighbours, pierce through a column, chain lightning
//   · lobbed shells (mortar / howitzer / grenade launcher): full damage to everything inside the burst, armour type ignored (grenades excepted), never aircraft
//   · the flame jet: a burn stoked to its top level on everything in the cone
//   · ultimates: orbital lance, plasma sun (brush burn + nova), Hydra swarm (ten seekers), black hole (drag-in crush + collapse), photon lance (a beam along a line)
//   · the siege rocket: wipes everything in its blast (bosses take a fixed hit)
//   Then the fight cycle: rate of fire, magazine, reload, spin-up → burst DPS and SUSTAINED DPS, per armour class (light / medium / heavy / air),
//   how many targets one trigger pull is worth in a loose battle line, reach in metres, muzzle velocity and time-of-flight (Z228b curves),
//   damage to fortress walls, and seconds to kill a reference tank.
import { BALANCE, BALLISTIC, DMG_TYPE, FORT, GUNSTAT, ROSTER } from '../../config.js';
import { ENEMY_DEFS, GUNS, PLAYER, gunDmgMul, gunFireMul, gunMagMul, gunReloadMul, gunRngMul } from '../hub.js';

const clamp=(v,a,b)=>Math.max(a, Math.min(b, v));
const CLS=['L','M','H','A'];
// multipliers from the kit (shop upgrades / run picks / mastery) — same shape as combat/power.js powerKit()
export function kitMul(id, K){ K=K||{}; const m=K.mastery!==false;
  return { d:(m?gunDmgMul(id):1)*(K.dmgMul||1), f:(m?gunFireMul(id):1)*(K.fireMul||1), r:(m?gunReloadMul(id):1)*(K.reloadMul||1), mag:(m?gunMagMul(id):1)*(K.magMul||1), rng:(m?gunRngMul(id):1) }; }

// how a gun delivers damage: per-target damage on ONE target, its area, whether armour type / aircraft apply
function mechanic(g){ const S=g.special, B=BALANCE.flame;
  if(S==='flame') return { kind:'flame', per:B.dps*B.lvlMax, cont:true, typed:true, air:true, R:0, cone:{ len:g.range||B.range, ang:B.cone } };
  if(S==='mortar') return { kind:g.small?'grenade':'shell', per:g.dmg, typed:!!g.small, air:false, R:g.aoeR, lob:true, boss:g.bossDmg };
  if(S==='orbital') return { kind:'orbital', per:g.dmg, typed:true, air:true, R:g.aoeR, delay:1.0 };
  if(S==='plasma') return { kind:'plasma', per:g.dmg*1.6 + g.dmg*0.3*1.3, typed:true, air:true, R:g.aoeR, v:g.bspeed };                  // nova ×1.6 (TBX) + ~1.3 brush ticks ×0.3
  if(S==='hydra') return { kind:'hydra', per:(g.frags||10)*g.dmg*(0.9+0.8), typed:true, air:true, R:g.aoe, split:g.frags||10, splash:0.8/1.7, v:g.bspeed };
  if(S==='singularity') return { kind:'hole', per:g.dmg*(0.22*1.5*(g.hold||2.6) + 2.2), typed:true, air:true, R:g.aoeR, lob:true, delay:g.hold||2.6 };   // drag-in crush (×0.22·dt·1–2) + collapse ×2.2
  if(S==='photon') return { kind:'beam', per:g.dmg, typed:false, air:true, R:0, line:true };
  if(S==='rocket') return { kind:'siege', per:Infinity, typed:false, air:true, R:g.aoeR, boss:g.bossDmg, wipe:true, lob:true, delay:2 };   // lobbed, 2 s fuse
  const splash=g.aoe && !S ? (g.splash??0.8) : 0;
  return { kind:g.lock?'missile':'round', per:g.dmg*(g.lock?0.9:1)*(1+splash), splash, typed:true, air:true, R:g.aoe||0, pierce:g.pierce||0, chain:g.chain||0, chainR:g.chainR||0, pellets:g.frags||1, lock:!!g.lock }; }

// the model: everything the UI and the power rating need
export function gunStats(id, K){ const g=GUNS[id]; if(!g) return null; const C=GUNSTAT, M=mechanic(g), km=kitMul(id, K);
  const reach=(g.special==='flame' ? (g.range||BALANCE.flame.range) : PLAYER.rangeBase*(g.rng||1))*km.rng, d=Math.min(reach*C.engage.frac, C.engage.max);
  // ---- one trigger pull on one tank at the fighting distance ----
  let shot=M.per, acc=1, fallK=1;
  if(M.kind==='round'){
    if(M.pellets>1){ const cone=2*d*Math.tan((g.spread||0)/2); acc=clamp(C.W.tank/Math.max(0.01,cone), C.minHit, 1); }       // pellets that land on a tank's width
    else if(g.spread>0){ const cone=2*d*Math.tan(g.spread); acc=clamp(C.W.tank/Math.max(0.01,cone), 0.55, 1); }               // a wandering single round
    shot=g.dmg*M.pellets*acc*(1+M.splash);
    if((g.fall??1)<1){ const f=clamp((d/reach-0.55)/0.45, 0, 1); fallK=1-f*(1-g.fall); shot*=fallK; } }
  if(M.kind==='missile') shot=g.dmg*(0.9+M.splash);
  if(isFinite(shot)) shot*=km.d;
  // ---- the fight cycle ----
  const fcd=g.fireCd*km.f, mag=Math.max(1, Math.round(g.mag*km.mag)), rel=g.reload*km.r, spin=g.spinUp||0;
  const cycle=mag*fcd + rel + spin*0.5, rof=1/fcd;
  const flame=M.kind==='flame', duty=flame ? (mag*fcd)/cycle : 1;
  const burst = flame ? shot : shot/fcd;                                    // the jet's burn is already per second
  const sus = flame ? shot*duty : shot*mag/cycle;
  // ---- how many targets one pull is worth in a loose battle line ----
  const rho=C.rho; let hits=1;
  if(M.kind==='round'){ if(M.R) hits+=rho*Math.PI*M.R*M.R*(M.splash/(1+M.splash)); if(M.pierce) hits+=Math.min(M.pierce, 2/C.pierceK)*C.pierceK; if(M.chain) hits+=Math.min(M.chain, rho*Math.PI*M.chainR*M.chainR)*0.6; }   // each arc does ×0.6
  else if(M.kind==='missile'){ hits+=rho*Math.PI*M.R*M.R*(M.splash/(1+M.splash)); }
  else if(M.kind==='hydra'){ hits+=rho*Math.PI*M.R*M.R*M.splash; }
  else if(flame){ hits+=rho*0.5*M.cone.ang*M.cone.len*M.cone.len; }
  else if(M.kind==='beam'){ hits+=rho*reach*C.lineW; }
  else if(M.R){ hits+=rho*Math.PI*M.R*M.R; }
  hits=Math.min(C.hitsCap, hits);
  // ---- per armour class ----
  const T=DMG_TYPE[g.type]||{}, vs={};
  for(const k of CLS){ let x = M.typed ? (T[k]||1) : 1; if(k==='A'){ if(!M.air) x=0; else if(id==='flak') x*=ROSTER.aaBonus; } vs[k]=x; }
  const sv={}; for(const k of CLS) sv[k]=isFinite(sus) ? sus*vs[k] : Infinity;
  // ---- reach, muzzle, flight ----
  const ballistic = !g.special && g.bspeed>0, v0 = ballistic ? (g.lock ? g.bspeed*1.45 : g.bspeed*BALLISTIC.gun.v0) : (M.v||0);
  const tof = ballistic || M.v ? d/(g.bspeed||M.v) : M.lob ? 0.9+(M.delay||0) : M.delay||0;
  // ---- walls ----
  const sk=Math.max(FORT.shotStructMin, T.struct||1), siegeShot=isFinite(shot) ? (M.kind==='round' ? g.dmg*M.pellets*acc*km.d*sk : shot*(M.lob?0.8:sk)) : (M.boss||0)*sk;
  // ---- time to kill the reference tank (heavy, at level 1) ----
  const ref=ENEMY_DEFS[C.ref.tank], hp=ref ? ref.hp : 140, perH=isFinite(shot) ? shot*vs.H : Infinity;
  const ttk = !isFinite(perH) ? 0 : perH<=0 ? Infinity : (()=>{ const n=Math.ceil(hp/perH); if(flame) return hp/(shot*vs.H); const full=Math.floor((n-1)/mag); return (n-1-full)*fcd + full*(rel+spin*0.5); })();
  return { id, delay:M.delay||0, kind:M.kind, shot, acc, fallK, rof, fcd, mag, rel, cycle, burst, sus, vs, sv, hits, crowd:sus*hits, R:M.R||0, reach, d, v0, tof, lob:!!M.lob, air:M.air,
    wipe:!!M.wipe, boss:M.boss||0, siegeShot, siegeDps:siegeShot*mag/cycle, ttk, hp }; }

// sustained damage per second against an armour mix (weights by HP share), crowd-weighted — what the power rating uses
export function gunMixDps(st, mix){ let e=0, w=0; for(const k in mix){ e+=mix[k]*(st.vs[k]??1); w+=mix[k]; } const eff=w?e/w:1;
  if(st.wipe){ const bossSus=st.boss*st.mag/st.cycle; return { dps:bossSus*st.hits, shot:st.boss }; }   // the siege rocket: credited as its boss hit, over its whole area
  return { dps:st.sus*eff*st.hits, shot:st.shot }; }

// the arsenal's yardsticks: the best of every number across the ordinary arsenal (ultimates and the siege rocket would flatten the bars)
let _gm=null; export function gunStatMax(){ if(_gm) return _gm; _gm={ shot:1, rof:1, sus:1, burst:1, reach:1, hits:1, v0:1 };
  for(const id of Object.keys(GUNS)){ const g=GUNS[id]; if(g.ulti || g.special==='rocket') continue; const s=gunStats(id, { mastery:false }); if(!s) continue;
    for(const k of Object.keys(_gm)) if(isFinite(s[k])) _gm[k]=Math.max(_gm[k], s[k]); }
  return _gm; }
