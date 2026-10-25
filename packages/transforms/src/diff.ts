import type { GraphModel } from '@flowforge/core';

export type ElementKind = 'diagram' | 'node' | 'edge' | 'group';

/** One observable difference between two models. Values are JSON-comparable. */
export type Change =
  | { type: 'added'; kind: ElementKind; id: string; value: unknown }
  | { type: 'removed'; kind: ElementKind; id: string; value: unknown }
  | {
      type: 'modified';
      kind: ElementKind;
      id: string;
      field: string;
      before: unknown;
      after: unknown;
    };

/**
 * Compares two models by element id. Output order is deterministic: diagram fields, then groups,
 * nodes and edges, each in the order they appear in `after` (removed elements follow, in `before`
 * order), fields sorted by name.
 */
export function diffModels(before: GraphModel, after: GraphModel): Change[] {
  const changes: Change[] = [];
  for (const field of ['direction', 'diagramType'] as const) {
    if (before[field] !== after[field]) {
      changes.push({
        type: 'modified',
        kind: 'diagram',
        id: '',
        field,
        before: before[field],
        after: after[field],
      });
    }
  }
  diffCollection('group', before.groups, after.groups, changes);
  diffCollection('node', before.nodes, after.nodes, changes);
  diffCollection('edge', before.edges, after.edges, changes);
  return changes;
}

function diffCollection<T extends { id: string }>(
  kind: ElementKind,
  before: readonly T[],
  after: readonly T[],
  changes: Change[],
): void {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterIds = new Set(after.map((item) => item.id));

  for (const item of after) {
    const previous = beforeById.get(item.id);
    if (previous === undefined) {
      changes.push({ type: 'added', kind, id: item.id, value: item });
      continue;
    }
    const fields = [...new Set([...Object.keys(previous), ...Object.keys(item)])].sort();
    for (const field of fields) {
      const a = (previous as Record<string, unknown>)[field];
      const b = (item as Record<string, unknown>)[field];
      if (!jsonEqual(a, b))
        changes.push({ type: 'modified', kind, id: item.id, field, before: a, after: b });
    }
  }
  for (const item of before) {
    if (!afterIds.has(item.id)) changes.push({ type: 'removed', kind, id: item.id, value: item });
  }
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const STRUCTURAL_FIELDS = new Set(['source', 'target', 'groupId', 'parentId']);

/** Changes that alter the graph's meaning: elements, endpoints, nesting or diagram settings. */
export function structuralChanges(changes: readonly Change[]): Change[] {
  return changes.filter(
    (c) => c.type !== 'modified' || c.kind === 'diagram' || STRUCTURAL_FIELDS.has(c.field),
  );
}
