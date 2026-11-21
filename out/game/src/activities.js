import {awardMissionPayout} from './progression.js';
export function startRinglineSprint(world){world.activity={name:'Ringline Sprint',time:75,checkpoints:5};world.toast='RINGLINE SPRINT  5 CHECKPOINTS'}
export function startRelayDelivery(world){world.activity={name:'Relay Delivery',time:90,checkpoints:2};world.toast='RELAY DELIVERY  90 SECONDS'}
export function updateActivity(world,dt){if(!world.activity)return;world.activity.time-=dt;if(world.activity.time<=0){awardMissionPayout(world,250,45);world.activity=null}}
