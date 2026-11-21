export function updateCivilianTraffic(world,dt){for(const car of world.vehicles){if(car.police||car.id===world.player.inVehicle)continue;if(!car.parked){car.z+=Math.sin(car.lane||0)*dt*2;car.x+=Math.cos(car.lane||0)*dt*2;if(car.x>430)car.x=-580;if(car.z>480)car.z=-480}}}
export function reserveIntersection(world,node){return !world.trafficLocks?.has(node)&&(world.trafficLocks?.add(node),true)}
export function spawnTrafficOutOfSight(world){return world.vehicles.filter(v=>!v.police).length}
