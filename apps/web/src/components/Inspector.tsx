'use client';

import { serviceById } from '@flowforge/providers';
import { useEditor } from '../store';

const heading = 'text-[11px] font-semibold uppercase tracking-wider text-muted';

export function Inspector() {
  const { model, selectedId, suggestions, accept, ignore } = useEditor();
  const nodeSuggestions = suggestions.filter((s) => s.elementId === selectedId);
  const node = model?.nodes.find((n) => n.id === selectedId);
  const group = node?.groupId ? model?.groups.find((g) => g.id === node.groupId) : undefined;
  const incoming = model?.edges.filter((e) => e.target === selectedId).length ?? 0;
  const outgoing = model?.edges.filter((e) => e.source === selectedId).length ?? 0;

  return (
    <aside
      aria-label="Inspector"
      className="w-72 shrink-0 overflow-auto border-l border-line bg-panel p-4"
    >
      <h2 className={heading}>Node</h2>
      {node ? (
        <div className="mt-2 flex flex-col gap-4">
          <p className="font-mono text-[15px]">{node.id}</p>
          <dl className="grid grid-cols-[72px_1fr] gap-x-2.5 gap-y-2 text-sm">
            <dt className="text-muted">Label</dt>
            <dd className="break-words">{node.label}</dd>
            <dt className="text-muted">Shape</dt>
            <dd>{node.shape}</dd>
            <dt className="text-muted">Group</dt>
            <dd>{group?.label ?? '—'}</dd>
            <dt className="text-muted">Edges</dt>
            <dd>
              {incoming} in · {outgoing} out
            </dd>
          </dl>
          {nodeSuggestions.length > 0 && (
            <section aria-label="Suggestions">
              <h3 className={heading}>Suggestions</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {nodeSuggestions.map((s) => {
                  const name = serviceById(s.inference.value)?.name ?? s.inference.value;
                  return (
                    <li
                      key={s.inference.value}
                      className="flex flex-col gap-2 rounded-md border border-line p-3 text-sm"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{name}</span>
                        <span className="font-mono text-xs text-ok">
                          {Math.round(s.inference.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted">{s.inference.reason}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => accept(s)}
                          aria-label={`Apply ${name}`}
                          className="h-8 flex-1 rounded-md bg-accent font-semibold text-accent-ink"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => ignore(s)}
                          aria-label={`Ignore ${name}`}
                          className="h-8 flex-1 rounded-md border border-line hover:border-muted"
                        >
                          Ignore
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section>
            <h3 className={heading}>What FlowForge knows</h3>
            {node.inferences.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No inferred metadata.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {node.inferences.map((i) => (
                  <li key={i.key} className="rounded-md border border-line p-2.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{i.key}</span>
                      <span className="font-mono text-xs text-ok">
                        {Math.round(i.confidence * 100)}%
                      </span>
                    </div>
                    <div className="font-mono text-xs">{i.value}</div>
                    <div className="mt-1 text-xs text-muted">
                      {i.provenance === 'user' ? 'your choice' : i.provenance} · {i.reason}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">Select a node on the canvas or in the outline.</p>
      )}
    </aside>
  );
}
