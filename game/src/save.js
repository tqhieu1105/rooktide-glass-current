const KEY='rooktide.glass-current.v1';
export function saveCampaignCheckpoint(world){try{localStorage.setItem(KEY,JSON.stringify({cash:world.cash,rp:world.rp,mission:world.mission,stage:world.stage,garage:world.garage}))}catch{world.toast='SESSION ONLY  save unavailable'}}
export function loadValidatedCampaign(world){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){Object.assign(world,{cash:Number(s.cash)||0,rp:Number(s.rp)||0,mission:Number(s.mission)||0,stage:Number(s.stage)||0,garage:s.garage||null});return true}}catch{}return false}
export function restoreSafeCheckpoint(world){world.player.x=-180;world.player.z=40;world.player.inVehicle=null;return world}
