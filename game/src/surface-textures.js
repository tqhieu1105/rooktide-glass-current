import * as THREE from '../vendor/three.module.min.js';
import { createRandom } from './random.js';

const TAU = Math.PI * 2;

export function createChunkRoughness(seed) {
  const random = createRandom((seed ^ 0x5f356495) >>> 0);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.createImageData(128, 128);
  const phase = Array.from({ length: 5 }, () => random() * TAU);
  const broadX = 2 + Math.floor(random() * 3), broadY = 2 + Math.floor(random() * 3);
  const mediumX = 9 + Math.floor(random() * 8), mediumY = 11 + Math.floor(random() * 8);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = x / 128, v = y / 128;
    const broad = Math.sin(TAU * (u * broadX + v * broadY) + phase[0])
      * Math.cos(TAU * (v * broadY - u * broadX) + phase[1]);
    const medium = Math.sin(TAU * (u * mediumX + v * 2) + phase[2])
      * Math.sin(TAU * (v * mediumY - u * 3) + phase[3]);
    const grain = Math.sin(TAU * (u * 37 + v * 13) + phase[4]) * Math.cos(TAU * (v * 43 - u * 9) + phase[0]);
    const value = Math.max(0, Math.min(255, Math.round(238 + broad * 11 + medium * 6 + grain * 2)));
    const i = (y * 128 + x) * 4;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export function createGroundTextures(seed) {
  const random = createRandom(seed ^ 0x275ea41d);
  const colorCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = roughCanvas.width = roughCanvas.height = 256;
  const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
  const roughCtx = roughCanvas.getContext('2d', { willReadFrequently: true });
  const color = colorCtx.createImageData(256, 256), rough = roughCtx.createImageData(256, 256);
  const phase = Array.from({ length: 8 }, () => random() * TAU);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = x / 256, v = y / 256;
    const low = Math.sin(TAU * (u * 3 + v * 2) + phase[0]) * Math.cos(TAU * (v * 2 - u) + phase[1]);
    const mid = Math.sin(TAU * (u * 11 + v * 7) + phase[2]) * Math.cos(TAU * (v * 13 - u * 3) + phase[3]);
    const fine = Math.sin(TAU * (u * 29) + phase[4]) * Math.cos(TAU * (v * 31) + phase[5]);
    const value = Math.max(0, Math.min(255, Math.round(227 + low * 14 + mid * 8 + fine * 4)));
    const roughness = Math.max(0, Math.min(255, Math.round(226 + low * 15 + mid * 11 + fine * 4)));
    const i = (y * 256 + x) * 4;
    color.data[i] = value;
    color.data[i + 1] = Math.min(255, value + 2);
    color.data[i + 2] = Math.max(0, value - 5);
    color.data[i + 3] = 255;
    rough.data[i] = rough.data[i + 1] = rough.data[i + 2] = roughness;
    rough.data[i + 3] = 255;
  }
  colorCtx.putImageData(color, 0, 0); roughCtx.putImageData(rough, 0, 0);
  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.wrapS = colorTexture.wrapT = THREE.RepeatWrapping;
  colorTexture.minFilter = THREE.LinearMipmapLinearFilter;
  colorTexture.generateMipmaps = true;
  const roughnessTexture = new THREE.CanvasTexture(roughCanvas);
  roughnessTexture.colorSpace = THREE.NoColorSpace;
  roughnessTexture.wrapS = roughnessTexture.wrapT = THREE.RepeatWrapping;
  roughnessTexture.minFilter = THREE.LinearMipmapLinearFilter;
  roughnessTexture.generateMipmaps = true;
  return {
    color: colorTexture,
    roughness: roughnessTexture,
  };
}

export function applyGroundTexture(material, textures) {
  material.map = textures.color;
  material.roughnessMap = textures.roughness;
  material.roughness = 1;
  material.customProgramCacheKey = () => 'world-grass-texture-v1';
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec2 vGroundUv;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
      #include <uv_vertex>
      #ifdef USE_INSTANCING
        vGroundUv = (instanceMatrix * vec4(position, 1.0)).xz * .035;
      #else
        vGroundUv = (modelMatrix * vec4(position, 1.0)).xz * .035;
      #endif
      #ifdef USE_MAP
        vMapUv = vGroundUv;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv = vGroundUv;
      #endif
    `);
    shader.fragmentShader = `varying vec2 vGroundUv;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        vec4 texelRoughness = textureGrad(roughnessMap, fract(vGroundUv), dFdx(vGroundUv), dFdy(vGroundUv));
        roughnessFactor *= texelRoughness.g;
      #endif
    `);
  };
}
