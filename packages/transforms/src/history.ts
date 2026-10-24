import type { GraphModel } from '@flowforge/core';
import type { Change } from './diff.js';

export interface HistoryEntry {
  /** Transform id, or `suggestion` / `manual` for user actions. */
  source: string;
  summary: string;
  changes: Change[];
  model: GraphModel;
}

/**
 * Immutable edit history. `original` is never replaced, so revert is always possible. Recording
 * after an undo discards the undone entries, as in any editor.
 */
export interface History {
  readonly original: GraphModel;
  readonly entries: readonly HistoryEntry[];
  /** Number of entries currently applied; `0` means the original. */
  readonly position: number;
}

export function createHistory(original: GraphModel): History {
  return { original, entries: [], position: 0 };
}

export function currentModel(history: History): GraphModel {
  return history.position === 0 ? history.original : history.entries[history.position - 1]!.model;
}

export function record(history: History, entry: HistoryEntry): History {
  if (entry.changes.length === 0) return history;
  return {
    ...history,
    entries: [...history.entries.slice(0, history.position), entry],
    position: history.position + 1,
  };
}

export const canUndo = (history: History) => history.position > 0;
export const canRedo = (history: History) => history.position < history.entries.length;

export function undo(history: History): History {
  return canUndo(history) ? { ...history, position: history.position - 1 } : history;
}

export function redo(history: History): History {
  return canRedo(history) ? { ...history, position: history.position + 1 } : history;
}

/** Back to the original source model. Entries are kept, so the revert itself can be redone. */
export function revert(history: History): History {
  return { ...history, position: 0 };
}
