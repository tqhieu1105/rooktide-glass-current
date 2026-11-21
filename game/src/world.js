import {DISTRICTS,PALETTE,VEHICLE_TUNING,WORLD} from './config.js';
import {buildRoadGraph} from './roads.js';
import {createVehicle} from './vehicles.js';
import {buildCollisionGrid} from './collision.js';

function cityBuildings(random){const out=[];for(let z=-450;z<=420;z+=90)for(let x=-560;x<=350;x+=92){if(Math.abs(x%168)<20||Math.abs(z%120)<18)continue;const h=18+random()*65;out.push({x:x+random()*22-11,z:z+random()*22-11,w:48+random()*28,d:48+random()*28,h,c:PALETTE.building[Math.floor(random()*PALETTE.building.length)]})}return out}
function makeCars(random){const list=[];const types=['saloon','compact','van','pickup','sports'];for(let i=0;i<20;i++){const type=types[i%types.length];const lane=i%2?0:Math.PI/2;list.push(createVehicle(type,-520+(i*83)%900,-410+(i*137)%820,{id:`civil-${i}`,angle:lane,parked:i<8,speed:i<8?0:18+random()*20}))}list.push(createVehicle('compact',-170,46,{id:'mission-car',parked:true,color:'#e8bf54'}));return list}
function makePeople(random){return Array.from({length:44},(_,i)=>({x:-520+(i*91)%890,z:-430+(i*157)%840,phase:random()*8,flee:0,color:['#ec8a68','#63b8c5','#e7d18e','#b36b83'][i%4]}))}

export function createRooktideCity(random){const roads=buildRoadGraph();const world={limits:WORLD,roads,buildings:cityBuildings(random),vehicles:makeCars(random),pedestrians:makePeople(random),police:[],guards:[{x:50,z:210,t:0},{x:80,z:210,t:2}],effects:[],colliders:[],player:{x:-185,z:36,angle:0,walk:0,hp:100,armour:40,weapon:'fists',ammo:12,reserve:48,inVehicle:null,sprinting:false,visible:true},cash:2750,rp:220,rank:'WHEELHAND',wanted:0,heat:0,mission:0,stage:0,radio:0,toast:'',toastTime:0,dialogue:{speaker:'Sava Pell',line:'The tide gate is listening. Keep the ledger moving.'},heli:{active:false,x:0,z:0,y:90,t:0},roadblock:null,garage:null,shotCooldown:0,clock:0,paused:false,started:false,art:'saltglass'};buildCollisionGrid(world);return world}
export function findSafeSpawn(world){return{x:-180,z:40}}
export function getDistrictAt(x,z){for(const d of DISTRICTS)if(x>=d[1]&&x<=d[3]&&z>=d[2]&&z<=d[4])return d[0];return z<0?'Saffron Strand':'Cinderbank'}
