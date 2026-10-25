import { describe, expect, it } from 'vitest';
import type { GraphModel } from '@flowforge/core';
import { applySuggestion, runTransform } from '@flowforge/transforms';
import {
  GENERIC_TERMS,
  recognize,
  recognizeServicesTransform,
  SERVICES,
  serviceById,
  type Recognition,
} from '../src/index.js';

const serviceId = (r: Recognition) => (r.kind === 'service' ? r.service.id : r.kind);

describe('registry integrity', () => {
  it('has unique ids that match their provider', () => {
    const ids = SERVICES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SERVICES) expect(s.id.startsWith(`${s.provider}.`)).toBe(true);
  });

  it('uses lower-case aliases, https docs links on the provider domain, and no generic words', () => {
    const generic = new Set(GENERIC_TERMS.flatMap((g) => g.terms));
    const domains = {
      azure: 'learn.microsoft.com',
      aws: 'aws.amazon.com',
      gcp: 'cloud.google.com',
    };
    for (const s of SERVICES) {
      expect(new URL(s.docsUrl).protocol).toBe('https:');
      expect(new URL(s.docsUrl).hostname).toBe(domains[s.provider]);
      for (const alias of s.aliases) {
        expect(alias).toBe(alias.toLowerCase());
        expect(generic.has(alias), `${s.id} alias "${alias}" is generic`).toBe(false);
      }
    }
  });

  it('covers all three providers', () => {
    for (const p of ['azure', 'aws', 'gcp'] as const) {
      expect(SERVICES.filter((s) => s.provider === p).length).toBeGreaterThanOrEqual(15);
    }
  });
});

describe('recognize: the brief’s own examples', () => {
  it('"azure sql" resolves to Azure SQL Database', () => {
    expect(serviceId(recognize('azure sql'))).toBe('azure.sql-database');
  });

  it('"database" is only a category, never Azure SQL', () => {
    expect(recognize('database')).toMatchObject({ kind: 'category', category: 'database' });
  });

  it('"queue" is only a category, never a vendor queue', () => {
    expect(recognize('queue')).toMatchObject({ kind: 'category', category: 'messaging' });
  });

  it('"db" may become a database category', () => {
    expect(recognize('Orders DB')).toMatchObject({ kind: 'category', category: 'database' });
  });
});

describe('recognize: certainty rules', () => {
  it('is certain when the whole label is one provider’s product name', () => {
    expect(recognize('Amazon S3')).toMatchObject({ kind: 'service', certain: true, confidence: 1 });
    expect(recognize('Cloud Run')).toMatchObject({ kind: 'service', certain: true });
    expect(serviceId(recognize('  COSMOS-db '))).toBe('azure.cosmos-db');
  });

  it('accepts a multi-word product name inside a longer label at 0.9', () => {
    const r = recognize('Orders Azure Service Bus topic');
    expect(r).toMatchObject({ kind: 'service', certain: false, confidence: 0.9 });
    expect(serviceId(r)).toBe('azure.service-bus');
  });

  it('treats names several providers share as ambiguous without context', () => {
    const r = recognize('API Gateway');
    expect(r.kind).toBe('ambiguous');
    expect(r.kind === 'ambiguous' && r.candidates.map((c) => c.id).sort()).toEqual([
      'aws.api-gateway',
      'gcp.api-gateway',
    ]);
  });

  it('lets provider context break a tie, at reduced confidence', () => {
    expect(recognize('API Gateway', { provider: 'gcp' })).toMatchObject({
      kind: 'service',
      confidence: 0.8,
      certain: false,
    });
    expect(serviceId(recognize('AWS API Gateway'))).toBe('aws.api-gateway');
  });

  it('does not accept a single-word name hidden in a longer label', () => {
    expect(recognize('lambda calculus engine').kind).toBe('ambiguous');
  });

  it('returns none for labels it knows nothing about', () => {
    expect(recognize('Billing Reconciler')).toEqual({ kind: 'none' });
  });
});

describe('recognizeServicesTransform', () => {
  function model(): GraphModel {
    return {
      version: 1,
      diagramType: 'flowchart',
      direction: 'LR',
      groups: [{ id: 'aws', label: 'AWS account' }],
      nodes: [
        { id: 'sql', label: 'Azure SQL Database', shape: 'cylinder', inferences: [] },
        { id: 'gw', label: 'API Gateway', shape: 'rectangle', groupId: 'aws', inferences: [] },
        { id: 'gw2', label: 'API Gateway', shape: 'rectangle', inferences: [] },
        { id: 'db', label: 'database', shape: 'cylinder', inferences: [] },
        {
          id: 'mine',
          label: 'Azure SQL Database',
          shape: 'rectangle',
          inferences: [
            {
              key: 'service',
              value: 'custom.legacy-sql',
              confidence: 1,
              provenance: 'user',
              reason: 'me',
            },
          ],
        },
      ],
      edges: [],
    };
  }

  function run(options = {}) {
    const result = runTransform(recognizeServicesTransform, model(), options);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result;
  }

  const inferenceOf = (m: GraphModel, id: string, key: string) =>
    m.nodes.find((n) => n.id === id)!.inferences.find((i) => i.key === key);

  it('records certain recognitions as inferences without renaming anything', () => {
    const result = run();
    expect(inferenceOf(result.model, 'sql', 'service')).toMatchObject({
      value: 'azure.sql-database',
      confidence: 1,
      provenance: 'deterministic',
    });
    expect(inferenceOf(result.model, 'sql', 'provider')?.value).toBe('azure');
    expect(result.model.nodes.map((n) => n.label)).toEqual(model().nodes.map((n) => n.label));
  });

  it('only suggests services for ambiguous labels, using group context when present', () => {
    const result = run();
    expect(inferenceOf(result.model, 'gw', 'service')).toBeUndefined();
    const forGw = result.suggestions.filter((s) => s.elementId === 'gw');
    expect(forGw.map((s) => [s.inference.value, s.inference.confidence])).toEqual([
      ['aws.api-gateway', 0.8],
    ]);
    const forGw2 = result.suggestions.filter((s) => s.elementId === 'gw2');
    expect(forGw2.map((s) => s.inference.value).sort()).toEqual([
      'aws.api-gateway',
      'gcp.api-gateway',
    ]);
  });

  it('gives generic labels a category and no service', () => {
    const result = run();
    expect(inferenceOf(result.model, 'db', 'category')?.value).toBe('database');
    expect(inferenceOf(result.model, 'db', 'service')).toBeUndefined();
  });

  it('never overwrites a service the user set', () => {
    const result = run();
    expect(inferenceOf(result.model, 'mine', 'service')?.value).toBe('custom.legacy-sql');
  });

  it('applying a suggestion records it as the user’s choice and keeps the label', () => {
    const result = run();
    const pick = result.suggestions.find(
      (s) => s.elementId === 'gw2' && s.inference.value === 'gcp.api-gateway',
    )!;
    const applied = applySuggestion(result.model, pick);
    expect(inferenceOf(applied, 'gw2', 'service')).toMatchObject({
      value: 'gcp.api-gateway',
      provenance: 'user',
    });
    expect(applied.nodes.find((n) => n.id === 'gw2')!.label).toBe('API Gateway');
    expect(serviceById('gcp.api-gateway')?.name).toBe('API Gateway');
  });

  it('is idempotent', () => {
    const once = run().model;
    const twice = runTransform(recognizeServicesTransform, once, {});
    expect(twice.ok && twice.changes).toEqual([]);
  });
});
