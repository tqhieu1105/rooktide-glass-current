import * as THREE from '../vendor/three.module.min.js';
import { createCityAtlas } from './atlas.js';
import { ART_DIRECTION as A } from './art-direction.js';
import { createGeometryBuilder } from './geometry.js';
import { createDistrictBuildings } from './buildings.js';
import { createBeachAndHarbour } from './coast.js';

const SUN = new THREE.Vector3(67, 15, -73);

export function createCityRenderer(canvas, world) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(A.fog, 110, 340);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.15, 1100);
  scene.add(new THREE.HemisphereLight(A.fill, A.groundFill, 2.0));
  const sun = new THREE.DirectionalLight(A.sun, 2.5);
  sun.castShadow = true;
  sun.position.copy(SUN);
  sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, { left: -51, right: 51, top: 51, bottom: -51, near: 1, far: 219 });
  sun.shadow.normalBias = 0.075; sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const atlas = createCityAtlas(world.seed);
  const sky = createSky(); scene.add(sky);
  const sea = createSea(atlas); scene.add(sea);
  const builder = createGeometryBuilder(scene, atlas);
  createBeachAndHarbour(world, builder);
  createDistrictBuildings(world, builder);
  const { updateDrawDistance, ...staticStats } = builder.finish();
  let scale = 1, shadowX = Infinity, shadowZ = Infinity;
  const gl = renderer.getContext();
  const extension = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const version = gl.getParameter(gl.VERSION);
  let quality = /swiftshader|llvmpipe|software/i.test(rendererName) ? 'low' : 'high';
  function resize() {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    const ratio = Math.min(scale, 1280 * scale / innerWidth, 720 * scale / innerHeight);
    renderer.setSize(Math.max(1, Math.round(innerWidth * ratio)), Math.max(1, Math.round(innerHeight * ratio)), false);
  }
  window.addEventListener('resize', resize); resize();
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; });
  function renderWorldFrame(target, time = world.clock) {
    if (contextLost) throw new Error('WebGL context lost. Reload to restore the 3D renderer.');
    if (renderer.shadowMap.enabled) {
      const x = Math.round(target.x / 16) * 16, z = Math.round(target.z / 16) * 16;
      if (x !== shadowX || z !== shadowZ || renderer.shadowMap.needsUpdate) {
        shadowX = x; shadowZ = z;
        sun.target.position.set(x, 0, z);
        sun.position.copy(SUN).add(sun.target.position);
        renderer.shadowMap.needsUpdate = true;
      }
    }
    sea.material.uniforms.time.value = time;
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);
    updateDrawDistance(camera, quality === 'low' ? 245 : 420);
    renderer.render(scene, camera);
  }
  function setRenderQuality(value) {
    quality = value;
    scale = value === 'low' ? 0.45 : 0.875;
    scene.fog.near = value === 'low' ? 90 : 150;
    scene.fog.far = value === 'low' ? 245 : 420;
    renderer.shadowMap.enabled = value !== 'low';
    renderer.shadowMap.needsUpdate = renderer.shadowMap.enabled;
    resize();
  }
  setRenderQuality(quality);
  return { scene, camera, renderer, renderWorldFrame, setRenderQuality,
    diagnostics: () => ({ engine: `Three.js r${THREE.REVISION}`, context: version, gpu: rendererName, quality,
      width: canvas.width, height: canvas.height,
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, ...staticStats }) };
}

function createSky() {
  return new THREE.Mesh(new THREE.SphereGeometry(950, 16, 10), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(A.skyTop) }, magenta: { value: new THREE.Color(A.skyMagenta) },
      pink: { value: new THREE.Color(A.skyPink) }, horizon: { value: new THREE.Color(A.skyHorizon) },
      sun: { value: SUN.clone().normalize() } },
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vDirection; uniform vec3 top; uniform vec3 magenta; uniform vec3 pink; uniform vec3 horizon; uniform vec3 sun;
      void main(){vec3 dir=normalize(vDirection);
      float lower=smoothstep(-.22,.10,dir.y); vec3 low=mix(horizon,pink,lower);
      float middle=smoothstep(-.015,.23,dir.y); vec3 dusk=mix(low,magenta,middle);
      float upper=smoothstep(-.03,.27,dir.y); vec3 sky=mix(dusk,top,upper);
      float angle=dot(dir,sun); float glow=smoothstep(.94,.999,angle);
      float disc=smoothstep(.9991,.9995,angle);
      gl_FragColor=vec4(sky+vec3(1.,.35,.25)*glow*.55+vec3(3.,2.,1.2)*disc,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }));
}
function createSea(atlas) {
  const geometry = new THREE.PlaneGeometry(2600, 2600);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(A.sea) }, haze: { value: new THREE.Color(A.fog) },
      deep: { value: new THREE.Color(A.seaDeep) }, atlas: { value: atlas } },
    vertexShader: 'varying vec3 vWorld; varying float vDepth; void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;vec4 mv=viewMatrix*p;vDepth=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform float time; uniform vec3 color; uniform vec3 deep; uniform vec3 haze; uniform sampler2D atlas;
      varying vec3 vWorld; varying float vDepth;
      void main(){vec2 wave=vWorld.xz*vec2(.031,.090)+vec2(.021,.012)*time;
      float sparkle=textureGrad(atlas, vec2(.2666,.5166)+fract(wave)*.217,dFdx(wave)*.217,dFdy(wave)*.217).g;
      vec3 sea=mix(color,deep,smoothstep(480.,760.,vWorld.x)) + vec3(.20,.26,.20)*sparkle;
      gl_FragColor=vec4(mix(sea,haze,smoothstep(140.,920.,vDepth)*.67),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const sea = new THREE.Mesh(geometry, material); sea.position.y = -0.5; return sea;
}
