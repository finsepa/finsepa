"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type UIEvent,
  type WheelEvent,
} from "react";

import {
  dropdownMenuOverlayScrollbarActiveClassName,
  dropdownMenuOverlayScrollbarClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

const SCROLLBAR_IDLE_MS = 900;

/**
 * Scrollable dropdown list — overlay scrollbar (hidden until scroll) and edge fade when content overflows.
 */
export function DropdownScrollArea({
  className,
  children,
  onScroll,
  wheelIsolation = false,
  edgeFade = true,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { wheelIsolation?: boolean; edgeFade?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fade, setFade] = useState(false);
  const [scrollbarVisible, setScrollbarVisible] = useState(false);

  const revealScrollbar = useCallback(() => {
    setScrollbarVisible(true);
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = setTimeout(() => setScrollbarVisible(false), SCROLLBAR_IDLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setFade(el.scrollHeight > el.clientHeight + 1);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of el.children) {
      if (child instanceof Element) ro.observe(child);
    }
    return () => ro.disconnect();
  }, [children]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    revealScrollbar();
    onScroll?.(e);
  };

  const handleWheelCapture = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (!wheelIsolation) return;
      const el = e.currentTarget;
      if (el.scrollHeight <= el.clientHeight + 1) return;

      e.stopPropagation();

      const { scrollTop, scrollHeight, clientHeight } = el;
      const delta = e.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        e.preventDefault();
      }
    },
    [wheelIsolation],
  );

  return (
    <div
      ref={ref}
      {...rest}
      onScroll={handleScroll}
      onWheel={revealScrollbar}
      onWheelCapture={handleWheelCapture}
      onTouchMove={revealScrollbar}
      className={cn(
        dropdownMenuOverlayScrollbarClassName,
        scrollbarVisible && dropdownMenuOverlayScrollbarActiveClassName,
        fade && edgeFade && "scroll-fade-effect-y",
        className,
      )}
    >
      {children}
    </div>
  );
}
