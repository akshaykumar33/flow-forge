import { describe, expect, it } from 'vitest';
import {
  deserializeModel,
  hasErrors,
  serializeModel,
  validateModel,
  type GraphModel,
} from '../src/index.js';

function model(overrides: Partial<GraphModel> = {}): GraphModel {
  return {
    version: 1,
    diagramType: 'flowchart',
    direction: 'LR',
    groups: [{ id: 'cloud', label: 'Azure' }],
    nodes: [
      { id: 'api', label: 'API', shape: 'rectangle', groupId: 'cloud', inferences: [] },
      { id: 'db', label: 'Azure SQL', shape: 'cylinder', inferences: [] },
    ],
    edges: [
      {
        id: 'L_api_db_0',
        source: 'api',
        target: 'db',
        label: 'reads',
        stroke: 'solid',
        arrowStart: 'none',
        arrowEnd: 'arrow',
      },
    ],
    ...overrides,
  };
}

function codes(input: unknown): string[] {
  return validateModel(input).diagnostics.map((d) => d.code);
}

describe('validateModel', () => {
  it('accepts a well-formed model', () => {
    const result = validateModel(model());
    expect(result).toMatchObject({ ok: true, diagnostics: [] });
  });

  it('fills defaults for optional collections', () => {
    const input = model();
    const { inferences: _, ...bare } = input.nodes[1]!;
    const result = validateModel({ ...input, nodes: [input.nodes[0], bare] });
    expect(result.ok && result.model.nodes[1]!.inferences).toEqual([]);
  });

  it('rejects schema violations with the failing path', () => {
    const result = validateModel({ ...model(), direction: 'XY' });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: 'schema-invalid' });
    expect(result.diagnostics[0]!.message).toContain('direction');
  });

  it('rejects non-object input without throwing', () => {
    expect(codes(null)).toEqual(['schema-invalid']);
    expect(codes('flowchart LR')).toEqual(['schema-invalid']);
  });

  it('reports edges to missing nodes', () => {
    const m = model();
    m.edges[0]!.target = 'ghost';
    expect(codes(m)).toEqual(['edge-unknown-target']);
  });

  it('allows edges that target a group', () => {
    const m = model();
    m.edges[0]!.target = 'cloud';
    expect(validateModel(m).ok).toBe(true);
  });

  it('reports duplicate ids and node/group collisions', () => {
    const m = model();
    m.nodes.push({ ...m.nodes[0]! });
    m.nodes.push({ id: 'cloud', label: 'x', shape: 'rectangle', inferences: [] });
    expect(codes(m).sort()).toEqual(['id-collision', 'node-duplicate-id']);
  });

  it('reports missing groups and parents', () => {
    const m = model({ groups: [{ id: 'cloud', label: 'Azure', parentId: 'nowhere' }] });
    m.nodes[1]!.groupId = 'missing';
    expect(codes(m).sort()).toEqual(['group-unknown-parent', 'node-unknown-group']);
  });

  it('reports group nesting cycles', () => {
    const m = model({
      groups: [
        { id: 'cloud', label: 'a', parentId: 'region' },
        { id: 'region', label: 'b', parentId: 'cloud' },
      ],
    });
    expect(codes(m)).toEqual(['group-cycle', 'group-cycle']);
  });

  it('rejects confidence outside 0..1', () => {
    const m = model();
    m.nodes[1]!.inferences.push({
      key: 'service',
      value: 'azure.sql-database',
      confidence: 1.5,
      provenance: 'heuristic',
      reason: 'label match',
    });
    expect(codes(m)).toEqual(['schema-invalid']);
  });
});

describe('serialization', () => {
  it('round-trips a model', () => {
    const m = model();
    const result = deserializeModel(serializeModel(m));
    expect(result.ok && result.model).toEqual(m);
  });

  it('is byte-identical regardless of key insertion order', () => {
    const m = model();
    const reordered = JSON.parse(JSON.stringify(m, Object.keys(m).reverse())) as GraphModel;
    expect(serializeModel({ ...reordered, ...m })).toBe(serializeModel(m));
    expect(serializeModel(m)).toMatch(/^\{\n {2}"diagramType"/);
  });

  it('preserves array order', () => {
    const m = model();
    m.nodes.reverse();
    const result = deserializeModel(serializeModel(m));
    expect(result.ok && result.model.nodes.map((n) => n.id)).toEqual(['db', 'api']);
  });

  it('reports malformed JSON as a diagnostic', () => {
    const result = deserializeModel('{"version": 1,');
    expect(result.ok).toBe(false);
    expect(hasErrors(result.diagnostics)).toBe(true);
    expect(result.diagnostics[0]!.code).toBe('json-invalid');
  });
});
