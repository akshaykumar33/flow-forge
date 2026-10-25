import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { serializeModel, type GraphModel } from '@flowforge/core';
import { parse, toMermaid } from '../src/node.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.mmd`, import.meta.url), 'utf8');

beforeAll(() => parse('flowchart LR\n  warm --> up'), 30_000);

async function parseOk(source: string): Promise<GraphModel> {
  const result = await parse(source);
  if (!result.ok) throw new Error(`${JSON.stringify(result.diagnostics, null, 2)}\n${source}`);
  return result.model;
}

function emitOk(model: GraphModel) {
  const result = toMermaid(model);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics, null, 2));
  return result;
}

function model(overrides: Partial<GraphModel>): GraphModel {
  return {
    version: 1,
    diagramType: 'flowchart',
    direction: 'LR',
    nodes: [],
    edges: [],
    groups: [],
    ...overrides,
  };
}

describe('toMermaid round trip', () => {
  // kitchen-sink is excluded: it contains a shape the model cannot represent (tested below).
  it.each(['basic', 'azure-architecture', 'html-labels', 'entity-codes'])(
    '%s: parse → emit → parse gives the same model with no losses',
    async (name) => {
      const original = await parseOk(fixture(name));
      const emitted = emitOk(original);
      expect(emitted.losses).toEqual([]);
      const reparsed = await parseOk(emitted.source);
      expect(serializeModel(reparsed)).toBe(serializeModel(original));
    },
  );

  it('is stable: emitting a re-parsed model gives identical text', async () => {
    const first = emitOk(await parseOk(fixture('azure-architecture'))).source;
    const second = emitOk(await parseOk(first)).source;
    expect(second).toBe(first);
  });

  it('round-trips every edge style that Mermaid can express', async () => {
    const original = await parseOk(fixture('kitchen-sink'));
    const reparsed = await parseOk(emitOk(original).source);
    expect(reparsed.edges).toEqual(original.edges);
    expect(reparsed.groups).toEqual(original.groups);
  });

  it('writes explicit ids only where Mermaid would not derive them', async () => {
    const m = model({
      nodes: [
        { id: 'a', label: 'A', shape: 'rectangle', inferences: [] },
        { id: 'b', label: 'B', shape: 'rectangle', inferences: [] },
      ],
      edges: [
        {
          id: 'L_a_b_0',
          source: 'a',
          target: 'b',
          label: '',
          stroke: 'solid',
          arrowStart: 'none',
          arrowEnd: 'arrow',
        },
        {
          id: 'retry',
          source: 'a',
          target: 'b',
          label: 'retry',
          stroke: 'dotted',
          arrowStart: 'none',
          arrowEnd: 'arrow',
        },
      ],
    });
    const { source } = emitOk(m);
    expect(source).toContain('  a --> b\n');
    expect(source).toContain('  a retry@-.->|"retry"| b\n');
    expect((await parseOk(source)).edges.map((e) => e.id)).toEqual(['L_a_b_0', 'retry']);
  });

  it('survives labels with quotes, hashes, angle brackets and line breaks', async () => {
    const label = 'say "hi" #quot; <tag> a#1\nnext line';
    const m = model({ nodes: [{ id: 'n', label, shape: 'rounded', inferences: [] }] });
    const reparsed = await parseOk(emitOk(m).source);
    expect(reparsed.nodes[0]!.label).toBe(label);
  });
});

describe('toMermaid losses', () => {
  it('reports metadata it cannot write instead of dropping it silently', () => {
    const m = model({
      nodes: [
        {
          id: 'db',
          label: 'Orders',
          shape: 'cylinder',
          inferences: [
            {
              key: 'service',
              value: 'azure.sql',
              confidence: 0.9,
              provenance: 'heuristic',
              reason: 'label',
            },
          ],
        },
      ],
    });
    expect(emitOk(m).losses).toEqual([
      expect.objectContaining({ code: 'emit-inferences-dropped', elementId: 'db' }),
    ]);
  });

  it('reports unknown shapes and arrowheads Mermaid cannot draw', () => {
    const m = model({
      nodes: [
        { id: 'a', label: 'A', shape: 'unknown', inferences: [] },
        { id: 'b', label: 'B', shape: 'rectangle', inferences: [] },
      ],
      edges: [
        {
          id: 'L_a_b_0',
          source: 'a',
          target: 'b',
          label: '',
          stroke: 'solid',
          arrowStart: 'circle',
          arrowEnd: 'arrow',
        },
        {
          id: 'L_a_b_1',
          source: 'a',
          target: 'b',
          label: '',
          stroke: 'invisible',
          arrowStart: 'none',
          arrowEnd: 'arrow',
        },
      ],
    });
    const result = emitOk(m);
    expect(result.losses.map((l) => [l.code, l.elementId])).toEqual([
      ['emit-shape-unknown', 'a'],
      ['emit-arrowhead-dropped', 'L_a_b_0'],
      ['emit-arrowhead-dropped', 'L_a_b_1'],
    ]);
    expect(result.source).toContain('  a --> b\n  a ~~~ b\n');
  });

  it('refuses ids Mermaid cannot read rather than writing broken source', () => {
    const m = model({
      nodes: [
        { id: 'my node', label: 'x', shape: 'rectangle', inferences: [] },
        { id: 'end', label: 'y', shape: 'rectangle', inferences: [] },
      ],
    });
    expect(toMermaid(m)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'emit-invalid-id', elementId: 'my node' },
        { code: 'emit-invalid-id', elementId: 'end' },
      ],
    });
  });
});
