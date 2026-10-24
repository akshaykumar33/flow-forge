# ADR-0005: transforms may change presentation, never structure

Status: accepted, 2026-10-24.

## Context

The brief's core principle is to preserve the user's graph semantics. Transforms such as
renaming run automatically and are written by contributors and, later, plugin authors. A
convention alone would not stop one from rewiring an edge or dropping a node.

## Decision

Every transform runs through `runTransform`, which:

1. gives the transform a copy of the model, so mutating its input cannot corrupt the caller's;
2. validates the output against the core schema and reference rules;
3. diffs input and output and rejects the result if any element was added or removed, or any
   `source`, `target`, `groupId`, `parentId` or diagram `direction` changed.

A rejected transform returns diagnostics and the input model stands. Transforms that are not
certain of a change return a `Suggestion` instead, which only `applySuggestion` (an explicit
user action) writes, recording `provenance: 'user'`.

Renames record the source label as an `original-label` inference, so renaming is idempotent and
always reversible, independent of history.

## Consequences

- Layout direction changes and structural edits (adding a node from the inspector) are not
  transforms. They will be separate, explicitly named operations when the editor needs them.
- The structural check costs one diff per transform run, which is linear in model size.
