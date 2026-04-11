"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { format, startOfDay } from "date-fns";
import { X } from "lucide-react";

import type { CompanyPick } from "@/components/charting/company-picker";
import { cn } from "@/lib/utils";
import {
  CashDirectionSelect,
  type CashDirection,
  cashOperationLabel,
  cashSignedAmount,
} from "@/components/layout/cash-direction-select";
import { ClearableInput } from "@/components/layout/clearable-input";
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
import { newHoldingId, newTransactionRowId } from "@/components/portfolio/portfolio-types";
import { SecondaryTabs } from "@/components/ui/secondary-tabs";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { customPortfolioSymbolFromName } from "@/lib/portfolio/custom-asset-symbol";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { fetchLiveMarketPriceClient, fetchPriceOnDateClient } from "@/lib/portfolio/client-symbol-quotes";
import { lotUnrealizedPnL, mergeBuyIntoPosition } from "@/lib/portfolio/holding-position";
import { toastTransactionAdded } from "@/lib/portfolio/transaction-added-toast";

const TABS = ["Trades", "Incomes", "Expenses", "Cash"] as const;

const TRADE_ASSET_TABS = [
  { id: "listed" as const, label: "Company / Ticker" },
  { id: "custom" as const, label: "Custom Asset" },
] as const;
type TradeAssetSource = (typeof TRADE_ASSET_TABS)[number]["id"];

function formatPriceInputFromApi(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(4).replace(/\.?0+$/, "") || "0";
}

function parseAmountField(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdBalance = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Ledger sums can be ±ε; round to cents so ~0 shows as $0.00 (not red / minus). */
function roundUsdForDisplay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(n * 100);
  if (cents === 0) return 0;
  return cents / 100;
}

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * New Transaction — matches Figma Web-App-Design node 8615:33802 (New Transaction modal).
 */
export function NewTransactionModal({ open, onClose }: Props) {
  const titleId = useId();
  const {
    portfolios,
    selectedPortfolioId,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    addHolding,
    addTransaction,
  } = usePortfolioWorkspace();

  const [transactionTab, setTransactionTab] = useState<(typeof TABS)[number]>("Trades");
  const [operation, setOperation] = useState<Operation>("Buy");
  const [selectedCompany, setSelectedCompany] = useState<CompanyPick | null>(null);
  const [transactionDate, setTransactionDate] = useState<Date>(() => startOfDay(new Date()));
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [cashDirection, setCashDirection] = useState<CashDirection>("in");
  const [cashAmount, setCashAmount] = useState("");
  const [incomeOperation, setIncomeOperation] = useState<IncomeOperation>("Dividend");
  const [incomeTotalReceived, setIncomeTotalReceived] = useState("");
  const [incomePerShare, setIncomePerShare] = useState("");
  const [incomeFees, setIncomeFees] = useState("");
  const [expenseOperation, setExpenseOperation] = useState<ExpenseOperation>("Other expense");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tradeAssetSource, setTradeAssetSource] = useState<TradeAssetSource>("listed");
  const [customAssetName, setCustomAssetName] = useState("");

  const transactionTotal = useMemo(() => {
    const line = parseAmountField(shares) * parseAmountField(price);
    return line + parseAmountField(fees);
  }, [shares, price, fees]);

  /** Same net cash as Portfolio → Cash tab (sum of ledger `sum`). */
  const currentCashBalanceUsd = useMemo(() => {
    if (selectedPortfolioId == null) return 0;
    const txs = transactionsByPortfolioId[selectedPortfolioId] ?? [];
    return txs.reduce((acc, t) => acc + t.sum, 0);
  }, [selectedPortfolioId, transactionsByPortfolioId]);

  const priceFetchGen = useRef(0);

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
        setPrice(formatPriceInputFromApi(p));
      } else {
        setPrice("");
      }
    })();
  }, [open, transactionTab, tradeAssetSource, selectedCompany?.symbol, transactionDate]);

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
    setTransactionTab("Trades");
    setOperation("Buy");
    setSelectedCompany(null);
    setTransactionDate(startOfDay(new Date()));
    setShares("");
    setPrice("");
    setFees("");
    setCashDirection("in");
    setCashAmount("");
    setIncomeOperation("Dividend");
    setIncomeTotalReceived("");
    setIncomePerShare("");
    setIncomeFees("");
    setExpenseOperation("Other expense");
    setExpenseAmount("");
    setSubmitting(false);
    setTradeAssetSource("listed");
    setCustomAssetName("");
  }, [open]);

  const hasSelectedPortfolio =
    selectedPortfolioId != null &&
    portfolios.some((p) => p.id === selectedPortfolioId);

  const cashAmountNum = useMemo(() => parseAmountField(cashAmount), [cashAmount]);
  const incomeTotalNum = useMemo(() => parseAmountField(incomeTotalReceived), [incomeTotalReceived]);
  /** Second field: share count; gross = per-share amount × shares (e.g. 50 × 2 = 100). */
  const incomeShareCountNum = useMemo(() => parseAmountField(incomePerShare), [incomePerShare]);
  const incomeFeeNum = useMemo(() => parseAmountField(incomeFees), [incomeFees]);
  const incomeGrossUsd = useMemo(() => {
    if (incomeTotalNum <= 0 || incomeShareCountNum <= 0) return 0;
    return incomeTotalNum * incomeShareCountNum;
  }, [incomeTotalNum, incomeShareCountNum]);
  const incomeNetUsd = useMemo(
    () => Math.max(0, incomeGrossUsd - incomeFeeNum),
    [incomeGrossUsd, incomeFeeNum],
  );

  const expenseAmountNum = useMemo(() => parseAmountField(expenseAmount), [expenseAmount]);

  const canAdd = useMemo(() => {
    if (!hasSelectedPortfolio) return false;
    if (transactionTab === "Trades") {
      if (operation !== "Buy") return false;
      const sh = parseAmountField(shares);
      const pr = parseAmountField(price);
      if (sh <= 0 || pr <= 0) return false;
      if (tradeAssetSource === "listed") return Boolean(selectedCompany?.symbol?.trim());
      return customAssetName.trim().length > 0;
    }
    if (transactionTab === "Cash") {
      return cashAmountNum > 0;
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
    cashAmountNum,
    incomeTotalNum,
    incomeShareCountNum,
    incomeFeeNum,
    incomeNetUsd,
    expenseAmountNum,
  ]);

  const cashFlowSigned = useMemo(
    () => cashSignedAmount(cashDirection, cashAmountNum),
    [cashDirection, cashAmountNum],
  );

  const currentCashBalanceDisplayUsd = useMemo(
    () => roundUsdForDisplay(currentCashBalanceUsd),
    [currentCashBalanceUsd],
  );

  const balanceAfterIncomeUsd = useMemo(
    () => roundUsdForDisplay(currentCashBalanceUsd + incomeNetUsd),
    [currentCashBalanceUsd, incomeNetUsd],
  );

  const balanceAfterCashUsd = useMemo(
    () => roundUsdForDisplay(currentCashBalanceUsd + cashFlowSigned),
    [currentCashBalanceUsd, cashFlowSigned],
  );

  const balanceAfterExpenseUsd = useMemo(
    () => roundUsdForDisplay(currentCashBalanceUsd - expenseAmountNum),
    [currentCashBalanceUsd, expenseAmountNum],
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

  const handleAddCash = useCallback(() => {
    if (transactionTab !== "Cash" || !canAdd || !selectedPortfolioId) return;
    const n = cashAmountNum;
    if (n <= 0) return;

    setSubmitting(true);
    try {
      const dateStr = format(transactionDate, "yyyy-MM-dd");
      const opLabel = cashOperationLabel(cashDirection);
      addTransaction(selectedPortfolioId, {
        id: newTransactionRowId(),
        portfolioId: selectedPortfolioId,
        kind: "cash",
        operation: opLabel,
        symbol: "USD",
        name: "US Dollar",
        logoUrl: null,
        date: dateStr,
        shares: n,
        price: 1,
        fee: 0,
        sum: cashSignedAmount(cashDirection, n),
        profitPct: null,
        profitUsd: null,
      });
      const toastHeadline =
        cashDirection === "in" || cashDirection === "out"
          ? `${cashDirection === "in" ? "Cash in" : "Cash out"} of ${usdFormatter.format(n)} added.`
          : `${opLabel} of ${usdFormatter.format(n)} recorded.`;
      toastTransactionAdded(toastHeadline, transactionDate);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    addTransaction,
    canAdd,
    cashAmountNum,
    cashDirection,
    onClose,
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
    if (transactionTab === "Cash") {
      handleAddCash();
      return;
    }
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
    const sh = parseAmountField(shares);
    const pr = parseAmountField(price);
    const fee = parseAmountField(fees);
    if (sh <= 0 || pr <= 0) return;

    let symUpper: string;
    let assetName: string;
    let logoUrl: string | null;
    let marketPrice: number;

    if (tradeAssetSource === "custom") {
      const nameRaw = customAssetName.trim();
      if (!nameRaw) return;
      symUpper = customPortfolioSymbolFromName(nameRaw).toUpperCase();
      assetName = nameRaw;
      logoUrl = null;
      marketPrice = pr;
    } else {
      if (!selectedCompany?.symbol?.trim()) return;
      const sym = selectedCompany.symbol.trim();
      symUpper = sym.toUpperCase();
      assetName = selectedCompany.name;
      const live = await fetchLiveMarketPriceClient(sym);
      marketPrice = live ?? pr;
      const resolvedLogo = displayLogoUrlForPortfolioSymbol(sym).trim();
      logoUrl = resolvedLogo ? resolvedLogo : null;
    }

    setSubmitting(true);
    try {
      const lotCost = sh * pr + fee;
      const dateStr = format(transactionDate, "yyyy-MM-dd");

      const existing =
        holdingsByPortfolioId[selectedPortfolioId]?.find(
          (h) => h.symbol.toUpperCase() === symUpper,
        ) ?? null;
      const positionId = existing?.id ?? newHoldingId();

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

      const { profitUsd, profitPct } = lotUnrealizedPnL({
        shares: sh,
        price: pr,
        fee,
        marketPrice,
      });

      addHolding(selectedPortfolioId, merged);

      addTransaction(selectedPortfolioId, {
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
        sum: -lotCost,
        profitPct,
        profitUsd,
        holdingId: merged.id,
      });

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
    shares,
    tradeAssetSource,
    transactionDate,
    transactionTab,
    handleAddCash,
    handleAddIncome,
    handleAddExpense,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(90vh,804px)] w-full max-w-[480px] flex-col rounded-xl bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)] min-h-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold leading-7 tracking-tight text-[#09090B]">
            New Transaction
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
          <div className="flex flex-col gap-5">
            <Field label="Portfolio">
              <TransactionPortfolioField />
            </Field>

            <TransactionTypeTabs active={transactionTab} onChange={setTransactionTab} />

            {transactionTab === "Trades" ? (
              <>
                <SecondaryTabs
                  aria-label="Asset source"
                  items={TRADE_ASSET_TABS}
                  value={tradeAssetSource}
                  onValueChange={(v) => {
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
                  <ClearableInput
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={fees}
                    onChange={setFees}
                    placeholder="Fee"
                    clearLabel="Clear fees"
                  />
                </Field>
              </>
            ) : null}

            {transactionTab === "Cash" ? (
              <>
                <Field label="Operation type">
                  <CashDirectionSelect value={cashDirection} onChange={setCashDirection} />
                </Field>

                <Field label="Date">
                  <TransactionDateField date={transactionDate} onDateChange={setTransactionDate} />
                </Field>

                <Field label="Amount">
                  <ClearableInput
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={cashAmount}
                    onChange={setCashAmount}
                    placeholder="0.00"
                    clearLabel="Clear amount"
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
                    <ClearableInput
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={incomeTotalReceived}
                      onChange={setIncomeTotalReceived}
                      placeholder="0.00"
                      clearLabel="Clear amount"
                    />
                  </Field>
                  <Field label="Per share">
                    <ClearableInput
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={incomePerShare}
                      onChange={setIncomePerShare}
                      placeholder="0.00"
                      clearLabel="Clear per share"
                    />
                  </Field>
                </div>

                <Field label="Fees">
                  <ClearableInput
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
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
                  <ClearableInput
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
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
                        : "text-[#09090B]",
                  )}
                >
                  {usdBalance.format(currentCashBalanceDisplayUsd)}
                </span>
              </div>
              {transactionTab === "Trades" ? (
                <div className="flex items-center gap-1 py-2.5 text-sm">
                  <span className="flex-1 font-medium text-[#71717A]">Total</span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#09090B]">
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
                            : "text-[#09090B]",
                      )}
                    >
                      {usdBalance.format(balanceAfterIncomeUsd)}
                    </span>
                  </div>
                </>
              ) : null}
              {transactionTab === "Cash" && cashAmountNum > 0 ? (
                <>
                  <div className="flex items-center gap-1 border-b border-dashed border-[#E4E4E7] py-2.5 text-sm">
                    <span className="flex-1 font-medium text-[#71717A]">Cash flow</span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        cashFlowSigned >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
                      )}
                    >
                      {usdFormatter.format(cashFlowSigned)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 py-2.5 text-sm">
                    <span className="flex-1 font-medium text-[#71717A]">Balance after</span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        balanceAfterCashUsd < 0
                          ? "text-[#DC2626]"
                          : balanceAfterCashUsd > 0
                            ? "text-[#16A34A]"
                            : "text-[#09090B]",
                      )}
                    >
                      {usdBalance.format(balanceAfterCashUsd)}
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
                            : "text-[#09090B]",
                      )}
                    >
                      {usdBalance.format(balanceAfterExpenseUsd)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E4E4E7] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-9 flex-1 items-center justify-center rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canAdd || submitting}
            onClick={() => void handleAdd()}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-colors",
              canAdd && !submitting
                ? "bg-[#09090B] hover:bg-[#27272A]"
                : "cursor-not-allowed bg-[#A1A1AA] opacity-50",
            )}
          >
            {submitting ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-[#09090B]">{label}</span>
      {children}
    </div>
  );
}

function TransactionTypeTabs({
  active,
  onChange,
}: {
  active: (typeof TABS)[number];
  onChange: (tab: (typeof TABS)[number]) => void;
}) {
  return (
    <div className="flex w-full gap-5 border-b border-[#E4E4E7]">
      {TABS.map((tab) => {
        const isOn = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={
              isOn
                ? "-mb-px border-b-2 border-[#09090B] pb-2 text-sm font-medium leading-6 text-[#09090B]"
                : "pb-2.5 text-sm font-medium leading-6 text-[#09090B] opacity-80 hover:opacity-100"
            }
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

