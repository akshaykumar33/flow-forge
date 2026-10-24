import type { Diagnostic, GraphModel, GraphNode } from '@flowforge/core';
import type { Transform } from './transform.js';

export type LabelCase = 'preserve' | 'kebab' | 'snake' | 'title' | 'upper';

export interface NamingProfile {
  /**
   * Label template. Tokens: `{label}` (the original label), `{prefix}`, `{suffix}`, `{env}`,
   * `{region}`, `{seq}` and `{category}`. Example: `{env}-{label}-{seq}`.
   */
  template: string;
  case?: LabelCase;
  prefix?: string;
  suffix?: string;
  env?: string;
  region?: string;
  /** Zero-padded width of `{seq}`. Default 2. */
  seqWidth?: number;
  /** Restrict to these node ids; default every node. */
  nodeIds?: readonly string[];
  /** Restrict to nodes inside these groups (directly or nested); default every group. */
  groupIds?: readonly string[];
}

const TOKENS = ['label', 'prefix', 'suffix', 'env', 'region', 'seq', 'category'] as const;
type Token = (typeof TOKENS)[number];

/** Inference key holding the label before the first rename, so renaming is idempotent. */
export const ORIGINAL_LABEL_KEY = 'original-label';

/**
 * Renames node labels from a template. Always renders from the node's original label, so
 * applying a profile twice gives the same result as applying it once. Nodes whose template needs
 * a value they do not have (for example `{category}` on an unclassified node) are left alone and
 * reported, never filled with a guess.
 */
export const namingTransform: Transform<NamingProfile> = {
  id: 'naming',
  description: 'Rename node labels from a naming profile template.',
  apply(model, profile) {
    const diagnostics: Diagnostic[] = [];
    const unknown = [...profile.template.matchAll(/\{(\w+)\}/g)]
      .map((m) => m[1]!)
      .filter((t) => !(TOKENS as readonly string[]).includes(t));
    if (unknown.length > 0) {
      diagnostics.push({
        severity: 'error',
        code: 'naming-unknown-token',
        message: `Unknown template token(s): ${unknown.map((t) => `{${t}}`).join(', ')}. Allowed: ${TOKENS.map((t) => `{${t}}`).join(', ')}.`,
      });
      return { model, diagnostics };
    }

    const inScope = scopeFilter(model, profile);
    let seq = 0;
    const nodes = model.nodes.map((node) => {
      if (!inScope(node)) return node;
      seq += 1;
      const original = originalLabel(node);
      const values: Record<Token, string | undefined> = {
        label: original,
        prefix: profile.prefix,
        suffix: profile.suffix,
        env: profile.env,
        region: profile.region,
        seq: String(seq).padStart(profile.seqWidth ?? 2, '0'),
        category: node.inferences.find((i) => i.key === 'category')?.value,
      };
      const missing = TOKENS.filter((t) => profile.template.includes(`{${t}}`) && !values[t]);
      if (missing.length > 0) {
        diagnostics.push({
          severity: 'warning',
          code: 'naming-missing-value',
          message: `Node "${node.id}" was not renamed: no value for ${missing.map((t) => `{${t}}`).join(', ')}.`,
          elementId: node.id,
        });
        return node;
      }
      const rendered = profile.template.replace(/\{(\w+)\}/g, (_, t: Token) => values[t]!);
      return withLabel(node, applyCase(rendered, profile.case ?? 'preserve'), original);
    });

    return { model: { ...model, nodes }, diagnostics };
  },
};

function scopeFilter(model: GraphModel, profile: NamingProfile): (node: GraphNode) => boolean {
  const ids = profile.nodeIds ? new Set(profile.nodeIds) : undefined;
  const groups = profile.groupIds ? new Set(profile.groupIds) : undefined;
  const parentOf = new Map(model.groups.map((g) => [g.id, g.parentId]));
  const inGroups = (groupId: string | undefined): boolean => {
    for (let g = groupId; g !== undefined; g = parentOf.get(g)) {
      if (groups!.has(g)) return true;
    }
    return false;
  };
  return (node) => (!ids || ids.has(node.id)) && (!groups || inGroups(node.groupId));
}

function originalLabel(node: GraphNode): string {
  return node.inferences.find((i) => i.key === ORIGINAL_LABEL_KEY)?.value ?? node.label;
}

function withLabel(node: GraphNode, label: string, original: string): GraphNode {
  if (label === node.label) return node;
  const hasOriginal = node.inferences.some((i) => i.key === ORIGINAL_LABEL_KEY);
  return {
    ...node,
    label,
    inferences: hasOriginal
      ? node.inferences
      : [
          ...node.inferences,
          {
            key: ORIGINAL_LABEL_KEY,
            value: original,
            confidence: 1,
            provenance: 'source',
            reason: 'Label as written in the source, kept so renames can be reverted.',
          },
        ],
  };
}

function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function applyCase(text: string, labelCase: LabelCase): string {
  switch (labelCase) {
    case 'preserve':
      return text;
    case 'upper':
      return text.toUpperCase();
    case 'kebab':
      return words(text).join('-').toLowerCase();
    case 'snake':
      return words(text).join('_').toLowerCase();
    case 'title':
      return words(text)
        .map((w) => w[0]!.toUpperCase() + w.slice(1))
        .join(' ');
  }
}
