// Deterministic standard-library packaging for Rooktide's static Three.js game.
// Browser captures are made during development, never by this entrypoint.

import { cpSync, existsSync, mkdirSync, writeFileSync, rmSync, realpathSync, statSync } from 'node:fs';
import { join, resolve, sep, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
function canonicalPath(path: string): string {
  const absolute = resolve(path);
  return existsSync(absolute) ? realpathSync(absolute) : join(canonicalPath(dirname(absolute)), basename(absolute));
}
const source = canonicalPath(here);
const out = canonicalPath(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const contains = (parent: string, child: string) => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
if (contains(out, source) || ['game', 'screenshots', 'vendor', '.git', 'tools', 'verification'].some(name => contains(join(source, name), out))) {
  throw new Error('Output directory must not overlap source files or contain the repository.');
}
for (const name of ['game/index.html', 'game/src/main.js', 'game/vendor/three.module.min.js', 'game/vendor/LICENSE']) {
  if (!existsSync(join(source, name)) || !statSync(join(source, name)).isFile()) throw new Error(`Required game file missing: ${name}`);
}

mkdirSync(out, { recursive: true });
// Clean only our two generated subtrees, preserving unrelated output files.
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
