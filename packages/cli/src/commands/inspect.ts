import { serializeModel } from '@flowforge/core';
import { formatDiagnostic } from '../format.js';
import { EXIT, loadDiagram, type CliIo } from '../io.js';
import type { GlobalOptions } from '../options.js';

export async function inspect(io: CliIo, file: string, options: GlobalOptions): Promise<number> {
  const loaded = await loadDiagram(io, file);
  for (const d of loaded.diagnostics) {
    if (d.severity === 'error' || !options.quiet) io.stderr(formatDiagnostic(loaded.name, d));
  }
  const model = loaded.model;
  if (!model) return EXIT.failed;

  if (options.json) {
    io.stdout(serializeModel(model));
    return EXIT.ok;
  }

  const groupLabel = new Map(model.groups.map((g) => [g.id, g.label]));
  const lines = [
    `${loaded.name}`,
    `  type       ${model.diagramType} (${model.direction})`,
    `  nodes      ${model.nodes.length}`,
    `  edges      ${model.edges.length}`,
    `  groups     ${model.groups.length}`,
    '',
    'Nodes',
    ...model.nodes.map((n) => {
      const group = n.groupId ? `  in ${groupLabel.get(n.groupId) ?? n.groupId}` : '';
      return `  ${n.id.padEnd(16)} ${n.shape.padEnd(18)} ${JSON.stringify(n.label)}${group}`;
    }),
  ];
  if (options.verbose) {
    lines.push(
      '',
      'Edges',
      ...model.edges.map((e) => {
        const label = e.label ? ` ${JSON.stringify(e.label)}` : '';
        return `  ${e.id.padEnd(16)} ${e.source} -> ${e.target} (${e.stroke})${label}`;
      }),
    );
  }
  io.stdout(lines.join('\n') + '\n');
  return EXIT.ok;
}
