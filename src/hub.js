// Z98 HUB — the single place that fixes MODULE EVALUATION ORDER (same order the code ran in when it was one file).
// Every system module imports what it needs from here (live bindings); data/* modules come first and are pure.
// RULE: add a new module = add ONE line here, at the position where its top-level code may run.
export * from './data/world.js';
export * from './data/text-vi.js';
export * from './data/player.js';
export * from './data/guns.js';
export * from './data/enemies.js';
export * from './data/bosses.js';
export * from './core/config.js';
export * from './ui/icons.js';
export * from './ui/gunart.js';   // Z150 one studio photo per gun, used on every screen
export * from './core/state.js';
export * from './world/field.js';
export * from './render/clouds.js';   // Z145 must load before any material patches its shader
export * from './render/renderer.js';
export * from './render/surface.js';   // Z145
export * from './fx/searchlight.js';   // Z146 (before world/biome.js: the floodlight masts are raised at boot)
export * from './render/lod.js';
export * from './world/atmosphere.js';
export * from './world/ground.js';
export * from './world/heightfield.js';
export * from './world/decals.js';
export * from './world/props.js';
export * from './world/perimeter.js';
export * from './world/decor.js';
export * from './world/physics.js';
export * from './world/biome.js';
export * from './world/cover.js';
export * from './world/ridges.js';
export * from './world/brick-walls.js';
export * from './tank/materials.js';
export * from './tank/models.js';   // Z155 tank collection (real MBTs + our designs)
export * from './tank/model.js';
export * from './tank/rig.js';
export * from './tank/barrels.js';
export * from './tank/shield.js';
export * from './fx/hud-fx.js';
export * from './fx/particles.js';
export * from './fx/gore.js';   // Z121
export * from './audio/synth.js';
export * from './audio/engine-music.js';
export * from './combat/projectiles.js';
export * from './fx/fire-wrecks.js';
export * from './combat/lock-on.js';
export * from './actors/core.js';
export * from './actors/enemies.js';
export * from './actors/fireteam.js';
export * from './actors/escalade.js';   // Z145
export * from './actors/ally-tanks.js';
export * from './render/night-marks.js';   // Z137
export * from './world/landmarks.js';      // Z139
export * from './world/regional.js';       // Z140
export * from './world/core-walls.js';     // Z140
export * from './world/env-events.js';     // Z140
export * from './fx/celebrate.js';         // Z140
export * from './world/flora.js';          // Z141
export * from './world/city.js';           // Z142
export * from './actors/wildlife.js';      // Z143
export * from './world/wonders.js';        // Z144
export * from './actors/crew.js';
export * from './ui/tips.js';
export * from './actors/infantry.js';
export * from './actors/enemy-missiles.js';
export * from './actors/vehicles.js';
export * from './actors/paradrop.js';
export * from './actors/command.js';
export * from './campaign/operations.js';
export * from './ai/tactics.js';
export * from './ai/cover.js';
export * from './actors/damage.js';
export * from './world/towers.js';
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
export * from './fx/explosions.js';
export * from './fx/gunfx.js';   // Z149 per-class muzzle fx, lightning / rail beams, ricochets
export * from './fx/debris.js';
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
export * from './combat/mastery.js';
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
export * from './ui/settings.js';
export * from './ui/loadout.js';
export * from './ui/garage.js';   // Z155 tank collection screen
export * from './ui/shop-info.js';
export * from './ui/shop.js';
export * from './ui/showroom.js';
export * from './core/helpers.js';
export * from './game/update.js';
export * from './game/intro.js';
export * from './ui/radar.js';
export * from './core/profile.js';
export * from './ui/alarm.js';
export * from './actors/drone.js';
export * from './loot/beacons.js';
export * from './actors/soldiers.js';
export * from './actors/riders.js';
export * from './game/loop.js';
export * from './game/viewport.js';
export * from './game/boot-gate.js';
export * from './game/startup.js';
export * from './dev/hooks.js';
