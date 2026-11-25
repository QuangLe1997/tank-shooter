// Z98 HUB — the single place that fixes MODULE EVALUATION ORDER (same order the code ran in when it was one file).
// Every system module imports what it needs from here (live bindings); data/* modules come first and are pure.
// RULE: add a new module = add ONE line here, at the position where its top-level code may run.
export * from './data/world.js';
export * from './data/scene-solids.js';   // Z433 arches, gates, ruins: their footprint at body height
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
export * from './render/aerial.js';   // Z427 the height and distance haze (a shader hook of render/clouds.js)
export * from './render/shafts.js';   // Z276 light shafts (before the renderer, which builds the pass)
export * from './render/renderer.js';
export * from './fx/battle-light.js';   // Z318 one palette, pulse clock and glowing-ring material for every gameplay light (before the rings built at load)
export * from './render/surface.js';   // Z145
export * from './fx/searchlight.js';   // Z146 (before world/biome.js: the floodlight masts are raised at boot)
export * from './render/lod.js';
export * from './render/far-lod.js';   // Z328 big static models swap to a simplified copy far away
export * from './render/inst-view.js';   // VIEW 1 a field-wide instanced mesh draws only what is near (its own detail near, a light copy far, nothing past sight)
export * from './render/near-detail.js';   // Z395 the originals' sharp maps on whatever the camera is close to
export * from './render/cover-batch.js';   // Z338 cover pieces drawn a few instanced draws at a time
export * from './render/perfhud.js';   // Z240 frame-time probe + F3 HUD
export * from './world/atmosphere.js';
export * from './world/sky-photo.js';   // Z255 photographed HDRI skies per hour of the day
export * from './world/ground.js';
export * from './world/ground-photo.js';
export * from './world/grass-carpet.js';   // Z251 instanced grass blades round the camera   // Z250 photo-scanned CC0 ground sets per battlefield
export * from './render/blend-in.js';   // Z325 forts, city, ruins, props and models graded into the field's own colour   // Z251 instanced grass blades round the camera   // Z250 photo-scanned CC0 ground sets per battlefield
export * from './world/heightfield.js';
export * from './world/river.js';   // Z405 the rivers: flowing water, the frozen river, bridge spots and fords
export * from './world/decals.js';
export * from './world/props.js';
export * from './world/real-props.js';   // Z252 Meshy cover pieces in place of the procedural ones
export * from './world/perimeter.js';
export * from './world/decor.js';
export * from './world/magma.js';   // Z258 the magma shader + the real volcano
export * from './world/stone.js';   // Z259 photo stone (pyramids, cliffs)
export * from './world/lava.js';   // Z187 volcanic caldera lava pools (runtime only)
export * from './world/horizon.js';   // Z189 the world beyond the fence
export * from './world/backdrop.js';   // Z427 the far ranges and the plain at the sky's depth
export * from './world/forest.js';   // Z440 the woods past the fence
export * from './world/biome.js';
export * from './world/cover.js';
export * from './world/rubble.js';   // Z193 broken obstacles leave a heap of their own material
export * from './world/supply.js';
export * from './world/camp-life.js';
export * from './world/radar.js';   // Z197 the radar station: sweeping array, AA guns, artillery blinded when it falls   // Z196 the barracks' mess, stores, medical post, rest area and its people   // Z194 fuel stations, ammo depots, camps as guarded supply bases
export * from './world/ridges.js';
export * from './world/brick-walls.js';
export * from './render/materials.js';
export * from './fx/hud-fx.js';
export * from './fx/particles.js';
export * from './fx/gore.js';   // Z121
export * from './audio/synth.js';
export * from './audio/engine-music.js';
export * from './audio/voice.js';   // Z161 Vietnamese radio voices
export * from './audio/music.js';   // Z161 adaptive battle score
export * from './audio/ambience.js';   // the nature ambience: wind, leaves, the sea, birdsong now and then
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
export * from './render/night-marks.js';   // Z137
export * from './world/landmarks.js';      // Z139
export * from './world/regional.js';       // Z140
export * from './world/core-walls.js';     // Z140
export * from './world/env-events.js';     // Z140
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
export * from './campaign/director.js';   // DIR 1 the battle's director: pressure round the player → build-up, peak, release; waves, surprises and the finale released by state
export * from './campaign/entries.js';   // AI 2 how an enemy soldier comes onto the field: over the edge out of the frame, up out of a hatch — never out of thin air
export * from './world/tunnels.js';
export * from './world/underbase.js';
export * from './actors/paradrop.js';
export * from './actors/command.js';
export * from './campaign/operations.js';
export * from './ai/tactics.js';
export * from './ai/cover.js';
export * from './ai/spatial.js';
export * from './ai/squads.js';
export * from './ai/tiers.js';   // DIR 2 tactics by tier: pin and flank, grenades that flush, the marksman, the machine gun, a squad that breaks, the last man's surrender
export * from './ai/awareness.js';   // AI 1 what each enemy soldier knows: unaware → suspicious → alerted; sight, hearing, shouts, the search
export * from './ai/fieldcraft.js';   // Z220 line of fire · grenades · smoke (both sides)
export * from './actors/damage.js';
export * from './world/towers.js';
export * from './world/tower-fall.js';   // Z452 towers topple for real, tear their footing out and lie where they fell
export * from './world/tower-kinds.js';
export * from './world/camps.js';
export * from './world/zones.js';
export * from './world/fortress.js';
export * from './world/fort-hill.js';   // Z453 castles on crags: the hills, the open citadel's ward, the paved yards
export * from './world/hill-trees.js';   // Z455 dead trees at the crags' lips, ancient oaks on the knolls
export * from './world/hill-climb.js';   // Z456 the one way up the capital's spur: hairpins cut into its tongue
export * from './world/iceberg.js';   // Z462 the arctic's iceberg citadels: the berg, its moat, its ice, the rope bridge over
export * from './world/rally.js';
export * from './world/pow.js';
export * from './world/depots.js';
export * from './world/bridges.js';
export * from './campaign/waves.js';
export * from './campaign/boss.js';
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
export * from './world/defense.js';   // Z420 the enemy's defence in depth: the obstacle belt, the lanes' checkpoints, the fighting positions
export * from './world/trails.js';   // Z432 the tracks worn between the places of a battlefield
export * from './world/real-turrets.js';   // Z424 real guard guns, AA guns, rockets and missiles
export * from './world/real-fit.js';   // Z426 the camps' barracks and tents, the rocket truck: a scan fitted to the drawn piece's box
export * from './world/scenery.js';   // Z374 every battlefield composed from the Meshy scans: skyline, landmark, groves, sidings, tank farms (distance levels, the near scan streamed in)
export * from './fx/dust.js';   // Z278 dust in the sunlight
export * from './game/xeom.js';   // Z282 xe ôm mode
export * from './game/ride-wear.js';   // Z303 the ride's own health: smoke, a coughing engine, breaking down, the driver's repair
export * from './game/ride-collide.js';   // Z311 what a ride runs into: trees, poles, parked cars, street furniture, wire
export * from './game/ride-avoid.js';   // RIDE 1 the mount picks its own line round what is in the way (horse and xe ôm)
export * from './game/ride-feel.js';   // RIDE 2 the hard stop: the horse on its haunches, the xe ôm's fork diving, the slide, the dust
export * from './world/solid-shape.js';   // Z337 the true footprint of walls and buildings, for bumping into them and for the camera's sight line
export * from './game/soldier-moves.js';   // Z336 the soldier on his feet: jump, sprint, combat roll, taking cover
export * from './game/soldier-climb.js';   // Z451 the soldier climbs rocks, walls, gates, containers: stands, walks and fires up there, drops off
export * from './combat/solid-line.js';   // Z380 the first solid thing on a round's path or an eye's line, by its true shape and height
export * from './game/stealth.js';   // Z377 a prone soldier unseen by far / high guns until close, lit or firing; the roll dodges rounds
export * from './game/ride-impact.js';   // Z306 soldier mode: the ride rams scooters, cars and animals
export * from './game/ride-call.js';   // Z306 soldier mode: the call-the-ride button, the driver's ETA, coming round by the streets
export * from './campaign/soldier-war.js';   // Z309 soldier mode: waves of men, armour as a set piece, a tank's shell as a warned burst
export * from './game/soldier-rank.js';   // Z350 soldier mode: experience, rank, the perk cards, what a rank brings
export * from './actors/squad-mates.js';   // Z351 soldier mode: his own squad — a machine-gunner, a medic, more with rank
export * from './loot/soldier-arms.js';   // Z352 soldier mode: the enemy's weapons on the ground, gun stars, medals, ammo crates, supply drops
export * from './loot/gift-crate.js';   // Z369 the rank's gift crate: down under a parachute, floating, opened
export * from './campaign/general-duel.js';   // Z353 soldier mode: the general jumps out of his burning machine and fights on foot
export * from './actors/hands.js';   // Z296 fingers that close round what they hold
export * from './actors/face-mask.js';   // Z305 a cloth mask fitted to a character's own face
export * from './actors/driver.js';   // Z296 the driver: his own rigged model riding the machine
export * from './actors/driver-acts.js';   // Z331 the driver off the ride: the crawl to a downed bike, the heave, giving himself up
export * from './actors/driver-rant.js';   // Z361 the bike dies under the driver: the kick-start, a boot to the tyre, a row with the soldier
export * from './actors/driver-break.js';   // Z363 the driver's break: a smoke on his heels or a pee, then he picks the soldier up
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
export * from './combat/air-aim.js';   // Z313 the gun laid on an aircraft in 3D: snap, lead, climb, tip up, a ring and a drop line
export * from './combat/crosshair.js';   // Z376 the crosshair is where the round goes: the point under it in the world, for the mouse and the pad alike
export * from './combat/trooper-spells.js';   // Z307 soldier mode: grenade, hand smoke, field dressing, the radio
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
export * from './ui/load-veil.js';   // NO-TANKS 8 the deployment order between XUẤT KÍCH and the battle
export * from './ui/setup-units.js';   // Z354 CHUẨN BỊ TRẬN steps ① ②: tank or soldier, the hull and guns · the trooper, his ride and its driver; the briefing's ĐỘI HÌNH
export * from './ui/padview.js';   // Z125
export * from './ui/keys.js';
export * from './ui/guide.js';
export * from './ui/settings.js';
export * from './ui/confirm.js';   // XK-UI the one confirmation dialog (leave the battle, restart, wipe progress)
export * from './ui/hud-prefs.js';   // Z324 what the battle HUD shows: on-screen dialogue, info cards, banners (CÀI ĐẶT)
export * from './ui/loadout.js';
export * from './ui/ranking.js';   // Z163 leaderboard screen
export * from './core/helpers.js';
export * from './game/update.js';
export * from './game/intro-clouds.js';   // Z322 the intro's haze and the cloud deck the swoop flies through
export * from './game/intro.js';
export * from './ui/radar.js';
export * from './ui/instruments.js';   // Z228 commander's instrument panel + radio teleprinter
export * from './ui/squad-hud.js';   // Z220 TỔ BỘ BINH panel
export * from './core/profile.js';
export * from './core/cloud.js';   // Z162 Firebase cloud save
export * from './core/score-report.js';   // Z163 the leaderboard's run report (no-tanks: was the server economy client)
export * from './ui/alarm.js';
export * from './actors/drone.js';
export * from './loot/beacons.js';
export * from './actors/soldiers.js';
export * from './actors/loft.js';   // Z246 sculpted lofted surfaces (horse, plate armour)
export * from './actors/horse.js';   // Z245 the war horse + gait engine
export * from './actors/models.js';   // Z247 real glTF models (Poly Haven CC0) on the procedural rigs
export * from './actors/general.js';
export * from './actors/puppet.js';   // Z294 the second soldier wears the operator's moves
export * from './actors/soldier-legs.js';   // Z339 the soldier's own legs: planted feet, steps the way he goes
export * from './actors/soldier-mount.js';   // Z342 getting on and off the horse / the rides the way a rider does
export * from './actors/soldier-climb-pose.js';   // Z451 his body on the face: limbs on holds, the pull-over, the rifle slung
export * from './actors/soldier-upper.js';   // Z343 the soldier's shoulders, trunk, head and rifle in time with his legs
export * from './actors/soldier-stirrups.js';   // Z371 the war horse's stirrups and the rider's feet in them
export * from './actors/real-cav.js';
export * from './actors/gun-hands.js';   // GUN 1 the hands held to a man's joints: trigger finger, wrists, the support arm's reach, the eye
export * from './actors/gun-fit.js';   // Z360 each hand weapon's hold read off its own model (grip, palm, butt, sight, bore)
export * from './actors/real-troops.js';
export * from './actors/troop-skin.js';   // Z344 the infantry skinned on the GPU: one body a side, each man's joints in a float texture
export * from './actors/ragdoll.js';   // Z254 a real fall for men shot down   // Z249 the Meshy infantryman cut into the batched rig   // Z248 the Meshy war horse, operator and carbine over the procedural rigs   // Z245 the general in full plate
export * from './game/cavalry.js';   // Z245 cavalry mode
export * from './world/sidepaint.js';   // Z179 battlefield-aware paint for both sides (runtime only)
export * from './game/loop.js';
export * from './game/viewport.js';
export * from './game/boot-gate.js';
export * from './game/startup.js';
export * from './dev/hooks.js';
export * from './dev/pose-studio.js';   // Z349 the pose studio: how a soldier holds each weapon, measured and photographed (window.poseStudio)
