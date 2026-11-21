export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const used = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyE', 'KeyC', 'KeyR', 'KeyM', 'ShiftLeft', 'ShiftRight', 'Space', 'Escape']);
  let drag = false, orbitX = 0, orbitY = 0, zoom = 0;
  function clearHeldInputs() { held.clear(); pressed.clear(); drag = false; }
  window.addEventListener('keydown', e => {
    if (!used.has(e.code)) return;
    e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', e => held.delete(e.code));
  window.addEventListener('blur', clearHeldInputs);
  canvas.addEventListener('pointerdown', e => { drag = true; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = false; });
  canvas.addEventListener('lostpointercapture', () => { drag = false; });
  canvas.addEventListener('pointermove', e => { if (drag) { orbitX += e.movementX; orbitY += e.movementY; } });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  const value = {};
  return {
    readPlayerActions() {
      value.forward = Number(held.has('KeyW') || held.has('ArrowUp')) - Number(held.has('KeyS') || held.has('ArrowDown'));
      value.right = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft'));
      value.sprint = held.has('ShiftLeft') || held.has('ShiftRight'); value.handbrake = held.has('Space');
      value.interact = pressed.has('KeyE'); value.camera = pressed.has('KeyC'); value.pause = pressed.has('Escape');
      value.recover = pressed.has('KeyR'); value.map = pressed.has('KeyM');
      value.orbitX = orbitX; value.orbitY = orbitY; value.zoom = zoom;
      pressed.clear(); orbitX = 0; orbitY = 0; zoom = 0;
      return value;
    }, clearHeldInputs,
  };
}
