// fx/battle-light.js — Z318 BATTLEFIELD LIGHT: one palette, one pulse clock and one glowing-ring material for every gameplay light
//   (danger zones, target locks, warnings, loot, objectives, range rings, shockwaves). A ring is HDR light laid on the ground: a crisp hot
//   core line, a soft falloff halo the bloom picks up, a faint dark backing so it still reads on sunlit sand, and optional hologram accents
//   (tick marks, a radar sweep, a progress arc, scan lines). Red / amber = danger, cyan = our own systems, green = allies and objectives,
//   gold = loot. Pulses are smooth (a raised cosine that never goes fully dark) on a few shared rates, so nothing strobes.
import * as THREE from 'three';
import { BLIGHT } from '../../config.js';

export const BL_T = { value:0 };                                                   // the shared clock every ring reads
export function blTick(dt){ BL_T.value = (BL_T.value + dt) % 3600; }
export function blCol(c){ return typeof c === 'string' ? BLIGHT.col[c] : c; }      // a palette name or a raw hex
export function blHot(c, k){ return new THREE.Color(blCol(c)).multiplyScalar(k ?? BLIGHT.gain); }   // an HDR colour (above 1: it blooms)
export function blCss(c){ return '#' + blCol(c).toString(16).padStart(6, '0'); }
const rate = r => typeof r === 'string' ? BLIGHT.hz[r] : r;
// one beat of the pulse: phase 0..1 → floor..1, eased at both ends
export function blWave(ph, floor){ const f = floor ?? BLIGHT.floor, c = 0.5 - 0.5 * Math.cos(ph * 6.2831853); return f + (1 - f) * c * c * (3 - 2 * c); }
export function blPulse(t, r, floor){ return blWave(t * rate(r), floor); }
// a pulse that quickens from rate a to rate b as k goes 0 → 1, its phase kept on the object (no jump as the rate climbs)
export function blRamp(o, dt, k, a, b, floor){ const ra = rate(a), hz = ra + (rate(b) - ra) * Math.max(0, Math.min(1, k)); o._blp = ((o._blp || 0) + dt * hz) % 1; return blWave(o._blp, floor); }
// loot's own signature: two quick flashes, then a rest
export function blDouble(t){ const c = t % BLIGHT.loot, f = 0.12; return c < f ? c / f : c < 2 * f ? 2 - c / f : c < 3 * f ? c / f - 2 : c < 4 * f ? 4 - c / f : 0; }

// ---- the ring: a MeshBasicMaterial (colour / opacity / fog stay the usual knobs) whose fragment paints the light from the radius ----
const FS_PARS = 'varying vec2 vHolo;\nuniform vec4 uHoloA, uHoloB, uHoloC;\nuniform float uHoloT;\n';
const FS = `{
  float r = length(vHolo), d = abs(r - uHoloA.x), aa = fwidth(r) + 1e-4;
  float core = 1.0 - smoothstep(uHoloA.y, uHoloA.y + aa * 1.2, d);
  float halo = exp(-d / max(uHoloA.z, 1e-4));
  float fill = uHoloA.w > 0.0 ? step(r, uHoloA.x) * smoothstep(uHoloA.x - uHoloA.w, uHoloA.x, r) : 0.0;
  float ang = atan(vHolo.y, vHolo.x), a01 = fract(0.25 - ang / 6.2831853);
  float arc = uHoloB.w >= 0.999 ? 1.0 : mix(0.14, 1.0, 1.0 - smoothstep(uHoloB.w - 0.004, uHoloB.w, a01));
  float tick = 0.0;
  if(uHoloB.x > 0.5){ float g = uHoloA.y * 3.0 + uHoloA.z * 0.4, ta = fract(fract(a01 + uHoloC.w * uHoloT) * uHoloB.x);
    tick = (1.0 - smoothstep(0.08, 0.14, abs(ta - 0.5))) * step(uHoloA.x - g - uHoloB.y, r) * step(r, uHoloA.x - g); }
  float sweep = uHoloB.z != 0.0 ? pow(1.0 - fract(a01 - uHoloT * uHoloB.z), 7.0) : 0.0;
  float scan = uHoloC.z > 0.0 ? mix(1.0, 0.55 + 0.45 * sin(r / max(uHoloA.x, 1e-3) * 70.0 - uHoloT * 5.0), uHoloC.z) : 1.0;
  float glow = (core + halo * 0.45 + fill * 0.2 * scan + tick * 0.75) * arc * (1.0 + sweep * 1.8);
  float dark = (exp(-d / max(uHoloA.z * 1.3, 1e-4)) * 0.9 + fill * 0.25) * uHoloC.y;
  diffuseColor.rgb *= glow * uHoloC.x * diffuseColor.a;
  diffuseColor.a = clamp(dark * diffuseColor.a, 0.0, 1.0);
  if(glow * diffuseColor.a < 0.002 && diffuseColor.a < 0.002 && dot(diffuseColor.rgb, vec3(1.0)) < 0.004) discard;
}
`;
// fog dims the light instead of painting the fog colour over it (the ring adds its light, it has no surface)
const FS_FOG = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor *= 1.0 - fogFactor * ${BLIGHT.fogK.toFixed(3)};
#endif`;
function holoCompile(shader){ const u = this.userData.holo; shader.uniforms.uHoloA = u.a; shader.uniforms.uHoloB = u.b; shader.uniforms.uHoloC = u.c; shader.uniforms.uHoloT = BL_T;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vHolo;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHolo = vec2(position.x, position.y - position.z);');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FS_PARS).replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n' + FS).replace('#include <fog_fragment>', FS_FOG); }
// o: col, gain, core (half-width of the line), halo (falloff length), fill (inner glow depth), ticks (count), tickLen, sweep (turns/s),
//    arc (0..1 of the ring lit), dark (backing), scan (0..1), spin (tick turns/s), fog, depthTest, opacity — all in the mesh's own units
export function holoMat(R, o = {}){ const P = o.kind ? { ...BLIGHT.ring[o.kind], ...o } : o;
  const m = new THREE.MeshBasicMaterial({ color:blCol(P.col ?? 'white'), transparent:true, opacity:P.opacity ?? 1, depthWrite:false, depthTest:P.depthTest ?? true, side:THREE.DoubleSide, fog:P.fog ?? true,
    blending:THREE.CustomBlending, blendEquation:THREE.AddEquation, blendSrc:THREE.OneFactor, blendDst:THREE.OneMinusSrcAlphaFactor });
  m.userData.holo = { a:{ value:new THREE.Vector4(R, P.core ?? R * 0.012, P.halo ?? R * 0.05, P.fill ?? 0) }, b:{ value:new THREE.Vector4(P.ticks ?? 0, P.tickLen ?? R * 0.06, P.sweep ?? 0, P.arc ?? 1) },
    c:{ value:new THREE.Vector4(P.gain ?? BLIGHT.gain, P.dark ?? BLIGHT.dark, P.scan ?? 0, P.spin ?? 0) } };
  m.onBeforeCompile = holoCompile; return m; }
// the annulus that holds the light (flat in XY like THREE.RingGeometry; rotate it or the mesh to lay it down)
export function holoGeo(R, m, seg){ const a = m.userData.holo.a.value, b = m.userData.holo.b.value, reach = a.z * 4 + a.y;
  const inner = Math.max(0, R - Math.max(reach, a.w, b.x > 0.5 ? a.y * 3 + a.z * 0.4 + b.y + 0.02 : 0)); return new THREE.RingGeometry(inner, R + reach, seg ?? Math.max(48, Math.min(160, Math.round(R * 10))), 1); }
export function holoRing(R, o = {}){ const P = o.kind ? { ...BLIGHT.ring[o.kind], ...o } : o, m = holoMat(R, P), mesh = new THREE.Mesh(holoGeo(R, m, P.seg), m);
  mesh.userData.holo = m.userData.holo; if(P.flat !== false) mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = P.order ?? 4; return mesh; }
export function holoArc(mesh, f){ mesh.material.userData.holo.b.value.w = Math.max(0, Math.min(1, f)); }
export function holoGain(mesh, g){ mesh.material.userData.holo.c.value.x = g; }
// a solid line of light for reticles and brackets: an HDR colour, normal blend (reads on sunlit ground, still blooms), drawn over the scene
export function blSolid(col, gain, o = {}){ return new THREE.MeshBasicMaterial({ color:blHot(col, gain ?? 2.0), transparent:true, opacity:o.opacity ?? 0.92, depthWrite:false, depthTest:o.depthTest ?? false, fog:false, side:THREE.DoubleSide }); }
// a hologram tag for in-world labels: a dark glass plate with clipped corners, a thin glowing frame, scan lines and lit text (one texture, cached)
const _tags = new Map();
export function blTag(text, col){ const key = text + '|' + col; if(_tags.has(key)) return _tags.get(key);
  const c = document.createElement('canvas'), W = 256, Hh = 72; c.width = W; c.height = Hh; const x = c.getContext('2d'), hex = blCss(col), k = 12;
  const plate = () => { x.beginPath(); x.moveTo(k + 4, 6); x.lineTo(W - 6, 6); x.lineTo(W - 6, Hh - 6 - k); x.lineTo(W - 6 - k, Hh - 6); x.lineTo(6, Hh - 6); x.lineTo(6, 6 + k); x.closePath(); };
  plate(); const g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, 'rgba(6,14,18,0.78)'); g.addColorStop(1, 'rgba(2,6,8,0.62)'); x.fillStyle = g; x.fill();
  x.save(); plate(); x.clip(); x.fillStyle = hex; x.globalAlpha = 0.09; for(let y = 8; y < Hh; y += 4) x.fillRect(0, y, W, 1.4); x.globalAlpha = 0.16; x.fillRect(6, 6, 5, Hh); x.restore();
  plate(); x.strokeStyle = hex; x.lineWidth = 2.4; x.shadowColor = hex; x.shadowBlur = 10; x.stroke();
  x.font = '800 34px "Saira Condensed", Rajdhani, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.shadowBlur = 14; x.fillText(text, W / 2 + 3, Hh / 2 + 2);
  x.shadowBlur = 0; x.globalAlpha = 0.55; x.fillStyle = hex; x.fillText(text, W / 2 + 3, Hh / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _tags.set(key, t); return t; }
