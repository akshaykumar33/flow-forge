import { describe, expect, it } from 'vitest';
import { serializeModel, type GraphModel } from '@flowforge/core';
import {
  applySuggestion,
  canRedo,
  canUndo,
  createHistory,
  currentModel,
  diffModels,
  namingTransform,
  record,
  redo,
  revert,
  runTransform,
  tidyLabelsTransform,
  undo,
  type NamingProfile,
  type Transform,
} from '../src/index.js';

function fixture(): GraphModel {
  return {
    version: 1,
    diagramType: 'flowchart',
    direction: 'LR',
    groups: [
      { id: 'azure', label: 'Azure' },
      { id: 'vnet', label: 'VNet', parentId: 'azure' },
    ],
    nodes: [
      { id: 'user', label: 'User', shape: 'circle', inferences: [] },
      { id: 'api', label: 'Orders API', shape: 'rectangle', groupId: 'vnet', inferences: [] },
      {
        id: 'db',
        label: 'Orders DB',
        shape: 'cylinder',
        groupId: 'azure',
        inferences: [
          {
            key: 'category',
            value: 'sqldb',
            confidence: 1,
            provenance: 'user',
            reason: 'set by user',
          },
        ],
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'user',
        target: 'api',
        label: '',
        stroke: 'solid',
        arrowStart: 'none',
        arrowEnd: 'arrow',
      },
      {
        id: 'e2',
        source: 'api',
        target: 'db',
        label: 'reads',
        stroke: 'solid',
        arrowStart: 'none',
        arrowEnd: 'arrow',
      },
    ],
  };
}

const labels = (model: GraphModel) => Object.fromEntries(model.nodes.map((n) => [n.id, n.label]));

function rename(model: GraphModel, profile: NamingProfile) {
  const result = runTransform(namingTransform, model, profile);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result;
}

describe('diffModels', () => {
  it('returns nothing for identical models', () => {
    expect(diffModels(fixture(), fixture())).toEqual([]);
  });

  it('reports field changes, additions and removals in a stable order', () => {
    const after = fixture();
    after.nodes[1]!.label = 'API';
    after.nodes.pop();
    after.nodes.push({ id: 'cache', label: 'Cache', shape: 'rectangle', inferences: [] });
    after.direction = 'TB';
    expect(diffModels(fixture(), after).map((c) => [c.type, c.kind, c.id])).toEqual([
      ['modified', 'diagram', ''],
      ['modified', 'node', 'api'],
      ['added', 'node', 'cache'],
      ['removed', 'node', 'db'],
    ]);
  });
});

describe('runTransform contract', () => {
  it('never mutates the input model', () => {
    const model = fixture();
    const snapshot = serializeModel(model);
    rename(model, { template: '{env}-{label}', env: 'prod' });
    expect(serializeModel(model)).toBe(snapshot);
  });

  it('shields the caller from a transform that mutates its input', () => {
    const model = fixture();
    const snapshot = serializeModel(model);
    const mutator: Transform = {
      id: 'mutator',
      description: 'edits in place',
      apply: (m) => {
        m.nodes[0]!.label = 'changed';
        return { model: m };
      },
    };
    const result = runTransform(mutator, model, undefined);
    expect(result.ok && labels(result.model).user).toBe('changed');
    expect(serializeModel(model)).toBe(snapshot);
  });

  it('rejects a transform that changes graph structure', () => {
    const rewire: Transform = {
      id: 'rewire',
      description: 'bad',
      apply: (m) => ({ model: { ...m, edges: m.edges.map((e) => ({ ...e, target: 'user' })) } }),
    };
    const result = runTransform(rewire, fixture(), undefined);
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'transform-changed-structure' }],
    });
  });

  it('rejects a transform that drops elements or changes direction', () => {
    const drop: Transform = {
      id: 'drop',
      description: 'bad',
      apply: (m) => ({ model: { ...m, edges: [] } }),
    };
    const flip: Transform = {
      id: 'flip',
      description: 'bad',
      apply: (m) => ({ model: { ...m, direction: 'TB' } }),
    };
    expect(runTransform(drop, fixture(), undefined).ok).toBe(false);
    expect(runTransform(flip, fixture(), undefined).ok).toBe(false);
  });

  it('rejects invalid output and thrown errors without crashing', () => {
    const invalid: Transform = {
      id: 'invalid',
      description: 'bad',
      apply: (m) => ({
        model: { ...m, nodes: m.nodes.map((n) => ({ ...n, shape: 'blob' as never })) },
      }),
    };
    const throws: Transform = {
      id: 'throws',
      description: 'bad',
      apply: () => {
        throw new Error('boom');
      },
    };
    expect(runTransform(invalid, fixture(), undefined)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'transform-invalid-output' }],
    });
    expect(runTransform(throws, fixture(), undefined)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'transform-threw', message: expect.stringContaining('boom') }],
    });
  });
});

describe('namingTransform', () => {
  it('renders the template with sequence numbers in model order', () => {
    const result = rename(fixture(), {
      template: '{env}-{label}-{seq}',
      env: 'prod',
      case: 'kebab',
    });
    expect(labels(result.model)).toEqual({
      user: 'prod-user-01',
      api: 'prod-orders-api-02',
      db: 'prod-orders-db-03',
    });
    expect(result.changes.every((c) => c.type === 'modified')).toBe(true);
  });

  it('is idempotent: applying twice equals applying once', () => {
    const profile: NamingProfile = { template: '{prefix}{label}', prefix: 'az-', case: 'kebab' };
    const once = rename(fixture(), profile).model;
    const twice = rename(once, profile);
    expect(serializeModel(twice.model)).toBe(serializeModel(once));
    expect(twice.changes).toEqual([]);
  });

  it('keeps the original label so later profiles start from the source', () => {
    const first = rename(fixture(), { template: '{label}', case: 'upper' }).model;
    const second = rename(first, { template: '{label}', case: 'snake' }).model;
    expect(labels(second).api).toBe('orders_api');
  });

  it('scopes by group, including nested groups', () => {
    const result = rename(fixture(), {
      template: '{region}/{label}',
      region: 'weu',
      groupIds: ['azure'],
    });
    expect(labels(result.model)).toEqual({
      user: 'User',
      api: 'weu/Orders API',
      db: 'weu/Orders DB',
    });
  });

  it('never invents a category; nodes without one are skipped and reported', () => {
    const result = rename(fixture(), { template: '{category}-{label}', case: 'kebab' });
    expect(labels(result.model)).toEqual({
      user: 'User',
      api: 'Orders API',
      db: 'sqldb-orders-db',
    });
    expect(result.diagnostics.map((d) => [d.code, d.elementId])).toEqual([
      ['naming-missing-value', 'user'],
      ['naming-missing-value', 'api'],
    ]);
  });

  it('fails on unknown template tokens', () => {
    const result = runTransform(namingTransform, fixture(), { template: '{owner}-{label}' });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'naming-unknown-token' }] });
  });

  it('is deterministic', () => {
    const profile: NamingProfile = { template: '{label} ({seq})', case: 'title', seqWidth: 3 };
    expect(serializeModel(rename(fixture(), profile).model)).toBe(
      serializeModel(rename(fixture(), profile).model),
    );
  });
});

describe('tidyLabelsTransform', () => {
  it('cleans whitespace and leaves clean models unchanged', () => {
    const messy = fixture();
    messy.nodes[0]!.label = '  User \n  Portal ';
    const result = runTransform(tidyLabelsTransform, messy, undefined);
    expect(result.ok && labels(result.model).user).toBe('User Portal');
    const clean = runTransform(tidyLabelsTransform, fixture(), undefined);
    expect(clean.ok && clean.changes).toEqual([]);
  });
});

describe('suggestions', () => {
  it('are only written by an explicit applySuggestion call', () => {
    const suggester: Transform = {
      id: 'suggester',
      description: 'proposes, never applies',
      apply: (m) => ({
        model: m,
        suggestions: [
          {
            transformId: 'suggester',
            elementId: 'db',
            label: 'Azure SQL Database',
            inference: {
              key: 'service',
              value: 'azure.sql-database',
              confidence: 0.6,
              provenance: 'heuristic',
              reason: 'cylinder in Azure group',
            },
          },
        ],
      }),
    };
    const result = runTransform(suggester, fixture(), undefined);
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.changes).toEqual([]);
    expect(labels(result.model).db).toBe('Orders DB');

    const applied = applySuggestion(result.model, result.suggestions[0]!);
    const db = applied.nodes.find((n) => n.id === 'db')!;
    expect(db.label).toBe('Azure SQL Database');
    expect(db.inferences.find((i) => i.key === 'service')).toMatchObject({
      provenance: 'user',
      confidence: 0.6,
    });
  });
});

describe('history', () => {
  it('supports undo, redo and revert to the original', () => {
    const original = fixture();
    let history = createHistory(original);
    expect(canUndo(history)).toBe(false);

    const step1 = rename(original, { template: '{label}', case: 'upper' });
    history = record(history, {
      source: 'naming',
      summary: 'upper',
      changes: step1.changes,
      model: step1.model,
    });
    const step2 = runTransform(tidyLabelsTransform, step1.model, undefined);
    if (!step2.ok) throw new Error('unexpected failure');
    // A no-op transform records nothing.
    history = record(history, {
      source: 'tidy-labels',
      summary: 'tidy',
      changes: step2.changes,
      model: step2.model,
    });
    expect(history.entries).toHaveLength(1);

    expect(labels(currentModel(history)).api).toBe('ORDERS API');
    history = undo(history);
    expect(currentModel(history)).toBe(original);
    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(labels(currentModel(history)).api).toBe('ORDERS API');
    history = revert(history);
    expect(currentModel(history)).toBe(original);
  });

  it('drops undone entries when a new change is recorded', () => {
    const original = fixture();
    const a = rename(original, { template: 'a-{label}' });
    const b = rename(original, { template: 'b-{label}' });
    let history = record(createHistory(original), {
      source: 'naming',
      summary: 'a',
      changes: a.changes,
      model: a.model,
    });
    history = record(undo(history), {
      source: 'naming',
      summary: 'b',
      changes: b.changes,
      model: b.model,
    });
    expect(history.entries.map((e) => e.summary)).toEqual(['b']);
    expect(canRedo(history)).toBe(false);
  });
});
