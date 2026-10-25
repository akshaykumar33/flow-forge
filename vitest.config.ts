import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against workspace sources so tests never run against a stale build.
    alias: {
      '@flowforge/core': source('./packages/core/src/index.ts'),
      '@flowforge/parser': source('./packages/parser/src/node.ts'),
      '@flowforge/transforms': source('./packages/transforms/src/index.ts'),
      '@flowforge/layout': source('./packages/layout/src/index.ts'),
      '@flowforge/renderer': source('./packages/renderer/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts'],
  },
});
