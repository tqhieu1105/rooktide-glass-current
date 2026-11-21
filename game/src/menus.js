import { CONTACTS, MISSIONS } from './mission-data.js';
import { AUDIO_DEFAULTS, STATIONS } from './radio.js';

const $ = id => document.getElementById(id);
const PREFS = 'rooktide-preferences-1';
const SESSION_ONLY = 'Browser storage is unavailable. Progress will only last for this session.';

export function loadPreferences(storage, quality) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(PREFS)); } catch {}
  const settings = { ...AUDIO_DEFAULTS, quality };
  for (const key of ['master', 'engine', 'radio']) {
    if (Number.isInteger(saved?.[key]) && saved[key] >= 0 && saved[key] <= 100) settings[key] = saved[key];
  }
  if (Number.isInteger(saved?.station) && STATIONS[saved.station]) settings.station = saved.station;
  if (typeof saved?.muted === 'boolean') settings.muted = saved.muted;
  if (['high', 'low'].includes(saved?.quality)) settings.quality = saved.quality;
  return settings;
}

export function createMenus({ canvas, input, missions, settings, storage, capture, actions }) {
  const dialog = $('game-menu'), hud = $('hud');
  const screens = new Map([...dialog.querySelectorAll('[data-screen]')].map(panel => [panel.dataset.screen, panel]));
  const replay = $('mission-replay'), station = $('radio-station');
  let current = null, root = null;
  for (const job of MISSIONS) replay.add(new Option(job.title, job.id));
  STATIONS.forEach((entry, i) => station.add(new Option(entry.name, i)));

  function show(screen, origin = screen) {
    input.clearHeldInputs();
    actions.freeze();
    current = screen; root = origin;
    dialog.classList.toggle('title-layout', origin === 'title');
    hud.hidden = true;
    for (const [name, panel] of screens) panel.hidden = name !== screen;
    const panel = screens.get(screen);
    dialog.setAttribute('aria-labelledby', panel.querySelector('h2').id);
    if (!dialog.open) dialog.showModal();
    (panel.querySelector('.primary:not([hidden])') || panel.querySelector('button')).focus({ preventScroll: true });
  }

  function resume() {
    current = root = null;
    for (const panel of screens.values()) panel.hidden = true;
    input.clearHeldInputs(); actions.freeze();
    dialog.close(); hud.hidden = false;
    canvas.focus({ preventScroll: true });
  }

  function title() {
    const save = missions.saveStatus();
    $('continue-button').hidden = !save.valid;
    $('title-note').textContent = save.valid ? `${missions.snapshot().done} / ${MISSIONS.length} JOBS CLEARED · ${save.blocked ? 'SESSION ONLY' : 'LOCAL SAVE'}`
      : save.invalid ? 'The old save could not be read. Start a new run to replace it.' : save.blocked ? SESSION_ONLY : 'SIX DISTRICTS · ONE BAD INFLUENCE';
    show('title');
  }

  function pause() {
    const job = missions.snapshot();
    $('pause-detail').textContent = job.active ? `${job.title} · Stage ${job.index + 1} of ${job.total}` : 'Free roam · The city can wait.';
    $('pause-retry').hidden = $('abandon-mission').hidden = !job.active;
    $('replay-row').hidden = job.active || job.done < MISSIONS.length;
    $('save-button').hidden = $('quit-button').hidden = capture;
    const last = missions.lastLine();
    $('last-transmission').hidden = !last;
    $('last-transmission').open = false;
    $('last-radio').textContent = last ? `${CONTACTS[last.contact].name}: ${last.line}` : '';
    $('save-note').textContent = !capture && missions.saveStatus().blocked ? SESSION_ONLY : '';
    show('pause');
  }

  function outcome({ heading, job, detail }) {
    $('outcome-label').textContent = job ? 'UNDERTOW RELAY / JOB FAILED' : 'UNDERTOW RELAY / ROADSIDE HELP';
    $('outcome-title').textContent = heading;
    $('outcome-job').hidden = !job;
    $('outcome-job').textContent = job || '';
    $('outcome-detail').textContent = detail;
    show('outcome');
  }

  function complete(job) {
    const { payout, ending } = job;
    $('completion-label').textContent = `UNDERTOW RELAY / ${ending ? 'PUBLIC RECORD' : payout.cash ? 'JOB COMPLETE' : 'REPLAY COMPLETE'}`;
    $('ending-title').textContent = ending ? 'Rooktide is listening.' : payout.title;
    $('completion-job').hidden = !ending;
    $('completion-job').textContent = payout.title;
    $('completion-reward').hidden = !payout.cash;
    $('completion-cash').textContent = `+$${payout.cash.toLocaleString('en-US')}`;
    $('completion-rp').textContent = `+${payout.rp} RP`;
    $('ending-detail').textContent = ending ? 'The ledger is on every radio in the city. The pause menu now has all six jobs ready for replay.'
      : payout.cash ? 'The crew paid up. The city still owes you a parking spot.' : 'Job replayed. First clear rewards have already been settled.';
    $('completion-progress').textContent = payout.cash ? `${job.done} / ${MISSIONS.length} JOBS CLEARED · ${missions.saveStatus().blocked ? 'SESSION ONLY' : 'PROGRESS SAVED'}` : '';
    show('complete');
  }

  function back() {
    if (current === 'pause') resume();
    else if (['confirm', 'controls', 'settings'].includes(current)) root === 'title' ? title() : pause();
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); back(); });
  dialog.addEventListener('click', event => {
    const { view } = event.target.dataset;
    if (view) { show(view, root); if (view === 'settings') $('settings-note').textContent = ''; }
    if (event.target.hasAttribute('data-back')) back();
  });
  const on = (id, handler) => $(id).addEventListener('click', handler);
  on('new-game', () => missions.saveStatus().valid ? show('confirm', 'title') : actions.start(true));
  on('confirm-new', () => actions.start(true));
  on('continue-button', () => actions.start(false));
  on('help-button', () => { if (!current) pause(); });
  on('resume-button', resume);
  on('pause-retry', () => actions.retry(false));
  on('retry-chase', () => actions.retry(false));
  on('return-yard', () => actions.retry(true));
  on('dismiss-ending', () => { missions.dismissEnding(); resume(); });
  on('abandon-mission', () => { missions.abandon(); resume(); });
  on('save-button', () => {
    $('save-note').textContent = missions.save() ? 'Progress saved. Continue resumes from a safe street.' : SESSION_ONLY;
    if (missions.active && !missions.saveStatus().blocked) $('save-note').textContent += ' Start the current job again at its contact.';
  });
  on('quit-button', actions.quit);
  replay.addEventListener('change', () => {
    if (missions.chooseReplay(replay.value)) resume();
    replay.selectedIndex = 0;
  });

  function savePreferences(report = true) {
    if (capture) return;
    try {
      if (!storage) throw new Error('No browser storage');
      storage.setItem(PREFS, JSON.stringify(settings));
      if (report) $('settings-note').textContent = 'Preferences saved.';
    } catch { if (report) $('settings-note').textContent = 'Preferences apply for this session.'; }
  }
  for (const channel of ['master', 'engine', 'radio']) {
    const slider = $(`volume-${channel}`), output = slider.nextElementSibling;
    slider.value = settings[channel]; output.value = `${settings[channel]}%`;
    slider.addEventListener('input', () => { settings[channel] = Number(slider.value); output.value = `${slider.value}%`; });
    slider.addEventListener('change', () => savePreferences());
  }
  $('mute-audio').checked = settings.muted;
  $('mute-audio').addEventListener('change', event => { settings.muted = event.target.checked; savePreferences(); });
  station.value = settings.station;
  station.addEventListener('change', () => { settings.station = Number(station.value); savePreferences(); });
  $('quality-button').textContent = `Quality: ${settings.quality}`;
  on('quality-button', () => {
    settings.quality = settings.quality === 'high' ? 'low' : 'high';
    actions.quality(settings.quality); $('quality-button').textContent = `Quality: ${settings.quality}`;
    savePreferences();
  });
  return { title, pause, resume, outcome, complete, get current() { return current; },
    get atTitle() { return root === 'title'; },
    tune() { settings.station = (settings.station + 1) % STATIONS.length; station.value = settings.station; savePreferences(false); } };
}
