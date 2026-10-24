# FlowForge

FlowForge turns Mermaid diagrams into a typed, validated graph model, the foundation for polished,
provider-aware architecture diagrams.

> **Status: early development (Phase 2 of 8 complete).** FlowForge parses, validates,
> transforms, compares and re-exports Mermaid **flowcharts**, from code or the `flowforge` CLI.
> Layout, SVG rendering, cloud icons, the web editor and animation do not exist yet. See
> [PROJECT_STATUS.md](PROJECT_STATUS.md) for exactly what works.

## What works today

- Parse `flowchart` / `graph` source into a renderer-independent model: nodes, edges, nested
  subgraphs, all classic shapes, arrow heads and line styles, with Mermaid's own IDs preserved.
- Syntax errors come back as diagnostics with a line number, never as thrown exceptions.
- Export the model back to Mermaid. Anything Mermaid cannot carry is reported, not dropped.
- Rename labels with naming templates, with diff, undo and revert. Transforms can change how a
  diagram reads, never its structure.
- Deterministic output: the same input always produces the same bytes.
- Input limits for source size and edge count.

Not supported yet: other diagram types (sequence, ER, class, state), per-node source positions,
and Mermaid's newer `@{ shape: … }` shapes beyond `rounded`.

## Quickstart (from source)

Requires Node 20.11+ and pnpm 10.

```sh
git clone <repository-url> flow-forge
cd flow-forge
pnpm install
pnpm build
pnpm test
```

## Command line

After `pnpm build`, run the CLI with `node packages/cli/dist/bin.js` (the `flowforge` binary
once published). Input is a Mermaid file, a `.json` model, or `-` for stdin.

```sh
flowforge validate diagram.mmd
# diagram.mmd:3:4: error syntax-error: Parse error on line 3: Expecting 'TAGEND', ..., got 'SQS'

flowforge inspect diagram.mmd            # summary; --json prints the full model
flowforge transform diagram.mmd --template "{env}-{label}" --env prod --case kebab -o out.mmd
flowforge diff before.mmd after.mmd      # exit 1 when they differ, like diff(1)
```

| Exit code | Meaning                                  |
| --------- | ---------------------------------------- |
| 0         | Success                                  |
| 1         | Invalid diagram, or `diff` found changes |
| 2         | Usage error                              |
| 3         | File could not be read or written        |

Global flags: `--json`, `-q/--quiet`, `-v/--verbose`. `transform` refuses to overwrite its own
input unless you pass `--force`. Run `flowforge --help` for every option.

## Library usage

Packages are not published to npm yet. Inside this workspace:

```ts
import { parse } from '@flowforge/parser';
import { serializeModel } from '@flowforge/core';

const result = await parse(`flowchart LR
  user((User)) -->|HTTPS| api[API]
  api --> db[(Orders DB)]`);

if (result.ok) {
  console.log(serializeModel(result.model));
} else {
  for (const d of result.diagnostics) {
    console.error(`${d.range?.startLine ?? '?'}: ${d.message}`);
  }
}
```

`result.model.nodes` for that source:

```json
[
  { "id": "user", "label": "User", "shape": "circle", "inferences": [] },
  { "id": "api", "label": "API", "shape": "rectangle", "inferences": [] },
  { "id": "db", "label": "Orders DB", "shape": "cylinder", "inferences": [] }
]
```

### Parse options

| Option            | Default   | Effect                                                   |
| ----------------- | --------- | -------------------------------------------------------- |
| `maxSourceLength` | 1,000,000 | Sources longer than this are rejected before parsing.    |
| `maxEdges`        | 2,000     | Mermaid stops parsing once a diagram exceeds this count. |

## Packages

| Package                 | Purpose                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `@flowforge/core`       | Graph model types, validation, diagnostics, serialisation                                      |
| `@flowforge/parser`     | Mermaid source to model and back (`parse`, `toMermaid`); the only package that imports Mermaid |
| `@flowforge/transforms` | Guarded transforms, naming profiles, model diff, undo/redo history                             |
| `@flowforge/cli`        | The `flowforge` command                                                                        |

## Development

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `pnpm build`        | Build all packages                |
| `pnpm test`         | Run unit and integration tests    |
| `pnpm typecheck`    | Type-check every package          |
| `pnpm lint`         | ESLint                            |
| `pnpm format:check` | Prettier check                    |
| `pnpm check:cycles` | Fail on package dependency cycles |

## Documentation

- [Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) and
  [decision records](docs/architecture/ADR/)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [License](LICENSE) (MIT)
