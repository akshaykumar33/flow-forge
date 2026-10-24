/**
 * The only module that reads Mermaid's internal flowchart database (ADR-0004). Everything Mermaid
 * calls a "vertex", "link" or "subgraph" is translated to the FlowForge model here, so a Mermaid
 * upgrade that renames internals breaks this file and its compatibility tests, nothing else.
 */
import type {
  ArrowHead,
  Diagnostic,
  Direction,
  GraphEdge,
  GraphGroup,
  GraphModel,
  GraphNode,
  NodeShape,
} from '@flowforge/core';
import { MODEL_VERSION } from '@flowforge/core';

/** The subset of Mermaid's FlowDB we rely on, typed by observation of mermaid@12.2.0. */
export interface MermaidFlowDb {
  getVertices(): Map<string, { id: string; text?: string; type?: string }>;
  getEdges(): {
    id?: string;
    start: string;
    end: string;
    text?: string;
    type?: string;
    stroke?: string;
  }[];
  getSubGraphs(): { id: string; title?: string; nodes: string[]; dir?: string }[];
  getDirection(): string | undefined;
}

const SHAPES: Record<string, NodeShape> = {
  square: 'rectangle',
  rect: 'rectangle',
  round: 'rounded',
  rounded: 'rounded',
  stadium: 'stadium',
  subroutine: 'subroutine',
  cylinder: 'cylinder',
  circle: 'circle',
  doublecircle: 'double-circle',
  odd: 'asymmetric',
  diamond: 'diamond',
  hexagon: 'hexagon',
  lean_right: 'parallelogram',
  lean_left: 'parallelogram-alt',
  trapezoid: 'trapezoid',
  inv_trapezoid: 'trapezoid-alt',
};

const ARROW_HEADS: Record<string, ArrowHead> = {
  point: 'arrow',
  circle: 'circle',
  cross: 'cross',
  open: 'none',
};

const STROKES: Record<string, GraphEdge['stroke']> = {
  normal: 'solid',
  thick: 'thick',
  dotted: 'dotted',
  invisible: 'invisible',
};

export function flowDbToModel(db: MermaidFlowDb): { model: GraphModel; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const subgraphs = db.getSubGraphs();
  const groupIds = new Set(subgraphs.map((s) => s.id));

  // Mermaid lists inner subgraphs first, and a node it places in several subgraphs belongs to
  // the first (innermost) one, so first assignment wins.
  const parentOf = new Map<string, string>();
  for (const subgraph of subgraphs) {
    for (const member of subgraph.nodes) {
      if (!parentOf.has(member)) parentOf.set(member, subgraph.id);
    }
  }

  const groups: GraphGroup[] = subgraphs.map((s) => {
    const direction = toDirection(s.dir);
    return {
      id: s.id,
      label: decodeEntities(s.title ?? s.id),
      ...optional('parentId', parentOf.get(s.id)),
      ...optional('direction', direction),
    };
  });

  const nodes: GraphNode[] = [];
  for (const vertex of db.getVertices().values()) {
    // An edge that targets a subgraph makes Mermaid also register a vertex with that id.
    if (groupIds.has(vertex.id)) continue;
    nodes.push({
      id: vertex.id,
      label: decodeEntities(vertex.text ?? vertex.id),
      shape: toShape(vertex, diagnostics),
      ...optional('groupId', parentOf.get(vertex.id)),
      inferences: [],
    });
  }

  const edges: GraphEdge[] = db.getEdges().map((edge, index) => {
    const [arrowStart, arrowEnd] = toArrowHeads(edge.type);
    return {
      id: edge.id ?? `L_${edge.start}_${edge.end}_${index}`,
      source: edge.start,
      target: edge.end,
      label: decodeEntities(edge.text ?? ''),
      stroke: STROKES[edge.stroke ?? 'normal'] ?? 'solid',
      arrowStart,
      arrowEnd,
    };
  });

  return {
    model: {
      version: MODEL_VERSION,
      diagramType: 'flowchart',
      direction: toDirection(db.getDirection()) ?? 'TB',
      nodes,
      edges,
      groups,
    },
    diagnostics,
  };
}

function toShape(vertex: { id: string; type?: string }, diagnostics: Diagnostic[]): NodeShape {
  if (vertex.type === undefined) return 'rectangle';
  const shape = SHAPES[vertex.type];
  if (shape !== undefined) return shape;
  diagnostics.push({
    severity: 'warning',
    code: 'shape-unsupported',
    message: `Shape "${vertex.type}" on node "${vertex.id}" is not supported yet; it will render as a generic box.`,
    elementId: vertex.id,
  });
  return 'unknown';
}

/** Mermaid encodes both ends in one string: `arrow_point`, `double_arrow_circle`, ... */
function toArrowHeads(type: string | undefined): [ArrowHead, ArrowHead] {
  const match = /^(double_)?arrow_(\w+)$/.exec(type ?? 'arrow_point');
  const head = ARROW_HEADS[match?.[2] ?? 'point'] ?? 'arrow';
  return [match?.[1] ? head : 'none', head];
}

function toDirection(dir: string | undefined): Direction | undefined {
  switch (dir) {
    case 'TB':
    case 'TD':
      return 'TB';
    case 'BT':
    case 'LR':
    case 'RL':
      return dir;
    default:
      return undefined;
  }
}

/** Mermaid HTML-escapes label text; the model stores plain text and renderers escape on output. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Omits the key entirely when undefined, as `exactOptionalPropertyTypes` requires. */
function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
