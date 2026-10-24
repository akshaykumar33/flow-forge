import { createParser, type MermaidApi } from './parse.js';

export {
  DEFAULT_MAX_EDGES,
  DEFAULT_MAX_SOURCE_LENGTH,
  type ParseOptions,
  type ParseResult,
} from './parse.js';

/** Browser entry: Mermaid uses the real `window`. Node resolves `./node.js` instead. */
export const parse = createParser(
  async () => (await import('mermaid')).default as unknown as MermaidApi,
);
