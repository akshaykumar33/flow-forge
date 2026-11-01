import { create } from 'zustand';
import type { Diagnostic, GraphModel, Inference } from '@flowforge/core';
import type { ThemeId } from '@flowforge/renderer';
import type { Suggestion } from '@flowforge/transforms';
import { EXAMPLES } from './examples';

export type BottomTab = 'source' | 'problems';

/**
 * The user's choices about suggestions. The Mermaid source stays the single source of truth;
 * decisions are keyed by node id and re-applied after every parse, so they survive edits.
 */
export interface Decisions {
  /** Accepted service per node id, recorded with provenance "user". */
  accepted: Readonly<Record<string, Inference>>;
  /** Suggestions dismissed, as `nodeId|value`, so they do not come back after the next edit. */
  ignored: readonly string[];
}

export const suggestionKey = (s: Suggestion) => `${s.elementId}|${s.inference.value}`;

const EMPTY: Decisions = { accepted: {}, ignored: [] };
/** Undo depth; older decisions drop off. */
const MAX_HISTORY = 100;

interface EditorState {
  source: string;
  theme: ThemeId;
  model?: GraphModel;
  svg?: string;
  size?: { width: number; height: number };
  diagnostics: Diagnostic[];
  suggestions: Suggestion[];
  decisions: Decisions;
  past: Decisions[];
  future: Decisions[];
  busy: boolean;
  selectedId?: string;
  bottomTab: BottomTab;
  setSource(source: string): void;
  setTheme(theme: ThemeId): void;
  setResult(result: {
    model?: GraphModel;
    svg?: string;
    size?: { width: number; height: number };
    diagnostics: Diagnostic[];
    suggestions?: Suggestion[];
  }): void;
  setBusy(busy: boolean): void;
  select(id: string | undefined): void;
  setBottomTab(tab: BottomTab): void;
  accept(suggestion: Suggestion): void;
  ignore(suggestion: Suggestion): void;
  undo(): void;
  redo(): void;
}

export const useEditor = create<EditorState>((set) => {
  /** Records a new decision state; a fresh change clears the redo stack, as in any editor. */
  const decide = (next: (d: Decisions) => Decisions) =>
    set((state) => ({
      past: [...state.past, state.decisions].slice(-MAX_HISTORY),
      future: [],
      decisions: next(state.decisions),
    }));

  return {
    source: EXAMPLES[0]!.source,
    theme: 'enterprise-dark',
    diagnostics: [],
    suggestions: [],
    decisions: EMPTY,
    past: [],
    future: [],
    busy: true,
    bottomTab: 'source',
    setSource: (source) => set({ source }),
    setTheme: (theme) => set({ theme }),
    // A failed parse keeps the last good diagram on screen, so a typo never blanks the canvas.
    setResult: ({ model, svg, size, diagnostics, suggestions }) =>
      set((state) => ({
        diagnostics,
        busy: false,
        ...(model && { model }),
        ...(svg !== undefined && { svg, size }),
        ...(suggestions && { suggestions }),
        selectedId: model?.nodes.some((n) => n.id === state.selectedId)
          ? state.selectedId
          : undefined,
      })),
    setBusy: (busy) => set({ busy }),
    select: (selectedId) => set({ selectedId }),
    setBottomTab: (bottomTab) => set({ bottomTab }),
    accept: (s) =>
      decide((d) => ({
        ...d,
        accepted: { ...d.accepted, [s.elementId]: { ...s.inference, provenance: 'user' } },
      })),
    ignore: (s) => decide((d) => ({ ...d, ignored: [...d.ignored, suggestionKey(s)] })),
    undo: () =>
      set((state) =>
        state.past.length === 0
          ? state
          : {
              past: state.past.slice(0, -1),
              future: [state.decisions, ...state.future],
              decisions: state.past[state.past.length - 1]!,
            },
      ),
    redo: () =>
      set((state) =>
        state.future.length === 0
          ? state
          : {
              past: [...state.past, state.decisions],
              future: state.future.slice(1),
              decisions: state.future[0]!,
            },
      ),
  };
});
