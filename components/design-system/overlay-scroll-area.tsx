"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const SCROLLBAR_IDLE_MS = 900;
const THUMB_MIN_PX = 24;
const THUMB_WIDTH_PX = 4;
const THUMB_INSET_PX = 2;

/**
 * Vertical scroll area whose native scrollbar is hidden (content keeps full width); a thin thumb
 * is drawn over the content only while the user scrolls inside it.
 */
export function OverlayScrollArea({
  className,
  viewportClassName,
  children,
}: {
  className?: string;
  viewportClassName?: string;
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const [visible, setVisible] = useState(false);

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb(null);
      return;
    }
    const track = clientHeight - THUMB_INSET_PX * 2;
    const height = Math.max(THUMB_MIN_PX, (clientHeight / scrollHeight) * track);
    const top = THUMB_INSET_PX + (scrollTop / (scrollHeight - clientHeight)) * (track - height);
    setThumb((prev) => (prev && prev.top === top && prev.height === height ? prev : { top, height }));
  }, []);

  const reveal = useCallback(() => {
    setVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setVisible(false), SCROLLBAR_IDLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => ro.disconnect();
  }, [children, measure]);

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div
        ref={viewportRef}
        onScroll={() => {
          measure();
          reveal();
        }}
        className={cn(
          "min-h-0 overflow-y-auto overscroll-y-contain overscroll-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          viewportClassName,
        )}
      >
        {children}
      </div>
      {thumb ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            right: THUMB_INSET_PX,
            top: 0,
            width: THUMB_WIDTH_PX,
            height: thumb.height,
            transform: `translateY(${thumb.top}px)`,
            backgroundColor: "color-mix(in srgb, var(--fs-fg-subtle) 65%, transparent)",
            opacity: visible ? 1 : 0,
            transition: "opacity 150ms ease",
          }}
        />
      ) : null}
    </div>
  );
}
