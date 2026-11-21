import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openChromium } from './browser.mjs';

const base = process.env.GAME_URL || 'http://127.0.0.1:8080';
const output = process.argv[2];
const iterations = Math.max(1, Number(process.argv[3]) || 5);
const browser = await openChromium();

try {
  const { product: chromium } = await browser.send('Browser.getVersion');
  const runs = [];
  for (let i = 0; i < iterations; i++) {
    const started = performance.now();
    await browser.send('Page.navigate', { url: `${base}/?loadProbe=${i}` });
    await browser.waitFor('window.__gameReady || window.__renderFailed');
    assert.ok(!await browser.evaluate('!!window.__renderFailed'), `Run ${i + 1} rendered without a fatal error`);
    const page = await browser.evaluate(`(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const state = window.__rooktide.snapshot();
      return { readyMs: +performance.now().toFixed(2), responseEndMs: +nav.responseEnd.toFixed(2),
        domInteractiveMs: +nav.domInteractive.toFixed(2), buildings: state.world.buildings,
        loadedChunks: state.streaming?.loadedChunks ?? null,
        totalChunks: state.streaming?.totalChunks ?? null,
        activeDistricts: state.streaming?.activeDistricts ?? null,
        detailedChunks: state.streaming?.detailedChunks ?? null,
        lowDetailChunks: state.streaming?.lowDetailChunks ?? null,
        renderer: { geometries: state.renderer.geometries, textures: state.renderer.textures,
          calls: state.renderer.calls, triangles: state.renderer.triangles } };
    })()`);
    runs.push({ navigationWallMs: +(performance.now() - started).toFixed(2), ...page,
      initializationMs: +(page.readyMs - page.responseEndMs).toFixed(2) });
  }
  const sorted = runs.map(run => run.readyMs).sort((a, b) => a - b);
  const result = { chromium, viewport: [1280, 720], iterations, runs,
    medianReadyMs: sorted[Math.floor((sorted.length - 1) * 0.5)],
    medianInitializationMs: runs.map(run => run.initializationMs).sort((a, b) => a - b)[Math.floor((runs.length - 1) * 0.5)] };
  if (output) await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
