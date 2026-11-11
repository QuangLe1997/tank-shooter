// campaign/waves.js — WAVES: difficulty / NG+ loop multipliers, wave queue per stage, random wave events, edge spawn points
import * as THREE from 'three';
import { BALANCE, INFANTRY, ROSTER } from '../../config.js';
import { FORTS, MOBILE, OBJ, PROFILE, S, addScore, applyScriptedWave, boss, cMod, enemies, fieldEdgePoint, fortLaunch, fortSpawnPoint, objMod, opFor, radio, riders, ringPulse, scriptedEvent, sfx, showBanner, spawnEnemy, spawnSquad, startBoss, tip, updateHUD } from '../hub.js';

// ----------------------------- WAVES -----------------------------
export const WAVE = { spawnQueue:[], spawnAt:0, betweenUntil:0, active:false, perStage:BALANCE.wave.perStageCount, event:null, eventBanner:null, eventColor:'#9bb0c0', treasure:false, eliteForce:0, assault:false };
// 0 at stage 1 → 1 at stage 5+. Scales enemy aggression so newcomers ease in.
export function diffScale(){ return Math.min(1, (S.stage-1)/4); }
// NG+ escalation — each loop ramps the threat AND the payout, so a grinded arsenal finally has a place to flex.
export function loopHpMul(){ return 1 + (S.loop||0)*BALANCE.loop.hp; }      // enemy / structure HP
export function loopDmgMul(){ return 1 + (S.loop||0)*BALANCE.loop.dmg; }    // enemy damage
export function loopBossMul(){ return 1 + (S.loop||0)*BALANCE.loop.boss; }  // boss HP
export function loopRewardMul(){ return 1 + (S.loop||0)*BALANCE.loop.reward; }   // UI labels (numbers live in config.js BALANCE.difficulty)
export function diffCfg(){ return BALANCE.difficulty[PROFILE.difficulty] || BALANCE.difficulty.soldier; }
export function diffHpMul(){ return diffCfg().hp; }
export function diffDmgMul(){ return diffCfg().dmg; }
export function diffRewardMul(){ return diffCfg().reward; }
// Z107 the wave's composition as data (also read by combat/power.js so the power rating sees exactly what the waves send)
export function waveSize(stage, wave){ return Math.floor(BALANCE.wave.base + wave*BALANCE.wave.perWave + (stage-1)*BALANCE.wave.perStage); }   // eased: s1w1=4 → s5w5=~15
export function waveSquads(stage, wave){ const SQ=INFANTRY.squad; return wave>=SQ.fromWave ? Math.floor(SQ.base + wave*SQ.perWave + (stage-1)*SQ.perStage) : 0; }
export function wavePool(stage, wave){   // weighted pool; tougher/new types unlock at later stages
  const pool=[['grunt', 5], ['scout', 2+wave*0.4], ['gunner', 1+wave*0.4+(stage-1)]];
  if(stage>=2){ pool.push(['bomber', 1+(stage-1)*0.5]); pool.push(['mortar', 1+(stage-1)*0.6]); }
  if(stage>=3){ pool.push(['shield', 1+(stage-2)*0.7]); pool.push(['heavy', 0.8+(stage-2)*0.5]); pool.push(['carrier', 0.7+(stage-2)*0.4]); }
  if(stage>=4){ pool.push(['sniper', 1+(stage-3)*0.7]); }
  for(const [ty,u] of Object.entries(ROSTER.unlock)) if(stage>=u){ const w=ROSTER.weight[ty]; pool.push([ty, w[0]+(stage-u)*w[1]]); }   // Z80 new vehicles
  return pool; }
export function buildWaveQueue(stage, wave){
  const n = waveSize(stage, wave), pool = wavePool(stage, wave);
  const tot=pool.reduce((s,pp)=>s+pp[1],0);
  const q=[];
  for(let i=0;i<n;i++){ let r=Math.random()*tot, t='grunt'; for(const [ty,w] of pool){ if((r-=w)<=0){ t=ty; break; } } q.push(t); }
  { const ns=waveSquads(stage, wave); for(let k=0;k<ns;k++) q.splice(1+((Math.random()*q.length)|0), 0, 'squad'); }   // Z79 infantry squads mixed into the column
  return q;
}
export function rollWaveEvent(){
  WAVE.event=null; WAVE.eventBanner=null; WAVE.eventColor='#9bb0c0'; WAVE.treasure=false; WAVE.eliteForce=0; WAVE.assault=false; WAVE.fixedEdge=null; WAVE.columnLeft=0;
  if(scriptedEvent()) return;                                   // Z83 operation script has this wave
  if(S.stage===1 && S.wave<=1 && (S.loop||0)===0) return;       // ease the very first wave of a fresh run
  if(Math.random()>=BALANCE.wave.eventChance) return;           // ~1 in 3 waves rolls an event
  const pool=['elite','horde','treasure','assault']; if(S.stage>=2) pool.push('blitz'); if(S.stage>=3) pool.push('airraid');
  const ev=pool[(Math.random()*pool.length)|0]; WAVE.event=ev;
  if(ev==='elite'){ WAVE.eliteForce=Math.min(4, 1+(S.stage>=4?1:0)+(S.loop||0)); WAVE.eventBanner='⚠ ĐỢT TINH NHUỆ'; WAVE.eventColor='#ffd24a'; }
  else if(ev==='horde'){ WAVE.eventBanner='ĐÀN ĐÔNG ĐANG TỚI'; WAVE.eventColor='#ff8a4a'; }
  else if(ev==='treasure'){ WAVE.treasure=true; WAVE.eventBanner='ĐỢT KHO BÁU — hạ ai cũng rơi đồ'; WAVE.eventColor='#7fe7ff'; }
  else if(ev==='assault'){ WAVE.assault=true; WAVE.eventBanner='TẤN CÔNG DỒN DẬP'; WAVE.eventColor='#ff5a4a'; }
  else if(ev==='blitz'){ WAVE.eventBanner='CẢM TỬ Ồ ẠT'; WAVE.eventColor='#ffae5c'; }
  else if(ev==='airraid'){ WAVE.eventBanner='⚠ KHÔNG KÍCH — TRỰC THĂNG ĐANG TỚI'; WAVE.eventColor='#ff7ae0'; }
  sfx('alarm');
}
export function startWave(now){
  if(S.wave===1){ tip('drive2'); if(riders.length) tip('crew2'); if(OBJ&&OBJ.alive) tip('objective'); }
  rollWaveEvent();
  if(cMod('eliteEveryWave',false)) WAVE.eliteForce=Math.max(WAVE.eliteForce, 1);   // ELITE HUNT contract: guarantee ≥1 elite/wave
  WAVE.spawnQueue = buildWaveQueue(S.stage, Math.min(S.wave, WAVE.perStage));
  if(WAVE.event==='horde'){ const ex=WAVE.spawnQueue.slice(0, Math.ceil(WAVE.spawnQueue.length*BALANCE.wave.hordeMul)); WAVE.spawnQueue.push(...ex); }   // +50% bodies
  else if(WAVE.event==='blitz'){ WAVE.spawnQueue = WAVE.spawnQueue.map(()=>'bomber'); }
  else if(['ambush','column','pyro','airraid'].includes(WAVE.event)) applyScriptedWave(now);   // Z83 scripted beats (airraid also from the random roll)
  if(objMod('gunshipPerWave',0)>0 && S.stage>=2) WAVE.spawnQueue.splice(Math.min(2,WAVE.spawnQueue.length),0,'gunship');   // Z83 radar site vectors a gunship onto every wave
  setTimeout(()=>{ if(S.mode==='playing') radio(opFor(S.stage).radio[S.wave]); }, 900);                                                // all kamikaze
  WAVE.spawnAt = now + 0.4; WAVE.active = true;
  showBanner(WAVE.eventBanner || ('ĐỢT '+S.wave), WAVE.eventColor);
  updateHUD();
}
// Z106 enemies enter through the irregular fence: edge 0 = their side (−z) · 1 = ours (+z) · 2 = west · 3 = east. Of a few candidate
// points on that stretch, prefer one 40–85 m from the tank so a bigger field does not mean long empty drives.
export function edgeSpawnPoint(){
  const fp=WAVE.fixedEdge==null ? fortSpawnPoint() : null; if(fp) return fp;   // Z107 most reinforcements march out of a fortress gate
  const e=(WAVE.fixedEdge!=null)?WAVE.fixedEdge:Math.floor(Math.random()*4), c=[-Math.PI/2, Math.PI/2, Math.PI, 0][e], p=S.player;
  let best=null, bs=1e9; for(let k=0;k<6;k++){ const [x,z]=fieldEdgePoint(c+(Math.random()-0.5)*1.3, 4), d=p?Math.hypot(x-p.pos.x, z-p.pos.z):60, s=d<40?40-d:(d>85?d-85:0);
    if(s<bs){ bs=s; best={ x, z }; } }
  return best;
}
export function updateWaves(dt, now){
  if(S.awaitingUpgrade) return;                        // boss just died, waiting on upgrade pick
  if(!WAVE.active){
    if(boss) return;                                   // boss fight in progress → no waves
    if(now>WAVE.betweenUntil){
      if(S.wave >= WAVE.perStage && !FORTS.length) startBoss(now);       // final wave done → summon the stage boss (Z107: with fortresses the boss waits inside the citadel)
      else { S.wave++; startWave(now); }
    }
    return;
  }
  // spawn from queue (stagger). Concurrent cap + cadence scale with stage so the
  // early game never floods a new player.
  const cap = Math.floor(BALANCE.wave.capBase + S.stage*BALANCE.wave.capPerStage) + (WAVE.assault?BALANCE.wave.assaultCapBonus:0);   // eased: s1=6 … s5=12; ASSAULT crowds the field
  let _nT=0, _nI=0; for(const e of enemies){ if(e.guard || e.fortOf || e.abandoned) continue; if(e.def.inf) _nI++; else _nT++; }   // foot soldiers don't eat the vehicle cap · Z107 nor do fortress garrisons / bodyguards / post guards (they stalled the waves)
  const _nx=WAVE.spawnQueue[0];
  if(WAVE.spawnQueue.length && now>WAVE.spawnAt && (_nx==='squad' ? _nI < (MOBILE?INFANTRY.squad.maxMobile:INFANTRY.squad.maxOnField) : _nT<cap)){
    const t=WAVE.spawnQueue.shift(); const sp=edgeSpawnPoint(), n0=enemies.length;
    if(t==='squad'){ spawnSquad(sp); if(sp.fort) fortLaunch(sp.fort, n0, now); WAVE.spawnAt=now+0.6; return; }
    spawnEnemy(t, sp.x, sp.z); if(sp.fort) fortLaunch(sp.fort, n0, now); else ringPulse(new THREE.Vector3(sp.x,0,sp.z), 0xe0603a, 2);   // Z111b from a fortress: raised inside, out through the gate
    WAVE.spawnAt = now + (BALANCE.wave.cadence - BALANCE.wave.cadenceDiff*diffScale())*(WAVE.assault?BALANCE.wave.assaultCadenceMul:1)*objMod('cadenceMul')*(WAVE.columnLeft>0?0.4:1);   // Z83 radio relay speeds reinforcements; a column rolls in nose-to-tail
    if(WAVE.columnLeft>0 && --WAVE.columnLeft<=0) WAVE.fixedEdge=null;   // ASSAULT = relentless spawn cadence
  }
  // wave clear?
  if(WAVE.spawnQueue.length===0 && !enemies.some(e=>!e.guard && !e.fortOf && !e.abandoned)){   // Z104 depot / stockade guards stay at their post — they don't hold the wave open · Z107 nor do fortress troops (garrison, sallies, bodyguards)
    WAVE.active=false; WAVE.betweenUntil = now + 2.2;
    addScore(200, new THREE.Vector3(0,2,0));
    showBanner('SẠCH ĐỢT! +200', '#8cbf3f'); sfx('wave');
  }
}
