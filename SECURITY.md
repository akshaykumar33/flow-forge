# Security

## Reporting a vulnerability

Do not open a public issue. Report privately through the repository's **Security** tab
("Report a vulnerability"), with steps to reproduce.

## Security model (current)

FlowForge treats all Mermaid source and imported JSON as untrusted.

- Parsing runs Mermaid with `securityLevel: 'strict'`. Mermaid removes script content from
  labels; the model stores labels as plain text, and renderers must escape them on output.
- Imported models are validated against a schema before use (`validateModel`).
- Source length and edge count are capped to limit denial of service from oversized input.
- Diagram text is never executed. There is no network access and no server-side storage.

Known limitation: in Node, `@flowforge/parser` installs a global jsdom `window` and `document`
before loading Mermaid.
