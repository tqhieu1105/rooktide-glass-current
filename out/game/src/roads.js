export function buildRoadGraph(){const xs=[-420,-252,-84,84,252,420],zs=[-360,-240,-120,0,120,240,360],edges=[];for(const x of xs)edges.push({a:[x,-500],b:[x,500],w:22});for(const z of zs)edges.push({a:[-600,z],b:[440,z],w:z===0?28:22});edges.push({a:[440,-240],b:[560,-240],w:18});return{xs,zs,edges}}
export function findStreetRoute(a,b){return[[a.x,a.z],[(a.x+b.x)/2,a.z],[b.x,b.z]]}
export function findSidewalkRoute(a,b){return findStreetRoute(a,b)}
