import {STEP} from './config.js';
import {createRandom} from './random.js';
import {createRooktideCity} from './world.js';
import {createInput} from './input.js';
import {createRenderer} from './render.js';
import {updateMissionAndWantedHUD} from './hud.js';
import {showStartMenu,pauseAndResumeGame} from './menus.js';
import {stagePlayableScreenshot,warmScenarioToCaptureTick,signalShotReady} from './shots.js';
import {updateOnFootPlayer,enterOrStealVehicle,exitVehicleSafely} from './player.js';
import {stepArcadeDriving} from './vehicles.js';
import {updateCivilianTraffic} from './traffic.js';
import {updateSidewalkPedestrians} from './pedestrians.js';
import {reportWitnessedCrime,updateWantedSearch} from './wanted.js';
import {dispatchRespondingPolice,updatePursuitTactics} from './police.js';
import {updatePoliceHelicopter} from './helicopter.js';
import {updatePlayerCombat,updateHostileGuards} from './combat.js';
import {updatePooledEffects} from './effects.js';
import {updateMission,advanceMissionStage} from './missions.js';
import {updateActivity} from './activities.js';
import {saveCampaignCheckpoint,loadValidatedCampaign,restoreSafeCheckpoint} from './save.js';
import {startSynthAudio,switchRadioStation} from './audio.js';

export function bootOpenWorldCrimeGame(){const canvas=document.getElementById('game'),menu=document.getElementById('menu'),status=document.getElementById('status'),input=createInput(canvas),renderer=createRenderer(canvas),params=new URLSearchParams(location.search),seed=Number(params.get('seed'))||20261121,world=createRooktideCity(createRandom(seed));let mode='title',acc=0,last=performance.now(),shot=params.get('shot');
function toast(message){world.toast=message;world.toastTime=3;status.textContent=message}
function start(){startSynthAudio();world.started=true;mode='play';menu.className='hidden';world.missionActive=true;world.mission=0;world.stage=0;toast('ROOKTIDE ONLINE  /  Meet Ilex at Kiln Market')}
function pause(){mode='pause';pauseAndResumeGame(menu,{resume:()=>{mode='play';menu.className='hidden'},retry:()=>{restoreSafeCheckpoint(world);mode='play';menu.className='hidden';toast('CHECKPOINT RESTORED')},save:()=>{saveCampaignCheckpoint(world);toast('CAMPAIGN SAVED')},title:()=>{mode='title';showStartMenu(menu,world,{start,title:()=>{},audio:startSynthAudio})}})}
showStartMenu(menu,world,{start,title:()=>{},audio:startSynthAudio});loadValidatedCampaign(world);
function interact(){if(world.player.inVehicle){exitVehicleSafely(world.player,world);toast('ON FOOT  /  safe exit')}else if(enterOrStealVehicle(world.player,world)){world.player.vehicle=world.vehicles.find(v=>v.id===world.player.inVehicle);toast('VEHICLE STOLEN  /  RCP alerted')}else{advanceMissionStage(world,'interact');toast(world.toast||'Nothing to interact with nearby')}}
function step(dt){world.clock+=dt;world.toastTime=Math.max(0,world.toastTime-dt);if(world.shotCooldown>0)world.shotCooldown-=dt;if(mode!=='play')return;const axis=input.axis(),p=world.player;p.sprinting=input.held('ShiftLeft')||input.held('ShiftRight');if(p.inVehicle){const car=world.vehicles.find(v=>v.id===p.inVehicle);if(car){stepArcadeDriving(car,axis,dt);p.x=car.x;p.z=car.z;p.angle=car.angle;if(Math.abs(car.speed)>100&&Math.random()<dt*.03)world.effects.push({type:'smoke',x:car.x,z:car.z,t:1})}}else{updateOnFootPlayer(p,axis,dt,world);p.angle=Math.atan2(axis.x,-axis.z)||p.angle}if(input.take('KeyE'))interact();if(input.take('Digit1'))p.weapon='fists';if(input.take('Digit2'))p.weapon='pistol';if(input.take('KeyR')&&p.weapon==='pistol'){p.ammo=12;toast('RELOADED')}if(input.take('Tab'))switchRadioStation(world);if(input.take('Space')&&p.inVehicle){const c=world.vehicles.find(v=>v.id===p.inVehicle);if(c)c.speed*=.35}updatePlayerCombat(world,input,dt);updateHostileGuards(world,dt);updateCivilianTraffic(world,dt);updateSidewalkPedestrians(world,dt);if(world.wanted>0){dispatchRespondingPolice(world);updatePursuitTactics(world,dt)}updatePoliceHelicopter(world,dt);updateWantedSearch(world,dt);updatePooledEffects(world,dt);updateMission(world,dt);updateActivity(world,dt);if(world.stageFlash)world.stageFlash=Math.max(0,world.stageFlash-dt);if(Math.random()<dt*.001&&p.inVehicle)reportWitnessedCrime(world,world.wanted||1);if(world.player.hp<=0){restoreSafeCheckpoint(world);toast('BUSTED  /  checkpoint restored')}}
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;acc+=dt;while(acc>=STEP){step(STEP);acc-=STEP}renderer.draw(world,dt);updateMissionAndWantedHUD(world);requestAnimationFrame(frame)}
if(shot){mode='play';menu.className='hidden';stagePlayableScreenshot(shot,world);warmScenarioToCaptureTick(world);renderer.draw(world,0);updateMissionAndWantedHUD(world);requestAnimationFrame(()=>{renderer.draw(world,0);updateMissionAndWantedHUD(world);signalShotReady()})}else{document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause()});window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat){if(mode==='play')pause();else if(mode==='pause'){mode='play';menu.className='hidden'}}});requestAnimationFrame(frame)}}
export function advanceFixedStep(world,input,dt){return world.clock+=dt}
export function resumeGameLoop(){return true}
bootOpenWorldCrimeGame();
