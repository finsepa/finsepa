"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type UIEvent,
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
  ...rest
}: ComponentPropsWithoutRef<"div">) {
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

  return (
    <div
      ref={ref}
      {...rest}
      onScroll={handleScroll}
      onWheel={revealScrollbar}
      onTouchMove={revealScrollbar}
      className={cn(
        dropdownMenuOverlayScrollbarClassName,
        scrollbarVisible && dropdownMenuOverlayScrollbarActiveClassName,
        fade && "scroll-fade-effect-y",
        className,
      )}
    >
      {children}
    </div>
  );
}
