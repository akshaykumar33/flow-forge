export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned box in canvas coordinates (origin top-left, y down). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeLayout extends Box {
  /** The label split into the lines the renderer must draw, so wrapping matches the sizing. */
  lines: string[];
  /** Square reserved above the label for a service icon, when the node has one. */
  icon?: Box;
}

export interface EdgeLayout {
  /** Polyline from source boundary to target boundary, including bend points. */
  points: Point[];
  label?: Box & { lines: string[] };
}

export interface GroupLayout extends Box {
  /** Box reserved for the title inside the top padding. */
  title: Box & { lines: string[] };
}

/** Geometry only. Keyed by model element id; every key follows model order. */
export interface LayoutResult {
  width: number;
  height: number;
  nodes: Record<string, NodeLayout>;
  edges: Record<string, EdgeLayout>;
  groups: Record<string, GroupLayout>;
}

export interface TextStyle {
  fontSize: number;
  fontWeight: number;
}

/**
 * Returns the width of one line of text in CSS pixels. Callers with real fonts (a browser canvas,
 * or a font metrics table) pass their own; the default is a deterministic estimate.
 */
export type MeasureText = (text: string, style: TextStyle) => number;
