'use client';

import { useEffect, useRef } from 'react';
import { BottomPanel } from '../src/components/BottomPanel';
import { Canvas } from '../src/components/Canvas';
import { Inspector } from '../src/components/Inspector';
import { Outline } from '../src/components/Outline';
import { Toolbar } from '../src/components/Toolbar';
import { Pipeline } from '../src/pipeline/pipeline';
import { useEditor } from '../src/store';

/** Waits this long after the last keystroke before re-parsing. */
const DEBOUNCE_MS = 250;

export default function EditorPage() {
  const source = useEditor((s) => s.source);
  const theme = useEditor((s) => s.theme);
  const pipeline = useRef<Pipeline | undefined>(undefined);

  // Match the app's colour scheme on first load. Done after hydration, because the page is
  // pre-rendered without a window and must hydrate with the same markup.
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      useEditor.getState().setTheme('enterprise-light');
    }
  }, []);

  useEffect(() => {
    pipeline.current = new Pipeline();
    return () => pipeline.current?.dispose();
  }, []);

  useEffect(() => {
    const { setBusy, setResult } = useEditor.getState();
    setBusy(true);
    const timer = setTimeout(async () => {
      const result = await pipeline.current?.run(source, theme);
      if (result) setResult(result);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [source, theme]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Outline />
        <Canvas />
        <Inspector />
      </div>
      <BottomPanel />
    </div>
  );
}
