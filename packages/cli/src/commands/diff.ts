import { diffModels, type Change } from '@flowforge/transforms';
import { formatDiagnostic, json } from '../format.js';
import { EXIT, loadDiagram, type CliIo } from '../io.js';
import type { GlobalOptions } from '../options.js';

/** Exit 0 when the diagrams are equivalent, 1 when they differ, like `diff(1)`. */
export async function diff(
  io: CliIo,
  fileA: string,
  fileB: string,
  options: GlobalOptions,
): Promise<number> {
  if (fileA === '-' && fileB === '-') {
    io.stderr('Only one input can be read from stdin.\n');
    return EXIT.usage;
  }
  const [a, b] = [await loadDiagram(io, fileA), await loadDiagram(io, fileB)];
  let failed = false;
  for (const loaded of [a, b]) {
    for (const d of loaded.diagnostics) {
      if (d.severity === 'error' || !options.quiet) io.stderr(formatDiagnostic(loaded.name, d));
    }
    if (!loaded.model) failed = true;
  }
  if (failed || !a.model || !b.model) return EXIT.failed;

  const changes = diffModels(a.model, b.model);
  if (options.json) {
    io.stdout(json({ from: a.name, to: b.name, changes }));
  } else if (changes.length === 0) {
    if (!options.quiet) io.stdout('No differences.\n');
  } else {
    io.stdout(changes.map(describe).join(''));
  }
  return changes.length === 0 ? EXIT.ok : EXIT.failed;
}

function describe(change: Change): string {
  const target = change.kind === 'diagram' ? 'diagram' : `${change.kind} ${change.id}`;
  switch (change.type) {
    case 'added':
      return `+ ${target}\n`;
    case 'removed':
      return `- ${target}\n`;
    case 'modified':
      return `~ ${target}.${change.field}: ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}\n`;
  }
}
