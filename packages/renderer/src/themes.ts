/** Every colour the renderer paints. Themes are plain data so users can supply their own. */
export interface Theme {
  id: string;
  name: string;
  fontFamily: string;
  background: string;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  groupFill: string;
  groupStroke: string;
  groupTitle: string;
  edge: string;
  edgeLabelFill: string;
  edgeLabelText: string;
  /** Outline for selected or highlighted elements, used by interactive renderers. */
  accent: string;
  strokeWidth: number;
}

/**
 * Local fonts only: rendering never fetches anything, so exported SVGs work offline and leak no
 * request to a font host.
 */
const FONT_STACK = "'IBM Plex Sans', 'Segoe UI', system-ui, -apple-system, sans-serif";

export const themes = {
  'enterprise-light': {
    id: 'enterprise-light',
    name: 'Enterprise light',
    fontFamily: FONT_STACK,
    background: '#ffffff',
    nodeFill: '#f8fafc',
    nodeStroke: '#748297',
    nodeText: '#0f172a',
    groupFill: '#f1f5f9',
    groupStroke: '#cbd5e1',
    groupTitle: '#334155',
    edge: '#64748b',
    edgeLabelFill: '#ffffff',
    edgeLabelText: '#334155',
    accent: '#0284c7',
    strokeWidth: 1.25,
  },
  'enterprise-dark': {
    id: 'enterprise-dark',
    name: 'Enterprise dark',
    fontFamily: FONT_STACK,
    background: '#0b0e13',
    nodeFill: '#161b24',
    nodeStroke: '#636f82',
    nodeText: '#e6eaf0',
    groupFill: '#11161e',
    groupStroke: '#2e3746',
    groupTitle: '#98a2b3',
    edge: '#7b8696',
    edgeLabelFill: '#0b0e13',
    edgeLabelText: '#c3cad5',
    accent: '#38bdf8',
    strokeWidth: 1.25,
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'High contrast',
    fontFamily: FONT_STACK,
    background: '#ffffff',
    nodeFill: '#ffffff',
    nodeStroke: '#000000',
    nodeText: '#000000',
    groupFill: '#ffffff',
    groupStroke: '#000000',
    groupTitle: '#000000',
    edge: '#000000',
    edgeLabelFill: '#ffffff',
    edgeLabelText: '#000000',
    accent: '#0000cc',
    strokeWidth: 2,
  },
} as const satisfies Record<string, Theme>;

export type ThemeId = keyof typeof themes;
