import { parseArgs, type ParseArgsConfig } from 'node:util';
import { diff } from './commands/diff.js';
import { inspect } from './commands/inspect.js';
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

Exit codes: 0 success · 1 invalid input or differences found · 2 usage error · 3 file error
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
  format: { type: 'string', default: 'mermaid' },
  output: { type: 'string', short: 'o' },
  force: { type: 'boolean', default: false },
} satisfies ParseArgsConfig['options'];

const TRANSFORM_ONLY = [
  'tidy',
  'template',
  'case',
  'prefix',
  'suffix',
  'env',
  'region',
  'group',
  'output',
  'force',
] as const;

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
  if (command !== 'transform') {
    const misplaced = TRANSFORM_ONLY.filter(
      (name) => values[name] !== undefined && values[name] !== false,
    );
    if (misplaced.length > 0) {
      throw new CliError(`--${misplaced[0]} only applies to "transform".`, EXIT.usage);
    }
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
        format: values.format,
        output: values.output,
        force: values.force,
      });
    case 'diff':
      expectArgs(2, 'diff <a> <b>');
      return diff(io, args[0]!, args[1]!, global);
    default:
      throw new CliError(`Unknown command "${command}".`, EXIT.usage);
  }
}
