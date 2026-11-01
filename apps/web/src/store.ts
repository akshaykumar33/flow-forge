import { create } from 'zustand';
import type { Diagnostic, GraphModel } from '@flowforge/core';
import type { ThemeId } from '@flowforge/renderer';
import { EXAMPLES } from './examples';

export type BottomTab = 'source' | 'problems';

interface EditorState {
  source: string;
  theme: ThemeId;
  model?: GraphModel;
  svg?: string;
  size?: { width: number; height: number };
  diagnostics: Diagnostic[];
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
  }): void;
  setBusy(busy: boolean): void;
  select(id: string | undefined): void;
  setBottomTab(tab: BottomTab): void;
}

export const useEditor = create<EditorState>((set) => ({
  source: EXAMPLES[0]!.source,
  theme: 'enterprise-dark',
  diagnostics: [],
  busy: true,
  bottomTab: 'source',
  setSource: (source) => set({ source }),
  setTheme: (theme) => set({ theme }),
  // A failed parse keeps the last good diagram on screen, so a typo never blanks the canvas.
  setResult: ({ model, svg, size, diagnostics }) =>
    set((state) => ({
      diagnostics,
      busy: false,
      ...(model && { model }),
      ...(svg !== undefined && { svg, size }),
      selectedId: model?.nodes.some((n) => n.id === state.selectedId)
        ? state.selectedId
        : undefined,
    })),
  setBusy: (busy) => set({ busy }),
  select: (selectedId) => set({ selectedId }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
}));
