export const ART_DIRECTION={name:'Saltglass Afternoon',skyTop:'#f09c73',skyBottom:'#f6d99f',sea:'#158694',shadow:'#164458',sun:'#ffe0a0',accent:'#58d8d1',warm:'#dd8065'};
export function applyArtDirection(world,renderer){world.art=ART_DIRECTION.name;renderer.profile=ART_DIRECTION;return renderer}
