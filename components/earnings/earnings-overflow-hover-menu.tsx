"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  dropdownMenuPanelClassName,
  dropdownMenuRichItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { Spinner } from "@/components/ui/spinner";
import type { EarningsCalendarItem, EarningsReportTiming } from "@/lib/market/earnings-calendar-types";
import { serializeAllowedScopeKeys } from "@/lib/market/earnings-scope-filter";
import { prefetchStockEarningsTabPayload } from "@/lib/market/stock-earnings-tab-client";
import { cn } from "@/lib/utils";

const HIDE_DELAY_MS = 140;

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

export function EarningsOverflowHoverMenu({
  count,
  preloadedItems,
  weekMondayYmd,
  dayYmd,
  timing,
  title,
  allowedScopeKeys,
  onOpenCard,
}: {
  count: number;
  /** When set, dropdown uses SSR overflow without fetching. */
  preloadedItems?: EarningsCalendarItem[];
  weekMondayYmd: string;
  dayYmd: string;
  timing: EarningsReportTiming;
  title: string;
  allowedScopeKeys: ReadonlySet<string> | null;
  onOpenCard: (item: EarningsCalendarItem) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EarningsCalendarItem[]>(preloadedItems ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (preloadedItems?.length) setItems(preloadedItems);
  }, [preloadedItems]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const fetchOverflow = useCallback(async () => {
    if (preloadedItems?.length) return;
    if (loadingRef.current || items.length > 0) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const qs = new URLSearchParams({
        week: weekMondayYmd,
        day: dayYmd,
        timing,
        offset: "0",
        limit: String(Math.min(50, count)),
      });
      if (allowedScopeKeys && allowedScopeKeys.size > 0) {
        qs.set("allowed", serializeAllowedScopeKeys(allowedScopeKeys));
      }
      const res = await fetch(`/api/earnings/week-bucket?${qs.toString()}`);
      if (!res.ok) throw new Error("overflow");
      const body: unknown = await res.json();
      const raw = body && typeof body === "object" && "items" in body ? (body as { items: unknown }).items : null;
      const next = Array.isArray(raw) ? (raw as EarningsCalendarItem[]) : [];
      setItems(next);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [allowedScopeKeys, count, dayYmd, items.length, preloadedItems, timing, weekMondayYmd]);

  const displayItems = preloadedItems?.length ? preloadedItems : items;

  const show = useCallback(() => {
    if (isCoarsePointer()) return;
    clearHideTimer();
    setOpen(true);
    void fetchOverflow();
  }, [clearHideTimer, fetchOverflow]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const toggleTouch = () => {
    if (!isCoarsePointer()) return;
    setOpen((v) => {
      const next = !v;
      if (next) void fetchOverflow();
      return next;
    });
  };

  useEffect(() => {
    if (!open || !isCoarsePointer()) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div
      ref={anchorRef}
      className="relative h-full w-full"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <button
        type="button"
        onClick={toggleTouch}
        className="flex h-full w-full items-center justify-center rounded-xl bg-[#EFF6FF] px-1 py-1.5 text-center transition-colors hover:bg-[#DBEAFE]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${count} more companies in ${title}`}
      >
        <span className="text-[13px] font-semibold tabular-nums leading-5 text-[#2563EB]">+{count}</span>
      </button>

      <TopbarDropdownPortal open={open} anchorRef={anchorRef} align="trailing">
        <div
          ref={menuRef}
          className="-mt-1 pt-1"
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          <div
            role="listbox"
            aria-label={`More companies in ${title}`}
            className={cn(
              dropdownMenuPanelClassName(),
              "min-w-[148px] max-w-[min(200px,calc(100vw-1.5rem))]",
            )}
          >
            <DropdownScrollArea className="max-h-[min(280px,50vh)] overflow-y-auto">
              {loading && displayItems.length === 0 ? (
                <div
                  className="flex items-center justify-center px-3 py-6"
                  role="status"
                  aria-live="polite"
                  aria-label="Loading companies"
                >
                  <Spinner className="size-5 text-[#71717A]" />
                </div>
              ) : error && displayItems.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-[#DC2626]">Could not load</p>
              ) : displayItems.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-[#71717A]">No companies</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {displayItems.map((item) => (
                    <li key={`${item.ticker}-${item.reportDate}`}>
                      <button
                        type="button"
                        role="option"
                        className={cn(dropdownMenuRichItemClassName(), "items-center gap-2")}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onOpenCard(item);
                          setOpen(false);
                        }}
                        onPointerEnter={() => prefetchStockEarningsTabPayload(item.ticker, true)}
                        onFocus={() => prefetchStockEarningsTabPayload(item.ticker, true)}
                      >
                        <CompanyLogo
                          name={item.companyName || item.ticker}
                          logoUrl={item.logoUrl}
                          symbol={item.ticker}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tabular-nums leading-5 text-[#09090B]">
                          {item.ticker}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </DropdownScrollArea>
          </div>
        </div>
      </TopbarDropdownPortal>
    </div>
  );
}
