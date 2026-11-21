import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { openChromium } from './browser.mjs';

// Review evidence only; the original JPEGs remain the only packaged captures.
const baseline = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${process.argv[2] || '388460f'}^{commit}`], { encoding: 'utf8' }).trim();
const shots = JSON.parse(await readFile('shots.json', 'utf8'));
const dataURL = bytes => `data:image/jpeg;base64,${bytes.toString('base64')}`;
const before = shots.map(({ name }) => dataURL(execFileSync('git', ['show', `${baseline}:screenshots/${name}`])));
const after = await Promise.all(shots.map(async ({ name }) => dataURL(await readFile(`screenshots/${name}`))));
const labels = [baseline.slice(0, 7), 'Current captures'];
const paired = (description, column) => [before, after].map((images, i) =>
  `<section><header>${labels[i]} · ${description}</header>${column(images)}</section>`).join('');
const img = (src, width, height) => `<img src="${src}" width="${width}" height="${height}">`;
const formats = [
  { name: 'thumbnails', width: 648, height: 580,
    html: paired('320×180', images => `<div class="thumbs">${images.map(src => img(src, 320, 180)).join('')}</div>`) },
  { name: 'contact-sheet', width: 1544, height: 680,
    html: paired('768 px contact sheet', ([cover, market, bridge]) => img(cover, 768, 432)
      + `<div class="strip">${img(market, 382, 215)}${img(bridge, 382, 215)}</div>`) },
];
const styles = `body{margin:0;background:#10181c;color:#f5e9c9;font:14px sans-serif;display:grid;grid-auto-flow:column;justify-content:start;gap:8px}
  header{height:24px;display:grid;place-content:center}img{display:block;object-fit:contain}
  .thumbs{display:grid;gap:8px}.strip{display:flex;gap:4px;margin-top:8px}`;

await mkdir('verification', { recursive: true });
const browser = await openChromium();
try {
  const { frameTree } = await browser.send('Page.getFrameTree');
  for (const { name, width, height, html } of formats) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: `<!doctype html><meta charset="utf-8"><style>${styles}</style>${html}` });
    await browser.evaluate('Promise.all(Array.from(document.images, img => img.decode())).then(() => true)');
    console.log(await browser.screenshot(`verification/${baseline.slice(0, 7)}-vs-current-${name}.png`));
  }
} finally { await browser.close(); }
