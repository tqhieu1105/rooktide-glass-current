import {createVehicle} from './vehicles.js';
export function dispatchRespondingPolice(world){while(world.police.length<Math.min(world.wanted,5)){const i=world.police.length;world.police.push(createVehicle('saloon',world.player.x-70-i*28,world.player.z-90-i*18,{id:`RCP-${12+i}`,police:true,color:'#f1f4e8'}))}}
export function updatePursuitTactics(world,dt){for(const unit of world.police){const dx=world.player.x-unit.x,dz=world.player.z-unit.z,d=Math.hypot(dx,dz)||1;unit.x+=dx/d*dt*(12+world.wanted*2);unit.z+=dz/d*dt*(12+world.wanted*2);unit.angle=Math.atan2(dx,-dz)}if(world.wanted>=4&&!world.roadblock)placeRoadblock(world)}
export function placeRoadblock(world){world.roadblock={x:world.player.x+80,z:world.player.z+40};world.toast='ROADBLOCK AHEAD  gap on right'}
