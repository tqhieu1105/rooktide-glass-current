export function reportWitnessedCrime(world,heat=1){world.wanted=Math.min(5,Math.max(world.wanted,heat));world.heat=Math.min(100,world.heat+20);world.toast='RCP DISPATCHED'}
export function updateWantedSearch(world,dt){if(world.wanted>0){world.heat=Math.max(0,world.heat-dt*(world.player.visible?0.5:4));if(world.heat===0)world.wanted=0}}
export function clearEscapedHeat(world){world.heat=0;world.wanted=0}
