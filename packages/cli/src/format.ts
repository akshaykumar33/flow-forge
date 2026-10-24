import type { Diagnostic } from '@flowforge/core';

/**
 * `file:line:col: severity code: message` on one line, the shape editors and CI annotators
 * recognise. Mermaid's multi-line messages put a source excerpt in the middle and the reason
 * ("Expecting ..., got ...") last, so the first and last lines are kept.
 */
export function formatDiagnostic(file: string, d: Diagnostic): string {
  const location = d.range ? `${file}:${d.range.startLine}:${d.range.startColumn}` : file;
  const lines = d.message.split('\n').map((line) => line.trim());
  const summary = lines.length > 1 ? `${lines[0]} ${lines[lines.length - 1]}` : lines[0];
  return `${location}: ${d.severity} ${d.code}: ${summary}\n`;
}

export function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}
