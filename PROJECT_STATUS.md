# Project status

Last updated: 2026-10-24. Current phase: **2 — Core transforms, in progress**. Phases 0 and 1 are done locally. The CI workflow exists but has never run, because there is no remote yet.

This file is the single source of truth for what exists. If a feature is not marked
**Implemented** here, it does not work yet.

## Baseline assessment (2026-10-16)

- The repository was empty apart from the build brief (`prompts/starter.md`). No existing code
  to preserve.
- Environment: Node 24.14, pnpm 10.33, git 2.52, Windows 11.
- Tooling in place: pnpm workspaces, strict TypeScript 6.0 base config, ESLint 10 with
  typescript-eslint, Prettier, Vitest. See [ADR-0002](docs/architecture/ADR/0002-typescript-6-pin.md).
- No git remote, no CI run yet, nothing published. CI (`.github/workflows/ci.yml`) runs format, lint, cycle check, build, typecheck and tests on Ubuntu and Windows once pushed.

## Assumptions

- Initial users are developers documenting architectures, working locally. No server storage.
- Flowcharts (with subgraphs) are the only Mermaid type targeted until Phase 3 is done.
- License: MIT, pending the owner's confirmation before any publish.
- "FlowForge" is a working name. Package, trademark and domain availability are unchecked.

## Phase plan

| Phase                    | Goal                                                                               | Exit gate                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 0 Discovery              | Assessment, architecture, ADRs, risks                                              | This file and the architecture doc reviewed                                                                     |
| 1 Foundation             | Graph model, flowchart parser adapter, fixtures, CI                                | Valid flowchart parses to a model; invalid input gives located diagnostics; tests, typecheck, lint, build green |
| 2 Transforms             | Deterministic pipeline, naming rules, diff/undo, serialisation, first CLI commands | Same input gives same output; ambiguous mappings never applied silently                                         |
| 3 Layout + render        | ELK layout, SVG renderer, themes, collision checks, SVG export                     | Fixture diagrams render with no overlap or clipping                                                             |
| 4 Providers              | Registry, Azure/AWS/GCP adapters, licensed icons                                   | Licence recorded per asset; unknown services fall back                                                          |
| 5 Web editor             | Next.js workspace                                                                  | Import, edit, transform, inspect, export end to end                                                             |
| 6 Animation + simulation | Flow playback, simulation engine                                                   | Playback follows edges; deterministic scenario tests                                                            |
| 7 CLI/API/React          | Stable public API, docs                                                            | Packages consumable from a clean install                                                                        |
| 8 Hardening              | Security, performance, a11y, release checklist                                     | All feasible gates green                                                                                        |

## Feature status

| Feature                                             | Status      | Tested                                                                         | Documented      | Notes                                                                                                                                                                                                                               |
| --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace tooling                                   | Implemented | n/a                                                                            | Yes             |                                                                                                                                                                                                                                     |
| Graph model (`@flowforge/core`)                     | Implemented | Yes (14 unit tests)                                                            | Partly (TSDoc)  | Flowchart only; layout, animation and simulation fields come in later phases                                                                                                                                                        |
| Flowchart parser (`@flowforge/parser`)              | Implemented | Yes (16 tests, 7 fixtures)                                                     | Partly (TSDoc)  | Flowcharts only. No per-node source ranges (Mermaid does not expose them). Newer `@{ shape }` shapes other than `rounded` map to `unknown` with a warning. Arrow length (`--->`) not kept. Node entry sets a global jsdom `window`. |
| CI workflow + cycle check                           | Implemented | Cycle check verified against an injected cycle; workflow not yet run           | Yes             | Needs a GitHub remote                                                                                                                                                                                                               |
| Mermaid export (`toMermaid` in `@flowforge/parser`) | Implemented | Yes (11 tests; parse → export → parse is identical for every lossless fixture) | TSDoc           | Reports what Mermaid cannot carry (node metadata, unknown shapes, mismatched or invisible arrowheads) as warnings. Refuses ids Mermaid cannot read. Writes explicit edge ids only when needed.                                      |
| Transforms (`@flowforge/transforms`)                | Implemented | Yes (18 tests)                                                                 | ADR-0005, TSDoc | Pipeline with structure guard, model diff, undo/redo/revert history, suggestions, naming profiles (template tokens, case styles, group scope), tidy-labels. No service recognition yet (Phase 4).                                   |
| Everything else                                     | Planned     |                                                                                |                 | See phase plan                                                                                                                                                                                                                      |

## Risk register

| ID  | Risk                                                                                                                                 | Likelihood | Impact | Mitigation                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------- |
| R1  | Mermaid's flowchart parser is not a stable Node API: `@mermaid-js/parser` does not cover flowcharts yet and `mermaid` expects a DOM. | High       | High   | Spike done: use Mermaid with a jsdom shim in Node (ADR-0004). Compatibility suite on every upgrade.   |
| R2  | Official cloud icon licences may forbid redistribution in an npm package.                                                            | Medium     | High   | Verify each provider's terms in Phase 4; support user-supplied icon packs if bundling is not allowed. |
| R3  | ELK.js layout is slow on graphs with hundreds of nodes.                                                                              | Medium     | Medium | Measure in Phase 3; run in a worker; cache by model hash.                                             |
| R4  | Scope is far larger than one release.                                                                                                | High       | Medium | Strict phase gates; ship flowcharts well before other diagram types.                                  |
| R5  | Name "FlowForge" unavailable on npm or trademarked.                                                                                  | Medium     | Low    | Check before first publish; scope packages under an npm org.                                          |

## Technical debt and follow-ups

- TypeScript is pinned below 7.0 until typescript-eslint supports it (ADR-0002).
- No git remote configured.
