# Contributing

## Setup

```sh
pnpm install
pnpm build
pnpm test
```

## Before opening a pull request

Run the same gates as CI:

```sh
pnpm format:check && pnpm lint && pnpm check:cycles && pnpm build && pnpm typecheck && pnpm test
```

## Conventions

- **Branches:** `<type>/<scope>-<slug>`, for example `feat/parser-sequence-diagrams`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), lowercase imperative
  subject of 72 characters or fewer: `fix(parser): keep edge ids for chained links`.
- **One purpose per branch and pull request.** Separate refactors from behaviour changes.
- **Tests come with the change.** Parser changes add a fixture under
  `packages/parser/test/fixtures/`.
- **Significant decisions get an ADR** in `docs/architecture/ADR/`.
- **Keep [PROJECT_STATUS.md](PROJECT_STATUS.md) true.** A feature is "Implemented" only when it
  works and is tested.

## Architecture rules

- Only `@flowforge/parser` imports Mermaid.
- `@flowforge/core` depends on no other workspace package.
- Library packages never touch the DOM, except the parser's Node entry, which installs a jsdom
  window for Mermaid.
- Never regenerate IDs that came from the user's source.
