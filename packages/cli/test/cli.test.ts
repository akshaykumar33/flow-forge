import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from '@flowforge/parser';
import { EXIT, run, type CliIo } from '../src/index.js';

const BASIC = `flowchart LR
  user((User)) -->|HTTPS| api[Orders  API]
  subgraph azure[Azure]
    api --> db[(Orders DB)]
  end
`;

const RENAMED = `flowchart LR
  user((User)) -->|HTTPS| api[Orders API v2]
  subgraph azure[Azure]
    api --> db[(Orders DB)]
  end
  api --> cache[Cache]
`;

interface Harness {
  io: CliIo;
  out: () => string;
  err: () => string;
  files: Map<string, string>;
}

function harness(files: Record<string, string> = {}, stdin = ''): Harness {
  const cwd = resolve('/work');
  const store = new Map(Object.entries(files).map(([k, v]) => [resolve(cwd, k), v]));
  let out = '';
  let err = '';
  return {
    io: {
      stdout: (t) => void (out += t),
      stderr: (t) => void (err += t),
      readText: async (p) => {
        const text = store.get(p);
        if (text === undefined) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
        return text;
      },
      writeText: async (p, t) => void store.set(p, t),
      readStdin: async () => stdin,
      cwd,
    },
    out: () => out,
    err: () => err,
    files: store,
  };
}

beforeAll(() => parse('flowchart LR\n  warm --> up'), 30_000);

describe('usage', () => {
  it('prints help with exit 0, and usage with exit 2 when no command is given', async () => {
    const h = harness();
    expect(await run(['--help'], h.io)).toBe(EXIT.ok);
    expect(h.out()).toContain('Usage: flowforge');
    const h2 = harness();
    expect(await run([], h2.io)).toBe(EXIT.usage);
    expect(h2.err()).toContain('Usage: flowforge');
  });

  it('rejects unknown commands, unknown flags and misplaced flags with exit 2', async () => {
    for (const argv of [
      ['publish', 'a.mmd'],
      ['validate', 'a.mmd', '--bogus'],
      ['validate', 'a.mmd', '--template', 'x'],
      ['validate'],
      ['inspect', 'a.mmd', '-q', '-v'],
    ]) {
      const h = harness({ 'a.mmd': BASIC });
      expect(await run(argv, h.io), argv.join(' ')).toBe(EXIT.usage);
      expect(h.err()).toMatch(/flowforge: .+/);
    }
  });

  it('reports a missing file with exit 3', async () => {
    const h = harness();
    expect(await run(['validate', 'nope.mmd'], h.io)).toBe(EXIT.io);
    expect(h.err()).toContain('Cannot read nope.mmd: file not found.');
  });
});

describe('validate', () => {
  it('accepts a valid diagram', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['validate', 'a.mmd'], h.io)).toBe(EXIT.ok);
    expect(h.out()).toBe('a.mmd: valid\n');
  });

  it('reports syntax errors with file:line:col and exit 1', async () => {
    const h = harness({ 'bad.mmd': 'flowchart LR\n  A --> \n  B[[[\n' });
    expect(await run(['validate', 'bad.mmd'], h.io)).toBe(EXIT.failed);
    // One line: Mermaid's headline plus its reason, without the excerpt in between.
    expect(h.err()).toMatch(
      /^bad\.mmd:3:\d+: error syntax-error: Parse error on line 3: Expecting .+, got .+\n$/,
    );
  });

  it('prints machine-readable output with --json', async () => {
    const h = harness({ 'bad.mmd': 'sequenceDiagram\n  A->>B: hi\n' });
    expect(await run(['validate', 'bad.mmd', '--json'], h.io)).toBe(EXIT.failed);
    expect(JSON.parse(h.out())).toMatchObject({
      file: 'bad.mmd',
      valid: false,
      diagnostics: [{ code: 'diagram-type-unsupported' }],
    });
  });

  it('reads stdin and validates .json models', async () => {
    const h = harness({}, BASIC);
    expect(await run(['validate', '-', '-q'], h.io)).toBe(EXIT.ok);
    expect(h.out()).toBe('');
    const h2 = harness({ 'm.json': '{"version": 2}' });
    expect(await run(['validate', 'm.json'], h2.io)).toBe(EXIT.failed);
    expect(h2.err()).toContain('error schema-invalid');
  });
});

describe('inspect', () => {
  it('summarises nodes and groups', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['inspect', 'a.mmd'], h.io)).toBe(EXIT.ok);
    expect(h.out()).toContain('nodes      3');
    expect(h.out()).toMatch(/db\s+cylinder\s+"Orders DB"\s+in Azure/);
  });

  it('--json prints the deterministic model', async () => {
    const h = harness({ 'a.mmd': BASIC });
    await run(['inspect', 'a.mmd', '--json'], h.io);
    expect(JSON.parse(h.out())).toMatchObject({ version: 1, direction: 'LR' });
  });
});

describe('transform', () => {
  it('renames, tidies and prints Mermaid that parses back', async () => {
    const h = harness({ 'a.mmd': BASIC });
    const code = await run(
      [
        'transform',
        'a.mmd',
        '--tidy',
        '--template',
        '{env}-{label}',
        '--env',
        'prod',
        '--case',
        'kebab',
      ],
      h.io,
    );
    expect(code).toBe(EXIT.ok);
    expect(h.out()).toContain('api["prod-orders-api"]');
    expect(h.err()).toContain('a.mmd: 3 element(s) changed');
    const reparsed = await parse(h.out());
    expect(reparsed.ok).toBe(true);
  });

  it('writes json with rename provenance kept', async () => {
    const h = harness({ 'a.mmd': BASIC });
    await run(
      [
        'transform',
        'a.mmd',
        '--template',
        '{label}',
        '--case',
        'upper',
        '--format',
        'json',
        '-o',
        'out.json',
      ],
      h.io,
    );
    const model = JSON.parse(h.files.get(resolve('/work', 'out.json'))!);
    const db = model.nodes.find((n: { id: string }) => n.id === 'db');
    expect(db.label).toBe('ORDERS DB');
    expect(db.inferences[0]).toMatchObject({ key: 'original-label', value: 'Orders DB' });
  });

  it('scopes renames with --group', async () => {
    const h = harness({ 'a.mmd': BASIC });
    await run(
      ['transform', 'a.mmd', '--template', 'az-{label}', '--group', 'azure', '--format', 'json'],
      h.io,
    );
    const labels = JSON.parse(h.out()).nodes.map((n: { label: string }) => n.label);
    // api is in azure: it appears inside the subgraph block, so Mermaid places it there.
    expect(labels).toEqual(['User', 'az-Orders  API', 'az-Orders DB']);
  });

  it('refuses to overwrite its input unless --force is given', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['transform', 'a.mmd', '--tidy', '-o', './a.mmd'], h.io)).toBe(EXIT.usage);
    expect(h.files.get(resolve('/work', 'a.mmd'))).toBe(BASIC);
    expect(h.err()).toContain('Refusing to overwrite the input file');
    expect(await run(['transform', 'a.mmd', '--tidy', '-o', 'a.mmd', '--force'], h.io)).toBe(
      EXIT.ok,
    );
  });

  it('rejects bad options and unknown template tokens', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['transform', 'a.mmd'], h.io)).toBe(EXIT.usage);
    expect(await run(['transform', 'a.mmd', '--tidy', '--case', 'camel'], h.io)).toBe(EXIT.usage);
    expect(await run(['transform', 'a.mmd', '--tidy', '--format', 'svg'], h.io)).toBe(EXIT.usage);
    const h2 = harness({ 'a.mmd': BASIC });
    expect(await run(['transform', 'a.mmd', '--template', '{owner}'], h2.io)).toBe(EXIT.failed);
    expect(h2.err()).toContain('naming-unknown-token');
  });

  it('is deterministic', async () => {
    const outputs: string[] = [];
    for (let i = 0; i < 2; i++) {
      const h = harness({ 'a.mmd': BASIC });
      await run(['transform', 'a.mmd', '--template', '{label}-{seq}', '--case', 'snake'], h.io);
      outputs.push(h.out());
    }
    expect(outputs[1]).toBe(outputs[0]);
  });
});

describe('diff', () => {
  it('exits 0 for equivalent diagrams, even across formats', async () => {
    const h = harness({ 'a.mmd': BASIC });
    await run(['inspect', 'a.mmd', '--json'], h.io);
    const h2 = harness({ 'a.mmd': BASIC, 'a.json': h.out() });
    expect(await run(['diff', 'a.mmd', 'a.json'], h2.io)).toBe(EXIT.ok);
    expect(h2.out()).toBe('No differences.\n');
  });

  it('lists changes and exits 1 when diagrams differ', async () => {
    const h = harness({ 'a.mmd': BASIC, 'b.mmd': RENAMED });
    expect(await run(['diff', 'a.mmd', 'b.mmd'], h.io)).toBe(EXIT.failed);
    expect(h.out()).toBe(
      [
        '~ node api.label: "Orders  API" -> "Orders API v2"',
        '+ node cache',
        '+ edge L_api_cache_0',
        '',
      ].join('\n'),
    );
  });

  it('refuses two stdin inputs', async () => {
    const h = harness();
    expect(await run(['diff', '-', '-'], h.io)).toBe(EXIT.usage);
  });
});

describe('built binary', () => {
  const bin = resolve(import.meta.dirname, '../dist/bin.js');
  it.runIf(existsSync(bin))(
    'runs end to end and sets the exit code',
    async () => {
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(process.execPath, [bin, '--version']);
      expect(stdout.trim()).toBe('0.0.0');
      const failure = await execFileAsync(process.execPath, [bin, 'validate', 'missing.mmd']).catch(
        (e) => e,
      );
      expect(failure.code).toBe(EXIT.io);
    },
    30_000,
  );
});

describe('render', () => {
  it('writes a themed SVG and keeps the input untouched', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['render', 'a.mmd', '--theme', 'enterprise-dark', '-o', 'a.svg'], h.io)).toBe(
      EXIT.ok,
    );
    const svg = h.files.get(resolve('/work', 'a.svg'))!;
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('fill="#0b0e13"');
    expect(svg).toContain('data-node-id="db"');
    expect(h.files.get(resolve('/work', 'a.mmd'))).toBe(BASIC);
    expect(h.err()).toBe('');
  });

  it('prints SVG to stdout by default', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['render', 'a.mmd'], h.io)).toBe(EXIT.ok);
    expect(h.out()).toContain('</svg>');
  });

  it('rejects unknown themes, formats and misplaced flags', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['render', 'a.mmd', '--theme', 'neon'], h.io)).toBe(EXIT.usage);
    expect(await run(['render', 'a.mmd', '--format', 'png'], h.io)).toBe(EXIT.usage);
    expect(await run(['render', 'a.mmd', '--template', 'x'], h.io)).toBe(EXIT.usage);
    expect(await run(['transform', 'a.mmd', '--tidy', '--theme', 'enterprise-dark'], h.io)).toBe(
      EXIT.usage,
    );
    expect(h.err()).toContain('--theme does not apply to "transform"');
  });

  it('refuses to overwrite its input and reports invalid diagrams', async () => {
    const h = harness({ 'a.mmd': BASIC, 'bad.mmd': 'flowchart LR\n  A --> \n  B[[[\n' });
    expect(await run(['render', 'a.mmd', '-o', 'a.mmd'], h.io)).toBe(EXIT.usage);
    expect(await run(['render', 'bad.mmd'], h.io)).toBe(EXIT.failed);
    expect(h.out()).toBe('');
  });

  it('reports layout notes in verbose mode', async () => {
    const source = 'flowchart LR\n  subgraph g[G]\n    direction TB\n    a --> b\n  end\n';
    const h = harness({ 'g.mmd': source });
    expect(await run(['render', 'g.mmd', '-v', '-o', 'g.svg'], h.io)).toBe(EXIT.ok);
    expect(h.err()).toContain('info layout-group-direction-ignored');
    expect(h.err()).toMatch(/laid out 2 nodes in \d+ ms/);
  });
});
