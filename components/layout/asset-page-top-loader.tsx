"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const Z_BAR = 95;

function routeKey(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ""}`;
}

/**
 * Thin top progress bar for in-page URL updates on asset routes (e.g. /stock/AAPL?tab=charting).
 * Complements NavigationTopLoader (which often starts on real &lt;a&gt; clicks, not router.replace).
 */
export function AssetPageTopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const key = routeKey(pathname, search);

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevKeyRef = useRef<string | null>(null);
  const firstRef = useRef(true);
  const doneTimerRef = useRef<number | null>(null);

  const isAssetPath =
    pathname.startsWith("/stock/") ||
    pathname.startsWith("/crypto/") ||
    pathname.startsWith("/index/") ||
    pathname.startsWith("/charting");

  useEffect(() => {
    if (!isAssetPath) {
      prevKeyRef.current = key;
      return;
    }
    if (firstRef.current) {
      firstRef.current = false;
      prevKeyRef.current = key;
      return;
    }
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;

    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }

    setVisible(true);
    setProgress(0.55);
    requestAnimationFrame(() => {
      setProgress(0.92);
      requestAnimationFrame(() => {
        setProgress(1);
        doneTimerRef.current = window.setTimeout(() => {
          setVisible(false);
          setProgress(0);
          doneTimerRef.current = null;
        }, 220);
      });
    });
  }, [key, isAssetPath]);

  if (!isAssetPath || (!visible && progress === 0)) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 right-0 left-0 overflow-hidden"
      style={{ zIndex: Z_BAR, height: 2, margin: 0, padding: 0 }}
      aria-hidden
    >
      <div
        className="h-full origin-left rounded-none bg-[#09090B]"
        style={{
          transform: `scaleX(${Math.min(1, Math.max(0, progress))})`,
          transition:
            progress >= 1
              ? "transform 160ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease"
              : "transform 120ms ease-out",
          opacity: 0.88,
        }}
      />
    </div>
  );
}
