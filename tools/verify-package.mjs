import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-game.ts';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function inventory(root, prefix = '') {
  return readdirSync(join(root, prefix)).sort().flatMap(name => {
    const path = join(prefix, name), full = join(root, path);
    return statSync(full).isDirectory() ? inventory(root, path)
      : [{ path, bytes: statSync(full).size, sha256: sha256(readFileSync(full)) }];
  });
}
function dimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'Native JPEG capture');
  let offset = 2;
  while (offset < bytes.length) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1], length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    offset += 2 + length;
  }
  throw new Error('Missing JPEG frame dimensions');
}
const kitHash = sha256(readFileSync('vendor/makefun-game.ts'));
const engineHash = sha256(readFileSync('game/vendor/three.module.min.js'));
assert.equal(kitHash, 'dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129');
assert.equal(engineHash, '3e690ac7d180b0aadf0891bea39eec643e29e2d3e75c99b18689518665f69ba6');
const runs = [];
for (let run = 1; run <= 2; run++) {
  const start = performance.now();
  const result = spawnSync(process.execPath, ['main.ts'], { env: { ...process.env, MAKEFUN_OUTPUT_DIR: 'out' }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Package failed: ${result.stderr}`);
  const files = inventory('out');
  runs.push({ run, milliseconds: Math.round(performance.now() - start), files });
  console.log(`MAKEFUN_OUTPUT_DIR=out node main.ts — run ${run}: ${runs.at(-1).milliseconds} ms`);
}
assert.deepEqual(runs[0].files, runs[1].files, 'Both complete output trees are byte-identical');
const caps = { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 };
const dossierBytes = readFileSync('out/dossier.json');
assert.ok(dossierBytes.equals(Buffer.from(buildDossier('out', caps))), 'Dossier bytes are exactly the unchanged kit output');
const dossier = JSON.parse(dossierBytes.toString('utf8'));
const manifest = JSON.parse(readFileSync('shots.json', 'utf8'));
const images = readdirSync('out/screenshots').sort();
assert.deepEqual(images, manifest.map(shot => shot.name).sort(), 'No starter or stale screenshot survives packaging');
assert.equal(images.length, 3);
const screenshots = images.map(name => {
  const bytes = readFileSync(join('out/screenshots', name));
  const size = dimensions(bytes);
  assert.ok(bytes.length <= 262144);
  assert.ok(Math.max(size.width, size.height) <= 1280 && Math.min(size.width, size.height) >= 480);
  return { name, ...size, bytes: bytes.length, sha256: sha256(bytes) };
});
const gameFiles = runs[1].files.filter(file => file.path.startsWith('game/'));
const gameBytes = gameFiles.reduce((n, file) => n + file.bytes, 0);
assert.ok(gameFiles.length <= caps.game_max_files && gameBytes <= caps.game_max_bytes, 'Game stays under both packaging caps');
const report = { deterministic: true, runs: runs.map(({ files, ...run }) => run),
  outputTreeSha256: sha256(JSON.stringify(runs[1].files)), dossierSha256: sha256(dossierBytes),
  dossierSchema: dossier.schema, kitLibrarySha256: kitHash, thirdPartyThreeSha256: engineHash,
  gameFiles: gameFiles.length, gameBytes, screenshots,
  files: runs[1].files };
mkdirSync('verification', { recursive: true });
writeFileSync('verification/package.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, files: undefined }, null, 2));
