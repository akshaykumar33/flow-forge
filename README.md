# FlowForge

FlowForge turns Mermaid diagrams into a typed, validated graph model, the foundation for polished,
provider-aware architecture diagrams.

> **Status: early development (Phase 1 of 8).** Today FlowForge parses Mermaid **flowcharts**
> into a validated model with located error diagnostics. Layout, rendering, cloud icons, the web
> editor, the CLI and animation do not exist yet. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for
> exactly what works.

## What works today

- Parse `flowchart` / `graph` source into a renderer-independent model: nodes, edges, nested
  subgraphs, all classic shapes, arrow heads and line styles, with Mermaid's own IDs preserved.
- Syntax errors come back as diagnostics with a line number, never as thrown exceptions.
- Deterministic JSON serialisation: the same diagram always produces the same bytes.
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

## Usage

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

| Package             | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `@flowforge/core`   | Graph model types, validation, diagnostics, serialisation      |
| `@flowforge/parser` | Mermaid source to model; the only package that imports Mermaid |

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
