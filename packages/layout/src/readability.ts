import type { Diagnostic, GraphModel } from '@flowforge/core';
import type { Box, LayoutResult, Point } from './types.js';

export interface ReadabilityLimits {
  /** Canvas side above which the diagram is reported as oversized. Default 20,000 px. */
  maxCanvasSide?: number;
}

/**
 * Checks a layout for problems a reader would notice. Errors mean the layout is broken (things
 * drawn on top of each other); warnings mean it is hard to read. Runs in O(n²) over nodes and
 * O(edges × nodes) for routing, which is fine for the sizes ELK lays out in seconds.
 */
export function checkReadability(
  model: GraphModel,
  layout: LayoutResult,
  limits: ReadabilityLimits = {},
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodeIds = model.nodes.map((n) => n.id);

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const [a, b] = [nodeIds[i]!, nodeIds[j]!];
      if (overlaps(layout.nodes[a]!, layout.nodes[b]!)) {
        diagnostics.push(error('layout-node-overlap', `Nodes "${a}" and "${b}" overlap.`, a));
      }
    }
  }

  const groupMembers = membership(model);
  for (const group of model.groups) {
    const groupBox = layout.groups[group.id]!;
    for (const id of nodeIds) {
      const inside = groupMembers.get(group.id)!.has(id);
      const nodeBox = layout.nodes[id]!;
      if (inside && !contains(groupBox, nodeBox)) {
        diagnostics.push(
          error(
            'layout-node-outside-group',
            `Node "${id}" sticks out of its group "${group.id}".`,
            id,
          ),
        );
      } else if (!inside && overlaps(groupBox, nodeBox)) {
        diagnostics.push(
          error(
            'layout-node-in-foreign-group',
            `Node "${id}" is drawn inside group "${group.id}", which it does not belong to.`,
            id,
          ),
        );
      }
    }
  }

  for (const edge of model.edges) {
    const route = layout.edges[edge.id]!;
    if (route.points.length < 2) {
      diagnostics.push(error('layout-edge-unrouted', `Edge "${edge.id}" has no route.`, edge.id));
      continue;
    }
    for (const id of nodeIds) {
      if (id === edge.source || id === edge.target) continue;
      if (routeCrosses(route.points, shrink(layout.nodes[id]!, 1))) {
        diagnostics.push(
          warning(
            'layout-edge-crosses-node',
            `Edge "${edge.id}" passes through node "${id}".`,
            edge.id,
          ),
        );
      }
    }
    const label = route.label;
    if (label) {
      for (const id of nodeIds) {
        if (overlaps(label, layout.nodes[id]!)) {
          diagnostics.push(
            warning(
              'layout-label-overlap',
              `The label of edge "${edge.id}" overlaps node "${id}".`,
              edge.id,
            ),
          );
        }
      }
    }
  }

  const labelled = model.edges.filter((e) => layout.edges[e.id]!.label);
  for (let i = 0; i < labelled.length; i++) {
    for (let j = i + 1; j < labelled.length; j++) {
      const [a, b] = [labelled[i]!, labelled[j]!];
      if (overlaps(layout.edges[a.id]!.label!, layout.edges[b.id]!.label!)) {
        diagnostics.push(
          warning('layout-label-overlap', `Labels of edges "${a.id}" and "${b.id}" overlap.`, a.id),
        );
      }
    }
  }

  const maxSide = limits.maxCanvasSide ?? 20_000;
  if (layout.width > maxSide || layout.height > maxSide) {
    diagnostics.push({
      severity: 'warning',
      code: 'layout-canvas-oversized',
      message: `The diagram is ${Math.round(layout.width)}×${Math.round(layout.height)} px, more than ${maxSide} px on a side. Consider splitting it or changing the direction.`,
    });
  }
  return diagnostics;
}

function membership(model: GraphModel): Map<string, Set<string>> {
  const parentOf = new Map(model.groups.map((g) => [g.id, g.parentId]));
  const members = new Map(model.groups.map((g) => [g.id, new Set<string>()]));
  for (const node of model.nodes) {
    for (let g = node.groupId; g !== undefined; g = parentOf.get(g)) members.get(g)!.add(node.id);
  }
  return members;
}

/** Strict overlap: boxes that only touch edges do not count. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function contains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function shrink(b: Box, by: number): Box {
  return { x: b.x + by, y: b.y + by, width: b.width - by * 2, height: b.height - by * 2 };
}

function routeCrosses(points: Point[], b: Box): boolean {
  for (let i = 1; i < points.length; i++) {
    if (segmentHitsBox(points[i - 1]!, points[i]!, b)) return true;
  }
  return false;
}

/** Liang–Barsky clipping: does the segment p→q enter the box's interior? */
function segmentHitsBox(p: Point, q: Point, b: Box): boolean {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, p.x - b.x],
    [dx, b.x + b.width - p.x],
    [-dy, p.y - b.y],
    [dy, b.y + b.height - p.y],
  ];
  for (const [den, num] of edges) {
    if (den === 0) {
      if (num <= 0) return false;
    } else {
      const t = num / den;
      if (den < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 >= t1) return false;
    }
  }
  return true;
}

function error(code: string, message: string, elementId: string): Diagnostic {
  return { severity: 'error', code, message, elementId };
}

function warning(code: string, message: string, elementId: string): Diagnostic {
  return { severity: 'warning', code, message, elementId };
}
