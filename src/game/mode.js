// game/mode.js — Z307 ONE MODE AT A TIME, EACH WITH ITS OWN RULES: the tank and the soldier (the horse / xe ôm / ba gác / bán tải units) are
//   two modes, each one object: who the player is; how a run sets him up (the tank: its garage loadout, shop upgrades, model stats, workshop kit, crew and
//   roof gun · the soldier: his rifle and his own toughness, none of the tank's progression); how he moves and fires; what a hit on him is (a hull's box
//   that shrugs off rifle rounds · a man's outline that doesn't); what being hit and falling for good look like; whether he flattens things; whether men
//   ride on him; his loot, his skills, his HUD; how close animals let him come. Every system that asked "is this the soldier?" asks MODE instead.
import { CAV, INFANTRY } from '../../config.js';
import { GUNS, PLAYER, TANK_SCALE, TROOPER_SPELLS, addPlayerBurn, applyTankKit, applyUpgrades, cavIdle, defaultGunIdx, fireGun, hitsHull, loadoutGuns, magCap, makeCavPlayer,
  makePlayer, mountRoofMG, playClip, playerHitFX, soldierFire, soldierHitFX, tankExplode, tankModel, trooperGuns, updateCavalry, updatePlayer, PLAYER_PAL, updateSoldierWar, soldierWaveQueue, tankShellZone, clearSoldierWar,
  CV, cavRespawn, driverBack, paintChip, rankReset, squadReset, duelReset, updateRank, updateSquadMates, updateGeneralDuel, soldierLoot } from '../hub.js';

const refill = p => { for(const gi of p.guns) gi.ammo = magCap(GUNS[gi.id]); };
const TANK = { id:'tank', crushes:true, riders:true, crewXp:true, powerHud:true, fortsOpen:false, arty:true, rings:true, fleeK:1, spells:null, loot:null, overText:'xe bị hạ khi không còn lượt hồi sinh',
  makePlayer(){ return makePlayer(); },
  setupRun(p){ p.guns = loadoutGuns(); p.gunIdx = defaultGunIdx();
    applyUpgrades(p); p.hp = p.maxHp; refill(p);   // shop upgrades (health / damage / range / speed / mag / reload / armour)
    const TS = tankModel(p.modelId).stats; p.maxHp = Math.round(p.maxHp * TS.hp); p.hp = p.maxHp; p.speedMul *= TS.spd; p.accelMul = TS.acc; p.turnMul = TS.turn; p._size = TS.size;   // the model's armour / engine / suspension
    applyTankKit(p, p.modelId); refill(p); mountRoofMG(p);   // workshop kit + signature module + crew skills, then the bigger mags filled
    p.radius = PLAYER.radius * TANK_SCALE * (p._size || 1); p.mesh.scale.setScalar(TANK_SCALE * (p._size || 1)); duelReset(); paintChip(); },   // (Z350 no rank stripe on a tank)
  update(dt, now){ updatePlayer(dt, now); }, idle(){},
  fire(now, range){ fireGun(now, range); },
  hitTest(p, x, z, r){ return hitsHull(p, x, z, r); }, rifleK(){ return INFANTRY.vsArmour; },
  onHit(p, dmg, dx, dz){ addPlayerBurn(dx, dz); playerHitFX(p, dx, dz, dmg); },
  finalDeath(p){ playClip('x_scream', 0.95); tankExplode(p.pos, 0xffd27a, 2.4, PLAYER_PAL, p.mesh.scale.x); } };
const SOLDIER = { id:'soldier', crushes:false, riders:false, crewXp:false, powerHud:false, fortsOpen:true,   // (Z315 a man walks in through the open gate, he does not breach walls)
  get fleeK(){ return CAV.soldier.fleeK; }, get spells(){ return TROOPER_SPELLS; },
  get arty(){ return CAV.soldier.war.arty; }, get rings(){ return CAV.soldier.war.rings; },   // Z403 a soldier's war: no enemy artillery, no red rings on the ground before a blast
  loot(tier){ return soldierLoot(tier); }, overText:'người lính ngã xuống khi không còn lượt hồi sinh',   // Z352 his loot: a medal or an ammo crate now and then, else trooperLoot
  makePlayer(kind){ return makeCavPlayer(kind); },
  setupRun(p){ clearSoldierWar(); if(CV.dead || !CV.mounted) cavRespawn(p); driverBack(CV.H); p.guns = trooperGuns(); p.gunIdx = 0; p.dmgMul = CAV.atk; p.crit = CAV.crit; p.fireMul = CAV.fireK;   // a marksman's eye, quick hands, heavy rifle rounds
    p.maxHp = CAV.soldier.hp; p.hp = p.maxHp; p.accelMul = p.turnMul = p._size = 1; refill(p); p.radius = CAV.radius.mounted; p.mesh.scale.setScalar(1);
    rankReset(); squadReset(); duelReset(); },   // Z350 Binh nhì again · Z351 his two men · Z353 no duel left over   // (Z331 a new run: back in the saddle, the driver on his seat, whatever the last one ended in)
  update(dt, now){ updateCavalry(dt, now); updateSoldierWar(dt, now); updateRank(); updateSquadMates(); updateGeneralDuel(dt); }, idle(dt){ cavIdle(dt); },   // Z350 rank · Z351 squad · Z353 the general's duel
  waveQueue(stage, wave){ return soldierWaveQueue(stage, wave); },   // Z309 men first, armour as a set piece
  tankShell(e, a, d, dmg, heavy){ tankShellZone(e, a, d, dmg, heavy); return true; },   // Z309 a tank's main gun: a warned burst on a spot, not a round at a hull
  fire(now, range){ soldierFire(now, range); },
  hitTest(p, x, z, r){ return Math.hypot(x - p.pos.x, z - p.pos.z) < p.radius + r; }, rifleK(){ return CAV.soldier.rifleK; },   // his outline by stance (game/cavalry.js sets the radius)
  onHit(p, dmg, dx, dz){ soldierHitFX(p, dx, dz, dmg); },
  finalDeath(){ return true; } };   // Z331 his last fall plays out (the driver gives himself up beside him) before the battle is lost
export const MODES = { tank:TANK, soldier:SOLDIER };
export let MODE = TANK;
export function __set_MODE(v){ MODE = v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
