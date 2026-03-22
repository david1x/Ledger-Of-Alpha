"use client";
import { useRef, useCallback, useState } from "react";

export interface WidgetDims { w: number; h: number }

interface UseGridResizeOptions {
  gridRef: React.RefObject<HTMLDivElement | null>;
  cols: number;          // total grid columns (6)
  gap: number;           // gap in px (12 = gap-3)
  onResize: (id: string, dims: WidgetDims) => void;
}

interface ResizeState {
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  colPx: number;   // computed pixel width of one column
  rowPx: number;   // computed pixel height of one row
}

export function useGridResize({ gridRef, cols, gap, onResize }: UseGridResizeOptions) {
  const [resizingId, setResizingId] = useState<string | null>(null);
  const stateRef = useRef<ResizeState | null>(null);
  const currentWRef = useRef<number>(0);
  const currentHRef = useRef<number>(0);

  const onResizeStart = useCallback((
    e: React.PointerEvent,
    id: string,
    currentW: number,
    currentH: number
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const grid = gridRef.current;
    if (!grid) return;

    const gridWidth = grid.clientWidth;
    const colPx = (gridWidth - (cols - 1) * gap) / cols;

    // Try to find the card element to compute rowPx
    const cardEl = (e.currentTarget as HTMLElement).closest("[data-widget-id]") as HTMLElement | null;
    const rowPx = cardEl ? cardEl.offsetHeight / currentH : 200;

    stateRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startW: currentW,
      startH: currentH,
      colPx,
      rowPx,
    };
    currentWRef.current = currentW;
    currentHRef.current = currentH;
    setResizingId(id);

    const onPointerMove = (ev: PointerEvent) => {
      const state = stateRef.current;
      if (!state) return;

      const deltaX = ev.clientX - state.startX;
      const deltaY = ev.clientY - state.startY;

      const newW = Math.max(1, Math.min(cols, state.startW + Math.round(deltaX / (state.colPx + gap))));
      const newH = Math.max(1, Math.min(4, state.startH + Math.round(deltaY / state.rowPx)));

      if (newW !== currentWRef.current || newH !== currentHRef.current) {
        currentWRef.current = newW;
        currentHRef.current = newH;
        onResize(state.id, { w: newW, h: newH });
      }
    };

    const onPointerUp = () => {
      stateRef.current = null;
      setResizingId(null);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }, [gridRef, cols, gap, onResize]);

  return { resizingId, onResizeStart };
}
