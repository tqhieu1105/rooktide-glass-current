export function repairVehicleAtGarage(world){if(world.cash>=150){world.cash-=150;if(world.player.vehicle)world.player.vehicle.condition=world.player.vehicle.maxCondition;world.toast='GARAGE REPAIR  -$150';return true}return false}
export function storeOwnedVehicle(world){world.garage=world.player.vehicle?.id||world.garage;return world.garage}
export function recallGarageVehicle(world){return world.vehicles.find(v=>v.id===world.garage)}
