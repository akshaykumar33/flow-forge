'use client';

import { Download, Redo2, Undo2, Workflow } from 'lucide-react';
import { serializeModel } from '@flowforge/core';
import { toMermaid } from '@flowforge/parser';
import { themes, type ThemeId } from '@flowforge/renderer';
import { downloadText } from '../download';
import { EXAMPLES } from '../examples';
import { useEditor } from '../store';

const selectClass =
  'h-8 rounded-md border border-line bg-panel px-2 text-sm text-ink hover:border-muted';
const buttonClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm hover:border-muted disabled:opacity-50';

export function Toolbar() {
  const { theme, setTheme, setSource, model, svg, busy, undo, redo, past, future } = useEditor();

  const exportMermaid = () => {
    if (!model) return;
    const result = toMermaid(model);
    if (result.ok) downloadText('diagram.mmd', result.source, 'text/plain');
  };

  return (
    <header className="flex h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line bg-panel px-3">
      <div className="flex items-center gap-2 border-r border-line pr-3">
        <Workflow aria-hidden className="size-[18px] text-accent" />
        <span className="font-semibold">FlowForge</span>
      </div>

      <label className="flex items-center gap-1.5 text-sm text-muted">
        Example
        <select
          className={selectClass}
          defaultValue=""
          onChange={(e) => {
            const example = EXAMPLES.find((x) => x.id === e.target.value);
            if (example) setSource(example.source);
          }}
        >
          <option value="" disabled>
            Load…
          </option>
          {EXAMPLES.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>

      <span aria-live="polite" className="text-xs text-muted">
        {busy ? 'Updating…' : ''}
      </span>

      <div className="flex-1" />

      <div className="flex gap-1" role="group" aria-label="History">
        <button
          type="button"
          className={buttonClass}
          disabled={past.length === 0}
          onClick={undo}
          aria-label="Undo"
          aria-keyshortcuts="Control+Z Meta+Z"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 aria-hidden className="size-3.5" />
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={future.length === 0}
          onClick={redo}
          aria-label="Redo"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 aria-hidden className="size-3.5" />
        </button>
      </div>

      <label className="flex items-center gap-1.5 text-sm text-muted">
        Theme
        <select
          className={selectClass}
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeId)}
        >
          {(Object.keys(themes) as ThemeId[]).map((id) => (
            <option key={id} value={id}>
              {themes[id].name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-1.5" role="group" aria-label="Export">
        <button
          type="button"
          className={buttonClass}
          disabled={!svg}
          onClick={() => svg && downloadText('diagram.svg', svg, 'image/svg+xml')}
        >
          <Download aria-hidden className="size-3.5" /> SVG
        </button>
        <button type="button" className={buttonClass} disabled={!model} onClick={exportMermaid}>
          <Download aria-hidden className="size-3.5" /> Mermaid
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!model}
          onClick={() =>
            model && downloadText('diagram.json', serializeModel(model), 'application/json')
          }
        >
          <Download aria-hidden className="size-3.5" /> JSON
        </button>
      </div>
    </header>
  );
}
