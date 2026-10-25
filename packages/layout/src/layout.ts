import elkModule from 'elkjs/lib/elk.bundled.js';
import type { ELK, ElkEdgeSection, ElkExtendedEdge, ElkLabel, ElkNode } from 'elkjs/lib/elk-api.js';
import type { Diagnostic, Direction, GraphModel, GraphNode, NodeShape } from '@flowforge/core';
import { estimateTextWidth, lineHeight, wrapText } from './text.js';
import type {
  EdgeLayout,
  GroupLayout,
  LayoutResult,
  MeasureText,
  NodeLayout,
  Point,
  TextStyle,
} from './types.js';

export interface LayoutOptions {
  measureText?: MeasureText;
  nodeFont?: TextStyle;
  edgeLabelFont?: TextStyle;
  groupTitleFont?: TextStyle;
  /** Space between nodes in the same layer. Default 40. */
  nodeSpacing?: number;
  /** Space between layers. Default 64. */
  layerSpacing?: number;
  /** Labels wider than this wrap. Default 200. */
  maxLabelWidth?: number;
}

export interface LayoutOutput {
  layout: LayoutResult;
  diagnostics: Diagnostic[];
}

const ELK_DIRECTION: Record<Direction, string> = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
};

const PADDING_X = 16;
const PADDING_Y = 12;
const MIN_NODE = { width: 96, height: 44 };
const GROUP_PADDING = 20;

// elkjs is CommonJS: Node's ESM loader returns `module.exports` (the class itself), some bundlers
// return `{ default }`, and its typings describe neither under NodeNext. Accept both shapes and
// type the result with elkjs's own `ELK` interface.
type ElkConstructor = new () => ELK;
const loaded = elkModule as unknown as ElkConstructor & { default?: ElkConstructor };
const Elk: ElkConstructor = loaded.default ?? loaded;
let sharedElk: ELK | undefined;

/**
 * Computes positions, sizes, edge routes and label boxes for a model. Pure apart from awaiting
 * ELK: the same model and options always give the same geometry (ADR-0006).
 */
export async function layoutModel(
  model: GraphModel,
  options: LayoutOptions = {},
): Promise<LayoutOutput> {
  const measure = options.measureText ?? estimateTextWidth;
  const nodeFont = options.nodeFont ?? { fontSize: 14, fontWeight: 500 };
  const edgeFont = options.edgeLabelFont ?? { fontSize: 12, fontWeight: 400 };
  const titleFont = options.groupTitleFont ?? { fontSize: 12, fontWeight: 600 };
  const maxLabelWidth = options.maxLabelWidth ?? 200;
  const diagnostics: Diagnostic[] = [];

  const nodeLines = new Map<string, string[]>();
  const elkNodes = new Map<string, ElkNode>();
  for (const node of model.nodes) {
    const lines = wrapText(node.label, maxLabelWidth, nodeFont, measure);
    nodeLines.set(node.id, lines);
    elkNodes.set(node.id, { id: node.id, ...nodeSize(node, lines, nodeFont, measure) });
  }

  const groupTitles = new Map<string, string[]>();
  for (const group of model.groups) {
    const lines = wrapText(group.label, maxLabelWidth * 1.5, titleFont, measure);
    groupTitles.set(group.id, lines);
    const titleHeight = lines.length * lineHeight(titleFont) + 12;
    const titleWidth = Math.max(...lines.map((l) => measure(l, titleFont))) + GROUP_PADDING * 2;
    elkNodes.set(group.id, {
      id: group.id,
      layoutOptions: {
        'elk.padding': `[top=${GROUP_PADDING + titleHeight},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${titleWidth}, ${titleHeight + GROUP_PADDING})`,
      },
      children: [],
    });
    if (group.direction !== undefined && group.direction !== model.direction) {
      diagnostics.push({
        severity: 'info',
        code: 'layout-group-direction-ignored',
        message: `Group "${group.id}" asks for direction ${group.direction}; the whole diagram is laid out ${model.direction} so edges between groups stay routable.`,
        elementId: group.id,
      });
    }
  }

  const root: ElkNode = {
    id: '__root__',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': ELK_DIRECTION[model.direction],
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.json.shapeCoords': 'ROOT',
      'elk.json.edgeCoords': 'ROOT',
      'elk.spacing.nodeNode': String(options.nodeSpacing ?? 40),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(options.layerSpacing ?? 64),
      'elk.spacing.edgeNode': '20',
      'elk.spacing.edgeEdge': '12',
      'elk.spacing.edgeLabel': '6',
      'elk.layered.spacing.edgeNodeBetweenLayers': '20',
      'elk.edgeLabels.placement': 'CENTER',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: [],
    edges: [],
  };

  const childrenOf = (id: string | undefined) => (id ? elkNodes.get(id)! : root).children!;
  // Groups first, in model order, so nested groups attach to parents that already exist.
  for (const group of model.groups) childrenOf(group.parentId).push(elkNodes.get(group.id)!);
  for (const node of model.nodes) childrenOf(node.groupId).push(elkNodes.get(node.id)!);

  const edgeLabelLines = new Map<string, string[]>();
  root.edges = model.edges.map((edge): ElkExtendedEdge => {
    const labels: ElkLabel[] = [];
    if (edge.label !== '') {
      const lines = wrapText(edge.label, maxLabelWidth * 0.75, edgeFont, measure);
      edgeLabelLines.set(edge.id, lines);
      labels.push({
        id: `${edge.id}__label`,
        text: edge.label,
        width: Math.max(...lines.map((l) => measure(l, edgeFont))) + 8,
        height: lines.length * lineHeight(edgeFont) + 4,
      });
    }
    return { id: edge.id, sources: [edge.source], targets: [edge.target], labels };
  });

  sharedElk ??= new Elk();
  const result = await sharedElk.layout(root);

  const placed = new Map<string, ElkNode>();
  const collect = (node: ElkNode) => {
    placed.set(node.id, node);
    node.children?.forEach(collect);
  };
  collect(result);
  const placedEdges = new Map((result.edges ?? []).map((e) => [e.id, e]));

  const nodes: Record<string, NodeLayout> = {};
  for (const node of model.nodes) {
    nodes[node.id] = { ...box(placed.get(node.id)!), lines: nodeLines.get(node.id)! };
  }

  const groups: Record<string, GroupLayout> = {};
  for (const group of model.groups) {
    const g = box(placed.get(group.id)!);
    const lines = groupTitles.get(group.id)!;
    groups[group.id] = {
      ...g,
      title: {
        x: g.x + GROUP_PADDING,
        y: g.y + 10,
        width: Math.max(...lines.map((l) => measure(l, titleFont))),
        height: lines.length * lineHeight(titleFont),
        lines,
      },
    };
  }

  const edges: Record<string, EdgeLayout> = {};
  for (const edge of model.edges) {
    const placedEdge = placedEdges.get(edge.id)!;
    const points = (placedEdge.sections ?? []).flatMap(sectionPoints);
    const label = placedEdge.labels?.[0];
    edges[edge.id] = {
      points: dedupe(points),
      ...(label && {
        label: {
          x: round(label.x ?? 0),
          y: round(label.y ?? 0),
          width: label.width ?? 0,
          height: label.height ?? 0,
          lines: edgeLabelLines.get(edge.id)!,
        },
      }),
    };
  }

  return {
    layout: {
      width: round(result.width ?? 0),
      height: round(result.height ?? 0),
      nodes,
      edges,
      groups,
    },
    diagnostics,
  };
}

function nodeSize(
  node: GraphNode,
  lines: string[],
  font: TextStyle,
  measure: MeasureText,
): { width: number; height: number } {
  const textWidth = Math.max(...lines.map((l) => measure(l, font)));
  const textHeight = lines.length * lineHeight(font);
  const width = Math.max(MIN_NODE.width, textWidth + PADDING_X * 2);
  const height = Math.max(MIN_NODE.height, textHeight + PADDING_Y * 2);
  return scaleForShape(node.shape, width, height, textWidth, textHeight);
}

/** Shapes whose drawable interior is smaller than their box need a larger box for the text. */
function scaleForShape(
  shape: NodeShape,
  width: number,
  height: number,
  textWidth: number,
  textHeight: number,
): { width: number; height: number } {
  switch (shape) {
    case 'circle':
    case 'double-circle': {
      // Text box inscribed in the circle: diameter = diagonal of the text box plus padding.
      const d = Math.ceil(
        Math.hypot(textWidth, textHeight) + (shape === 'double-circle' ? 28 : 20),
      );
      return { width: Math.max(d, 56), height: Math.max(d, 56) };
    }
    case 'diamond':
      // A rhombus fits a centred rectangle of half its width and height.
      return {
        width: Math.ceil(textWidth * 2 + 24),
        height: Math.ceil(Math.max(textHeight * 2 + 16, 64)),
      };
    case 'hexagon':
    case 'parallelogram':
    case 'parallelogram-alt':
    case 'trapezoid':
    case 'trapezoid-alt':
    case 'asymmetric':
      return { width: width + Math.ceil(height / 2), height };
    case 'cylinder':
      return { width, height: height + 16 };
    case 'stadium':
      return { width: width + Math.ceil(height / 2), height };
    case 'subroutine':
      return { width: width + 16, height };
    default:
      return { width, height };
  }
}

function sectionPoints(section: ElkEdgeSection): Point[] {
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((p) => ({
    x: round(p.x),
    y: round(p.y),
  }));
}

function dedupe(points: Point[]): Point[] {
  return points.filter((p, i) => i === 0 || p.x !== points[i - 1]!.x || p.y !== points[i - 1]!.y);
}

function box(node: ElkNode) {
  return {
    x: round(node.x ?? 0),
    y: round(node.y ?? 0),
    width: round(node.width ?? 0),
    height: round(node.height ?? 0),
  };
}

/** Two decimals: removes float noise like 58.666666 so output is stable and compact. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
