# Project status

Last updated: 2026-10-16. Current phase: **0 — Discovery and planning**.

This file is the single source of truth for what exists. If a feature is not marked
**Implemented** here, it does not work yet.

## Baseline assessment (2026-10-16)

- The repository was empty apart from the build brief (`prompts/starter.md`). No existing code
  to preserve.
- Environment: Node 24.14, pnpm 10.33, git 2.52, Windows 11.
- Tooling in place: pnpm workspaces, strict TypeScript 6.0 base config, ESLint 10 with
  typescript-eslint, Prettier, Vitest. See [ADR-0002](docs/architecture/ADR/0002-typescript-6-pin.md).
- No git remote, no CI run yet, nothing published.

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

| Feature                         | Status      | Tested | Documented | Notes                |
| ------------------------------- | ----------- | ------ | ---------- | -------------------- |
| Workspace tooling               | Implemented | n/a    | Yes        |                      |
| Graph model (`@flowforge/core`) | Planned     |        |            | Phase 1              |
| Flowchart parser adapter        | Planned     |        |            | Phase 1, see risk R1 |
| Everything else                 | Planned     |        |            | See phase plan       |

## Risk register

| ID  | Risk                                                                                                                                 | Likelihood | Impact | Mitigation                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------- |
| R1  | Mermaid's flowchart parser is not a stable Node API: `@mermaid-js/parser` does not cover flowcharts yet and `mermaid` expects a DOM. | High       | High   | Isolate behind an adapter (ADR-0003). Spike in Phase 1 and record the outcome as ADR-0004.            |
| R2  | Official cloud icon licences may forbid redistribution in an npm package.                                                            | Medium     | High   | Verify each provider's terms in Phase 4; support user-supplied icon packs if bundling is not allowed. |
| R3  | ELK.js layout is slow on graphs with hundreds of nodes.                                                                              | Medium     | Medium | Measure in Phase 3; run in a worker; cache by model hash.                                             |
| R4  | Scope is far larger than one release.                                                                                                | High       | Medium | Strict phase gates; ship flowcharts well before other diagram types.                                  |
| R5  | Name "FlowForge" unavailable on npm or trademarked.                                                                                  | Medium     | Low    | Check before first publish; scope packages under an npm org.                                          |

## Technical debt and follow-ups

- TypeScript is pinned below 7.0 until typescript-eslint supports it (ADR-0002).
- No git remote configured.
