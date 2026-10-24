import type { Diagnostic } from './diagnostics.js';
import { GraphModelSchema, type GraphModel } from './model.js';

export type ValidationResult =
  | { ok: true; model: GraphModel; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

/**
 * Checks untrusted input (imported JSON, adapter output) against the schema and the graph's
 * referential rules. Returns diagnostics instead of throwing so callers can show all problems at
 * once.
 */
export function validateModel(input: unknown): ValidationResult {
  const parsed = GraphModelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: parsed.error.issues.map((issue) => ({
        severity: 'error',
        code: 'schema-invalid',
        message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      })),
    };
  }

  const model = parsed.data;
  const diagnostics = checkReferences(model);
  const ok = !diagnostics.some((d) => d.severity === 'error');
  return ok ? { ok, model, diagnostics } : { ok, diagnostics };
}

function checkReferences(model: GraphModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const error = (code: string, message: string, elementId: string) =>
    diagnostics.push({ severity: 'error', code, message, elementId });

  const nodeIds = findDuplicates(model.nodes, 'node-duplicate-id', error);
  const groupIds = findDuplicates(model.groups, 'group-duplicate-id', error);
  findDuplicates(model.edges, 'edge-duplicate-id', error);

  for (const id of nodeIds) {
    if (groupIds.has(id)) {
      error('id-collision', `"${id}" is used as both a node and a group id.`, id);
    }
  }

  for (const edge of model.edges) {
    // Mermaid allows edges to subgraphs, so a group id is a valid endpoint.
    for (const end of ['source', 'target'] as const) {
      const ref = edge[end];
      if (!nodeIds.has(ref) && !groupIds.has(ref)) {
        error(`edge-unknown-${end}`, `Edge "${edge.id}" ${end} "${ref}" does not exist.`, edge.id);
      }
    }
  }

  for (const node of model.nodes) {
    if (node.groupId !== undefined && !groupIds.has(node.groupId)) {
      error(
        'node-unknown-group',
        `Node "${node.id}" is in missing group "${node.groupId}".`,
        node.id,
      );
    }
  }

  const parentOf = new Map(model.groups.map((g) => [g.id, g.parentId]));
  for (const group of model.groups) {
    if (group.parentId !== undefined && !groupIds.has(group.parentId)) {
      error(
        'group-unknown-parent',
        `Group "${group.id}" has missing parent "${group.parentId}".`,
        group.id,
      );
    } else if (isInCycle(group.id, parentOf)) {
      error('group-cycle', `Group "${group.id}" is nested inside itself.`, group.id);
    }
  }

  return diagnostics;
}

function findDuplicates(
  items: readonly { id: string }[],
  code: string,
  error: (code: string, message: string, elementId: string) => void,
): Set<string> {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) error(code, `Duplicate id "${id}".`, id);
    seen.add(id);
  }
  return seen;
}

function isInCycle(start: string, parentOf: Map<string, string | undefined>): boolean {
  const visited = new Set<string>();
  let current = parentOf.get(start);
  while (current !== undefined) {
    if (current === start) return true;
    if (visited.has(current)) return false; // cycle further up; reported for its own members
    visited.add(current);
    current = parentOf.get(current);
  }
  return false;
}
