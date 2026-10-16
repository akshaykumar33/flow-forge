import type { GraphModel } from './model.js';
import { validateModel, type ValidationResult } from './validate.js';

/**
 * Deterministic JSON: object keys sorted, arrays kept in source order (order carries meaning,
 * e.g. layout ranking), two-space indent, trailing newline. Equal models give identical bytes.
 */
export function serializeModel(model: GraphModel): string {
  return JSON.stringify(sortKeys(model), null, 2) + '\n';
}

/** Parses and validates serialised JSON. Never throws on bad input. */
export function deserializeModel(json: string): ValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return {
      ok: false,
      diagnostics: [
        { severity: 'error', code: 'json-invalid', message: `Invalid JSON: ${reason}` },
      ],
    };
  }
  return validateModel(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}
