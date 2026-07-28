"use client";

import { X } from "@/lib/icons";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { useEffect, useMemo, useState } from "react";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { CompanyLogo } from "@/components/screener/company-logo";
import { cn } from "@/lib/utils";
import type { CompanyPick } from "@/components/charting/company-picker";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { isCryptoOverviewSymbol } from "@/lib/crypto/crypto-picker-universe";
import { STOCK_OVERVIEW_COMPARE_LINE_COLORS } from "@/components/stock/stock-compare-return-chart";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";

function formatPerformancePct(value: number): string {
  const isPositive = value >= 0;
  const sign = isPositive ? "+" : "−";
  const body = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${body}%`;
}

type PerfField = keyof Pick<StockPerformance, "d1" | "d5" | "m1" | "m6" | "ytd" | "y1" | "y5" | "all">;

const MINI_TABLE_PERF_COLUMNS: readonly {
  header: string;
  field: PerfField;
  showOnMobile: boolean;
}[] = [
  { header: "1D", field: "d1", showOnMobile: false },
  { header: "5D", field: "d5", showOnMobile: true },
  { header: "1M", field: "m1", showOnMobile: true },
  { header: "6M", field: "m6", showOnMobile: true },
  { header: "YTD", field: "ytd", showOnMobile: true },
  { header: "1Y", field: "y1", showOnMobile: false },
  { header: "5Y", field: "y5", showOnMobile: true },
  { header: "ALL", field: "all", showOnMobile: false },
];

/** Company + 8 period columns — 8px desktop inset from {@link SCREENER_TABLE_ROW_HOVER_PAD_CLASS}. */
const MINI_GRID_WITH_COMPANY = cn(
  "grid w-full items-center gap-x-2",
  "max-md:min-w-[560px] max-md:grid-cols-[minmax(140px,1.4fr)_repeat(5,minmax(0,1fr))]",
  "md:min-w-[760px] md:grid-cols-[minmax(180px,1.8fr)_repeat(8,minmax(56px,0.75fr))] lg:min-w-0",
);

/** Period-only strip (no compare companies). */
const MINI_GRID_PERIODS_ONLY = cn(
  "grid w-full items-center gap-x-2",
  "grid-cols-5 md:grid-cols-8",
);

function perfVisibilityClass(showOnMobile: boolean) {
  return showOnMobile ? "min-w-0" : "hidden md:block";
}

function PerfValue({
  value,
  showOnMobile,
  hideCompanyColumn,
  isLast,
}: {
  value: number | null;
  showOnMobile: boolean;
  hideCompanyColumn: boolean;
  isLast: boolean;
}) {
  const base = cn(
    "w-full text-[14px] leading-5 tabular-nums",
    hideCompanyColumn ? "text-center" : "text-right",
    perfVisibilityClass(showOnMobile),
    isLast && TABLE_END_ALIGNED_PAD_CLASS,
  );

  if (value == null || !Number.isFinite(value)) {
    return <div className={cn(base, "text-[#5C5D5F]")}>—</div>;
  }
  const isPositive = value >= 0;
  return (
    <div className={cn(base, isPositive ? "text-[#16A34A]" : "text-[#DC2626]")}>
      {formatPerformancePct(value)}
    </div>
  );
}

function parseHeaderMetaPayload(json: {
  fullName?: unknown;
  logoUrl?: unknown;
}): Pick<StockDetailHeaderMeta, "fullName" | "logoUrl"> {
  return {
    fullName: typeof json.fullName === "string" ? json.fullName : null,
    logoUrl: typeof json.logoUrl === "string" ? json.logoUrl : null,
  };
}

function sanitizeCompareDisplayName(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function resolveCompareDisplayName(
  meta: Pick<StockDetailHeaderMeta, "fullName"> | null,
  nameHint: string,
  symbol: string,
): string {
  const fromMeta = sanitizeCompareDisplayName(meta?.fullName);
  if (fromMeta) return fromMeta;
  const fromHint = sanitizeCompareDisplayName(nameHint);
  if (fromHint) return fromHint;
  return symbol;
}

function CompanyCell({
  displayName,
  symbol,
  logoUrl,
  metaLoading,
  borderColor,
  onRemove,
}: {
  displayName: string;
  symbol: string;
  logoUrl: string;
  metaLoading: boolean;
  borderColor: string;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 items-center gap-x-3 pl-2 text-left",
        TABLE_START_ALIGNED_PAD_CLASS,
        onRemove ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]",
      )}
      style={{ borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: borderColor }}
    >
      {metaLoading ? (
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg border border-[#E4E4E7] bg-[#F4F4F5]" aria-hidden />
      ) : (
        <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={symbol} />
      )}
      <div className="min-w-0 overflow-hidden">
        <div className="truncate text-[14px] font-semibold leading-5 text-[#141414]" title={displayName}>
          {displayName}
        </div>
        <div className="truncate text-[12px] leading-4 text-[#5C5D5F]" title={symbol}>
          {isCryptoOverviewSymbol(symbol) ? eodhdCryptoSpotTickerDisplay(symbol) : symbol}
        </div>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5C5D5F] transition-colors hover:bg-[#F4F4F5] hover:text-[#141414]"
          aria-label={`Remove ${symbol} from comparison`}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

function OverviewCompareRow({
  pick,
  borderColor,
  onRemove,
  showDivider,
}: {
  pick: CompanyPick;
  borderColor: string;
  onRemove: () => void;
  showDivider: boolean;
}) {
  const compareSym = pick.symbol.trim().toUpperCase();
  const nameHint = pick.name?.trim() || compareSym;
  const [compareMeta, setCompareMeta] = useState<Pick<StockDetailHeaderMeta, "fullName" | "logoUrl"> | null>(null);
  const [compareMetaLoading, setCompareMetaLoading] = useState(false);
  const [comparePerf, setComparePerf] = useState<StockPerformance | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isCrypto = isCryptoOverviewSymbol(compareSym);
    setCompareMetaLoading(!isCrypto);
    void (async () => {
      try {
        const perfUrl = isCrypto
          ? `/api/crypto/${encodeURIComponent(compareSym)}/performance`
          : `/api/stocks/${encodeURIComponent(compareSym)}/performance`;
        const [hr, pr] = await Promise.all([
          isCrypto
            ? Promise.resolve(null)
            : fetch(`/api/stocks/${encodeURIComponent(compareSym)}/header-meta`),
          fetch(perfUrl),
        ]);
        const hj =
          hr && hr.ok ? ((await hr.json()) as Parameters<typeof parseHeaderMetaPayload>[0]) : {};
        const pj = pr.ok ? ((await pr.json()) as StockPerformance) : null;
        if (cancelled) return;
        if (isCrypto) {
          const base = cryptoRouteBase(compareSym);
          setCompareMeta({
            fullName: nameHint,
            logoUrl: getCryptoLogoUrl(base),
          });
        } else {
          setCompareMeta(parseHeaderMetaPayload(hj));
        }
        setComparePerf(pj);
      } catch {
        if (!cancelled) {
          setCompareMeta(null);
          setComparePerf(null);
        }
      } finally {
        if (!cancelled) setCompareMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compareSym, nameHint]);

  const compareDisplayName = resolveCompareDisplayName(compareMeta, nameHint, compareSym);
  const compareLogoUrl = compareMeta?.logoUrl?.trim() ? compareMeta.logoUrl : "";

  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(
            MINI_GRID_WITH_COMPANY,
            "min-h-[60px]",
            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
          )}
        >
          <CompanyCell
            displayName={compareDisplayName}
            symbol={compareSym}
            logoUrl={compareLogoUrl}
            metaLoading={compareMetaLoading}
            borderColor={borderColor}
            onRemove={onRemove}
          />
          {MINI_TABLE_PERF_COLUMNS.map((col, i) => (
            <PerfValue
              key={col.header}
              showOnMobile={col.showOnMobile}
              hideCompanyColumn={false}
              isLast={i === MINI_TABLE_PERF_COLUMNS.length - 1}
              value={comparePerf?.[col.field] ?? null}
            />
          ))}
        </div>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
}

function MiniTableHeader({ hasCompare }: { hasCompare: boolean }) {
  return (
    <div
      className={cn(
        SCREENER_TABLE_HEADER_STICKY_CLASS,
        SCREENER_TABLE_ROUNDED_HEADER_CLASS,
        SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
        "md:border-b-0",
      )}
    >
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(
            hasCompare ? MINI_GRID_WITH_COMPANY : MINI_GRID_PERIODS_ONLY,
            "min-h-[44px] text-[14px] font-medium leading-5 text-[#5C5D5F]",
          )}
        >
          {hasCompare ? (
            <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Company</div>
          ) : null}
          {MINI_TABLE_PERF_COLUMNS.map((col, i) => (
            <div
              key={col.header}
              className={cn(
                hasCompare ? "text-right" : "text-center",
                perfVisibilityClass(col.showOnMobile),
                i === MINI_TABLE_PERF_COLUMNS.length - 1 && TABLE_END_ALIGNED_PAD_CLASS,
              )}
            >
              {col.header}
            </div>
          ))}
        </div>
      </div>
      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
    </div>
  );
}

export function MiniTable({
  ticker,
  headerMeta,
  headerMetaLoading,
  initialPerformance,
  comparePicks = [],
  onRemoveCompare,
  cryptoPrimary,
}: {
  ticker: string;
  headerMeta?: StockDetailHeaderMeta | null;
  headerMetaLoading?: boolean;
  /** From server initial payload — avoids an extra round-trip on first paint. */
  initialPerformance?: StockPerformance | null;
  /** Overview compare: extra company rows (same order as chart). */
  comparePicks?: readonly CompanyPick[];
  onRemoveCompare?: (symbol: string) => void;
  /** Crypto overview: primary row uses crypto APIs and supplied display fields. */
  cryptoPrimary?: { displayName: string; logoUrl: string };
}) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const sym = cryptoPrimary ? ticker.trim().toUpperCase() : meta.ticker;
  const displayName = cryptoPrimary
    ? cryptoPrimary.displayName
    : headerMeta?.fullName?.trim()
      ? headerMeta.fullName
      : meta.name;
  const logoUrl = cryptoPrimary ? cryptoPrimary.logoUrl.trim() : headerMeta?.logoUrl?.trim() ? headerMeta.logoUrl : "";
  const primaryMetaLoading = cryptoPrimary ? false : (headerMetaLoading ?? false);
  const [loading, setLoading] = useState(() => !initialPerformance);
  const [perf, setPerf] = useState<StockPerformance | null>(() => initialPerformance ?? null);

  const hasCompare = comparePicks.length > 0;
  const hideCompanyColumn = !hasCompare;

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (initialPerformance) {
        setPerf(initialPerformance);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const perfPath = cryptoPrimary
          ? `/api/crypto/${encodeURIComponent(sym)}/performance`
          : `/api/stocks/${encodeURIComponent(sym)}/performance`;
        const res = await fetch(perfPath);
        if (!res.ok) {
          if (!mounted) return;
          setPerf(null);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as StockPerformance;
        if (!mounted) return;
        setPerf(json);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setPerf(null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [sym, initialPerformance, cryptoPrimary]);

  const row = useMemo(() => perf, [perf]);
  const totalRows = 1 + comparePicks.length;

  return (
    <ScreenerTableScroll mobileScroll={hasCompare}>
      <MiniTableHeader hasCompare={hasCompare} />
      <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
        <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
          <div
            className={cn(
              hasCompare ? MINI_GRID_WITH_COMPANY : MINI_GRID_PERIODS_ONLY,
              "min-h-[60px]",
              SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
              loading && "opacity-70",
            )}
          >
            {hasCompare ? (
              <CompanyCell
                displayName={displayName}
                symbol={sym}
                logoUrl={logoUrl}
                metaLoading={primaryMetaLoading}
                borderColor="#2563EB"
              />
            ) : null}
            {MINI_TABLE_PERF_COLUMNS.map((col, i) => (
              <PerfValue
                key={col.header}
                showOnMobile={col.showOnMobile}
                hideCompanyColumn={hideCompanyColumn}
                isLast={i === MINI_TABLE_PERF_COLUMNS.length - 1}
                value={row?.[col.field] ?? null}
              />
            ))}
          </div>
        </div>
        {totalRows > 1 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
      </div>
      {comparePicks.map((pick, i) => (
        <OverviewCompareRow
          key={pick.symbol.toUpperCase()}
          pick={pick}
          borderColor={STOCK_OVERVIEW_COMPARE_LINE_COLORS[i % STOCK_OVERVIEW_COMPARE_LINE_COLORS.length]!}
          onRemove={() => onRemoveCompare?.(pick.symbol)}
          showDivider={i < comparePicks.length - 1}
        />
      ))}
    </ScreenerTableScroll>
  );
}
