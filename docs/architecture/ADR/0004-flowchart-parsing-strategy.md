# ADR-0004: parse flowcharts with Mermaid itself, behind a DOM shim in Node

Status: accepted, 2026-10-16.

## Context

ADR-0003 left open how `@flowforge/parser` turns flowchart source into a model. A spike against
`mermaid@12.2.0` on Node 24 found:

- `mermaid.parse()` validates syntax in Node with no DOM. Errors carry line and column
  (`hash.loc`), which is enough for located diagnostics.
- Extracting structure (`mermaidAPI.getDiagramFromText(src).db`) fails in plain Node with
  `DOMPurify.addHook is not a function`. With a `jsdom` window assigned to `globalThis` first,
  it works and returns vertex IDs, labels and shapes, edge IDs, labels, arrow types and stroke
  styles, subgraphs with members, and direction.
- Diagram types register only after the first `mermaid.parse()` call.
- Mermaid enforces `maxEdges` (default 500) as a secure, initialize-only setting. A useful
  denial-of-service guard.
- Timings: cold start with jsdom ~900 ms; a 2,000-edge flowchart parses in ~800 ms. The parser
  state resets between calls.
- Mermaid's grammar has quirks a hand-written parser would have to replicate, for example a node
  named `x` followed by `-->` is lexed as a cross-arrow edge.

## Decision

Use Mermaid's own parser (option a). In Node, `@flowforge/parser` installs a minimal `jsdom`
window before importing Mermaid; in the browser it uses the real window. The `db` getters are
Mermaid internals, so they are read in exactly one module (`mermaid-flowchart.ts`), the Mermaid
version is pinned exactly, and the fixture corpus runs as compatibility tests on every upgrade.

`maxEdges` is set explicitly and exposed as an option with a documented default.

## Alternatives rejected

- **Own grammar (option b):** guarantees drift from what Mermaid actually renders, and every
  quirk above becomes our bug. Revisit only if Mermaid drops the `db` getters.
- **`@mermaid-js/parser` (Langium):** does not cover flowcharts in 12.2.0.

## Consequences

- `jsdom` is a Node-only runtime dependency of the parser (a few MB). It must not reach browser
  bundles; the package uses conditional exports to keep it out.
- 2,000-edge parses take most of a second, so the web app parses in a worker (Phase 5).
- Mermaid upgrades require the compatibility suite to pass before merging.
