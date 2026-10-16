import type { SourceRange } from './model.js';

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  /** Stable machine-readable code, e.g. `edge-unknown-target`. Never reworded. */
  code: string;
  message: string;
  range?: SourceRange;
  /** Model element the diagnostic is about, when there is one. */
  elementId?: string;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
