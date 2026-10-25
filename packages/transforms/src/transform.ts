import { validateModel, type Diagnostic, type GraphModel, type Inference } from '@flowforge/core';
import { diffModels, structuralChanges, type Change } from './diff.js';

/**
 * A proposal a transform is not confident enough to apply. Only `applySuggestion` (an explicit
 * user action) writes it into the model.
 */
export interface Suggestion {
  transformId: string;
  /** Node the suggestion applies to. */
  elementId: string;
  /** New label, when the suggestion renames the node. Omitted to only attach the inference. */
  label?: string;
  inference: Inference;
}

export interface TransformOutput {
  model: GraphModel;
  suggestions?: Suggestion[];
  diagnostics?: Diagnostic[];
}

export interface Transform<Options = void> {
  /** Stable kebab-case id, recorded in history. */
  id: string;
  description: string;
  /** Must be pure: same model and options give the same output, and the input is not mutated. */
  apply(model: GraphModel, options: Options): TransformOutput;
}

export type TransformResult =
  | {
      ok: true;
      model: GraphModel;
      changes: Change[];
      suggestions: Suggestion[];
      diagnostics: Diagnostic[];
    }
  | { ok: false; diagnostics: Diagnostic[] };

/**
 * Runs a transform and enforces the contract every transform shares: the output is a valid model
 * and the graph's structure (elements, endpoints, nesting, direction) is untouched. A transform
 * that breaks either rule is rejected and the input model stands.
 */
export function runTransform<Options>(
  transform: Transform<Options>,
  model: GraphModel,
  options: Options,
): TransformResult {
  // The model is plain JSON, so a JSON round-trip is a full copy and needs no DOM or Node API.
  // Transforms get the copy, so one that mutates its input cannot corrupt the caller's model.
  const input = JSON.parse(JSON.stringify(model)) as GraphModel;
  let output: TransformOutput;
  try {
    output = transform.apply(input, options);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(transform.id, 'transform-threw', `Transform "${transform.id}" failed: ${reason}`);
  }

  if (output.diagnostics?.some((d) => d.severity === 'error')) {
    return { ok: false, diagnostics: output.diagnostics };
  }

  const validation = validateModel(output.model);
  if (!validation.ok) {
    const details = validation.diagnostics.map((d) => d.message).join('; ');
    return fail(
      transform.id,
      'transform-invalid-output',
      `Transform "${transform.id}" produced an invalid model: ${details}`,
    );
  }

  const changes = diffModels(model, validation.model);
  const structural = structuralChanges(changes);
  if (structural.length > 0) {
    const what = structural.map((c) => `${c.type} ${c.kind} "${c.id}"`).join(', ');
    return fail(
      transform.id,
      'transform-changed-structure',
      `Transform "${transform.id}" tried to change the graph structure (${what}). Transforms may only change presentation.`,
    );
  }

  return {
    ok: true,
    model: validation.model,
    changes,
    suggestions: output.suggestions ?? [],
    diagnostics: output.diagnostics ?? [],
  };
}

/** Writes one suggestion into the model, recording its inference. Never mutates the input. */
export function applySuggestion(model: GraphModel, suggestion: Suggestion): GraphModel {
  return {
    ...model,
    nodes: model.nodes.map((node) =>
      node.id === suggestion.elementId
        ? {
            ...node,
            ...(suggestion.label !== undefined && { label: suggestion.label }),
            inferences: [
              ...node.inferences.filter((i) => i.key !== suggestion.inference.key),
              { ...suggestion.inference, provenance: 'user' as const },
            ],
          }
        : node,
    ),
  };
}

function fail(transformId: string, code: string, message: string): TransformResult {
  return { ok: false, diagnostics: [{ severity: 'error', code, message, elementId: transformId }] };
}
