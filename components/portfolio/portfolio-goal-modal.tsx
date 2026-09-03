"use client";

import { useId, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { SegmentedControl } from "@/components/design-system/segmented-control";
import { ClearableInput } from "@/components/layout/clearable-input";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import type { PortfolioGoal, PortfolioGoalKind } from "@/components/portfolio/portfolio-types";
import { GOAL_DEFAULT_DIVIDEND_GROWTH_PCT, GOAL_PORTFOLIO_ANNUAL_RETURN } from "@/lib/portfolio/portfolio-goal-projections";
import { cn } from "@/lib/utils";

function ModalField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium leading-5 text-fg">{label}</span>
      {children}
      {hint ? <p className="text-xs leading-4 text-fg-muted">{hint}</p> : null}
    </div>
  );
}

function parseUsdInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatUsdInput(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function parsePercentInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function sanitizePercentInput(raw: string): string {
  let out = "";
  let hasDot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !hasDot) {
      hasDot = true;
      out += ch;
    }
  }
  return out;
}

function formatPercentInput(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPercentDisplay(n: number): string {
  return `${formatPercentInput(n)}%`;
}

const DEFAULT_PORTFOLIO_RETURN_PCT = GOAL_PORTFOLIO_ANNUAL_RETURN * 100;

function goalFormStateFromProps(
  initialGoal: PortfolioGoal | null,
  portfolioAverageAnnualReturnPct: number | null,
  currentDividendYieldPct: number | null,
): {
  kind: PortfolioGoalKind;
  targetInput: string;
  achieveByYear: number | null;
  contributionInput: string;
  reinvestDividends: boolean;
  returnInput: string;
  yieldInput: string;
  growthInput: string;
} {
  let returnInput: string;
  if (
    portfolioAverageAnnualReturnPct != null &&
    Number.isFinite(portfolioAverageAnnualReturnPct)
  ) {
    returnInput = formatPercentInput(portfolioAverageAnnualReturnPct);
  } else if (initialGoal?.portfolioAnnualReturnPct != null) {
    returnInput = formatPercentInput(initialGoal.portfolioAnnualReturnPct);
  } else {
    returnInput = formatPercentInput(DEFAULT_PORTFOLIO_RETURN_PCT);
  }

  let yieldInput: string;
  if (initialGoal?.kind === "passive_income" && initialGoal.dividendYieldPct != null) {
    yieldInput = formatPercentInput(initialGoal.dividendYieldPct);
  } else if (currentDividendYieldPct != null && Number.isFinite(currentDividendYieldPct)) {
    yieldInput = formatPercentInput(currentDividendYieldPct);
  } else {
    yieldInput = "";
  }

  const growthInput = formatPercentInput(
    initialGoal?.kind === "passive_income" && initialGoal.dividendGrowthPct != null
      ? initialGoal.dividendGrowthPct
      : GOAL_DEFAULT_DIVIDEND_GROWTH_PCT,
  );

  return {
    kind: initialGoal?.kind ?? "value",
    targetInput: initialGoal ? formatUsdInput(initialGoal.targetUsd) : "",
    achieveByYear: initialGoal?.achieveByYear ?? null,
    contributionInput: initialGoal ? formatUsdInput(initialGoal.monthlyContributionUsd) : "",
    reinvestDividends: initialGoal?.reinvestDividends === true,
    returnInput,
    yieldInput,
    growthInput,
  };
}

function GoalPillSwitch({
  pressed,
  onPressedChange,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
        pressed ? "bg-accent" : "bg-stroke",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-switch-thumb-off shadow-sm transition-[transform,background-color]",
          pressed ? "translate-x-4 bg-switch-thumb" : "translate-x-0",
        )}
      />
    </button>
  );
}

function GoalSettingRow({
  label,
  pressed,
  onPressedChange,
}: {
  label: string;
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium leading-5 text-fg">{label}</span>
      <GoalPillSwitch
        pressed={pressed}
        onPressedChange={onPressedChange}
        aria-label={label}
      />
    </div>
  );
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PortfolioGoalModal({
  open,
  initialGoal,
  currentPortfolioValue,
  currentAnnualPassiveIncomeUsd,
  currentDividendYieldPct,
  portfolioAverageAnnualReturnPct,
  onClose,
  onSave,
}: {
  open: boolean;
  initialGoal: PortfolioGoal | null;
  currentPortfolioValue: number;
  /** Estimated annual dividend / passive income for this portfolio (overview-market yields). */
  currentAnnualPassiveIncomeUsd: number | null;
  /** Portfolio-level dividend yield % (annual income ÷ holdings). Default for Dividend yield. */
  currentDividendYieldPct: number | null;
  /** Mean annual portfolio return % (Returns Dynamics → Annually). Default for Returns input. */
  portfolioAverageAnnualReturnPct: number | null;
  onClose: () => void;
  onSave: (goal: PortfolioGoal) => void;
}) {
  const titleId = useId();
  const currentYear = new Date().getFullYear();

  const defaultAchieveByYear = currentYear + 9;
  const defaultAchieveByPlaceholder = `${defaultAchieveByYear} (in 9 years)`;

  const initialForm = goalFormStateFromProps(
    initialGoal,
    portfolioAverageAnnualReturnPct,
    currentDividendYieldPct,
  );
  const [kind, setKind] = useState<PortfolioGoalKind>(initialForm.kind);
  const [targetInput, setTargetInput] = useState(initialForm.targetInput);
  const [achieveByYear, setAchieveByYear] = useState<number | null>(initialForm.achieveByYear);
  const [contributionInput, setContributionInput] = useState(initialForm.contributionInput);
  const [reinvestDividends, setReinvestDividends] = useState(initialForm.reinvestDividends);
  const [returnInput, setReturnInput] = useState(initialForm.returnInput);
  const [yieldInput, setYieldInput] = useState(initialForm.yieldInput);
  const [growthInput, setGrowthInput] = useState(initialForm.growthInput);
  const yieldTouchedRef = useRef(false);

  const wasOpenRef = useRef(open);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    yieldTouchedRef.current = false;
    const next = goalFormStateFromProps(
      initialGoal,
      portfolioAverageAnnualReturnPct,
      currentDividendYieldPct,
    );
    setKind(next.kind);
    setTargetInput(next.targetInput);
    setAchieveByYear(next.achieveByYear);
    setContributionInput(next.contributionInput);
    setReinvestDividends(next.reinvestDividends);
    setReturnInput(next.returnInput);
    setYieldInput(next.yieldInput);
    setGrowthInput(next.growthInput);
  }, [open, initialGoal, portfolioAverageAnnualReturnPct, currentDividendYieldPct]);

  useEffect(() => {
    if (!open || kind !== "passive_income") return;
    if (yieldTouchedRef.current) return;
    if (yieldInput !== "") return;
    if (currentDividendYieldPct == null || !Number.isFinite(currentDividendYieldPct)) return;
    setYieldInput(formatPercentInput(currentDividendYieldPct));
  }, [open, kind, yieldInput, currentDividendYieldPct]);

  const defaultReturnPct =
    portfolioAverageAnnualReturnPct != null && Number.isFinite(portfolioAverageAnnualReturnPct)
      ? portfolioAverageAnnualReturnPct
      : DEFAULT_PORTFOLIO_RETURN_PCT;

  const yearOptions = useMemo(() => {
    const out: { year: number; label: string }[] = [];
    for (let y = currentYear + 1; y <= currentYear + 50; y++) {
      const yearsOut = y - currentYear;
      out.push({ year: y, label: `${y} (in ${yearsOut} ${yearsOut === 1 ? "year" : "years"})` });
    }
    return out;
  }, [currentYear]);

  const yearListboxOptions = useMemo(() => {
    const mapped = yearOptions.map((o) => ({
      value: String(o.year),
      label: o.label,
    }));
    const defaultKey = String(defaultAchieveByYear);
    const defaultOpt = mapped.find((o) => o.value === defaultKey);
    const rest = mapped.filter((o) => o.value !== defaultKey);
    const sortedYears = defaultOpt ? [defaultOpt, ...rest] : mapped;
    return [
      { value: "", label: defaultAchieveByPlaceholder },
      ...sortedYears,
    ];
  }, [yearOptions, defaultAchieveByYear, defaultAchieveByPlaceholder]);

  const achieveByPlaceholderOption = useMemo(
    () => ({ value: "", label: defaultAchieveByPlaceholder }),
    [defaultAchieveByPlaceholder],
  );

  const targetUsd = parseUsdInput(targetInput);
  const monthlyContributionUsd = parseUsdInput(contributionInput) ?? 0;
  const returnPct = parsePercentInput(returnInput);
  const yieldPct = parsePercentInput(yieldInput);
  const growthPct = parsePercentInput(growthInput);
  const incomeFieldsValid =
    yieldPct != null && yieldPct >= 0 && yieldPct <= 100 && growthPct != null && growthPct >= 0 && growthPct <= 100;
  const returnFieldsValid = returnPct != null && returnPct >= 0 && returnPct <= 100;
  const canSave =
    targetUsd != null &&
    targetUsd > 0 &&
    achieveByYear != null &&
    monthlyContributionUsd >= 0 &&
    (kind === "passive_income" ? incomeFieldsValid : returnFieldsValid);

  const yearlyContribution = monthlyContributionUsd > 0 ? monthlyContributionUsd * 12 : null;

  const targetLabel = kind === "passive_income" ? "Target annually" : "Target";

  const targetHint = useMemo(() => {
    if (kind === "value") {
      return `Portfolio value ${usd.format(currentPortfolioValue)}`;
    }
    if (currentAnnualPassiveIncomeUsd != null) {
      return `Passive income ${usd.format(currentAnnualPassiveIncomeUsd)} annually`;
    }
    return "No dividend data";
  }, [kind, currentPortfolioValue, currentAnnualPassiveIncomeUsd]);

  const returnDefaultHintPct =
    portfolioAverageAnnualReturnPct != null && Number.isFinite(portfolioAverageAnnualReturnPct)
      ? portfolioAverageAnnualReturnPct
      : null;

  return (
    <AppModalOverlay open={open} onClose={onClose} zIndex={110}>
      <AppModalShell
        titleId={titleId}
        title="My goal"
        onClose={onClose}
        maxHeightClass={
          kind === "passive_income" ? "max-h-[min(90vh,880px)]" : "max-h-[min(90vh,720px)]"
        }
        bodyScroll={false}
        bodyClassName={cn(
          "flex flex-col gap-5 px-5 pt-5",
          kind === "passive_income" ? "pb-6" : "pb-5",
        )}
        footer={
          <AppModalFooter>
            <button type="button" onClick={onClose} className={appModalCancelButtonClass}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                if (!canSave || targetUsd == null || achieveByYear == null) {
                  return;
                }
                if (kind === "passive_income") {
                  if (yieldPct == null || growthPct == null) return;
                  onSave({
                    kind,
                    targetUsd,
                    achieveByYear,
                    monthlyContributionUsd,
                    currency: "USD",
                    dividendYieldPct: yieldPct,
                    dividendGrowthPct: growthPct,
                  });
                  return;
                }
                onSave({
                  kind,
                  targetUsd,
                  achieveByYear,
                  monthlyContributionUsd,
                  currency: "USD",
                  portfolioAnnualReturnPct: returnPct ?? defaultReturnPct,
                  reinvestDividends,
                });
              }}
              className={appModalPrimaryButtonClass(canSave)}
            >
              Save
            </button>
          </AppModalFooter>
        }
      >
        <ModalField label="Goal">
          <SegmentedControl
            fullWidth
            aria-label="Goal type"
            options={[
              { value: "value", label: "Value" },
              { value: "passive_income", label: "Passive income" },
            ]}
            value={kind}
            onChange={setKind}
          />
        </ModalField>

        <ModalField label={targetLabel} hint={targetHint}>
          <ClearableInput
            type="text"
            inputMode="decimal"
            value={targetInput}
            onChange={setTargetInput}
            placeholder={kind === "passive_income" ? "5,000" : "10,000,000"}
            clearLabel="Clear target"
            aria-label={
              kind === "passive_income" ? "Target annual passive income (USD)" : "Target amount (USD)"
            }
          />
        </ModalField>

        <ModalField label="Achieve by">
          <FormListboxSelect
            value={achieveByYear != null ? String(achieveByYear) : ""}
            onChange={(v) => setAchieveByYear(v ? Number(v) : null)}
            options={yearListboxOptions}
            placeholderOption={achieveByPlaceholderOption}
            aria-label="Achieve by year"
            portaled
            triggerClassName={achieveByYear == null ? "text-fg-muted" : undefined}
          />
        </ModalField>

        <ModalField
          label="Contributions per month"
          hint={
            yearlyContribution != null && yearlyContribution > 0
              ? `${usd.format(yearlyContribution)} per year`
              : undefined
          }
        >
          <ClearableInput
            type="text"
            inputMode="decimal"
            value={contributionInput}
            onChange={setContributionInput}
            placeholder="0"
            clearLabel="Clear contribution"
            aria-label="Monthly contribution (optional)"
          />
        </ModalField>

        <div className="flex w-full flex-col gap-4">
          {kind === "passive_income" ? (
            <>
              <div className="flex w-full flex-col gap-2">
                <span className="text-sm font-medium leading-5 text-fg">Dividend yield</span>
                <ClearableInput
                  type="text"
                  inputMode="decimal"
                  value={yieldInput}
                  onChange={(v) => {
                    yieldTouchedRef.current = true;
                    setYieldInput(sanitizePercentInput(v));
                  }}
                  placeholder={
                    currentDividendYieldPct != null
                      ? formatPercentInput(currentDividendYieldPct)
                      : "0"
                  }
                  clearLabel="Clear dividend yield"
                  aria-label="Dividend yield (percent)"
                />
                {currentDividendYieldPct != null ? (
                  <p className="text-xs leading-4 text-fg-muted">
                    Portfolio dividend yield: {formatPercentDisplay(currentDividendYieldPct)}
                  </p>
                ) : (
                  <p className="text-xs leading-4 text-fg-muted">No dividend data</p>
                )}
              </div>
              <div className="flex w-full flex-col gap-2">
                <span className="text-sm font-medium leading-5 text-fg">Dividend growth</span>
                <ClearableInput
                  type="text"
                  inputMode="decimal"
                  value={growthInput}
                  onChange={(v) => setGrowthInput(sanitizePercentInput(v))}
                  placeholder={formatPercentInput(GOAL_DEFAULT_DIVIDEND_GROWTH_PCT)}
                  clearLabel="Clear dividend growth"
                  aria-label="Dividend growth (percent)"
                />
                <p className="text-xs leading-4 text-fg-muted">
                  Default {formatPercentDisplay(GOAL_DEFAULT_DIVIDEND_GROWTH_PCT)} annually
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex w-full flex-col gap-2">
                <span className="text-sm font-medium leading-5 text-fg">Returns</span>
                <ClearableInput
                  type="text"
                  inputMode="decimal"
                  value={returnInput}
                  onChange={(v) => setReturnInput(sanitizePercentInput(v))}
                  placeholder={formatPercentInput(defaultReturnPct)}
                  clearLabel="Clear return"
                  aria-label="Annual portfolio return (percent)"
                />
                {returnDefaultHintPct != null ? (
                  <p className="text-xs leading-4 text-fg-muted">
                    Portfolio annualized return: {formatPercentDisplay(returnDefaultHintPct)}
                  </p>
                ) : null}
              </div>

              <GoalSettingRow
                label="Reinvest dividends"
                pressed={reinvestDividends}
                onPressedChange={setReinvestDividends}
              />
            </>
          )}
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
