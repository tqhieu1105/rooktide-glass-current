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
  return {
    readPlayerActions() {
      const value = {
        forward: Number(held.has('KeyW') || held.has('ArrowUp')) - Number(held.has('KeyS') || held.has('ArrowDown')),
        right: Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft')),
        sprint: held.has('ShiftLeft') || held.has('ShiftRight'), handbrake: held.has('Space'),
        interact: pressed.has('KeyE'), camera: pressed.has('KeyC'), pause: pressed.has('Escape'),
        recover: pressed.has('KeyR'), map: pressed.has('KeyM'), orbitX, orbitY, zoom,
      };
      pressed.clear(); orbitX = 0; orbitY = 0; zoom = 0;
      return value;
    }, clearHeldInputs,
  };
}
