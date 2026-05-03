"use client";

import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Landmark,
  LineChart,
  Percent,
  PieChart,
  Receipt,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  dropdownMenuSurfaceClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  topbarSquircleIconClass,
  topbarSquircleTextButtonClass,
} from "@/components/design-system/topbar-control-classes";
import { cn } from "@/lib/utils";
import type { ScreenerKeyStatCategoryDef } from "@/lib/screener/screener-key-stats-metric-catalog";
import {
  isScreenerBuiltinTableMetricId,
  SCREENER_KEY_STAT_CATEGORIES,
} from "@/lib/screener/screener-key-stats-metric-catalog";

function categoryIcon(categoryId: string) {
  const className = "size-4 shrink-0 text-[#71717A]";
  switch (categoryId) {
    case "basic":
      return <Building2 className={className} aria-hidden />;
    case "valuation":
      return <LineChart className={className} aria-hidden />;
    case "revenue-profit":
      return <Receipt className={className} aria-hidden />;
    case "margins":
      return <PieChart className={className} aria-hidden />;
    case "growth":
      return <TrendingUp className={className} aria-hidden />;
    case "assets":
      return <Landmark className={className} aria-hidden />;
    case "returns":
      return <Percent className={className} aria-hidden />;
    case "dividends":
      return <Coins className={className} aria-hidden />;
    case "risk":
      return <AlertTriangle className={className} aria-hidden />;
    default:
      return <div className="size-4 shrink-0" aria-hidden />;
  }
}

function filterCategories(query: string): ScreenerKeyStatCategoryDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return SCREENER_KEY_STAT_CATEGORIES;
  return SCREENER_KEY_STAT_CATEGORIES.map((cat) => ({
    ...cat,
    metrics: cat.metrics.filter(
      (m) => m.label.toLowerCase().includes(q) || cat.title.toLowerCase().includes(q),
    ),
  })).filter((cat) => cat.metrics.length > 0);
}

export function ScreenerCompaniesKeyStatToolbar({
  selectedMetricId,
  onSelectMetricId,
  onReset,
  disabled,
}: {
  selectedMetricId: string | null;
  onSelectMetricId: (metricId: string) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(SCREENER_KEY_STAT_CATEGORIES[0]!.id);
  const [mobileDrill, setMobileDrill] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterCategories(search), [search]);

  useEffect(() => {
    if (!filtered.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(filtered[0]?.id ?? SCREENER_KEY_STAT_CATEGORIES[0]!.id);
    }
  }, [filtered, activeCategoryId]);

  const activeCategory = useMemo(
    () => filtered.find((c) => c.id === activeCategoryId) ?? filtered[0] ?? null,
    [filtered, activeCategoryId],
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSearch("");
    setMobileDrill(false);
  }, []);

  const onPickMetric = useCallback(
    (id: string) => {
      if (isScreenerBuiltinTableMetricId(id)) {
        onReset();
        closeMenu();
        return;
      }
      onSelectMetricId(id);
      closeMenu();
    },
    [onSelectMetricId, onReset, closeMenu],
  );

  return (
    <div ref={rootRef} className="flex shrink-0 items-center gap-3 self-end sm:self-center">
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
            if (!open) {
              setSearch("");
              setActiveCategoryId(SCREENER_KEY_STAT_CATEGORIES[0]!.id);
              setMobileDrill(false);
            }
          }}
          className={cn(topbarSquircleTextButtonClass, disabled && "pointer-events-none opacity-50")}
        >
          <SlidersHorizontal className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
          Customize
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label="Customize columns"
            className="absolute right-0 top-[calc(100%+6px)] z-50 flex max-h-[min(70vh,520px)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 sm:max-w-none"
          >
            {/* Desktop: nested flyout (sub-menu on the left). Mobile: drill-in. */}
            <div
              className={cn(
                dropdownMenuSurfaceClassName("overflow-hidden p-0"),
                "flex w-[min(100vw-1.5rem,520px)] flex-col-reverse sm:w-auto sm:min-w-[480px] sm:flex-row-reverse sm:items-stretch",
              )}
            >
              {/* Category list */}
              <div
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col border-[#E4E4E7] sm:w-[min(50vw,240px)] sm:border-l",
                  mobileDrill ? "hidden sm:flex" : "flex",
                )}
              >
                <div className="border-b border-[#E4E4E7] px-2 py-2">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#71717A]"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search metrics…"
                      className="h-9 w-full rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] py-1.5 pl-9 pr-3 text-[13px] leading-5 text-[#09090B] placeholder:text-[#71717A] focus:border-[#09090B]/20 focus:outline-none focus:ring-2 focus:ring-[#09090B]/10"
                    />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto py-1">
                  {filtered.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCategoryId(cat.id);
                        if (
                          typeof window !== "undefined" &&
                          window.matchMedia("(max-width: 639px)").matches
                        ) {
                          setMobileDrill(true);
                        }
                      }}
                      className={dropdownMenuPlainItemRowClassName({ selected: cat.id === activeCategoryId })}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        {categoryIcon(cat.id)}
                        <span className="truncate">{cat.title}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-[#71717A]" aria-hidden />
                    </button>
                  ))}
                  {!filtered.length ? (
                    <div className="px-4 py-6 text-center text-[13px] text-[#71717A]">No metrics match.</div>
                  ) : null}
                </div>
              </div>

              {/* Metrics sub-panel */}
              <div
                className={cn(
                  "flex min-h-[200px] min-w-0 flex-col border-[#E4E4E7] sm:w-[min(50vw,260px)] sm:border-l",
                  mobileDrill ? "flex" : "hidden sm:flex",
                )}
              >
                <div className="flex items-center gap-1 border-b border-[#E4E4E7] px-2 py-2 sm:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileDrill(false)}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-[#09090B] hover:bg-[#F4F4F5]"
                    aria-label="Back to categories"
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#09090B]">
                    {activeCategory?.title ?? ""}
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                  {activeCategory?.metrics.map((m) => {
                    const checked =
                      selectedMetricId === m.id ||
                      (isScreenerBuiltinTableMetricId(m.id) && selectedMetricId == null);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => onPickMetric(m.id)}
                        className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] leading-5 text-[#09090B] transition-colors hover:bg-[#F4F4F5] last:mb-0"
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded border",
                            checked
                              ? "border-[#2563EB] bg-[#2563EB] text-white"
                              : "border-[#D4D4D8] bg-white",
                          )}
                          aria-hidden
                        >
                          {checked ? (
                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
                              <path
                                d="M1 5l3.5 3.5L11 1"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled || !selectedMetricId}
        onClick={onReset}
        title="Reset table columns"
        aria-label="Reset table columns to default"
        className={cn(
          topbarSquircleIconClass,
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        <RotateCcw className="h-5 w-5 shrink-0" aria-hidden />
      </button>
    </div>
  );
}
