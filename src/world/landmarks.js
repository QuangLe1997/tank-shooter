// world/landmarks.js — Z139 BATTLEFIELD LANDMARKS (Z327: the old box-city and hill-woods builders are gone — the real city and flora.js build
//   those now; Z401 the VILLAGE homes and rice paddies too, the biome having left the game at Z253): the city district, the land's composed set, the ruins.
//   Then the scenery round them: flora, wildlife, the land's wonder.
import { REALCITY } from '../../config.js';
import { BIOME, NIGHT, POOL_K, WIN_K, buildCityDistrict, buildFlora, buildRuins, buildSceneSet, buildWildlife, buildWonder, climbGate, crushables, hillTrees, resetCity } from '../hub.js';

export const LAND = { meshes:[], mats:[] };
export function clearLandmarks(){ resetCity(); for(const m of LAND.meshes){ m.parent && m.parent.remove(m); if(m.geometry && !m.isInstancedMesh) m.geometry.dispose(); if(m.isInstancedMesh) m.dispose(); } LAND.meshes.length=0; for(let i=crushables.length-1;i>=0;i--) if(crushables[i].land) crushables.splice(i,1); }   // (instanced geometry is cached & shared)

export function buildLandmarks(){
  clearLandmarks(); LAND.mats.length=0; const n=BIOME.name;
  if(n==='CITY') buildCityDistrict(); buildSceneSet(); climbGate(); hillTrees(); buildRuins(); }   // Z374 the land's composed set first (it claims its ground), then the ruins round it   // Z275 the war's ruins on the open battlefields   // Z142 the city is a real district now (city.js)
// Z141 vegetation goes in last, round whatever was built
export function buildScenery(){ buildFlora(); buildWildlife(); buildWonder(); }   // Z144 + the land's famous landmark   // Z143 + herds of wild animals
// lit windows glow at night
export function updateLandmarkGlow(){ WIN_K.value=NIGHT.k*1.5; POOL_K.value=NIGHT.k*(REALCITY.pools?REALCITY.pools.k:0); if(!LAND.mats.length) return; const k=NIGHT.k*1.5; for(const m of LAND.mats) if(Math.abs(m.emissiveIntensity-k)>0.01) m.emissiveIntensity=k; }   // Z287 the lamp pools come up with the windows
