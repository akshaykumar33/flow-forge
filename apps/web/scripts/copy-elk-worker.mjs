// Copies ELK's worker script into public/ so the static app can start it as a real Web Worker
// (ADR-0008), with ELK's licence notice beside it (EPL-2.0 or GPL-3.0, risk R6).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const elkDir = dirname(require.resolve('elkjs/package.json'));
const pkg = JSON.parse(readFileSync(join(elkDir, 'package.json'), 'utf8'));
const out = new URL('../public/vendor/elk/', import.meta.url);
mkdirSync(out, { recursive: true });
copyFileSync(join(elkDir, 'lib', 'elk-worker.min.js'), new URL('elk-worker.min.js', out));
writeFileSync(
  new URL('NOTICE.txt', out),
  `elk-worker.min.js is from elkjs ${pkg.version} (${pkg.homepage ?? 'https://github.com/kieler/elkjs'}),\n` +
    `licensed ${pkg.license}. Source: https://github.com/kieler/elkjs and https://github.com/eclipse/elk\n` +
    'It is redistributed unmodified.\n',
);
console.log(`copied elkjs ${pkg.version} worker to public/vendor/elk/`);
