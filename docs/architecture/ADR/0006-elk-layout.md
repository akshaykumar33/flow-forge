# ADR-0006: lay out diagrams with ELK's layered algorithm

Status: accepted, 2026-10-24.

## Context

Phase 3 needs automatic layout with nested groups, orthogonal edge routing, edge labels and the
four Mermaid directions, and its output must be deterministic. Risk R3 was that ELK is too slow
for large diagrams. A spike against `elkjs@0.12.0` on Node 24 measured synthetic flowcharts
(nodes 150×48, nested groups, about 1.25 edges per node, every third edge labelled,
`hierarchyHandling: INCLUDE_CHILDREN`, `edgeRouting: ORTHOGONAL`):

| Nodes | Edges | Groups | Layout time                          |
| ----- | ----- | ------ | ------------------------------------ |
| 50    | 61    | 3      | 0.44 s (includes first-call warm-up) |
| 200   | 248   | 8      | 0.93 s                               |
| 500   | 623   | 15     | 1.9 s                                |
| 1000  | 1248  | 25     | 6.2 s                                |

Repeated layouts gave identical node positions, edge routes and label positions, on the same
instance and on a fresh one. The raw output JSON differs only in ELK's internal `$H` counters.

## Decision

`@flowforge/layout` uses ELK's `layered` algorithm through `elkjs`, pinned exactly, with
hierarchy handling across groups and orthogonal routing. It converts the model to an ELK graph
and returns only geometry (positions, sizes, route points, label boxes), never ELK's raw
objects, so the internal counters never reach serialised output.

Node sizes come from a text-measurement function passed in by the caller, so layout stays free
of DOM and font APIs. Dagre is not added: one engine is simpler to test, and ELK covers the
small cases.

## Consequences

- Beyond about 500 nodes, layout takes seconds. The web editor (Phase 5) runs it in a worker and
  caches by model hash; the CLI reports timing in verbose mode.
- `elkjs` is about 1.5 MB minified. It belongs in `@flowforge/layout` only.
- Risk R3 is reduced from Medium likelihood to Low.
- **Licence:** `elkjs` is `EPL-2.0 OR GPL-3.0-or-later`, not permissive. FlowForge uses it as an
  unmodified dependency, which EPL-2.0 permits from an MIT project: its copyleft applies to
  changes to ELK itself. If FlowForge ever ships a bundle that includes ELK (the web app), the
  bundle must carry ELK's licence notice and say where its source is available. Tracked as risk R6
  and to be confirmed by the owner before any publish.
