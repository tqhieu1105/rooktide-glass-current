import {RANKS} from './config.js';
export function awardMissionPayout(world,cash,rp){world.cash+=cash;world.rp+=rp;world.rank=RANKS.reduce((n,r)=>world.rp>=r[1]?r[0]:n,'RUNNER');world.toast=`MISSION COMPLETE  +$${cash.toLocaleString()}`}
export function updateCrewRank(world){return world.rank}
export function useCrewService(world,service){world.toast=`${service.toUpperCase()} SERVICE ACTIVE`;return true}
