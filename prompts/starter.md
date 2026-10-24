# MASTER BUILD PROMPT — FLOWFORGE
## An Intelligent Mermaid Transformation, Architecture Visualization & Flow Simulation Platform

Act as a world-class principal software architect, TypeScript library maintainer, graph-layout engineer, cloud solutions architect, UI/UX designer, developer-tools engineer, QA lead, technical writer, and open-source project maintainer.

Your mission is to design, implement, test, document, and deliver **FlowForge**, a production-minded developer platform that transforms Mermaid diagrams into polished, readable, provider-aware, interactive architecture diagrams with official service icons, configurable naming conventions, automatic layout, glowing flow animations, and optional behavior simulation.

Do not merely generate a prototype, landing page, or architecture document. Build a working software product with a reusable npm library, an interactive web application, a command-line interface, comprehensive tests, documentation, and a disciplined GitHub-ready repository.

Work autonomously within the available environment. Inspect the repository and existing tooling before making changes. Make sensible decisions when details are unspecified, document assumptions, and ask questions only when a decision genuinely blocks safe or correct implementation.

Never claim a feature works unless it has been implemented and verified.

---

# 1. PRODUCT VISION

Build FlowForge as a Mermaid-to-production visualization engine.

Users should be able to:

1. Paste, upload, or import Mermaid source.
2. Parse and validate the source.
3. Understand diagram structure and identify known services where evidence supports recognition.
4. Transform the diagram using configurable naming, layout, styling, and provider rules.
5. Replace generic service representations with appropriate official cloud-provider icons when supported.
6. Render large diagrams with professional spacing, clear routing, legible labels, meaningful group boundaries, and no overlapping elements.
7. Animate connections using glowing paths and moving data packets.
8. Explore diagrams through zoom, pan, minimap, search, selection, and path highlighting.
9. Play, pause, step through, and reset visual flow playback.
10. Export diagrams into supported formats.
11. Download the transformed Mermaid source where the transformation can be represented faithfully in Mermaid.
12. Use the core engine programmatically through npm packages, React components, and a CLI.
13. Integrate the library into existing developer tools and documentation websites.
14. Review all automatic changes and revert transformations.

The product must prioritize correctness, predictability, extensibility, accessibility, and visual quality.

## Core principle

Preserve the user's intended graph semantics.

Never silently invent cloud services, network connections, resource dependencies, security relationships, execution behavior, or infrastructure configuration.

Clearly distinguish:
- Deterministic transformations.
- Heuristic suggestions.
- AI-generated suggestions, if enabled.
- Validated facts.
- Unknown or ambiguous information.
- Visual playback.
- Actual execution or behavior simulation.

AI must be optional. The deterministic core must not depend on an AI provider.

---

# 2. PRODUCT NAME AND BRAND

Working product name: FlowForge.

Use a brand architecture that can support:
- An open-source TypeScript library.
- A professional browser-based editor.
- A CLI.
- React integrations.
- Future plugins and provider adapters.

Before publishing, verify package-name, trademark, repository-name, and domain availability. Do not assume the name is legally available.

Brand personality:
- Premium developer tooling.
- Precise and engineering-focused.
- Futuristic without unnecessary visual noise.
- Powerful enough for enterprise architecture work.
- Clean enough for everyday documentation.

Suggested visual identity:
- Deep charcoal and midnight backgrounds.
- Restrained cyan, blue, violet, and emerald accents.
- Subtle grid patterns and controlled glow effects.
- Crisp typography, thin borders, consistent spacing.
- Clear semantic colors for success, warnings, errors, and selected flows.
- Light and dark themes.

Avoid excessive gradients, oversized headings, gratuitous animations, random emoji icons, cluttered panels, and generic template aesthetics.

---

# 3. REQUIRED REPOSITORY DISCOVERY

Before implementation:

1. Inspect the current working directory.
2. Identify existing source files, package manifests, framework, package manager, Git status, and project conventions.
3. Identify existing functionality that should be preserved.
4. Detect whether this is an empty repository or an existing application.
5. Review existing Mermaid dependencies and diagram-related implementations.
6. Inspect available scripts and determine which commands can be run.
7. Create a baseline assessment.
8. Never overwrite existing work without understanding its purpose.

If the repository is empty, initialize the project with a suitable monorepo structure.

If an application already exists, adapt the architecture to its constraints rather than replacing it unnecessarily.

Create `PROJECT_STATUS.md` and maintain it throughout development.

---

# 4. TECHNICAL ARCHITECTURE

Use TypeScript as the primary language.

Recommended stack, subject to repository compatibility:

- pnpm workspaces for monorepo management.
- Turborepo where it materially improves build orchestration.
- Next.js with App Router for the web application.
- React for interactive components.
- Tailwind CSS for styling.
- A mature accessible component library, such as shadcn/ui.
- Lucide icons for generic interface controls.
- Mermaid parsing and rendering APIs behind an isolated adapter.
- A normalized intermediate graph representation.
- ELK.js for complex graph layouts and routing.
- Dagre where a simpler graph layout is sufficient.
- SVG for scalable diagrams and edge animations.
- Canvas or WebGL only when measured performance justifies the additional complexity.
- Vitest for unit and integration testing.
- Playwright for end-to-end testing.
- ESLint and Prettier for code quality.
- GitHub Actions for continuous integration.
- Changesets for version management and release notes.

Verify dependency compatibility and current supported APIs before implementation. Pin compatible versions and document important architectural decisions.

Do not use undocumented Mermaid internals throughout the codebase. Encapsulate parsing and rendering dependencies behind adapters and add compatibility tests.

## Proposed monorepo

apps/
  web/
  docs/

packages/
  core/
  parser/
  providers/
  transforms/
  layout/
  renderer/
  simulator/
  react/
  cli/
  config/

examples/
  basic-flowchart/
  azure-architecture/
  aws-architecture/
  ci-cd-pipeline/
  data-pipeline/

docs/
  architecture/
  adr/
  guides/
  api/
  contributing/

.github/
  workflows/
  ISSUE_TEMPLATE/
  PULL_REQUEST_TEMPLATE.md

Use this as a starting point, not an inflexible directory requirement. Avoid unnecessary packages and circular dependencies.

Each package must have a clearly defined responsibility, public API, tests, package metadata, and documentation.

---

# 5. NORMALIZED DIAGRAM MODEL

Create a typed, renderer-independent intermediate representation.

The model should represent, where supported:

- Nodes and stable node IDs.
- Edges and stable edge IDs.
- Directed and undirected relationships.
- Labels and descriptions.
- Node and edge types.
- Parent-child relationships and groups.
- Nested subgraphs.
- Input and output ports when applicable.
- Edge labels and relationship metadata.
- Layout hints.
- Provider and resource metadata.
- Original source locations.
- Original Mermaid source.
- Transformation history.
- Validation warnings and errors.
- Confidence and provenance for inferred metadata.
- Animation settings.
- Optional simulation configuration.
- Extension metadata.

Use schema validation and explicit types.

Define stable serialization rules and deterministic output wherever practical.

Preserve original identifiers and relationships. Do not regenerate IDs unnecessarily.

Implement a source-to-model-to-render pipeline with clearly defined contracts.

When a diagram cannot be faithfully converted back into Mermaid, explain which features cannot be represented rather than silently discarding them.

---

# 6. MERMAID SUPPORT

Build support incrementally and maintain a documented compatibility matrix.

Priority order:

1. Flowcharts.
2. Subgraphs and grouped architecture boundaries.
3. Sequence diagrams.
4. Entity-relationship diagrams.
5. Class diagrams.
6. State diagrams.
7. Gantt and other supported Mermaid diagram types.
8. Additional diagram types through extensible adapters.

Do not claim universal Mermaid compatibility until it has been demonstrated by tests.

For every supported diagram type:

- Parse valid source.
- Report invalid syntax with useful diagnostics.
- Preserve node identities and relationship semantics.
- Support source editing and live preview.
- Handle unsupported syntax gracefully.
- Avoid corrupting original input.
- Provide deterministic transformations where possible.
- Test representative syntax variations and large diagrams.

Keep a dedicated fixture corpus containing valid, invalid, ambiguous, nested, and edge-case diagrams.

Use official Mermaid APIs where available. Do not build a fragile parser based solely on regular expressions.

---

# 7. SEMANTIC ANALYSIS ENGINE

Implement a deterministic analysis engine.

It should identify:
- Known cloud-provider resources.
- Common infrastructure patterns.
- API and application components.
- Databases and storage systems.
- Messaging and event-processing systems.
- Networking components.
- Authentication and identity components.
- CI/CD stages.
- Data ingestion and processing stages.
- External systems and user actors.

Use evidence from explicit labels, metadata, configured mappings, and recognizable identifiers.

Maintain an extensible service registry.

Every inferred service must have a confidence level and provenance. Ambiguous matches should be presented as suggestions rather than silently substituted.

Never infer a specific service merely because a generic node could represent it.

For example:
- `db` may safely become `Database`.
- `azure sql` may resolve to an Azure SQL service when the registry confirms the mapping.
- `database` must not automatically become Azure SQL Database.
- `queue` must not automatically become a specific vendor's queue service.

Provide an API for custom recognizers, aliases, and mapping rules.

---

# 8. OFFICIAL CLOUD ICONS AND NAMING CONVENTIONS

Implement provider adapters for:

1. Microsoft Azure.
2. Amazon Web Services.
3. Google Cloud.
4. Generic infrastructure and software architecture.

Use official provider icon resources and naming guidance where licensing and distribution terms permit.

Verify:
- Official source.
- License and redistribution requirements.
- Version and update date.
- Asset attribution requirements.
- Correct service-to-icon mapping.
- Supported asset formats.
- Fallback behavior.

Do not draw inaccurate replacements and label them official.

Do not use arbitrary web-scraped logos. Keep asset provenance and license information in the repository.

The provider registry should contain fields such as:

- Provider ID.
- Canonical service ID.
- Display name.
- Official documentation URL.
- Icon asset reference.
- Resource category.
- Recognized aliases.
- Naming policies.
- Supported versions or metadata.
- Provenance and licensing details.

Create configurable naming profiles for:
- Cloud resources.
- Networking.
- Applications and microservices.
- Data platforms.
- CI/CD pipelines.
- Enterprise architecture.
- Custom organizational conventions.

Allow users to configure prefixes, suffixes, environment labels, resource categories, regions, sequence numbers, and naming templates.

Never force one vendor's naming conventions on another provider.

Offer preview, diff, apply, undo, and revert functionality for naming changes.

---

# 9. LAYOUT AND READABILITY ENGINE

Professional diagram layout is a core product requirement.

Support:
- Top-to-bottom.
- Left-to-right.
- Right-to-left.
- Bottom-to-top.
- Hierarchical layouts.
- Grouped layouts.
- Layered architecture views.
- Configurable node spacing.
- Configurable group spacing.
- Edge routing.
- Orthogonal routing where appropriate.
- Stable node placement where practical.
- Large-graph layout optimization.

Implement automatic collision and readability checks.

Detect:
- Overlapping nodes.
- Overlapping labels.
- Edges crossing nodes.
- Excessive edge crossings.
- Clipped content.
- Tiny labels.
- Unnecessarily long connectors.
- Oversized canvas dimensions.
- Unreadable group boundaries.
- Excessive whitespace.
- Dense regions requiring alternative layout.

Use measurable layout constraints rather than arbitrary fixed dimensions.

Never force all diagrams into the same layout.

Provide manual positioning and locking where appropriate so automatic layout does not destroy deliberate user adjustments.

Include diagnostics and suggested fixes for diagrams that remain difficult to read.

---

# 10. RENDERER AND VISUAL DESIGN SYSTEM

Build a professional SVG-based architecture renderer.

Requirements:
- Crisp, scalable rendering.
- Correct aspect ratios.
- Predictable text measurement.
- Appropriate node sizes.
- Consistent padding and alignment.
- Clear edge routing.
- Readable edge labels.
- Professional group containers.
- Appropriate icon sizing.
- Distinct node selection and focus states.
- Theme-aware colors.
- Tooltips and accessible labels.
- High-quality export.
- Responsive behavior.

Provide multiple rendering themes:

1. Enterprise light.
2. Enterprise dark.
3. Cloud architecture.
4. Blueprint.
5. Minimal technical.
6. High-contrast accessibility.
7. Custom theme.

Build a design-token system for spacing, typography, radii, shadows, node styles, edge styles, and semantic colors.

Use official cloud icons for recognized resources and consistent generic shapes for unknown nodes.

Do not stretch icons or use text glyphs as substitutes for official logos.

Provide a graceful fallback if an icon is unavailable.

---

# 11. GLOWING FLOW ANIMATION

Implement optional, performant, controllable SVG animations.

Features:
- Animated glowing connectors.
- Moving data packets.
- Direction-aware motion.
- Animated edge highlighting.
- Configurable speed.
- Configurable color and intensity.
- Start and end markers.
- Flow-path highlighting.
- Sequential stage transitions.
- Pause and resume.
- Step forward and backward where supported.
- Reset.
- Reduced-motion mode.
- Static rendering mode.
- Export-safe behavior.

Animations must follow actual graph relationships and directionality.

Do not animate every edge simultaneously by default. Allow selected paths and controlled playback.

Respect user preferences for reduced motion.

Prevent uncontrolled animation loops and clean up animation resources when components unmount.

For large diagrams, provide performance budgets, graceful degradation, and the ability to disable effects.

Distinguish visual playback from real execution.

---

# 12. SIMULATION ENGINE

Implement simulation as a separate subsystem.

Define an explicit simulation model containing, where applicable:

- Initial state.
- Events.
- State transitions.
- Configurable delays.
- Event ordering.
- Message propagation.
- Failure scenarios.
- Retries.
- Timeouts.
- Conditional routing.
- Execution traces.
- Metrics and timeline events.

Provide a simulation API that can execute configured scenarios deterministically for tests.

Do not imply that a diagram can reveal actual production latency, throughput, availability, or failure behavior without supporting data and a valid model.

Clearly label simulated values and hypothetical outcomes.

Support playback controls and event inspection.

Do not execute arbitrary user code or infrastructure operations merely because they appear in diagram labels.

Actual infrastructure execution, cloud provisioning, or live production integrations are out of scope for the initial release.

---

# 13. WEB APPLICATION EXPERIENCE

Build a complete interactive developer application, not merely a marketing page.

## Main editor

Create a three-panel workspace:

Left panel:
- File explorer.
- Diagram outline.
- Provider selection.
- Node and group navigation.
- Transform presets.

Center:
- Interactive diagram canvas.
- Zoom and pan.
- Selection.
- Search and focus.
- Minimap.
- Flow playback.
- Fullscreen mode.

Right panel:
- Node or edge inspector.
- Properties.
- Naming suggestions.
- Provider metadata.
- Style controls.
- Animation settings.
- Validation diagnostics.
- Transformation diff.

Bottom panel:
- Mermaid source editor.
- Parse errors.
- Warnings.
- Transformation history.
- Simulation timeline.

Allow users to resize and collapse panels.

Support keyboard shortcuts and clear focus states.

## Required workflows

1. Start from an example.
2. Paste Mermaid.
3. Upload a supported file.
4. Edit source.
5. Preview live changes.
6. Validate the diagram.
7. Apply transformations.
8. Review transformation differences.
9. Accept or revert changes.
10. Customize layout and theme.
11. Play visual flow animations.
12. Run configured simulations.
13. Export diagram and source.
14. Reopen saved local projects.

Use sensible autosave behavior with clear user controls and appropriate storage boundaries.

Never silently overwrite the original source.

## Design quality

The interface must feel like a premium developer tool.

Use:
- A compact application toolbar.
- Consistent iconography.
- Thoughtful spacing.
- Clear visual hierarchy.
- Useful empty states.
- Skeletons only where loading occurs.
- Clear error states.
- Helpful tooltips.
- Responsive layouts.
- Accessible menus and dialogs.
- Realistic architecture examples.

Avoid:
- Fake buttons.
- Placeholder links presented as functional.
- Decorative dashboards with fabricated metrics.
- Randomly generated diagram content presented as the user's data.
- Excessive cards.
- Broken or overlapping diagrams.
- Unnecessary full-screen animations.

All visible controls must perform their advertised action.

---

# 14. CLI AND PROGRAMMATIC API

Build a CLI that supports commands conceptually similar to:

flowforge validate input.mmd

flowforge transform input.mmd --provider azure --theme dark

flowforge render input.mmd --format svg --output diagram.svg

flowforge inspect input.mmd

flowforge providers list

flowforge diff input.mmd transformed.mmd

Use a proper command-line argument parser.

Support useful exit codes, actionable error messages, quiet mode, verbose mode, and machine-readable output where appropriate.

Document the actual supported syntax and flags.

Create a stable programmatic API for:

- Parsing.
- Validation.
- Transformation.
- Layout.
- Rendering.
- Serialization.
- Provider lookup.
- Simulation.
- Diagnostics.

Provide React components with typed props and documented events.

Avoid making browser-only APIs mandatory for server-side CLI usage.

---

# 15. EXPORT AND INTEGRATION

Prioritize:
- SVG export.
- PNG export.
- Mermaid source export.
- JSON diagram model export.
- Copy-to-clipboard.
- Import from local files.
- Programmatic integration.

Add PDF export only after a reliable rendering and pagination strategy exists.

Validate export dimensions, fonts, embedded icons, backgrounds, and clipping.

If a transformation depends on custom renderer features that Mermaid cannot express, preserve the enhanced output through SVG or the normalized diagram model.

Do not promise fidelity that the target format cannot provide.

---

# 16. PERFORMANCE AND ACCESSIBILITY

Establish measurable targets and test representative diagrams.

Test:
- Small diagrams.
- Medium architecture diagrams.
- Large graphs with hundreds of nodes.
- Graphs with thousands of edges where practical.
- Deeply nested groups.
- Long labels.
- Missing icons.
- Invalid source.
- Rapid editor updates.
- Repeated mount and unmount.
- Reduced-motion mode.

Use profiling to identify bottlenecks.

Avoid unnecessary React rerenders and repeated expensive layouts.

Consider debouncing source parsing and using workers for expensive computations when supported and justified.

Provide:
- Keyboard navigation.
- Accessible names.
- Visible focus indicators.
- Adequate contrast.
- Nonanimated alternatives.
- Screen-reader-readable diagnostics.
- Clear error messages.

Do not sacrifice basic accessibility for visual effects.

---

# 17. SECURITY AND PRIVACY

Treat Mermaid source, labels, uploaded files, imported JSON, SVG content, and custom metadata as untrusted input.

Implement appropriate protections against:
- Script injection.
- Unsafe SVG content.
- Malicious links.
- HTML injection.
- Path traversal.
- Unsafe file operations.
- Unintended remote asset loading.
- Denial of service through pathological graph inputs.
- Secret leakage in logs.

Sanitize generated SVG and avoid unsafe HTML rendering.

Restrict import size and expensive parsing operations where appropriate.

Do not upload source code or diagrams to an AI provider unless the user explicitly enables the integration and understands the data flow.

Do not store user diagrams on a server by default.

Never execute commands or infrastructure actions embedded in diagram text.

Document security boundaries and assumptions.

---

# 18. TESTING AND QUALITY GATES

Testing is mandatory throughout development.

## Unit tests
- Parser adapters.
- Normalized graph model.
- Naming rules.
- Provider matching.
- Transformation determinism.
- Serialization.
- Validation diagnostics.
- Simulation transitions.
- Export utilities.

## Integration tests
- Parse to model.
- Model to layout.
- Layout to rendering.
- Source editing to preview.
- Transformation to diff.
- Provider recognition to icon rendering.
- CLI commands and exit codes.

## End-to-end tests
- Open the application.
- Load example diagrams.
- Paste source.
- Handle invalid Mermaid.
- Transform a diagram.
- Change layout.
- Play and pause animation.
- Run a simulation.
- Export SVG.
- Reopen the project.

## Visual regression
Maintain representative snapshots for important layouts and themes. Avoid brittle snapshots for intentionally animated states.

## Quality gates
Before declaring a phase complete, run all applicable:
- Formatting checks.
- Lint.
- Type checking.
- Unit tests.
- Integration tests.
- Build.
- End-to-end tests.
- Dependency and security checks.

Report any command that cannot run and explain why.

Never remove or weaken a test simply to make CI pass.

---

# 19. DOCUMENTATION AND PROJECT GOVERNANCE

Create and maintain:

README.md
LICENSE
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
CHANGELOG.md
PROJECT_STATUS.md
ROADMAP.md
SUPPORT.md
.env.example, only if required
.editorconfig
.gitignore
.prettierrc or equivalent
.github/workflows/ci.yml
.github/PULL_REQUEST_TEMPLATE.md

Also create:

docs/architecture/SYSTEM_ARCHITECTURE.md
docs/architecture/DATA_MODEL.md
docs/architecture/RENDERING_PIPELINE.md
docs/architecture/SECURITY_MODEL.md
docs/architecture/ADR/
docs/guides/GETTING_STARTED.md
docs/guides/PROVIDER_REGISTRY.md
docs/guides/CUSTOM_TRANSFORMS.md
docs/guides/THEMES_AND_ANIMATIONS.md
docs/guides/SIMULATION.md
docs/api/
docs/testing/TEST_STRATEGY.md

Create additional documentation when justified.

Every document must describe the real implementation. Do not document nonexistent capabilities as if they already exist.

Use architecture decision records for significant technical choices.

Keep a feature-status matrix with:
- Planned.
- In progress.
- Implemented.
- Tested.
- Documented.
- Known limitations.

---

# 20. GIT AND OPEN-SOURCE WORKFLOW

Use small, reviewable changes.

Before modifying files:
- Inspect Git status.
- Preserve unrelated user changes.
- Identify the current branch and existing conventions.

Follow Conventional Commits, for example:

feat(core): add normalized graph model
feat(providers): add Azure service mappings
feat(renderer): implement animated SVG edges
feat(cli): add SVG export command
fix(layout): prevent clipped edge labels
test(core): add transformation regression cases
docs(architecture): document renderer adapters

Never claim that a commit or push succeeded unless the corresponding command succeeded.

Do not push to remote repositories, publish npm packages, create releases, or modify protected branches without explicit authorization.

Never commit credentials, tokens, personal data, or generated secrets.

Prepare pull-request-ready changes with clear summaries, test evidence, and known limitations.

---

# 21. STRICT IMPLEMENTATION PHASES

Work in the following sequence. Do not skip foundational phases to build flashy features.

## Phase 0 — Discovery and planning

Inspect the repository and available environment.

Deliver:
- Repository assessment.
- Requirements and assumptions.
- Dependency strategy.
- Architecture diagram.
- Package dependency graph.
- Risk register.
- Phased implementation plan.
- Acceptance criteria.
- Initial PROJECT_STATUS.md.
- Initial ADRs where required.

Do not spend the entire project writing planning documents. Once the plan is coherent, begin implementation.

## Phase 1 — Foundation

Deliver:
- Monorepo or compatible repository structure.
- TypeScript configuration.
- Lint and formatting.
- Build orchestration.
- CI workflow.
- Typed graph model.
- Parser adapter.
- Initial test fixtures.
- Working example.

Acceptance criteria:
- A valid supported Mermaid diagram can be parsed.
- A graph model can be produced.
- Invalid input returns useful diagnostics.
- Unit tests and builds pass.

## Phase 2 — Core transformations

Deliver:
- Deterministic transformation pipeline.
- Naming rules.
- Transformation registry.
- Diff and undo support.
- Validation rules.
- Serialization.
- Initial CLI commands.

Acceptance criteria:
- Transformations preserve graph meaning.
- Unchanged input produces stable output where applicable.
- Ambiguous mappings are not silently applied.
- Tests cover transformation regressions.

## Phase 3 — Rendering and layout

Deliver:
- SVG renderer.
- Automatic layout.
- Edge routing.
- Themes.
- Node selection.
- Zoom and pan.
- Collision diagnostics.
- SVG export.

Acceptance criteria:
- Representative diagrams render without clipping or unintended overlap.
- Large diagrams remain navigable.
- Theme switching works.
- Export output is valid and readable.

## Phase 4 — Provider intelligence

Deliver:
- Provider registry.
- Azure adapter.
- AWS adapter.
- Google Cloud adapter.
- Official icon assets with verified provenance.
- Naming profiles.
- Ambiguity handling.
- Provider-specific tests.

Acceptance criteria:
- Known mappings render the correct icons.
- Unknown mappings fall back gracefully.
- Assets meet documented licensing requirements.
- Naming rules are configurable.

## Phase 5 — Web editor

Deliver:
- Complete application workspace.
- Source editor.
- Interactive canvas.
- Inspector.
- Transformation controls.
- Diff preview.
- Error diagnostics.
- Search and minimap.
- Save and export workflows.

Acceptance criteria:
- A user can import, edit, transform, inspect, and export a diagram.
- Every visible control has working behavior.
- Errors do not crash the entire workspace.

## Phase 6 — Animation and simulation

Deliver:
- Animated SVG paths.
- Data packet effects.
- Playback controls.
- Flow highlighting.
- Reduced-motion support.
- Simulation configuration.
- Event timeline.
- Failure scenarios.

Acceptance criteria:
- Playback follows graph relationships.
- Pause and reset work reliably.
- Simulated behavior is clearly distinguished from real execution.
- Tests verify deterministic scenarios.

## Phase 7 — CLI, API and integrations

Deliver:
- Stable public API.
- CLI documentation.
- React integration.
- Usage examples.
- Package build verification.
- API compatibility tests.

Acceptance criteria:
- Packages can be built and consumed as intended.
- Public exports are typed.
- CLI commands work in a clean environment.
- Examples use the documented APIs.

## Phase 8 — Hardening and release readiness

Deliver:
- Security review.
- Performance profiling.
- Accessibility audit.
- Visual regression suite.
- Documentation audit.
- Release notes.
- Example gallery.
- Known limitations.
- Release checklist.

Acceptance criteria:
- All feasible quality gates pass.
- Outstanding failures are reported accurately.
- No known critical security issues are concealed.
- Installation and quick-start instructions are reproducible.

---

# 22. HOW YOU MUST WORK

Follow these operating rules throughout the project.

1. Think like an engineering team maintaining software for years, not a developer generating a disposable demo.

2. Inspect before changing. Do not blindly replace files.

3. Plan the smallest useful implementation slice, then implement and verify it.

4. Keep functions, packages, types, and interfaces focused.

5. Avoid giant files, duplicated business logic, circular dependencies, unnecessary abstractions, and premature micro-optimization.

6. Use typed interfaces and explicit error handling.

7. Prefer deterministic, testable transformations.

8. Never silently destroy original source or user changes.

9. Never fake an integration, official icon, test result, feature, or release.

10. When an external service, credential, network connection, or unavailable dependency blocks a task, implement the safe portion and document the blocker.

11. Do not repeatedly ask for permission to perform routine, reversible coding work.

12. Ask for authorization before destructive actions, publishing, pushing, provisioning resources, or accessing sensitive services.

13. Update PROJECT_STATUS.md and the relevant documentation after each meaningful milestone.

14. If a test fails, diagnose and fix the underlying problem rather than bypassing the test.

15. Keep a running list of technical debt, known limitations, and follow-up work.

16. Prefer working software over elaborate plans, but never sacrifice correctness for superficial progress.

17. Do not stop after creating the architecture, README, or UI shell.

18. Do not claim that every Mermaid type or cloud service is supported when only a subset has been implemented.

19. Do not add AI dependencies unless there is a specific, documented use case and a deterministic fallback.

20. Make the repository understandable to a new contributor.

---

# 23. FINAL DELIVERABLES

At the end of the implementation work, provide:

1. A summary of what was actually implemented.
2. Repository and package structure.
3. Exact setup and installation commands.
4. Development and build commands.
5. Supported Mermaid syntax.
6. Supported cloud providers and icon coverage.
7. Working application entry point.
8. CLI examples.
9. Public API examples.
10. Test commands and actual results.
11. Build and lint results.
12. Screenshots or visual evidence when available.
13. Performance and accessibility findings.
14. Security limitations.
15. Known bugs and incomplete features.
16. Recommended next phase.
17. Git status and commit details, if applicable.

Separate completed features from partial implementations and planned features.

Do not fabricate test counts, screenshots, URLs, package publication, commits, or successful builds.

---

# 24. FIRST ACTION

Begin now.

Inspect the current repository and environment. Produce a concise initial assessment, architecture recommendation, and phased task checklist. Then start implementing Phase 0 and Phase 1 in the same working session wherever the environment permits.

Do not stop after presenting a plan. Continue into actual code, run the available checks, fix discovered problems, update documentation, and leave the repository in the strongest verified working state possible.

The ultimate objective is a trustworthy, extensible, visually exceptional Mermaid transformation engine that developers can integrate into real projects—not just a beautiful demo.