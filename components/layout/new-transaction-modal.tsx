"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay } from "date-fns";
import type { CompanyPick } from "@/components/charting/company-picker";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { SpinnerLabel } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ClearableInput } from "@/components/layout/clearable-input";
import { UsdMoneyClearableInput } from "@/components/layout/usd-money-clearable-input";
import { TransactionCompanyField } from "@/components/layout/transaction-company-field";
import { TransactionDateField } from "@/components/layout/transaction-date-field";
import {
  TransactionIncomeOperationSelect,
  type IncomeOperation,
} from "@/components/layout/transaction-income-operation-select";
import {
  TransactionExpenseOperationSelect,
  type ExpenseOperation,
} from "@/components/layout/transaction-expense-operation-select";
import {
  TransactionOperationField,
  type Operation,
} from "@/components/layout/transaction-operation-field";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { newHoldingId, newTransactionRowId, type PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { SegmentedControl } from "@/components/design-system";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { customPortfolioSymbolFromName } from "@/lib/portfolio/custom-asset-symbol";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { fetchLiveMarketPriceClient, fetchPriceOnDateClient } from "@/lib/portfolio/client-symbol-quotes";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { portfolioSymbolMatchesAssetRoute } from "@/lib/portfolio/portfolio-asset-route-match";
import { splitRatioFromTransaction } from "@/lib/portfolio/split-ratio-from-transaction";
import { lotUnrealizedPnL, mergeBuyIntoPosition } from "@/lib/portfolio/holding-position";
import { toastTransactionAdded } from "@/lib/portfolio/transaction-added-toast";
import { refreshHoldingMarketPrices, replayTradeTransactionsToHoldings } from "@/lib/portfolio/rebuild-holdings-from-trades";
import { parseUsdStyleNumber } from "@/lib/portfolio/amount-input-format";

const TABS = ["Trades", "Incomes", "Expenses"] as const;

const TRADE_ASSET_TABS = [
  { value: "listed" as const, label: "Company / Ticker" },
  { value: "custom" as const, label: "Custom Asset" },
] as const;
type TradeAssetSource = (typeof TRADE_ASSET_TABS)[number]["value"];

function formatPriceInputFromApi(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(4).replace(/\.?0+$/, "") || "0";
}

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdBalance = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSharesHint(n: number, symbol: string): string {
  const qty = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(n);
  // Crypto uses unit tickers (BTC, ETH, ...); equities read better as "shares".
  const base = cryptoRouteBase(symbol);
  if (base !== symbol.trim().toUpperCase()) return `${qty} ${base}`;
  if (symbol.trim().toUpperCase() === "USD") return `${qty} USD`;
  return `${qty} shares`;
}

/** Ledger sums can be ±ε; round to cents so ~0 shows as $0.00 (not red / minus). */
function roundUsdForDisplay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(n * 100);
  if (cents === 0) return 0;
  return cents / 100;
}

type Props = {
  open: boolean;
  /** When provided, pre-selects the ticker/company in the Trades tab on open. */
  presetCompany?: CompanyPick | null;
  onClose: () => void;
};

/**
 * New Transaction — matches Figma Web-App-Design node 8615:33802 (New Transaction modal).
 */
export function NewTransactionModal({ open, presetCompany = null, onClose }: Props) {
  const titleId = useId();
  const {
    portfolios,
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    addHolding,
    setPortfolioHoldings,
    addTransaction,
    setPortfolioTransactions,
  } = usePortfolioWorkspace();

  const [transactionTab, setTransactionTab] = useState<(typeof TABS)[number]>("Trades");
  const [operation, setOperation] = useState<Operation>("Buy");
  const [selectedCompany, setSelectedCompany] = useState<CompanyPick | null>(null);
  const [transactionDate, setTransactionDate] = useState<Date>(() => startOfDay(new Date()));
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [incomeOperation, setIncomeOperation] = useState<IncomeOperation>("Dividend");
  const [incomeTotalReceived, setIncomeTotalReceived] = useState("");
  const [incomePerShare, setIncomePerShare] = useState("");
  const [incomeFees, setIncomeFees] = useState("");
  const [expenseOperation, setExpenseOperation] = useState<ExpenseOperation>("Other expense");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tradeAssetSource, setTradeAssetSource] = useState<TradeAssetSource>("listed");
  const [customAssetName, setCustomAssetName] = useState("");

  const selectedHoldingShares = useMemo(() => {
    if (selectedPortfolioId == null) return null;
    if (tradeAssetSource !== "listed") return null;
    const sym = selectedCompany?.symbol?.trim();
    if (!sym) return null;
    const key = cryptoRouteBase(sym).toUpperCase();
    const list = holdingsByPortfolioId[selectedPortfolioId] ?? [];
    for (const h of list) {
      const hKey = cryptoRouteBase(h.symbol).toUpperCase();
      if (hKey === key) return h.shares;
    }
    return 0;
  }, [holdingsByPortfolioId, selectedCompany?.symbol, selectedPortfolioId, tradeAssetSource]);

  /** Mark-to-market of owned shares using the Price field (Sell tip). */
  const selectedHoldingWorthUsd = useMemo(() => {
    if (selectedHoldingShares == null) return null;
    if (!price.trim()) return null;
    const px = parseUsdStyleNumber(price);
    if (!(px >= 0) || !Number.isFinite(selectedHoldingShares)) return null;
    return roundUsdForDisplay(selectedHoldingShares * px);
  }, [price, selectedHoldingShares]);

  const transactionTotal = useMemo(() => {
    const line = parseUsdStyleNumber(shares) * parseUsdStyleNumber(price);
    const fee = parseUsdStyleNumber(fees);
    if (operation === "Sell") return Math.max(0, line - fee);
    return line + fee;
  }, [shares, price, fees, operation]);

  /** Same net cash as Portfolio → Cash tab (sum of ledger `sum`). */
  const currentCashBalanceUsd = useMemo(() => {
    if (selectedPortfolioId == null) return 0;
    const txs = transactionsByPortfolioId[selectedPortfolioId] ?? [];
    return txs.reduce((acc, t) => acc + t.sum, 0);
  }, [selectedPortfolioId, transactionsByPortfolioId]);

  const priceFetchGen = useRef(0);
  const selectedPortfolioIdRef = useRef<string | null>(null);
  const transactionsByPortfolioIdRef = useRef(transactionsByPortfolioId);

  useEffect(() => {
    selectedPortfolioIdRef.current = selectedPortfolioId;
    transactionsByPortfolioIdRef.current = transactionsByPortfolioId;
  }, [selectedPortfolioId, transactionsByPortfolioId]);

  useEffect(() => {
    if (!open || transactionTab !== "Trades" || tradeAssetSource !== "listed") return;
    const sym = selectedCompany?.symbol?.trim();
    if (!sym) {
      setPrice("");
      return;
    }

    const ymd = format(transactionDate, "yyyy-MM-dd");
    const gen = ++priceFetchGen.current;

    void (async () => {
      const p = await fetchPriceOnDateClient(sym, ymd);
      if (gen !== priceFetchGen.current) return;
      if (p != null) {
        const pid = selectedPortfolioIdRef.current;
        const txs = pid ? transactionsByPortfolioIdRef.current[pid] ?? [] : [];
        let splitFactor = 1;
        for (const t of txs) {
          const ratio = splitRatioFromTransaction(t);
          if (ratio == null) continue;
          if (!portfolioSymbolMatchesAssetRoute({ holdingSymbol: t.symbol, routeKey: sym, kind: "stock" })) continue;
          if (t.date <= ymd) continue;
          splitFactor *= ratio;
        }
        const adj = splitFactor > 1 && Number.isFinite(splitFactor) ? p / splitFactor : p;
        setPrice(formatPriceInputFromApi(adj));
      } else {
        setPrice("");
      }
    })();
  }, [open, transactionTab, tradeAssetSource, selectedCompany?.symbol, transactionDate]);

  useEffect(() => {
    if (!open) return;
    setTransactionTab("Trades");
    setOperation("Buy");
    setSelectedCompany(presetCompany);
    setTransactionDate(startOfDay(new Date()));
    setShares("");
    setPrice("");
    setFees("");
    setIncomeOperation("Dividend");
    setIncomeTotalReceived("");
    setIncomePerShare("");
    setIncomeFees("");
    setExpenseOperation("Other expense");
    setExpenseAmount("");
    setSubmitting(false);
    setTradeAssetSource("listed");
    setCustomAssetName("");
  }, [open, presetCompany]);

  const hasSelectedPortfolio =
    selectedPortfolioId != null &&
    portfolios.some((p) => p.id === selectedPortfolioId);

  const incomeTotalNum = useMemo(() => parseUsdStyleNumber(incomeTotalReceived), [incomeTotalReceived]);
  /** Second field: share count; gross = per-share amount × shares (e.g. 50 × 2 = 100). */
  const incomeShareCountNum = useMemo(() => parseUsdStyleNumber(incomePerShare), [incomePerShare]);
  const incomeFeeNum = useMemo(() => parseUsdStyleNumber(incomeFees), [incomeFees]);
  const incomeGrossUsd = useMemo(() => {
    if (incomeTotalNum <= 0 || incomeShareCountNum <= 0) return 0;
    return incomeTotalNum * incomeShareCountNum;
  }, [incomeTotalNum, incomeShareCountNum]);
  const incomeNetUsd = useMemo(
    () => Math.max(0, incomeGrossUsd - incomeFeeNum),
    [incomeGrossUsd, incomeFeeNum],
  );

  const expenseAmountNum = useMemo(() => parseUsdStyleNumber(expenseAmount), [expenseAmount]);

  const canAdd = useMemo(() => {
    if (!hasSelectedPortfolio) return false;
    if (transactionTab === "Trades") {
      const sh = parseUsdStyleNumber(shares);
      const pr = parseUsdStyleNumber(price);
      if (sh <= 0 || pr <= 0) return false;
      if (operation === "Sell") {
        if (tradeAssetSource !== "listed") return false;
        if (!selectedCompany?.symbol?.trim()) return false;
        if (selectedHoldingShares == null) return false;
        return sh <= selectedHoldingShares + 1e-9;
      }
      if (tradeAssetSource === "listed") return Boolean(selectedCompany?.symbol?.trim());
      return customAssetName.trim().length > 0;
    }
    if (transactionTab === "Incomes") {
      if (!selectedCompany?.symbol?.trim()) return false;
      return (
        incomeTotalNum > 0 &&
        incomeShareCountNum > 0 &&
        incomeFeeNum >= 0 &&
        incomeNetUsd > 0
      );
    }
    if (transactionTab === "Expenses") {
      if (!selectedCompany?.symbol?.trim()) return false;
      return expenseAmountNum > 0;
    }
    return false;
  }, [
    transactionTab,
    hasSelectedPortfolio,
    selectedCompany?.symbol,
    tradeAssetSource,
    customAssetName,
    operation,
    shares,
    price,
    incomeTotalNum,
    incomeShareCountNum,
    incomeFeeNum,
    incomeNetUsd,
    expenseAmountNum,
    selectedHoldingShares,
  ]);

  const balanceAfterIncomeUsd = useMemo(
    () => roundUsdForDisplay(currentCashBalanceUsd + incomeNetUsd),
    [currentCashBalanceUsd, incomeNetUsd],
  );

  const balanceAfterExpenseUsd = useMemo(
    () => roundUsdForDisplay(currentCashBalanceUsd - expenseAmountNum),
    [currentCashBalanceUsd, expenseAmountNum],
  );

  const currentCashBalanceDisplayUsd = useMemo(
    () => roundUsdForDisplay(currentCashBalanceUsd),
    [currentCashBalanceUsd],
  );

  const handleAddIncome = useCallback(() => {
    if (transactionTab !== "Incomes" || !canAdd || !selectedPortfolioId || !selectedCompany) return;
    const perShareAmt = incomeTotalNum;
    const shareCt = incomeShareCountNum;
    const gross = perShareAmt * shareCt;
    const fee = incomeFeeNum;
    const net = gross - fee;
    if (gross <= 0 || net <= 0) return;

    const sharesLedger = shareCt;
    const priceLedger = perShareAmt;

    setSubmitting(true);
    try {
      const sym = selectedCompany.symbol.trim().toUpperCase();
      const resolvedLogo = displayLogoUrlForPortfolioSymbol(sym).trim();
      const logoUrl = resolvedLogo ? resolvedLogo : null;
      const dateStr = format(transactionDate, "yyyy-MM-dd");
      const opLabel = incomeOperation === "Dividend" ? "Dividend" : "Other income";

      addTransaction(selectedPortfolioId, {
        id: newTransactionRowId(),
        portfolioId: selectedPortfolioId,
        kind: "income",
        operation: opLabel,
        symbol: sym,
        name: selectedCompany.name,
        logoUrl,
        date: dateStr,
        shares: sharesLedger,
        price: priceLedger,
        fee,
        sum: net,
        profitPct: null,
        profitUsd: null,
      });
      toastTransactionAdded(`Income added for ${selectedCompany.name} (${sym}).`, transactionDate);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    addTransaction,
    canAdd,
    incomeFeeNum,
    incomeOperation,
    incomeShareCountNum,
    incomeTotalNum,
    onClose,
    selectedCompany,
    selectedPortfolioId,
    transactionDate,
    transactionTab,
  ]);

  const handleAddExpense = useCallback(() => {
    if (transactionTab !== "Expenses" || !canAdd || !selectedPortfolioId || !selectedCompany) return;
    const amt = expenseAmountNum;
    if (amt <= 0) return;

    setSubmitting(true);
    try {
      const sym = selectedCompany.symbol.trim().toUpperCase();
      const resolvedLogo = displayLogoUrlForPortfolioSymbol(sym).trim();
      const logoUrl = resolvedLogo ? resolvedLogo : null;
      const dateStr = format(transactionDate, "yyyy-MM-dd");

      addTransaction(selectedPortfolioId, {
        id: newTransactionRowId(),
        portfolioId: selectedPortfolioId,
        kind: "expense",
        operation: expenseOperation,
        symbol: sym,
        name: selectedCompany.name,
        logoUrl,
        date: dateStr,
        shares: amt,
        price: 1,
        fee: 0,
        sum: -amt,
        profitPct: null,
        profitUsd: null,
      });
      toastTransactionAdded(`Expense recorded for ${selectedCompany.name} (${sym}).`, transactionDate);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    addTransaction,
    canAdd,
    expenseAmountNum,
    expenseOperation,
    onClose,
    selectedCompany,
    selectedPortfolioId,
    transactionDate,
    transactionTab,
  ]);

  const handleAdd = useCallback(async () => {
    if (transactionTab === "Incomes") {
      handleAddIncome();
      return;
    }
    if (transactionTab === "Expenses") {
      handleAddExpense();
      return;
    }
    if (transactionTab !== "Trades") return;
    if (!canAdd || !selectedPortfolioId) return;
    const sh = parseUsdStyleNumber(shares);
    const pr = parseUsdStyleNumber(price);
    const fee = parseUsdStyleNumber(fees);
    if (sh <= 0 || pr <= 0) return;

    let symUpper: string;
    let assetName: string;
    let logoUrl: string | null;
    let marketPrice: number;

    // Flip the button label to "Adding" immediately (before any quote fetch).
    setSubmitting(true);
    if (tradeAssetSource === "custom") {
      const nameRaw = customAssetName.trim();
      if (!nameRaw) {
        setSubmitting(false);
        return;
      }
      symUpper = customPortfolioSymbolFromName(nameRaw).toUpperCase();
      assetName = nameRaw;
      logoUrl = null;
      marketPrice = pr;
    } else {
      if (!selectedCompany?.symbol?.trim()) {
        setSubmitting(false);
        return;
      }
      const sym = selectedCompany.symbol.trim();
      symUpper = sym.toUpperCase();
      assetName = selectedCompany.name;
      const live = await fetchLiveMarketPriceClient(sym);
      marketPrice = live ?? pr;
      const resolvedLogo = displayLogoUrlForPortfolioSymbol(sym).trim();
      logoUrl = resolvedLogo ? resolvedLogo : null;
    }

    try {
      const gross = sh * pr;
      const dateStr = format(transactionDate, "yyyy-MM-dd");

      const existing =
        holdingsByPortfolioId[selectedPortfolioId]?.find(
          (h) => h.symbol.toUpperCase() === symUpper,
        ) ?? null;
      const positionId = existing?.id ?? newHoldingId();

      let holdingIdForTx = positionId;
      let profitUsd: number | null = null;
      let profitPct: number | null = null;

      if (operation === "Sell") {
        if (!existing) return;
        const available = existing.shares;
        if (!Number.isFinite(available) || available <= 0) return;
        if (sh - available > 1e-9) return;

        const costRemoved = (sh / available) * existing.costBasis;
        const realized = gross - fee - costRemoved;
        profitUsd = Number.isFinite(realized) ? realized : null;
        profitPct =
          costRemoved > 0 && Number.isFinite(realized) ? (realized / costRemoved) * 100 : null;

        // Holdings are rebuilt from the ledger right after we append the transaction (single source of truth).
      } else {
        const merged = mergeBuyIntoPosition(existing, {
          id: positionId,
          symbol: symUpper,
          name: assetName,
          logoUrl,
          shares: sh,
          price: pr,
          fee,
          marketPrice,
        });

        const pnl = lotUnrealizedPnL({
          shares: sh,
          price: pr,
          fee,
          marketPrice,
        });
        profitUsd = pnl.profitUsd;
        profitPct = pnl.profitPct;
        holdingIdForTx = merged.id;

        // Holdings are rebuilt from the ledger right after we append the transaction (single source of truth).
      }

      const nextTx: PortfolioTransaction = {
        id: newTransactionRowId(),
        portfolioId: selectedPortfolioId,
        kind: "trade",
        operation,
        symbol: symUpper,
        name: assetName,
        logoUrl,
        date: dateStr,
        shares: sh,
        price: pr,
        fee,
        sum: operation === "Sell" ? gross - fee : -(gross + fee),
        profitPct,
        profitUsd,
        holdingId: holdingIdForTx,
      };

      const prevTx = transactionsByPortfolioId[selectedPortfolioId] ?? [];
      const nextTxList = [...prevTx, nextTx];
      setPortfolioTransactions(selectedPortfolioId, nextTxList);

      // Rebuild holdings so sell transactions correctly reduce remaining quantity/cost basis,
      // ensuring unrealized P&L always uses remaining shares only.
      const rebuilt = replayTradeTransactionsToHoldings(nextTxList);
      const quoted = await refreshHoldingMarketPrices(rebuilt);
      setPortfolioHoldings(selectedPortfolioId, quoted);

      toastTransactionAdded(`Transaction added for ${assetName} (${symUpper}).`, transactionDate);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    addHolding,
    addTransaction,
    canAdd,
    customAssetName,
    fees,
    holdingsByPortfolioId,
    onClose,
    operation,
    price,
    selectedCompany,
    selectedPortfolioId,
    setPortfolioHoldings,
    setPortfolioTransactions,
    shares,
    tradeAssetSource,
    transactionDate,
    transactionTab,
    handleAddIncome,
    handleAddExpense,
    transactionsByPortfolioId,
  ]);

  if (!open) return null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={100}>
      <AppModalShell
        titleId={titleId}
        title="New Transaction"
        onClose={onClose}
        bodyClassName="px-5 pb-5 pt-5"
        footer={
          <AppModalFooter>
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canAdd || submitting}
              onClick={() => void handleAdd()}
              className={appModalPrimaryButtonClass(canAdd && !submitting)}
            >
              {transactionTab === "Trades" ? (
                submitting ? (
                  <SpinnerLabel>{operation === "Sell" ? "Selling..." : "Adding"}</SpinnerLabel>
                ) : (
                  operation === "Sell" ? "Sell" : "Add"
                )
              ) : submitting ? (
                <SpinnerLabel>Adding</SpinnerLabel>
              ) : (
                "Add"
              )}
            </button>
          </AppModalFooter>
        }
      >
          <div className="flex flex-col gap-5">
            <Field label="Portfolio">
              <TransactionPortfolioField />
            </Field>

            <TransactionTypeTabs active={transactionTab} onChange={setTransactionTab} />

            {transactionTab === "Trades" ? (
              <>
                <SegmentedControl
                  fullWidth
                  aria-label="Asset source"
                  options={TRADE_ASSET_TABS}
                  value={tradeAssetSource}
                  onChange={(v) => {
                    setTradeAssetSource(v);
                    if (v === "custom") {
                      setSelectedCompany(null);
                      setPrice("");
                    } else {
                      setCustomAssetName("");
                    }
                  }}
                />

                {tradeAssetSource === "listed" ? (
                  <Field label="Ticker/Company">
                    <TransactionCompanyField value={selectedCompany} onChange={setSelectedCompany} />
                  </Field>
                ) : (
                  <Field label="Asset name">
                    <ClearableInput
                      type="text"
                      value={customAssetName}
                      onChange={setCustomAssetName}
                      placeholder="e.g. Private loan, Collectible"
                      clearLabel="Clear name"
                    />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Operation">
                    <TransactionOperationField value={operation} onChange={setOperation} />
                  </Field>
                  <Field label="Date">
                    <TransactionDateField date={transactionDate} onDateChange={setTransactionDate} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Shares">
                    <ClearableInput
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={shares}
                      onChange={setShares}
                      placeholder="Shares"
                      clearLabel="Clear shares"
                    />
                    {operation === "Sell" && selectedHoldingShares != null ? (
                      <div className="mt-1 text-[12px] leading-4 text-[#71717A]">
                        You have{" "}
                        <span className="font-medium text-[#0F0F0F]">
                          {formatSharesHint(selectedHoldingShares, selectedCompany?.symbol ?? "")}
                        </span>
                        {selectedHoldingWorthUsd != null ? (
                          <>
                            {" "}
                            worth of{" "}
                            <span className="font-medium tabular-nums text-[#0F0F0F]">
                              {usdBalance.format(selectedHoldingWorthUsd)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </Field>
                  <Field label="Price">
                    <ClearableInput
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={price}
                      onChange={setPrice}
                      placeholder="Price"
                      clearLabel="Clear price"
                    />
                  </Field>
                </div>

                <Field label="Fees">
                  <UsdMoneyClearableInput
                    value={fees}
                    onChange={setFees}
                    placeholder="Fee"
                    clearLabel="Clear fees"
                  />
                </Field>
              </>
            ) : null}

            {transactionTab === "Incomes" ? (
              <>
                <Field label="Ticker/Company">
                  <TransactionCompanyField value={selectedCompany} onChange={setSelectedCompany} />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Operation">
                    <TransactionIncomeOperationSelect value={incomeOperation} onChange={setIncomeOperation} />
                  </Field>
                  <Field label="Date">
                    <TransactionDateField date={transactionDate} onDateChange={setTransactionDate} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Total received">
                    <UsdMoneyClearableInput
                      value={incomeTotalReceived}
                      onChange={setIncomeTotalReceived}
                      placeholder="0.00"
                      clearLabel="Clear amount"
                    />
                  </Field>
                  <Field label="Per share">
                    <UsdMoneyClearableInput
                      value={incomePerShare}
                      onChange={setIncomePerShare}
                      placeholder="0.00"
                      clearLabel="Clear per share"
                    />
                  </Field>
                </div>

                <Field label="Fees">
                  <UsdMoneyClearableInput
                    value={incomeFees}
                    onChange={setIncomeFees}
                    placeholder="Fee"
                    clearLabel="Clear fees"
                  />
                </Field>
              </>
            ) : null}

            {transactionTab === "Expenses" ? (
              <>
                <Field label="Operation">
                  <TransactionExpenseOperationSelect value={expenseOperation} onChange={setExpenseOperation} />
                </Field>

                <Field label="Ticker/Company">
                  <TransactionCompanyField value={selectedCompany} onChange={setSelectedCompany} />
                </Field>

                <Field label="Date">
                  <TransactionDateField date={transactionDate} onDateChange={setTransactionDate} />
                </Field>

                <Field label="Amount">
                  <UsdMoneyClearableInput
                    value={expenseAmount}
                    onChange={setExpenseAmount}
                    placeholder="Amount"
                    clearLabel="Clear amount"
                  />
                </Field>
              </>
            ) : null}

            <div className="pt-1">
              <div className="flex items-center gap-1 border-b border-dashed border-[#E4E4E7] py-2.5 text-sm">
                <span className="flex-1 font-medium text-[#71717A]">Current cash balance</span>
                <span
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    currentCashBalanceDisplayUsd < 0
                      ? "text-[#DC2626]"
                      : currentCashBalanceDisplayUsd > 0
                        ? "text-[#16A34A]"
                        : "text-[#0F0F0F]",
                  )}
                >
                  {usdBalance.format(currentCashBalanceDisplayUsd)}
                </span>
              </div>
              {transactionTab === "Trades" ? (
                <div className="flex items-center gap-1 py-2.5 text-sm">
                  <span className="flex-1 font-medium text-[#71717A]">Total</span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#0F0F0F]">
                    {usdFormatter.format(transactionTotal)}
                  </span>
                </div>
              ) : null}
              {transactionTab === "Incomes" && incomeGrossUsd > 0 && incomeNetUsd > 0 ? (
                <>
                  <div className="flex items-center gap-1 border-b border-dashed border-[#E4E4E7] py-2.5 text-sm">
                    <span className="flex-1 font-medium text-[#71717A]">Net to cash</span>
                    <span className="shrink-0 font-semibold tabular-nums text-[#16A34A]">
                      {usdFormatter.format(incomeNetUsd)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 py-2.5 text-sm">
                    <span className="flex-1 font-medium text-[#71717A]">Balance after</span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        balanceAfterIncomeUsd < 0
                          ? "text-[#DC2626]"
                          : balanceAfterIncomeUsd > 0
                            ? "text-[#16A34A]"
                            : "text-[#0F0F0F]",
                      )}
                    >
                      {usdBalance.format(balanceAfterIncomeUsd)}
                    </span>
                  </div>
                </>
              ) : null}
              {transactionTab === "Expenses" && expenseAmountNum > 0 ? (
                <>
                  <div className="flex items-center gap-1 border-b border-dashed border-[#E4E4E7] py-2.5 text-sm">
                    <span className="flex-1 font-medium text-[#71717A]">Cash out</span>
                    <span className="shrink-0 font-semibold tabular-nums text-[#DC2626]">
                      {usdFormatter.format(-expenseAmountNum)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 py-2.5 text-sm">
                    <span className="flex-1 font-medium text-[#71717A]">Balance after</span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        balanceAfterExpenseUsd < 0
                          ? "text-[#DC2626]"
                          : balanceAfterExpenseUsd > 0
                            ? "text-[#16A34A]"
                            : "text-[#0F0F0F]",
                      )}
                    >
                      {usdBalance.format(balanceAfterExpenseUsd)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#0F0F0F]">{label}</span>
      {children}
    </div>
  );
}

const TRANSACTION_TAB_MOTION_MS = 280;
const TRANSACTION_TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

function TransactionTypeTabs({
  active,
  onChange,
}: {
  active: (typeof TABS)[number];
  onChange: (tab: (typeof TABS)[number]) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<(typeof TABS)[number], HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [indicatorMotionEnabled, setIndicatorMotionEnabled] = useState(false);
  const hasPositionedOnceRef = useRef(false);

  const measureIndicator = useCallback(() => {
    const nav = navRef.current;
    const btn = tabRefs.current.get(active);
    if (!nav || !btn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const width = Math.round(btnRect.width);
    if (width <= 0) return;
    const left = Math.round(btnRect.left - navRect.left + nav.scrollLeft);
    setIndicator((prev) => {
      if (prev.left === left && prev.width === width) return prev;
      return { left, width };
    });
  }, [active]);

  useLayoutEffect(() => {
    measureIndicator();
    if (hasPositionedOnceRef.current) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measureIndicator();
      raf2 = requestAnimationFrame(() => {
        if (hasPositionedOnceRef.current) return;
        const btn = tabRefs.current.get(active);
        if (!btn || btn.getBoundingClientRect().width <= 0) return;
        hasPositionedOnceRef.current = true;
        setIndicatorMotionEnabled(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [measureIndicator, active]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(nav);
    window.addEventListener("resize", measureIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator]);

  return (
    <div className="w-full border-b border-[#E4E4E7]">
      <nav ref={navRef} className="relative flex w-full flex-nowrap items-start gap-5 pb-px" aria-label="Transaction type">
        {TABS.map((tab) => {
          const isOn = tab === active;
          return (
            <button
              key={tab}
              ref={(el) => {
                if (el) tabRefs.current.set(tab, el);
                else tabRefs.current.delete(tab);
              }}
              type="button"
              onClick={() => onChange(tab)}
              className={cn(
                "-mb-px shrink-0 cursor-pointer border-b-2 border-transparent py-2 text-sm font-medium leading-6 transition-[color,opacity] duration-100 hover:opacity-100",
                isOn ? "font-semibold text-[#0F0F0F] opacity-100" : "text-[#0F0F0F] opacity-80",
              )}
            >
              {tab}
            </button>
          );
        })}
        <span
          className="pointer-events-none absolute bottom-0 z-[1] h-0.5 rounded-full bg-[#0F0F0F] motion-reduce:transition-none"
          style={{
            left: indicator.left,
            width: indicator.width,
            opacity: indicator.width > 0 ? 1 : 0,
            transitionProperty: indicatorMotionEnabled ? "left, width" : "none",
            transitionDuration: indicatorMotionEnabled ? `${TRANSACTION_TAB_MOTION_MS}ms` : "0ms",
            transitionTimingFunction: TRANSACTION_TAB_MOTION_EASE,
          }}
          aria-hidden
        />
      </nav>
    </div>
  );
}

