"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SuperinvestorQuarterlyTransaction, SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  SuperinvestorTransactionActivityCell,
  formatSuperinvestorTxPrice,
  formatSuperinvestorTxPriceRange,
} from "@/components/superinvestors/superinvestor-transaction-display";
import { SuperinvestorTransactionsSearch } from "@/components/superinvestors/superinvestor-transactions-search";
import { SUPERINVESTOR_HOLDINGS_PAGE_SIZE } from "@/lib/superinvestors/superinvestors-holdings-page-size";
import {
  flattenSuperinvestorTransactions,
  transactionMatchesCompanySearch,
} from "@/lib/superinvestors/superinvestor-transaction-utils";
import { resolveEquityLogoUrlFromListingTicker } from "@/lib/screener/resolve-equity-logo-url";
import { SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
import { ScreenerPagination } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";

const TRANSACTIONS_PAGE_SIZE = SUPERINVESTOR_HOLDINGS_PAGE_SIZE;

const thCompany =
  "whitespace-nowrap py-0 text-left align-middle text-[14px] font-medium leading-5 text-[#71717A]";
const thRight =
  "whitespace-nowrap py-0 text-right align-middle text-[14px] font-medium leading-5 text-[#71717A]";
const tdCompany = "min-w-0 py-1 text-left text-[14px] leading-5 whitespace-normal";
const tdActivity =
  "flex min-w-0 flex-col items-end justify-center py-1 text-right text-[14px] leading-5 whitespace-normal";
const tdNum =
  "whitespace-nowrap py-0 text-right align-middle font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]";

/** Company | Recent activity | Avg closing price | Price range. */
const rowGridFour =
  "grid w-full min-w-[800px] grid-cols-[minmax(180px,2.05fr)_minmax(140px,1.15fr)_minmax(96px,0.9fr)_minmax(120px,1.05fr)] gap-x-4";

const mobileRowGrid =
  "grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(5.5rem,auto)] gap-x-3 items-center";

const rowShellBase = "min-h-[60px] items-center transition-colors duration-75";

const headerGrid = cn("h-11 min-h-[44px] items-center bg-white", rowGridFour);

type FlatTransactionRow = {
  quarterLabel: string;
  sectionKey: string;
  tx: SuperinvestorQuarterlyTransaction;
  rowKey: string;
};

type PagedTableRow =
  | { kind: "quarter"; quarterLabel: string; sectionKey: string }
  | { kind: "transaction"; row: FlatTransactionRow };

function issuerDisplayTitle(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const hyphenParts = word.split("-").map((p) => (p.length === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)));
      return hyphenParts.join("-");
    })
    .join(" ");
}

function flattenTransactions(
  quarters: SuperinvestorTransactionsPayload["quarters"],
  companySearch: string,
): FlatTransactionRow[] {
  const filtered = flattenSuperinvestorTransactions(quarters).filter((tx) =>
    transactionMatchesCompanySearch(tx, companySearch),
  );
  return filtered.map((tx) => ({
    quarterLabel: tx.quarterLabel,
    sectionKey: `${tx.reportDate}|${tx.quarterLabel}`,
    tx,
    rowKey: `${tx.reportDate}-${tx.cusip ?? tx.companyName}`,
  }));
}

function pagedRowsWithQuarterDividers(flat: FlatTransactionRow[], page: number): PagedTableRow[] {
  const totalPages = Math.max(1, Math.ceil(flat.length / TRANSACTIONS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = flat.slice((safePage - 1) * TRANSACTIONS_PAGE_SIZE, safePage * TRANSACTIONS_PAGE_SIZE);

  const out: PagedTableRow[] = [];
  let lastQuarter: string | null = null;
  for (const row of slice) {
    if (row.quarterLabel !== lastQuarter) {
      out.push({ kind: "quarter", quarterLabel: row.quarterLabel, sectionKey: row.sectionKey });
      lastQuarter = row.quarterLabel;
    }
    out.push({ kind: "transaction", row });
  }
  return out;
}

function rowHref(displayName: string, ticker: string | null): string {
  const t = ticker?.trim();
  if (t) return `/stock/${encodeURIComponent(t.toUpperCase())}`;
  const q = displayName.trim();
  const hint = q ? `&q=${encodeURIComponent(q)}` : "";
  return `/screener?${SCREENER_MARKET_QUERY}=stocks${hint}`;
}

function TransactionRowShell({
  ticker,
  displayName,
  gridClass,
  children,
}: {
  ticker: string | null;
  displayName: string;
  gridClass: string;
  children: ReactNode;
}) {
  const href = rowHref(displayName, ticker);
  const hasTicker = Boolean(ticker?.trim());
  const merged = cn(gridClass, rowShellBase, "group cursor-pointer no-underline hover:bg-neutral-50");
  return (
    <Link
      href={href}
      prefetch={false}
      className={merged}
      aria-label={
        hasTicker
          ? `Open ${displayName} (${ticker!.trim().toUpperCase()})`
          : `Open screener to find ${displayName}`
      }
    >
      {children}
    </Link>
  );
}

function CompanyTickerCell({ companyName, ticker }: { companyName: string; ticker: string | null }) {
  const displayName = issuerDisplayTitle(companyName);
  const sym = ticker?.trim() ? ticker.trim().toUpperCase() : null;
  const logoUrl = sym ? resolveEquityLogoUrlFromListingTicker(sym) : "";
  return (
    <div className="flex min-w-0 items-center gap-3 pr-2 text-left">
      <CompanyLogo name={displayName} logoUrl={logoUrl} symbol={sym ?? undefined} size="md" />
      <div className="flex min-w-0 max-w-[min(280px,45vw)] flex-col gap-0.5 py-0.5">
        <span className="line-clamp-1 text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-[3px] decoration-[#09090B] group-hover:underline sm:line-clamp-2">
          {displayName}
        </span>
        <span className="text-[12px] font-normal leading-4 text-[#71717A]">{sym ?? "—"}</span>
      </div>
    </div>
  );
}

function MobilePricesCell({ tx }: { tx: SuperinvestorQuarterlyTransaction }) {
  return (
    <div className="flex flex-col items-end justify-center gap-1 text-right">
      <span className={cn(tdNum, "block font-medium")}>{formatSuperinvestorTxPrice(tx.avgClosingPriceUsd)}</span>
      <span className="text-[12px] font-normal leading-4 tabular-nums text-[#71717A]">
        {formatSuperinvestorTxPriceRange(tx.priceRangeLowUsd, tx.priceRangeHighUsd)}
      </span>
    </div>
  );
}

function QuarterDividerRow({ quarterLabel }: { quarterLabel: string }) {
  return (
    <div className="flex h-11 min-h-[44px] items-center bg-[#F4F4F5] px-4">
      <span className="text-[14px] font-semibold leading-5 text-[#09090B]">{quarterLabel}</span>
    </div>
  );
}

function DesktopTransactionRow({ row }: { row: FlatTransactionRow }) {
  const displayName = issuerDisplayTitle(row.tx.companyName);
  const ticker = row.tx.ticker?.trim() ? row.tx.ticker : null;
  return (
    <TransactionRowShell ticker={ticker} displayName={displayName} gridClass={cn(rowGridFour, "px-4")}>
      <div className={tdCompany}>
        <CompanyTickerCell companyName={row.tx.companyName} ticker={ticker} />
      </div>
      <div className={tdActivity}>
        <SuperinvestorTransactionActivityCell tx={row.tx} />
      </div>
      <div className={tdNum}>{formatSuperinvestorTxPrice(row.tx.avgClosingPriceUsd)}</div>
      <div className={tdNum}>{formatSuperinvestorTxPriceRange(row.tx.priceRangeLowUsd, row.tx.priceRangeHighUsd)}</div>
    </TransactionRowShell>
  );
}

function MobileTransactionRow({ row }: { row: FlatTransactionRow }) {
  const displayName = issuerDisplayTitle(row.tx.companyName);
  const ticker = row.tx.ticker?.trim() ? row.tx.ticker : null;
  return (
    <TransactionRowShell ticker={ticker} displayName={displayName} gridClass={cn(mobileRowGrid, "px-4")}>
      <div className={tdCompany}>
        <CompanyTickerCell companyName={row.tx.companyName} ticker={ticker} />
      </div>
      <div className={tdActivity}>
        <SuperinvestorTransactionActivityCell tx={row.tx} />
      </div>
      <MobilePricesCell tx={row.tx} />
    </TransactionRowShell>
  );
}

export function SuperinvestorTransactionsTable({
  data,
  companySearch = "",
  onCompanySearchChange,
  historyLoading = false,
}: {
  data: SuperinvestorTransactionsPayload;
  companySearch?: string;
  onCompanySearchChange?: (query: string) => void;
  /** True while loading full 13F history after a company search. */
  historyLoading?: boolean;
}) {
  const [page, setPage] = useState(1);

  const flatTransactions = useMemo(
    () => flattenTransactions(data.quarters, companySearch),
    [data.quarters, companySearch],
  );

  const totalPages = Math.max(1, Math.ceil(flatTransactions.length / TRANSACTIONS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedTableRows = useMemo(
    () => pagedRowsWithQuarterDividers(flatTransactions, safePage),
    [flatTransactions, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [data.cik, flatTransactions.length, companySearch]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (data.source === "unavailable") {
    return (
      <p className="text-sm text-[#71717A]">
        Quarterly transaction history could not be loaded from the SEC right now. Try again later.
      </p>
    );
  }

  if (historyLoading && companySearch.trim().length >= 2) {
    return (
      <div>
        {onCompanySearchChange ? (
          <div className="mb-4 flex w-full justify-end">
            <SuperinvestorTransactionsSearch value={companySearch} onChange={onCompanySearchChange} />
          </div>
        ) : null}
        <p className="text-sm text-[#71717A]">Loading full 13F history for this search…</p>
      </div>
    );
  }

  if (flatTransactions.length === 0) {
    return (
      <div>
        {onCompanySearchChange ? (
          <div className="mb-4 flex w-full justify-end">
            <SuperinvestorTransactionsSearch value={companySearch} onChange={onCompanySearchChange} />
          </div>
        ) : null}
        <p className="text-sm text-[#71717A]">
          {companySearch.trim() ?
            "No transactions match your search."
          : "No quarter-over-quarter position changes found in the last five years of 13F filings."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 -mx-4 sm:mx-0">
      {onCompanySearchChange ? (
        <div className="mb-4 flex w-full justify-end px-4 sm:px-0">
          <SuperinvestorTransactionsSearch value={companySearch} onChange={onCompanySearchChange} />
        </div>
      ) : null}
      {/* ── Mobile: single table ── */}
      <div className="sm:hidden">
        <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white">
          <div className={cn(mobileRowGrid, "h-11 min-h-[44px] bg-white px-4")}>
            <div className={thCompany}>Company</div>
            <div className={thRight}>Recent Activity</div>
            <div className={thRight}>Price</div>
          </div>
          {pagedTableRows.map((item) =>
            item.kind === "quarter" ? (
              <QuarterDividerRow key={`q-${item.sectionKey}`} quarterLabel={item.quarterLabel} />
            ) : (
              <MobileTransactionRow key={item.row.rowKey} row={item.row} />
            ),
          )}
        </div>
      </div>

      {/* ── Desktop: single table ── */}
      <div className="hidden overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] sm:block sm:overflow-visible sm:pb-0">
        <div className="min-w-[720px] sm:min-w-0">
          <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white">
            <div className={cn(headerGrid, "px-4")}>
              <div className={thCompany}>Company</div>
              <div className={thRight}>Recent Activity</div>
              <div className={thRight}>Avg closing price</div>
              <div className={thRight}>Price range</div>
            </div>
            {pagedTableRows.map((item) =>
              item.kind === "quarter" ? (
                <QuarterDividerRow key={`q-${item.sectionKey}`} quarterLabel={item.quarterLabel} />
              ) : (
                <DesktopTransactionRow key={item.row.rowKey} row={item.row} />
              ),
            )}
          </div>
        </div>
      </div>

      <ScreenerPagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        aria-label="Transaction pages"
      />
    </div>
  );
}
