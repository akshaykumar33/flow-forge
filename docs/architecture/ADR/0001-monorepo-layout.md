# ADR-0001: pnpm monorepo with focused packages

Status: accepted, 2026-10-16.

## Context

FlowForge ships a library, a CLI, React components and a web app that share one model.

## Decision

One pnpm workspace with `packages/*` and `apps/*`. A package is added only when a phase needs
it, starting with `core` and `parser`. Turborepo is deferred until build times justify it.

## Alternatives rejected

- Single package: forces browser and Node dependencies on every consumer.
- Separate repositories: model changes would need coordinated releases across repos.
