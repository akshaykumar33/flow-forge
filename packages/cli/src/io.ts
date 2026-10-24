import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deserializeModel, type Diagnostic, type GraphModel } from '@flowforge/core';
import { parse } from '@flowforge/parser';

export const EXIT = {
  ok: 0,
  /** Invalid diagram, or differences found by `diff`. */
  failed: 1,
  usage: 2,
  io: 3,
} as const;

/** Everything a command touches outside its own logic, so tests can run commands in memory. */
export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  readStdin(): Promise<string>;
  cwd: string;
}

/** Inputs larger than this are refused before reading, so a stray huge file cannot hang the CLI. */
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}

export function nodeIo(): CliIo {
  return {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    async readText(path) {
      const info = await stat(path);
      if (!info.isFile()) throw new CliError(`${path} is not a file.`, EXIT.io);
      if (info.size > MAX_INPUT_BYTES) {
        throw new CliError(
          `${path} is ${info.size} bytes; the limit is ${MAX_INPUT_BYTES}.`,
          EXIT.io,
        );
      }
      return readFile(path, 'utf8');
    },
    writeText: (path, text) => writeFile(path, text, 'utf8'),
    async readStdin() {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of process.stdin) {
        size += (chunk as Buffer).length;
        if (size > MAX_INPUT_BYTES) {
          throw new CliError(`stdin exceeds the ${MAX_INPUT_BYTES}-byte limit.`, EXIT.io);
        }
        chunks.push(chunk as Buffer);
      }
      return Buffer.concat(chunks).toString('utf8');
    },
    cwd: process.cwd(),
  };
}

export interface LoadedDiagram {
  /** Display name for messages: the path as given, or `<stdin>`. */
  name: string;
  model?: GraphModel;
  diagnostics: Diagnostic[];
}

/**
 * Reads a `.json` model or Mermaid source (any other extension, or `-` for stdin). Never throws
 * for bad content; content problems come back as diagnostics.
 */
export async function loadDiagram(io: CliIo, path: string): Promise<LoadedDiagram> {
  const name = path === '-' ? '<stdin>' : path;
  let text: string;
  try {
    text = path === '-' ? await io.readStdin() : await io.readText(resolve(io.cwd, path));
  } catch (error) {
    if (error instanceof CliError) throw error;
    const reason =
      (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'file not found' : String(error);
    throw new CliError(`Cannot read ${name}: ${reason}.`, EXIT.io);
  }

  const result = path.toLowerCase().endsWith('.json') ? deserializeModel(text) : await parse(text);
  return result.ok
    ? { name, model: result.model, diagnostics: result.diagnostics }
    : { name, diagnostics: result.diagnostics };
}
