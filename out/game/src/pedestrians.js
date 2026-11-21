export function updateSidewalkPedestrians(world,dt){for(const p of world.pedestrians){p.phase+=dt;if(p.flee>0)p.flee-=dt;p.x+=Math.sin(p.phase*.7)*dt*.5;p.z+=Math.cos(p.phase*.6)*dt*.3}}
export function fleeFromDanger(world,x,z){for(const p of world.pedestrians)if(Math.hypot(p.x-x,p.z-z)<45)p.flee=3}
export function witnessCrime(world){world.toast='WITNESS REPORTING TO RCP';world.wanted=Math.min(5,world.wanted+1)}
