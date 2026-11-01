'use client';

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { useEditor } from '../store';

/** Fired by the problems list; the editor moves its cursor to the line and takes focus. */
export const GOTO_LINE_EVENT = 'flowforge:goto-line';

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'transparent', color: 'var(--text)' },
  // Ligatures would turn --> into an arrow glyph and hide the real Mermaid syntax.
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    fontVariantLigatures: 'none',
    caretColor: 'var(--accent)',
  },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)',
  },
  '&.cm-focused': { outline: 'none' },
});

export function SourceEditor() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  const source = useEditor((s) => s.source);
  const setSource = useEditor((s) => s.setSource);

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: useEditor.getState().source,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          theme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Mermaid source' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) setSource(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;

    const gotoLine = (event: Event) => {
      const line = (event as CustomEvent<number>).detail;
      const doc = editor.state.doc;
      const target = doc.line(Math.min(Math.max(line, 1), doc.lines));
      editor.dispatch({ selection: { anchor: target.from }, scrollIntoView: true });
      editor.focus();
    };
    window.addEventListener(GOTO_LINE_EVENT, gotoLine);
    return () => {
      window.removeEventListener(GOTO_LINE_EVENT, gotoLine);
      editor.destroy();
    };
  }, [setSource]);

  // External changes (loading an example) replace the document; the editor's own typing does not
  // loop back because the text is then already equal.
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== source) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: source } });
    }
  }, [source]);

  return <div ref={host} className="h-full overflow-auto" />;
}
