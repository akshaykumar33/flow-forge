import type { NextConfig } from 'next';

// Static export: plain files, no server, so diagrams never leave the browser (ADR-0008).
const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default config;
