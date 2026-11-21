export function updateChaseCamera(camera,player,dt){camera.x+=(player.x-camera.x)*Math.min(1,dt*4);camera.z+=(player.z-camera.z)*Math.min(1,dt*4);camera.angle+=(player.angle-camera.angle)*Math.min(1,dt*5);return camera}
export function updateShoulderCamera(camera,player,dt){return updateChaseCamera(camera,player,dt)}
export function avoidCameraOcclusion(camera,world){return camera}
