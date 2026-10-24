import { parseArgs, type ParseArgsConfig } from 'node:util';
import { diff } from './commands/diff.js';
import { inspect } from './commands/inspect.js';
import { render } from './commands/render.js';
import { transform } from './commands/transform.js';
import { validate } from './commands/validate.js';
import { CliError, EXIT, nodeIo, type CliIo } from './io.js';

export { EXIT, MAX_INPUT_BYTES, nodeIo, type CliIo } from './io.js';

export const VERSION = '0.0.0';

const USAGE = `Usage: flowforge <command> [options]

Commands
  validate <file>          Check a diagram; report problems with line numbers
  inspect <file>           Summarise a diagram (--json prints the full model)
  transform <file>         Apply transforms and print the result
  diff <a> <b>             Compare two diagrams by element id
  render <file>            Lay out and draw the diagram as SVG

<file> is Mermaid source, a .json model, or - for stdin.

Global options
  --json                   Machine-readable output
  -q, --quiet              Only print errors
  -v, --verbose            Print more detail
  -h, --help               Show help
  --version                Show version

Transform options
  --tidy                   Trim and collapse whitespace in labels
  --template <t>           Rename labels, e.g. "{env}-{label}-{seq}"
                           Tokens: {label} {prefix} {suffix} {env} {region} {seq} {category}
  --case <c>               preserve | kebab | snake | title | upper
  --prefix, --suffix, --env, --region <value>
  --group <id>             Only rename nodes inside this group (repeatable)
  --format <f>             mermaid (default) | json
  -o, --output <path>      Write to a file instead of stdout
  --force                  Allow --output to overwrite the input file

Render options
  --theme <t>              enterprise-light (default) | enterprise-dark | high-contrast
  --format <f>             svg (default)
  -o, --output <path>      Write to a file instead of stdout
  --force                  Allow --output to overwrite the input file

Exit codes: 0 success · 1 invalid input, differences found, or a broken layout ·
            2 usage error · 3 file error
`;

const OPTIONS = {
  json: { type: 'boolean', default: false },
  quiet: { type: 'boolean', short: 'q', default: false },
  verbose: { type: 'boolean', short: 'v', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', default: false },
  tidy: { type: 'boolean', default: false },
  template: { type: 'string' },
  case: { type: 'string' },
  prefix: { type: 'string' },
  suffix: { type: 'string' },
  env: { type: 'string' },
  region: { type: 'string' },
  group: { type: 'string', multiple: true },
  format: { type: 'string' },
  theme: { type: 'string' },
  output: { type: 'string', short: 'o' },
  force: { type: 'boolean', default: false },
} satisfies ParseArgsConfig['options'];

type OptionName = keyof typeof OPTIONS;
const GLOBAL: readonly OptionName[] = ['json', 'quiet', 'verbose', 'help', 'version'];
/** Flags each command accepts beyond the global ones; anything else is a usage error. */
const COMMAND_OPTIONS: Record<string, readonly OptionName[]> = {
  validate: [],
  inspect: [],
  diff: [],
  transform: [
    'tidy',
    'template',
    'case',
    'prefix',
    'suffix',
    'env',
    'region',
    'group',
    'format',
    'output',
    'force',
  ],
  render: ['theme', 'format', 'output', 'force'],
};

/** Runs the CLI and returns its exit code. Never calls `process.exit`, so it is testable. */
export async function run(argv: readonly string[], io: CliIo = nodeIo()): Promise<number> {
  try {
    return await dispatch(argv, io);
  } catch (error) {
    if (error instanceof CliError) {
      io.stderr(`flowforge: ${error.message}\n`);
      if (error.exitCode === EXIT.usage) io.stderr('Run "flowforge --help" for usage.\n');
      return error.exitCode;
    }
    io.stderr(
      `flowforge: unexpected error: ${error instanceof Error ? error.stack : String(error)}\n`,
    );
    return EXIT.io;
  }
}

async function dispatch(argv: readonly string[], io: CliIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args: [...argv], options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw new CliError((error as Error).message, EXIT.usage);
  }
  const { values, positionals } = parsed;
  const [command, ...args] = positionals;

  if (values.version) {
    io.stdout(`${VERSION}\n`);
    return EXIT.ok;
  }
  if (values.help || command === undefined) {
    (command === undefined && !values.help ? io.stderr : io.stdout)(USAGE);
    return command === undefined && !values.help ? EXIT.usage : EXIT.ok;
  }
  if (values.quiet && values.verbose) {
    throw new CliError('--quiet and --verbose cannot be combined.', EXIT.usage);
  }
  const allowed = COMMAND_OPTIONS[command];
  if (allowed === undefined) throw new CliError(`Unknown command "${command}".`, EXIT.usage);
  const misplaced = (Object.keys(OPTIONS) as OptionName[]).find(
    (name) =>
      !GLOBAL.includes(name) &&
      !allowed.includes(name) &&
      values[name] !== undefined &&
      values[name] !== false,
  );
  if (misplaced !== undefined) {
    throw new CliError(`--${misplaced} does not apply to "${command}".`, EXIT.usage);
  }

  const global = { json: values.json, quiet: values.quiet, verbose: values.verbose };
  const expectArgs = (count: number, usage: string) => {
    if (args.length !== count) throw new CliError(`Usage: flowforge ${usage}`, EXIT.usage);
  };

  switch (command) {
    case 'validate':
      expectArgs(1, 'validate <file>');
      return validate(io, args[0]!, global);
    case 'inspect':
      expectArgs(1, 'inspect <file>');
      return inspect(io, args[0]!, global);
    case 'transform':
      expectArgs(1, 'transform <file> [--tidy] [--template <t>] [options]');
      return transform(io, args[0]!, {
        ...global,
        tidy: values.tidy,
        template: values.template,
        case: values.case,
        prefix: values.prefix,
        suffix: values.suffix,
        env: values.env,
        region: values.region,
        group: values.group,
        format: values.format ?? 'mermaid',
        output: values.output,
        force: values.force,
      });
    case 'diff':
      expectArgs(2, 'diff <a> <b>');
      return diff(io, args[0]!, args[1]!, global);
    case 'render':
      expectArgs(1, 'render <file> [--theme <t>] [-o <file.svg>]');
      return render(io, args[0]!, {
        ...global,
        format: values.format ?? 'svg',
        theme: values.theme,
        output: values.output,
        force: values.force,
      });
    default:
      throw new CliError(`Unknown command "${command}".`, EXIT.usage);
  }
}
