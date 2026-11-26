// world/biome.js — Z103 split from world/physics.js: apply a battlefield biome (ground maps, terrain, sky, perimeter,
// decor, arms-doctrine env) + the initial menu-backdrop dressing that runs at boot.
import { SPACE, CAMPAIGN } from '../../config.js';
import { modeSeed, BIOME, BIOMES, CAMPAIGN_BIOMES, FIELD_STATE, MACRO, NIGHT, PATCH_COL, S, __set_BIOME, applyAtmosphere, applyGroundPhoto, applyWeather, buildFloodlights, buildHighland, buildHorizon, buildPerimeter, buildTerrainDecor, computeEnv, decalReset, genField, genTerrain, groundMaps, groundMat, idle, paintTroops, perimeter, ring, rockSet, todFor } from '../hub.js';

export function applyBiome(stage){
  const R = S.run || { mode:'campaign' }, custom = R.mode==='custom';                // Z107 CUSTOM battle: your map · hour · weather · space
  const idx = custom ? Math.min(Math.max(0, R.biome|0), BIOMES.length-1) : Math.min(stage-1, CAMPAIGN_BIOMES-1);   // campaign rotation
  __set_BIOME(BIOMES[idx]);
  S.tod = BIOME.cave ? 'night' : custom && R.tod ? R.tod : todFor(stage + (S.loop||0));   // the hour shifts with the stage (and NG+ loop) — Z225 underground it is always dark
  FIELD_STATE.scale = custom ? (SPACE[R.space]||SPACE.wide).k : 1;
  { const pc=PATCH_COL[BIOME.name]||PATCH_COL.DESERT; MACRO.pcol.value.setHex(pc[0]); MACRO.pamt.value=pc[1]; }
  const gm=groundMaps(BIOME); groundMat.map=gm.map; groundMat.normalMap=gm.nrm; groundMat.roughness=gm.rough; groundMat.needsUpdate=true;
  applyGroundPhoto(BIOME);   // Z250 the photo-scanned floor swaps in once its two sets have loaded
  modeSeed(1); decalReset(BIOME); genField(); genTerrain(BIOME);   // Z106 a new field outline every stage · MODE 2 (modeSeed: the daily challenge builds each step from its own stream of the day's seed — campaign/mode-run.js; nothing outside it)
  applyAtmosphere(BIOME);   // sky dome reflections · sun angle/colour · haze · grade
  applyWeather(BIOME.cave ? 'clear' : custom ? R.wx : CAMPAIGN.weather[(Math.max(1, (S.loop||0)*CAMPAIGN.perLoop + stage)-1) % CAMPAIGN.weather.length]);   // Z107 rain · sand · snow · fog
  ring.material.color.setHex(BIOME.accent);
  modeSeed(2); buildPerimeter(BIOME);   // jersey barriers + concertina wire
  perimeter.visible=!BIOME.cave; for(const t of NIGHT.towers) t.visible=!BIOME.cave; if(BIOME.cave) for(const sp of NIGHT.spots) sp.visible=false;   // Z225 no fence and no floodlight masts inside a cave
  buildHorizon(BIOME);     // Z189 distant ranges, smoke columns, flashes on the horizon
  computeEnv();            // ARMS DOCTRINE battlefield conditions (night / heat / frost / urban / open)
  if(!custom){ const nb=BIOMES[Math.min(stage, CAMPAIGN_BIOMES-1)]; if(nb!==BIOME && typeof idle==='function') idle(()=>{ groundMaps(nb); rockSet(nb.name); }); }   // prepare the next stage's battlefield while you fight
  modeSeed(3); buildTerrainDecor(BIOME);
  paintTroops();   // Z179 both sides' uniforms re-dyed to stand out from this ground
}
performance.mark('boot:ground');
genTerrain(BIOME); buildTerrainDecor(BIOME); buildHighland(BIOME);   // initial dressing for the menu backdrop (Z106 + highland rocks)
performance.mark('boot:decor');
buildFloodlights(); S.tod='day'; applyAtmosphere(BIOME); decalReset(BIOME); buildHorizon(BIOME);
