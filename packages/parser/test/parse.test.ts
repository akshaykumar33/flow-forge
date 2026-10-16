import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { serializeModel, type GraphModel } from '@flowforge/core';
import { parse } from '../src/node.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.mmd`, import.meta.url), 'utf8');

async function parseOk(source: string): Promise<GraphModel> {
  const result = await parse(source);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics, null, 2));
  return result.model;
}

const node = (model: GraphModel, id: string) => model.nodes.find((n) => n.id === id);
const edge = (model: GraphModel, source: string, target: string) =>
  model.edges.find((e) => e.source === source && e.target === target);

describe('parse: valid flowcharts', () => {
  it('parses a basic graph with labels, shapes and edge labels', async () => {
    const model = await parseOk(fixture('basic'));
    expect(model.direction).toBe('TB');
    expect(model.nodes.map((n) => [n.id, n.label, n.shape])).toEqual([
      ['A', 'Start', 'rectangle'],
      ['B', 'Is it valid?', 'diamond'],
      ['C', 'Process', 'rectangle'],
      ['D', 'Reject', 'rectangle'],
      ['E', 'Done', 'circle'],
    ]);
    expect(edge(model, 'B', 'C')).toMatchObject({ label: 'Yes', arrowEnd: 'arrow' });
  });

  it('preserves Mermaid node and edge ids', async () => {
    const model = await parseOk(fixture('basic'));
    expect(model.edges.map((e) => e.id)).toEqual(['L_A_B_0', 'L_B_C_0', 'L_B_D_0', 'L_C_E_0']);
  });

  it('builds nested groups, group direction and edges to groups', async () => {
    const model = await parseOk(fixture('azure-architecture'));
    expect(model.groups).toEqual([
      { id: 'vnet', label: 'Virtual Network', parentId: 'azure', direction: 'TB' },
      { id: 'azure', label: 'Azure Subscription' },
    ]);
    expect(node(model, 'app')?.groupId).toBe('vnet');
    expect(node(model, 'sql')?.groupId).toBe('azure');
    expect(node(model, 'user')?.groupId).toBeUndefined();
    // The subgraph target must not also appear as a phantom node.
    expect(node(model, 'vnet')).toBeUndefined();
    expect(edge(model, 'sb', 'vnet')).toBeDefined();
    expect(edge(model, 'fn', 'sb')).toMatchObject({ stroke: 'dotted', label: 'events' });
  });

  it('maps every classic shape', async () => {
    const model = await parseOk(fixture('kitchen-sink'));
    const shapes = Object.fromEntries(model.nodes.map((n) => [n.id, n.shape]));
    expect(shapes).toMatchObject({
      s1: 'asymmetric',
      s2: 'hexagon',
      s3: 'parallelogram',
      s4: 'parallelogram-alt',
      s5: 'trapezoid',
      s6: 'trapezoid-alt',
      s7: 'double-circle',
      s8: 'stadium',
      s9: 'subroutine',
      s10: 'diamond',
      n1: 'rounded',
    });
  });

  it('maps arrow heads and strokes', async () => {
    const model = await parseOk(fixture('kitchen-sink'));
    const style = (target: string) => {
      const e = edge(model, 'a', target)!;
      return [e.arrowStart, e.arrowEnd, e.stroke];
    };
    expect(style('b')).toEqual(['arrow', 'arrow', 'solid']);
    expect(style('c')).toEqual(['none', 'circle', 'solid']);
    expect(style('d')).toEqual(['none', 'cross', 'solid']);
    expect(style('e')).toEqual(['none', 'none', 'solid']);
    expect(style('f')).toEqual(['none', 'arrow', 'thick']);
    expect(style('g')).toEqual(['none', 'none', 'invisible']);
    expect(style('h')).toEqual(['none', 'none', 'dotted']);
  });

  it('warns on shapes the model does not support instead of dropping them', async () => {
    const result = await parse(fixture('kitchen-sink'));
    expect(result.ok).toBe(true);
    expect(result.ok && node(result.model, 'n2')?.shape).toBe('unknown');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: 'warning', code: 'shape-unsupported', elementId: 'n2' }),
    );
  });

  it('stores labels as plain text with script content removed', async () => {
    const model = await parseOk(fixture('html-labels'));
    const label = node(model, 'a')!.label;
    expect(label).not.toMatch(/script|alert/);
    expect(label).toContain('<b>bold</b> & ');
    expect(node(model, 'b')!.label).toBe('Tom\'s "db"');
    expect(edge(model, 'a', 'b')!.label).toBe('x < y');
  });

  it('is deterministic across repeated parses', async () => {
    const source = fixture('azure-architecture');
    const first = serializeModel(await parseOk(source));
    await parseOk(fixture('basic'));
    expect(serializeModel(await parseOk(source))).toBe(first);
  });

  it('isolates concurrent parses', async () => {
    const [a, b] = await Promise.all([parseOk(fixture('basic')), parseOk(fixture('html-labels'))]);
    expect(a.nodes).toHaveLength(5);
    expect(b.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('parse: diagnostics', () => {
  it('locates syntax errors', async () => {
    const result = await parse(fixture('invalid-syntax'));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'error',
      code: 'syntax-error',
      range: { startLine: 3 },
    });
  });

  it('locates lexical errors on the right line', async () => {
    const result = await parse(fixture('invalid-lexical'));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: 'syntax-error', range: { startLine: 3 } });
  });

  it('recovers after an error', async () => {
    await parse(fixture('invalid-syntax'));
    expect((await parse(fixture('basic'))).ok).toBe(true);
  });

  it('rejects unsupported diagram types clearly', async () => {
    const result = await parse(fixture('sequence'));
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'diagram-type-unsupported' }],
    });
  });

  it('rejects empty and non-Mermaid input without throwing', async () => {
    expect((await parse('')).ok).toBe(false);
    expect((await parse('hello world')).ok).toBe(false);
  });

  it('enforces the source length limit before parsing', async () => {
    const result = await parse(fixture('basic'), { maxSourceLength: 10 });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'source-too-large' }] });
  });

  it('enforces the edge limit', async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `  n${i} --> n${i + 1}`);
    const source = `flowchart TD\n${lines.join('\n')}`;
    const result = await parse(source, { maxEdges: 20 });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'edge-limit-exceeded' }] });
    expect((await parse(source)).ok).toBe(true);
  });
});
