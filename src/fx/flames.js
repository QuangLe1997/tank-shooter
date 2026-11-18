// fx/flames.js — Z235 LIVING FLAMES: every standing fire (camp fires, braziers, torches) is a flame that breathes and dances, not a stiff cone.
//   A flame is two crossed quads that always turn to the camera round their own upright axis; the fragment shader draws the fire itself —
//   a white-yellow core inside an orange body with red edges, licks of flame that peel off and rise, the whole flame swaying and
//   breathing in a layered rhythm (a slow pulse, a quicker flutter, a fast shimmer). Every flame runs on its own phase (taken from where
//   it stands), so a row of torches never moves in step. One shared material → any number of flames costs one tiny shader.
import * as THREE from 'three';

export const FLAME_U = { time:{ value:0 } };
let _mat=null, _geo=null;
function flameMat(){ if(_mat) return _mat;
  _mat=new THREE.ShaderMaterial({ uniforms:FLAME_U, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false,
    vertexShader:`uniform float time; varying vec2 vUv; varying float vPh;
      void main(){ vUv=uv; vec3 c=modelMatrix[3].xyz; vPh=fract(sin(dot(c.xz,vec2(12.9898,78.233)))*43758.5453)*40.0;
        vec3 right=normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0])); float sx=length(modelMatrix[0].xyz), sy=length(modelMatrix[1].xyz);
        float breathe=1.0+0.10*sin(time*3.1+vPh)+0.06*sin(time*7.3+vPh*1.7);                 // the flame stretches and settles
        vec3 p=c + right*position.x*sx + vec3(0.0,1.0,0.0)*position.y*sy*breathe;
        p.x+=sin(time*2.3+vPh)*0.06*position.y*sy; p.z+=cos(time*1.9+vPh)*0.05*position.y*sy;   // the tip sways
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0); }`,
    fragmentShader:`uniform float time; varying vec2 vUv; varying float vPh;
      float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); }
      void main(){ float y=vUv.y, x=vUv.x-0.5;
        float t=time*1.0+vPh;
        float n=vn(vec2(x*3.0, y*2.6-t*2.2))*0.6+vn(vec2(x*7.0, y*5.5-t*4.1))*0.4;             // turbulence rising through the flame
        x+=(n-0.5)*0.32*y + sin(y*5.0-t*3.0)*0.05*y;                                             // licks bend the body
        float w=0.42*pow(1.0-y, 0.6)*(0.82+0.18*sin(t*5.7))*(0.75+0.5*n);                       // wide at the root, a tongue at the top
        float body=smoothstep(w, w*0.25, abs(x))*smoothstep(0.0,0.08,y)*smoothstep(1.0,0.55-0.25*n,y);
        if(body<0.01) discard;
        float core=smoothstep(w*0.45, 0.0, abs(x))*smoothstep(0.55,0.05,y)*0.75;
        float flick=0.85+0.1*sin(t*9.0)+0.05*sin(t*23.0+1.3);
        vec3 col=mix(vec3(0.85,0.16,0.03), vec3(1.0,0.48,0.08), smoothstep(0.0,0.7,body)*smoothstep(1.0,0.3,y));           // red edges → orange body
        col=mix(col, vec3(1.0,0.82,0.45), core);                                                  // white-yellow heart
        gl_FragColor=vec4(col*body*flick*1.35, body); }` });
  return _mat; }
// a flame `h` tall and `w` wide, its foot at the group's origin
export function flameFX(h, w){ if(!_geo){ _geo=new THREE.PlaneGeometry(1,1); _geo.translate(0,0.5,0); }
  const g=new THREE.Group(); for(let k=0;k<2;k++){ const m=new THREE.Mesh(_geo, flameMat()); m.scale.set(w*(k?0.8:1), h*(k?0.86:1), 1); m.position.set(k?0.04:0, k?0.02:0, 0); m.renderOrder=5; m.frustumCulled=false; m.userData.flame=true; g.add(m); }
  g.userData.flame=true; return g; }
export function updateFlames(dt){ FLAME_U.time.value+=dt; }
