import { z } from 'zod';

/** Bump when the serialised shape changes incompatibly. */
export const MODEL_VERSION = 1;

/** 1-based line and column span in the original source. */
export const SourceRangeSchema = z.object({
  startLine: z.number().int().positive(),
  startColumn: z.number().int().positive(),
  endLine: z.number().int().positive(),
  endColumn: z.number().int().positive(),
});

export const DirectionSchema = z.enum(['TB', 'BT', 'LR', 'RL']);

export const NodeShapeSchema = z.enum([
  'rectangle',
  'rounded',
  'stadium',
  'subroutine',
  'cylinder',
  'circle',
  'double-circle',
  'asymmetric',
  'diamond',
  'hexagon',
  'parallelogram',
  'parallelogram-alt',
  'trapezoid',
  'trapezoid-alt',
  'unknown',
]);

/**
 * How a piece of metadata was obtained. Kept separate so the UI and transforms never present a
 * guess as a fact.
 */
export const ProvenanceSchema = z.enum(['source', 'deterministic', 'heuristic', 'ai', 'user']);

export const InferenceSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  provenance: ProvenanceSchema,
  reason: z.string(),
});

export const NodeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  shape: NodeShapeSchema,
  groupId: z.string().min(1).optional(),
  sourceRange: SourceRangeSchema.optional(),
  inferences: z.array(InferenceSchema).default([]),
});

export const ArrowHeadSchema = z.enum(['none', 'arrow', 'circle', 'cross']);

export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().default(''),
  stroke: z.enum(['solid', 'dotted', 'thick', 'invisible']),
  arrowStart: ArrowHeadSchema,
  arrowEnd: ArrowHeadSchema,
  sourceRange: SourceRangeSchema.optional(),
});

export const GroupSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  parentId: z.string().min(1).optional(),
  direction: DirectionSchema.optional(),
});

export const GraphModelSchema = z.object({
  version: z.literal(MODEL_VERSION),
  diagramType: z.literal('flowchart'),
  direction: DirectionSchema,
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  groups: z.array(GroupSchema),
});

export type SourceRange = z.infer<typeof SourceRangeSchema>;
export type Direction = z.infer<typeof DirectionSchema>;
export type NodeShape = z.infer<typeof NodeShapeSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type Inference = z.infer<typeof InferenceSchema>;
export type GraphNode = z.infer<typeof NodeSchema>;
export type ArrowHead = z.infer<typeof ArrowHeadSchema>;
export type GraphEdge = z.infer<typeof EdgeSchema>;
export type GraphGroup = z.infer<typeof GroupSchema>;
export type GraphModel = z.infer<typeof GraphModelSchema>;
