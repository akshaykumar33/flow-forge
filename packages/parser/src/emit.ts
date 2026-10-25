import type {
  ArrowHead,
  Diagnostic,
  GraphEdge,
  GraphGroup,
  GraphModel,
  NodeShape,
} from '@flowforge/core';

export type EmitResult =
  | {
      ok: true;
      source: string;
      /**
       * Information the Mermaid text cannot carry. Empty means parsing `source` gives back an
       * equivalent model.
       */
      losses: Diagnostic[];
    }
  | { ok: false; diagnostics: Diagnostic[] };

/** Ids Mermaid reads as plain node ids. Keywords are excluded because they open or end blocks. */
const SAFE_ID = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;
const RESERVED_IDS = new Set([
  'end',
  'subgraph',
  'graph',
  'flowchart',
  'direction',
  'style',
  'class',
  'classdef',
  'click',
  'linkstyle',
  'call',
  'href',
]);

const SHAPE_BRACKETS: Record<Exclude<NodeShape, 'unknown'>, [string, string]> = {
  rectangle: ['[', ']'],
  rounded: ['(', ')'],
  stadium: ['([', '])'],
  subroutine: ['[[', ']]'],
  cylinder: ['[(', ')]'],
  circle: ['((', '))'],
  'double-circle': ['(((', ')))'],
  asymmetric: ['>', ']'],
  diamond: ['{', '}'],
  hexagon: ['{{', '}}'],
  parallelogram: ['[/', '/]'],
  'parallelogram-alt': ['[\\', '\\]'],
  trapezoid: ['[/', '\\]'],
  'trapezoid-alt': ['[\\', '/]'],
};

const HEAD_START: Record<ArrowHead, string> = { none: '', arrow: '<', circle: 'o', cross: 'x' };
const HEAD_END: Record<ArrowHead, string> = { none: '', arrow: '>', circle: 'o', cross: 'x' };

/**
 * Writes a model as Mermaid flowchart source. Deterministic: the same model always gives the
 * same text. Node declarations come first in model order, so a re-parse keeps that order;
 * subgraphs then list their members; edges come last.
 */
export function toMermaid(model: GraphModel): EmitResult {
  const invalid = [...model.nodes, ...model.groups, ...model.edges]
    .map((element) => element.id)
    .filter((id) => !SAFE_ID.test(id) || RESERVED_IDS.has(id.toLowerCase()));
  if (invalid.length > 0) {
    return {
      ok: false,
      diagnostics: invalid.map((id) => ({
        severity: 'error',
        code: 'emit-invalid-id',
        message: `"${id}" cannot be written as a Mermaid id. Use letters, digits, "_" or "-", and avoid keywords such as "end".`,
        elementId: id,
      })),
    };
  }

  const losses: Diagnostic[] = [];
  const lines = [`flowchart ${model.direction}`];

  for (const node of model.nodes) {
    let shape = node.shape;
    if (shape === 'unknown') {
      shape = 'rectangle';
      losses.push(
        loss(
          'emit-shape-unknown',
          `Node "${node.id}" has no known shape; written as a rectangle.`,
          node.id,
        ),
      );
    }
    const [open, close] = SHAPE_BRACKETS[shape];
    lines.push(`  ${node.id}${open}"${escapeLabel(node.label)}"${close}`);
    if (node.inferences.length > 0) {
      const keys = node.inferences.map((i) => i.key).join(', ');
      losses.push(
        loss(
          'emit-inferences-dropped',
          `Node "${node.id}" metadata (${keys}) cannot be written to Mermaid; keep the JSON model to preserve it.`,
          node.id,
        ),
      );
    }
  }

  const childGroups = new Map<string | undefined, GraphGroup[]>();
  for (const group of model.groups) {
    childGroups.set(group.parentId, [...(childGroups.get(group.parentId) ?? []), group]);
  }
  const writeGroup = (group: GraphGroup, depth: number) => {
    const pad = '  '.repeat(depth);
    lines.push(`${pad}subgraph ${group.id}["${escapeLabel(group.label)}"]`);
    if (group.direction) lines.push(`${pad}  direction ${group.direction}`);
    for (const child of childGroups.get(group.id) ?? []) writeGroup(child, depth + 1);
    for (const node of model.nodes) {
      if (node.groupId === group.id) lines.push(`${pad}  ${node.id}`);
    }
    lines.push(`${pad}end`);
  };
  for (const group of childGroups.get(undefined) ?? []) writeGroup(group, 1);

  const seenPairs = new Map<string, number>();
  for (const edge of model.edges) {
    const pairKey = `${edge.source}\u0000${edge.target}`;
    const index = seenPairs.get(pairKey) ?? 0;
    seenPairs.set(pairKey, index + 1);
    // Mermaid derives `L_<source>_<target>_<n>`; write the id only when it differs.
    const autoId = `L_${edge.source}_${edge.target}_${index}`;
    const idPrefix = edge.id === autoId ? '' : `${edge.id}@`;
    const label = edge.label === '' ? '' : `|"${escapeLabel(edge.label)}"|`;
    lines.push(`  ${edge.source} ${idPrefix}${arrow(edge, losses)}${label} ${edge.target}`);
  }

  return { ok: true, source: lines.join('\n') + '\n', losses };
}

function arrow(edge: GraphEdge, losses: Diagnostic[]): string {
  if (edge.stroke === 'invisible') {
    if (edge.arrowStart !== 'none' || edge.arrowEnd !== 'none') {
      losses.push(
        loss(
          'emit-arrowhead-dropped',
          `Edge "${edge.id}" is invisible; Mermaid cannot draw arrowheads on it.`,
          edge.id,
        ),
      );
    }
    return '~~~';
  }
  let start = edge.arrowStart;
  const end = edge.arrowEnd;
  // Mermaid only draws a start head when it matches the end head (`<-->`, `o--o`, `x--x`).
  if (start !== 'none' && start !== end) {
    losses.push(
      loss(
        'emit-arrowhead-dropped',
        `Edge "${edge.id}" start head "${start}" differs from its end head; Mermaid can only write matching heads, so it was dropped.`,
        edge.id,
      ),
    );
    start = 'none';
  }
  if (end === 'none') return { solid: '---', thick: '===', dotted: '-.-' }[edge.stroke];
  const line = { solid: '--', thick: '==', dotted: '-.-' }[edge.stroke];
  return `${HEAD_START[start]}${line}${HEAD_END[end]}`;
}

/**
 * Quoted Mermaid strings end at `"`, and Mermaid strips text that looks like an HTML tag, so
 * these characters, and line breaks, are written as Mermaid entity codes. `&` and `#` are encoded
 * too, so label text such as `&lt;` or `#quot;` is not read back as an entity.
 */
function escapeLabel(text: string): string {
  return text.replace(/[&#"<>\n]/g, (ch) => `#${ch.codePointAt(0)};`);
}

function loss(code: string, message: string, elementId: string): Diagnostic {
  return { severity: 'warning', code, message, elementId };
}
