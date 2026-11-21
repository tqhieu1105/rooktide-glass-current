import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Minimal CDP transport using Node 22's built-in WebSocket: no npm or network install.
export async function openChromium({ width = 1280, height = 720, headed = false } = {}) {
  const profile = await mkdtemp(join(tmpdir(), 'rooktide-chromium-'));
  let port;
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--no-first-run',
    '--no-default-browser-check', '--disable-component-update', '--disable-sync', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--remote-allow-origins=*', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank'];
  if (!headed) args.unshift('--headless=new');
  const process = spawn('/usr/bin/chromium', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  process.stderr.on('data', data => { stderr = (stderr + data).slice(-8000); });
  process.on('error', error => { stderr += error.message; });
  let target;
  for (let i = 0; i < 100; i++) {
    try {
      port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = pages.find(p => p.type === 'page'); if (target) break;
    } catch {}
    if (process.exitCode !== null) throw new Error(`Chromium exited: ${stderr}`);
    await delay(100);
  }
  if (!target) { process.kill('SIGTERM'); throw new Error(`No Chromium target: ${stderr}`); }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let serial = 0;
  const pending = new Map(), listeners = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id); if (!request) return;
      pending.delete(message.id); clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
    } else for (const handler of listeners.get(message.method) || []) handler(message.params);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
  }
  function on(method, handler) { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(handler); }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function waitFor(expression, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Page readiness timeout: ${expression}`);
  }
  async function key(code, down = true) {
    const virtual = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyC: 67, KeyR: 82, KeyM: 77, KeyV: 86,
      Digit1: 49, Digit2: 50,
      Tab: 9,
      Escape: 27, Space: 32, ShiftLeft: 16, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 }[code];
    const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code === 'ShiftLeft' ? 'Shift' : code;
    await send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual });
  }
  async function tap(code) { await key(code); await delay(180); await key(code, false); await delay(180); }
  async function click(selector) {
    const [x, y] = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return [b.left+b.width/2,b.top+b.height/2]; })()`);
    const point = { x, y, button: 'left', clickCount: 1 };
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point });
  }
  async function startNewGame() {
    await click('#new-game');
    if (await evaluate('!document.getElementById("new-confirm").hidden')) await click('#confirm-new');
    await waitFor('window.__rooktide.snapshot().menu === null');
    await waitFor('window.__rooktide.snapshot().streaming.settled');
  }
  async function screenshot(path, format = 'png', quality = 84) {
    const shot = await send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality } : {}), captureBeyondViewport: false, fromSurface: true });
    await writeFile(path, Buffer.from(shot.data, 'base64')); return path;
  }
  async function close() {
    socket.close();
    for (const { timer } of pending.values()) clearTimeout(timer);
    process.kill('SIGTERM');
    await new Promise(resolve => { if (process.exitCode !== null) resolve(); else { process.once('exit', resolve); setTimeout(resolve, 3000); } });
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  }
  return { send, on, evaluate, waitFor, key, tap, click, startNewGame, screenshot, close };
}
