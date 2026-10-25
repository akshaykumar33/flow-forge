import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GraphModel } from '@flowforge/core';
import { layoutModel } from '@flowforge/layout';
import { parse } from '@flowforge/parser';
import { escapeXml, renderSvg, themes, type Theme, type ThemeId } from '../src/index.js';

const fixture = (name: string) =>
  readFileSync(new URL(`../../parser/test/fixtures/${name}.mmd`, import.meta.url), 'utf8');

async function parseOk(source: string): Promise<GraphModel> {
  const result = await parse(source);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.model;
}

async function render(source: string, theme?: ThemeId | Theme) {
  const model = await parseOk(source);
  const { layout } = await layoutModel(model);
  return { model, svg: renderSvg(model, layout, theme === undefined ? {} : { theme }) };
}

/** Parses as strict XML; throws on any well-formedness error. */
function parseSvg(svg: string): Document {
  const doc = new new JSDOM('').window.DOMParser().parseFromString(svg, 'image/svg+xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error(`Invalid SVG: ${error.textContent}`);
  return doc;
}

beforeAll(() => parse('flowchart LR\n  warm --> up'), 30_000);

const FIXTURES = ['basic', 'azure-architecture', 'kitchen-sink', 'html-labels', 'entity-codes'];
const THEME_IDS = Object.keys(themes) as ThemeId[];

describe('renderSvg output', () => {
  it.each(FIXTURES)('%s: well-formed SVG with every node, edge and group', async (name) => {
    const { model, svg } = await render(fixture(name));
    const doc = parseSvg(svg);
    expect(doc.querySelectorAll('[data-node-id]')).toHaveLength(model.nodes.length);
    expect(doc.querySelectorAll('[data-group-id]')).toHaveLength(model.groups.length);
    const visibleEdges = model.edges.filter((e) => e.stroke !== 'invisible');
    expect(doc.querySelectorAll('.ff-edges [data-edge-id]')).toHaveLength(visibleEdges.length);
  });

  it('draws node text exactly as the layout wrapped it', async () => {
    const long = 'Customer order processing service with retries';
    const model = await parseOk(`flowchart LR\n  a[${long}] --> b\n`);
    const { layout } = await layoutModel(model);
    const doc = parseSvg(renderSvg(model, layout));
    const tspans = [...doc.querySelectorAll('[data-node-id="a"] tspan')].map((t) => t.textContent);
    expect(tspans).toEqual(layout.nodes.a!.lines);
  });

  it('is accessible: titled, described, and one title per node', async () => {
    const { svg } = await render(fixture('azure-architecture'));
    const doc = parseSvg(svg);
    const root = doc.documentElement;
    expect(root.getAttribute('role')).toBe('img');
    expect(doc.getElementById('ff-title')?.textContent).toBe('Flowchart');
    expect(doc.getElementById('ff-desc')?.textContent).toBe(
      'Flowchart with 6 nodes, 6 connections, 2 groups.',
    );
    expect(doc.querySelector('[data-node-id="sql"] > title')?.textContent).toBe(
      'Azure SQL Database',
    );
  });

  it('applies arrowheads and line styles', async () => {
    const doc = parseSvg((await render(fixture('kitchen-sink'))).svg);
    const path = (id: string) => doc.querySelector(`.ff-edges [data-edge-id="${id}"] path`)!;
    expect(path('L_a_b_0').getAttribute('marker-start')).toBe('url(#ff-arrow-start)');
    // SVG 2 auto-start-reverse is ignored by resvg and many converters; heads must not rely on it.
    expect(doc.querySelectorAll('marker[orient="auto-start-reverse"]')).toHaveLength(0);
    expect(path('L_a_c_0').getAttribute('marker-end')).toBe('url(#ff-circle)');
    expect(path('L_a_d_0').getAttribute('marker-end')).toBe('url(#ff-cross)');
    expect(path('L_a_h_0').getAttribute('stroke-dasharray')).toBe('4 4');
    expect(doc.querySelector('.ff-edges [data-edge-id="L_a_g_0"]')).toBeNull();
  });

  it('is deterministic', async () => {
    const a = (await render(fixture('azure-architecture'))).svg;
    const b = (await render(fixture('azure-architecture'))).svg;
    expect(b).toBe(a);
  });
});

describe('security', () => {
  const hostile: GraphModel = {
    version: 1,
    diagramType: 'flowchart',
    direction: 'LR',
    groups: [{ id: 'g', label: '</title><script>alert(1)</script>' }],
    nodes: [
      {
        id: 'x"onload="alert(1)',
        label: '<img src=x onerror=alert(1)> & "quotes" \'single\'',
        shape: 'rectangle',
        groupId: 'g',
        inferences: [],
      },
    ],
    edges: [],
  };

  it('escapes every model string and emits no active content', async () => {
    const { layout } = await layoutModel(hostile);
    const svg = renderSvg(hostile, layout, { title: '<script>t</script>' });
    const doc = parseSvg(svg);
    // Hostile text may appear, escaped, as visible text; what matters is that it never becomes
    // markup. Check the parsed document, not the raw string.
    expect(svg).not.toMatch(/<(script|img|foreignObject|style|a|image|iframe)\b/i);
    expect(doc.querySelectorAll('script, foreignObject, image, a, style')).toHaveLength(0);
    const attributes = [...doc.querySelectorAll('*')].flatMap((el) => [...el.attributes]);
    expect(
      attributes.filter((a) => /^on/i.test(a.name) || /^(xlink:)?href$/i.test(a.name)),
    ).toEqual([]);
    expect(attributes.filter((a) => /javascript:/i.test(a.value))).toEqual([]);
    expect(doc.querySelector('[data-node-id] > title')?.textContent).toBe(hostile.nodes[0]!.label);
    expect(doc.querySelector('[data-node-id]')?.getAttribute('data-node-id')).toBe(
      hostile.nodes[0]!.id,
    );
  });

  it('removes characters XML forbids and leaves ordinary letters alone', () => {
    const bell = String.fromCharCode(7);
    const nonChar = String.fromCharCode(0xfffe);
    expect(escapeXml(`Fee fi${bell} fo${nonChar} fum\ttab`)).toBe('Fee fi fo fum\ttab');
  });

  it('rejects theme colours that could inject markup', async () => {
    const model = await parseOk('flowchart LR\n  a --> b\n');
    const { layout } = await layoutModel(model);
    const bad = { ...themes['enterprise-light'], nodeFill: 'red" onclick="alert(1)' };
    expect(() => renderSvg(model, layout, { theme: bad })).toThrow(/Invalid theme colour/);
    expect(() => renderSvg(model, layout, { theme: 'neon' as ThemeId })).toThrow(/Unknown theme/);
  });

  it('sanitises the id prefix', async () => {
    const model = await parseOk('flowchart LR\n  a --> b\n');
    const { layout } = await layoutModel(model);
    const svg = renderSvg(model, layout, { idPrefix: 'x" onload="y' });
    expect(svg).toContain('url(#xonloady-arrow)');
  });
});

describe('themes', () => {
  /** WCAG 2 contrast ratio between two #rrggbb colours. */
  function contrast(a: string, b: string): number {
    const luminance = (hex: string) => {
      const [r, g, bl] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
    };
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  }

  it.each(THEME_IDS)('%s: text meets WCAG AA (4.5:1) and lines meet 3:1', (id) => {
    const t: Theme = themes[id];
    expect(contrast(t.nodeText, t.nodeFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.groupTitle, t.groupFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.edgeLabelText, t.edgeLabelFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.edge, t.background)).toBeGreaterThanOrEqual(3);
    // WCAG 1.4.11: outlines that identify a shape need 3:1 against what surrounds them.
    expect(contrast(t.nodeStroke, t.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(t.nodeStroke, t.groupFill)).toBeGreaterThanOrEqual(3);
  });

  it.each(THEME_IDS)('%s: matches the visual snapshot', async (id) => {
    const { svg } = await render(fixture('azure-architecture'), id);
    await expect(svg).toMatchFileSnapshot(`./__snapshots__/azure-architecture.${id}.svg`);
  });
});
