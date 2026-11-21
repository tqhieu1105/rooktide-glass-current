export function emitTyreSmoke(world,x,z){world.effects.push({type:'smoke',x,z,t:1})}
export function emitImpactSparks(world,x,z){world.effects.push({type:'spark',x,z,t:.5})}
export function updatePooledEffects(world,dt){for(const e of world.effects)e.t-=dt;world.effects=world.effects.filter(e=>e.t>0)}
