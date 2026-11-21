import { readFile, mkdir, stat, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { openChromium } from './browser.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const base = option('--base', 'http://127.0.0.1:8080');
const output = option('--output', 'screenshots');
const shots = JSON.parse(await readFile(option('--shots', 'shots.json'), 'utf8'));
const initialQuality = Number(option('--quality', '84'));
const renderQuality = option('--render-quality', 'high');
async function sourceInventory(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await sourceInventory(path));
    else files.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
const source = {
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTree: true,
  gameTreeSha256: createHash('sha256').update(JSON.stringify(await sourceInventory('game'))).digest('hex'),
};
await mkdir(output, { recursive: true });
await mkdir('verification', { recursive: true });
const browser = await openChromium();
const errors = [], requests = [], records = [];
browser.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails));
browser.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') errors.push(e.args); });
browser.on('Network.loadingFailed', e => errors.push({ network: e.errorText }));
browser.on('Network.responseReceived', e => { if (e.response.status >= 400) errors.push({ status: e.response.status, url: e.response.url }); });
browser.on('Network.requestWillBeSent', e => { if (/^https?:/.test(e.request.url)) requests.push(e.request.url); });
try {
  const version = await browser.send('Browser.getVersion');
  for (const shot of shots) {
    if (!/^[\w-]+\.jpg$/.test(shot.name)) throw new Error(`Unsafe screenshot name: ${shot.name}`);
    const url = new URL(shot.query, base).href;
    await browser.send('Page.navigate', { url });
    await browser.waitFor('window.__shotReady || window.__renderFailed');
    if (await browser.evaluate('!!window.__renderFailed')) throw new Error('Renderer failed');
    if (await browser.evaluate('window.__rooktide.snapshot().renderer.quality') !== renderQuality) {
      // Exercise the ordinary pause-menu control; no screenshot-only renderer.
      await browser.evaluate('document.getElementById("help-button").click()');
      // DOM activation avoids opening an audio context in passive captures.
      await browser.evaluate(`document.querySelector('#pause [data-view=settings]').click();
        document.getElementById('quality-button').click(); document.querySelector('#settings-screen [data-back]').click();
        document.getElementById('resume-button').click()`);
    }
    const fonts = await browser.evaluate(`Promise.all([
      '400 42px Anton', '400 14px Barlow', '600 14px Barlow',
      '600 14px "Barlow Condensed"', '700 72px "Barlow Condensed"',
    ].map(spec => document.fonts.load(spec).then(faces => faces.length > 0)))`);
    if (fonts.some(loaded => !loaded)) throw new Error('A local HUD font failed to load');
    await browser.evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))))');
    const path = join(output, shot.name);
    let quality = initialQuality;
    for (const candidate of [initialQuality, 80, 76]) {
      quality = candidate;
      await browser.screenshot(path, 'jpeg', quality);
      if ((await stat(path)).size <= 245760) break;
    }
    const bytes = await readFile(path);
    if (bytes.length > 262144) throw new Error(`Screenshot exceeds cap: ${path}`);
    const state = await browser.evaluate('window.__rooktide.snapshot()');
    const viewport = await browser.evaluate('[innerWidth, innerHeight]');
    if (!state.frozen || state.paused || viewport[0] !== 1280 || viewport[1] !== 720 || state.renderer.quality !== renderQuality) {
      throw new Error(`Capture is not a settled full-resolution game view: ${path}`);
    }
    records.push({ path, url, seed: 20261121, tick: state.tick, width: 1280, height: 720,
      quality, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), state });
    console.log(`${path}: ${bytes.length} bytes; ${state.district}; tick ${state.tick}; ${state.renderer.calls} calls / ${state.renderer.triangles} triangles`);
  }
  const external = requests.filter(url => new URL(url).origin !== new URL(base).origin);
  if (errors.length || external.length) throw new Error(JSON.stringify({ errors, external }));
  // Remove obsolete starter captures only after every replacement has succeeded.
  for (const file of await readdir(output)) {
    if (/\.(jpe?g|png)$/i.test(file) && !shots.some(shot => shot.name === file)) await unlink(join(output, file));
  }
  await writeFile('verification/captures.json', JSON.stringify({ browser: version.product, source, errors, external, localFontFaces: 5, records }, null, 2) + '\n');
} finally { await browser.close(); }
