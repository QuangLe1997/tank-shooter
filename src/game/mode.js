// game/mode.js — Z307 THE PLAYER'S RULES IN ONE OBJECT (no-tanks: the soldier on foot / horse / xe ôm / ba gác / bán tải is the only mode): who the
//   player is; how a run sets him up (his rifle and his own toughness); how he moves and fires; what a hit on him is (a man's outline); what being hit
//   and falling for good look like; his loot, his skills, his HUD; how close animals let him come.
import { CAV } from '../../config.js';
import { GUNS, TROOPER_SPELLS, cavIdle, magCap, makeCavPlayer, soldierFire, soldierHitFX, trooperGuns, updateCavalry, updateSoldierWar, soldierWaveQueue, clearSoldierWar, CV, cavRespawn, driverBack, rankReset, squadReset, duelReset, updateRank, updateSquadMates, updateGeneralDuel, soldierLoot } from '../hub.js';

const refill = p => { for(const gi of p.guns) gi.ammo = magCap(GUNS[gi.id]); };
const SOLDIER = { id:'soldier', crushes:false, riders:false, crewXp:false, powerHud:false, fortsOpen:true,   // (Z315 a man walks in through the open gate, he does not breach walls)
  get fleeK(){ return CAV.soldier.fleeK; }, get spells(){ return TROOPER_SPELLS; },
  loot(tier){ return soldierLoot(tier); }, overText:'người lính ngã xuống khi không còn lượt hồi sinh',   // Z352 his loot: a medal or an ammo crate now and then, else trooperLoot
  makePlayer(kind){ return makeCavPlayer(kind); },
  setupRun(p){ clearSoldierWar(); if(CV.dead || !CV.mounted) cavRespawn(p); driverBack(CV.H); p.guns = trooperGuns(); p.gunIdx = 0; p.dmgMul = CAV.atk; p.crit = CAV.crit; p.fireMul = CAV.fireK;   // a marksman's eye, quick hands, heavy rifle rounds
    p.maxHp = CAV.soldier.hp; p.hp = p.maxHp; p.accelMul = p.turnMul = p._size = 1; refill(p); p.radius = CAV.radius.mounted; p.mesh.scale.setScalar(1);
    rankReset(); squadReset(); duelReset(); },   // Z350 Binh nhì again · Z351 his two men · Z353 no duel left over   // (Z331 a new run: back in the saddle, the driver on his seat, whatever the last one ended in)
  update(dt, now){ updateCavalry(dt, now); updateSoldierWar(dt, now); updateRank(); updateSquadMates(); updateGeneralDuel(dt); }, idle(dt){ cavIdle(dt); },   // Z350 rank · Z351 squad · Z353 the general's duel
  waveQueue(stage, wave){ return soldierWaveQueue(stage, wave); },   // Z309 men first, an attack helicopter as a set piece
  fire(now, range){ soldierFire(now, range); },
  hitTest(p, x, z, r){ return Math.hypot(x - p.pos.x, z - p.pos.z) < p.radius + r; }, rifleK(){ return CAV.soldier.rifleK; },   // his outline by stance (game/cavalry.js sets the radius)
  onHit(p, dmg, dx, dz){ soldierHitFX(p, dx, dz, dmg); },
  finalDeath(){ return true; } };   // Z331 his last fall plays out (the driver gives himself up beside him) before the battle is lost
export const MODE = SOLDIER;   // (no-tanks: the soldier is the only mode)
