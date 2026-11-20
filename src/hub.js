// Z98 HUB — the single place that fixes MODULE EVALUATION ORDER (same order the code ran in when it was one file).
// Every system module imports what it needs from here (live bindings); data/* modules come first and are pure.
// RULE: add a new module = add ONE line here, at the position where its top-level code may run.
export * from './data/world.js';
export * from './data/text-vi.js';
export * from './data/player.js';
export * from './data/guns.js';
export * from './data/enemies.js';
export * from './data/bosses.js';
export * from './data/kit.js';   // Z161 workshop + crew data
export * from './core/config.js';
export * from './ui/icons.js';
export * from './ui/gunart.js';   // Z150 one studio photo per gun, used on every screen
export * from './core/state.js';
export * from './world/field.js';
export * from './render/clouds.js';   // Z145 must load before any material patches its shader
export * from './render/shafts.js';   // Z276 light shafts (before the renderer, which builds the pass)
export * from './render/renderer.js';
export * from './render/surface.js';   // Z145
export * from './fx/searchlight.js';   // Z146 (before world/biome.js: the floodlight masts are raised at boot)
export * from './render/lod.js';
export * from './render/perfhud.js';   // Z240 frame-time probe + F3 HUD
export * from './world/atmosphere.js';
export * from './world/sky-photo.js';   // Z255 photographed HDRI skies per hour of the day
export * from './world/ground.js';
export * from './world/ground-photo.js';
export * from './world/grass-carpet.js';   // Z251 instanced grass blades round the camera   // Z250 photo-scanned CC0 ground sets per battlefield
export * from './world/heightfield.js';
export * from './world/decals.js';
export * from './world/props.js';
export * from './world/real-props.js';   // Z252 Meshy cover pieces in place of the procedural ones
export * from './world/perimeter.js';
export * from './world/decor.js';
export * from './world/physics.js';
export * from './world/magma.js';   // Z258 the magma shader + the real volcano
export * from './world/stone.js';   // Z259 photo stone (pyramids, cliffs)
export * from './world/lava.js';   // Z187 volcanic caldera lava pools (runtime only)
export * from './world/horizon.js';   // Z189 the world beyond the fence
export * from './world/biome.js';
export * from './world/cover.js';
export * from './world/rubble.js';   // Z193 broken obstacles leave a heap of their own material
export * from './world/supply.js';
export * from './world/camp-life.js';
export * from './world/radar.js';   // Z197 the radar station: sweeping array, AA guns, artillery blinded when it falls   // Z196 the barracks' mess, stores, medical post, rest area and its people   // Z194 fuel stations, ammo depots, camps as guarded supply bases
export * from './world/ridges.js';
export * from './world/brick-walls.js';
export * from './tank/materials.js';
export * from './tank/models.js';
export * from './tank/designs.js';   // Z157 a dedicated vehicle build per model   // Z155 tank collection (real MBTs + our designs)
export * from './tank/model.js';
export * from './tank/real-tanks.js';   // Z256 Meshy vehicles per tank family
export * from './tank/real-guns.js';   // Z257 real models per player-gun family
export * from './tank/warkit.js';   // Z228 our tank's war kit (mine plough, sandbags, slat cage, APS, jammer)
export * from './tank/rig.js';
export * from './tank/barrels.js';
export * from './tank/shield.js';
export * from './tank/kit.js';   // Z161 per-tank workshop + crew
export * from './tank/roofmg.js';   // Z167 roof machine gun
export * from './fx/hud-fx.js';
export * from './fx/particles.js';
export * from './fx/gore.js';   // Z121
export * from './audio/synth.js';
export * from './audio/engine-music.js';
export * from './audio/voice.js';   // Z161 Vietnamese radio voices
export * from './audio/music.js';   // Z161 adaptive battle score
export * from './combat/projectiles.js';
export * from './combat/ballistics.js';   // Z228b velocity curves, sabot, vapour, swept hits
export * from './fx/fire-wrecks.js';
export * from './fx/flames.js';
export * from './fx/smoketrail.js';
export * from './world/skylife.js';   // Z235 birds and high aircraft   // Z235 living flames for every standing fire
export * from './combat/lock-on.js';
export * from './actors/core.js';
export * from './actors/enemies.js';
export * from './actors/fireteam.js';
export * from './actors/escalade.js';   // Z145
export * from './actors/ally-tanks.js';
export * from './render/night-marks.js';   // Z137
export * from './world/houses.js';         // Z207
export * from './world/landmarks.js';      // Z139
export * from './world/regional.js';       // Z140
export * from './world/core-walls.js';     // Z140
export * from './world/env-events.js';     // Z140
export * from './world/whirlwinds.js';   // Z229 dust devils + avalanches
export * from './fx/celebrate.js';         // Z140
export * from './world/flora.js';          // Z141
export * from './world/cars.js';           // Z206
export * from './world/city.js';           // Z142
export * from './actors/wildlife.js';      // Z143
export * from './world/wonders.js';        // Z144
export * from './actors/crew.js';
export * from './ui/tips.js';
export * from './actors/infantry.js';
export * from './actors/enemy-missiles.js';
export * from './actors/vehicles.js';
export * from './actors/helis.js';
export * from './fx/realwar.js';
export * from './campaign/surprises.js';
export * from './world/cavern.js';
export * from './world/tunnels.js';
export * from './world/underbase.js';
export * from './actors/paradrop.js';
export * from './actors/command.js';
export * from './campaign/operations.js';
export * from './ai/tactics.js';
export * from './ai/cover.js';
export * from './ai/spatial.js';
export * from './ai/squads.js';
export * from './ai/fieldcraft.js';   // Z220 line of fire · grenades · smoke (both sides)
export * from './actors/damage.js';
export * from './world/towers.js';
export * from './world/tower-kinds.js';
export * from './world/camps.js';
export * from './world/zones.js';
export * from './world/fortress.js';
export * from './world/rally.js';
export * from './world/pow.js';
export * from './world/depots.js';
export * from './world/bridges.js';
export * from './fx/dying.js';
export * from './campaign/waves.js';
export * from './campaign/boss.js';
export * from './campaign/boss-new.js';   // Z161 the three new generals' weapons
export * from './fx/cinematic.js';   // Z189 shock domes, fire light, our tank's hit / damage FX
export * from './fx/soldier-fx.js';   // Z306 soldier mode: a man is hit, not a hull
export * from './fx/hitfx.js';   // Z192 shell streaks, missile smoke ribbons, armour hits that rock the hull, hurt tanks that smoke
export * from './fx/explosions.js';
export * from './fx/wallmarks.js';   // Z204 rounds go off against walls / cover / forts and leave their marks
export * from './fx/gunfx.js';   // Z149 per-class muzzle fx, lightning / rail beams, ricochets
export * from './fx/debris.js';
export * from './fx/shatter.js';   // Z261 props break into pieces of themselves
export * from './world/tree-fall.js';   // Z262 trees topple for real
export * from './world/real-trees.js';   // Z262 Meshy tree species with wind
export * from './world/real-city.js';   // Z264 Meshy city buildings + vehicles
export * from './world/traffic.js';
export * from './actors/real-air.js';   // Z272 real aircraft
export * from './world/ruins3d.js';   // Z275 ruins of war
export * from './fx/dust.js';   // Z278 dust in the sunlight
export * from './game/xeom.js';   // Z282 xe ôm / xích lô mode
export * from './game/ride-wear.js';   // Z303 the ride's own health: smoke, a coughing engine, breaking down, the driver's repair
export * from './game/ride-impact.js';   // Z306 soldier mode: the ride rams scooters, cars and animals
export * from './game/ride-call.js';   // Z306 soldier mode: the call-the-ride button, the driver's ETA, coming round by the streets
export * from './game/mode.js';   // Z307 the tank and the soldier: one object per mode with its own rules (player, setup, update, fire, hits, death, loot, skills, HUD)
export * from './actors/hands.js';   // Z296 fingers that close round what they hold
export * from './actors/face-mask.js';   // Z305 a cloth mask fitted to a character's own face
export * from './actors/driver.js';   // Z296 the driver: his own rigged model riding the machine
export * from './world/outposts.js';   // Z285 enemy outposts   // Z268 scooters and cars on the move
export * from './fx/weather.js';
export * from './game/score.js';
export * from './game/player-damage.js';
export * from './input/input.js';
export * from './input/bindings.js';   // Z118
export * from './input/gamepad.js';   // Z117
export * from './input/padmap.js';   // Z123
export * from './combat/abilities.js';
export * from './combat/guns.js';
export * from './combat/aim.js';
export * from './combat/siege-rocket.js';
export * from './combat/flame.js';
export * from './combat/soldier-fire.js';   // Z306 soldier mode: his own rifle and its firing
export * from './combat/trooper-spells.js';   // Z307 soldier mode: grenade, hand smoke, field dressing, the radio
export * from './combat/ultimate.js';   // Z186 the five ultimate weapons
export * from './combat/mastery.js';
export * from './combat/gunstats.js';   // Z230 what a gun really does (arsenal · shop · power rating)
export * from './combat/power.js';
export * from './combat/spells.js';
export * from './campaign/artillery.js';
export * from './loot/powerups.js';
export * from './loot/relic.js';   // Z154 one relic per stage: wake it, pick a big power
export * from './loot/upgrades.js';
export * from './ui/briefing.js';
export * from './ui/deploy.js';
export * from './game/flow.js';
export * from './ui/menus.js';
export * from './ui/terrain-picker.js';
export * from './ui/battle-setup.js';
export * from './ui/padview.js';   // Z125
export * from './ui/keys.js';
export * from './ui/guide.js';
export * from './ui/training.js';   // Z182 first-run onboarding: call-up card · guided training in a trial tank · showcase
export * from './ui/settings.js';
export * from './ui/loadout.js';
export * from './ui/garage.js';   // Z155 tank collection screen
export * from './ui/kitshop.js';   // Z161 workshop + crew screen
export * from './ui/ranking.js';   // Z163 leaderboard screen
export * from './ui/shop-info.js';
export * from './ui/shop.js';
export * from './ui/showroom.js';
export * from './core/helpers.js';
export * from './game/update.js';
export * from './game/intro.js';
export * from './ui/radar.js';
export * from './ui/pylon-marks.js';   // Z243 screen markers for the general's shield pylons
export * from './ui/instruments.js';   // Z228 commander's instrument panel + radio teleprinter
export * from './ui/squad-hud.js';   // Z220 TỔ BỘ BINH panel
export * from './core/profile.js';
export * from './core/cloud.js';   // Z162 Firebase cloud save
export * from './core/econ.js';   // Z162 server economy client
export * from './ui/alarm.js';
export * from './actors/drone.js';
export * from './loot/beacons.js';
export * from './actors/soldiers.js';
export * from './actors/loft.js';   // Z246 sculpted lofted surfaces (horse, plate armour)
export * from './actors/horse.js';   // Z245 the war horse + gait engine
export * from './actors/models.js';   // Z247 real glTF models (Poly Haven CC0) on the procedural rigs
export * from './actors/general.js';
export * from './actors/puppet.js';   // Z294 the second soldier wears the operator's moves
export * from './actors/real-cav.js';
export * from './actors/real-troops.js';
export * from './actors/ragdoll.js';   // Z254 a real fall for men shot down   // Z249 the Meshy infantryman cut into the batched rig   // Z248 the Meshy war horse, operator and carbine over the procedural rigs   // Z245 the general in full plate
export * from './game/cavalry.js';   // Z245 cavalry mode
export * from './world/sidepaint.js';   // Z179 battlefield-aware paint for both sides (runtime only)
export * from './actors/riders.js';
export * from './game/loop.js';
export * from './game/viewport.js';
export * from './game/boot-gate.js';
export * from './game/startup.js';
export * from './dev/hooks.js';
