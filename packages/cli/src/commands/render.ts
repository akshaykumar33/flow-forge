import { resolve } from 'node:path';
import { checkReadability, layoutModel } from '@flowforge/layout';
import { renderSvg, themes, type ThemeId } from '@flowforge/renderer';
import { formatDiagnostic, json } from '../format.js';
import { CliError, EXIT, loadDiagram, type CliIo } from '../io.js';
import type { GlobalOptions } from '../options.js';

export interface RenderOptions extends GlobalOptions {
  format: string;
  theme?: string | undefined;
  /** PNG pixel density relative to the SVG's CSS pixels. */
  scale?: string | undefined;
  output?: string | undefined;
  force: boolean;
}

/**
 * Lays out and renders a diagram to SVG or PNG. The file is written even when readability checks
 * find errors, so the problem can be seen, but the exit code is then 1.
 */
export async function render(io: CliIo, file: string, options: RenderOptions): Promise<number> {
  if (options.format !== 'svg' && options.format !== 'png') {
    throw new CliError(
      `--format must be "svg" or "png" for render, got "${options.format}".`,
      EXIT.usage,
    );
  }
  if (options.format === 'png' && options.output === undefined) {
    throw new CliError('PNG output is binary: pass -o <file.png>.', EXIT.usage);
  }
  const scale = Number(options.scale ?? '2');
  if (!(scale >= 0.25 && scale <= 8)) {
    throw new CliError(
      `--scale must be a number from 0.25 to 8, got "${options.scale}".`,
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
      const target = resolve(io.cwd, options.output);
      if (options.format === 'png') await io.writeBytes(target, await svgToPng(svg, scale));
      else await io.writeText(target, svg);
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

/**
 * Generic-family fonts per OS. resvg does not walk a font-family list like browsers do: when the
 * first family is missing it jumps to its generic fallback, which can be a condensed face, so the
 * generics are pointed at each platform's standard UI and code fonts.
 */
const FALLBACK_FONTS: Record<string, { sans: string; mono: string }> = {
  win32: { sans: 'Segoe UI', mono: 'Consolas' },
  darwin: { sans: 'Helvetica Neue', mono: 'Menlo' },
};
const LINUX_FONTS = { sans: 'DejaVu Sans', mono: 'DejaVu Sans Mono' };

/**
 * Rasterises with resvg, loaded on demand so SVG-only runs never load the native module. Only
 * system fonts are used; nothing is fetched from the network.
 */
async function svgToPng(svg: string, scale: number): Promise<Uint8Array> {
  const { Resvg } = await import('@resvg/resvg-js');
  const fonts = FALLBACK_FONTS[process.platform] ?? LINUX_FONTS;
  return new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: fonts.sans,
      sansSerifFamily: fonts.sans,
      monospaceFamily: fonts.mono,
    },
  })
    .render()
    .asPng();
}
