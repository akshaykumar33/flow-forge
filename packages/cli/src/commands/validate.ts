import { hasErrors } from '@flowforge/core';
import { formatDiagnostic, json } from '../format.js';
import { EXIT, loadDiagram, type CliIo } from '../io.js';
import type { GlobalOptions } from '../options.js';

export async function validate(io: CliIo, file: string, options: GlobalOptions): Promise<number> {
  const loaded = await loadDiagram(io, file);
  const valid = loaded.model !== undefined && !hasErrors(loaded.diagnostics);

  if (options.json) {
    io.stdout(json({ file: loaded.name, valid, diagnostics: loaded.diagnostics }));
  } else {
    for (const d of loaded.diagnostics) {
      if (d.severity === 'error' || !options.quiet) io.stderr(formatDiagnostic(loaded.name, d));
    }
    if (valid && !options.quiet) io.stdout(`${loaded.name}: valid\n`);
  }
  return valid ? EXIT.ok : EXIT.failed;
}
