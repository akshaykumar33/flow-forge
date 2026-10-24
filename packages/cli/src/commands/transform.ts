import { resolve } from 'node:path';
import { serializeModel, type GraphModel } from '@flowforge/core';
import { toMermaid } from '@flowforge/parser';
import {
  namingTransform,
  runTransform,
  tidyLabelsTransform,
  type Change,
  type LabelCase,
  type NamingProfile,
} from '@flowforge/transforms';
import { formatDiagnostic, json } from '../format.js';
import { CliError, EXIT, loadDiagram, type CliIo } from '../io.js';
import type { GlobalOptions } from '../options.js';

export interface TransformOptions extends GlobalOptions {
  tidy: boolean;
  template?: string | undefined;
  case?: string | undefined;
  prefix?: string | undefined;
  suffix?: string | undefined;
  env?: string | undefined;
  region?: string | undefined;
  group?: string[] | undefined;
  format: string;
  output?: string | undefined;
  force: boolean;
}

const CASES: readonly LabelCase[] = ['preserve', 'kebab', 'snake', 'title', 'upper'];

export async function transform(
  io: CliIo,
  file: string,
  options: TransformOptions,
): Promise<number> {
  if (options.format !== 'mermaid' && options.format !== 'json') {
    throw new CliError(
      `--format must be "mermaid" or "json", got "${options.format}".`,
      EXIT.usage,
    );
  }
  if (options.case !== undefined && !CASES.includes(options.case as LabelCase)) {
    throw new CliError(
      `--case must be one of ${CASES.join(', ')}; got "${options.case}".`,
      EXIT.usage,
    );
  }
  if (!options.tidy && options.template === undefined) {
    throw new CliError('Nothing to do: pass --tidy and/or --template.', EXIT.usage);
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

  let model: GraphModel = loaded.model;
  const changes: Change[] = [];
  const steps: [string, () => ReturnType<typeof runTransform>][] = [];
  if (options.tidy)
    steps.push(['tidy-labels', () => runTransform(tidyLabelsTransform, model, undefined)]);
  if (options.template !== undefined) {
    const profile: NamingProfile = {
      template: options.template,
      ...(options.case !== undefined && { case: options.case as LabelCase }),
      ...(options.prefix !== undefined && { prefix: options.prefix }),
      ...(options.suffix !== undefined && { suffix: options.suffix }),
      ...(options.env !== undefined && { env: options.env }),
      ...(options.region !== undefined && { region: options.region }),
      ...(options.group !== undefined && { groupIds: options.group }),
    };
    steps.push(['naming', () => runTransform(namingTransform, model, profile)]);
  }

  for (const [, step] of steps) {
    const result = step();
    if (!result.ok) {
      result.diagnostics.forEach(report);
      return EXIT.failed;
    }
    result.diagnostics.forEach(report);
    model = result.model;
    changes.push(...result.changes);
  }

  let output: string;
  if (options.format === 'json') {
    output = serializeModel(model);
  } else {
    const emitted = toMermaid(model);
    if (!emitted.ok) {
      emitted.diagnostics.forEach(report);
      return EXIT.failed;
    }
    // Rename bookkeeping (original-label) is expected to be lost in Mermaid; say so once.
    emitted.losses.filter((l) => l.code !== 'emit-inferences-dropped').forEach(report);
    if (emitted.losses.some((l) => l.code === 'emit-inferences-dropped') && !options.quiet) {
      io.stderr(
        `${loaded.name}: info: node metadata (such as original labels) is not stored in Mermaid; use --format json to keep it.\n`,
      );
    }
    output = emitted.source;
  }

  if (options.output !== undefined) {
    try {
      await io.writeText(resolve(io.cwd, options.output), output);
    } catch (error) {
      throw new CliError(`Cannot write ${options.output}: ${String(error)}.`, EXIT.io);
    }
  } else {
    io.stdout(output);
  }

  if (options.json) {
    io.stderr(json({ changes }));
  } else if (!options.quiet) {
    const elements = new Set(changes.map((c) => `${c.kind}:${c.id}`)).size;
    io.stderr(`${loaded.name}: ${elements} element(s) changed\n`);
    if (options.verbose) {
      for (const c of changes) {
        if (c.type === 'modified') {
          io.stderr(
            `  ${c.kind} ${c.id}.${c.field}: ${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}\n`,
          );
        }
      }
    }
  }
  return EXIT.ok;
}
