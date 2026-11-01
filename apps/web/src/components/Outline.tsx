'use client';

import type { GraphModel } from '@flowforge/core';
import { useEditor } from '../store';

interface Row {
  id: string;
  label: string;
  depth: number;
  kind: 'group' | 'node';
}

/** Groups, then their members, nested by depth; ungrouped nodes last. */
function rows(model: GraphModel): Row[] {
  const out: Row[] = [];
  const walk = (parent: string | undefined, depth: number) => {
    for (const g of model.groups.filter((g) => g.parentId === parent)) {
      out.push({ id: g.id, label: g.label, depth, kind: 'group' });
      walk(g.id, depth + 1);
    }
    for (const n of model.nodes.filter((n) => n.groupId === parent)) {
      out.push({ id: n.id, label: n.label, depth, kind: 'node' });
    }
  };
  walk(undefined, 0);
  return out;
}

/** Keyboard-accessible way to select nodes, mirroring clicks on the canvas. */
export function Outline() {
  const { model, selectedId, select } = useEditor();
  return (
    <nav
      aria-label="Diagram outline"
      className="w-56 shrink-0 overflow-auto border-r border-line bg-panel p-3"
    >
      <h2 className="px-1.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Outline
      </h2>
      {model ? (
        <ul className="flex flex-col gap-0.5">
          {rows(model).map((row) => (
            <li key={`${row.kind}:${row.id}`}>
              {row.kind === 'group' ? (
                <span
                  className="block truncate py-1 text-xs font-semibold text-muted"
                  style={{ paddingLeft: 6 + row.depth * 14 }}
                >
                  {row.label}
                </span>
              ) : (
                <button
                  type="button"
                  aria-pressed={row.id === selectedId}
                  onClick={() => select(row.id)}
                  className={`block w-full truncate rounded px-1.5 py-1 text-left text-sm ${
                    row.id === selectedId ? 'bg-accent/15 text-accent' : 'hover:bg-line/50'
                  }`}
                  style={{ paddingLeft: 6 + row.depth * 14 }}
                >
                  {row.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1.5 text-sm text-muted">Nothing to show until the source parses.</p>
      )}
    </nav>
  );
}
