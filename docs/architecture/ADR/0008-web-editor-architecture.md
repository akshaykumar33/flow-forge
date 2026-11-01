# ADR-0008: a static, client-only web editor that shows the exported SVG

Status: accepted, 2026-10-31.

## Context

Phase 5 builds the editor from the mockup: source editor, interactive canvas, inspector,
suggestions, undo, export. The brief requires that diagrams are not stored on a server by default,
that heavy work does not block typing, and that the editor reuses the library rather than
re-implementing it.

## Decision

1. **Next.js 16 (App Router) with static export** (`output: 'export'`). The app is plain files that
   any static host can serve; there is no FlowForge server, so diagrams never leave the browser.
2. **React 19, Tailwind CSS 4, Lucide icons.** Interface primitives are written in the app;
   menus and dialogs follow WAI-ARIA patterns and are covered by Playwright keyboard tests.
3. **CodeMirror 6** for the Mermaid source: accessible, small, and it reports cursor positions so
   diagnostics can jump to lines. Monaco is rejected as too large for the benefit.
4. **Layout and rendering in a Web Worker.** Parsing stays on the main thread: Mermaid needs a
   real DOM, which workers lack (the same constraint as Node, ADR-0004). Parsing is fast for
   typical diagrams and runs debounced while typing; ELK layout, the slow step (ADR-0006), runs in
   the worker, and stale results are dropped so only the latest edit is shown.
5. **The canvas displays the renderer's SVG.** It inserts `renderSvg` output (sanitised and
   escaped by construction, ADR-0007, renderer security tests) and adds interaction around it:
   selection and hover by event delegation on `data-node-id`, pan and zoom by CSS transform. What
   the user sees is byte-for-byte what they export.
6. **State in a small Zustand store** holding the `@flowforge/transforms` history, so undo, redo
   and revert are the library's, not a second implementation.
7. **Local projects in browser storage** (localStorage first; IndexedDB if size requires), with
   autosave the user can turn off. The original source of a project is never overwritten.
8. **Playwright** for end-to-end tests of the required workflows.

## Alternatives rejected

- **A React-drawn canvas** (nodes as components): flexible, but a second renderer that could
  drift from exported files.
- **A server for parsing or storage**: contradicts "no server storage by default" and adds an
  operational surface for no benefit at this scale.

## Consequences

- The web bundle includes Mermaid and ELK. ELK is EPL-2.0 or GPL-3.0 (risk R6): the app must
  ship a third-party notices page with ELK's licence and where to get its source.
- Large diagrams stay responsive because layout never runs on the main thread.
