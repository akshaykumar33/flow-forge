'use client';

import { Maximize, Minus, Plus } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { sanitizeSvg } from '../sanitize';
import { useEditor } from '../store';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/**
 * Shows the renderer's own SVG (ADR-0008), so what you see is what you export. The SVG is escaped
 * by construction and sanitised again before insertion; interaction is added around it.
 */
export function Canvas() {
  const { svg, size, selectedId, select } = useEditor();
  const safeSvg = useMemo(() => (svg ? sanitizeSvg(svg) : ''), [svg]);
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  // The node under the pointer is read at press time: pointer capture retargets later events.
  const drag = useRef<{ x: number; y: number; moved: boolean; nodeId?: string } | undefined>(
    undefined,
  );

  const fit = useCallback(() => {
    const box = viewport.current?.getBoundingClientRect();
    if (!box || !size || size.width === 0) return;
    const zoom = clampZoom(
      Math.min((box.width - 48) / size.width, (box.height - 48) / size.height, 1.5),
    );
    setView({
      zoom,
      x: (box.width - size.width * zoom) / 2,
      y: (box.height - size.height * zoom) / 2,
    });
  }, [size]);

  // Re-fit when the diagram's size changes, not on every edit that keeps the same layout size.
  useEffect(fit, [size?.width, size?.height, fit]);

  const zoomBy = (factor: number, cx?: number, cy?: number) => {
    const box = viewport.current?.getBoundingClientRect();
    if (!box) return;
    const px = cx ?? box.width / 2;
    const py = cy ?? box.height / 2;
    setView((v) => {
      const zoom = clampZoom(v.zoom * factor);
      const k = zoom / v.zoom;
      return { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const box = viewport.current!.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - box.left, e.clientY - box.top);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const nodeId = (e.target as Element).closest('[data-node-id]')?.getAttribute('data-node-id');
    drag.current = { x: e.clientX, y: e.clientY, moved: false, ...(nodeId && { nodeId }) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onPointerUp = () => {
    const press = drag.current;
    drag.current = undefined;
    // A click, not a pan: select the node that was pressed, or clear the selection.
    if (press && !press.moved) select(press.nodeId);
  };

  const selectedCss = selectedId
    ? `[data-node-id="${CSS.escape(selectedId)}"] > :is(rect, circle, polygon, path) { stroke: var(--accent); stroke-width: 3px; }`
    : '';

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <div
        ref={viewport}
        role="img"
        aria-label="Diagram canvas. Drag to pan, scroll to zoom, click a node to inspect it."
        className="canvas-grid h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <style>{selectedCss}</style>
        {svg ? (
          <div
            className="absolute left-0 top-0 origin-top-left [&_[data-node-id]]:cursor-pointer"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
            // Renderer output, escaped by construction and sanitised again (src/sanitize.ts).
            dangerouslySetInnerHTML={{ __html: safeSvg }}
          />
        ) : (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted">
            Your diagram appears here.
          </p>
        )}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center rounded-md border border-line bg-panel">
        <button
          type="button"
          aria-label="Zoom out"
          className="size-8 grid place-items-center"
          onClick={() => zoomBy(1 / 1.2)}
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <span className="min-w-12 text-center font-mono text-xs" aria-live="polite">
          {Math.round(view.zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          className="size-8 grid place-items-center"
          onClick={() => zoomBy(1.2)}
        >
          <Plus aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Fit diagram to view"
          className="size-8 grid place-items-center border-l border-line"
          onClick={fit}
        >
          <Maximize aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
