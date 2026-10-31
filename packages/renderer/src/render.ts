import type { ArrowHead, GraphEdge, GraphModel } from '@flowforge/core';
import { lineHeight, type LayoutResult, type TextStyle } from '@flowforge/layout';
import { color, escapeXml, num } from './escape.js';
import { shapeMarkup } from './shapes.js';
import { themes, type Theme, type ThemeId } from './themes.js';

export interface RenderOptions {
  /** A built-in theme id or a full custom theme. Default `enterprise-light`. */
  theme?: ThemeId | Theme;
  /** Prefix for ids inside the SVG, so several diagrams can share one HTML page. */
  idPrefix?: string;
  /** Accessible title. Default: "Flowchart". */
  title?: string;
  /** Must match the fonts used for layout, so text fits the measured boxes. */
  nodeFont?: TextStyle;
  edgeLabelFont?: TextStyle;
  groupTitleFont?: TextStyle;
  /**
   * SVG icon source per node id, drawn in the box layout reserved (`NodeLayout.icon`). Icons are
   * embedded as `<image>` data URIs, never inlined, so browsers render them in secure static
   * mode: scripts and external references inside an icon file cannot run (ADR-0007).
   */
  icons?: Readonly<Record<string, string>>;
}

/** Icons larger than this are skipped; official provider icons are a few kilobytes. */
export const MAX_ICON_BYTES = 256 * 1024;

const HEADS: Exclude<ArrowHead, 'none'>[] = ['arrow', 'circle', 'cross'];

/**
 * Renders a laid-out model to a standalone SVG document. Output contains no scripts, no
 * foreignObject, no style sheets and no external references; every model string is escaped.
 * Deterministic: the same inputs give the same bytes.
 */
export function renderSvg(
  model: GraphModel,
  layout: LayoutResult,
  options: RenderOptions = {},
): string {
  const theme = resolveTheme(options.theme);
  const prefix = (options.idPrefix ?? 'ff').replace(/[^A-Za-z0-9_-]/g, '');
  const nodeFont = options.nodeFont ?? { fontSize: 14, fontWeight: 500 };
  const edgeFont = options.edgeLabelFont ?? { fontSize: 12, fontWeight: 400 };
  const titleFont = options.groupTitleFont ?? { fontSize: 12, fontWeight: 600 };
  const title = options.title ?? 'Flowchart';
  const width = Math.ceil(layout.width);
  const height = Math.ceil(layout.height);

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" font-family="${escapeXml(theme.fontFamily)}">`,
    `<title id="${prefix}-title">${escapeXml(title)}</title>`,
    `<desc id="${prefix}-desc">${escapeXml(describe(model))}</desc>`,
    `<defs>${markers(prefix, theme)}</defs>`,
    `<rect width="100%" height="100%" fill="${theme.background}"/>`,
  );

  // Outer groups first so nested groups paint on top of their parents.
  const depth = groupDepths(model);
  const groups = [...model.groups].sort((a, b) => depth.get(a.id)! - depth.get(b.id)!);
  out.push('<g class="ff-groups">');
  for (const group of groups) {
    const box = layout.groups[group.id]!;
    out.push(
      `<g data-group-id="${escapeXml(group.id)}">`,
      `<title>${escapeXml(group.label)}</title>`,
      `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" height="${num(box.height)}" rx="10" fill="${theme.groupFill}" stroke="${theme.groupStroke}" stroke-width="${num(theme.strokeWidth)}"/>`,
      textBlock(
        box.title.lines,
        box.title.x,
        box.title.y + lineHeight(titleFont) / 2,
        titleFont,
        theme.groupTitle,
        'start',
      ),
      '</g>',
    );
  }
  out.push('</g>');

  out.push('<g class="ff-edges" fill="none">');
  for (const edge of model.edges) {
    if (edge.stroke === 'invisible') continue;
    const route = layout.edges[edge.id]!;
    if (route.points.length < 2) continue;
    const d = route.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${num(p.x)} ${num(p.y)}`).join('');
    out.push(
      `<g data-edge-id="${escapeXml(edge.id)}">`,
      `<path d="${d}" stroke="${theme.edge}" ${strokeStyle(edge, theme)}${markerRefs(edge, prefix)}/>`,
      '</g>',
    );
  }
  out.push('</g>');

  out.push('<g class="ff-edge-labels">');
  for (const edge of model.edges) {
    const label = layout.edges[edge.id]!.label;
    if (!label || edge.stroke === 'invisible') continue;
    const cx = label.x + label.width / 2;
    out.push(
      `<g data-edge-id="${escapeXml(edge.id)}">`,
      `<rect x="${num(label.x)}" y="${num(label.y)}" width="${num(label.width)}" height="${num(label.height)}" rx="4" fill="${theme.edgeLabelFill}"/>`,
      textBlock(
        label.lines,
        cx,
        label.y + label.height / 2,
        edgeFont,
        theme.edgeLabelText,
        'middle',
        true,
      ),
      '</g>',
    );
  }
  out.push('</g>');

  const paint = {
    fill: `fill="${theme.nodeFill}"`,
    stroke: `stroke="${theme.nodeStroke}" stroke-width="${num(theme.strokeWidth)}"`,
  };
  out.push('<g class="ff-nodes">');
  for (const node of model.nodes) {
    const box = layout.nodes[node.id]!;
    const icon = box.icon ? options.icons?.[node.id] : undefined;
    // With an icon, the label is centred in the space below it.
    const textTop = icon && box.icon ? box.icon.y + box.icon.height + 6 : box.y;
    const textCy = textTop + (box.y + box.height - textTop) / 2;
    out.push(
      `<g data-node-id="${escapeXml(node.id)}">`,
      `<title>${escapeXml(node.label)}</title>`,
      shapeMarkup(node.shape, box, paint),
      ...(icon && box.icon ? [iconImage(icon, box.icon)].filter(Boolean) : []),
      textBlock(box.lines, box.x + box.width / 2, textCy, nodeFont, theme.nodeText, 'middle', true),
      '</g>',
    );
  }
  out.push('</g>', '</svg>');
  return out.join('\n') + '\n';
}

function resolveTheme(theme: ThemeId | Theme | undefined): Theme {
  const chosen = typeof theme === 'string' ? themes[theme] : (theme ?? themes['enterprise-light']);
  if (chosen === undefined) {
    throw new Error(
      `Unknown theme "${String(theme)}". Built-in themes: ${Object.keys(themes).join(', ')}.`,
    );
  }
  const colours = [
    'background',
    'nodeFill',
    'nodeStroke',
    'nodeText',
    'groupFill',
    'groupStroke',
    'groupTitle',
    'edge',
    'edgeLabelFill',
    'edgeLabelText',
    'accent',
  ] as const;
  for (const key of colours) color(chosen[key]);
  if (!(chosen.strokeWidth > 0 && chosen.strokeWidth < 20)) {
    throw new Error(`Theme strokeWidth must be between 0 and 20, got ${chosen.strokeWidth}.`);
  }
  return chosen;
}

function describe(model: GraphModel): string {
  const parts = [`${model.nodes.length} nodes`, `${model.edges.length} connections`];
  if (model.groups.length > 0) parts.push(`${model.groups.length} groups`);
  return `Flowchart with ${parts.join(', ')}.`;
}

function groupDepths(model: GraphModel): Map<string, number> {
  const parentOf = new Map(model.groups.map((g) => [g.id, g.parentId]));
  const depths = new Map<string, number>();
  for (const group of model.groups) {
    let depth = 0;
    for (let p = group.parentId; p !== undefined; p = parentOf.get(p)) depth++;
    depths.set(group.id, depth);
  }
  return depths;
}

/**
 * Lines centred on (x, cy) vertically. `dominant-baseline` is avoided because several SVG
 * renderers ignore it; a 0.35em offset centres cap height reliably everywhere.
 */
function textBlock(
  lines: readonly string[],
  x: number,
  cy: number,
  font: TextStyle,
  fill: string,
  anchor: 'start' | 'middle',
  centred = false,
): string {
  const lh = lineHeight(font);
  const first = centred ? cy - ((lines.length - 1) * lh) / 2 : cy;
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${num(x)}" y="${num(first + i * lh)}" dy="0.35em">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<text font-size="${font.fontSize}" font-weight="${font.fontWeight}" fill="${fill}" text-anchor="${anchor}">${tspans}</text>`;
}

function strokeStyle(edge: GraphEdge, theme: Theme): string {
  switch (edge.stroke) {
    case 'thick':
      return `stroke-width="${num(theme.strokeWidth * 2.4)}"`;
    case 'dotted':
      return `stroke-width="${num(theme.strokeWidth)}" stroke-dasharray="4 4"`;
    default:
      return `stroke-width="${num(theme.strokeWidth)}"`;
  }
}

function markerRefs(edge: GraphEdge, prefix: string): string {
  return (
    (edge.arrowEnd === 'none' ? '' : ` marker-end="url(#${prefix}-${edge.arrowEnd})"`) +
    (edge.arrowStart === 'none' ? '' : ` marker-start="url(#${prefix}-${edge.arrowStart}-start)"`)
  );
}

/**
 * One end marker and one start marker per head type, all `orient="auto"`. SVG 2's
 * `auto-start-reverse` would need only one, but resvg, older Inkscape and many PDF converters
 * ignore it and draw every head pointing right, so start markers carry a mirrored shape instead.
 */
function markers(prefix: string, theme: Theme): string {
  // Scaled to the line so heads stay readable: 12px at the default 1.25px stroke, larger for the
  // heavier high-contrast lines. Fixed 8px heads were barely visible in rendered output.
  const size = num(Math.max(12, theme.strokeWidth * 8));
  const shapes: Record<
    (typeof HEADS)[number],
    { end: string; start: string; refX: [number, number] }
  > = {
    arrow: {
      end: `<path d="M0 0L10 5L0 10z" fill="${theme.edge}"/>`,
      start: `<path d="M10 0L0 5L10 10z" fill="${theme.edge}"/>`,
      refX: [9, 1],
    },
    circle: {
      end: `<circle cx="5" cy="5" r="4" fill="${theme.background}" stroke="${theme.edge}" stroke-width="1.5"/>`,
      start: `<circle cx="5" cy="5" r="4" fill="${theme.background}" stroke="${theme.edge}" stroke-width="1.5"/>`,
      refX: [5, 5],
    },
    cross: {
      end: `<path d="M1 1L9 9M9 1L1 9" stroke="${theme.edge}" stroke-width="1.5"/>`,
      start: `<path d="M1 1L9 9M9 1L1 9" stroke="${theme.edge}" stroke-width="1.5"/>`,
      refX: [5, 5],
    },
  };
  const marker = (id: string, refX: number, body: string) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="${refX}" refY="5" markerWidth="${size}" markerHeight="${size}" markerUnits="userSpaceOnUse" orient="auto">${body}</marker>`;
  return HEADS.map((head) => {
    const s = shapes[head];
    return (
      marker(`${prefix}-${head}`, s.refX[0], s.end) +
      marker(`${prefix}-${head}-start`, s.refX[1], s.start)
    );
  }).join('');
}

/** Uniform scaling only (`xMidYMid meet`): icons are never stretched, cropped or distorted. */
function iconImage(
  svg: string,
  box: { x: number; y: number; width: number; height: number },
): string {
  const bytes = utf8(svg);
  if (bytes.length > MAX_ICON_BYTES || !/<svg[\s>]/i.test(svg)) return '';
  return `<image href="data:image/svg+xml;base64,${base64(bytes)}" x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" height="${num(box.height)}" preserveAspectRatio="xMidYMid meet"/>`;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 without Node's Buffer, so the renderer also runs in browsers and workers. */
function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += BASE64[a >> 2];
    out += BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : BASE64[c & 63];
  }
  return out;
}

/** UTF-8 bytes of a string, without TextEncoder, which ES2022 typings and some runtimes lack. */
function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}
