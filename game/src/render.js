import * as THREE from '../vendor/three.module.min.js';
import { ART_DIRECTION as A } from './art-direction.js';
import { createGeometryBuilder } from './geometry.js';
import { createDistrictBuildings } from './buildings.js';
import { createBeachAndHarbour } from './coast.js';

export function createCityRenderer(canvas, world) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(A.fog, 210, 950);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.15, 3600);
  scene.add(new THREE.HemisphereLight(A.fill, A.groundFill, 2.3));
  const sun = new THREE.DirectionalLight(A.sun, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 220 });
  sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const sky = createSky(); scene.add(sky);
  const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(56, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffe1a1, fog: false }));
  sunDisk.position.set(1450, 490, -1900); scene.add(sunDisk);
  const sea = createSea(); scene.add(sea);
  const builder = createGeometryBuilder(scene);
  createBeachAndHarbour(world, builder);
  createDistrictBuildings(world, builder);
  const { updateDrawDistance, ...staticStats } = builder.finish();
  let scale = 1;
  const gl = renderer.getContext();
  const extension = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const version = gl.getParameter(gl.VERSION);
  let quality = /swiftshader|llvmpipe|software/i.test(rendererName) ? 'low' : 'high';
  function resize() {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
    renderer.setSize(Math.round(innerWidth * scale), Math.round(innerHeight * scale), false);
  }
  window.addEventListener('resize', resize); resize();
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; });
  function renderWorldFrame(target) {
    if (contextLost) throw new Error('WebGL context lost. Reload to restore the 3D renderer.');
    sun.target.position.set(target.x, 0, target.z);
    sun.position.set(target.x - 65, 95, target.z + 45);
    sea.material.uniforms.time.value = world.clock;
    sky.position.set(camera.position.x, 0, camera.position.z);
    updateDrawDistance(camera, quality === 'low' ? 450 : Infinity);
    renderer.render(scene, camera);
  }
  function setRenderQuality(value) {
    quality = value;
    scale = value === 'low' ? 0.75 : 1;
    scene.fog.far = value === 'low' ? 420 : 950;
    renderer.shadowMap.enabled = value !== 'low'; resize();
  }
  setRenderQuality(quality);
  return { scene, camera, renderer, renderWorldFrame, setRenderQuality,
    diagnostics: () => ({ engine: `Three.js r${THREE.REVISION}`, context: version, gpu: rendererName, quality,
      width: canvas.width, height: canvas.height,
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, ...staticStats }) };
}

function createSky() {
  return new THREE.Mesh(new THREE.SphereGeometry(3000, 20, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(A.skyTop) }, horizon: { value: new THREE.Color(A.skyHorizon) } },
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vDirection; uniform vec3 top; uniform vec3 horizon;
      void main(){float h=max(normalize(vDirection).y,0.);gl_FragColor=vec4(mix(horizon,top,pow(h,.55)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }));
}
function createSea() {
  const geometry = new THREE.PlaneGeometry(7000, 7000);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(A.sea) }, haze: { value: new THREE.Color(A.fog) } },
    vertexShader: 'varying vec3 vWorld; varying float vDepth; void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;vec4 mv=viewMatrix*p;vDepth=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform float time; uniform vec3 color; uniform vec3 haze; varying vec3 vWorld; varying float vDepth;
      void main(){float a=sin(vWorld.z*.72+sin(vWorld.x*.09+time*.3)*1.8+time*.5);float b=sin(vWorld.x*.18-vWorld.z*.38+time*.7);
      float ripple=smoothstep(.90,1.,a*b)*.12;vec3 c=color+vec3(ripple*.7,ripple,ripple*.9);
      c=mix(c,haze,smoothstep(200.,2200.,vDepth)*.72);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const sea = new THREE.Mesh(geometry, material); sea.position.y = -0.5; return sea;
}
