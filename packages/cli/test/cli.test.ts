import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from '@flowforge/parser';
import { EXIT, run, VERSION, type CliIo } from '../src/index.js';

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
  bytes: Map<string, Uint8Array>;
}

function harness(files: Record<string, string> = {}, stdin = ''): Harness {
  const cwd = resolve('/work');
  const store = new Map(Object.entries(files).map(([k, v]) => [resolve(cwd, k), v]));
  let out = '';
  let err = '';
  const bytes = new Map<string, Uint8Array>();
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
      writeBytes: async (p, b) => void bytes.set(p, b),
      readSvgFiles: async (dir) => {
        const prefix = dir.endsWith(sep) ? dir : dir + sep;
        return [...store]
          .filter(([p]) => p.startsWith(prefix) && p.endsWith('.svg'))
          .map(([p, svg]) => ({ path: p.slice(prefix.length), svg }));
      },
      readStdin: async () => stdin,
      cwd,
    },
    out: () => out,
    err: () => err,
    files: store,
    bytes,
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
      expect(stdout.trim()).toBe('0.2.0');
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

describe('version', () => {
  it('matches the package version, so --version never drifts from releases', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(VERSION).toBe(pkg.version);
    const h = harness();
    expect(await run(['--version'], h.io)).toBe(EXIT.ok);
    expect(h.out()).toBe(`${pkg.version}\n`);
  });
});

describe('render to PNG', () => {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const widthOf = (png: Uint8Array) => new DataView(png.buffer, png.byteOffset).getUint32(16);

  it('writes a real PNG at the requested scale', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['render', 'a.mmd', '--format', 'png', '-o', 'a.png'], h.io)).toBe(EXIT.ok);
    expect(
      await run(['render', 'a.mmd', '--format', 'png', '--scale', '1', '-o', 'b.png'], h.io),
    ).toBe(EXIT.ok);
    const twoX = h.bytes.get(resolve('/work', 'a.png'))!;
    const oneX = h.bytes.get(resolve('/work', 'b.png'))!;
    expect([...twoX.slice(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(widthOf(twoX)).toBe(widthOf(oneX) * 2);
  }, 30_000);

  it('requires -o and a sane scale', async () => {
    const h = harness({ 'a.mmd': BASIC });
    expect(await run(['render', 'a.mmd', '--format', 'png'], h.io)).toBe(EXIT.usage);
    expect(h.err()).toContain('PNG output is binary');
    expect(
      await run(['render', 'a.mmd', '--format', 'png', '--scale', '50', '-o', 'x.png'], h.io),
    ).toBe(EXIT.usage);
    expect(await run(['render', 'a.mmd', '--format', 'gif', '-o', 'x.gif'], h.io)).toBe(EXIT.usage);
    expect(await run(['validate', 'a.mmd', '--scale', '2'], h.io)).toBe(EXIT.usage);
  });
});

describe('transform --recognize', () => {
  const CLOUD = `flowchart LR
  subgraph aws[AWS account]
    gw[API Gateway] --> fn[AWS Lambda]
  end
  fn --> db[(database)]
  fn --> sql[(Azure SQL Database)]
  x[API Gateway]
`;

  it('tags certain services, gives generic labels a category, and only suggests the rest', async () => {
    const h = harness({ 'c.mmd': CLOUD });
    expect(await run(['transform', 'c.mmd', '--recognize', '--format', 'json'], h.io)).toBe(
      EXIT.ok,
    );
    const nodes = JSON.parse(h.out()).nodes as {
      id: string;
      inferences: { key: string; value: string }[];
    }[];
    const value = (id: string, key: string) =>
      nodes.find((n) => n.id === id)!.inferences.find((i) => i.key === key)?.value;
    expect(value('fn', 'service')).toBe('aws.lambda');
    expect(value('sql', 'service')).toBe('azure.sql-database');
    expect(value('db', 'category')).toBe('database');
    expect(value('db', 'service')).toBeUndefined();
    expect(value('gw', 'service')).toBeUndefined();
    expect(h.err()).toContain('suggestion: node "gw" may be Amazon API Gateway (confidence 0.8)');
    expect(h.err()).toContain('suggestion: node "x" may be API Gateway (confidence 0.5)');
  });

  it('fills {category} in naming templates from recognition', async () => {
    const h = harness({ 'c.mmd': CLOUD });
    await run(
      [
        'transform',
        'c.mmd',
        '--recognize',
        '--template',
        '{category}-{label}',
        '--case',
        'kebab',
        '--format',
        'json',
        '-q',
      ],
      h.io,
    );
    const labels = JSON.parse(h.out()).nodes.map((n: { label: string }) => n.label);
    expect(labels).toContain('serverless-aws-lambda');
    expect(labels).toContain('database-database');
  });

  it('includes suggestions in --json output and validates --provider', async () => {
    const h = harness({ 'c.mmd': CLOUD });
    await run(['transform', 'c.mmd', '--recognize', '--provider', 'gcp', '--json'], h.io);
    const report = JSON.parse(h.err());
    expect(report.suggestions.map((s: { elementId: string }) => s.elementId)).toContain('x');
    const h2 = harness({ 'c.mmd': CLOUD });
    expect(await run(['transform', 'c.mmd', '--recognize', '--provider', 'oracle'], h2.io)).toBe(
      EXIT.usage,
    );
    expect(await run(['transform', 'c.mmd', '--tidy', '--provider', 'aws'], h2.io)).toBe(
      EXIT.usage,
    );
  });
});

describe('transform --json on failure', () => {
  it('still prints one JSON report with the diagnostics', async () => {
    const h = harness({ 'bad.mmd': 'flowchart LR\n  A --> \n  B[[[\n' });
    expect(await run(['transform', 'bad.mmd', '--tidy', '--json'], h.io)).toBe(EXIT.failed);
    expect(JSON.parse(h.err()).diagnostics[0].code).toBe('syntax-error');
  });
});

describe('render --icon-pack', () => {
  const ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64"/></svg>';
  const DIAGRAM = 'flowchart LR\n  fn[AWS Lambda] --> db[(DynamoDB)] --> q[queue]\n';

  it('draws icons from the user’s pack for recognised services only', async () => {
    const h = harness({
      'd.mmd': DIAGRAM,
      'aws-icons/Arch_AWS-Lambda_64.svg': ICON,
      'aws-icons/sub/Arch_Amazon-DynamoDB_64.svg': ICON,
    });
    expect(
      await run(['render', 'd.mmd', '--icon-pack', 'aws:aws-icons', '-o', 'd.svg', '-v'], h.io),
    ).toBe(EXIT.ok);
    const svg = h.files.get(resolve('/work', 'd.svg'))!;
    expect((svg.match(/<image /g) ?? []).length).toBe(2);
    expect(svg).toMatch(/data-node-id="fn">[\s\S]*?<image /);
    expect(svg).not.toMatch(/data-node-id="q">[\s\S]*?<image [\s\S]*?<\/g>\n<\/g>/);
    expect(h.err()).toContain('icons for 2 aws services');
  });

  it('renders without icons when no pack is given, and rejects malformed pack values', async () => {
    const h = harness({ 'd.mmd': DIAGRAM });
    expect(await run(['render', 'd.mmd', '-o', 'd.svg'], h.io)).toBe(EXIT.ok);
    expect(h.files.get(resolve('/work', 'd.svg'))).not.toContain('<image');
    expect(await run(['render', 'd.mmd', '--icon-pack', 'oracle:./x'], h.io)).toBe(EXIT.usage);
    expect(await run(['render', 'd.mmd', '--icon-pack', 'aws'], h.io)).toBe(EXIT.usage);
    expect(await run(['validate', 'd.mmd', '--icon-pack', 'aws:x'], h.io)).toBe(EXIT.usage);
  });
});
