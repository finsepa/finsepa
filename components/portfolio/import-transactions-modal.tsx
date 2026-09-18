"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Pencil, Trash2, Upload } from "@/lib/icons";
import { Spinner, SpinnerLabel } from "@/components/ui/spinner";

import {
  newTransactionRowId,
  portfolioIsCombined,
  type PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import {
  countUniqueOpenHoldingSymbols,
  freeHoldingsImportLimitMessage,
} from "@/lib/account/free-plan-asset-limits";
import { FREE_MAX_HOLDINGS_PER_PORTFOLIO } from "@/lib/account/plan-entitlements";
import { isManualPortfolioForFreeQuota } from "@/lib/account/free-plan-quota";
import { toastProUpgrade } from "@/lib/account/toast-pro-upgrade";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { useRouter } from "next/navigation";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import {
  buildImportedDrafts,
  parseNumberLoose,
  parseWorkbookToMatrix,
  resolveImportAssetDisplay,
  type ImportFieldKey,
  type ImportOperationLabel,
  type ImportedTransactionDraft,
} from "@/lib/portfolio/transaction-import";
import { formatPortfolioOperationLabel } from "@/components/layout/cash-direction-select";
import { fetchLiveMarketPriceClient, fetchPriceOnDateClient } from "@/lib/portfolio/client-symbol-quotes";
import { lotUnrealizedPnL } from "@/lib/portfolio/holding-position";
import {
  refreshHoldingMarketPrices,
  replayTradeTransactionsToHoldings,
} from "@/lib/portfolio/rebuild-holdings-from-trades";
import { formatPortfolioUsdPerUnit } from "@/lib/portfolio/format-portfolio-usd-unit";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";
import { CARD_CHROME_CLASS } from "@/components/design-system/card-surface-styles";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

/** UI progress jumps by a random step in this range (inclusive). */
const IMPORT_PROGRESS_STEP_MIN = 2;
const IMPORT_PROGRESS_STEP_MAX = 10;

function nextImportProgressTarget(from: number, total: number): number {
  const span = IMPORT_PROGRESS_STEP_MAX - IMPORT_PROGRESS_STEP_MIN + 1;
  const step = IMPORT_PROGRESS_STEP_MIN + Math.floor(Math.random() * span);
  return Math.min(total, from + step);
}

const ACCEPT = ".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

const OPS: ImportOperationLabel[] = [
  "Cash In",
  "Cash Out",
  "Other income",
  "Other expense",
  "Buy",
  "Sell",
  "Dividend",
  "Split",
];

type ImportOperationSelectValue = ImportOperationLabel | "";

const OPERATION_OPTIONS: ListboxOption<ImportOperationSelectValue>[] = [
  { value: "", label: "—" },
  ...OPS.map((op) => ({ value: op, label: formatPortfolioOperationLabel(op) })),
];

/** Compact import review grid — fills modal width (no forced horizontal scroll). */
const IMPORT_REVIEW_GRID_CLASS = "grid w-full min-w-0 items-center gap-x-1.5";
const IMPORT_REVIEW_GRID_STYLE = {
  gridTemplateColumns:
    "minmax(0,0.9fr) minmax(0,1fr) minmax(0,1.05fr) minmax(0,0.95fr) minmax(0,0.8fr) minmax(0,0.55fr) minmax(0,1.15fr) 76px",
} as const;

function importOpColorClass(operation: string | null): string {
  if (!operation) return "text-fg";
  const u = operation.toLowerCase();
  if (u.includes("sell") || u.includes("cash out") || u.includes("withdraw")) return "text-down";
  if (u.includes("expense") || u.includes("fees")) return "text-down";
  if (u.includes("buy") || u.includes("cash in") || u.includes("deposit") || u.includes("other income")) {
    return "text-up";
  }
  return "text-fg";
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type ImportRow = ImportedTransactionDraft & { id: string };

function newRowId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ir-${Math.random().toString(36).slice(2, 12)}`;
}

function isCashAssetSymbol(asset: string): boolean {
  const u = asset.trim().toUpperCase();
  return u === "USD" || u === "CASH" || u === "US DOLLAR";
}

/**
 * Sync stand-in for {@link ImportTransactionsModal}'s async `buildTransactions` —
 * enough for open-holdings cap preview (shares / ops), without live quotes.
 */
function buildImportHoldingsPreviewTransactions(
  portfolioId: string,
  rows: readonly ImportRow[],
): PortfolioTransaction[] {
  const out: PortfolioTransaction[] = [];
  for (const row of rows) {
    if (isCashAssetSymbol(row.asset)) {
      const amount = row.shares ?? 0;
      const fee = row.fee ?? 0;
      const op = (row.operation ?? "Cash In") as
        | "Cash In"
        | "Cash Out"
        | "Other income"
        | "Other expense";
      const cashSum =
        row.sum != null && Number.isFinite(row.sum)
          ? row.sum
          : op === "Cash In" || op === "Other income"
            ? amount - fee
            : -(amount + fee);
      out.push({
        id: newTransactionRowId(),
        portfolioId,
        kind: "cash",
        operation: op,
        symbol: "USD",
        name: "US Dollar",
        logoUrl: null,
        date: row.dateYmd ?? "1970-01-01",
        shares: amount,
        price: 1,
        fee,
        sum: cashSum,
        profitPct: null,
        profitUsd: null,
      });
      continue;
    }

    const sym = (row.quoteSymbol ?? row.asset).trim().toUpperCase();
    if (!sym) continue;
    const name = row.asset.trim() || sym;
    const fee = row.fee ?? 0;
    const dateStr = row.dateYmd ?? "1970-01-01";

    if (row.operation === "Dividend") {
      const total = row.shares ?? 0;
      const per = row.price ?? 0;
      const sum = row.sum != null && Number.isFinite(row.sum) ? row.sum : total - fee;
      out.push({
        id: newTransactionRowId(),
        portfolioId,
        kind: "income",
        operation: "Dividend",
        symbol: sym,
        name,
        logoUrl: null,
        date: dateStr,
        shares: total,
        price: per > 0 ? per : 1,
        fee,
        sum,
        profitPct: null,
        profitUsd: null,
      });
      continue;
    }

    if (row.operation === "Split") {
      out.push({
        id: newTransactionRowId(),
        portfolioId,
        kind: "trade",
        operation: "Split",
        symbol: sym,
        name,
        logoUrl: null,
        date: dateStr,
        shares: 0,
        price: row.price ?? 1,
        fee: 0,
        sum: 0,
        profitPct: null,
        profitUsd: null,
      });
      continue;
    }

    const sh = row.shares ?? 0;
    const pr = row.price ?? 0;
    const op = row.operation === "Sell" ? "Sell" : "Buy";
    const lotCost = sh * pr + fee;
    const sumDefault = op === "Buy" ? -lotCost : Math.max(0, sh * pr - fee);
    const sum = row.sum != null && Number.isFinite(row.sum) ? row.sum : sumDefault;
    out.push({
      id: newTransactionRowId(),
      portfolioId,
      kind: "trade",
      operation: op,
      symbol: sym,
      name,
      logoUrl: null,
      date: dateStr,
      shares: sh,
      price: pr,
      fee,
      sum,
      profitPct: null,
      profitUsd: null,
    });
  }
  return out;
}

function validateRow(r: ImportRow): ImportFieldKey[] {
  const missing: ImportFieldKey[] = [];
  if (!r.asset.trim()) missing.push("asset");
  if (!r.operation) missing.push("operation");
  if (!r.dateYmd) missing.push("date");
  const cash = isCashAssetSymbol(r.asset);
  if (r.operation === "Split") {
    if (r.shares != null && r.shares < 0) missing.push("shares");
    if (r.price == null || !(r.price > 0) || r.price === 1) missing.push("price");
  } else if (r.operation === "Dividend") {
    if (r.shares == null || r.shares <= 0) missing.push("shares");
  } else {
    if (r.shares == null || r.shares <= 0) missing.push("shares");
    if (!cash && (r.price == null || r.price <= 0)) missing.push("price");
  }
  if (r.sum == null || !Number.isFinite(r.sum)) missing.push("total");
  return missing;
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ImportTransactionsModal({ open, onClose }: Props) {
  const titleId = useId();
  const addingStatusId = useId();
  const router = useRouter();
  const plan = usePlanAccessOptional();
  const {
    selectedPortfolioId,
    portfolios,
    transactionsByPortfolioId,
    setPortfolioTransactions,
    setPortfolioHoldings,
  } = usePortfolioWorkspace();

  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"review" | "success">("review");
  const [importedCount, setImportedCount] = useState(0);
  const [commitError, setCommitError] = useState<string | null>(null);
  /** Row progress while applying CSV — UI ticks in random steps of 2–10. */
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
    stage: "idle" | "rows" | "holdings";
  }>({ done: 0, total: 0, stage: "idle" });

  const importPortfolio =
    selectedPortfolioId != null ?
      portfolios.find((p) => p.id === selectedPortfolioId) ?? null
    : null;
  const hasPortfolio = importPortfolio != null && !portfolioIsCombined(importPortfolio);

  useEffect(() => {
    if (!open) return;
    setDragOver(false);
    setParseError(null);
    setRows([]);
    setEditingId(null);
    setSubmitting(false);
    setPhase("review");
    setImportedCount(0);
    setCommitError(null);
    setImportProgress({ done: 0, total: 0, stage: "idle" });
  }, [open]);

  const recomputeRow = useCallback((r: ImportRow, patch: Partial<ImportRow> = {}): ImportRow => {
    let merged: ImportRow = { ...r, ...patch };
    if (Object.hasOwn(patch, "asset")) {
      const res = resolveImportAssetDisplay(String(patch.asset ?? ""));
      const { quoteSymbol: _, ...rest } = merged;
      merged = {
        ...rest,
        asset: res.display,
        ...(res.quoteSymbol ? { quoteSymbol: res.quoteSymbol } : {}),
      };
    }
    const cash = isCashAssetSymbol(merged.asset);
    const price = cash ? (merged.price != null && merged.price > 0 ? merged.price : 1) : merged.price;
    const shares = merged.shares;
    const fee = Math.max(0, merged.fee ?? 0);
    let sum = merged.sum;
    const userEditedSum = Object.hasOwn(patch, "sum");
    const p = cash ? 1 : price ?? 0;
    if (!userEditedSum && merged.operation) {
      if (merged.operation === "Dividend" && shares != null && shares > 0) {
        sum = shares - fee;
      } else if (merged.operation === "Split") {
        sum = 0;
      } else if (shares != null && shares > 0 && p > 0) {
        const gross = shares * p;
        if (merged.operation === "Buy") sum = -(gross + fee);
        else if (merged.operation === "Sell") sum = Math.max(0, gross - fee);
        else if (merged.operation === "Cash In") sum = shares - fee;
        else if (merged.operation === "Cash Out") sum = -(shares + fee);
        else if (merged.operation === "Other income") sum = shares - fee;
        else if (merged.operation === "Other expense") sum = -(shares + fee);
      }
    }
    const next: ImportRow = {
      ...merged,
      price: price ?? merged.price,
      fee,
      sum,
    };
    return { ...next, missing: validateRow(next) };
  }, []);

  const ingestFile = useCallback(
    async (file: File) => {
      setParseError(null);
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".csv") && !lower.endsWith(".xls") && !lower.endsWith(".xlsx")) {
        setParseError("Use a .csv, .xls, or .xlsx file.");
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const { rows: matrix } = await parseWorkbookToMatrix(buf);
        if (matrix.length < 2) {
          setParseError("No data rows found.");
          return;
        }
        const drafts = buildImportedDrafts(matrix);
        // Newest first in the review table (same-day rows keep file order).
        const next = drafts
          .map((d) => recomputeRow({ ...d, id: newRowId() }, {}))
          .sort((a, b) => {
            const da = a.dateYmd ?? "";
            const db = b.dateYmd ?? "";
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return db.localeCompare(da);
          });
        setRows(next);
        setEditingId(null);
      } catch {
        setParseError("Could not read this file.");
      }
    },
    [recomputeRow],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void ingestFile(f);
    },
    [ingestFile],
  );

  const updateRow = useCallback(
    (id: string, patch: Partial<ImportRow>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          let p = { ...patch };
          if (patch.asset !== undefined) {
            const mergedAsset = patch.asset;
            const cash = isCashAssetSymbol(mergedAsset);
            const curOp = patch.operation !== undefined ? patch.operation : r.operation;
            if (cash) {
              if (curOp === "Buy" || curOp === "Sell") p = { ...p, operation: null };
            } else if (
              curOp === "Cash In" ||
              curOp === "Cash Out" ||
              curOp === "Other income" ||
              curOp === "Other expense"
            ) {
              p = { ...p, operation: "Buy" };
            }
          }
          return recomputeRow(r, p);
        }),
      );
    },
    [recomputeRow],
  );

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setEditingId((e) => (e === id ? null : e));
  }, []);

  /** Matches red `r.missing` cells; import only when every row is clean and no row is mid-edit. */
  const allRowsValid = useMemo(() => rows.length > 0 && rows.every((r) => r.missing.length === 0), [rows]);
  const canImport = allRowsValid && editingId === null;
  const missingCellCount = useMemo(() => rows.reduce((acc, r) => acc + r.missing.length, 0), [rows]);

  const freeHoldingsCap =
    plan?.isFree === true
      ? (plan.maxHoldingsPerPortfolio ?? FREE_MAX_HOLDINGS_PER_PORTFOLIO)
      : null;
  const holdingsLimitApplies =
    freeHoldingsCap != null &&
    importPortfolio != null &&
    isManualPortfolioForFreeQuota(importPortfolio);

  /** Free: block Add when merged open holdings would grow past the 15-asset cap. */
  const holdingsLimitViolation = useMemo(() => {
    if (!holdingsLimitApplies || freeHoldingsCap == null || !selectedPortfolioId) return null;
    if (rows.length === 0 || !allRowsValid) return null;
    const existing = transactionsByPortfolioId[selectedPortfolioId] ?? [];
    const prevCount = countUniqueOpenHoldingSymbols(replayTradeTransactionsToHoldings(existing));
    const previewImported = buildImportHoldingsPreviewTransactions(selectedPortfolioId, rows);
    const merged = [...existing, ...previewImported].sort((a, b) => a.date.localeCompare(b.date));
    const nextCount = countUniqueOpenHoldingSymbols(replayTradeTransactionsToHoldings(merged));
    if (nextCount > freeHoldingsCap && nextCount > prevCount) {
      return { prevCount, nextCount, max: freeHoldingsCap };
    }
    return null;
  }, [
    allRowsValid,
    freeHoldingsCap,
    holdingsLimitApplies,
    rows,
    selectedPortfolioId,
    transactionsByPortfolioId,
  ]);

  const holdingsLimitMessage = holdingsLimitViolation
    ? freeHoldingsImportLimitMessage(holdingsLimitViolation)
    : null;

  const currentOpenHoldingsCount = useMemo(() => {
    if (!holdingsLimitApplies || !selectedPortfolioId) return 0;
    const existing = transactionsByPortfolioId[selectedPortfolioId] ?? [];
    return countUniqueOpenHoldingSymbols(replayTradeTransactionsToHoldings(existing));
  }, [holdingsLimitApplies, selectedPortfolioId, transactionsByPortfolioId]);

  const atHoldingsCap =
    holdingsLimitApplies && freeHoldingsCap != null && currentOpenHoldingsCount >= freeHoldingsCap;

  /** Mirrors `buildTransactions`: non-cash → trades; cash → split into Cash / Income / Expenses. */
  const importBreakdown = useMemo(() => {
    let trades = 0;
    let income = 0;
    let expenses = 0;
    let cash = 0;
    for (const r of rows) {
      if (!isCashAssetSymbol(r.asset)) {
        if (r.operation === "Dividend") income += 1;
        else trades += 1;
        continue;
      }
      const op = r.operation;
      if (op === "Other income") income += 1;
      else if (op === "Other expense") expenses += 1;
      else cash += 1;
    }
    return { trades, income, expenses, cash, total: rows.length };
  }, [rows]);

  const buildTransactions = useCallback(
    async (
      pid: string,
      onRowProgress?: (done: number, total: number) => void,
    ): Promise<PortfolioTransaction[]> => {
      const out: PortfolioTransaction[] = [];
      const rowTotal = rows.length;
      let rowDone = 0;
      let nextPublishAt = rowTotal > 0 ? 1 : 0;
      const bumpRow = () => {
        rowDone += 1;
        if (rowTotal <= 0) return;
        if (rowDone === rowTotal || rowDone >= nextPublishAt) {
          onRowProgress?.(rowDone, rowTotal);
          nextPublishAt = nextImportProgressTarget(rowDone, rowTotal);
        }
      };

      for (const row of rows) {
        if (isCashAssetSymbol(row.asset)) {
          const amount = row.shares!;
          const fee = row.fee ?? 0;
          const op = row.operation as
            | "Cash In"
            | "Cash Out"
            | "Other income"
            | "Other expense";
          const cashSum =
            row.sum != null && Number.isFinite(row.sum)
              ? row.sum
              : op === "Cash In" || op === "Other income"
                ? amount - fee
                : -(amount + fee);
          out.push({
            id: newTransactionRowId(),
            portfolioId: pid,
            kind: "cash",
            operation: op,
            symbol: "USD",
            name: "US Dollar",
            logoUrl: null,
            date: row.dateYmd!,
            shares: amount,
            price: 1,
            fee,
            sum: cashSum,
            profitPct: null,
            profitUsd: null,
          });
          bumpRow();
          continue;
        }

        const sym = (row.quoteSymbol ?? row.asset).trim().toUpperCase();
        const name = row.asset.trim();
        const fee = row.fee ?? 0;
        const dateStr = row.dateYmd!;

        if (row.operation === "Dividend") {
          const total = row.shares!;
          const per = row.price ?? 0;
          const implied = per > 0 && Number.isFinite(total / per) ? total / per : null;
          const shareDisplay =
            implied != null &&
            implied > 0 &&
            Math.abs(implied - Math.round(implied)) < 1e-3
              ? Math.round(implied)
              : implied ?? 0;
          const sum =
            row.sum != null && Number.isFinite(row.sum) ? row.sum : total - fee;
          const logoUrl = displayLogoUrlForPortfolioSymbol(sym).trim() || null;
          out.push({
            id: newTransactionRowId(),
            portfolioId: pid,
            kind: "income",
            operation: "Dividend",
            symbol: sym,
            name,
            logoUrl,
            date: dateStr,
            shares: shareDisplay,
            price: per > 0 ? per : 1,
            fee,
            sum,
            profitPct: null,
            profitUsd: null,
          });
          bumpRow();
          continue;
        }

        if (row.operation === "Split") {
          const ratio = row.price!;
          const logoUrl = displayLogoUrlForPortfolioSymbol(sym).trim() || null;
          out.push({
            id: newTransactionRowId(),
            portfolioId: pid,
            kind: "trade",
            operation: "Split",
            symbol: sym,
            name,
            logoUrl,
            date: dateStr,
            shares: 0,
            price: ratio,
            fee: 0,
            sum: 0,
            profitPct: null,
            profitUsd: null,
          });
          bumpRow();
          continue;
        }

        const sh = row.shares!;
        const pr = row.price!;
        const op = row.operation === "Sell" ? "Sell" : "Buy";

        const live = await fetchLiveMarketPriceClient(sym);
        const onDate = await fetchPriceOnDateClient(sym, dateStr);
        const marketPrice = live ?? onDate ?? pr;
        const logoUrl = displayLogoUrlForPortfolioSymbol(sym).trim() || null;
        const lotCost = sh * pr + fee;
        const sumDefault = op === "Buy" ? -lotCost : Math.max(0, sh * pr - fee);
        const sum =
          row.sum != null && Number.isFinite(row.sum) ? row.sum : sumDefault;
        const pnl =
          op === "Buy"
            ? lotUnrealizedPnL({ shares: sh, price: pr, fee, marketPrice })
            : { profitPct: null as number | null, profitUsd: null as number | null };

        out.push({
          id: newTransactionRowId(),
          portfolioId: pid,
          kind: "trade",
          operation: op,
          symbol: sym,
          name,
          logoUrl,
          date: dateStr,
          shares: sh,
          price: pr,
          fee,
          sum,
          profitPct: pnl.profitPct,
          profitUsd: pnl.profitUsd,
        });
        bumpRow();
      }
      return out;
    },
    [rows],
  );

  const handleAdd = useCallback(async () => {
    if (!selectedPortfolioId || !hasPortfolio || !canImport) return;
    if (holdingsLimitViolation) {
      const description = freeHoldingsImportLimitMessage(holdingsLimitViolation);
      setCommitError(description);
      toastProUpgrade({
        title: "Free plan limit",
        description,
        onUpgrade: () => router.push(PATH_ACCOUNT_PLANS),
      });
      return;
    }
    setCommitError(null);
    setSubmitting(true);
    const rowTotal = rows.length;
    setImportProgress({
      done: 0,
      total: rowTotal,
      stage: rowTotal > 0 ? "rows" : "holdings",
    });
    try {
      const pid = selectedPortfolioId;
      const existing = transactionsByPortfolioId[pid] ?? [];
      const imported = await buildTransactions(pid, (done, total) => {
        setImportProgress({ done, total, stage: "rows" });
      });
      /** Stable by date so same-calendar-day rows keep file order (Snowball / broker CSVs). */
      const merged = [...existing, ...imported].sort((a, b) => a.date.localeCompare(b.date));
      const rebuilt = replayTradeTransactionsToHoldings(merged);
      const maxHoldings =
        plan?.isFree === true
          ? (plan.maxHoldingsPerPortfolio ?? FREE_MAX_HOLDINGS_PER_PORTFOLIO)
          : null;
      if (maxHoldings != null && importPortfolio && isManualPortfolioForFreeQuota(importPortfolio)) {
        const nextCount = countUniqueOpenHoldingSymbols(rebuilt);
        const prevCount = countUniqueOpenHoldingSymbols(
          replayTradeTransactionsToHoldings(existing),
        );
        if (nextCount > maxHoldings && nextCount > prevCount) {
          const description = freeHoldingsImportLimitMessage({
            max: maxHoldings,
            prevCount,
            nextCount,
          });
          setCommitError(description);
          toastProUpgrade({
            title: "Free plan limit",
            description,
            onUpgrade: () => router.push(PATH_ACCOUNT_PLANS),
          });
          return;
        }
      }
      setImportProgress((prev) => ({
        done: prev.total,
        total: prev.total,
        stage: "holdings",
      }));
      const applied = setPortfolioTransactions(pid, merged, { forgivePositionAnomalies: true });
      if (!applied) {
        setCommitError(
          "Import could not be applied — some rows conflict with the portfolio ledger (for example a sell before any buy). Fix those rows or import a corrected CSV.",
        );
        return;
      }
      const quoted = await refreshHoldingMarketPrices(rebuilt);
      setPortfolioHoldings(pid, quoted);
      setImportedCount(imported.length);
      setPhase("success");
    } catch {
      setCommitError("Could not finish import. Check your connection and try again.");
    } finally {
      setSubmitting(false);
      setImportProgress({ done: 0, total: 0, stage: "idle" });
    }
  }, [
    canImport,
    buildTransactions,
    hasPortfolio,
    holdingsLimitViolation,
    importPortfolio,
    plan,
    router,
    rows,
    selectedPortfolioId,
    setPortfolioHoldings,
    setPortfolioTransactions,
    transactionsByPortfolioId,
  ]);

  if (!open) return null;

  const fieldTone = (r: ImportRow, field: ImportFieldKey) =>
    r.missing.includes(field) && "rounded-md bg-red-50 ring-1 ring-inset ring-red-200";

  const showAddingOverlay = submitting && phase === "review";

  return (
    <>
      <AppModalOverlay
        open={open}
        onClose={submitting ? undefined : onClose}
        zIndex={115}
      >
        <AppModalShell
          titleId={titleId}
          title={phase === "success" ? "Import complete" : "Import CSV File"}
          onClose={onClose}
          closeDisabled={submitting}
          maxWidthClass={phase === "success" ? "w-full max-w-md" : "w-full max-w-[960px]"}
          maxHeightClass={phase === "success" ? "max-h-[min(90vh,804px)]" : "max-h-[min(92vh,880px)]"}
          bodyClassName="px-5 pb-4 pt-4"
          footer={
            <AppModalFooter className={phase === "success" ? "justify-end" : undefined}>
              {phase === "success" ? (
                <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className={appModalCancelButtonClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!hasPortfolio || !canImport || submitting || holdingsLimitViolation != null}
                    onClick={() => void handleAdd()}
                    className={appModalPrimaryButtonClass(
                      hasPortfolio && canImport && !submitting && holdingsLimitViolation == null,
                    )}
                  >
                    {submitting ? <SpinnerLabel>Adding…</SpinnerLabel> : "Add"}
                  </button>
                </>
              )}
            </AppModalFooter>
          }
        >
          {phase === "success" ? (
            <div className="py-2">
              <p className="text-sm leading-relaxed text-fg">
                You successfully imported <strong>{importedCount}</strong>{" "}
                {importedCount === 1 ? "transaction" : "transactions"}.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                Updating holdings and prices can take a little while. You can close this dialog and keep working; the
                portfolio will refresh as data finishes loading.
              </p>
            </div>
          ) : (
            <>
              {rows.length === 0 ? (
                <div className="flex flex-col gap-3">
                  {atHoldingsCap && freeHoldingsCap != null ? (
                    <div
                      className="rounded-[10px] border border-orange/30 bg-orange-soft px-3 py-2.5 text-sm text-orange"
                      role="status"
                    >
                      You’re at the Free limit of {freeHoldingsCap} holdings. Imports that only touch
                      existing assets or cash still work — adding new assets requires Pro.
                    </div>
                  ) : null}
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") e.preventDefault();
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    className={cn(
                      "flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 transition-colors",
                      dragOver ? "border-fg bg-surface-muted" : "border-stroke bg-canvas hover:border-fg-subtle",
                    )}
                  >
                    <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                      <Upload className="h-8 w-8 text-fg-muted" aria-hidden />
                      <span className="text-sm font-medium text-fg">Drop your spreadsheet here</span>
                      <span className="text-xs text-fg-muted">or click to choose · .csv, .xls, .xlsx</span>
                      <input
                        type="file"
                        accept={ACCEPT}
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void ingestFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {parseError ? (
                    <p className="text-sm text-red-700">{parseError}</p>
                  ) : null}

                  {missingCellCount > 0 ? (
                    <div
                      className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-950"
                      role="status"
                    >
                      <span className="font-semibold tabular-nums">{missingCellCount}</span>{" "}
                      {missingCellCount === 1 ? "field needs" : "fields need"} to be fixed (red cells) before you can
                      import.
                    </div>
                  ) : null}
                  {holdingsLimitMessage ? (
                    <div
                      className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-950"
                      role="alert"
                    >
                      <p className="font-semibold leading-5">Free holdings limit</p>
                      <p className="mt-1 text-sm leading-5">{holdingsLimitMessage}</p>
                      <button
                        type="button"
                        className="mt-2 text-sm font-semibold text-red-950 underline underline-offset-2"
                        onClick={() => router.push(PATH_ACCOUNT_PLANS)}
                      >
                        View plans
                      </button>
                    </div>
                  ) : null}
                  <div
                    className="rounded-[10px] border border-orange/30 bg-orange-soft px-3 py-2.5 text-orange"
                    role="note"
                  >
                    <p className="text-sm font-semibold leading-5">Check your import</p>
                    <p className="mt-1 text-xs leading-5">
                      USD is treated as cash. If a cell is red, click{" "}
                      <strong className="font-semibold">Edit</strong>, fill it in, then{" "}
                      <strong className="font-semibold">Confirm</strong>. Hit{" "}
                      <strong className="font-semibold">Add</strong> when all rows are valid and
                      you’re done editing.
                    </p>
                  </div>
              <div
                className={cn(
                  "import-review-table-scroll max-h-[min(52vh,420px)] overflow-x-hidden overflow-y-auto rounded-2xl bg-surface [scrollbar-gutter:stable]",
                  SCREENER_TABLE_OUTER_BORDER_CLASS,
                  CARD_CHROME_CLASS,
                )}
              >
                <div
                  className={cn(
                    SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS,
                    SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
                    "border-b-0",
                  )}
                >
                  <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                    <div
                      className={cn(
                        IMPORT_REVIEW_GRID_CLASS,
                        "min-h-9 text-[13px] font-medium leading-5 text-fg-muted",
                      )}
                      style={IMPORT_REVIEW_GRID_STYLE}
                    >
                      <div className={cn("min-w-0 text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Asset</div>
                      <div className={cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Operation</div>
                      <div className={cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Date</div>
                      <div className={cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Price</div>
                      <div className={cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Shares</div>
                      <div className={cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Fee</div>
                      <div className={cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Total</div>
                      <div className="pr-5 text-right">
                        <span className="sr-only">Actions</span>
                      </div>
                    </div>
                  </div>
                  <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                </div>

                {rows.map((r) => {
                  const edit = editingId === r.id;
                  return (
                    <div key={r.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                        <div
                          className={cn(
                            IMPORT_REVIEW_GRID_CLASS,
                            "min-h-9 py-1 text-xs font-normal leading-4",
                            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                          )}
                          style={IMPORT_REVIEW_GRID_STYLE}
                        >
                          <div
                            className={cn(
                              "min-w-0 text-left",
                              TABLE_START_ALIGNED_PAD_CLASS,
                              fieldTone(r, "asset"),
                            )}
                          >
                            {edit ? (
                              <input
                                value={r.asset}
                                onChange={(e) => updateRow(r.id, { asset: e.target.value })}
                                className="w-full min-w-0 rounded border border-stroke bg-surface px-1.5 py-1 text-xs"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                className={cn(
                                  "w-full truncate text-left font-medium text-fg",
                                  r.missing.includes("asset") && "min-h-7",
                                )}
                              >
                                {r.asset || "—"}
                              </button>
                            )}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 text-right",
                              TABLE_END_ALIGNED_PAD_CLASS,
                              fieldTone(r, "operation"),
                            )}
                          >
                            {edit ? (
                              <FormListboxSelect
                                value={(r.operation ?? "") as ImportOperationSelectValue}
                                onChange={(v) =>
                                  updateRow(r.id, { operation: v === "" ? null : v })
                                }
                                options={OPERATION_OPTIONS}
                                aria-label="Operation"
                                portaled
                                compact
                                truncateLabel={false}
                                truncateOptions={false}
                                className="ml-auto w-full max-w-full"
                                triggerClassName="h-7 min-h-7 max-h-7 py-0 text-xs"
                                menuClassName="z-[200] min-w-[10.5rem]"
                                menuAlign="trailing"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                className="w-full text-right"
                              >
                                <span
                                  className={cn(
                                    "font-medium",
                                    importOpColorClass(r.operation),
                                  )}
                                >
                                  {r.operation ? formatPortfolioOperationLabel(r.operation) : "—"}
                                </span>
                              </button>
                            )}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 text-right",
                              TABLE_END_ALIGNED_PAD_CLASS,
                              fieldTone(r, "date"),
                            )}
                          >
                            {edit ? (
                              <input
                                type="date"
                                value={r.dateYmd ?? ""}
                                onChange={(e) =>
                                  updateRow(r.id, { dateYmd: e.target.value || null })
                                }
                                className="ml-auto w-full rounded border border-stroke bg-surface px-1 py-1 text-right text-xs"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                className="w-full text-right tabular-nums text-fg"
                              >
                                {r.dateYmd
                                  ? (() => {
                                      try {
                                        return format(parseISO(r.dateYmd), "MMM d, yyyy");
                                      } catch {
                                        return r.dateYmd;
                                      }
                                    })()
                                  : "—"}
                              </button>
                            )}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 text-right",
                              TABLE_END_ALIGNED_PAD_CLASS,
                              fieldTone(r, "price"),
                            )}
                          >
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.price != null ? String(r.price) : ""}
                                onChange={(e) =>
                                  updateRow(r.id, { price: parseNumberLoose(e.target.value) })
                                }
                                className="w-full rounded border border-stroke bg-surface px-1 py-1 text-right text-xs tabular-nums"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                className="w-full text-right tabular-nums text-fg"
                              >
                                {isCashAssetSymbol(r.asset)
                                  ? "—"
                                  : r.price != null
                                    ? formatPortfolioUsdPerUnit(r.price)
                                    : "—"}
                              </button>
                            )}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 text-right",
                              TABLE_END_ALIGNED_PAD_CLASS,
                              fieldTone(r, "shares"),
                            )}
                          >
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.shares != null ? String(r.shares) : ""}
                                onChange={(e) =>
                                  updateRow(r.id, { shares: parseNumberLoose(e.target.value) })
                                }
                                className="w-full rounded border border-stroke bg-surface px-1 py-1 text-right text-xs tabular-nums"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                className="w-full text-right tabular-nums text-fg"
                              >
                                {r.shares != null ? r.shares.toLocaleString("en-US") : "—"}
                              </button>
                            )}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 text-right",
                              TABLE_END_ALIGNED_PAD_CLASS,
                              fieldTone(r, "fee"),
                            )}
                          >
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.fee != null && r.fee > 0 ? String(r.fee) : ""}
                                onChange={(e) =>
                                  updateRow(r.id, { fee: parseNumberLoose(e.target.value) ?? 0 })
                                }
                                className="w-full rounded border border-stroke bg-surface px-1 py-1 text-right text-xs tabular-nums"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                className="w-full text-right tabular-nums text-fg"
                              >
                                {(r.fee ?? 0) > 0 ? usd.format(r.fee ?? 0) : "—"}
                              </button>
                            )}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 text-right",
                              TABLE_END_ALIGNED_PAD_CLASS,
                              fieldTone(r, "total"),
                            )}
                          >
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.sum != null ? String(r.sum) : ""}
                                onChange={(e) =>
                                  updateRow(r.id, { sum: parseNumberLoose(e.target.value) })
                                }
                                className="w-full rounded border border-stroke bg-surface px-1 py-1 text-right text-xs tabular-nums"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                className="w-full text-right"
                              >
                                {r.sum != null ? (
                                  <span
                                    className={cn(
                                      "tabular-nums font-medium",
                                      r.sum > 0 ? "text-up" : r.sum < 0 ? "text-down" : "text-fg",
                                    )}
                                  >
                                    {r.sum > 0 ? "+" : ""}
                                    {usd.format(r.sum)}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-end pr-5">
                            <div className="flex items-center justify-end gap-0.5">
                              {edit ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-fg text-surface hover:bg-fg"
                                  aria-label="Confirm changes"
                                >
                                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(r.id)}
                                    className="flex h-7 w-7 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                                    aria-label="Edit row"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeRow(r.id)}
                                    className="flex h-7 w-7 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-down-soft hover:text-down"
                                    aria-label="Remove row"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                    </div>
                  );
                })}
              </div>

              <div className="rounded-[10px] border border-stroke bg-canvas px-4 py-3">
                <ul className="space-y-1.5 text-sm text-fg">
                  <li className="flex items-center justify-between gap-4">
                    <span>Trades</span>
                    <span className="tabular-nums font-medium">{importBreakdown.trades}</span>
                  </li>
                  <li className="flex items-center justify-between gap-4">
                    <span>Income</span>
                    <span className="tabular-nums font-medium">{importBreakdown.income}</span>
                  </li>
                  <li className="flex items-center justify-between gap-4">
                    <span>Expenses</span>
                    <span className="tabular-nums font-medium">{importBreakdown.expenses}</span>
                  </li>
                  <li className="flex items-center justify-between gap-4">
                    <span>Cash</span>
                    <span className="tabular-nums font-medium">{importBreakdown.cash}</span>
                  </li>
                  <li className="flex items-center justify-between gap-4 border-t border-stroke pt-2.5 font-semibold">
                    <span>Total transactions</span>
                    <span className="tabular-nums">{importBreakdown.total}</span>
                  </li>
                </ul>
              </div>
                </div>
              )}

              {parseError && rows.length === 0 ? (
                <p className="mt-3 text-sm text-red-700">{parseError}</p>
              ) : null}

              {commitError ? (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {commitError}
                </p>
              ) : null}

              {!hasPortfolio ? (
                <p className="mt-3 text-sm text-amber-800">
                  {importPortfolio && portfolioIsCombined(importPortfolio) ?
                    "Choose a standard portfolio—combined portfolios are read-only."
                  : "Choose a portfolio to import into."}
                </p>
              ) : null}
            </>
          )}
        </AppModalShell>
      </AppModalOverlay>

      <AppModalOverlay open={showAddingOverlay} zIndex={120} closeOnBackdropClick={false}>
        <AppModalShell
          titleId={addingStatusId}
          showClose={false}
          maxWidthClass="w-full max-w-[360px]"
          bodyClassName="px-8 py-10 text-center"
          bodyScroll={false}
        >
          <Spinner className="mx-auto size-10 text-fg" />
          <p id={addingStatusId} className="mt-5 text-lg font-semibold tracking-tight text-fg">
            Adding
          </p>
          {importProgress.stage === "rows" && importProgress.total > 0 ? (
            <>
              <p
                id={`${addingStatusId}-desc`}
                className="mt-2 text-sm tabular-nums leading-relaxed text-fg"
              >
                {importProgress.done} / {importProgress.total} transactions imported…
              </p>
              <div
                className="mx-auto mt-4 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-stroke"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={importProgress.total}
                aria-valuenow={importProgress.done}
                aria-labelledby={`${addingStatusId}-desc`}
              >
                <div
                  className="h-full rounded-full bg-fg transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.min(100, (importProgress.done / importProgress.total) * 100)}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <p id={`${addingStatusId}-desc`} className="mt-2 text-sm leading-relaxed text-fg-muted">
              {importProgress.stage === "holdings"
                ? "Updating holdings with live market prices…"
                : "Applying your transactions. Please wait…"}
            </p>
          )}
        </AppModalShell>
      </AppModalOverlay>
    </>
  );
}
