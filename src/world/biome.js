// world/biome.js — Z103 split from world/physics.js: apply a battlefield biome (ground maps, terrain, sky, perimeter,
// decor, arms-doctrine env) + the initial menu-backdrop dressing that runs at boot.
import { SPACE, CAMPAIGN } from '../../config.js';
import { BIOME, BIOMES, CAMPAIGN_BIOMES, FIELD_STATE, GRIME, MACRO, PATCH_COL, S, __set_BIOME, applyAtmosphere, applyWeather, buildFloodlights, buildHighland, buildPerimeter, buildTerrainDecor, computeEnv, decalReset, genField, genTerrain, groundMaps, groundMat, idle, ring, rockSet, todFor } from '../hub.js';

export function applyBiome(stage){
  const R = S.run || { mode:'campaign' }, custom = R.mode==='custom';                // Z107 CUSTOM battle: your map · hour · weather · space
  const idx = custom ? Math.min(Math.max(0, R.biome|0), BIOMES.length-1) : Math.min(stage-1, CAMPAIGN_BIOMES-1);   // campaign rotation
  __set_BIOME(BIOMES[idx]);
  S.tod = custom && R.tod ? R.tod : todFor(stage + (S.loop||0));                    // the hour shifts with the stage (and NG+ loop)
  FIELD_STATE.scale = custom ? (SPACE[R.space]||SPACE.wide).k : 1;
  { const pc=PATCH_COL[BIOME.name]||PATCH_COL.DESERT; MACRO.pcol.value.setHex(pc[0]); MACRO.pamt.value=pc[1]; }
  const gm=groundMaps(BIOME); groundMat.map=gm.map; groundMat.normalMap=gm.nrm; groundMat.roughness=gm.rough; groundMat.needsUpdate=true;
  decalReset(BIOME); genField(); genTerrain(BIOME);   // Z106 a new field outline every stage
  applyAtmosphere(BIOME);   // sky dome reflections · sun angle/colour · haze · grade
  applyWeather(custom ? R.wx : CAMPAIGN.weather[(Math.max(1, (S.loop||0)*CAMPAIGN.perLoop + stage)-1) % CAMPAIGN.weather.length]);   // Z107 rain · sand · snow · fog
  if(typeof GRIME!=='undefined'){ GRIME.col.value.setHex(BIOME.deco==='grass' ? 0x6e5a3c : BIOME.ground);   /* Z147 on grass the tracks throw up brown mud, not green */ GRIME.amt.value = BIOME.deco==='ice'?0.42:(BIOME.deco==='slag'?0.38:0.58); }   // dust/mud/snow on the running gear matches the battlefield
  ring.material.color.setHex(BIOME.accent);
  buildPerimeter(BIOME);   // jersey barriers + concertina wire
  computeEnv();            // ARMS DOCTRINE battlefield conditions (night / heat / frost / urban / open)
  if(!custom){ const nb=BIOMES[Math.min(stage, CAMPAIGN_BIOMES-1)]; if(nb!==BIOME && typeof idle==='function') idle(()=>{ groundMaps(nb); rockSet(nb.name); }); }   // prepare the next stage's battlefield while you fight
  buildTerrainDecor(BIOME);
}
performance.mark('boot:ground');
genTerrain(BIOME); buildTerrainDecor(BIOME); buildHighland(BIOME);   // initial dressing for the menu backdrop (Z106 + highland rocks)
performance.mark('boot:decor');
buildFloodlights(); S.tod='day'; applyAtmosphere(BIOME); decalReset(BIOME);
