export function updatePlayerCombat(world,input,dt){if(input.mouse.down&&world.player.weapon==='pistol'&&world.player.ammo>0&&world.shotCooldown<=0){world.player.ammo--;world.shotCooldown=.25;world.effects.push({type:'muzzle',x:world.player.x,z:world.player.z,t:.2});world.toast='SHOT FIRED'}}
export function resolveHitscanShot(world){return true}
export function updateHostileGuards(world,dt){for(const g of world.guards){g.t+=dt;g.x+=Math.sin(g.t)*dt*.4}}
