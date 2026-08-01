"use client";

import Link from "next/link";

import { CompanyLogo } from "@/components/screener/company-logo";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
} from "@/components/screener/screener-table-scroll";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { toSupportedCryptoTicker } from "@/lib/market/crypto-meta";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { cn } from "@/lib/utils";
import { WATCHLIST_CRYPTO_PREFIX, WATCHLIST_INDEX_PREFIX } from "@/lib/watchlist/constants";

export type AgentTickerRef = {
  kind: "stock" | "crypto" | "index";
  symbol: string;
  href: string;
  logoUrl: string;
};

export type AgentHoldingRef = {
  ticker: AgentTickerRef;
  /** e.g. `8` or `0.116` (Shares column). */
  sharesLabel: string;
  /** e.g. `$2,450` or null when unknown. */
  worthLabel: string | null;
  /** e.g. `6.9%` or null. */
  weightLabel: string | null;
  /** e.g. `$3,682.68` unrealized P/L when the model includes it. */
  pnlLabel: string | null;
};

const STOCK_RE = /^[A-Z][A-Z0-9.-]{0,11}$/;
const CRYPTO_BASE_RE = /^[A-Z0-9]{1,12}$/;

/** Words that look ticker-like but should not become chips in prose. */
const STOPWORDS = new Set([
  "A",
  "I",
  "THE",
  "AND",
  "OR",
  "FOR",
  "YOUR",
  "WITH",
  "FROM",
  "THIS",
  "THAT",
  "HOLDINGS",
  "NOTABLE",
  "STOCKS",
  "TRANSACTIONS",
  "PORTFOLIO",
  "PORTFOLIOS",
  "WATCHLIST",
  "SUMMARY",
  "HERE",
  "USD",
]);

function stripMdInline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").trim();
}

function formatAgentUsd(n: number, maxFractionDigits?: number): string {
  const digits =
    maxFractionDigits != null ? maxFractionDigits : Math.abs(n) >= 100 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(n);
}

function parseAgentParenMeta(paren: string): { pnlLabel: string | null; weightLabel: string | null } {
  let pnlLabel: string | null = null;
  let weightLabel: string | null = null;

  const pnl = paren.match(
    /(?:unrealized\s+)?(?:profit|p\/?l|gain|loss)\s*:\s*\$?\s*([+-]?[\d,.]+)/i,
  );
  if (pnl?.[1]) {
    const n = Number(pnl[1].replace(/,/g, ""));
    if (Number.isFinite(n)) pnlLabel = formatAgentUsd(n, 2);
  }

  const weight = paren.match(/weight\s*:\s*([\d.]+)\s*%?/i);
  if (weight?.[1] && Number.isFinite(Number(weight[1]))) {
    weightLabel = `${Number(weight[1])}%`;
  }

  return { pnlLabel, weightLabel };
}

export function parseAgentTickerToken(raw: string): AgentTickerRef | null {
  let t = stripMdInline(raw.trim());
  if (!t) return null;
  t = t.replace(/^[-*•]\s+/, "").replace(/[,;.]+$/, "").trim();
  if (!t) return null;

  const upper = t.toUpperCase();

  if (upper === "USD") {
    return {
      kind: "stock",
      symbol: "USD",
      href: "/portfolio",
      logoUrl: "",
    };
  }

  if (upper.startsWith(WATCHLIST_CRYPTO_PREFIX)) {
    const sym = upper.slice(WATCHLIST_CRYPTO_PREFIX.length).replace(/-USD$/, "");
    const base = toSupportedCryptoTicker(sym) ?? (CRYPTO_BASE_RE.test(sym) ? sym : null);
    if (!base) return null;
    return {
      kind: "crypto",
      symbol: base,
      href: `/crypto/${encodeURIComponent(base)}`,
      logoUrl: getCryptoLogoUrl(base),
    };
  }

  if (upper.startsWith(WATCHLIST_INDEX_PREFIX)) {
    const sym = upper.slice(WATCHLIST_INDEX_PREFIX.length);
    return {
      kind: "index",
      symbol: sym,
      href: `/stock/${encodeURIComponent(sym)}`,
      logoUrl: logoDevStockLogoUrl(sym) ?? "",
    };
  }

  const cryptoBase = toSupportedCryptoTicker(upper);
  if (cryptoBase) {
    return {
      kind: "crypto",
      symbol: cryptoBase,
      href: `/crypto/${encodeURIComponent(cryptoBase)}`,
      logoUrl: getCryptoLogoUrl(cryptoBase),
    };
  }

  if (!STOCK_RE.test(upper) || STOPWORDS.has(upper)) return null;

  const display = upper.replace(/\./g, "-");
  return {
    kind: "stock",
    symbol: display,
    href: `/stock/${encodeURIComponent(display)}`,
    logoUrl: logoDevStockLogoUrl(display) ?? "",
  };
}

/**
 * `- AAPL: 8 shares` / `BTC: 0.116 shares · $11,800` / `… · 6.9%`
 * Also: `GOOGL: 25 shares · $8,164.00 (unrealized profit: $3,682.68, weight: 5.26%)`
 */
export function parseAgentHoldingLine(raw: string): AgentHoldingRef | null {
  let body = raw.trim().replace(/^[-*•]\s+/, "").trim();
  if (!body) return null;

  let parenMeta: { pnlLabel: string | null; weightLabel: string | null } = {
    pnlLabel: null,
    weightLabel: null,
  };
  const parenMatch = body.match(/\(([^)]*)\)\s*$/);
  if (parenMatch) {
    parenMeta = parseAgentParenMeta(parenMatch[1] ?? "");
    body = body.slice(0, parenMatch.index).trim();
  }

  const m = body.match(
    /^(.+?)\s*[:：]\s*([\d,.]+)\s*(shares?|units?)?(?:\s*[·|,—–-]\s*(?:Worth:\s*)?\$\s*([\d,.]+))?(?:\s*[·|,—–-]\s*([\d.]+)\s*%)?\s*$/i,
  );
  if (!m) return null;

  const ticker = parseAgentTickerToken(m[1] ?? "");
  if (!ticker) return null;

  const qty = (m[2] ?? "").replace(/,/g, "");
  if (!qty) return null;

  const worthRaw = m[4]?.replace(/,/g, "");
  let worthLabel: string | null = null;
  if (worthRaw && Number.isFinite(Number(worthRaw))) {
    worthLabel = formatAgentUsd(Number(worthRaw));
  }

  const weightRaw = m[5];
  const weightLabel =
    weightRaw && Number.isFinite(Number(weightRaw))
      ? `${Number(weightRaw)}%`
      : parenMeta.weightLabel;

  return {
    ticker,
    sharesLabel: qty,
    worthLabel,
    weightLabel,
    pnlLabel: parenMeta.pnlLabel,
  };
}

/** `- AAPL: 6.9%` or `- AAPL: 6.9% · $10,653` */
export function parseAgentAllocationLine(raw: string): {
  ticker: AgentTickerRef;
  weightLabel: string;
  worthLabel: string | null;
} | null {
  let body = raw.trim().replace(/^[-*•]\s+/, "").trim();
  if (!body) return null;

  const m = body.match(
    /^(.+?)\s*[:：]\s*([\d.]+)\s*%(?:\s*[·|,—–-]\s*\$\s*([\d,.]+))?\s*$/i,
  );
  if (!m) return null;

  const ticker = parseAgentTickerToken(m[1] ?? "");
  if (!ticker) return null;
  const weight = Number(m[2]);
  if (!Number.isFinite(weight)) return null;

  const worthRaw = m[3]?.replace(/,/g, "");
  let worthLabel: string | null = null;
  if (worthRaw && Number.isFinite(Number(worthRaw))) {
    worthLabel = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: Number(worthRaw) >= 100 ? 0 : 2,
    }).format(Number(worthRaw));
  }

  return { ticker, weightLabel: `${weight}%`, worthLabel };
}

export function AgentTickerChip({
  ticker,
  className,
}: {
  ticker: AgentTickerRef;
  className?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={ticker.href}
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1.5 rounded-[10px] border border-stroke-muted bg-surface px-2",
        "text-[13px] font-semibold leading-none text-fg no-underline shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]",
        "transition-colors hover:bg-surface-muted",
        className,
      )}
    >
      <CompanyLogo
        name={ticker.symbol}
        symbol={ticker.symbol}
        logoUrl={ticker.logoUrl}
        size="xs"
      />
      <span className="truncate">{ticker.symbol}</span>
    </Link>
  );
}

export function AgentTickerChipRow({ tickers }: { tickers: AgentTickerRef[] }) {
  if (tickers.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tickers.map((t) => (
        <AgentTickerChip key={`${t.kind}:${t.symbol}`} ticker={t} />
      ))}
    </div>
  );
}

const HOLDINGS_GRID =
  "grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,0.65fr)] items-center gap-2";
const HOLDINGS_GRID_NO_PNL =
  "grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] items-center gap-2";
const HOLDINGS_GRID_NO_WEIGHT =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-3";
const HOLDINGS_GRID_PNL_NO_WEIGHT =
  "grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] items-center gap-2";
/** 12px horizontal + vertical cell padding. */
const HOLDINGS_CELL_PAD_CLASS = "px-3 py-3";

function pnlToneClass(pnlLabel: string | null): string {
  if (!pnlLabel) return "text-fg-muted";
  const n = Number(pnlLabel.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n === 0) return "text-fg";
  return n > 0 ? "text-up" : "text-down";
}

/** Portfolio holdings — screener table container + row chrome. */
export function AgentHoldingList({ holdings }: { holdings: AgentHoldingRef[] }) {
  if (holdings.length === 0) return null;
  const showWeight = holdings.some((h) => h.weightLabel);
  const showPnl = holdings.some((h) => h.pnlLabel);
  const grid =
    showPnl && showWeight ? HOLDINGS_GRID
    : showPnl ? HOLDINGS_GRID_PNL_NO_WEIGHT
    : showWeight ? HOLDINGS_GRID_NO_PNL
    : HOLDINGS_GRID_NO_WEIGHT;

  return (
    <div
      className={cn(
        "w-full min-w-0 bg-surface p-2",
        SCREENER_TABLE_OUTER_BORDER_CLASS,
        SCREENER_TABLE_MOBILE_SURFACE_CLASS,
      )}
    >
      <div
        className={cn(
          SCREENER_TABLE_HEADER_STICKY_CLASS,
          SCREENER_TABLE_ROUNDED_HEADER_CLASS,
          SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
          "md:border-b-0",
        )}
      >
        <div className={HOLDINGS_CELL_PAD_CLASS}>
          <div className={cn(grid, "text-[14px] font-medium leading-5 text-fg-muted")}>
            <div className="text-left">Ticker</div>
            <div className="text-right">Shares</div>
            <div className="text-right">Worth</div>
            {showPnl ? <div className="text-right">Profit</div> : null}
            {showWeight ? <div className="text-right">Weight</div> : null}
          </div>
        </div>
        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
      </div>

      {holdings.map((h, i) => (
        <div
          key={`${h.ticker.kind}:${h.ticker.symbol}:${i}`}
          className={SCREENER_TABLE_DATA_ROW_CLASS}
        >
          <div className={cn(HOLDINGS_CELL_PAD_CLASS, SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS)}>
            <Link
              prefetch={false}
              href={h.ticker.href}
              className={cn(grid, "no-underline")}
            >
              <div className="flex min-w-0 items-center gap-3">
                <CompanyLogo
                  name={h.ticker.symbol}
                  symbol={h.ticker.symbol}
                  logoUrl={h.ticker.logoUrl}
                  size="sm"
                />
                <span className="truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover/row:underline">
                  {h.ticker.symbol}
                </span>
              </div>
              <span className="text-right text-[14px] font-normal leading-5 tabular-nums text-fg">
                {h.sharesLabel}
              </span>
              <span
                className={cn(
                  "text-right text-[14px] font-normal leading-5 tabular-nums",
                  h.worthLabel ? "text-fg" : "text-fg-muted",
                )}
              >
                {h.worthLabel ?? "—"}
              </span>
              {showPnl ? (
                <span
                  className={cn(
                    "text-right text-[14px] font-normal leading-5 tabular-nums",
                    pnlToneClass(h.pnlLabel),
                  )}
                >
                  {h.pnlLabel ?? "—"}
                </span>
              ) : null}
              {showWeight ? (
                <span className="text-right text-[14px] font-normal leading-5 tabular-nums text-fg">
                  {h.weightLabel ?? "—"}
                </span>
              ) : null}
            </Link>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>
      ))}
    </div>
  );
}

const ALLOC_GRID = "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3";

export function AgentAllocationList({
  rows,
}: {
  rows: Array<{ ticker: AgentTickerRef; weightLabel: string; worthLabel: string | null }>;
}) {
  if (rows.length === 0) return null;
  const showWorth = rows.some((r) => r.worthLabel);
  return (
    <div
      className={cn(
        "w-full min-w-0 bg-surface p-2",
        SCREENER_TABLE_OUTER_BORDER_CLASS,
        SCREENER_TABLE_MOBILE_SURFACE_CLASS,
      )}
    >
      <div
        className={cn(
          SCREENER_TABLE_HEADER_STICKY_CLASS,
          SCREENER_TABLE_ROUNDED_HEADER_CLASS,
          SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
          "md:border-b-0",
        )}
      >
        <div className={HOLDINGS_CELL_PAD_CLASS}>
          <div className={cn(ALLOC_GRID, "text-[14px] font-medium leading-5 text-fg-muted")}>
            <div className="text-left">Ticker</div>
            <div className="text-right">Weight</div>
            {showWorth ? <div className="text-right">Worth</div> : <div />}
          </div>
        </div>
        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
      </div>
      {rows.map((r, i) => (
        <div key={`${r.ticker.symbol}:${i}`} className={SCREENER_TABLE_DATA_ROW_CLASS}>
          <div className={cn(HOLDINGS_CELL_PAD_CLASS, SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS)}>
            <Link prefetch={false} href={r.ticker.href} className={cn(ALLOC_GRID, "no-underline")}>
              <div className="flex min-w-0 items-center gap-3">
                <CompanyLogo
                  name={r.ticker.symbol}
                  symbol={r.ticker.symbol}
                  logoUrl={r.ticker.logoUrl}
                  size="sm"
                />
                <span className="truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover/row:underline">
                  {r.ticker.symbol}
                </span>
              </div>
              <span className="text-right text-[14px] font-normal leading-5 tabular-nums text-fg">
                {r.weightLabel}
              </span>
              {showWorth ? (
                <span className="text-right text-[14px] font-normal leading-5 tabular-nums text-fg">
                  {r.worthLabel ?? "—"}
                </span>
              ) : (
                <span />
              )}
            </Link>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>
      ))}
    </div>
  );
}
