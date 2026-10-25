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
  'cloud-architecture': {
    id: 'cloud-architecture',
    name: 'Cloud architecture',
    fontFamily: FONT_STACK,
    background: '#0a1628',
    nodeFill: '#10223d',
    nodeStroke: '#3d8bd9',
    nodeText: '#e8f1fc',
    groupFill: '#0d1d35',
    groupStroke: '#2c5a8f',
    groupTitle: '#8fb8e8',
    edge: '#5fa8e8',
    edgeLabelFill: '#0a1628',
    edgeLabelText: '#b9d4f2',
    accent: '#22d3ee',
    strokeWidth: 1.25,
  },
  blueprint: {
    id: 'blueprint',
    name: 'Blueprint',
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, ui-monospace, monospace",
    background: '#123a6b',
    nodeFill: '#123a6b',
    nodeStroke: '#dbe8f7',
    nodeText: '#ffffff',
    groupFill: '#164478',
    groupStroke: '#9fc0e6',
    groupTitle: '#e3eefa',
    edge: '#dbe8f7',
    edgeLabelFill: '#123a6b',
    edgeLabelText: '#ffffff',
    accent: '#ffd166',
    strokeWidth: 1.25,
  },
  'minimal-technical': {
    id: 'minimal-technical',
    name: 'Minimal technical',
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, ui-monospace, monospace",
    background: '#ffffff',
    nodeFill: '#ffffff',
    nodeStroke: '#6b6b6b',
    nodeText: '#1a1a1a',
    groupFill: '#fafafa',
    groupStroke: '#c4c4c4',
    groupTitle: '#4a4a4a',
    edge: '#6b6b6b',
    edgeLabelFill: '#ffffff',
    edgeLabelText: '#3d3d3d',
    accent: '#1a1a1a',
    strokeWidth: 1,
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
