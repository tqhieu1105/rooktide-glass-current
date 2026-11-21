import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openChromium } from './browser.mjs';

const base = process.env.GAME_URL || 'http://127.0.0.1:8080';
const [output, ...flags] = process.argv.slice(2);
const browser = await openChromium();
const snapshot = () => browser.evaluate('window.__rooktide.snapshot()');
async function load(query) {
  await browser.send('Page.navigate', { url: base + '/' + query });
  await browser.waitFor('window.__gameReady || window.__renderFailed');
  assert.ok(!await browser.evaluate('!!window.__renderFailed'));
}
async function measure(seconds) {
  return browser.evaluate(`new Promise(resolve => {
    const samples = [];
    let start, previous;
    function tick(now) {
      start ??= now;
      if (previous !== undefined && now - start > 1200) samples.push(now - previous);
      previous = now;
      if (now - start < ${seconds * 1000 + 1200}) requestAnimationFrame(tick);
      else {
        samples.sort((a, b) => a - b);
        const at = p => +samples[Math.floor((samples.length - 1) * p)].toFixed(2);
        resolve({ samples: samples.length, medianMs: at(.5), p95Ms: at(.95),
          meanMs: +(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2) });
      }
    }
    requestAnimationFrame(tick);
  })`);
}

try {
  const { product: chromium } = await browser.send('Browser.getVersion');
  await load('');
  const market = { ...await measure(8), renderer: (await snapshot()).renderer };
  let profile;
  if (flags.includes('--profile')) {
    await browser.send('Profiler.enable');
    await browser.send('Profiler.start');
    await measure(6);
    const { profile: cpu } = await browser.send('Profiler.stop');
    const total = cpu.timeDeltas.reduce((a, b) => a + b, 0);
    const weights = new Map();
    for (let i = 0; i < cpu.samples.length; i++) {
      const id = cpu.samples[i];
      weights.set(id, (weights.get(id) || 0) + cpu.timeDeltas[i]);
    }
    profile = cpu.nodes.map(({ id, callFrame }) => ({ function: callFrame.functionName || '(anonymous)',
      file: callFrame.url.split('/').at(-1), percent: +((weights.get(id) || 0) / total * 100).toFixed(2) }))
      .sort((a, b) => b.percent - a.percent).slice(0, 18);
    await browser.evaluate('document.getElementById("quality-button").click()');
    market.high = { ...await measure(6), renderer: (await snapshot()).renderer };
  }
  await load('?shot=chase&seed=20261121');
  await browser.key('KeyW');
  const drivingTiming = await measure(8);
  await browser.key('KeyW', false);
  const end = await snapshot();
  assert.ok(!end.frozen && end.car.speed > 10, 'Chase checkpoint resumed into a live drive');
  const drive = { ...drivingTiming, renderer: end.renderer, endTick: end.tick };
  const result = { chromium, viewport: [1280, 720], market, drive, ...(profile ? { profile } : {}) };
  if (output) await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
