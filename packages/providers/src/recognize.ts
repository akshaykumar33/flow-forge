import type { GraphModel, GraphNode, Inference } from '@flowforge/core';
import type { Suggestion, Transform } from '@flowforge/transforms';
import { GENERIC_TERMS, SERVICES } from './registry.js';
import type { GenericTerm, ProviderId, ServiceEntry } from './types.js';

export interface RecognizeOptions {
  /** The diagram's provider, when the user knows it. Breaks ties like "api gateway". */
  provider?: ProviderId;
  /** Services to recognise. Defaults to the built-in registry. */
  services?: readonly ServiceEntry[];
}

/** What the recogniser concluded about one label, before it touches the model. */
export type Recognition =
  | { kind: 'service'; service: ServiceEntry; confidence: number; certain: boolean; reason: string }
  | { kind: 'ambiguous'; candidates: ServiceEntry[]; reason: string }
  | { kind: 'category'; category: GenericTerm['category']; reason: string }
  | { kind: 'none' };

const PROVIDER_WORDS: Record<ProviderId, RegExp> = {
  azure: /\b(azure|microsoft)\b/,
  aws: /\b(aws|amazon)\b/,
  gcp: /\b(gcp|google cloud|google)\b/,
};

export function normalizeLabel(label: string): string {
  return ` ${label
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim()} `;
}

/**
 * Decides what a label names. Rules, strictest first:
 * 1. The whole label is a service alias of exactly one provider: certain.
 * 2. A multi-word alias appears as whole words inside the label: likely (0.9).
 * 3. An alias several providers share, or a single-word alias inside a longer label: only
 *    resolved when context names the provider; otherwise ambiguous, never guessed.
 * 4. A generic term ("database", "queue"): its category only, never a vendor.
 */
export function recognize(
  label: string,
  context: { provider?: ProviderId | undefined } = {},
  services: readonly ServiceEntry[] = SERVICES,
): Recognition {
  const text = normalizeLabel(label);
  const named = (Object.keys(PROVIDER_WORDS) as ProviderId[]).filter((p) =>
    PROVIDER_WORDS[p].test(text),
  );
  const provider = context.provider ?? (named.length === 1 ? named[0] : undefined);

  const exact = services.filter((s) => s.aliases.some((a) => text === ` ${a} `));
  if (exact.length > 0) return decide(exact, provider, true, label);

  let best = 0;
  let contained: ServiceEntry[] = [];
  for (const service of services) {
    for (const alias of service.aliases) {
      if (!text.includes(` ${alias} `) || alias.length < best) continue;
      if (alias.length > best) contained = [];
      best = alias.length;
      if (!contained.includes(service)) contained.push(service);
    }
  }
  if (contained.length > 0) {
    const multiWord = contained.every((s) =>
      s.aliases.some((a) => a.length === best && a.includes(' ')),
    );
    return decide(contained, provider, false, label, multiWord);
  }

  for (const generic of GENERIC_TERMS) {
    const term = generic.terms.find((t) => text === ` ${t} ` || text.endsWith(` ${t} `));
    if (term) {
      return {
        kind: 'category',
        category: generic.category,
        reason: `"${term}" names a kind of ${generic.category}, not a specific product.`,
      };
    }
  }
  return { kind: 'none' };
}

function decide(
  candidates: ServiceEntry[],
  provider: ProviderId | undefined,
  exact: boolean,
  label: string,
  multiWord = true,
): Recognition {
  const providers = new Set(candidates.map((c) => c.provider));
  if (providers.size === 1 && candidates.length === 1 && (exact || multiWord)) {
    const service = candidates[0]!;
    return {
      kind: 'service',
      service,
      confidence: exact ? 1 : 0.9,
      certain: exact,
      reason: exact
        ? `"${label}" is the name of ${service.name}.`
        : `"${label}" contains the product name ${service.name}.`,
    };
  }
  const narrowed = provider ? candidates.filter((c) => c.provider === provider) : [];
  if (narrowed.length === 1) {
    const service = narrowed[0]!;
    return {
      kind: 'service',
      service,
      confidence: 0.8,
      certain: false,
      reason: `"${label}" could name several services; the diagram's ${provider} context points to ${service.name}.`,
    };
  }
  return {
    kind: 'ambiguous',
    candidates,
    reason: `"${label}" could name ${candidates.map((c) => c.name).join(' or ')}.`,
  };
}

/**
 * Tags nodes with the services they name. Certain recognitions become inferences; everything
 * else becomes a suggestion the user must accept. Labels are never changed, and inferences the
 * user set by hand are never overwritten.
 */
export const recognizeServicesTransform: Transform<RecognizeOptions> = {
  id: 'recognize-services',
  description: 'Recognise cloud services named in node labels.',
  apply(model, options) {
    const services = options.services ?? SERVICES;
    const suggestions: Suggestion[] = [];
    const nodes = model.nodes.map((node) => {
      if (node.inferences.some((i) => i.key === 'service' && i.provenance === 'user')) return node;
      const provider = options.provider ?? providerFromGroups(model, node);
      const result = recognize(node.label, { provider }, services);
      switch (result.kind) {
        case 'service':
          if (result.certain || result.confidence >= 0.9) {
            return withInferences(
              node,
              serviceInferences(result.service, result.confidence, 'deterministic', result.reason),
            );
          }
          suggestions.push(suggest(node, result.service, result.confidence, result.reason));
          return node;
        case 'ambiguous':
          for (const candidate of result.candidates) {
            suggestions.push(suggest(node, candidate, 0.5, result.reason));
          }
          return node;
        case 'category':
          return withInferences(node, [
            inference('category', result.category, 1, 'deterministic', result.reason),
          ]);
        case 'none':
          return node;
      }
    });
    return { model: { ...model, nodes }, suggestions };
  },
};

/** The nearest enclosing group whose label names exactly one provider sets the context. */
function providerFromGroups(model: GraphModel, node: GraphNode): ProviderId | undefined {
  const groups = new Map(model.groups.map((g) => [g.id, g]));
  for (let id = node.groupId; id !== undefined; id = groups.get(id)?.parentId) {
    const text = normalizeLabel(groups.get(id)?.label ?? '');
    const named = (Object.keys(PROVIDER_WORDS) as ProviderId[]).filter((p) =>
      PROVIDER_WORDS[p].test(text),
    );
    if (named.length === 1) return named[0];
  }
  return undefined;
}

function serviceInferences(
  service: ServiceEntry,
  confidence: number,
  provenance: Inference['provenance'],
  reason: string,
): Inference[] {
  return [
    inference('service', service.id, confidence, provenance, reason),
    inference('provider', service.provider, confidence, provenance, reason),
    inference('category', service.category, confidence, provenance, reason),
  ];
}

function inference(
  key: string,
  value: string,
  confidence: number,
  provenance: Inference['provenance'],
  reason: string,
): Inference {
  return { key, value, confidence, provenance, reason };
}

function withInferences(node: GraphNode, added: Inference[]): GraphNode {
  const keys = new Set(added.map((i) => i.key));
  const kept = node.inferences.filter((i) => !keys.has(i.key) || i.provenance === 'user');
  const fresh = added.filter((i) => !kept.some((k) => k.key === i.key));
  return { ...node, inferences: [...kept, ...fresh] };
}

function suggest(
  node: GraphNode,
  service: ServiceEntry,
  confidence: number,
  reason: string,
): Suggestion {
  return {
    transformId: 'recognize-services',
    elementId: node.id,
    inference: inference('service', service.id, confidence, 'heuristic', reason),
  };
}
