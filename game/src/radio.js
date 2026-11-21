export const STATIONS = [
  { name: 'Pulse Ledger 98.3', track: 'Overdraft After Dark', beat: .48, notes: [45, 57, 60, 64, 43, 55, 59, 62], wave: 'triangle' },
  { name: 'Lowwater 91.6', track: 'Fish on the Guest List', beat: .72, notes: [43, 55, 58, 62, 41, 53, 57, 60], wave: 'sine' },
  { name: 'Splice FM 104.8', track: 'Parking Ticket Remix', beat: .40, notes: [40, 52, 55, 47, 38, 50, 55, 45], wave: 'square' },
  { name: 'Radio off', track: '', notes: [] },
];

export const AUDIO_DEFAULTS = { station: 0, master: 70, engine: 34, radio: 55, muted: false };

export function createCarAudio(settings) {
  let context, master, radio, motorGain, motor;
  let station = -1, step = 0, nextNote = 0;
  const voices = new Set();

  function wake() {
    if (!globalThis.AudioContext) return;
    if (!context) {
      context = new AudioContext();
      master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
      radio = context.createGain(); radio.connect(master);
      motorGain = context.createGain(); motorGain.gain.value = 0; motorGain.connect(master);
      motor = context.createOscillator(); motor.type = 'triangle'; motor.connect(motorGain); motor.start();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function silenceNotes() {
    for (const voice of voices) voice.stop();
    voices.clear();
    nextNote = 0; step = 0;
  }

  function note(midi, wave, at, length, volume) {
    const voice = context.createOscillator(), envelope = context.createGain();
    voice.type = wave; voice.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(.001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + .035);
    envelope.gain.exponentialRampToValueAtTime(.001, at + length);
    voice.connect(envelope); envelope.connect(radio);
    voices.add(voice);
    voice.onended = () => { voices.delete(voice); voice.disconnect(); envelope.disconnect(); };
    voice.start(at); voice.stop(at + length);
  }

  function update(driving, speed, throttle) {
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    const audible = driving && !settings.muted;
    master.gain.setTargetAtTime(audible ? settings.master / 100 : 0, now, .035);
    motorGain.gain.setTargetAtTime(audible ? .07 * settings.engine / 100 : 0, now, .06);
    motor.frequency.setTargetAtTime(41 + speed * 2.6 + Math.abs(throttle) * 14, now, .08);
    radio.gain.setTargetAtTime(settings.radio / 100, now, .04);
    if (!audible || station !== settings.station) {
      if (nextNote) silenceNotes();
      station = settings.station;
    }
    const current = STATIONS[station];
    if (!audible || !current.notes.length) return;
    if (!nextNote || nextNote < now) nextNote = now + .035;
    while (nextNote < now + .16) {
      const pitch = current.notes[step % current.notes.length];
      note(pitch, current.wave, nextNote, current.beat * .72, .13);
      if (step % 2 === 0) note(pitch - 12, 'sine', nextNote, current.beat * .8, .15);
      nextNote += current.beat / 2;
      step++;
    }
  }
  return { wake, update };
}
