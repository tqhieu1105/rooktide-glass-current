export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const weaponIds = [...document.querySelectorAll('#weapon-wheel [data-weapon]')].map(slot => Number(slot.dataset.weapon));
  const used = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyE', 'KeyC', 'KeyR', 'KeyM', 'KeyF', 'KeyQ', 'KeyV', 'Digit1', 'Digit2', 'Tab', 'ShiftLeft', 'ShiftRight', 'Space', 'Escape']);
  let drag = false, orbitX = 0, orbitY = 0, zoom = 0, wheelPick = 1, queuedWeapon = 0, equipped = 1, pointerX = innerWidth / 2, pointerY = innerHeight / 2;
  function clearHeldInputs() { held.clear(); pressed.clear(); drag = false; orbitX = orbitY = zoom = 0; queuedWeapon = 0; }
  function pickWheel(x, y) {
    const dx = x - innerWidth / 2, dy = y - innerHeight / 2;
    if (Math.hypot(dx, dy) < 35) return;
    // Each new weapon is another evenly spaced radial slot.
    const weapons = weaponIds, step = Math.PI * 2 / weapons.length;
    const angle = Math.atan2(dy, dx);
    const index = Math.round((angle + Math.PI / 2) / step + weapons.length) % weapons.length;
    wheelPick = weapons[index];
  }
  window.addEventListener('keydown', e => {
    if (!used.has(e.code) || e.target.closest?.('dialog') || (e.code === 'Space' && e.target instanceof HTMLButtonElement)) return;
    e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
    const keyWeapon = Number(e.code.slice(5));
    if (held.has('Tab')) {
      if (weaponIds.includes(keyWeapon)) wheelPick = keyWeapon;
      if (e.code === 'Tab') wheelPick = equipped;
    } else if (weaponIds.includes(keyWeapon)) queuedWeapon = keyWeapon;
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Tab' && held.has('Tab')) queuedWeapon = wheelPick;
    held.delete(e.code);
  });
  window.addEventListener('blur', clearHeldInputs);
  window.addEventListener('pointermove', e => {
    pointerX = e.clientX; pointerY = e.clientY;
    if (held.has('Tab')) pickWheel(pointerX, pointerY);
  });
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
      value.attack = held.has('KeyF'); value.scan = held.has('KeyQ');
      value.weapon = queuedWeapon || (held.has('Digit2') ? 2 : held.has('Digit1') ? 1 : 0);
      value.weaponWheelOpen = held.has('Tab'); value.weaponWheelPick = wheelPick;
      value.recover = pressed.has('KeyR'); value.map = pressed.has('KeyM'); value.radio = pressed.has('KeyV');
      value.orbitX = orbitX; value.orbitY = orbitY; value.zoom = zoom;
      pressed.clear(); orbitX = 0; orbitY = 0; zoom = 0;
      return value;
    }, clearHeldInputs,
    setWheelSelection(weapon) {
      equipped = weapon;
      if (queuedWeapon === weapon) queuedWeapon = 0;
      if (!held.has('Tab')) wheelPick = weapon;
    },
  };
}
