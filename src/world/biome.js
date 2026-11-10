// world/biome.js — Z103 split from world/physics.js: apply a battlefield biome (ground maps, terrain, sky, perimeter,
// decor, arms-doctrine env) + the initial menu-backdrop dressing that runs at boot.
import { BIOME, BIOMES, CAMPAIGN_BIOMES, GRIME, MACRO, PATCH_COL, PROFILE, S, __set_BIOME, applyAtmosphere, buildFloodlights, buildPerimeter, buildTerrainDecor, computeEnv, decalReset, genTerrain, groundMaps, groundMat, idle, ring, rockSet, todFor } from '../hub.js';

export function applyBiome(stage){
  const pick = (typeof PROFILE!=='undefined' && Number.isInteger(PROFILE.terrain) && PROFILE.terrain>=0) ? PROFILE.terrain : -1;
  const idx = pick>=0 ? Math.min(pick, BIOMES.length-1) : Math.min(stage-1, CAMPAIGN_BIOMES-1);   // player's pick OR campaign rotation
  __set_BIOME(BIOMES[idx]);
  S.tod = todFor(stage + (S.loop||0));                                              // the hour shifts with the stage (and NG+ loop)
  { const pc=PATCH_COL[BIOME.name]||PATCH_COL.DESERT; MACRO.pcol.value.setHex(pc[0]); MACRO.pamt.value=pc[1]; }
  const gm=groundMaps(BIOME); groundMat.map=gm.map; groundMat.normalMap=gm.nrm; groundMat.roughness=gm.rough; groundMat.needsUpdate=true;
  decalReset(BIOME); genTerrain(BIOME);
  applyAtmosphere(BIOME);   // sky dome reflections · sun angle/colour · haze · grade
  if(typeof GRIME!=='undefined'){ GRIME.col.value.setHex(BIOME.ground); GRIME.amt.value = BIOME.deco==='ice'?0.42:(BIOME.deco==='slag'?0.38:0.58); }   // dust/mud/snow on the running gear matches the battlefield
  ring.material.color.setHex(BIOME.accent);
  buildPerimeter(BIOME);   // jersey barriers + concertina wire
  computeEnv();            // ARMS DOCTRINE battlefield conditions (night / heat / frost / urban / open)
  if(pick<0){ const nb=BIOMES[Math.min(stage, CAMPAIGN_BIOMES-1)]; if(nb!==BIOME && typeof idle==='function') idle(()=>{ groundMaps(nb); rockSet(nb.name); }); }   // prepare the next stage's battlefield while you fight
  buildTerrainDecor(BIOME);
}
performance.mark('boot:ground');
genTerrain(BIOME); buildTerrainDecor(BIOME);   // initial dressing for the menu backdrop
performance.mark('boot:decor');
buildFloodlights(); S.tod='day'; applyAtmosphere(BIOME); decalReset(BIOME);
