// combat/trooper-spells.js — Z307 THE SOLDIER'S OWN SKILLS (soldier mode only; the tank keeps combat/spells.js SPELLS): a hand grenade lobbed to where
//   you aim (a small blast, not a shell's), a smoke grenade tossed a few metres ahead (the same screen that blinds laser designators, thrown by hand instead
//   of fired from turret dischargers), a field dressing (health back, no base repair) — and the radio: an airstrike, a fireteam brought up.
import { CAV, DRONEWAR, EQUIP, FEELFX } from '../../config.js';
import { MOBILE, S, airstrike, banterCue, callFireteam, dropBeam, enemies, fireMortar, floatText, fpvCast, fpvStock, jamBurst, reconLaunch, ringPulse, sfx, spawnPart, updateHUD } from '../hub.js';

const T = () => CAV.soldier;
export const TROOPER_SPELLS = [
  { id:'grenade',   name:'GRENADE',   vi:'LỰU ĐẠN',        svg:'bomb',      get cd(){ return T().grenade.cd; }, cast(now){ grenade(now); } },
  { id:'smokeHand', name:'SMOKE',     vi:'LỰU KHÓI',       svg:'smoke',     get cd(){ return T().smoke.cd; },   cast(now){ handSmoke(now); } },
  { id:'medkit',    name:'MEDKIT',    vi:'CỨU THƯƠNG',     svg:'heart',     get cd(){ return T().medkit.cd; },  cast(now){ medkit(now); } },
  { id:'airstrike', name:'AIRSTRIKE', vi:'GỌI KHÔNG KÍCH', svg:'crosshair', cd:18, cast(now){ airstrike(now); } },
  { id:'fireteam',  name:'FIRETEAM',  vi:'GỌI TỔ BỘ BINH', svg:'team',      cd:24, cast(now){ callFireteam(now); } },
  // DRONE 1 the drone war's skills (combat/drone-skills.js): own = a clock of their own (combat/spells.js spellReady), cast returns false when nothing was spent
  { id:'reconDrone', name:'RECON DRONE', vi:'DRONE TRINH SÁT', svg:'drone', own:true, get cd(){ return DRONEWAR.recon.cd; }, cast(now){ return reconLaunch(now); } },
  { id:'fpvDrone', name:'FPV STRIKE', get vi(){ return 'FPV CẢM TỬ ×' + fpvStock(); }, svg:'fpv', own:true, desk:!DRONEWAR.fpv.mobile, get cd(){ return DRONEWAR.fpv.lock; }, cast(now){ return fpvCast(now); } },   // DRONE 2 a stock a stage, not a cooldown
  { id:'jammer', name:'JAMMER', vi:'GÂY NHIỄU', svg:'jam', own:true, get cd(){ return DRONEWAR.jam.cd; }, cast(now){ return jamBurst(now); } },   // DRONE 3 every enemy drone near him loses its link (campaign/drone-raid.js)
].filter(s => (!s.own || DRONEWAR.on) && !(s.desk && MOBILE));   // (?nodrones: off the list · desk: not on phones)
// lobbed by hand to the aim point (the mortar's arc, a grenade's size and blast)
function grenade(now){ const said = banterCue('throw') && FEELFX.on; const G = T().grenade, k = S.player.nadeK || 1; fireMortar(now, { small:true, aoeR:G.r * Math.sqrt(k), bossDmg:G.dmg * k * 0.4 }, G.dmg * k); sfx('whoosh'); if(!said) floatText('NÉM LỰU ĐẠN!', '#ffcf5a', S.player.pos, 15); }   // FEEL 4 heard ("Lựu đạn!"): no text   // (Z350 LÍNH NÉM LỰU: nadeK)
// a smoke grenade a few metres ahead of him
function handSmoke(now){ const p = S.player, f = p.aimSmoothed ?? p.facing, d = T().smoke.toss, x = p.pos.x + Math.sin(f) * d, z = p.pos.z + Math.cos(f) * d;
  p.smokeUntil = now + EQUIP.smoke.dur; p.smokeX = x; p.smokeZ = z;
  spawnPart(p.pos.x, 1.4, p.pos.z, Math.sin(f) * d * 1.6, 3.2, Math.cos(f) * d * 1.6, { color:0x4a5230, size:0.18, life:0.6, grav:-14, drag:0.4 });   // the canister in the air
  for(const e of enemies) if(e.laser){ dropBeam(e.laser); e.laser = null; e.aimT = 0; }
  sfx('dash'); floatText('NÉM LỰU KHÓI', '#dfe6e0', p.pos, 15); }
function medkit(now){ const p = S.player, M = T().medkit, h = Math.round(M.hp * (p.medK || 1)); p.hp = Math.min(p.maxHp, p.hp + h); ringPulse(p.pos, 0x5fd06a, 1.6); floatText('BĂNG BÓ +' + h, '#7fe07a', p.pos, 15); sfx('levelup'); updateHUD(); }   // (Z350 CỨU THƯƠNG GIỎI: medK)
