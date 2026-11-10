// world/zones.js — Z104 BATTLEFIELD PLAN: reserves ground for the rally point, POW stockades and depots before cover is scattered
import { DEPOT, POW, RALLY } from '../../config.js';
import { ARENA, DEPOTS, POWS, RALLY_PT, S, buildDepots, buildPOWs, buildRally, clearAllyTanks, clearDepots, clearPOWs, clearRally, depotJob, enemies, enemyPool, fieldEdgePoint, freeEnemyBar, inField, powJob, spawnEnemy } from '../hub.js';

export const ZONES=[];   // { kind:'rally'|'pow'|'arms'|'motor', x, z, r }
export function inZone(x, z, pad){ for(const q of ZONES) if(Math.hypot(q.x-x, q.z-z) < q.r+(pad||0)) return true; return false; }
export function zonesOf(kind){ return ZONES.filter(q=>q.kind===kind); }
function _free(x, z, r){ return Math.abs(x)<ARENA-r-3 && Math.abs(z)<ARENA-r-3 && inField(x, z, r+4) && Math.hypot(x,z)>24+r && Math.hypot(x, z-ARENA*0.55)>14+r && !inZone(x, z, r+8); }
function _pick(gen, r){ for(let t=0;t<50;t++){ const [x,z]=gen(); if(_free(x,z,r)) return [x,z]; } return null; }
// called first thing in buildBlocks() so every scatter loop can keep clear of these sites
export function planZones(){
  ZONES.length=0; const st=Math.min(4, S.stage-1), side=Math.random()<0.5?-1:1;
  ZONES.push({ kind:'rally', x:side*ARENA*RALLY.offX, z:ARENA*RALLY.offZ, r:RALLY.r+2 });                        // our side, beside the spawn
  for(let i=0;i<POW.perStage[st];i++){ const s=_pick(()=>{ const sd=Math.random()<0.5?-1:1;                       // POW stockades line OUR fence: the flanks + rear edge
      const u=Math.random(), a = u<0.65 ? (sd>0 ? 0.15+Math.random()*1.05 : Math.PI-0.15-Math.random()*1.05)   // our east / west flank (bearing atan2(z,x); +z = our side)
                                     : Math.PI/2+(Math.random()-0.5)*1.4;                                       // or the rear fence behind our spawn
    return fieldEdgePoint(a, POW.r+6); }, POW.r);   // Z106 hug OUR side of the irregular fence
    if(s) ZONES.push({ kind:'pow', x:s[0], z:s[1], r:POW.r }); }
  for(const kind of ['arms','motor']) for(let i=0;i<DEPOT[kind][st];i++){ const s=_pick(()=>[(Math.random()*2-1)*(ARENA-24), -ARENA*(0.18+Math.random()*0.55)], DEPOT.r);   // depots sit in the enemy half
    if(s) ZONES.push({ kind, x:s[0], z:s[1], r:DEPOT.r }); }
}
// called last in buildBlocks(): raise the installations on the reserved ground
export function buildZones(){ clearZoneGuards(); buildRally(); buildPOWs(); buildDepots();
  if(RALLY_PT.g) freezeStatic(RALLY_PT.g); for(const w of POWS) freezeStatic(w.g); for(const d of DEPOTS){ freezeStatic(d.g); for(const m of d.g.userData.extra) freezeStatic(m); } }
// Z105 PERF: static scenery computes its matrices once; anything flagged userData.live (bobbing badges, rings) keeps updating
export function freezeStatic(root){ root.traverse(o=>{ if(o.userData && o.userData.live) return; o.updateMatrix(); o.matrixAutoUpdate=false; }); root.updateMatrixWorld(true); }
export function clearZones(){ clearZoneGuards(); clearRally(); clearPOWs(); clearDepots(); clearAllyTanks(); }
// a soldier with nothing urgent asks for work: capture an open depot, free an open stockade
export function zoneJob(a){ return depotJob(a) || powJob(a); }
// guards posted round an installation (they hold their post; the wave system ignores them)
export function spawnGuards(zone, n, rpgN){ const out=[];
  for(let k=0;k<n;k++){ const a=Math.random()*6.283, r=zone.r*(0.55+Math.random()*0.4), x=zone.x+Math.cos(a)*r, z=zone.z+Math.sin(a)*r;
    const e=spawnEnemy(k<rpgN?'rpg':'rifle', x, z); if(!e) continue; e.guard=zone; e.post=[x,z]; e.loot=false; out.push(e); }
  zone.guards=out; return out; }
export function guardsLeft(zone){ let n=0; for(const e of (zone.guards||[])) if(enemies.includes(e)) n++; return n; }
// stage change / restart: take any leftover guards off the field without a death scene
export function clearZoneGuards(){ for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; if(!e.guard) continue; enemies.splice(i,1);
  if(e.bar){ freeEnemyBar(e.bar); e.bar=null; } e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); } }
