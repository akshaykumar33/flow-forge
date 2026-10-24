import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Direction, GraphModel } from '@flowforge/core';
import { parse } from '@flowforge/parser';
import {
  checkReadability,
  estimateTextWidth,
  layoutModel,
  overlaps,
  wrapText,
  type LayoutResult,
} from '../src/index.js';

const fixture = (name: string) =>
  readFileSync(new URL(`../../parser/test/fixtures/${name}.mmd`, import.meta.url), 'utf8');

async function parseOk(source: string): Promise<GraphModel> {
  const result = await parse(source);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.model;
}

beforeAll(() => parse('flowchart LR\n  warm --> up'), 30_000);

const FIXTURES = ['basic', 'azure-architecture', 'kitchen-sink', 'html-labels', 'entity-codes'];

describe('layoutModel on the fixture corpus', () => {
  it.each(FIXTURES)('%s: every element placed, no overlaps or crossings', async (name) => {
    const model = await parseOk(fixture(name));
    const { layout } = await layoutModel(model);
    expect(Object.keys(layout.nodes)).toEqual(model.nodes.map((n) => n.id));
    expect(Object.keys(layout.edges)).toEqual(model.edges.map((e) => e.id));
    expect(Object.keys(layout.groups)).toEqual(model.groups.map((g) => g.id));
    expect(checkReadability(model, layout)).toEqual([]);
  });

  it('keeps everything inside the canvas', async () => {
    const model = await parseOk(fixture('azure-architecture'));
    const { layout } = await layoutModel(model);
    const boxes = [...Object.values(layout.nodes), ...Object.values(layout.groups)];
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(layout.width);
      expect(b.y + b.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it('is deterministic', async () => {
    const model = await parseOk(fixture('kitchen-sink'));
    const a = await layoutModel(model);
    const b = await layoutModel(model);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('reports group directions it cannot honour', async () => {
    const model = await parseOk(fixture('azure-architecture'));
    const { diagnostics } = await layoutModel(model);
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'layout-group-direction-ignored', elementId: 'vnet' }),
    ]);
  });
});

describe('direction', () => {
  const chain = (direction: Direction) => `flowchart ${direction}\n  a --> b --> c\n`;
  const centre = (l: LayoutResult, id: string) => {
    const n = l.nodes[id]!;
    return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  };

  it.each([
    ['LR', (a: number, b: number) => a < b, 'x'],
    ['RL', (a: number, b: number) => a > b, 'x'],
    ['TB', (a: number, b: number) => a < b, 'y'],
    ['BT', (a: number, b: number) => a > b, 'y'],
  ] as const)('%s flows the right way', async (direction, before, axis) => {
    const { layout } = await layoutModel(await parseOk(chain(direction)));
    expect(before(centre(layout, 'a')[axis], centre(layout, 'b')[axis])).toBe(true);
    expect(before(centre(layout, 'b')[axis], centre(layout, 'c')[axis])).toBe(true);
  });
});

describe('sizing', () => {
  it('gives long labels wrapped lines and taller boxes', async () => {
    const long = 'Customer order processing service with retries and dead lettering';
    const { layout } = await layoutModel(
      await parseOk(`flowchart LR\n  a[${long}] --> b[Short]\n`),
    );
    expect(layout.nodes.a!.lines.length).toBeGreaterThan(1);
    expect(layout.nodes.a!.lines.join(' ')).toBe(long);
    expect(layout.nodes.a!.height).toBeGreaterThan(layout.nodes.b!.height);
  });

  it('makes circles round and diamonds larger than their text', async () => {
    const { layout } = await layoutModel(
      await parseOk('flowchart LR\n  a((Circle)) --> b{Decide}\n'),
    );
    expect(layout.nodes.a!.width).toBe(layout.nodes.a!.height);
    expect(layout.nodes.b!.width).toBeGreaterThan(
      2 * estimateTextWidth('Decide', { fontSize: 14, fontWeight: 500 }),
    );
  });

  it('wraps on words and keeps explicit line breaks', () => {
    const style = { fontSize: 10, fontWeight: 400 };
    expect(wrapText('alpha beta gamma', 40, style, estimateTextWidth)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    expect(wrapText('one\ntwo', 1000, style, estimateTextWidth)).toEqual(['one', 'two']);
    expect(wrapText('unbreakable', 5, style, estimateTextWidth)).toEqual(['unbreakable']);
  });
});

describe('checkReadability', () => {
  async function laidOut() {
    const model = await parseOk(
      'flowchart LR\n  subgraph g[Group]\n    a\n  end\n  a --> b\n  b --> c\n',
    );
    return { model, layout: (await layoutModel(model)).layout };
  }

  it('detects overlapping nodes', async () => {
    const { model, layout } = await laidOut();
    layout.nodes.c = { ...layout.nodes.c!, x: layout.nodes.b!.x + 5, y: layout.nodes.b!.y + 5 };
    expect(checkReadability(model, layout).map((d) => d.code)).toContain('layout-node-overlap');
  });

  it('detects edges through nodes and nodes in foreign groups', async () => {
    const { model, layout } = await laidOut();
    const ab = layout.edges['L_a_b_0']!;
    const mid = ab.points[0]!;
    layout.nodes.c = { ...layout.nodes.c!, x: mid.x + 2, y: mid.y - 10 };
    const codes = checkReadability(model, layout).map((d) => d.code);
    expect(codes).toContain('layout-edge-crosses-node');
    expect(codes).toContain('layout-node-in-foreign-group');
  });

  it('detects nodes sticking out of their group and oversized canvases', async () => {
    const { model, layout } = await laidOut();
    layout.nodes.a = { ...layout.nodes.a!, x: layout.groups.g!.x - 50 };
    const codes = checkReadability(model, layout, { maxCanvasSide: 10 }).map((d) => d.code);
    expect(codes).toContain('layout-node-outside-group');
    expect(codes).toContain('layout-canvas-oversized');
  });

  it('treats touching boxes as not overlapping', () => {
    expect(
      overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }),
    ).toBe(false);
  });
});

describe('scale', () => {
  it('lays out 200 nodes in groups without errors', async () => {
    const lines = ['flowchart LR'];
    for (let g = 0; g < 8; g++) {
      lines.push(`  subgraph g${g}[Group ${g}]`);
      for (let i = g * 25; i < (g + 1) * 25; i++) lines.push(`    n${i}[Service ${i}]`);
      lines.push('  end');
    }
    for (let i = 1; i < 200; i++) lines.push(`  n${(i * 7919) % i} --> n${i}`);
    const model = await parseOk(lines.join('\n'));
    const started = performance.now();
    const { layout } = await layoutModel(model);
    const elapsed = performance.now() - started;
    const errors = checkReadability(model, layout).filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);
});
