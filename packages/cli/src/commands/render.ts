import { resolve } from 'node:path';
import { checkReadability, layoutModel } from '@flowforge/layout';
import { renderSvg, themes, type ThemeId } from '@flowforge/renderer';
import { formatDiagnostic, json } from '../format.js';
import { CliError, EXIT, loadDiagram, type CliIo } from '../io.js';
import type { GlobalOptions } from '../options.js';

export interface RenderOptions extends GlobalOptions {
  format: string;
  theme?: string | undefined;
  output?: string | undefined;
  force: boolean;
}

/**
 * Lays out and renders a diagram to SVG. The SVG is written even when readability checks find
 * errors, so the problem can be seen, but the exit code is then 1.
 */
export async function render(io: CliIo, file: string, options: RenderOptions): Promise<number> {
  if (options.format !== 'svg') {
    throw new CliError(
      `--format must be "svg" for render, got "${options.format}". PNG export is not available yet.`,
      EXIT.usage,
    );
  }
  const themeIds = Object.keys(themes);
  const theme = options.theme ?? 'enterprise-light';
  if (!themeIds.includes(theme)) {
    throw new CliError(
      `--theme must be one of ${themeIds.join(', ')}; got "${theme}".`,
      EXIT.usage,
    );
  }
  if (options.output !== undefined && file !== '-' && !options.force) {
    if (resolve(io.cwd, options.output) === resolve(io.cwd, file)) {
      throw new CliError(
        'Refusing to overwrite the input file. Choose another --output, or pass --force.',
        EXIT.usage,
      );
    }
  }

  const loaded = await loadDiagram(io, file);
  const report = (d: Parameters<typeof formatDiagnostic>[1]) => {
    if (d.severity === 'error' || !options.quiet) io.stderr(formatDiagnostic(loaded.name, d));
  };
  loaded.diagnostics.forEach(report);
  if (!loaded.model) return EXIT.failed;

  const started = performance.now();
  const { layout, diagnostics: layoutNotes } = await layoutModel(loaded.model);
  const elapsed = performance.now() - started;
  const findings = [...layoutNotes, ...checkReadability(loaded.model, layout)];
  if (!options.json)
    findings.filter((d) => d.severity !== 'info' || options.verbose).forEach(report);

  const svg = renderSvg(loaded.model, layout, { theme: theme as ThemeId });
  if (options.output !== undefined) {
    try {
      await io.writeText(resolve(io.cwd, options.output), svg);
    } catch (error) {
      throw new CliError(`Cannot write ${options.output}: ${String(error)}.`, EXIT.io);
    }
  } else {
    io.stdout(svg);
  }

  if (options.json) {
    io.stderr(json({ width: layout.width, height: layout.height, diagnostics: findings }));
  } else if (options.verbose) {
    io.stderr(
      `${loaded.name}: laid out ${loaded.model.nodes.length} nodes in ${Math.round(elapsed)} ms, ${Math.ceil(layout.width)}×${Math.ceil(layout.height)} px\n`,
    );
  }
  return findings.some((d) => d.severity === 'error') ? EXIT.failed : EXIT.ok;
}
