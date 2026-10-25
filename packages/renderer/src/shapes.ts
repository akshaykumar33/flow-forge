import type { NodeShape } from '@flowforge/core';
import type { Box } from '@flowforge/layout';
import { num } from './escape.js';

/** Fill and stroke attribute strings, already validated by the caller. */
export interface Paint {
  fill: string;
  stroke: string;
}

/** SVG markup for a node outline filling `box`. */
export function shapeMarkup(shape: NodeShape, box: Box, colours: Paint): string {
  const paint = `${colours.fill} ${colours.stroke}`;
  const outline = `fill="none" ${colours.stroke}`;
  const { x, y, width: w, height: h } = box;
  const polygon = (points: [number, number][]) =>
    `<polygon points="${points.map(([px, py]) => `${num(px)},${num(py)}`).join(' ')}" ${paint}/>`;
  const rect = (rx: number, extra = '') =>
    `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(rx)}" ${paint}${extra}/>`;
  const slant = h / 4;

  switch (shape) {
    case 'rectangle':
      return rect(6);
    case 'rounded':
      return rect(14);
    case 'stadium':
      return rect(h / 2);
    case 'unknown':
      return rect(6, ' stroke-dasharray="5 4"');
    case 'subroutine':
      return (
        rect(4) +
        `<path d="M${num(x + 8)} ${num(y)}V${num(y + h)}M${num(x + w - 8)} ${num(y)}V${num(y + h)}" ${outline}/>`
      );
    case 'cylinder': {
      const ry = 8;
      const body =
        `M${num(x)} ${num(y + ry)}` +
        `A${num(w / 2)} ${ry} 0 0 1 ${num(x + w)} ${num(y + ry)}` +
        `V${num(y + h - ry)}` +
        `A${num(w / 2)} ${ry} 0 0 1 ${num(x)} ${num(y + h - ry)}Z`;
      const rim = `M${num(x)} ${num(y + ry)}A${num(w / 2)} ${ry} 0 0 0 ${num(x + w)} ${num(y + ry)}`;
      return `<path d="${body}" ${paint}/><path d="${rim}" ${outline}/>`;
    }
    case 'circle':
      return `<circle cx="${num(x + w / 2)}" cy="${num(y + h / 2)}" r="${num(Math.min(w, h) / 2)}" ${paint}/>`;
    case 'double-circle': {
      const cx = num(x + w / 2);
      const cy = num(y + h / 2);
      const r = Math.min(w, h) / 2;
      return `<circle cx="${cx}" cy="${cy}" r="${num(r)}" ${paint}/><circle cx="${cx}" cy="${cy}" r="${num(r - 5)}" ${outline}/>`;
    }
    case 'asymmetric':
      return polygon([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x + h / 3, y + h / 2],
      ]);
    case 'diamond':
      return polygon([
        [x + w / 2, y],
        [x + w, y + h / 2],
        [x + w / 2, y + h],
        [x, y + h / 2],
      ]);
    case 'hexagon':
      return polygon([
        [x + slant, y],
        [x + w - slant, y],
        [x + w, y + h / 2],
        [x + w - slant, y + h],
        [x + slant, y + h],
        [x, y + h / 2],
      ]);
    case 'parallelogram':
      return polygon([
        [x + slant, y],
        [x + w, y],
        [x + w - slant, y + h],
        [x, y + h],
      ]);
    case 'parallelogram-alt':
      return polygon([
        [x, y],
        [x + w - slant, y],
        [x + w, y + h],
        [x + slant, y + h],
      ]);
    case 'trapezoid':
      return polygon([
        [x + slant, y],
        [x + w - slant, y],
        [x + w, y + h],
        [x, y + h],
      ]);
    case 'trapezoid-alt':
      return polygon([
        [x, y],
        [x + w, y],
        [x + w - slant, y + h],
        [x + slant, y + h],
      ]);
  }
}
