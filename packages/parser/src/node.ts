import { createParser, type MermaidApi } from './parse.js';

export {
  DEFAULT_MAX_EDGES,
  DEFAULT_MAX_SOURCE_LENGTH,
  type ParseOptions,
  type ParseResult,
} from './parse.js';

/**
 * Node entry. Mermaid's bundled DOMPurify needs a `window` at import time (ADR-0004), so a jsdom
 * window is installed first. It is only installed when no `window` exists, and it sets
 * `globalThis.window` and `globalThis.document`, which code checking `typeof window` will see.
 */
export const parse = createParser(async () => {
  if (typeof globalThis.window === 'undefined') {
    const { JSDOM } = await import('jsdom');
    const { window } = new JSDOM('');
    Object.assign(globalThis, { window, document: window.document });
  }
  return (await import('mermaid')).default as unknown as MermaidApi;
});
