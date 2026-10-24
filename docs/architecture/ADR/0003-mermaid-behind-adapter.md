# ADR-0003: Mermaid behind a single parser adapter

Status: accepted, 2026-10-16.

## Context

Mermaid's public API is built for browser rendering. Its flowchart parser is internal, and the
Langium-based `@mermaid-js/parser` does not cover flowcharts yet. Internals change between
releases.

## Decision

Only `@flowforge/parser` may import Mermaid packages. It exposes
`parse(source): { model, diagnostics }` and nothing Mermaid-specific. Compatibility tests run the
fixture corpus against the pinned Mermaid version.

How flowcharts are actually parsed is decided by a Phase 1 spike and recorded as ADR-0004.

## Consequences

Changing the parsing strategy, or upgrading Mermaid, touches one package.
