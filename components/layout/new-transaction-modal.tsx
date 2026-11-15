"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";

import type { CompanyPick } from "@/components/charting/company-picker";
import { SegmentedControl, whiteSurfaceButtonChromeClass } from "@/components/design-system";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ClearableInput } from "@/components/layout/clearable-input";
import { TransactionAssetPickStep } from "@/components/layout/transaction-asset-pick-step";
import { TransactionDateField } from "@/components/layout/transaction-date-field";
import { UsdMoneyClearableInput } from "@/components/layout/usd-money-clearable-input";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import {
  newHoldingId,
  newTransactionRowId,
  portfolioIsDemo,
  type PortfolioTransaction,
} from "@/components/portfolio/portfolio-types";
import { CompanyLogo } from "@/components/screener/company-logo";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell, APP_MODAL_RULE_CLASS } from "@/components/ui/app-modal-shell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpinnerLabel } from "@/components/ui/spinner";
import { freeHoldingsLimitMessage, wouldExceedFreeHoldingsCap } from "@/lib/account/free-plan-asset-limits";
import { FREE_MAX_HOLDINGS_PER_PORTFOLIO } from "@/lib/account/plan-entitlements";
import { toastProUpgrade } from "@/lib/account/toast-pro-upgrade";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { ArrowUpDown, Check, ChevronLeft, Lock } from "@/lib/icons";
import { parseUsdStyleNumber } from "@/lib/portfolio/amount-input-format";
import { fetchLiveMarketPriceClient, fetchPriceOnDateClient } from "@/lib/portfolio/client-symbol-quotes";
import { customPortfolioSymbolFromName } from "@/lib/portfolio/custom-asset-symbol";
import { lotUnrealizedPnL, mergeBuyIntoPosition } from "@/lib/portfolio/holding-position";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { portfolioSymbolMatchesAssetRoute } from "@/lib/portfolio/portfolio-asset-route-match";
import { refreshHoldingMarketPrices, replayTradeTransactionsToHoldings } from "@/lib/portfolio/rebuild-holdings-from-trades";
import { splitRatioFromTransaction } from "@/lib/portfolio/split-ratio-from-transaction";
import {
  formatExpenseToastDescription,
  formatIncomeToastDescription,
  formatTradeToastDescription,
  toastTransactionAdded,
} from "@/lib/portfolio/transaction-added-toast";
import { cn } from "@/lib/utils";

type Intent = "Buy" | "Sell" | "More";
const INTENT_OPTIONS = [
  { value: "Buy" as const, label: "Buy" },
  { value: "Sell" as const, label: "Sell" },
  { value: "More" as const, label: "More" },
];

/** iOS “More” menu — credits go to the income ledger, the rest to expenses. */
const OTHER_TYPES = ["Dividends", "Other income", "Fee", "Tax", "Other expense"] as const;
type OtherType = (typeof OTHER_TYPES)[number];
const OTHER_TYPE_LEDGER_OPERATION: Record<OtherType, string> = {
  Dividends: "Dividend",
  "Other income": "Other income",
  Fee: "Fees",
  Tax: "Tax",
  "Other expense": "Other expense",
};
function isCreditType(t: OtherType): boolean {
  return t === "Dividends" || t === "Other income";
}

type FormTab = "trade" | "income" | "expense";
type AssetChoice = { kind: "listed"; pick: CompanyPick } | { kind: "custom" };

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const qtyFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 6 });

/** Grouped live typing (`1,234.5`) — digits + one dot, capped fraction digits. */
function sanitizeAmountTyping(raw: string, maxFraction: number): string {
  let s = raw.replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  const [intRaw = "", frac] = s.split(".");
  const intPart = intRaw.replace(/^0+(?=\d)/, "");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (frac == null) return grouped;
  return `${grouped || "0"}.${frac.slice(0, maxFraction)}`;
}

function priceTextFromApi(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const fixed = n >= 1 ? n.toFixed(2) : n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return sanitizeAmountTyping(fixed, 6);
}

function tickerLabel(symbol: string): string {
  const base = cryptoRouteBase(symbol);
  return base || symbol.trim().toUpperCase();
}

/** Ledger sums can be ±ε; round to cents so ~0 shows as $0.00. */
function roundUsdForDisplay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(n * 100);
  return cents === 0 ? 0 : cents / 100;
}

const PILL_CLASS = cn(
  "inline-flex h-9 max-w-full shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-muted dark:hover:bg-dropdown-item-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
  whiteSurfaceButtonChromeClass,
);

type Props = {
  open: boolean;
  /** When provided, skips the asset pick step and opens the form on this ticker. */
  presetCompany?: CompanyPick | null;
  onClose: () => void;
};

/** Add Transaction — same flow as iOS: pick an asset, then Buy / Sell / More with a hero amount. */
export function NewTransactionModal({ open, presetCompany = null, onClose }: Props) {
  if (!open) return null;
  return <NewTransactionModalContent presetCompany={presetCompany} onClose={onClose} />;
}

function NewTransactionModalContent({
  presetCompany,
  onClose,
}: {
  presetCompany: CompanyPick | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const [asset, setAsset] = useState<AssetChoice | null>(() =>
    presetCompany ? { kind: "listed", pick: presetCompany } : null,
  );
  const canGoBack = presetCompany == null;

  return (
    <AppModalOverlay open onClose={onClose} zIndex={100}>
      {asset == null ? (
        <AppModalShell titleId={titleId} title="Add Transaction" onClose={onClose} bodyClassName="px-4 pb-4 pt-4">
          <TransactionAssetPickStep
            onPick={(pick) => setAsset({ kind: "listed", pick })}
            onPickCustom={() => setAsset({ kind: "custom" })}
          />
        </AppModalShell>
      ) : (
        <TransactionForm
          key={asset.kind === "listed" ? asset.pick.symbol : "custom"}
          titleId={titleId}
          asset={asset}
          onBack={canGoBack ? () => setAsset(null) : null}
          onClose={onClose}
        />
      )}
    </AppModalOverlay>
  );
}

function TransactionForm({
  titleId,
  asset,
  onBack,
  onClose,
}: {
  titleId: string;
  asset: AssetChoice;
  onBack: (() => void) | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const plan = usePlanAccessOptional();
  const {
    portfolios,
    selectedPortfolioId,
    setSelectedPortfolioId,
    isFreePortfolioAccessible,
    holdingsByPortfolioId,
    transactionsByPortfolioId,
    addTransaction,
    setPortfolioHoldings,
    setPortfolioTransactions,
  } = usePortfolioWorkspace();

  const isCustom = asset.kind === "custom";
  const listed = asset.kind === "listed" ? asset.pick : null;
  const listedSymbol = listed?.symbol.trim().toUpperCase() ?? "";
  const displayTicker = listed ? tickerLabel(listedSymbol) : "";

  const [intent, setIntent] = useState<Intent>("Buy");
  const [otherType, setOtherType] = useState<OtherType>("Dividends");
  const [transactionDate, setTransactionDate] = useState<Date>(() => startOfDay(new Date()));
  const [customAssetName, setCustomAssetName] = useState("");
  const [fees, setFees] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [tradeMode, setTradeMode] = useState<"price" | "shares">("price");
  const [shares, setShares] = useState("");
  /** User-typed unit price, scoped to the symbol + date it was typed for (a new date refetches). */
  const [priceOverride, setPriceOverride] = useState<{ key: string; value: string } | null>(null);

  const [incomeMode, setIncomeMode] = useState<"perShare" | "shares">("perShare");
  const [incomePerShare, setIncomePerShare] = useState("");
  /** `null` = follow the holding’s share count. */
  const [incomeSharesTyped, setIncomeSharesTyped] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");

  const tab: FormTab = intent === "More" ? (isCreditType(otherType) ? "income" : "expense") : "trade";

  const pickerPortfolios = useMemo(() => portfolios.filter((p) => !portfolioIsDemo(p)), [portfolios]);
  const selectedPortfolio =
    pickerPortfolios.find((p) => p.id === selectedPortfolioId) ?? pickerPortfolios[0] ?? null;
  const portfolioId = selectedPortfolio?.id ?? null;

  // Demo books are view-only — the form always targets a real portfolio.
  useEffect(() => {
    if (portfolioId && portfolioId !== selectedPortfolioId) setSelectedPortfolioId(portfolioId);
  }, [portfolioId, selectedPortfolioId, setSelectedPortfolioId]);

  const heldShares = useCallback(
    (pid: string | null): number => {
      if (!pid || !listedSymbol) return 0;
      const key = cryptoRouteBase(listedSymbol).toUpperCase();
      const h = (holdingsByPortfolioId[pid] ?? []).find((x) => cryptoRouteBase(x.symbol).toUpperCase() === key);
      return h?.shares ?? 0;
    },
    [holdingsByPortfolioId, listedSymbol],
  );
  const heldInSelected = heldShares(portfolioId);

  const cashBalanceUsd = useMemo(() => {
    if (!portfolioId) return 0;
    return roundUsdForDisplay((transactionsByPortfolioId[portfolioId] ?? []).reduce((acc, t) => acc + t.sum, 0));
  }, [portfolioId, transactionsByPortfolioId]);

  // --- Unit price (market on the trade date; the hero can override it) ---
  const ymd = format(transactionDate, "yyyy-MM-dd");
  const priceKey = tab === "trade" && listedSymbol ? `${listedSymbol}|${ymd}` : null;
  const priceOverrideKey = priceKey ?? "custom";
  const [fetchedPrice, setFetchedPrice] = useState<{ key: string; price: number | null } | null>(null);
  const transactionsRef = useRef(transactionsByPortfolioId);
  const portfolioIdRef = useRef(portfolioId);
  useEffect(() => {
    transactionsRef.current = transactionsByPortfolioId;
    portfolioIdRef.current = portfolioId;
  }, [transactionsByPortfolioId, portfolioId]);

  useEffect(() => {
    if (!priceKey) return;
    const [sym, day] = priceKey.split("|") as [string, string];
    let cancelled = false;
    void (async () => {
      const p = await fetchPriceOnDateClient(sym, day);
      if (cancelled) return;
      if (p == null) {
        setFetchedPrice({ key: priceKey, price: null });
        return;
      }
      // Later splits in this book restate the historical price to post-split shares.
      const pid = portfolioIdRef.current;
      let splitFactor = 1;
      for (const t of pid ? transactionsRef.current[pid] ?? [] : []) {
        const ratio = splitRatioFromTransaction(t);
        if (ratio == null) continue;
        if (!portfolioSymbolMatchesAssetRoute({ holdingSymbol: t.symbol, routeKey: sym, kind: "stock" })) continue;
        if (t.date <= day) continue;
        splitFactor *= ratio;
      }
      const adj = splitFactor > 0 && Number.isFinite(splitFactor) && splitFactor !== 1 ? p / splitFactor : p;
      setFetchedPrice({ key: priceKey, price: adj });
    })();
    return () => {
      cancelled = true;
    };
  }, [priceKey]);

  const loadingPrice = priceKey != null && fetchedPrice?.key !== priceKey;
  const priceText =
    priceOverride?.key === priceOverrideKey ? priceOverride.value
    : priceKey && fetchedPrice?.key === priceKey && fetchedPrice.price != null ? priceTextFromApi(fetchedPrice.price)
    : "";
  const priceNum = parseUsdStyleNumber(priceText);
  const sharesNum = parseUsdStyleNumber(shares);
  const feesNum = parseUsdStyleNumber(fees);

  const incomeSharesText =
    incomeSharesTyped ?? (heldInSelected > 0 ? sanitizeAmountTyping(String(+heldInSelected.toFixed(6)), 6) : "");
  const incomePerShareNum = parseUsdStyleNumber(incomePerShare);
  const incomeSharesNum = parseUsdStyleNumber(incomeSharesText);
  const incomeGross = incomePerShareNum * incomeSharesNum;
  const expenseNum = parseUsdStyleNumber(expenseAmount);

  const isSell = tab === "trade" && intent === "Sell";
  const sellOverHolding = isSell && sharesNum > heldInSelected + 1e-9;

  const canAdd = useMemo(() => {
    if (!portfolioId) return false;
    if (tab === "trade") {
      if (sharesNum <= 0 || priceNum <= 0) return false;
      if (isCustom) return intent === "Buy" && customAssetName.trim().length > 0;
      if (intent === "Sell") return !sellOverHolding;
      return true;
    }
    if (!listed) return false;
    if (tab === "income") return incomeGross > 0 && incomeGross - feesNum > 0;
    return expenseNum > 0;
  }, [
    portfolioId,
    tab,
    sharesNum,
    priceNum,
    isCustom,
    intent,
    customAssetName,
    sellOverHolding,
    listed,
    incomeGross,
    feesNum,
    expenseNum,
  ]);

  const addIncomeOrExpense = useCallback(() => {
    if (!portfolioId || !listed) return;
    const sym = listedSymbol;
    const resolvedLogo = displayLogoUrlForPortfolioSymbol(sym).trim();
    const logoUrl = resolvedLogo || null;
    const dateStr = format(transactionDate, "yyyy-MM-dd");
    const operation = OTHER_TYPE_LEDGER_OPERATION[otherType];
    if (tab === "income") {
      const net = incomeGross - feesNum;
      addTransaction(portfolioId, {
        id: newTransactionRowId(),
        portfolioId,
        kind: "income",
        operation,
        symbol: sym,
        name: listed.name,
        logoUrl,
        date: dateStr,
        shares: incomeSharesNum,
        price: incomePerShareNum,
        fee: feesNum,
        sum: net,
        profitPct: null,
        profitUsd: null,
      });
      toastTransactionAdded("Income added", formatIncomeToastDescription(operation, sym, net));
    } else {
      addTransaction(portfolioId, {
        id: newTransactionRowId(),
        portfolioId,
        kind: "expense",
        operation,
        symbol: sym,
        name: listed.name,
        logoUrl,
        date: dateStr,
        shares: expenseNum,
        price: 1,
        fee: 0,
        sum: -expenseNum,
        profitPct: null,
        profitUsd: null,
      });
      toastTransactionAdded("Expense recorded", formatExpenseToastDescription(operation, sym, expenseNum));
    }
    onClose();
  }, [
    addTransaction,
    expenseNum,
    feesNum,
    incomeGross,
    incomePerShareNum,
    incomeSharesNum,
    listed,
    listedSymbol,
    onClose,
    otherType,
    portfolioId,
    tab,
    transactionDate,
  ]);

  const addTrade = useCallback(async () => {
    if (!portfolioId) return;
    const operation = intent === "Sell" ? "Sell" : "Buy";
    const sh = sharesNum;
    const pr = priceNum;
    const fee = feesNum;

    let symUpper: string;
    let assetName: string;
    let logoUrl: string | null;
    let marketPrice: number;
    if (isCustom) {
      const nameRaw = customAssetName.trim();
      symUpper = customPortfolioSymbolFromName(nameRaw).toUpperCase();
      assetName = nameRaw;
      logoUrl = null;
      marketPrice = pr;
    } else {
      symUpper = listedSymbol;
      assetName = listed!.name;
      marketPrice = (await fetchLiveMarketPriceClient(listedSymbol)) ?? pr;
      const resolvedLogo = displayLogoUrlForPortfolioSymbol(listedSymbol).trim();
      logoUrl = resolvedLogo || null;
    }

    const gross = sh * pr;
    const dateStr = format(transactionDate, "yyyy-MM-dd");
    const existing =
      holdingsByPortfolioId[portfolioId]?.find((h) => h.symbol.toUpperCase() === symUpper) ?? null;

    if (
      operation === "Buy" &&
      plan?.isFree === true &&
      wouldExceedFreeHoldingsCap({
        holdings: holdingsByPortfolioId[portfolioId],
        symbol: symUpper,
        maxHoldings: plan.maxHoldingsPerPortfolio ?? FREE_MAX_HOLDINGS_PER_PORTFOLIO,
      })
    ) {
      toastProUpgrade({
        title: "Free plan limit",
        description: freeHoldingsLimitMessage(plan.maxHoldingsPerPortfolio ?? FREE_MAX_HOLDINGS_PER_PORTFOLIO),
        onUpgrade: () => router.push(PATH_ACCOUNT_PLANS),
      });
      return;
    }

    let holdingIdForTx = existing?.id ?? newHoldingId();
    let profitUsd: number | null = null;
    let profitPct: number | null = null;
    if (operation === "Sell") {
      if (!existing) return;
      const available = existing.shares;
      if (!Number.isFinite(available) || available <= 0 || sh - available > 1e-9) return;
      const costRemoved = (sh / available) * existing.costBasis;
      const realized = gross - fee - costRemoved;
      profitUsd = Number.isFinite(realized) ? realized : null;
      profitPct = costRemoved > 0 && Number.isFinite(realized) ? (realized / costRemoved) * 100 : null;
    } else {
      const merged = mergeBuyIntoPosition(existing, {
        id: holdingIdForTx,
        symbol: symUpper,
        name: assetName,
        logoUrl,
        shares: sh,
        price: pr,
        fee,
        marketPrice,
      });
      const pnl = lotUnrealizedPnL({ shares: sh, price: pr, fee, marketPrice });
      profitUsd = pnl.profitUsd;
      profitPct = pnl.profitPct;
      holdingIdForTx = merged.id;
    }

    const nextTx: PortfolioTransaction = {
      id: newTransactionRowId(),
      portfolioId,
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
    const nextTxList = [...(transactionsByPortfolioId[portfolioId] ?? []), nextTx];
    setPortfolioTransactions(portfolioId, nextTxList);
    // Holdings are rebuilt from the ledger so sells reduce remaining quantity / cost basis.
    const quoted = await refreshHoldingMarketPrices(replayTradeTransactionsToHoldings(nextTxList));
    setPortfolioHoldings(portfolioId, quoted);

    toastTransactionAdded("Transaction added", formatTradeToastDescription(operation, sh, symUpper));
    onClose();
  }, [
    customAssetName,
    feesNum,
    holdingsByPortfolioId,
    intent,
    isCustom,
    listed,
    listedSymbol,
    onClose,
    plan,
    portfolioId,
    priceNum,
    router,
    setPortfolioHoldings,
    setPortfolioTransactions,
    sharesNum,
    transactionDate,
    transactionsByPortfolioId,
  ]);

  const submit = useCallback(async () => {
    if (!canAdd || submitting) return;
    setSubmitting(true);
    try {
      if (tab === "trade") await addTrade();
      else addIncomeOrExpense();
    } finally {
      setSubmitting(false);
    }
  }, [addIncomeOrExpense, addTrade, canAdd, submitting, tab]);

  // --- Copy ---
  const sellHoldingLabel = (() => {
    const qty = `${qtyFormatter.format(heldInSelected)} ${displayTicker}`;
    if (heldInSelected <= 0 || priceNum <= 0) return qty;
    return `${qty} · ${usd2.format(heldInSelected * priceNum)}`;
  })();
  const portfolioPillLabel = selectedPortfolio
    ? `${selectedPortfolio.name} · ${isSell ? sellHoldingLabel : usd2.format(cashBalanceUsd)}`
    : "No portfolio";

  const summaryLine: ReactNode =
    sellOverHolding ?
      <span className="text-down">
        {heldInSelected > 0
          ? `Only ${qtyFormatter.format(heldInSelected)} ${displayTicker} available`
          : `No ${displayTicker} in ${selectedPortfolio?.name ?? "this portfolio"}`}
      </span>
    : tab === "trade" ? `Total amount: ${usd2.format(sharesNum * priceNum)}`
    : tab === "income" ? `Total amount: ${usd2.format(incomeGross)}`
    : null;

  const primaryLabel = tab === "trade" ? intent : "Add";
  const primaryToneClass =
    tab === "trade" && intent === "Buy" ? "bg-up text-white"
    : tab === "trade" && intent === "Sell" ? "bg-down text-white"
    : "bg-fg text-surface";

  const feesPillLabel = feesNum > 0 ? `Fees: ${usd2.format(feesNum)}` : "Add Fee";

  const header = (
    <div className="flex w-full items-center gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-hover"
          aria-label="Back to assets"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {listed ? (
          <CompanyLogo
            name={listed.name}
            logoUrl={displayLogoUrlForPortfolioSymbol(listedSymbol)}
            symbol={listedSymbol}
            size="sm"
          />
        ) : null}
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-base font-semibold leading-5 text-fg">
            {listed ? displayTicker : "Custom asset"}
          </h2>
          {listed ? <p className="truncate text-[12px] leading-4 text-fg-muted">{listed.name}</p> : null}
        </div>
      </div>
      <AppModalCloseButton onClick={onClose} disabled={submitting} />
    </div>
  );

  const footer = (
    <div className={cn("flex shrink-0 flex-col gap-3 border-t px-5 pb-5 pt-4", APP_MODAL_RULE_CLASS)}>
      {summaryLine != null ? (
        <p className="text-center text-sm tabular-nums text-fg-muted" aria-live="polite">
          {summaryLine}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!canAdd || submitting}
        onClick={() => void submit()}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center rounded-full text-[15px] font-semibold transition-opacity",
          primaryToneClass,
          (!canAdd || submitting) && "cursor-not-allowed opacity-40",
        )}
      >
        {submitting ? <SpinnerLabel>{intent === "Sell" && tab === "trade" ? "Selling…" : "Adding…"}</SpinnerLabel> : primaryLabel}
      </button>
    </div>
  );

  return (
    <AppModalShell header={header} footer={footer} bodyClassName="px-5 py-5">
      {/* Fixed sheet height (iOS): switching Buy / Sell / More never resizes the modal. */}
      <div className="flex flex-col items-center" style={{ minHeight: FORM_BODY_MIN_H_PX }}>
        <SegmentedControl
          fullWidth
          aria-label="Operation"
          options={INTENT_OPTIONS.map((o) => ({
            ...o,
            disabled: isCustom && o.value !== "Buy",
          }))}
          value={intent}
          onChange={setIntent}
        />

        <div
          className="flex w-full flex-1 flex-col items-center justify-center"
          style={{ gap: FORM_SECTION_GAP_PX, paddingTop: FORM_SECTION_GAP_PX, paddingBottom: FORM_SECTION_GAP_PX }}
        >
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={PILL_CLASS} aria-label="Portfolio">
                <span className="min-w-0 truncate tabular-nums">{portfolioPillLabel}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" sideOffset={6} className="w-[min(calc(100vw-2rem),300px)] p-0">
              <div className={dropdownMenuPanelClassName()} role="listbox" aria-label="Portfolio">
                {pickerPortfolios.map((p) => {
                  const isOn = p.id === portfolioId;
                  const locked = !isFreePortfolioAccessible(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={isOn}
                      onClick={() => setSelectedPortfolioId(p.id)}
                      className={cn(dropdownMenuPlainItemClassName({ selected: isOn }), "justify-between")}
                    >
                      <span className="flex min-w-0 flex-col items-start">
                        <span className="truncate">{p.name}</span>
                        {isSell ? (
                          <span className="text-[12px] tabular-nums text-fg-muted">
                            {qtyFormatter.format(heldShares(p.id))} {displayTicker}
                          </span>
                        ) : null}
                      </span>
                      {isOn ? (
                        <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      ) : locked ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {tab === "trade" ? (
            <HeroEntry
              value={tradeMode === "price" ? priceText : shares}
              onChange={(v) =>
                tradeMode === "price" ?
                  setPriceOverride({ key: priceOverrideKey, value: sanitizeAmountTyping(v, 6) })
                : setShares(sanitizeAmountTyping(v, 8))
              }
              prefix={tradeMode === "price" ? "$" : undefined}
              suffix={tradeMode === "price" ? "per share" : displayTicker || undefined}
              ariaLabel={tradeMode === "price" ? "Price per share" : "Shares"}
              secondary={
                tradeMode === "price" ?
                  `${sharesNum > 0 ? shares : "0.00"}\u2009${displayTicker || "shares"}`
                : loadingPrice && priceNum <= 0 ? "Loading price…"
                : priceNum <= 0 ? (isCustom ? "Set a price per share" : "Set a trade date to load price")
                : `${usd2.format(priceNum)}\u2009per share`
              }
              onToggle={() => setTradeMode((m) => (m === "price" ? "shares" : "price"))}
              toggleLabel={tradeMode === "price" ? "Switch to enter shares" : "Switch to enter price per share"}
              dimmed={loadingPrice && tradeMode === "price" && !priceText}
            />
          ) : tab === "income" ? (
            <HeroEntry
              value={incomeMode === "perShare" ? incomePerShare : incomeSharesText}
              onChange={(v) =>
                incomeMode === "perShare" ?
                  setIncomePerShare(sanitizeAmountTyping(v, 6))
                : setIncomeSharesTyped(sanitizeAmountTyping(v, 8))
              }
              prefix={incomeMode === "perShare" ? "$" : undefined}
              suffix={incomeMode === "perShare" ? "per share" : displayTicker || undefined}
              ariaLabel={incomeMode === "perShare" ? "Per share" : "Shares"}
              secondary={
                incomeMode === "perShare" ?
                  `${incomeSharesNum > 0 ? incomeSharesText : "0.00"}\u2009${displayTicker}`
                : `${usd2.format(incomePerShareNum)}\u2009per share`
              }
              onToggle={() => setIncomeMode((m) => (m === "perShare" ? "shares" : "perShare"))}
              toggleLabel={incomeMode === "perShare" ? "Switch to enter shares" : "Switch to enter per share"}
            />
          ) : (
            <HeroEntry
              value={expenseAmount}
              onChange={(v) => setExpenseAmount(sanitizeAmountTyping(v, 2))}
              prefix="$"
              ariaLabel="Amount"
              secondary="Amount"
            />
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {intent === "More" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={PILL_CLASS} aria-label={`Type, ${otherType}`}>
                    {otherType}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" sideOffset={6} className="w-[200px] p-0">
                  <div className={dropdownMenuPanelClassName()} role="listbox" aria-label="Type">
                    {OTHER_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="option"
                        aria-selected={t === otherType}
                        onClick={() => setOtherType(t)}
                        className={cn(dropdownMenuPlainItemClassName({ selected: t === otherType }), "justify-between")}
                      >
                        <span>{t}</span>
                        {t === otherType ? <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden /> : null}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            {tab !== "expense" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={PILL_CLASS}>
                    <span className="tabular-nums">{feesPillLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" sideOffset={6} className="w-[240px] p-3">
                  <p className="mb-2 text-[12px] font-medium text-fg-muted">Fees</p>
                  <UsdMoneyClearableInput value={fees} onChange={setFees} placeholder="0.00" clearLabel="Clear fees" />
                </PopoverContent>
              </Popover>
            ) : null}
            <TransactionDateField date={transactionDate} onDateChange={setTransactionDate} pillClassName={PILL_CLASS} />
          </div>
        </div>

        {isCustom ? (
          <div className="w-full">
            <ClearableInput
              type="text"
              value={customAssetName}
              onChange={setCustomAssetName}
              placeholder="Asset name (e.g. Private loan, Collectible)"
              clearLabel="Clear name"
            />
          </div>
        ) : null}
      </div>
    </AppModalShell>
  );
}

/** Form body height + section rhythm (iOS sheet: 32pt between portfolio, amount and pills). */
const FORM_BODY_MIN_H_PX = 420;
const FORM_SECTION_GAP_PX = 32;

const HERO_DIGITS_CLASS = "text-[48px] font-semibold leading-[56px] tracking-[-0.02em] tabular-nums";

/** iOS hero amount — big centered digits with `$` / `per share`, plus a toggle for the linked value. */
function HeroEntry({
  value,
  onChange,
  prefix,
  suffix,
  ariaLabel,
  secondary,
  onToggle,
  toggleLabel,
  dimmed = false,
}: {
  value: string;
  onChange: (next: string) => void;
  prefix?: string;
  suffix?: string;
  ariaLabel: string;
  secondary: string;
  onToggle?: () => void;
  toggleLabel?: string;
  dimmed?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const placeholder = "0.00";
  const isEmpty = value.length === 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, [ariaLabel]);

  // Hug the digits so `$` / `per share` sit right beside them (no ch-based slack).
  useLayoutEffect(() => {
    const input = inputRef.current;
    const measure = measureRef.current;
    if (!input || !measure) return;
    input.style.width = `${Math.ceil(measure.getBoundingClientRect().width) + 2}px`;
  }, [value]);

  return (
    <div className={cn("relative w-full transition-opacity", dimmed && "opacity-55")}>
      <div className="flex w-full flex-col items-center gap-0.5 px-11">
        <div
          className="relative flex max-w-full cursor-text items-baseline justify-center gap-0.5"
          onClick={() => inputRef.current?.focus()}
        >
          {prefix ? <span className="text-[17px] font-medium text-fg-muted">{prefix}</span> : null}
          <span
            ref={measureRef}
            aria-hidden
            className={cn(HERO_DIGITS_CLASS, "pointer-events-none invisible absolute whitespace-pre")}
          >
            {value || placeholder}
          </span>
          {/* Empty: caret at leading edge of muted 0.00 (iOS). Native centered placeholder put `|` mid-digits. */}
          <span className="relative inline-flex max-w-[260px] items-baseline">
            {isEmpty ? (
              <span aria-hidden className={cn(HERO_DIGITS_CLASS, "pointer-events-none text-fg-muted")}>
                {placeholder}
              </span>
            ) : null}
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              inputMode="decimal"
              aria-label={ariaLabel}
              autoComplete="off"
              className={cn(
                HERO_DIGITS_CLASS,
                "min-w-0 bg-transparent text-left text-fg caret-fg outline-none",
                isEmpty ? "absolute inset-0 w-full" : "relative max-w-[260px]",
              )}
            />
          </span>
          {suffix ? <span className="whitespace-nowrap text-[17px] font-medium text-fg-muted">{suffix}</span> : null}
        </div>
        <p className="text-[15px] tabular-nums text-fg-muted">{secondary}</p>
      </div>
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={toggleLabel}
          className={cn(
            "absolute right-0 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-muted dark:hover:bg-dropdown-item-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
            whiteSurfaceButtonChromeClass,
          )}
        >
          <ArrowUpDown className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
