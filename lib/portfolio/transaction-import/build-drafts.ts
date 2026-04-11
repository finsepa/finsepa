import { detectImportColumns } from "@/lib/portfolio/transaction-import/detect-columns";
import { resolveImportAssetDisplay } from "@/lib/portfolio/transaction-import/import-asset-display";
import { parseDateLoose, parseNumberLoose } from "@/lib/portfolio/transaction-import/parse-cells";
import { parseOperationCell } from "@/lib/portfolio/transaction-import/parse-operation";
import type { ImportFieldKey, ImportedTransactionDraft, ImportOperationLabel } from "@/lib/portfolio/transaction-import/types";

function getCell(row: string[], col: number | undefined): string {
  if (col == null || col < 0 || col >= row.length) return "";
  return row[col] ?? "";
}

function computeLedgerSum(
  op: ImportOperationLabel,
  shares: number,
  price: number,
  fee: number,
  explicitTotal: number | null,
): number | null {
  if (explicitTotal != null && Number.isFinite(explicitTotal)) return explicitTotal;
  const gross = shares * price;
  if (op === "Buy") return -(gross + fee);
  if (op === "Sell") return Math.max(0, gross - fee);
  if (op === "Cash In") return shares - fee;
  if (op === "Cash Out") return -(shares + fee);
  if (op === "Other income") return shares - fee;
  if (op === "Other expense") return -(shares + fee);
  return null;
}

function isCashAsset(assetUpper: string): boolean {
  return assetUpper === "USD" || assetUpper === "CASH" || assetUpper === "US DOLLAR";
}

/**
 * Builds draft rows from raw matrix (row 0 = headers).
 */
export function buildImportedDrafts(matrix: string[][]): ImportedTransactionDraft[] {
  if (matrix.length < 2) return [];
  const headerRow = matrix[0] ?? [];
  const colMap = detectImportColumns(headerRow);
  const drafts: ImportedTransactionDraft[] = [];
  let sourceRow = 2;

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const nonEmpty = row.some((c) => String(c).trim() !== "");
    if (!nonEmpty) {
      sourceRow += 1;
      continue;
    }

    const assetRaw = getCell(row, colMap.asset);
    const rawUpper = assetRaw.trim().toUpperCase().replace(/\s+/g, "");
    const { display, quoteSymbol } = resolveImportAssetDisplay(assetRaw);
    const asset = display;
    const isCash = isCashAsset(rawUpper);

    const opRaw = getCell(row, colMap.operation);
    let operation = parseOperationCell(opRaw, rawUpper);
    if (!operation && !isCash) operation = "Buy";

    const dateYmd = parseDateLoose(getCell(row, colMap.date));
    let price = parseNumberLoose(getCell(row, colMap.price));
    const shares = parseNumberLoose(getCell(row, colMap.shares));
    const fee = Math.max(0, parseNumberLoose(getCell(row, colMap.fee)) ?? 0);
    const explicitTotal = parseNumberLoose(getCell(row, colMap.total));

    if (isCash && (price == null || price <= 0)) price = 1;

    const missing: ImportFieldKey[] = [];
    if (!asset.trim()) missing.push("asset");
    if (!dateYmd) missing.push("date");
    if (isCash && !operation) missing.push("operation");
    if (shares == null || shares <= 0) missing.push("shares");
    if (!isCash && (price == null || price <= 0)) missing.push("price");

    const opFinal: ImportOperationLabel | null = operation;
    let sum: number | null = null;
    if (opFinal && shares != null && shares > 0) {
      const p = isCash ? 1 : price ?? 0;
      if (!isCash && p <= 0) {
        sum = explicitTotal;
      } else {
        sum = computeLedgerSum(opFinal, shares, p, fee, explicitTotal);
      }
    } else {
      sum = explicitTotal;
    }

    if (sum == null && missing.length === 0) missing.push("total");

    const draft: ImportedTransactionDraft = {
      sourceRow,
      asset: asset.trim() || assetRaw.trim(),
      operation: opFinal,
      dateYmd,
      price: isCash ? (price ?? 1) : price,
      shares,
      fee,
      sum,
      missing: [...new Set(missing)],
    };
    if (quoteSymbol) draft.quoteSymbol = quoteSymbol;
    drafts.push(draft);

    sourceRow += 1;
  }

  return drafts;
}
