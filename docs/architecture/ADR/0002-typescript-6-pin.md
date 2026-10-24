# ADR-0002: pin TypeScript to 6.0.x

Status: accepted, 2026-10-16.

## Context

TypeScript 7.0.2 is current, but typescript-eslint 8.71 declares a peer range of `<6.1.0`.

## Decision

Pin `typescript@~6.0.0`. Revisit when typescript-eslint supports 7.x.

## Alternatives rejected

- TypeScript 7 with an unsupported lint setup: risks silent rule failures.
