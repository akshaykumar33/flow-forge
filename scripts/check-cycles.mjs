// Fails when workspace packages depend on each other in a cycle, or when a library package
// depends on an app-level package (see docs/architecture/SYSTEM_ARCHITECTURE.md).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN_TARGETS = new Set(['@flowforge/react', '@flowforge/cli']);
const packages = new Map();
for (const root of ['packages', 'apps']) {
  if (!existsSync(root)) continue;
  for (const dir of readdirSync(root)) {
    const file = join(root, dir, 'package.json');
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    const deps = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    });
    packages.set(pkg.name, { root, deps: deps.filter((d) => d.startsWith('@flowforge/')) });
  }
}

const problems = [];
for (const [name, { root, deps }] of packages) {
  for (const dep of deps) {
    if (root === 'packages' && FORBIDDEN_TARGETS.has(dep) && name !== '@flowforge/cli') {
      problems.push(`${name} must not depend on ${dep}`);
    }
  }
}

const state = new Map();
function visit(name, path) {
  if (state.get(name) === 'done') return;
  if (state.get(name) === 'active') {
    problems.push(`cycle: ${[...path.slice(path.indexOf(name)), name].join(' -> ')}`);
    return;
  }
  state.set(name, 'active');
  for (const dep of packages.get(name)?.deps ?? []) visit(dep, [...path, name]);
  state.set(name, 'done');
}
for (const name of packages.keys()) visit(name, []);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`No dependency cycles across ${packages.size} workspace packages.`);
