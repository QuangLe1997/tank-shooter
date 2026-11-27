// loot/loot-real.js — LOOT 1 THE LOOT IS REAL: every pick-up wears a downloaded 3D model at its real size (tools/loot-pack.mjs → assets/models/real/loot/,
//   credits in its SOURCES.txt): the medkit is a tactical first-aid pouch, an ammunition drop a steel ammo can, the repair kit a green toolbox, the shield a
//   plate carrier, the cluster bomb a crate of grenades, the freeze a field radio, the drone crate a quadcopter, the long barrel a pair of binoculars, a new
//   gun a wooden rifle box, a medal a struck silver medal (LOOT_REAL.ground / byCat). Drops of one model are drawn as ONE InstancedMesh (an Object3D slot
//   in each drop's group carries its place, tumble and all); the rank's air-dropped crate, its parachute and smoke can, and the relic's altar and crystal
//   are models too (loot/gift-crate.js, loot/relic.js). The icons of those items — the reward toast, the picture over a drop, the buff chips, the skill
//   button — are renders of the same models (128 px WebP, LOOT_REAL.iconDir). ?nolootreal: the drawn ones · ?nolootinst: one mesh a drop.
import * as THREE from 'three';
import { LOOT_REAL as LR } from '../../config.js';
import { MODEL_FILES, compileReady, iconEl, loadGLTF, scene, svgGlyphTex } from '../hub.js';

let _reg = false; const reg = () => { if(_reg) return; _reg = true; for(const k of LR.keys) MODEL_FILES['loot_' + k] = LR.dir + k + '.glb'; };   // (the files join actors/models.js's list on first use)
// the model a drop wears / the picture it shows (null: the drawn one)
export function lootKey(def){ if(!LR.on || !def) return null; const id = def.id || ''; return LR.ground[id] || (id.startsWith('pouch_') ? LR.ground.pouch : null) || LR.byCat[def.cat] || null; }
export function lootIconKey(def){ if(!LR.on || !def) return null; return LR.icon[def.id] || lootKey(def); }
// a model's file, loaded once (actors/models.js keeps it while a battle uses it); a battle asks for all of them at its start (loot/relic.js spawnRelic)
export const lootGLTF = k => LR.on ? (reg(), loadGLTF('loot_' + k)) : Promise.resolve(null);
export function lootPreload(){ if(LR.on) for(const k of LR.keys) lootGLTF(k); }
// a copy of a model (its own meshes, the file's geometry and material shared) → onto `parent` when loaded; resolves to it (null: none)
export function lootModelInto(parent, k, mat){ return lootGLTF(k).then(gl => { if(!gl) return null; const m = gl.scene.clone(true);
  m.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; o.userData.lootShared = true; if(mat) o.material = mat(o.material); } });   // (its geometry is the file's: never disposed by a user)
  return compileReady(m).then(() => { parent.add(m); return m; }); }); }   // SPLIT 4 its shaders linked before it is shown (the relic's crystal: ~200 ms in a fight's second frame)

// ---- the drops of one model as one InstancedMesh: a slot (an empty Object3D) in each drop's group; lootInstSync copies the slots' places each frame ----
const INST = {};
function instOf(k, gl){ let I = INST[k]; if(I) return I; let src = null; gl.scene.traverse(o => { if(o.isMesh && !src) src = o; }); if(!src) return null;
  src.updateWorldMatrix(true, false); const geo = src.geometry.clone().applyMatrix4(src.matrixWorld), im = new THREE.InstancedMesh(geo, src.material, LR.cap);
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.count = 0; im.name = 'loot_' + k; return (INST[k] = { im, slots:[] }); }
// a drop's model: a slot drawn by its model's InstancedMesh (or, ?nolootinst, a copy of the model in it)
export function lootSlot(parent, k){ const s = new THREE.Object3D(); s.name = 'lootSlot'; parent.add(s);
  lootGLTF(k).then(gl => { if(!gl || s.userData.gone) return; const I = LR.inst && instOf(k, gl); if(I){ I.slots.push(s); s.userData.inst = I; } else lootModelInto(s, k); }); return s; }
export function lootUnslot(root){ if(root) root.traverse(o => { if(o.name !== 'lootSlot') return; o.userData.gone = true; const I = o.userData.inst; if(I){ const i = I.slots.indexOf(o); if(i >= 0) I.slots.splice(i, 1); o.userData.inst = null; } }); }
export function lootInstSync(){ for(const k in INST){ const I = INST[k], n = Math.min(I.slots.length, LR.cap); if(!n && !I.im.count) continue;
    if(n && !I.im.parent) scene.add(I.im); for(let i = 0; i < n; i++){ const s = I.slots[i]; s.updateWorldMatrix(true, false); I.im.setMatrixAt(i, s.matrixWorld); }
    I.im.count = n; I.im.instanceMatrix.needsUpdate = true; } }
export const lootInstStats = () => Object.fromEntries(Object.entries(INST).map(([k, I]) => [k, I.slots.length]));

// ---- the icons: a render of the model (the drawn glyph when there is none, or while it fails) ----
const iconURL = k => LR.iconDir + k + '.webp';
export function lootIconEl(k, svg){ if(!LR.on || !k) return iconEl(svg || 'star'); const im = document.createElement('img'); im.className = 'licon'; im.alt = ''; im.draggable = false; im.decoding = 'async';
  im.onerror = () => { im.onerror = null; im.replaceWith(iconEl(svg || 'star')); }; im.src = iconURL(k); return im; }
export function setLootIcon(el, k, svg){ if(!el) return; if(el._lk === (k || '') + '|' + svg && el.firstChild) return; el._lk = (k || '') + '|' + svg; el.replaceChildren(lootIconEl(k, svg)); }
const _tex = {};
export function lootIconTex(k, svg){ if(!LR.on || !k) return svgGlyphTex(svg || 'star'); if(_tex[k]) return _tex[k];
  const t = _tex[k] = new THREE.TextureLoader().load(iconURL(k), undefined, undefined, () => { _tex[k] = svgGlyphTex(svg || 'star'); }); t.colorSpace = THREE.SRGBColorSpace; return t; }
