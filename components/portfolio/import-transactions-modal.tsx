"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { Check, Loader2, Pencil, Trash2, Upload, X } from "lucide-react";

import {
  newTransactionRowId,
  type PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
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
import { fetchLiveMarketPriceClient, fetchPriceOnDateClient } from "@/lib/portfolio/client-symbol-quotes";
import { lotUnrealizedPnL } from "@/lib/portfolio/holding-position";
import {
  refreshHoldingMarketPrices,
  replayTradeTransactionsToHoldings,
} from "@/lib/portfolio/rebuild-holdings-from-trades";
import { formatPortfolioUsdPerUnit } from "@/lib/portfolio/format-portfolio-usd-unit";
import { cn } from "@/lib/utils";

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

  const hasPortfolio =
    selectedPortfolioId != null && portfolios.some((p) => p.id === selectedPortfolioId);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
        const { rows: matrix } = parseWorkbookToMatrix(buf);
        if (matrix.length < 2) {
          setParseError("No data rows found.");
          return;
        }
        const drafts = buildImportedDrafts(matrix);
        setRows(drafts.map((d) => recomputeRow({ ...d, id: newRowId() }, {})));
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
    async (pid: string): Promise<PortfolioTransaction[]> => {
      const out: PortfolioTransaction[] = [];
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
      }
      return out;
    },
    [rows],
  );

  const handleAdd = useCallback(async () => {
    if (!selectedPortfolioId || !hasPortfolio || !canImport) return;
    setCommitError(null);
    setSubmitting(true);
    try {
      const pid = selectedPortfolioId;
      const existing = transactionsByPortfolioId[pid] ?? [];
      const imported = await buildTransactions(pid);
      /** Stable by date so same-calendar-day rows keep file order (Snowball / broker CSVs). */
      const merged = [...existing, ...imported].sort((a, b) => a.date.localeCompare(b.date));
      setPortfolioTransactions(pid, merged);
      const rebuilt = replayTradeTransactionsToHoldings(merged);
      const quoted = await refreshHoldingMarketPrices(rebuilt);
      setPortfolioHoldings(pid, quoted);
      setImportedCount(imported.length);
      setPhase("success");
    } catch {
      setCommitError("Could not finish import. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    canImport,
    buildTransactions,
    hasPortfolio,
    selectedPortfolioId,
    setPortfolioHoldings,
    setPortfolioTransactions,
    transactionsByPortfolioId,
  ]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const cellClass = (r: ImportRow, field: ImportFieldKey, extra?: string) =>
    cn(
      "min-h-[36px] px-2 py-1.5 align-middle text-xs",
      r.missing.includes(field) && "bg-red-50 ring-1 ring-inset ring-red-200",
      extra,
    );

  const showAddingOverlay = submitting && phase === "review";

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[115] flex items-center justify-center bg-black/40 p-4"
        role="presentation"
        onMouseDown={(e) => {
          if (submitting) return;
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={showAddingOverlay}
          className={cn(
            "flex w-full flex-col rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)] min-h-0",
            phase === "success" ? "max-w-md" : "max-h-[min(92vh,880px)] max-w-[800px]",
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
            <h2 id={titleId} className="text-lg font-semibold leading-7 tracking-tight text-[#09090B]">
              {phase === "success" ? "Import complete" : "Import Transactions"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors",
                submitting ? "cursor-not-allowed opacity-40" : "hover:bg-[#F4F4F5]",
              )}
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
          {phase === "success" ? (
            <div className="py-2">
              <p className="text-sm leading-relaxed text-[#09090B]">
                You successfully imported <strong>{importedCount}</strong>{" "}
                {importedCount === 1 ? "transaction" : "transactions"}.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#71717A]">
                Updating holdings and prices can take a little while. You can close this dialog and keep working; the
                portfolio will refresh as data finishes loading.
              </p>
            </div>
          ) : rows.length === 0 ? (
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
                dragOver ? "border-[#09090B] bg-[#F4F4F5]" : "border-[#D4D4D8] bg-[#FAFAFA] hover:border-[#A1A1AA]",
              )}
            >
              <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                <Upload className="h-8 w-8 text-[#71717A]" aria-hidden />
                <span className="text-sm font-medium text-[#09090B]">Drop your spreadsheet here</span>
                <span className="text-xs text-[#71717A]">or click to choose · .csv, .xls, .xlsx</span>
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
          ) : null}

          {phase === "review" ? (
            <>
              {parseError ? (
                <p className="mb-3 text-sm text-red-700">{parseError}</p>
              ) : null}

              {rows.length > 0 ? (
                <>
                  {missingCellCount > 0 ? (
                    <div
                      className="mb-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-950"
                      role="status"
                    >
                      <span className="font-semibold tabular-nums">{missingCellCount}</span>{" "}
                      {missingCellCount === 1 ? "field needs" : "fields need"} to be fixed (red cells) before you can
                      import.
                    </div>
                  ) : null}
                  <p className="mb-2 text-xs text-[#71717A]">
                    USD is treated as cash. Red cells need a value—click <strong className="text-[#09090B]">Edit</strong>,
                    fix the row, then <strong className="text-[#09090B]">Confirm</strong> (check).{" "}
                    <strong className="text-[#09090B]">Add</strong> imports when every row is valid and you are not
                    editing a row.
                  </p>
              <div className="max-h-[min(52vh,420px)] overflow-auto rounded-lg border border-[#E4E4E7]">
                <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-[1] bg-[#F4F4F5] text-[#71717A]">
                    <tr>
                      <th className="border-b border-[#E4E4E7] px-2 py-2 font-medium">Asset</th>
                      <th className="border-b border-[#E4E4E7] px-2 py-2 font-medium">Operation</th>
                      <th className="border-b border-[#E4E4E7] px-2 py-2 font-medium">Date</th>
                      <th className="border-b border-[#E4E4E7] px-2 py-2 font-medium">Price</th>
                      <th className="border-b border-[#E4E4E7] px-2 py-2 font-medium">Shares</th>
                      <th className="border-b border-[#E4E4E7] px-2 py-2 font-medium">Fee</th>
                      <th className="border-b border-[#E4E4E7] px-2 py-2 font-medium">Total</th>
                      <th className="border-b border-[#E4E4E7] px-2 py-2 font-medium w-20"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const edit = editingId === r.id;
                      return (
                        <tr key={r.id} className="border-b border-[#E4E4E7]">
                          <td className={cellClass(r, "asset")}>
                            {edit ? (
                              <input
                                value={r.asset}
                                onChange={(e) => updateRow(r.id, { asset: e.target.value })}
                                className="w-full min-w-[80px] rounded border border-[#E4E4E7] bg-white px-1.5 py-1 text-xs"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(r.id)}
                                className={cn("w-full text-left font-medium text-[#09090B]", r.missing.includes("asset") && "min-h-[28px]")}
                              >
                                {r.asset || "—"}
                              </button>
                            )}
                          </td>
                          <td className={cellClass(r, "operation")}>
                            {edit ? (
                              <select
                                value={r.operation ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateRow(r.id, {
                                    operation: v === "" ? null : (v as ImportOperationLabel),
                                  });
                                }}
                                className="w-full max-w-[min(100%,9.5rem)] rounded border border-[#E4E4E7] bg-white px-1 py-1 text-xs"
                              >
                                <option value="">—</option>
                                {OPS.map((op) => (
                                  <option key={op} value={op}>
                                    {op}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button type="button" onClick={() => setEditingId(r.id)} className="w-full text-left">
                                <span
                                  className={cn(
                                    "font-medium",
                                    r.operation?.includes("Cash") && r.operation?.includes("In") && "text-emerald-700",
                                    r.operation?.includes("Cash") && r.operation?.includes("Out") && "text-red-700",
                                    r.operation === "Other income" && "text-emerald-700",
                                    r.operation === "Other expense" && "text-red-700",
                                    r.operation === "Buy" && "text-emerald-700",
                                    r.operation === "Sell" && "text-red-700",
                                  )}
                                >
                                  {r.operation ?? "—"}
                                </span>
                              </button>
                            )}
                          </td>
                          <td className={cellClass(r, "date")}>
                            {edit ? (
                              <input
                                type="date"
                                value={r.dateYmd ?? ""}
                                onChange={(e) => updateRow(r.id, { dateYmd: e.target.value || null })}
                                className="w-full rounded border border-[#E4E4E7] bg-white px-1 py-1 text-xs"
                              />
                            ) : (
                              <button type="button" onClick={() => setEditingId(r.id)} className="w-full text-left tabular-nums">
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
                          </td>
                          <td className={cellClass(r, "price")}>
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.price != null ? String(r.price) : ""}
                                onChange={(e) =>
                                  updateRow(r.id, { price: parseNumberLoose(e.target.value) })
                                }
                                className="w-full rounded border border-[#E4E4E7] bg-white px-1 py-1 text-xs tabular-nums"
                              />
                            ) : (
                              <button type="button" onClick={() => setEditingId(r.id)} className="w-full text-left tabular-nums">
                                {isCashAssetSymbol(r.asset) ? "—" : r.price != null ? formatPortfolioUsdPerUnit(r.price) : "—"}
                              </button>
                            )}
                          </td>
                          <td className={cellClass(r, "shares")}>
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.shares != null ? String(r.shares) : ""}
                                onChange={(e) =>
                                  updateRow(r.id, { shares: parseNumberLoose(e.target.value) })
                                }
                                className="w-full rounded border border-[#E4E4E7] bg-white px-1 py-1 text-xs tabular-nums"
                              />
                            ) : (
                              <button type="button" onClick={() => setEditingId(r.id)} className="w-full text-left tabular-nums">
                                {r.shares != null ? r.shares.toLocaleString("en-US") : "—"}
                              </button>
                            )}
                          </td>
                          <td className={cellClass(r, "fee")}>
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.fee != null && r.fee > 0 ? String(r.fee) : ""}
                                onChange={(e) =>
                                  updateRow(r.id, { fee: parseNumberLoose(e.target.value) ?? 0 })
                                }
                                className="w-full rounded border border-[#E4E4E7] bg-white px-1 py-1 text-xs tabular-nums"
                              />
                            ) : (
                              <button type="button" onClick={() => setEditingId(r.id)} className="w-full text-left tabular-nums">
                                {(r.fee ?? 0) > 0 ? usd.format(r.fee ?? 0) : "—"}
                              </button>
                            )}
                          </td>
                          <td className={cellClass(r, "total")}>
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.sum != null ? String(r.sum) : ""}
                                onChange={(e) =>
                                  updateRow(r.id, { sum: parseNumberLoose(e.target.value) })
                                }
                                className="w-full rounded border border-[#E4E4E7] bg-white px-1 py-1 text-xs tabular-nums"
                              />
                            ) : (
                              <button type="button" onClick={() => setEditingId(r.id)} className="w-full text-left">
                                {r.sum != null ? (
                                  <span
                                    className={cn(
                                      "tabular-nums font-medium",
                                      r.sum > 0 ? "text-emerald-700" : r.sum < 0 ? "text-red-700" : "text-[#09090B]",
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
                          </td>
                          <td className="px-1 py-1 align-middle">
                            <div className="flex items-center justify-end gap-0.5">
                              {edit ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#09090B] text-white hover:bg-[#27272A]"
                                  aria-label="Confirm changes"
                                >
                                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(r.id)}
                                    className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#71717A] hover:bg-[#F4F4F5]"
                                    aria-label="Edit row"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeRow(r.id)}
                                    className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#71717A] hover:bg-red-50 hover:text-red-700"
                                    aria-label="Remove row"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#71717A]">Ready to import</p>
                <ul className="mt-2 space-y-1.5 text-sm text-[#09090B]">
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
                  <li className="flex items-center justify-between gap-4 border-t border-[#E4E4E7] pt-2.5 font-semibold">
                    <span>Total transactions</span>
                    <span className="tabular-nums">{importBreakdown.total}</span>
                  </li>
                </ul>
              </div>
                </>
              ) : null}

              {commitError ? (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {commitError}
                </p>
              ) : null}

              {!hasPortfolio ? (
                <p className="mt-3 text-sm text-amber-800">Select a portfolio in the header first.</p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          {phase === "success" ? (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-9 w-full items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={cn(
                  "flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors",
                  submitting ? "cursor-not-allowed opacity-50" : "hover:bg-[#EBEBEB]",
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!hasPortfolio || !canImport || submitting}
                onClick={() => void handleAdd()}
                className={cn(
                  "flex min-h-9 flex-1 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-colors",
                  hasPortfolio && canImport && !submitting
                    ? "bg-[#09090B] hover:bg-[#27272A]"
                    : "cursor-not-allowed bg-[#A1A1AA] opacity-50",
                )}
              >
                {submitting ? "Adding…" : "Add"}
              </button>
            </>
          )}
        </div>
      </div>
      </div>

      {showAddingOverlay ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          aria-hidden={false}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            aria-labelledby={addingStatusId}
            aria-describedby={`${addingStatusId}-desc`}
            className="w-full max-w-[360px] rounded-xl border border-[#E4E4E7] bg-white px-8 py-10 text-center shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.12)]"
          >
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#09090B]" strokeWidth={1.75} aria-hidden />
            <p id={addingStatusId} className="mt-5 text-lg font-semibold tracking-tight text-[#09090B]">
              Adding
            </p>
            <p id={`${addingStatusId}-desc`} className="mt-2 text-sm leading-relaxed text-[#71717A]">
              Applying your transactions and fetching market prices. Please wait—this can take a little while if you
              imported many rows.
            </p>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
