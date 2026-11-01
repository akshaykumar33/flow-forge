import type { Diagnostic, GraphModel } from '@flowforge/core';
import { checkReadability, layoutModel, type ELK } from '@flowforge/layout';
import { parse } from '@flowforge/parser';
import { recognizeServicesTransform } from '@flowforge/providers';
import { renderSvg, type ThemeId } from '@flowforge/renderer';
import { runTransform } from '@flowforge/transforms';

export interface PipelineResult {
  model?: GraphModel;
  svg?: string;
  size?: { width: number; height: number };
  diagnostics: Diagnostic[];
}

/**
 * Source → model → layout → SVG. Mermaid needs the DOM, so parsing runs on the page; ELK's layout
 * engine, the slow step, runs in its own real Web Worker (ADR-0008). Each run gets a sequence
 * number, and results older than the newest request are discarded so fast typing never shows a
 * stale diagram. Every failure becomes a diagnostic; the editor never waits silently.
 */
export class Pipeline {
  private elk: Promise<ELK> | undefined;
  private seq = 0;

  private loadElk(): Promise<ELK> {
    this.elk ??= import('elkjs/lib/elk-api.js').then((mod) => {
      const m = mod as unknown as { default?: unknown };
      const ElkApi = (typeof m.default === 'function'
        ? m.default
        : mod) as unknown as new (options: { workerUrl: string }) => ELK;
      // Copied to public/ at build time with its licence notice (scripts/copy-elk-worker.mjs).
      return new ElkApi({
        workerUrl: new URL('vendor/elk/elk-worker.min.js', document.baseURI).href,
      });
    });
    return this.elk;
  }

  /** Resolves with `undefined` when a newer run has started meanwhile. */
  async run(source: string, theme: ThemeId): Promise<PipelineResult | undefined> {
    const seq = ++this.seq;
    try {
      const parsed = await parse(source);
      if (seq !== this.seq) return undefined;
      if (!parsed.ok) return { diagnostics: parsed.diagnostics };
      // Certain service recognitions feed the inspector; uncertain ones are suggestions.
      const recognised = runTransform(recognizeServicesTransform, parsed.model, {});
      const model = recognised.ok ? recognised.model : parsed.model;
      return await this.layout(seq, model, theme, parsed.diagnostics);
    } catch (error) {
      if (seq !== this.seq) return undefined;
      return { diagnostics: [failure('pipeline-failed', error)] };
    }
  }

  private async layout(
    seq: number,
    model: GraphModel,
    theme: ThemeId,
    earlier: Diagnostic[],
  ): Promise<PipelineResult | undefined> {
    try {
      const { layout, diagnostics } = await layoutModel(model, { elk: await this.loadElk() });
      if (seq !== this.seq) return undefined;
      return {
        model,
        svg: renderSvg(model, layout, { theme, title: 'Diagram preview' }),
        size: { width: layout.width, height: layout.height },
        diagnostics: [...earlier, ...diagnostics, ...checkReadability(model, layout)],
      };
    } catch (error) {
      if (seq !== this.seq) return undefined;
      return { model, diagnostics: [...earlier, failure('layout-failed', error)] };
    }
  }

  dispose(): void {
    // Invalidate in-flight runs; ELK's worker is released with the page.
    this.seq++;
  }
}

function failure(code: string, error: unknown): Diagnostic {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    severity: 'error',
    code,
    message: `${code === 'layout-failed' ? 'Layout' : 'Processing'} failed: ${reason}`,
  };
}
