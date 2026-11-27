// render/air-post.js — AIR 1 ONE CINEMATIC PASS: the frame's tail (NaN guard, bloom's additive write-back, tone map + sRGB, the grade) drawn as a single
//   full-screen pass, with auto exposure (a tiny 2 × 1 target follows the frame's mean log brightness fast and slow, all on the GPU, never read back),
//   selective bloom (bright pass keeps what really shines) and mid-tone film grain. AIRPOST.u shares the grade's uniform objects, so every module that
//   writes gradePass.uniforms (atmosphere, weather, flashes, shake) still drives it. airPost(false) puts the old chain back (A/B in one battle).
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { AIR } from '../../config.js';
import { BIOME, NIGHT, S, SUN_DIR, bloom, composer, gradePass, nanPass, outPass, renderPass, renderer } from '../hub.js';

const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
// selective bright pass (replaces the bloom's luminosity high pass; uSel.x = 0 is the stock one: hard threshold, every colour alike)
const SEL_FRAG = `uniform sampler2D tDiffuse; uniform float luminosityThreshold, smoothWidth; uniform vec4 uSel; varying vec2 vUv;
  void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; if(any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = min(c, vec3(64.0));   // (Z147's guard: a NaN never reaches the mip chain)
    float v = dot(c, vec3(0.299, 0.587, 0.114)), a = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v);
    if(uSel.x > 0.0){ float mx = max(c.r, max(c.g, c.b)), sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 1e-4);
      a *= mix(uSel.w, 1.0, max(smoothstep(uSel.y * 0.5, uSel.y, sat), smoothstep(luminosityThreshold * uSel.z, luminosityThreshold * uSel.z * 1.6, v))); }
    gl_FragColor = vec4(c * a, 1.0); }`;
// auto exposure: pixel 0 = fast mean, pixel 1 = slow mean of log2 luminance, each eased from the previous frame's (ping-pong)
const AE_FRAG = `uniform sampler2D tDiffuse, tPrev; uniform vec2 uK, uJ; varying vec2 vUv;
  void main(){ float s = 0.0, w = 0.0;
    for(int y = 0; y < 8; y++) for(int x = 0; x < 12; x++){ vec2 uv = (vec2(float(x), float(y)) + uJ) / vec2(12.0, 8.0), d = uv - 0.5; float wt = 1.0 - 1.2 * dot(d, d);
      float l = dot(texture2D(tDiffuse, uv).rgb, vec3(0.2126, 0.7152, 0.0722)); if(!(l == l) || l > 1e4) l = 0.18; s += log2(clamp(l, 0.002, 64.0)) * wt; w += wt; }
    float k = gl_FragCoord.x < 1.0 ? uK.x : uK.y, prev = texture2D(tPrev, vec2(gl_FragCoord.x * 0.5, 0.5)).r;
    gl_FragColor = vec4(mix(prev, s / w, k), 0.0, 0.0, 1.0); }`;
const FRAG = `#include <tonemapping_pars_fragment>
  #include <packing>
  uniform sampler2D tDiffuse, tBloom, tAE, tDepth; uniform float bloomOn; uniform vec4 uAE, uHaze; uniform vec2 uGrainK, uNF;
  uniform float time,vig,grain,sharp,sat,contrast,aberr,flash,vib,toe; uniform vec3 lift,gain,shTint,hiTint; varying vec2 vUv;
  float gExp = 1.0; vec3 gB = vec3(0.0);
  vec3 hdr(vec2 uv){ return min(texture2D(tDiffuse, uv).rgb, vec3(64.0)); }   // (the NaN guard runs once, on the result)
  float lum(vec2 uv){ float l = dot(hdr(uv) + gB, vec3(0.2126, 0.7152, 0.0722)) * gExp * toneMappingExposure; return l / (l + 0.45); }
  vec3 disp(vec3 h){ h = (h + gB) * gExp;   // linear HDR (+ the bloom) → display: exposure, the tone map (it applies toneMappingExposure), sRGB
    #if defined( AGX_TONE_MAPPING )
      h = AgXToneMapping(h);
    #elif defined( ACES_FILMIC_TONE_MAPPING )
      h = ACESFilmicToneMapping(h);
    #elif defined( NEUTRAL_TONE_MAPPING )
      h = NeutralToneMapping(h);
    #elif defined( LINEAR_TONE_MAPPING )
      h = LinearToneMapping(h);
    #endif
    return sRGBTransferOETF(vec4(h, 1.0)).rgb; }
  void main(){
    vec2 uv = vUv;
    if(uHaze.x > 0.0){ float z = texture2D(tDepth, vUv).x, m = smoothstep(uHaze.z, uHaze.w, -perspectiveDepthToViewZ(z, uNF.x, uNF.y)) * step(z, 0.99999);   // AIR 3 heat haze: the far hot ground
      if(m > 0.0){ float t = uHaze.y, w = sin(vUv.y * 520.0 - t * 5.0 + sin(vUv.x * 31.0 + t * 0.9) * 2.4) * 0.65 + sin(vUv.y * 1130.0 - t * 8.3 + vUv.x * 57.0) * 0.35;   // fine ripples rising up the frame
        uv += vec2(w * 0.35, w) * uHaze.x * m / vec2(textureSize(tDiffuse, 0)); } }
    if(uAE.x > 0.0){ float f = texture2D(tAE, vec2(0.25, 0.5)).r, s = texture2D(tAE, vec2(0.75, 0.5)).r; gExp = clamp(exp2((s - f) * uAE.y), uAE.z, uAE.w); }
    if(bloomOn > 0.5) gB = texture2D(tBloom, vUv).rgb;
    vec2 d = vUv - 0.5; vec3 c;
    if(aberr > 0.0002){ vec2 o = d * aberr; c = disp(vec3(hdr(uv + o).r, hdr(uv).g, hdr(uv - o).b)); }
    else c = disp(hdr(uv));
    if(sharp > 0.0){ vec2 px = 1.0 / vec2(textureSize(tDiffuse, 0)), dx = vec2(px.x, 0.0), dy = vec2(0.0, px.y);   // Z145 unsharp mask — AIR 1 on brightness alone, in a cheap display-like
      float fc = lum(uv), f1 = lum(uv + dx), f2 = lum(uv - dx), f3 = lum(uv + dy), f4 = lum(uv - dy);   // curve: tone-mapping all five taps cost 2.8 ms at 0.9 MP
      float fs = fc + (fc - (f1 + f2 + f3 + f4) * 0.25) * sharp;
      c *= max(fs, 0.0) / max(fc, 1e-4); }
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float s0 = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = mix(vec3(l), c, sat * (1.0 + vib * (1.0 - s0)));
    { vec3 cl = (c - 0.45) * contrast + 0.45;
      if(toe > 0.0) cl = mix(cl, 0.45 * pow(max(c, vec3(0.0)) / 0.45, vec3(contrast)), toe * (1.0 - step(0.45, c)));
      c = cl; }
    c = mix(c, 0.8 + (c - 0.8) / (1.0 + (c - 0.8) * 5.0), step(0.8, c));
    float l2 = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
    c += shTint * (1.0 - smoothstep(0.0, 0.55, l2)) + hiTint * smoothstep(0.4, 1.0, l2);
    c = c * gain + lift * (1.0 - l);
    c += flash * vec3(1.0, 0.86, 0.62);
    float r = length(d * vec2(1.0, 0.82)); c *= 1.0 - vig * smoothstep(0.32, 0.82, r);
    float n = fract(sin(dot(vUv * vec2(1271.3, 3117.1) + time * 61.7, vec2(12.9898, 78.233))) * 43758.5453);
    c += (n - 0.5) * grain * mix(1.0, uGrainK.x + (1.0 - uGrainK.x) * 4.0 * l2 * (1.0 - l2), uGrainK.y);   // AIR 1 film grain lives in the mid-tones
    if(any(isnan(c))) c = vec3(0.0);   // Z147 a bad pixel stays one black pixel
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`;

const TONES = { [THREE.LinearToneMapping]:'LINEAR_TONE_MAPPING', [THREE.ACESFilmicToneMapping]:'ACES_FILMIC_TONE_MAPPING', [THREE.AgXToneMapping]:'AGX_TONE_MAPPING', [THREE.NeutralToneMapping]:'NEUTRAL_TONE_MAPPING' };
const G = gradePass.uniforms, aeRT = () => new THREE.WebGLRenderTarget(2, 1, { type:THREE.HalfFloatType, format:THREE.RGBAFormat, minFilter:THREE.NearestFilter, magFilter:THREE.NearestFilter, depthBuffer:false });
export const AIRPOST = { on:false, ae:{ a:aeRT(), b:aeRT(), reset:true, last:0, was:'' }, tone:-1,
  u:{ tDiffuse:{ value:null }, tBloom:{ value:null }, tAE:{ value:null }, bloomOn:{ value:1 }, toneMappingExposure:{ value:1 }, uAE:{ value:new THREE.Vector4(0, AIR.ae.k, AIR.ae.lo, AIR.ae.hi) },
    uGrainK:{ value:new THREE.Vector2(AIR.grain.lo, AIR.grain.shape ? 1 : 0) }, tDepth:{ value:null }, uHaze:{ value:new THREE.Vector4() }, uNF:{ value:new THREE.Vector2(0.6, 600) },
    time:G.time, vig:G.vig, grain:G.grain, sharp:G.sharp, sat:G.sat, contrast:G.contrast, lift:G.lift, gain:G.gain, aberr:G.aberr, flash:G.flash, shTint:G.shTint, hiTint:G.hiTint, vib:G.vib, toe:G.toe } };
const aeMat = new THREE.ShaderMaterial({ uniforms:{ tDiffuse:{ value:null }, tPrev:{ value:null }, uK:{ value:new THREE.Vector2(1, 1) }, uJ:{ value:new THREE.Vector2(0.5, 0.5) } }, vertexShader:VS, fragmentShader:AE_FRAG, depthTest:false, depthWrite:false, blending:THREE.NoBlending });
const aeQuad = new FullScreenQuad(aeMat);
// the selective bright pass goes into the bloom itself (both chains use it; uSel.x = 0 → the stock high pass)
{ const m = bloom.materialHighPassFilter; m.uniforms.uSel = { value:new THREE.Vector4(AIR.bloom.sel ? 1 : 0, AIR.bloom.sat, AIR.bloom.hot, AIR.bloom.keep) }; m.fragmentShader = SEL_FRAG; m.needsUpdate = true;
  if(AIR.bloom.sel) bloom.highPassUniforms.smoothWidth.value = AIR.bloom.knee; }
// the bloom without its write-back: three's UnrealBloomPass.render up to the mip composite (the final pass adds it)
const _cc = new THREE.Color();
function bloomMips(r, rb){ const B = bloom; r.getClearColor(_cc); const ca = r.getClearAlpha(), ac = r.autoClear; r.autoClear = false; r.setClearColor(B.clearColor, 0);
  B.highPassUniforms.tDiffuse.value = rb.texture; B.highPassUniforms.luminosityThreshold.value = B.threshold; B.fsQuad.material = B.materialHighPassFilter;
  r.setRenderTarget(B.renderTargetBright); r.clear(); B.fsQuad.render(r);
  let inp = B.renderTargetBright;
  for(let i = 0; i < B.nMips; i++){ const m = B.separableBlurMaterials[i]; B.fsQuad.material = m;
    m.uniforms.colorTexture.value = inp.texture; m.uniforms.direction.value = B.constructor.BlurDirectionX; r.setRenderTarget(B.renderTargetsHorizontal[i]); r.clear(); B.fsQuad.render(r);
    m.uniforms.colorTexture.value = B.renderTargetsHorizontal[i].texture; m.uniforms.direction.value = B.constructor.BlurDirectionY; r.setRenderTarget(B.renderTargetsVertical[i]); r.clear(); B.fsQuad.render(r);
    inp = B.renderTargetsVertical[i]; }
  const cm = B.compositeMaterial; B.fsQuad.material = cm; cm.uniforms.bloomStrength.value = B.strength; cm.uniforms.bloomRadius.value = B.radius; cm.uniforms.bloomTintColors.value = B.bloomTintColors;
  r.setRenderTarget(B.renderTargetsHorizontal[0]); r.clear(); B.fsQuad.render(r);
  r.setClearColor(_cc, ca); r.autoClear = ac; }
{ const base = bloom.render.bind(bloom); bloom.render = (r, w, rb, dt, mask) => AIRPOST.on ? bloomMips(r, rb) : base(r, w, rb, dt, mask); }

// AIR 3 heat haze (config AIR.haze): the far ground of a hot battlefield wavers in fine rising ripples — strongest with the sun high, none at night,
//   none near (near..far m). Needs the scene's depth: desktop only, and only in the one pass.
function heatHaze(U){ const H = AIR.haze, k = H && H.on ? (H[BIOME.name] || 0) : 0, dt = renderPass.rt.depthTexture, cam = renderPass.camera, v = U.uHaze.value;
  const amt = dt && k > 0 && !AIRPOST.hazeOff ? k * H.px * Math.min(1, Math.max(0, (SUN_DIR.y - 0.2) / 0.4)) * (1 - NIGHT.k) : 0; v.x = amt; if(!amt) return;
  v.y = performance.now() / 1000 % 1000; v.z = H.near; v.w = H.far; U.tDepth.value = dt; U.uNF.value.set(cam.near, cam.far); }
class AirPass extends Pass {
  constructor(){ super(); this.needsSwap = false; this.mat = new THREE.ShaderMaterial({ uniforms:AIRPOST.u, vertexShader:VS, fragmentShader:FRAG, toneMapped:false, depthTest:false, depthWrite:false, blending:THREE.NoBlending }); this.quad = new FullScreenQuad(this.mat); }
  render(r, w, rb){ const U = AIRPOST.u, A = AIRPOST.ae;
    if(renderer.toneMapping !== AIRPOST.tone){ AIRPOST.tone = renderer.toneMapping; this.mat.defines = {}; if(TONES[AIRPOST.tone]) this.mat.defines[TONES[AIRPOST.tone]] = ''; this.mat.needsUpdate = true; }
    U.toneMappingExposure.value = renderer.toneMappingExposure;
    const aeOn = AIR.ae.on && !A.off && S.mode !== 'intro'; U.uAE.value.x = aeOn ? 1 : 0;
    if(aeOn){ const t = performance.now() / 1000, dt = Math.min(0.25, Math.max(0, t - (A.last || t))); A.last = t;
      if(S.mode === 'playing' && A.was !== 'playing') A.reset = true; A.was = S.mode;
      const kf = A.reset ? 1 : 1 - Math.exp(-dt / AIR.ae.fast), ks = A.reset ? 1 : 1 - Math.exp(-dt / AIR.ae.slow); A.reset = false;
      aeMat.uniforms.tDiffuse.value = rb.texture; aeMat.uniforms.tPrev.value = A.a.texture; aeMat.uniforms.uK.value.set(kf, ks); aeMat.uniforms.uJ.value.set(Math.random(), Math.random());
      r.setRenderTarget(A.b); aeQuad.render(r); const sw = A.a; A.a = A.b; A.b = sw; U.tAE.value = A.a.texture; }
    heatHaze(U);
    U.tDiffuse.value = rb.texture; U.bloomOn.value = bloom.enabled ? 1 : 0; U.tBloom.value = bloom.renderTargetsHorizontal[0].texture;
    r.setRenderTarget(this.renderToScreen ? null : w); this.quad.render(r); }
  dispose(){ this.mat.dispose(); this.quad.dispose(); } }
export const airPass = new AirPass(); composer.addPass(airPass);
// on: the one pass; off: the old chain (NaN guard → bloom written back → OutputPass → grade)
export function airPost(on){ AIRPOST.on = !!on; airPass.enabled = AIRPOST.on; nanPass.enabled = outPass.enabled = gradePass.enabled = !AIRPOST.on; AIRPOST.ae.reset = true; }
airPost(AIR.post.on);
