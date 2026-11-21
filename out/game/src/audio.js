let ctx=null,master=null;
export function startSynthAudio(){if(ctx)return;ctx=new AudioContext();master=ctx.createGain();master.gain.value=.08;master.connect(ctx.destination);const o=ctx.createOscillator();o.frequency.value=110;o.type='triangle';o.connect(master);o.start();o.stop(ctx.currentTime+.12)}
export function updateEngineAndSirens(world){if(!ctx||!world.player.inVehicle)return}
export function switchRadioStation(world){world.radio=(world.radio+1)%3;world.toast=['PULSE LEDGER 98.3','LOWWATER 91.6','SPLICE FM 104.8'][world.radio]}
