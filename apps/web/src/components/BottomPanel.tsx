'use client';

import { useEditor, type BottomTab } from '../store';
import { GOTO_LINE_EVENT, SourceEditor } from './SourceEditor';

const SEVERITY_CLASS = { error: 'text-error', warning: 'text-warn', info: 'text-muted' } as const;

export function BottomPanel() {
  const { bottomTab, setBottomTab, diagnostics } = useEditor();
  const problems = diagnostics.filter((d) => d.severity !== 'info');
  const tabs: [BottomTab, string][] = [
    ['source', 'Source'],
    ['problems', `Problems (${problems.length})`],
  ];

  return (
    <section
      aria-label="Source and problems"
      className="flex h-56 shrink-0 flex-col border-t border-line bg-panel"
    >
      <div
        role="tablist"
        aria-label="Bottom panel"
        className="flex gap-1 border-b border-line px-3"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={bottomTab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setBottomTab(id)}
            className={`h-9 border-b-2 px-2.5 text-sm ${
              bottomTab === id ? 'border-accent font-semibold' : 'border-transparent text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The editor stays mounted while hidden so its undo history survives tab switches. */}
      <div
        id="panel-source"
        role="tabpanel"
        aria-labelledby="tab-source"
        hidden={bottomTab !== 'source'}
        className="min-h-0 flex-1"
      >
        <SourceEditor />
      </div>

      <div
        id="panel-problems"
        role="tabpanel"
        aria-labelledby="tab-problems"
        hidden={bottomTab !== 'problems'}
        className="min-h-0 flex-1 overflow-auto p-2"
      >
        {problems.length === 0 ? (
          <p className="px-2 text-sm text-muted">No problems.</p>
        ) : (
          <ul className="flex flex-col">
            {problems.map((d, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={!d.range}
                  onClick={() => {
                    setBottomTab('source');
                    window.dispatchEvent(
                      new CustomEvent(GOTO_LINE_EVENT, { detail: d.range!.startLine }),
                    );
                  }}
                  className="flex w-full gap-3 rounded px-2 py-1 text-left font-mono text-xs hover:bg-line/50 disabled:hover:bg-transparent"
                >
                  <span className={SEVERITY_CLASS[d.severity]}>{d.severity}</span>
                  <span className="text-muted">{d.range ? `line ${d.range.startLine}` : '—'}</span>
                  <span className="whitespace-pre-wrap">{d.message.split('\n')[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
