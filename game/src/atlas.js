import * as THREE from '../vendor/three.module.min.js';
import { createRandom } from './random.js';

// One padded atlas for every repeating surface. Each 128px tile has an 8px bleed.
export function createCityAtlas(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = createRandom(seed ^ 0xb77ca);
  const tile = (index, draw) => {
    const x = (index % 4) * 128, y = 384 - Math.floor(index / 4) * 128;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, 128, 128); ctx.clip();
    ctx.translate(x + 8, y + 8);
    draw(); ctx.restore();
    const pixels = ctx.getImageData(x + 8, y + 8, 112, 112), phase = random() * Math.PI * 2;
    const strength = index === 6 ? 6 : index === 8 ? 5 : index === 9 ? 6 : index === 7 ? 3 : 2;
    for (let py = 0; py < 112; py++) for (let px = 0; px < 112; px++) {
      const u = px / 112, v = py / 112;
      const broad = Math.sin((u * 3 + v * 2) * Math.PI * 2 + phase)
        * Math.cos((v * 3 - u * 2) * Math.PI * 2 + phase * 0.7);
      const fine = Math.sin((u * 37 + v * 19) * Math.PI * 2 + phase * 1.3)
        * Math.cos((v * 29 - u * 11) * Math.PI * 2 + phase);
      const delta = broad * strength + fine * 1.8;
      const offset = (py * 112 + px) * 4;
      for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] = Math.max(0, Math.min(255,
        Math.round(pixels.data[offset + channel] + delta)));
    }
    ctx.putImageData(pixels, x + 8, y + 8);
    ctx.drawImage(canvas, x + 8, y + 8, 1, 112, x, y + 8, 8, 112);
    ctx.drawImage(canvas, x + 119, y + 8, 1, 112, x + 120, y + 8, 8, 112);
    ctx.drawImage(canvas, x, y + 8, 128, 1, x, y, 128, 8);
    ctx.drawImage(canvas, x, y + 119, 128, 1, x, y + 120, 128, 8);
  };
  const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  tile(0, () => rect('#fff', 0, 0, 112, 112));
  for (let variant = 0; variant < 4; variant++) tile(variant + 1, () => {
    rect('#f9f1e4', 0, 0, 112, 112);
    rect('#d8c7b1', 0, 95, 112, 17);
    rect('#fff7e8', 0, 92, 112, 5);
    for (let column = 0; column < 2; column++) {
      const x = 9 + column * 56;
      rect('#a3a6a3', x - 3, 24, 44, 54);
      rect(variant === 1 && column === 0 || variant === 2 && column === 1 ? '#f3ca7e' : '#41585c', x, 27, 38, 47);
      rect('#779091', x, 27, 38, 11);
      rect('#e2ddd0', x + 18, 27, 2, 47);
    }
  });
  tile(5, () => {
    rect('#776f6b', 0, 0, 112, 112);
    rect('#4b6b69', 6, 24, 100, 81);
    for (let x = 12; x < 112; x += 23) rect('#bcb39a', x, 24, 3, 81);
    rect('#fae0a1', 13, 29, 81, 8);
    rect('#475651', 0, 104, 112, 8);
  });
  tile(6, () => {
    rect('#d0cecb', 0, 0, 112, 112);
    for (let i = 0; i < 3800; i++) rect(i % 4 ? '#b3b0ae' : '#ebe7df', random() * 112, random() * 112, 1 + random() * 2.3, 1);
    ctx.strokeStyle = '#a29d96'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(59, 0); ctx.lineTo(55, 29); ctx.lineTo(62, 56); ctx.lineTo(53, 85); ctx.lineTo(59, 112); ctx.stroke();
  });
  tile(7, () => {
    rect('#b9ad9c', 0, 0, 112, 112);
    for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
      rect(['#eee1cb', '#ddd1be', '#e4d9c5'][Math.floor(random() * 3)], x * 28 + 1, z * 28 + 1, 26, 26);
    }
  });
  tile(8, () => {
    rect('#fbefd6', 0, 0, 112, 112);
    for (let i = 0; i < 2600; i++) rect(i % 3 ? '#e8d0ad' : '#fffbef', random() * 112, random() * 112, 1 + random() * 1.8, 1.1);
  });
  tile(9, () => {
    rect('#253b3d', 0, 0, 112, 112);
    for (let i = 0; i < 360; i++) {
      const x = random() * 112, y = random() * 112, length = 3 + random() * 28;
      for (let wrap = -1; wrap <= 0; wrap++) {
        const left = x + wrap * 112, right = Math.min(112, left + length);
        if (right > 0) rect(i % 8 ? '#718e8b' : '#d9eedb', Math.max(0, left), y, right - Math.max(0, left), 1 + random() * 2);
      }
    }
  });
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.minFilter = THREE.LinearMipmapNearestFilter;
  return atlas;
}

export function useCityAtlas(material, texture, roughness, facade) {
  material.map = texture;
  material.roughnessMap = roughness;
  material.roughness = 1;
  material.customProgramCacheKey = () => facade ? 'facades' : 'surfaces';
  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute vec4 atlasStyle;
      varying vec2 vTileUV;
      varying vec4 vTileStyle;
      varying float vRoof;
      ${shader.vertexShader}`.replace('#include <uv_vertex>', `#include <uv_vertex>
      vTileStyle = atlasStyle;
      ${facade ? `vRoof = abs(normal.y);
        vTileUV = uv * vec2(mix(atlasStyle.y, atlasStyle.z, abs(normal.x)), atlasStyle.w);`
        : 'vRoof = 0.; vTileUV = (instanceMatrix * vec4(position, 1.)).xz * atlasStyle.y;'}`);
    shader.fragmentShader = `varying vec2 vTileUV;
      varying vec4 vTileStyle;
      varying float vRoof;
      ${shader.fragmentShader}`.replace('#include <map_fragment>', `
      float tile = ${facade ? 'vRoof > .5 ? 0. : (vTileUV.y < 1. ? 5. : vTileStyle.x)' : 'vTileStyle.x'};
      vec2 tileOffset = vec2(mod(tile, 4.), floor(tile * .25)) * .25;
      vec2 repeatUV = fract(vTileUV);
      vec2 tileUV = tileOffset + vec2(.0166) + repeatUV * .217;
      diffuseColor *= textureGrad(map, tileUV, dFdx(vTileUV) * .217, dFdy(vTileUV) * .217);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        float tileRoughness = tile < 1. ? .96 : tile < 5. ? .93 : tile < 6. ? .80
          : tile < 7. ? .95 : tile < 8. ? .91 : tile < 9. ? .99 : .32;
        vec4 texelRoughness = textureGrad(roughnessMap, fract(vTileUV), dFdx(vTileUV), dFdy(vTileUV));
        roughnessFactor *= texelRoughness.g * tileRoughness;
      #endif
    `);
  };
}
