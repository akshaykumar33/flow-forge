# Changelog

All notable changes to FlowForge are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Before 1.0.0, minor versions may change public APIs.

## [Unreleased]

### Added

- Three more themes: cloud-architecture, blueprint and minimal-technical.
- PNG export: `flowforge render --format png -o file.png`, with `--scale` (default 2x).
- `@flowforge/providers`: 60 Azure, AWS and Google Cloud services and generic categories.
- `flowforge render --icon-pack <provider>:<folder>` draws official icons from packs you
  downloaded (FlowForge bundles none). Icons are embedded as images and never inlined.
- `flowforge transform --recognize [--provider azure|aws|gcp]` tags nodes with the services they
  name. Names several providers share, or single words inside longer labels, become suggestions;
  generic words such as "database" only get a category.

### Changed

- `flowforge transform --json` prints one JSON report with changes, suggestions and diagnostics,
  also when the input is invalid.

## [0.1.0] - 2026-10-25

First preview. Packages are not yet published to npm; build from source.

### Added

- Parse Mermaid flowcharts (all classic shapes, arrowheads, line styles, nested subgraphs) into a
  validated, deterministic model, with line-numbered syntax errors.
- Export the model back to Mermaid, reporting anything Mermaid cannot represent instead of
  dropping it.
- Guarded transforms (naming templates, tidy labels) with diff, undo and revert. Transforms that
  would change the graph's structure are rejected.
- Automatic layout with ELK and readability checks for overlaps, edge crossings, clipping and
  oversized canvases.
- Sanitised SVG rendering in enterprise-light, enterprise-dark and high-contrast themes.
- The `flowforge` CLI: `validate`, `inspect`, `transform`, `diff` and `render`.

### Fixed

- Mermaid entity codes such as `#quot;` in labels no longer reach the model as garbage text.
- The build script works on Linux; an unquoted glob was expanded by the shell.

### Known limitations

- Flowcharts only. Sequence, ER, class and state diagrams are not supported yet.
- No cloud provider icons, web editor or animation yet.
- PNG export and the remaining themes from the roadmap are not available yet.
- Layout uses `elkjs`, licensed EPL-2.0 or GPL-3.0-or-later (see ADR-0006).

[0.1.0]: https://github.com/akshaykumar33/flow-forge/releases/tag/v0.1.0
