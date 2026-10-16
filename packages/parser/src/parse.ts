import type { Diagnostic, GraphModel, SourceRange } from '@flowforge/core';
import { validateModel } from '@flowforge/core';
import { flowDbToModel, type MermaidFlowDb } from './mermaid-flowchart.js';

export interface ParseOptions {
  /** Reject sources larger than this many UTF-16 code units. Default 1,000,000. */
  maxSourceLength?: number;
  /** Mermaid's own edge limit, enforced while parsing. Default 2,000. */
  maxEdges?: number;
}

export type ParseResult =
  | { ok: true; model: GraphModel; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

/** The parts of the `mermaid` default export we use. */
export interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  parse(text: string): Promise<{ diagramType: string } | false>;
  mermaidAPI: { getDiagramFromText(text: string): Promise<{ db: unknown }> };
}

export const DEFAULT_MAX_SOURCE_LENGTH = 1_000_000;
export const DEFAULT_MAX_EDGES = 2_000;

const FLOWCHART_TYPES = new Set(['flowchart', 'flowchart-v2', 'flowchart-elk']);

/**
 * Builds a `parse` function around a Mermaid loader. Mermaid keeps parser state in module-level
 * globals, so calls are serialised through a queue; concurrent callers never see each other's
 * diagrams.
 */
export function createParser(loadMermaid: () => Promise<MermaidApi>) {
  let mermaidPromise: Promise<MermaidApi> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  return function parse(source: string, options: ParseOptions = {}): Promise<ParseResult> {
    const run = async () => {
      mermaidPromise ??= loadMermaid();
      return parseWith(await mermaidPromise, source, options);
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  };
}

async function parseWith(
  mermaid: MermaidApi,
  source: string,
  options: ParseOptions,
): Promise<ParseResult> {
  const maxSourceLength = options.maxSourceLength ?? DEFAULT_MAX_SOURCE_LENGTH;
  if (source.length > maxSourceLength) {
    return fail({
      severity: 'error',
      code: 'source-too-large',
      message: `Source is ${source.length} characters; the limit is ${maxSourceLength}. Split the diagram or raise maxSourceLength.`,
    });
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    maxEdges: options.maxEdges ?? DEFAULT_MAX_EDGES,
  });

  let diagramType: string;
  let db: unknown;
  try {
    const detected = await mermaid.parse(source);
    if (detected === false)
      return fail(syntaxDiagnostic(new Error('Mermaid rejected the source.')));
    diagramType = detected.diagramType;
    if (!FLOWCHART_TYPES.has(diagramType)) {
      return fail({
        severity: 'error',
        code: 'diagram-type-unsupported',
        message: `"${diagramType}" diagrams are not supported yet. Supported: flowchart, graph.`,
      });
    }
    db = (await mermaid.mermaidAPI.getDiagramFromText(source)).db;
  } catch (error) {
    return fail(syntaxDiagnostic(error));
  }

  const { model, diagnostics } = flowDbToModel(db as MermaidFlowDb);
  const validation = validateModel(model);
  // Mermaid accepted it, so a validation failure here is an adapter bug, not user error.
  if (!validation.ok) {
    return {
      ok: false,
      diagnostics: validation.diagnostics.map((d) => ({
        ...d,
        code: `adapter-${d.code}`,
        message: `Internal adapter error: ${d.message}`,
      })),
    };
  }
  return {
    ok: true,
    model: validation.model,
    diagnostics: [...diagnostics, ...validation.diagnostics],
  };
}

function fail(diagnostic: Diagnostic): ParseResult {
  return { ok: false, diagnostics: [diagnostic] };
}

interface MermaidErrorHash {
  line?: number;
  loc?: { first_line: number; last_line: number; first_column: number; last_column: number };
}

function syntaxDiagnostic(error: unknown): Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Edge limit exceeded')) {
    return {
      severity: 'error',
      code: 'edge-limit-exceeded',
      message: `${message.split('\n')[0]} Raise the maxEdges option if this diagram is expected.`,
    };
  }
  const hash = (error as { hash?: MermaidErrorHash } | null)?.hash;
  const range = toRange(hash);
  return {
    severity: 'error',
    code: 'syntax-error',
    message: message.trim(),
    ...(range === undefined ? {} : { range }),
  };
}

/**
 * Mermaid's parse errors carry `loc` (1-based lines, 0-based columns); its lexer errors carry
 * only a 0-based `line`. The model uses 1-based lines and columns.
 */
function toRange(hash: MermaidErrorHash | undefined): SourceRange | undefined {
  if (hash?.loc) {
    return {
      startLine: hash.loc.first_line,
      startColumn: hash.loc.first_column + 1,
      endLine: hash.loc.last_line,
      endColumn: hash.loc.last_column + 1,
    };
  }
  if (typeof hash?.line === 'number') {
    const line = hash.line + 1;
    return { startLine: line, startColumn: 1, endLine: line, endColumn: 1 };
  }
  return undefined;
}
